"""
Unit and integration tests for Hotel Booking Cancellation Prediction API.
Includes tests for automatic calculation of derived features:
- total_stay = stays_in_weekend_nights + stays_in_week_nights
- total_guests = adults + children + babies
- is_family = 1 if (children + babies > 0) else 0
"""
from pathlib import Path
import pytest
from app import create_app
from config import Config
from services.prediction_service import PredictionService
from utils.error_handlers import ModelLoadError
from utils.validators import validate_prediction_input

# 25 raw features coming from frontend (without total_stay, total_guests, is_family)
RAW_FRONTEND_PAYLOAD = {
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


# 2. Valid Prediction Request Test (Raw frontend payload without engineered features)
def test_valid_prediction(client):
    """Test POST /api/predict with raw frontend payload returns HTTP 200."""
    response = client.post("/api/predict", json=RAW_FRONTEND_PAYLOAD)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["prediction"] in (0, 1)
    assert isinstance(data["result"], str)
    assert isinstance(data["cancellation_probability"], float)
    assert 0.0 <= data["cancellation_probability"] <= 1.0


# 3. Automatic Feature Engineering Calculation Test
def test_automatic_feature_engineering_calculation():
    """Verify backend calculates total_stay, total_guests, and is_family accurately."""
    # Case A: 2 adults, 0 children, 0 babies, 1 weekend night, 3 week nights
    payload_a = RAW_FRONTEND_PAYLOAD.copy()
    payload_a["stays_in_weekend_nights"] = 2
    payload_a["stays_in_week_nights"] = 5
    payload_a["adults"] = 2
    payload_a["children"] = 1
    payload_a["babies"] = 1

    is_valid, validated, error = validate_prediction_input(payload_a)
    assert is_valid is True
    assert error is None
    # total_stay = 2 + 5 = 7
    assert validated["total_stay"] == 7.0
    # total_guests = 2 + 1 + 1 = 4
    assert validated["total_guests"] == 4.0
    # is_family = 1 because children (1) + babies (1) > 0
    assert validated["is_family"] == 1

    # Case B: No children or babies -> is_family = 0
    payload_b = RAW_FRONTEND_PAYLOAD.copy()
    payload_b["children"] = 0
    payload_b["babies"] = 0
    is_valid_b, validated_b, _ = validate_prediction_input(payload_b)
    assert is_valid_b is True
    assert validated_b["is_family"] == 0


# 4. Missing Required Field Test
def test_missing_required_field(client):
    """Test POST /api/predict with missing raw frontend fields returns HTTP 400."""
    incomplete_payload = RAW_FRONTEND_PAYLOAD.copy()
    del incomplete_payload["lead_time"]
    del incomplete_payload["hotel"]

    response = client.post("/api/predict", json=incomplete_payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "lead_time" in data["error"]["fields"]
    assert "hotel" in data["error"]["fields"]


# 5. Invalid JSON / Request Body Test
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


# 6. Invalid Numerical Value Test
def test_invalid_numerical_value(client):
    """Test POST /api/predict with negative or invalid numerical values returns HTTP 400."""
    invalid_payload = RAW_FRONTEND_PAYLOAD.copy()
    invalid_payload["lead_time"] = -10  # negative lead_time is invalid
    invalid_payload["adr"] = "not-a-number"  # non-numeric adr

    response = client.post("/api/predict", json=invalid_payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "lead_time" in data["error"]["fields"]
    assert "adr" in data["error"]["fields"]


# 7. Prediction Response Structure Test
def test_prediction_response_structure(client):
    """Test that prediction response matches the expected JSON contract."""
    response = client.post("/api/predict", json=RAW_FRONTEND_PAYLOAD)
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


# 8. 404 Endpoint Test
def test_not_found_endpoint(client):
    """Test non-existent route returns 404 with JSON error format."""
    response = client.get("/api/non-existent-route")
    assert response.status_code == 404
    data = response.get_json()
    assert data["success"] is False
    assert data["error"]["message"] == "Resource not found"


# 9. Model Loading Failure Handling Test
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
