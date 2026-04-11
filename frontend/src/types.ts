export interface DebateMessage {
  role: 'agent' | 'user' | 'moderator';
  agentName?: string;
  side: 'pro' | 'con' | 'neutral';
  content: string;
  timestamp: string;
  round?: number;
}

export type View = 'home' | 'about' | 'setup' | 'debate' | 'result' | 'faq' | 'search' | 'profile' | 'login' | 'signup' | 'pre-quiz' | 'post-quiz';

export interface UserData {
  email: string;
  nickname: string;
}

export interface DebateTopic {
  id: number;
  category: string;
  isHot: boolean;
  title: string;
  description: string;
  participants: number;
}

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
