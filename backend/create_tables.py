from sqlalchemy import text

from database import Base, engine
from models import User, Ride  # noqa: F401


def ensure_columns():
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION NOT NULL DEFAULT 5.0",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(30)",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS rider_rating INTEGER",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_rating INTEGER",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS polyline TEXT",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20)",
    ]

    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    print("Database tables are ready.")
