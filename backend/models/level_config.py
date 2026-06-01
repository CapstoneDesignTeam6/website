from sqlalchemy import Column, Integer, String
from database import Base


class LevelConfig(Base):
    __tablename__ = "level_configs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(Integer, unique=True, nullable=False)
    required_exp = Column(Integer, nullable=False)
    title = Column(String, nullable=False, default="토론가")


# 레벨별 필요 경험치 및 칭호
LEVEL_CONFIG_DATA = [
    {"level": 1,  "required_exp": 0,    "title": "입문 토론가"},
    {"level": 2,  "required_exp": 100,  "title": "초급 토론가"},
    {"level": 3,  "required_exp": 250,  "title": "중급 토론가"},
    {"level": 4,  "required_exp": 500,  "title": "숙련 토론가"},
    {"level": 5,  "required_exp": 900,  "title": "고급 토론가"},
    {"level": 6,  "required_exp": 1400, "title": "전문 토론가"},
    {"level": 7,  "required_exp": 2000, "title": "논리가"},
    {"level": 8,  "required_exp": 2700, "title": "변론가"},
    {"level": 9,  "required_exp": 3500, "title": "웅변가"},
    {"level": 10, "required_exp": 5000, "title": "토론 마스터"},
]


def get_exp_from_score(score: float) -> int:
    """토론 점수(0~100)를 경험치로 변환"""
    if score >= 90:
        return 50
    elif score >= 75:
        return 35
    elif score >= 60:
        return 25
    elif score >= 40:
        return 15
    else:
        return 5


def get_star_rating(score: float) -> str:
    """토론 점수를 별점 문자열로 변환"""
    if score >= 90:
        return "⭐⭐⭐⭐⭐"
    elif score >= 75:
        return "⭐⭐⭐⭐"
    elif score >= 60:
        return "⭐⭐⭐"
    elif score >= 40:
        return "⭐⭐"
    else:
        return "⭐"
