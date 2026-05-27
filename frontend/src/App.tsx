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
import { SearchView } from "./components/SearchView";
import { LoginView } from "./components/LoginView";
import { SignupView } from "./components/SignupView";
import { ProfileView } from "./components/ProfileView";
import { QuizView } from "./components/QuizView";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // =========================================================
  // [1] 인증 상태 (Auth)
  // 사용 위치: Navbar, LoginView, SignupView, ProfileView
  // =========================================================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  /** 앱 초기 로드 시 토큰으로 로그인 상태 복원 */
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

  // =========================================================
  // [2] 페이지 전환 (Navigation)
  // 사용 위치: 모든 Route 전환 시
  // =========================================================

  /** 경로 변경 시 스크롤 위치를 최상단으로 초기화 */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // =========================================================
  // [3] 토론 주제 & 난이도 설정 (Setup)
  // 사용 위치: HomeView, SetupView, SearchView → DebateView, ResultView
  // =========================================================
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  // const [responseSpeed, setResponseSpeed] = useState<ResponseSpeed>('fast');

  /** 설정 완료 후 사전 퀴즈 화면으로 이동 */
  const handleStartDebate = async () => {
    if (!topic.trim()) return;
    navigate("/pre-quiz");
  };

  // =========================================================
  // [4] 토론 진행 상태 (Debate)
  // 사용 위치: DebateView
  // =========================================================
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(4);
  const [progress, setProgress] = useState(0);
  // 라운드 내 발언 단계: 1=사용자 주장, 2=사용자 반박, 3=사용자 재반박
  const [speechTurn, setspeechTurn] = useState(1);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [discussionId, setDiscussionId] = useState<number | null>(null);
  const [usedMaterials, setUsedMaterials] = useState<import("./types").RelatedMaterial[]>([]);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);

  /**
   * 발언 단계(speechTurn)를 API turn 값으로 변환
   * - step 1 → turn 1 (사용자 주장)
   * - step 2 → turn 2 (사용자 반박)
   * - step 3 → turn 3 (사용자 재반박)
   *
   * 사용 위치: handleSendMessage
   */
  const getSpeechTurn = (step: number): Turn => {
    if (step === 1) return 1;
    if (step === 2) return 2;
    return 3;
  };

  /**
   * 사용자 메시지를 API로 전송하고 AI 응답을 받아 메시지 목록에 추가
   * 진행률·발언 단계를 업데이트하고, 라운드 종료 시 계속 여부를 결정
   *
   * 사용 위치: DebateView
   */
  const handleSendMessage = async (text: string) => {
    setIsGenerating(true);

    try {
      const data = await debateApi.sendMessage(topic, text, messages, discussionId, difficulty/*, responseSpeed*/);

      if (data.used_materials && data.used_materials.length > 0) {
        setUsedMaterials(data.used_materials);
      }
      if (data.agent_steps && data.agent_steps.length > 0) {
        setAgentSteps(data.agent_steps);
      }

      const currentTurn = getSpeechTurn(speechTurn);

      // 사용자 메시지 객체 생성
      const userMsg: DebateMessage = {
        role: "user",
        side: data.userSide || undefined,
        turn: currentTurn,
        content: text,
        timestamp: formatTime(),
        round: currentRound,
      };

      const nextspeechTurn = speechTurn + 1;

      // AI 응답 메시지 객체 생성 후 목록에 추가
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "agent",
          agentName: data.aiResponse.agentName,
          side: data.aiResponse.side || undefined,
          /*
          토론 진행 단계 (turn)
          0: 시작 → 주제 설명 생성
          1: 사용자 주장 → 에이전트 반박
          2: 사용자 재반박 → 에이전트 주장 생성
          3: 사용자 반박 → 에이전트 재반박
          turn이 3이 되면 1라운드 종료 -> 다시 1부터 반복
          */
          turn: getSpeechTurn(nextspeechTurn > 3 ? 3 : nextspeechTurn) as Turn,
          content: data.aiResponse.content,
          timestamp: data.aiResponse.timestamp
            ? formatTime(data.aiResponse.timestamp)
            : formatTime(),
          round: currentRound,
        },
      ]);

      // 진행률 계산: 각 라운드는 에이전트 설명(+1) + 주장/반박/재반박(3) = 4스텝
      const totalSteps = totalRounds * 4;
      const completedSteps = (currentRound - 1) * 4 + 1 + speechTurn;
      setProgress(Math.min(100, Math.round((completedSteps / totalSteps) * 100)));

      if (speechTurn < 3) {
        setspeechTurn(speechTurn + 1);
      } else {
        // 재반박 완료: 마지막 라운드면 종료, 아니면 계속 여부 선택 대기
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
  };

  /**
   * 다음 라운드 계속 진행: totalRounds를 2씩 늘리고 라운드 상태 초기화
   *
   * 사용 위치: DebateView
   */
  const handleContinueDebate = () => {
    setTotalRounds((prev) => prev + 2);
    setCurrentRound((prev) => prev + 1);
    setspeechTurn(1);
    setWaitingForContinue(false);
  };

  /**
   * 토론 종료: 사후 퀴즈 화면으로 이동
   *
   * 사용 위치: DebateView, handleSendMessage(마지막 라운드 완료 시)
   */
  const handleFinishDebate = async () => {
    navigate("/post-quiz");
  };

  // =========================================================
  // [5] 퀴즈 & 토론 초기화 (Quiz / Debate Init)
  // 사용 위치: QuizView(pre), QuizView(post) → DebateView, ResultView
  // =========================================================

  /**
   * 사전 퀴즈 완료 후 실제 토론 시작
   * QuizView에서 turn=0인 초기 에이전트 메시지와 discussionId를 전달받아 세팅
   *
   * 사용 위치: QuizView(type="pre") onComplete 콜백
   */
  const startActualDebate = async (
    initialMessages?: DebateMessage[],
    receivedDiscussionId?: number
  ) => {
    setMessages([]);
    setCurrentRound(1);
    setTotalRounds(2);
    setProgress(0);
    setspeechTurn(1);
    setWaitingForContinue(false);

    if (receivedDiscussionId && initialMessages && initialMessages.length > 0) {
      const turn0Messages = initialMessages.filter((m) => m.turn === 0);
      setMessages(turn0Messages.length > 0 ? turn0Messages : initialMessages);
      setDiscussionId(receivedDiscussionId);
      navigate("/debate");
    } else {
      console.error("토론 시작에 필요한 초기 메시지가 없습니다.");
      navigate("/setup");
    }
  };

  // =========================================================
  // [6] 결과 분석 (Result)
  // 사용 위치: QuizView(post) → ResultView
  // =========================================================
  const [debateResult, setDebateResult] = useState<DiscussionSummaryResponse | string>("");

  /**
   * 사후 퀴즈 완료 후 토론 결과 분석 요청 및 결과 화면 이동
   *
   * 사용 위치: QuizView(type="post") onComplete 콜백
   */
  const showResult = async () => {
    navigate("/result");
    setDebateResult("토론 결과를 분석 중입니다...");

    try {
      const data = await debateApi.analyze(topic, messages, discussionId);
      setDebateResult(data);
    } catch (error) {
      console.error("토론 분석에 실패했습니다:", error);
      setDebateResult("결과 분석에 실패했습니다.");
    }
  };

  // =========================================================
  // [7] 렌더링 (Layout & Routes)
  // =========================================================
  return (
    <div className={`min-h-screen flex flex-col font-sans ${fullScreenMode ? "overflow-hidden" : ""}`}>
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
              {/* 홈 */}
              <Route path="/" element={<HomeView setTopic={setTopic} />} />

              {/* 토론 설정 */}
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

              {/* 사전 퀴즈 */}
              <Route
                path="/pre-quiz"
                element={
                  <QuizView
                    topic={topic}
                    type="pre"
                    onComplete={startActualDebate}
                  />
                }
              />

              {/* 사후 퀴즈 */}
              <Route
                path="/post-quiz"
                element={<QuizView topic={topic} type="post" onComplete={showResult} />}
              />

              {/* 토론 화면 - discussionId 없으면 설정 페이지로 리다이렉트 */}
              <Route
                path="/debate"
                element={
                  discussionId ? (
                    <DebateView
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
                      speechTurn={speechTurn}
                      waitingForContinue={waitingForContinue}
                      onContinueDebate={handleContinueDebate}
                    />
                  ) : (
                    <Navigate to="/setup" replace />
                  )
                }
              />

              {/* 결과 */}
              <Route
                path="/result"
                element={<ResultView topic={topic} result={debateResult} />}
              />

              {/* FAQ */}
              <Route path="/faq" element={<FAQView />} />

              {/* 토론 주제 검색 */}
              <Route path="/search" element={<SearchView setTopic={setTopic} />} />

              {/* 로그인 */}
              <Route
                path="/login"
                element={<LoginView setIsLoggedIn={setIsLoggedIn} setUserData={setUserData} />}
              />

              {/* 회원가입 */}
              <Route
                path="/signup"
                element={<SignupView setIsLoggedIn={setIsLoggedIn} setUserData={setUserData} />}
              />

              {/* 프로필 - 비로그인 시 로그인 페이지로 리다이렉트 */}
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

              {/* 404 - 홈으로 리다이렉트 */}
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
