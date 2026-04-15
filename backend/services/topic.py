import json
import logging
from datetime import datetime, timezone, timedelta
from database import get_supabase_client
from config import settings

logger = logging.getLogger(__name__)

TOPIC_MAX_AGE_DAYS = 7   # 이 기간이 지나야 주제를 교체
CATEGORIES = ["정치", "경제", "사회", "기술", "환경", "국제", "문화"]

# ── 시스템 프롬프트 ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """당신은 최신 뉴스를 누구나 쉽게 이해하고 토론할 수 있는 주제로 변환하는 전문가입니다.

[서비스 목적]
뉴스를 읽어도 무슨 말인지 이해하기 어려운 시사 이슈를,
토론을 통해 쉽고 재미있게 파악할 수 있도록 돕는 것입니다.

[반드시 지켜야 할 규칙]
1. 전문 용어, 어려운 한자어, 법률·경제 용어를 절대 사용하지 마세요.
   나쁜 예: "긴축 통화정책", "탄핵 소추안", "경상수지 흑자"
   좋은 예: "정부가 시중에 돌아다니는 돈을 줄이는 정책",
            "대통령을 자리에서 물러나게 하는 절차",
            "우리나라가 해외에서 벌어들이는 돈이 쓰는 돈보다 많아지는 것"
2. 중학생도 읽으면 바로 이해할 수 있는 쉬운 말로 작성하세요.
3. 두 가지 다른 입장이나 시각으로 나뉠 수 있는 주제를 선택하세요.
   꼭 찬성/반대가 아니어도 됩니다. 예: 미국 입장 vs 이란 입장, 기업 입장 vs 노동자 입장 등.
4. 비슷한 사건을 다루는 뉴스는 반드시 하나의 주제로 묶으세요 (중복 방지).
5. 주제 제목은 두 입장이 맞서는 상황을 잘 드러내는 질문이나 문장으로 만드세요."""

# ── 사용자 프롬프트 템플릿 ───────────────────────────────────────────────────
USER_PROMPT_TEMPLATE = """아래는 오늘의 주요 뉴스 제목 목록입니다.

{titles}

위 뉴스들을 바탕으로, 일반 시민이 쉽게 이해하고 토론할 수 있는 주제를 최대한 많이 만들어주세요.
찬반이 나뉘는 주제라면 빠짐없이 모두 뽑아주세요. 단순 사실 보도처럼 찬반이 없는 뉴스는 제외하세요.

각 주제는 아래 필드를 포함해야 합니다.
- title       : 토론 주제 제목 (40자 이내, 두 입장이 맞서는 상황을 잘 드러내는 표현)
- description : 이 주제가 왜 중요한지, 지금 어떤 상황인지 쉬운 말로 설명 (3문장 이내, 150자 이내)
                ※ 뉴스를 전혀 안 읽은 사람도 이해할 수 있어야 합니다.
- category    : {categories} 중 하나
- side_a      : 한쪽 입장을 대표하는 짧은 이름 (10자 이내, 예: "미국 입장", "기업 편", "찬성 측")
- side_b      : 반대쪽 입장을 대표하는 짧은 이름 (10자 이내, 예: "이란 입장", "노동자 편", "반대 측")

JSON 배열 형식으로만 응답하세요. 코드블록이나 다른 텍스트 없이 배열만 출력하세요.

출력 예시:
[
  {{
    "title": "인공지능이 사람의 일자리를 빼앗아도 괜찮은가?",
    "description": "요즘 AI가 빠르게 발전하면서 많은 직업이 사라질 수 있다는 걱정이 커지고 있어요. 편리해지는 건 좋지만, 일자리를 잃는 사람들은 어떻게 해야 할까요? AI 기술과 사람의 생계 사이에서 우리 사회가 어떤 선택을 해야 할지 이야기해봐요.",
    "category": "기술",
    "side_a": "기술 발전 우선",
    "side_b": "일자리 보호 우선"
  }},
  {{
    "title": "미국의 이란 제재, 과연 옳은 선택인가?",
    "description": "미국이 이란에 강한 경제 제재를 가하고 있어요. 이란은 이를 불공평하다고 반발하고 있고, 두 나라 사이의 갈등이 커지고 있어요. 이 상황에서 누구의 입장이 더 타당한지 함께 이야기해봐요.",
    "category": "국제",
    "side_a": "미국 입장",
    "side_b": "이란 입장"
  }}
]"""


def _is_topics_expired() -> bool:
    """
    discussion_topics 테이블에 데이터가 없거나,
    가장 최근에 생성된 주제가 7일 이상 지났으면 True 반환.
    """
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("discussion_topics")
            .select("created_at")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not response.data:
            logger.info("저장된 토론 주제 없음 → 새로 생성 필요")
            return True

        latest_str = response.data[0]["created_at"]
        # Supabase는 ISO 8601 문자열 반환 (예: "2026-04-08T12:00:00+00:00")
        latest = datetime.fromisoformat(latest_str)
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)

        age = datetime.now(timezone.utc) - latest
        if age >= timedelta(days=TOPIC_MAX_AGE_DAYS):
            logger.info(f"토론 주제 생성 후 {age.days}일 경과 → 교체 필요")
            return True
        else:
            logger.info(f"토론 주제 생성 후 {age.days}일 경과 → 아직 유효 (교체 안 함)")
            return False

    except Exception as e:
        logger.error(f"주제 만료 여부 확인 실패: {e}")
        return True  # 확인 불가 시 재생성


def _get_news_titles() -> list[str]:
    """Supabase news 테이블에서 제목 목록을 가져온다."""
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("news")
            .select("title")
            .order("crawled_at", desc=True)
            .execute()
        )
        titles = [row["title"] for row in response.data if row.get("title")]
        logger.info(f"뉴스 제목 {len(titles)}건 로드 완료")
        return titles
    except Exception as e:
        logger.error(f"뉴스 제목 로드 실패: {e}")
        return []


def _call_gpt(titles: list[str]) -> list[dict]:
    """
    OpenAI GPT에 뉴스 제목 목록을 넘겨 토론 주제 JSON을 받아온다.
    개수 제한 없이 뽑을 수 있는 만큼 최대로 생성.
    """
    from openai import OpenAI

    if not settings.OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY가 설정되지 않았습니다.")
        return []

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    user_prompt = USER_PROMPT_TEMPLATE.format(
        titles=numbered,
        categories=", ".join(CATEGORIES),
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=4000,  # 주제 수 제한 없으므로 넉넉하게
        )
        raw = response.choices[0].message.content.strip()

        # 혹시 코드블록이 포함된 경우 제거
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        topics = json.loads(raw)
        if not isinstance(topics, list):
            raise ValueError("응답이 배열 형식이 아닙니다.")

        logger.info(f"GPT 토론 주제 {len(topics)}개 생성 완료")
        return topics

    except json.JSONDecodeError as e:
        logger.error(f"GPT 응답 JSON 파싱 실패: {e}\n원문: {raw}")
        return []
    except Exception as e:
        logger.error(f"GPT 호출 실패: {e}")
        return []


def _replace_topics(topics: list[dict]) -> int:
    """
    discussion_topics 테이블의 기존 데이터를 전부 지우고
    새 주제를 삽입한다. 저장된 건수를 반환한다.
    """
    supabase = get_supabase_client()

    try:
        supabase.table("discussion_topics").delete().neq("id", 0).execute()
        logger.info("기존 discussion_topics 삭제 완료")
    except Exception as e:
        logger.error(f"기존 토론 주제 삭제 실패: {e}")
        return 0

    rows = []
    for t in topics:
        title = t.get("title", "").strip()
        description = t.get("description", "").strip()
        category = t.get("category", "").strip()

        if not title:
            continue
        if category not in CATEGORIES:
            category = "사회"

        rows.append({
            "title": title,
            "description": description,
            "category": category,
            "side_a": t.get("side_a", "").strip(),
            "side_b": t.get("side_b", "").strip(),
            "views": 0,
            "participants": 0,
            "trending_score": 0.0,
        })

    if not rows:
        logger.warning("저장할 토론 주제가 없습니다.")
        return 0

    try:
        supabase.table("discussion_topics").insert(rows).execute()
        logger.info(f"✅ 토론 주제 {len(rows)}개 저장 완료")
        return len(rows)
    except Exception as e:
        logger.error(f"토론 주제 삽입 실패: {e}")
        return 0


def generate_and_save_topics(force: bool = False) -> dict:
    """
    뉴스 제목 → GPT 토론 주제 생성 → DB 저장 전체 흐름.

    - 마지막 생성 후 7일이 지나지 않았으면 건너뜀 (force=True 시 강제 실행)
    - 뉴스 크롤링 후 자동 호출되거나 수동으로 트리거한다.
    """
    # 1. 만료 여부 확인
    if not force and not _is_topics_expired():
        return {
            "success": True,
            "message": f"토론 주제가 아직 유효합니다 (교체 주기: {TOPIC_MAX_AGE_DAYS}일). 건너뜀.",
            "count": 0,
            "skipped": True,
        }

    # 2. 뉴스 제목 수집
    titles = _get_news_titles()
    if not titles:
        return {"success": False, "message": "뉴스 데이터가 없습니다.", "count": 0}

    # 3. GPT로 주제 생성
    topics = _call_gpt(titles)
    if not topics:
        return {"success": False, "message": "주제 생성 실패", "count": 0}

    # 4. DB 교체
    saved = _replace_topics(topics)
    if saved == 0:
        return {"success": False, "message": "DB 저장 실패", "count": 0}

    return {"success": True, "message": "토론 주제 생성 완료", "count": saved, "skipped": False}
