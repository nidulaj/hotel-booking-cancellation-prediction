export const HOTELS = ["City Hotel", "Resort Hotel"] as const;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const MEALS = [
  { value: "BB", label: "Bed & Breakfast" },
  { value: "HB", label: "Half Board" },
  { value: "FB", label: "Full Board" },
  { value: "SC", label: "Self Catering" },
  { value: "Undefined", label: "Not specified" },
];

export const MARKET_SEGMENTS = [
  "Online TA", "Offline TA/TO", "Direct", "Corporate", "Groups", "Complementary", "Aviation",
];

export const DISTRIBUTION_CHANNELS = ["TA/TO", "Direct", "Corporate", "GDS"];

export const ROOM_TYPES = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const DEPOSIT_TYPES = ["No Deposit", "Non Refund", "Refundable"];

export const CUSTOMER_TYPES = ["Transient", "Transient-Party", "Contract", "Group"];

/** Most common source markets in the training data, followed by a broader list. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "PRT", name: "Portugal" },
  { code: "GBR", name: "United Kingdom" },
  { code: "FRA", name: "France" },
  { code: "ESP", name: "Spain" },
  { code: "DEU", name: "Germany" },
  { code: "ITA", name: "Italy" },
  { code: "IRL", name: "Ireland" },
  { code: "BEL", name: "Belgium" },
  { code: "BRA", name: "Brazil" },
  { code: "NLD", name: "Netherlands" },
  { code: "USA", name: "United States" },
  { code: "CHE", name: "Switzerland" },
  { code: "AUT", name: "Austria" },
  { code: "SWE", name: "Sweden" },
  { code: "CHN", name: "China" },
  { code: "POL", name: "Poland" },
  { code: "ISR", name: "Israel" },
  { code: "RUS", name: "Russia" },
  { code: "NOR", name: "Norway" },
  { code: "ROU", name: "Romania" },
  { code: "FIN", name: "Finland" },
  { code: "DNK", name: "Denmark" },
  { code: "AUS", name: "Australia" },
  { code: "AGO", name: "Angola" },
  { code: "LUX", name: "Luxembourg" },
  { code: "MAR", name: "Morocco" },
  { code: "TUR", name: "Turkey" },
  { code: "ARG", name: "Argentina" },
  { code: "IND", name: "India" },
  { code: "JPN", name: "Japan" },
  { code: "KOR", name: "South Korea" },
  { code: "LKA", name: "Sri Lanka" },
  { code: "ZAF", name: "South Africa" },
  { code: "MEX", name: "Mexico" },
  { code: "GRC", name: "Greece" },
  { code: "CZE", name: "Czech Republic" },
  { code: "HUN", name: "Hungary" },
];

/** Statuses offered in the status editor. The backend accepts any non-empty value. */
export const BOOKING_STATUSES = ["Confirmed", "Check-Out", "No-Show", "Canceled"];

/** Snapshot of ML/models/final_model_info.json (XGBoost, held-out test set). */
export const MODEL_INFO = {
  name: "XGBoost",
  threshold: 0.5,
  metrics: [
    { label: "ROC-AUC", value: 0.9202 },
    { label: "Recall", value: 0.868 },
    { label: "Accuracy", value: 0.8276 },
    { label: "F1-score", value: 0.7348 },
    { label: "Precision", value: 0.6371 },
  ],
};
