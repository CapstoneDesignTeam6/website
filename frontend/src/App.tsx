/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Services ---
import { View, DebateMessage, UserData } from './types';
import { debateApi, userApi } from './services/api';

// --- Components ---
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { AboutView } from './components/AboutView';
import { SetupView } from './components/SetupView';
import { DebateView } from './components/DebateView';
import { ResultView } from './components/ResultView';
import { FAQView } from './components/FAQView';
import { SearchView } from './components/SearchView';
import { LoginView } from './components/LoginView';
import { SignupView } from './components/SignupView';
import { ProfileView } from './components/ProfileView';
import { QuizView } from './components/QuizView';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [topic, setTopic] = useState('');
  const [agentCount, setAgentCount] = useState(3);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [debateResult, setDebateResult] = useState('');

  useEffect(() => {
    const token = userApi.getToken();
    if (token) {
      // In a real app, you'd verify the token and fetch user data here
      setIsLoggedIn(true);
      setUserData({
        nickname: '다시 돌아온 토론가',
        email: 'user@example.com'
      });
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const handleStartDebate = async () => {
    if (!topic.trim()) return;
    setView('pre-quiz');
  };

  const startActualDebate = async () => {
    setView('debate');
    setMessages([]);
    setIsGenerating(true);

    try {
      const data = await debateApi.start(topic);
      setMessages([{
        role: 'agent',
        agentName: data.agentName,
        side: data.side,
        content: data.content,
        timestamp: data.timestamp
      }]);
    } catch (error) {
      console.error("Failed to start debate:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    setIsGenerating(true);
    
    try {
      const data = await debateApi.sendMessage(topic, text, messages);
      
      const userMsg: DebateMessage = {
        role: 'user',
        side: data.userSide,
        content: text,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, userMsg, {
        role: 'agent',
        agentName: data.aiResponse.agentName,
        side: data.aiResponse.side,
        content: data.aiResponse.content,
        timestamp: data.aiResponse.timestamp
      }]);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinishDebate = async () => {
    setView('post-quiz');
  };

  const showResult = async () => {
    setView('result');
    setDebateResult('분석 중...');
    
    try {
      const data = await debateApi.analyze(topic, messages);
      setDebateResult(data.result);
    } catch (error) {
      console.error("Failed to analyze debate:", error);
      setDebateResult("결과 분석에 실패했습니다.");
    }
  };

  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomeView setView={setView} setTopic={setTopic} />;
      case 'about':
        return <AboutView setView={setView} />;
      case 'setup':
        return (
          <SetupView 
            setView={setView} 
            topic={topic} 
            setTopic={setTopic} 
            agentCount={agentCount} 
            setAgentCount={setAgentCount} 
            onStart={handleStartDebate} 
          />
        );
      case 'pre-quiz':
        return <QuizView topic={topic} type="pre" onComplete={startActualDebate} />;
      case 'post-quiz':
        return <QuizView topic={topic} type="post" onComplete={showResult} />;
      case 'debate':
        return (
          <DebateView 
            setView={setView} 
            topic={topic} 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isGenerating={isGenerating} 
            onFinish={handleFinishDebate}
          />
        );
      case 'result':
        return <ResultView setView={setView} topic={topic} result={debateResult} />;
      case 'faq':
        return <FAQView />;
      case 'search':
        return <SearchView setView={setView} setTopic={setTopic} />;
      case 'login':
        return <LoginView setView={setView} setIsLoggedIn={setIsLoggedIn} setUserData={setUserData} />;
      case 'signup':
        return <SignupView setView={setView} setIsLoggedIn={setIsLoggedIn} setUserData={setUserData} />;
      case 'profile':
        return (
          <ProfileView 
            isLoggedIn={isLoggedIn} 
            setIsLoggedIn={setIsLoggedIn} 
            userData={userData} 
            setUserData={setUserData} 
            setView={setView} 
          />
        );
      default:
        return <HomeView setView={setView} setTopic={setTopic} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar currentView={view} setView={setView} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {view !== 'debate' && <Footer />}
    </div>
  );
}
