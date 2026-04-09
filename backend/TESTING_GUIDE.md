# 🧪 백엔드 테스트 및 검증 가이드

이 문서는 백엔드가 제대로 작동하는지 확인하는 방법을 설명합니다.

---

## 1️⃣ 자동 테스트 (권장) ✅

### 설치

```bash
# 프로젝트 폴더로 이동
cd backend

# 가상환경 활성화
venv\Scripts\activate  # Windows

# 테스트 패키지 설치
pip install pytest pytest-asyncio
```

### 테스트 실행

```bash
# 모든 테스트 실행
pytest test_main.py -v

# 특정 클래스만 테스트
pytest test_main.py::TestAuth -v

# 상세 출력
pytest test_main.py -vv -s
```

### 테스트 항목

#### ✅ TestBasic - 기본 구조
```
- 앱 시작 확인
- 헬스 체크
```

#### ✅ TestAuth - 인증 시스템
```
- 회원가입 성공
- 중복 아이디 거부
- 로그인 성공
- 잘못된 비밀번호 거부
- 게스트 모드 생성
```

#### ✅ TestDiscussion - 토론 시스템
```
- 토론 시작
- 인증 없이 토론 시작 거부
```

#### ✅ TestLevel - 레벨 시스템
```
- 레벨 설정 초기화
```

#### ✅ TestIntegration - 전체 흐름
```
- 회원가입 → 로그인 → 토론 시작 (통합 테스트)
```

### 예상 결과

```
$ pytest test_main.py -v

test_main.py::TestBasic::test_app_startup PASSED
test_main.py::TestBasic::test_health_check PASSED
test_main.py::TestAuth::test_signup_success PASSED
test_main.py::TestAuth::test_signup_duplicate_username PASSED
test_main.py::TestAuth::test_login_success PASSED
test_main.py::TestAuth::test_login_wrong_password PASSED
test_main.py::TestAuth::test_guest_mode PASSED
test_main.py::TestDiscussion::test_start_discussion PASSED
test_main.py::TestDiscussion::test_no_auth_fails PASSED
test_main.py::TestLevel::test_level_initialization PASSED
test_main.py::TestIntegration::test_full_discussion_flow PASSED

✅ 11 passed in 2.34s
```

---

## 2️⃣ 수동 API 테스트 (Swagger UI)

### 서버 실행

```bash
uvicorn main:app --reload
```

서버가 시작되면 `http://localhost:8000/docs` 에서 Swagger UI를 열 수 있습니다.

### 테스트 시나리오

#### 1️⃣ 회원가입
```
POST /auth/signup

Body:
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}

✅ 응답:
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "is_guest": false,
  "level": 1,
  "experience_points": 0,
  "created_at": "2024-01-01T12:00:00"
}
```

#### 2️⃣ 로그인
```
POST /auth/login

Body:
{
  "username": "testuser",
  "email": null,
  "password": "password123"
}

✅ 응답:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

#### 3️⃣ 토론 시작
```
POST /discussions/start

Header:
Authorization: Bearer {받은_access_token}

Body:
{
  "title": "AI와 일자리",
  "topic": "AI 기술의 발전이 인간의 일자리에 미치는 영향",
  "agents_config": {}
}

✅ 응답:
{
  "id": 1,
  "user_id": 1,
  "title": "AI와 일자리",
  "topic": "AI 기술의 발전이 인간의 일자리에 미치는 영향",
  "status": "ongoing",
  "score": 0.0,
  "exp_earned": 0,
  "created_at": "2024-01-01T12:00:00"
}
```

#### 4️⃣ 에이전트 응답 생성
```
POST /discussions/1/generate-agent-response

Header:
Authorization: Bearer {access_token}

Query:
agent_index=0

✅ 응답 (정상):
{
  "agent_name": "논리적 비판가",
  "agent_role": "객관적인 시각에서 반박하고 논리적 결함을 지적하는 역할",
  "response": "흥미로운 주제입니다. AI의 발전이 일자리에 영향을 미치는 것은 분명하지만...",
  "is_fallback": false,
  "timestamp": "2024-01-01T12:00:00.123456"
}

✅ 응답 (AI 모델 에러 시 폴백):
{
  "agent_name": "논리적 비판가",
  "agent_role": "객관적인 시각에서 반박하고 논리적 결함을 지적하는 역할",
  "response": "흥미로운 지적입니다. 하지만 이 관점에서 한 가지 더 고려해야 할 점이 있습니다.",
  "is_fallback": true,
  "timestamp": "2024-01-01T12:00:00.123456",
  "note": "AI 모델이 응답을 생성하지 못했으므로 기본 응답을 제공합니다."
}
```

#### 5️⃣ 토론 종료 및 평가
```
POST /discussions/1/end

Header:
Authorization: Bearer {access_token}

Body:
{
  "score": 85,
  "evaluation_detail": {
    "논리성": 85,
    "깊이": 80,
    "일관성": 87
  }
}

✅ 응답:
{
  "discussion_id": 1,
  "score": 85,
  "star_rating": "⭐⭐⭐⭐",
  "exp_earned": 30,
  "level_info": {
    "level_up": false,
    "old_level": 1,
    "new_level": 1,
    "total_exp": 30,
    "message": "30 경험치를 획득했습니다!"
  }
}
```

#### 6️⃣ 현재 사용자 레벨 조회
```
GET /level/my-level

Header:
Authorization: Bearer {access_token}

✅ 응답:
{
  "level": 1,
  "experience_points": 30,
  "current_level_exp": 30,
  "next_level_required_exp": 100,
  "exp_to_next_level": 70,
  "progress_percentage": 30.0
}
```

---

## 3️⃣ 폴백 응답 시스템 (에이전트 타임아웃 시)

### 동작 방식

```
사용자 요청
    ↓
AI 모델 로드 시도
    ↓
┌─────────────────────────┐
│   성공?                 │
│   ✅ Yes / ❌ No       │
└─────────────────────────┘
   ✅ |                | ❌
     |                |
  응답 생성        폴백 응답
  정상 응답        임의 응답
  (is_fallback:   (is_fallback:
   false)         true)
```

### 폴백 응답 예시

#### 논리적 비판가
```
- "흥미로운 지적입니다. 하지만 이 관점에서 한 가지 더 고려해야 할 점이 있습니다."
- "좋은 의견이지만, 반대 관점에서 생각해보면..."
- "실제로 데이터를 보면 이와 다른 결과가 나타날 수 있습니다."
- "이 주장의 논리적 근거가 충분한지 검토해 볼 필요가 있습니다."
```

#### 창의적 대안제시자
```
- "이를 다른 관점에서 접근한다면 어떨까요?"
- "새로운 방식으로 생각해본다면 다음과 같은 대안이 있습니다."
- "기존 방식에서 벗어나 보면, 이런 방법도 가능합니다."
- "혁신적으로 접근한다면 더 나은 해결책이 있을 수 있습니다."
```

#### 균형잡힌 중재자
```
- "양쪽 의견 모두 타당한 부분이 있습니다."
- "이 문제는 서로 다른 관점을 모두 고려해야 합니다."
- "양쪽 입장의 공통점을 찾아보는 것이 중요합니다."
- "이 주제에 대해 균형잡힌 평가를 하려면 다양한 요소를 봐야 합니다."
```

### 폴백 응답 발생 상황

✅ **자동으로 폴백 응답이 반환되는 경우:**

1. **AI 모델 로드 실패**
   - 메모리 부족
   - 모델 파일 없음
   - 라이브러리 호환성 문제

2. **응답 생성 중 에러**
   - CUDA 메모리 부족
   - 토크나이저 에러
   - 기타 런타임 에러

3. **타임아웃** (향후 추가 가능)
   - 응답 생성이 너무 오래 걸림

---

## 4️⃣ 데이터베이스 상태 확인

### SQLite 데이터베이스 확인

```bash
# SQLite 콘솔 실행
sqlite3 discussion_agent.db

# 테이블 목록 확인
.tables

# 사용자 데이터 확인
SELECT * FROM users;

# 토론 데이터 확인
SELECT * FROM discussion_sessions;

# 메시지 데이터 확인
SELECT * FROM messages;

# 레벨 설정 확인
SELECT * FROM level_configs;

# 종료
.quit
```

### 예상 데이터

```
users 테이블:
┌────┬──────────┬──────────────────┬──────┬──────────────────┬──────────────┐
│ id │ username │ email            │level │ experience_points│ is_guest     │
├────┼──────────┼──────────────────┼──────┼──────────────────┼──────────────┤
│ 1  │ testuser │ test@example.com │ 1    │ 0                │ 0 (false)    │
└────┴──────────┴──────────────────┴──────┴──────────────────┴──────────────┘

discussion_sessions 테이블:
┌────┬─────────┬──────────────┬────────┬────────┬────────────┐
│ id │ user_id │ topic        │status  │ score  │ exp_earned │
├────┼─────────┼──────────────┼────────┼────────┼────────────┤
│ 1  │ 1       │ AI와 일자리  │ongoing │ 0.0    │ 0          │
└────┴─────────┴──────────────┴────────┴────────┴────────────┘

level_configs 테이블:
┌───────┬──────────────┬──────────────────────────┐
│ level │ required_exp │ title                    │
├───────┼──────────────┼──────────────────────────┤
│ 1     │ 0            │ 🥇 초보자 (Bronze)       │
│ 2     │ 100          │ 🥈 숙련자 (Silver)       │
│ 3     │ 250          │ 🥉 전문가 (Gold)         │
│ 4     │ 450          │ 💎 마스터 (Platinum)     │
│ 5     │ 700          │ 👑 그랜드마스터          │
└───────┴──────────────┴──────────────────────────┘
```

---

## 5️⃣ 로그 확인

### 서버 실행 시 로그

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
INFO: Initializing database...
INFO: Level configurations initialized
INFO: Initializing AI model...
INFO: Loading model: microsoft/phi-2
INFO: Model loaded successfully
```

### 에이전트 응답 로그

**정상 응답:**
```
INFO: ✅ [논리적 비판가] 응답 생성 성공
```

**폴백 응답:**
```
WARNING: ⚠️ [논리적 비판가] CUDA 메모리 부족 - 폴백 응답 사용
WARNING: ⚠️ [논리적 비판가] 응답 생성 실패 (RuntimeError: ...) - 폴백 응답 사용
```

---

## 6️⃣ 문제 해결

### Q: 테스트 실행 시 모듈을 찾을 수 없다고 함
```bash
# Python 경로 확인
python -c "import sys; print(sys.path)"

# PYTHONPATH 설정 (Windows)
set PYTHONPATH=%PYTHONPATH%;c:\Users\helen\Desktop\캡스톤\backend

# 그 후 테스트 실행
pytest test_main.py -v
```

### Q: AI 모델 로드 실패
```
해결: 폴백 응답이 자동으로 반환되므로 문제없습니다
또는: 모델 초기화 스킵하고 폴백만 사용하도록 변경 가능
```

### Q: 데이터베이스 초기화하고 싶음
```bash
# 기존 DB 삭제
rm discussion_agent.db

# 다시 실행하면 자동 생성됨
uvicorn main:app --reload
```

---

## ✅ 최종 확인 체크리스트

- [ ] `pytest test_main.py -v` 모두 PASSED
- [ ] http://localhost:8000/docs 에서 API 문서 확인
- [ ] 회원가입 → 로그인 → 토론 생성 수동 테스트
- [ ] 에이전트 응답 생성 테스트 (정상 또는 폴백)
- [ ] 토론 평가 후 경험치 증가 확인
- [ ] 데이터베이스에 데이터 저장 확인

모두 확인되면 **백엔드 완성** 🎉
