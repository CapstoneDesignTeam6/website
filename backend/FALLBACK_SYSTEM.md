# 🔄 폴백 응답 시스템 (Fallback Response System)

AI 에이전트가 응답을 생성하지 못할 때를 대비한 안정성 시스템입니다.

---

## 📋 개요

### 목적
- ✅ 에이전트 서버 장애 시에도 토론이 진행되어야 함
- ✅ 사용자 경험 중단 방지
- ✅ 임의의 의미있는 응답 제공

### 특징
- 🟢 자동 감지 및 폴백 전환
- 🟢 사용자에게 폴백 여부 알림 (`is_fallback: true/false`)
- 🟢 각 에이전트별 맞춤형 응답
- 🟢 랜덤 선택으로 반복 방지

---

## 🔧 구조

### 폴백 응답 매핑

```python
FALLBACK_RESPONSES = {
    "논리적 비판가": [
        "흥미로운 지적입니다. 하지만 이 관점에서 한 가지 더 고려해야 할 점이 있습니다.",
        "좋은 의견이지만, 반대 관점에서 생각해보면...",
        "실제로 데이터를 보면 이와 다른 결과가 나타날 수 있습니다.",
        "이 주장의 논리적 근거가 충분한지 검토해 볼 필요가 있습니다.",
    ],
    "창의적 대안제시자": [
        "이를 다른 관점에서 접근한다면 어떨까요?",
        "새로운 방식으로 생각해본다면 다음과 같은 대안이 있습니다.",
        "기존 방식에서 벗어나 보면, 이런 방법도 가능합니다.",
        "혁신적으로 접근한다면 더 나은 해결책이 있을 수 있습니다.",
    ],
    "균형잡힌 중재자": [
        "양쪽 의견 모두 타당한 부분이 있습니다.",
        "이 문제는 서로 다른 관점을 모두 고려해야 합니다.",
        "양쪽 입장의 공통점을 찾아보는 것이 중요합니다.",
        "이 주제에 대해 균형잡힌 평가를 하려면 다양한 요소를 봐야 합니다.",
    ]
}
```

---

## 🚨 폴백 트리거 조건

### 1. CUDA 메모리 부족
```python
except torch.cuda.OutOfMemoryError:
    logger.warning(f"⚠️ [{agent_name}] CUDA 메모리 부족 - 폴백 응답 사용")
    return AgentService._get_fallback_response(agent_name)
```

### 2. 일반 런타임 에러
```python
except Exception as e:
    logger.warning(f"⚠️ [{agent_name}] 응답 생성 실패 ({str(e)}) - 폴백 응답 사용")
    return AgentService._get_fallback_response(agent_name)
```

### 가능한 에러 상황
- 🔴 모델 로드 실패
- 🔴 메모리 부족 (RAM/VRAM)
- 🔴 토크나이저 에러
- 🔴 네트워크 연결 끊김
- 🔴 파일 시스템 에러
- 🔴 타임아웃 (향후 추가)

---

## 📤 응답 포맷

### 정상 응답
```json
{
  "agent_name": "논리적 비판가",
  "agent_role": "객관적인 시각에서 반박하고 논리적 결함을 지적하는 역할",
  "response": "흥미로운 주제입니다. AI의 발전이 일자리에 영향을 미치는 것은 분명하지만...",
  "is_fallback": false,
  "timestamp": "2024-01-01T12:00:00.123456Z",
  "note": ""
}
```

### 폴백 응답
```json
{
  "agent_name": "논리적 비판가",
  "agent_role": "객관적인 시각에서 반박하고 논리적 결함을 지적하는 역할",
  "response": "흥미로운 지적입니다. 하지만 이 관점에서 한 가지 더 고려해야 할 점이 있습니다.",
  "is_fallback": true,
  "timestamp": "2024-01-01T12:00:01.456789Z",
  "note": "AI 모델이 응답을 생성하지 못했으므로 기본 응답을 제공합니다."
}
```

### 응답 필드 설명
| 필드 | 설명 | 예시 |
|-----|------|------|
| `agent_name` | 에이전트 이름 | "논리적 비판가" |
| `agent_role` | 에이전트 역할 설명 | "객관적인 시각에서..." |
| `response` | 생성된 응답 텍스트 | "흥미로운 지적입니다..." |
| `is_fallback` | 폴백 여부 | true/false |
| `timestamp` | 응답 생성 시간 | "2024-01-01T12:00:00Z" |
| `note` | 추가 메모 | "AI 모델이 응답을 생성하지 못했..." |

---

## 🎯 사용자 관점

### 클라이언트에서 처리 예시 (JavaScript)

```javascript
// 에이전트 응답 요청
const response = await fetch(`/discussions/${discussionId}/generate-agent-response`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ agent_index: 0 })
});

const data = await response.json();

// 응답 표시
console.log(`[${data.agent_name}]: ${data.response}`);

// 폴백 여부 확인
if (data.is_fallback) {
  console.warn('⚠️ 서버 상태: AI 모델이 응답을 생성하지 못했습니다.');
  console.warn(`메모: ${data.note}`);
  
  // UI에서 표시
  showWarning('AI 모델 응답 실패, 기본 응답을 사용합니다.');
} else {
  console.log('✅ 정상 AI 응답입니다.');
}
```

---

## 📊 폴백 빈도 분석

### 로그에서 폴백률 확인

```bash
# 정상 응답 로그
grep "✅.*응답 생성 성공" uvicorn.log | wc -l

# 폴백 응답 로그
grep "⚠️.*폴백 응답 사용" uvicorn.log | wc -l

# 폴백률 = 폴백 응답 / (정상 + 폴백)
```

### 모니터링 포인트
- 📈 폴백 빈도가 높으면 시스템 문제 신호
- 🔧 메모리/성능 최적화 필요 가능성
- 📝 로그를 통해 문제 패턴 분석

---

## 🛠️ 커스터마이징

### 폴백 응답 추가

`services/agent_service.py` 에서 수정:

```python
FALLBACK_RESPONSES = {
    "논리적 비판가": [
        # 기존 응답들...
        # 새로운 응답 추가
        "이 부분을 더 자세히 설명해 주실 수 있을까요?",
    ],
    # 새로운 에이전트 추가
    "새로운_에이전트": [
        "새로운 역할의 응답들 추가...",
    ]
}
```

### 폴백 조건 추가

```python
@staticmethod
def generate_response(...) -> dict:
    try:
        # 기존 코드...
        pass
    
    except torch.cuda.OutOfMemoryError:
        logger.warning(f"...")
        return AgentService._get_fallback_response(agent_name)
    
    except TimeoutError:  # 타임아웃 추가
        logger.warning(f"⚠️ [{agent_name}] 응답 생성 타임아웃")
        return AgentService._get_fallback_response(agent_name)
    
    except Exception as e:
        logger.warning(f"...")
        return AgentService._get_fallback_response(agent_name)
```

---

## 📈 성능 고려사항

### 폴백 응답의 장점
- ✅ 빠른 응답 (즉시 반환)
- ✅ 안정성 (서버 다운 방지)
- ✅ 사용자 경험 (토론 진행 가능)

### 폴백 응답의 단점
- ❌ 덜 정교한 응답
- ❌ 문맥 무시 (고정 응답)
- ❌ 사용성 감소

### 권장사항
- 폴백이 자주 발생 → 하드웨어 업그레이드 필요
- 모니터링 시스템 구축 → 문제 조기 발견
- 대체 모델 고려 → 더 작은 모델 사용

---

## 🔍 디버깅

### 폴백 응답 강제 테스트

`services/agent_service.py` 에서 임시 수정:

```python
@staticmethod
def generate_response(...):
    # 테스트용 폴백 강제
    if True:  # 또는 특정 조건
        return AgentService._get_fallback_response(agent_name)
    
    # 정상 코드...
```

### 로그 출력 확인

```bash
# 상세 로그 활성화
uvicorn main:app --reload --log-level debug

# 특정 로그만 필터링
grep "agent_service" uvicorn.log
```

---

## ✨ 향후 개선 방향

- [ ] **타임아웃 추가**: 응답이 너무 오래 걸리면 폴백
- [ ] **캐싱**: 자주 사용되는 응답 캐시
- [ ] **하이브리드**: 폴백 + 간단한 텍스트 생성 알고리즘
- [ ] **대체 모델**: 작은 모델로 빠른 응답
- [ ] **실시간 모니터링**: 대시보드에서 폴백률 표시
- [ ] **A/B 테스트**: 폴백 응답 품질 개선

---

## 📚 참고

- [services/agent_service.py](services/agent_service.py) - 폴백 구현
- [api/discussion.py](api/discussion.py) - API 응답 처리
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 테스트 방법
