export interface DutyEvent {
  status: "off_duty" | "sleeper" | "driving" | "on_duty";
  start_hour: number;
  duration: number;
  end_hour: number;
  location: string;
  notes: string;
}

export interface DayLog {
  day_number: number;
  date_label: string;
  total_driving: number;
  total_on_duty: number;
  total_off_duty: number;
  events: DutyEvent[];
}

export interface Stop {
  type: "pickup" | "dropoff" | "rest" | "fuel";
  time_from_start_hours: number;
  duration_hours: number;
  location: string;
}

export interface TripPlan {
  total_distance_miles: number;
  total_driving_hours: number;
  cycle_hours_used_final: number;
  warnings: string[];
  stops: Stop[];
  days: DayLog[];
}

export interface GeoLocation {
  lat: number;
  lon: number;
  display_name: string;
}

export interface TripResponse {
  trip: TripPlan;
  locations: {
    current: GeoLocation;
    pickup: GeoLocation;
    dropoff: GeoLocation;
  };
  route_geometry: [number, number][];
  distance_to_pickup_miles: number;
  distance_pickup_to_dropoff_miles: number;
}
