from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users_local"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    level = Column(Integer, default=1)
    experience_points = Column(Integer, default=0)
    current_level_exp = Column(Integer, default=0)
    is_guest = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
