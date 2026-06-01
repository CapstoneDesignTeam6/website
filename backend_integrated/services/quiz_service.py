"""
services/quiz_service.py

사전(pre) / 사후(post) 퀴즈 생성 서비스.
- 사전 퀴즈: IntroQuizAgent 로직 (topic + discussion_turns ai_summary 기반)
- 사후 퀴즈: ReviewQuizAgent 로직 (discussion_turns history 기반)
LLM: Vertex AI Gemini (gemini-2.5-pro)
"""

import json
import re
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


def _pre_quiz_prompt(topic: str, summary: str, qtype: str) -> str:
    meta = _PRE_TYPES[qtype]
    lines = [
        "당신은 비판적 사고 평가 전문가입니다.",
        "아래 토론 주제와 배경 요약을 바탕으로, 지정된 유형의 4지선다 퀴즈를 하나 만드세요.",
        "",
        f"토론 주제: {topic}",
        f"배경 요약: {summary}",
        f"퀴즈 유형: {meta['name']} - {meta['measure']}",
        "",
        "[정답 기준]",
        meta["correct_criteria"],
        "",
        "[오답 설계]",
        meta["distractor_criteria"],
        "",
        "[형식]",
        "- 선지: ...다. 또는 ...된다. 로 끝나는 평서형. 한 문장, 간결하게.",
        "- correct_index: choices 배열 0부터 시작 (정답 위치를 매번 다르게 섞을 것)",
        "- explanation: 정확히 4문장. (1)(2)(3)(4) 기호 사용.",
        "  정답 문장 예시: (1)은 ~~이기 때문에 정답이다.",
        "  오답 문장 예시: (2)는 ~~처럼 보이지만, ~~점에서 오답이다.",
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


def _make_pre_quiz(topic: str, summary: str, qtype: str) -> Optional[dict]:
    prompt = _pre_quiz_prompt(topic, summary, qtype)
    for attempt in range(MAX_RETRIES):
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
            q = _make_post_quiz(topic, history_block, qtype)
            if q:
                quizzes.append(_to_frontend(q, len(quizzes), topic, phase))
                logger.info(f"[PostQuiz] {qtype} 완료 → Q: {q.get('question', '')[:60]}")
            else:
                logger.warning(f"[PostQuiz] {qtype} 생성 실패 — 건너뜀")
        logger.info(f"[QuizService] 사후 퀴즈 {len(quizzes)}개 완료 ──────────────")
        return quizzes
