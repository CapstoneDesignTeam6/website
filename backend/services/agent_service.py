import requests
import asyncio
from typing import List, Dict, Optional
from config import settings
import logging
from datetime import datetime

from services.queue_service import (
    enqueue, wait_result,
    DISCUSSION_QUEUE, EVALUATION_QUEUE,
)

logger = logging.getLogger(__name__)


def _call_gpt(system_prompt: str, user_prompt: str, max_tokens: int = 300) -> str:
    """OpenAI GPT API 직접 호출 (폴백용)."""
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
            "temperature": 0.7,
        },
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


def _run_sync(job_type: str, queue: str, payload: dict, timeout: int = 90) -> dict:
    """큐에 job 삽입 후 결과 대기 (동기)."""
    job_id = enqueue(queue, job_type, payload)
    return wait_result(job_id, timeout=timeout)


class AgentService:

    @staticmethod
    def generate_response(
        agent_name: str,
        agent_role: str,
        topic: str,
        conversation_history: List[Dict],
        max_tokens: int = settings.MAX_NEW_TOKENS,
        temperature: float = settings.TEMPERATURE,
    ) -> dict:
        """토론 AI 응답 생성 — 토론 워커에 위임."""
        try:
            return _run_sync(
                "generate_response",
                DISCUSSION_QUEUE,
                {
                    "agent_name": agent_name,
                    "topic": topic,
                    "history": conversation_history[-6:],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
                timeout=60,
            )
        except Exception as e:
            logger.warning(f"⚠️ 토론 워커 오류, GPT 폴백: {e}")
            return _gpt_fallback_response(agent_name, topic, conversation_history, max_tokens)

    @staticmethod
    def get_trending_topics() -> list:
        """네이버 뉴스 API로 최신 기사를 수집한 뒤 GPT로 토론 주제 5개 생성."""
        search_queries = ["사회이슈", "정치논란", "기술AI", "경제정책", "국제분쟁"]
        news_items = []

        for query in search_queries:
            try:
                res = requests.get(
                    "https://openapi.naver.com/v1/search/news.json",
                    headers={
                        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
                        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
                    },
                    params={"query": query, "display": 3, "sort": "date"},
                    timeout=5,
                )
                if res.status_code == 200:
                    items = res.json().get("items", [])
                    for item in items[:2]:
                        import re
                        title = re.sub(r"<[^>]+>", "", item.get("title", ""))
                        desc  = re.sub(r"<[^>]+>", "", item.get("description", ""))
                        news_items.append(f"- {title}: {desc}")
            except Exception as e:
                logger.warning(f"⚠️ 네이버 뉴스 검색 실패 ({query}): {e}")

        if not news_items:
            raise RuntimeError("네이버 뉴스 API 호출에 실패했습니다.")

        news_text = "\n".join(news_items[:10])
        system_prompt = (
            "당신은 시사 토론 기획자입니다. 아래 최신 뉴스들을 바탕으로 토론 주제 5개를 JSON 배열로 만들어주세요.\n"
            "각 항목 형식:\n"
            "{\n"
            '  "title": "뉴스 키워드를 포함한 논쟁적 질문 (예: \'48개국 확대, 축제인가 민폐인가?\')",\n'
            '  "description": "[이슈] 주제 배경을 2~3문장으로 설명. 현재 상황·쟁점·양측 입장을 균형있게.",\n'
            '  "category": "정치 | 경제 | 사회 | 기술 | 환경 | 문화 | 스포츠 중 하나"\n'
            "}\n"
            "반드시 JSON 배열만 출력하고 다른 텍스트는 쓰지 마세요. 한국어로 작성하세요."
        )
        user_prompt = f"다음 뉴스를 참고해서 토론 주제를 만들어주세요:\n{news_text}"
        raw = _call_gpt(system_prompt, user_prompt, max_tokens=1000)

        import json, re as re2
        json_match = re2.search(r"\[.*\]", raw, re2.DOTALL)
        parsed = json.loads(json_match.group() if json_match else raw)

        result = []
        for i, item in enumerate(parsed[:5], start=1):
            result.append({
                "id": i,
                "category": item.get("category", "사회"),
                "isHot": i <= 2,
                "title": item.get("title", ""),
                "description": item.get("description", ""),
                "participants": 0,
            })

        logger.info(f"✅ 트렌딩 토론 주제 {len(result)}개 생성 완료")
        return result

    @staticmethod
    def evaluate_response(response_text: str) -> dict:
        """응답 평가."""
        try:
            return _run_sync(
                "evaluate_response",
                EVALUATION_QUEUE,
                {"response": response_text},
                timeout=30,
            )
        except Exception as e:
            logger.warning(f"⚠️ 평가 워커 오류: {e}")
            return {"logic": 0, "consistency": 0, "depth": 0}

    @staticmethod
    def health_check() -> dict:
        """Redis 연결 상태 확인."""
        try:
            from services.queue_service import _client
            _client().ping()
            redis_ok = True
        except Exception:
            redis_ok = False
        return {
            "redis": redis_ok,
            "discussion_worker": redis_ok,
            "evaluation_worker": redis_ok,
            "all_healthy": redis_ok,
        }

    @staticmethod
    def get_intro(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        news_data: List = None,
    ) -> dict:
        """토론 시작 전 주제 배경 요약 — 평가 워커에 위임."""
        try:
            return _run_sync(
                "intro",
                EVALUATION_QUEUE,
                {
                    "topic": topic,
                    "user_label": user_label,
                    "ai_label": ai_label,
                    "news_data": news_data or [],
                },
                timeout=60,
            )
        except Exception as e:
            logger.warning(f"⚠️ Intro 워커 오류, GPT 폴백: {e}")
            summary = _call_gpt(
                "당신은 토론 진행자입니다. 주어진 주제를 2-3문장으로 객관적으로 소개하세요.",
                f"토론 주제: {topic}",
                max_tokens=200,
            )
            return {"summary": summary}

    @staticmethod
    def get_counter_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None,
    ) -> dict:
        """재반박 힌트 — 평가 워커에 위임."""
        ai_history = _normalize_history(history)
        return _run_sync(
            "counter_hint",
            EVALUATION_QUEUE,
            {
                "topic": topic,
                "user_label": user_label,
                "ai_label": ai_label,
                "history": ai_history,
                "news_data": news_data or [],
            },
        )

    @staticmethod
    def get_rebuttal_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None,
    ) -> dict:
        """반박 힌트 — 평가 워커에 위임."""
        ai_history = _normalize_history(history)
        return _run_sync(
            "rebuttal_hint",
            EVALUATION_QUEUE,
            {
                "topic": topic,
                "user_label": user_label,
                "ai_label": ai_label,
                "history": ai_history,
                "news_data": news_data or [],
            },
        )

    @staticmethod
    def get_quiz(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None,
    ) -> dict:
        """퀴즈 생성 — 평가 워커에 위임."""
        ai_history = _normalize_history(history)
        return _run_sync(
            "quiz",
            EVALUATION_QUEUE,
            {
                "topic": topic,
                "user_label": user_label,
                "ai_label": ai_label,
                "history": ai_history,
                "news_data": news_data or [],
            },
            timeout=120,
        )

    @staticmethod
    def get_summary(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None,
        turns: int = 1,
    ) -> dict:
        """토론 종료 후 전체 정리 + 피드백 — 평가 워커에 위임."""
        ai_history = _normalize_history(history)
        return _run_sync(
            "summarize",
            EVALUATION_QUEUE,
            {
                "topic": topic,
                "user_label": user_label,
                "ai_label": ai_label,
                "turns": turns,
                "history": ai_history,
                "news_data": news_data or [],
            },
            timeout=120,
        )


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────


def _normalize_history(history: Optional[List[Dict]]) -> List[Dict]:
    return [
        {
            "role": "ai" if m.get("role") in ("agent", "assistant") else "user",
            "content": m.get("content", ""),
        }
        for m in (history or [])
    ]


def _gpt_fallback_response(
    agent_name: str,
    topic: str,
    conversation_history: List[Dict],
    max_tokens: int,
) -> dict:
    history_text = "\n".join([
        f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
        for m in conversation_history[-6:]
    ])
    system_prompt = (
        f"당신은 '{topic}' 주제로 토론하는 AI 에이전트입니다. "
        f"역할: {agent_name}. "
        f"사용자의 주장에 반대 입장에서 논리적으로 반박하세요. "
        f"2-3문장으로 간결하게 답하세요. 한국어로 답하세요."
    )
    user_prompt = f"지금까지 대화:\n{history_text}\n\n위 내용에 대해 반박해주세요."
    response_text = _call_gpt(system_prompt, user_prompt, max_tokens=max_tokens)
    logger.info(f"✅ [{agent_name}] GPT 폴백 응답 생성")
    return {
        "response": response_text,
        "agent": agent_name,
        "timestamp": datetime.utcnow().isoformat(),
    }
