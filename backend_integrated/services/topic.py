import json
import logging
import vertexai
from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage
from datetime import datetime, timezone, timedelta
from database import get_supabase_client

logger = logging.getLogger(__name__)

TOPIC_MAX_AGE_DAYS = 7
CATEGORIES = ["정치", "경제", "사회", "기술", "환경", "국제", "문화"]

MODEL_ID   = "gemini-2.5-flash"
PROJECT_ID = "project-8dcb485c-620f-47a6-bc5"
LOCATION   = "us-central1"

vertexai.init(project=PROJECT_ID, location=LOCATION)

llm = ChatVertexAI(
    model_name=MODEL_ID,
    temperature=0.2,
    max_output_tokens=8192,
)

# ── 시스템 프롬프트 ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """당신은 최신 뉴스를 누구나 쉽게 이해하고 토론할 수 있는 주제로 변환하는 전문가입니다.

[서비스 목적]
뉴스를 읽어도 무슨 말인지 이해하기 어려운 시사 이슈를,
토론을 통해 쉽고 재미있게 파악할 수 있도록 돕는 것입니다.

[반드시 지켜야 할 규칙]
1. 전문 용어, 어려운 한자어, 법률이나 경제 용어를 절대 사용하지 마세요.
   나쁜 예: "긴축 통화정책", "탄핵 소추안", "경상수지 흑자"
   좋은 예: "정부가 시중에 돌아다니는 돈을 줄이는 정책은 과연 시민의 질 향상에 도움이 될까요?",
            "우리나라 사람들이 해외 여행을 많이 가는 것은 좋은 현상일까요?"
2. 중학생도 읽으면 바로 이해할 수 있는 쉬운 말로 작성하세요.
3. 두 가지 다른 입장이나 시각으로 나뉠 수 있는 주제를 선택하세요.
   꼭 찬성/반대가 아니어도 됩니다. 예: 미국 입장 vs 이란 입장, 기업 입장 vs 노동자 입장 등.
4. 비슷한 사건을 다루는 뉴스는 반드시 하나의 주제로 묶으세요 (중복 방지).
5. 주제 제목은 두 입장이 맞서는 상황을 잘 드러내는 질문이나 문장으로 만드세요.
6. [절대 금지 — 실명/정치인 언급 금지]
   특정 정치인, 공직자, 유명인의 실명을 제목·설명 어디에도 넣지 마세요.
   나쁜 예: "이재명의 정책이 옳은가?", "윤석열 대통령의 결정은 잘못인가?"
   좋은 예: "정부의 이번 노란봉투법은 노동자에게 도움이 될까요?", "북한의 이번 미사일 발사에 대해 강경한 입장은 도움 될까요?"
7. [절대 금지 — 민감 주제 제외]
   아래 유형의 주제는 절대 생성하지 마세요:
   - 특정 종교를 비판하거나 종교 간 우열을 가리는 주제
   - 지역 감정을 자극하거나 특정 지역을 비하하는 주제
   - 성별·나이·인종·장애 등 차별을 조장할 수 있는 주제
   - 성적 콘텐츠, 폭력, 자살·자해를 다루는 주제
   - 특정 기업·제품을 비교하거나 광고처럼 보일 수 있는 주제"""

# ── 사용자 프롬프트 템플릿 ────────────────────────────────────────────────────
USER_PROMPT_TEMPLATE = """아래는 오늘의 주요 뉴스 제목과 내용 목록입니다.

{titles}

위 뉴스들을 바탕으로, 일반 시민이 쉽게 이해하고 토론할 수 있는 주제를 1개 만들어주세요.

각 주제는 아래 필드를 포함해야 합니다.
- description    : 이 주제가 왜 중요한지, 지금 어떤 상황인지 쉬운 말로 설명 (3문장 이내, 150자 이내)
                   ※ 뉴스를 전혀 안 읽은 사람도 이해할 수 있어야 합니다.
- category       : {categories} 중 하나
- side_a         : 한쪽 입장을 대표하는 짧은 이름 (10자 이내, 예: "미국 입장", "기업 편", "찬성 측")
- side_b         : 반대쪽 입장을 대표하는 짧은 이름 (10자 이내, 예: "이란 입장", "노동자 편", "반대 측")
- source_indices : 이 주제를 만드는 데 참고한 뉴스 번호 목록 (예: [1, 3, 5])
- title          : 토론 주제 제목 (40자 이내, 질문이나 side_a, side_b의 대립이 잘 드러나는 문장)
JSON 배열 형식으로만 응답하세요. 코드블록이나 다른 텍스트 없이 배열만 출력하세요.

출력 예시:
[
  {{
    "title": "미국의 이란 제재, 누가 더 손해보는가?",
    "description": "미국이 이란에 강한 경제 제재를 가하고 있어요. 이란은 이를 불공평하다고 반발하고 있고, 두 나라 사이의 갈등이 커지고 있어요. 이 상황에서 누구의 입장이 더 타당한지 함께 이야기해봐요.",
    "category": "국제",
    "side_a": "미국 입장",
    "side_b": "이란 입장",
    "source_indices": [4]
  }}
]"""


def _is_topics_expired() -> bool:
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
        return True


MAX_NEWS = 30  # 주제 생성에 사용할 최신 뉴스 최대 건수

def _get_news_data() -> list[dict]:
    """Supabase news 테이블에서 최신 뉴스 상위 MAX_NEWS건을 가져온다."""
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("news")
            .select("title, url, content")
            .order("crawled_at", desc=True)
            .limit(MAX_NEWS)
            .execute()
        )
        data = [
            {"title": r["title"], "url": r["url"], "content": r.get("content", "")}
            for r in response.data if r.get("title")
        ]
        logger.info(f"뉴스 데이터 {len(data)}건 로드 완료")
        return data
    except Exception as e:
        logger.error(f"뉴스 데이터 로드 실패: {e}")
        return []


def _call_llm(news_data: list[dict]) -> list[dict]:
    """Vertex AI Gemini에 뉴스 배치를 넘겨 토론 주제 1개를 생성한다."""
    url_map = {i + 1: d.get("url", "") for i, d in enumerate(news_data)}

    numbered = "\n".join(
        f"{i+1}. [제목] {d['title']}\n   [내용] {d.get('content', '')}"
        for i, d in enumerate(news_data)
    )
    user_prompt = USER_PROMPT_TEMPLATE.format(
        titles=numbered,
        categories=", ".join(CATEGORIES),
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]

    try:
        response = llm.invoke(messages)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        topics = json.loads(raw)
        if not isinstance(topics, list):
            raise ValueError("응답이 배열 형식이 아닙니다.")

        for topic in topics:
            indices = topic.pop("source_indices", [])
            topic["related_news"] = [url_map[i] for i in indices if i in url_map]

        return topics

    except json.JSONDecodeError as e:
        logger.error(f"Gemini 응답 JSON 파싱 실패: {e}")
        return []
    except Exception as e:
        logger.error(f"Gemini 호출 실패: {e}")
        return []


def _replace_topics(topics: list[dict]) -> int:
    supabase = get_supabase_client()

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
            "related_news": t.get("related_news", []),
            "participants": 0,
        })

    if not rows:
        logger.warning("저장할 토론 주제가 없습니다.")
        return 0

    # 기존 ID 목록 저장
    try:
        existing = supabase.table("discussion_topics").select("id").execute()
        old_ids = [r["id"] for r in existing.data]
    except Exception as e:
        logger.error(f"기존 ID 조회 실패: {e}")
        old_ids = []

    # 삽입 먼저 시도 — 성공한 경우에만 기존 데이터 삭제
    try:
        supabase.table("discussion_topics").insert(rows).execute()
    except Exception as e:
        logger.error(f"토론 주제 삽입 실패 — 기존 데이터 유지: {e}")
        return 0

    # 기존 ID만 삭제 (새로 삽입된 행은 건드리지 않음)
    if old_ids:
        try:
            supabase.table("discussion_topics").delete().in_("id", old_ids).execute()
            logger.info("기존 discussion_topics 삭제 완료")
        except Exception as e:
            logger.error(f"기존 토론 주제 삭제 실패: {e}")

    logger.info(f"✅ 토론 주제 {len(rows)}개 저장 완료")
    return len(rows)


def generate_and_save_topics(force: bool = False) -> dict:
    """뉴스를 10개 청크로 나눠 Gemini를 10번 호출해 토론 주제 10개를 생성·저장한다."""
    if not force and not _is_topics_expired():
        return {
            "success": True,
            "message": f"토론 주제가 아직 유효합니다 (교체 주기: {TOPIC_MAX_AGE_DAYS}일). 건너뜀.",
            "count": 0,
            "skipped": True,
        }

    news_data = _get_news_data()
    if not news_data:
        return {"success": False, "message": "뉴스 데이터가 없습니다.", "count": 0}

    topics = []
    for idx, article in enumerate(news_data, start=1):
        logger.info(f"Gemini 호출 {idx}/{len(news_data)}")
        result = _call_llm([article])
        topics.extend(result)

    if not topics:
        return {"success": False, "message": "주제 생성 실패", "count": 0}

    saved = _replace_topics(topics)
    if saved == 0:
        return {"success": False, "message": "DB 저장 실패", "count": 0}

    return {"success": True, "message": "토론 주제 생성 완료", "count": saved, "skipped": False}
