from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from supabase import Client

from schemas.level import UserLevelResponse
from services.auth_service import AuthService
from services.level_service import LevelService
from database import get_db, get_supabase

router = APIRouter(prefix="/level", tags=["level"])

# 의존성: 현재 사용자 조회
async def get_current_user(request: Request, supabase: Client = Depends(get_supabase)) -> dict:
    """Authorization 헤더에서 토큰을 읽어 사용자 조회"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 필요합니다."
        )
    token = auth_header[len('Bearer '):]
    user = AuthService.get_user_from_token(token, supabase)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다."
        )
    return user

@router.get("/my-level", response_model=UserLevelResponse)
async def get_my_level(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """현재 사용자의 레벨 정보 조회"""
    level_info = LevelService.get_user_level_info(user, db)
    return level_info

@router.get("/leaderboard", response_model=list)
async def get_leaderboard(
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """전체 사용자 레벨 랭킹"""
    from models.user import User as UserModel
    
    top_users = db.query(UserModel).filter(
        UserModel.is_guest == False
    ).order_by(
        UserModel.level.desc(),
        UserModel.experience_points.desc()
    ).limit(limit).all()
    
    leaderboard = []
    for rank, user in enumerate(top_users, 1):
        leaderboard.append({
            "rank": rank,
            "username": user.username,
            "level": user.level,
            "experience_points": user.experience_points
        })
    
    return leaderboard
