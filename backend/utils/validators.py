"""
Validation utilities for the prediction endpoint.
Validates raw frontend inputs and calculates engineered features:
- total_stay = stays_in_weekend_nights + stays_in_week_nights
- total_guests = adults + children + babies
- is_family = 1 if (children + babies > 0) else 0
"""
import math
import re
from typing import Any, Dict, List, Tuple
from schemas.prediction_schema import (
    ALL_FEATURES,
    AUTO_POPULATED_FEATURES,
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
    DATABASE_HISTORY_FEATURES,
    DERIVED_FEATURES,
    FRONTEND_REQUIRED_FEATURES,
    NUMERICAL_FEATURES,
    VALID_CUSTOMER_TYPES,
    VALID_DEPOSIT_TYPES,
    VALID_HOTELS,
    VALID_MONTHS,
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_prediction_input(data: Any) -> Tuple[bool, Dict[str, Any] | None, Dict[str, Any] | None]:
    """
    Validate raw prediction input dictionary and compute derived features.

    Returns:
        (is_valid, validated_data, error_response_dict)
    """
    if not isinstance(data, dict) or not data:
        return False, None, {
            "success": False,
            "error": {
                "message": "Request body must be a non-empty JSON object",
                "fields": []
            }
        }

    missing_fields: List[str] = []
    invalid_fields: List[str] = []
    validated: Dict[str, Any] = {}

    # Check for missing required frontend fields
    for field in FRONTEND_REQUIRED_FEATURES:
        if field not in data or data[field] is None:
            missing_fields.append(field)

    # Email check: Either email must be provided for Supabase lookup,
    # OR historical columns must be provided directly.
    has_email = "email" in data and bool(data["email"])
    has_history = all(f in data and data[f] is not None for f in DATABASE_HISTORY_FEATURES)

    if not has_email and not has_history:
        missing_fields.append("email")

    if missing_fields:
        return False, None, {
            "success": False,
            "error": {
                "message": "Missing required fields",
                "fields": missing_fields
            }
        }

    # Validate email format if provided
    if has_email:
        raw_email = str(data["email"]).strip()
        if not EMAIL_REGEX.match(raw_email):
            invalid_fields.append("email")
        else:
            validated["email"] = raw_email.lower()

    # Validate numerical fields required from frontend
    frontend_numerical = [f for f in NUMERICAL_FEATURES if f not in AUTO_POPULATED_FEATURES]
    for field in frontend_numerical:
        val = data.get(field)
        try:
            if isinstance(val, bool):
                invalid_fields.append(field)
                continue
            num_val = float(val)
            if math.isnan(num_val) or math.isinf(num_val):
                invalid_fields.append(field)
                continue

            # Additional domain boundaries check
            if field in ("lead_time", "stays_in_weekend_nights", "stays_in_week_nights",
                         "adults", "children", "babies", "required_car_parking_spaces",
                         "total_of_special_requests"):
                if num_val < 0:
                    invalid_fields.append(field)
                    continue

            if field == "arrival_date_year" and (num_val < 2000 or num_val > 2100):
                invalid_fields.append(field)
                continue

            if field == "arrival_date_week_number" and (num_val < 1 or num_val > 53):
                invalid_fields.append(field)
                continue

            if field == "arrival_date_day_of_month" and (num_val < 1 or num_val > 31):
                invalid_fields.append(field)
                continue

            if field == "adr" and num_val < -100:
                invalid_fields.append(field)
                continue

            validated[field] = num_val
        except (ValueError, TypeError):
            invalid_fields.append(field)

    # Validate manual history values if provided directly
    if "is_repeated_guest" in data and data["is_repeated_guest"] is not None:
        val = data["is_repeated_guest"]
        if val in (0, 1, 0.0, 1.0, "0", "1", True, False):
            validated["is_repeated_guest"] = 1 if val in (1, 1.0, "1", True) else 0
        else:
            invalid_fields.append("is_repeated_guest")

    for hist_num_col in ("previous_cancellations", "previous_bookings_not_canceled"):
        if hist_num_col in data and data[hist_num_col] is not None:
            try:
                num_v = float(data[hist_num_col])
                if num_v < 0 or math.isnan(num_v) or math.isinf(num_v):
                    invalid_fields.append(hist_num_col)
                else:
                    validated[hist_num_col] = int(num_v)
            except (ValueError, TypeError):
                invalid_fields.append(hist_num_col)

    # Validate categorical fields
    for field in CATEGORICAL_FEATURES:
        val = data.get(field)
        if not isinstance(val, (str, int, float)) or (isinstance(val, str) and not val.strip()):
            invalid_fields.append(field)
            continue

        str_val = str(val).strip()

        # Strict checks for bounded enumerations
        if field == "hotel" and str_val not in VALID_HOTELS:
            invalid_fields.append(field)
            continue
        elif field == "arrival_date_month" and str_val not in VALID_MONTHS:
            invalid_fields.append(field)
            continue
        elif field == "deposit_type" and str_val not in VALID_DEPOSIT_TYPES:
            invalid_fields.append(field)
            continue
        elif field == "customer_type" and str_val not in VALID_CUSTOMER_TYPES:
            invalid_fields.append(field)
            continue

        validated[field] = str_val

    # Optional booking_status if provided by client
    if "booking_status" in data and data["booking_status"]:
        validated["booking_status"] = str(data["booking_status"]).strip()

    if invalid_fields:
        return False, None, {
            "success": False,
            "error": {
                "message": "Invalid input",
                "fields": invalid_fields
            }
        }

    # Automatically compute derived features from raw booking data:
    # 1. total_stay = stays_in_weekend_nights + stays_in_week_nights
    validated["total_stay"] = (
        validated["stays_in_weekend_nights"] + validated["stays_in_week_nights"]
    )

    # 2. total_guests = adults + children + babies
    validated["total_guests"] = (
        validated["adults"] + validated["children"] + validated["babies"]
    )

    # 3. is_family = 1 if (children + babies > 0) else 0
    validated["is_family"] = (
        1 if (validated["children"] + validated["babies"]) > 0 else 0
    )

    return True, validated, None
