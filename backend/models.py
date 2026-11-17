from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Boolean, Text
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(15), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="rider")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_online = Column(Boolean, nullable=False, default=False)
    vehicle_type = Column(String(30), nullable=True)
    vehicle_number = Column(String(30), nullable=True)
    rating = Column(Float, nullable=False, default=5.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    pickup = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    destination_lat = Column(Float, nullable=True)
    destination_lng = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=False)
    eta_minutes = Column(Integer, nullable=False)
    traffic = Column(String(30), nullable=False)
    weather = Column(String(30), nullable=False)
    fare = Column(Float, nullable=False)
    status = Column(String(30), nullable=False, default="requested")
    zone_id = Column(String(50), nullable=True)
    otp = Column(String(6), nullable=True)
    vehicle_type = Column(String(30), nullable=True)
    payment_method = Column(String(20), nullable=False, default="cash")
    payment_status = Column(String(20), nullable=False, default="pending")
    rider_rating = Column(Integer, nullable=True)
    driver_rating = Column(Integer, nullable=True)
    polyline = Column(Text, nullable=True)
    cancelled_by = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
