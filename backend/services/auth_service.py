from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from supabase import Client
from config import settings
import uuid

# 비밀번호 해싱
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except JWTError:
            return None

    @staticmethod
    def get_user_from_token(token: str, supabase: Client) -> Optional[dict]:
        payload = AuthService.verify_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        response = supabase.table('users').select('*').eq('id', int(user_id)).execute()
        return response.data[0] if response.data else None

    @staticmethod
    def create_user(username: str, email: str, password: str, supabase: Client) -> dict:
        """회원가입"""
        hashed_password = AuthService.hash_password(password)
        response = supabase.table('users').insert({
            'username': username,
            'email': email,
            'password_hash': hashed_password,
            'is_guest': False,
            'level': 1,
            'experience_points': 0,
            'current_level_exp': 0,
        }).execute()
        return response.data[0]

    @staticmethod
    def authenticate_user(
        username: Optional[str],
        email: Optional[str],
        password: str,
        supabase: Client
    ) -> Optional[dict]:
        """로그인"""
        if username:
            response = supabase.table('users').select('*').eq('username', username).execute()
        elif email:
            response = supabase.table('users').select('*').eq('email', email).execute()
        else:
            return None

        if not response.data:
            return None

        user = response.data[0]
        if not AuthService.verify_password(password, user['password_hash']):
            return None
        return user

    @staticmethod
    def create_guest_user(supabase: Client) -> dict:
        """게스트 사용자 생성"""
        guest_session_id = str(uuid.uuid4())
        response = supabase.table('users').insert({
            'is_guest': True,
            'guest_session_id': guest_session_id,
            'level': 1,
            'experience_points': 0,
            'current_level_exp': 0,
        }).execute()
        return response.data[0]

    @staticmethod
    def user_exists(supabase: Client, username: Optional[str] = None, email: Optional[str] = None) -> bool:
        """사용자 존재 여부 확인"""
        if username:
            response = supabase.table('users').select('id').eq('username', username).execute()
        elif email:
            response = supabase.table('users').select('id').eq('email', email).execute()
        else:
            return False
        return len(response.data) > 0
