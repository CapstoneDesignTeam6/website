import requests
from typing import List, Dict, Optional
from config import settings
import logging
import re
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
    def get_intro(topic: str, stance: int, news_data: List = None) -> dict:
        """토론 시작 전 주제 배경 요약. AI 서버 우선, 실패 시 GPT 폴백."""
        # AI 서버 시도
        try:
            res = requests.post(
                f"{settings.EVALUATION_AGENT_URL}/intro",
                json={"topic": topic, "stance": stance, "news_data": news_data or []},
                timeout=settings.AGENT_TIMEOUT,
            )
            if res.status_code == 200:
                logger.info(f"✅ Intro AI 서버 응답 완료: {topic}")
                return res.json()
        except Exception as e:
            logger.warning(f"⚠️ AI 서버 intro 실패, GPT 폴백: {e}")

        # GPT 폴백
        # ── 프롬프트 수정 위치 ──────────────────────────────────────
        system_prompt = (
            "당신은 토론 진행자입니다. "
            "주어진 주제에 대해 배경과 핵심 쟁점을 3-4문장으로 요약해주세요. "
            "한국어로 답하세요."
        )
        user_prompt = (
            f"주제: '{topic}'\n"
            f"사용자 입장: {'찬성' if stance == 1 else '반대'}\n\n"
            f"이 주제의 배경과 핵심 쟁점을 요약해주세요."
        )
        # ────────────────────────────────────────────────────────────
        summary = _call_gpt(system_prompt, user_prompt)
        logger.info(f"✅ Intro GPT 생성 완료: {topic}")
        return {"summary": summary}

    @staticmethod
    def get_counter_hint(
        topic: str,
        stance: int,
        history: List[Dict],
        news_data: List = None
    ) -> dict:
        """재반박 힌트 생성. AI 서버 우선, 실패 시 GPT 폴백."""
        # AI 서버는 role을 "ai"/"user" 사용
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in history
        ]
        try:
            res = requests.post(
                f"{settings.EVALUATION_AGENT_URL}/hint/counter",
                json={"topic": topic, "stance": stance, "history": ai_history, "news_data": news_data or []},
                timeout=settings.AGENT_TIMEOUT,
            )
            if res.status_code == 200:
                logger.info("✅ Counter hint AI 서버 응답 완료")
                return res.json()
        except Exception as e:
            logger.warning(f"⚠️ AI 서버 counter hint 실패, GPT 폴백: {e}")

        # GPT 폴백
        history_text = "\n".join([
            f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
            for m in history[-4:]
        ])
        # ── 프롬프트 수정 위치 ──────────────────────────────────────
        system_prompt = (
            "당신은 토론 코치입니다. "
            "사용자가 AI의 반박에 재반박할 수 있도록 간결한 힌트를 1-2문장으로 제시해주세요. "
            "한국어로 답하세요."
        )
        user_prompt = (
            f"주제: '{topic}'\n"
            f"최근 대화:\n{history_text}\n\n재반박 힌트를 알려주세요."
        )
        # ────────────────────────────────────────────────────────────
        return {"hint": _call_gpt(system_prompt, user_prompt, max_tokens=150)}

    @staticmethod
    def get_rebuttal_hint(
        topic: str,
        stance: int,
        history: List[Dict],
        news_data: List = None
    ) -> dict:
        """반박 힌트 생성. AI 서버 우선, 실패 시 GPT 폴백."""
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in history
        ]
        try:
            res = requests.post(
                f"{settings.EVALUATION_AGENT_URL}/hint/rebuttal",
                json={"topic": topic, "stance": stance, "history": ai_history, "news_data": news_data or []},
                timeout=settings.AGENT_TIMEOUT,
            )
            if res.status_code == 200:
                logger.info("✅ Rebuttal hint AI 서버 응답 완료")
                return res.json()
        except Exception as e:
            logger.warning(f"⚠️ AI 서버 rebuttal hint 실패, GPT 폴백: {e}")

        # GPT 폴백
        history_text = "\n".join([
            f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
            for m in history[-4:]
        ])
        # ── 프롬프트 수정 위치 ──────────────────────────────────────
        system_prompt = (
            "당신은 토론 코치입니다. "
            "사용자가 AI의 새 주장을 반박할 수 있도록 간결한 힌트를 1-2문장으로 제시해주세요. "
            "한국어로 답하세요."
        )
        user_prompt = (
            f"주제: '{topic}'\n"
            f"최근 대화:\n{history_text}\n\n반박 힌트를 알려주세요."
        )
        # ────────────────────────────────────────────────────────────
        return {"hint": _call_gpt(system_prompt, user_prompt, max_tokens=150)}

    @staticmethod
    def get_summary(
        topic: str,
        stance: int,
        history: List[Dict],
        news_data: List = None,
        turns: int = 1
    ) -> dict:
        """토론 종료 후 전체 정리 + 피드백. AI 서버 우선, 실패 시 GPT 폴백."""
        ai_history = [
            {"role": "ai" if m.get("role") in ("agent", "assistant") else "user",
             "content": m.get("content", "")}
            for m in history
        ]
        try:
            res = requests.post(
                f"{settings.EVALUATION_AGENT_URL}/summarize",
                json={"topic": topic, "stance": stance, "turns": turns,
                      "history": ai_history, "news_data": news_data or []},
                timeout=settings.AGENT_TIMEOUT,
            )
            if res.status_code == 200:
                logger.info("✅ Summary AI 서버 응답 완료")
                return res.json()
        except Exception as e:
            logger.warning(f"⚠️ AI 서버 summary 실패, GPT 폴백: {e}")

        # GPT 폴백
        history_text = "\n".join([
            f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
            for m in history
        ])
        # ── 프롬프트 수정 위치 ──────────────────────────────────────
        system_prompt = (
            "당신은 토론 평가 전문가입니다. 아래 형식으로 정확히 답하세요:\n"
            "[요약] 토론 전체 요약 (2문장)\n"
            "[쟁점] 주요 쟁점 3가지\n"
            "[피드백] 사용자 논리에 대한 피드백 (2문장)\n"
            "[추가정보] 관련 추가 정보 (1문장)\n"
            "한국어로 답하세요."
        )
        user_prompt = (
            f"주제: '{topic}'\n"
            f"사용자 입장: {'찬성' if stance == 1 else '반대'}\n"
            f"토론 내용:\n{history_text}"
        )
        # ────────────────────────────────────────────────────────────
        gpt_response = _call_gpt(system_prompt, user_prompt, max_tokens=500)
        logger.info("✅ Summary GPT 생성 완료")

        def extract(tag: str) -> str:
            m = re.search(rf'\[{tag}\](.*?)(?=\[|$)', gpt_response, re.DOTALL)
            return m.group(1).strip() if m else gpt_response

        return {
            "summary": extract("요약"),
            "issues": extract("쟁점"),
            "logic_feedback": extract("피드백"),
            "extra_info": extract("추가정보"),
        }
