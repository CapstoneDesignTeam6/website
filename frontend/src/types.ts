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

// ─── 퀴즈 관련 ────────────────────────────────────────────────────────────────

export interface QuizOption {
  id: number;
  text: string;
}

export interface Quiz {
  id: number;
  topic: string;
  question: string;
  options: QuizOption[];
  correctOptionId: number;
  explanation: string;
}

// ─── 토론 관련 ────────────────────────────────────────────────────────────────

export type MessageRole = 'agent' | 'user';
export type DebateSide = string;
export type SpeechType = 'argument' | 'rebuttal' | 'counter-rebuttal';
export type Difficulty = 'easy' | 'normal';
export type ResponseSpeed = 'fast' | 'slow';

export interface DebateMessage {
  id?: number; // 게스트 모드일 경우 백엔드에서 ID가 없을 수 있음
  discussion_id?: number;
  role: MessageRole;
  agentName?: string;
  side?: DebateSide;
  speechType?: SpeechType; // 주장, 반박, 재반박
  content: string;
  timestamp: string;
  round?: number;
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
  used?: boolean;
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

