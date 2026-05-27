"""
agent_service.py — 통합 버전 (Redis 워커 패턴 제거)

LLM 호출 전략:
  1) DebateOrchestrator (Vertex AI Gemini + hongcheol 멀티에이전트)
     - VERTEX_PROJECT_ID가 설정되어 있고 인증 키가 있을 때만 사용
     - 토론 응답 생성에만 사용 (generate_response)
  2) OpenAI GPT (gpt-4o-mini)
     - 위가 실패하거나 미설정이면 자동 폴백
     - 평가 워커가 하던 기능들(intro, hint, quiz, summary)은 모두 GPT로 처리
"""

import os
import json
import logging
import requests
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

from config import settings

logger = logging.getLogger(__name__)

# ── Vertex AI 설정 ────────────────────────────────────────────────────────

VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", "")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "global")
VERTEX_MODEL_ID = os.getenv("VERTEX_MODEL_ID", "gemini-2.5-pro")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")



# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────


def _normalize_history(history: Optional[List[Dict]]) -> List[Dict]:
    return [
        {
            "role": "ai" if m.get("role") in ("agent", "assistant") else "user",
            "content": m.get("content", ""),
        }
        for m in (history or [])
    ]




# ── AgentService ──────────────────────────────────────────────────────────


class AgentService:

    @staticmethod
    def get_trending_topics() -> list:
        """네이버 뉴스 API + GPT로 트렌딩 토론 주제 생성."""
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
                        desc = re.sub(r"<[^>]+>", "", item.get("description", ""))
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
            '  "title": "뉴스 키워드를 포함한 논쟁적 질문",\n'
            '  "description": "[이슈] 주제 배경을 2~3문장으로",\n'
            '  "category": "정치 | 경제 | 사회 | 기술 | 환경 | 문화 | 스포츠 중 하나"\n'
            "}\n"
            "반드시 JSON 배열만 출력하고 다른 텍스트는 쓰지 마세요. 한국어로 작성하세요."
        )
        user_prompt = f"다음 뉴스를 참고해서 토론 주제를 만들어주세요:\n{news_text}"
        raw = _call_gpt(system_prompt, user_prompt, max_tokens=1000)

        import re as re2
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
        """응답 평가 (논리/일관성/깊이 0~10점)."""
        try:
            system_prompt = (
                "당신은 토론 응답을 평가하는 분석가입니다. 응답의 논리성(logic), 일관성(consistency), "
                "깊이(depth)를 각 0~10점으로 평가하여 JSON으로 반환하세요. "
                '형식: {"logic": 0, "consistency": 0, "depth": 0}'
            )
            return _call_gpt_json(system_prompt, response_text, max_tokens=120)
        except Exception as e:
            logger.warning(f"⚠️ 평가 실패: {e}")
            return {"logic": 0, "consistency": 0, "depth": 0}

    @staticmethod
    def health_check() -> dict:
        """OpenAI API 키 설정 여부만 확인."""
        openai_ok = bool(settings.OPENAI_API_KEY)
        vertex_ok = bool(VERTEX_PROJECT_ID)
        return {
            "openai": openai_ok,
            "vertex": vertex_ok,
            "all_healthy": openai_ok,
        }

    @staticmethod
    def get_intro(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        news_data: Optional[List] = None,
    ) -> dict:
        """토론 시작 전 주제 배경 요약."""
        try:
            summary = _call_gpt(
                "당신은 토론 진행자입니다. 주어진 주제를 2-3문장으로 객관적으로 소개하세요.",
                f"토론 주제: {topic}",
                max_tokens=200,
            )
            return {"summary": summary}
        except Exception as e:
            logger.error(f"❌ Intro 실패: {e}")
            return {"summary": f'"{topic}"에 대한 토론을 시작합니다.'}

    @staticmethod
    def get_counter_hint(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: Optional[List[Dict]] = None,
        news_data: Optional[List] = None,
    ) -> dict:
        """재반박 힌트 (AI 반박 직후, 사용자가 다시 반박할 때 도와줌)."""
        try:
            history_text = "\n".join([
                f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
                for m in (history or [])[-6:]
            ])
            system_prompt = (
                f"당신은 토론 코치입니다. 토론 주제: {topic}. "
                f"사용자는 {user_label} 측, AI는 {ai_label} 측입니다. "
                f"AI의 마지막 반박을 다시 반박할 수 있는 힌트를 1-2문장으로 제시하세요. "
                f"한국어로 답하세요."
            )
            hint = _call_gpt(
                system_prompt,
                f"대화 기록:\n{history_text}\n\n사용자가 AI의 반박을 재반박하려면 어떤 논점을 제시하면 좋을까요?",
                max_tokens=200,
            )
            return {"hint": hint}
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
    ) -> dict:
        """반박 힌트 (AI가 새 주장을 펼친 직후, 사용자에게 반박 방향 제시)."""
        try:
            history_text = "\n".join([
                f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
                for m in (history or [])[-6:]
            ])
            system_prompt = (
                f"당신은 토론 코치입니다. 토론 주제: {topic}. "
                f"사용자는 {user_label} 측, AI는 {ai_label} 측입니다. "
                f"AI의 마지막 주장을 반박할 수 있는 힌트를 1-2문장으로 제시하세요. "
                f"한국어로 답하세요."
            )
            hint = _call_gpt(
                system_prompt,
                f"대화 기록:\n{history_text}\n\nAI의 주장을 어떻게 반박하면 좋을까요?",
                max_tokens=200,
            )
            return {"hint": hint}
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

    @staticmethod
    def get_summary(
        topic: str,
        user_label: str = "찬성",
        ai_label: str = "반대",
        history: Optional[List[Dict]] = None,
        news_data: Optional[List] = None,
        turns: int = 1,
    ) -> dict:
        """토론 종료 후 전체 정리 + 피드백."""
        try:
            history_text = "\n".join([
                f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
                for m in (history or [])
            ])
            system_prompt = (
                f"당신은 토론 분석가입니다. 주제 '{topic}'에 대한 {turns}턴 토론을 분석하여 JSON으로 반환하세요. "
                '형식: {"summary": "...", "issues": "...", "logic_feedback": "...", "extra_info": "..."} '
                "각 필드는 2-4문장으로 한국어 작성."
            )
            return _call_gpt_json(system_prompt, f"토론 기록:\n{history_text}", max_tokens=900)
        except Exception as e:
            logger.error(f"❌ Summary 실패: {e}")
            return {
                "summary": "토론 요약을 생성할 수 없습니다.",
                "issues": "",
                "logic_feedback": "",
                "extra_info": "",
            }
