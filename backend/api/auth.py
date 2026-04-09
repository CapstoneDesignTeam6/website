from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from schemas.user import UserCreate, UserLogin, UserResponse
from services.auth_service import AuthService
from database import get_supabase
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["auth"])


def _to_user_response(user: dict) -> UserResponse:
    return UserResponse(**user)


@router.post("/signup")
def signup(user_data: UserCreate, supabase: Client = Depends(get_supabase)):
    """회원가입"""
    print(">>> [1] signup 진입")
    try:
        print(">>> [2] user_exists(username) 호출 전")
        exists = AuthService.user_exists(supabase, username=user_data.username)
        print(f">>> [3] user_exists(username) 완료: {exists}")
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용 중인 아이디입니다."
            )

        print(">>> [4] user_exists(email) 호출 전")
        exists = AuthService.user_exists(supabase, email=user_data.email)
        print(f">>> [5] user_exists(email) 완료: {exists}")
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용 중인 이메일입니다."
            )

        print(">>> [6] create_user 호출 전")
        user = AuthService.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            supabase=supabase
        )
        print(f">>> [7] create_user 완료: {user}")

        access_token = AuthService.create_access_token(data={"sub": str(user['id'])})
        print(">>> [8] 응답 반환")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": _to_user_response(user)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f">>> [ERROR] {type(e).__name__}: {e}")
        logger.error(f"[signup] 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"회원가입 처리 중 오류가 발생했습니다: {str(e)}")


@router.post("/login")
def login(login_data: UserLogin, supabase: Client = Depends(get_supabase)):
    """로그인"""
    try:
        user = AuthService.authenticate_user(
            username=login_data.username,
            email=login_data.email,
            password=login_data.password,
            supabase=supabase
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="아이디, 이메일 또는 비밀번호가 잘못되었습니다."
            )

        access_token = AuthService.create_access_token(data={"sub": str(user['id'])})

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": _to_user_response(user)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[login] 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"로그인 처리 중 오류가 발생했습니다: {str(e)}")


@router.post("/guest")
def create_guest(supabase: Client = Depends(get_supabase)):
    """게스트 모드"""
    try:
        user = AuthService.create_guest_user(supabase=supabase)
        access_token = AuthService.create_access_token(data={"sub": str(user['id'])})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": _to_user_response(user)
        }
    except Exception as e:
        logger.error(f"[guest] 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"게스트 생성 중 오류가 발생했습니다: {str(e)}")
