"""
Unit and integration tests for Booking Management endpoints:
- GET /api/bookings (list bookings, pagination, filters)
- GET /api/bookings/<id> (retrieve single booking)
- PATCH/POST /api/bookings/<id>/cancel (cancel booking)
- PATCH/PUT /api/bookings/<id> (edit booking_status only; reject other fields)
"""
import uuid
import pytest
from app import create_app
from config import Config


SAMPLE_BOOKING_UUID = str(uuid.uuid4())

MOCK_BOOKING_RECORD = {
    "id": SAMPLE_BOOKING_UUID,
    "email": "traveler@example.com",
    "hotel": "City Hotel",
    "lead_time": 45,
    "arrival_date_year": 2017,
    "arrival_date_month": "August",
    "arrival_date_week_number": 32,
    "arrival_date_day_of_month": 10,
    "stays_in_weekend_nights": 1,
    "stays_in_week_nights": 2,
    "adults": 2,
    "children": 0,
    "babies": 0,
    "is_repeated_guest": 0,
    "previous_cancellations": 0,
    "previous_bookings_not_canceled": 0,
    "adr": 110.0,
    "required_car_parking_spaces": 0,
    "total_of_special_requests": 1,
    "total_stay": 3,
    "total_guests": 2,
    "is_family": 0,
    "meal": "BB",
    "country": "PRT",
    "market_segment": "Online TA",
    "distribution_channel": "TA/TO",
    "reserved_room_type": "A",
    "deposit_type": "No Deposit",
    "customer_type": "Transient",
    "agent": "9",
    "booking_status": "Confirmed",
}


class MockSupabaseService:
    """Mock Supabase Service for isolated unit testing."""

    def __init__(self, is_available=True):
        self._is_available = is_available
        self.bookings_db = {SAMPLE_BOOKING_UUID: dict(MOCK_BOOKING_RECORD)}

    @property
    def is_available(self):
        return self._is_available

    def get_all_bookings(self, limit=50, offset=0, email=None, status=None, hotel=None):
        if not self.is_available:
            return {"bookings": [], "count": 0, "total": 0, "error": "Database service unavailable"}

        filtered = list(self.bookings_db.values())
        if email:
            filtered = [b for b in filtered if email.lower() in b.get("email", "").lower()]
        if status:
            filtered = [b for b in filtered if status.lower() in b.get("booking_status", "").lower()]
        if hotel:
            filtered = [b for b in filtered if hotel.lower() in b.get("hotel", "").lower()]

        total = len(filtered)
        paginated = filtered[offset: offset + limit]
        return {
            "bookings": paginated,
            "count": len(paginated),
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_booking_by_id(self, booking_id):
        if not self.is_available:
            return None
        return self.bookings_db.get(str(booking_id).strip())

    def update_booking_status(self, booking_id, new_status):
        if not self.is_available:
            return False, None, "Database service is not available"

        clean_id = str(booking_id).strip()
        if clean_id not in self.bookings_db:
            return False, None, f"Booking not found with ID: {clean_id}"

        clean_status = str(new_status).strip()
        if clean_status.lower() in ("canceled", "cancelled"):
            clean_status = "Canceled"
        elif clean_status.lower() == "confirmed":
            clean_status = "Confirmed"

        self.bookings_db[clean_id]["booking_status"] = clean_status
        return True, self.bookings_db[clean_id], None

    def cancel_booking(self, booking_id):
        return self.update_booking_status(booking_id, "Canceled")


@pytest.fixture
def app():
    flask_app = create_app(Config)
    flask_app.config["TESTING"] = True
    flask_app.supabase_service = MockSupabaseService(is_available=True)
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()


# 1. Test GET /api/bookings (list all bookings)
def test_get_all_bookings(client):
    response = client.get("/api/bookings")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "bookings" in data
    assert data["count"] >= 1
    assert data["bookings"][0]["id"] == SAMPLE_BOOKING_UUID


# 2. Test GET /api/bookings with filters
def test_get_all_bookings_with_filters(client):
    # Filter by email
    response = client.get("/api/bookings?email=traveler@example.com")
    assert response.status_code == 200
    data = response.get_json()
    assert data["count"] == 1

    # Filter with non-matching email
    response_none = client.get("/api/bookings?email=nonexistent@example.com")
    assert response_none.status_code == 200
    data_none = response_none.get_json()
    assert data_none["count"] == 0


# 3. Test GET /api/bookings/<id> single booking
def test_get_booking_by_id(client):
    # Valid existing ID
    response = client.get(f"/api/bookings/{SAMPLE_BOOKING_UUID}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["booking"]["email"] == "traveler@example.com"

    # Non-existent UUID
    fake_uuid = str(uuid.uuid4())
    response_404 = client.get(f"/api/bookings/{fake_uuid}")
    assert response_404.status_code == 404
    data_404 = response_404.get_json()
    assert data_404["success"] is False

    # Invalid UUID format
    response_bad = client.get("/api/bookings/not-a-uuid")
    assert response_bad.status_code == 400
    data_bad = response_bad.get_json()
    assert data_bad["success"] is False


# 4. Test cancel booking via dedicated route (PATCH & POST /api/bookings/<id>/cancel)
def test_cancel_booking_dedicated_route(client):
    response = client.patch(f"/api/bookings/{SAMPLE_BOOKING_UUID}/cancel")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["message"] == "Booking status changed to Canceled."
    assert data["booking"]["booking_status"] == "Canceled"

    response_post = client.post(f"/api/bookings/{SAMPLE_BOOKING_UUID}/cancel")
    assert response_post.status_code == 200
    assert response_post.get_json()["booking"]["booking_status"] == "Canceled"


# 5. Test edit booking_status to Canceled via PATCH /api/bookings/<id>
def test_edit_booking_status_to_canceled(client):
    response = client.patch(
        f"/api/bookings/{SAMPLE_BOOKING_UUID}",
        json={"booking_status": "Canceled"}
    )
    assert response.status_code == 200
    assert response.get_json()["booking"]["booking_status"] == "Canceled"


# 6. Test edit booking_status to Confirmed via PUT /api/bookings/<id>
def test_edit_booking_status_to_confirmed(client):
    response = client.put(
        f"/api/bookings/{SAMPLE_BOOKING_UUID}",
        json={"booking_status": "Confirmed"}
    )
    assert response.status_code == 200
    assert response.get_json()["booking"]["booking_status"] == "Confirmed"


# 7. Test rejecting other field edits on PATCH /api/bookings/<id>
def test_reject_other_field_edits(client):
    response = client.patch(
        f"/api/bookings/{SAMPLE_BOOKING_UUID}",
        json={"adr": 150.0, "meal": "HB"}
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "Only 'booking_status' can be edited" in data["error"]["message"]
    assert "adr" in data["error"]["disallowed_fields"]
    assert "meal" in data["error"]["disallowed_fields"]


# 8. Test missing booking_status on PATCH /api/bookings/<id>
def test_missing_booking_status(client):
    response = client.patch(
        f"/api/bookings/{SAMPLE_BOOKING_UUID}",
        json={}
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "Missing required field 'booking_status'" in data["error"]["message"]


# 9. Test service unavailable (when Supabase is down)
def test_database_service_unavailable(app, client):
    app.supabase_service = MockSupabaseService(is_available=False)
    response = client.get("/api/bookings")
    assert response.status_code == 503
    data = response.get_json()
    assert data["success"] is False
    assert "unavailable" in data["error"]["message"].lower()
