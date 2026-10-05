"""
Prediction and health check API routes with Supabase customer history integration.
"""
import logging
from flask import Blueprint, current_app, jsonify, request
from utils.error_handlers import ModelPredictionError, ValidationError
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

    supabase_available = False
    if hasattr(current_app, "supabase_service") and current_app.supabase_service:
        supabase_available = current_app.supabase_service.is_available

    return jsonify({
        "success": True,
        "message": "Backend is running.",
        "model_loaded": model_loaded,
        "database_connected": supabase_available
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

    # 1. Supabase Customer History Lookup via Email
    email = validated_data.get("email")
    supabase_service = getattr(current_app, "supabase_service", None)
    customer_history = None

    if email and supabase_service and supabase_service.is_available:
        customer_history = supabase_service.get_customer_history(email)
        validated_data["is_repeated_guest"] = customer_history["is_repeated_guest"]
        validated_data["previous_cancellations"] = customer_history["previous_cancellations"]
        validated_data["previous_bookings_not_canceled"] = customer_history["previous_bookings_not_canceled"]
    else:
        # Fallbacks if email not provided or Supabase unavailable
        validated_data.setdefault("is_repeated_guest", 0)
        validated_data.setdefault("previous_cancellations", 0)
        validated_data.setdefault("previous_bookings_not_canceled", 0)

    # 2. Prediction execution
    service = getattr(current_app, "prediction_service", None)
    if not service:
        raise ModelPredictionError("Prediction service is not initialized.")

    result = service.predict(validated_data)

    # 3. Attach customer history summary to response
    if customer_history:
        result["customer_history"] = customer_history

    # 4. Persist booking to Supabase if email provided
    if email and supabase_service and supabase_service.is_available:
        booking_payload = dict(validated_data)
        if "booking_status" not in booking_payload:
            booking_payload["booking_status"] = "Confirmed"
        saved_rec = supabase_service.save_booking(booking_payload)
        if saved_rec and "id" in saved_rec:
            result["booking_id"] = saved_rec["id"]
            result["saved_to_database"] = True

    return jsonify(result), 200
