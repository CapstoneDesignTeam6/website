import asyncio
import logging
import random
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from db import get_supabase_client

# bs4, playwright 는 크롤링 실행 시점에 임포트 (서버 startup 오류 방지)

logger = logging.getLogger(__name__)

DAUM_NEWS_URL = "https://news.daum.net/"

TOTAL_PAGES = 3
DAILY_NEWS_COUNT = 4
RETENTION_DAYS = 7

REFRESH_BTN_SELECTOR = "article.content-article .group_btn a.link_refresh"


def _parse_headline_items(html: str) -> list[dict]:
    """
    HTML 문자열에서 ul.list_newsheadline2 항목을 파싱한다.
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
            return btn
    except Exception:
        pass
    logger.warning("다음 탭 버튼을 찾지 못했습니다.")
    return None


ARTICLE_CONTENT_SELECTORS = [
    "div.article_view",
    "div#mArticle",
    "div.news_view",
    "div#newsct",
    "section.article_body",
]


def _fetch_article_content(page, url: str) -> str:
    """
    기사 URL에 접속해 본문 텍스트를 추출한다.
    타임아웃 발생 시 1회 재시도. 최종 실패 시 빈 문자열 반환.
    """
    for attempt in range(2):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)

            for selector in ARTICLE_CONTENT_SELECTORS:
                el = page.locator(selector).first
                if el.count() > 0:
                    text = el.inner_text().strip()
                    if text:
                        return text

            logger.warning(f"본문 셀렉터 미매칭: {url}")
            return ""
        except Exception as e:
            if attempt == 0:
                logger.warning(f"본문 수집 재시도 중 ({url}): {e}")
                page.wait_for_timeout(3000)
                continue
            logger.warning(f"본문 수집 최종 실패 ({url}): {e}")
            return ""
    return ""


def _crawl_sync() -> tuple[list[dict], str]:
    """
    sync_playwright로 다음 뉴스 헤드라인을 수집하고
    랜덤으로 DAILY_NEWS_COUNT개를 선택해 본문까지 수집한다.
    """
    import sys

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    crawled_at = datetime.now(timezone.utc).isoformat()
    seen_urls: set[str] = set()
    all_items: list[dict] = []

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
                all_items.append(item)
                new_count += 1

            logger.info(f"  → 신규 {new_count}건 (누적: {len(all_items)}건)")

            if page_num < TOTAL_PAGES:
                refresh_btn = _find_refresh_btn(page)
                if refresh_btn:
                    refresh_btn.click()
                    page.wait_for_timeout(2000)
                else:
                    logger.warning(f"새로고침 버튼 없음 → {page_num}페이지에서 수집 종료")
                    break

        # ── 2단계: 랜덤으로 DAILY_NEWS_COUNT개 선택 ──
        pick_count = min(DAILY_NEWS_COUNT, len(all_items))
        selected_items = random.sample(all_items, pick_count)
        logger.info(f"랜덤 선택: {pick_count}건 / 전체 {len(all_items)}건")

        # ── 3단계: 선택된 기사만 본문 수집 ──
        news_rows: list[dict] = []
        for i, item in enumerate(selected_items):
            logger.info(f"  [{i+1}/{pick_count}] 본문 수집: {item['url']}")
            content = _fetch_article_content(page, item["url"])
            news_rows.append(
                {
                    "title": item["title"],
                    "url": item["url"],
                    "content": content,
                    "crawled_at": crawled_at,
                }
            )

        browser.close()

    return news_rows, crawled_at


def is_news_expired() -> bool:
    """최근 크롤링이 하루 이상 지났거나 데이터가 없으면 True."""
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("news")
            .select("crawled_at")
            .order("crawled_at", desc=True)
            .limit(1)
            .execute()
        )
        if not response.data:
            return True
        latest_str = response.data[0]["crawled_at"]
        latest = datetime.fromisoformat(latest_str)
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - latest
        if age >= timedelta(days=1):
            logger.info(f"뉴스 마지막 크롤링 후 {age.seconds//3600}시간 경과 → 갱신 필요")
            return True
        logger.info(f"뉴스 마지막 크롤링 후 {age.seconds//3600}시간 경과 → 아직 유효")
        return False
    except Exception as e:
        logger.error(f"뉴스 만료 여부 확인 실패: {e}")
        return True


async def crawl_and_replace_news() -> dict:
    """
    ThreadPoolExecutor에서 sync_playwright 크롤링을 실행하고
    7일 초과 뉴스를 삭제한 뒤 오늘 수집한 4건을 누적 삽입한다.
    """
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=1) as pool:
        news_rows, crawled_at = await loop.run_in_executor(pool, _crawl_sync)

    if not news_rows:
        logger.error("수집된 뉴스가 없습니다.")
        return {"success": False, "message": "수집된 뉴스 없음", "count": 0}

    supabase = get_supabase_client()

    # 7일 초과 데이터 삭제
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).isoformat()
    try:
        supabase.table("news").delete().lt("crawled_at", cutoff).execute()
        logger.info(f"7일 초과 뉴스 삭제 완료 (기준: {cutoff})")
    except Exception as e:
        logger.error(f"오래된 뉴스 삭제 실패: {e}")

    # 기존 URL 조회 (중복 삽입 방지)
    existing_urls: set[str] = set()
    try:
        resp = supabase.table("news").select("url").execute()
        existing_urls = {row["url"] for row in resp.data}
    except Exception as e:
        logger.warning(f"기존 URL 조회 실패 (중복 체크 건너뜀): {e}")

    new_rows = [row for row in news_rows if row["url"] not in existing_urls]

    if not new_rows:
        logger.info("수집된 뉴스가 모두 중복입니다. 추가 없음.")
        return {"success": True, "message": "중복 뉴스로 추가 없음", "count": 0}

    # 새 데이터 누적 삽입
    try:
        supabase.table("news").insert(new_rows).execute()
        logger.info(f"뉴스 크롤링 완료: {len(new_rows)}건 저장 ({crawled_at})")
    except Exception as e:
        logger.error(f"뉴스 삽입 실패: {e}")
        return {"success": False, "message": str(e), "count": 0}

    return {"success": True, "message": "뉴스 크롤링 완료", "count": len(new_rows)}


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
