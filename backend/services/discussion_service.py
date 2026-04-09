from datetime import datetime
from sqlalchemy.orm import Session
from models.discussion import DiscussionSession
from models.message import Message
from models.user import User
from schemas.discussion import DiscussionCreate, DiscussionEndRequest
from services.level_service import LevelService
from config import settings

class DiscussionService:
    @staticmethod
    def create_discussion(user: User, discussion_data: DiscussionCreate, db: Session) -> DiscussionSession:
        """새로운 토론 세션 생성"""
        discussion = DiscussionSession(
            user_id=user.id,
            title=discussion_data.title,
            topic=discussion_data.topic,
            agents_config=discussion_data.agents_config,
            status="ongoing"
        )
        db.add(discussion)
        db.commit()
        db.refresh(discussion)
        return discussion
    
    @staticmethod
    def add_message(session: DiscussionSession, speaker: str, content: str, role: str, db: Session) -> Message:
        """토론에 메시지 추가"""
        message = Message(
            session_id=session.id,
            speaker=speaker,
            content=content,
            role=role
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
    
    @staticmethod
    def end_discussion(session: DiscussionSession, end_request: DiscussionEndRequest, user: User, db: Session) -> dict:
        """토론 종료 및 평가"""
        # 토론 상태 업데이트
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        session.score = end_request.score
        session.evaluation_detail = end_request.evaluation_detail
        
        # 경험치 계산
        exp, star_rating = LevelService.calculate_score_exp(end_request.score)
        session.exp_earned = exp
        
        db.commit()
        db.refresh(session)
        
        # 사용자에게 경험치 추가 및 레벨업 확인
        level_result = LevelService.add_experience(user, exp, db)
        
        return {
            "discussion_id": session.id,
            "score": session.score,
            "star_rating": star_rating,
            "exp_earned": exp,
            "level_info": level_result
        }
    
    @staticmethod
    def get_user_discussions(user: User, db: Session, skip: int = 0, limit: int = 20) -> list:
        """사용자의 모든 토론 조회"""
        return db.query(DiscussionSession).filter(
            DiscussionSession.user_id == user.id
        ).order_by(DiscussionSession.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_discussion_by_id(discussion_id: int, db: Session) -> DiscussionSession:
        """토론 상세 조회"""
        return db.query(DiscussionSession).filter(DiscussionSession.id == discussion_id).first()
    
    @staticmethod
    def get_discussion_stats(user: User, db: Session) -> dict:
        """사용자의 토론 통계"""
        discussions = db.query(DiscussionSession).filter(
            DiscussionSession.user_id == user.id
        ).all()
        
        total_discussions = len(discussions)
        completed = len([d for d in discussions if d.status == "completed"])
        total_exp = sum([d.exp_earned for d in discussions if d.status == "completed"])
        avg_score = sum([d.score for d in discussions if d.status == "completed"]) / completed if completed > 0 else 0
        
        return {
            "total_discussions": total_discussions,
            "completed_discussions": completed,
            "total_exp_earned": total_exp,
            "average_score": avg_score
        }
    
    @staticmethod
    def check_guest_daily_limit(user: User, db: Session) -> bool:
        """게스트 일일 토론 제한 확인"""
        if not user.is_guest:
            return True
        
        from datetime import date
        today = date.today()
        
        today_discussions = db.query(DiscussionSession).filter(
            DiscussionSession.user_id == user.id,
            DiscussionSession.created_at >= datetime(today.year, today.month, today.day)
        ).count()
        
        return today_discussions < settings.GUEST_DAILY_LIMIT
