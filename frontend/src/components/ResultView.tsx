import { 
  Download, 
  RefreshCw, 
  FileText 
} from 'lucide-react';
import { View } from '../types';

interface ResultViewProps {
  setView: (v: View) => void;
  topic: string;
  result: string;
}

export const ResultView = ({ setView, topic, result }: ResultViewProps) => (
  <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
    <section className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-12 editorial-shadow mb-8 md:mb-12 relative overflow-hidden card-hover">
      <div className="absolute top-0 right-0 p-4 md:p-6">
        <span className="px-3 md:px-4 py-1 md:py-1.5 bg-primary-fixed text-primary text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full">Final Verdict</span>
      </div>
      <div className="max-w-3xl">
        <h1 className="text-2xl md:text-4xl font-black font-headline tracking-tight mb-4 md:mb-6">{topic}</h1>
        <p className="text-base md:text-lg text-outline mb-8 md:mb-10 leading-relaxed">AI 분석 엔진이 도출한 최종 결론입니다.</p>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12">
          <div className="w-full flex-1">
            <div className="flex justify-between mb-2 md:mb-3 text-xs md:text-sm font-bold">
              <span className="text-primary">찬성 68%</span>
              <span className="text-secondary">반대 32%</span>
            </div>
            <div className="h-3 md:h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-primary" style={{ width: '68%' }} />
              <div className="h-full bg-secondary" style={{ width: '32%' }} />
            </div>
          </div>
          <div className="bg-gray-50 p-4 md:p-6 rounded-2xl border border-gray-100 text-center w-full md:w-auto">
            <span className="text-[9px] md:text-[10px] text-outline font-bold uppercase block mb-1">Conflict Index</span>
            <span className="text-2xl md:text-3xl font-black text-orange-600">4.2</span>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-white p-8 md:p-16 editorial-shadow rounded-2xl border-t-8 border-primary card-hover">
      <div className="flex flex-col md:flex-row justify-between items-start border-b border-gray-100 pb-8 md:pb-10 mb-8 md:mb-12 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black font-headline mb-2">토론 분석 리포트</h2>
          <p className="text-[10px] md:text-xs text-outline">Agora Editorial Analysis #{new Date().getFullYear()}-{Math.floor(Math.random() * 9000 + 1000)}</p>
        </div>
        <div className="text-left md:text-right text-[10px] md:text-xs text-outline space-y-1">
          <p>발행일: {new Date().toLocaleDateString('ko-KR')}</p>
          <p>분석 대상: {topic}</p>
        </div>
      </div>

      <div className="prose prose-sm max-w-none text-outline leading-relaxed whitespace-pre-wrap">
        {result || "리포트를 생성하는 중입니다..."}
      </div>
    </section>

    <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 py-4 md:py-6 px-4 md:px-8 z-50">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-outline text-[9px] md:text-[10px] font-bold">
          <FileText size={14} /> 이 리포트는 토론 내용과 AI 판정 결과를 바탕으로 자동 생성되었습니다.
        </div>
        <div className="flex gap-3 md:gap-4 w-full md:w-auto">
          <button onClick={() => setView('setup')} className="flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3 bg-gray-100 text-on-surface font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all text-xs md:text-sm">
            <RefreshCw size={16} /> 다시 시작
          </button>
          <button className="flex-1 md:flex-none px-6 md:px-10 py-2.5 md:py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs md:text-sm">
            <Download size={16} /> PDF 다운로드
          </button>
        </div>
      </div>
    </div>
    <div className="h-24" />
  </div>
);
