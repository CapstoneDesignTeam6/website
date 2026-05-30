"""
services/scoring_service.py

ScoringAgent 로직을 GPT 기반으로 재구현.
discussion_turns에서 history를 복원해 최신 유저 발언을 평가하고
UserEvaluationScore 형식으로 반환.
"""

import re
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

METRICS = [
    "specificity",
    "causality",
    "domain_breadth",
    "information_autonomy",
    "conceptual_accuracy",
]


# ── GPT 호출 ──────────────────────────────────────────────────────────────────

def _call_gpt(prompt: str, max_tokens: int = 1500) -> str:
    try:
        from openai import OpenAI
        from config import settings
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"[ScoringService] GPT 호출 실패: {e}")
        return ""


# ── Supabase 조회 ──────────────────────────────────────────────────────────────

def _fetch_turns(discussion_id: int) -> list[dict]:
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_turns")
            .select("turn_number, user_message, ai_summary")
            .eq("discussion_id", discussion_id)
            .order("turn_number", desc=False)
            .execute()
            .data
        ) or []
        return rows
    except Exception as e:
        logger.error(f"[ScoringService] Supabase 조회 실패: {e}")
        return []


def _build_history(turns: list[dict]) -> list[dict]:
    """turns → [{"role": "user"|"ai", "content": "..."}] 형식"""
    history = []
    for t in turns:
        if t.get("user_message"):
            history.append({"role": "user", "content": t["user_message"]})
        if t.get("ai_summary"):
            history.append({"role": "ai", "content": t["ai_summary"]})
    return history


def _build_history_block(history: list[dict]) -> str:
    lines = []
    for h in history:
        role = "AI" if h["role"] == "ai" else "유저"
        lines.append(f"[{role}] {h['content']}")
    return "\n".join(lines)


# ── 평가 프롬프트 ──────────────────────────────────────────────────────────────

def _build_prompt(
    topic: str,
    turn_number: int,
    current_user_utterance: str,
    prev_ai_utterance: str,
    history_block: str,
) -> str:
    return f"""당신은 시사 토론 평가 전문가입니다.
아래 정보를 바탕으로 유저의 이번 턴 발언을 5가지 지표로 평가하세요.

[토론 주제]
{topic}

[이번 턴 직전 AI 발언]
{prev_ai_utterance}

[이번 턴 유저 발언 — 평가 대상]
{current_user_utterance}

[전체 토론 기록]
{history_block}

━━━ 평가 기준 (각 지표 1~5점) ━━━

점수는 반드시 1~5 사이 정수만 사용하세요.
1점과 5점은 극단적인 경우에만 부여하고, 대부분의 발언은 2~4점 사이로 평가하세요.

[1. 발언 구체성 specificity]
1점: 전부 불확실 표현만 / 2점: 근거 막연, 수치 없음 / 3점: 일부 구체적이나 출처 불명
4점: 수치·사례 포함, 출처 언급 / 5점: 수치·사례·기관명·출처 명확

[2. 인과 연결 causality]
1점: 사례 이름만 / 2점: 사례+결과만 / 3점: 원인 또는 결과 중 하나만
4점: 사례+원인+결과 / 5점: 사례+원인+결과+자신의 주장 연결

[3. 도메인 폭 domain_breadth]
1점: 단일 도메인 반복 / 2점: 단일 도메인 한 각도 / 3점: 단일 도메인 두 논점
4점: 두 도메인 / 5점: 세 도메인 이상
domain_keywords 필드에 이번 발언의 도메인 키워드 1~3개 추출.

[4. 정보 자립도 information_autonomy]
1점: 단순 재인용 / 2점: 재구성 수준 / 3점: 외부 정보+자신의 사례 1개 이상
4점: 자신의 정보가 절반 이상 / 5점: 발언 전체가 스스로 구성

[5. 개념 정확도 conceptual_accuracy]
1점: 명백한 오용 / 2점: 부정확 사용 / 3점: 대체로 올바르나 부정밀
4점: 정확히 사용 / 5점: 정확히 사용+한계·조건 인식
전문 용어 없으면 3점. errors 필드에 오용 개념 기재, 없으면 null.

━━━ 출력 형식 (JSON만, 다른 텍스트 없이) ━━━

{{
  "turn": {turn_number},
  "scores": {{
    "specificity": {{"score": 정수, "reason": "1문장", "evidence": ""}},
    "causality": {{"score": 정수, "reason": "1문장", "evidence": ""}},
    "domain_breadth": {{"score": 정수, "reason": "1문장", "evidence": "", "domain_keywords": []}},
    "information_autonomy": {{"score": 정수, "reason": "1문장", "evidence": ""}},
    "conceptual_accuracy": {{"score": 정수, "reason": "1문장", "evidence": "", "errors": null}}
  }},
  "total": 합계정수
}}"""


# ── 파싱 ──────────────────────────────────────────────────────────────────────

def _parse(raw: str, turn_number: int) -> dict:
    try:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            scores = parsed.get("scores", {})
            total = 0
            for m in METRICS:
                s = scores.get(m, {}).get("score", 3)
                s = max(1, min(5, int(s)))
                scores.setdefault(m, {})["score"] = s
                total += s
            parsed["scores"] = scores
            parsed["total"] = total
            parsed["turn"] = turn_number
            return parsed
    except Exception as e:
        logger.error(f"[ScoringService] JSON 파싱 실패: {e}")

    # fallback
    return {
        "turn": turn_number,
        "scores": {
            "specificity":          {"score": 3, "reason": "평가 불가", "evidence": ""},
            "causality":            {"score": 3, "reason": "평가 불가", "evidence": ""},
            "domain_breadth":       {"score": 3, "reason": "평가 불가", "evidence": "", "domain_keywords": []},
            "information_autonomy": {"score": 3, "reason": "평가 불가", "evidence": ""},
            "conceptual_accuracy":  {"score": 3, "reason": "평가 불가", "evidence": "", "errors": None},
        },
        "total": 15,
    }


# ── 응답 변환: scores 중첩 제거 → UserEvaluationScore 형식 ──────────────────────

def _to_frontend(turn_result: dict) -> dict:
    """
    ScoringAgent 반환값 → UserEvaluationScore 형식
    {"scores": {"specificity": {...}}} → {"specificity": {...}, "total": n}
    """
    scores = turn_result.get("scores", {})
    return {
        "specificity":          scores.get("specificity", {}),
        "causality":            scores.get("causality", {}),
        "domain_breadth":       scores.get("domain_breadth", {}),
        "information_autonomy": scores.get("information_autonomy", {}),
        "conceptual_accuracy":  scores.get("conceptual_accuracy", {}),
        "total":                turn_result.get("total", 15),
    }


# ── 공개 API ───────────────────────────────────────────────────────────────────

def get_evaluation(discussion_id: int, topic: str) -> Optional[dict]:
    """
    최신 유저 발언 기준으로 평가 점수 반환.
    Returns: UserEvaluationScore 형식 또는 None
    """
    turns = _fetch_turns(discussion_id)
    if not turns:
        return None

    # 유저 발언이 있는 턴만 추출
    user_turns = [t for t in turns if t.get("user_message")]
    if not user_turns:
        return None

    history = _build_history(turns)
    history_block = _build_history_block(history)

    # 가장 최신 유저 발언 평가
    latest = user_turns[-1]
    turn_number = len(user_turns)
    current_user_utterance = latest["user_message"]

    # 직전 AI 발언
    prev_ai = ""
    for t in reversed(turns):
        if t.get("turn_number", 0) < latest.get("turn_number", 0) and t.get("ai_summary"):
            prev_ai = t["ai_summary"]
            break

    prompt = _build_prompt(topic, turn_number, current_user_utterance, prev_ai, history_block)
    raw = _call_gpt(prompt)
    result = _parse(raw, turn_number)
    return _to_frontend(result)
