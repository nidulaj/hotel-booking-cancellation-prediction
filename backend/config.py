import os
from pathlib import Path
from dotenv import load_dotenv

# Base Directories
BACKEND_DIR = Path(__file__).resolve().parent
BASE_DIR = BACKEND_DIR.parent

# Load environment variables from backend/.env if present
load_dotenv(BACKEND_DIR / ".env")


def resolve_ml_path(target_path_str: str | None, default_subpath: str) -> Path:
    """
    Resolve machine learning artifact path robustly.
    Supports relative paths, case variations (ml vs ML), and optional .joblib extension.
    """
    candidates = []

    if target_path_str:
        user_p = Path(target_path_str)
        candidates.append(user_p if user_p.is_absolute() else (BACKEND_DIR / user_p))
        candidates.append(user_p if user_p.is_absolute() else (BASE_DIR / user_p))

    # Default paths to check
    for base in [BASE_DIR, BACKEND_DIR]:
        candidates.append(base / default_subpath)
        candidates.append(base / (default_subpath + ".joblib"))
        # Check 'ML' vs 'ml'
        if "ml/" in default_subpath or "ML/" in default_subpath:
            alt_subpath = (
                default_subpath.replace("ml/", "ML/")
                if "ml/" in default_subpath
                else default_subpath.replace("ML/", "ml/")
            )
            candidates.append(base / alt_subpath)
            candidates.append(base / (alt_subpath + ".joblib"))

    # Return the first candidate that exists
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    # Fallback to standard base path
    return (BASE_DIR / default_subpath).resolve()


class Config:
    """Application configuration."""

    # Server settings
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1", "t")

    # Logging settings
    LOG_DIR = BACKEND_DIR / "logs"
    LOG_FILE = LOG_DIR / "app.log"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

    # CORS settings
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000",
    )
    CORS_ORIGINS = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    # ML Artifact Paths
    MODEL_PATH = resolve_ml_path(os.getenv("MODEL_PATH"), "ml/models/xgboost_model")
    PREPROCESSOR_PATH = resolve_ml_path(
        os.getenv("PREPROCESSOR_PATH"), "ml/models/preprocessor_unfitted"
    )


class TestConfig(Config):
    """Testing configuration."""

    TESTING = True
    DEBUG = False
    LOG_LEVEL = "WARNING"
