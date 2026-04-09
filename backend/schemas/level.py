from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class LevelConfigResponse(BaseModel):
    level: int
    required_exp: int
    title: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True

class UserLevelResponse(BaseModel):
    level: int
    experience_points: int
    current_level_exp: int
    next_level_required_exp: int
    exp_to_next_level: int
    progress_percentage: float

class LevelUpResponse(BaseModel):
    old_level: int
    new_level: int
    exp_earned: int
    total_exp: int
    message: str
