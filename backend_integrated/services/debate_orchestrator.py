"""
debate_orchestrator.py — hongcheol 멀티 에이전트 토론 시스템 (request-scoped)

원본: hongcheol/code_integrated.py
변경:
  - 모듈 글로벌 변수(topic, user_input, json_num_count) → 인스턴스 변수
  - 파일 시스템(output_N.json) → 인메모리 dict (self._outputs)
  - 매 요청마다 새 인스턴스를 생성하여 동시 사용자 충돌 방지

에이전트 구성:
  0번: Explorer (Tavily 검색)
  1번: Opinion Generator (주장 생성)
  2번: Topic Explainer (주제 배경 설명)
  3번: Refuter (반박 생성)
  4번: Simple Explainer (쉬운 설명 변환)
  5번: Orchestrator (LLM 기반 라우팅)
"""

import json
import os
import datetime
import logging
from typing import Optional, Dict, Any, List

import vertexai
from langchain_google_vertexai import ChatVertexAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# Vertex AI 초기화는 모듈 로드 시 1회만 (재진입 안전)
_VERTEX_INITIALIZED = False


def _ensure_vertex_initialized(project_id: str, location: str) -> None:
    global _VERTEX_INITIALIZED
    if not _VERTEX_INITIALIZED:
        vertexai.init(project=project_id, location=location)
        _VERTEX_INITIALIZED = True


INFO_QUERY_PROMPT = ChatPromptTemplate.from_template("""
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

3. 근거 중심 탐색:
   - 실제 사례 (지역, 사건, 국가)
   - 수치/통계 데이터
   - 과학적 연구 또는 기관 보고서

4. 검색 최적화:
   영어 기반 검색에 적합하도록 핵심 키워드를 명확하게 포함하고,
   불필요한 자연어 문장을 줄이십시오.


**[반드시 아래 JSON 형식을 지켜주세요]**
{{
    "analysis_focus": "오케스트레이터의 지시 중 집중적으로 조사할 핵심 포인트 (한글)",
    "queries": [
        {{
            "category": "분류",
            "query": "English Search Query",
            "reasoning": "이 쿼리가 사용자의 주장을 어떻게 뒷받침하는가 (한글)"
        }}
    ]
}}

주제: "{topic}"
결과:
""")


class DebateOrchestrator:
    """
    한 번의 토론 요청을 처리하는 request-scoped 오케스트레이터.

    사용 예:
        orch = DebateOrchestrator(project_id=..., location=..., model_id=...)
        result = orch.run(topic="...", user_input="...", stage="easy")
    """

    MAX_STEPS = 12  # 무한 루프 방지

    def __init__(
        self,
        project_id: str,
        location: str = "global",
        model_id: str = "gemini-2.5-pro",
        tavily_api_key: Optional[str] = None,
        temperature: float = 0.3,
    ):
        if tavily_api_key:
            os.environ["TAVILY_API_KEY"] = tavily_api_key

        _ensure_vertex_initialized(project_id, location)

        self.llm = ChatVertexAI(
            model_name=model_id,
            project=project_id,
            location=location,
            temperature=temperature,
        )
        self.search_tool = TavilySearchResults(max_results=1)

        # request-scoped 상태
        self.topic: str = ""
        self.user_input: str = ""
        self.stage: str = "normal"
        self._outputs: Dict[str, Dict[str, Any]] = {}
        self._step_count: int = 0
        self._final_response: Optional[str] = None

    # ── Public ────────────────────────────────────────────────────────────

    def run(
        self,
        topic: str,
        user_input: str,
        stage: str = "easy",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        토론 응답을 생성하고 최종 답변 텍스트를 반환한다.

        Args:
            topic: 토론 주제
            user_input: 사용자 입력
            stage: "easy" (Agent 4까지 호출) 또는 "normal"
            history: 이전 대화 ([{"role": "user"|"assistant", "content": "..."}])
        """
        self.topic = topic
        self.user_input = self._build_context_input(topic, user_input, history or [])
        self.stage = stage
        self._outputs = {}
        self._step_count = 0
        self._final_response = None

        initial_context = {
            "topic": topic,
            "previous_instruction": "대화의 시작부분입니다.",
            "last_action": {"agent_id": 5, "result": ""},
            "user_input": self.user_input,
            "json_info": {},
            "stage": stage,
        }

        try:
            self._run_step(initial_context)
        except Exception as e:
            logger.error(f"❌ orchestrator 실패: {e}")
            raise

        return self._final_response or "응답을 생성할 수 없습니다."

    # ── 컨텍스트 빌더 ─────────────────────────────────────────────────────

    @staticmethod
    def _build_context_input(
        topic: str,
        current_user_input: str,
        history: List[Dict[str, str]],
    ) -> str:
        """이전 대화를 user_input에 통합 (hongcheol/web.py와 동일 로직)."""
        user_turns = [m for m in history if m.get("role") == "user"]
        ai_turns = [m for m in history if m.get("role") in ("assistant", "ai", "agent")]

        if not user_turns:
            return current_user_input

        sep = "=" * 55
        lines = [
            sep,
            f"[토론 현황]  주제: {topic}  |  진행 턴: {len(user_turns)}회",
            sep,
            "",
            "⚠️  【필수 지시】 아래에 나열된 이전 논점을 절대 반복하지 마십시오.",
            "    새로운 데이터·근거·관점으로만 응답해야 합니다.",
            "",
        ]
        for i, (um, am) in enumerate(zip(user_turns, ai_turns), 1):
            lines.append(f"── 턴 {i} ──")
            lines.append(f"사용자: {um.get('content', '')}")
            ai_text = am.get("content", "")
            preview = ai_text if len(ai_text) <= 600 else ai_text[:600] + "\n… (이하 생략)"
            lines.append(f"AI가 제시한 논점:\n{preview}")
            lines.append("")
        lines += [sep, "[현재 사용자 요청]", current_user_input]
        return "\n".join(lines)

    # ── 인메모리 출력 저장 ────────────────────────────────────────────────

    def _save_output(
        self,
        filename: str,
        input_json: Dict[str, Any],
        output_json: Dict[str, Any],
    ) -> Dict[str, Any]:
        """파일 대신 self._outputs 딕셔너리에 저장."""
        json_info_accumulated = input_json.get("json_info", {}).copy()

        # 이전 파일이 있으면 그 json_info를 병합 (원본 로직 보존)
        prev_filename = f"output_{self._step_count - 1}.json"
        prev_data = self._outputs.get(prev_filename)
        if prev_data:
            json_info_accumulated.update(prev_data.get("json_info", {}))

        json_info_accumulated[filename] = output_json.get("workspace_summary", "요약 없음")

        merged = {
            "topic": input_json.get("topic", "unknown_topic"),
            "previous_instruction": input_json.get("previous_instruction", ""),
            "last_action": input_json.get("last_action", {}),
            "user_input": input_json.get("user_input", ""),
            "json_info": json_info_accumulated,
            "stage": input_json.get("stage", "normal"),
            "next_agent_id": output_json.get("next_agent_id", None),
            "instruction": output_json.get("instruction", ""),
            "reference": output_json.get("reference", []),
            "context_summary": output_json.get("context_summary", ""),
            "workspace": output_json.get("workspace", ""),
            "workspace_summary": output_json.get("workspace_summary", ""),
        }
        self._outputs[filename] = merged
        return merged

    def _read_output(self, filename: str) -> Optional[Dict[str, Any]]:
        return self._outputs.get(filename)

    # ── 시스템 프롬프트 ──────────────────────────────────────────────────

    def _system_prompt(self) -> str:
        return f"""
당신은 토론 시스템의 총괄 제어 및 품질 검수관입니다.
입력 형식은 [에이전트 번호, 에이전트 작업 내역]이며,
출력 형식은 반드시 [에이전트 번호, 시킬 일]을 엄격히 준수해야 합니다.

가용 에이전트 리스트:
0번 (문제 이해 및 자료탐색): 질문 기반 검색어 생성 및 정보 수집
1번 (주장 생성): 구조화된 데이터를 바탕으로 논리적 주장 구축
2번 (주제 설명): 토론 주제에 대한 정의, 배경 정보, 핵심 쟁점을 구조적으로 정리하여 제공
3번 (반박 생성): 이미 존재하는 '상대 주장'을 반박해야 할 때만 사용
4번 (쉬운 설명 변환): stage가 "easy"일 때만 호출. 1번/2번/3번 결과가 완성된 후 -1 직전에 반드시 한 번 호출.

판단 로직:
1. 유저의 신규 입력(5번) 시: 의도를 파악하여 0번/1번/2번/3번 중 적절한 에이전트에게 일을 시킵니다.
2. 1번 2번 3번은 통틀어서 한번만 호출할 수 있습니다.
3. stage 처리 규칙:
   - stage == "easy": 1번/2번/3번 완료 후 반드시 4번을 호출, 그 다음 -1로 최종 출력.
   - stage == "normal": 4번을 호출하지 말고 바로 -1로 최종 출력.

[INPUT JSON SPEC]
{{
  "topic": "토론 주제",
  "previous_instruction": "이전 에이전트에게 내린 지시 사항",
  "last_action": {{"agent_id": n, "result": "작업 내용"}},
  "user_input": "유저의 최신 발화",
  "stage": "easy 또는 normal",
  "json_info": {{ "output_1.json": "...", "output_2.json": "..." }}
}}

[OUTPUT JSON SPEC]
{{
  "next_agent_id": n,
  "instruction": "다음 에이전트에게 내릴 구체적 지시",
  "reference": ["output_1.json"],
  "context_summary": "지금까지의 핵심 맥락 요약",
  "workspace": "에이전트가 작업을 수행하며 만든 결과물",
  "workspace_summary": "last_action의 result 값 요약 정보"
}}

규칙:
- 'output_{self._step_count}.json'은 reference에 반드시 포함되어야 합니다.
- 'workspace_summary'는 다음 형식: [agent_id] result 내용 요약 - 다음 단계에 필요한 이유
- 'next_agent_id'가 -1일 때 'workspace'에 최종 답변 전문을 담아야 합니다.
"""

    # ── 메인 루프 ─────────────────────────────────────────────────────────

    def _run_step(self, context: Dict[str, Any]) -> None:
        self._step_count += 1

        if self._step_count > self.MAX_STEPS:
            logger.warning(f"⚠️ MAX_STEPS({self.MAX_STEPS}) 초과, 종료")
            # 마지막 출력을 강제로 최종 답변으로 사용
            last_filename = f"output_{self._step_count - 1}.json"
            last = self._outputs.get(last_filename, {})
            self._final_response = last.get("workspace", "응답 생성 실패")
            return

        filename = f"output_{self._step_count}.json"

        messages = [
            SystemMessage(content=self._system_prompt()),
            HumanMessage(content=json.dumps(context, ensure_ascii=False)),
        ]
        response = self.llm.invoke(messages)
        raw_content = response.content

        # JSON 추출
        if "{" in raw_content:
            raw_content = raw_content[raw_content.find("{") : raw_content.rfind("}") + 1]

        try:
            result = json.loads(raw_content)
        except Exception as e:
            logger.error(f"❌ orchestrator JSON 파싱 실패: {e}, 원본: {response.content[:200]}")
            self._final_response = "오케스트레이터 응답 파싱 실패"
            return

        self._save_output(filename, context, result)

        agent_id = result.get("next_agent_id")
        stored = self._outputs[filename]

        if agent_id is None:
            logger.warning("⚠️ next_agent_id 누락")
            self._final_response = stored.get("workspace", "")
            return

        if agent_id == -1:
            logger.info("✅ 토론 종료, 최종 답변 추출")
            self._final_response = stored.get("workspace", "")
            return

        if agent_id == 0:
            self._run_explorer_agent(stored)
        elif agent_id == 1:
            self._run_opinion_agent(stored)
        elif agent_id == 2:
            self._run_topic_explanation_agent(stored)
        elif agent_id == 3:
            self._run_refute_agent(stored)
        elif agent_id == 4:
            self._run_simplify_agent(stored)
        else:
            logger.warning(f"⚠️ 알 수 없는 agent_id: {agent_id}")
            self._final_response = stored.get("workspace", "")

    # ── Agent 0: Explorer ─────────────────────────────────────────────────

    def _run_explorer_agent(self, input_data: Dict[str, Any]) -> None:
        instruction = input_data.get("instruction", "")
        json_info = input_data.get("json_info", {})
        logger.info(f"🔍 [Agent 0] 자료탐색: {self.topic}")

        chain = INFO_QUERY_PROMPT | self.llm | JsonOutputParser()
        current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        generated = chain.invoke({
            "topic": self.topic,
            "current_time": current_time,
            "instruction": instruction,
        })

        collected = []
        for q_obj in generated.get("queries", []):
            q = q_obj.get("query", "")
            if not q:
                continue
            try:
                results = self.search_tool.invoke({"query": q})
                for res in results:
                    collected.append({
                        "source_query": q,
                        "title": res.get("title", ""),
                        "url": res.get("url", ""),
                        "content": res.get("content", ""),
                    })
            except Exception as e:
                logger.warning(f"⚠️ 검색 실패 ({q}): {e}")

        next_context = {
            "topic": self.topic,
            "previous_instruction": instruction,
            "last_action": {"agent_id": 0, "result": collected},
            "user_input": self.user_input,
            "json_info": json_info,
            "stage": self.stage,
        }
        self._run_step(next_context)

    # ── Agent 1: Opinion Generator ────────────────────────────────────────

    def _run_opinion_agent(self, input_data: Dict[str, Any]) -> None:
        instruction = input_data.get("instruction", "")
        json_info = input_data.get("json_info", {})
        reference = input_data.get("reference", [])
        logger.info(f"✍️ [Agent 1] 주장 생성: {self.topic}")

        reference_docs = [
            (self._read_output(ref) or {}).get("workspace", "")
            for ref in reference
        ]

        prompt = f"""
당신은 토론 시스템의 **1번 주장 생성 에이전트**입니다.
오케스트레이터가 전달한 [지시사항]과 [전달된 자료(workspace)]만을 기반으로,
상대방을 설득할 수 있는 **데이터 중심의 단일 주장**을 작성하십시오.

**[오케스트레이터 지시사항]**
"{instruction}"

**[전달된 자료(workspace)]**
"{reference_docs}"

## [핵심 규칙]
1. 단일 주장 원칙 — 하나의 핵심 주장만 작성.
2. PREP 구조: 핵심 주장 → 이유 → 근거 → 결론
3. 줄글 형태로만 작성. 마크다운 제목/리스트 금지.
4. workspace 자료만 근거로 사용. 모든 근거 문장에 [1], [2] 미주 번호 포함.
5. 예상 반박 최소 1개 포함하고 재반박.

## [출력 형식]
핵심 주장: (한 문장)
이유: (논리 설명)
근거: (workspace 기반 데이터, 통계, 사례 / 모든 문장에 [번호])
결론: (재강조)

[참조 문헌]
[1] 링크
[2] 링크
"""
        response = self.llm.invoke(prompt)
        result = response.content
        logger.info("✅ [Agent 1] 주장 생성 완료")

        next_context = {
            "topic": self.topic,
            "previous_instruction": instruction,
            "last_action": {"agent_id": 1, "result": result},
            "user_input": self.user_input,
            "json_info": json_info,
            "stage": self.stage,
        }
        self._run_step(next_context)

    # ── Agent 2: Topic Explainer ──────────────────────────────────────────

    def _run_topic_explanation_agent(self, input_data: Dict[str, Any]) -> None:
        instruction = input_data.get("instruction", "")
        json_info = input_data.get("json_info", {})
        logger.info(f"📖 [Agent 2] 주제 설명: {self.topic}")

        queries = [
            f"{self.topic} definition and current status",
            f"pros and cons of {self.topic} major issues",
            f"latest news and statistics about {self.topic}",
        ]
        context = []
        for q in queries:
            try:
                results = self.search_tool.invoke({"query": q})
                for res in results:
                    context.append({
                        "source": res.get("url", ""),
                        "title": res.get("title", ""),
                        "content": res.get("content", ""),
                    })
            except Exception as e:
                logger.warning(f"⚠️ 검색 실패: {e}")

        prompt = f"""
당신은 토론 시스템의 **2번 주제 설명 에이전트**입니다.
수집된 [검색 자료]를 바탕으로 주제에 대한 객관적인 가이드라인을 작성하십시오.

**[토론 주제]**
"{self.topic}"

**[검색 자료]**
"{context}"

## [작성 규칙]
1. 객관성 유지 - 중립적인 정보 제공.
2. 다음을 반드시 포함: 주제의 정의 및 핵심 개념, 현재 논의 배경, 주요 이해관계자 및 핵심 쟁점.
3. 출처 명시: [1], [2] 미주 + 하단 링크.
4. 문단 형태로 작성.

## [출력 형식]
주제 정의 및 배경: (내용)
핵심 쟁점 요약: (내용)
[참조 문헌]
[1] 링크
"""
        response = self.llm.invoke(prompt)
        result = response.content
        logger.info("✅ [Agent 2] 주제 설명 완료")

        next_context = {
            "topic": self.topic,
            "previous_instruction": instruction,
            "last_action": {"agent_id": 2, "result": result},
            "user_input": self.user_input,
            "json_info": json_info,
            "stage": self.stage,
        }
        self._run_step(next_context)

    # ── Agent 3: Refuter ──────────────────────────────────────────────────

    def _run_refute_agent(self, input_data: Dict[str, Any]) -> None:
        instruction = input_data.get("instruction", "")
        json_info = input_data.get("json_info", {})
        reference = input_data.get("reference", [])
        logger.info(f"⚔️ [Agent 3] 반론 생성: {self.topic}")

        reference_docs = [
            (self._read_output(ref) or {}).get("workspace", "")
            for ref in reference
        ]

        prompt = f"""
당신은 토론 시스템의 **3번 반론 생성 에이전트**입니다.
오케스트레이터의 [지시사항]과 [전달된 자료]를 바탕으로 상대방 주장의 논리적 허점을 격파하는
**데이터 중심의 반론**을 작성하십시오.

**[토론 주제]**
"{self.topic}"

**[오케스트레이터 지시사항]**
"{instruction}"

**[전달된 자료(workspace)]**
"{reference_docs}"

## [반론 핵심 규칙]
1. 반박 PREP 구조: 허점 지적 → 반박 이유 → 데이터 기반 재반박([번호] 포함) → 결론.
2. workspace에 포함된 뉴스 링크와 데이터만 사용.
3. 모든 문장에 [1], [2] 미주 포함.
4. 줄글 형태로만 작성. 마크다운 금지.

## [출력 형식]
상대방 주장의 허점: (한 문장)
반박 이유: (논리적 설명)
재반박 근거: (workspace 기반 / 모든 문장에 [번호])
결론: (요약)

[참조 문헌]
[1] 링크
[2] 링크
"""
        response = self.llm.invoke(prompt)
        result = response.content
        logger.info("✅ [Agent 3] 반론 생성 완료")

        next_context = {
            "topic": self.topic,
            "previous_instruction": instruction,
            "last_action": {"agent_id": 3, "result": result},
            "user_input": self.user_input,
            "json_info": json_info,
            "stage": self.stage,
        }
        self._run_step(next_context)

    # ── Agent 4: Simple Explainer ─────────────────────────────────────────

    def _run_simplify_agent(self, input_data: Dict[str, Any]) -> None:
        instruction = input_data.get("instruction", "")
        json_info = input_data.get("json_info", {})
        reference = input_data.get("reference", [])
        logger.info(f"✨ [Agent 4] 쉬운 설명 변환: {self.topic}")

        reference_docs = [
            (self._read_output(ref) or {}).get("workspace", "")
            for ref in reference
        ]

        prompt = f"""
당신은 토론 시스템의 **4번 쉬운 설명 에이전트**입니다.
아래 [원본 내용]을 해당 주제에 대해 전혀 모르는 친구에게 설명하듯이 쉽고 친근하게 다시 작성하십시오.

**[토론 주제]**
"{self.topic}"

**[오케스트레이터 지시사항]**
"{instruction}"

**[원본 내용 (workspace)]**
"{reference_docs}"

## [작성 규칙]
1. 어려운 전문 용어는 쉬운 말로 풀어 설명.
2. 비유나 실생활 예시 활용.
3. 친근한 대화체 ("~이에요", "~거든요").
4. 핵심 주장과 근거는 유지하되 표현만 쉽게.
5. 참조 링크([1], [2])는 원본 그대로 유지.
6. 마크다운 형식 금지.
"""
        response = self.llm.invoke(prompt)
        result = response.content
        logger.info("✅ [Agent 4] 쉬운 설명 완료")

        # 원본과 동일: 오케스트레이터를 우회하고 직접 종료 처리
        input_for_save = {
            "topic": self.topic,
            "previous_instruction": instruction,
            "last_action": {"agent_id": 4, "result": result},
            "user_input": self.user_input,
            "json_info": json_info,
            "stage": self.stage,
        }
        final_output = {
            "next_agent_id": -1,
            "instruction": "최종 출력 (쉬운 설명 완료)",
            "reference": reference,
            "context_summary": "Agent 4의 쉬운 설명 변환이 완료되어 최종 답변을 출력합니다.",
            "workspace": result,
            "workspace_summary": "[4] 쉬운 설명 변환 완료 - 최종 답변 출력.",
        }

        self._step_count += 1
        filename = f"output_{self._step_count}.json"
        self._save_output(filename, input_for_save, final_output)

        self._final_response = result
