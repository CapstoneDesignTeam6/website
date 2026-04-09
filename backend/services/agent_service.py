import requests
from typing import List, Tuple, Optional
from config import settings
import logging
import random
from datetime import datetime

logger = logging.getLogger(__name__)

# 폴백용 샘플 응답 (에이전트 응답 없을 때 사용)
FALLBACK_RESPONSES = {
    "논리적 비판가": [
        "흥미로운 지적입니다. 하지만 이 관점에서 한 가지 더 고려해야 할 점이 있습니다.",
        "좋은 의견이지만, 반대 관점에서 생각해보면...",
        "실제로 데이터를 보면 이와 다른 결과가 나타날 수 있습니다.",
        "이 주장의 논리적 근거가 충분한지 검토해 볼 필요가 있습니다.",
    ],
    "창의적 대안제시자": [
        "이를 다른 관점에서 접근한다면 어떨까요?",
        "새로운 방식으로 생각해본다면 다음과 같은 대안이 있습니다.",
        "기존 방식에서 벗어나 보면, 이런 방법도 가능합니다.",
        "혁신적으로 접근한다면 더 나은 해결책이 있을 수 있습니다.",
    ],
    "균형잡힌 중재자": [
        "양쪽 의견 모두 타당한 부분이 있습니다.",
        "이 문제는 서로 다른 관점을 모두 고려해야 합니다.",
        "양쪽 입장의 공통점을 찾아보는 것이 중요합니다.",
        "이 주제에 대해 균형잡힌 평가를 하려면 다양한 요소를 봐야 합니다.",
    ]
}


class AgentService:
    """AI 에이전트 관리 및 실행 서비스 (외부 에이전트 서버와 통신)
    
    이 서비스는 외부의 별도 에이전트 서버와 통신하여 AI 응답을 생성합니다.
    에이전트 서버가 응답하지 않을 경우 폴백 응답을 제공합니다.
    """

    @staticmethod
    def generate_response(
        agent_name: str,
        agent_role: str,
        topic: str,
        conversation_history: List[Tuple[str, str]],
        max_tokens: int = settings.MAX_NEW_TOKENS,
        temperature: float = settings.TEMPERATURE,
    ) -> dict:
        """외부 토론 AI 서버에 요청하여 에이전트 응답 생성
        
        Args:
            agent_name: 에이전트 이름 (예: "논리적 비판가")
            agent_role: 에이전트 역할 설명
            topic: 토론 주제
            conversation_history: 대화 히스토리 [(발화자, 내용), ...]
            max_tokens: 최대 토큰 수
            temperature: 온도 (창의성)
        
        Returns:
            {
                "response": "생성된 응답",
                "is_fallback": False (정상 응답) / True (폴백 응답),
                "agent": "에이전트 이름",
                "timestamp": "ISO 타임스탬프",
                "note": "추가 정보 (있을 경우)"
            }
        """
        try:
            # 요청 데이터 구성
            payload = {
                "agent_name": agent_name,
                "agent_role": agent_role,
                "topic": topic,
                "conversation_history": conversation_history[-5:],  # 최근 5개만 전송
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            # 토론 진행 AI 서버에 요청
            response = requests.post(
                f"{settings.DISCUSSION_AGENT_URL}/generate-response",
                json=payload,
                timeout=settings.AGENT_TIMEOUT
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ [{agent_name}] 토론 AI 서버에서 응답 수신")
                return {
                    "response": data.get("response", ""),
                    "is_fallback": False,
                    "agent": agent_name,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            else:
                logger.warning(
                    f"⚠️ [{agent_name}] 토론 AI 서버 오류 (상태: {response.status_code})"
                )
                return AgentService._get_fallback_response(agent_name)

        except requests.exceptions.Timeout:
            logger.warning(f"⚠️ [{agent_name}] 토론 AI 서버 타임아웃 - 폴백 응답 사용")
            return AgentService._get_fallback_response(agent_name)

        except requests.exceptions.ConnectionError:
            logger.warning(
                f"⚠️ [{agent_name}] 토론 AI 서버 연결 실패 ({settings.DISCUSSION_AGENT_URL})"
            )
            return AgentService._get_fallback_response(agent_name)

        except Exception as e:
            logger.error(f"❌ [{agent_name}] 예상치 못한 오류: {str(e)}")
            return AgentService._get_fallback_response(agent_name)

    @staticmethod
    def _get_fallback_response(agent_name: str) -> dict:
        """폴백 응답 (에이전트 서버 사용 불가 시)
        
        에이전트 서버가 응답하지 않을 때 미리 정의된 응답을 제공합니다.
        """
        fallback_list = FALLBACK_RESPONSES.get(agent_name, FALLBACK_RESPONSES["균형잡힌 중재자"])
        response = random.choice(fallback_list)

        return {
            "response": response,
            "is_fallback": True,
            "agent": agent_name,
            "timestamp": datetime.utcnow().isoformat(),
            "note": "에이전트 서버를 사용할 수 없어 기본 응답을 제공합니다.",
        }

    @staticmethod
    def evaluate_response(response_text: str) -> dict:
        """응답 평가 (외부 평가 AI 서버 이용)
        
        Args:
            response_text: 평가할 응답
        
        Returns:
            평가 결과
        """
        try:
            payload = {
                "response": response_text,
            }

            response = requests.post(
                f"{settings.EVALUATION_AGENT_URL}/evaluate-response",
                json=payload,
                timeout=settings.AGENT_TIMEOUT
            )

            if response.status_code == 200:
                logger.info("✅ 평가 AI 서버에서 응답 평가 완료")
                return response.json()
            else:
                logger.warning(f"⚠️ 응답 평가 실패 (상태: {response.status_code})")
                return {
                    "logic": 0,
                    "consistency": 0,
                    "depth": 0,
                    "note": "평가를 진행할 수 없습니다."
                }

        except requests.exceptions.Timeout:
            logger.warning("⚠️ 평가 AI 서버 타임아웃")
            return {
                "logic": 0,
                "consistency": 0,
                "depth": 0,
                "error": "Timeout"
            }

        except Exception as e:
            logger.error(f"❌ 응답 평가 중 오류: {str(e)}")
            return {
                "logic": 0,
                "consistency": 0,
                "depth": 0,
                "error": str(e)
            }

    @staticmethod
    def health_check() -> dict:
        """두 개의 AI 서버 상태 확인
        
        Returns:
            {
                "discussion_agent": True/False,
                "evaluation_agent": True/False,
                "all_healthy": True/False
            }
        """
        try:
            discussion_healthy = False
            evaluation_healthy = False
            
            # 토론 AI 서버 상태 확인
            try:
                response = requests.get(
                    f"{settings.DISCUSSION_AGENT_URL}/health",
                    timeout=5
                )
                discussion_healthy = response.status_code == 200
            except Exception as e:
                logger.warning(f"⚠️ 토론 AI 서버 헬스 체크 실패: {str(e)}")
            
            # 평가 AI 서버 상태 확인
            try:
                response = requests.get(
                    f"{settings.EVALUATION_AGENT_URL}/health",
                    timeout=5
                )
                evaluation_healthy = response.status_code == 200
            except Exception as e:
                logger.warning(f"⚠️ 평가 AI 서버 헬스 체크 실패: {str(e)}")
            
            return {
                "discussion_agent": discussion_healthy,
                "evaluation_agent": evaluation_healthy,
                "all_healthy": discussion_healthy and evaluation_healthy
            }
        except Exception as e:
            logger.error(f"❌ 헬스 체크 중 오류: {str(e)}")
            return {
                "discussion_agent": False,
                "evaluation_agent": False,
                "all_healthy": False
            }
