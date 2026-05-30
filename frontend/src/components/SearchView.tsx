import { useState, useEffect } from 'react';
import {
  Search,
  MessageSquare,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { debateApi } from '../services/api';
import type { DebateTopic } from '../types';

interface SearchViewProps {
  setTopic: (t: string) => void;
}

// 카드 컴포넌트 — 호버 시 1.2배 확대, 나머지는 흐려짐
const DebateCard = ({
  debate,
  onSelect,
  isHovered,
  isAnyHovered,
  onHoverStart,
  onHoverEnd,
}: {
  debate: DebateTopic;
  onSelect: () => void;
  isHovered: boolean;
  isAnyHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) => {
  return (
    // 그리드 셀 자리 유지용 wrapper
    <div className="relative">
      <motion.div
        className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 cursor-pointer flex flex-col w-full absolute top-0 left-0"
        style={{ transformOrigin: 'center center', zIndex: isHovered ? 40 : 0 }}
        animate={{
          scale: isHovered ? 1.1 : 1,
          opacity: isAnyHovered && !isHovered ? 0.45 : 1,
          boxShadow: isHovered
            ? '0 24px 48px rgba(0,0,0,0.18)'
            : '0 1px 3px rgba(0,0,0,0.05)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        onClick={onSelect}
      >
        <div className="flex gap-2 mb-4">
          <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-outline rounded uppercase">{debate.category}</span>
          {debate.isHot && <span className="px-2 py-0.5 bg-red-50 text-[10px] font-bold text-secondary rounded uppercase tracking-widest">Hot</span>}
        </div>
        <h3 className={`text-lg md:text-xl font-bold mb-3 md:mb-4 transition-colors ${isHovered ? 'text-primary' : ''}`}>{debate.title}</h3>

        {/* 기본: 3줄 clamp, 호버: AnimatePresence로 전체 텍스트 fade-in */}
        <div className="mb-6 md:mb-8">
          <AnimatePresence mode="wait">
            {isHovered ? (
              <motion.p
                key="full"
                className="text-xs md:text-sm text-outline leading-relaxed"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {debate.description}
              </motion.p>
            ) : (
              <motion.p
                key="clamp"
                className="text-xs md:text-sm text-outline leading-relaxed line-clamp-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {debate.description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-4 md:pt-6 border-t border-gray-50 flex justify-between items-center">
          <div className="flex flex-col gap-1 text-outline text-[10px] md:text-xs">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} /> {debate.participants}명 참여 중
            </div>
            {/* 시간 뜨는 지 확인하고 삭제 */}
            {debate.createdAt && (
              <span>{new Date(debate.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            )}
          </div>
          <motion.span
            className="text-[10px] md:text-xs font-bold text-primary flex items-center gap-1"
            animate={{ x: isHovered ? 4 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            참여하기 <ArrowRight size={14} />
          </motion.span>
        </div>
      </motion.div>

      {/* 그리드 공간 유지용 invisible placeholder — 항상 3줄 clamp 높이 */}
      <div className="invisible p-6 md:p-8 flex flex-col" aria-hidden="true">
        <div className="flex gap-2 mb-4">
          <span className="px-2 py-0.5 text-[10px]">{debate.category}</span>
        </div>
        <div className="text-lg md:text-xl font-bold mb-3 md:mb-4">{debate.title}</div>
        <p className="text-xs md:text-sm leading-relaxed line-clamp-3 mb-6 md:mb-8">{debate.description}</p>
        <div className="pt-4 md:pt-6 border-t border-transparent text-[10px] md:text-xs">placeholder</div>
      </div>
    </div>
  );
};

// type SortOrder = 'latest' | 'popular';

export const SearchView = ({ setTopic }: SearchViewProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debates, setDebates] = useState<DebateTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  // const [sortOrder, setSortOrder] = useState<SortOrder>('latest');

  useEffect(() => {
    const fetchDebates = async () => {
      setIsLoading(true);
      try {
        const data = await debateApi.search(searchQuery);
        setDebates([...data].sort((a, b) => (b.isHot ? 1 : 0) - (a.isHot ? 1 : 0)));
      } catch (error) {
        console.error("Failed to fetch debates:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchDebates, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // const sortedDebates = [...debates].sort((a, b) => {
  //   if (sortOrder === 'popular') return b.participants - a.participants;
  //   return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  // });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
      <header className="text-center mb-10 md:mb-12">
        <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-4 text-on-surface">토론 주제 탐색</h1>
        <p className="text-sm md:text-base text-outline max-w-2xl mx-auto">관심 있는 시사 이슈를 검색하고 토론에 참여해보세요.</p>
      </header>

      <div className="max-w-3xl mx-auto mb-6 md:mb-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 md:left-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="주제, 키워드, 카테고리 등으로 검색해보세요"
            className="w-full bg-white border border-gray-100 rounded-2xl md:rounded-3xl py-4 pl-10 md:pl-12 pr-4 md:pr-6 text-sm outline-none focus:outline-none focus:ring-0 transition-all shadow-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* <div className="mb-4 md:mb-6 flex gap-4 justify-end">
        {(['latest', 'popular'] as SortOrder[]).map((order) => (
          <button
            key={order}
            onClick={() => setSortOrder(order)}
            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
              sortOrder === order ? 'text-primary' : 'text-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full border ${
              sortOrder === order ? 'bg-primary border-primary' : 'bg-transparent border-gray-300'
            }`} />
            {order === 'latest' ? '최신순' : '날짜별'}
          </button>
        ))}
      </div> */}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <Loader2 size={48} className="animate-spin mx-auto text-primary mb-4" />
            <p className="text-outline">검색 중...</p>
          </div>
        ) : debates.length > 0 ? (
          debates.map((debate: DebateTopic) => (
            <DebateCard
              key={debate.id}
              debate={debate}
              onSelect={() => {
                setTopic(debate.title);
                navigate('/setup');
              }}
              isHovered={hoveredId === debate.id}
              isAnyHovered={hoveredId !== null}
              onHoverStart={() => setHoveredId(debate.id)}
              onHoverEnd={() => setHoveredId(null)}
            />
          ))
        ) : (
          <div className="col-span-full text-center ">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto  text-outline">
              <Search size={32} className="md:w-10 md:h-10" />
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-2">검색 결과가 없습니다</h3>
            <p className="text-sm md:text-base text-outline">다른 키워드로 검색해보거나 새로운 주제를 제안해보세요</p>
          </div>
        )}
      </div>
    </div>
  );
};
