export type Hotel = "Resort Hotel" | "City Hotel";

/** Raw booking details sent to POST /api/predict. */
export interface PredictionRequest {
  email: string;
  hotel: Hotel;
  lead_time: number;
  arrival_date_year: number;
  arrival_date_month: string;
  arrival_date_week_number: number;
  arrival_date_day_of_month: number;
  stays_in_weekend_nights: number;
  stays_in_week_nights: number;
  adults: number;
  children: number;
  babies: number;
  meal: string;
  country: string;
  market_segment: string;
  distribution_channel: string;
  reserved_room_type: string;
  deposit_type: string;
  customer_type: string;
  adr: number;
  required_car_parking_spaces: number;
  total_of_special_requests: number;
  agent: string;
}

export interface CustomerHistory {
  is_repeated_guest: number;
  previous_cancellations: number;
  previous_bookings_not_canceled: number;
  total_previous_bookings: number;
}

export interface PredictionResponse {
  success: true;
  prediction: 0 | 1;
  result: string;
  cancellation_probability: number;
  booking_id: string | null;
  saved_to_database: boolean;
  customer_history: CustomerHistory;
}

export interface Booking extends Partial<Omit<PredictionRequest, "hotel">> {
  id: string;
  email: string;
  hotel: string;
  booking_status: string;
  total_stay?: number;
  total_guests?: number;
  is_family?: number;
  created_at?: string;
}

export interface BookingListResponse {
  success: true;
  count: number;
  total: number;
  limit: number;
  offset: number;
  bookings: Booking[];
}

export interface HealthResponse {
  success: boolean;
  message: string;
  model_loaded: boolean;
  database_connected: boolean;
}

export interface BookingFilters {
  limit?: number;
  offset?: number;
  email?: string;
  status?: string;
  hotel?: string;
}
