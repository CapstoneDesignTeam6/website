"""
content_filter.py — 민감 주제 / 토론 무관 발언 필터링

- is_sensitive_topic(topic): 토론 주제 자체가 부적절한지 확인 (시작 시점)
- is_on_topic(topic, message): 사용자 발언이 주제와 관련 있는지 확인 (메시지마다)

두 함수 모두 GPT-4o-mini로 분류한다. 실패 시 안전한 기본값(허용)으로 폴백.
"""

import json
import logging
import requests
from typing import Tuple

from config import settings

logger = logging.getLogger(__name__)

# 키워드 기반 1차 필터 (LLM 호출 전 빠른 차단)
_HARD_BLOCKED_KEYWORDS = [
    # 성적 콘텐츠
    "포르노", "성관계 묘사", "음란",
    # 자살/자해 (지원이 아닌 방법 묘사)
    "자살 방법", "자해 방법",
    # 마약 제조/구매
    "마약 제조", "마약 구매", "필로폰 만드는",
    # 폭탄/무기 제조
    "폭탄 제조", "총기 제조",
    # 명백한 혐오
    "특정 인종 절멸", "특정 종교 절멸",
]


def _call_gpt_json(system_prompt: str, user_prompt: str, max_tokens: int = 100) -> dict:
    """JSON 응답을 강제하는 GPT 호출."""
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0,
            "response_format": {"type": "json_object"},
        },
        timeout=10,
    )
    response.raise_for_status()
    return json.loads(response.json()["choices"][0]["message"]["content"])


def is_sensitive_topic(topic: str) -> Tuple[bool, str]:
    """
    토론 주제가 민감하거나 부적절한지 판단.

    Returns:
        (is_sensitive, reason)
        is_sensitive=True면 토론 시작을 막아야 함.
    """
    if not topic or not topic.strip():
        return True, "주제가 비어 있습니다."

    topic_lower = topic.lower().strip()

    # 1차: 키워드 필터 (즉시 차단)
    for kw in _HARD_BLOCKED_KEYWORDS:
        if kw in topic:
            logger.warning(f"⚠️ 민감 키워드 매칭: '{kw}' in '{topic}'")
            return True, "부적절한 키워드가 포함되어 있어 토론을 시작할 수 없습니다."

    # 2차: LLM 분류
    try:
        system_prompt = (
            "당신은 토론 주제 검토자입니다. 주어진 주제가 다음 중 하나라도 해당하는지 판단하세요:\n"
            "- 폭력, 성적 콘텐츠, 자해/자살 조장\n"
            "- 마약/무기 제조 등 불법 행위 안내\n"
            "- 특정 집단(인종, 성별, 종교, 성소수자 등)에 대한 차별/혐오 선동\n"
            "- 미성년자에게 부적절한 내용\n"
            "- 명백히 무의미한 입력 (랜덤 문자, 욕설만 나열 등)\n\n"
            "사회적 논쟁 주제(정치, 경제, 윤리 등)는 허용입니다.\n"
            "JSON으로 응답하세요: {\"sensitive\": true/false, \"reason\": \"짧은 이유 (사용자에게 보일 수 있음)\"}"
        )
        result = _call_gpt_json(system_prompt, f"주제: {topic}", max_tokens=120)
        sensitive = bool(result.get("sensitive", False))
        reason = result.get("reason", "")
        if sensitive:
            logger.warning(f"⚠️ LLM 민감 분류: '{topic}' → {reason}")
        return sensitive, reason
    except Exception as e:
        logger.error(f"❌ 민감 주제 분류 실패, 허용으로 폴백: {e}")
        return False, ""


def is_on_topic(topic: str, message: str) -> Tuple[bool, str]:
    """
    사용자 발언이 토론 주제와 관련 있는지 판단.

    Returns:
        (is_relevant, reason)
        is_relevant=False면 응답 생성 대신 사용자에게 안내 메시지를 보낸다.
    """
    if not message or not message.strip():
        return False, "메시지가 비어 있습니다."

    # 너무 짧은 메시지는 통과 (인사 등)
    if len(message.strip()) < 5:
        return True, ""

    try:
        system_prompt = (
            "당신은 토론 진행자입니다. 사용자의 발언이 토론 주제와 관련 있는지 판단하세요.\n"
            "관련 기준:\n"
            "- 주제에 대한 의견, 근거, 반박, 질문은 모두 '관련 있음'.\n"
            "- 주제와 완전히 다른 화제(예: 점심 메뉴, 욕설, 광고, 무의미한 문자) → '관련 없음'.\n"
            "- 약간 둘러서 표현해도 주제와 연결되면 '관련 있음'으로 판정.\n"
            "JSON으로 응답하세요: {\"on_topic\": true/false, \"reason\": \"왜 무관한지 짧게 (관련 있으면 빈 문자열)\"}"
        )
        user_prompt = f"토론 주제: {topic}\n\n사용자 발언: {message}"
        result = _call_gpt_json(system_prompt, user_prompt, max_tokens=120)
        on_topic = bool(result.get("on_topic", True))
        reason = result.get("reason", "")
        if not on_topic:
            logger.info(f"ℹ️ 토론 무관 발언 차단: '{message[:50]}...' → {reason}")
        return on_topic, reason
    except Exception as e:
        logger.error(f"❌ 무관 발언 분류 실패, 허용으로 폴백: {e}")
        return True, ""
