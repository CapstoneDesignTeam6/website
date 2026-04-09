from agents.base import BaseAgent
from typing import List, Tuple
import requests
import logging

logger = logging.getLogger(__name__)

class NewsSearchAgent(BaseAgent):
    """뉴스 검색 에이전트"""
    
    def __init__(self):
        super().__init__(
            name="뉴스 검색 전문가",
            role="최신 뉴스와 실시간 정보를 검색하여 토론에 근거를 제공"
        )
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    
    def generate_response(self, topic: str, last_remarks: List[Tuple[str, str]] = None) -> str:
        """뉴스 기반 응답"""
        if last_remarks is None:
            last_remarks = []
        
        news = self.search_news(topic)
        if news:
            response = f"최신 뉴스에 따르면, {news[0]}"
            return response
        
        return f"'{topic}'과 관련된 최신 뉴스를 찾을 수 없습니다."
    
    def search_news(self, topic: str) -> list:
        """뉴스 검색"""
        try:
            # 실제로는 네이버 API나 Google News API를 사용하면 됨
            # 현재는 모의 구현
            return [f"최근 '{topic}'과 관련된 뉴스가 있습니다."]
        except Exception as e:
            logger.error(f"News search failed: {e}")
            return []
    
    def scrape_content(self, url: str) -> str:
        """URL에서 콘텐츠 스크래핑"""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            # BeautifulSoup을 사용하여 파싱 가능
            return response.text
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            return ""
