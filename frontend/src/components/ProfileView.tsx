import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, MessageSquare, Calendar, Search, ChevronDown, Layers, ChevronLeft, Bot, Loader2, FileText, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserData, DiscussionHistoryItem, DiscussionSummaryResponse } from '../types';
import { userApi } from '../services/api';
import { MOCK_HISTORY, MOCK_TURNS, MOCK_REPORT } from '../mockData';
import html2pdf from 'html2pdf.js';

const USE_MOCK = false; // 백엔드 엔드포인트 연결 후 false로 변경

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface ProfileViewProps {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userData: UserData | null;
  setUserData: (d: UserData) => void;
}

type Tab = 'profile' | 'history';
type ViewMode = 'list' | 'grouped';

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

interface HistoryCardProps {
  item: DiscussionHistoryItem;
  formatDate: (d: string) => string;
  inGroup?: boolean;
  onClick: () => void;
}

const HistoryCard = ({ item, formatDate, inGroup, onClick }: HistoryCardProps) => (
  <button
    onClick={onClick}
    className={`history-card w-full text-left flex items-start justify-between gap-4 transition-shadow ${
      inGroup
        ? 'px-5 py-4 hover:shadow-sm'
        : 'p-5 md:p-6 bg-white rounded-2xl editorial-shadow border border-gray-50 card-hover'
    }`}
  >
    <div className="flex-1 min-w-0">
      {!inGroup && (
        <p className="font-bold text-on-surface text-base md:text-lg truncate">{item.topic}</p>
      )}
      <div className={`flex items-center gap-3 text-sm text-outline ${inGroup ? '' : 'mt-2'}`}>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {formatDate(item.created_at)}
        </span>
        <span className={`font-bold ${item.has_report ? 'text-emerald-600' : 'text-yellow-600'}`}>
          {item.has_report ? '완료' : '진행 중'}
        </span>
      </div>
    </div>
  </button>
);

interface DetailViewProps {
  item: DiscussionHistoryItem;
  turns: { role: 'user' | 'ai'; content: string; turn: number }[];
  turnsLoading: boolean;
  report: DiscussionSummaryResponse | null;
  reportLoading: boolean;
  formatDate: (d: string) => string;
  getScoreColor: (s: number) => string;
  onBack: () => void;
}

function DetailView({ item, turns, turnsLoading, report, reportLoading, formatDate, getScoreColor, onBack }: DetailViewProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsPdfLoading(true);
    const style = document.createElement('style');
    style.innerHTML = `
      * { color: #000 !important; background-color: #fff !important; border-color: #e5e7eb !important; }
      .text-primary { color: #004ac6 !important; }
      .text-secondary { color: #bb0112 !important; }
      .text-outline { color: #737686 !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .border-gray-100 { border-color: #f3f4f6 !important; }
    `;
    document.head.appendChild(style);
    try {
      await html2pdf().set({
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${item.topic}_토론_결과_리포트.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }).from(reportRef.current).save();
    } catch {
      alert('PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      document.head.removeChild(style);
      setIsPdfLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-outline hover:text-on-surface mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        목록으로
      </button>

      {/* PDF 변환 대상 영역 */}
      <div ref={reportRef}>
        {/* 요약 카드 */}
        <div className="bg-white rounded-2xl p-5 md:p-6 editorial-shadow border border-gray-50 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface text-base md:text-lg mb-2">{item.topic}</p>
              <div className="flex items-center gap-3 text-sm text-outline">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(item.created_at)}
                </span>
                <span className={`font-bold ${item.has_report ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {item.has_report ? '완료' : '진행 중'}
                </span>
              </div>
              {item.has_report && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-xs text-outline mb-0.5">실시간 평가 평균 점수</p>
                  <p className={`text-2xl font-extrabold ${report?.score_avg != null ? getScoreColor(report.score_avg) : 'text-primary'}`}>
                    {report?.score_avg != null ? `${report.score_avg} / 25` : reportLoading ? '...' : '-'}
                  </p>
                </div>
              )}
            </div>
            {report && (
              <button
                onClick={handleDownloadPdf}
                disabled={isPdfLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isPdfLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                {isPdfLoading ? 'PDF 생성 중...' : 'PDF 저장'}
              </button>
            )}
          </div>
        </div>

        {/* 채팅 기록 */}
        <div className="bg-white rounded-2xl editorial-shadow border border-gray-50 overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <MessageSquare size={15} className="text-outline" />
            <span className="font-bold text-sm text-on-surface">채팅 기록</span>
          </div>

          {turnsLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 size={20} className="animate-spin text-outline" />
            </div>
          ) : turns.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-outline">
              채팅 기록이 없습니다.
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3 max-h-130 overflow-y-auto">
              {turns
                .filter((msg) => !(msg.role === 'user' && msg.turn === 0))
                .map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
                      {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>
                    <div
                      className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-50 border-2 border-primary text-gray-800'
                          : 'bg-red-50 border-2 border-secondary text-gray-800'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 결과 보고서 */}
        {reportLoading ? (
          <div className="bg-white rounded-2xl editorial-shadow border border-gray-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <FileText size={15} className="text-outline" />
              <span className="font-bold text-sm text-on-surface">결과 보고서</span>
            </div>
            <div className="flex justify-center items-center py-12">
              <Loader2 size={20} className="animate-spin text-outline" />
            </div>
          </div>
        ) : report ? (
          <div className="bg-white rounded-2xl editorial-shadow border border-gray-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <FileText size={15} className="text-outline" />
              <span className="font-bold text-sm text-on-surface">결과 보고서</span>
            </div>
            <div className="px-5 py-5 space-y-6 text-sm leading-relaxed">

              {/* 메타 점수 카드 */}
              {(report.pre_quiz_score != null || report.post_quiz_score != null || report.score_avg != null) && (
                <div className="grid grid-cols-3 gap-2">
                  {report.pre_quiz_score != null && (
                    <div className="bg-primary/5 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs font-bold text-outline">사전 퀴즈</p>
                      <p className="text-base font-extrabold text-primary">
                        {report.pre_quiz_score} / {report.pre_quiz_count ?? '?'}
                      </p>
                    </div>
                  )}
                  {report.post_quiz_score != null && (
                    <div className="bg-primary/5 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs font-bold text-outline">사후 퀴즈</p>
                      <p className="text-base font-extrabold text-primary">
                        {report.post_quiz_score} / {report.post_quiz_count ?? '?'}
                      </p>
                    </div>
                  )}
                  {report.score_avg != null && (
                    <div className="bg-secondary/5 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs font-bold text-outline">평가 점수</p>
                      <p className="text-base font-extrabold text-secondary">{report.score_avg} / 25</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="font-bold text-primary mb-2">토론 요약</p>
                <div className="text-on-surface whitespace-pre-wrap space-y-1">
                  {report.summary.split('\n').map((line, i) => {
                    if (/^\[.*찬성.*\]/.test(line))
                      return <p key={i} className="font-bold text-primary">{line}</p>;
                    if (/^\[.*반대.*\]/.test(line))
                      return <p key={i} className="font-bold text-secondary">{line}</p>;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>

              <hr className="border-gray-100" />

              <div>
                <p className="font-bold text-primary mb-2">주요 쟁점</p>
                <p className="text-on-surface whitespace-pre-wrap">{report.issues}</p>
              </div>

              <hr className="border-gray-100" />

              <div>
                <p className="font-bold text-primary mb-2">논리 피드백</p>
                <p className="text-on-surface whitespace-pre-wrap">{report.logic_feedback}</p>
              </div>

              {/* 퀴즈 결과 */}
              {(report.pre_quiz_correct !== undefined || report.post_quiz_correct !== undefined) && (
                <>
                  <hr className="border-gray-100" />
                  <div>
                    <p className="font-bold text-primary mb-3">퀴즈 결과</p>
                    <div className="space-y-3">
                      {report.pre_quiz_correct !== undefined && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="font-bold mb-1 text-primary">
                            사전 퀴즈&nbsp;
                            <span className={report.pre_quiz_correct ? 'text-emerald-600' : 'text-secondary'}>
                              {report.pre_quiz_correct ? '✅ 정답' : '❌ 오답'}
                            </span>
                          </p>
                          {report.pre_quiz_explanation && (
                            <p className="text-on-surface whitespace-pre-wrap text-xs leading-relaxed">{report.pre_quiz_explanation}</p>
                          )}
                        </div>
                      )}
                      {report.post_quiz_correct !== undefined && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="font-bold mb-1 text-primary">
                            사후 퀴즈&nbsp;
                            <span className={report.post_quiz_correct ? 'text-emerald-600' : 'text-secondary'}>
                              {report.post_quiz_correct ? '✅ 정답' : '❌ 오답'}
                            </span>
                          </p>
                          {report.post_quiz_explanation && (
                            <p className="text-on-surface whitespace-pre-wrap text-xs leading-relaxed">{report.post_quiz_explanation}</p>
                          )}
                        </div>
                      )}
                      {report.quiz_comparison && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="font-bold mb-1 text-primary">전후 비교 분석</p>
                          <p className="text-on-surface whitespace-pre-wrap text-xs leading-relaxed">{report.quiz_comparison}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {report.extra_info && (
                <>
                  <hr className="border-gray-100" />
                  <div>
                    <p className="font-bold text-primary mb-2">추가 사례·정보</p>
                    <p className="text-on-surface whitespace-pre-wrap">{report.extra_info}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : item.has_report ? (
          <div className="bg-white rounded-2xl editorial-shadow border border-gray-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <FileText size={15} className="text-outline" />
              <span className="font-bold text-sm text-on-surface">결과 보고서</span>
            </div>
            <div className="px-5 py-10 text-center text-sm text-outline">
              결과 보고서를 불러올 수 없습니다.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export const ProfileView = ({ isLoggedIn, userData, setUserData }: ProfileViewProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL 쿼리 파라미터로 탭/상세보기 상태 동기화 → 브라우저 뒤로가기 지원
  const activeTab = (searchParams.get('tab') as Tab) || 'profile';
  const selectedItemId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  const setActiveTab = (tab: Tab) => {
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  const [formData, setFormData] = useState({
    nickname: userData?.nickname || '',
    email: userData?.email || '',
    password: '',
  });
  const [history, setHistory] = useState<DiscussionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [turns, setTurns] = useState<{ role: 'user' | 'ai'; content: string; turn: number }[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [report, setReport] = useState<DiscussionSummaryResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const selectedItem = useMemo(
    () => history.find((item) => item.id === selectedItemId) ?? null,
    [history, selectedItemId],
  );

  // 히스토리 목록 로드
  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryLoading(true);
    if (USE_MOCK) {
      setTimeout(() => { setHistory(MOCK_HISTORY); setHistoryLoading(false); }, 400);
    } else {
      userApi.getDiscussionHistory()
        .then(setHistory)
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab]);

  // 상세 채팅 기록 로드
  useEffect(() => {
    if (!selectedItemId) { setTurns([]); return; }
    setTurnsLoading(true);
    if (USE_MOCK) {
      setTimeout(() => { setTurns(MOCK_TURNS[selectedItemId] ?? []); setTurnsLoading(false); }, 300);
    } else {
      userApi.getDiscussionTurns(selectedItemId)
        .then(setTurns)
        .finally(() => setTurnsLoading(false));
    }
  }, [selectedItemId]);

  // 결과 보고서 로드
  useEffect(() => {
    if (!selectedItemId) { setReport(null); return; }
    setReportLoading(true);
    if (USE_MOCK) {
      setTimeout(() => { setReport(MOCK_REPORT[selectedItemId] ?? null); setReportLoading(false); }, 300);
    } else {
      userApi.getDiscussionReport(selectedItemId)
        .then(setReport)
        .finally(() => setReportLoading(false));
    }
  }, [selectedItemId]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => item.topic.toLowerCase().includes(q));
  }, [history, searchQuery]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, DiscussionHistoryItem[]> = {};
    for (const item of filteredHistory) {
      if (!groups[item.topic]) groups[item.topic] = [];
      groups[item.topic].push(item);
    }
    return groups;
  }, [filteredHistory]);

  const toggleGroup = (topic: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const handleSelectItem = (item: DiscussionHistoryItem) => {
    setSearchParams({ tab: 'history', id: String(item.id) });
    setTurns([]);
    setReport(null);
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setUserData({ ...userData!, nickname: formData.nickname, email: formData.email });
    alert('회원 정보가 수정되었습니다.');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 20) return 'text-primary';
    if (score >= 15) return 'text-outline';
    return 'text-secondary';
  };


  if (!isLoggedIn) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 md:mb-16">
          <h1 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tight mb-3 md:mb-4 text-left">
            마이페이지
          </h1>
          <p className="text-base md:text-lg text-outline text-left">
            Agora에서 당신의 활동 정보를 관리하세요.
          </p>
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
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                />
                <p className="text-sm text-outline ml-1">토론 시 표시되는 이름입니다.</p>
              </div>
              <div className="space-y-2 md:space-y-3">
                <label className="text-sm md:text-base font-bold text-on-surface ml-1">이메일</label>
                <input
                  type="email"
                  required
                  className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:space-y-3">
                <label className="text-sm md:text-base font-bold text-on-surface ml-1">비밀번호 변경</label>
                <input
                  type="password"
                  className="w-full bg-surface-container p-4 md:p-5 rounded-2xl border-none focus:ring-2 focus:ring-primary transition-all text-base md:text-lg"
                  placeholder="새로운 비밀번호를 입력하세요 (입력 시 변경)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
            ) : selectedItem ? (
              <DetailView
                item={selectedItem}
                turns={turns}
                turnsLoading={turnsLoading}
                report={report}
                reportLoading={reportLoading}
                formatDate={formatDate}
                getScoreColor={getScoreColor}
                onBack={() => setSearchParams({ tab: 'history' })}
              />
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
              <>
                {/* 검색 + 뷰 모드 토글 */}
                <div className="flex gap-3 mb-5">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                    <input
                      type="text"
                      placeholder="주제 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white pl-10 pr-4 py-3 rounded-2xl border border-gray-100 editorial-shadow text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={() => setViewMode(viewMode === 'list' ? 'grouped' : 'list')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl border font-bold text-sm transition-all ${
                      viewMode === 'grouped'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-outline border-gray-100 editorial-shadow hover:text-on-surface'
                    }`}
                  >
                    <Layers size={15} />
                    주제별
                  </button>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 editorial-shadow border border-gray-50 text-center">
                    <p className="text-outline font-medium">검색 결과가 없습니다.</p>
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="space-y-3">
                    {filteredHistory.map((item) => (
                      <HistoryCard
                        key={item.id}
                        item={item}
                        formatDate={formatDate}
                        onClick={() => handleSelectItem(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedHistory).map(([topic, items]) => {
                      const isCollapsed = collapsedGroups.has(topic);
                      return (
                        <div key={topic} className="bg-white rounded-2xl editorial-shadow border border-gray-50 overflow-hidden">
                          <button
                            onClick={() => toggleGroup(topic)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-bold text-on-surface text-base truncate">{topic}</span>
                              <span className="shrink-0 text-xs font-bold text-outline bg-surface-container px-2 py-0.5 rounded-full">
                                {items.length}회
                              </span>
                            </div>
                            <ChevronDown
                              size={16}
                              className={`text-outline shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                            />
                          </button>
                          {!isCollapsed && (
                            <div className="border-t border-gray-50 divide-y divide-gray-50">
                              {items.map((item) => (
                                <HistoryCard
                                  key={item.id}
                                  item={item}
                                  formatDate={formatDate}
                                  inGroup
                                  onClick={() => handleSelectItem(item)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
