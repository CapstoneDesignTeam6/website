"""
services/vertex_llm.py — Vertex AI Gemini 공통 호출 헬퍼

기존 각 서비스의 OpenAI GPT 호출(_call_gpt 등)을 대체한다.
orchestrator/topic과 동일한 프로젝트·리전을 사용하며, 모델은 gemini-2.5-pro.
"""
import logging

import vertexai
from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)

MODEL_ID = "gemini-2.5-pro"
PROJECT_ID = "project-8dcb485c-620f-47a6-bc5"
LOCATION = "global"

_initialized = False


def _ensure_init() -> None:
    global _initialized
    if not _initialized:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        _initialized = True


def call_llm(
    prompt: str,
    system: str = "",
    max_tokens: int = 1000,
    temperature: float = 0.3,
) -> str:
    """Vertex AI Gemini 호출 → 텍스트 반환. 실패 시 빈 문자열.

    Args:
        prompt: 사용자(Human) 메시지
        system: 시스템 메시지 (없으면 생략)
        max_tokens: 최대 출력 토큰 (gemini는 사고 토큰도 포함되므로 너무 작게 잡지 말 것)
        temperature: 0~1
    """
    try:
        _ensure_init()
        llm = ChatVertexAI(
            model_name=MODEL_ID,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        messages = []
        if system:
            messages.append(SystemMessage(content=system))
        messages.append(HumanMessage(content=prompt))
        resp = llm.invoke(messages)
        return resp.content or ""
    except Exception as e:
        logger.error(f"[vertex_llm] 호출 실패: {e}")
        return ""
