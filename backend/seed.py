import os

from dotenv import load_dotenv

from auth_utils import hash_password
from create_tables import ensure_columns
from database import Base, SessionLocal, engine
from models import User

load_dotenv()

DEMO_PASSWORD = os.getenv("SEED_PASSWORD", "password123")

ACCOUNTS = [
    {
        "name": "Aarav Rider",
        "email": "rider1@example.com",
        "phone": "9000000001",
        "role": "rider",
    },
    {
        "name": "Rohan Driver",
        "email": "driver1@example.com",
        "phone": "9000000002",
        "role": "driver",
        "vehicle_type": "mini",
        "vehicle_number": "MH12AB1234",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "is_online": True,
    },
    {
        "name": "Pune Manager",
        "email": "manager1@example.com",
        "phone": "9000000003",
        "role": "manager",
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    db = SessionLocal()
    try:
        for account in ACCOUNTS:
            existing = db.query(User).filter(User.email == account["email"]).first()
            if existing:
                existing.role = account["role"]
                existing.password_hash = hash_password(DEMO_PASSWORD)
                continue
            user = User(
                name=account["name"],
                email=account["email"],
                phone=account["phone"],
                password_hash=hash_password(DEMO_PASSWORD),
                role=account["role"],
                vehicle_type=account.get("vehicle_type"),
                vehicle_number=account.get("vehicle_number"),
                latitude=account.get("latitude"),
                longitude=account.get("longitude"),
                is_online=account.get("is_online", False),
            )
            db.add(user)
        db.commit()
        print("Demo accounts ready.")
        print(f"Password for all demo users: {DEMO_PASSWORD}")
        print("rider1@example.com / driver1@example.com / manager1@example.com")
    finally:
        db.close()


if __name__ == "__main__":
    seed()