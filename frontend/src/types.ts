export interface DebateMessage {
  id?: number; // 백엔드 Message 모델의 ID (선택적)
  discussion_id?: number; // 백엔드 Message 모델의 session_id (선택적)
  role: 'agent' | 'user' | 'moderator';
  agentName?: string; // 에이전트 이름 (프론트엔드 표시용, 선택적)
  side?: 'pro' | 'con' | 'neutral'; // 토론 입장 (프론트엔드 표시용, 선택적)
  content: string;
  timestamp: string; // 메시지 시간 (프론트엔드 포맷용)
  round?: number; // 토론 라운드 (프론트엔드 관리용, 선택적)
}

export type View = 'home' | 'about' | 'setup' | 'debate' | 'result' | 'faq' | 'search' | 'profile' | 'login' | 'signup' | 'pre-quiz' | 'post-quiz';

export interface UserData {
  id: number; // 사용자 고유 ID
  username: string; // 사용자 이름 (백엔드 username)
  email: string;
  nickname: string;
  is_guest?: boolean; // 게스트 여부 (선택적)
  level?: number; // 사용자 레벨 (선택적)
  experience_points?: number; // 사용자 경험치 (선택적)
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

// 백엔드 Search API 응답 항목 타입
export interface SearchDebateItem {
  id: number; // 토론 세션 ID
  topic: string; // 토론 주제 (백엔드 topic)
  stance: string; // 사용자의 입장 (찬성/반대)
  author: string; // 토론 생성자 (현재는 'anonymous')
  viewCount: number; // 조회수 (백엔드 messageCount를 활용)
  messageCount: number; // 메시지 수
  createdAt: string; // 생성일시 (ISO 8601 형식)
  updatedAt: string; // 최종 업데이트 일시 (ISO 8601 형식)
}
