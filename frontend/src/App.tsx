/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  Search, 
  Bell, 
  User, 
  TrendingUp, 
  MessageSquare, 
  Library, 
  Settings, 
  Send, 
  Paperclip, 
  ArrowRight, 
  Download, 
  RefreshCw, 
  FileText, 
  Rocket,
  Power,
  Brain,
  Gavel,
  BarChart3,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface DebateMessage {
  role: 'agent' | 'user' | 'moderator';
  agentName?: string;
  side: 'pro' | 'con' | 'neutral';
  content: string;
  timestamp: string;
}

type View = 'home' | 'about' | 'setup' | 'debate' | 'result' | 'faq' | 'search' | 'profile' | 'login' | 'signup';

const generateRandomNickname = () => {
  const adjectives = ['논리적인', '냉철한', '열정적인', '지혜로운', '날카로운', '따뜻한', '공정한', '창의적인'];
  const nouns = ['토론가', '분석가', '에디터', '철학자', '시민', '관찰자', '비평가', '리더'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj} ${noun}${num}`;
};

// --- Mock Data ---
const DEBATES = [
  {
    id: 1,
    category: 'Climate',
    isHot: true,
    title: '탄소중립 2050: 경제 성장과 공존 가능한가?',
    description: '전 세계적인 기후 위기 속에서 탄소 감축 정책이 기업 경쟁력에 미치는 영향과 해결책을 논합니다.',
    participants: 842
  },
  {
    id: 2,
    category: 'Society',
    isHot: false,
    title: '주 4일 근무제, 생산성의 혁신인가 사치인가?',
    description: '일과 삶의 균형을 넘어 실질적인 기업 운영 효율성에 대한 치열한 공방이 이어지고 있습니다.',
    participants: 1205
  },
  {
    id: 3,
    category: 'Tech',
    isHot: false,
    title: '스마트폰 사용 제한: 아동 교육의 필수인가 억압인가?',
    description: '디지털 네이티브 세대의 두뇌 발달과 정서 조절을 위한 학교 내 기기 제한 정책에 대한 찬반 양론.',
    participants: 637
  }
];

// --- Components ---

const Navbar = ({ currentView, setView, isLoggedIn, setIsLoggedIn }: { currentView: View, setView: (v: View) => void, isLoggedIn: boolean, setIsLoggedIn: (v: boolean) => void }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserClick = () => {
    if (isLoggedIn) {
      setIsDropdownOpen(!isDropdownOpen);
    } else {
      setView('login');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    setView('home');
  };

  const handleProfileUpdate = () => {
    setView('profile');
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navigateTo = (v: View) => {
    setView(v);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-6 md:gap-12">
          <button onClick={() => navigateTo('home')} className="flex items-center gap-2 md:gap-3 text-xl md:text-2xl font-black tracking-tighter font-headline cursor-pointer group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl overflow-hidden shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <img 
                src="https://images.unsplash.com/photo-1675271591211-126ad94e495d?q=80&w=200&h=200&auto=format&fit=crop" 
                alt="Agora Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span>Agora</span>
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <button onClick={() => navigateTo('about')} className={`${currentView === 'about' ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>소개</button>
            <button onClick={() => navigateTo('search')} className={`${currentView === 'search' ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>주제 검색</button>
            <button onClick={() => navigateTo('setup')} className={`${currentView === 'debate' || currentView === 'setup' ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>토론</button>
            <button onClick={() => navigateTo('result')} className={`${currentView === 'result' ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>결과</button>
            <button onClick={() => navigateTo('faq')} className={`${currentView === 'faq' ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>자주 묻는 질문</button>
          </nav>
        </div>
        
        {/* Desktop Icons */}
        <div className="hidden md:flex items-center gap-4 relative" ref={dropdownRef}>
          <button className="p-2 text-outline hover:bg-gray-100 rounded-full transition-colors"><Bell size={20} /></button>
          <button 
            onClick={handleUserClick} 
            className={`p-2 rounded-full transition-colors ${currentView === 'profile' || currentView === 'login' || currentView === 'signup' ? 'bg-primary/10 text-primary' : 'text-outline hover:bg-gray-100'}`}
          >
            <User size={20} />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 overflow-hidden"
              >
                <button 
                  onClick={handleProfileUpdate}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-on-surface hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <Settings size={16} className="text-outline" />
                  회원 정보
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-secondary hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <Power size={16} />
                  로그아웃
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-outline hover:bg-gray-100 rounded-full transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl md:hidden flex flex-col"
              style={{ backgroundColor: 'white' }}
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <span className="text-xl font-black font-headline tracking-tighter">Agora</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-outline hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {!isLoggedIn ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => navigateTo('login')}
                      className="py-3 px-4 bg-primary/10 text-primary font-bold rounded-xl text-sm"
                    >
                      로그인
                    </button>
                    <button 
                      onClick={() => navigateTo('signup')}
                      className="py-3 px-4 bg-primary text-white font-bold rounded-xl text-sm shadow-lg shadow-primary/20"
                    >
                      회원가입
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-surface-container rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                      <User size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm truncate">사용자 님</p>
                      <button onClick={handleProfileUpdate} className="text-xs text-primary font-medium">회원 정보 관리</button>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-secondary hover:bg-red-50 rounded-lg transition-colors">
                      <Power size={18} />
                    </button>
                  </div>
                )}
              </div>

              <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto">
                {[
                  { id: 'about', label: '소개' },
                  { id: 'search', label: '주제 검색' },
                  { id: 'setup', label: '토론' },
                  { id: 'result', label: '결과' },
                  { id: 'faq', label: '자주 묻는 질문' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id as View)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${
                      currentView === item.id || (item.id === 'setup' && currentView === 'debate')
                        ? 'bg-primary text-white'
                        : 'text-outline hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

const Footer = () => (
  <footer className="bg-surface-container py-8 md:py-16 border-t border-gray-200">
    <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-start gap-8 md:gap-12">
      <div className="space-y-4">
        <span className="text-xl md:text-2xl font-black font-headline tracking-tighter">Agora</span>
        <p className="text-outline text-xs md:text-sm max-w-xs leading-relaxed">
          건강한 담론과 팩트 기반의 토론을 통해 더 나은 사회를 꿈꾸는 디지털 공론장입니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-8 md:gap-16">
        <div className="space-y-4">
          <h4 className="font-bold text-xs md:text-sm text-on-surface">고객 지원</h4>
          <ul className="space-y-2 text-xs md:text-sm text-outline">
            <li><a href="#" className="hover:text-primary">공지사항</a></li>
            <li><a href="#" className="hover:text-primary">도움말</a></li>
            <li><a href="#" className="hover:text-primary">문의하기</a></li>
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="font-bold text-xs md:text-sm text-on-surface">정책</h4>
          <ul className="space-y-2 text-xs md:text-sm text-outline">
            <li><a href="#" className="hover:text-primary">개인정보 처리방침</a></li>
            <li><a href="#" className="hover:text-primary">이용약관</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 md:mt-16 pt-6 md:pt-8 border-t border-gray-200 flex justify-between text-[10px] md:text-xs text-outline">
      <span>© 2026 Agora. All rights reserved.</span>
    </div>
  </footer>
);

// --- Page Views ---

const HERO_TOPICS = [
  {
    tag: "이번 주의 주제",
    title: <>인공지능의 시대,<br /><span className="text-primary">인간의 창의성</span>은<br />어디로 가는가?</>,
    plainTitle: "인공지능의 시대, 인간의 창의성은 어디로 가는가?",
    desc: "생성형 AI가 예술과 문학의 영역을 침범하고 있습니다. 우리는 기술을 도구로 받아들여야 할까요?",
    color: "from-[#dbe1ff] to-white"
  },
  {
    tag: "경제 트렌드",
    title: <>주 4일 근무제,<br /><span className="text-primary">생산성의 혁신</span>인가<br />단순한 사치인가?</>,
    plainTitle: "주 4일 근무제, 생산성의 혁신인가 단순한 사치인가?",
    desc: "일과 삶의 균형을 넘어 실질적인 기업 운영 효율성에 대한 치열한 공방이 이어지고 있습니다.",
    color: "from-[#ffe4e1] to-white"
  },
  {
    tag: "사회 이슈",
    title: <>디지털 네이티브,<br /><span className="text-primary">스마트폰 제한</span>은<br />필수인가 억압인가?</>,
    plainTitle: "디지털 네이티브, 스마트폰 제한은 필수인가 억압인가?",
    desc: "아동 교육의 필수 요소로 떠오른 학교 내 기기 제한 정책에 대한 찬반 양론을 논합니다.",
    color: "from-[#e0f7fa] to-white"
  }
];

const HomeView = ({ setView, setTopic }: { setView: (v: View) => void, setTopic: (t: string) => void }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_TOPICS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDragEnd = (event: any, info: any) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      setCurrentSlide((prev) => (prev + 1) % HERO_TOPICS.length);
    } else if (info.offset.x > threshold) {
      setCurrentSlide((prev) => (prev - 1 + HERO_TOPICS.length) % HERO_TOPICS.length);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 overflow-x-hidden">
      {/* Hero Section Container */}
      <div className="relative mb-6 md:mb-12">
        <motion.div 
          className="flex cursor-grab active:cursor-grabbing"
          animate={{ x: `-${currentSlide * 100}%` }}
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
        >
          {HERO_TOPICS.map((slide, i) => (
            <section 
              key={i} 
              className={`relative bg-gradient-to-br ${slide.color} rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 w-full flex-shrink-0 overflow-hidden`}
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
                        setTopic(slide.plainTitle);
                        setView('setup');
                      }} 
                      className="px-6 md:px-8 py-3 md:py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-all flex items-center justify-center gap-2 text-sm md:text-base pointer-events-auto"
                    >
                      자세히 보기 <ArrowRight size={18} />
                    </button>
                    <button onClick={() => setView('setup')} className="px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur border border-gray-200 text-on-surface font-bold rounded-xl hover:bg-white transition-all text-sm md:text-base pointer-events-auto">
                      토론 참여하기
                    </button>
                  </div>
                </div>
                <div className="hidden lg:block relative">
                  <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-[2rem] p-8 shadow-2xl rotate-3">
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
            </section>
          ))}
        </motion.div>
      </div>

      {/* Carousel Indicators */}
      <div className="flex justify-center gap-3 mb-12 md:mb-24">
        {HERO_TOPICS.map((_, i) => (
          <button 
            key={i} 
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${currentSlide === i ? 'w-4 bg-primary' : 'w-2 bg-gray-300'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Explore Section */}
      <section className="mb-12 md:mb-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold font-headline mb-2">인기 주제</h2>
            <p className="text-sm md:text-base text-outline">지금 가장 뜨거운 주제들을 매거진 레이아웃으로 만나보세요.</p>
          </div>
          <button className="text-primary font-bold flex items-center gap-2 hover:gap-3 transition-all text-sm md:text-base">모든 주제 보기 <ArrowRight size={18} /></button>
        </div>
      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {DEBATES.map(debate => (
          <div key={debate.id} className="group bg-white border border-gray-100 rounded-2xl p-6 md:p-8 card-hover cursor-pointer">
            <div className="flex gap-2 mb-4">
              <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-outline rounded uppercase">{debate.category}</span>
              {debate.isHot && <span className="px-2 py-0.5 bg-red-50 text-[10px] font-bold text-secondary rounded uppercase tracking-widest">Hot</span>}
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 group-hover:text-primary transition-colors">{debate.title}</h3>
            <p className="text-xs md:text-sm text-outline mb-6 md:mb-8 line-clamp-2 leading-relaxed">{debate.description}</p>
            <div className="pt-4 md:pt-6 border-t border-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-outline text-[10px] md:text-xs">
                <MessageSquare size={14} /> {debate.participants}
              </div>
              <span className="text-[10px] md:text-xs font-bold text-primary">참여하기</span>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* CTA */}
    <section className="text-center py-12 md:py-24 bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 card-hover px-6">
      <h2 className="text-2xl md:text-4xl font-black mb-8 md:mb-12 tracking-tight">깊이 있는 대화의 세계로<br />지금 바로 합류하세요</h2>
      <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4">
        <button onClick={() => setView('setup')} className="px-8 md:px-12 py-4 md:py-5 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base">회원가입</button>
        <button onClick={() => setView('search')} className="px-8 md:px-12 py-4 md:py-5 border-2 border-gray-100 text-on-surface font-bold rounded-xl hover:bg-gray-50 transition-all text-sm md:text-base">주제 둘러보기</button>
      </div>
    </section>
  </div>
  );
};

const AboutView = ({ setView }: { setView: (v: View) => void }) => (
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
          <button onClick={() => setView('setup')} className="px-6 md:px-8 py-3 md:py-4 bg-primary text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm md:text-base">지금 시작하기</button>
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

    <section className="bg-surface-container rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-16">
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

const SetupView = ({ 
  setView, 
  topic, 
  setTopic, 
  agentCount, 
  setAgentCount, 
  onStart 
}: { 
  setView: (v: View) => void,
  topic: string,
  setTopic: (t: string) => void,
  agentCount: number,
  setAgentCount: (n: number) => void,
  onStart: () => void
}) => (
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
                className="w-full bg-surface-container p-4 md:p-6 rounded-xl border-none focus:ring-2 focus:ring-primary min-h-[120px] md:min-h-[160px] resize-none text-sm md:text-base"
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

const DebateView = ({ 
  setView, 
  topic, 
  messages, 
  onSendMessage, 
  isGenerating,
  onFinish
}: { 
  setView: (v: View) => void,
  topic: string,
  messages: DebateMessage[],
  onSendMessage: (text: string) => void,
  isGenerating: boolean,
  onFinish: () => void
}) => {
  const [inputText, setInputText] = useState('');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const proCount = messages.filter(m => m.side === 'pro').length;
  const conCount = messages.filter(m => m.side === 'con').length;
  const totalCount = proCount + conCount;
  const proPercent = totalCount > 0 ? Math.round((proCount / totalCount) * 100) : 50;
  const conPercent = totalCount > 0 ? 100 - proPercent : 50;
  const neutralValue = totalCount === 0 ? '0.5 Neutral' : proPercent > conPercent ? `Pro dominant (${proPercent}%)` : `Con dominant (${conPercent}%)`;

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden relative">
      {/* Left Sidebar: Stats */}
      <motion.aside 
        initial={false}
        animate={{ width: isLeftSidebarOpen ? 320 : 0, opacity: isLeftSidebarOpen ? 1 : 0 }}
        className="bg-surface-container flex flex-col border-r border-gray-200 overflow-hidden relative hidden md:flex"
      >
        <div className="p-6 flex flex-col h-full w-80">
          <div className="mb-10">
            <h2 className="text-xl font-black font-headline mb-1 line-clamp-2">{topic}</h2>
            <p className="text-xs text-outline font-medium">실시간 분석 중</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 mb-6 card-hover">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold">대립 지표</h3>
              <span className="text-xs text-outline font-medium">{neutralValue}</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full relative overflow-hidden flex">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-400 z-10" />
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${proPercent}%` }} />
              <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${conPercent}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold text-outline uppercase tracking-widest">
              <span className={proPercent > 50 ? 'text-primary' : ''}>Pro</span>
              <span className={conPercent > 50 ? 'text-secondary' : ''}>Con</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 mb-8 card-hover">
            <h3 className="text-sm font-bold mb-6">토론 흐름</h3>
            <div className="h-24 flex items-center justify-center relative">
              <svg className="w-full h-full overflow-visible">
                <path 
                  d="M 0 40 Q 40 35, 80 42 T 160 40 T 240 42" 
                  fill="none" 
                  stroke="#d1d5db" 
                  strokeWidth="2" 
                />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] font-bold text-outline uppercase tracking-tighter">
                <span>Round 1</span>
                <span>Round 4</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {[
              { icon: <BarChart3 size={18} />, label: "분석", active: true },
              { icon: <MessageSquare size={18} />, label: "토론 흐름" },
              { icon: <FileText size={18} />, label: "뉴스 근거" },
              { icon: <Settings size={18} />, label: "설정" }
            ].map((item, i) => (
              <button key={i} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-bold text-sm ${item.active ? 'bg-white text-primary shadow-sm' : 'text-outline hover:bg-white/50'}`}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <button onClick={() => setView('setup')} className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm transition-all mt-6">
            새 토론 시작
          </button>
        </div>
      </motion.aside>

      {/* Left Sidebar Toggle Button */}
      <button 
        onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isLeftSidebarOpen ? 'left-[304px]' : 'left-4'}`}
      >
        {isLeftSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      {/* Center: Chat */}
      <main className="flex-1 flex flex-col bg-surface overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-6 md:space-y-8 custom-scrollbar relative">
          <div className="flex justify-center mb-8 md:mb-12">
            <span className="px-3 md:px-4 py-1 md:py-1.5 bg-gray-200 text-outline text-[9px] md:text-[10px] font-bold rounded-full uppercase tracking-widest">Round 1: Introduction</span>
          </div>

          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
              <Brain size={48} className="text-outline" />
              <p className="text-sm md:text-base text-outline font-medium">토론이 시작되기를 기다리고 있습니다...</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                {msg.role === 'user' ? <User size={18} /> : <Brain size={18} />}
              </div>
              <div className={`flex flex-col gap-1 md:gap-1.5 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] md:text-xs font-bold text-on-surface">
                    {msg.role === 'user' ? '나 (사용자)' : msg.agentName || 'AI 모더레이터'}
                  </span>
                  <span className="text-[9px] md:text-[10px] text-outline">{msg.timestamp || '14:02'}</span>
                </div>
                <div className={`p-4 md:p-6 rounded-2xl text-xs md:text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? msg.side === 'pro' 
                      ? 'bg-blue-50 border-2 border-blue-100 text-primary' 
                      : msg.side === 'con'
                        ? 'bg-red-50 border-2 border-red-100 text-secondary'
                        : 'bg-white border-2 border-dashed border-gray-200 text-outline' 
                    : 'bg-gray-100 text-on-surface'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-20 w-64 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 md:p-8 bg-transparent">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 md:gap-4 bg-white p-2 md:p-4 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100">
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-xs md:text-sm px-2" 
                placeholder="의견을 입력하세요..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button 
                onClick={handleSend}
                disabled={!inputText.trim() || isGenerating}
                className="p-2 md:p-3 bg-primary text-white rounded-xl md:rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Send size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar Toggle Button */}
      <button 
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isRightSidebarOpen ? 'right-[368px]' : 'right-4'}`}
      >
        {isRightSidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
      </button>

      {/* Right Sidebar: News */}
      <motion.aside 
        initial={false}
        animate={{ width: isRightSidebarOpen ? 384 : 0, opacity: isRightSidebarOpen ? 1 : 0 }}
        className="bg-white flex flex-col border-l border-gray-200 overflow-hidden relative hidden md:flex"
      >
        <div className="p-8 flex flex-col h-full w-96 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-secondary" />
              <h2 className="text-base font-black font-headline">근거 / 뉴스</h2>
            </div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Latest 3</span>
          </div>

          <div className="space-y-10">
            {[
              { 
                category: "TECH TRENDS", 
                color: "text-blue-600",
                title: "UAM 상용화, 2025년 서울 도심 첫 비행 예정", 
                desc: "국토교통부는 K-UAM 실증사업의 일환으로 내년 중 서울 도심 내에서 소음 및 안전성 테스트를 완료할 것이...",
                source: "NEWS.AI"
              },
              { 
                category: "ENVIRONMENT", 
                color: "text-emerald-600",
                title: "전기 추진 시스템, 기존 헬기 대비 70% 소음 감소", 
                desc: "항공 음향 전문가 그룹에 따르면 분산 전기 추진(DEP) 기술을 적용한 기체는 도심 일상 소음 수준으로 비행이...",
                source: "GLOBAL TECH"
              },
              { 
                category: "SOCIETY", 
                color: "text-orange-600",
                title: "지상 교통 체계와의 통합, 넘어야 할 거대한 산", 
                desc: "UAM이 성공하려면 버티포트(Vertiport)와 기존 대중교통 간의 원활한 환승 시스템 구축이 필수적이나 초기 투...",
                source: "URBAN ANALYTICS"
              }
            ].map((news, i) => (
              <article key={i} className="bg-white rounded-2xl border border-gray-100 p-5 card-hover">
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                    <img src={`https://picsum.photos/seed/uam-${i}/100/100`} alt="News" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold ${news.color} mb-1 block`}>{news.category}</span>
                    <h3 className="text-sm font-bold leading-tight line-clamp-2">{news.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-outline leading-relaxed line-clamp-3 mb-6">{news.desc}</p>
                <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                  <span className="text-[10px] font-bold text-outline uppercase">Source: {news.source}</span>
                  <button className="text-[10px] font-black text-on-surface uppercase tracking-widest hover:text-primary transition-colors">View Evidence</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </motion.aside>
    </div>
  );
};

const SearchView = ({ setView, setTopic }: { setView: (v: View) => void, setTopic: (t: string) => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredDebates = DEBATES.filter(debate => 
    debate.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    debate.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    debate.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            className="w-full bg-white border-2 border-gray-100 rounded-[1.5rem] md:rounded-[2rem] py-4 md:py-6 pl-12 md:pl-16 pr-6 md:pr-8 text-base md:text-lg focus:border-primary focus:ring-0 transition-all shadow-sm hover:shadow-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {filteredDebates.length > 0 ? (
          filteredDebates.map(debate => (
            <motion.div 
              layout
              key={debate.id} 
              className="group bg-white border border-gray-100 rounded-2xl p-6 md:p-8 card-hover cursor-pointer flex flex-col"
              onClick={() => {
                setTopic(debate.title);
                setView('setup');
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

const LoginView = ({ setView, setIsLoggedIn, setUserData }: { setView: (v: View) => void, setIsLoggedIn: (v: boolean) => void, setUserData: (d: any) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setIsLoggedIn(true);
        setUserData(data.user);
        setView('home');
      } else {
        alert(data.detail || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error("Login error:", error);
      alert('서버 통신 중 오류가 발생했습니다.');
    }
  };

  const handleGoogleLogin = () => {
    // Mock Google Login
    setIsLoggedIn(true);
    setUserData({
      nickname: generateRandomNickname(),
      email: 'google_user@gmail.com',
      interests: []
    });
    setView('home');
  };

  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-12 md:py-24">
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mb-3 md:mb-4">로그인</h1>
        <p className="text-sm md:text-base text-outline">Agora에 오신 것을 환영합니다.</p>
      </header>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50 card-hover">
        <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">이메일</label>
            <input 
              type="email" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">비밀번호</label>
            <input 
              type="password" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full py-3 md:py-4 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base"
          >
            로그인
          </button>

          <div className="relative py-3 md:py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[10px] md:text-xs uppercase"><span className="bg-white px-2 text-outline">또는</span></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 md:py-4 border border-gray-200 text-on-surface font-bold rounded-xl flex items-center justify-center gap-2 md:gap-3 hover:bg-gray-50 transition-all text-sm md:text-base"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 md:w-5 md:h-5" />
            Google 계정으로 로그인
          </button>

          <p className="text-center text-xs md:text-sm text-outline pt-3 md:pt-4">
            계정이 없으신가요? <button type="button" onClick={() => setView('signup')} className="text-primary font-bold hover:underline">회원가입</button>
          </p>
        </form>
      </div>
    </div>
  );
};

const SignupView = ({ setView, setIsLoggedIn, setUserData }: { setView: (v: View) => void, setIsLoggedIn: (v: boolean) => void, setUserData: (d: any) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    try {
      const nickname = generateRandomNickname();
      const res = await fetch('/api/user/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname })
      });
      const data = await res.json();
      if (res.ok) {
        setIsLoggedIn(true);
        setUserData(data.user);
        setView('home');
      } else {
        alert(data.detail || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error("Signup error:", error);
      alert('서버 통신 중 오류가 발생했습니다.');
    }
  };

  const handleGoogleSignup = () => {
    setIsLoggedIn(true);
    setUserData({
      nickname: generateRandomNickname(),
      email: 'google_user@gmail.com',
      interests: []
    });
    setView('home');
  };

  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-12 md:py-24">
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mb-3 md:mb-4">회원가입</h1>
        <p className="text-sm md:text-base text-outline">Agora의 일원이 되어보세요.</p>
      </header>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50 card-hover">
        <form onSubmit={handleSignup} className="space-y-4 md:space-y-6">
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">이메일</label>
            <input 
              type="email" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">비밀번호</label>
            <input 
              type="password" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">비밀번호 확인</label>
            <input 
              type="password" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full py-3 md:py-4 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base"
          >
            가입하기
          </button>

          <div className="relative py-3 md:py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[10px] md:text-xs uppercase"><span className="bg-white px-2 text-outline">또는</span></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignup}
            className="w-full py-3 md:py-4 border border-gray-200 text-on-surface font-bold rounded-xl flex items-center justify-center gap-2 md:gap-3 hover:bg-gray-50 transition-all text-sm md:text-base"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 md:w-5 md:h-5" />
            Google 계정으로 가입
          </button>

          <p className="text-center text-xs md:text-sm text-outline pt-3 md:pt-4">
            이미 계정이 있으신가요? <button type="button" onClick={() => setView('login')} className="text-primary font-bold hover:underline">로그인</button>
          </p>
        </form>
      </div>
    </div>
  );
};

const ProfileView = ({ isLoggedIn, setIsLoggedIn, userData, setUserData, setView }: { isLoggedIn: boolean, setIsLoggedIn: (v: boolean) => void, userData: any, setUserData: (d: any) => void, setView: (v: View) => void }) => {
  const [formData, setFormData] = useState({
    nickname: userData?.nickname || '',
    email: userData?.email || '',
    password: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setUserData({
      ...userData,
      nickname: formData.nickname,
      email: formData.email
    });
    alert('회원 정보가 수정되었습니다.');
  };

  if (!isLoggedIn) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-24">
      <div className="max-w-3xl">
        <header className="mb-12 md:mb-16">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-fixed text-primary rounded-2xl flex items-center justify-center mb-6 md:mb-8">
            <User size={32} className="md:w-10 md:h-10" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold font-headline tracking-tight mb-3 md:mb-4 text-left">회원 정보</h1>
          <p className="text-base md:text-lg text-outline text-left">Agora에서 당신의 활동 정보를 관리하세요.</p>
        </header>

        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 editorial-shadow border border-gray-50 card-hover">
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-10">
            <div className="space-y-2 md:space-y-3">
              <label className="text-sm md:text-base font-bold text-on-surface ml-1">닉네임</label>
              <input 
                type="text" 
                required
                className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                placeholder="닉네임을 입력하세요"
                value={formData.nickname}
                onChange={(e) => setFormData({...formData, nickname: e.target.value})}
              />
              <p className="text-[10px] md:text-xs text-outline ml-1">토론 시 표시되는 이름입니다.</p>
            </div>
            
            <div className="space-y-2 md:space-y-3">
              <label className="text-sm md:text-base font-bold text-on-surface ml-1">이메일</label>
              <input 
                type="email" 
                required
                className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:space-y-3">
              <label className="text-sm md:text-base font-bold text-on-surface ml-1">비밀번호 변경</label>
              <input 
                type="password" 
                className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                placeholder="새로운 비밀번호를 입력하세요 (입력 시 변경)"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <div className="pt-6 md:pt-8 flex gap-3 md:gap-4">
              <button 
                type="submit"
                className="flex-1 md:flex-none px-8 md:px-12 py-3 md:py-5 bg-primary text-white font-bold rounded-2xl transition-all text-sm md:text-base"
              >
                저장
              </button>
              <button 
                type="button"
                onClick={() => setView('home')}
                className="flex-1 md:flex-none px-8 md:px-12 py-3 md:py-5 border border-gray-200 text-outline font-bold rounded-2xl hover:bg-gray-50 transition-all text-sm md:text-base"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const FAQView = () => {
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

const ResultView = ({ setView, topic, result }: { setView: (v: View) => void, topic: string, result: string }) => (
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

export default function App() {
  const [view, setView] = useState<View>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const [userData, setUserData] = useState<any>(null);
  const [topic, setTopic] = useState('');
  const [agentCount, setAgentCount] = useState(3);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [debateResult, setDebateResult] = useState('');

  const handleStartDebate = async () => {
    if (!topic.trim()) return;
    setView('debate');
    setMessages([]);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/debate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await res.json();
      
      setMessages([{
        role: 'agent',
        agentName: data.agentName,
        side: data.side,
        content: data.content,
        timestamp: data.timestamp
      }]);
    } catch (error) {
      console.error("Failed to start debate:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    setIsGenerating(true);
    
    try {
      const res = await fetch('/api/debate/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, message: text, history: messages })
      });
      const data = await res.json();
      
      const userMsg: DebateMessage = {
        role: 'user',
        side: data.userSide,
        content: text,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, userMsg, {
        role: 'agent',
        agentName: data.aiResponse.agentName,
        side: data.aiResponse.side,
        content: data.aiResponse.content,
        timestamp: data.aiResponse.timestamp
      }]);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinishDebate = async () => {
    setView('result');
    setDebateResult('분석 중...');
    
    try {
      const res = await fetch('/api/debate/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, messages })
      });
      const data = await res.json();
      setDebateResult(data.result);
    } catch (error) {
      console.error("Failed to analyze debate:", error);
      setDebateResult("결과 분석에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar currentView={view} setView={setView} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {view === 'home' && <HomeView setView={setView} setTopic={setTopic} />}
            {view === 'about' && <AboutView setView={setView} />}
            {view === 'setup' && (
              <SetupView 
                setView={setView} 
                topic={topic} 
                setTopic={setTopic} 
                agentCount={agentCount} 
                setAgentCount={setAgentCount} 
                onStart={handleStartDebate}
              />
            )}
            {view === 'debate' && (
              <DebateView 
                setView={setView} 
                topic={topic} 
                messages={messages} 
                onSendMessage={handleSendMessage}
                isGenerating={isGenerating}
                onFinish={handleFinishDebate}
              />
            )}
            {view === 'result' && <ResultView setView={setView} topic={topic} result={debateResult} />}
            {view === 'faq' && <FAQView />}
            {view === 'search' && <SearchView setView={setView} setTopic={setTopic} />}
            {view === 'profile' && <ProfileView isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} userData={userData} setUserData={setUserData} setView={setView} />}
            {view === "login" && !isLoggedIn && (
              <LoginView
                setView={setView}
                setIsLoggedIn={setIsLoggedIn}
                setUserData={setUserData}
              />
            )}
            {view === "signup" && !isLoggedIn && (
              <SignupView
                setView={setView}
                setIsLoggedIn={setIsLoggedIn}
                setUserData={setUserData}
              />)}
          </motion.div>
        </AnimatePresence>
      </main>

      {view !== 'debate' && view !== 'result' && <Footer />}
    </div>
  );
}
