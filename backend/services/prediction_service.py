"""
PredictionService: Encapsulates loading of ML artifacts, input preprocessing,
and XGBoost prediction/probability generation.
"""
import ctypes
import logging
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd
from schemas.prediction_schema import (
    ALL_FEATURES,
    CATEGORICAL_FEATURES,
)
from utils.error_handlers import ModelLoadError, ModelPredictionError

logger = logging.getLogger(__name__)


def _patch_xgboost_gpu_to_cpu_deserialization():
    """
    Safely patch XGBoost's Booster.__setstate__ to handle models serialized
    with GPU parameters (cuda / grow_gpu_hist) when loading on a CPU-only environment.
    """
    try:
        import xgboost.core as core

        orig_setstate = core.Booster.__setstate__

        def safe_setstate(self, state: Dict) -> None:
            handle = state.get("handle")
            if handle is not None and isinstance(handle, (bytearray, bytes)):
                buf = handle
                # Check if buffer was saved with GPU/cuda configuration
                p = buf.find(b"Model{")
                if p != -1 and (b"grow_gpu_hist" in buf or b"cuda" in buf):
                    try:
                        # Extract the Model object slice
                        model_bytes = bytearray(buf[p + 5 : -1])
                        dmats = core.c_array(ctypes.c_void_p, [])
                        h = ctypes.c_void_p()
                        core._check_call(
                            core._LIB.XGBoosterCreate(dmats, core.c_bst_ulong(0), ctypes.byref(h))
                        )
                        length = core.c_bst_ulong(len(model_bytes))
                        ptr = (ctypes.c_char * len(model_bytes)).from_buffer(model_bytes)
                        ret = core._LIB.XGBoosterLoadModelFromBuffer(h, ptr, length)
                        if ret == 0:
                            state["handle"] = h
                            self.__dict__.update(state)
                            return
                    except Exception as err:
                        logger.warning(
                            "Direct Model buffer load fallback failed, falling back to default: %s",
                            err,
                        )

            return orig_setstate(self, state)

        core.Booster.__setstate__ = safe_setstate
    except ImportError:
        pass


class PredictionService:
    """Service responsible for ML model inference and artifact lifecycle."""

    def __init__(self, model_path: Path, preprocessor_path: Path):
        self.model_path = model_path
        self.preprocessor_path = preprocessor_path
        self.model = None
        self.preprocessor = None
        self.is_pipeline = False
        self.has_preprocessing_step = False
        self.is_loaded = False

    def load_artifacts(self) -> None:
        """
        Load XGBoost model and preprocessor artifacts.
        Fails clearly if either artifact cannot be found or loaded.
        """
        logger.info("Initializing ML artifacts...")

        if not self.model_path.exists():
            msg = f"Model artifact not found at {self.model_path}"
            logger.error(msg)
            raise ModelLoadError(msg)

        if not self.preprocessor_path.exists():
            msg = f"Preprocessor artifact not found at {self.preprocessor_path}"
            logger.error(msg)
            raise ModelLoadError(msg)

        # Apply compatibility patch before loading XGBoost models
        _patch_xgboost_gpu_to_cpu_deserialization()

        # 1. Load Preprocessor
        try:
            logger.info("Loading preprocessor artifact from %s", self.preprocessor_path)
            self.preprocessor = joblib.load(self.preprocessor_path)
            logger.info("Loaded preprocessor type: %s", type(self.preprocessor).__name__)
        except Exception as e:
            msg = f"Failed to load preprocessor artifact: {e}"
            logger.error(msg, exc_info=True)
            raise ModelLoadError(msg) from e

        # 2. Load XGBoost Model
        try:
            logger.info("Loading model artifact from %s", self.model_path)
            self.model = joblib.load(self.model_path)
            logger.info("Loaded model type: %s", type(self.model).__name__)
        except Exception as e:
            msg = f"Failed to load model artifact: {e}"
            logger.error(msg, exc_info=True)
            raise ModelLoadError(msg) from e

        # 3. Inspect Model Architecture
        if hasattr(self.model, "steps"):
            self.is_pipeline = True
            step_names = [name for name, _ in self.model.steps]
            logger.info("Model is a Pipeline with steps: %s", step_names)

            if "preprocess" in self.model.named_steps or any(
                "preprocess" in s.lower() for s in step_names
            ):
                self.has_preprocessing_step = True
                logger.info(
                    "Model pipeline contains an internal preprocessing transformer. "
                    "Raw features will be passed directly without redundant preprocessing."
                )
            else:
                logger.info("Pipeline does not contain a dedicated preprocessing step.")
        else:
            self.is_pipeline = False
            self.has_preprocessing_step = False
            logger.info(
                "Model is a standalone classifier. "
                "Separate preprocessor transformer will be evaluated."
            )

        self.is_loaded = True
        logger.info("ML artifacts successfully loaded and ready for inference.")

    def predict(self, raw_input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute prediction pipeline:
        Raw input dict -> Validated DataFrame -> (Preprocessing if standalone) -> Model -> Prediction & Probability.
        """
        if not self.is_loaded or self.model is None:
            raise ModelPredictionError("Model is not loaded or unavailable.")

        try:
            # 1. Explicitly construct DataFrame with canonical feature list and order
            df = pd.DataFrame([raw_input_data])[ALL_FEATURES]

            # 2. Ensure categorical types are strings (specifically agent and string fields)
            for col in CATEGORICAL_FEATURES:
                df[col] = df[col].astype(str)

            # 3. Preprocessing and inference
            if self.is_pipeline and self.has_preprocessing_step:
                # The pipeline already contains the fitted preprocessing step
                prediction_arr = self.model.predict(df)

                if hasattr(self.model, "predict_proba"):
                    proba_arr = self.model.predict_proba(df)
                    cancellation_probability = float(proba_arr[0][1])
                else:
                    cancellation_probability = float(prediction_arr[0])
            else:
                # Standalone model requiring external preprocessor
                if hasattr(self.preprocessor, "transform"):
                    features_transformed = self.preprocessor.transform(df)
                else:
                    raise ModelPredictionError(
                        "Preprocessor does not support transform (may be unfitted)."
                    )

                prediction_arr = self.model.predict(features_transformed)

                if hasattr(self.model, "predict_proba"):
                    proba_arr = self.model.predict_proba(features_transformed)
                    cancellation_probability = float(proba_arr[0][1])
                else:
                    cancellation_probability = float(prediction_arr[0])

            # 4. Format outputs
            prediction_val = int(prediction_arr[0])
            result_text = (
                "Booking is likely to be cancelled."
                if prediction_val == 1
                else "Booking is unlikely to be cancelled."
            )

            # Round probability to 2 decimal places to match project specifications
            formatted_prob = round(cancellation_probability, 2)

            return {
                "success": True,
                "prediction": prediction_val,
                "result": result_text,
                "cancellation_probability": formatted_prob,
            }

        except Exception as e:
            logger.error("Error during prediction execution: %s", e, exc_info=True)
            if isinstance(e, ModelPredictionError):
                raise
            raise ModelPredictionError(f"Prediction execution failed: {str(e)}") from e
