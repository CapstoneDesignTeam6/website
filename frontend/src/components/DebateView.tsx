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
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { DebateMessage, UserEvaluationScore, RelatedMaterial, Difficulty, AgentStep, MultipleChoiceQuiz } from '../types';
import { useNavigate } from 'react-router-dom';
import { debateApi } from '../services/api';
import { MOCK_REBUTTAL_HINT, MOCK_COUNTER_HINT } from '../mockData.ts';
import { formatTime } from '../utils';
import type { DebatePhase } from '../App';

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
  usedMaterials?: string[];
  agentSteps?: AgentStep[];
  difficulty?: Difficulty;
  speechTurn?: number;
  waitingForContinue?: boolean;
  onContinueDebate?: () => void;
  // ── 인라인 퀴즈 관련 ──
  debatePhase?: DebatePhase;
  onPhaseChange?: (phase: DebatePhase) => void;
  preQuizzes?: MultipleChoiceQuiz[];
  postQuizzes?: MultipleChoiceQuiz[];
  isQuizLoading?: boolean;
  onStartQuiz?: () => void;          // "퀴즈 풀기" 버튼 클릭 → pre-quiz 단계로 전환
  onPreQuizComplete?: () => void;   // 사전 퀴즈 완료 → turn=0 요청 후 debating 전환
  onPostQuizComplete?: () => void;  // 사후 퀴즈 완료 → ResultView 이동
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

  // step → 기본 label/desc 매핑 (data가 없을 때 폴백)
  const STEP_META: Record<string, { label: string; desc: string }> = {
    orchestrator: { label: '오케스트레이터', desc: '전략 수립 중' },
    search:       { label: '자료 탐색',      desc: '관련 자료 검색 중' },
    generate:     { label: '주장 생성',      desc: '논거 구성 중' },
    simplify:     { label: '쉬운 설명',      desc: '표현 변환 중' },
  };

  const backendSteps = agentSteps && agentSteps.length > 0
    ? agentSteps.map(s => {
        const meta = STEP_META[s.step] ?? { label: s.step, desc: '' };
        return {
          icon:   STEP_TYPE_TO_ICON[s.step] ?? Bot,
          label:  meta.label,
          desc:   s.data?.workspace_summary || meta.desc,
          status: s.status,
          data:   s.data,
        };
      })
    : null;

  const fallbackSteps = isEasy ? AGENT_STEPS_EASY : AGENT_STEPS_NORMAL;
  const steps = backendSteps ?? fallbackSteps.map(s => ({ ...s, status: 'pending' as const, data: undefined }));

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

  const activeStepData = steps[activeStep]?.data;

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
                    ? 'bg-primary text-white'
                    : i < activeStep
                    ? 'bg-primary/10 text-primary'
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
                  className={`${i < activeStep ? 'text-primary' : 'text-gray-300'}`}
                  animate={i === activeStep - 1 ? { opacity: [0.4, 1, 0.4] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight size={12} />
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
        {/* data.instruction이 있으면 현재 단계의 지시사항을 부가 정보로 표시 */}
        {activeStepData?.instruction && (
          <p className="text-[10px] text-gray-400 px-1 leading-relaxed max-w-xs line-clamp-2">
            {activeStepData.instruction}
          </p>
        )}
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
  totalRounds = 2,
  progress = 25,
  discussionId,
  usedMaterials,
  difficulty = 'normal',
  speechTurn = 1,
  waitingForContinue = false,
  onContinueDebate,
  debatePhase = 'debating',
  preQuizzes = [],
  postQuizzes = [],
  isQuizLoading = false,
  onStartQuiz,
  onPreQuizComplete,
  onPostQuizComplete,
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
    { sender: 'bot', text: '어떤 도움이 필요하신가요? "반박 힌트" 또는 "재반박 힌트"를 눌러보세요.', timestamp: formatTime() }
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

  useEffect(() => {
    // 히스토리 스택에 현재 상태를 하나 추가해서 뒤로가기를 가로챌 수 있게 함
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      navigate('/setup', { replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  const SPEECH_GUIDE: Record<number, string> = {
    1: '💡 주장: 주제에 대한 나의 입장과 근거를 제시해주세요',
    2: '✅ 반박: 에이전트의 주장에 반박해주세요',
    3: '🔄️ 재반박: 에이전트의 반박에 맞서 나의 주장을 강화해주세요',
  };

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
  // AI 응답(agent 메시지)이 새로 추가될 때마다 재조회 — 새 검색 결과가 Supabase에 저장된 직후
  const lastAgentMsgCount = messages.filter(m => m.role === 'agent').length;
  useEffect(() => {
    if (!discussionId) return;
    const fetchRelatedMaterials = async () => {
      setIsLoadingRelatedMaterials(true);
      try {
        const data = await debateApi.getRelatedMaterials(topic, discussionId || null);
        setRelatedMaterials(data);
      } catch (error) {
        console.error("Failed to fetch related materials:", error);
      } finally {
        setIsLoadingRelatedMaterials(false);
      }
    };
    fetchRelatedMaterials();
  }, [topic, discussionId, lastAgentMsgCount]); // AI 메시지 추가 시 재조회

  // 주장 생성 응답으로 받은 사용된 자료 링크를 기존 목록과 매칭해 used 자료를 위로 재배치
  useEffect(() => {
    if (!usedMaterials || usedMaterials.length === 0) return;
    // used_materials는 URL 문자열 배열이므로 그대로 Set으로 변환
    const usedUrls = new Set(usedMaterials.filter(url => !!url));
    setRelatedMaterials(prev => {
      const used = prev.filter(m => m.url && usedUrls.has(m.url)).map(m => ({ ...m, used: true }));
      const unused = prev.filter(m => !m.url || !usedUrls.has(m.url)).map(m => ({ ...m, used: false }));
      return [...used, ...unused];
    });
  }, [usedMaterials]);


  const prevMessageCountRef = useRef(0);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    console.log("DebateView received messages:", messages); // 디버깅용 로그 추가
    const currentCount = messages.length;
    // 처음 로드(빈 → 첫 메시지 포함)가 아니라 메시지가 새로 추가될 때만 스크롤
    if (currentCount > 0 && currentCount > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = currentCount;
  }, [messages]);

  // AI 생성 중(isGenerating) 상태 변화 시에도 스크롤 (AgentThinkingIndicator 등장 시)
  useEffect(() => {
    if (isGenerating) {
      scrollToBottom();
    }
  }, [isGenerating]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!inputText) {
      el.style.height = '2rem';
      el.style.overflowY = 'hidden';
      return;
    }
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

    setChatbotMessages(prev => [...prev, { sender: 'user', text: userMessage, timestamp: formatTime() }]);
    setIsHintGenerating(true);

    const isCounter = userMessage.includes('재반박 힌트');
    const isRebuttal = userMessage.includes('반박 힌트');

    if (isCounter || isRebuttal) {
      const hintType = isCounter ? '재반박' : '반박';
      try {
        const data = isCounter
          ? await debateApi.getCounterHint(discussionId)
          : await debateApi.getRebuttalHint(discussionId);
        setChatbotMessages(prev => [...prev, { sender: 'bot', text: data.hint || `${hintType} 힌트를 생성할 수 없습니다.`, timestamp: formatTime() }]);
      } catch (error) {
        console.error(`Error fetching ${hintType} hint:`, error);
        const fallback = isRebuttal ? MOCK_REBUTTAL_HINT : MOCK_COUNTER_HINT;
        setChatbotMessages(prev => [...prev, { sender: 'bot', text: fallback ?? `${hintType} 힌트를 가져오는 데 실패했습니다. 다시 시도해주세요.`, timestamp: formatTime() }]);
      } finally {
        setIsHintGenerating(false);
      }
    } else {
      setChatbotMessages(prev => [...prev, { sender: 'bot', text: '어떤 도움이 필요하신가요? "반박 힌트" 또는 "재반박 힌트"를 눌러보세요.', timestamp: formatTime() }]);
      setIsHintGenerating(false);
    }
  };

  // 렌더링 전 content 문자열 전처리:
  // 1. \n 이스케이프 문자열을 실제 줄바꿈으로 변환 (백엔드/목데이터 혼용 대응)
  // 2. ## / ### 헤더 줄 제거
  // 3. [1], [2] 등 인라인 각주 번호 제거
  const preprocessContent = (content: string): string =>
    content
      .replace(/\\n/g, '\n')
      .replace(/^#{1,6}\s+.+$/gm, '')
      .replace(/\[\d+\]/g, '')
      .trim();

  // **레이블**: 형태의 섹션 레이블을 children 배열에서 제거하는 함수
  // ReactMarkdown은 **foo**: bar 를 [<strong>foo</strong>, ": bar"] 로 파싱함
  // strong 커스텀 컴포넌트를 쓰지 않으므로 type === 'strong' 문자열 비교가 정확히 작동함
  const stripSectionLabels = (children: React.ReactNode): React.ReactNode[] => {
    const nodes = Array.isArray(children) ? children : [children];
    const result: React.ReactNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const next = nodes[i + 1];
      if (
        React.isValidElement(node) &&
        (node as React.ReactElement).type === 'strong' &&
        typeof next === 'string' &&
        (next as string).trimStart().startsWith(':')
      ) {
        const rest = (next as string).replace(/^\s*[:：]\s*/, '');
        if (rest) result.push(rest);
        i++;
      } else {
        result.push(node);
      }
    }
    return result;
  };


  const scoreLabels = [
    {
      key: 'specificity' as const,
      label: '발언 구체성',
      desc: '수치·사례·출처의 정밀도',
    },
    {
      key: 'causality' as const,
      label: '인과 연결',
      desc: '원인-결과-함의 연결 깊이',
    },
    {
      key: 'domain_breadth' as const,
      label: '도메인 폭',
      desc: '한 발언 안에서 넘나드는 영역의 수',
    },
    {
      key: 'information_autonomy' as const,
      label: '정보 자립도',
      desc: '스스로 구성한 정보 비율',
    },
    {
      key: 'conceptual_accuracy' as const,
      label: '개념 정확도',
      desc: '전문용어·고유명사의 정확한 사용',
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
    const values = [score.specificity.score, score.causality.score, score.domain_breadth.score, score.information_autonomy.score, score.conceptual_accuracy.score];
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
                        {evaluationScore[scoreLabels[activeTooltip].key].score} / 5
                      </p>
                      <button onClick={() => setActiveTooltip(null)} className="text-outline hover:text-on-surface">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] text-on-surface leading-relaxed mt-1">{scoreLabels[activeTooltip].desc}</p>
                    <div className="flex flex-col gap-1 border-t border-indigo-200 mt-2 pt-2">
                      <p className="text-[11px] font-bold text-primary">평가 이유</p>
                      <p className="text-[10px] text-outline leading-relaxed">{evaluationScore[scoreLabels[activeTooltip].key].reason}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex flex-col gap-2">
                {scoreLabels.map(({ key, label }, idx) => (
                  <div
                    key={key}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 cursor-pointer hover:bg-indigo-50 transition-colors"
                    onClick={() => setActiveTooltip(activeTooltip === idx ? null : idx)}
                  >
                    <span className="text-xs font-bold text-on-surface">{label}</span>
                    <span className="text-xs font-black text-primary">{evaluationScore[key].score} / 5</span>
                  </div>
                ))}
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
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all ${isScoreSidebarOpen ? 'left-75' : 'left-2'}`}
      >
        {isScoreSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* Center: Chat */}
      <main className="flex-1 flex flex-col bg-surface overflow-hidden relative">
        {/* Header with Topic and Progress */}
        <div className={`bg-white border-b border-gray-100 p-4 shadow-sm z-10 transition-all duration-300 ${isScoreSidebarOpen && isRelatedMaterialsSidebarOpen ? 'md:px-4' : isScoreSidebarOpen || isRelatedMaterialsSidebarOpen ? 'md:px-8' : 'md:px-14'}`}>
          <div className={`w-full py-0 transition-all duration-300 ${isScoreSidebarOpen && isRelatedMaterialsSidebarOpen ? 'px-2 md:px-3' : isScoreSidebarOpen || isRelatedMaterialsSidebarOpen ? 'px-3 md:px-4' : 'px-4 md:px-7'}`}>
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
                <div className="flex flex-col gap-0.5 px-5 py-1 bg-gray-50 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] font-bold text-outline uppercase">라운드</span>
                  <span className="text-xs font-black text-on-surface">
                    {currentRound} / {totalRounds}
                  </span>
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

        <div className={`flex-1 overflow-y-auto py-2 md:py-6 ${debatePhase === 'debating' ? 'pb-32 md:pb-36' : 'pb-8'} flex flex-col gap-6 md:gap-8 custom-scrollbar relative transition-all duration-300 ${isScoreSidebarOpen && isRelatedMaterialsSidebarOpen ? 'px-6 md:px-7' : isScoreSidebarOpen || isRelatedMaterialsSidebarOpen ? 'px-7 md:px-12' : 'px-8 md:px-21'}`} ref={scrollRef} style={{ overscrollBehavior: 'contain' }}>

          {/* ── intro 단계: turn=0 로딩 스피너 ── */}
          {debatePhase === 'intro' && isGenerating && (
            <AgentThinkingIndicator isEasy={difficulty === 'easy'} />
          )}

          {/* ── 메시지 목록: intro / pre-quiz / debating / post-quiz 모두 표시 ── */}
          {(debatePhase === 'intro' || debatePhase === 'pre-quiz' || debatePhase === 'debating' || debatePhase === 'post-quiz') && (
            <>
              {messages.length === 0 && !isGenerating && debatePhase === 'debating' && (
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
                        <span className="px-3 py-1 bg-gray-100 border border-gray-800  text-on-surface text-[10px] font-black rounded-full tracking-widest">
                          라운드 {msg.round} 
                        </span>
                      </div>
                    )}
                    <div className={`flex items-start gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <>
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
                          {msg.role === 'user' ? <User size={18} /> : <Brain size={18} />}
                        </div>
                        <div className={`flex flex-col gap-1 md:gap-1.5 max-w-[82%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                          <div className="flex items-center gap-2 px-1">
                            <span className="text-[10px] md:text-xs font-bold text-on-surface">
                              {msg.role === 'user' ? '나 (사용자)' : msg.agentName || 'AI 에이전트'}
                            </span>
                            <span className="text-[9px] md:text-[10px] text-outline">{msg.timestamp || '14:02'}</span>
                          </div>
                          <div className={`p-4 md:p-6 rounded-2xl text-xs md:text-sm leading-relaxed prose prose-sm max-w-none ${msg.role === 'user' ? 'bg-blue-50 border-2 border-primary text-gray-800' : 'bg-red-50 border-2 border-secondary text-gray-800'}`}>
                            <ReactMarkdown
                              components={{
                                h2: () => null,
                                h3: () => null,
                                ol: ({ children }) => <div className="flex flex-col gap-1.5 my-2">{children}</div>,
                                ul: ({ children }) => <div className="flex flex-col gap-1 my-2">{children}</div>,
                                li: ({ children }) => {
                                  const content = stripSectionLabels(children);
                                  const isEmpty = content.every(c => c === '' || c === null || c === undefined);
                                  if (isEmpty) return null;
                                  return <p className="mb-1.5 last:mb-0 leading-relaxed">{content}</p>;
                                },
                                p: ({ children }) => {
                                  const content = stripSectionLabels(children);
                                  const isEmpty = content.every(c => c === '' || c === null || c === undefined);
                                  if (isEmpty) return null;
                                  return <p className="mb-1.5 last:mb-0">{content}</p>;
                                },
                              }}
                            >
                              {preprocessContent(msg.content)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* ── intro 단계: turn=0 메시지 아래 "퀴즈 풀기" 버튼 ── */}
              {debatePhase === 'intro' && !isGenerating && messages.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={onStartQuiz}
                    className="px-8 py-3 bg-primary text-white font-black rounded-2xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg"
                  >
                    <HelpCircle size={18} /> 퀴즈 풀기
                  </button>
                </div>
              )}

              {/* ── 사전 퀴즈 (pre-quiz 단계, turn=0 메시지 아래에 이어서 표시) ── */}
              {debatePhase === 'pre-quiz' && (
                <InlineQuizPanel
                  quizzes={preQuizzes}
                  isLoading={isQuizLoading}
                  type="pre"
                  onComplete={onPreQuizComplete}
                  isCompleting={false}
                />
              )}

              {/* ── 사후 퀴즈 (post-quiz 단계, 메시지 아래에 이어서 표시) ── */}
              {debatePhase === 'post-quiz' && (
                <InlineQuizPanel
                  quizzes={postQuizzes}
                  isLoading={isQuizLoading}
                  type="post"
                  onComplete={onPostQuizComplete}
                  isCompleting={false}
                />
              )}

              {isGenerating && debatePhase === 'debating' && (
                <AgentThinkingIndicator isEasy={difficulty === 'easy'} />
              )}
            </>
          )}
        </div>

        {/* 입력창: debating 단계에서만 표시 */}
        {debatePhase === 'debating' && (
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
            {/* 계속 진행 선택 */}
            {waitingForContinue ? (
              <div className="px-1 py-3 flex flex-col items-center gap-3">
                <span className="text-sm font-bold text-on-surface">
                  토론이 끝났습니다. 다음 라운드를 계속 진행할까요?
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={onContinueDebate}
                    className="px-5 py-2 bg-primary text-white text-sm font-black rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    계속 진행
                  </button>
                  <button
                    onClick={onFinish}
                    className="px-5 py-2 bg-gray-200 text-on-surface text-sm font-black rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    토론 종료
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-1 py-2">
                  <span className="text-xs font-bold text-primary flex items-center gap-2">
                    {SPEECH_GUIDE[speechTurn]}
                  </span>
                </div>
                <div className="flex items-center bg-white px-3 py-1.5 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 gap-2">
                  <textarea
                    ref={textareaRef}
                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-xs md:text-sm resize-none custom-scrollbar"
                    style={{ height: '2rem', minHeight: '2rem', maxHeight: '16rem', overflowY: 'hidden', padding: '0.375rem' }}
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
              </>
            )}
          </div>
        </div>
        )}

        {/* 챗봇 플로팅 버튼 & 팝업 — debating 단계에서만 표시 */}
        {debatePhase === 'debating' && (
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
                        {msg.sender === 'bot' ? (
                          <div className="text-sm prose prose-sm max-w-none">
                            <ReactMarkdown
                              components={{
                                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                              }}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm">{msg.text}</p>
                        )}
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
        )}
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
                    {material.used && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">AI가 참고한 자료</span>}
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
        className={`absolute top-1/2 -translate-y-1/2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg transition-all ${isRelatedMaterialsSidebarOpen ? 'right-85' : 'right-2'}`}
      >
        {isRelatedMaterialsSidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <div className="h-24" />
    </div>
  );
};

// ─── 인라인 퀴즈 패널 ────────────────────────────────────────────────────────
// DebateView 채팅 영역 안에서 사전/사후 퀴즈를 순서대로 보여주는 컴포넌트.
// pre-quiz  : 마지막 문제 완료 후 onComplete() → App.tsx handlePreQuizComplete 호출
//             → turn=0 주제요약 메시지를 받아 채팅에 추가 후 debating 단계로 전환
// post-quiz : 마지막 문제 완료 후 onComplete() → App.tsx showResult 호출
//             → ResultView로 이동

interface InlineQuizPanelProps {
  quizzes: MultipleChoiceQuiz[];
  isLoading: boolean;
  type: 'pre' | 'post';
  onComplete?: () => void;
  isCompleting?: boolean; // onComplete 처리 중 (turn=0 API 호출 중)
}

const InlineQuizPanel = ({ quizzes, isLoading, type, onComplete, isCompleting }: InlineQuizPanelProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // 퀴즈 목록이 바뀌면 인덱스 초기화
  useEffect(() => {
    setCurrentIndex(0);
  }, [quizzes]);

  const handleNext = () => {
    if (currentIndex < quizzes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete?.();
    }
  };

  // 로딩 중 — AI 에이전트 말풍선 형태로
  if (isLoading) {
    return (
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gray-200 text-gray-500 flex items-center justify-center shrink-0 shadow-sm">
          <HelpCircle size={18} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] md:text-xs font-bold text-on-surface">AI 에이전트</span>
          </div>
          <div className="p-4 md:p-5 rounded-2xl bg-white border-2 border-gray-200 flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-gray-400 shrink-0" />
            <span className="text-xs md:text-sm text-gray-600">퀴즈를 불러오는 중입니다...</span>
          </div>
        </div>
      </div>
    );
  }

  // 퀴즈 없음 — 마찬가지로 말풍선 형태
  if (quizzes.length === 0) {
    return (
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gray-200 text-gray-500 flex items-center justify-center shrink-0 shadow-sm">
          <HelpCircle size={18} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] md:text-xs font-bold text-on-surface">AI 에이전트</span>
          </div>
          <div className="p-4 md:p-5 rounded-2xl bg-white border-2 border-gray-200 flex flex-col gap-3">
            <p className="text-xs md:text-sm text-gray-600">퀴즈를 불러오지 못했습니다.</p>
            <button
              onClick={() => onComplete?.()}
              className="self-start px-5 py-2 bg-gray-400 text-white font-bold rounded-full text-xs flex items-center gap-1.5 hover:bg-gray-500 transition-colors"
            >
              {type === 'pre' ? '토론 시작' : '결과 보기'} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLast = currentIndex === quizzes.length - 1;

  return (
    /* AI 에이전트 말풍선 레이아웃 — 기존 채팅 메시지와 동일한 구조 */
    <div className="flex items-start gap-3 md:gap-4">
      {/* 아바타 */}
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm">
        <HelpCircle size={18} />
      </div>

      <div className="flex flex-col gap-1 md:gap-1.5 max-w-[82%]">
        {/* 발신자 · 퀴즈 진행 표시 */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-primary text-[10px] md:text-xs font-bold">
            {type === 'pre' ? '토론 전 퀴즈' : '토론 후 퀴즈'} {currentIndex + 1} / {quizzes.length}
          </span>
        </div>

        {/* 말풍선 — 흰색 배경 */}
        <div className="p-4 md:p-5 rounded-2xl bg-white border-2 border-gray-200 text-gray-800">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <InlineMCQuizCard
                quiz={quizzes[currentIndex]}
                isLast={isLast}
                type={type}
                isCompleting={!!isCompleting}
                onNext={handleNext}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─── 인라인 객관식 퀴즈 카드 ─────────────────────────────────────────────────

interface InlineMCQuizCardProps {
  quiz: MultipleChoiceQuiz;
  isLast: boolean;
  type: 'pre' | 'post';
  isCompleting: boolean;
  onNext: () => void;
}

const InlineMCQuizCard = ({ quiz, isLast, type, isCompleting, onNext }: InlineMCQuizCardProps) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === quiz.correctIndex;

  // 문제가 바뀌면 선택 초기화
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [quiz]);

  const optionLabels = ['①', '②', '③', '④'];

  const getButtonClass = (index: number) => {
    const isSelected = selected === index;
    const isCorrectAnswer = quiz.correctIndex === index;
    if (!submitted) {
      return isSelected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-gray-200 bg-white hover:border-gray-300 text-on-surface';
    }
    if (isCorrectAnswer) return 'border-primary bg-primary/10 text-primary';
    if (isSelected && !isCorrect) return 'border-secondary bg-secondary/10 text-secondary';
    return 'border-gray-200 bg-white text-outline opacity-50';
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 문제 */}
      <div className="flex items-start gap-2.5">
        <p className="text-sm md:text-base font-bold leading-snug">{quiz.question}</p>
      </div>

      {/* 선택지 */}
      <div className="flex flex-col gap-2">
        {quiz.options.map((option, index) => (
          <button
            key={index}
            disabled={submitted}
            onClick={() => setSelected(index)}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl border-2 text-left transition-all text-xs md:text-sm font-medium ${getButtonClass(index)}`}
          >
            <span className="font-bold shrink-0 text-sm">{optionLabels[index]}</span>
            <span className="flex-1">{option}</span>
            {submitted && quiz.correctIndex === index && (
              <CheckCircle2 size={15} className="shrink-0 text-primary" />
            )}
            {submitted && selected === index && !isCorrect && index !== quiz.correctIndex && (
              <XCircle size={15} className="shrink-0 text-secondary" />
            )}
          </button>
        ))}
      </div>

      {/* 해설 */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3.5 rounded-xl ${isCorrect ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/10 border border-secondary/20'}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {isCorrect
                ? <CheckCircle2 size={14} className="text-primary shrink-0" />
                : <XCircle size={14} className="text-secondary shrink-0" />}
              <span className={`font-bold text-xs ${isCorrect ? 'text-primary' : 'text-secondary'}`}>
                {isCorrect
                  ? '정답입니다!'
                  : `아쉽네요! 정답은 ${optionLabels[quiz.correctIndex]} ${quiz.options[quiz.correctIndex]}`}
              </span>
            </div>
            <p className="text-[11px] text-outline leading-relaxed">
              <span className="font-bold text-on-surface">해설: </span>{quiz.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 버튼 */}
      <div className="flex justify-end pt-1">
        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={selected === null}
            className="px-6 py-2 bg-primary text-white font-bold rounded-full disabled:opacity-40 transition-all text-xs"
          >
            정답 확인
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={isCompleting}
            className="px-6 py-2 bg-primary text-white font-bold rounded-full flex items-center gap-1.5 hover:bg-gray-500 transition-all text-xs disabled:opacity-40"
          >
            {isCompleting ? (
              <><Loader2 size={14} className="animate-spin" /> 토론 준비 중...</>
            ) : (
              <>
                {isLast ? (type === 'pre' ? '토론 시작' : '최종 결과 보기') : '다음 문제'}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
