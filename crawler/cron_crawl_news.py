"""
Render Cron Job 진입점 — 뉴스 크롤링 (매일).

웹 서비스 메모리(512MB)를 아끼기 위해 무거운 Playwright(Chromium) 크롤링을
별도 Cron 인스턴스에서 실행한다. 실행 후 프로세스는 종료된다.

실행 커맨드(Render Cron Job Command):  python cron_crawl_news.py
스케줄 예시(UTC): "0 15 * * *"  ← 한국시간(KST) 매일 00:00 (KST = UTC+9)
"""
import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("cron_crawl_news")


async def main() -> None:
    # 웹 서비스와 동일한 로직 재사용
    from news import crawl_and_replace_news
    logger.info("🔄 [cron] 뉴스 크롤링 시작...")
    result = await crawl_and_replace_news()
    logger.info(f"✅ [cron] 뉴스 크롤링 완료: {result}")


if __name__ == "__main__":
    asyncio.run(main())
