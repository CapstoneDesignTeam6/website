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
  User,
  Minimize, // 전체 화면 축소 아이콘 추가
  Maximize, // 전체 화면 아이콘 추가
  RefreshCw, // 새 토론 시작 아이콘
  Power, // 토론 종료 아이콘
} from 'lucide-react'; // lucide-react 아이콘 임포트
import { motion, AnimatePresence } from 'motion/react';
import { DebateMessage } from '../types'; // DebateMessage 타입 임포트
import { useNavigate } from 'react-router-dom';
import { debateApi } from '../services/api'; // debateApi 임포트
import { MOCK_RELATED_MATERIALS } from '../mockData.ts'; // 목 관련 자료 임포트
import { MOCK_REBUTTAL_HINT } from '../mockData.ts'; // 목 반박 힌트 임포트

interface DebateViewProps {
  topic: string;
  messages: DebateMessage[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  onFinish: () => void;
  currentRound?: number;
  totalRounds?: number;
  progress?: number;
  discussionId: number;
  setFullScreenMode: (isFullScreen: boolean) => void; // 전체 화면 모드 설정 함수 추가
}

export const DebateView = ({ 
  topic, 
  messages, 
  setFullScreenMode, // prop으로 전달받음
  onSendMessage, 
  isGenerating,
  onFinish,
  currentRound = 1,
  totalRounds = 4,
  progress = 25,
  discussionId, // Destructure the new prop
}: DebateViewProps) => {
  const [inputText, setInputText] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false); // 전체 화면 상태
  // 관련 자료 사이드바 상태 (이전 isLeftSidebarOpen -> isRelatedMaterialsSidebarOpen)
  const [isRelatedMaterialsSidebarOpen, setIsRelatedMaterialsSidebarOpen] = useState(true);
  const [relatedMaterials, setRelatedMaterials] = useState<any[]>([]); // 관련 자료 상태
  const [isLoadingRelatedMaterials, setIsLoadingRelatedMaterials] = useState(true); // 관련 자료 로딩 상태
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ sender: 'user' | 'bot', text: string, timestamp: string }>>([
    { sender: 'bot', text: '안녕하세요! 토론 진행 중 도움이 필요하시면 언제든 물어보세요. 반박 힌트를 알려드리겠습니다.', timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isHintGenerating, setIsHintGenerating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInput, setHelpInput] = useState('');
  const [isFirstInput, setIsFirstInput] = useState(true);
  const [placeholder, setPlaceholder] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const navigateTo = (path: string) => {
    navigate(path);
  };

  const examples = [
    `~에 찬성합니다. 왜냐하면...`,
    `~은 필요하다고 생각합니다...`,
    `~은 문제가 있다고 생각합니다...`,
    `~에 반대합니다. 이유는...`
  ];

  useEffect(() => {
    if (isFirstInput) {
      const randomExample = examples[Math.floor(Math.random() * examples.length)];
      setPlaceholder(randomExample);
    } else {
      setPlaceholder("의견을 입력해주세요.");
    }
  }, [isFirstInput, topic]);

  // 관련 자료를 백엔드에서 불러오는 useEffect
  useEffect(() => {
    const fetchRelatedMaterials = async () => {
      setIsLoadingRelatedMaterials(true); // 로딩 시작
      try {
        const data = await debateApi.getRelatedMaterials(topic); // API 호출
        setRelatedMaterials(data); // 데이터 설정
      } catch (error) {
        console.error("Failed to fetch related materials:", error);
        setRelatedMaterials(MOCK_RELATED_MATERIALS); // API 호출 실패 시 목 데이터 사용
      } finally {
        setIsLoadingRelatedMaterials(false); // 로딩 종료
      }
    };
    fetchRelatedMaterials();
  }, [topic]); // 토론 주제가 변경될 때마다 다시 불러옴

  useEffect(() => {
    console.log("DebateView received messages:", messages); // 디버깅용 로그 추가
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

  // 전체 화면 토글 함수
  const toggleFullScreen = () => {
    const newState = !isFullScreen;
    setIsFullScreen(newState);
    setFullScreenMode(newState); // App.tsx에 전체 화면 상태 전달
    if (newState) {
      document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen request failed:", e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
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
      // 목 데이터 사용 (기존 API 호출 주석 처리)

      // 목 데이터 응답 처리
      setChatbotMessages(prev => [...prev, { sender: 'bot', text: MOCK_REBUTTAL_HINT, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
      setIsHintGenerating(false);
      return; // 목 데이터 처리 후 함수 종료
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
        // // 기존 API 호출 로직 (주석 처리)
        // const response = await fetch(hintEndpoint, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     // Assuming authentication token is handled globally or not needed for hints
        //     // 'Authorization': `Bearer ${yourAuthToken}`
        //   },
        //   // No body needed as per backend implementation, as the backend fetches discussion history by discussionId
        // });

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
    <div className={`flex ${isFullScreen ? 'h-screen' : 'h-[calc(100vh-72px)]'} overflow-hidden relative`}>
      {/* Left Sidebar (비어있음 - 이전 관련 자료 사이드바는 우측으로 이동) */}
      {/* <motion.aside
        initial={false}
        animate={{ width: 0, opacity: 0 }} // 항상 닫혀있음
        className="bg-white flex flex-col border-r border-gray-200 overflow-hidden relative md:flex"
      >
      </motion.aside> */}

      {/* Left Sidebar Toggle Button */}
      {/* 이전 좌측 사이드바 토글 버튼은 우측 사이드바 토글 버튼으로 변경됨 */}

      {/* Center: Chat */}
      <main className="flex-1 flex flex-col bg-surface overflow-hidden relative">
        {/* Header with Topic and Progress */}
        <div className="bg-white border-b border-gray-100 p-2 md:p-3 shadow-sm z-10"> {/* 주제 섹션의 상단 패딩을 더 줄여 높이 감소 */}
          <div className="max-w-4xl mx-auto py-0 md:py-1"> {/* 주제 섹션의 상하 패딩을 더 줄여 높이 감소 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"> {/* 요소 간 간격 조정 */}
              <div className="flex-1">
                <h2 className="text-lg md:text-xl font-black font-headline line-clamp-1">{topic}</h2>
                <div className="flex items-center gap-3 mt-1"> {/* 진행률 바 상단 마진 조정 */}
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-primary whitespace-nowrap">{progress}%</span> {/* 텍스트 크기 조정 */}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0"> {/* 버튼 간 간격 조정 */}
                <div className="px-3 py-1 bg-gray-50 rounded-xl border border-gray-100"> {/* 라운드 표시 패딩 조정 */}
                  <span className="text-[10px] font-bold text-outline uppercase block mb-0.5">현재 라운드</span>
                  <span className="text-xs font-black text-on-surface ">{currentRound} / {totalRounds}</span> {/* 텍스트 크기 조정 */}
                </div>
                {/* 새 토론 시작 및 토론 종료 버튼 패딩 조정 */}
                <button onClick={() => navigateTo('/setup')} className="px-2 py-1 bg-primary text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1">
                  <RefreshCw size={14} /> 다시 시작
                </button>
                <button onClick={onFinish} className="px-2 py-1 bg-secondary text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1">
                  <Power size={14} /> 토론 종료
                </button>
                <button onClick={toggleFullScreen} className="px-2 py-1 bg-gray-100 text-on-surface rounded-xl font-bold text-xs transition-all flex items-center gap-1">
                  {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />} 전체 화면
                </button>
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
                        {msg.role === 'user' ? '나 (사용자)' : msg.agentName || 'AI 에이전트'}
                      </span>
                      <span className="text-[9px] md:text-[10px] text-outline">{msg.timestamp || '14:02'}</span>
                    </div>
                    <div className={`p-4 md:p-6 rounded-2xl text-xs md:text-sm leading-relaxed ${
                      msg.side === 'pro' 
                        ? 'bg-blue-50 border-2 border-blue-100 text-primary' 
                        : msg.side === 'con'
                          ? 'bg-red-50 border-2 border-red-100 text-secondary'
                          : 'bg-white border-2 border-dashed border-gray-200 text-outline' 
                    } whitespace-pre-wrap`}> {/* 줄바꿈 기호가 적용되도록 whitespace-pre-wrap 추가 */}
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

        <div className="pt-2 md:pt-3 pb-6 md:pb-8 bg-transparent"> {/* 입력창 섹션의 상단 패딩은 유지하고 하단 패딩을 늘려 마진 증가 */}
          <div className="max-w-3xl mx-auto">
            {isFirstInput && (
              <div className="mb-2 px-4"> {/* 첫 입력 가이드 메시지 마진 조정 */}
                <span className="text-xs font-bold text-primary flex items-center gap-2 animate-bounce">
                  💡 첫 주장에는 입장을 포함해주세요
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 md:gap-4 bg-white p-1 md:p-2 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100"> {/* 입력창 컨테이너 패딩 조정 */}
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-xs md:text-sm px-2 py-1" /* 입력 필드 상하 패딩 추가 */
                placeholder={placeholder}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)} // 입력 필드 높이 조정을 위해 py-2 제거
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
                className="p-1 md:p-2 bg-primary text-white rounded-xl md:rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50" /* 전송 버튼 패딩 조정 */
              >
                <Send size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Floating Help Button & Chatbot Popup */}
        <div className={`absolute bottom-6 z-60 flex flex-col gap-4 ${ // 챗봇 위치를 입력창과 수평으로 맞추기 위해 bottom-6으로 조정
          isRelatedMaterialsSidebarOpen
            ? 'right-10 items-end' // 관련 자료 사이드바가 열려있으면 사이드바 너비(24rem) + 여백(1rem) 만큼 왼쪽으로 이동
            : 'right-6 items-end' // 관련 자료 사이드바가 닫혀있으면 화면 오른쪽 끝에서 1.5rem (right-6) 만큼 이동
        }`}> {/* 챗봇 전체를 오른쪽 하단으로 이동하고 입력창과 겹치지 않도록 높이 조정 */}
          {/* isRelatedMaterialsSidebarOpen이 true일 때 (사이드바 열림), 사이드바 너비(w-96 = 24rem) + 여백(1rem) 만큼 왼쪽으로 이동하여 right-[calc(24rem+1rem)]로 설정.
              isRelatedMaterialsSidebarOpen이 false일 때 (사이드바 닫힘), 화면 오른쪽 끝에서 right-6 만큼 이동.
              items-end로 변경하여 팝업이 버튼의 오른쪽에 정렬되도록 함. */}
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
                    <span className="font-bold text-sm">보조 에이전트</span> {/* 보조 에이전트 제목 */}
                  </div>
                  <button onClick={() => setIsHelpOpen(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                    <ChevronLeft size={20} /> {/* 닫기 아이콘 방향 변경 (좌측으로) */}
                  </button>
                </div>
                <div className="p-4 h-48 overflow-y-auto bg-gray-50 text-xs text-outline leading-relaxed flex flex-col space-y-2 custom-scrollbar">
                  {chatbotMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}> {/* 메시지 정렬 */}
                      <div className={`max-w-[80%] p-2 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
                        <p className="text-sm">{msg.text}</p>
                        <span className={`block text-[9px] mt-1 ${msg.sender === 'user' ? 'text-white/70' : 'text-gray-500'}`}>{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}
                  {isHintGenerating && (
                    <div className="flex justify-start"> {/* 힌트 생성 중 로딩 스피너 */}
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
                  <button type="submit" className="p-2 bg-primary text-white rounded-lg hover:scale-105 transition-transform"> {/* 전송 버튼 */}
                    <Send size={14} /> {/* 전송 아이콘 */}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="w-12 h-12 md:w-14 md:h-14 bg-gray-100 border-gray-100 flex items-center justify-center overflow-hidden hover:scale-110 transition-transform group"
          > {/* 챗봇 토글 버튼 */}
            {/* 아이콘에 이미지 삽입 */}
            <img 
              src="/help_icon.png" 
              alt="Help Icon" 
              className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
              referrerPolicy="no-referrer"
            />
          </button>
        </div>
      </main>

      {/* Right Sidebar: Related Materials (이전 Left Sidebar) */}
      <motion.aside 
        initial={false}
        // isRelatedMaterialsSidebarOpen 상태에 따라 너비 애니메이션
        animate={{ width: isRelatedMaterialsSidebarOpen ? 384 : 0, opacity: isRelatedMaterialsSidebarOpen ? 1 : 0 }}
        className="bg-white flex flex-col border-l border-gray-200 overflow-hidden relative md:flex order-last" // order-last로 우측 정렬
      >
        <div className="p-8 flex flex-col h-full w-96 overflow-y-auto custom-scrollbar">
          <div className="mb-10">
            <div className="flex items-center gap-2"> {/* 관련 자료 제목 */}
              <FileText size={20} className="text-secondary" />
              <h2 className="text-base font-black font-headline">관련 자료</h2>
            </div>
          </div>

          {isLoadingRelatedMaterials ? ( // 관련 자료 로딩 중일 때
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin text-primary mb-4" /> {/* 로딩 스피너 */}
              <p className="text-outline">관련 자료를 불러오는 중입니다...</p>
            </div>
          ) : relatedMaterials.length > 0 ? ( // 관련 자료가 있을 때
            <div className="space-y-10">
              {relatedMaterials.map((material, i) => (
                <article key={i} className="bg-white rounded-2xl border border-gray-100 p-5 card-hover">
                  <span className={`text-[10px] font-bold ${material.color} mb-1 block`}>{material.category}</span>
                  <h3 className="text-sm font-bold leading-tight mb-2">{material.title}</h3> {/* 자료 제목 */}
                  {material.description && (
                    <p className="text-[11px] text-outline leading-relaxed line-clamp-3 mb-3">{material.description}</p>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                    <span className="text-[10px] font-bold text-outline uppercase">출처: {material.source}</span>
                    {material.url ? (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        원문 보기 →
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300">링크 없음</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : ( // 관련 자료가 없을 때
            <div className="text-center py-12 text-outline">
              <p>관련 자료를 찾을 수 없습니다.</p> {/* 자료 없음 메시지 */}
            </div>
          )}
        </div>
      </motion.aside>
<button
        
        onClick={() => setIsRelatedMaterialsSidebarOpen(!isRelatedMaterialsSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isRelatedMaterialsSidebarOpen ? 'right-92' : 'right-4'}`} // 위치 조정
      > {/* 관련 자료 사이드바 토글 버튼 */}
        {isRelatedMaterialsSidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />} {/* 아이콘 방향 변경 */}
      </button>

      <div className="h-24" />
    </div>
  );
};
