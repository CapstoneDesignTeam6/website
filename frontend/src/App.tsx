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
import { AboutView } from "./components/AboutView";
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
          // 백엔드의 @router.get("/me")를 호출하는 함수가 userApi에 있다고 가정
          // userApi.getCurrentUser()를 추가하여 실제 데이터를 가져오세요.
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

  const startActualDebate = async () => {
    // navigate("/debate"); // discussionId가 설정된 후로 이동
    setMessages([]);
    setIsGenerating(true);
    setCurrentRound(1);
    setProgress(0);

    try {
      // debateApi.start는 이제 discussionId를 반환합니다.
      const data = await debateApi.start(topic);
      setMessages([
        {
          role: "agent",
          agentName: data.agentName,
          side: data.side,
          content: data.content,
          timestamp: data.timestamp,
          round: data.currentRound || 1,
        },
      ]);
      setDiscussionId(data.discussionId); // discussionId 저장
      if (data.currentRound) setCurrentRound(data.currentRound);
      if (data.totalRounds) setTotalRounds(data.totalRounds);
      if (data.progress) setProgress(data.progress);

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
    setIsGenerating(true);

    try {
      const data = await debateApi.sendMessage(topic, text, messages);

      const userMsg: DebateMessage = {
        role: "user",
        side: data.userSide,
        content: text,
        timestamp: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        round: data.currentRound || currentRound,
      };

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "agent",
          agentName: data.aiResponse.agentName,
          side: data.aiResponse.side,
          content: data.aiResponse.content,
          timestamp: data.aiResponse.timestamp,
          round: data.currentRound || currentRound,
        },
      ]);
      if (data.currentRound) setCurrentRound(data.currentRound);
      if (data.totalRounds) setTotalRounds(data.totalRounds);
      if (data.progress) setProgress(data.progress);
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
              <Route path="/about" element={<AboutView />} />
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
                    onComplete={startActualDebate}
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
                    <DebateView
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
