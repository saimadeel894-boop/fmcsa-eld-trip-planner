import requests
import math
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .hos_engine import plan_trip

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"


def geocode(location: str) -> dict:
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": location, "format": "json", "limit": 1},
            headers={"User-Agent": "ELD-Planner/1.0"},
            timeout=10,
        )
        data = resp.json()
        if data:
            return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"]), "display_name": data[0]["display_name"]}
    except Exception:
        pass
    return None


def haversine_miles(origin, destination):
    lat1 = math.radians(origin['lat'])
    lat2 = math.radians(destination['lat'])
    dlat = lat2 - lat1
    dlon = math.radians(destination['lon'] - origin['lon'])
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 3956 * 2 * math.asin(math.sqrt(a)) * 1.15

def get_route(origin, destination):
    try:
        coords = f"{origin['lon']},{origin['lat']};{destination['lon']},{destination['lat']}"
        resp = requests.get(
            f"{OSRM_URL}/{coords}",
            params={"overview": "full", "geometries": "geojson"},
            timeout=10,
        )
        data = resp.json()
        if data.get("code") == "Ok":
            route = data["routes"][0]
            return {
                "distance_miles": route["distance"] / 1609.34,
                "geometry": route["geometry"]["coordinates"],
            }
    except Exception:
        pass
    return {
        "distance_miles": haversine_miles(origin, destination),
        "geometry": [
            [origin['lon'], origin['lat']],
            [destination['lon'], destination['lat']],
        ],
    }


class PlanTripView(APIView):
    def post(self, request):
        d = request.data
        current_location = d.get("current_location", "").strip()
        pickup_location = d.get("pickup_location", "").strip()
        dropoff_location = d.get("dropoff_location", "").strip()

        try:
            current_cycle_used = float(d.get("current_cycle_used", 0))
        except (ValueError, TypeError):
            return Response({"error": "current_cycle_used must be a number"}, status=400)

        if not all([current_location, pickup_location, dropoff_location]):
            return Response({"error": "All three locations required"}, status=400)

        if not (0 <= current_cycle_used <= 70):
            return Response({"error": "current_cycle_used must be 0-70"}, status=400)

        geo_current = geocode(current_location)
        geo_pickup = geocode(pickup_location)
        geo_dropoff = geocode(dropoff_location)

        if not geo_current:
            return Response({"error": f"Cannot geocode: {current_location}"}, status=400)
        if not geo_pickup:
            return Response({"error": f"Cannot geocode: {pickup_location}"}, status=400)
        if not geo_dropoff:
            return Response({"error": f"Cannot geocode: {dropoff_location}"}, status=400)

        route_to_pickup = get_route(geo_current, geo_pickup)
        route_main = get_route(geo_pickup, geo_dropoff)

        # Fallback guaranteed by get_route now

        dist_to_pickup = route_to_pickup["distance_miles"] if route_to_pickup else 0.0
        dist_main = route_main["distance_miles"]

        # Combine geometries
        geom_a = route_to_pickup["geometry"] if route_to_pickup else []
        geom_b = route_main["geometry"]
        full_route = geom_a + (geom_b[1:] if geom_a else geom_b)

        trip_plan = plan_trip(
            total_distance_miles=dist_main,
            current_cycle_used=current_cycle_used,
            current_location=geo_current["display_name"],
            pickup_location=geo_pickup["display_name"],
            dropoff_location=geo_dropoff["display_name"],
            distance_to_pickup=dist_to_pickup,
        )

        return Response({
            "trip": trip_plan.to_dict(),
            "locations": {
                "current": geo_current,
                "pickup": geo_pickup,
                "dropoff": geo_dropoff,
            },
            "route_geometry": full_route,
            "distance_to_pickup_miles": round(dist_to_pickup, 1),
            "distance_pickup_to_dropoff_miles": round(dist_main, 1),
        })
