import { DebateMessage, UserData, DiscussionSummaryResponse, UserEvaluationScore, RelatedMaterial, DiscussionHistoryItem, MultipleChoiceQuiz, BackgroundSummary } from '../types';
import type { DebateTopic } from '../types';
import type { AgentStep } from '../types';
import { MOCK_RELATED_MATERIALS, MOCK_TOPICS, MOCK_DEBATE_SUMMARY, MOCK_USER_EVALUATION_SCORE, MOCK_PRE_QUIZ_MC, MOCK_POST_QUIZ_MC } from '../mockData';

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
        const json = await res.json();
        // 백엔드가 { code, message, data: [...] } 형태로 반환하는 경우 처리
        const rows: { id?: number; topic?: string; title?: string; description?: string; category?: string; isHot?: boolean; participants?: number; createdAt?: string }[] =
          Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        if (rows.length > 0) {
          return rows.map((row, i) => ({
            id: row.id ?? i,
            category: row.category ?? '사회',
            isHot: row.isHot ?? false,
            title: row.title ?? row.topic ?? '',
            description: row.description ?? '',
            participants: row.participants ?? 0,
            createdAt: row.createdAt ?? '',
          }));
        }
      }
    } catch (_) { /* 실패 시 목 데이터 반환 */ }
    return query ? MOCK_TOPICS.filter(d => d.title.includes(query)) : MOCK_TOPICS;
  },

  // ─── 배경 요약 관련 (BackgroundSummary) — QuizView 전용, 현재 미사용 ──────────
  // QuizView.tsx는 라우팅에서 제외되어 사용되지 않으므로 주석 처리
  getBackgroundSummary: async (topic: string): Promise<BackgroundSummary> => {
    try {
      const res = await fetch(`/api/debate/background?topic=${encodeURIComponent(topic)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      return res.json();
    } catch (_) {
      return { topic, summary: '' };
    }
  },

  // ─── 퀴즈 관련 (Quiz) ────────────────────────────────────────────────────────
  getQuizSet: async (topic: string, phase: 'pre' | 'post', discussionId?: number | null): Promise<MultipleChoiceQuiz[]> => {
    try {
      const params = new URLSearchParams({ topic, phase });
      if (discussionId != null) params.set('discussion_id', String(discussionId));
      const res = await fetch(
        `/api/debate/quiz/set?${params.toString()}`,
        { headers: getHeaders() },
      );
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      return phase === 'pre' ? MOCK_PRE_QUIZ_MC : MOCK_POST_QUIZ_MC;
    } catch (_) {
      return phase === 'pre' ? MOCK_PRE_QUIZ_MC : MOCK_POST_QUIZ_MC;
    }
  },

  // ─── 토론 관련 (DebateMessage, AgentStep, RelatedMaterial, UserEvaluationScore) ──
  //
  // sendMessage 호출 패턴:
  //   turn=0 (주제 요약): message='{topic}에 대한 토론을 수행할거야. 주제에 대한 설명을 해줘', history=[], discussionId=null
  //   turn=1~3 (토론):    message=사용자입력, history=누적메시지, discussionId=받은ID
  sendMessage: async (
    topic: string,
    message: string,
    history: DebateMessage[],
    discussionId: number | null,
    difficulty?: DebateMessage['difficulty'],
    turn?: DebateMessage['turn'],
    onStep?: (step: AgentStep) => void,
  ): Promise<{ userSide: string; aiResponse: DebateMessage; used_materials?: string[]; agent_steps?: AgentStep[] }> => {
    const res = await fetch('/api/debate/message', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, message, history, discussion_id: discussionId ?? null, difficulty, turn: turn ?? 0 }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const contentType = res.headers.get('content-type') ?? '';

    // SSE 스트림 처리
    if (contentType.includes('text/event-stream')) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: { userSide: string; aiResponse: DebateMessage; used_materials?: string[]; agent_steps?: AgentStep[] } | null = null;
      const steps: AgentStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const event = JSON.parse(raw);
            if (event.type === 'step') {
              const step: AgentStep = { step: event.step, status: event.status, data: event.data };
              steps.push(step);
              onStep?.(step);
            } else if (event.type === 'result') {
              result = {
                userSide: event.userSide,
                aiResponse: event.aiResponse,
                used_materials: event.used_materials,
                agent_steps: steps,
              };
            }
          } catch { /* JSON 파싱 실패 시 무시 */ }
        }
      }

      if (!result) throw new Error('SSE stream ended without result');
      return result;
    }

    // 기존 JSON 응답 (백엔드 미전환 시 폴백)
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
  getRelatedMaterials: async (topic: string, discussionId?: number | null): Promise<RelatedMaterial[]> => {
    try {
      const params = new URLSearchParams({ topic });
      if (discussionId) params.set('discussion_id', String(discussionId));
      const res = await fetch(`/api/debates/related-materials?${params.toString()}`, {
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
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '사용자 정보를 불러오지 못했습니다.');
    }

    return res.json();
  },
  getDiscussionHistory: async (skip = 0, limit = 20): Promise<DiscussionHistoryItem[]> => {
    const res = await fetch(`/api/debate/?skip=${skip}&limit=${limit}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
};
