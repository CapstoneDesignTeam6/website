import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";

// --- Types & Services ---
// --- 타입 및 서비스 ---
import { DebateMessage, UserData, DiscussionSummaryResponse, Difficulty, AgentStep, Turn/*, ResponseSpeed*/ } from "./types";
import { debateApi, userApi } from "./services/api";
import { formatTime } from "./utils";

// --- Components ---
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { HomeView } from "./components/HomeView";
import { SetupView } from "./components/SetupView";
import { DebateView } from "./components/DebateView";
import { ResultView } from "./components/ResultView";
import { FAQView } from "./components/FAQView";
import { SearchView } from "./components/SearchView"; // SearchView 임포트
import { LoginView } from "./components/LoginView";
import { SignupView } from "./components/SignupView";
import { ProfileView } from "./components/ProfileView";
import { QuizView } from "./components/QuizView";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  // const [responseSpeed, setResponseSpeed] = useState<ResponseSpeed>('fast');
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [debateResult, setDebateResult] = useState<DiscussionSummaryResponse | string>(""); // debateResult 타입 변경
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(4);
  const [progress, setProgress] = useState(0);
  // 라운드 내 발언 단계: 1=사용자주장, 2=사용자반박, 3=사용자재반박, 4=에이전트재반박완료(계속여부선택)
  const [speechStep, setSpeechStep] = useState(1);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState(false); // 전체 화면 모드 상태 추가
  const [discussionId, setDiscussionId] = useState<number | null>(null); // discussionId 상태
  const [usedMaterials, setUsedMaterials] = useState<import('./types').RelatedMaterial[]>([]); // AI 주장에 사용된 자료 목록
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]); // 에이전트 사고과정 단계

  useEffect(() => {
    const initAuth = async () => {
      const token = userApi.getToken();
      if (token) {
        try {
          const user = await userApi.getCurrentUser();
          setIsLoggedIn(true);
          setUserData(user);
        } catch (error) {
          console.error("세션이 만료되었습니다.");
          userApi.logout();
          setIsLoggedIn(false);
        }
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]); // 경로 변경 시 스크롤 상단으로 이동

  const handleStartDebate = async () => {
    if (!topic.trim()) return;
    navigate("/pre-quiz");
  }; // 토론 시작 처리

  const startActualDebate = async (initialMessages?: DebateMessage[], receivedDiscussionId?: number) => {
    setMessages([]);
    setCurrentRound(1); // 토론 시작 시 현재 라운드를 1로 초기화
    setTotalRounds(2); // 초기 총 라운드 수 2 (계속 진행 시 2씩 증가)
    setProgress(0); // 진행률을 0으로 초기화
    setSpeechStep(1); // 발언 단계 초기화
    setWaitingForContinue(false);

    // QuizView에서 turn=0인 초기 메시지와 discussionId를 전달받아 사용
    if (receivedDiscussionId && initialMessages && initialMessages.length > 0) {
      // turn === 0 인 에이전트 메시지만 추려서 초기 메시지로 설정
      const turn0Messages = initialMessages.filter(m => m.turn === 0);
      setMessages(turn0Messages.length > 0 ? turn0Messages : initialMessages);
      setDiscussionId(receivedDiscussionId);
      navigate("/debate");
    } else {
      // initialMessages가 없으면 설정 페이지로 되돌아감
      console.error("토론 시작에 필요한 초기 메시지가 없습니다.");
      navigate("/setup");
    }
  }; // 실제 토론 시작

  // 발언 단계별 turn 매핑
  // speechStep: 1=사용자 주장(turn 1), 2=사용자 반박(turn 2→에이전트 재반박), 3=사용자 재반박(turn 3)
  const getSpeechTurn = (step: number): Turn => {
    if (step === 1) return 1;
    if (step === 2) return 2;
    return 3;
  };

  const handleSendMessage = async (text: string) => {
    // 메시지 전송 시 로딩 상태 활성화
    setIsGenerating(true);

    try {
      // 백엔드 API를 통해 메시지 전송
      const data = await debateApi.sendMessage(topic, text, messages, discussionId, difficulty/*, responseSpeed*/);
      if (data.used_materials && data.used_materials.length > 0) {
        setUsedMaterials(data.used_materials);
      }
      if (data.agent_steps && data.agent_steps.length > 0) {
        setAgentSteps(data.agent_steps);
      }

      const currentTurn = getSpeechTurn(speechStep);

      // 사용자 메시지 객체 생성
      const userMsg: DebateMessage = {
        role: "user",
        side: data.userSide || undefined,
        turn: currentTurn,
        content: text,
        timestamp: formatTime(),
        round: currentRound,
      };

      const nextSpeechStep = speechStep + 1; // 에이전트 응답 후 다음 단계

      // AI 응답 메시지 객체 생성
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "agent",
          agentName: data.aiResponse.agentName,
          side: data.aiResponse.side || undefined,
          // 에이전트는 사용자 발언 다음 단계로 응답
          // speechStep 1(사용자 주장) → 에이전트 반박(turn 1)
          // speechStep 2(사용자 재반박) → 에이전트 주장 생성(turn 2)
          // speechStep 3(사용자 반박) → 에이전트 재반박(turn 3)
          turn: getSpeechTurn(nextSpeechStep > 3 ? 3 : nextSpeechStep) as Turn,
          content: data.aiResponse.content,
          timestamp: data.aiResponse.timestamp ? formatTime(data.aiResponse.timestamp) : formatTime(),
          round: currentRound,
        },
      ]);

      // 발언 단계 진행
      // 진행률 계산: 각 라운드는 에이전트 설명(+1) + 주장/반박/재반박(3) = 4스텝
      // 완료 스텝 = (이전 라운드 * 4) + (에이전트 설명 1 + 현재 speechStep)
      const totalSteps = totalRounds * 4;
      const completedSteps = (currentRound - 1) * 4 + 1 + speechStep;
      setProgress(Math.min(100, Math.round((completedSteps / totalSteps) * 100)));

      if (speechStep < 3) {
        // 아직 재반박 전: 다음 발언 단계로
        setSpeechStep(speechStep + 1);
      } else {
        // 재반박 완료: 계속 진행 여부 선택 대기

        if (currentRound >= totalRounds) {
          handleFinishDebate();
        } else {
          setWaitingForContinue(true);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsGenerating(false);
    }
  }; // 메시지 전송 처리

  const handleContinueDebate = () => {
    setTotalRounds(prev => prev + 2);
    setCurrentRound(prev => prev + 1);
    setSpeechStep(1);
    setWaitingForContinue(false);
  }; // 다음 라운드 계속 진행 (totalRounds 2씩 증가)

  const handleFinishDebate = async () => {
    navigate("/post-quiz");
  }; // 토론 종료 처리

  const showResult = async () => {
    navigate("/result");
    setDebateResult("토론 결과를 분석 중입니다..."); // 로딩 메시지

    try {
      const data = await debateApi.analyze(topic, messages, discussionId);
      setDebateResult(data); // DiscussionSummaryResponse 객체를 직접 저장
    } catch (error) {
      console.error("토론 분석에 실패했습니다:", error);
      setDebateResult("결과 분석에 실패했습니다.");
    }
  }; // 결과 표시

  return (
    <div className={`min-h-screen flex flex-col font-sans ${fullScreenMode ? 'overflow-hidden' : ''}`}>
      {/* 전체 화면 모드가 아닐 때만 Navbar 렌더링 */}
      {!fullScreenMode && <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />}

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomeView setTopic={setTopic} />} />
              <Route
                path="/setup"
                element={
                  <SetupView
                    topic={topic}
                    setTopic={setTopic}
                    difficulty={difficulty}
                    setDifficulty={setDifficulty}
                    // responseSpeed={responseSpeed}
                    // setResponseSpeed={setResponseSpeed}
                    onStart={handleStartDebate}
                  />
                }
              />
              <Route
                path="/pre-quiz"
                element={
                  <QuizView
                    topic={topic}
                    type="pre"
                    onComplete={startActualDebate} // 수정된 onComplete 함수 전달
                  />
                }
              />
              <Route
                path="/post-quiz"
                element={
                  <QuizView topic={topic} type="post" onComplete={showResult} />
                }
              />
              <Route
                path="/debate"
                element={
                  discussionId ? ( // discussionId가 있을 때만 DebateView 렌더링
                    <DebateView // DebateView 컴포넌트 렌더링
                      topic={topic}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      isGenerating={isGenerating}
                      onFinish={handleFinishDebate}
                      currentRound={currentRound}
                      totalRounds={totalRounds}
                      progress={progress}
                      discussionId={discussionId}
                      setFullScreenMode={setFullScreenMode}
                      usedMaterials={usedMaterials}
                      agentSteps={agentSteps}
                      difficulty={difficulty}
                      speechStep={speechStep}
                      waitingForContinue={waitingForContinue}
                      onContinueDebate={handleContinueDebate}
                    />
                  ) : (
                    <Navigate to="/setup" replace /> // discussionId가 없으면 설정 페이지로 리다이렉트
                  )
                }
              />
              <Route
                path="/result"
                element={<ResultView topic={topic} result={debateResult} />}
              />
              <Route path="/faq" element={<FAQView />} />
              <Route
                path="/search"
                element={<SearchView setTopic={setTopic} />}
              />
              <Route
                path="/login"
                element={
                  <LoginView
                    setIsLoggedIn={setIsLoggedIn}
                    setUserData={setUserData}
                  />
                }
              />
              <Route
                path="/signup"
                element={
                  <SignupView
                    setIsLoggedIn={setIsLoggedIn}
                    setUserData={setUserData}
                  />
                }
              />
              <Route
                path="/profile"
                element={
                  isLoggedIn ? (
                    <ProfileView
                      isLoggedIn={isLoggedIn}
                      setIsLoggedIn={setIsLoggedIn}
                      userData={userData}
                      setUserData={setUserData}
                    />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {/* 전체 화면 모드가 아닐 때만 Footer 렌더링 */}
      {!fullScreenMode && <Footer />}
    </div>
  );
}
