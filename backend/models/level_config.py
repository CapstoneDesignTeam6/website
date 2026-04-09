from sqlalchemy import Column, Integer, String, Text
from database import Base

class LevelConfig(Base):
    __tablename__ = "level_configs"
    
    level = Column(Integer, primary_key=True, index=True)               # 레벨 (1-10)
    required_exp = Column(Integer)                                      # 해당 레벨까지 필요한 누적 경험치
    title = Column(String)                                              # 레벨 제목 (금메달, 은메달 등)
    description = Column(Text, nullable=True)                           # 설명
    
    def __repr__(self):
        return f"<LevelConfig(level={self.level}, required_exp={self.required_exp}, title={self.title})>"

# 기본 레벨 설정 데이터
LEVEL_CONFIG_DATA = [
    {"level": 1, "required_exp": 0, "title": "🥇 초보자 (Bronze)", "description": "토론을 시작한 초보 사용자"},
    {"level": 2, "required_exp": 100, "title": "🥈 숙련자 (Silver)", "description": "기본기를 갖춘 사용자"},
    {"level": 3, "required_exp": 250, "title": "🥉 전문가 (Gold)", "description": "깊이 있는 토론을 하는 사용자"},
    {"level": 4, "required_exp": 450, "title": "💎 마스터 (Platinum)", "description": "우수한 토론 능력을 보인 사용자"},
    {"level": 5, "required_exp": 700, "title": "👑 그랜드마스터", "description": "최고 수준의 토론자"},
]

# 점수에 따른 경험치 정의
SCORE_TO_EXP = {
    (90, 100): 50,   # 90-100점: 50 exp (⭐⭐⭐⭐⭐)
    (70, 89): 30,    # 70-89점: 30 exp (⭐⭐⭐⭐)
    (50, 69): 15,    # 50-69점: 15 exp (⭐⭐⭐)
    (30, 49): 5,     # 30-49점: 5 exp (⭐⭐)
    (0, 29): 0,      # 0-29점: 0 exp (⭐)
}

def get_exp_from_score(score: float) -> int:
    """점수에서 경험치로 변환"""
    for (min_score, max_score), exp in SCORE_TO_EXP.items():
        if min_score <= score <= max_score:
            return exp
    return 0

def get_star_rating(score: float) -> str:
    """점수에 따른 별점 반환"""
    if 90 <= score <= 100:
        return "⭐⭐⭐⭐⭐"
    elif 70 <= score < 90:
        return "⭐⭐⭐⭐"
    elif 50 <= score < 70:
        return "⭐⭐⭐"
    elif 30 <= score < 50:
        return "⭐⭐"
    else:
        return "⭐"
