import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoLocation, Stop } from "./types";
import { useEffect } from "react";

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const makeIcon = (color: string, label: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map(([lon, lat]) => [lat, lon]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

interface Props {
  locations: { current: GeoLocation; pickup: GeoLocation; dropoff: GeoLocation };
  routeGeometry: [number, number][];
  stops: Stop[];
}

export default function TripMap({ locations, routeGeometry, stops }: Props) {
  const latLngs: [number, number][] = routeGeometry.map(([lon, lat]) => [lat, lon]);

  const stopIcons: Record<Stop["type"], { color: string; label: string }> = {
    pickup: { color: "#16a34a", label: "P" },
    dropoff: { color: "#dc2626", label: "D" },
    rest: { color: "#7c3aed", label: "R" },
    fuel: { color: "#d97706", label: "F" },
  };

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      style={{ height: 400, width: "100%", borderRadius: 8, zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {latLngs.length > 0 && (
        <>
          <Polyline positions={latLngs} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.8 }} />
          <FitBounds coords={routeGeometry} />
        </>
      )}

      <Marker position={[locations.current.lat, locations.current.lon]} icon={makeIcon("#1c1917", "C")}>
        <Popup><strong>Current</strong><br />{locations.current.display_name}</Popup>
      </Marker>
      <Marker position={[locations.pickup.lat, locations.pickup.lon]} icon={makeIcon("#16a34a", "P")}>
        <Popup><strong>Pickup</strong><br />{locations.pickup.display_name}</Popup>
      </Marker>
      <Marker position={[locations.dropoff.lat, locations.dropoff.lon]} icon={makeIcon("#dc2626", "D")}>
        <Popup><strong>Dropoff</strong><br />{locations.dropoff.display_name}</Popup>
      </Marker>

      {stops.filter(s => s.type === "rest" || s.type === "fuel").map((stop, i) => {
        const info = stopIcons[stop.type];
        // Approximate position along route
        const idx = Math.floor((i + 1) / (stops.length + 1) * latLngs.length);
        const pos = latLngs[Math.min(idx, latLngs.length - 1)];
        if (!pos) return null;
        return (
          <Marker key={i} position={pos} icon={makeIcon(info.color, info.label)}>
            <Popup>
              <strong>{stop.type === "rest" ? "Rest Stop" : "Fuel Stop"}</strong><br />
              {stop.type === "rest" ? `${stop.duration_hours}hr rest` : "~30 min fuel"}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
