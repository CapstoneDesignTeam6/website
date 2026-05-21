import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OXQuiz, SubjectiveQuiz, DebateMessage } from '../types';
import { debateApi } from '../services/api';
import {
  MOCK_PRE_QUIZ_OX,
  MOCK_PRE_QUIZ_SUBJECTIVE,
  MOCK_POST_QUIZ_OX,
  MOCK_POST_QUIZ_SUBJECTIVE,
  MOCK_DISCUSSION_ID,
  MOCK_DEBATE_MESSAGES,
} from '../mockData.ts';

interface QuizViewProps {
  topic: string;
  type: 'pre' | 'post';
  onComplete: (initialMessages?: DebateMessage[], discussionId?: number) => void;
}

// 퀴즈 진행 단계: OX 0~2 → 주관식 0~1
type QuizStep =
  | { kind: 'ox'; index: number }
  | { kind: 'subj'; index: number };

export const QuizView = ({ topic, type, onComplete }: QuizViewProps) => {
  const [oxQuizzes, setOxQuizzes] = useState<OXQuiz[]>([]);
  const [subjQuizzes, setSubjQuizzes] = useState<SubjectiveQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<QuizStep>({ kind: 'ox', index: 0 });
  const [isStartingDebate, setIsStartingDebate] = useState(false);

  useNavigate();

  useEffect(() => {
    const fetchQuizzes = async () => {
      setIsLoading(true);
      try {
        const data = await debateApi.getQuizSet(topic, type);
        setOxQuizzes(data.ox);
        setSubjQuizzes(data.subjective);
      } catch {
        setOxQuizzes(type === 'pre' ? MOCK_PRE_QUIZ_OX : MOCK_POST_QUIZ_OX);
        setSubjQuizzes(type === 'pre' ? MOCK_PRE_QUIZ_SUBJECTIVE : MOCK_POST_QUIZ_SUBJECTIVE);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizzes();
  }, [topic, type]);

  const totalSteps = oxQuizzes.length + subjQuizzes.length;
  const currentStepIndex =
    step.kind === 'ox' ? step.index : oxQuizzes.length + step.index;

  const goNextStep = () => {
    if (step.kind === 'ox') {
      if (step.index < oxQuizzes.length - 1) {
        setStep({ kind: 'ox', index: step.index + 1 });
      } else if (subjQuizzes.length > 0) {
        setStep({ kind: 'subj', index: 0 });
      } else {
        handleFinish();
      }
    } else {
      if (step.index < subjQuizzes.length - 1) {
        setStep({ kind: 'subj', index: step.index + 1 });
      } else {
        handleFinish();
      }
    }
  };

  const handleFinish = async () => {
    if (type === 'pre') {
      setIsStartingDebate(true);
      try {
        const response = await debateApi.start(topic);
        onComplete([response], MOCK_DISCUSSION_ID);
      } catch {
        onComplete(MOCK_DEBATE_MESSAGES, MOCK_DISCUSSION_ID);
      } finally {
        setIsStartingDebate(false);
      }
    } else {
      onComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="animate-spin text-primary mb-4" />
        <p className="text-outline">퀴즈를 불러오는 중입니다...</p>
      </div>
    );
  }

  const isLastStep = totalSteps > 0 && currentStepIndex === totalSteps - 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5.5 md:py-11">
      <header className="text-center mb-8">
        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] md:text-xs font-bold rounded-full mb-3 inline-block uppercase tracking-widest">
          {type === 'pre' ? '토론 전 퀴즈' : '토론 후 퀴즈'}
        </span>
        <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-4">
          {type === 'pre' ? '주제 이해도 확인' : '토론 내용 복습'}
        </h1>
        {/* 진행 인디케이터 */}
        {totalSteps > 0 && (
          <>
            <div className="flex items-center gap-2 justify-center mt-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < currentStepIndex
                      ? 'bg-primary w-6'
                      : i === currentStepIndex
                      ? 'bg-primary w-8'
                      : 'bg-gray-200 w-6'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-outline mt-2">
              {currentStepIndex + 1} / {totalSteps}
            </p>
          </>
        )}
      </header>

      <AnimatePresence mode="wait">
        {step.kind === 'ox' && oxQuizzes[step.index] && (
          <motion.div
            key={`ox-${step.index}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            <OXQuizCard
              quiz={oxQuizzes[step.index]}
              isLast={isLastStep}
              isStartingDebate={isStartingDebate}
              type={type}
              onNext={goNextStep}
            />
          </motion.div>
        )}
        {step.kind === 'subj' && subjQuizzes[step.index] && (
          <motion.div
            key={`subj-${step.index}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            <SubjQuizCard
              quiz={subjQuizzes[step.index]}
              isLast={isLastStep}
              isStartingDebate={isStartingDebate}
              type={type}
              topic={topic}
              onNext={goNextStep}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── OX 퀴즈 카드 ─────────────────────────────────────────────────────────────

interface OXQuizCardProps {
  quiz: OXQuiz;
  isLast: boolean;
  isStartingDebate: boolean;
  type: 'pre' | 'post';
  onNext: () => void;
}

const OXQuizCard = ({ quiz, isLast, isStartingDebate, type, onNext }: OXQuizCardProps) => {
  const [selected, setSelected] = useState<'O' | 'X' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === quiz.correctAnswer;

  const getButtonClass = (value: 'O' | 'X') => {
    const isSelected = selected === value;
    const isCorrectAnswer = quiz.correctAnswer === value;
    if (!submitted) {
      return isSelected
        ? 'border-primary bg-primary/5 text-primary'
        : 'border-gray-100 hover:border-gray-200 text-outline';
    }
    if (isCorrectAnswer) return 'border-green-500 bg-green-50 text-green-700';
    if (isSelected && !isCorrect) return 'border-red-500 bg-red-50 text-red-700';
    return 'border-gray-100 text-outline opacity-50';
  };

  return (
    <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50">
      <div className="flex items-center gap-2 mb-6">
        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">OX</span>
      </div>
      <div className="flex items-start gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
          <HelpCircle size={24} />
        </div>
        <h2 className="text-lg md:text-xl font-bold leading-tight pt-1">{quiz.question}</h2>
      </div>

      <div className="flex gap-4 mb-8">
        {(['O', 'X'] as const).map((value) => (
          <button
            key={value}
            disabled={submitted}
            onClick={() => setSelected(value)}
            className={`flex-1 py-6 rounded-xl border-2 transition-all text-4xl font-extrabold ${getButtonClass(value)}`}
          >
            {value}
            {submitted && quiz.correctAnswer === value && (
              <CheckCircle2 size={20} className="inline ml-2 text-green-500 align-middle" />
            )}
            {submitted && selected === value && !isCorrect && (
              <XCircle size={20} className="inline ml-2 text-red-500 align-middle" />
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
                {isCorrect ? '정답입니다!' : `아쉽네요! 정답은 ${quiz.correctAnswer}입니다.`}
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

// ─── 주관식 퀴즈 카드 ─────────────────────────────────────────────────────────

interface SubjQuizCardProps {
  quiz: SubjectiveQuiz;
  isLast: boolean;
  isStartingDebate: boolean;
  type: 'pre' | 'post';
  topic: string;
  onNext: () => void;
}

const SubjQuizCard = ({ quiz, isLast, isStartingDebate, type, topic, onNext }: SubjQuizCardProps) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [evalResult, setEvalResult] = useState<{ score: number; maxScore: number; feedback: string } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleSubmit = async () => {
    setSubmitted(true);
    setIsEvaluating(true);
    try {
      const res = await debateApi.evaluateSubjective(topic, type, [{ quiz, userAnswer: answer }]);
      const r = res.results[0];
      setEvalResult({ score: r.score, maxScore: r.maxScore, feedback: r.feedback });
    } catch {
      setEvalResult(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50">
      <div className="flex items-center gap-2 mb-6">
        <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-xs font-bold rounded-full">주관식</span>
      </div>
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
          <HelpCircle size={24} />
        </div>
        <h2 className="text-lg md:text-xl font-bold leading-tight pt-1">{quiz.question}</h2>
      </div>

      {quiz.hint && (
        <p className="text-sm text-outline bg-gray-50 rounded-xl px-4 py-3 mb-6 leading-relaxed">
          💡 {quiz.hint}
        </p>
      )}

      <textarea
        disabled={submitted}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="답을 입력하세요..."
        rows={4}
        className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-primary outline-none resize-none text-sm md:text-base mb-8 disabled:opacity-60"
      />

      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 space-y-4"
          >
            {isEvaluating ? (
              <div className="p-4 rounded-2xl bg-gray-50 flex items-center gap-2 text-outline text-sm">
                <Loader2 size={16} className="animate-spin" /> 답변 평가 중...
              </div>
            ) : evalResult && (
              <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-primary text-sm">AI 평가</span>
                  <span className="font-black text-primary">
                    {evalResult.score} / {evalResult.maxScore}점
                  </span>
                </div>
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: evalResult.maxScore }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded-full ${i < evalResult.score ? 'bg-primary' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-outline leading-relaxed">{evalResult.feedback}</p>
              </div>
            )}

            <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-sm text-outline leading-relaxed">
                <span className="font-bold text-on-surface">해설:</span> {quiz.explanation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={answer.trim() === ''}
            className="px-12 py-4 bg-primary text-white font-bold rounded-full disabled:opacity-50 transition-all"
          >
            제출하기
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={isStartingDebate || isEvaluating}
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
