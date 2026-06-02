"""
services/summary_service.py

SummaryAgent 로직을 GPT + TavilyClient 기반으로 재구현.
discussion_turns에서 history를 복원해 최종 토론 요약/피드백 생성.
DiscussionSummaryResponse 형식으로 반환.
"""

import re
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ── GPT 호출 ──────────────────────────────────────────────────────────────────

def _call_gpt(prompt: str, system: str = "", max_tokens: int = 1000) -> str:
    from services.vertex_llm import call_llm
    return call_llm(prompt, system=system, max_tokens=max_tokens, temperature=0.5)


# ── Tavily 검색 ────────────────────────────────────────────────────────────────

def _tavily_search(queries: list[str], max_results: int = 2) -> list[dict]:
    results = []
    try:
        from tavily import TavilyClient
        from config import settings
        import os
        client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))
        for q in queries[:3]:
            try:
                resp = client.search(q, max_results=max_results)
                for r in resp.get("results", []):
                    r["query"] = q
                    results.append(r)
            except Exception as e:
                logger.warning(f"[SummaryService] Tavily 검색 실패: {e}")
    except Exception as e:
        logger.warning(f"[SummaryService] TavilyClient 초기화 실패: {e}")
    return results


# ── Supabase 조회 ──────────────────────────────────────────────────────────────

def _fetch_turns(discussion_id: int) -> list[dict]:
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_turns")
            .select("turn_number, user_message, ai_summary")
            .eq("discussion_id", discussion_id)
            .order("turn_number", desc=False)
            .execute()
            .data
        ) or []
        return rows
    except Exception as e:
        logger.error(f"[SummaryService] Supabase 조회 실패: {e}")
        return []


def _build_history(turns: list[dict]) -> list[dict]:
    history = []
    for t in turns:
        if t.get("user_message"):
            history.append({"role": "user", "content": t["user_message"]})
        if t.get("ai_summary"):
            history.append({"role": "ai", "content": t["ai_summary"]})
    return history


def _build_history_block(history: list[dict]) -> str:
    lines = []
    for h in history:
        role = "AI" if h["role"] == "ai" else "유저"
        lines.append(f"[{role}] {h['content']}")
    return "\n".join(lines)


# ── 무효 발언 필터 ─────────────────────────────────────────────────────────────

def _filter_invalid_turns(history: list[dict], topic: str) -> tuple[list[str], str]:
    user_turns = [
        {"turn": i + 1, "content": h["content"]}
        for i, h in enumerate(h for h in history if h["role"] == "user")
    ]
    if not user_turns:
        return [], _build_history_block(history)

    turns_block = "\n".join(
        f"[유저 발언 {t['turn']}번째] {t['content']}" for t in user_turns
    )
    raw = _call_gpt(
        f"토론 주제: {topic}\n\n{turns_block}",
        system=(
            "당신은 토론 심판입니다. 아래 유저 발언들이 토론 주제와 관련된 논거를 포함하는지 판단하세요.\n"
            "무효 발언(감탄사·일상대화·주제 무관·단순 감정)이 있으면 번호를 JSON 배열로, 없으면 []만 출력."
        ),
        max_tokens=100,
    )

    invalid_contents: list[str] = []
    clean_history = history[:]
    try:
        match = re.search(r"\[.*?\]", raw, re.DOTALL)
        if match:
            invalid_nums = set(json.loads(match.group()))
            invalid_set = {t["content"] for t in user_turns if t["turn"] in invalid_nums}
            invalid_contents = list(invalid_set)
            clean_history = [h for h in history if not (h["role"] == "user" and h["content"] in invalid_set)]
    except Exception:
        pass

    return invalid_contents, _build_history_block(clean_history)


# ── 단계별 요약 생성 ───────────────────────────────────────────────────────────

def _extract_claims(history_block: str) -> str:
    return _call_gpt(
        f"토론 기록:\n{history_block}",
        system=(
            "토론 기록에서 각 측 발언을 문장 단위로 그대로 복사하세요. "
            "절대 요약·추측·추가·창작 금지. 있는 문장만 그대로.\n\n"
            "[유저]\n(유저 발언에서 주장·근거 문장을 그대로 복사)\n\n"
            "[AI]\n(AI 발언에서 주장·근거 문장을 그대로 복사)"
        ),
        max_tokens=800,
    )


def _structure_issues(extracted: str) -> str:
    return _call_gpt(
        f"추출된 발언:\n{extracted}",
        system=(
            "추출된 발언을 읽고 양측이 실제로 충돌한 핵심 논점 2~3개를 파악하세요.\n"
            "새로운 내용 추가 절대 금지.\n\n"
            "[핵심 논점]\n논점1: (한 줄)\n논점2: (한 줄)\n\n"
            "[유저 핵심 주장]\n(추출 발언 기반 2~3개)\n\n"
            "[AI 핵심 주장]\n(추출 발언 기반 2~3개)"
        ),
        max_tokens=400,
    )


def _polish_summary(extracted: str, structured: str, invalid_contents: list[str]) -> str:
    invalid_note = ""
    if invalid_contents:
        previews = [f'"{c.strip()[:15]}..."' for c in invalid_contents]
        invalid_note = f"\n\n[참고] {', '.join(previews)} 같은 발언은 토론 논거로 보기 어려워 요약에서 제외했어요."

    raw = _call_gpt(
        f"추출된 발언:\n{extracted}\n\n논점 구조:\n{structured}",
        system=(
            "당신은 시사 토론 해설자입니다. 추출된 발언과 논점 구조를 바탕으로 토론 요약문을 작성하세요.\n"
            "- 추출된 발언에 있는 내용만 사용. 새로운 사실·수치 추가 절대 금지.\n"
            "- 추측·단정 표현 금지. '~라고 주장했습니다' 같은 인용 형식 사용.\n"
            "- 각 측 문단 200~350자.\n\n"
            "[유저]\n(서술형 문단)\n\n[AI]\n(서술형 문단)"
        ),
        max_tokens=700,
    )
    return raw.strip() + invalid_note


def _generate_feedback(
    history_block: str, topic: str, summary_context: str, turns: int
) -> str:
    # 1단계: 기본 피드백
    feedback = _call_gpt(
        f"주제: {topic}\n\n토론 요약:\n{summary_context}\n\n전체 토론 기록:\n{history_block}",
        system=(
            f"당신은 시사 토론 코치입니다. 유저({turns}라운드)의 논증에서 "
            "강했던 점 1가지, 보완이 필요한 논리 구조 1가지를 200자 이내로.\n"
            "한 문단만. 제목·번호·불릿 없이 바로 본문."
        ),
        max_tokens=300,
    ).strip()

    # 2단계: Tavily 검색으로 보완
    queries_raw = _call_gpt(
        f"Debate topic: {topic}\nLogic feedback: {feedback}",
        system=(
            "Generate 3 English search queries to find real case studies or statistics "
            "related to the logical weakness in the feedback. "
            "Output ONLY a JSON array of 3 strings."
        ),
        max_tokens=150,
    )
    try:
        match = re.search(r"\[.*?\]", queries_raw, re.DOTALL)
        queries = json.loads(match.group()) if match else []
        queries = [q for q in queries if isinstance(q, str)][:3]
    except Exception:
        queries = []

    if not queries:
        return feedback

    print(f"🌐 [Summary] 피드백 보완 검색 {len(queries)}건 수행")
    search_results = _tavily_search(queries)
    print(f"🌐 [Summary] 검색 결과 {len(search_results)}건 수집")
    if not search_results:
        return feedback

    results_block = "\n\n".join(
        f"[검색결과] 쿼리: {r.get('query','')}\n제목: {r.get('title','')}\n"
        f"출처: {r.get('url','')}\n내용: {(r.get('content') or '')[:400]}"
        for r in search_results[:5]
    )

    supplement = _call_gpt(
        f"논리 피드백:\n{feedback}\n\n전체 토론 기록 (중복 금지):\n{history_block}\n\nTavily 검색결과:\n{results_block}",
        system=(
            "논리 피드백의 보완 포인트를 검색결과의 실제 사례·수치로 뒷받침하세요. "
            "토론 기록에서 이미 언급된 사례 반복 금지. 확인되지 않은 수치 금지. "
            "200자 이내, 2~3문장, 번호·불릿 없이 바로 본문만 출력."
        ),
        max_tokens=300,
    ).strip()

    return f"{feedback}\n\n{supplement}" if supplement else feedback


# ── 공개 API ───────────────────────────────────────────────────────────────────

def get_summary(discussion_id: int, topic: str) -> dict:
    """
    토론 최종 요약 및 피드백 생성.
    Returns: DiscussionSummaryResponse 형식
      {summary, issues, logic_feedback, extra_info}
    """
    print(f"📝 [Summary] 요약 시작 | discussion_id={discussion_id} | topic={topic}")
    turns = _fetch_turns(discussion_id)
    history = _build_history(turns)
    print(f"📝 [Summary] 턴 {len(turns)}개 로드 (history {len(history)}개)")

    if not history:
        print("⚠️ [Summary] 토론 기록 없음 → 빈 요약 반환")
        return {
            "summary": "토론 기록을 찾을 수 없습니다.",
            "issues": "",
            "logic_feedback": "",
            "extra_info": "",
        }

    history_block = _build_history_block(history)
    user_turn_count = sum(1 for h in history if h["role"] == "user")

    # 1. 무효 발언 필터
    invalid_contents, clean_history_block = _filter_invalid_turns(history, topic)
    print(f"🔎 [Summary] 무효 발언 필터 완료 (제외 {len(invalid_contents)}건)")

    # 2. 발언 추출
    extracted = _extract_claims(clean_history_block)
    print(f"📤 [Summary] 발언 추출 완료 ({len(extracted)}자)")

    # 3. 핵심 논점 구조화
    structured = _structure_issues(extracted)
    print(f"🧩 [Summary] 핵심 논점 구조화 완료 ({len(structured)}자)")

    # 4. 서술형 요약
    summary = _polish_summary(extracted, structured, invalid_contents)
    print(f"✍️ [Summary] 서술형 요약 완료 ({len(summary)}자)")

    # 5. 논리 피드백 + 검색 보완
    logic_feedback = _generate_feedback(clean_history_block, topic, summary, user_turn_count)
    print(f"💬 [Summary] 논리 피드백 완료 ({len(logic_feedback)}자)")

    # extra_info: 무효 발언 메모
    extra_info = ""
    if invalid_contents:
        extra_info = f"무효 발언 {len(invalid_contents)}건이 요약에서 제외됐습니다."

    result = {
        "summary": summary,
        "issues": structured,
        "logic_feedback": logic_feedback,
        "extra_info": extra_info,
    }

    # 요약·피드백을 discussion_sessions에 저장 (세션당 1개, id=discussion_id로 UPDATE)
    if discussion_id:
        try:
            from database import get_supabase_client
            sb = get_supabase_client()
            sb.table("discussion_sessions").update({
                "summary_report": result,
            }).eq("id", discussion_id).execute()
            print(f"💾 [Summary] 요약·피드백 DB 저장 완료 (discussion_id={discussion_id})")
        except Exception as e:
            print(f"⚠️ [Summary] 요약 DB 저장 실패: {e}")

    print(f"✅ [Summary] 요약 생성 완료 (discussion_id={discussion_id})")
    return result
