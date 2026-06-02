"""
services/quiz_service.py

사전(pre) / 사후(post) 퀴즈 생성 서비스.
- 사전 퀴즈: IntroQuizAgent 로직 (topic + discussion_turns ai_summary 기반)
- 사후 퀴즈: ReviewQuizAgent 로직 (discussion_turns history 기반)
LLM: Vertex AI Gemini (gemini-2.5-pro)
"""

import json
import re
import random
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


# ── GPT 호출 ──────────────────────────────────────────────────────────────────

def _call_gpt(prompt: str, max_tokens: int = 2000) -> str:
    from services.vertex_llm import call_llm
    return call_llm(prompt, max_tokens=max_tokens, temperature=0.7)


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
        logger.error(f"[QuizService] Supabase 조회 실패: {e}")
        return []


def _build_summary(turns: list[dict]) -> str:
    parts = [t.get("ai_summary", "") for t in turns if t.get("ai_summary")]
    return " ".join(parts)


def _build_history_block(turns: list[dict]) -> str:
    lines = []
    for t in turns:
        if t.get("user_message"):
            lines.append(f"[유저] {t['user_message']}")
        if t.get("ai_summary"):
            lines.append(f"[AI] {t['ai_summary']}")
    return "\n".join(lines)


# ── 공통 파싱 ──────────────────────────────────────────────────────────────────

def _find_balanced_object(text: str) -> Optional[str]:
    start = text.find("{")
    if start == -1:
        return None
    depth = in_str = escape = 0
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            escape = (ch == "\\") if not escape else 0
            if not escape and ch == '"':
                in_str = 0
        elif ch == '"':
            in_str = 1
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _normalize_choices(choices: list[str]) -> list[str]:
    result = []
    for c in choices:
        c = c.strip().rstrip(".")
        if c.endswith("?"):
            result.append(c)
        elif c.endswith("다"):
            result.append(c + ".")
        else:
            result.append(c + "다.")
    return result


def _parse_correct_index(item: dict, choices: list[str]) -> Optional[int]:
    raw = item.get("correct_index", item.get("answer_index"))
    try:
        idx = int(raw)
        if 0 <= idx <= 3:
            return idx
    except (TypeError, ValueError):
        pass
    ans_text = item.get("correct_answer") or item.get("answer")
    if isinstance(ans_text, str):
        for i, c in enumerate(choices):
            if c.strip() == ans_text.strip():
                return i
    return None


def _sync_correct_index(correct_idx: int, explanation: str) -> int:
    label_map = {"①": 0, "②": 1, "③": 2, "④": 3}
    hits = re.findall(r"([①②③④])[^。.]*?정답|정답[^。.]*?([①②③④])", explanation)
    indices = set()
    for a, b in hits:
        label = a or b
        if label in label_map:
            indices.add(label_map[label])
    if not indices:
        paren_map = {"(1)": 0, "(2)": 1, "(3)": 2, "(4)": 3}
        hits2 = re.findall(r"(\(\d\))[^.]*?정답|정답[^.]*?(\(\d\))", explanation)
        for a, b in hits2:
            label = a or b
            if label in paren_map:
                indices.add(paren_map[label])
    if len(indices) == 1:
        return next(iter(indices))
    return correct_idx


def _parse_quiz(raw: str, qtype: str) -> Optional[dict]:
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    obj = _find_balanced_object(cleaned) or _find_balanced_object(raw)
    if not obj:
        return None
    try:
        item = json.loads(obj)
    except Exception:
        return None
    if not isinstance(item, dict):
        return None

    choices = None
    for key in ("choices", "options", "answers"):
        val = item.get(key)
        if isinstance(val, list) and len(val) == 4:
            choices = [str(c).strip() for c in val]
            break
    if not choices:
        return None

    question = item.get("question", "").strip()
    explanation = item.get("explanation", "").strip()
    if not question or not explanation:
        return None

    correct_idx = _parse_correct_index(item, choices)
    if correct_idx is None:
        return None

    correct_idx = _sync_correct_index(correct_idx, explanation)
    choices = _normalize_choices(choices)

    return {
        "quiz_type": qtype,
        "question": question,
        "choices": choices,
        "correct_index": correct_idx,
        "explanation": explanation,
    }


# ── 사전 퀴즈 (IntroQuizAgent 로직) ────────────────────────────────────────────

_PRE_TYPES = {
    "missing_variable": {
        "name": "누락 변수 감지",
        "measure": "부분 사실 하나로 전체를 단정할 때 빠진 핵심 변수를 찾는 능력",
        "question_guide": (
            "두 대상을 비교해 결론을 내릴 때, 그 비교가 의미 있으려면 "
            "함께 봐야 하는데 빠진 것이 무엇인지 묻는 자연스러운 질문을 써라.\n"
            "좋은 예) 'A와 B 중 어느 쪽이 더 나은지 판단하려면 무엇을 함께 고려해야 하는가?'\n"
            "나쁜 예) '반드시 누락된 핵심 변수는 무엇인가?' — 이런 메타 표현 절대 금지"
        ),
        "correct_criteria": (
            "이 결론이 성립하려면 반드시 함께 비교해야 할 변수. "
            "이걸 빠뜨리면 비교 자체가 무의미해진다."
        ),
        "distractor_criteria": (
            "각 오답은 다음 중 하나여야 한다:\n"
            "- 결론을 강화하지만 '빠진 변수'가 아닌 것\n"
            "- 관련 있어 보이지만 이 논증과 다른 차원\n"
            "- 주제 내 실제 변수지만 이 특정 비교에서는 부차적"
        ),
    },
    "overgeneralization": {
        "name": "일반화 범위 판단",
        "measure": "하나의 사례에서 끌어낼 수 있는 결론의 적절한 범위를 판단하는 능력",
        "question_guide": (
            "사례 하나를 보여주고 이 사례로부터 무엇을 결론 내릴 수 있는지 묻는 "
            "자연스러운 질문을 써라.\n"
            "좋은 예) '다음 비교 논의를 바탕으로 추론할 수 있는 가장 적절한 결론은 무엇인가?'\n"
            "나쁜 예) '일반화 범위를 벗어나지 않은 결론은?' — 이런 메타 표현 절대 금지"
        ),
        "correct_criteria": (
            "사례 하나가 직접 말해주는 것만 담은 결론. "
            "범위를 벗어나지 않으면서 너무 좁지도 넓지도 않다."
        ),
        "distractor_criteria": (
            "각 오답은 다음 중 하나여야 한다:\n"
            "- 사례를 훨씬 넓은 범주로 과도하게 일반화\n"
            "- 사례의 의미를 너무 좁게 해석하거나 전면 부정\n"
            "- 그럴듯하게 들리지만 사례와 논리 연결이 없는 비약"
        ),
    },
    "counterargument": {
        "name": "반론 구성력",
        "measure": "주장의 숨은 전제를 직접 흔드는 반론을 찾는 능력",
        "question_guide": (
            "특정 주장을 제시하고, 그 주장의 논리를 가장 강하게 흔드는 것이 무엇인지 "
            "묻는 자연스러운 질문을 써라.\n"
            "좋은 예) 'A에 대한 B라는 주장에 대해 가장 강력한 반론은 무엇인가?'\n"
            "나쁜 예) '숨은 전제를 부정하는 반론은?' — 이런 메타 표현 절대 금지"
        ),
        "correct_criteria": (
            "주장이 성립하려면 반드시 참이어야 하는 숨은 전제를 직접 부정하거나 "
            "성립하지 않을 수 있음을 보여주는 반론."
        ),
        "distractor_criteria": (
            "각 오답은 반드시 서로 다른 논리 차원이어야 한다:\n"
            "- 주장의 결론 방향을 강화하거나 보완하는 것 (반론이 아닌 지지)\n"
            "- 주장의 전제는 그대로 두고 부수적 수치나 사실만 다투는 것\n"
            "- 주제와 관련 있지만 이 주장의 핵심 논점과 다른 차원을 건드리는 것"
        ),
    },
}


def _pre_quiz_prompt(topic: str, summary: str, qtype: str, correct_hint: int) -> str:
    meta = _PRE_TYPES[qtype]

    counterargument_extra = (
        "\n[반론 구성력 유형 추가 규칙]\n"
        "- 선지는 한 문장, 간결하게. 조건절 중첩 금지\n"
        "- 현실 팩트 단정 선지 금지 — 논리 구조 공격이 목적\n"
        "- 4개 선지가 각각 다른 논리 차원을 공격해야 함\n"
        "- 선지 시작 표현 금지: '만약 ~', 'If ~' 로 시작하는 선지 절대 금지\n"
        "- 선지 끝 표현 금지: '~인가?', '~무엇인가?' 로 끝나는 선지 절대 금지\n"
        "- 선지는 반드시 '...다.' 또는 '...된다.' 로 끝나는 평서형\n"
    ) if qtype == "counterargument" else ""

    lines = [
        "당신은 비판적 사고 평가 전문가입니다.",
        "아래 토론 주제와 배경 요약을 바탕으로, 지정된 유형의 4지선다 퀴즈를 하나 만드세요.",
        "",
        f"토론 주제: {topic}",
        f"배경 요약: {summary}",
        f"퀴즈 유형: {meta['name']} - {meta['measure']}",
        "",
        "[질문 작성 규칙]",
        "- 주제의 핵심 대상(국가명, 개념, 인물명 등)을 반드시 포함할 것",
        "- 단순 암기가 아닌 추론을 요구해야 함",
        "- 한 문장, 명확하고 자연스럽게",
        "- 절대 금지 표현: '누락된', '반드시 비교해야 할', '숨은 전제', '핵심 변수',",
        "  '일반화 범위', '논리적 오류' 등 측정 능력을 설명하는 메타 언어를 질문에 쓰지 말 것",
        f"- 질문 작성 가이드: {meta['question_guide']}",
        "",
        "[정답 기준]",
        meta["correct_criteria"],
        "",
        "[오답 설계 - 가장 중요]",
        meta["distractor_criteria"],
        "",
        "[핵심 요구사항]",
        "- 4개 선지 중 어느 것도 '이건 아닌데?' 싶으면 안 된다",
        "- 처음 읽을 때 4개 모두 그럴듯해야 한다",
        "- 정답은 추론 끝에 납득되고, 오답은 '이것도 틀린 건 아닌데...' 싶지만 결정적으로 부족한 것",
        counterargument_extra,
        "[형식]",
        "- 선지: ...다. 또는 ...된다. 로 끝나는 평서형. 한 문장, 간결하게.",
        f"- 정답은 반드시 인덱스 {correct_hint} 위치(0부터 시작)에 배치할 것. "
        f"choices 배열에서 {correct_hint}번째(0-indexed)가 정답이 되도록 선지 순서를 구성하라.",
        "- explanation: 정확히 4문장. (1)(2)(3)(4) 기호 사용.",
        f"  정답 문장 예시: ({correct_hint + 1})은 ~~이기 때문에 정답이다.",
        "  오답 문장 예시: (2)는 ~~처럼 보이지만, ~~점에서 오답이다.",
        "",
        "JSON만 출력. 백틱/마크다운 금지.",
        "",
        "{",
        f'  "quiz_type": "{qtype}",',
        '  "type": "reasoning",',
        '  "question": "질문 텍스트?",',
        '  "choices": ["선지A다.", "선지B다.", "선지C다.", "선지D다."],',
        f'  "correct_index": {correct_hint},',
        '  "explanation": "(1)은 ... (2)는 ... (3)은 ... (4)는 ..."',
        "}",
    ]
    return "\n".join(lines)


def _make_pre_quiz(topic: str, summary: str, qtype: str) -> Optional[dict]:
    for attempt in range(MAX_RETRIES):
        # 정답 위치를 매 시도마다 랜덤 지정 → 정답 쏠림(항상 0번) 방지
        correct_hint = random.randint(0, 3)
        prompt = _pre_quiz_prompt(topic, summary, qtype, correct_hint)
        raw = _call_gpt(prompt)
        if not raw or "[ERROR]" in raw:
            logger.warning(f"[PreQuiz:{qtype}] 시도 {attempt+1} GPT 오류")
            continue
        quiz = _parse_quiz(raw, qtype)
        if quiz:
            return quiz
        logger.warning(f"[PreQuiz:{qtype}] 시도 {attempt+1} 파싱 실패")
    return None


# ── 사후 퀴즈 (ReviewQuizAgent 로직) ──────────────────────────────────────────

_POST_TYPES = {
    "argument_core": {
        "name": "논거의 숨은 전제 추론",
        "measure": "토론에서 제시된 논거가 성립하려면 반드시 참이어야 하는 숨은 전제를 찾는 능력",
        "correct_criteria": (
            "이 논거가 설득력을 가지려면 반드시 받아들여야 하는 숨은 전제. "
            "이 전제가 흔들리면 논거 전체가 무너진다."
        ),
        "distractor_criteria": (
            "각 오답은 다음 중 하나여야 한다:\n"
            "- 논거를 강화하는 추가 근거이지, 논거가 의존하는 전제가 아닌 것\n"
            "- 논거와 관련 있어 보이지만 이 논증 구조와 다른 차원의 가정\n"
            "- 전제처럼 들리지만 논거가 무너져도 여전히 성립하는 독립적 사실"
        ),
    },
    "argument_flaw": {
        "name": "논증 약점 찾기",
        "measure": "토론에서 제시된 주장이나 반박에 어떤 논리적 문제가 있는지 찾는 능력",
        "correct_criteria": (
            "이 주장 또는 반박이 가진 가장 치명적인 논리적 약점. "
            "전제가 과도하게 단순화되었거나, 인과관계가 성립하지 않거나, "
            "반론이 실제로는 상대 주장을 강화하는 등 논증 구조 자체의 결함."
        ),
        "distractor_criteria": (
            "각 오답은 다음 중 하나여야 한다:\n"
            "- 약점처럼 들리지만 실제로는 주장의 강점이나 근거를 설명하는 것\n"
            "- 논리적 문제가 있긴 하지만 이 주장의 핵심을 흔들지 못하는 부차적 결함\n"
            "- 주제와 관련 있지만 이 특정 논증과 다른 차원의 문제를 지적하는 것"
        ),
    },
    "news_inference": {
        "name": "추가 정보 기반 심화 추론",
        "measure": "토론의 핵심 주장과 맥락을 연결해 더 깊이 사고하는 능력",
        "correct_criteria": (
            "토론에서 제기된 주장 또는 반박을 전체 맥락과 연결했을 때 "
            "가장 타당하게 도출되는 추론이나 판단."
        ),
        "distractor_criteria": (
            "각 오답은 다음 중 하나여야 한다:\n"
            "- 토론 내용과는 맞지만 논리 흐름과 충돌하는 추론\n"
            "- 그럴듯해 보이지만 토론 내용에서 근거가 부족한 추론\n"
            "- 부분적으로만 맞지만 전체를 왜곡한 추론"
        ),
    },
}


def _post_quiz_prompt(topic: str, history_block: str, qtype: str) -> str:
    meta = _POST_TYPES[qtype]
    lines = [
        "당신은 토론 이해도 평가 전문가입니다.",
        "아래 토론 기록을 꼼꼼히 읽고, 지정된 유형의 4지선다 퀴즈를 하나 만드세요.",
        "",
        f"토론 주제: {topic}",
        "",
        "[토론 기록]",
        history_block,
        "",
        f"퀴즈 유형: {meta['name']} - {meta['measure']}",
        "",
        "[정답 기준]",
        meta["correct_criteria"],
        "",
        "[오답 설계]",
        meta["distractor_criteria"],
        "",
        "[형식]",
        "- 모든 선지: ...다. 또는 ...된다. 로 끝나는 평서형",
        "- correct_index: choices 배열 0부터 시작 (정답 위치를 매번 다르게 섞을 것)",
        "- explanation: 정확히 4문장. (1)(2)(3)(4) 기호 사용.",
        "",
        "JSON만 출력. 백틱/마크다운 금지.",
        "",
        "{",
        f'  "quiz_type": "{qtype}",',
        '  "type": "reasoning",',
        '  "question": "질문 텍스트?",',
        '  "choices": ["선지A다.", "선지B다.", "선지C다.", "선지D다."],',
        '  "correct_index": 0,',
        '  "explanation": "(1)은 ... (2)는 ... (3)은 ... (4)는 ..."',
        "}",
    ]
    return "\n".join(lines)


def _make_post_quiz(topic: str, history_block: str, qtype: str) -> Optional[dict]:
    prompt = _post_quiz_prompt(topic, history_block, qtype)
    for attempt in range(MAX_RETRIES):
        raw = _call_gpt(prompt)
        if not raw or "[ERROR]" in raw:
            logger.warning(f"[PostQuiz:{qtype}] 시도 {attempt+1} GPT 오류")
            continue
        quiz = _parse_quiz(raw, qtype)
        if quiz:
            return quiz
        logger.warning(f"[PostQuiz:{qtype}] 시도 {attempt+1} 파싱 실패")
    return None


# ── news_inference 전용: 토론 중 에이전트가 이미 수집한 검색결과 재사용 ──────────

def _fetch_search_results(discussion_id: int, limit: int = 5) -> str:
    """에이전트(0/2)가 토론 중 수집해 둔 discussion_search_results를 블록으로 반환.
    별도 Tavily 검색 없이 이미 모아둔 뉴스/데이터를 그대로 활용한다."""
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        rows = (
            sb.table("discussion_search_results")
            .select("title, url, content")
            .eq("discussion_id", str(discussion_id))
            .execute()
            .data
        ) or []
    except Exception as e:
        logger.warning(f"[QuizService] 검색결과 조회 실패: {e}")
        return ""

    blocks, seen = [], set()
    for r in rows:
        url = (r.get("url") or "").strip()
        if url in seen:
            continue
        seen.add(url)
        content = (r.get("content") or "").strip()[:500]
        if not content:
            continue
        blocks.append(f"제목: {r.get('title', '')}\n출처: {url}\n내용: {content}")
        if len(blocks) >= limit:
            break
    return "\n\n".join(blocks)


def _make_news_inference(topic: str, history_block: str, discussion_id: int) -> Optional[dict]:
    """추가 정보 기반 심화 추론 — 토론 중 에이전트가 수집한 검색결과를 활용해 출제.
    수집된 자료가 없으면 토론 기록만으로 출제(일반 사후 퀴즈와 동일)."""
    search_block = _fetch_search_results(discussion_id)
    if not search_block:
        logger.info("[PostQuiz:news_inference] 수집된 검색결과 없음 → 토론 기록만으로 출제")
        return _make_post_quiz(topic, history_block, "news_inference")

    for attempt in range(MAX_RETRIES):
        correct_hint = random.randint(0, 3)
        prompt = "\n".join([
            "당신은 토론 이해도 평가 전문가입니다.",
            "아래 토론 기록과, 토론 중 수집된 실제 뉴스/데이터를 함께 사용해 4지선다 퀴즈를 하나 만드세요.",
            "",
            f"토론 주제: {topic}",
            "",
            "[토론 기록]",
            history_block,
            "",
            "[토론 중 수집된 실제 뉴스/데이터]",
            search_block,
            "",
            "[출제 규칙]",
            "- 토론에서 제기된 주장 하나를 골라, 위 뉴스/데이터와 연결해서 평가하는 질문을 한 문장으로 작성",
            "- 토론 내용만 알아도 풀리면 안 됨 — 뉴스/데이터까지 함께 고려해야 정답이 보여야 함",
            "- 화자 표기는 '유저' 또는 'AI'로만",
            "",
            "[정답/오답]",
            "- 정답: 뉴스/데이터의 사실을 토론 핵심 주장과 연결했을 때 가장 타당한 판단",
            "- 오답: (A)사실은 맞지만 맥락 연결이 어긋남 (B)방향을 반대로 적용 (C)부분만 고려해 전체 왜곡 — 모두 그럴듯하게",
            "",
            "[형식]",
            "- 선지: ...다. 로 끝나는 평서형",
            f"- 정답은 반드시 인덱스 {correct_hint} 위치(0부터 시작)에 배치",
            "- explanation: 정확히 4문장. (1)(2)(3)(4) 기호 사용.",
            "",
            "JSON만 출력. 백틱/마크다운 금지.",
            "{",
            '  "quiz_type": "news_inference",',
            '  "type": "reasoning",',
            '  "question": "질문?",',
            '  "choices": ["선지A다.", "선지B다.", "선지C다.", "선지D다."],',
            f'  "correct_index": {correct_hint},',
            '  "explanation": "(1)은 ... (2)는 ... (3)은 ... (4)는 ..."',
            "}",
        ])
        raw = _call_gpt(prompt)
        if not raw or "[ERROR]" in raw:
            continue
        quiz = _parse_quiz(raw, "news_inference")
        if quiz:
            return quiz
        logger.warning(f"[PostQuiz:news_inference] 시도 {attempt+1} 파싱 실패, 재시도")
    return None


# ── 변환: MultipleChoiceQuiz 형식 ──────────────────────────────────────────────

def _to_frontend(quiz: dict, idx: int, topic: str, phase: str) -> dict:
    return {
        "id": idx + 1,
        "topic": topic,
        "phase": phase,
        "type": "multiple-choice",
        "question": quiz.get("question", ""),
        "options": quiz.get("choices", []),
        "correctIndex": quiz.get("correct_index", 0),
        "explanation": quiz.get("explanation", ""),
    }


# ── 채점 & 저장 ────────────────────────────────────────────────────────────────

def grade_and_save(discussion_id: int, phase: str, quizzes: list[dict], answers: list[int]) -> dict:
    """프론트가 푼 퀴즈 답안을 채점하고 discussion_sessions에 저장.

    Args:
        quizzes: 프론트가 받은 퀴즈 리스트 (correctIndex 포함)
        answers: 사용자가 고른 보기 인덱스 리스트 (quizzes와 같은 순서)
    Returns: {"results": [...], "total_score": n, "count": n}
    """
    results = []
    for quiz, user_idx in zip(quizzes, answers):
        correct_idx = quiz.get("correctIndex", quiz.get("correct_index", -1))
        results.append({
            "quiz_type": quiz.get("quiz_type") or quiz.get("type"),
            "question": quiz.get("question"),
            "user_index": user_idx,
            "correct_index": correct_idx,
            "correct": user_idx == correct_idx,
        })
    total = sum(1 for r in results if r["correct"])

    # discussion_sessions 행은 /message 첫 턴에서 생성됨 (로그인/게스트 모두). id=discussion_id로 UPDATE.
    phase = "pre" if phase == "pre" else "post"
    try:
        from database import get_supabase_client
        sb = get_supabase_client()
        sb.table("discussion_sessions").update({
            f"{phase}_quiz_result": results,
            f"{phase}_quiz_score": total,
        }).eq("id", discussion_id).execute()
        logger.info(f"[QuizService] {phase} 퀴즈 결과 저장 완료 (discussion_id={discussion_id}, score={total}/{len(results)})")
    except Exception as e:
        logger.warning(f"[QuizService] 퀴즈 결과 저장 실패: {e}")

    return {"results": results, "total_score": total, "count": len(results)}


# ── 공개 API ───────────────────────────────────────────────────────────────────

def get_quiz_set(topic: str, phase: str, discussion_id: int) -> list[dict]:
    """
    사전(pre) 또는 사후(post) 퀴즈 세트 생성.
    discussion_turns를 discussion_id 기준으로 Supabase에서 조회해 컨텍스트 구성.
    Returns: MultipleChoiceQuiz[] 형식 리스트
    """
    turns = _fetch_turns(discussion_id)
    logger.info(f"[QuizService] ── 퀴즈 생성 시작 ──────────────────────────")
    logger.info(f"[QuizService] discussion_id={discussion_id} | phase={phase} | turns={len(turns)}개")
    logger.info(f"[QuizService] topic: {topic}")

    if phase == "pre":
        summary = _build_summary(turns) or topic
        if turns:
            logger.info(f"[QuizService] 배경 요약 (ai_summary 기반, {len(summary)}자):\n{summary[:500]}{'...' if len(summary) > 500 else ''}")
        else:
            logger.warning(f"[QuizService] turns 없음 → topic 문자열만 사용: {topic}")
        quizzes = []
        for qtype in _PRE_TYPES:
            logger.info(f"[PreQuiz] {qtype} 생성 중...")
            q = _make_pre_quiz(topic, summary, qtype)
            if q:
                quizzes.append(_to_frontend(q, len(quizzes), topic, phase))
                logger.info(f"[PreQuiz] {qtype} 완료 → Q: {q.get('question', '')[:60]}")
            else:
                logger.warning(f"[PreQuiz] {qtype} 생성 실패 — 건너뜀")
        logger.info(f"[QuizService] 사전 퀴즈 {len(quizzes)}개 완료 ──────────────")
        return quizzes

    else:
        history_block = _build_history_block(turns) or f"주제: {topic}"
        if turns:
            logger.info(f"[QuizService] 대화 기록 ({len(turns)}턴, {len(history_block)}자):\n{history_block[:500]}{'...' if len(history_block) > 500 else ''}")
        else:
            logger.warning(f"[QuizService] turns 없음 → fallback: '주제: {topic}'")
        quizzes = []
        for qtype in _POST_TYPES:
            logger.info(f"[PostQuiz] {qtype} 생성 중...")
            if qtype == "news_inference":
                # 토론 중 수집된 검색결과(discussion_search_results) 재사용
                q = _make_news_inference(topic, history_block, discussion_id)
            else:
                q = _make_post_quiz(topic, history_block, qtype)
            if q:
                quizzes.append(_to_frontend(q, len(quizzes), topic, phase))
                logger.info(f"[PostQuiz] {qtype} 완료 → Q: {q.get('question', '')[:60]}")
            else:
                logger.warning(f"[PostQuiz] {qtype} 생성 실패 — 건너뜀")
        logger.info(f"[QuizService] 사후 퀴즈 {len(quizzes)}개 완료 ──────────────")
        return quizzes
