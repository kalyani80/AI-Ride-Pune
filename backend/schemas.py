from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: str = "rider"
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


class RouteRequest(BaseModel):
    pickup: str
    destination: str


class FarePreviewRequest(BaseModel):
    distance_km: float
    eta_minutes: int
    traffic: str
    pickup: str
    destination: str
    pickup_lat: float
    pickup_lng: float


class ConfirmRideRequest(BaseModel):
    pickup: str
    destination: str
    distance_km: float
    eta_minutes: int
    traffic: str
    weather: str
    fare: float
    pickup_lat: float
    pickup_lng: float
    destination_lat: float = 0
    destination_lng: float = 0
    vehicle_type: str = "mini"
    payment_method: str = "cash"
    polyline: Optional[str] = None


class StartRideRequest(BaseModel):
    otp: str


class DriverOnlineRequest(BaseModel):
    is_online: bool
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None


class RateRideRequest(BaseModel):
    rating: int = Field(ge=1, le=5)


class ManagerChatRequest(BaseModel):
    question: str
