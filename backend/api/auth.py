from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from schemas.user import UserCreate, UserLogin, UserResponse, UserDetailResponse
from services.auth_service import AuthService
from database import get_db
from models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    # 중복 확인
    if AuthService.user_exists(username=user_data.username, db=db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다."
        )
    
    if AuthService.user_exists(email=user_data.email, db=db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 이메일입니다."
        )
    
    # 사용자 생성
    user = AuthService.create_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        db=db
    )
    
    return user

@router.post("/login")
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """로그인"""
    # 사용자 인증
    user = AuthService.authenticate_user(
        username=login_data.username,
        email=login_data.email,
        password=login_data.password,
        db=db
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디, 이메일 또는 비밀번호가 잘못되었습니다."
        )
    
    # 토큰 생성
    access_token = AuthService.create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }

@router.post("/guest")
async def create_guest(db: Session = Depends(get_db)):
    """게스트 모드"""
    user = AuthService.create_guest_user(db=db)
    
    # 게스트용 토큰 생성
    access_token = AuthService.create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }

@router.get("/me", response_model=UserDetailResponse)
async def get_current_user(
    token: str = Depends(lambda: None),  # 헤더에서 토큰 추출
    db: Session = Depends(get_db)
):
    """현재 사용자 정보"""
    # 토큰 검증 로직 (실제로는 Depends를 사용하여 구현)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 필요합니다."
        )
    
    user = AuthService.get_user_from_token(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다."
        )
    
    return UserDetailResponse.from_orm(user)
