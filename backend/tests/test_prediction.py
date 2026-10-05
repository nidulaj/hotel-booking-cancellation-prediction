"""
Unit and integration tests for Hotel Booking Cancellation Prediction API.
"""
from pathlib import Path
import pytest
from app import create_app
from config import Config, TestConfig
from services.prediction_service import PredictionService
from utils.error_handlers import ModelLoadError

VALID_PAYLOAD = {
    "hotel": "Resort Hotel",
    "lead_time": 50,
    "arrival_date_year": 2017,
    "arrival_date_month": "July",
    "arrival_date_week_number": 27,
    "arrival_date_day_of_month": 5,
    "stays_in_weekend_nights": 1,
    "stays_in_week_nights": 3,
    "adults": 2,
    "children": 0,
    "babies": 0,
    "is_repeated_guest": 0,
    "previous_cancellations": 0,
    "previous_bookings_not_canceled": 0,
    "adr": 120.5,
    "required_car_parking_spaces": 0,
    "total_of_special_requests": 1,
    "total_stay": 4,
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
}


@pytest.fixture(scope="module")
def app():
    """Create application instance for testing with actual loaded model."""
    flask_app = create_app(Config)
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture
def client(app):
    """Test client."""
    return app.test_client()


# 1. Health Endpoint Test
def test_health_check(client):
    """Test GET /api/health returns HTTP 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["message"] == "Backend is running."
    assert "model_loaded" in data


def test_root_health_check(client):
    """Test GET /health returns HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True


# 2. Valid Prediction Request Test
def test_valid_prediction(client):
    """Test POST /api/predict with valid payload returns HTTP 200."""
    response = client.post("/api/predict", json=VALID_PAYLOAD)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["prediction"] in (0, 1)
    assert isinstance(data["result"], str)
    assert isinstance(data["cancellation_probability"], float)
    assert 0.0 <= data["cancellation_probability"] <= 1.0


# 3. Missing Required Field Test
def test_missing_required_field(client):
    """Test POST /api/predict with missing required fields returns HTTP 400."""
    incomplete_payload = VALID_PAYLOAD.copy()
    del incomplete_payload["lead_time"]
    del incomplete_payload["hotel"]

    response = client.post("/api/predict", json=incomplete_payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "lead_time" in data["error"]["fields"]
    assert "hotel" in data["error"]["fields"]


# 4. Invalid JSON / Request Body Test
def test_invalid_json_request(client):
    """Test POST /api/predict with non-JSON or empty payload returns HTTP 400."""
    # Test empty payload
    response = client.post("/api/predict", data="")
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False

    # Test non-JSON plain text
    response = client.post(
        "/api/predict",
        data="just a plain string",
        content_type="text/plain"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False


# 5. Invalid Numerical Value Test
def test_invalid_numerical_value(client):
    """Test POST /api/predict with negative or invalid numerical values returns HTTP 400."""
    invalid_payload = VALID_PAYLOAD.copy()
    invalid_payload["lead_time"] = -10  # negative lead_time is invalid
    invalid_payload["adr"] = "not-a-number"  # non-numeric adr

    response = client.post("/api/predict", json=invalid_payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "lead_time" in data["error"]["fields"]
    assert "adr" in data["error"]["fields"]


# 6. Prediction Response Structure Test
def test_prediction_response_structure(client):
    """Test that prediction response matches the expected JSON contract."""
    response = client.post("/api/predict", json=VALID_PAYLOAD)
    assert response.status_code == 200
    data = response.get_json()

    # Exact expected keys
    expected_keys = {"success", "prediction", "result", "cancellation_probability"}
    assert set(data.keys()) == expected_keys
    assert isinstance(data["prediction"], int)
    assert data["prediction"] in (0, 1)

    if data["prediction"] == 1:
        assert data["result"] == "Booking is likely to be cancelled."
    else:
        assert data["result"] == "Booking is unlikely to be cancelled."


# 7. 404 Endpoint Test
def test_not_found_endpoint(client):
    """Test non-existent route returns 404 with JSON error format."""
    response = client.get("/api/non-existent-route")
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["message"] == "Resource not found"


# 8. Model Loading Failure Handling Test
def test_model_loading_failure():
    """Test that PredictionService raises ModelLoadError for non-existent paths."""
    fake_model_path = Path("/path/to/nonexistent_model.joblib")
    fake_preprocessor_path = Path("/path/to/nonexistent_preprocessor.joblib")

    service = PredictionService(
        model_path=fake_model_path,
        preprocessor_path=fake_preprocessor_path
    )

    with pytest.raises(ModelLoadError) as exc_info:
        service.load_artifacts()

    assert "not found" in str(exc_info.value).lower()
