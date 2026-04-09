import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const FAQView = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      category: "서비스 이용",
      questions: [
        { q: "Agora는 어떤 서비스인가요?", a: "Agora는 최신 뉴스를 기반으로 AI 에이전트와 함께 심도 있는 토론을 나눌 수 있는 디지털 공론장입니다. 단순히 정보를 소비하는 것을 넘어, 다양한 관점에서 이슈를 분석하고 자신의 논리를 정립할 수 있도록 돕습니다." },
        { q: "토론 주제는 어떻게 선정되나요?", a: "사용자가 직접 주제를 입력하거나, 현재 가장 뜨거운 시사 이슈들을 추천 목록에서 선택할 수 있습니다. AI는 입력된 주제와 관련된 최신 뉴스 데이터를 실시간으로 분석하여 토론 환경을 조성합니다." },
        { q: "AI 에이전트의 답변은 신뢰할 수 있나요?", a: "Agora의 AI 에이전트는 검증된 뉴스 데이터와 공신력 있는 자료를 근거로 답변을 생성합니다. 하지만 AI의 특성상 완벽하지 않을 수 있으므로, 제공되는 '근거 자료' 섹션을 함께 참고하시는 것을 권장합니다." }
      ]
    },
    {
      category: "계정 및 보안",
      questions: [
        { q: "회원가입은 꼭 해야 하나요?", a: "기본적인 토론 둘러보기는 비회원도 가능하지만, 직접 토론에 참여하고 개인화된 분석 리포트를 저장하기 위해서는 회원가입이 필요합니다." },
        { q: "비밀번호를 잊어버렸어요.", a: "로그인 화면 하단의 '비밀번호 찾기' 링크를 통해 가입하신 이메일로 임시 비밀번호를 발송해 드립니다." },
        { q: "개인정보는 어떻게 보호되나요?", a: "Agora는 사용자의 개인정보를 최우선으로 보호하며, 토론 데이터는 서비스 품질 향상 및 AI 학습을 위해 비식별화된 상태로만 활용됩니다. 자세한 내용은 개인정보 처리방침을 확인해 주세요." }
      ]
    },
    {
      category: "기타 문의",
      questions: [
        { q: "토론 리포트를 PDF로 저장할 수 있나요?", a: "네, 토론이 종료된 후 생성되는 결과 페이지에서 'PDF 다운로드' 버튼을 클릭하여 리포트를 소장할 수 있습니다." },
        { q: "서비스 이용 중 오류가 발생했어요.", a: "이용 중 불편을 겪으셨다면 '문의하기' 메뉴를 통해 상세한 오류 내용과 스크린샷을 보내주시면 신속히 확인하여 조치하겠습니다." }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-24">
      <header className="text-center mb-12 md:mb-20">
        <span className="text-primary font-bold tracking-widest text-[10px] md:text-sm uppercase mb-3 md:mb-4 block">Help Center</span>
        <h1 className="text-3xl md:text-5xl font-extrabold font-headline tracking-tight mb-4 md:mb-6">자주 묻는 질문</h1>
        <p className="text-sm md:text-lg text-outline">Agora 이용에 대해 궁금한 점이 있으신가요? 분야별로 정리된 답변을 확인해 보세요.</p>
      </header>

      <div className="space-y-10 md:space-y-16">
        {faqs.map((section, sIdx) => (
          <div key={sIdx} className="space-y-4 md:space-y-6">
            <h2 className="text-lg md:text-xl font-bold font-headline border-b border-gray-100 pb-3 md:pb-4 flex items-center gap-3">
              <div className="w-1 md:w-1.5 h-5 md:h-6 bg-primary rounded-full" />
              {section.category}
            </h2>
            <div className="space-y-3 md:space-y-4">
              {section.questions.map((item, qIdx) => {
                const globalIdx = sIdx * 100 + qIdx;
                const isOpen = openIndex === globalIdx;
                return (
                  <div 
                    key={qIdx} 
                    className={`bg-white rounded-2xl border transition-all duration-300 card-hover ${isOpen ? 'border-primary shadow-lg' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <button 
                      onClick={() => setOpenIndex(isOpen ? null : globalIdx)}
                      className="w-full px-6 md:px-8 py-4 md:py-6 flex justify-between items-center text-left"
                    >
                      <span className={`font-bold text-base md:text-lg ${isOpen ? 'text-primary' : 'text-on-surface'}`}>
                        {item.q}
                      </span>
                      {isOpen ? <ChevronUp size={20} className="text-primary" /> : <ChevronDown size={20} className="text-outline" />}
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 md:px-8 pb-6 md:pb-8 text-xs md:text-sm text-outline leading-relaxed border-t border-gray-50 pt-4 md:pt-6">
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 md:mt-24 bg-surface-container rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 text-center">
        <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">원하는 답변을 찾지 못하셨나요?</h3>
        <p className="text-xs md:text-sm text-outline mb-6 md:mb-8">Agora 운영팀이 직접 상세히 안내해 드리겠습니다.</p>
        <button className="px-8 md:px-10 py-3 md:py-4 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base">
          1:1 문의하기
        </button>
      </div>
    </div>
  );
};
