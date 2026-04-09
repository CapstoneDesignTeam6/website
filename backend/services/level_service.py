from sqlalchemy.orm import Session
from supabase import Client
from models.level_config import (
    LevelConfig, 
    LEVEL_CONFIG_DATA, 
    get_exp_from_score,
    get_star_rating
)
from schemas.level import UserLevelResponse, LevelUpResponse

class LevelService:
    @staticmethod
    def initialize_level_configs(db: Session):
        """초기 레벨 설정 생성"""
        # 기존 설정 확인
        existing = db.query(LevelConfig).first()
        if existing:
            return
        
        # 새로운 설정 추가
        for config_data in LEVEL_CONFIG_DATA:
            config = LevelConfig(**config_data)
            db.add(config)
        
        db.commit()
    
    @staticmethod
    def add_experience(user: dict, exp: int, db: Session, supabase: Client) -> dict:
        """경험치 추가 및 레벨 업 확인"""
        new_exp = user['experience_points'] + exp
        new_level_exp = user['current_level_exp'] + exp
        new_level = user['level']
        old_level = new_level

        level_up = False

        # 레벨업 확인
        while True:
            next_level_config = db.query(LevelConfig).filter(
                LevelConfig.level == new_level + 1
            ).first()

            if not next_level_config:
                break

            if new_exp >= next_level_config.required_exp:
                new_level += 1
                level_up = True
            else:
                break

        # Supabase에 경험치/레벨 업데이트
        supabase.table('users').update({
            'experience_points': new_exp,
            'current_level_exp': new_level_exp,
            'level': new_level,
        }).eq('id', user['id']).execute()

        return {
            "level_up": level_up,
            "old_level": old_level,
            "new_level": new_level,
            "total_exp": new_exp,
            "message": f"레벨 {old_level} → {new_level}로 상승했습니다!" if level_up else f"{exp} 경험치를 획득했습니다!"
        }
    
    @staticmethod
    def get_user_level_info(user: dict, db: Session) -> UserLevelResponse:
        """사용자 레벨 정보 조회"""
        current_level_config = db.query(LevelConfig).filter(
            LevelConfig.level == user['level']
        ).first()

        next_level_config = db.query(LevelConfig).filter(
            LevelConfig.level == user['level'] + 1
        ).first()

        if not next_level_config:
            next_required = current_level_config.required_exp
            exp_to_next = 0
            progress = 100.0
        else:
            next_required = next_level_config.required_exp
            exp_to_next = max(0, next_required - user['experience_points'])
            progress = min(100.0, ((user['experience_points'] - current_level_config.required_exp) /
                         (next_required - current_level_config.required_exp)) * 100)

        return UserLevelResponse(
            level=user['level'],
            experience_points=user['experience_points'],
            current_level_exp=user['current_level_exp'],
            next_level_required_exp=next_required,
            exp_to_next_level=exp_to_next,
            progress_percentage=progress
        )
    
    @staticmethod
    def calculate_score_exp(score: float) -> tuple[int, str]:
        """점수에서 경험치 계산"""
        exp = get_exp_from_score(score)
        star = get_star_rating(score)
        return exp, star
