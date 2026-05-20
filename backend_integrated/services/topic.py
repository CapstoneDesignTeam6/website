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
5. 주제 제목은 두 입장이 맞서는 상황을 잘 드러내는 질문이나 문장으로 만드세요.
6. [절대 금지 — 실명/정치인 언급 금지]
   특정 정치인, 공직자, 유명인의 실명을 제목·설명 어디에도 넣지 마세요.
   나쁜 예: "이재명의 정책이 옳은가?", "윤석열 대통령의 결정은 잘못인가?"
   좋은 예: "정부의 경제 정책 방향이 옳은가?", "대통령의 결정, 국민에게 득인가 실인가?"
   사람 이름이 필요한 경우 직위나 역할로 대체하세요 (예: "여당 지도부", "현 정부", "야당").
7. [절대 금지 — 민감 주제 제외]
   아래 유형의 주제는 절대 생성하지 마세요:
   - 특정 종교를 비판하거나 종교 간 우열을 가리는 주제
   - 지역 감정을 자극하거나 특정 지역을 비하하는 주제
   - 성별·나이·인종·장애 등 차별을 조장할 수 있는 주제
   - 성적 콘텐츠, 폭력, 자살·자해를 다루는 주제
   - 특정 기업·제품을 비교하거나 광고처럼 보일 수 있는 주제"""

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
- side_a         : 한쪽 입장을 대표하는 짧은 이름 (10자 이내, 예: "미국 입장", "기업 편", "찬성 측")
- side_b         : 반대쪽 입장을 대표하는 짧은 이름 (10자 이내, 예: "이란 입장", "노동자 편", "반대 측")
- source_indices : 이 주제를 만드는 데 참고한 뉴스 번호 목록 (예: [1, 3, 5])

JSON 배열 형식으로만 응답하세요. 코드블록이나 다른 텍스트 없이 배열만 출력하세요.

출력 예시:
[
  {{
    "title": "인공지능이 사람의 일자리를 빼앗아도 괜찮은가?",
    "description": "요즘 AI가 빠르게 발전하면서 많은 직업이 사라질 수 있다는 걱정이 커지고 있어요. 편리해지는 건 좋지만, 일자리를 잃는 사람들은 어떻게 해야 할까요? AI 기술과 사람의 생계 사이에서 우리 사회가 어떤 선택을 해야 할지 이야기해봐요.",
    "category": "기술",
    "side_a": "기술 발전 우선",
    "side_b": "일자리 보호 우선",
    "source_indices": [2, 7, 11]
  }},
  {{
    "title": "미국의 이란 제재, 과연 옳은 선택인가?",
    "description": "미국이 이란에 강한 경제 제재를 가하고 있어요. 이란은 이를 불공평하다고 반발하고 있고, 두 나라 사이의 갈등이 커지고 있어요. 이 상황에서 누구의 입장이 더 타당한지 함께 이야기해봐요.",
    "category": "국제",
    "side_a": "미국 입장",
    "side_b": "이란 입장",
    "source_indices": [4]
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


def _get_news_data() -> list[dict]:
    """Supabase news 테이블에서 제목과 URL 목록을 가져온다."""
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("news")
            .select("title, url")
            .order("crawled_at", desc=True)
            .execute()
        )
        data = [{"title": r["title"], "url": r["url"]} for r in response.data if r.get("title")]
        logger.info(f"뉴스 데이터 {len(data)}건 로드 완료")
        return data
    except Exception as e:
        logger.error(f"뉴스 데이터 로드 실패: {e}")
        return []


def _call_gpt(news_data: list[dict]) -> list[dict]:
    """
    OpenAI GPT에 뉴스 제목 목록을 넘겨 토론 주제 JSON을 받아온다.
    각 주제에 source_indices를 요청하고, 이를 실제 URL로 변환해 related_news에 저장한다.
    """
    from openai import OpenAI

    if not settings.OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY가 설정되지 않았습니다.")
        return []

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # 1-based 인덱스 → URL 매핑
    url_map = {i + 1: d["url"] for i, d in enumerate(news_data)}

    numbered = "\n".join(f"{i+1}. {d['title']}" for i, d in enumerate(news_data))
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
            max_tokens=8000,
        )
        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        topics = json.loads(raw)
        if not isinstance(topics, list):
            raise ValueError("응답이 배열 형식이 아닙니다.")

        # source_indices → related_news URL 변환
        for topic in topics:
            indices = topic.pop("source_indices", [])
            topic["related_news"] = [url_map[i] for i in indices if i in url_map]

        logger.info(f"GPT 토론 주제 {len(topics)}개 생성 완료")
        return topics

    except json.JSONDecodeError as e:
        logger.error(f"GPT 응답 JSON 파싱 실패: {e}\n원문: {raw}")
        return []
    except Exception as e:
        logger.error(f"GPT 호출 실패: {e}")
        return []


def _validate_topic(topic: dict) -> tuple[bool, str]:
    """
    GPT-4o-mini로 단일 주제가 안전한지 검수한다.
    Returns (is_safe, reason).
    """
    from openai import OpenAI
    from config import settings

    if not settings.OPENAI_API_KEY:
        return True, "API 키 없음 — 검수 생략"

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    title = topic.get("title", "")
    description = topic.get("description", "")

    system = (
        "당신은 토론 플랫폼의 콘텐츠 안전 검수 담당자입니다. "
        "아래 토론 주제가 다음 조건 중 하나라도 해당하면 'BLOCK'이라고만 답하고, "
        "모두 안전하면 'OK'라고만 답하세요.\n"
        "차단 조건:\n"
        "1. 제목이나 설명에 특정 정치인·공직자·유명인의 실명이 포함된 경우\n"
        "2. 특정 종교를 비판하거나 종교 간 우열을 가리는 경우\n"
        "3. 지역 감정 자극 또는 특정 지역 비하\n"
        "4. 성별·나이·인종·장애 차별 조장\n"
        "5. 성적 콘텐츠·폭력·자살·자해 관련\n"
        "6. 특정 기업·제품 광고성 비교"
    )
    user = f"제목: {title}\n설명: {description}"

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0,
            max_tokens=10,
        )
        answer = resp.choices[0].message.content.strip().upper()
        if "BLOCK" in answer:
            return False, f"콘텐츠 안전 검수 실패: {title}"
        return True, "OK"
    except Exception as e:
        logger.warning(f"검수 GPT 호출 실패 ({title}): {e} — 통과 처리")
        return True, "검수 오류 — 통과"


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
    blocked_count = 0
    for t in topics:
        title = t.get("title", "").strip()
        description = t.get("description", "").strip()
        category = t.get("category", "").strip()

        if not title:
            continue
        if category not in CATEGORIES:
            category = "사회"

        is_safe, reason = _validate_topic(t)
        if not is_safe:
            logger.warning(f"⚠️ 주제 차단됨: {reason}")
            blocked_count += 1
            continue

        rows.append({
            "title": title,
            "description": description,
            "category": category,
            "side_a": t.get("side_a", "").strip(),
            "side_b": t.get("side_b", "").strip(),
            "related_news": t.get("related_news", []),
            "views": 0,
            "participants": 0,
            "trending_score": 0.0,
        })

    if blocked_count:
        logger.info(f"총 {blocked_count}개 주제 차단됨")

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

    # 2. 뉴스 데이터 수집 (제목 + URL)
    news_data = _get_news_data()
    if not news_data:
        return {"success": False, "message": "뉴스 데이터가 없습니다.", "count": 0}

    # 3. GPT로 주제 생성
    topics = _call_gpt(news_data)
    if not topics:
        return {"success": False, "message": "주제 생성 실패", "count": 0}

    # 4. DB 교체
    saved = _replace_topics(topics)
    if saved == 0:
        return {"success": False, "message": "DB 저장 실패", "count": 0}

    return {"success": True, "message": "토론 주제 생성 완료", "count": saved, "skipped": False}
