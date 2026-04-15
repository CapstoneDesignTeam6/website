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
import { DebateMessage, UserData } from "./types";
import { debateApi, userApi } from "./services/api";

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [topic, setTopic] = useState("");
  const [agentCount, setAgentCount] = useState(1);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [debateResult, setDebateResult] = useState("");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(4);
  const [progress, setProgress] = useState(0);
  const [discussionId, setDiscussionId] = useState<number | null>(null); // discussionId 상태

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
      setProgress(0); // 진행률을 0으로 초기화 (아직 완료된 라운드가 없으므로)

  const handleStartDebate = async () => {
    if (!topic.trim()) return;
    navigate("/pre-quiz");
  }; // 토론 시작 처리

  const startActualDebate = async (initialMessages?: DebateMessage[], receivedDiscussionId?: number) => {
    // navigate("/debate"); // discussionId가 설정된 후로 이동
    setMessages([]);
    setIsGenerating(true); // 메시지 생성 중 상태 활성화
    setCurrentRound(1); // 토론 시작 시 현재 라운드를 1로 초기화
    setTotalRounds(4); // 총 라운드 수를 4로 설정 (필요에 따라 변경 가능)
    setProgress(0); // 진행률을 0으로 초기화 (아직 완료된 라운드가 없으므로)

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
        const data = await debateApi.start(topic);
        actualDiscussionId = data.id || Date.now(); // 백엔드에서 안 넘어오면 임시 discussionId 생성
        initialAgentMessage = [
          {
            role: "agent",
          agentName: data.agentName || "AI 에이전트", 
          side: data.side || "pro", 
          content: data.content || `"${topic}"에 대한 토론을 시작합니다.`,
          timestamp: data.timestamp || new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
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

  const handleSendMessage = async (text: string) => {
    // 메시지 전송 시 로딩 상태 활성화
    setIsGenerating(true);

    try {
      // 백엔드 API를 통해 메시지 전송
      const data = await debateApi.sendMessage(topic, text, messages);

      // 사용자 메시지 객체 생성
      const userMsg: DebateMessage = {
        role: "user",
        // data.userSide가 'pro', 'con', 'neutral' 중 하나인지 확인하고 할당
        side: (data.userSide === 'pro' || data.userSide === 'con' || data.userSide === 'neutral') ? data.userSide : undefined,
        content: text,
        timestamp: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
        }),
        round: currentRound,
      };

      // AI 응답 메시지 객체 생성
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "agent",
          agentName: data.aiResponse.agentName,
          side: (data.aiResponse.side === 'pro' || data.aiResponse.side === 'con' || data.aiResponse.side === 'neutral') ? data.aiResponse.side : undefined,
          content: data.aiResponse.content,
          timestamp: data.aiResponse.timestamp,
          round: currentRound,
        },
      ]);

      // 사용자 메시지와 AI 응답이 모두 완료되면 라운드 진행
      const completedRound = currentRound; // 방금 완료된 라운드
      const nextRound = currentRound + 1; // 다음 라운드
      setCurrentRound(nextRound); // 다음 라운드로 상태 업데이트

      // 진행률 계산 (완료된 라운드 수 / 총 라운드 수)
      // Math.min(100, ...)을 사용하여 100%를 초과하지 않도록 합니다.
      const newProgress = Math.min(100, Math.round((completedRound / totalRounds) * 100));
      setProgress(newProgress);

      // 모든 라운드가 완료되면 토론 종료 처리
      if (completedRound >= totalRounds) {
        handleFinishDebate();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsGenerating(false);
    }
  }; // 메시지 전송 처리

  const handleFinishDebate = async () => {
    navigate("/post-quiz");
  }; // 토론 종료 처리

  const showResult = async () => {
    navigate("/result");
    setDebateResult("분석 중...");

    try {
      const data = await debateApi.analyze(topic, messages);
      setDebateResult(data.result);
    } catch (error) {
      console.error("Failed to analyze debate:", error);
      setDebateResult("결과 분석에 실패했습니다.");
    }
  }; // 결과 표시

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

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
                    agentCount={agentCount}
                    setAgentCount={setAgentCount}
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
                      discussionId={discussionId} // discussionId 전달
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

      {location.pathname !== "/debate" && <Footer />}
    </div>
  );
}
