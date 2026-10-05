"""
Main Flask application entry point.
"""
import logging
import os
import sys
from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes.prediction_routes import prediction_bp
from services.prediction_service import PredictionService
from services.supabase_service import SupabaseService
from utils.error_handlers import register_error_handlers


def setup_logging(app: Flask, config_class=Config) -> None:
    """Configure structured logging to file and console."""
    log_dir = config_class.LOG_DIR
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = config_class.LOG_FILE

    log_level = getattr(logging, config_class.LOG_LEVEL, logging.INFO)

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s (%(process)d): %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Avoid adding duplicate handlers if setup_logging is called multiple times
    if not any(isinstance(h, logging.FileHandler) for h in app.logger.handlers):
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)

    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler) for h in app.logger.handlers):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        app.logger.addHandler(console_handler)

    app.logger.setLevel(log_level)
    app.logger.info("Logging initialized. Writing logs to %s", log_file)


def create_app(config_class=Config) -> Flask:
    """Application factory for the Flask backend."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 1. Setup logging
    setup_logging(app, config_class)

    # 2. Configure CORS
    CORS(
        app,
        resources={r"/*": {"origins": config_class.CORS_ORIGINS}},
        supports_credentials=True,
    )
    app.logger.info("CORS initialized with allowed origins: %s", config_class.CORS_ORIGINS)

    # 3. Register centralized error handlers
    register_error_handlers(app)

    # 4. Register Blueprints
    app.register_blueprint(prediction_bp, url_prefix="/api")

    # Convenience root and health routes
    @app.route("/", methods=["GET"])
    def root():
        return jsonify({
            "status": "online",
            "message": "Hotel Booking Cancellation Prediction API is running!",
            "endpoints": {
                "health": "/api/health",
                "predict": "/api/predict"
            }
        }), 200

    @app.route("/health", methods=["GET"])
    def root_health():
        return jsonify({
            "success": True,
            "message": "Backend is running."
        }), 200

    # 5. Initialize Prediction Service and Supabase Service
    app.supabase_service = SupabaseService(
        url=config_class.SUPABASE_URL,
        key=config_class.SUPABASE_KEY,
    )

    app.prediction_service = PredictionService(
        model_path=config_class.MODEL_PATH,
        preprocessor_path=config_class.PREPROCESSOR_PATH,
    )

    if not app.config.get("TESTING", False):
        try:
            app.prediction_service.load_artifacts()
            app.logger.info("PredictionService initialized and artifacts verified.")
        except Exception as e:
            app.logger.critical(
                "CRITICAL: Failed to load machine learning artifacts at startup: %s",
                e,
                exc_info=True,
            )
            # Fail clearly at startup if artifacts cannot be loaded
            raise SystemExit(f"Startup Error: ML artifact loading failed: {e}") from e

    return app


# Create default application instance
app = create_app(Config)


if __name__ == "__main__":
    host = Config.HOST
    port = Config.PORT
    debug = Config.DEBUG
    print(f"\n==================================================")
    print(f" Hotel Booking Cancellation Prediction API")
    print(f" Server running at: http://{host}:{port}")
    print(f" Allowed CORS Origins: {Config.CORS_ORIGINS}")
    print(f" Model Path: {Config.MODEL_PATH}")
    print(f" Preprocessor Path: {Config.PREPROCESSOR_PATH}")
    print(f"==================================================\n")
    app.run(host=host, port=port, debug=debug)