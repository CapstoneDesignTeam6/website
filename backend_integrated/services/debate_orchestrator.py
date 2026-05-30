import os
os.environ['TAVILY_API_KEY'] = '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'
import json
import os
import datetime

import vertexai
from langchain_google_vertexai import ChatVertexAI
from langchain_tavily import TavilySearch
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.messages import HumanMessage, SystemMessage

MODEL_ID = 'gemini-2.5-pro'
PROJECT_ID = "project-8dcb485c-620f-47a6-bc5"
#LOCATION = "us-central1"
LOCATION = "global"
vertexai.init(project=PROJECT_ID, location=LOCATION)

llm = ChatVertexAI(
    model_name=MODEL_ID,
    project=PROJECT_ID,
    location=LOCATION,
    temperature=0.3
)

search_tool = TavilySearch(max_results=1,topic='news')
current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

global topic, user_input

info_query_prompt = ChatPromptTemplate.from_template("""
당신은 **문제 이해 및 자료탐색 에이전트**입니다.
[지시사항]을 분석하여, 사용자의 주장을 뒷받침하거나 반박할 수 있는 정교한 검색 쿼리 **2**개를 생성하십시오.


**[오케스트레이터 지시사항]**
"{instruction}"

**[분석 및 쿼리 생성 가이드]**
1. 주장 기반 쟁점 추출:
   지시사항에서 핵심 주장과 그 근거 방향(예: 환경 파괴)을 식별하고,
   해당 주장을 뒷받침하거나 검증할 수 있는 구체적인 탐색 방향을 설정하십시오.

2. 쟁점 세분화:
   instruction에 포함된 키워드를 중심으로,
   이를 하위 문제(원인, 영향, 사례, 메커니즘 등)로 확장하여
   구체적인 검색 쿼리로 분해하십시오.
   (예: 환경 영향 → 폐기물, 열오염, 생태계 변화 등)

3. 근거 중심 탐색:
   단순 설명이 아닌, 다음을 포함할 가능성이 높은 쿼리를 생성하십시오:
   - 실제 사례 (지역, 사건, 국가)
   - 수치/통계 데이터
   - 과학적 연구 또는 기관 보고서

4. 검색 최적화:
   영어 기반 검색에 적합하도록,
   핵심 키워드를 명확하게 포함하고
   불필요한 자연어 문장을 줄이십시오.


**[반드시 아래 JSON 형식을 지켜주세요]**
{{
    "analysis_focus": "오케스트레이터의 지시 중 집중적으로 조사할 핵심 포인트 (한글)",
    "queries": [
        {{
            "category": "분류 (예: 생태계 영향, 방사성 폐기물, 사례 연구 등)",
            "query": "English Search Query",
            "reasoning": "이 쿼리가 사용자의 주장을 어떻게 뒷받침하는가 (한글)"
        }}
    ]
}}

주제: "{topic}"
결과:
""")

# ── 인메모리 스토어 ──────────────────────────────────────────────────
import queue as _queue_module
import time as _time

_STORE_TTL = 7200  # 2시간 이상 비활성 토론은 자동 해제

json_num_count: int = 0
_current_discussion_id: str = "local"
_discussion_stores: dict[str, dict[str, dict]] = {}
_discussion_timestamps: dict[str, float] = {}   # 마지막 접근 시각
_event_queues: dict[str, _queue_module.Queue] = {}

# agent_id → SSE step 타입
_AGENT_STEP_TYPE: dict[int, str] = {
    0: "search",
    1: "generate",
    2: "generate",
    3: "generate",
    4: "simplify",
    5: "simplify",
    6: "orchestrator",
}


def _cleanup_stale_stores() -> None:
    """TTL 초과 토론 스토어를 한 번에 정리 (start_new_turn 시 호출)."""
    now = _time.time()
    stale = [k for k, t in _discussion_timestamps.items() if now - t > _STORE_TTL]
    for k in stale:
        _discussion_stores.pop(k, None)
        _discussion_timestamps.pop(k, None)
        _event_queues.pop(k, None)
    if stale:
        print(f"🧹 [Store] 만료 토론 {len(stale)}건 정리: {stale}")


def _store() -> dict[str, dict]:
    _discussion_timestamps[_current_discussion_id] = _time.time()
    return _discussion_stores.setdefault(_current_discussion_id, {})


def _emit(event: dict) -> None:
    """현재 토론의 SSE 큐에 이벤트를 넣는다."""
    q = _event_queues.get(_current_discussion_id)
    if q is not None:
        q.put(event)


def set_event_queue(discussion_id, q: _queue_module.Queue) -> None:
    _event_queues[str(discussion_id or "local")] = q


def clear_event_queue(discussion_id) -> None:
    _event_queues.pop(str(discussion_id or "local"), None)


# ── 턴 관리 함수 ────────────────────────────────────────────────────

def extract_current_message(user_input_field):
    for marker in ("[현재 사용자 요청]\n", "[현재 사용자 입력]\n"):
        if marker in user_input_field:
            return user_input_field.split(marker, 1)[1].strip()
    return user_input_field.strip()


def save_turn_file(raw_user_message, ai_response, discussion_id=None, turn_number=0):
    summary_prompt = (
        f"아래 토론 발언을 핵심 주장 위주로 2~3문장으로 요약하십시오. "
        f"불필요한 수식어 없이 간결하게 작성하십시오.\n\n"
        f"발언: {ai_response[:3000]}\n\n요약:"
    )
    try:
        ai_summary = llm.invoke(summary_prompt).content.strip()
    except Exception:
        ai_summary = ai_response[:300] + "..."

    if discussion_id is not None:
        try:
            from database import get_supabase_client
            sb = get_supabase_client()
            sb.table("discussion_turns").insert({
                "discussion_id": discussion_id,
                "turn_number": turn_number,
                "user_message": raw_user_message,
                "ai_summary": ai_summary,
            }).execute()
            print(f"💾 [Turn Manager] 턴 {turn_number} Supabase 저장 완료 (discussion_id={discussion_id})")
        except Exception as e:
            print(f"⚠️ [Turn Manager] Supabase 저장 실패: {e}")
    else:
        print(f"⚠️ [Turn Manager] discussion_id 없음 — 턴 저장 건너뜀")


def build_compact_user_input(nowturn, raw_message, discussion_id=None, max_recent_turns=5):
    now_turn = nowturn
    todo_instruction = ""
    if now_turn == 0:
        todo_instruction = '토론의 시작에 앞서 토론 주제에 대한 설명을 하는 단계입니다. 사용자가 토론 주제에 대해 잘 모른다고 가정하고, 주제의 정의, 배경, 주요 쟁점 등을 친절하게 설명하는 것이 목표입니다. 에이전트 2번을 활용하세요.'
    elif now_turn == 1:
        todo_instruction = '이제 상대방의 주장에 반박을 제시하는 단계입니다. 상대방 주장의 허점을 파악하여, 그에 대한 논리적인 반박을 제시하는 것이 목표입니다. 에이전트 3번을 활용하세요.'
    elif now_turn == 2:
        todo_instruction = '이제 새로운 의견을 제시하는 단계입니다. 자신의 입장을 뒷받침할 수 있는 새로운 의견을 제시하는 것이 목표입니다. 에이전트 1번을 활용하세요.'
    else:
        todo_instruction = '이제 상대방의 반박에 대한 재반박을 제시하는 단계입니다. 상대방의 반박에서 논리적 허점을 파악하여, 그에 대한 논리적인 재반박을 제시하는 것이 목표입니다. 에이전트 3번을 활용하세요.'

    past_turns = []
    if discussion_id is not None:
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
            past_turns = rows
        except Exception as e:
            print(f"⚠️ [Turn Manager] Supabase 조회 실패: {e}")

    if not past_turns:
        return raw_message

    sep = "=" * 55
    total_turns = len(past_turns)
    recent = past_turns[-max_recent_turns:]
    older_count = total_turns - len(recent)

    lines = [
        sep,
        f"[토론 현황]  주제: {topic}  |  진행 턴: {total_turns}회",
        sep,
        "",
        "⚠️  【필수 지시】 아래에 나열된 이전 논점을 절대 반복하지 마십시오.",
        "    새로운 데이터·근거·관점으로만 응답해야 합니다.",
        "",
    ]

    if older_count > 0:
        lines.append(f"  (이전 {older_count}턴은 생략됨)")
        lines.append("")

    for td in recent:
        user_preview = (td.get("user_message") or "")[:200].replace("\n", " ")
        lines.append(f"── 턴 {td['turn_number']} ──────────────────────────────────────")
        lines.append(f"사용자: {user_preview}")
        lines.append("")
        lines.append(f"AI가 제시한 핵심 논점:\n{td.get('ai_summary', '')}")
        lines.append("")

    lines += [sep, "[이번 차례 지시사항]", todo_instruction, sep, "[현재 사용자 요청]", raw_message]
    return "\n".join(lines)


def clear_discussion_store(discussion_id) -> None:
    """토론 종료 후 해당 discussion_id의 인메모리 파일 스토어를 해제."""
    key = str(discussion_id or "local")
    _discussion_stores.pop(key, None)
    print(f"🗑️ [Store] discussion_id={discussion_id} 스토어 해제 완료")


def start_new_turn(now_turn, raw_user_message, topic_str, stage_str="normal", discussion_id=None):
    global topic, user_input, json_num_count, _current_discussion_id
    topic = topic_str
    user_input = raw_user_message

    _cleanup_stale_stores()  # 새 턴 시작 시 만료 스토어 정리
    _current_discussion_id = str(discussion_id or "local")
    # 이전 턴 파일을 보존하기 위해 스토어를 지우지 않음.
    # json_num_count는 이 토론에서 마지막으로 사용한 번호부터 이어감.
    existing = _store()
    if existing:
        json_num_count = max(
            (int(k.replace("output_", "").replace(".json", ""))
             for k in existing if k.startswith("output_") and k.endswith(".json")),
            default=0,
        )
    else:
        json_num_count = 0
    print(f"🆕 [Turn {now_turn}] 초기화 완료 | topic={topic_str} | discussion_id={discussion_id} | 파일 카운트={json_num_count}")

    compact_input = build_compact_user_input(now_turn, raw_user_message, discussion_id=discussion_id)

    # 이전 턴에서 생성된 파일들을 json_info에 복원 → 오케스트레이터가 이전 자료를 참조 가능
    restored_json_info = {
        fname: data.get("workspace_summary", "")
        for fname, data in _store().items()
        if fname.startswith("output_") and fname.endswith(".json")
    }

    context = {
        "discussion_id": discussion_id,
        "topic": topic_str,
        "previous_instruction": "이전 대화에서 이어지는 사용자 발화입니다.",
        "last_action": {"agent_id": 6, "result": ""},
        "user_input": compact_input,
        "json_info": restored_json_info,
        "stage": stage_str,
        "refutation_turn": 0,
    }
    return run_step(context)


# ── 인메모리 I/O (파일 대신 dict 사용) ─────────────────────────────────

def read_json_file(filename: str) -> dict | None:
    if not filename.endswith(".json"):
        filename = f"{filename}.json"
    return _store().get(filename)

read_step = read_json_file


def make_json_file(filename: str, input_json: dict, output_json: dict) -> dict:
    global json_num_count

    if not filename.endswith(".json"):
        filename = f"{filename}.json"

    json_info_accumulated = input_json.get("json_info", {}).copy()

    prev_filename = f"output_{json_num_count - 1}.json"
    prev_data = _store().get(prev_filename)
    if prev_data:
        json_info_accumulated.update(prev_data.get("json_info", {}))

    json_info_accumulated[filename] = output_json.get("workspace_summary", "요약 없음")

    prev_refutation_turn = input_json.get("refutation_turn", 0)
    last_agent_id = input_json.get("last_action", {}).get("agent_id", -1)
    refutation_turn = prev_refutation_turn + (1 if last_agent_id == 3 else 0)

    merged = {
        'discussion_id': input_json.get("discussion_id"),
        'topic': input_json.get("topic", "unknown_topic"),
        'previous_instruction': input_json.get("previous_instruction", "no_previous_instruction"),
        'last_action': input_json.get("last_action", {}),
        'user_input': input_json.get("user_input", "no_user_input"),
        'json_info': json_info_accumulated,
        'stage': input_json.get("stage", "normal"),
        'refutation_turn': refutation_turn,
        'next_agent_id': output_json.get("next_agent_id", "no_next_agent_id"),
        'instruction': output_json.get("instruction", "no_instruction"),
        'reference': output_json.get("reference", []),
        'context_summary': output_json.get("context_summary", "no_context_summary"),
        'workspace': output_json.get("workspace", "no_workspace"),
        'workspace_summary': output_json.get("workspace_summary", "no_workspace_summary"),
    }

    _store()[filename] = merged
    return merged


# ── 에이전트 ─────────────────────────────────────────────────────────

def run_explorer_agent(input_json_str):
    input_data = input_json_str
    instruction = input_data.get("instruction", "")
    json_info = input_data.get("json_info", {})
    discussion_id = input_data.get("discussion_id")
    turn_number = input_data.get("refutation_turn", 0)

    print(f"🔍 [Agent 0] 주제 분석 및 쿼리 생성 중: {topic}")

    chain = info_query_prompt | llm | JsonOutputParser()
    generated = chain.invoke({"topic": topic, "current_time": current_time, "instruction": instruction})

    print(f"✅ [Agent 0] 쿼리 생성 완료. 총 {len(generated['queries'])}개의 쿼리가 생성되었습니다.")
    search_queries = [q['query'] for q in generated['queries']]
    collected_documents = []

    for q in search_queries:
        print(f"🌐 [Agent 0] 검색 수행: {q}")
        search_response = search_tool.invoke({"query": q})

        if isinstance(search_response, dict) and "results" in search_response:
            result_list = search_response["results"]
        elif isinstance(search_response, list):
            result_list = search_response
        else:
            result_list = []

        for res in result_list:
            if isinstance(res, dict):
                doc = {
                    "source_query": q,
                    "title": res.get("title", "No Title"),
                    "url": res.get("url", ""),
                    "content": res.get("content", "")
                }
            else:
                doc = {"source_query": q, "title": "No Title", "url": "", "content": str(res)}
            collected_documents.append(doc)

    if discussion_id is not None and collected_documents:
        try:
            from database import get_supabase_client
            sb = get_supabase_client()
            rows = [
                {
                    "discussion_id": str(discussion_id),
                    "turn_number": int(turn_number),
                    "query": str(doc["source_query"]),
                    "title": str(doc["title"]),
                    "url": str(doc["url"]),
                    "content": str(doc["content"]),
                }
                for doc in collected_documents
            ]
            sb.table("discussion_search_results").insert(rows).execute()
            print(f"💾 [Agent 0] 검색 결과 {len(rows)}건 Supabase 저장 완료")
        except Exception as e:
            print(f"⚠️ [Agent 0] Supabase 저장 실패: {e}")

    input_json = {
        "discussion_id": discussion_id,
        "topic": topic,
        "previous_instruction": instruction,
        "last_action": {"agent_id": 0, "result": collected_documents},
        "user_input": user_input,
        "json_info": json_info,
        "stage": input_data.get("stage", "normal"),
        "refutation_turn": input_data.get("refutation_turn", 0),
    }
    _emit({"type": "step", "step": "search", "status": "done",
           "data": {"agent_id": 0,
                    "workspace_summary": f"검색 결과 {len(collected_documents)}건 수집 완료"}})
    return run_step(input_json)


def make_refute_agent(input_json_str):
    input_data = input_json_str
    topic = input_data.get("topic", "")
    instruction = input_data.get("instruction", "")
    json_info = input_data.get("json_info", {})
    reference = input_data.get("reference", [])
    user_input = input_data.get("user_input", "")
    discussion_id = input_data.get("discussion_id")

    print(f"⚔️ [Agent 3] 반론 생성 중: {topic}")

    reference_docs = []
    for ref in reference:
        raw_data = read_json_file(ref)
        if raw_data:
            reference_docs.append(raw_data.get("workspace", {}))

    refute_prompt = f"""
    당신은 토론 시스템의 **3번 반론 생성 에이전트(Refuter)**입니다.
    오케스트레이터의 [지시사항]과 [전달된 자료(workspace)]를 바탕으로 상대방 주장의 논리적 허점을 격파하는 **데이터 중심의 반론**을 작성하십시오.

    **[토론 주제]**
    "{topic}"

    **[오케스트레이터 지시사항]**
    "{instruction}"

    **[전달된 자료(workspace)]**
    "{reference_docs}"


    ## [반론 생성 핵심 규칙 — 반드시 준수]

    1. **공격적 논리 구조 (반박 PREP)**
    반드시 아래 순서로 작성하십시오:
    * **상대 주장의 허점 지적**: 상대방이 간과하고 있거나 잘못 알고 있는 부분을 한 문장으로 명시.
    * **논리적 반박 이유**: 왜 상대방의 논리가 성립하지 않는지 서술.
    * **데이터 기반 재반박**: [workspace]의 수치, 통계, 뉴스 데이터를 사용하여 상대방의 주장을 무력화. (반드시 [번호] 미주 포함)
    * **최종 결론**: 반론을 통해 자신의 논리적 우위를 재확인.

    2. **데이터 및 미주 규칙**
    * 반드시 [workspace]에 포함된 뉴스 링크와 데이터만 사용하십시오.
    * 모든 문장에 반드시 [1], [2] 형태의 미주 번호를 포함해야 합니다.
    * "수집된 자료에 따르면", "뉴스 기사[번호]에 의하면"과 같이 출처를 명시하십시오.

    3. **형식 제약**
    * 줄글 형태로만 작성하십시오. 마크다운 제목(##), 리스트(*, -), 숫자 목록(1.) 사용 금지.
    * 인사말 없이 바로 본론부터 시작하십시오.

    4. **출력 실패 조건**
    * 미주 번호([1], [2])가 누락된 경우.
    * 리스트/항목 구조를 사용한 경우.
    * [workspace] 외의 외부 지식을 사용한 경우.


    ## [출력 형식 — 반드시 그대로 작성]

    상대방 주장의 허점: (상대의 논리적 오류를 한 문장으로 지적)

    반박 이유: (상대 주장이 왜 틀렸는지 논리적으로 설명)

    재반박 근거: (workspace 기반 데이터, 통계, 사례 포함 / 모든 문장에 [번호] 포함)

    결론: (반론 요약 및 주제에 대한 자신의 입장을 재확인)

    [참조 문헌]
    [1] 링크
    [2] 링크
    (workspace에 포함된 링크를 번호에 맞게 기입)
    """

    response = llm.invoke(refute_prompt)
    result = response.content
    print(f"✅ [Agent 3] 반론 생성 완료.")

    output_json = {
        "discussion_id": discussion_id,
        "topic": topic,
        "previous_instruction": instruction,
        "last_action": {"agent_id": 3, "result": result},
        "user_input": user_input,
        "json_info": json_info,
        "stage": input_data.get("stage", "normal"),
        "refutation_turn": input_data.get("refutation_turn", 0),
    }
    _emit({"type": "step", "step": "generate", "status": "done",
           "data": {"agent_id": 3, "workspace_summary": "반론 생성 완료"}})
    return run_step(output_json)


def make_topic_explanation_agent(input_json_str):
    input_data = input_json_str
    topic = input_data.get("topic", "")
    instruction = input_data.get("instruction", "")
    json_info = input_data.get("json_info", {})
    user_input = input_data.get("user_input", "")
    reference = input_data.get("reference", [])
    discussion_id = input_data.get("discussion_id")
    turn_number = input_data.get("refutation_turn", 0)


    print(f"📖 [Agent 2] 주제 배경 및 정보 수집 중: {topic}")

    # 오케스트레이터가 reference를 지정한 경우 파일에서 읽어옴 (Agent 0가 수집한 자료 활용)
    reference_docs = []
    for ref in reference:
        raw_data = read_json_file(ref)
        if raw_data:
            reference_docs.append(raw_data.get("workspace", {}))

    # reference 자료가 없을 때만 자체 검색 수행 (fallback)
    collected_context = []
    if not reference_docs:
        print(f"📖 [Agent 2] reference 없음 → 자체 검색 수행")
        explanation_queries = [
            f"{topic} definition and current status 2026",
            f"pros and cons of {topic} major issues",
            f"latest news and statistics about {topic}"
        ]

        for q in explanation_queries:
            print(f"🌐 [Agent 2] 배경 정보 검색: {q}")
            search_response = search_tool.invoke({"query": q})

            if isinstance(search_response, dict) and "results" in search_response:
                result_list = search_response["results"]
            elif isinstance(search_response, list):
                result_list = search_response
            else:
                result_list = []

            for res in result_list:
                if isinstance(res, dict):
                    doc = {
                        "source": res.get("url", "unknown"),
                        "title": res.get("title", "No Title"),
                        "content": res.get("content", "")
                    }
                else:
                    doc = {"source": "unknown", "title": "No Title", "content": str(res)}
                collected_context.append(doc)

        if discussion_id is not None and collected_context:
            try:
                from database import get_supabase_client
                sb = get_supabase_client()
                rows = [
                    {
                        "discussion_id": str(discussion_id),
                        "turn_number": int(turn_number),
                        "query": str(doc["source"]),
                        "title": str(doc["title"]),
                        "url": str(doc["source"]),
                        "content": str(doc["content"]),
                    }
                    for doc in collected_context
                ]
                sb.table("discussion_search_results").insert(rows).execute()
                print(f"💾 [Agent 2] 배경 자료 {len(rows)}건 Supabase 저장 완료")
            except Exception as e:
                print(f"⚠️ [Agent 2] Supabase 저장 실패: {e}")
    else:
        print(f"📖 [Agent 2] reference {len(reference_docs)}개 자료 사용 (자체 검색 생략)")

    source_data = reference_docs if reference_docs else collected_context

    explanation_prompt = f"""
    당신은 토론 시스템의 **2번 주제 설명 에이전트(Topic Explainer)**입니다.
    수집된 [검색 자료]를 바탕으로 주제에 대한 객관적인 가이드라인을 작성하십시오.

    **[토론 주제]**
    "{topic}"

    **[오케스트레이터 지시사항]**
    "{instruction}"

    **[검색 자료]**
    "{source_data}"

    ## [작성 규칙]
    1. **객관성 유지**: 특정 입장에 치우치지 말고 중립적인 정보를 제공하십시오.
    2. **구조화**: 아래 항목을 반드시 포함하여 줄글로 작성하십시오.
       - 주제의 정의 및 핵심 개념
       - 해당 주제가 현재 왜 논의되고 있는가 (최근 배경/이슈)
       - 주요 이해관계자 및 핵심 쟁점 (찬성측/반대측의 주요 논거 요약)
    3. **출처 명시**: 모든 정보 끝에 [1], [2]와 같이 미주를 달고 하단에 링크를 기입하십시오.
    4. **형식**: 마크다운 제목(##)은 사용 가능하나, 리스트 형태(1., *)는 지양하고 문단 형태로 작성하십시오.

    ## [출력 형식]
    주제 정의 및 배경: (내용)
    핵심 쟁점 요약: (내용)
    [참조 문헌]
    [1] 링크...
    """

    response = llm.invoke(explanation_prompt)
    result = response.content
    print(f"✅ [Agent 2] 주제 설명 생성 완료.")

    output_json = {
        "discussion_id": discussion_id,
        "topic": topic,
        "previous_instruction": instruction,
        "last_action": {"agent_id": 2, "result": result},
        "user_input": user_input,
        "json_info": json_info,
        "stage": input_data.get("stage", "normal"),
        "refutation_turn": input_data.get("refutation_turn", 0),
    }
    _emit({"type": "step", "step": "generate", "status": "done",
           "data": {"agent_id": 2, "workspace_summary": "주제 설명 생성 완료"}})
    return run_step(output_json)


def make_opinion_agent(input_json_str):
    input_data = input_json_str
    instruction = input_data.get("instruction", "")
    json_info = input_data.get("json_info", {})
    reference = input_data.get("reference", [])
    discussion_id = input_data.get("discussion_id")

    print(f"🔍 [Agent 1] 주장 생성 중: {topic}")

    reference_docs = []
    for ref in reference:
        raw_data = read_json_file(ref)
        if raw_data:
            reference_docs.append(raw_data.get("workspace", {}))

    opinion_prompt = f"""
    당신은 토론 시스템의 **1번 주장 생성 에이전트**입니다.
    오케스트레이터가 전달한 [지시사항]과 [전달된 자료(workspace)]만을 기반으로, 상대방을 설득할 수 있는 **데이터 중심의 단일 주장**을 작성하십시오.


    **[오케스트레이터 지시사항]**
    "{instruction}"

    **[전달된 자료(workspace)]**
    "{reference_docs}"


    ## [핵심 규칙 — 반드시 모두 준수]

    1. **단일 주장 원칙**

    * 반드시 하나의 핵심 주장만 작성하십시오.
    * 여러 주장, 번호 목록, 항목 분리(예: 1., 2., 3.)는 절대 금지합니다.

    2. **PREP 구조 강제**
    아래 순서를 반드시 그대로 따르십시오:

    * 핵심 주장 → 이유 → 근거 → 결론

    3. **형식 강제**

    * 모든 내용은 줄글 형태로 작성하십시오.
    * 마크다운 제목(##), 글머리표(*, -), 숫자 목록 사용을 금지합니다.
    * 형식을 어길 경우 잘못된 출력입니다.

    4. **근거 및 데이터 사용 규칙**

    * 반드시 [workspace]에 포함된 자료만을 근거로 사용하십시오.
    * 외부 지식, 일반 상식 기반 추론은 금지합니다.
    * 모든 근거 문장에는 반드시 [1], [2] 형태의 미주 번호를 포함해야 합니다.
    * 숫자, 기관명, 연구명 등 구체적인 정보를 포함하십시오.
    * "자료에 따르면"과 같이 출처 기반 표현을 사용하십시오.

    5. **반론 선제 대응**

    * 예상 가능한 반박을 최소 1개 포함하십시오.
    * 해당 반박에 대해 반드시 [workspace] 근거를 활용하여 재반박하십시오.

    6. **출력 실패 조건**

    * PREP 구조를 따르지 않은 경우
    * 미주 번호([1], [2])가 없는 경우
    * 리스트/항목 구조를 사용한 경우
    → 위 조건 중 하나라도 위반하면 잘못된 출력입니다.


    ## [출력 형식 — 반드시 그대로 작성]

    핵심 주장: (한 문장으로 명확하게 작성)

    이유: (핵심 주장을 뒷받침하는 논리 설명)

    근거: (workspace 기반 데이터, 통계, 사례 포함 / 모든 문장에 [번호] 포함)

    결론: (핵심 주장 재강조 및 요약)

    [참조 문헌]
    [1] 링크
    [2] 링크
    (필요 시 계속 추가)


    ## [출력 예시 — 구조만 참고]

    핵심 주장: 원자력 발전소 증설은 탄소 중립 달성을 위한 가장 현실적인 대안이다.
    이유: 안정적인 전력 공급과 낮은 탄소 배출을 동시에 만족시키기 때문이다.
    근거: 자료에 따르면 원자력은 발전 과정에서 온실가스 배출이 거의 없으며[1], 태양광 대비 발전 효율이 약 50배 이상 높다[2]. 일부에서는 안전성을 우려하지만 최신 SMR 기술은 폐기물 발생량을 크게 줄였다[3].
    결론: 따라서 탄소 중립을 위해 원자력 확대는 필수적이다.

    [참조 문헌]
    [1] https://example1.com
    [2] https://example2.com
    [3] https://example3.com

    """
    response = llm.invoke(opinion_prompt)
    result = response.content
    _emit({"type": "step", "step": "generate", "status": "done",
           "data": {"agent_id": 1, "workspace_summary": "주장 생성 완료"}})
    input_json = {
        "discussion_id": discussion_id,
        "topic": topic,
        "previous_instruction": instruction,
        "last_action": {"agent_id": 1, "result": result},
        "user_input": user_input,
        "json_info": json_info,
        "stage": input_data.get("stage", "normal"),
        "refutation_turn": input_data.get("refutation_turn", 0),
    }
    return run_step(input_json)


def simplify_output_agent(input_json_str):
    input_data = input_json_str
    topic = input_data.get("topic", "")
    instruction = input_data.get("instruction", "")
    json_info = input_data.get("json_info", {})
    user_input = input_data.get("user_input", "")
    reference = input_data.get("reference", [])
    stage = input_data.get("stage", "easy")
    discussion_id = input_data.get("discussion_id")
    turn_number = input_data.get("refutation_turn", 0)

    print(f"✏️ [Agent 4] 쉬운 설명으로 변환 중: {topic}")

    reference_docs = []
    for ref in reference:
        raw_data = read_json_file(ref)
        if raw_data:
            reference_docs.append(raw_data.get("workspace", {}))

    simplify_prompt = f"""
    당신은 토론 시스템의 **4번 쉬운 설명 에이전트(Simple Explainer)**입니다.
    아래 [원본 내용]을 바탕으로, 해당 주제를 전혀 모르는 친구에게 다정하게 이야기하듯 쉽고 친근하게 발언문을 작성하십시오.

    **[토론 주제]**
    "{topic}"

    **[오케스트레이터 지시사항]**
    "{instruction}"

    **[원본 내용 (workspace)]**
    "{reference_docs}"

    ## [발언문 작성 가이드라인]

    1. **친근한 구어체와 쉬운 풀이**
    - 말투는 친근한 대화체로 작성하십시오. (예: "~이에요", "~거든요", "쉽게 말하면", "있잖아~")
    - 어려운 전문 용어는 그대로 쓰지 말고, 비유나 실생활 예시(예: 용돈, 쓰레기 배출 등)를 적극적으로 활용하여 초등학생도 이해할 수 있도록 풀어 설명하십시오.

    2. **핵심 주장의 시각적 강조 (필수)**
    - 발언 전체의 관통하는 가장 중요한 **핵심 주장이 등장하는 문장이나 단어**는 반드시 마크다운 굵게 표시 기호인 `**내용**`을 사용하여 강조하십시오.
    - 단, 본문 내의 일반적인 설명이나 부연 설명에는 마크다운 기호(##, *, - 등)를 절대 사용하지 마십시오.

    3. **인용 및 참조 문헌 형식의 철저한 유지 (필수)**
    - 본문 중에서 근거를 제시할 때 원본에 있던 참조 번호(`[1]`, `[2]` 등)를 알맞은 위치에 누락 없이 그대로 포함하여 말하십시오.
    - **[중요]** 발언문 작성이 끝난 후, 맨 아래에 원본에 있는 `[참조 문헌]` 목록을 줄바꿈을 포함하여 원본 형태 그대로 반드시 덧붙여 출력하십시오. 이 목록은 생략되거나 변형되어서는 안 됩니다.
    """

    response = llm.invoke(simplify_prompt)
    result = response.content
    print(f"✅ [Agent 4] 쉬운 설명 변환 완료.")

    input_json_for_file = {
        "discussion_id": discussion_id,
        "topic": topic,
        "previous_instruction": instruction,
        "last_action": {"agent_id": 4, "result": result},
        "user_input": user_input,
        "json_info": json_info,
        "stage": stage,
    }
    final_output = {
        "next_agent_id": -1,
        "instruction": "최종 출력 (쉬운 설명 완료)",
        "reference": reference,
        "context_summary": "Agent 4의 쉬운 설명 변환이 완료되어 최종 답변을 출력합니다.",
        "workspace": result,
        "workspace_summary": "[4] 쉬운 설명 변환 완료 - 최종 답변 출력.",
    }

    global json_num_count
    json_num_count += 1
    make_json_file(f"output_{json_num_count}.json", input_json_for_file, final_output)

    print("\n✅ Orchestrator has decided to end the discussion. Final response:")
    print(result)

    raw_msg = extract_current_message(user_input)
    save_turn_file(raw_msg, result, discussion_id=discussion_id, turn_number=turn_number)
    _emit({"type": "step", "step": "simplify", "status": "done",
           "data": {"agent_id": 4, "workspace_summary": "쉬운 설명 변환 완료"}})
    return result


def normally_output_agent(input_json_str):
    input_data = input_json_str
    topic = input_data.get("topic", "")
    instruction = input_data.get("instruction", "")
    json_info = input_data.get("json_info", {})
    user_input = input_data.get("user_input", "")
    reference = input_data.get("reference", [])
    stage = input_data.get("stage", "easy")
    discussion_id = input_data.get("discussion_id")
    turn_number = input_data.get("refutation_turn", 0)

    print(f"✏️ [Agent 5] 보통 설명으로 변환 중: {topic}")

    reference_docs = []
    for ref in reference:
        raw_data = read_json_file(ref)
        if raw_data:
            reference_docs.append(raw_data.get("workspace", {}))

    simplify_prompt = f"""
    당신은 토론 시스템의 **5번 보통 설명 에이전트(Normal Explainer)**이며, 현재 고도의 학술적·정책적 판단을 내리는 전문가를 대상으로 발언하는 **[전문가 모드]** 상태입니다.
    주어진 [원본 내용]의 논리 구조와 전문성을 완벽히 보존하면서도, 설득력 있는 대화를 작성하십시오.

    **[토론 주제]**
    "{topic}"

    **[오케스트레이터 지시사항]**
    "{instruction}"

    **[원본 내용 (workspace)]**
    "{reference_docs}"

    ## [발언문 작성 가이드라인]

    1. **품격 있는 전문가적 대화체 수행**
    - 텍스트를 단순히 읽는 듯한 딱딱한 어조를 탈피하고, 인과관계와 논리적 흐름이 매끄럽게 연결되는 대화 형태로 작성하십시오.
    - 인사말, 소개, 다짐, 본인의 상태나 모드 전환에 대한 언급(예: '전문가 모드로 시작하겠습니다', '네, 답변드리겠습니다', instruction을 다시 이야기하기)을 절대 생략하고, 질문에 대한 핵심 답변의 첫 문장을 **내용** 강조해서 즉시 출력을 시작하세요.

    2. **용어의 고수 및 심층적 논리 전개**
    - 원문에 등장하는 핵심 전문 용어를 임의로 쉬운 단어로 바꾸거나 생략하지 말고 정확하게 기술하십시오.
    - 발언 전체의 관통하는 가장 중요한 **핵심 주장이 등장하는 문장이나 단어**는 반드시 마크다운 굵게 표시 기호인 `**내용**`을 사용하여 강조하십시오.
    - 단순한 실생활 비유는 지양하고, 해당 분야의 메커니즘, 구조적 원인, 객관적 지표를 바탕으로 논거의 타당성을 심층적으로 입증하십시오.

    3. **핵심 주장 및 인용의 엄밀성 (엄격 준수)**
    - [원본 내용]의 핵심 주장과 세부 데이터, 학술적 논리를 단 하나도 왜곡하거나 누락하지 마십시오.
    - 본문 내의 적절한 위치에 원본의 참조 링크 번호(`[1]`, `[2]` 등)를 출처 근거로서 명확하게 명시하십시오.
    - **[중요]** 발언문 작성이 끝난 후, 맨 아래에 원본에 있는 `[참조 문헌]` 목록을 줄바꿈을 포함하여 원본 형태 그대로 반드시 덧붙여 출력하십시오.

    4. **텍스트 형식 규칙**
    - 시스템 출력의 자연스러운 흐름과 청각적 전달력을 위해 마크다운 기호(##, **, * 등)는 절대 사용하지 마십시오.
    - 문단 간의 유기적인 연결을 위해 적절한 줄바꿈과 공백만을 활용하여 가독성을 높이십시오
    """

    response = llm.invoke(simplify_prompt)
    result = response.content
    print(f"✅ [Agent 5] 보통 설명 변환 완료.")

    input_json_for_file = {
        "discussion_id": discussion_id,
        "topic": topic,
        "previous_instruction": instruction,
        "last_action": {"agent_id": 5, "result": result},
        "user_input": user_input,
        "json_info": json_info,
        "stage": stage,
    }
    final_output = {
        "next_agent_id": -1,
        "instruction": "최종 출력 (보통 설명 완료)",
        "reference": reference,
        "context_summary": "Agent 5의 보통 설명 변환이 완료되어 최종 답변을 출력합니다.",
        "workspace": result,
        "workspace_summary": "[5] 보통 설명 변환 완료 - 최종 답변 출력.",
    }

    global json_num_count
    json_num_count += 1
    make_json_file(f"output_{json_num_count}.json", input_json_for_file, final_output)

    print("\n✅ Orchestrator has decided to end the discussion. Final response:")
    print(result)

    raw_msg = extract_current_message(user_input)
    save_turn_file(raw_msg, result, discussion_id=discussion_id, turn_number=turn_number)
    _emit({"type": "step", "step": "simplify", "status": "done",
           "data": {"agent_id": 5, "workspace_summary": "보통 설명 변환 완료"}})
    return result


# ── 오케스트레이터 ───────────────────────────────────────────────────

def get_system_prompt(refutation_count=0):
    repeat_rule = ""
    if refutation_count >= 3:
        repeat_rule = f"""
⚠️ [반복 감지 경고 — 최우선 규칙]
현재까지 반박 에이전트(3번)가 {refutation_count}회 호출되었습니다.
사용자와의 논리 공방이 충분히 이루어진 것으로 판단합니다.
반드시 아래 규칙을 따르십시오:
- 0번(탐색) → 3번(반박) 순환을 절대 반복하지 마십시오.
- 지금까지의 논점을 종합하여 최종 결론을 도출하십시오.
- stage에 따라 4번(easy) 또는 5번(normal)을 호출한 뒤 -1로 최종 출력하십시오.
- '새로운 자료 탐색이 필요하다'는 판단을 내리면 안 됩니다.
"""
    return f"""{repeat_rule}
당신은 토론 시스템의 총괄 제어 및 품질 검수관입니다.
입력 형식은 [에이전트 번호, 에이전트 작업 내역]이며,
출력 형식은 반드시 [에이전트 번호, 시킬 일]을 엄격히 준수해야 합니다.

가용 에이전트 리스트:
0번 (자료탐색): 질문 기반 검색어 생성 및 정보 수집
1번 (주장 생성): 구조화된 데이터를 바탕으로 논리적 주장 구축
2번 (주제 설명): 토론 주제에 대한 정의, 배경 정보, 핵심 쟁점을 구조적으로 정리하여 제공(유저의 요청시에만 호출)
3번 (반박 생성): 이미 존재하는 '상대 주장'을 반박해야 할 때만 사용, 반박 대상이 명확히 존재해야 함(유저의 요청시에만 호출)
4번 (쉬운 설명 변환): stage가 "easy"일 때만 호출. 1번/2번/3번 결과가 완성된 후 -1(최종 출력) 직전에 반드시 한 번 호출하여 내용을 전문 지식이 없는 사람도 이해할 수 있도록 쉽고 친근하게 변환.
5번 (보통 설명 변환): stage가 "normal"일 때만 호출. 1번/2번/3번 결과가 완성된 후 -1(최종 출력) 직전에 반드시 한 번 호출하여 내용을 일반 뉴스 기사 수준으로 쉽게 변환.

판단 로직:
1. 유저의 신규 입력시: 의도를 파악하여 0번(탐색), 1번(주장 생성), 2번(주제 설명), 3번(반박 생성) 중 적절한 에이전트에게 일을 시킵니다.
2. 1번 2번 3번은 통틀어서 한번만 호출할 수 있습니다. (예: 1번을 이미 호출했다면, 다음에는 2번이나 3번을 호출하면 안됨)
3. 에이전트 결과 검수 시: 결과가 미흡하면 재작업을 시키고, 완료되었다면 다음 단계 에이전트를 호출하거나 유저에게 출력(-1번)합니다.
4. stage 처리 규칙: input JSON의 stage 값을 확인하십시오.
   - stage == "easy": 1번/2번/3번 작업이 완료되면 반드시 4번 에이전트를 호출하고, 4번의 결과를 받은 후 -1로 최종 출력하십시오.
   - stage == "normal": 5번 에이전트를 호출하고, 5번의 결과를 받은 후 -1로 최종 출력하십시오.

제약 사항:
- 유저에게 최종 응답할 때는 에이전트 번호를 -1로 설정하십시오.
- 에이전트 간 데이터 전달 시 문맥을 유지하십시오.
- 4번은 stage가 "easy"일 때만, 최종 출력 직전에 한 번만 호출하십시오. stage가 "normal"이면 절대 호출하지 마십시오.
- 5번은 stage가 "normal"일 때만, 최종 출력 직전에 한 번만 호출하십시오. stage가 "easy"이면 절대 호출하지 마십시오.
- 당신은 모든 입출력을 아래 JSON 명세서 형식으로 처리하여 맥락을 유지해야 합니다.
- 사용자 입력의 topic을 절대 무시하지 마세요.

[INPUT JSON SPEC]
{{
  "discussion_id": "토론 세션 ID",
  "topic": "토론 주제",
  "previous_instruction": "이전 에이전트에게 내린 지시 사항",
  "last_action": {{"agent_id": n, "result": "작업 내용"}},
  "user_input": "유저의 최신 발화",
  "stage": "easy 또는 normal — easy면 최종 출력 전 4번 에이전트를 반드시 호출, normal이면 5번 에이전트를 반드시 호출",
  "refutation_turn": "3번(반박) 에이전트가 완료된 누적 횟수. 이 값이 3 이상이면 반드시 결론으로 가야 함.",
  "json_info": {{ # 기존 에이전트가 수행한 내용을 요약해둔 문서들. output json의 reference에 넣을때 사용해야함.
  "output_1.json": "전기차 화재 원인 뉴스 탐색 (완료)",
    "output_2.json": "output_1.json을 참조하여 전기차 화재 원인 분석 및 주장 생성 (완료)",
  }}
}}

[OUTPUT JSON SPEC]
{{
  "next_agent_id": n,
  "instruction": "다음 에이전트에게 내릴 구체적 지시",
  "reference": ["output_1.json","output_2.json"], # 다음 에이전트가 instruction을 수행하기 위해 반드시 읽어야 할 문서들을 명시, input json spec의 json_info에 있는 문서명(output_1.json, output_2.json 등)을 참조
  "context_summary": "지금까지의 핵심 맥락 요약 (누적)",
  "workspace": "에이전트가 작업을 수행하며 만든 결과물",
  "workspace_summary": "last_action의 result 값 요약 정보",
}}

규칙:
1. **에이전트 호출 및 전환 규칙**:
   - 모든 작업은 '오케스트레이터(6번)'를 거쳐야 합니다. 에이전트끼리 직접 데이터를 주고받을 수 없습니다.
   - 작업 결과가 논리적으로 불충분할 경우(예: 근거 부족, 형식 미준수), 동일한 에이전트 번호에 대해 '보완 지시'를 내리십시오.

2. **문서 관리 및 json_info 유지**:
   - 'reference' 리스트에는 'instruction'을 수행하기 위해 다음 에이전트가 반드시 읽어야 할 파일명들을 명시하십시오. 이 파일명들은 'json_info'에 존재하는 문서명(output_1.json, output_2.json 등)과 일치해야 합니다.
   - 참조할 문서는 'json_info'에서 관련 내용을 찾을 수 있습니다.
   - 'output_{json_num_count}.json'은 반드시 포함되어야 합니다.

3. **Workspace 및 Context 유지**:
   - 'workspace'에는 에이전트가 생성한 날것의 데이터(Raw Data), 논증 전문, 검색 결과 등을 상세히 기록하십시오.
   - 'context_summary'는 현재 토론의 쟁점과 합의된 사항을 한눈에 파악할 수 있도록 서술형으로 업데이트하십시오.
   - 'workspace_summary'는 반드시 다음 형식을 지켜서 작성하십시오: "[last_action의 agent_id] last_action의 result 내용 요약 (완료)"
   - ⚠️ workspace_summary에는 "필요함", "해야 함", "호출해야 함" 등 미래 지시 표현을 절대 포함하지 마십시오. 과거에 수행한 내용만 서술하십시오.

4. **최종 종료 조건**:
   - 'next_agent_id'를 -1로 설정할 때는 'workspace'에 유저에게 보여줄 최종 답변 전문을 담아야 합니다.
   - input JSON의 'refutation_turn' 값이 3 이상인 경우: 유저의 재반박 여부와 무관하게 반드시 stage에 맞는 출력 에이전트(4번/5번)를 호출하고 -1로 종료하십시오.
   - 그 외: 유저가 '납득'했거나 '토론 종료'를 요청한 경우에 -1을 호출하십시오.
"""


def run_step(context_json):
    global json_num_count
    json_num_count += 1
    filename = f"output_{json_num_count}.json"

    refutation_turn = context_json.get("refutation_turn", 0)
    print(f"\n[Current Context]:\n{json.dumps(context_json, indent=2, ensure_ascii=False, default=str)}")
    print(f"⚙️  [Step {json_num_count}] 오케스트레이터 호출 시작")
    print(f"📊 [Orchestrator] 현재 반박 완료 횟수(refutation_turn): {refutation_turn}")

    _emit({"type": "step", "step": "orchestrator", "status": "running",
           "data": {"agent_id": 6}})

    messages = [
        SystemMessage(content=get_system_prompt(refutation_turn)),
        HumanMessage(content=json.dumps(context_json, ensure_ascii=False, default=str))
    ]

    response = llm.invoke(messages)

    try:
        raw_content = response.content
        if "{" in raw_content:
            raw_content = raw_content[raw_content.find("{"):raw_content.rfind("}")+1]

        result = json.loads(raw_content)
        print(f"\n[Orchestrator Decision]:\n{json.dumps(result, indent=2, ensure_ascii=False)}")

        make_json_file(filename, context_json, result)

        _emit({"type": "step", "step": "orchestrator", "status": "done", "data": {
            "agent_id": 6,
            "next_agent_id": result.get("next_agent_id"),
            "instruction": result.get("instruction", "")[:300],
            "workspace_summary": result.get("workspace_summary", ""),
            "context_summary": result.get("context_summary", "")[:200],
            "reference": result.get("reference", []),
        }})
    except Exception as e:
        print(f"❌ 오케스트레이터가 유효한 JSON을 반환하지 않았습니다. 오류: {e}")
        print(response.content)
        return

    return run_orchestrator_test(result)


def run_orchestrator_test(result):
    agent_id = result.get("next_agent_id", None)

    current_filename = f"output_{json_num_count}.json"
    result2 = read_json_file(current_filename) or {}

    if agent_id is None:
        print("❌ Orchestrator did not return a valid next_agent_id.")
        return

    if agent_id == -1:
        final_text = result.get('workspace', '')
        print("✅ Orchestrator has decided to end the discussion. Final response:")
        print(final_text)
        return final_text

    # 안전망: LLM이 경고를 무시하고 반박 루프를 계속 시도할 경우 강제 종료
    refutation_turn = result2.get("refutation_turn", 0)
    if refutation_turn >= 3 and agent_id in (0, 3):
        stage = result2.get("stage", "normal")
        forced_id = 4 if stage == "easy" else 5
        print(f"🛑 [안전망] 반박 {refutation_turn}회 완료. Agent {agent_id} 차단 → Agent {forced_id}(최종 출력)으로 강제 전환합니다.")
        result2["instruction"] = (
            "반박 공방이 충분히 이루어졌습니다. "
            "지금까지 AI가 제시한 핵심 논점들을 종합하여 "
            "설득력 있는 최종 결론을 작성하십시오. "
            "새로운 반박 근거는 추가하지 않아도 됩니다."
        )
        agent_id = forced_id

    print(f"\n⏸ 현재 next_agent_id: {agent_id}")
    user_cmd = 'pass'

    if user_cmd == "stop":
        print("🛑 실행을 중단합니다.")
        return

    step_type = _AGENT_STEP_TYPE.get(agent_id, "generate")
    _emit({"type": "step", "step": step_type, "status": "running",
           "data": {"agent_id": agent_id,
                    "instruction": result2.get("instruction", "")[:300]}})

    if agent_id == 0:
        print("🔄 Agent 0 (Explorer) 실행 중...")
        return run_explorer_agent(result2)
    elif agent_id == 1:
        print("🔄 Agent 1 (Opinion Generator) 실행 중...")
        return make_opinion_agent(result2)
    elif agent_id == 2:
        print("🔄 Agent 2 (Topic Explainer) 실행 중...")
        return make_topic_explanation_agent(result2)
    elif agent_id == 3:
        print("🔄 Agent 3 (Refute Generator) 실행 중...")
        return make_refute_agent(result2)
    elif agent_id == 4:
        print("✏️ Agent 4 (Simple Explainer) 실행 중...")
        return simplify_output_agent(result2)
    elif agent_id == 5:
        print("✏️ Agent 5 (Normal Explainer) 실행 중...")
        return normally_output_agent(result2)
    else:
        print(f"🔄 잘못된 에이전트 ID: {agent_id}")
        return
# ── 실행 설정 ───────────────────────────────────────────────────────
# stage: "easy"   → 전문 지식 없는 친구에게 설명하듯 쉽게 변환 (Agent 4 자동 호출)
# stage: "normal" → 일반 뉴스 수준으로 출력 (Agent 5 자동 호출)

TOPIC = "원자력 발전소 증설"
STAGE = "easy"

# ── 글로벌 초기화 ────────────────────────────────────────────────────
topic = TOPIC
user_input = ""

if __name__ == "__main__":
    # 다중 턴 예시: start_new_turn()을 반복 호출하면 turn_N.json이 누적되며
    # user_input이 자동으로 압축됩니다.
    start_new_turn(
        now_turn = 1, # 턴 번호 (0부터 시작) 0은 토론 주제에 대한 설명, 1은 에이전트가 유저의 의견에 대한 반박, 2는 새로운 의견을 제시하는 턴, 3은 유저의 반박에 대한 재반박.
        raw_user_message="원자력 발전소 증설을 해야해. 이것에 대해 반박하는 주장을 생성해줘.",
        topic_str=TOPIC,
        stage_str=STAGE,
    )