# 🚀 Supabase 연결 가이드

## 1️⃣ Supabase 프로젝트 생성

### 1. Supabase 가입 및 로그인
- [https://supabase.com](https://supabase.com) 방문
- GitHub 또는 이메일로 계정 생성

### 2. 새 프로젝트 생성
```
New Project
├─ Organization: 선택 (없으면 생성)
├─ Project name: capstone-discussion-agent (원하는 이름)
├─ Database password: 강력한 비밀번호 설정 (저장!)
├─ Region: Singapore (아시아 권장) 또는 Tokyo
└─ Pricing plan: Free 선택
```

### 3. 프로젝트 대기
- 데이터베이스 초기화까지 약 2-3분 소요

---

## 2️⃣ 연결 문자열 얻기

### 1. 프로젝트 대시보드 접속
```
Supabase Dashboard → 프로젝트 선택
```

### 2. Database 연결 정보 확인
```
Settings (좌측 메뉴) → Database
```

### 3. Connection String 복사
**두 가지 옵션:**

**Option A: 직접 연결 (권장 - 개발)**
```
postgresql://postgres.abcxyz:password@db.supabase.co:5432/postgres
```

**Option B: Connection Pooling (권장 - 프로덕션)**
```
postgresql://postgres.abcxyz:[PASSWORD]@db.supabase.co:6543/postgres?sslmode=require
```

> 💡 Connection Pooling을 사용하려면:
> - Port: 6543 (기본 5432 대신)
> - PgBouncer 활성화: Settings → Database → Connection pooling

---

## 3️⃣ 백엔드 설정

### 1. `.env` 파일 생성
```bash
cd backend
cp .env.example .env
```

### 2. `.env` 파일 편집
```env
DATABASE_URL=postgresql://postgres.abcxyz:your_password@db.supabase.co:5432/postgres
SECRET_KEY=your-secret-key-here
```

### 3. 의존성 설치
```bash
pip install -r requirements.txt
```

### 4. 데이터베이스 테이블 생성
```bash
python -c "from database import create_all_tables; create_all_tables()"
# 또는
uvicorn main:app --reload
# 앱 시작 시 자동으로 테이블 생성됨
```

---

## 4️⃣ Supabase 대시보드 활용

### Database 관리
```
Table Editor (좌측 메뉴)
├─ 테이블 조회
├─ 데이터 추가/수정/삭제
└─ SQL Editor로 쿼리 실행
```

### SQL 직접 실행
```
SQL Editor (좌측 메뉴)
├─ 테이블 생성
├─ 데이터 조회
└─ 마이그레이션 작업
```

### 백업 및 보안
```
Settings → Backups
├─ 자동 백업 활성화
└─ 백업 복원 가능
```

---

## 5️⃣ 문제 해결

### 🔴 "연결 시간 초과" 에러
```
해결책:
1. 인터넷 연결 확인
2. Supabase 상태 확인: status.supabase.com
3. 방화벽에서 PostgreSQL (5432) 포트 허용
4. Connection pooling 활성화 시도 (port 6543)
```

### 🔴 "인증 실패" 에러
```
해결책:
1. DATABASE_URL의 비밀번호 확인
2. 사용자명 확인: postgres.XXXXXX (마지막 6자리)
3. .env 파일의 따옴표 제거 확인
```

### 🔴 "테이블이 없음" 에러
```
해결책:
python -c "from database import create_all_tables; create_all_tables()"
```

### 🔴 SSL 연결 에러
```
해결책:
DATABASE_URL에 다음 추가:
?sslmode=require
```

---

## 6️⃣ 프로덕션 배포 시 주의사항

### 환경 변수 설정 (Vercel, Railway 등)
```bash
# 배포 플랫폼의 환경 변수 설정
DATABASE_URL=postgresql://...
SECRET_KEY=your-very-secret-key (매우 강력하게!)
```

### 보안 설정
```sql
-- Supabase SQL Editor에서 실행
-- 불필요한 권한 제거
REVOKE ALL ON DATABASE postgres FROM public;
REVOKE ALL ON SCHEMA public FROM public;
```

### 성능 모니터링
```
Supabase Dashboard → Database
├─ Network Activity
├─ Query Performance
└─ Resource Usage
```

---

## 7️⃣ 데이터 마이그레이션 (SQLite → Supabase)

### SQLite에서 데이터 내보내기
```bash
# SQLite 데이터를 CSV로 내보내기
sqlite3 discussion_agent.db ".mode csv" ".output users.csv" "SELECT * FROM users;"
```

### Supabase로 데이터 가져오기
```sql
-- Supabase SQL Editor에서
COPY users FROM '/path/to/users.csv' WITH CSV HEADER;
```

또는 대시보드의 `Table Editor` → `Insert Data` → `Upload CSV` 사용

---

## 📊 데이터베이스 스키마 확인

```bash
# 백엔드에서 테이블 생성 후 확인
# Supabase 대시보드 → Table Editor에서 테이블 목록 확인

테이블 목록:
├─ users
├─ discussions  
├─ messages
├─ levels
└─ level_configs
```

---

## 🔗 유용한 링크

- 📚 [Supabase 공식 문서](https://supabase.com/docs)
- 🐍 [SQLAlchemy PostgreSQL 가이드](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html)
- 🔐 [PostgreSQL 연결 문자열 형식](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- 🚀 [Supabase CLI](https://supabase.com/docs/guides/cli)

---

## ✅ 체크리스트

- [ ] Supabase 프로젝트 생성
- [ ] 연결 문자열 복사
- [ ] `.env` 파일 생성 및 설정
- [ ] `pip install -r requirements.txt` 실행
- [ ] 테이블 생성 확인
- [ ] 로그인 및 회원가입 테스트
- [ ] 토론 생성 테스트
- [ ] Supabase 대시보드에서 데이터 확인

---

## 💡 팁

**로컬 개발 중 변경사항 테스트:**
```bash
# 1. 로컬 데이터베이스 초기화
rm discussion_agent.db  # (SQLite 사용 시)

# 2. 백엔드 재시작
uvicorn main:app --reload

# 3. 프론트엔드 테스트
npm run dev
```

**Supabase 쿼리 테스트:**
```bash
# psql 커맨드라인 클라이언트 설치
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client
# Windows: choco install postgresql

psql postgresql://postgres.abcxyz:password@db.supabase.co:5432/postgres
```

