from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class UserResponse(BaseModel):
    id: int
    username: Optional[str] = None
    email: Optional[str] = None
    is_guest: bool = False
    level: int = 1
    experience_points: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True, "extra": "ignore"}

class UserDetailResponse(UserResponse):
    current_level_exp: int
    updated_at: datetime
