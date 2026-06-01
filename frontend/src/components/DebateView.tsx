import React, { useState, useEffect, useRef } from 'react';
import { DebateTutorial, getTutorialStorageKey } from './DebateTutorial.tsx';
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
  BookOpen,
  MessageCircle,
  RotateCcw,
  Flag,
  Info,
  Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { DebateMessage, UserEvaluationScore, RelatedMaterial, Difficulty, AgentStep, MultipleChoiceQuiz, UserData } from '../types';
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
  agentSteps?: AgentStep[];
  agentLog?: string[];
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
  userData?: UserData | null;
}

const STEP_META: Record<string, { icon: React.ElementType; label: string; desc: string }> = {
  orchestrator: { icon: Bot,       label: '오케스트레이터', desc: '전략 수립 중' },
  search:       { icon: Search,    label: '자료 탐색',      desc: '참고 자료 검색 중' },
  generate:     { icon: Brain,     label: '주장 생성',      desc: '논거 구성 중' },
  simplify:     { icon: Lightbulb, label: '난이도 조정',    desc: '표현 변환 중' },
};

// generate 타입은 agent_id에 따라 라벨/설명이 달라짐 (1=주장, 2=설명, 3=반박)
const AGENT_LABEL: Record<number, { label: string; desc: string }> = {
  1: { label: '주장 생성', desc: '논거 구성 중' },
  2: { label: '주제 설명', desc: '배경 정리 중' },
  3: { label: '반박 생성', desc: '반론 구성 중' },
};

const NORMAL_STEP_KEYS = ['orchestrator', 'search', 'generate'];
const EASY_STEP_KEYS   = ['orchestrator', 'search', 'generate', 'simplify'];

// instruction 텍스트 순차 전환하는 컴포넌트
// 문장 단위로 분리하되, 한 문장이 MAX_WORDS_PER_CHUNK 단어를 초과하면 단어 청크로 재분리
const MAX_WORDS_PER_CHUNK = 50;

const splitIntoChunks = (text: string): string[] => {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const result: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= MAX_WORDS_PER_CHUNK) {
      result.push(sentence);
    } else {
      for (let i = 0; i < words.length; i += MAX_WORDS_PER_CHUNK) {
        result.push(words.slice(i, i + MAX_WORDS_PER_CHUNK).join(' '));
      }
    }
  }
  return result;
};

const InstructionScroller = ({ text }: { text: string }) => {
  const chunks = splitIntoChunks(text);


  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [text]);

  useEffect(() => {
    if (chunks.length <= 1) return;
    const timer = setTimeout(() => {
      setIdx(prev => (prev + 1) % chunks.length);
    }, 2500);
    return () => clearTimeout(timer);
  }, [idx, chunks.length]);

  return (
    <div className="overflow-hidden h-8 px-1">
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          className="text-sm text-gray-400 leading-relaxed line-clamp-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
        >
          {chunks[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

const AgentThinkingIndicator = ({ isEasy, agentSteps, agentLog }: { isEasy: boolean; agentSteps?: AgentStep[]; agentLog?: string[] }) => {
  const backendSteps = agentSteps && agentSteps.length > 0
    ? agentSteps.map(s => {
        const meta = STEP_META[s.step] ?? { icon: Bot, label: s.step, desc: '' };
        // generate 타입은 agent_id로 라벨/설명을 세분화 (1=주장, 2=설명, 3=반박)
        const agentMeta = s.step === 'generate' && s.data?.agent_id != null
          ? AGENT_LABEL[s.data.agent_id]
          : undefined;
        const label = agentMeta?.label ?? meta.label;
        const progressDesc = s.data?.workspace_summary || agentMeta?.desc || meta.desc;
        return {
          icon:   meta.icon,
          label,
          desc:   progressDesc,
          status: s.status,
          data:   s.data,
        };
      })
    : null;

  const fallbackKeys = isEasy ? EASY_STEP_KEYS : NORMAL_STEP_KEYS;
  const steps = backendSteps ?? fallbackKeys.map(key => ({ ...STEP_META[key], status: 'pending' as const, data: undefined }));

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
          {steps.map((_: unknown, i: number) => (
            <React.Fragment key={i}>
              <motion.div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-bold transition-colors ${
                  i === activeStep
                    ? 'bg-primary text-white'
                    : i < activeStep
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-400'
                }`}
                animate={i === activeStep ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.6, repeat: i === activeStep ? Infinity : 0, repeatType: 'loop' }}
              >
                {React.createElement(steps[i].icon, { size: 15 })}
                <span>{steps[i].label}</span>
              </motion.div>
              {i < steps.length - 1 && (
                <motion.span
                  className={`${i < activeStep ? 'text-primary' : 'text-gray-300'}`}
                  animate={i === activeStep - 1 ? { opacity: [0.4, 1, 0.4] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight size={14} />
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
          <span className="text-sm text-outline">{steps[activeStep]?.desc ?? ''}</span>
        </div>
        {/* 현재 단계의 실시간 서버 로그 누적 표시 (단계 전환 시 초기화됨) */}
        {agentLog && agentLog.length > 0 && (
          <div className="flex flex-col gap-1 px-1 pt-1">
            <AnimatePresence initial={false}>
              {agentLog.map((line, i) => (
                <motion.span
                  key={`${i}-${line}`}
                  className="text-sm text-gray-400 leading-relaxed font-mono"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {line}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
        {!agentLog?.length && activeStepData?.instruction && (
          <InstructionScroller text={activeStepData.instruction} />
        )}
      </div>
    </div>
  );
};

// 에이전트 메시지에서 참고 자료 섹션 텍스트 추출
// "참고/참조/출처/source/ref/reference" 계열 단어가 들어간 줄을 헤더로 인식
// 헤더와 내용이 같은 줄이거나 다음 줄에 오는 모든 형태를 처리
const REF_HEADER_RE = /참고|참조|출처|레퍼런스|reference|source/i;
const extractRefSection = (content: string): string | null => {
  const normalized = content.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 헤더 줄 판별: REF_HEADER_RE 매칭 + 본문 내용이 아닌 짧은 줄(60자 이하)
    const stripped = line.replace(/^[#*\[\]\s]+|[#*\[\]\s]+$/g, '').trim();
    if (!REF_HEADER_RE.test(stripped) || stripped.length > 60) continue;

    // 같은 줄에 헤더 뒤로 내용이 있는 경우 (예: [참고 자료] URL1 URL2 / **참고자료** 내용)
    // [헤더] 형태: ] 이후, **헤더** 형태: 마지막 ** 이후, 그 외: : 이후
    const inlineContent = line
      .replace(/^\[.*?\]\s*[:：]?\s*/, '')   // [헤더] 제거
      .replace(/^\*{1,2}.*?\*{1,2}\s*[:：]?\s*/, '')  // **헤더** 제거
      .replace(/^[#\s]*\S+\s*[:：]\s*/, '')  // 헤더: 형태 제거
      .trim();
    if (inlineContent.length > 0) return inlineContent;

    // 다음 줄부터 내용 수집 — 빈 줄 2개 연속이거나 새 헤더가 나오면 종료
    const bodyLines: string[] = [];
    let blankCount = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const bodyLine = lines[j];
      if (bodyLine.trim() === '') {
        blankCount++;
        if (blankCount >= 2) break;
      } else {
        blankCount = 0;
        // 새 섹션 헤더(##, ** 등)가 나오면 종료
        if (/^#{1,6}\s|^\*{2}[^*]/.test(bodyLine)) break;
        bodyLines.push(bodyLine);
      }
    }
    if (bodyLines.length > 0) return bodyLines.join('\n').trim();
  }
  return null;
};

// 참고자료 섹션에서 URL 목록 추출
const extractReferencedUrls = (content: string): string[] => {
  const section = extractRefSection(content);
  console.log('[extractReferencedUrls] 섹션 매칭:', section ? '성공' : '실패');
  if (section) console.log('[extractReferencedUrls] 섹션 원문:\n', section);
  if (!section) return [];
  const urls = [...new Set(section.match(/https?:\/\/[^\s\)\],"']+/g) ?? [])];
  console.log('[extractReferencedUrls] 추출된 URL:', urls);
  return urls;
};

// 참고자료 섹션 전체 텍스트(서지정보 포함)와 자료 title을 매칭해 used 플래그 업데이트
const matchReferencesToMaterials = (content: string, materials: RelatedMaterial[]): RelatedMaterial[] => {
  const section = extractRefSection(content);
  const urls = extractReferencedUrls(content);
  console.log('[matchReferencesToMaterials] 섹션:', section ? section.slice(0, 120) : '없음');
  console.log('[matchReferencesToMaterials] URL 수:', urls.length, '| 자료 수:', materials.length);
  const urlSet = new Set(urls);
  const result = materials.map(m => {
    const byUrl = !!m.url && urlSet.has(m.url);
    // title 키워드 매칭: 자료 제목의 주요 단어(4글자 이상)가 섹션 텍스트에 포함되는지 확인
    const byTitle = !!section && !!m.title &&
      m.title.split(/\s+/).filter(w => w.length >= 4).some(w => section.includes(w));
    const matched = byUrl || byTitle;
    if (matched) console.log('[matchReferencesToMaterials] 매칭됨:', m.title, '| byUrl:', byUrl, '| byTitle:', byTitle);
    return { ...m, used: m.used || matched };
  });
  console.log('[matchReferencesToMaterials] 매칭된 자료 수:', result.filter(m => m.used).length);
  return result;
};

// ─── 토론 시작 안내 팝업 ────────────────────────────────────────────────────────

// GUIDE_PAGES and GuideModal commented out

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
  agentSteps,
  agentLog,
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
  userData,
}: DebateViewProps) => {
  const [inputText, setInputText] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPreQuizDone, setIsPreQuizDone] = useState(false);
  const [isPostQuizDone, setIsPostQuizDone] = useState(false);
  const [isScoreSidebarOpen, setIsScoreSidebarOpen] = useState(true);
  const [evaluationScores, setEvaluationScores] = useState<Record<number, UserEvaluationScore>>({});
  const [evaluationScore, setEvaluationScore] = useState<UserEvaluationScore | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [showPrevScoreWhileLoading, setShowPrevScoreWhileLoading] = useState(false);
  const [viewingMsgIdx, setViewingMsgIdx] = useState<number | null>(null);
  const [isRelatedMaterialsSidebarOpen, setIsRelatedMaterialsSidebarOpen] = useState(true);
  const [relatedMaterials, setRelatedMaterials] = useState<RelatedMaterial[]>([]); // 참고 자료 상태
  const [isLoadingRelatedMaterials, setIsLoadingRelatedMaterials] = useState(true); // 참고 자료 로딩 상태
  const fetchedMaterialsRef = useRef<RelatedMaterial[]>([]); // fetch된 원본 자료 캐시
  const [hasFetchedMaterials, setHasFetchedMaterials] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ sender: 'user' | 'bot', text: string, timestamp: string }>>([]);
  const [isHintGenerating, setIsHintGenerating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const chatbotScrollRef = useRef<HTMLDivElement>(null);

  const [chatbotSize, setChatbotSize] = useState({ width: 480, height: 350 });
  const [isFirstInput, setIsFirstInput] = useState(true);
  const [placeholder, setPlaceholder] = useState('');
  const [isTutorialRunning, setIsTutorialRunning] = useState(() => {
    const userId = userData?.id && !userData.is_guest ? userData.id : undefined;
    const key = getTutorialStorageKey(userId);
    if (userId) {
      return localStorage.getItem(key) !== 'true';
    }
    return sessionStorage.getItem(key) !== 'true';
  });
  // const [isGuideOpen, setIsGuideOpen] = useState(true);
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
    1: `📢 **주장 단계입니다.**  \n나의 입장과 근거를 이야기해주세요.\n\n💡 **도움말**  \n• 구체적인 사례나 수치를 제시해보세요.  \n• 경제·사회·환경 등 여러 측면을 함께 언급해보세요.`,
    2: `✅ **반박 단계입니다.**  \n상대방 주장 속 논리적 오류를 짚어 반박해주세요.\n\n💡 **도움말**  \n• 상대방 주장이 적용되지 않는 특수한 상황이나 예외적인 사례를 설명해보세요.  \n• 상대 말을 그대로 반복하기보다 내 언어로 정리해보세요.`,
    3: `🔄 **재반박 단계입니다.**  \n상대방 반박의 논리적 모순이나 근거 오류를 제시하여 나의 주장을 더 보완해보세요.\n\n💡 **도움말**  \n• 상대 말을 그대로 반복하기보다 내 언어로 정리해보세요.  \n• 주장을 뒷받침하는 새로운 사례나 이유를 추가해보세요.`,
  };

  // speechTurn 변화 시 챗봇 자동 팝업 (speechGuide + 힌트 질문)
  useEffect(() => {
    if (debatePhase !== 'debating') return;

    const guideText = SPEECH_GUIDE[speechTurn];
    if (!guideText) return;

    // speechGuide 메시지 추가
    const newMsgs: Array<{ sender: 'user' | 'bot'; text: string; timestamp: string }> = [
      { sender: 'bot', text: guideText, timestamp: formatTime() },
    ];

    // 반박(speechTurn==2) 또는 재반박(speechTurn==3) 타이밍에 힌트 질문 추가
    if (speechTurn === 2 || speechTurn === 3) {
      const hintLabel = speechTurn === 2 ? '반박' : '재반박';
      newMsgs.push({
        sender: 'bot',
        text: `💬 **${hintLabel} 힌트**가 필요하신가요?\n아래 버튼을 눌러 AI의 도움을 받아보세요!`,
        timestamp: formatTime(),
      });
    }

    setChatbotMessages(msgs => [...msgs, ...newMsgs]);
    setIsHelpOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechTurn, debatePhase]);

  // 챗봇 메시지 추가 시 자동 스크롤
  useEffect(() => {
    if (chatbotScrollRef.current) {
      chatbotScrollRef.current.scrollTop = chatbotScrollRef.current.scrollHeight;
    }
  }, [chatbotMessages]);

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
    const hasUserMessage = messages.some(m => m.role === 'user');
    if (!hasUserMessage || speechTurn === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== 'user') return;
    const msgIdx = messages.length - 1;
    const fetchScore = async () => {
      setIsLoadingScore(true);
      setShowPrevScoreWhileLoading(false);
      try {
        const score = await debateApi.getUserEvaluation(discussionId, topic);
        setEvaluationScores(prev => ({ ...prev, [msgIdx]: score }));
        setEvaluationScore(score);
        setViewingMsgIdx(msgIdx);
      } catch (_) {
      } finally {
        setIsLoadingScore(false);
      }
    };
    fetchScore();
  }, [messages.length, discussionId]);

  // 참고 자료 fetch — AI 응답이 추가될 때마다 갱신 (에이전트가 매 턴 새 자료를 저장하므로)
  const aiMessageCount = messages.filter(m => m.role !== 'user').length;
  useEffect(() => {
    if (!discussionId) return;
    const fetchMaterials = async () => {
      try {
        const data = await debateApi.getRelatedMaterials(topic, discussionId);
        fetchedMaterialsRef.current = data;
        setHasFetchedMaterials(true);
        setRelatedMaterials(data);
      } catch (error) {
        console.error("Failed to fetch related materials:", error);
      } finally {
        setIsLoadingRelatedMaterials(false);
      }
    };
    fetchMaterials();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionId, aiMessageCount]);

  // 참고자료 매칭 — 새 메시지가 추가되거나 자료 fetch 완료 시 재실행
  useEffect(() => {
    if (!hasFetchedMaterials || fetchedMaterialsRef.current.length === 0) return;
    const nonUserMessages = messages.filter(m => m.role !== 'user');
    const matched = nonUserMessages.reduce(
      (acc, m) => matchReferencesToMaterials(m.content, acc),
      fetchedMaterialsRef.current
    );
    const used = matched.filter(m => m.used);
    const unused = matched.filter(m => !m.used);
    setRelatedMaterials([...used, ...unused]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, hasFetchedMaterials]);



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
          ? await debateApi.getCounterHint(discussionId, topic)
          : await debateApi.getRebuttalHint(discussionId, topic);
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
  // 4. 참고자료 섹션 제거 (에이전트 메시지)
  const preprocessContent = (content: string, isAgent = false): string => {
    let processed = content.replace(/\\n/g, '\n');
    if (isAgent) {
      // 헤더 제거 전에 참고자료 섹션을 먼저 잘라냄 (헤더 제거 시 REF_HEADER_RE 매칭 불가 방지)
      const lines = processed.split('\n');
      let cutIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        // 줄 앞쪽의 헤더 토큰([...], **...**, ###, 공백)만 제거한 뒤 REF_HEADER_RE 검사
        // 헤더와 내용이 같은 줄에 있어도 (예: "[참고 자료] 김민정...") 헤더 줄로 인식
        const headerToken = lines[i].match(/^([#*\[\]\s]*(?:참고|참조|출처|레퍼런스|reference|source)[^\n:：]*[:：]?\s*)/i)?.[0] ?? '';
        if (headerToken.length > 0) {
          cutIdx = i;
          break;
        }
      }
      if (cutIdx !== -1) processed = lines.slice(0, cutIdx).join('\n');
    }
    processed = processed
      .replace(/^#{1,6}\s+.+$/gm, '')
      .replace(/\[\d+\]/g, '');
    return processed.trim();
  };

  // **레이블**: 형태의 섹션 레이블을 제거하고, 일반 **볼드** 는 <strong> 으로 유지하는 함수
  // ReactMarkdown은 **foo**: bar 를 [<strong>foo</strong>, ": bar"] 로 파싱함
  // 뒤따르는 문자열이 ':' 로 시작하면 섹션 레이블로 간주해 제거, 아니면 볼드 유지
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
      } else if (
        React.isValidElement(node) &&
        (node as React.ReactElement).type === 'strong'
      ) {
        result.push(<strong className="font-bold">{(node as React.ReactElement<{ children?: React.ReactNode }>).props.children}</strong>);
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

  // 가장 마지막 사용자 메시지 인덱스
  const lastUserMsgIdx = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return i;
    }
    return -1;
  }, [messages]);

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
      <DebateTutorial
        run={isTutorialRunning}
        onFinish={() => setIsTutorialRunning(false)}
        userId={userData?.id && !userData.is_guest ? userData.id : undefined}
      />
      {/* <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} /> */}
      {/* Left Sidebar: 실시간 평가 점수 */}
      <motion.aside
        initial={false}
        animate={{ width: isScoreSidebarOpen ? 320 : 0, opacity: isScoreSidebarOpen ? 1 : 0 }}
        className="bg-white flex flex-col border-r border-gray-200 overflow-hidden relative md:flex order-first"
      >
        <div id="tutorial-score-panel" className="p-6 flex flex-col gap-3 h-full w-80 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className={evaluationScore ? 'text-primary' : 'text-outline'} />
            <h2 className="text-base font-black font-headline">실시간 평가 지표</h2>
          </div>
          {/* 로딩 중 + 이전 평가 보기 선택 → 배너만 표시 */}
          {isLoadingScore && showPrevScoreWhileLoading && (
            <div className="flex items-center gap-2 bg-blue-50 border border-primary/20 rounded-xl px-3 py-2">
              <Loader2 size={13} className="animate-spin text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-bold text-primary">새 발언 평가 중...</p>
                <p className="text-sm text-gray-600 truncate">{messages[lastUserMsgIdx]?.content}</p>
              </div>
            </div>
          )}

          {/* 로딩 중 + 전체 로딩 화면 */}
          {isLoadingScore && !showPrevScoreWhileLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 flex-1">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-outline">점수를 계산하는 중...</p>
            </div>
          ) : !isLoadingScore && !evaluationScore ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center opacity-50">
              <p className="text-sm text-outline">첫 발언 후 점수가 표시됩니다.</p>
            </div>
          ) : evaluationScore ? (
            <>
            {(viewingMsgIdx ?? lastUserMsgIdx) >= 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-primary mb-1">평가 대상 발언</p>
                  <p className="text-sm text-outline leading-relaxed line-clamp-2">
                    {messages[viewingMsgIdx ?? lastUserMsgIdx]?.content}
                  </p>
                </div>
              )}
              <div className="w-full">
                <PentagonChart score={evaluationScore} />
              </div>
              <p className="text-sm text-outline text-center -mt-5 mb-1">지표 이름을 클릭하면 설명을 볼 수 있어요</p>
              
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
                    <p className="text-sm text-on-surface leading-relaxed mt-1">{scoreLabels[activeTooltip].desc}</p>
                    <div className="flex flex-col gap-1 border-t border-indigo-200 mt-2 pt-2">
                      <p className="text-sm font-bold text-primary">평가 이유</p>
                      <p className="text-sm text-outline leading-relaxed">{evaluationScore[scoreLabels[activeTooltip].key].reason}</p>
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
                    <span className="text-sm font-bold text-on-surface">{label}</span>
                    <span className="text-sm font-black text-primary">{evaluationScore[key].score} / 5</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </motion.aside>

      {/* Left Sidebar Toggle Button */}
      <button
        id="tutorial-score-toggle"
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
              <div id="tutorial-header" className="flex flex-col gap-1 flex-1">
                <h2 className="text-lg md:text-xl font-black font-headline line-clamp-1">{topic}</h2>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <span className="text-sm font-bold text-primary whitespace-nowrap">{progress}%</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div id="tutorial-round-badge" className="flex flex-col gap-0.5 px-5 py-1 bg-gray-50 rounded-xl border border-gray-100 text-center">
                  <span className="text-sm font-bold text-outline uppercase">라운드</span>
                  <span className="text-sm font-black text-on-surface">
                    {currentRound} / {totalRounds}
                  </span>
                </div>
                <div id="tutorial-action-buttons" className="flex items-center gap-3">

                  <button onClick={() => setIsTutorialRunning(true)} className="px-2 py-1 bg-gray-50  text-on-surface rounded-xl font-bold text-sm transition-all flex items-center gap-1">
                    <Info size={14} /> {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '튜토리얼'}
                  </button>
                  <button onClick={() => navigateTo('/setup')} className="px-2 py-1 bg-primary text-white rounded-xl font-bold text-sm transition-all flex items-center gap-1">
                    <RefreshCw size={14} /> {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '다시 시작'}
                  </button>
                  <button onClick={onFinish} className="px-2 py-1 bg-secondary text-white rounded-xl font-bold text-sm transition-all flex items-center gap-1">
                    <Power size={14} /> {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '토론 종료'}
                  </button>
                  <button onClick={toggleFullScreen} className="px-2 py-1 bg-gray-50  text-on-surface rounded-xl font-bold text-sm transition-all flex items-center gap-1">
                    {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />} {!(isScoreSidebarOpen && isRelatedMaterialsSidebarOpen) && '전체 화면'}
                  </button>
                                    
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="tutorial-chat-area" className={`flex-1 overflow-y-auto py-2 md:py-6 ${debatePhase === 'debating' ? 'pb-32 md:pb-36' : 'pb-8'} flex flex-col gap-6 md:gap-8 custom-scrollbar relative transition-all duration-300 ${isScoreSidebarOpen && isRelatedMaterialsSidebarOpen ? 'px-6 md:px-7' : isScoreSidebarOpen || isRelatedMaterialsSidebarOpen ? 'px-7 md:px-12' : 'px-8 md:px-21'}`} ref={scrollRef} style={{ overscrollBehavior: 'contain' }}>

          {/* ── intro 단계: turn=0 로딩 스피너 ── */}
          {debatePhase === 'intro' && isGenerating && (
            <AgentThinkingIndicator isEasy={difficulty === 'easy'} agentSteps={agentSteps} agentLog={agentLog} />
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

                const isFirstUserMsg = msg.role === 'user' && !messages.slice(0, idx).some(m => m.role === 'user');

                return (
                  <React.Fragment key={idx}>
                    {/* ── 사전 퀴즈: 첫 번째 사용자 메시지 바로 위에 고정 삽입 ── */}
                    {isFirstUserMsg && (debatePhase === 'pre-quiz' || debatePhase === 'debating') && (preQuizzes.length > 0 || isPreQuizDone || (isQuizLoading && debatePhase === 'pre-quiz')) && (
                      <InlineQuizPanel
                        quizzes={preQuizzes}
                        isLoading={isQuizLoading && debatePhase === 'pre-quiz'}
                        type="pre"
                        isDone={isPreQuizDone}
                        onComplete={() => { setIsPreQuizDone(true); onPreQuizComplete?.(); }}
                        isCompleting={false}
                      />
                    )}
                    {showRoundIndicator && (
                      <div className="flex justify-center">
                        <span className="px-3 py-1 bg-gray-100 border border-gray-800  text-on-surface text-sm font-black rounded-full tracking-widest">
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
                            {msg.role === 'user' && evaluationScores[idx] && idx !== lastUserMsgIdx && (
                              <button
                                onClick={() => { setIsScoreSidebarOpen(true); setShowPrevScoreWhileLoading(false); setViewingMsgIdx(idx); setEvaluationScore(evaluationScores[idx]); }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                <BarChart3 size={10} /> 평가 완료 · 보기
                              </button>
                            )}
                            {msg.role === 'user' && idx === lastUserMsgIdx && (!!evaluationScores[idx] || isLoadingScore) && (
                              isLoadingScore ? (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-sm font-bold bg-gray-100 text-outline">
                                  <Loader2 size={9} className="animate-spin" /> 평가 중
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setIsScoreSidebarOpen(true); setViewingMsgIdx(idx); setEvaluationScore(evaluationScores[idx]); }}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                  <BarChart3 size={10} /> 평가 완료 · 보기
                                </button>
                              )
                            )}
                            <span className="text-sm md:text-sm font-bold text-on-surface">
                              {msg.role === 'user' ? '나 (사용자)' : msg.agentName || 'AI 에이전트'}
                            </span>
                            <span className="text-sm md:text-sm text-outline">{msg.timestamp || '14:02'}</span>
                          </div>
                          <div className={`p-4 md:p-6 rounded-2xl text-sm md:text-base leading-relaxed prose prose-sm max-w-none ${msg.role === 'user' ? 'bg-blue-50 border-2 border-primary text-gray-800' : 'bg-red-50 border-2 border-secondary text-gray-800'}`}>
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
                              {preprocessContent(msg.content, msg.role === 'agent')}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* ── 사전 퀴즈 fallback: 사용자 메시지가 아직 없을 때 ── */}
              {(debatePhase === 'pre-quiz' || (debatePhase === 'debating' && isPreQuizDone)) && !messages.some(m => m.role === 'user') && (
                <InlineQuizPanel
                  quizzes={preQuizzes}
                  isLoading={isQuizLoading && debatePhase === 'pre-quiz'}
                  type="pre"
                  isDone={isPreQuizDone}
                  onComplete={() => { setIsPreQuizDone(true); onPreQuizComplete?.(); }}
                  isCompleting={false}
                />
              )}

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

              {/* ── 사후 퀴즈 (post-quiz 완료 후에도 계속 표시) ── */}
              {debatePhase === 'post-quiz' && (
                <InlineQuizPanel
                  quizzes={postQuizzes}
                  isLoading={isQuizLoading}
                  type="post"
                  isDone={isPostQuizDone}
                  onComplete={() => { setIsPostQuizDone(true); onPostQuizComplete?.(); }}
                  isCompleting={false}
                />
              )}

              {isGenerating && debatePhase === 'debating' && (
                <AgentThinkingIndicator isEasy={difficulty === 'easy'} agentSteps={agentSteps} agentLog={agentLog} />
              )}
            </>
          )}
        </div>

        {/* 입력창: debating 단계에서만 표시 */}
        {debatePhase === 'debating' && (
        <div className="absolute bottom-0 left-0 right-0 pt-2 md:pt-3 pb-6 md:pb-6 bg-transparent">
          <div
            className="mx-auto w-full md:max-w-[80%] lg:max-w-[70%] px-4 md:pr-20"
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
                <div id="tutorial-input-area" className="flex items-center bg-white px-3 py-1.5 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 gap-2">
                  <textarea
                    ref={textareaRef}
                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm md:text-base resize-none custom-scrollbar"
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
        <div className="absolute bottom-6 right-6 z-60 flex flex-col items-end gap-4 pointer-events-none">
          <AnimatePresence>
            {isHelpOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                style={{ width: chatbotSize.width, height: chatbotSize.height }}
                className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col mb-2 relative pointer-events-auto"
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
                <div ref={chatbotScrollRef} className="flex-1 p-4 overflow-y-auto bg-gray-50 text-sm text-outline leading-relaxed flex flex-col gap-2 custom-scrollbar">
                  {chatbotMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`w-full p-3 rounded-lg ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
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
                        <span className={`block text-sm mt-1 ${msg.sender === 'user' ? 'text-white/70' : 'text-gray-500'}`}>{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}
                  {isHintGenerating && (
                    <div className="flex justify-start">
                      <div className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-100">
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
                {(speechTurn === 2 || speechTurn === 3) && (
                  <div className="p-3 border-t border-gray-100 bg-white shrink-0">
                    <button
                      onClick={() => handleHintRequest(speechTurn === 2 ? '반박 힌트' : '재반박 힌트')}
                      disabled={isHintGenerating}
                      className={`w-full text-sm py-2 px-3 font-bold rounded-xl transition-colors disabled:opacity-50 bg-primary/10 text-primary hover:bg-primary/20`}
                    >
                      {isHintGenerating ? (
                        <span className="flex items-center justify-center gap-1"><Loader2 size={13} className="animate-spin" /> 힌트 생성 중...</span>
                      ) : (
                        `${speechTurn === 2 ? '반박' : '재반박'} 힌트 받기`
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            id="tutorial-help-button"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className="w-12 h-12 md:w-14 md:h-14 bg-transparent border-none flex items-center justify-center overflow-hidden hover:scale-110 transition-transform pointer-events-auto"
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
        <div id="tutorial-materials-panel" className="p-6 flex flex-col gap-3 h-full w-90 overflow-y-auto custom-scrollbar">
          {(!hasFetchedMaterials || relatedMaterials.length > 0 || isLoadingRelatedMaterials) && (
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-secondary" />
              <h2 className="text-base font-black font-headline">참고 자료</h2>
            </div>
          )}

          {isLoadingRelatedMaterials ? (
            <div className="flex flex-col items-center justify-center gap-4 h-full">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-outline">참고 자료를 불러오는 중입니다...</p>
            </div>
          ) : relatedMaterials.length > 0 ? (
            <div className="flex flex-col gap-5">
              {relatedMaterials.map((material, i) => (
                <article key={i} className={`flex flex-col gap-2 bg-white rounded-2xl border p-5 card-hover ${material.used ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${material.color}`}>{material.category}</span>
                    {material.used && <span className="text-sm font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">AI가 참고한 자료</span>}
                  </div>
                  <h3 className="text-base font-bold leading-tight">{material.title}</h3>
                  {material.description && (
                    <p className="text-sm text-outline leading-relaxed line-clamp-3">{material.description}</p>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                    <span className="text-sm font-bold text-outline uppercase">출처: {material.source}</span>
                    {material.url ? (
                      material.url.toLowerCase().endsWith('.pdf') ? (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-red-500 hover:underline flex items-center gap-1"
                        >
                          <FileText size={11} /> PDF 보기 →
                        </a>
                      ) : (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          원문 보기 →
                        </a>
                      )
                    ) : (
                      <span className="text-sm text-gray-300">링크 없음</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : hasFetchedMaterials ? (
            <div className="flex flex-col items-center justify-center gap-2 flex-1 text-center opacity-50">
              <p className="text-sm text-outline">참고 자료 없음</p>
            </div>
          ) : null}
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
  isDone?: boolean;
  onComplete?: () => void;
  isCompleting?: boolean; // onComplete 처리 중 (turn=0 API 호출 중)
}

const InlineQuizPanel = ({ quizzes, isLoading, type, isDone = false, onComplete, isCompleting }: InlineQuizPanelProps) => {
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
            <span className="text-sm md:text-sm font-bold text-on-surface">AI 에이전트</span>
          </div>
          <div className="p-4 md:p-5 rounded-2xl bg-white border-2 border-gray-200 flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-gray-400 shrink-0" />
            <span className="text-sm md:text-base text-gray-600">퀴즈를 불러오는 중입니다...</span>
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
            <span className="text-sm md:text-sm font-bold text-on-surface">AI 에이전트</span>
          </div>
          <div className="p-4 md:p-5 rounded-2xl bg-white border-2 border-gray-200 flex flex-col gap-3">
            <p className="text-sm md:text-base text-gray-600">퀴즈를 불러오지 못했습니다.</p>
            <button
              onClick={() => onComplete?.()}
              className="self-start px-5 py-2 bg-gray-400 text-white font-bold rounded-full text-sm flex items-center gap-1.5 hover:bg-gray-500 transition-colors"
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
          <span className="text-primary text-sm md:text-sm font-bold">
            {isDone
              ? `${type === 'pre' ? '토론 전 퀴즈' : '토론 후 퀴즈'}`
              : `${type === 'pre' ? '토론 전 퀴즈' : '토론 후 퀴즈'} ${currentIndex + 1} / ${quizzes.length}`}
          </span>
        </div>

        {/* 말풍선 — 흰색 배경 */}
        <div className="p-4 md:p-5 rounded-2xl bg-white border-2 border-gray-200 text-gray-800">
          {isDone ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle2 size={32} className="text-primary" />
              <p className="text-sm font-bold text-on-surface">
                {type === 'pre' ? '사전 퀴즈를 모두 완료했습니다!' : '사후 퀴즈를 모두 완료했습니다!'}
              </p>
              <p className="text-sm text-outline">
                {type === 'pre' ? '토론을 시작해주세요.' : '결과를 불러오는 중입니다.'}
              </p>
            </div>
          ) : (
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
          )}
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
        <p className="text-base md:text-lg font-bold leading-snug">{quiz.question}</p>
      </div>

      {/* 선택지 */}
      <div className="flex flex-col gap-2">
        {quiz.options.map((option, index) => (
          <button
            key={index}
            disabled={submitted}
            onClick={() => setSelected(index)}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl border-2 text-left transition-all text-sm md:text-base font-medium ${getButtonClass(index)}`}
          >
            <span className="font-bold shrink-0 text-base">{optionLabels[index]}</span>
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
              <span className={`font-bold text-sm ${isCorrect ? 'text-primary' : 'text-secondary'}`}>
                {isCorrect
                  ? '정답입니다!'
                  : `아쉽네요! 정답은 ${optionLabels[quiz.correctIndex]} ${quiz.options[quiz.correctIndex]}`}
              </span>
            </div>
            <p className="text-sm text-outline leading-relaxed">
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
            className="px-6 py-2 bg-primary text-white font-bold rounded-full disabled:opacity-40 transition-all text-sm"
          >
            정답 확인
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={isCompleting}
            className="px-6 py-2 bg-primary text-white font-bold rounded-full flex items-center gap-1.5 hover:bg-gray-500 transition-all text-sm disabled:opacity-40"
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
