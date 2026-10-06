# Frontend — Booking Shield

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 UI for the hotel booking cancellation API.

## Pages

| Route | What it does |
|---|---|
| `/` | Overview: booking totals, cancellation rate, status/hotel mix, latest bookings, model metrics |
| `/predict` | Booking form → `POST /api/predict`; shows the risk gauge, saved booking and guest history |
| `/bookings` | Searchable, filterable, paginated table; click a row for details, status editing and cancellation |

The API base URL, model metrics and dropdown values live in [services/api.ts](services/api.ts) and [utils/constants.ts](utils/constants.ts).

## Run

```bash
cp .env.example .env      # set NEXT_PUBLIC_API_URL (default http://127.0.0.1:5000)
npm install
npm run dev -- -p 5173    # any origin listed in the backend's CORS_ORIGINS works
```

`npm run build && npm start -- -p 5173` for a production build; `npm run lint` to lint.

## Notes

- The arrival date picker fills `arrival_date_year/month/week_number/day_of_month` (ISO week). Lead time is
  calculated from today unless edited by hand.
- "No agent" sends `agent: "0"`, matching how missing agents were filled during training.
- The bookings table doesn't store the model's probability, so risk scores are kept in the browser's
  `localStorage` for predictions made there and shown next to those bookings only.
- Helpers live in `utils/` and `services/` rather than `lib/`, because the root `.gitignore` ignores every `lib/` folder.
