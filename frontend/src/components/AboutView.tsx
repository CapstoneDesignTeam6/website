import { 
  Download, 
  MessageSquare, 
  User, 
  TrendingUp, 
  Library, 
  Gavel, 
  FileText 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AboutView = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-24">
      <div className="grid lg:grid-cols-2 gap-12 md:gap-24 items-center mb-16 md:mb-32">
        <div className="space-y-6 md:space-y-8">
          <span className="text-primary font-bold tracking-widest text-[10px] md:text-sm uppercase">About Agora</span>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold font-headline tracking-tighter leading-tight">
            나만의 AI 시사 메이트,<br />Agora
          </h1>
          <p className="text-base md:text-xl text-outline leading-relaxed max-w-xl">
            읽는 뉴스에서 생각하는 뉴스로, AI 에이전트와 함께 깊이 있는 이해를 경험해보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button onClick={() => navigate('/setup')} className="px-6 md:px-8 py-3 md:py-4 bg-primary text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm md:text-base">지금 시작하기</button>
            <button className="px-6 md:px-8 py-3 md:py-4 border border-gray-200 text-on-surface font-bold rounded-xl hover:bg-gray-50 transition-all text-sm md:text-base">사용 가이드</button>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <img 
              src="https://picsum.photos/seed/agora-ai/1200/800" 
              alt="AI Analysis" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/10 blur-[100px] -z-10" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 md:gap-12 mb-16 md:mb-32">
        {[
          { icon: "🗞️", title: "뉴스 기반 토론, 정보에서 이해로", desc: "Agora의 모든 토론은 실제 뉴스에서 시작됩니다. 단순히 기사를 읽는 것이 아니라 맥락을 입체적으로 이해합니다." },
          { icon: "🤖", title: "AI 에이전트 토론, 살아있는 다양성", desc: "다양한 입장을 대변하는 AI 에이전트들이 논리적인 토론을 펼칠니다. 편향되지 않은 균형 잡힌 시각을 제공합니다." },
          { icon: "💬", title: "직접 참여, 생각이 깊어지는 경험", desc: "AI 에이전트와 직접 토론하며 자신의 논리를 다듬고 사고의 확장을 경험해보세요." }
        ].map((item, i) => (
          <div key={i} className="p-6 md:p-8 bg-white border border-gray-100 rounded-2xl group">
            <div className="text-3xl md:text-4xl mb-4 md:mb-6">{item.icon}</div>
            <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">{item.title}</h3>
            <p className="text-xs md:text-sm text-outline leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <section className="bg-surface-container rounded-3xl md:rounded-[2.5rem] p-8 md:p-16">
        <div className="grid lg:grid-cols-3 gap-8 md:gap-12">
          <div className="lg:col-span-1">
            <h2 className="text-2xl md:text-3xl font-extrabold font-headline mb-6 leading-tight">Agora의 핵심 기능으로<br />논리적인 토론을 경험하세요</h2>
            <button className="w-full flex items-center justify-between px-6 md:px-8 py-4 md:py-5 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base">
              샘플 리포트 PDF 다운로드 <Download size={20} />
            </button>
          </div>
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
            {[
              { icon: <MessageSquare />, title: "AI 에이전트 토론", desc: "찬반 AI가 구조화된 토론 진행" },
              { icon: <User />, title: "사용자 참여형 토론", desc: "사용자가 직접 의견 입력 및 개입" },
              { icon: <TrendingUp />, title: "대립 지표 시각화", desc: "의견 차이를 수치 및 그래프로 제공" },
              { icon: <Library />, title: "근거 기반 토론", desc: "뉴스 및 출처 기반 주장 제공" },
              { icon: <Gavel />, title: "자동 판정 시스템", desc: "토론 결과 및 논리 분석 제공" },
              { icon: <FileText />, title: "최종 리포트 제공", desc: "토론 결과 PDF 다운로드" }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-xl flex items-start gap-4 border border-gray-100">
                <div className="p-2 bg-primary/5 text-primary rounded-lg">{feature.icon}</div>
                <div>
                  <h4 className="font-bold mb-1">{feature.title}</h4>
                  <p className="text-xs text-outline">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
