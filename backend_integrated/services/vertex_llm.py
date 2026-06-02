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
PROJECT_ID = "gen-lang-client-0550898914"
LOCATION = "global"

_initialized = False
# (temperature, max_output_tokens) → ChatVertexAI 인스턴스 캐시.
# 호출마다 새로 만들면 gRPC 채널이 누적돼 메모리가 단조 증가하므로,
# 설정별로 클라이언트를 1개만 만들어 재사용한다. (langchain LLM은 동시 invoke 안전)
_clients: dict[tuple, ChatVertexAI] = {}


def _ensure_init() -> None:
    global _initialized
    if not _initialized:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        _initialized = True


def _get_client(temperature: float, max_output_tokens: int) -> ChatVertexAI:
    key = (round(temperature, 3), max_output_tokens)
    llm = _clients.get(key)
    if llm is None:
        _ensure_init()
        # project/location을 명시적으로 전달한다. topic.py가 vertexai.init을
        # us-central1로 호출해 전역 기본값을 덮어쓸 수 있으므로, 전역에 의존하지
        # 않고 생성자에서 직접 지정해야 의도한 리전(global)이 보장된다.
        llm = ChatVertexAI(
            model_name=MODEL_ID,
            project=PROJECT_ID,
            location=LOCATION,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        _clients[key] = llm
    return llm


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
        # gemini-2.5-pro는 thinking을 끌 수 없고(thinking_budget=0 → 400),
        # 사고 토큰을 응답 예산과 함께 소비한다. 답변이 잘리지 않도록 넉넉한
        # 하한(orchestrator와 동일한 8192)을 둔다. 캡일 뿐이라 짧은 답변은 일찍 종료된다.
        effective_max = max(max_tokens, 8192)
        llm = _get_client(temperature, effective_max)
        messages = []
        if system:
            messages.append(SystemMessage(content=system))
        messages.append(HumanMessage(content=prompt))
        resp = llm.invoke(messages)
        return resp.content or ""
    except Exception as e:
        logger.error(f"[vertex_llm] 호출 실패: {e}")
        return ""
