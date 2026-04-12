import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  MessageSquare, 
  ArrowRight, 
  Brain,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { debateApi } from '../services/api';


interface HomeViewProps {
  setTopic: (t: string) => void;
}

// 백엔드에서 받아오는 트렌딩 토론 데이터 타입 정의
interface TrendingDebate {
  id: number;
  topic: string;
  stance: string; // "찬성" or "반대"
  author: string;
  viewCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

// 슬라이더에 사용될 데이터 타입 정의
interface HeroSlide {
  tag: string;
  title: string;
  desc: string;
  color: string;
}

// 카드 섹션에 사용될 데이터 타입 정의
interface CardDebate {
  id: number;
  title: string;
  description: string;
  category: string;
  isHot: boolean;
  participants: number;
}

export const HomeView = ({ setTopic }: HomeViewProps) => {
  const navigate = useNavigate();
   const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [cardDebates, setCardDebates] = useState<CardDebate[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await debateApi.getTrending();
        console.log("Trending API Response:", response);
        
        let debatesToUse: TrendingDebate[] = [];
        if (response?.data && Array.isArray(response.data)) {
          debatesToUse = response.data;
        } else {
          console.warn("Unexpected response format for trending debates:", response);
          debatesToUse = [];
        }

        // 슬라이더용 데이터 매핑
        const slideColors = [
          "from-[#dbe1ff] to-white",
          "from-[#ffe4e1] to-white",
          "from-[#e0f7fa] to-white"
        ];
        const mappedHeroSlides: HeroSlide[] = debatesToUse.slice(0, 3).map((debate, index) => ({
          tag: "인기 토론", // 백엔드에 category 필드가 없으므로 임의 지정
          title: debate.topic,
          desc: `${debate.topic}에 대한 뜨거운 토론이 진행 중입니다. ${debate.viewCount}명이 참여했습니다.`, // 설명 생성
          color: slideColors[index % slideColors.length] // 색상 순환 적용
        }));
        setHeroSlides(mappedHeroSlides);

        // 카드 섹션용 데이터 매핑
        const mappedCardDebates: CardDebate[] = debatesToUse.map(debate => ({
          id: debate.id,
          title: debate.topic,
          description: `${debate.topic}에 대한 토론입니다. 현재 ${debate.messageCount}개의 메시지가 오고 갔습니다.`, // 설명 생성
          category: "시사", // 백엔드에 category 필드가 없으므로 임의 지정
          isHot: debate.viewCount > 100, // 조회수 100 이상이면 Hot으로 간주 (임의 로직)
          participants: debate.viewCount,
        }));
        setCardDebates(mappedCardDebates);
      } catch (error) {
        console.error("Failed to fetch trending debates:", error);
        setHeroSlides([]);
        setCardDebates([]);
      }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    if (heroSlides.length > 0) {
        const timer = setInterval(() => {
          setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
        }, 5000);
        return () => clearInterval(timer);
      }
    }, [heroSlides]); // heroSlides가 변경될 때마다 타이머 재설정

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 50;
    if (heroSlides.length === 0) return;

    if (info.offset.x < -threshold) {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    } else if (info.offset.x > threshold) {
      setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 overflow-x-hidden">
      <div className="relative mb-6 md:mb-12">
        <motion.div 
          className="flex cursor-grab active:cursor-grabbing"
          animate={{ x: `-${currentSlide * 100}%` }}
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
        >
          {heroSlides.length > 0 ? (
            heroSlides.map((slide, i) => (
              <div 
                key={i} 
                className={`relative bg-gradient-to-br ${slide.color} rounded-3xl md:rounded-[2.5rem] p-6 md:p-12 w-full shrink-0 overflow-hidden`}
              >
                <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center relative z-10">
                  <div>
                    <span className="inline-block px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full mb-4 md:mb-6 tracking-widest uppercase">{slide.tag}</span>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold font-headline tracking-tight mb-6 md:mb-8 leading-tight">
                      {slide.title}
                    </h1>
                    <p className="text-base md:text-lg text-outline mb-8 md:mb-10 leading-relaxed max-w-md">
                      {slide.desc}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                      <button 
                        onClick={() => {
                          setTopic(slide.title);
                          navigate('/setup');
                        }} 
                        className="px-6 md:px-8 py-3 md:py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all flex items-center justify-center gap-2 text-sm md:text-base pointer-events-auto"
                      >
                        자세히 보기 <ArrowRight size={18} />
                      </button>
                      <button onClick={() => navigate('/setup')} className="px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur border border-gray-200 text-on-surface font-bold rounded-xl hover:bg-white transition-all text-sm md:text-base pointer-events-auto">
                        토론 참여하기
                      </button>
                    </div>
                  </div>
                  <div className="hidden lg:block relative">
                    <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-2xl rotate-3">
                       <div className="flex justify-between items-start mb-8">
                          <div className="w-12 h-12 bg-primary-fixed rounded-xl flex items-center justify-center text-primary">
                             <Brain size={24} />
                          </div>
                          <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Live Debate</span>
                       </div>
                       <div className="space-y-4 mb-12">
                          <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
                          <div className="h-3 w-full bg-gray-100 rounded-full" />
                          <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
                       </div>
                       <div className="flex justify-between items-center">
                          <div className="flex -space-x-2">
                             {[1,2,3].map(j => <div key={j} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white" />)}
                          </div>
                          <span className="text-xs font-bold text-primary">2.4k 참여 중</span>
                       </div>
                    </div>
                    <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl -rotate-6 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg text-secondary"><TrendingUp size={16} /></div>
                        <div>
                          <p className="text-[10px] font-bold text-outline uppercase">Conflict Index</p>
                          <p className="text-lg font-black leading-none">High (82%)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full h-64 flex items-center justify-center text-outline">
              <Loader2 className="animate-spin mr-2" size={20} /> 로딩 중...
            </div>
          )}
        </motion.div>
      </div>

      <div className="flex justify-center gap-3 mb-12 md:mb-24">
        {heroSlides.map((_, i) => ( // heroSlides의 길이를 사용하여 인디케이터 렌더링
          <button 
            key={i} 
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${currentSlide === i ? 'w-4 bg-primary' : 'w-2 bg-gray-300'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <section className="mb-12 md:mb-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold font-headline mb-2">인기 주제</h2>
            <p className="text-sm md:text-base text-outline">지금 가장 뜨거운 주제들을 매거진 레이아웃으로 만나보세요.</p>
          </div>
          <button onClick={() => navigate('/search')} className="text-primary font-bold flex items-center gap-2 hover:gap-3 transition-all text-sm md:text-base">모든 주제 보기 <ArrowRight size={18} /></button>
        </div>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {cardDebates.length > 0 ? (
            cardDebates.map(debate => (
              <div 
                key={debate.id} 
                className="group bg-white border border-gray-100 rounded-2xl p-6 md:p-8 card-hover cursor-pointer flex flex-col"
                onClick={() => {
                  setTopic(debate.title);
                  navigate('/setup');
                }}
              >
                <div className="flex gap-2 mb-4">
                  <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-outline rounded uppercase">{debate.category}</span>
                  {debate.isHot && <span className="px-2 py-0.5 bg-red-50 text-[10px] font-bold text-secondary rounded uppercase tracking-widest">Hot</span>}
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 group-hover:text-primary transition-colors">{debate.title}</h3>
                <p className="text-xs md:text-sm text-outline mb-6 md:mb-8 line-clamp-3 leading-relaxed flex-1">{debate.description}</p>
                <div className="pt-4 md:pt-6 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-outline text-[10px] md:text-xs">
                    <MessageSquare size={14} /> {debate.participants}명 참여 중
                  </div>
                  <span className="text-[10px] md:text-xs font-bold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    참여하기 <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-3 text-center text-outline">
              <Loader2 className="animate-spin mr-2" size={20} /> 인기 주제 로딩 중...
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
