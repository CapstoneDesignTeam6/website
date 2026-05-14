from agents.base import BaseAgent

class SearchAgent(BaseAgent):
    """검색 및 정보 제공 에이전트"""
    
    def __init__(self, knowledge_base: dict = None):
        super().__init__(name="검색 전문가", role="주제와 관련된 정보를 검색하고 제공")
        self.knowledge_base = knowledge_base or {}
    
    def generate_response(self, topic: str, last_remarks: list = None) -> str:
        """검색 기반 응답"""
        results = self.search(topic)
        if results:
            return f"주제와 관련된 정보: {', '.join(results[:3])}"
        return "관련 정보를 찾을 수 없습니다."
    
    def search(self, query: str) -> list:
        """지식 베이스에서 검색"""
        results = []
        query_words = query.lower().split()
        
        for category, facts in self.knowledge_base.items():
            for fact in facts:
                if any(word in fact.lower() for word in query_words):
                    results.append(fact)
        
        return results[:5]  # 상위 5개 반환
    
    def add_knowledge(self, category: str, facts: list):
        """지식 추가"""
        if category in self.knowledge_base:
            self.knowledge_base[category].extend(facts)
        else:
            self.knowledge_base[category] = facts
