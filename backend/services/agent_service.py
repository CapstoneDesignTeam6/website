import requests
from typing import List, Dict, Optional
from config import settings
import logging
import random
from datetime import datetime

logger = logging.getLogger(__name__)

# 토론 에이전트 Mock 데이터 (서버 없을 때 사용)
DISCUSSION_AGENT_MOCK_RESPONSES = {
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

# 평가 에이전트 Mock 데이터 (서버 없을 때 사용)
EVALUATION_AGENT_MOCK_DATA = {
    "intro_samples": [
        "이 주제는 현대 사회에서 많은 관심과 논쟁을 불러일으키고 있습니다. 양쪽 주장 모두 타당한 근거를 가지고 있으며, 이번 토론을 통해 깊이 있는 이해를 도모하겠습니다.",
        "주어진 주제에 대해 찬성과 반대의 관점을 균형있게 살펴보겠습니다. 각각의 논리와 근거를 검토하며 신중한 판단을 내려보겠습니다.",
    ],
    "counter_hints": [
        "상대방의 주장에서 핵심을 파악한 후, 그 근거를 체계적으로 검토해보세요.",
        "논리적 모순이나 불완전한 부분이 있는지 질문해봐요.",
    ],
    "rebuttal_hints": [
        "새로운 관점이나 사례를 제시하면서 당신의 주장을 강화해보세요.",
        "데이터나 구체적인 사례를 활용하여 설득력을 높여봅시다.",
    ],
}


class AgentService:
    """AI 에이전트 관리 서비스
    
    - 토론 에이전트: Mock 데이터 반환 (별도 팀에서 만들 예정)
    - 평가 에이전트: Mock 데이터 반환 (별도 팀에서 만들 예정)
    """

    # ====== 토론 에이전트 (Mock 데이터) ======
    
    @staticmethod
    def generate_response(
        agent_name: str,
        agent_role: str,
        topic: str,
        conversation_history: List[Dict],
        max_tokens: int = settings.MAX_NEW_TOKENS,
        temperature: float = settings.TEMPERATURE,
    ) -> dict:
        """토론 에이전트 응답 생성 (Mock 데이터 반환)
        
        Args:
            agent_name: 에이전트 이름 (예: "논리적 비판가")
            agent_role: 에이전트 역할 설명
            topic: 토론 주제
            conversation_history: 대화 히스토리 (role, content 포함)
            max_tokens: 최대 토큰 수
            temperature: 온도 (창의성)
        
        Returns:
            {
                "response": "생성된 응답 (Mock 데이터)",
                "is_mock": True,
                "agent": "에이전트 이름",
                "timestamp": "ISO 타임스탬프"
            }
        """
        try:
            logger.info(f"🎭 [{agent_name}] Mock 데이터로 응답 생성")
            
            # Mock 응답 선택
            mock_list = DISCUSSION_AGENT_MOCK_RESPONSES.get(
                agent_name, 
                DISCUSSION_AGENT_MOCK_RESPONSES["균형잡힌 중재자"]
            )
            response = random.choice(mock_list)
            
            return {
                "response": response,
                "is_mock": True,
                "agent": agent_name,
                "timestamp": datetime.utcnow().isoformat(),
                "note": "이것은 Mock 응답입니다. 실제 토론 에이전트 서버를 구현하세요."
            }
        
        except Exception as e:
            logger.error(f"❌ [{agent_name}] Mock 응답 생성 실패: {str(e)}")
            return {
                "response": "죄송합니다. 응답을 생성할 수 없습니다.",
                "is_mock": True,
                "agent": agent_name,
                "error": str(e)
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

    # ====== 평가 에이전트 (Mock 데이터) ======
    
    @staticmethod
    def get_intro(topic: str, stance: int, news_data: List = None) -> dict:
        """토론 시작 전 주제 배경 요약 (Mock 데이터)
        
        Args:
            topic: 토론 주제
            stance: 사용자 입장 (1=찬성, -1=반대)
            news_data: 주제 관련 뉴스 배열 (없으면 서버 기본값 사용)
        
        Returns:
            {"summary": "주제 요약 텍스트"}
        """
        try:
            logger.info(f"🎯 Intro Mock 데이터 생성: {topic}")
            
            # Mock 요약 선택
            intro = random.choice(EVALUATION_AGENT_MOCK_DATA["intro_samples"])
            
            return {
                "summary": f""{topic}"에 대한 토론\n\n{intro}",
                "is_mock": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"❌ Intro 생성 중 오류: {str(e)}")
            return {"summary": f""{topic}"에 대한 토론을 시작합니다.", "error": str(e)}
    
    @staticmethod
    def get_counter_hint(
        topic: str, 
        stance: int, 
        history: List[Dict],
        news_data: List = None
    ) -> dict:
        """재반박 힌트 생성 - Mock 데이터 (AI가 반박한 직후 호출)
        
        Args:
            topic: 토론 주제
            stance: 사용자 입장 (1=찬성, -1=반대)
            history: 그 시점까지의 대화 전부
            news_data: 주제 관련 뉴스 배열
        
        Returns:
            {"hint": "재반박 힌트 텍스트"}
        """
        try:
            logger.info("🎯 Counter Hint Mock 데이터 생성")
            
            # Mock 힌트 선택
            hint = random.choice(EVALUATION_AGENT_MOCK_DATA["counter_hints"])
            
            return {
                "hint": hint,
                "is_mock": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"❌ Counter Hint 생성 중 오류: {str(e)}")
            return {"hint": "상대방의 주장을 분석해보세요.", "error": str(e)}
    
    @staticmethod
    def get_rebuttal_hint(
        topic: str,
        stance: int,
        history: List[Dict],
        news_data: List = None
    ) -> dict:
        """반박 힌트 생성 - Mock 데이터 (AI가 새 주장한 직후 호출)
        
        Args:
            topic: 토론 주제
            stance: 사용자 입장 (1=찬성, -1=반대)
            history: 그 시점까지의 대화 전부
            news_data: 주제 관련 뉴스 배열
        
        Returns:
            {"hint": "반박 힌트 텍스트"}
        """
        try:
            logger.info("🎯 Rebuttal Hint Mock 데이터 생성")
            
            # Mock 힌트 선택
            hint = random.choice(EVALUATION_AGENT_MOCK_DATA["rebuttal_hints"])
            
            return {
                "hint": hint,
                "is_mock": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"❌ Rebuttal Hint 생성 중 오류: {str(e)}")
            return {"hint": "새로운 주장을 제시해보세요.", "error": str(e)}
    
    @staticmethod
    def get_summary(
        topic: str,
        stance: int,
        history: List[Dict],
        news_data: List = None,
        turns: int = 1
    ) -> dict:
        """토론 종료 후 전체 정리 + 피드백 - Mock 데이터
        
        Args:
            topic: 토론 주제
            stance: 사용자 입장 (1=찬성, -1=반대)
            history: 전체 토론 기록
            news_data: 주제 관련 뉴스 배열
            turns: 진행된 라운드 수
        
        Returns:
            {
                "summary": "토론 요약",
                "issues": "쟁점 분석",
                "logic_feedback": "논리 피드백 + 보완 정보",
                "extra_info": "추가 사례"
            }
        """
        try:
            logger.info(f"🎯 Summary Mock 데이터 생성: {turns} 라운드")
            
            return {
                "summary": f""{topic}"에 대한 {turns}라운드 토론을 완료했습니다. 양쪽 주장 모두 타당한 근거를 제시했으며, 깊이 있는 논의가 이루어졌습니다.",
                "issues": f"주요 쟁점: 1) 실효성, 2) 윤리적 고려사항, 3) 경제적 영향",
                "logic_feedback": "논리적 구조가 명확했습니다. 더 구체적인 사례나 통계 자료를 활용하면 더욱 설득력 있는 주장을 펼칠 수 있을 것 같습니다.",
                "extra_info": "관련 주제: 국내외 사례 연구, 정책 현황 분석 등을 추가로 학습하시면 도움이 될 것입니다.",
                "is_mock": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"❌ Summary 생성 중 오류: {str(e)}")
            return {
                "summary": "토론을 완료했습니다.",
                "issues": "다양한 관점이 제시되었습니다.",
                "logic_feedback": "논의가 잘 진행되었습니다.",
                "extra_info": "추가 학습을 권장합니다.",
                "error": str(e)
            }
