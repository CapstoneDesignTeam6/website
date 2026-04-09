import { DebateMessage, UserData } from '../types';

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
  start: async (topic: string) => {
    const res = await fetch('/api/debate/start', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic }),
    });
    return res.json();
  },
  sendMessage: async (topic: string, message: string, history: DebateMessage[]) => {
    const res = await fetch('/api/debate/message', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, message, history }),
    });
    return res.json();
  },
  analyze: async (topic: string, messages: DebateMessage[]) => {
    const res = await fetch('/api/debate/analyze', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, messages }),
    });
    return res.json();
  },
  getTrending: async () => {
    const res = await fetch('/api/debates/trending', {
      headers: getHeaders(),
    });
    return res.json();
  },
  search: async (query: string) => {
    const url = query 
      ? `/api/debates/search?q=${encodeURIComponent(query)}` 
      : '/api/debates/search';
    const res = await fetch(url, {
      headers: getHeaders(),
    });
    return res.json();
  },
  getQuiz: async (topic: string) => {
    const res = await fetch(`/api/debate/quiz?topic=${encodeURIComponent(topic)}`, {
      headers: getHeaders(),
    });
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
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
    }
    return data;
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
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
    }
    return data;
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
  },
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  }
};
