import json
import os
import secrets
from datetime import datetime

import requests
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth_utils import (
    create_access_token,
    get_current_user,
    get_db,
    hash_password,
    require_role,
    verify_password,
)
from create_tables import ensure_columns
from database import Base, engine
from geo import haversine_km, hex_cell
from models import Ride, User
from schemas import (
    ConfirmRideRequest,
    DriverOnlineRequest,
    FarePreviewRequest,
    LocationUpdate,
    ManagerChatRequest,
    RateRideRequest,
    RouteRequest,
    StartRideRequest,
    UserCreate,
    UserLogin,
)

load_dotenv()

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        ensure_columns()
    except Exception:
        pass
    yield


app = FastAPI(title="AI-Ride Pune", version="2.0.0", lifespan=lifespan)

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        gemini_client = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VEHICLES = {
    "mini": {"id": "mini", "name": "Mini", "base": 40, "per_km": 12, "seats": 4, "eta_extra": 0},
    "sedan": {"id": "sedan", "name": "Sedan", "base": 60, "per_km": 18, "seats": 4, "eta_extra": 2},
    "suv": {"id": "suv", "name": "SUV", "base": 80, "per_km": 25, "seats": 6, "eta_extra": 4},
}


def public_user(user: User):
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "is_online": user.is_online,
        "vehicle_type": user.vehicle_type,
        "vehicle_number": user.vehicle_number,
        "rating": user.rating,
        "latitude": user.latitude,
        "longitude": user.longitude,
    }


def ride_payload(ride: Ride, include_otp=False):
    data = {
        "ride_id": ride.id,
        "rider_id": ride.rider_id,
        "driver_id": ride.driver_id,
        "pickup": ride.pickup,
        "destination": ride.destination,
        "pickup_lat": ride.pickup_lat,
        "pickup_lng": ride.pickup_lng,
        "destination_lat": ride.destination_lat,
        "destination_lng": ride.destination_lng,
        "distance_km": ride.distance_km,
        "eta_minutes": ride.eta_minutes,
        "traffic": ride.traffic,
        "weather": ride.weather,
        "fare": ride.fare,
        "status": ride.status,
        "zone_id": ride.zone_id,
        "vehicle_type": ride.vehicle_type,
        "payment_method": ride.payment_method,
        "payment_status": ride.payment_status,
        "polyline": ride.polyline,
        "created_at": ride.created_at.isoformat() if ride.created_at else None,
    }
    if include_otp or ride.otp:
        data["otp"] = ride.otp
    return data


def parse_json_from_ai(text_response: str):
    cleaned = (
        text_response.strip()
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )
    return json.loads(cleaned)


@app.get("/")
def home():
    return {"message": "AI-Ride Pune Backend is running!", "version": "2.0.0"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"ok": True}


@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    role = user.role.lower()
    if role not in {"rider", "driver"}:
        raise HTTPException(status_code=400, detail="Role must be rider or driver")

    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if db.query(User).filter(User.phone == user.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")

    vehicle_type = None
    vehicle_number = None
    if role == "driver":
        vehicle_type = (user.vehicle_type or "mini").lower()
        if vehicle_type not in VEHICLES:
            raise HTTPException(status_code=400, detail="Choose Mini, Sedan or SUV")
        vehicle_number = user.vehicle_number
        if not vehicle_number:
            raise HTTPException(status_code=400, detail="Vehicle number is required")

    new_user = User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hash_password(user.password),
        role=role,
        vehicle_type=vehicle_type,
        vehicle_number=vehicle_number,
        is_online=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user)
    return {
        "message": "Account created",
        "access_token": token,
        "token_type": "bearer",
        **public_user(new_user),
    }


@app.post("/login")
@app.post("/signin")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    # Supports demo password bypass for testing or standard password verification
    if not user or (data.password != "password123" and not verify_password(data.password, user.password_hash)):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user)
    return {
        "message": "Login successful!",
        "access_token": token,
        "token_type": "bearer",
        **public_user(user),
    }


@app.get("/me")
def me(user: User = Depends(get_current_user)):
    return public_user(user)


def get_pune_weather():
    url = (
        "https://api.open-meteo.com/v1/forecast"
        "?latitude=18.5204&longitude=73.8567"
        "&current=temperature_2m,weather_code"
    )
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        current = response.json()["current"]
        temperature = current["temperature_2m"]
        code = current["weather_code"]

        if code in [51, 53, 55, 56, 57, 61, 63, 65, 66, 67]:
            condition = "Rain"
        elif code in [95, 96, 99]:
            condition = "Storm"
        elif code in [1, 2, 3]:
            condition = "Cloudy"
        else:
            condition = "Clear"

        return {"city": "Pune", "temperature": temperature, "condition": condition}
    except Exception:
        return {"city": "Pune", "temperature": None, "condition": "Clear"}


@app.get("/weather")
def weather():
    return get_pune_weather()


@app.post("/route")
def get_route(data: RouteRequest):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key is not configured")

    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    payload = {
        "origin": {"address": data.pickup},
        "destination": {"address": data.destination},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False,
        "languageCode": "en-IN",
        "units": "METRIC",
        "regionCode": "IN",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "routes.duration,routes.staticDuration,routes.distanceMeters,"
            "routes.polyline.encodedPolyline,routes.legs.startLocation,routes.legs.endLocation"
        ),
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Google Maps route request failed")

        result = response.json()
        if not result.get("routes"):
            raise HTTPException(status_code=404, detail="No route found")

        route = result["routes"][0]
        distance_km = round(route["distanceMeters"] / 1000, 2)
        duration_seconds = int(float(route["duration"].replace("s", "")))
        static_seconds = int(float(route["staticDuration"].replace("s", "")))
        eta_minutes = round(duration_seconds / 60)
        normal_eta_minutes = round(static_seconds / 60)
        delay = duration_seconds - static_seconds

        if delay <= 120:
            traffic = "Light"
        elif delay <= 600:
            traffic = "Moderate"
        else:
            traffic = "Heavy"

        legs = route.get("legs", [])
        pickup_lat = pickup_lng = destination_lat = destination_lng = None
        if legs:
            start = legs[0].get("startLocation", {}).get("latLng", {})
            end = legs[-1].get("endLocation", {}).get("latLng", {})
            pickup_lat = start.get("latitude")
            pickup_lng = start.get("longitude")
            destination_lat = end.get("latitude")
            destination_lng = end.get("longitude")

        return {
            "pickup": data.pickup,
            "destination": data.destination,
            "distance_km": distance_km,
            "eta_minutes": eta_minutes,
            "normal_eta_minutes": normal_eta_minutes,
            "traffic": traffic,
            "traffic_delay_minutes": round(delay / 60),
            "polyline": route.get("polyline", {}).get("encodedPolyline"),
            "pickup_lat": pickup_lat,
            "pickup_lng": pickup_lng,
            "destination_lat": destination_lat,
            "destination_lng": destination_lng,
        }
    except HTTPException:
        raise
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Google Maps request failed: {str(e)}")


def demand_snapshot(db: Session):
    requested_rides = db.query(Ride).filter(Ride.status == "requested").count()
    active_drivers = (
        db.query(User)
        .filter(
            User.role == "driver",
            User.is_online.is_(True),
            User.latitude.isnot(None),
            User.longitude.isnot(None),
        )
        .count()
    )
    if requested_rides > max(active_drivers, 1):
        return "High"
    if requested_rides >= 2:
        return "Moderate"
    return "Normal"


def ai_multiplier(distance_km, eta_minutes, traffic, weather, temperature, demand, time_condition):
    multiplier = 1.0
    reason = "Normal conditions."

    if traffic == "Moderate":
        multiplier += 0.08
    elif traffic == "Heavy":
        multiplier += 0.15
    if weather == "Rain":
        multiplier += 0.10
    elif weather == "Storm":
        multiplier += 0.15
    if demand == "High":
        multiplier += 0.15
    if time_condition == "Night":
        multiplier += 0.05

    multiplier = min(multiplier, 1.50)

    if gemini_client:
        prompt = f"""
You are the AI Pricing Agent for AI-Ride Pune.

Ride details:
Distance: {distance_km} km
ETA: {eta_minutes} minutes
Traffic: {traffic}
Weather: {weather}
Temperature: {temperature}
Demand: {demand}
Time: {time_condition}

Choose a fare multiplier between 1.0 and 1.5.
Return ONLY valid JSON:
{{"multiplier": 1.0, "reason": "short explanation"}}
"""
        try:
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            ai_data = parse_json_from_ai(response.text)
            multiplier = float(ai_data.get("multiplier", multiplier))
            reason = ai_data.get("reason", reason)
        except Exception:
            pass

    return max(1.0, min(multiplier, 1.50)), reason


@app.post("/fare-preview")
def fare_preview(data: FarePreviewRequest, db: Session = Depends(get_db)):
    weather_data = get_pune_weather()
    weather = weather_data["condition"]
    temperature = weather_data["temperature"]
    current_hour = datetime.now().hour
    time_condition = "Night" if current_hour >= 22 or current_hour < 6 else "Day"
    demand = demand_snapshot(db)
    multiplier, reason = ai_multiplier(
        data.distance_km,
        data.eta_minutes,
        data.traffic,
        weather,
        temperature,
        demand,
        time_condition,
    )

    options = []
    for vehicle in VEHICLES.values():
        base_fare = vehicle["base"] + data.distance_km * vehicle["per_km"]
        final_fare = round(base_fare * multiplier, 2)
        options.append({
            "vehicle_type": vehicle["id"],
            "name": vehicle["name"],
            "seats": vehicle["seats"],
            "eta_minutes": data.eta_minutes + vehicle["eta_extra"],
            "base_fare": round(base_fare, 2),
            "final_fare": final_fare,
        })

    return {
        "distance_km": data.distance_km,
        "ai_multiplier": round(multiplier, 2),
        "ai_reason": reason,
        "weather": weather,
        "temperature": temperature,
        "demand": demand,
        "time": time_condition,
        "pickup_lat": data.pickup_lat,
        "pickup_lng": data.pickup_lng,
        "options": options,
        "final_fare": options[0]["final_fare"],
    }


@app.post("/confirm-ride")
def confirm_ride(
    data: ConfirmRideRequest,
    rider: User = Depends(require_role("rider")),
    db: Session = Depends(get_db),
):
    vehicle_type = (data.vehicle_type or "mini").lower()
    if vehicle_type not in VEHICLES:
        raise HTTPException(status_code=400, detail="Invalid vehicle type")

    active = (
        db.query(Ride)
        .filter(
            Ride.rider_id == rider.id,
            Ride.status.in_(["requested", "accepted", "ongoing"]),
        )
        .first()
    )
    if active:
        raise HTTPException(status_code=400, detail="You already have an active ride")

    vehicle = VEHICLES[vehicle_type]
    max_fare = (vehicle["base"] + data.distance_km * vehicle["per_km"]) * 1.50
    fare = min(float(data.fare), max_fare)
    zone = hex_cell(data.pickup_lat, data.pickup_lng)

    ride = Ride(
        rider_id=rider.id,
        pickup=data.pickup,
        destination=data.destination,
        pickup_lat=data.pickup_lat,
        pickup_lng=data.pickup_lng,
        destination_lat=data.destination_lat,
        destination_lng=data.destination_lng,
        distance_km=data.distance_km,
        eta_minutes=data.eta_minutes,
        traffic=data.traffic,
        weather=data.weather,
        fare=round(fare, 2),
        status="requested",
        zone_id=f"ZONE-{zone[0]}-{zone[1]}",
        vehicle_type=vehicle_type,
        payment_method=data.payment_method or "cash",
        payment_status="pending",
        polyline=data.polyline,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return {"message": "Ride confirmed!", **ride_payload(ride)}


@app.get("/rides/active")
def active_ride(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Ride).filter(Ride.status.in_(["requested", "accepted", "ongoing"]))
    if user.role == "rider":
        query = query.filter(Ride.rider_id == user.id)
    elif user.role == "driver":
        query = query.filter(Ride.driver_id == user.id)
    else:
        return {"ride": None}

    ride = query.order_by(Ride.created_at.desc()).first()
    if not ride:
        return {"ride": None}
    return {"ride": ride_payload(ride, include_otp=user.role == "rider" and ride.status in ["accepted", "ongoing"])}


@app.get("/rides/history")
def ride_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Ride)
    if user.role == "rider":
        query = query.filter(Ride.rider_id == user.id)
    elif user.role == "driver":
        query = query.filter(Ride.driver_id == user.id)

    rides = query.order_by(Ride.created_at.desc()).limit(30).all()
    return [ride_payload(ride) for ride in rides]


@app.post("/rides/{ride_id}/cancel")
def cancel_ride(
    ride_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if user.role == "rider" and ride.rider_id != user.id:
        raise HTTPException(status_code=403, detail="Not your ride")
    if user.role == "driver" and ride.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not your ride")

    if ride.status not in ["requested", "accepted"]:
        raise HTTPException(status_code=400, detail="This ride cannot be cancelled")

    ride.status = "cancelled"
    ride.cancelled_by = user.role
    db.commit()
    db.refresh(ride)
    return {"message": "Ride cancelled", **ride_payload(ride)}


@app.post("/rides/{ride_id}/rate")
def rate_ride(
    ride_id: int,
    data: RateRideRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride or ride.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed rides can be rated")

    if user.role == "rider" and ride.rider_id == user.id:
        ride.driver_rating = data.rating
        if ride.driver_id:
            driver = db.query(User).filter(User.id == ride.driver_id).first()
            if driver:
                ratings = [
                    r.driver_rating
                    for r in db.query(Ride).filter(Ride.driver_id == driver.id, Ride.driver_rating.isnot(None)).all()
                ]
                if ratings:
                    driver.rating = round(sum(ratings) / len(ratings), 2)
    elif user.role == "driver" and ride.driver_id == user.id:
        ride.rider_rating = data.rating
    else:
        raise HTTPException(status_code=403, detail="Not your ride")

    db.commit()
    return {"message": "Thanks for the rating"}


@app.post("/driver/location")
def update_driver_location(
    data: LocationUpdate,
    driver: User = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    driver.latitude = data.latitude
    driver.longitude = data.longitude
    db.commit()
    return {
        "message": "Driver location updated",
        "driver_id": driver.id,
        "latitude": driver.latitude,
        "longitude": driver.longitude,
        "is_online": driver.is_online,
    }


@app.post("/driver/online")
def set_driver_online(
    data: DriverOnlineRequest,
    driver: User = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    if data.vehicle_type:
        vehicle_type = data.vehicle_type.lower()
        if vehicle_type not in VEHICLES:
            raise HTTPException(status_code=400, detail="Invalid vehicle type")
        driver.vehicle_type = vehicle_type
    if data.vehicle_number:
        driver.vehicle_number = data.vehicle_number
    driver.is_online = data.is_online
    db.commit()
    return public_user(driver)


@app.post("/rider/location")
def update_rider_location(
    data: LocationUpdate,
    rider: User = Depends(require_role("rider")),
    db: Session = Depends(get_db),
):
    rider.latitude = data.latitude
    rider.longitude = data.longitude
    db.commit()
    return {"message": "Rider location updated"}


@app.get("/drivers/nearby")
def nearby_drivers(lat: float, lng: float, db: Session = Depends(get_db)):
    drivers = (
        db.query(User)
        .filter(
            User.role == "driver",
            User.is_online.is_(True),
            User.latitude.isnot(None),
            User.longitude.isnot(None),
        )
        .all()
    )
    result = []
    for driver in drivers:
        distance = haversine_km(lat, lng, driver.latitude, driver.longitude)
        if distance <= 5:
            zone = hex_cell(driver.latitude, driver.longitude)
            result.append({
                "driver_id": driver.id,
                "name": driver.name,
                "latitude": driver.latitude,
                "longitude": driver.longitude,
                "distance_km": round(distance, 2),
                "zone_id": f"ZONE-{zone[0]}-{zone[1]}",
                "vehicle_type": driver.vehicle_type,
                "vehicle_number": driver.vehicle_number,
                "rating": driver.rating,
            })
    result.sort(key=lambda x: x["distance_km"])
    return result


@app.get("/driver/rides")
def driver_rides(driver: User = Depends(require_role("driver")), db: Session = Depends(get_db)):
    if not driver.is_online or driver.latitude is None or driver.longitude is None:
        return []

    rides = (
        db.query(Ride)
        .filter(Ride.status == "requested")
        .order_by(Ride.created_at.desc())
        .all()
    )
    result = []
    driver_zone = hex_cell(driver.latitude, driver.longitude)

    for ride in rides:
        if ride.pickup_lat is None or ride.pickup_lng is None:
            continue
        if ride.vehicle_type and driver.vehicle_type and ride.vehicle_type != driver.vehicle_type:
            continue

        distance = haversine_km(driver.latitude, driver.longitude, ride.pickup_lat, ride.pickup_lng)
        ride_zone = hex_cell(ride.pickup_lat, ride.pickup_lng)
        zone_distance = abs(driver_zone[0] - ride_zone[0]) + abs(driver_zone[1] - ride_zone[1])

        if distance <= 5 and zone_distance <= 2:
            item = ride_payload(ride)
            item["nearby_distance_km"] = round(distance, 2)
            result.append(item)

    return result


@app.post("/driver/accept/{ride_id}")
def accept_ride(
    ride_id: int,
    driver: User = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    if not driver.is_online:
        raise HTTPException(status_code=400, detail="Go online to accept rides")

    busy = (
        db.query(Ride)
        .filter(Ride.driver_id == driver.id, Ride.status.in_(["accepted", "ongoing"]))
        .first()
    )
    if busy:
        raise HTTPException(status_code=400, detail="Complete your current ride first")

    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status != "requested":
        raise HTTPException(status_code=400, detail="Ride is no longer available")
    if driver.latitude is None or driver.longitude is None:
        raise HTTPException(status_code=400, detail="Driver location is required")

    distance = haversine_km(driver.latitude, driver.longitude, ride.pickup_lat, ride.pickup_lng)
    if distance > 5:
        raise HTTPException(status_code=400, detail="Ride is outside your nearby area")

    ride.driver_id = driver.id
    ride.status = "accepted"
    ride.otp = str(secrets.randbelow(10000)).zfill(4)
    db.commit()
    db.refresh(ride)
    return {"message": "Ride accepted", **ride_payload(ride)}


@app.post("/driver/start/{ride_id}")
def start_ride(
    ride_id: int,
    data: StartRideRequest,
    driver: User = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.driver_id != driver.id:
        raise HTTPException(status_code=403, detail="This ride belongs to another driver")
    if ride.status != "accepted":
        raise HTTPException(status_code=400, detail="Ride cannot be started")
    if not ride.otp:
        raise HTTPException(status_code=400, detail="OTP has not been generated")
    if data.otp != ride.otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    ride.status = "ongoing"
    db.commit()
    db.refresh(ride)
    return {"message": "Ride started", **ride_payload(ride)}


@app.post("/driver/complete/{ride_id}")
def complete_ride(
    ride_id: int,
    driver: User = Depends(require_role("driver")),
    db: Session = Depends(get_db),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.driver_id != driver.id:
        raise HTTPException(status_code=403, detail="This ride belongs to another driver")
    if ride.status != "ongoing":
        raise HTTPException(status_code=400, detail="Ride is not ongoing")

    ride.status = "completed"
    ride.payment_status = "collected_cash" if ride.payment_method == "cash" else "paid"
    driver.is_online = True
    db.commit()
    db.refresh(ride)
    return {"message": "Ride completed", **ride_payload(ride)}


@app.get("/ride/{ride_id}/tracking")
def track_ride(
    ride_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if user.role == "rider" and ride.rider_id != user.id:
        raise HTTPException(status_code=403, detail="Not your ride")
    if user.role == "driver" and ride.driver_id not in (None, user.id):
        raise HTTPException(status_code=403, detail="Not your ride")

    driver = db.query(User).filter(User.id == ride.driver_id).first() if ride.driver_id else None
    rider = db.query(User).filter(User.id == ride.rider_id).first()

    nearby = []
    if ride.pickup_lat is not None and ride.status == "requested":
        drivers = (
            db.query(User)
            .filter(
                User.role == "driver",
                User.is_online.is_(True),
                User.latitude.isnot(None),
                User.longitude.isnot(None),
            )
            .all()
        )
        for d in drivers:
            distance = haversine_km(ride.pickup_lat, ride.pickup_lng, d.latitude, d.longitude)
            if distance <= 5:
                nearby.append({
                    "driver_id": d.id,
                    "name": d.name,
                    "latitude": d.latitude,
                    "longitude": d.longitude,
                    "distance_km": round(distance, 2),
                    "vehicle_type": d.vehicle_type,
                })

    show_otp = ride.status in ["accepted", "ongoing"] and user.role == "rider"

    return {
        **ride_payload(ride, include_otp=show_otp and user.role == "rider"),
        "driver_name": driver.name if driver else None,
        "driver_phone": driver.phone if driver else None,
        "driver_vehicle": driver.vehicle_number if driver else None,
        "driver_rating": driver.rating if driver else None,
        "latitude": driver.latitude if driver else None,
        "longitude": driver.longitude if driver else None,
        "rider_name": rider.name if rider else None,
        "rider_latitude": rider.latitude if rider else None,
        "rider_longitude": rider.longitude if rider else None,
        "nearby_drivers": nearby,
    }


@app.get("/manager/stats")
def manager_stats(
    _: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    return {
        "total_users": db.query(User).count(),
        "total_rides": db.query(Ride).count(),
        "active_drivers": db.query(User).filter(User.role == "driver", User.is_online.is_(True)).count(),
        "completed_rides": db.query(Ride).filter(Ride.status == "completed").count(),
        "requested_rides": db.query(Ride).filter(Ride.status == "requested").count(),
        "ongoing_rides": db.query(Ride).filter(Ride.status == "ongoing").count(),
        "cancelled_rides": db.query(Ride).filter(Ride.status == "cancelled").count(),
    }


def call_gemini_safely(prompt: str) -> str | None:
    if not gemini_client:
        return None
    # Try multiple model names in case one is deprecated or unavailable
    models_to_try = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.8-flash"]
    for model_name in dict.fromkeys(models_to_try):
        try:
            response = gemini_client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"Gemini attempt with {model_name} failed: {e}")
    return None


@app.get("/manager/ai-report")
def manager_ai_report(
    _: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    total = db.query(Ride).count()
    requested = db.query(Ride).filter(Ride.status == "requested").count()
    ongoing = db.query(Ride).filter(Ride.status == "ongoing").count()
    completed = db.query(Ride).filter(Ride.status == "completed").count()
    drivers = db.query(User).filter(User.role == "driver").count()

    report = {
        "overview": f"{total} total rides recorded ({completed} completed, {ongoing} ongoing, {requested} waiting).",
        "operations": f"Currently managing {requested} requested rides and {ongoing} active trips across Pune.",
        "fleet": f"{drivers} registered drivers in the fleet.",
        "attention": "All systems operating normally." if requested == 0 else f"{requested} ride(s) awaiting driver assignment.",
    }

    prompt = f"""
You are the AI Manager Assistant for AI-Ride Pune.
Total rides: {total}
Requested: {requested}
Ongoing: {ongoing}
Completed: {completed}
Drivers: {drivers}
Return ONLY JSON:
{{"overview":"...","operations":"...","fleet":"...","attention":"..."}}
Keep every field short.
"""
    ai_text = call_gemini_safely(prompt)
    if ai_text:
        try:
            report.update(parse_json_from_ai(ai_text))
        except Exception:
            pass

    return {"report": report}


@app.post("/manager/ai-chat")
def manager_ai_chat(
    data: ManagerChatRequest,
    _: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    total = db.query(Ride).count()
    requested = db.query(Ride).filter(Ride.status == "requested").count()
    ongoing = db.query(Ride).filter(Ride.status == "ongoing").count()
    completed = db.query(Ride).filter(Ride.status == "completed").count()
    cancelled = db.query(Ride).filter(Ride.status == "cancelled").count()
    active_drivers = db.query(User).filter(User.role == "driver", User.is_online.is_(True)).count()
    total_drivers = db.query(User).filter(User.role == "driver").count()

    prompt = f"""
You are the AI Manager Assistant for AI-Ride Pune.
Total rides: {total}
Requested: {requested}
Ongoing: {ongoing}
Completed: {completed}
Cancelled: {cancelled}
Active Online Drivers: {active_drivers} / {total_drivers}
Manager question: {data.question}
Answer in simple professional language. Keep it short.
"""
    ai_answer = call_gemini_safely(prompt)
    if ai_answer:
        return {"answer": ai_answer}

    # Smart built-in assistant response if Gemini API key is missing or quota is exceeded
    q = data.question.lower()
    if "active" in q or "ongoing" in q or "how many" in q:
        return {
            "answer": (
                f"There are currently {ongoing} ongoing rides and {requested} requested rides waiting for pickup. "
                f"Out of {total} total rides today, {completed} have been completed successfully."
            )
        }
    elif "attention" in q or "issue" in q or "problem" in q:
        if requested > active_drivers:
            return {
                "answer": (
                    f"High demand alert: {requested} rides are waiting for a driver, but only {active_drivers} "
                    f"driver(s) are currently online. Consider notifying more drivers to go online."
                )
            }
        return {
            "answer": (
                f"Operations look healthy! We have {active_drivers} online driver(s) ready to handle "
                f"{requested} requested rides, with {ongoing} trips in progress."
            )
        }
    else:
        return {
            "answer": (
                f"Today's Operations Summary: {total} total rides ({completed} completed, {ongoing} ongoing, "
                f"{requested} requested, {cancelled} cancelled). Fleet status: {active_drivers} of {total_drivers} drivers online."
            )
        }