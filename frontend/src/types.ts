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
  side_a?: string;
  side_b?: string;
  related_news?: string[];
}

// ─── 배경 요약 관련 ──────────────────────────────────────────────────────────

export interface BackgroundSummary {
  topic: string;
  summary: string;
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
/**
 * 토론 진행 단계 (turn)
 * 0: 시작 → 주제 설명 생성
 * 1: 사용자 주장 → 에이전트 반박
 * 2: 사용자 재반박 → 에이전트 주장 생성
 * 3: 사용자 반박 → 에이전트 재반박
 * 3까지 끝나면 1라운드 종료 -> 다시 1부터 반복
 */
export type Turn = 0 | 1 | 2 | 3;
export type Difficulty = 'easy' | 'normal';

export interface DebateMessage {
  id?: number; // 게스트 모드일 경우 백엔드에서 ID가 없을 수 있음
  discussion_id?: number;
  role: MessageRole; // 에이전트, 사용자 구분
  agentName?: string;
  side?: DebateSide; // 입장 구분
  turn?: Turn; // 0=시작, 1=에이전트 반박, 2=에이전트 주장 생성, 3=에이전트 재반박
  round?: number; // ui 표시용(api에 사용 X)
  content: string;
  timestamp: string;
  difficulty?: Difficulty; // 쉬운 모드 선택
}

export type AgentStepType = 'orchestrator' | 'search' | 'generate' | 'simplify';
export type AgentStepStatus = 'pending' | 'running' | 'done';

export interface AgentStep {
  // 에이전트 사고 과정
  step: AgentStepType;
  label: string;
  description: string;
  status: AgentStepStatus;
}

export interface RelatedMaterial {
  // 관련 자료, 주장 생성에 사용
  category: string;
  color: string;
  title: string;
  description: string;
  source: string;
  url?: string;
  used?: boolean; // 에이전트 주장 생성 사용 여부
}

export interface UserEvaluationScore {
  // 사용자 평가 점수
  specificity: number;
  understanding: number;
  logic: number;
  informativeness: number;
  bias: number;
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
}

// ─── 토론 기록 관련 ───────────────────────────────────────────────────────────

export interface DiscussionHistoryItem {
  id: number;
  title: string;
  topic: string;
  score: number;
  exp_earned: number;
  created_at: string;
  completed_at: string | null;
}

// ─── 회원정보 관련 ────────────────────────────────────────────────────────────

export interface UserData {
  id: number;
  username: string;
  email: string;
  nickname: string;
  is_guest?: boolean;
  level?: number;
  experience_points?: number;
}

