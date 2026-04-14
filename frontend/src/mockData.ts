// frontend/src/mockData.ts
import { DebateMessage } from './types'; // DebateMessage 타입 임포트

// 목(mock) 관련 자료 데이터
export const MOCK_RELATED_MATERIALS = [
  { 
    category: "경제", 
    color: "text-blue-600", // 카테고리 색상
    title: "주 4일 근무제, 생산성 향상과 기업 비용 부담 사이", // 주 4일 근무제 관련 뉴스 제목
    desc: "최근 연구에 따르면 주 4일 근무제 도입 시 근로자 만족도와 생산성이 증가하는 경향을 보였으나, 일부 기업에서는 추가 인력 고용 및 운영 비용 증가에 대한 우려를 표명했습니다.", // 뉴스 설명
    source: "경제신문" // 뉴스 출처
  },
  { 
    category: "사회", 
    color: "text-emerald-600",
    title: "근로자 삶의 질 향상 기대, 여가 산업 성장 견인", // 주 4일 근무제 관련 뉴스 제목
    desc: "주 4일 근무제는 근로자에게 더 많은 여가 시간을 제공하여 개인의 삶의 질을 높이고, 이는 여행, 문화, 레저 등 여가 관련 산업의 성장을 촉진할 것으로 기대됩니다.", // 뉴스 설명
    source: "사회연구소" // 뉴스 출처
  },
  { 
    category: "정책", 
    color: "text-orange-600",
    title: "정부, 주 4일 근무제 시범 사업 확대 검토", // 주 4일 근무제 관련 뉴스 제목
    desc: "정부는 주 4일 근무제의 사회적 파급 효과를 면밀히 분석하기 위해 공공 부문 및 민간 기업을 대상으로 한 시범 사업을 확대하는 방안을 검토 중이며, 법적, 제도적 기반 마련에 나설 예정입니다.", // 뉴스 설명
    source: "정책브리핑" // 뉴스 출처
  }
];

// 목(mock) 토론 전 퀴즈 데이터
export const MOCK_PRE_DEBATE_QUIZ = {
  id: 1, // 퀴즈 ID (고유 식별자)
  topic: "주 4일 근무제, 생산성 향상인가 효율 저하인가?", // 이 퀴즈가 속한 토론 주제의 제목
  question: "주 4일 근무제 도입에 대한 다음 설명 중 가장 적절하지 않은 것은 무엇입니까?", // 주 4일 근무제 관련 질문
  options: [
    { id: 1, text: "생산성 향상과 근로자 만족도 증가를 기대할 수 있습니다." }, // 보기 1
    { id: 2, text: "기업의 인건비 부담이 증가하고 서비스 품질 저하로 이어질 수 있습니다." }, // 보기 2
    { id: 3, text: "모든 산업 분야에 일률적으로 적용하기 용이하며, 즉각적인 긍정적 효과를 가져옵니다." }, // 보기 3 (정답)
    { id: 4, text: "여가 시간 증가로 인한 소비 활성화 및 지역 경제 발전 가능성이 있습니다." }, // 보기 4
  ],
  correctOptionId: 3, // 정답 옵션 ID
  explanation: "주 4일 근무제는 산업 특성상 모든 분야에 일률적으로 적용하기 어렵고, 도입 초기에는 생산성 저하 등의 부작용이 발생할 수 있어 신중한 접근이 필요합니다. 즉각적인 긍정적 효과를 보장하기는 어렵습니다." // 정답 해설
};

// 목(mock) 토론 후 퀴즈 데이터
export const MOCK_POST_DEBATE_QUIZ = {
  id: 2, // 퀴즈 ID (고유 식별자)
  topic: "주 4일 근무제, 생산성 향상인가 효율 저하인가?", // 이 퀴즈가 속한 토론 주제의 제목
  question: "주 4일 근무제 도입 시 예상되는 긍정적 효과와 부정적 효과에 대한 설명으로 가장 적절한 조합은 무엇입니까?", // 주 4일 근무제 관련 심화 질문
  options: [
    { id: 1, text: "긍정: 생산성 향상 / 부정: 기업 경쟁력 약화" }, // 보기 1 (정답)
    { id: 2, text: "긍정: 근로자 만족도 증가 / 부정: 임금 감소" }, // 보기 2
    { id: 3, text: "긍정: 환경 개선 / 부정: 서비스 산업 혼란" }, // 보기 3
    { id: 4, text: "긍정: 고용 창출 / 부정: 노동 강도 심화" }, // 보기 4
  ],
  correctOptionId: 1, // 정답 옵션 ID
  explanation: "주 4일 근무제는 근로자의 집중도 향상으로 생산성 증대를 기대할 수 있지만, 동시에 기업 입장에서는 고정 비용 증가 및 운영 효율성 저하로 경쟁력 약화를 우려할 수 있습니다. 임금 감소는 반드시 수반되는 것은 아니며, 환경 개선은 간접적인 효과, 고용 창출 및 노동 강도 심화는 복합적인 요인에 따라 달라질 수 있습니다." // 정답 해설
};

// 목(mock) 토론 데이터
export const MOCK_TOPICS = [
  {
    id: 101,
    title: "기본소득제 도입, 과연 필요한가?",
    description: "모든 국민에게 조건 없이 일정 금액을 지급하는 기본소득제 도입에 대한 찬반 논쟁입니다. 경제적 효과와 사회적 파급력을 중심으로 토론해봅시다.",
    category: "경제",
    isHot: true,
    participants: 150
  },
  {
    id: 102,
    title: "주 4일 근무제, 생산성 향상인가 효율 저하인가?",
    description: "근무 시간을 단축하는 주 4일 근무제가 기업의 생산성과 근로자의 삶의 질에 미치는 영향에 대해 논의합니다. 국내외 사례를 통해 장단점을 분석해봅시다.",
    category: "사회",
    isHot: false,
    participants: 80
  },
  {
    id: 103,
    title: "AI 창작물, 저작권 보호의 대상이 될 수 있는가?",
    description: "인공지능이 생성한 그림, 음악, 글 등 창작물에 대한 저작권 인정 여부를 두고 법적, 윤리적 논쟁이 뜨겁습니다. AI 시대의 창작 개념을 재정의해봅시다.",
    category: "기술",
    isHot: true,
    participants: 210
  }
];

// 목(mock) 토론 ID
export const MOCK_DISCUSSION_ID = 999; // 임시 토론 ID

// 목(mock) 토론 메시지 데이터 (토론 시작 실패 시 사용)
export const MOCK_DEBATE_MESSAGES: DebateMessage[] = [
  {
    id: 1,
    discussion_id: MOCK_DISCUSSION_ID,
    role: 'user',
    content: '주 4일 근무제 도입에 찬성합니다. 근로자의 삶의 질 향상과 생산성 증대에 기여할 것입니다.',
    timestamp: '10:00',
    agentName: '나 (사용자)',
    side: 'pro',
    round: 1,
  },
  {
    id: 2,
    discussion_id: MOCK_DISCUSSION_ID,
    role: 'agent',
    content: '주 4일 근무제 도입은 기업의 운영 비용 증가와 서비스 품질 저하를 초래할 수 있습니다. 특히 특정 산업에서는 인력 부족 문제가 심화될 수 있습니다.',
    timestamp: '10:02',
    agentName: '논리적 비판가',
    side: 'con',
    round: 1,
  },
  {
    id: 3,
    discussion_id: MOCK_DISCUSSION_ID,
    role: 'user',
    content: '하지만 근로자의 만족도가 높아지면 이직률이 감소하고, 이는 장기적으로 기업의 생산성 향상으로 이어질 수 있습니다.',
    timestamp: '10:05',
    agentName: '나 (사용자)',
    side: 'pro',
    round: 2,
  },
  {
    id: 4,
    discussion_id: MOCK_DISCUSSION_ID,
    role: 'agent',
    content: '새로운 관점에서 접근한다면, 주 4일 근무제를 전면 도입하기보다 유연근무제나 선택적 근로시간제를 확대하여 기업과 근로자 모두에게 이점을 줄 수 있는 방안을 모색하는 것이 어떨까요?',
    timestamp: '10:07',
    agentName: '창의적 대안제시자',
    side: 'neutral',
    round: 2,
  },
];