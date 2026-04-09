import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  HelpCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quiz } from '../types';
import { debateApi } from '../services/api';

interface QuizViewProps {
  topic: string;
  type: 'pre' | 'post';
  onComplete: () => void;
}

export const QuizView = ({ topic, type, onComplete }: QuizViewProps) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuiz = async () => {
      setIsLoading(true);
      try {
        const data = await debateApi.getQuiz(topic);
        setQuiz(data);
      } catch (error) {
        console.error("Failed to fetch quiz:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, [topic]);

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="animate-spin text-primary mb-4" />
        <p className="text-outline">퀴즈를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-outline mb-6">퀴즈를 찾을 수 없습니다.</p>
        <button 
          onClick={onComplete}
          className="px-8 py-3 bg-primary text-white font-bold rounded-xl"
        >
          건너뛰기
        </button>
      </div>
    );
  }

  const isCorrect = selectedOption === quiz.correctOptionId;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-24">
      <header className="text-center mb-12">
        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full mb-4 inline-block uppercase tracking-widest">
          {type === 'pre' ? '토론 전 퀴즈' : '토론 후 퀴즈'}
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight mb-2">
          {type === 'pre' ? '주제 이해도 체크' : '토론 내용 복습'}
        </h1>
        <p className="text-sm text-outline">간단한 퀴즈를 통해 주제에 대해 더 깊이 알아보세요.</p>
      </header>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
            <HelpCircle size={24} />
          </div>
          <h2 className="text-lg md:text-xl font-bold leading-tight pt-1">
            {quiz.question}
          </h2>
        </div>

        <div className="space-y-3 mb-8">
          {quiz.options.map((option) => (
            <button
              key={option.id}
              disabled={isSubmitted}
              onClick={() => setSelectedOption(option.id)}
              className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all flex items-center justify-between ${
                selectedOption === option.id
                  ? isSubmitted
                    ? isCorrect
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                    : 'border-primary bg-primary/5'
                  : isSubmitted && option.id === quiz.correctOptionId
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <span className={`text-sm md:text-base font-medium ${
                selectedOption === option.id || (isSubmitted && option.id === quiz.correctOptionId)
                  ? 'text-on-surface'
                  : 'text-outline'
              }`}>
                {option.text}
              </span>
              {isSubmitted && option.id === quiz.correctOptionId && (
                <CheckCircle2 size={20} className="text-green-500" />
              )}
              {isSubmitted && selectedOption === option.id && !isCorrect && (
                <XCircle size={20} className="text-red-500" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {isSubmitted && (
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
                  {isCorrect ? '정답입니다!' : '아쉽네요, 정답이 아닙니다.'}
                </span>
              </div>
              <p className="text-sm text-outline leading-relaxed">
                <span className="font-bold text-on-surface">해설:</span> {quiz.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center">
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={selectedOption === null}
              className="px-12 py-4 bg-primary text-white font-bold rounded-full disabled:opacity-50 transition-all"
            >
              정답 확인
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-12 py-4 bg-primary text-white font-bold rounded-full flex items-center gap-2 hover:gap-3 transition-all"
            >
              {type === 'pre' ? '토론장으로 이동' : '최종 결과 보기'} <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
