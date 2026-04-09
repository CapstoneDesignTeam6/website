import { useState, useEffect } from 'react';
import { 
  Search, 
  MessageSquare, 
  ArrowRight, 
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { View } from '../types';
import { debateApi } from '../services/api';

interface SearchViewProps {
  setView: (v: View) => void;
  setTopic: (t: string) => void;
}

export const SearchView = ({ setView, setTopic }: SearchViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debates, setDebates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchDebates = async () => {
      setIsLoading(true);
      try {
        const response = await debateApi.search(searchQuery);
        console.log("Search API Response:", response);
        
        // 응답이 배열인 경우
        if (Array.isArray(response)) {
          setDebates(response);
        }
        // 응답이 객체이고 data 필드가 있는 경우
        else if (response?.data && Array.isArray(response.data)) {
          setDebates(response.data);
        }
        // 그 외의 경우
        else {
          console.warn("Unexpected response format:", response);
          setDebates([]);
        }
      } catch (error) {
        console.error("Failed to fetch debates:", error);
        setDebates([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchDebates, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-24">
      <header className="text-center mb-12 md:mb-16">
        <h1 className="text-3xl md:text-5xl font-extrabold font-headline tracking-tight mb-4 md:mb-6 text-on-surface">토론 주제 검색</h1>
        <p className="text-base md:text-lg text-outline max-w-2xl mx-auto">관심 있는 시사 이슈를 검색하고 지성적인 담론에 참여해보세요.</p>
      </header>

      <div className="max-w-3xl mx-auto mb-12 md:mb-16">
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 md:left-6 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
            <Search size={20} className="md:w-6 md:h-6" />
          </div>
          <input 
            type="text"
            placeholder="주제, 키워드, 카테고리 검색..."
            className="w-full bg-white border-2 border-gray-100 rounded-3xl md:rounded-4xl py-4 md:py-6 pl-12 md:pl-16 pr-6 md:pr-8 text-base md:text-lg focus:border-primary focus:ring-0 transition-all shadow-sm hover:shadow-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <Loader2 size={48} className="animate-spin mx-auto text-primary mb-4" />
            <p className="text-outline">검색 중...</p>
          </div>
        ) : Array.isArray(debates) && debates.length > 0 ? (
          debates.map(debate => (
            <motion.div 
              layout
              key={debate.id} 
              className="group bg-white border border-gray-100 rounded-2xl p-6 md:p-8 card-hover cursor-pointer flex flex-col"
              onClick={() => {
                setTopic(debate.topic);
                setView('setup');
              }}
            >
              <div className="flex gap-2 mb-4">
                <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-outline rounded uppercase">{debate.stance}</span>
                {debate.messageCount > 15 && <span className="px-2 py-0.5 bg-red-50 text-[10px] font-bold text-secondary rounded uppercase tracking-widest">Hot</span>}
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 group-hover:text-primary transition-colors line-clamp-2">{debate.topic}</h3>
              <p className="text-xs md:text-sm text-outline mb-6 md:mb-8 line-clamp-2 leading-relaxed flex-1">작성자: <strong>{debate.author}</strong></p>
              <div className="pt-4 md:pt-6 border-t border-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2 text-outline text-[10px] md:text-xs">
                  <MessageSquare size={14} /> {debate.messageCount}개 메시지
                </div>
                <span className="text-[10px] md:text-xs font-bold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  참여하기 <ArrowRight size={14} />
                </span>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 md:py-24">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-outline">
              <Search size={32} className="md:w-10 md:h-10" />
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-2">검색 결과가 없습니다</h3>
            <p className="text-sm md:text-base text-outline">다른 키워드로 검색해보거나 새로운 주제를 제안해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};
