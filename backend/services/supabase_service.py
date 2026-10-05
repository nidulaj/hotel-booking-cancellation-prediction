"""
Supabase database service for customer history lookup and booking persistence.
"""
import logging
from typing import Any, Dict, List, Optional
from supabase import Client, create_client

logger = logging.getLogger(__name__)


class SupabaseService:
    """Service to interact with Supabase bookings table."""

    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.client: Optional[Client] = None

        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                logger.info("Supabase client initialized successfully for URL: %s", self.url)
            except Exception as e:
                logger.warning("Failed to initialize Supabase client: %s", e)
        else:
            logger.info("Supabase URL or key not provided. Database lookups will use default fallbacks.")

    @property
    def is_available(self) -> bool:
        """Check if Supabase client is connected."""
        return self.client is not None

    def get_customer_history(self, email: str) -> Dict[str, int]:
        """
        Query bookings table by customer email to determine:
        - is_repeated_guest (1 if any previous bookings found, else 0)
        - previous_cancellations (count of past bookings with cancelled status)
        - previous_bookings_not_canceled (count of past bookings that were completed/confirmed)

        Returns:
            Dict containing:
            {
                "is_repeated_guest": int,
                "previous_cancellations": int,
                "previous_bookings_not_canceled": int,
                "total_previous_bookings": int,
            }
        """
        default_history = {
            "is_repeated_guest": 0,
            "previous_cancellations": 0,
            "previous_bookings_not_canceled": 0,
            "total_previous_bookings": 0,
        }

        if not self.is_available or not email or not isinstance(email, str):
            return default_history

        clean_email = email.strip().lower()
        if not clean_email:
            return default_history

        try:
            logger.info("Querying booking history for email: %s", clean_email)
            response = (
                self.client.table("bookings")
                .select("booking_status")
                .ilike("email", clean_email)
                .execute()
            )

            records: List[Dict[str, Any]] = response.data or []
            total_count = len(records)

            if total_count == 0:
                logger.info("No prior bookings found for %s. Classified as new guest.", clean_email)
                return default_history

            # Repeated guest found
            cancellations = 0
            not_canceled = 0

            for rec in records:
                status_raw = str(rec.get("booking_status") or "").strip().lower()
                # Consider cancelled if status has cancel or is 1
                if "cancel" in status_raw or status_raw in ("1", "true"):
                    cancellations += 1
                else:
                    not_canceled += 1

            result = {
                "is_repeated_guest": 1,
                "previous_cancellations": cancellations,
                "previous_bookings_not_canceled": not_canceled,
                "total_previous_bookings": total_count,
            }
            logger.info(
                "History for %s -> repeated: %d, canceled: %d, completed: %d (total: %d)",
                clean_email,
                result["is_repeated_guest"],
                result["previous_cancellations"],
                result["previous_bookings_not_canceled"],
                total_count,
            )
            return result

        except Exception as e:
            logger.error("Error querying Supabase for customer history (%s): %s", clean_email, e)
            # Return safe default rather than failing user prediction
            return default_history

    def save_booking(self, booking_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Persist a new booking record to the Supabase bookings table.
        """
        if not self.is_available:
            logger.warning("Supabase client not available. Skipping booking record insertion.")
            return None

        # Approved schema column names in Supabase
        table_columns = {
            "email", "hotel", "lead_time", "arrival_date_year", "arrival_date_month",
            "arrival_date_week_number", "arrival_date_day_of_month",
            "stays_in_weekend_nights", "stays_in_week_nights", "adults", "children",
            "babies", "is_repeated_guest", "previous_cancellations",
            "previous_bookings_not_canceled", "adr", "required_car_parking_spaces",
            "total_of_special_requests", "total_stay", "total_guests", "is_family",
            "meal", "country", "market_segment", "distribution_channel",
            "reserved_room_type", "deposit_type", "customer_type", "agent",
            "booking_status"
        }

        integer_columns = {
            "lead_time", "arrival_date_year", "arrival_date_week_number",
            "arrival_date_day_of_month", "stays_in_weekend_nights",
            "stays_in_week_nights", "adults", "children", "babies",
            "is_repeated_guest", "previous_cancellations",
            "previous_bookings_not_canceled", "required_car_parking_spaces",
            "total_of_special_requests", "total_stay", "total_guests", "is_family"
        }

        # Filter booking data to match table columns and cast types properly
        payload = {}
        for k, v in booking_data.items():
            if k in table_columns:
                if k in integer_columns and v is not None:
                    try:
                        payload[k] = int(round(float(v)))
                    except (ValueError, TypeError):
                        payload[k] = 0
                elif k == "adr" and v is not None:
                    payload[k] = float(v)
                else:
                    payload[k] = v

        try:
            logger.info("Persisting new booking for %s to Supabase...", payload.get("email"))
            response = self.client.table("bookings").insert(payload).execute()
            if response.data and len(response.data) > 0:
                inserted = response.data[0]
                logger.info("Booking persisted successfully with ID: %s", inserted.get("id"))
                return inserted
            return None
        except Exception as e:
            logger.error("Failed to insert booking into Supabase: %s", e)
            return None
