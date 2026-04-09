export const MOCK_DEBATES = [
  {
    id: 1,
    category: "기술/AI",
    title: "인공지능의 시대, 인간의 창의성은 어디로 가는가?",
    description: "생성형 AI가 예술과 문학의 영역을 침범하고 있습니다. 우리는 기술을 도구로 받아들여야 할까요, 아니면 인간 고유의 영역을 보호해야 할까요?",
    participants: 1240,
    isHot: true
  },
  {
    id: 2,
    category: "경제/노동",
    title: "주 4일 근무제, 생산성의 혁신인가 단순한 사치인가?",
    description: "일과 삶의 균형을 넘어 실질적인 기업 운영 효율성에 대한 치열한 공방이 이어지고 있습니다. 생산성 향상과 비용 증가 사이의 균형을 논합니다.",
    participants: 850,
    isHot: true
  },
  {
    id: 3,
    category: "교육/사회",
    title: "디지털 네이티브, 스마트폰 제한은 필수인가 억압인가?",
    description: "아동 교육의 필수 요소로 떠오른 학교 내 기기 제한 정책에 대한 찬반 양론을 논합니다. 집중력 향상과 디지털 리터러시 교육 사이의 갈등입니다.",
    participants: 2100,
    isHot: false
  },
  {
    id: 4,
    category: "복지/경제",
    title: "기본소득제 도입, 복지의 혁명인가 재정의 재앙인가?",
    description: "모든 국민에게 조건 없이 지급되는 기본소득이 빈곤 문제를 해결할 수 있을까요, 아니면 국가 재정에 심각한 타격을 줄까요?",
    participants: 560,
    isHot: false
  },
  {
    id: 5,
    category: "환경/에너지",
    title: "원자력 발전 확대, 기후 위기의 해법인가 잠재적 재앙인가?",
    description: "탄소 중립을 위한 현실적인 대안으로 원자력이 다시 주목받고 있습니다. 안전성과 효율성 사이의 끝없는 논쟁을 다룹니다.",
    participants: 920,
    isHot: true
  },
  {
    id: 6,
    category: "과학/미래",
    title: "우주 탐사 경쟁, 인류의 미래인가 자원 낭비인가?",
    description: "화성 탐사와 달 기지 건설 등 거대 자본이 투입되는 우주 개발이 지구의 당면 과제보다 우선시되어야 하는지 토론합니다.",
    participants: 430,
    isHot: false
  },
  {
    id: 7,
    category: "문화/예술",
    title: "OTT 플랫폼의 독점, 문화 다양성의 위기인가 기회인가?",
    description: "넷플릭스 등 거대 플랫폼의 시장 지배력이 로컬 콘텐츠 산업에 미치는 영향과 창작 환경의 변화에 대해 토론합니다.",
    participants: 710,
    isHot: false
  },
  {
    id: 8,
    category: "정치/행정",
    title: "온라인 투표 시스템 도입, 민주주의의 진화인가 보안의 재앙인가?",
    description: "투표율 제고를 위한 온라인 투표 도입이 해킹과 조작의 위험을 감수할 만큼 가치 있는 일인지 논의합니다.",
    participants: 320,
    isHot: false
  }
];

export const MOCK_QUIZZES: Record<string, any> = {
  "인공지능의 시대, 인간의 창의성은 어디로 가는가?": {
    question: "생성형 AI가 예술 창작에 미치는 영향으로 가장 적절한 관점은 무엇입니까?",
    options: [
      { id: 1, text: "AI는 인간의 창의성을 완전히 대체할 것이다." },
      { id: 2, text: "AI는 창작의 도구로서 인간의 능력을 확장시킬 수 있다." },
      { id: 3, text: "예술은 오직 인간만이 할 수 있는 영역이므로 AI는 무의미하다." },
      { id: 4, text: "AI가 만든 작품은 저작권 보호를 받을 수 없다." }
    ],
    correctOptionId: 2,
    explanation: "많은 전문가들은 AI를 인간의 창의성을 보조하고 확장하는 강력한 도구로 보고 있습니다."
  },
  "주 4일 근무제, 생산성의 혁신인가 단순한 사치인가?": {
    question: "주 4일 근무제 도입의 주요 기대 효과 중 하나는 무엇입니까?",
    options: [
      { id: 1, text: "임금의 무조건적인 상승" },
      { id: 2, text: "업무 집중도 향상을 통한 생산성 유지 및 증대" },
      { id: 3, text: "기업의 운영 비용 대폭 절감" },
      { id: 4, text: "모든 직종의 즉각적인 적용 가능성" }
    ],
    correctOptionId: 2,
    explanation: "근무 시간 단축은 집중도 향상과 번아웃 방지를 통해 생산성을 유지하거나 높이는 효과를 목표로 합니다."
  },
  "default": {
    question: "이 주제와 관련하여 토론을 시작하기 전, 가장 중요한 태도는 무엇입니까?",
    options: [
      { id: 1, text: "자신의 주장만을 관철시키는 고집" },
      { id: 2, text: "상대방의 논리적 허점을 찾아 비난하는 태도" },
      { id: 3, text: "다양한 관점을 열린 마음으로 경청하고 분석하는 자세" },
      { id: 4, text: "다수의 의견에 무조건적으로 동조하는 태도" }
    ],
    correctOptionId: 3,
    explanation: "건전한 토론의 핵심은 서로 다른 의견을 존중하며 합리적인 결론을 도출하려는 열린 자세입니다."
  }
};