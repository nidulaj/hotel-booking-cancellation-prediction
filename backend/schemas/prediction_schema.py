"""
Prediction schema defining the approved feature set, groupings, and validation constants.
"""

NUMERICAL_FEATURES = [
    "lead_time",
    "arrival_date_year",
    "arrival_date_week_number",
    "arrival_date_day_of_month",
    "stays_in_weekend_nights",
    "stays_in_week_nights",
    "adults",
    "children",
    "babies",
    "previous_cancellations",
    "previous_bookings_not_canceled",
    "adr",
    "required_car_parking_spaces",
    "total_of_special_requests",
    "total_stay",
    "total_guests",
]

BINARY_FEATURES = [
    "is_repeated_guest",
    "is_family",
]

CATEGORICAL_FEATURES = [
    "hotel",
    "arrival_date_month",
    "meal",
    "country",
    "market_segment",
    "distribution_channel",
    "reserved_room_type",
    "deposit_type",
    "customer_type",
    "agent",
]

# Total approved predictor features in canonical order (28 features)
ALL_FEATURES = NUMERICAL_FEATURES + BINARY_FEATURES + CATEGORICAL_FEATURES

# Engineered / derived features calculated automatically by backend from raw input
DERIVED_FEATURES = {"total_stay", "total_guests", "is_family"}

# Features strictly expected from the frontend (25 raw booking features)
FRONTEND_REQUIRED_FEATURES = [f for f in ALL_FEATURES if f not in DERIVED_FEATURES]

# Allowed sets for categories where known bounded sets are standard
VALID_HOTELS = {"Resort Hotel", "City Hotel"}

VALID_MONTHS = {
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
}

VALID_DEPOSIT_TYPES = {"No Deposit", "Non Refund", "Refundable"}

VALID_CUSTOMER_TYPES = {"Transient", "Contract", "Transient-Party", "Group"}
