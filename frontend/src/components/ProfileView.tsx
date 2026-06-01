import React, { useState, useEffect } from 'react';
import { User, MessageSquare, Trophy, Calendar, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserData, DiscussionHistoryItem } from '../types';
import { userApi } from '../services/api';

interface ProfileViewProps {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userData: UserData | null;
  setUserData: (d: UserData) => void;
}

type Tab = 'profile' | 'history';

export const ProfileView = ({ isLoggedIn, userData, setUserData }: ProfileViewProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [formData, setFormData] = useState({
    nickname: userData?.nickname || '',
    email: userData?.email || '',
    password: '',
  });
  const [history, setHistory] = useState<DiscussionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      setHistoryLoading(true);
      userApi.getDiscussionHistory()
        .then(setHistory)
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserData({
      ...userData!,
      nickname: formData.nickname,
      email: formData.email
    });
    alert('회원 정보가 수정되었습니다.');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-500';
  };

  if (!isLoggedIn) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 md:mb-16">
          <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-3 md:mb-4 text-left">마이페이지</h1>
          <p className="text-base md:text-lg text-outline text-left">Agora에서 당신의 활동 정보를 관리하세요.</p>
        </header>

        {/* 탭 */}
        <div className="flex gap-1 mb-8 bg-surface-container rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm md:text-base transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            <User size={16} />
            회원 정보
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm md:text-base transition-all ${
              activeTab === 'history'
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            <MessageSquare size={16} />
            토론 기록
          </button>
        </div>

        {/* 회원 정보 탭 */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-12 editorial-shadow border border-gray-50 card-hover">
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
                <p className="text-sm md:text-sm text-outline ml-1">토론 시 표시되는 이름입니다.</p>
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
                  onClick={() => navigate('/')}
                  className="flex-1 md:flex-none px-8 md:px-12 py-3 md:py-5 border border-gray-200 text-outline font-bold rounded-2xl hover:bg-gray-50 transition-all text-sm md:text-base"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 토론 기록 탭 */}
        {activeTab === 'history' && (
          <div>
            {historyLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-12 editorial-shadow border border-gray-50 text-center">
                <MessageSquare size={48} className="mx-auto mb-4 text-outline opacity-40" />
                <p className="text-outline font-medium">아직 토론 기록이 없습니다.</p>
                <button
                  onClick={() => navigate('/setup')}
                  className="mt-6 px-8 py-3 bg-primary text-white font-bold rounded-2xl text-base"
                >
                  첫 토론 시작하기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-5 md:p-6 editorial-shadow border border-gray-50 card-hover"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-base md:text-lg truncate">{item.topic}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm md:text-base text-outline">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(item.created_at)}
                          </span>
                          <span className={`flex items-center gap-1 font-bold ${
                            item.completed_at ? 'text-emerald-600' : 'text-yellow-600'
                          }`}>
                            {item.completed_at ? '완료' : '진행 중'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {item.completed_at && (
                          <div className="text-right">
                            <p className={`text-lg md:text-xl font-extrabold ${getScoreColor(item.score)}`}>
                              {Math.round(item.score)}점
                            </p>
                            <p className="text-sm text-outline flex items-center gap-1 justify-end">
                              <Trophy size={10} />
                              +{item.exp_earned} EXP
                            </p>
                          </div>
                        )}
                        <ChevronRight size={16} className="text-outline" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
