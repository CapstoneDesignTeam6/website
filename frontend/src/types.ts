export type View = 'home' | 'setup' | 'debate' | 'result' | 'faq' | 'search' | 'profile' | 'login' | 'signup' | 'pre-quiz' | 'post-quiz';

// ─── HomeView  관련 ───────────────────────────────────────────────────────────

export interface HeroSlide {
  tag: string;
  id?: string;
  title: string;
  description: string;
  color: string;
  isAboutAgora: boolean;
}

// ─── 주제 탐색 관련 ───────────────────────────────────────────────────────────

export interface DebateTopic {
  id: number;
  category: string;
  isHot: boolean;
  title: string;
  description: string;
  participants: number;
  createdAt?: string;
  side_a?: string;
  side_b?: string;
  related_news?: string[];
}

// ─── 퀴즈 관련(객관식만 사용중 ) ─────────────────────────────────────────────

export type QuizPhase = 'pre' | 'post';
export type QuizType = 'ox' | 'subjective' | 'multiple-choice';

interface QuizBase {
  id: number;
  topic: string;
  question: string;
  explanation: string;
  phase: QuizPhase;
}

export interface OXQuiz extends QuizBase {
  type: 'ox';
  correctAnswer: 'O' | 'X';
}

export interface SubjectiveQuiz extends QuizBase {
  type: 'subjective';
  hint?: string;
}

export interface MultipleChoiceQuiz extends QuizBase {
  type: 'multiple-choice';
  options: string[];
  correctIndex: number;
}

export type Quiz = OXQuiz | SubjectiveQuiz | MultipleChoiceQuiz;

export interface QuizSet {
  ox: OXQuiz[];
  subjective: SubjectiveQuiz[];
  multipleChoice: MultipleChoiceQuiz[];
}

export interface SubjectiveAnswer {
  quiz: SubjectiveQuiz;
  userAnswer: string;
}

export interface SubjectiveEvaluationResult {
  questionIndex: number;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface SubjectiveEvaluationResponse {
  results: SubjectiveEvaluationResult[];
  totalScore: number;
  maxTotalScore: number;
}

// ─── 토론 관련 ────────────────────────────────────────────────────────────────

export type MessageRole = 'agent' | 'user';
export type DebateSide = string;
/*
토론 진행 단계 (turn)
0: 시작 → 주제 설명 생성
1: 사용자 주장 → 에이전트 반박
2: 사용자 재반박 → 에이전트 주장 생성
3: 사용자 반박 → 에이전트 재반박
turn이 3이 되면 1라운드 종료 -> 다시 1부터 반복
 */
export type Turn = 0 | 1 | 2 | 3;
export type Difficulty = 'easy' | 'normal';

export interface DebateMessage {
  id?: number; // 게스트 모드일 경우 백엔드에서 ID가 없을 수 있음
  discussion_id: number; // 게스트 모드여도 토론 세션 식별을 위해 필요
  role: MessageRole; // 에이전트, 사용자 구분
  side?: DebateSide; // 입장 구분
  turn: Turn; // 0=시작, 1=에이전트 반박, 2=에이전트 주장 생성, 3=에이전트 재반박
  round?: number; // ui 표시용(api에 사용 X)
  content: string;
  timestamp: string;
  difficulty?: Difficulty; // 쉬운 모드 선택
}

export type AgentStepType = 'orchestrator' | 'search' | 'generate' | 'simplify';
export type AgentStepStatus = 'pending' | 'running' | 'done';

export interface AgentStepData {
  // _steps_cache 엔트리의 원본 데이터
  agent_id: number;           // last_action.agent_id
  instruction?: string;       // 오케스트레이터가 내린 지시
  workspace_summary?: string; // 해당 스텝 작업 요약
  context_summary?: string;   // 누적 맥락 요약
  next_agent_id?: number;     // 오케스트레이터 판단 결과
  reference?: string[];       // 참조 문서 목록
}

export interface AgentStep {
  // 에이전트 사고 과정
  step: AgentStepType;
  status: AgentStepStatus;
  data?: AgentStepData;       // _steps_cache에서 온 상세 데이터
}

export interface RelatedMaterial {
  // 관련 자료, 주장 생성에 사용
  category: string;
  color: string;
  title: string;
  description: string;
  source: string;
  url: string;
  used?: boolean; // 에이전트 주장 생성 사용 여부
}

export interface MetricScore {
  score: number;       // 1~5 점수
  reason: string;      // 점수 이유
  evidence: string;    // 발언에서 근거가 된 실제 문구
}

export interface DomainBreadthScore extends MetricScore {
  domain_keywords: string[]; // 발언에서 등장한 도메인 키워드 (1~3개)
}

export interface ConceptualAccuracyScore extends MetricScore {
  errors: string | null; // 오용된 개념 설명 (없으면 null)
}

// 사용자 발언 실시간 평가 점수 (scoring_agent 반환값)
export interface UserEvaluationScore {
  specificity: MetricScore;           // 발언 구체성: 수치·사례·출처의 정밀도
  causality: MetricScore;             // 인과 연결: 원인-결과-함의 연결 깊이
  domain_breadth: DomainBreadthScore; // 도메인 폭: 한 발언 안에서 넘나드는 영역의 수
  information_autonomy: MetricScore;  // 정보 자립도: 스스로 구성한 정보 비율
  conceptual_accuracy: ConceptualAccuracyScore; // 개념 정확도: 전문용어·고유명사의 정확한 사용
  total?: number;                     // 5개 지표 합계 (5~25)
}

// ─── 결과 보고서 관련 ─────────────────────────────────────────────────────────

export interface DiscussionSummaryResponse {
  summary: string;
  issues: string;
  logic_feedback: string;
  extra_info: string;
  pre_quiz_correct?: boolean;
  pre_quiz_explanation?: string;
  post_quiz_correct?: boolean;
  post_quiz_explanation?: string;
  quiz_comparison?: string;
  // 메타 정보
  difficulty?: string;
  pre_quiz_score?: number;
  pre_quiz_count?: number;
  post_quiz_score?: number;
  post_quiz_count?: number;
  score_avg?: number;
}

// ─── 토론 기록 관련 ───────────────────────────────────────────────────────────

export interface DiscussionHistoryItem {
  id: number;
  topic: string;
  difficulty: string;
  has_report: boolean;
  created_at: string;
}

// ─── 회원정보 관련 ────────────────────────────────────────────────────────────

export interface UserData {
  id: number;
  username: string;
  email: string;
  nickname: string;
  is_guest?: boolean;
}

