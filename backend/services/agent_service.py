import requests
from typing import List, Dict, Optional
from config import settings
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def _call_gpt(system_prompt: str, user_prompt: str, max_tokens: int = 300) -> str:
    """OpenAI GPT API 호출. 실패 시 예외 발생."""
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
        """토론 AI 응답 생성"""
        history_text = "\n".join([
            f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
            for m in conversation_history[-6:]  # 최근 6개만 GPT에 전달
        ])

        # ── 프롬프트 수정 위치 ──────────────────────────────────────
        system_prompt = (
            f"당신은 '{topic}' 주제로 토론하는 AI 에이전트입니다. "
            f"역할: {agent_name}. "
            f"사용자의 주장에 반대 입장에서 논리적으로 반박하세요. "
            f"2-3문장으로 간결하게 답하세요. 한국어로 답하세요."
        )
        user_prompt = (
            f"지금까지 대화:\n{history_text}\n\n"
            f"위 내용에 대해 반박해주세요."
        )
        # ────────────────────────────────────────────────────────────

        response_text = _call_gpt(system_prompt, user_prompt, max_tokens=max_tokens)
        logger.info(f"✅ [{agent_name}] GPT 응답 생성 완료")
        return {
            "response": response_text,
            "agent": agent_name,
            "timestamp": datetime.utcnow().isoformat(),
        }

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
                        # HTML 태그 제거
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
        # GPT가 ```json ... ``` 블록으로 감싸는 경우 처리
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
        """응답 평가 (외부 평가 AI 서버)"""
        try:
            response = requests.post(
                f"{settings.EVALUATION_AGENT_URL}/evaluate-response",
                json={"response": response_text},
                timeout=settings.AGENT_TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.warning(f"⚠️ 평가 AI 서버 오류: {e}")
        return {"logic": 0, "consistency": 0, "depth": 0}

    @staticmethod
    def health_check() -> dict:
        discussion_healthy = False
        evaluation_healthy = False
        try:
            r = requests.get(f"{settings.DISCUSSION_AGENT_URL}/health", timeout=5)
            discussion_healthy = r.status_code == 200
        except Exception as e:
            logger.warning(f"⚠️ 토론 AI 서버 헬스 체크 실패: {e}")
        try:
            r = requests.get(f"{settings.EVALUATION_AGENT_URL}/health", timeout=5)
            evaluation_healthy = r.status_code == 200
        except Exception as e:
            logger.warning(f"⚠️ 평가 AI 서버 헬스 체크 실패: {e}")
        return {
            "discussion_agent": discussion_healthy,
            "evaluation_agent": evaluation_healthy,
            "all_healthy": discussion_healthy and evaluation_healthy,
        }

    @staticmethod
    def get_intro(topic: str, user_label: str = "찬성", ai_label: str = "반대", news_data: List = None) -> dict:
        """토론 시작 전 주제 배경 요약."""
        res = requests.post(
            f"{settings.EVALUATION_AGENT_URL}/intro",
            json={"topic": topic, "user_label": user_label, "ai_label": ai_label, "news_data": news_data or []},
            timeout=settings.AGENT_TIMEOUT,
        )
        res.raise_for_status()
        logger.info(f"✅ Intro AI 서버 응답 완료: {topic}")
        return res.json()

    @staticmethod
    def get_counter_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None
    ) -> dict:
        """재반박 힌트 생성."""
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in (history or [])
        ]
        res = requests.post(
            f"{settings.EVALUATION_AGENT_URL}/hint/counter",
            json={"topic": topic, "user_label": user_label, "ai_label": ai_label, "history": ai_history, "news_data": news_data or []},
            timeout=settings.AGENT_TIMEOUT,
        )
        res.raise_for_status()
        logger.info("✅ Counter hint AI 서버 응답 완료")
        return res.json()

    @staticmethod
    def get_rebuttal_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None
    ) -> dict:
        """반박 힌트 생성."""
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in (history or [])
        ]
        res = requests.post(
            f"{settings.EVALUATION_AGENT_URL}/hint/rebuttal",
            json={"topic": topic, "user_label": user_label, "ai_label": ai_label, "history": ai_history, "news_data": news_data or []},
            timeout=settings.AGENT_TIMEOUT,
        )
        res.raise_for_status()
        logger.info("✅ Rebuttal hint AI 서버 응답 완료")
        return res.json()

    @staticmethod
    def get_quiz(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None
    ) -> dict:
        """퀴즈 생성."""
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in (history or [])
        ]
        res = requests.post(
            f"{settings.EVALUATION_AGENT_URL}/quiz",
            json={
                "topic": topic,
                "user_label": user_label,
                "ai_label": ai_label,
                "history": ai_history,
                "news_data": news_data or [],
            },
            timeout=settings.AGENT_TIMEOUT,
        )
        res.raise_for_status()
        logger.info("✅ Quiz AI 서버 응답 완료")
        return res.json()

    @staticmethod
    def get_summary(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: List[Dict] = None,
        news_data: List = None,
        turns: int = 1
    ) -> dict:
        """토론 종료 후 전체 정리 + 피드백."""
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in (history or [])
        ]
        res = requests.post(
            f"{settings.EVALUATION_AGENT_URL}/summarize",
            json={"topic": topic, "user_label": user_label, "ai_label": ai_label, "turns": turns,
                  "history": ai_history, "news_data": news_data or []},
            timeout=settings.AGENT_TIMEOUT,
        )
        res.raise_for_status()
        logger.info("✅ Summary AI 서버 응답 완료")
        return res.json()
