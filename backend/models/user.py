from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)  # 회원만
    email = Column(String, unique=True, index=True, nullable=True)      # 회원만
    password_hash = Column(String, nullable=True)                       # 회원만
    
    # 게스트 여부
    is_guest = Column(Boolean, default=False, index=True)
    guest_session_id = Column(String, unique=True, nullable=True)       # 게스트 임시 ID
    
    # 레벨 시스템
    level = Column(Integer, default=1)                                   # 현재 레벨
    experience_points = Column(Integer, default=0)                       # 총 경험치
    current_level_exp = Column(Integer, default=0)                       # 현재 레벨 누적 경험치
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    discussions = relationship("DiscussionSession", back_populates="user")
    
    def __repr__(self):
        username = self.username if not self.is_guest else f"guest_{self.guest_session_id}"
        return f"<User(id={self.id}, name={username}, level={self.level})>"
