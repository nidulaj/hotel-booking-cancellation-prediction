"""
Booking management API routes:
- GET /api/bookings: List all bookings (with pagination and optional filters)
- GET /api/bookings/<id>: Retrieve single booking details
- PATCH/PUT /api/bookings/<id>: Edit booking (only 'booking_status' can be edited)
- PATCH/POST /api/bookings/<id>/cancel: Convenient shortcut to cancel a booking
"""
import logging
from flask import Blueprint, current_app, jsonify, request
from utils.validators import is_valid_uuid

logger = logging.getLogger(__name__)

booking_bp = Blueprint("bookings", __name__)


@booking_bp.route("", methods=["GET"])
@booking_bp.route("/", methods=["GET"])
def get_all_bookings():
    """
    Retrieve all bookings with optional pagination and filters.
    Query parameters:
    - limit (int, default: 50, max: 200)
    - offset (int, default: 0)
    - email (str, optional: partial/exact email filter)
    - status (str, optional: filter by booking_status e.g. Confirmed, Canceled)
    - hotel (str, optional: filter by hotel name)
    """
    supabase_service = getattr(current_app, "supabase_service", None)
    if not supabase_service or not supabase_service.is_available:
        return jsonify({
            "success": False,
            "error": {
                "message": "Database service is unavailable. Supabase credentials may not be configured."
            }
        }), 503

    try:
        limit = int(request.args.get("limit", 50))
    except (ValueError, TypeError):
        limit = 50

    try:
        offset = int(request.args.get("offset", 0))
    except (ValueError, TypeError):
        offset = 0

    email = request.args.get("email")
    status = request.args.get("status") or request.args.get("booking_status")
    hotel = request.args.get("hotel")

    result = supabase_service.get_all_bookings(
        limit=limit,
        offset=offset,
        email=email,
        status=status,
        hotel=hotel,
    )

    if "error" in result and result["error"]:
        return jsonify({
            "success": False,
            "error": {
                "message": f"Failed to retrieve bookings: {result['error']}"
            }
        }), 500

    return jsonify({
        "success": True,
        "count": result["count"],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
        "bookings": result["bookings"],
    }), 200


@booking_bp.route("/<booking_id>", methods=["GET"])
def get_booking(booking_id: str):
    """
    Retrieve a single booking by ID.
    GET /api/bookings/<booking_id>
    """
    if not is_valid_uuid(booking_id):
        return jsonify({
            "success": False,
            "error": {
                "message": f"Invalid booking ID format: '{booking_id}'. Expected a valid UUID."
            }
        }), 400

    supabase_service = getattr(current_app, "supabase_service", None)
    if not supabase_service or not supabase_service.is_available:
        return jsonify({
            "success": False,
            "error": {
                "message": "Database service is unavailable."
            }
        }), 503

    booking = supabase_service.get_booking_by_id(booking_id)
    if not booking:
        return jsonify({
            "success": False,
            "error": {
                "message": f"Booking not found with ID: {booking_id}"
            }
        }), 404

    return jsonify({
        "success": True,
        "booking": booking
    }), 200


@booking_bp.route("/<booking_id>/cancel", methods=["PATCH", "POST"])
def cancel_booking(booking_id: str):
    """
    Cancel a booking by setting booking_status = 'Canceled'.
    PATCH/POST /api/bookings/<booking_id>/cancel
    """
    if not is_valid_uuid(booking_id):
        return jsonify({
            "success": False,
            "error": {
                "message": f"Invalid booking ID format: '{booking_id}'. Expected a valid UUID."
            }
        }), 400

    supabase_service = getattr(current_app, "supabase_service", None)
    if not supabase_service or not supabase_service.is_available:
        return jsonify({
            "success": False,
            "error": {
                "message": "Database service is unavailable."
            }
        }), 503

    success, updated_record, error_msg = supabase_service.cancel_booking(booking_id)

    if not success:
        if error_msg and "not found" in error_msg.lower():
            return jsonify({
                "success": False,
                "error": {
                    "message": error_msg
                }
            }), 404
        return jsonify({
            "success": False,
            "error": {
                "message": error_msg or "Failed to cancel booking."
            }
        }), 500

    return jsonify({
        "success": True,
        "message": "Booking status changed to Canceled.",
        "booking": updated_record
    }), 200


@booking_bp.route("/<booking_id>", methods=["PATCH", "PUT"])
def edit_booking(booking_id: str):
    """
    Edit booking: ONLY 'booking_status' is editable.
    PATCH/PUT /api/bookings/<booking_id>
    Body: {"booking_status": "Canceled"}
    """
    if not is_valid_uuid(booking_id):
        return jsonify({
            "success": False,
            "error": {
                "message": f"Invalid booking ID format: '{booking_id}'. Expected a valid UUID."
            }
        }), 400

    raw_data = request.get_json(silent=True)
    if raw_data is None:
        raw_data = {}

    # Check if client tried to edit fields other than booking_status
    disallowed_fields = [k for k in raw_data.keys() if k != "booking_status"]
    if disallowed_fields:
        return jsonify({
            "success": False,
            "error": {
                "message": "Only 'booking_status' can be edited. Other booking fields cannot be modified.",
                "disallowed_fields": disallowed_fields
            }
        }), 400

    new_status = raw_data.get("booking_status")
    if not new_status or not str(new_status).strip():
        return jsonify({
            "success": False,
            "error": {
                "message": "Missing required field 'booking_status'. Only 'booking_status' can be edited."
            }
        }), 400

    supabase_service = getattr(current_app, "supabase_service", None)
    if not supabase_service or not supabase_service.is_available:
        return jsonify({
            "success": False,
            "error": {
                "message": "Database service is unavailable."
            }
        }), 503

    success, updated_record, error_msg = supabase_service.update_booking_status(
        booking_id=booking_id,
        new_status=str(new_status).strip()
    )

    if not success:
        if error_msg and "not found" in error_msg.lower():
            return jsonify({
                "success": False,
                "error": {
                    "message": error_msg
                }
            }), 404
        return jsonify({
            "success": False,
            "error": {
                "message": error_msg or "Failed to update booking status."
            }
        }), 500

    return jsonify({
        "success": True,
        "message": f"Booking status updated to '{updated_record.get('booking_status')}'.",
        "booking": updated_record
    }), 200

