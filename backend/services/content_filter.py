"""
content_filter.py — 콘텐츠 안전 필터

1. is_sensitive_topic(topic) : 민감한 토론 주제 판별
2. is_on_topic(topic, message): 사용자 발언이 토론 주제와 관련 있는지 판별
"""

import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# 즉시 차단 키워드 (LLM 호출 없이 1차 필터)
_HARD_BLOCKED_KEYWORDS = [
    "포르노", "성관계", "음란", "자살 방법", "자해 방법", "마약 제조",
    "폭탄 제조", "살인 방법", "강간", "아동 성",
]


# ── 1. 민감 주제 필터 ─────────────────────────────────────────────────────────

def is_sensitive_topic(topic: str) -> Tuple[bool, str]:
    """
    토론 주제가 서비스 정책상 부적절한지 검사한다.

    Returns:
        (True, reason)  → 민감 주제, 차단 필요
        (False, "OK")   → 정상 주제
    """
    # 1차: 하드 키워드 필터
    for kw in _HARD_BLOCKED_KEYWORDS:
        if kw in topic:
            return True, f"금지 키워드 포함: {kw}"

    # 2차: LLM 분류 (Vertex AI Gemini)
    try:
        from services.vertex_llm import call_llm
        system = (
            "당신은 토론 플랫폼의 콘텐츠 심사관입니다. "
            "아래 토론 주제가 다음 중 하나에 해당하면 'BLOCK'이라고만 답하고, "
            "괜찮으면 'OK'라고만 답하세요.\n"
            "차단 조건:\n"
            "1. 특정 정치인·공직자·유명인의 실명이 들어간 경우\n"
            "2. 특정 종교를 비판하거나 종교 간 우열을 가리는 경우\n"
            "3. 지역 감정 자극 또는 특정 지역 비하\n"
            "4. 성별·나이·인종·장애 차별 조장\n"
            "5. 성적 콘텐츠, 폭력, 자살·자해 관련\n"
            "6. 혐오 발언 또는 특정 집단 적대"
        )
        answer = call_llm(
            f"토론 주제: {topic}", system=system, max_tokens=256, temperature=0
        ).strip().upper()
        if not answer:
            return False, "심사 오류 — 통과"
        if "BLOCK" in answer:
            return True, f"LLM 심사 차단: {topic}"
        return False, "OK"
    except Exception as e:
        logger.warning(f"is_sensitive_topic LLM 호출 실패: {e} — 통과 처리")
        return False, "심사 오류 — 통과"


# ── 2. 주제 관련성 필터 ───────────────────────────────────────────────────────

_OFF_TOPIC_FALLBACK = (
    "지금 토론 주제와 관련 없는 내용인 것 같아요. "
    "토론 주제에 대한 의견이나 질문을 이야기해 주세요!"
)


def is_on_topic(topic: str, message: str) -> Tuple[bool, str]:
    """
    사용자 발언이 토론 주제와 관련 있는지 검사한다.

    Returns:
        (True, "OK")         → 관련 있음, 정상 처리
        (False, fallback_msg) → 무관, fallback 메시지 반환
    """
    # 너무 짧은 발언은 관련성 판단 불가 → 통과
    if len(message.strip()) < 5:
        return True, "OK"

    try:
        from services.vertex_llm import call_llm
        system = (
            "당신은 토론 플랫폼의 발언 관련성 검사관입니다. "
            "아래 토론 주제와 사용자 발언을 보고, "
            "발언이 토론 주제와 조금이라도 관련 있으면 'YES', "
            "전혀 관련 없으면 'NO'라고만 답하세요. "
            "토론 주제에 대한 찬반, 질문, 배경 설명, 반박 등은 모두 관련 있는 것으로 봅니다."
        )
        user_msg = f"토론 주제: {topic}\n사용자 발언: {message}"
        answer = call_llm(user_msg, system=system, max_tokens=256, temperature=0).strip().upper()
        if "NO" in answer:
            return False, _OFF_TOPIC_FALLBACK
        return True, "OK"
    except Exception as e:
        logger.warning(f"is_on_topic LLM 호출 실패: {e} — 통과 처리")
        return True, "OK"
