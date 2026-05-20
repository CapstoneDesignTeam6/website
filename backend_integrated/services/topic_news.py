"""
topic_news.py — 토론 주제별 뉴스/검색 결과 Supabase 저장 & 조회

debate_orchestrator의 Agent 0 (Explorer) 가 Tavily로 수집한 결과를
topic_news 테이블에 캐싱하여 다른 서비스에서도 재사용할 수 있게 한다.

테이블 스키마 (Supabase SQL):
  create table topic_news (
    id          bigserial primary key,
    topic       text not null,
    title       text,
    url         text,
    content     text,
    source_query text,
    created_at  timestamptz default now()
  );
  create index on topic_news (topic, created_at desc);
"""

import logging
from datetime import datetime, timezone, timedelta
from database import get_supabase_client

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24  # 같은 주제로 24시간 내 재검색 방지


def save_topic_news(topic: str, items: list[dict]) -> int:
    """
    Tavily 검색 결과를 topic_news 테이블에 저장한다.
    같은 주제의 캐시가 CACHE_TTL_HOURS 이내에 있으면 저장을 건너뛴다.

    items 형식: [{"source_query": "", "title": "", "url": "", "content": ""}]
    저장된 건수 반환 (건너뛴 경우 0).
    """
    if not items or not topic:
        return 0

    supabase = get_supabase_client()

    # 캐시 확인: 최근 24시간 내 같은 주제 데이터가 있으면 스킵
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_TTL_HOURS)).isoformat()
        existing = (
            supabase.table("topic_news")
            .select("id")
            .eq("topic", topic)
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        if existing.data:
            logger.info(f"[topic_news] '{topic}' 캐시 유효 — 저장 생략")
            return 0
    except Exception as e:
        logger.warning(f"[topic_news] 캐시 확인 실패: {e} — 저장 진행")

    rows = [
        {
            "topic": topic,
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "content": item.get("content", ""),
            "source_query": item.get("source_query", ""),
        }
        for item in items
        if item.get("title") or item.get("content")
    ]

    if not rows:
        return 0

    try:
        supabase.table("topic_news").insert(rows).execute()
        logger.info(f"[topic_news] '{topic}' — {len(rows)}건 저장 완료")
        return len(rows)
    except Exception as e:
        logger.error(f"[topic_news] 저장 실패: {e}")
        return 0


def get_topic_news(topic: str, limit: int = 10) -> list[dict]:
    """
    topic_news 테이블에서 해당 주제의 최신 뉴스를 가져온다.
    캐시 TTL 이내 데이터만 반환.
    """
    supabase = get_supabase_client()
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_TTL_HOURS)).isoformat()
        response = (
            supabase.table("topic_news")
            .select("title, url, content, source_query, created_at")
            .eq("topic", topic)
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        logger.error(f"[topic_news] 조회 실패: {e}")
        return []
