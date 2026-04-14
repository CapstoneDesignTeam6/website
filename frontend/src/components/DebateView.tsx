import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Send, 
  FileText, 
  Brain,
  BarChart3,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { DebateMessage } from '../types';

interface DebateViewProps {
  topic: string;
  messages: DebateMessage[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  onFinish: () => void;
  currentRound?: number;
  totalRounds?: number;
  progress?: number;
  discussionId: number; // Add this prop
}

export const DebateView = ({ 
  topic, 
  messages, 
  onSendMessage, 
  isGenerating,
  onFinish,
  currentRound = 1,
  totalRounds = 4,
  progress = 25,
  discussionId, // Destructure the new prop
}: DebateViewProps) => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ sender: 'user' | 'bot', text: string, timestamp: string }>>([
    { sender: 'bot', text: '안녕하세요! 토론 진행 중 도움이 필요하시면 언제든 물어보세요. 주장이나 반박 작성을 도와드리겠습니다.', timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isHintGenerating, setIsHintGenerating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInput, setHelpInput] = useState('');
  const [isFirstInput, setIsFirstInput] = useState(true);
  const [placeholder, setPlaceholder] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const examples = [
    `"${topic}"에 찬성합니다. 왜냐하면...`,
    `"${topic}"은 필요하다고 생각합니다...`,
    `"${topic}"은 문제가 있다고 생각합니다...`,
    `"${topic}"에 반대합니다. 이유는...`
  ];

  useEffect(() => {
    if (isFirstInput) {
      const randomExample = examples[Math.floor(Math.random() * examples.length)];
      setPlaceholder(randomExample);
    } else {
      setPlaceholder("의견을 입력해주세요.");
    }
  }, [isFirstInput, topic]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText);
    setInputText('');
    if (isFirstInput) setIsFirstInput(false);
  };

  const handleHelpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpInput.trim() || isHintGenerating) return;

    const userMessage = helpInput;
    setChatbotMessages(prev => [...prev, { sender: 'user', text: userMessage, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
    setHelpInput('');
    setIsHintGenerating(true);

    let hintEndpoint = '';
    let hintType = '';

    if (userMessage.includes('재반박 힌트')) {
      hintEndpoint = `/api/debate/${discussionId}/counter-hint`;
      hintType = '재반박';
    } else if (userMessage.includes('반박 힌트')) {
      hintEndpoint = `/api/debate/${discussionId}/rebuttal-hint`;
      hintType = '반박';
    }

    if (hintEndpoint) {
      try {
        const response = await fetch(hintEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Assuming authentication token is handled globally or not needed for hints
            // 'Authorization': `Bearer ${yourAuthToken}`
          },
          // No body needed as per backend implementation, as the backend fetches discussion history by discussionId
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setChatbotMessages(prev => [...prev, { sender: 'bot', text: data.hint || `${hintType} 힌트를 생성할 수 없습니다.`, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
      } catch (error) {
        console.error(`Error fetching ${hintType} hint:`, error);
        setChatbotMessages(prev => [...prev, { sender: 'bot', text: `${hintType} 힌트를 가져오는 데 실패했습니다. 다시 시도해주세요.`, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
      } finally {
        setIsHintGenerating(false);
      }
    } else {
      // Generic response if no specific hint keyword is found
      setChatbotMessages(prev => [...prev, { sender: 'bot', text: '어떤 도움이 필요하신가요? "재반박 힌트" 또는 "반박 힌트"라고 입력해보세요.', timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
      setIsHintGenerating(false);
    }
  };

  const proCount = messages.filter(m => m.side === 'pro').length;
  const conCount = messages.filter(m => m.side === 'con').length;
  const totalCount = proCount + conCount;
  const proPercent = totalCount > 0 ? Math.round((proCount / totalCount) * 100) : 50;
  const conPercent = totalCount > 0 ? 100 - proPercent : 50;
  const neutralValue = totalCount === 0 ? '0.5 Neutral' : proPercent > conPercent ? `Pro dominant (${proPercent}%)` : `Con dominant (${conPercent}%)`;

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden relative">
      {/* Left Sidebar: Related Materials (Formerly News) */}
      <motion.aside 
        initial={false}
        animate={{ width: isLeftSidebarOpen ? 384 : 0, opacity: isLeftSidebarOpen ? 1 : 0 }}
        className="bg-white flex flex-col border-r border-gray-200 overflow-hidden relative md:flex"
      >
        <div className="p-8 flex flex-col h-full w-96 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-secondary" />
              <h2 className="text-base font-black font-headline">관련 자료</h2>
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

      {/* Left Sidebar Toggle Button */}
      <button 
        onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isLeftSidebarOpen ? 'left-92' : 'left-4'}`}
      >
        {isLeftSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* Center: Chat */}
      <main className="flex-1 flex flex-col bg-surface overflow-hidden relative">
        {/* Header with Topic and Progress */}
        <div className="bg-white border-b border-gray-100 p-4 md:p-6 shadow-sm z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-lg md:text-xl font-black font-headline line-clamp-1">{topic}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <span className="text-xs font-bold text-primary whitespace-nowrap">{progress}%</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-outline uppercase block mb-0.5">Current Round</span>
                  <span className="text-sm font-black text-on-surface">{currentRound} / {totalRounds}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-6 md:space-y-8 custom-scrollbar relative" ref={scrollRef}>
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
              <Brain size={48} className="text-outline" />
              <p className="text-sm md:text-base text-outline font-medium">토론이 시작되기를 기다리고 있습니다...</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            // Show round indicator if the round changes or it's the first message with a round
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showRoundIndicator = msg.round && (!prevMsg || prevMsg.round !== msg.round);
            
            return (
              <React.Fragment key={idx}>
                {showRoundIndicator && (
                  <div className="flex justify-center my-8">
                    <span className="px-4 py-1.5 bg-gray-200 text-outline text-[10px] font-bold rounded-full uppercase tracking-widest">
                      라운드 {msg.round}
                    </span>
                  </div>
                )}
                <div className={`flex items-start gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
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
                      msg.side === 'pro' 
                        ? 'bg-blue-50 border-2 border-blue-100 text-primary' 
                        : msg.side === 'con'
                          ? 'bg-red-50 border-2 border-red-100 text-secondary'
                          : 'bg-white border-2 border-dashed border-gray-200 text-outline' 
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

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
            {isFirstInput && (
              <div className="mb-3 px-4">
                <span className="text-xs font-bold text-primary flex items-center gap-2 animate-bounce">
                  💡 첫 주장에는 입장을 포함해주세요
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 md:gap-4 bg-white p-2 md:p-4 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100">
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-xs md:text-sm px-2" 
                placeholder={placeholder}
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

        {/* Floating Help Button & Chatbot Popup */}
        <div className="absolute bottom-6 right-6 z-60 flex flex-col items-end gap-4">
          <AnimatePresence>
            {isHelpOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                className="w-72 md:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col mb-2"
              >
                <div className="bg-primary p-4 text-white flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Brain size={18} />
                    </div>
                    <span className="font-bold text-sm">도움말 챗봇</span>
                  </div>
                  <button onClick={() => setIsHelpOpen(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                    <ChevronRight size={20} className="rotate-90" />
                  </button>
                </div>
                <div className="p-4 h-48 overflow-y-auto bg-gray-50 text-xs text-outline leading-relaxed flex flex-col space-y-2 custom-scrollbar">
                  {chatbotMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-2 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
                        <p className="text-sm">{msg.text}</p>
                        <span className={`block text-[9px] mt-1 ${msg.sender === 'user' ? 'text-white/70' : 'text-gray-500'}`}>{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}
                  {isHintGenerating && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] p-2 rounded-lg bg-white text-gray-800 border border-gray-100">
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleHelpSubmit} className="p-3 border-t border-gray-100 bg-white flex gap-2">
                  <input 
                    type="text"
                    value={helpInput}
                    onChange={(e) => setHelpInput(e.target.value)}
                    placeholder="무엇을 도와드릴까요?"
                    className="flex-1 text-xs px-3 py-2 bg-gray-50 rounded-xl border-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button type="submit" className="p-2 bg-primary text-white rounded-lg hover:scale-105 transition-transform">
                    <Send size={14} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-2xl border border-gray-100 flex items-center justify-center overflow-hidden hover:scale-110 transition-transform group"
          >
            {/* 아이콘에 이미지 삽입 */}
            <img 
              src="../assets/logo.png" 
              alt="Help Icon" 
              className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
              referrerPolicy="no-referrer"
            />
          </button>
        </div>
      </main>

      {/* Right Sidebar Toggle Button */}
      <button 
        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isRightSidebarOpen ? 'right-76' : 'right-4'}`}
      >
        {isRightSidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Right Sidebar: Stats (Currently Commented Out) */}
      <motion.aside 
        initial={false}
        animate={{ width: isRightSidebarOpen ? 320 : 0, opacity: isRightSidebarOpen ? 1 : 0 }}
        className="bg-surface-container flex flex-col border-l border-gray-200 overflow-hidden relative md:flex"
      >
        <div className="p-6 flex flex-col h-full w-80">
          <div className="mb-10">
            <h2 className="text-xl font-black font-headline mb-1 line-clamp-2">{topic}</h2>
            <p className="text-xs text-outline font-medium">실시간 분석 중</p>
          </div>
          
          {/* 대립 지표 (주석 처리)
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
          */}

          {/* 토론 흐름 (주석 처리)
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
          */}

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

          <button onClick={() => navigate('/setup')} className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm transition-all mt-6">
            새 토론 시작
          </button>
          <button onClick={onFinish} className="w-full py-4 bg-secondary text-white rounded-xl font-bold text-sm transition-all mt-2">
            토론 종료 및 분석
          </button>
        </div>
      </motion.aside>
    </div>
  );
};
