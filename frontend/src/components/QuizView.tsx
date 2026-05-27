import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  HelpCircle,
  Loader2,
  BookOpen,
  ChevronLeft,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MultipleChoiceQuiz, DebateMessage, BackgroundSummary } from '../types';
import { debateApi } from '../services/api';
import {
  MOCK_PRE_QUIZ_MC,
  MOCK_POST_QUIZ_MC,
  MOCK_DISCUSSION_ID,
  MOCK_DEBATE_MESSAGES,
} from '../mockData.ts';

interface QuizViewProps {
  topic: string;
  type: 'pre' | 'post';
  onComplete: (initialMessages?: DebateMessage[], discussionId?: number) => void;
}

type QuizPage = 'summary' | 'quiz';

export const QuizView = ({ topic, type, onComplete }: QuizViewProps) => {
  const [quizzes, setQuizzes] = useState<MultipleChoiceQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStartingDebate, setIsStartingDebate] = useState(false);
  const [backgroundSummary, setBackgroundSummary] = useState<BackgroundSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(type === 'pre');

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { page?: QuizPage } | null;
  const page: QuizPage = locationState?.page ?? (type === 'pre' ? 'summary' : 'quiz');

  const setPage = (next: QuizPage) => {
    navigate('.', { state: { page: next }, replace: false });
  };

  useEffect(() => {
    const fetchQuizzes = async () => {
      setIsLoading(true);
      try {
        const data = await debateApi.getQuizSet(topic, type);
        if (Array.isArray(data) && data.length > 0) {
          setQuizzes(data);
        } else {
          setQuizzes(type === 'pre' ? MOCK_PRE_QUIZ_MC : MOCK_POST_QUIZ_MC);
        }
      } catch {
        setQuizzes(type === 'pre' ? MOCK_PRE_QUIZ_MC : MOCK_POST_QUIZ_MC);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizzes();
  }, [topic, type]);

  useEffect(() => {
    if (type !== 'pre') return;
    const fetchSummary = async () => {
      setIsSummaryLoading(true);
      try {
        const data = await debateApi.getBackgroundSummary(topic);
        setBackgroundSummary(data);
      } catch {
        setBackgroundSummary(null);
      } finally {
        setIsSummaryLoading(false);
      }
    };
    fetchSummary();
  }, [topic, type]);

  const totalSteps = quizzes.length;

  const handleNext = () => {
    if (currentIndex < totalSteps - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (type === 'pre') {
      setIsStartingDebate(true);
      try {
        // /api/debate/start 대신 sendMessage로 turn=0 초기 메시지를 받음
        // history를 빈 배열로 전달하면 백엔드에서 turn=0(시작) 메시지를 반환
        const data = await debateApi.sendMessage(topic, '', [], null);
        const initialMsg: DebateMessage = {
          ...data.aiResponse,
          turn: 0,
          round: 1, // ui 표시용
        };
        const discussionId = initialMsg.discussion_id ?? MOCK_DISCUSSION_ID;
        onComplete([initialMsg], discussionId);
      } catch {
        onComplete(MOCK_DEBATE_MESSAGES, MOCK_DISCUSSION_ID);
      } finally {
        setIsStartingDebate(false);
      }
    } else {
      onComplete();
    }
  };

  const handleShowSummary = () => setPage('summary');

  const handleBack = () => navigate(-1);

  if (isLoading || (type === 'pre' && isSummaryLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="animate-spin text-primary mb-4" />
        <p className="text-outline">
          {isSummaryLoading ? '주제 배경 정보를 불러오는 중입니다...' : '퀴즈를 불러오는 중입니다...'}
        </p>
      </div>
    );
  }

  if (type === 'pre' && page === 'summary') {
    return (
      <BackgroundSummaryPage
        summary={backgroundSummary}
        topic={topic}
        onBack={handleBack}
        onStartQuiz={() => setPage('quiz')}
      />
    );
  }

  const isLast = totalSteps > 0 && currentIndex === totalSteps - 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5.5 md:py-11">
      <header className="text-center mb-8">
        <div className="flex justify-start mb-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm text-outline hover:text-on-surface transition-colors"
          >
            <ChevronLeft size={18} />
            뒤로
          </button>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] md:text-xs font-bold rounded-full mb-3 inline-block uppercase tracking-widest">
          {type === 'pre' ? '토론 전 퀴즈' : '토론 후 퀴즈'}
        </span>
        <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-4">
          {type === 'pre' ? '주제 이해도 확인' : '토론 내용 복습'}
        </h1>
        {totalSteps > 0 && (
          <>
            <div className="flex items-center gap-2 justify-center mt-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < currentIndex
                      ? 'bg-primary w-6'
                      : i === currentIndex
                      ? 'bg-primary w-8'
                      : 'bg-gray-200 w-6'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-outline mt-2">
              {currentIndex + 1} / {totalSteps}
            </p>
          </>
        )}
      </header>

      <AnimatePresence mode="wait">
        {quizzes[currentIndex] && (
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            <MCQuizCard
              quiz={quizzes[currentIndex]}
              isLast={isLast}
              isStartingDebate={isStartingDebate}
              type={type}
              onNext={handleNext}
              onShowSummary={type === 'pre' ? handleShowSummary : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── 배경 요약 페이지 ──────────────────────────────────────────────────────────

interface BackgroundSummaryPageProps {
  summary: BackgroundSummary | null;
  topic: string;
  onBack: () => void;
  onStartQuiz: () => void;
}

const BackgroundSummaryPage = ({ summary, topic, onBack, onStartQuiz }: BackgroundSummaryPageProps) => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-5.5 md:py-11">
      <header className="text-center mb-8">
        <div className="flex justify-start mb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-outline hover:text-on-surface transition-colors"
          >
            <ChevronLeft size={18} />
            뒤로
          </button>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] md:text-xs font-bold rounded-full mb-3 inline-block uppercase tracking-widest">
          주제 배경
        </span>
        <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-2">
          토론 전 알아두기
        </h1>
        <p className="text-sm text-outline">{summary?.topic ?? topic}</p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50 mb-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
            <BookOpen size={22} />
          </div>
          <h2 className="text-base md:text-lg font-bold">주제 배경 요약</h2>
        </div>

        {summary ? (
          <p className="text-sm md:text-base leading-relaxed text-on-surface whitespace-pre-line">
            {summary.summary}
          </p>
        ) : (
          <p className="text-sm text-outline">배경 정보를 불러오지 못했습니다.</p>
        )}
      </motion.div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onStartQuiz}
          className="w-full sm:w-auto px-12 py-4 bg-primary text-white font-bold rounded-full flex items-center justify-center gap-2 hover:gap-3 transition-all"
        >
          퀴즈 풀기
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

// ─── 객관식 퀴즈 카드 ──────────────────────────────────────────────────────────

interface MCQuizCardProps {
  quiz: MultipleChoiceQuiz;
  isLast: boolean;
  isStartingDebate: boolean;
  type: 'pre' | 'post';
  onNext: () => void;
  onShowSummary?: () => void;
}

const MCQuizCard = ({ quiz, isLast, isStartingDebate, type, onNext, onShowSummary }: MCQuizCardProps) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === quiz.correctIndex;

  const getButtonClass = (index: number) => {
    const isSelected = selected === index;
    const isCorrectAnswer = quiz.correctIndex === index;
    if (!submitted) {
      return isSelected
        ? 'border-primary bg-primary/5 text-primary'
        : 'border-gray-100 hover:border-gray-200 text-on-surface';
    }
    if (isCorrectAnswer) return 'border-green-500 bg-green-50 text-green-700';
    if (isSelected && !isCorrect) return 'border-red-500 bg-red-50 text-red-700';
    return 'border-gray-100 text-outline opacity-50';
  };

  const optionLabels = ['①', '②', '③', '④'];

  return (
    <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50">
      <div className="flex items-center justify-between mb-6">
        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">객관식</span>
        {onShowSummary && (
          <button
            onClick={onShowSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
          >
            <BookOpen size={13} />
            주제 배경 다시 보기
          </button>
        )}
      </div>
      <div className="flex items-start gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
          <HelpCircle size={24} />
        </div>
        <h2 className="text-lg md:text-xl font-bold leading-tight pt-1">{quiz.question}</h2>
      </div>

      <div className="flex flex-col gap-3 mb-8">
        {quiz.options.map((option, index) => (
          <button
            key={index}
            disabled={submitted}
            onClick={() => setSelected(index)}
            className={`flex items-center gap-3 w-full px-5 py-4 rounded-xl border-2 text-left transition-all text-sm md:text-base font-medium ${getButtonClass(index)}`}
          >
            <span className="text-base font-bold shrink-0">{optionLabels[index]}</span>
            <span className="flex-1">{option}</span>
            {submitted && quiz.correctIndex === index && (
              <CheckCircle2 size={18} className="shrink-0 text-green-500" />
            )}
            {submitted && selected === index && !isCorrect && (
              <XCircle size={18} className="shrink-0 text-red-500" />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl mb-8 ${isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : (
                <XCircle size={18} className="text-red-600" />
              )}
              <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                {isCorrect
                  ? '정답입니다!'
                  : `아쉽네요! 정답은 ${optionLabels[quiz.correctIndex]} ${quiz.options[quiz.correctIndex]}입니다.`}
              </span>
            </div>
            <p className="text-sm text-outline leading-relaxed">
              <span className="font-bold text-on-surface">해설:</span> {quiz.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center">
        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={selected === null}
            className="px-12 py-4 bg-primary text-white font-bold rounded-full disabled:opacity-50 transition-all"
          >
            정답 확인
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={isStartingDebate}
            className="px-12 py-4 bg-primary text-white font-bold rounded-full flex items-center gap-2 hover:gap-3 transition-all disabled:opacity-50"
          >
            {isStartingDebate ? (
              <><Loader2 size={20} className="animate-spin" /> 토론 준비 중...</>
            ) : (
              <>
                {isLast ? (type === 'pre' ? '토론장으로 이동' : '최종 결과 보기') : '다음 문제'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
