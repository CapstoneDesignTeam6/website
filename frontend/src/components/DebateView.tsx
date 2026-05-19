import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  FileText,
  Brain,
  BarChart3,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Minimize,
  Maximize,
  RefreshCw,
  Power,
  Search,
  Lightbulb,
  Zap,
  Bot,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DebateMessage, UserEvaluationScore, RelatedMaterial, Difficulty, AgentStep } from '../types';
import { useNavigate } from 'react-router-dom';
import { debateApi } from '../services/api'; // debateApi 임포트
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
  setFullScreenMode: (isFullScreen: boolean) => void;
  usedMaterialUrls?: string[];
  agentSteps?: AgentStep[];
  difficulty?: Difficulty;
}

const AGENT_STEPS_NORMAL = [
  { icon: Bot,    label: '오케스트레이터', desc: '전략 수립 중' },
  { icon: Search, label: '자료 탐색',      desc: '관련 자료 검색 중' },
  { icon: Brain,  label: '주장 생성',      desc: '논거 구성 중' },
];

const AGENT_STEPS_EASY = [
  { icon: Bot,      label: '오케스트레이터', desc: '전략 수립 중' },
  { icon: Search,   label: '자료 탐색',      desc: '관련 자료 검색 중' },
  { icon: Brain,    label: '주장 생성',      desc: '논거 구성 중' },
  { icon: Lightbulb, label: '쉬운 설명',    desc: '표현 변환 중' },
];

const AgentThinkingIndicator = ({ isEasy, agentSteps }: { isEasy: boolean; agentSteps?: AgentStep[] }) => {
  const STEP_TYPE_TO_ICON: Record<string, React.ElementType> = {
    orchestrator: Bot,
    search: Search,
    generate: Brain,
    simplify: Lightbulb,
  };

  const backendSteps = agentSteps && agentSteps.length > 0
    ? agentSteps.map(s => ({
        icon: STEP_TYPE_TO_ICON[s.step] ?? Bot,
        label: s.label,
        desc: s.description,
        status: s.status,
      }))
    : null;

  const fallbackSteps = isEasy ? AGENT_STEPS_EASY : AGENT_STEPS_NORMAL;
  const steps = backendSteps ?? fallbackSteps.map(s => ({ ...s, status: 'pending' as const }));

  const initialActive = backendSteps
    ? Math.max(0, backendSteps.findIndex(s => s.status === 'running'))
    : 0;
  const [activeStep, setActiveStep] = useState(initialActive);

  useEffect(() => {
    if (backendSteps) {
      const runningIdx = backendSteps.findIndex(s => s.status === 'running');
      setActiveStep(runningIdx >= 0 ? runningIdx : backendSteps.length - 1);
      return;
    }
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [agentSteps, steps.length]);

  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
        <Zap size={20} className="text-primary animate-pulse" />
      </div>
      <div className="flex flex-col gap-3 py-1">
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <React.Fragment key={i}>
              <motion.div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                  i === activeStep
                    ? 'bg-primary/10 text-primary'
                    : i < activeStep
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
                animate={i === activeStep ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.6, repeat: i === activeStep ? Infinity : 0, repeatType: 'loop' }}
              >
                {React.createElement(steps[i].icon, { size: 13 })}
                <span>{steps[i].label}</span>
              </motion.div>
              {i < steps.length - 1 && (
                <motion.span
                  className={`text-[10px] font-bold ${i < activeStep ? 'text-green-400' : 'text-gray-300'}`}
                  animate={i === activeStep - 1 ? { opacity: [0.4, 1, 0.4] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  →
                </motion.span>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 px-1">
          <motion.div
            className="flex gap-1"
            initial={false}
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
          <span className="text-[11px] text-outline">{steps[activeStep].desc}</span>
        </div>
      </div>
    </div>
  );
};

export const DebateView = ({
  topic,
  messages,
  setFullScreenMode,
  onSendMessage,
  isGenerating,
  onFinish,
  currentRound = 1,
  totalRounds = 4,
  progress = 25,
  discussionId,
  usedMaterialUrls,
  difficulty = 'normal',
}: DebateViewProps) => {
  const [inputText, setInputText] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isScoreSidebarOpen, setIsScoreSidebarOpen] = useState(true);
  const [evaluationScore, setEvaluationScore] = useState<UserEvaluationScore | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [isRelatedMaterialsSidebarOpen, setIsRelatedMaterialsSidebarOpen] = useState(true);
  const [relatedMaterials, setRelatedMaterials] = useState<RelatedMaterial[]>([]); // 관련 자료 상태
  const [isLoadingRelatedMaterials, setIsLoadingRelatedMaterials] = useState(true); // 관련 자료 로딩 상태
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ sender: 'user' | 'bot', text: string, timestamp: string }>>([
    { sender: 'bot', text: '어떤 도움이 필요하신가요? "반박 힌트" 또는 "재반박 힌트"라고 입력해보세요.', timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isHintGenerating, setIsHintGenerating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [chatbotSize, setChatbotSize] = useState({ width: 480, height: 350 });
  const [isFirstInput, setIsFirstInput] = useState(true);
  const [placeholder, setPlaceholder] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setPlaceholder("Ctrl + Enter를 눌러 의견을 제출해주세요.");
    /*
    if (isFirstInput) {
      const randomExample = examples[Math.floor(Math.random() * examples.length)];
      setPlaceholder(randomExample);
    } else {
      setPlaceholder("Ctrl + Enter를 눌러 의견을 제출해주세요");
    }
    */
  }, [isFirstInput, topic]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement !== null;
      setIsFullScreen(isCurrentlyFullscreen);
      setFullScreenMode(isCurrentlyFullscreen);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const fetchScore = async () => {
      setIsLoadingScore(true);
      try {
        const score = await debateApi.getUserEvaluation(discussionId);
        setEvaluationScore(score);
      } catch (_) {
      } finally {
        setIsLoadingScore(false);
      }
    };
    fetchScore();
  }, [messages.length, discussionId]);

  // 관련 자료를 백엔드에서 불러오는 useEffect
  useEffect(() => {
    const fetchRelatedMaterials = async () => {
      setIsLoadingRelatedMaterials(true); // 로딩 시작
      try {
        const data = await debateApi.getRelatedMaterials(topic);
        setRelatedMaterials(data);
      } catch (error) {
        console.error("Failed to fetch related materials:", error);
      } finally {
        setIsLoadingRelatedMaterials(false); // 로딩 종료
      }
    };
    fetchRelatedMaterials();
  }, [topic]); // 토론 주제가 변경될 때마다 다시 불러옴

  // 사용된 자료 URL이 바뀌면 해당 자료를 위로 재배치
  useEffect(() => {
    if (!usedMaterialUrls || usedMaterialUrls.length === 0) return;
    setRelatedMaterials(prev => {
      const used = prev.filter(m => m.url && usedMaterialUrls.includes(m.url)).map(m => ({ ...m, used: true }));
      const unused = prev.filter(m => !m.url || !usedMaterialUrls.includes(m.url)).map(m => ({ ...m, used: false }));
      return [...used, ...unused];
    });
  }, [usedMaterialUrls]);

  useEffect(() => {
    console.log("DebateView received messages:", messages); // 디버깅용 로그 추가
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '2rem';
    const newHeight = Math.min(el.scrollHeight, 256);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > 256 ? 'auto' : 'hidden';
  }, [inputText]);

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
  const handleHintRequest = async (userMessage: string) => {
    if (isHintGenerating) return;

    setChatbotMessages(prev => [...prev, { sender: 'user', text: userMessage, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }]);
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

  // 메시지 내용을 파싱하여 볼드체 태그를 처리하는 함수
  const renderContentWithHighlights = (content: string) => {
    // **...** 패턴을 찾아 분리합니다.
    // 정규식: /(\*\*.*?\*\*)/g
    const parts = content.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      // ** 태그로 시작하고 ** 태그로 끝나는 경우
      if (part && part.startsWith('**') && part.endsWith('**')) {
        // 태그를 제거하고 내부 텍스트만 추출합니다.
        const boldText = part.substring(2, part.length - 2);
        return <strong key={index} className="font-bold">{boldText}</strong>; // 볼드체 스타일 적용
      }
      return <React.Fragment key={index}>{part}</React.Fragment>; // 일반 텍스트는 그대로 반환
    });
  };

  const scoreLabels = [
    {
      key: 'specificity' as const,
      label: '발언 구체성',
      desc: '불확실한 발언의 비율에 따른 점수',
      tip: '구체적인 수치, 날짜, 이름 등을 발언에 포함해보세요. "많다", "크다" 같은 막연한 표현 대신 정확한 데이터를 인용하면 점수가 올라갑니다.',
    },
    {
      key: 'understanding' as const,
      label: '상황 이해도',
      desc: '현재 주제와 관련 있는 주장과 발언을 하는지에 따른 점수',
      tip: '토론 주제의 핵심 쟁점을 파악하고 발언이 항상 그 맥락과 연결되도록 유지하세요. 상대방의 논점에 직접 반응하는 것도 도움이 됩니다.',
    },
    {
      key: 'logic' as const,
      label: '논리력',
      desc: '근거의 품질, 주장의 검증 가능성과 신뢰성, 반례의 고려 유무 등 전반적인 논리력에 따른 점수',
      tip: '주장마다 검증 가능한 근거를 제시하고, 반례도 먼저 언급해 논리를 강화하세요. "왜냐하면 ~이기 때문입니다" 구조를 의식적으로 활용하세요.',
    },
    {
      key: 'informativeness' as const,
      label: '정보 주도성',
      desc: 'AI의 발언 외의 새로운 정보를 추가적으로 언급했는지에 따른 점수',
      tip: 'AI가 제시한 내용을 반복하기보다, 직접 알고 있는 사례·연구·통계를 새롭게 추가하세요. 독자적인 정보를 도입할수록 점수가 올라갑니다.',
    },
    {
      key: 'bias' as const,
      label: '편향도',
      desc: '유리한 통계만 사용하는지, 반례를 무시하는지, 감정적인 선동만을 무기로 하는지에 따른 점수',
      tip: '자신에게 불리한 데이터도 인정하되 반박하세요. 감정적 호소보다는 사실 기반 논거를 사용하고, 다양한 관점을 균형 있게 다루면 편향도 점수가 낮아집니다.',
    },
  ];

  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const PentagonChart = ({ score }: { score: UserEvaluationScore }) => {
    const size = 240;
    const padding = 46;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2 - padding;
    const n = 5;
    const angles = Array.from({ length: n }, (_, i) => -(Math.PI * 2 * i) / n - Math.PI / 2);
    const toXY = (r: number, angle: number) => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    const values = [score.specificity, score.understanding, score.logic, score.informativeness, 5 - score.bias];
    const gridLevels = [1, 2, 3, 4, 5];
    const gridPolygon = (ratio: number) => angles.map(a => { const p = toXY(maxR * ratio, a); return `${p.x},${p.y}`; }).join(' ');
    const dataPolygon = angles.map((a, i) => { const p = toXY(maxR * (values[i] / 5), a); return `${p.x},${p.y}`; }).join(' ');

    // 축 숫자 레이블 위치: 상단 축(angle[0]) 방향으로 배치
    const axisAngle = angles[0];
    const axisLabelPositions = gridLevels.map(lvl => toXY(maxR * (lvl / 5), axisAngle));

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible" style={{ maxWidth: '100%', aspectRatio: '1 / 1' }}>
        {gridLevels.map(lvl => (
          <polygon key={lvl} points={gridPolygon(lvl / 5)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {angles.map((a, i) => {
          const outer = toXY(maxR, a);
          return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        {/* 축 범위 숫자 */}
        {axisLabelPositions.map((pos, i) => (
          <text
            key={i}
            x={pos.x + 6}
            y={pos.y}
            textAnchor="start"
            dominantBaseline="middle"
            fontSize="8"
            fill="#9ca3af"
          >
            {gridLevels[i]}
          </text>
        ))}
        <polygon points={dataPolygon} fill="rgba(0,74,198,0.15)" stroke="#004ac6" strokeWidth="2" />
        {angles.map((a, i) => {
          const p = toXY(maxR * (values[i] / 5), a);
          return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#004ac6" />;
        })}
        {/* 레이블: 충분한 여백 확보 */}
        {angles.map((a, i) => {
          const labelR = maxR + 26;
          const p = toXY(labelR, a);
          const words = scoreLabels[i].label.split(' ');
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="700"
              fill={activeTooltip === i ? '#004ac6' : '#374151'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setActiveTooltip(activeTooltip === i ? null : i)}
            >
              {words.length === 1 ? (
                <tspan>{words[0]}</tspan>
              ) : (
                words.map((w, wi) => (
                  <tspan key={wi} x={p.x} dy={wi === 0 ? `-${(words.length - 1) * 6}` : '13'}>
                    {w}
                  </tspan>
                ))
              )}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className={`flex ${isFullScreen ? 'h-screen' : 'h-[calc(100vh-72px)]'} overflow-hidden relative`}>
      {/* Left Sidebar: 실시간 평가 점수 */}
      <motion.aside
        initial={false}
        animate={{ width: isScoreSidebarOpen ? 320 : 0, opacity: isScoreSidebarOpen ? 1 : 0 }}
        className="bg-white flex flex-col border-r border-gray-200 overflow-hidden relative md:flex order-first"
      >
        <div className="p-6 flex flex-col gap-3 h-full w-80 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className={evaluationScore ? 'text-primary' : 'text-outline'} />
            <h2 className="text-base font-black font-headline">실시간 평가 지표</h2>
          </div>
          {isLoadingScore ? (
            <div className="flex flex-col items-center justify-center gap-3 flex-1">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-xs text-outline">점수를 계산하는 중...</p>
            </div>
          ) : evaluationScore ? (
            <>
              <div className="w-full">
                <PentagonChart score={evaluationScore} />
              </div>
              <p className="text-[10px] text-outline text-center -mt-5 mb-1">지표 이름을 클릭하면 설명을 볼 수 있어요</p>
              <AnimatePresence>
                {activeTooltip !== null && (
                  <motion.div
                    key={activeTooltip}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="relative bg-indigo-50 border border-indigo-200 rounded-xl p-4"
                  >
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                      <p className="text-sm font-black text-primary">{scoreLabels[activeTooltip].label}</p>
                      <p className="text-base font-black text-primary">
                        {(() => { const k = scoreLabels[activeTooltip].key; const v = evaluationScore[k]; return k === 'bias' ? 5 - v : v; })()} / 5
                      </p>
                      <button onClick={() => setActiveTooltip(null)} className="text-outline hover:text-on-surface">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] text-on-surface leading-relaxed mt-1">{scoreLabels[activeTooltip].desc}</p>
                    <div className="flex flex-col gap-1 border-t border-indigo-200 mt-2 pt-2">
                      <p className="text-[11px] font-bold text-primary">점수 올리는 팁</p>
                      <p className="text-[10px] text-outline leading-relaxed">{scoreLabels[activeTooltip].tip}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex flex-col gap-2">
                {scoreLabels.map(({ key, label }, idx) => {
                  const raw = evaluationScore[key];
                  const displayValue = key === 'bias' ? 5 - raw : raw;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 cursor-pointer hover:bg-indigo-50 transition-colors"
                      onClick={() => setActiveTooltip(activeTooltip === idx ? null : idx)}
                    >
                      <span className="text-xs font-bold text-on-surface">{label}</span>
                      <span className="text-xs font-black text-primary">{displayValue} / 5</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center opacity-50">
              <p className="text-xs text-outline">첫 발언 후 점수가 표시됩니다.</p>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Left Sidebar Toggle Button */}
      <button
        onClick={() => setIsScoreSidebarOpen(!isScoreSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isScoreSidebarOpen ? 'left-75' : 'left-2'}`}
      >
        {isScoreSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* Center: Chat */}
      <main className="flex-1 flex flex-col bg-surface overflow-hidden relative">
        {/* Header with Topic and Progress */}
        <div className="bg-white border-b border-gray-100 p-4 md:px-14 shadow-sm z-10">
          <div className="w-full py-0 px-4 md:px-7">
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <h2 className="text-lg md:text-xl font-black font-headline line-clamp-1">{topic}</h2>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-primary whitespace-nowrap">{progress}%</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col gap-0.5 px-3 py-1 bg-gray-50 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] font-bold text-outline uppercase">현재 라운드</span>
                  <span className="text-xs font-black text-on-surface">{currentRound} / {totalRounds}</span>
                </div>
                <button onClick={() => navigateTo('/setup')} className="px-2 py-1 bg-primary text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1">
                  <RefreshCw size={14} /> {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '다시 시작'}
                </button>
                <button onClick={onFinish} className="px-2 py-1 bg-secondary text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1">
                  <Power size={14} /> {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '토론 종료'}
                </button>
                <button onClick={toggleFullScreen} className="px-2 py-1 bg-gray-100 text-on-surface rounded-xl font-bold text-xs transition-all flex items-center gap-1">
                  {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />} {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '전체 화면'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 pb-32 md:pb-36 flex flex-col gap-6 md:gap-8 custom-scrollbar relative" ref={scrollRef}>
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center opacity-40">
              <Brain size={48} className="text-outline" />
              <p className="text-sm md:text-base text-outline font-medium">토론이 시작되기를 기다리고 있습니다...</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showRoundIndicator = msg.round && (!prevMsg || prevMsg.round !== msg.round);

            return (
              <React.Fragment key={idx}>
                {showRoundIndicator && (
                  <div className="flex justify-center">
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
                        ? 'bg-blue-50 border-2 border-blue-200 text-gray-800'
                        : msg.side === 'con'
                          ? 'bg-red-50 border-2 border-red-200 text-gray-800'
                          : 'bg-white border-2 border-dashed border-gray-200 text-gray-700'
                    } whitespace-pre-wrap`}>
                      {renderContentWithHighlights(msg.content)}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {isGenerating && (
            <AgentThinkingIndicator isEasy={difficulty === 'easy'} />
          )}
        </div>

        {/* 입력창: 고정 크기, 챗봇 열림 여부와 무관 */}
        <div className="absolute bottom-0 left-0 right-0 pt-2 md:pt-3 pb-6 md:pb-6 bg-transparent">
          <div
            className="mx-auto"
            style={{
              paddingLeft: '1rem',
              paddingRight: '5rem',
              maxWidth: '60%',
              minWidth: '650px',
            }}
          >
            {isFirstInput && (
              <div className="px-1">
                <span className="text-xs font-bold text-primary flex items-center gap-2">
                  💡 첫 주장에는 찬반 입장을 포함해주세요
                </span>
              </div>
            )}
            <div className="flex items-center bg-white px-3 py-1.5 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 gap-2">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-xs md:text-sm resize-none custom-scrollbar"
                style={{ minHeight: '2rem', maxHeight: '16rem', overflowY: 'hidden', padding: '0.375rem' }}
                placeholder={placeholder}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isGenerating}
                className="shrink-0 p-1 md:p-2 bg-primary text-white rounded-xl md:rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Send size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 챗봇 플로팅 버튼 & 팝업 */}
        <div className="absolute bottom-6 right-6 z-60 flex flex-col items-end gap-4">
          <AnimatePresence>
            {isHelpOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                style={{ width: chatbotSize.width, height: chatbotSize.height }}
                className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col mb-2 relative"
              >
                {/* 드래그 핸들 (좌상단 모서리) */}
                <div
                  title="드래그하여 크기 조절"
                  className="absolute top-1 left-1 w-6 h-6 cursor-nw-resize z-10 flex items-center justify-center text-white/60 hover:text-white/90 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startW = chatbotSize.width;
                    const startH = chatbotSize.height;
                    const onMove = (me: MouseEvent) => {
                      setChatbotSize({
                        width: Math.max(280, startW - (me.clientX - startX)),
                        height: Math.max(300, startH - (me.clientY - startY)),
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2 Q2 2 2 10" />
                  </svg>
                </div>
                <div className="bg-primary p-4 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Brain size={18} />
                    </div>
                    <span className="font-bold text-sm">보조 에이전트</span>
                  </div>
                  <button onClick={() => setIsHelpOpen(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 text-xs text-outline leading-relaxed flex flex-col gap-2 custom-scrollbar">
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
                <div className="p-3 border-t border-gray-100 bg-white flex gap-2 shrink-0">
                  <button
                    onClick={() => handleHintRequest('반박 힌트')}
                    disabled={isHintGenerating}
                    className="flex-1 text-xs py-2 px-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    반박 힌트
                  </button>
                  <button
                    onClick={() => handleHintRequest('재반박 힌트')}
                    disabled={isHintGenerating}
                    className="flex-1 text-xs py-2 px-3 bg-secondary/10 text-secondary font-bold rounded-xl hover:bg-secondary/20 transition-colors disabled:opacity-50"
                  >
                    재반박 힌트
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="w-12 h-12 md:w-14 md:h-14 bg-transparent border-none flex items-center justify-center overflow-hidden hover:scale-110 transition-transform"
          >
            <img
              src="/help_icon.png"
              alt="Help Icon"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </button>
        </div>
      </main>

      {/* Right Sidebar: Related Materials (이전 Left Sidebar) */}
      <motion.aside 
        initial={false}
        // isRelatedMaterialsSidebarOpen 상태에 따라 너비 애니메이션
        animate={{ width: isRelatedMaterialsSidebarOpen ? 360 : 0, opacity: isRelatedMaterialsSidebarOpen ? 1 : 0 }}
        className="bg-white flex flex-col border-l border-gray-200 overflow-hidden relative md:flex order-last" // order-last로 우측 정렬
      >
        <div className="p-6 flex flex-col gap-3 h-full w-90 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-secondary" />
            <h2 className="text-base font-black font-headline">관련 자료</h2>
          </div>

          {isLoadingRelatedMaterials ? (
            <div className="flex flex-col items-center justify-center gap-4 h-full">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-outline">관련 자료를 불러오는 중입니다...</p>
            </div>
          ) : relatedMaterials.length > 0 ? (
            <div className="flex flex-col gap-5">
              {relatedMaterials.map((material, i) => (
                <article key={i} className={`flex flex-col gap-2 bg-white rounded-2xl border p-5 card-hover ${material.used ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${material.color}`}>{material.category}</span>
                    {material.used && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">주장에 사용됨</span>}
                  </div>
                  <h3 className="text-sm font-bold leading-tight">{material.title}</h3>
                  {material.description && (
                    <p className="text-[11px] text-outline leading-relaxed line-clamp-3">{material.description}</p>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                    <span className="text-[10px] font-bold text-outline uppercase">출처: {material.source}</span>
                    {material.url ? (
                      material.url.toLowerCase().endsWith('.pdf') ? (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-1"
                        >
                          <FileText size={11} /> PDF 보기 →
                        </a>
                      ) : (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          원문 보기 →
                        </a>
                      )
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
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all hidden md:block ${isRelatedMaterialsSidebarOpen ? 'right-85' : 'right-2'}`}
      >
        {isRelatedMaterialsSidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <div className="h-24" />
    </div>
  );
};
