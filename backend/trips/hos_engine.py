"""
HOS Engine - FMCSA 49 CFR Part 395
Rules: Property carrier, 70hr/8-day, no adverse conditions
"""
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class DutyStatus(Enum):
    OFF_DUTY = "off_duty"
    SLEEPER = "sleeper"
    DRIVING = "driving"
    ON_DUTY = "on_duty"  # not driving


@dataclass
class DutyEvent:
    status: DutyStatus
    start_hour: float   # hours from trip start (day 0, 00:00)
    duration: float     # hours
    location: str = ""
    notes: str = ""

    @property
    def end_hour(self) -> float:
        return self.start_hour + self.duration


@dataclass
class DayLog:
    day_number: int          # 1-based
    date_label: str
    events: List[DutyEvent] = field(default_factory=list)
    total_driving: float = 0.0
    total_on_duty: float = 0.0
    total_off_duty: float = 0.0

    def to_dict(self):
        return {
            "day_number": self.day_number,
            "date_label": self.date_label,
            "total_driving": round(self.total_driving, 2),
            "total_on_duty": round(self.total_on_duty, 2),
            "total_off_duty": round(self.total_off_duty, 2),
            "events": [
                {
                    "status": e.status.value,
                    "start_hour": round(e.start_hour % 24, 4),
                    "duration": round(e.duration, 4),
                    "end_hour": round(e.end_hour % 24, 4),
                    "location": e.location,
                    "notes": e.notes,
                }
                for e in self.events
            ],
        }


@dataclass
class TripPlan:
    total_distance_miles: float
    total_driving_hours: float
    days: List[DayLog]
    stops: List[dict]
    cycle_hours_used_final: float
    warnings: List[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "total_distance_miles": round(self.total_distance_miles, 1),
            "total_driving_hours": round(self.total_driving_hours, 2),
            "cycle_hours_used_final": round(self.cycle_hours_used_final, 2),
            "warnings": self.warnings,
            "stops": self.stops,
            "days": [d.to_dict() for d in self.days],
        }


# HOS Constants (FMCSA)
MAX_DRIVING_PER_SHIFT = 11.0       # 11-hour driving limit
MAX_WINDOW = 14.0                  # 14-hour driving window
REQUIRED_OFF_DUTY = 10.0           # 10 consecutive hours off
MAX_CYCLE = 70.0                   # 70hr/8-day
BREAK_AFTER_DRIVE = 8.0            # 30-min break required after 8 cumulative hrs driving
BREAK_DURATION = 0.5               # 30 minutes
AVG_SPEED_MPH = 55.0               # assumed average
FUEL_INTERVAL_MILES = 1000.0       # fuel stop every 1000 miles
FUEL_STOP_HOURS = 0.5              # 30 min fuel stop
PICKUP_HOURS = 1.0
DROPOFF_HOURS = 1.0


def plan_trip(
    total_distance_miles: float,
    current_cycle_used: float,
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    distance_to_pickup: float = 0.0,
) -> TripPlan:
    """
    Plan a full trip with HOS compliance.
    distance_to_pickup: miles from current to pickup (subset of total_distance_miles)
    total_distance_miles: pickup to dropoff
    """

    warnings = []
    days: List[DayLog] = []
    stops: List[dict] = []

    # Remaining cycle hours available
    cycle_remaining = MAX_CYCLE - current_cycle_used
    if cycle_remaining <= 0:
        warnings.append("No cycle hours remaining. 34-hour restart required before driving.")
        cycle_remaining = 0

    # Build event timeline
    # Timeline: absolute hours from trip start
    cursor = 0.0  # current time in hours from trip start

    # Track HOS state
    drive_since_break = 0.0     # cumulative driving since last 30-min break
    drive_in_window = 0.0       # driving in current 14-hr window
    window_start = 0.0          # when current 14-hr window started
    cycle_used = current_cycle_used
    miles_since_fuel = 0.0

    all_events: List[DutyEvent] = []

    def add_event(status: DutyStatus, duration: float, location: str = "", notes: str = ""):
        nonlocal cursor, cycle_used
        e = DutyEvent(status=status, start_hour=cursor, duration=duration,
                      location=location, notes=notes)
        all_events.append(e)
        if status in (DutyStatus.DRIVING, DutyStatus.ON_DUTY):
            cycle_used += duration
        cursor += duration

    def reset_window():
        nonlocal drive_since_break, drive_in_window, window_start
        drive_since_break = 0.0
        drive_in_window = 0.0
        window_start = cursor

    def take_rest(location: str = ""):
        """Take 10-hour off-duty rest. Resets daily limits."""
        nonlocal cycle_used
        add_event(DutyStatus.OFF_DUTY, REQUIRED_OFF_DUTY, location=location, notes="Required 10-hr rest")
        reset_window()
        stops.append({
            "type": "rest",
            "time_from_start_hours": round(cursor - REQUIRED_OFF_DUTY, 2),
            "duration_hours": REQUIRED_OFF_DUTY,
            "location": location,
        })

    def drive_segment(miles: float, location_start: str, location_end: str) -> float:
        """
        Drive a segment. Inserts breaks and rests as needed.
        Returns miles actually driven (same as input; we drive all of it).
        """
        nonlocal drive_since_break, drive_in_window, window_start, miles_since_fuel, cursor, cycle_used

        remaining_miles = miles

        while remaining_miles > 0.001:
            # Check cycle
            if cycle_used >= MAX_CYCLE:
                warnings.append(f"Cycle limit hit at mile mark. 34-hr restart needed.")
                break

            # Hours available before needing rest
            window_elapsed = cursor - window_start
            hours_left_in_window = MAX_WINDOW - window_elapsed - drive_in_window
            # Actually: drive_in_window + non-drive on-duty within window
            # Simplified: how many drive hours can we fit before 14-hr window closes
            drive_left_window = MAX_DRIVING_PER_SHIFT - drive_in_window
            drive_left_break = BREAK_AFTER_DRIVE - drive_since_break
            cycle_left = MAX_CYCLE - cycle_used

            max_drive_now = min(
                drive_left_window,
                drive_left_break,
                cycle_left,
            )

            if max_drive_now <= 0:
                # Need break or rest
                if drive_in_window >= MAX_DRIVING_PER_SHIFT or (cursor - window_start) >= MAX_WINDOW - 0.01:
                    # Need full reset
                    take_rest(location=location_start)
                elif drive_since_break >= BREAK_AFTER_DRIVE:
                    # Need 30-min break
                    add_event(DutyStatus.OFF_DUTY, BREAK_DURATION,
                              location=location_start, notes="30-min mandatory break")
                    drive_since_break = 0.0
                else:
                    take_rest(location=location_start)
                continue

            # How many miles fit in max_drive_now hours?
            miles_in_segment = min(remaining_miles, max_drive_now * AVG_SPEED_MPH)

            # Check fuel
            if miles_since_fuel + miles_in_segment > FUEL_INTERVAL_MILES:
                miles_to_fuel = FUEL_INTERVAL_MILES - miles_since_fuel
                if miles_to_fuel > 0:
                    # Drive to fuel stop
                    hrs = miles_to_fuel / AVG_SPEED_MPH
                    add_event(DutyStatus.DRIVING, hrs,
                              location=location_start, notes=f"Driving to fuel stop")
                    drive_since_break += hrs
                    drive_in_window += hrs
                    remaining_miles -= miles_to_fuel
                    miles_since_fuel = 0.0

                # Fuel stop
                add_event(DutyStatus.ON_DUTY, FUEL_STOP_HOURS,
                          location="Fuel Stop", notes="Fueling (on-duty not driving)")
                stops.append({
                    "type": "fuel",
                    "time_from_start_hours": round(cursor - FUEL_STOP_HOURS, 2),
                    "duration_hours": FUEL_STOP_HOURS,
                    "location": "Fuel Stop",
                })
                continue

            # Drive the segment
            hrs = miles_in_segment / AVG_SPEED_MPH
            add_event(DutyStatus.DRIVING, hrs,
                      location=location_start,
                      notes=f"Driving toward {location_end}")
            drive_since_break += hrs
            drive_in_window += hrs
            remaining_miles -= miles_in_segment
            miles_since_fuel += miles_in_segment

        return miles - remaining_miles

    # === TRIP SEQUENCE ===

    # Window starts when driver goes on duty
    window_start = cursor
    drive_since_break = 0.0
    drive_in_window = 0.0

    # 1. Drive to pickup (if distance given)
    if distance_to_pickup > 0:
        drive_segment(distance_to_pickup, current_location, pickup_location)

    # 2. Pickup (1 hour on-duty)
    add_event(DutyStatus.ON_DUTY, PICKUP_HOURS,
              location=pickup_location, notes="Pickup (on-duty not driving)")
    stops.append({
        "type": "pickup",
        "time_from_start_hours": round(cursor - PICKUP_HOURS, 2),
        "duration_hours": PICKUP_HOURS,
        "location": pickup_location,
    })

    # 3. Drive pickup → dropoff
    drive_segment(total_distance_miles, pickup_location, dropoff_location)

    # 4. Dropoff (1 hour on-duty)
    add_event(DutyStatus.ON_DUTY, DROPOFF_HOURS,
              location=dropoff_location, notes="Dropoff (on-duty not driving)")
    stops.append({
        "type": "dropoff",
        "time_from_start_hours": round(cursor - DROPOFF_HOURS, 2),
        "duration_hours": DROPOFF_HOURS,
        "location": dropoff_location,
    })

    # === BUILD DAY LOGS ===
    total_hours = cursor
    num_days = int(total_hours // 24) + 1

    for day_idx in range(num_days):
        day_start = day_idx * 24.0
        day_end = day_start + 24.0
        day_log = DayLog(
            day_number=day_idx + 1,
            date_label=f"Day {day_idx + 1}",
        )

        for event in all_events:
            # Events that overlap this day
            ev_start = event.start_hour
            ev_end = event.end_hour

            if ev_end <= day_start or ev_start >= day_end:
                continue

            # Clip to this day
            clipped_start = max(ev_start, day_start)
            clipped_end = min(ev_end, day_end)
            clipped_dur = clipped_end - clipped_start

            if clipped_dur <= 0:
                continue

            clipped = DutyEvent(
                status=event.status,
                start_hour=clipped_start,
                duration=clipped_dur,
                location=event.location,
                notes=event.notes,
            )
            day_log.events.append(clipped)

            if event.status == DutyStatus.DRIVING:
                day_log.total_driving += clipped_dur
            elif event.status == DutyStatus.ON_DUTY:
                day_log.total_on_duty += clipped_dur
            else:
                day_log.total_off_duty += clipped_dur

        # Fill remainder of day as off-duty if events don't cover full 24hrs
        covered = sum(e.duration for e in day_log.events)
        if covered < 24.0 and day_log.events:
            last = day_log.events[-1]
            gap_start = last.end_hour
            gap_dur = day_end - gap_start
            if gap_dur > 0:
                day_log.events.append(DutyEvent(
                    status=DutyStatus.OFF_DUTY,
                    start_hour=gap_start,
                    duration=gap_dur,
                    location=day_log.events[-1].location,
                    notes="Off duty",
                ))
                day_log.total_off_duty += gap_dur

        if day_log.events:
            days.append(day_log)

    total_driving = sum(
        e.duration for e in all_events if e.status == DutyStatus.DRIVING
    )

    return TripPlan(
        total_distance_miles=total_distance_miles + distance_to_pickup,
        total_driving_hours=total_driving,
        days=days,
        stops=stops,
        cycle_hours_used_final=cycle_used,
        warnings=warnings,
    )
