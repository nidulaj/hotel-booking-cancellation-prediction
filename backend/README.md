# Hotel Booking Cancellation Prediction - Flask Backend

A modular Flask REST API for predicting hotel booking cancellations using an XGBoost classification pipeline.

---

## 1. Overview & Architecture

The backend acts strictly as an inference layer for the project's saved machine learning models. It does not retrain or alter any model parameters or preprocessing pipelines.

### Inference Workflow
```
Raw Frontend Request (JSON)
           ↓
    Flask API Endpoint
           ↓
   Input Validation Layer
           ↓
  Pretrained Scikit-Learn Pipeline
  (Fitted Imputation, Scaling, One-Hot Encoding)
           ↓
  Tuned XGBoost Classifier
           ↓
 Prediction & Cancellation Probability
           ↓
     JSON Response
```

---

## 2. Directory Structure

```
backend/
├── app.py                      # Application factory & entry point
├── config.py                   # Configuration & path management
├── requirements.txt            # Python dependencies
├── README.md                   # Backend documentation
├── .env                        # Environment variables (local)
├── .env.example                # Example environment variables
│
├── routes/
│   ├── __init__.py
│   ├── prediction_routes.py    # /api/predict & /api/health routes
│   └── booking_routes.py       # /api/bookings CRUD & cancellation routes
│
├── services/
│   ├── __init__.py
│   ├── prediction_service.py   # Model loading and inference service
│   └── supabase_service.py     # Supabase persistence and booking management
│
├── schemas/
│   ├── __init__.py
│   └── prediction_schema.py    # Approved feature list and validation sets
│
├── utils/
│   ├── __init__.py
│   ├── validators.py           # Robust input validation & feature calculation
│   └── error_handlers.py       # Centralized JSON error handlers
│
├── logs/
│   └── app.log                 # Structured application log file
│
└── tests/
    ├── __init__.py
    ├── test_prediction.py      # Automated prediction test suite
    └── test_bookings.py        # Automated booking management test suite
```

---

## 3. ML Artifacts & Source of Truth

The single source of truth for the machine learning artifacts remains in `ml/models`:
- **Model**: `ml/models/xgboost_model` (`xgboost_model.joblib`)
  - A complete `sklearn.pipeline.Pipeline` containing the fitted preprocessing step (`ColumnTransformer`) followed by the tuned `XGBClassifier`.
- **Preprocessor Reference**: `ml/models/preprocessor_unfitted` (`preprocessor_unfitted.joblib`)
  - The shared baseline preprocessing architecture used during model development.

> **Note on Pipeline Execution:** Because `xgboost_model.joblib` already contains the fitted preprocessing transformers, raw features are passed directly to the model pipeline to avoid double preprocessing.

---

## 4. Installation & Setup

### Prerequisites
- Python 3.10+ (Python 3.12 recommended)

### 1. Install Dependencies
From the `backend` directory:
```bash
pip install -r requirements.txt
```

### 2. Configure Environment (Optional)
A `.env` file is provided with default settings:
```ini
FLASK_APP=app.py
HOST=127.0.0.1
PORT=5000
FLASK_DEBUG=1
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000
MODEL_PATH=../ml/models/xgboost_model
PREPROCESSOR_PATH=../ml/models/preprocessor_unfitted
```

### 3. Run the Server
```bash
python app.py
```
The server will start on: **`http://localhost:5000`**

---

## 5. Port Configuration

| Service | Port | Description |
|---|---|---|
| **Flask Backend** | `5000` | API (`http://localhost:5000`) |
| **Vite / React Frontend** | `5173` | Allowed by CORS (`http://localhost:5173`) |
| **Next.js Frontend** | `3000` | Allowed by CORS (`http://localhost:3000`) |

---

## 6. API Endpoints

### 1. Health Check
- **URL**: `GET /api/health` (also available at `GET /health`)
- **Description**: Verifies API status and ML model availability.
- **Response**:
```json
{
  "success": true,
  "message": "Backend is running.",
  "model_loaded": true
}
```

---

### 2. Cancellation Prediction (with Supabase History Lookup)
- **URL**: `POST /api/predict`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
> **Automated Fields**:
> 1. Provide `"email"`, and the backend queries your Supabase `bookings` table to automatically populate `is_repeated_guest`, `previous_cancellations`, and `previous_bookings_not_canceled`.
> 2. `total_stay`, `total_guests`, and `is_family` are engineered features calculated automatically by the backend.
> 3. The new booking is automatically saved to the Supabase `bookings` table with an assigned UUID.
```json
{
  "email": "customer@example.com",
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
  "agent": "9"
}
```

- **Successful Response (HTTP 200)**:
```json
{
  "booking_id": "3b5d5b1a-aa49-4b88-8f7e-c88d92e9062c",
  "cancellation_probability": 0.42,
  "customer_history": {
    "is_repeated_guest": 0,
    "previous_bookings_not_canceled": 0,
    "previous_cancellations": 0,
    "total_previous_bookings": 0
  },
  "prediction": 0,
  "result": "Booking is unlikely to be cancelled.",
  "saved_to_database": true,
  "success": true
}
```

If the booking is likely to be cancelled:
```json
{
  "success": true,
  "prediction": 1,
  "result": "Booking is likely to be cancelled.",
  "cancellation_probability": 0.82
}
```

---

### 3. Display All Bookings
- **URL**: `GET /api/bookings`
- **Query Parameters (Optional)**:
  - `limit` (int, default: 50, max: 200)
  - `offset` (int, default: 0)
  - `email` (string, partial or exact customer email search)
  - `status` (string, filter by `booking_status` e.g. `Confirmed`, `Canceled`)
  - `hotel` (string, filter by hotel e.g. `Resort Hotel`, `City Hotel`)
- **Successful Response (HTTP 200)**:
```json
{
  "success": true,
  "count": 2,
  "total": 2,
  "limit": 50,
  "offset": 0,
  "bookings": [
    {
      "id": "3b5d5b1a-aa49-4b88-8f7e-c88d92e9062c",
      "email": "customer@example.com",
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
      "adr": 120.5,
      "booking_status": "Confirmed",
      "total_stay": 4,
      "total_guests": 2,
      "is_family": 0,
      "created_at": "2026-10-05T08:00:00+00:00"
    }
  ]
}
```

---

### 4. Display Single Booking
- **URL**: `GET /api/bookings/<id>`
- **Successful Response (HTTP 200)**:
```json
{
  "success": true,
  "booking": {
    "id": "3b5d5b1a-aa49-4b88-8f7e-c88d92e9062c",
    "email": "customer@example.com",
    "booking_status": "Confirmed",
    "hotel": "Resort Hotel",
    "total_stay": 4,
    "total_guests": 2
  }
}
```

---

### 5. Edit Booking (Only `booking_status` is Editable)

In accordance with business rules, raw booking details (such as `lead_time`, `adr`, `meal`, `stays_*`, etc.) cannot be edited. **Only `booking_status` can be edited.**

#### Edit via PATCH / PUT
- **URL**: `PATCH /api/bookings/<id>` (or `PUT /api/bookings/<id>`)
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "booking_status": "Canceled"
}
```
*(Note: Attempting to edit fields other than `booking_status` will be rejected with a `400 Bad Request`).*

#### Dedicated Cancellation Shortcut
- **URL**: `PATCH /api/bookings/<id>/cancel` (or `POST /api/bookings/<id>/cancel`)
- **Headers**: *(none required)*
- **Body**: *(none required)*

- **Successful Response (HTTP 200)**:
```json
{
  "success": true,
  "message": "Booking status changed to Canceled.",
  "booking": {
    "id": "3b5d5b1a-aa49-4b88-8f7e-c88d92e9062c",
    "email": "customer@example.com",
    "hotel": "Resort Hotel",
    "lead_time": 50,
    "booking_status": "Canceled",
    "adr": 120.5,
    "total_stay": 4,
    "total_guests": 2
  }
}
```

---

## 7. Input Validation & Error Responses

All errors return JSON with HTTP 4xx/5xx status codes (no HTML error pages or internal stack traces).

### Missing Required Fields (HTTP 400)
```json
{
  "success": false,
  "error": {
    "message": "Missing required fields",
    "fields": [
      "lead_time",
      "hotel"
    ]
  }
}
```

### Invalid Field Types / Values (HTTP 400)
```json
{
  "success": false,
  "error": {
    "message": "Invalid input",
    "fields": [
      "lead_time",
      "adr"
    ]
  }
}
```

### Route Not Found (HTTP 404)
```json
{
  "success": false,
  "error": {
    "message": "Resource not found"
  }
}
```

---

## 8. Running Automated Tests

To run the complete automated test suite:
```bash
pytest backend/tests/ -v
```

The test suites validate:
- **Prediction Suite (`test_prediction.py`)**:
  1. Health check endpoints (`/api/health` and `/health`)
  2. Valid prediction with XGBoost pipeline
  3. Automatic feature engineering (`total_stay`, `total_guests`, `is_family`)
  4. Missing required frontend fields
  5. Malformed/non-JSON requests
  6. Numerical range boundaries and validation
  7. Centralized 404 JSON formatting
  8. Graceful ML artifact failure handling
- **Booking Management Suite (`test_bookings.py`)**:
  1. Listing all bookings (`GET /api/bookings`) with pagination and filtering
  2. Retrieving single booking (`GET /api/bookings/<id>`)
  3. Cancelling booking via dedicated route (`PATCH /api/bookings/<id>/cancel`)
  4. Cancelling booking via direct status update (`PATCH /api/bookings/<id>`)
  5. Rejecting other field edits with 400 Bad Request
  6. Service availability handling (Supabase offline)

