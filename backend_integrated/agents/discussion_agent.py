from agents.base import BaseAgent
from services.agent_service import AgentService

class DiscussionAgent(BaseAgent):
    """토론용 AI 에이전트"""
    
    def generate_response(self, topic: str, last_remarks: list = None) -> dict:
        """토론 응답 생성
        
        Returns:
            {
                "response": "생성된 응답",
                "is_fallback": False/True,
                "timestamp": "ISO 형식 시간",
                "agent": "에이전트 이름"
            }
        """
        if last_remarks is None:
            last_remarks = []
        
        response_data = AgentService.generate_response(
            agent_name=self.name,
            agent_role=self.role,
            topic=topic,
            conversation_history=last_remarks
        )
        
        return response_data
    
    @staticmethod
    def create_default_agents() -> list:
        """기본 에이전트들 생성"""
        agents = [
            DiscussionAgent(
                name="논리적 비판가",
                role="객관적인 시각에서 반박하고 논리적 결함을 지적하는 역할"
            ),
            DiscussionAgent(
                name="창의적 대안제시자",
                role="기존 관점을 벗어나 새로운 대안과 시각을 제시하는 역할"
            ),
            DiscussionAgent(
                name="균형잡힌 중재자",
                role="양쪽 주장을 인정하면서 공통점과 평가 기준을 제시하는 역할"
            ),
        ]
        return agents
