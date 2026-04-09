from typing import List, Tuple, Optional
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    """기본 에이전트 클래스"""
    
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.conversation_history: List[Tuple[str, str]] = []
    
    @abstractmethod
    def generate_response(self, topic: str, last_remarks: List[Tuple[str, str]]) -> str:
        """응답 생성 (서브클래스에서 구현)"""
        pass
    
    def add_to_history(self, speaker: str, content: str):
        """대화 히스토리에 추가"""
        self.conversation_history.append((speaker, content))
    
    def clear_history(self):
        """히스토리 초기화"""
        self.conversation_history.clear()
    
    def __repr__(self):
        return f"<{self.__class__.__name__}(name={self.name}, role={self.role})>"
