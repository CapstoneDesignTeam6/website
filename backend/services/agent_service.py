import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig
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
    """AI 에이전트 관리 및 실행 서비스"""
    
    _model = None
    _tokenizer = None
    
    @classmethod
    def initialize_model(cls):
        """모델 초기화 (싱글톤)"""
        if cls._model is not None:
            return
        
        try:
            logger.info(f"Loading model: {settings.MODEL_NAME}")
            
            cls._tokenizer = AutoTokenizer.from_pretrained(
                settings.MODEL_NAME, 
                trust_remote_code=True
            )
            
            if cls._tokenizer.pad_token is None:
                cls._tokenizer.pad_token = cls._tokenizer.eos_token
            
            config = AutoConfig.from_pretrained(settings.MODEL_NAME, trust_remote_code=True)
            config.pad_token_id = cls._tokenizer.pad_token_id
            
            cls._model = AutoModelForCausalLM.from_pretrained(
                settings.MODEL_NAME,
                config=config,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto",
                trust_remote_code=True
            )
            
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    @classmethod
    def get_model(cls):
        """모델 조회"""
        if cls._model is None:
            cls.initialize_model()
        return cls._model
    
    @classmethod
    def get_tokenizer(cls):
        """토크나이저 조회"""
        if cls._tokenizer is None:
            cls.initialize_model()
        return cls._tokenizer
    
    @staticmethod
    def generate_response(
        agent_name: str,
        agent_role: str,
        topic: str,
        conversation_history: List[Tuple[str, str]],
        max_tokens: int = settings.MAX_NEW_TOKENS,
        temperature: float = settings.TEMPERATURE,
        timeout: int = 30
    ) -> dict:
        """에이전트 응답 생성
        
        Args:
            agent_name: 에이전트 이름
            agent_role: 에이전트 역할
            topic: 토론 주제
            conversation_history: 대화 히스토리
            max_tokens: 최대 토큰 수
            temperature: 온도 (창의성)
            timeout: 타임아웃 (초)
        
        Returns:
            {
                "response": "생성된 응답",
                "is_fallback": False (정상 응답) / True (폴백 응답),
                "timestamp": "2024-01-01T12:00:00"
            }
        """
        try:
            model = AgentService.get_model()
            tokenizer = AgentService.get_tokenizer()
            
            # 컨텍스트 구성
            context = f"Topic: {topic}\nYour Name: {agent_name}\nYour Role: {agent_role}\n\n"
            
            # 대화 히스토리 추가
            for speaker, remark in conversation_history[-5:]:  # 최근 5개만 포함
                context += f"{speaker}: {remark}\n"
            
            prompt = context + f"{agent_name}:"
            
            # 토큰 생성
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    do_sample=True,
                    pad_token_id=tokenizer.pad_token_id,
                    top_p=0.95
                )
            
            # 응답 디코딩
            response = tokenizer.decode(
                outputs[0][inputs["input_ids"].shape[1]:],
                skip_special_tokens=True
            )
            
            # 첫 번째 문장만 추출
            clean_response = response.split("\n")[0].strip()
            
            logger.info(f"✅ [{agent_name}] 응답 생성 성공")
            
            return {
                "response": clean_response,
                "is_fallback": False,
                "timestamp": datetime.utcnow().isoformat(),
                "agent": agent_name
            }
        
        except torch.cuda.OutOfMemoryError:
            logger.warning(f"⚠️ [{agent_name}] CUDA 메모리 부족 - 폴백 응답 사용")
            return AgentService._get_fallback_response(agent_name)
        
        except Exception as e:
            logger.warning(f"⚠️ [{agent_name}] 응답 생성 실패 ({str(e)}) - 폴백 응답 사용")
            return AgentService._get_fallback_response(agent_name)
    
    @staticmethod
    def _get_fallback_response(agent_name: str) -> dict:
        """폴백 응답 (에이전트 실패 시)"""
        fallback_list = FALLBACK_RESPONSES.get(agent_name, FALLBACK_RESPONSES["균형잡힌 중재자"])
        response = random.choice(fallback_list)
        
        return {
            "response": response,
            "is_fallback": True,
            "timestamp": datetime.utcnow().isoformat(),
            "agent": agent_name,
            "note": "AI 모델이 응답을 생성하지 못했으므로 기본 응답을 제공합니다."
        }
    
    @staticmethod
    def evaluate_response(response: str) -> dict:
        """응답 평가"""
        try:
            model = AgentService.get_model()
            tokenizer = AgentService.get_tokenizer()
            
            prompt = f"""다음 토론 응답을 평가해주세요:
'{response}'

평가 기준:
- 논리성 (0-100)
- 일관성 (0-100)
- 깊이 (0-100)

각 점수와 종합 평가를 JSON 형식으로 제공해주세요."""
            
            inputs = tokenizer(prompt, return_tensors='pt').to(model.device)
            
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.3,
                    pad_token_id=tokenizer.pad_token_id
                )
            
            evaluation = tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:],
                skip_special_tokens=True
            )
            
            return {"evaluation": evaluation}
        
        except Exception as e:
            logger.error(f"Error evaluating response: {e}")
            return {"evaluation": "평가 실패"}
