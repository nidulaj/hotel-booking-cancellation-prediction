"""
Prediction and health check API routes.
"""
import logging
from flask import Blueprint, current_app, jsonify, request
from utils.error_handlers import ValidationError
from utils.validators import validate_prediction_input

logger = logging.getLogger(__name__)

prediction_bp = Blueprint("prediction", __name__)


@prediction_bp.route("/health", methods=["GET"])
def health():
    """
    Health check endpoint.
    GET /api/health (or /health)
    """
    model_loaded = False
    if hasattr(current_app, "prediction_service") and current_app.prediction_service:
        model_loaded = current_app.prediction_service.is_loaded

    return jsonify({
        "success": True,
        "message": "Backend is running.",
        "model_loaded": model_loaded
    }), 200


@prediction_bp.route("/predict", methods=["POST"])
def predict():
    """
    Predict hotel booking cancellation.
    POST /api/predict
    """
    if not request.is_json:
        raise ValidationError("Request body must be valid JSON", fields=[])

    raw_data = request.get_json(silent=True)
    if raw_data is None:
        raise ValidationError("Invalid JSON payload", fields=[])

    is_valid, validated_data, error_info = validate_prediction_input(raw_data)
    if not is_valid and error_info:
        err = error_info["error"]
        raise ValidationError(err["message"], fields=err.get("fields", []))

    service = getattr(current_app, "prediction_service", None)
    if not service:
        from utils.error_handlers import ModelPredictionError
        raise ModelPredictionError("Prediction service is not initialized.")

    result = service.predict(validated_data)
    return jsonify(result), 200
