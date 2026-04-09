import { useState, FormEvent } from 'react';
import { View, UserData } from '../types';
import { userApi } from '../services/api';

interface LoginViewProps {
  setView: (v: View) => void;
  setIsLoggedIn: (v: boolean) => void;
  setUserData: (d: UserData) => void;
}

export const LoginView = ({ setView, setIsLoggedIn, setUserData }: LoginViewProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const data = await userApi.login(email, password);
      setIsLoggedIn(true);
      setUserData(data.user);
      setView('home');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoggedIn(true);
    setUserData({
      nickname: 'Google User',
      email: 'google_user@gmail.com'
    });
    setView('home');
  };

  return (
    <div className="max-w-md mx-auto px-4 md:px-8 py-12 md:py-24">
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mb-3 md:mb-4">로그인</h1>
        <p className="text-sm md:text-base text-outline">Agora에 오신 것을 환영합니다.</p>
      </header>

      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 editorial-shadow border border-gray-50 card-hover">
        <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">이메일</label>
            <input 
              type="email" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-xs md:text-sm font-bold text-on-surface ml-1">비밀번호</label>
            <input 
              type="password" 
              required
              className="w-full bg-surface-container p-3 md:p-4 rounded-xl border-none focus:ring-2 focus:ring-primary transition-all text-sm md:text-base"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full py-3 md:py-4 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base"
          >
            로그인
          </button>

          <div className="relative py-3 md:py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[10px] md:text-xs uppercase"><span className="bg-white px-2 text-outline">또는</span></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 md:py-4 border border-gray-200 text-on-surface font-bold rounded-xl flex items-center justify-center gap-2 md:gap-3 hover:bg-gray-50 transition-all text-sm md:text-base"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 md:w-5 md:h-5" />
            Google 계정으로 로그인
          </button>

          <p className="text-center text-xs md:text-sm text-outline pt-3 md:pt-4">
            계정이 없으신가요? <button type="button" onClick={() => setView('signup')} className="text-primary font-bold hover:underline">회원가입</button>
          </p>
        </form>
      </div>
    </div>
  );
};
