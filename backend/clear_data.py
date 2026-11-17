from database import SessionLocal
from models import Ride, User

db = SessionLocal()
num_rides = db.query(Ride).delete()
num_users = db.query(User).delete()
db.commit()
db.close()
print(f"Successfully cleared {num_rides} rides and {num_users} users!")
