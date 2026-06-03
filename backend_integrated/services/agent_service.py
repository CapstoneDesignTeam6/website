"""
agent_service.py — 통합 버전 (Redis 워커 패턴 제거)

LLM 호출 전략:
  - Vertex AI Gemini (gemini-2.5-pro, services/vertex_llm.call_llm)
  - 힌트(반박/재반박)·단일 퀴즈 생성을 Gemini로 처리
"""

import json
import logging
from typing import List, Dict, Optional


logger = logging.getLogger(__name__)


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────


def _call_gpt(system_prompt: str, user_content: str, max_tokens: int = 500) -> str:
    """Vertex AI Gemini 호출 → 텍스트 반환."""
    from services.vertex_llm import call_llm
    return call_llm(user_content, system=system_prompt, max_tokens=max_tokens, temperature=0.7)


def _call_gpt_json(system_prompt: str, user_content: str, max_tokens: int = 500) -> dict:
    """Vertex AI Gemini 호출 → JSON dict 반환. 파싱 실패 시 빈 dict."""
    raw = _call_gpt(system_prompt, user_content, max_tokens)
    if not raw:
        return {}
    try:
        import re as _re
        match = _re.search(r"\{.*\}", raw, _re.DOTALL)
        return json.loads(match.group()) if match else {}
    except Exception:
        return {}


def _normalize_history(history: Optional[List[Dict]]) -> List[Dict]:
    return [
        {
            "role": "ai" if m.get("role") in ("agent", "assistant") else "user",
            "content": m.get("content", ""),
        }
        for m in (history or [])
    ]


# ── 힌트 에이전트 (jongtae 포팅, Gemini) ────────────────────────────────────
# discussion_id 별로 HintAgent 인스턴스를 캐시 → 턴 간 반복방지 상태(도메인/전략/
# 결론 패턴) 유지. evidence 는 매 호출 discussion_search_results 로 최신화.
_hint_agents: Dict = {}


def _fetch_evidence(discussion_id) -> List[Dict]:
    """해당 토론의 discussion_search_results 를 HintAgent evidence 형식으로 변환."""
    if not discussion_id:
        return []
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_search_results")
            .select("title, url, content")
            .eq("discussion_id", str(discussion_id))
            .execute()
            .data
        ) or []
        return [
            {"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("content", "")}
            for r in rows
        ]
    except Exception:
        return []


def _get_hint_agent(discussion_id, user_label: str, ai_label: str):
    key = discussion_id or 0
    agent = _hint_agents.get(key)
    if agent is None:
        from services.hint_agent import HintAgent
        agent = HintAgent(user_label=user_label, ai_label=ai_label)
        _hint_agents[key] = agent
    agent.evidence = _fetch_evidence(discussion_id)  # 매 호출 최신 근거 반영
    return agent


# ── AgentService ──────────────────────────────────────────────────────────


class AgentService:

    @staticmethod
    def health_check() -> dict:
        """Vertex AI 설정 여부 확인."""
        try:
            from services.vertex_llm import PROJECT_ID
            vertex_ok = bool(PROJECT_ID)
        except Exception:
            vertex_ok = False
        return {
            "vertex": vertex_ok,
            "all_healthy": vertex_ok,
        }

    @staticmethod
    def get_counter_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: Optional[List[Dict]] = None,
        news_data: Optional[List] = None,
        discussion_id=None,
    ) -> dict:
        """재반박 힌트 (AI 반박 직후, 사용자가 다시 반박할 때 도와줌).
        jongtae HintAgent(Gemini 포팅): stance→전략선택→Tavily 검색→4문장 힌트."""
        try:
            agent = _get_hint_agent(discussion_id, user_label, ai_label)
            return agent.counter_hint(_normalize_history(history), topic)
        except Exception as e:
            logger.error(f"❌ Counter hint 실패: {e}")
            return {"hint": "AI의 주장에 대한 반례를 제시해보세요."}

    @staticmethod
    def get_rebuttal_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: Optional[List[Dict]] = None,
        news_data: Optional[List] = None,
        discussion_id=None,
    ) -> dict:
        """반박 힌트 (AI가 새 주장을 펼친 직후, 사용자에게 반박 방향 제시).
        jongtae HintAgent(Gemini 포팅): stance→전략선택→Tavily 검색→4문장 힌트."""
        try:
            agent = _get_hint_agent(discussion_id, user_label, ai_label)
            return agent.rebuttal_hint(_normalize_history(history), topic)
        except Exception as e:
            logger.error(f"❌ Rebuttal hint 실패: {e}")
            return {"hint": "AI 주장의 전제를 점검해보세요."}

    @staticmethod
    def get_quiz(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: Optional[List[Dict]] = None,
        news_data: Optional[List] = None,
    ) -> dict:
        """주제 관련 4지선다 퀴즈 생성. 프론트엔드 Quiz 인터페이스 형식으로 반환."""
        try:
            system_prompt = (
                f"당신은 토론 교육 자료 제작자입니다. 주제 '{topic}'에 대한 객관식 4지선다 퀴즈 1개를 JSON으로 만드세요. "
                '형식: {"question": "...", "options": ["a", "b", "c", "d"], "answer": 0, "explanation": "..."} '
                "answer는 0-3 정답 인덱스. 한국어로 작성."
            )
            raw = _call_gpt_json(system_prompt, f"주제: {topic}", max_tokens=500)

            # 프론트엔드 Quiz 인터페이스로 변환
            options_raw = raw.get("options", [])
            return {
                "id": 1,
                "topic": topic,
                "question": raw.get("question", ""),
                "options": [
                    {"id": i, "text": opt}
                    for i, opt in enumerate(options_raw)
                ],
                "correctOptionId": int(raw.get("answer", 0)),
                "explanation": raw.get("explanation", ""),
            }
        except Exception as e:
            logger.error(f"❌ Quiz 실패: {e}")
            return {
                "id": 1,
                "topic": topic,
                "question": f"'{topic}'에 대해 어떻게 생각하시나요?",
                "options": [
                    {"id": 0, "text": "찬성"},
                    {"id": 1, "text": "반대"},
                    {"id": 2, "text": "중립"},
                    {"id": 3, "text": "잘 모르겠다"},
                ],
                "correctOptionId": 0,
                "explanation": "퀴즈 생성에 실패했습니다.",
            }
