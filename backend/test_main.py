import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from models.user import User
from models.level_config import LevelConfig, LEVEL_CONFIG_DATA
from services.auth_service import AuthService

# 테스트 데이터베이스 설정
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# ================================================================
# 1. 기본 구조 테스트
# ================================================================

class TestBasic:
    def test_app_startup(self):
        """앱 실행 확인"""
        response = client.get("/")
        assert response.status_code == 200
        assert "AI 토론 에이전트" in response.json()["message"]
    
    def test_health_check(self):
        """헬스 체크"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

# ================================================================
# 2. 인증 테스트
# ================================================================

class TestAuth:
    def test_signup_success(self):
        """회원가입 성공"""
        response = client.post("/auth/signup", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        assert response.json()["username"] == "testuser"
        assert response.json()["level"] == 1
    
    def test_signup_duplicate_username(self):
        """중복 아이디 가입 거부"""
        # 첫 번째 가입
        client.post("/auth/signup", json={
            "username": "duplicate",
            "email": "first@example.com",
            "password": "password123"
        })
        
        # 같은 아이디로 재가입 시도
        response = client.post("/auth/signup", json={
            "username": "duplicate",
            "email": "second@example.com",
            "password": "password123"
        })
        assert response.status_code == 400
        assert "이미 사용 중인 아이디" in response.json()["detail"]
    
    def test_login_success(self):
        """로그인 성공"""
        # 회원가입
        client.post("/auth/signup", json={
            "username": "loginuser",
            "email": "login@example.com",
            "password": "password123"
        })
        
        # 로그인
        response = client.post("/auth/login", json={
            "username": "loginuser",
            "email": None,
            "password": "password123"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert response.json()["token_type"] == "bearer"
    
    def test_login_wrong_password(self):
        """잘못된 비밀번호로 로그인"""
        # 회원가입
        client.post("/auth/signup", json={
            "username": "wrongpass",
            "email": "wrong@example.com",
            "password": "correctpassword"
        })
        
        # 잘못된 비밀번호로 로그인
        response = client.post("/auth/login", json={
            "username": "wrongpass",
            "email": None,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_guest_mode(self):
        """게스트 모드"""
        response = client.post("/auth/guest")
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert response.json()["user"]["is_guest"] == True

# ================================================================
# 3. 토론 시스템 테스트
# ================================================================

class TestDiscussion:
    @pytest.fixture
    def auth_header(self):
        """테스트용 인증 토큰"""
        # 사용자 생성
        db = TestingSessionLocal()
        user = User(
            username="discussion_user",
            email="discussion@example.com",
            password_hash=AuthService.hash_password("password123"),
            is_guest=False,
            level=1,
            experience_points=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # 토큰 생성
        token = AuthService.create_access_token(data={"sub": str(user.id)})
        db.close()
        
        return {"Authorization": f"Bearer {token}"}
    
    def test_start_discussion(self, auth_header):
        """토론 시작"""
        response = client.post(
            "/discussions/start",
            headers=auth_header,
            json={
                "title": "AI와 일자리",
                "topic": "AI 기술의 발전이 인간의 일자리에 미치는 영향",
                "agents_config": {}
            }
        )
        assert response.status_code == 200
        assert response.json()["topic"] == "AI 기술의 발전이 인간의 일자리에 미치는 영향"
        assert response.json()["status"] == "ongoing"
    
    def test_no_auth_fails(self):
        """인증 없이 토론 시작 시도"""
        response = client.post(
            "/discussions/start",
            json={
                "title": "테스트",
                "topic": "테스트 주제",
                "agents_config": {}
            }
        )
        assert response.status_code == 401

# ================================================================
# 4. 레벨 시스템 테스트
# ================================================================

class TestLevel:
    def test_level_initialization(self):
        """레벨 설정 초기화"""
        db = TestingSessionLocal()
        
        # 레벨 설정 추가
        for config_data in LEVEL_CONFIG_DATA:
            existing = db.query(LevelConfig).filter(
                LevelConfig.level == config_data["level"]
            ).first()
            if not existing:
                config = LevelConfig(**config_data)
                db.add(config)
        
        db.commit()
        
        # 확인
        levels = db.query(LevelConfig).all()
        assert len(levels) > 0
        
        db.close()

# ================================================================
# 5. 통합 테스트
# ================================================================

class TestIntegration:
    def test_full_discussion_flow(self):
        """전체 토론 흐름"""
        # 1. 회원가입
        signup_response = client.post("/auth/signup", json={
            "username": "integration_user",
            "email": "integration@example.com",
            "password": "password123"
        })
        assert signup_response.status_code == 200
        user_id = signup_response.json()["id"]
        
        # 2. 로그인
        login_response = client.post("/auth/login", json={
            "username": "integration_user",
            "email": None,
            "password": "password123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 3. 토론 시작
        discussion_response = client.post(
            "/discussions/start",
            headers=headers,
            json={
                "title": "통합 테스트",
                "topic": "통합 테스트 주제"
            }
        )
        assert discussion_response.status_code == 200
        discussion_id = discussion_response.json()["id"]
        
        print(f"\n✅ 통합 테스트 성공!")
        print(f"   사용자 ID: {user_id}")
        print(f"   토론 ID: {discussion_id}")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
