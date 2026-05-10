# 🚛 FMCSA ELD Trip Planner

[![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A full-stack Electronic Logging Device (ELD) trip planning application that enforces **FMCSA 49 CFR Part 395** Hours-of-Service (HOS) regulations for property carriers. Given a driver's current location, pickup, and dropoff destinations, the system computes a fully compliant multi-day driving schedule, renders an interactive route map, and generates official-style ELD daily log sheets.

---

## ✨ Features

| Feature | Details |
|---|---|
| **HOS Compliance Engine** | Enforces 11-hr drive limit, 14-hr on-duty window, 10-hr mandatory rest, 30-min break rule, 70hr/8-day cycle |
| **Intelligent Route Planning** | Geocodes addresses via Nominatim, calculates road distance + geometry via OSRM |
| **Automatic Stop Scheduling** | Inserts mandatory rest breaks, 30-min HOS breaks, and fuel stops every 1,000 miles |
| **Interactive Route Map** | Leaflet-powered map with color-coded markers (Current, Pickup, Dropoff, Rest, Fuel) |
| **ELD Daily Log Sheet Renderer** | Canvas-drawn 24-hour grid with colored duty-status lines, per-row totals, and remarks |
| **Multi-Day Trip View** | Tabbed navigation across all trip days with accurate clock-time segmentation |
| **Cycle Hour Tracking** | Accounts for driver's pre-existing cycle hours used; warns on cycle limit |
| **Zero External API Costs** | Uses only open, free geocoding (Nominatim) and routing (OSRM) services |

---

## 🏗️ Architecture

```
fmcsa-eld-trip-planner/
├── backend/                        # Django REST API
│   ├── eld_backend/                # Django project config
│   │   ├── settings.py             # CORS, DRF, WhiteNoise config
│   │   └── urls.py                 # Root URL routing
│   ├── trips/                      # Core application
│   │   ├── hos_engine.py           # FMCSA HOS compliance engine (pure Python)
│   │   ├── views.py                # PlanTripView — geocode + route + HOS
│   │   └── urls.py                 # /api/trips/plan/ endpoint
│   ├── requirements.txt
│   ├── Procfile                    # Railway / Heroku deploy config
│   └── manage.py
│
├── frontend/                       # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx                 # Main UI: form, summary cards, tabs
│   │   ├── TripMap.tsx             # Leaflet map with route + stop markers
│   │   ├── ELDLogSheet.tsx         # Canvas-rendered 24-hr ELD grid
│   │   └── types.ts                # TypeScript interfaces (TripResponse, DayLog…)
│   ├── .env.example                # Environment variable template
│   └── package.json
│
└── README.md
```

### Data Flow

```
User Input (form)
      │
      ▼
React App (App.tsx)
      │  POST /api/trips/plan/
      ▼
Django REST API (views.py)
      │  Nominatim geocoding (×3 locations)
      │  OSRM routing (×2 segments)
      │  HOS Engine (hos_engine.py)
      ▼
JSON Response
      │
      ├──▶ TripMap.tsx   → Leaflet polyline + markers
      ├──▶ App.tsx       → Summary cards + Stops list
      └──▶ ELDLogSheet.tsx → Canvas 24-hr duty grid (per day)
```

---

## 🛠️ Tech Stack

**Backend**
- Python 3.11+ / Django 4.2
- Django REST Framework 3.14
- django-cors-headers 4.3
- Gunicorn (production WSGI)
- WhiteNoise (static file serving)
- Nominatim API (OSM geocoding)
- OSRM (open-source routing engine)

**Frontend**
- React 19 + TypeScript 5
- Vite 8 (build tooling)
- React-Leaflet 5 + Leaflet 1.9 (interactive maps)
- Axios (HTTP client)
- HTML5 Canvas (ELD log sheet rendering)

---

## 🚀 Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git

---

### 1. Clone the Repository

```bash
git clone https://github.com/saimadeel894-boop/fmcsa-eld-trip-planner.git
cd fmcsa-eld-trip-planner
```

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

Backend API available at: **`http://localhost:8000`**

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# .env content: VITE_API_URL=http://localhost:8000

# Start Vite dev server
npm run dev
```

Frontend available at: **`http://localhost:5173`**

---

### 4. Test the Application

Open `http://localhost:5173` and enter:

| Field | Value |
|---|---|
| Current Location | `Chicago, IL` |
| Pickup Location | `Memphis, TN` |
| Dropoff Location | `New York, NY` |
| Cycle Hours Used | `20` |

Click **PLAN TRIP →** — expected result: interactive map with route, trip stops timeline, and 2–3 day ELD log sheets with colored duty lines.

---

## 🌍 Environment Variables

### Backend

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | Django secret key | Set in production via env |
| `DEBUG` | Debug mode | `True` (dev only) |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames | `*` |
| `DATABASE_URL` | Production database URL | SQLite (dev) |

### Frontend

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |

> ⚠️ **Never commit `.env` files.** Use `.env.example` as a template.

---

## ☁️ Deployment

### Backend → Railway

1. Create a new Railway project and connect this repository
2. Set root directory to `backend/`
3. Railway auto-detects the `Procfile`:
   ```
   web: gunicorn eld_backend.wsgi --workers 2 --bind 0.0.0.0:$PORT
   ```
4. Set environment variables in Railway dashboard:
   ```
   SECRET_KEY=your-production-secret-key
   DEBUG=False
   ALLOWED_HOSTS=your-railway-domain.railway.app
   ```
5. Railway will run migrations automatically if you add a release command:
   ```
   release: python manage.py migrate
   ```

### Frontend → Vercel

1. Import this repository on [Vercel](https://vercel.com)
2. Set root directory to `frontend/`
3. Framework preset: **Vite**
4. Add environment variable:
   ```
   VITE_API_URL=https://your-railway-domain.railway.app
   ```
5. Deploy — Vercel handles the `npm run build` automatically

---

## 📋 API Reference

### `POST /api/trips/plan/`

Plan a compliant HOS trip.

**Request Body**
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Memphis, TN",
  "dropoff_location": "New York, NY",
  "current_cycle_used": 20
}
```

**Response** (abbreviated)
```json
{
  "trip": {
    "total_distance_miles": 1284.5,
    "total_driving_hours": 23.4,
    "cycle_hours_used_final": 47.9,
    "warnings": [],
    "stops": [...],
    "days": [
      {
        "day_number": 1,
        "date_label": "Day 1",
        "total_driving": 11.0,
        "total_on_duty": 2.0,
        "total_off_duty": 11.0,
        "events": [...]
      }
    ]
  },
  "locations": {
    "current": { "lat": 41.85, "lon": -87.65, "display_name": "Chicago..." },
    "pickup":  { "lat": 35.14, "lon": -90.05, "display_name": "Memphis..." },
    "dropoff": { "lat": 40.71, "lon": -74.01, "display_name": "New York..." }
  },
  "route_geometry": [[-87.65, 41.85], ...],
  "distance_to_pickup_miles": 534.2,
  "distance_pickup_to_dropoff_miles": 1284.5
}
```

---

## ⚖️ HOS Compliance Rules Implemented

| Rule | FMCSA Reference | Implementation |
|---|---|---|
| 11-Hour Driving Limit | 49 CFR §395.3(a)(3) | `MAX_DRIVING_PER_SHIFT = 11.0` |
| 14-Hour On-Duty Window | 49 CFR §395.3(a)(2) | `MAX_WINDOW = 14.0` |
| 10-Hour Off-Duty Reset | 49 CFR §395.3(a)(1) | `REQUIRED_OFF_DUTY = 10.0` |
| 30-Minute Break (after 8hrs) | 49 CFR §395.3(a)(3)(ii) | `BREAK_AFTER_DRIVE = 8.0` |
| 70-Hour/8-Day Cycle | 49 CFR §395.3(b)(2) | `MAX_CYCLE = 70.0` |
| Fuel Stop Intervals | Best practice | Every 1,000 miles, 30 min |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Commit using conventional commits: `git commit -m "feat: add adverse conditions exception"`
4. Push and open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built for FMCSA compliance assessment · Property carrier · 70hr/8-day rule</sub>
</div>
