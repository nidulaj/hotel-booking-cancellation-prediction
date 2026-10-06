import type {
  Booking,
  BookingFilters,
  BookingListResponse,
  HealthResponse,
  PredictionRequest,
  PredictionResponse,
} from "./types";

// Empty by default: requests go to the same origin and Next.js proxies /api/* to Flask
// (see next.config.ts). Set NEXT_PUBLIC_API_URL only to call a backend directly.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

/** Error raised for any non-2xx response, carrying the backend's error payload. */
export class ApiError extends Error {
  status: number;
  fields: string[];

  constructor(message: string, status: number, fields: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_URL || "/api"}. Is the backend running?`, 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body; handled below.
  }

  if (!res.ok || (body as { success?: boolean } | null)?.success === false) {
    const err = (body as { error?: { message?: string; fields?: string[]; disallowed_fields?: string[] } } | null)
      ?.error;
    throw new ApiError(
      err?.message || `Request failed with status ${res.status}`,
      res.status,
      err?.fields || err?.disallowed_fields || [],
    );
  }
  return body as T;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),

  predict: (payload: PredictionRequest) =>
    request<PredictionResponse>("/api/predict", { method: "POST", body: JSON.stringify(payload) }),

  listBookings: (filters: BookingFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    const qs = params.toString();
    return request<BookingListResponse>(`/api/bookings${qs ? `?${qs}` : ""}`);
  },

  getBooking: (id: string) =>
    request<{ success: true; booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}`),

  updateStatus: (id: string, booking_status: string) =>
    request<{ success: true; message: string; booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ booking_status }),
    }),

  cancelBooking: (id: string) =>
    request<{ success: true; message: string; booking: Booking }>(
      `/api/bookings/${encodeURIComponent(id)}/cancel`,
      { method: "PATCH" },
    ),
};
