from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from config import settings
from models.user import User

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
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            return None
    
    @staticmethod
    def get_user_from_token(token: str, db: Session) -> Optional[User]:
        payload = AuthService.verify_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        return db.query(User).filter(User.id == int(user_id)).first()
    
    @staticmethod
    def create_user(username: str, email: str, password: str, db: Session) -> User:
        """회원가입"""
        hashed_password = AuthService.hash_password(password)
        user = User(
            username=username,
            email=email,
            password_hash=hashed_password,
            is_guest=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def authenticate_user(username: Optional[str], email: Optional[str], password: str, db: Session) -> Optional[User]:
        """로그인"""
        if username:
            user = db.query(User).filter(User.username == username).first()
        elif email:
            user = db.query(User).filter(User.email == email).first()
        else:
            return None
        
        if not user or not AuthService.verify_password(password, user.password_hash):
            return None
        
        return user
    
    @staticmethod
    def create_guest_user(db: Session) -> User:
        """게스트 사용자 생성"""
        import uuid
        guest_session_id = str(uuid.uuid4())
        user = User(
            is_guest=True,
            guest_session_id=guest_session_id,
            level=1,
            experience_points=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def user_exists(username: Optional[str] = None, email: Optional[str] = None, db: Session = None) -> bool:
        """사용자 존재 여부 확인"""
        if not db:
            return False
        
        if username:
            return db.query(User).filter(User.username == username).first() is not None
        elif email:
            return db.query(User).filter(User.email == email).first() is not None
        
        return False
