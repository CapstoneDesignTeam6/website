import { 
  FileText, 
  Rocket 
} from 'lucide-react';

interface SetupViewProps {
  topic: string;
  setTopic: (t: string) => void;
  agentCount: number;
  setAgentCount: (n: number) => void;
  onStart: () => void;
}

export const SetupView = ({ 
  topic, 
  setTopic, 
  agentCount, 
  setAgentCount, 
  onStart 
}: SetupViewProps) => (
  <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-24">
    <header className="text-center mb-12 md:mb-16">
      <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-4">새로운 토론 설계</h1>
      <p className="text-sm md:text-base text-outline">디지털 아틀리에에서 지성적인 담론을 시작해보세요.</p>
    </header>

    <div className="space-y-8 md:space-y-12">
      <section className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 card-hover">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg md:text-xl shrink-0">1</div>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold font-headline mb-4 md:mb-6">토론 주제를 입력하세요</h2>
            <div className="relative">
              <textarea 
                className="w-full bg-surface-container p-4 md:p-6 rounded-xl border-none focus:ring-0 outline-none min-h-30 md:min-h-40 resize-none text-sm md:text-base"
                placeholder="예: 인공지능이 예술의 창의성에 미치는 영향에 대해 토론하고 싶습니다."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 flex items-center gap-2 text-outline text-[10px] md:text-xs">
                <FileText size={14} /> 명확한 주제일수록 깊이 있는 토론이 가능합니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 card-hover">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg md:text-xl shrink-0">2</div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6 md:mb-8">
              <h2 className="text-lg md:text-xl font-bold font-headline">참여 에이전트 수 선택</h2>
            </div>
            <div className="flex items-center justify-center md:justify-start gap-4 md:gap-8">
              <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                {[1, 2, 3, 4, 5].map(n => (
                  <button 
                    key={n} 
                    onClick={() => setAgentCount(n)}
                    className={`w-10 h-10 md:w-14 md:h-14 rounded-full border-2 font-bold text-sm md:text-lg transition-all ${agentCount === n ? 'bg-primary border-primary text-white shadow-lg ring-2 md:ring-4 ring-primary-fixed' : 'border-gray-100 text-outline hover:border-primary hover:text-primary'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center pt-4 md:pt-8">
        <button 
          onClick={onStart} 
          disabled={!topic.trim()}
          className="px-8 md:px-12 py-4 md:py-5 bg-primary text-white font-bold text-lg md:text-xl rounded-full transition-all flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          토론 시작하기 <Rocket size={24} />
        </button>
        <p className="mt-4 md:mt-6 text-xs md:text-sm text-outline">시작 버튼을 누르면 Agora 아틀리에가 즉시 구성됩니다.</p>
      </div>
    </div>
  </div>
);
