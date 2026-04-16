import { DebateMessage, UserData, SearchDebateItem, DiscussionSummaryResponse } from '../types'; // DiscussionSummaryResponse 타입 임포트
import { MOCK_RELATED_MATERIALS, MOCK_TOPICS, MOCK_DEBATE_SUMMARY } from '../mockData'; // MOCK_DEBATE_SUMMARY 임포트
 
// 관련 자료 항목 타입 (백엔드 RelatedMaterialSchema와 일치)
interface RelatedMaterial {
  category: string; // 자료의 카테고리 (예: 경제, 사회, 기술)
  color: string; // 프론트엔드에서 사용할 색상 클래스 (예: text-blue-600)
  title: string; // 자료의 제목
  description: string; // 자료의 상세 설명
  source: string; // 자료의 출처
  url?: string; // 원문 링크 (선택)
}

// 백엔드 Trending API 응답 항목 타입
interface TrendingTopicResponse {
  id: number;
  category: string;
  isHot: boolean;
  title: string; // 토론 주제 제목
  description: string; // 토론 주제 설명
  participants: number; // 참여자 수
}

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
  start: async (topic: string): Promise<DebateMessage> => { // 토론 시작 API (DebateMessage를 반환하도록 타입 수정)
    const res = await fetch('/api/debate/start', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) { // API 응답이 성공적이지 않을 경우 (예: 500 Internal Server Error)
      // JSON 파싱을 시도하기 전에 오류를 처리합니다.
      const errorText = await res.text(); // 오류 메시지를 텍스트로 읽어옵니다.
      throw new Error(`Failed to start debate: ${res.status} ${res.statusText} - ${errorText}`);
    }
    return res.json(); // 성공적인 응답일 경우 JSON으로 파싱합니다.
  }, // 메시지 전송 API
  sendMessage: async (topic: string, message: string, history: DebateMessage[], discussionId?: number | null, roundNumber?: number): Promise<{ userSide: string; aiResponse: DebateMessage }> => {
    const res = await fetch('/api/debate/message', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic, message, history, discussion_id: discussionId ?? null, round_number: roundNumber ?? 1 }),
    });
    return res.json();
  },
  analyze: async (topic: string, messages: DebateMessage[], discussionId?: number | null): Promise<DiscussionSummaryResponse> => { // 토론 분석 API 반환 타입 변경
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
      return MOCK_DEBATE_SUMMARY; // API 호출 실패 시 목 데이터 반환
    }
  },
  getTrending: async (): Promise<TrendingTopicResponse[]> => { // 트렌딩 토론 목록 가져오기 API
    let realTopics: TrendingTopicResponse[] = [];
    try {
      const res = await fetch('/api/debates/trending', { headers: getHeaders() });
      if (res.ok) realTopics = await res.json();
    } catch (_) { /* 실패 시 빈 배열 유지 */ }

    // 주 4일 근무제 mock 주제를 맨 앞에 고정 (HomeView는 상위 2개만 슬라이드로 표시)
    const mockTopic = MOCK_TOPICS[1]; // id:102, 주 4일 근무제
    const alreadyExists = realTopics.some(t => t.title === mockTopic.title);
    return alreadyExists ? realTopics : [mockTopic, ...realTopics];
  },
  search: async (query: string): Promise<{ code: number; message: string; data: SearchDebateItem[] }> => { // 토론 검색 API
    const mockItem: SearchDebateItem = {
      id: MOCK_TOPICS[1].id,
      topic: MOCK_TOPICS[1].title,
      stance: '',
      author: 'anonymous',
      viewCount: MOCK_TOPICS[1].participants,
      messageCount: 0,
      createdAt: '',
      updatedAt: '',
    };

    let realData: SearchDebateItem[] = [];
    try {
      const url = query
        ? `/api/debates/search?q=${encodeURIComponent(query)}`
        : '/api/debates/search';
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        realData = json?.data ?? [];
      }
    } catch (_) { /* 실패 시 빈 배열 유지 */ }

    // 검색어가 있을 때: mock 주제가 검색어를 포함하면 결과에 추가
    const mockMatches = !query || mockItem.topic.includes(query);
    const alreadyExists = realData.some(d => d.topic === mockItem.topic);
    const data = (mockMatches && !alreadyExists)
      ? [mockItem, ...realData]
      : realData;

    return { code: 200, message: 'Success', data };
  },
  getQuiz: async (topic: string) => {
    const res = await fetch(`/api/debate/quiz?topic=${encodeURIComponent(topic)}`, {
      headers: getHeaders(),
    });
    return res.json();
  },
  getCounterHint: async (discussionId: number) => {
    const res = await fetch(`/api/debate/${discussionId}/counter-hint`, {
      method: 'POST',
      headers: getHeaders(),
      // 백엔드 구현에 따라 본문 필요 없음
    });
    return res.json();
  },
  getRebuttalHint: async (discussionId: number) => {
    const res = await fetch(`/api/debate/${discussionId}/rebuttal-hint`, {
      method: 'POST',
      headers: getHeaders(),
      // 백엔드 구현에 따라 본문 필요 없음
    });
    return res.json();
  },
  getRelatedMaterials: async (topic: string): Promise<RelatedMaterial[]> => { // 관련 자료 가져오기 API
    // 주 4일 근무제 주제는 mock 데이터 반환
    if (topic.includes('주 4일')) {
      return MOCK_RELATED_MATERIALS as RelatedMaterial[];
    }
    const res = await fetch(`/api/debates/related-materials?topic=${encodeURIComponent(topic)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch related materials: ${res.status} ${res.statusText} - ${errorText}`);
    }
    return res.json();
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
