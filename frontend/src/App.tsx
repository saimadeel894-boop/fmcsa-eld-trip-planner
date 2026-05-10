import { useState } from "react";
import axios from "axios";
import type { TripResponse } from "./types";
import ELDLogSheet from "./ELDLogSheet";
import TripMap from "./TripMap";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STOP_COLORS: Record<string, string> = {
  pickup: "#16a34a",
  dropoff: "#dc2626",
  rest: "#7c3aed",
  fuel: "#d97706",
};

const STOP_ICONS: Record<string, string> = {
  pickup: "📦",
  dropoff: "🏁",
  rest: "💤",
  fuel: "⛽",
};

export default function App() {
  const [form, setForm] = useState({
    current_location: "",
    pickup_location: "",
    dropoff_location: "",
    current_cycle_used: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TripResponse | null>(null);
  const [activeDay, setActiveDay] = useState(0);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const resp = await axios.post(`${API}/api/trips/plan/`, {
        ...form,
        current_cycle_used: parseFloat(form.current_cycle_used) || 0,
      });
      setResult(resp.data);
      setActiveDay(0);
    } catch (e: any) {
      setError(e.response?.data?.error || "Request failed. Check backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f4", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#1c1917", color: "#fafaf9", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: "bold", letterSpacing: 1 }}>⏱ ELD TRIP PLANNER</div>
        <div style={{ fontSize: 13, color: "#a8a29e", marginLeft: "auto", fontWeight: 600 }}>FMCSA HOS Compliant · 70hr/8-day · Property Carrier</div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
        {/* Input Form */}
        <div style={{ background: "#fff", border: "1px solid #e7e5e4", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", borderRadius: 12, padding: 32, marginBottom: 32 }}>
          <div style={{ fontSize: 15, fontWeight: "bold", color: "#1c1917", marginBottom: 20, letterSpacing: 1 }}>
            TRIP DETAILS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { key: "current_location", label: "CURRENT LOCATION", placeholder: "Chicago, IL" },
              { key: "pickup_location", label: "PICKUP LOCATION", placeholder: "Memphis, TN" },
              { key: "dropoff_location", label: "DROPOFF LOCATION", placeholder: "New York, NY" },
              { key: "current_cycle_used", label: "CYCLE HOURS USED (0–70)", placeholder: "20", type: "number" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#544f4d", display: "block", marginBottom: 6, letterSpacing: 1 }}>
                  {label}
                </label>
                <input
                  type={type || "text"}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  min={type === "number" ? 0 : undefined}
                  max={type === "number" ? 70 : undefined}
                  style={{
                    width: "100%",
                    padding: "14px",
                    border: "1.5px solid #d6d3d1",
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: "'Inter', sans-serif",
                    background: "#fafaf9",
                    boxSizing: "border-box",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1c1917")}
                  onBlur={(e) => (e.target.style.borderColor = "#d6d3d1")}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              marginTop: 24,
              width: "100%",
              background: loading ? "#78716c" : "#1c1917",
              color: "#fafaf9",
              border: "none",
              borderRadius: 8,
              padding: "16px 28px",
              fontSize: 15,
              fontWeight: "bold",
              letterSpacing: 1,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "CALCULATING ROUTE..." : "PLAN TRIP →"}
          </button>

          {error && (
            <div style={{ marginTop: 12, color: "#dc2626", fontSize: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 4 }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {result && (
          <>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
              {[
                { label: "TOTAL DISTANCE", value: `${result.trip.total_distance_miles.toFixed(0)} mi` },
                { label: "TOTAL DRIVE TIME", value: `${result.trip.total_driving_hours.toFixed(1)} hrs` },
                { label: "DAYS ON ROAD", value: `${result.trip.days.length}` },
                { label: "CYCLE USED (FINAL)", value: `${result.trip.cycle_hours_used_final.toFixed(1)} / 70 hrs` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #e7e5e4", borderLeft: "4px solid #1c1917", color: "#1c1917", borderRadius: 8, padding: "20px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 11, color: "#78716c", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
                </div>
              ))}
            </div>

            {result.trip.warnings.length > 0 && (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                {result.trip.warnings.map((w, i) => (
                  <div key={i} style={{ color: "#c2410c", fontSize: 12 }}>⚠ {w}</div>
                ))}
              </div>
            )}

            {/* Map */}
            <div style={{ background: "#fff", border: "1px solid #e7e5e4", boxShadow: "0 4px 24px rgba(0,0,0,0.04)", borderRadius: 12, padding: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: "bold", color: "#1c1917", marginBottom: 16, letterSpacing: 1 }}>
                ROUTE MAP
              </div>
              <TripMap
                locations={result.locations}
                routeGeometry={result.route_geometry}
                stops={result.trip.stops}
              />
              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Current", color: "#1c1917", icon: "●" },
                  { label: "Pickup", color: "#16a34a", icon: "●" },
                  { label: "Dropoff", color: "#dc2626", icon: "●" },
                  { label: "Rest", color: "#7c3aed", icon: "●" },
                  { label: "Fuel", color: "#d97706", icon: "●" },
                ].map(({ label, color, icon }) => (
                  <span key={label} style={{ fontSize: 11, color: "#44403c", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color }}>{icon}</span> {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Stops Summary */}
            <div style={{ background: "#fff", border: "1px solid #e7e5e4", boxShadow: "0 4px 24px rgba(0,0,0,0.04)", borderRadius: 12, padding: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 15, fontWeight: "bold", color: "#1c1917", marginBottom: 16, letterSpacing: 1 }}>
                TRIP STOPS & EVENTS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.trip.stops.map((stop, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 12px", borderRadius: 4,
                    background: "#fafaf9", border: "1px solid #e7e5e4"
                  }}>
                    <span style={{ fontSize: 16 }}>{STOP_ICONS[stop.type]}</span>
                    <span style={{
                      fontSize: 10, fontWeight: "bold", letterSpacing: 1,
                      color: STOP_COLORS[stop.type], minWidth: 60
                    }}>
                      {stop.type.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: "#44403c", flex: 1 }}>
                      {stop.location || "En route"}
                    </span>
                    <span style={{ fontSize: 11, color: "#78716c" }}>
                      +{stop.time_from_start_hours.toFixed(1)}h from start · {stop.duration_hours}h
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ELD Log Sheets */}
            <div style={{ background: "#fff", border: "1px solid #e7e5e4", boxShadow: "0 4px 24px rgba(0,0,0,0.04)", borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: "bold", color: "#1c1917", marginBottom: 16, letterSpacing: 1 }}>
                ELD DAILY LOG SHEETS
              </div>

              {/* Day tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {result.trip.days.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDay(i)}
                    style={{
                      padding: "8px 16px",
                      border: "1.5px solid #1c1917",
                      borderRadius: 6,
                      background: activeDay === i ? "#1c1917" : "#fff",
                      color: activeDay === i ? "#fafaf9" : "#1c1917",
                      fontSize: 13,
                      fontFamily: "'Inter', sans-serif",
                      cursor: "pointer",
                      fontWeight: activeDay === i ? "600" : "400",
                    }}
                  >
                    {day.date_label}
                  </button>
                ))}
              </div>

              {result.trip.days[activeDay] && (
                <ELDLogSheet
                  dayLog={result.trip.days[activeDay]}
                  carrierName="Spotter AI Logistics"
                  driverName="Driver"
                />
              )}

              {/* Status legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { label: "Off Duty", color: "#2563eb" },
                  { label: "Sleeper Berth", color: "#7c3aed" },
                  { label: "Driving", color: "#16a34a" },
                  { label: "On Duty (Not Driving)", color: "#d97706" },
                ].map(({ label, color }) => (
                  <span key={label} style={{ fontSize: 11, color: "#44403c", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "inline-block", width: 20, height: 4, background: color, borderRadius: 2 }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
