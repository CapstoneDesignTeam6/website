import { DebateMessage, UserData, DiscussionSummaryResponse, UserEvaluationScore, Difficulty, ResponseSpeed, RelatedMaterial } from '../types';
import type { DebateTopic } from '../types';
import type { AgentStep } from '../types';
import { MOCK_RELATED_MATERIALS, MOCK_TOPICS, MOCK_DEBATE_SUMMARY, MOCK_USER_EVALUATION_SCORE } from '../mockData';

// 로컬 스토리지에 저장되는 인증 토큰 키
const TOKEN_KEY = 'agora_token';

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const debateApi = {
  // ─── 주제 탐색 관련 (DebateTopic) ────────────────────────────────────────────
  getTrending: async (): Promise<DebateTopic[]> => {
    try {
      const res = await fetch('/api/debates/trending', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (_) { /* 실패 시 목 데이터 반환 */ }
    return MOCK_TOPICS;
  },
  search: async (query: string): Promise<DebateTopic[]> => {
    try {
      const url = query
        ? `/api/debates/search?q=${encodeURIComponent(query)}`
        : '/api/debates/search';
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data: DebateTopic[] = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (_) { /* 실패 시 목 데이터 반환 */ }
    return query ? MOCK_TOPICS.filter(d => d.title.includes(query)) : MOCK_TOPICS;
  },

  // ─── 퀴즈 관련 (Quiz) ────────────────────────────────────────────────────────
  getQuiz: async (topic: string) => {
    const res = await fetch(`/api/debate/quiz?topic=${encodeURIComponent(topic)}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // ─── 토론 관련 (DebateMessage, AgentStep, RelatedMaterial, UserEvaluationScore) ──
  start: async (topic: string, difficulty?: Difficulty, responseSpeed?: ResponseSpeed): Promise<DebateMessage> => {
    const res = await fetch('/api/debate/start', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, difficulty, response_speed: responseSpeed }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to start debate: ${res.status} ${res.statusText} - ${errorText}`);
    }
    return res.json();
  },
  sendMessage: async (topic: string, message: string, history: DebateMessage[], discussionId?: number | null, roundNumber?: number, difficulty?: Difficulty, responseSpeed?: ResponseSpeed): Promise<{ userSide: string; aiResponse: DebateMessage; used_material_urls?: string[]; agent_steps?: AgentStep[] }> => {
    const res = await fetch('/api/debate/message', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, message, history, discussion_id: discussionId ?? null, round_number: roundNumber ?? 1, difficulty, response_speed: responseSpeed }),
    });
    return res.json();
  },
  getCounterHint: async (discussionId: number) => {
    const res = await fetch(`/api/debate/${discussionId}/counter-hint`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },
  getRebuttalHint: async (discussionId: number) => {
    const res = await fetch(`/api/debate/${discussionId}/rebuttal-hint`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },
  getRelatedMaterials: async (topic: string): Promise<RelatedMaterial[]> => {
    try {
      const res = await fetch(`/api/debates/related-materials?topic=${encodeURIComponent(topic)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      const data: RelatedMaterial[] = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      return MOCK_RELATED_MATERIALS as RelatedMaterial[];
    } catch (_) {
      return MOCK_RELATED_MATERIALS as RelatedMaterial[];
    }
  },
  getUserEvaluation: async (discussionId: number): Promise<UserEvaluationScore> => {
    try {
      const res = await fetch(`/api/debate/${discussionId}/evaluation`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      return res.json();
    } catch (_) {
      return MOCK_USER_EVALUATION_SCORE;
    }
  },

  // ─── 결과 보고서 관련 (DiscussionSummaryResponse) ─────────────────────────────
  analyze: async (topic: string, messages: DebateMessage[], discussionId?: number | null): Promise<DiscussionSummaryResponse> => {
    try {
      const res = await fetch('/api/debate/analyze', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ topic, messages, discussion_id: discussionId ?? null }),
      });
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error("Failed to analyze debate, using mock data:", error);
      return MOCK_DEBATE_SUMMARY;
    }
  },
};

export const userApi = {
  login: async (email: string, password: string): Promise<{ access_token: string; token_type: string; user: UserData }> => { // 로그인 API
    const res = await fetch('/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '로그인에 실패했습니다.');
    }
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      // 백엔드에서 username을 nickname으로 사용하도록 처리
      if (data.user && !data.user.nickname) {
        data.user.nickname = data.user.username;
      }
    }    return data;
  },
  signup: async (email: string, password: string, username: string): Promise<{ access_token: string; token_type: string; user: UserData }> => { // 회원가입 API
    const res = await fetch('/api/user/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username: username }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '회원가입에 실패했습니다.');
    }
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      if (data.user && !data.user.nickname) {
        data.user.nickname = data.user.username;
      }
    }
    return data;
  },
  logout: () => { // 로그아웃
    localStorage.removeItem(TOKEN_KEY);
  },
  getToken: () => { // 토큰 가져오기
    return localStorage.getItem(TOKEN_KEY);
  },
  getCurrentUser: async (): Promise<UserData> => {
    const res = await fetch('/api/auth/me', { // 백엔드 @router.get("/me") 경로
      method: 'GET',
      headers: getHeaders(), // Authorization 헤더가 포함된 공통 헤더 사용
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '사용자 정보를 불러오지 못했습니다.');
    }

    return res.json(); // UserDetailResponse 반환
  }
  
};
