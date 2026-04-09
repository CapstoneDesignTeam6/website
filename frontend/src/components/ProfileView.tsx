import { useState, FormEvent } from 'react';
import { User } from 'lucide-react';
import { View, UserData } from '../types';

interface ProfileViewProps {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userData: UserData | null;
  setUserData: (d: UserData) => void;
  setView: (v: View) => void;
}

export const ProfileView = ({ isLoggedIn, userData, setUserData, setView }: ProfileViewProps) => {
  const [formData, setFormData] = useState({
    nickname: userData?.nickname || '',
    email: userData?.email || '',
    password: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setUserData({
      ...userData!,
      nickname: formData.nickname,
      email: formData.email
    });
    alert('회원 정보가 수정되었습니다.');
  };

  if (!isLoggedIn) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-24">
      <div className="max-w-3xl">
        <header className="mb-12 md:mb-16">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-fixed text-primary rounded-2xl flex items-center justify-center mb-6 md:mb-8">
            <User size={32} className="md:w-10 md:h-10" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold font-headline tracking-tight mb-3 md:mb-4 text-left">회원 정보</h1>
          <p className="text-base md:text-lg text-outline text-left">Agora에서 당신의 활동 정보를 관리하세요.</p>
        </header>

        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 editorial-shadow border border-gray-50 card-hover">
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-10">
            <div className="space-y-2 md:space-y-3">
              <label className="text-sm md:text-base font-bold text-on-surface ml-1">닉네임</label>
              <input 
                type="text" 
                required
                className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                placeholder="닉네임을 입력하세요"
                value={formData.nickname}
                onChange={(e) => setFormData({...formData, nickname: e.target.value})}
              />
              <p className="text-[10px] md:text-xs text-outline ml-1">토론 시 표시되는 이름입니다.</p>
            </div>
            
            <div className="space-y-2 md:space-y-3">
              <label className="text-sm md:text-base font-bold text-on-surface ml-1">이메일</label>
              <input 
                type="email" 
                required
                className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="space-y-2 md:space-y-3">
              <label className="text-sm md:text-base font-bold text-on-surface ml-1">비밀번호 변경</label>
              <input 
                type="password" 
                className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                placeholder="새로운 비밀번호를 입력하세요 (입력 시 변경)"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <div className="pt-6 md:pt-8 flex gap-3 md:gap-4">
              <button 
                type="submit"
                className="flex-1 md:flex-none px-8 md:px-12 py-3 md:py-5 bg-primary text-white font-bold rounded-2xl transition-all text-sm md:text-base"
              >
                저장
              </button>
              <button 
                type="button"
                onClick={() => setView('home')}
                className="flex-1 md:flex-none px-8 md:px-12 py-3 md:py-5 border border-gray-200 text-outline font-bold rounded-2xl hover:bg-gray-50 transition-all text-sm md:text-base"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
