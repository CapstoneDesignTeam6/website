import { DebateMessage, UserData } from '../types';

export const debateApi = {
  start: async (topic: string) => {
    const res = await fetch('/api/debate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });
    return res.json();
  },
  sendMessage: async (topic: string, message: string, history: DebateMessage[]) => {
    const res = await fetch('/api/debate/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, message, history }),
    });
    return res.json();
  },
  analyze: async (topic: string, messages: DebateMessage[]) => {
    const res = await fetch('/api/debate/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, messages }),
    });
    return res.json();
  },
  getTrending: async () => {
    const res = await fetch('/api/debates/trending');
    return res.json();
  },
  search: async (query: string) => {
    const url = query 
      ? `/api/debates/search?q=${encodeURIComponent(query)}` 
      : '/api/debates/search';
    const res = await fetch(url);
    return res.json();
  },
  getQuiz: async (topic: string) => {
    const res = await fetch(`/api/debate/quiz?topic=${encodeURIComponent(topic)}`);
    return res.json();
  }
};

export const userApi = {
  login: async (email: string, password: string) => {
    const res = await fetch('/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '로그인에 실패했습니다.');
    }
    return res.json();
  },
  signup: async (email: string, password: string, nickname: string) => {
    const res = await fetch('/api/user/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '회원가입에 실패했습니다.');
    }
    return res.json();
  }
};
