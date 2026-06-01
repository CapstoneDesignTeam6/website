"""
Render Cron Job 진입점 — 토론 주제 생성 (주 1회).

스케줄 자체가 주기를 통제하므로 force=True로 항상 새로 생성한다.

실행 커맨드(Render Cron Job Command):  python cron_generate_topics.py
스케줄 예시(UTC): "0 15 * * 0"  ← 한국시간(KST) 매주 월요일 00:00
  (일요일 15:00 UTC = 월요일 00:00 KST. 요일은 원하는 날로 조정)
"""
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("cron_generate_topics")


def main() -> None:
    from topic import generate_and_save_topics
    logger.info("💬 [cron] 토론 주제 생성 시작...")
    result = generate_and_save_topics(force=True)
    logger.info(f"✅ [cron] 토론 주제 생성 완료: {result}")


if __name__ == "__main__":
    main()
