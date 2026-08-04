from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import redis
import os

# Zero-config SQLite database stored locally in your project folder
DATABASE_URL = "sqlite:///./freshstack.db"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# SQLite requires check_same_thread=False for FastAPI multithreading
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()