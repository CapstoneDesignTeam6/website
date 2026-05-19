import {
  FileText,
  Rocket
} from 'lucide-react';
import { Difficulty/*, ResponseSpeed*/ } from '../types';

interface SetupViewProps {
  topic: string;
  setTopic: (t: string) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  // responseSpeed: ResponseSpeed;
  // setResponseSpeed: (s: ResponseSpeed) => void;
  onStart: () => void;
}

export const SetupView = ({
  topic,
  setTopic,
  difficulty,
  setDifficulty,
  // responseSpeed,
  // setResponseSpeed,
  onStart
}: SetupViewProps) => (
  <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-20">
    <header className="text-center mb-10 md:mb-12">
      <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-4">새로운 토론 시작</h1>
      <p className="text-sm md:text-base text-outline">최신 뉴스를 기반으로 에이전트와 토론을 나눠보세요.</p>
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
                placeholder="예: 주 4일 근무제, 생산성 향상인가 효율 저하인가?"
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
            <h2 className="text-lg md:text-xl font-bold font-headline mb-4 md:mb-6">난이도 선택</h2>
            <div className="flex gap-4 justify-start">
              <button
                onClick={() => setDifficulty('normal')}
                className={`py-3 md:py-4 px-8 md:px-12 rounded-xl border-2 font-bold text-sm md:text-base transition-all ${difficulty === 'normal' ? 'bg-primary border-primary text-white shadow-lg ring-2 ring-primary-fixed' : 'border-gray-100 text-outline hover:border-primary hover:text-primary'}`}
              >
                일반 버전
              </button>
              <button
                onClick={() => setDifficulty('easy')}
                className={`py-3 md:py-4 px-8 md:px-12 rounded-xl border-2 font-bold text-sm md:text-base transition-all ${difficulty === 'easy' ? 'bg-primary border-primary text-white shadow-lg ring-2 ring-primary-fixed' : 'border-gray-100 text-outline hover:border-primary hover:text-primary'}`}
              >
                쉬운 버전
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 답변 모드 선택 (비활성화)
      <section className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 card-hover">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg md:text-xl shrink-0">3</div>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold font-headline mb-4 md:mb-6">답변 모드 선택</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setResponseSpeed('fast')}
                className={`flex-1 py-3 md:py-4 rounded-xl border-2 font-bold text-sm md:text-base transition-all ${responseSpeed === 'fast' ? 'bg-primary border-primary text-white shadow-lg ring-2 ring-primary-fixed' : 'border-gray-100 text-outline hover:border-primary hover:text-primary'}`}
              >
                빠른 답변
              </button>
              <button
                onClick={() => setResponseSpeed('slow')}
                className={`flex-1 py-3 md:py-4 rounded-xl border-2 font-bold text-sm md:text-base transition-all ${responseSpeed === 'slow' ? 'bg-primary border-primary text-white shadow-lg ring-2 ring-primary-fixed' : 'border-gray-100 text-outline hover:border-primary hover:text-primary'}`}
              >
                깊은 답변
              </button>
            </div>
          </div>
        </div>
      </section>
      */}

      <div className="text-center pt-4 md:pt-8">
        <button
          onClick={onStart}
          disabled={!topic.trim()}
          className="px-8 md:px-12 py-3 md:py-4 bg-primary text-white font-bold text-lg md:text-xl rounded-full transition-all flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          토론 시작하기 <Rocket size={24} />
        </button>
      </div>
    </div>
  </div>
);
