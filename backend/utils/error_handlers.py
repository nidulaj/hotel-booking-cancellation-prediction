"""
Centralized error handling and custom exceptions for the Flask application.
"""
import logging
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base API Exception."""

    def __init__(self, message: str, status_code: int = 400, fields: list[str] | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.fields = fields or []


class ValidationError(APIError):
    """Raised when input validation fails."""

    def __init__(self, message: str = "Invalid input", fields: list[str] | None = None):
        super().__init__(message=message, status_code=400, fields=fields)


class ModelLoadError(APIError):
    """Raised when machine learning artifacts fail to load."""

    def __init__(self, message: str = "Machine learning model unavailable"):
        super().__init__(message=message, status_code=500)


class ModelPredictionError(APIError):
    """Raised when prediction or preprocessing fails during inference."""

    def __init__(self, message: str = "Prediction failed."):
        super().__init__(message=message, status_code=500)


def register_error_handlers(app: Flask) -> None:
    """Register application-wide error handlers."""

    @app.errorhandler(APIError)
    def handle_api_error(error: APIError):
        error_body = {"message": error.message}
        if error.fields:
            error_body["fields"] = error.fields
        return jsonify({"success": False, "error": error_body}), error.status_code

    @app.errorhandler(400)
    def handle_bad_request(error):
        msg = "Bad request"
        if hasattr(error, "description") and error.description:
            msg = str(error.description)
        return jsonify({"success": False, "error": {"message": msg}}), 400

    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({"success": False, "error": {"message": "Resource not found"}}), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        return jsonify({"success": False, "error": {"message": "Method not allowed"}}), 405

    @app.errorhandler(500)
    def handle_internal_server_error(error):
        logger.error("Internal Server Error: %s", error, exc_info=True)
        return jsonify({"success": False, "error": {"message": "Internal server error."}}), 500

    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        # Pass through HTTPExceptions like 404, 405 if not handled
        if isinstance(error, HTTPException):
            return (
                jsonify({"success": False, "error": {"message": error.description}}),
                error.code or 500,
            )

        logger.error("Unhandled Exception: %s", error, exc_info=True)
        return jsonify({"success": False, "error": {"message": "An unexpected error occurred."}}), 500
