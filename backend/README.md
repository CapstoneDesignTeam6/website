# 🤖 AI 토론 에이전트 백엔드

FastAPI 기반의 AI 토론 에이전트 시스템 백엔드 서버입니다.

## 📋 주요 기능

### 1. 사용자 인증 🔐
- **회원가입**: 아이디, 이메일, 비밀번호로 회원 가입
- **로그인**: JWT 토큰 기반 인증
- **게스트 모드**: 로그인 없이 게스트로 임시 사용 (일일 3회 제한)

### 2. 토론 시스템 💬
- **토론 생성**: 주제와 설정을 지정하여 새로운 토론 시작
- **AI 에이전트 응답**: 3가지 에이전트가 다양한 관점에서 토론
  - 논리적 비판가: 객관적인 시각에서 반박
  - 창의적 대안제시자: 새로운 관점 제시
  - 균형잡힌 중재자: 양쪽 주장 평가
- **메시지 관리**: 토론 중 사용자와 에이전트의 대화 저장
- **토론 평가**: 토론 완료 후 품질 평가 (0-100점)

### 3. 레벨 시스템 🏆
- **경험치 획득**: 토론 평가 점수에 따라 경험치 증가
  - 90-100점: 50 exp ⭐⭐⭐⭐⭐
  - 70-89점: 30 exp ⭐⭐⭐⭐
  - 50-69점: 15 exp ⭐⭐⭐
  - 30-49점: 5 exp ⭐⭐
  - 0-29점: 0 exp ⭐
- **자동 레벨업**: 경험치가 일정 지점에 도달하면 자동 상승
- **레벨 랭킹**: 전체 사용자 레벨 순위 조회

### 4. 토론 히스토리 📊
- **개인 토론 기록**: 사용자별 토론 이력 조회
- **통계 정보**: 평균 점수, 총 경험치, 토론 횟수 등

---

## 🚀 설치 및 실행

### 1. 환경 설정

```bash
# 프로젝트 폴더로 이동
cd backend

# Python 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

### 2. 패키지 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

`.env` 파일을 생성하고 다음과 같이 설정:

```env
SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
DATABASE_URL=sqlite:///./discussion_agent.db
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
```

### 4. 서버 실행

```bash
# 개발 서버 (자동 리로드 활성화)
uvicorn main:app --reload

# 프로덕션 서버
uvicorn main:app --host 0.0.0.0 --port 8000
```

서버가 실행되면 `http://localhost:8000` 에서 접속 가능합니다.

---

## 📚 API 문서

### Swagger UI (대화형 문서)
```
http://localhost:8000/docs
```

### ReDoc (API 문서)
```
http://localhost:8000/redoc
```

---

## 🔗 주요 API 엔드포인트

### 인증 (Auth)
```
POST   /auth/signup              # 회원가입
POST   /auth/login               # 로그인
POST   /auth/guest               # 게스트 모드
GET    /auth/me                  # 현재 사용자 정보
```

### 토론 (Discussions)
```
POST   /discussions/start                      # 토론 시작
POST   /discussions/{id}/add-message           # 메시지 추가
POST   /discussions/{id}/end                   # 토론 종료 및 평가
POST   /discussions/{id}/generate-agent-response  # 에이전트 응답 생성
GET    /discussions/{id}                       # 토론 상세 조회
GET    /discussions/                           # 토론 히스토리 조회
GET    /discussions/stats/summary              # 토론 통계
```

### 레벨 (Level)
```
GET    /level/my-level           # 현재 사용자 레벨 정보
GET    /level/leaderboard        # 전체 사용자 랭킹
```

### 상태 확인
```
GET    /                         # 기본 정보
GET    /health                   # 헬스 체크
```

---

## 📊 데이터베이스 스키마

### Users 테이블
```sql
- id (PK)
- username (회원 아이디)
- email (회원 이메일)
- password_hash (암호화된 비밀번호)
- is_guest (게스트 여부)
- guest_session_id (게스트 임시 ID)
- level (현재 레벨, 1-10)
- experience_points (총 경험치)
- current_level_exp (현재 레벨 누적 경험치)
- created_at (가입 시간)
- updated_at (수정 시간)
```

### DiscussionSessions 테이블
```sql
- id (PK)
- user_id (FK, 사용자)
- title (토론 제목)
- topic (토론 주제)
- agents_config (에이전트 설정)
- status (진행 상태: ongoing/completed)
- score (평가 점수)
- exp_earned (획득 경험치)
- evaluation_detail (평가 상세 정보)
- created_at, updated_at, completed_at
```

### Messages 테이블
```sql
- id (PK)
- session_id (FK, 토론 세션)
- speaker (발언자 이름)
- content (메시지 내용)
- role (agent/user)
- created_at
```

### LevelConfigs 테이블
```sql
- level (PK, 레벨 1-10)
- required_exp (필요 경험치)
- title (레벨 제목)
- description (설명)
```

---

## 🧪 테스트

```bash
# pytest 설치 (선택)
pip install pytest pytest-asyncio

# 테스트 실행
pytest
```

---

## 🛠️ 기술 스택

- **Backend**: FastAPI
- **Database**: SQLite (개발), PostgreSQL (프로덕션 권장)
- **Authentication**: JWT (Python-Jose)
- **AI Model**: Microsoft Phi-2 (Hugging Face Transformers)
- **ORM**: SQLAlchemy
- **Validation**: Pydantic

---

## 📁 프로젝트 구조

```
backend/
├── main.py                    # FastAPI 메인 앱
├── config.py                  # 환경 설정
├── database.py               # DB 연결
├── requirements.txt          # 의존성
├── .env                      # 환경 변수 (git 제외)
│
├── models/                   # DB 모델
│   ├── __init__.py
│   ├── user.py              # User 모델
│   ├── discussion.py         # DiscussionSession 모델
│   ├── message.py           # Message 모델
│   └── level_config.py      # LevelConfig 모델
│
├── schemas/                  # Pydantic 스키마
│   ├── __init__.py
│   ├── user.py
│   ├── discussion.py
│   └── level.py
│
├── services/                 # 비즈니스 로직
│   ├── __init__.py
│   ├── auth_service.py      # 인증 로직
│   ├── discussion_service.py # 토론 로직
│   ├── level_service.py     # 레벨 로직
│   └── agent_service.py     # AI 에이전트 로직
│
├── agents/                   # AI 에이전트
│   ├── __init__.py
│   ├── base.py              # 기본 에이전트
│   ├── discussion_agent.py   # 토론 에이전트
│   ├── search_agent.py      # 검색 에이전트
│   └── news_agent.py        # 뉴스 에이전트
│
└── api/                      # API 라우터
    ├── __init__.py
    ├── auth.py              # 인증 엔드포인트
    ├── discussion.py        # 토론 엔드포인트
    └── level.py             # 레벨 엔드포인트
```

---

## ⚙️ 설정 파일 (config.py)

주요 설정 항목:

```python
# 기본
APP_NAME = "Discussion Agent Backend"
DEBUG = True

# 데이터베이스
DATABASE_URL = "sqlite:///./discussion_agent.db"

# JWT
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# AI 모델
MODEL_NAME = "microsoft/phi-2"
MAX_NEW_TOKENS = 150
TEMPERATURE = 0.7

# 제한
GUEST_DAILY_LIMIT = 3
```

---

## 🔒 보안 주의사항

- `.env` 파일은 git에 포함하지 마세요
- 프로덕션 환경에서는 `SECRET_KEY` 변경
- HTTPS 사용 필수
- CORS 설정 검토
- 데이터베이스 백업 정기 실행

---

## 🤝 프론트엔드 연동

프론트엔드에서 API 요청 시:

```javascript
// 1. 사용자 인증
const response = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'user', password: 'pass' })
});
const { access_token } = await response.json();

// 2. 토론 시작
const discussion = await fetch('/discussions/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: '토론 제목',
    topic: '토론 주제',
    agents_config: {}
  })
});

// 3. 에이전트 응답 요청
const agentResponse = await fetch(`/discussions/${discussion_id}/generate-agent-response`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}` }
});

// 4. 토론 종료 및 평가
const evaluation = await fetch(`/discussions/${discussion_id}/end`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ score: 85 })
});
```

---

## 📝 라이선스

MIT License

---

## 📧 문의

프로젝트에 대한 질문이나 제안은 이슈를 통해 연락주세요.
