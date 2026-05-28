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
import { DebateMessage, UserData, DiscussionSummaryResponse, Difficulty, AgentStep, Turn, MultipleChoiceQuiz/*, ResponseSpeed*/ } from "./types";
import { debateApi, userApi } from "./services/api";
import { formatTime } from "./utils";
import {
  MOCK_PRE_QUIZ_MC,
  MOCK_POST_QUIZ_MC,
  MOCK_DISCUSSION_ID,
  MOCK_DEBATE_MESSAGES,
} from "./mockData";

/**
 * 토론 화면 내 진행 단계
 * intro     : turn=0 주제 요약 메시지 표시 (퀴즈 이전)
 * pre-quiz  : 사전 퀴즈 풀기  (turn=0 이후)
 * debating  : 토론 진행 중    (turn=1~3 × N라운드)
 * post-quiz : 사후 퀴즈 풀기  (마지막 라운드 turn=3 에이전트 메시지 직후)
 */
export type DebatePhase = 'intro' | 'pre-quiz' | 'debating' | 'post-quiz';

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

  // =========================================================
  // [4] 토론 화면 내 퀴즈 상태
  // 사용 위치: DebateView (인라인 렌더링)
  //
  // 진행 순서:
  //   SetupView 완료
  //     → pre-quiz  (사전 퀴즈 — DebateView 채팅 영역에 인라인 표시)
  //     → debating  (turn=0 주제요약 채팅 → turn=1~3 토론 → 라운드 추가여부 선택)
  //     → post-quiz (사후 퀴즈 — 마지막 라운드 turn=3 직후)
  //     → ResultView
  // =========================================================
  const [debatePhase, setDebatePhase] = useState<DebatePhase>('pre-quiz');
  const [preQuizzes, setPreQuizzes] = useState<MultipleChoiceQuiz[]>([]);
  const [postQuizzes, setPostQuizzes] = useState<MultipleChoiceQuiz[]>([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  /**
   * SetupView 완료 → /debate 로 이동하고 사전 퀴즈 데이터 로드
   * 사용 위치: SetupView onStart 콜백
   */
  const handleStartDebate = async () => {
    if (!topic.trim()) return;

    // 토론 관련 상태 초기화 — API 응답 전 로딩 화면을 위해 intro로 먼저 전환
    setDebatePhase('intro');
    setPreQuizzes([]);
    setPostQuizzes([]);
    setMessages([]);
    setCurrentRound(1);
    setTotalRounds(2);
    setProgress(0);
    setspeechTurn(1);
    setWaitingForContinue(false);
    setDiscussionId(null);

    navigate("/debate");

    // 1단계: turn=0 주제 요약 메시지 먼저 요청
    setIsGenerating(true);
    setAgentSteps([]);
    try {
      const data = await debateApi.sendMessage(
        topic, `${topic}에 대한 토론을 수행할거야. 주제에 대한 설명을 해줘`, [], null, undefined, 0,
        (step) => setAgentSteps(prev => {
          const idx = prev.findIndex(s => s.step === step.step);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = step;
            return next;
          }
          return [...prev, step];
        }),
      );
      const initialMsg: DebateMessage = { ...data.aiResponse, turn: 0, round: 1 };
      setMessages([initialMsg]);
      setDiscussionId(initialMsg.discussion_id ?? MOCK_DISCUSSION_ID);
    } catch {
      const mockTurn0 = MOCK_DEBATE_MESSAGES.filter(m => m.turn === 0);
      setMessages(mockTurn0);
      setDiscussionId(MOCK_DISCUSSION_ID);
    } finally {
      setIsGenerating(false);
    }

    // API 완료 후 intro 단계 재확인 (try/catch 중 phase가 바뀐 경우 대비)
    setDebatePhase('intro');
  };

  // =========================================================
  // [5] 토론 진행 상태 (Debate)
  // 사용 위치: DebateView
  // =========================================================
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(2);
  const [progress, setProgress] = useState(0);
  // 라운드 내 발언 단계: 1=사용자 주장, 2=사용자 반박, 3=사용자 재반박
  const [speechTurn, setspeechTurn] = useState(1);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [discussionId, setDiscussionId] = useState<number | null>(null);
  const [usedMaterials, setUsedMaterials] = useState<string[]>([]);
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
   * "퀴즈 풀기" 버튼 클릭 → 사전 퀴즈 로드 후 pre-quiz 단계로 전환
   * intro 단계에서 turn=0 메시지 아래에 보이는 버튼에서 호출됨
   *
   * 사용 위치: DebateView onStartQuiz 콜백
   */
  const handleStartQuiz = async () => {
    setIsQuizLoading(true);
    setDebatePhase('pre-quiz');
    try {
      const data = await debateApi.getQuizSet(topic, 'pre');
      setPreQuizzes(
        Array.isArray(data) && data.length > 0 ? data : MOCK_PRE_QUIZ_MC
      );
    } catch {
      setPreQuizzes(MOCK_PRE_QUIZ_MC);
    } finally {
      setIsQuizLoading(false);
    }
  };

  /**
   * 사전 퀴즈 완료 → debating 단계로 전환
   * (turn=0 주제 요약은 handleStartDebate에서 이미 처리됨)
   *
   * 사용 위치: DebateView 내 인라인 사전퀴즈 완료 콜백
   */
  const handlePreQuizComplete = () => {
    setDebatePhase('debating');
  };

  /**
   * 사용자 메시지를 API로 전송하고 AI 응답을 받아 메시지 목록에 추가
   * 진행률·발언 단계를 업데이트하고, 라운드 종료 시 계속 여부를 결정
   *
   * 사용 위치: DebateView
   */
  const handleSendMessage = async (text: string) => {
    setIsGenerating(true);
    setAgentSteps([]);

    try {
      const currentTurn = getSpeechTurn(speechTurn);
      const data = await debateApi.sendMessage(
        topic, text, messages, discussionId, difficulty, currentTurn,
        (step) => setAgentSteps(prev => {
          const idx = prev.findIndex(s => s.step === step.step);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = step;
            return next;
          }
          return [...prev, step];
        }),
      );

      if (data.used_materials && data.used_materials.length > 0) {
        setUsedMaterials(data.used_materials);
      }
      if (data.agent_steps && data.agent_steps.length > 0) {
        setAgentSteps(data.agent_steps);
      }

      // 사용자 메시지 객체 생성
      const userMsg: DebateMessage = {
        discussion_id: discussionId!, //이미 저장된 discussionId 사용
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
          discussion_id: data.aiResponse.discussion_id,
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
        // 재반박 완료: 마지막 라운드면 사후퀴즈로 전환, 아니면 계속 여부 선택 대기
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
   * 토론 종료 → 사후 퀴즈 로드 후 post-quiz 단계로 전환
   * 마지막 라운드 turn=3 에이전트 메시지 직후 호출됨
   *
   * 사용 위치: DebateView, handleSendMessage(마지막 라운드 완료 시)
   */
  const handleFinishDebate = async () => {
    setIsQuizLoading(true);
    try {
      const data = await debateApi.getQuizSet(topic, 'post');
      setPostQuizzes(
        Array.isArray(data) && data.length > 0 ? data : MOCK_POST_QUIZ_MC
      );
    } catch {
      setPostQuizzes(MOCK_POST_QUIZ_MC);
    } finally {
      setIsQuizLoading(false);
    }
    setDebatePhase('post-quiz');
  };

  // =========================================================
  // [6] 결과 분석 (Result)
  // 사용 위치: DebateView(post-quiz 완료) → ResultView
  // =========================================================
  const [debateResult, setDebateResult] = useState<DiscussionSummaryResponse | string>("");

  /**
   * 사후 퀴즈 완료 후 토론 결과 분석 요청 및 결과 화면 이동
   *
   * 사용 위치: DebateView 내 인라인 사후퀴즈 완료 콜백
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

              {/* 토론 화면
                  - pre-quiz / debating / post-quiz 단계를 DebateView 채팅 영역에서 인라인 처리
                  - topic이 없으면 setup으로 리다이렉트 */}
              <Route
                path="/debate"
                element={
                  topic ? (
                    <DebateView
                      topic={topic}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      isGenerating={isGenerating}
                      onFinish={handleFinishDebate}
                      currentRound={currentRound}
                      totalRounds={totalRounds}
                      progress={progress}
                      discussionId={discussionId ?? 0}
                      setFullScreenMode={setFullScreenMode}
                      usedMaterials={usedMaterials}
                      agentSteps={agentSteps}
                      difficulty={difficulty}
                      speechTurn={speechTurn}
                      waitingForContinue={waitingForContinue}
                      onContinueDebate={handleContinueDebate}
                      // ── 인라인 퀴즈 관련 props ──
                      debatePhase={debatePhase}
                      onPhaseChange={setDebatePhase}
                      preQuizzes={preQuizzes}
                      postQuizzes={postQuizzes}
                      isQuizLoading={isQuizLoading}
                      onStartQuiz={handleStartQuiz}
                      onPreQuizComplete={handlePreQuizComplete}
                      onPostQuizComplete={showResult}
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
