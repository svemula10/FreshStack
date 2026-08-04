from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./freshstack.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Graceful Redis fallback mock since local Redis server is bypassed
class DummyRedis:
    def smembers(self, *args, **kwargs):
        return set()
    def sadd(self, *args, **kwargs):
        pass
    def expire(self, *args, **kwargs):
        pass

redis_client = DummyRedis()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()