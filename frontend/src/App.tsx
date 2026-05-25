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
import { DebateMessage, UserData, DiscussionSummaryResponse, Difficulty, AgentStep/*, ResponseSpeed*/ } from "./types";
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
    // navigate("/debate"); // discussionId가 설정된 후로 이동
    setMessages([]);
    setIsGenerating(true); // 메시지 생성 중 상태 활성화
    setCurrentRound(1); // 토론 시작 시 현재 라운드를 1로 초기화
    setTotalRounds(2); // 초기 총 라운드 수 2 (계속 진행 시 2씩 증가)
    setProgress(0); // 진행률을 0으로 초기화 (아직 완료된 라운드가 없으므로)
    setSpeechStep(1); // 발언 단계 초기화
    setWaitingForContinue(false);

    try {
      // debateApi.start는 이제 discussionId를 반환합니다.
      let actualDiscussionId: number | null = null;
      let initialAgentMessage: DebateMessage[] = [];

      if (receivedDiscussionId && initialMessages && initialMessages.length > 0) {
        // QuizView에서 Mock 데이터로 넘어온 경우
        actualDiscussionId = receivedDiscussionId;
        initialAgentMessage = initialMessages;
      } else {
        // 실제 API 호출을 통해 토론 시작
        const data = await debateApi.start(topic, difficulty/*, responseSpeed*/);
        actualDiscussionId = data.id || Date.now(); // 백엔드에서 안 넘어오면 임시 discussionId 생성
        initialAgentMessage = [
          {
            role: "agent",
          agentName: data.agentName || "AI 에이전트", 
          side: data.side || "pro", 
          content: data.content || `"${topic}"에 대한 토론을 시작합니다.`,
          timestamp: data.timestamp || formatTime(),
          round: 1, // 초기 메시지는 1라운드에 속함
          },
        ];
      }

      setMessages(initialAgentMessage); // 초기 메시지 설정
      setDiscussionId(actualDiscussionId); // discussionId 저장

      navigate("/debate"); // discussionId가 설정된 후 토론 페이지로 이동
    } catch (error) {
      console.error("Failed to start debate:", error);
      // 오류 발생 시 이전 페이지로 돌아가거나 사용자에게 알림
      navigate("/setup"); 
    } finally {
      setIsGenerating(false);
    }
  }; // 실제 토론 시작

  // 발언 단계별 speechType 매핑
  // speechStep: 1=주장, 2=반박, 3=재반박
  const getSpeechType = (step: number): 'argument' | 'rebuttal' | 'counter-rebuttal' => {
    if (step === 1) return 'argument';
    if (step === 2) return 'rebuttal';
    return 'counter-rebuttal';
  };

  const handleSendMessage = async (text: string) => {
    // 메시지 전송 시 로딩 상태 활성화
    setIsGenerating(true);

    try {
      // 백엔드 API를 통해 메시지 전송
      const data = await debateApi.sendMessage(topic, text, messages, discussionId, currentRound, difficulty/*, responseSpeed*/);
      if (data.used_materials && data.used_materials.length > 0) {
        setUsedMaterials(data.used_materials);
      }
      if (data.agent_steps && data.agent_steps.length > 0) {
        setAgentSteps(data.agent_steps);
      }

      const currentSpeechType = getSpeechType(speechStep);

      // 사용자 메시지 객체 생성
      const userMsg: DebateMessage = {
        role: "user",
        side: data.userSide || undefined,
        speechType: currentSpeechType,
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
          // 에이전트는 사용자 발언 다음 단계로 응답 (주장→반박, 반박→재반박, 재반박→재반박)
          speechType: nextSpeechStep === 2 ? 'argument' : nextSpeechStep === 3 ? 'rebuttal' : 'counter-rebuttal',
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
