import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from database import get_supabase_client

# bs4, playwright 는 크롤링 실행 시점에 임포트 (서버 startup 오류 방지)

logger = logging.getLogger(__name__)

DAUM_NEWS_URL = "https://news.daum.net/"

# 총 3페이지 → 수집 3번, 새로고침 버튼 클릭 2번
TOTAL_PAGES = 3

# content-article > group_btn > link_refresh (a 태그)
REFRESH_BTN_SELECTOR = "article.content-article .group_btn a.link_refresh"


def _parse_headline_items(html: str) -> list[dict]:
    """
    HTML 문자열에서 ul.list_newsheadline2 항목을 파싱한다.

    구조:
      article.content-article
        > ... > ul.list_newsheadline2
          > li
            > a.item_newsheadline2 [href]
              > div.cont_thumb
                  > .tit_txt  ← 제목
    """
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    results = []

    article = soup.find("article", class_="content-article")
    if not article:
        logger.warning("content-article 요소를 찾을 수 없습니다.")
        return results

    headline_list = article.find("ul", class_="list_newsheadline2")
    if not headline_list:
        logger.warning("list_newsheadline2 요소를 찾을 수 없습니다.")
        return results

    for li in headline_list.find_all("li"):
        a_tag = li.find("a", class_="item_newsheadline2", href=True)
        if not a_tag:
            continue

        url = a_tag.get("href", "").strip()

        cont_thumb = a_tag.find("div", class_="cont_thumb")
        tit_tag = cont_thumb.find(class_="tit_txt") if cont_thumb else None
        title = tit_tag.get_text(strip=True) if tit_tag else a_tag.get("data-title", "").strip()

        if title and url:
            results.append({"title": title, "url": url})

    return results


def _find_refresh_btn(page):
    """content-article 안의 다음 탭 버튼을 찾아 반환. 없으면 None."""
    try:
        btn = page.locator(REFRESH_BTN_SELECTOR).first
        if btn.count() > 0:
            logger.info(f"다음 탭 버튼 발견: {REFRESH_BTN_SELECTOR}")
            return btn
    except Exception:
        pass
    logger.warning("다음 탭 버튼을 찾지 못했습니다.")
    return None


# v.daum.net 기사 본문 셀렉터 (우선순위 순)
ARTICLE_CONTENT_SELECTORS = [
    "div.article_view",       # 다음 뉴스 본문 (주요)
    "div#mArticle",           # 모바일 뷰
    "div.news_view",          # 일부 언론사
    "div#newsct",             # 일부 언론사
    "section.article_body",   # 기타
]


def _fetch_article_content(page, url: str) -> str:
    """
    기사 URL에 접속해 본문 텍스트를 추출한다.
    실패하면 빈 문자열 반환.
    """
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1000)  # JS 렌더링 대기

        for selector in ARTICLE_CONTENT_SELECTORS:
            el = page.locator(selector).first
            if el.count() > 0:
                text = el.inner_text().strip()
                if text:
                    return text

        logger.warning(f"본문 셀렉터 미매칭: {url}")
        return ""
    except Exception as e:
        logger.warning(f"본문 수집 실패 ({url}): {e}")
        return ""


def _crawl_sync() -> tuple[list[dict], str]:
    """
    sync_playwright로 다음 뉴스 헤드라인을 수집한다.
    Windows asyncio 호환을 위해 동기 버전으로 구현.
    """
    import sys

    # Windows SelectorEventLoop는 subprocess를 지원하지 않으므로
    # 전역 policy를 ProactorEventLoop로 변경
    # (set_event_loop은 현재 스레드만 바꾸지만, playwright는 내부에서
    #  asyncio.new_event_loop()를 새로 생성하기 때문에 policy 변경이 필요)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    crawled_at = datetime.now(timezone.utc).isoformat()
    seen_urls: set[str] = set()
    news_rows: list[dict] = []

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )

        logger.info("다음 뉴스 접속 중...")
        page.goto(DAUM_NEWS_URL, wait_until="networkidle", timeout=30000)

        # ── 1단계: 메인 페이지에서 제목 + URL 수집 ──
        for page_num in range(1, TOTAL_PAGES + 1):
            logger.info(f"[{page_num}/{TOTAL_PAGES}] 헤드라인 수집 중...")

            html = page.content()
            items = _parse_headline_items(html)

            new_count = 0
            for item in items:
                if item["url"] in seen_urls:
                    continue
                seen_urls.add(item["url"])
                news_rows.append(
                    {
                        "title": item["title"],
                        "url": item["url"],
                        "content": "",          # 2단계에서 채움
                        "crawled_at": crawled_at,
                    }
                )
                new_count += 1

            logger.info(f"  → 신규 {new_count}건 (누적: {len(news_rows)}건)")

            if page_num < TOTAL_PAGES:
                refresh_btn = _find_refresh_btn(page)
                if refresh_btn:
                    refresh_btn.click()
                    page.wait_for_timeout(2000)
                else:
                    logger.warning(f"새로고침 버튼 없음 → {page_num}페이지에서 수집 종료")
                    break

        # ── 2단계: 각 기사 URL 방문해서 본문 수집 ──
        logger.info(f"기사 본문 수집 시작 (총 {len(news_rows)}건)...")
        for i, row in enumerate(news_rows):
            logger.info(f"  [{i+1}/{len(news_rows)}] {row['url']}")
            row["content"] = _fetch_article_content(page, row["url"])

        browser.close()

    return news_rows, crawled_at


async def crawl_and_replace_news() -> dict:
    """
    ThreadPoolExecutor에서 sync_playwright 크롤링을 실행하고
    news 테이블 전체를 새 데이터로 교체한다.
    (Windows asyncio SelectorEventLoop의 subprocess 제한 우회)
    """
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=1) as pool:
        news_rows, crawled_at = await loop.run_in_executor(pool, _crawl_sync)

    if not news_rows:
        logger.error("수집된 뉴스가 없습니다.")
        return {"success": False, "message": "수집된 뉴스 없음", "count": 0}

    supabase = get_supabase_client()

    # 기존 데이터 전체 삭제
    try:
        supabase.table("news").delete().neq("id", 0).execute()
        logger.info("기존 news 테이블 데이터 삭제 완료")
    except Exception as e:
        logger.error(f"기존 데이터 삭제 실패: {e}")
        return {"success": False, "message": str(e), "count": 0}

    # 새 데이터 삽입
    try:
        supabase.table("news").insert(news_rows).execute()
        logger.info(f"✅ 뉴스 크롤링 완료: 총 {len(news_rows)}건 저장 ({crawled_at})")
    except Exception as e:
        logger.error(f"뉴스 삽입 실패: {e}")
        return {"success": False, "message": str(e), "count": 0}

    return {"success": True, "message": "뉴스 크롤링 완료", "count": len(news_rows)}


def get_news_list(limit: int = 50) -> list[dict]:
    """DB에서 뉴스 목록 조회"""
    supabase = get_supabase_client()
    response = (
        supabase.table("news")
        .select("*")
        .order("crawled_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data
