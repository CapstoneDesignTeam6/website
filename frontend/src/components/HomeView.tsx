import { useState, useEffect } from "react";
import {
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Download, // AboutView에서 사용되는 아이콘 추가
  User, // AboutView에서 사용되는 아이콘 추가
  Library, // AboutView에서 사용되는 아이콘 추가
  Gavel, // AboutView에서 사용되는 아이콘 추가
  FileText, // AboutView에서 사용되는 아이콘 추가
  // TrendingUp, MessageSquare는 이미 존재
  Brain,
  Loader2,
  ChevronLeft, // 추가: 왼쪽 화살표 아이콘
  ChevronRight, // 추가: 오른쪽 화살표 아이콘
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { MOCK_TOPICS } from "../mockData.ts"; // mockData.ts에서 MOCK_TOPICS 임포트
import { debateApi } from "../services/api";

interface HomeViewProps {
  setTopic: (t: string) => void;
}

// 백엔드에서 받아오는 트렌딩 토론 데이터 타입 정의
interface TrendingDebate {
  id: number;
  category: string;
  isHot: boolean;
  title: string; // 백엔드에서 topic 대신 title 사용
  description: string;
  participants: number; // 백엔드에서 viewCount 대신 participants 사용
}

// 카드 섹션에 사용될 데이터 타입 정의 (SearchView와 동일)
interface CardDebate {
  id: number;
  title: string;
  description: string;
  category: string;
  isHot: boolean;
  participants: number;
}

// 슬라이더에 사용될 데이터 타입 정의
interface HeroSlide {
  tag: string;
  id?: string; // 고유 식별자 추가 (옵션)
  title: string;
  description: string;
  color: string;
  isAboutAgora: boolean; // About Agora 슬라이드 여부를 나타내는 플래그
}

export const HomeView = ({ setTopic }: HomeViewProps) => {
  const navigate = useNavigate();
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]); // 슬라이드 데이터 상태
  const [cardDebates, setCardDebates] = useState<CardDebate[]>([]); // 이 상태는 현재 사용되지 않습니다.
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false); // 애니메이션 중인지 여부를 나타내는 상태

  // 샘플 PDF 다운로드 핸들러
  const handleDownloadSamplePdf = () => {
    const pdfUrl = '/sample_report.pdf'; // PDF 파일 경로(public 폴더)
    const link = document.createElement('a'); // <a> 태그 생성
    link.href = pdfUrl; // 링크 URL 설정
    link.download = 'Agora_Sample_Report.pdf'; // 다운로드될 파일 이름 설정
    link.click(); // 클릭 이벤트 발생시켜 다운로드 시작
  };
  useEffect(() => {
    // 슬라이더 색상 배열 (컴포넌트 내에서 한 번만 정의)
    const slideColors = [
      "from-[#dbe1ff] to-white",
      "from-[#ffe4e1] to-white",
      "from-[#e0f7fa] to-white",
    ];

    // About Agora 슬라이드 데이터 정의
    const aboutAgoraSlide: HeroSlide = {
      id: "about-agora", // 고유 ID
      tag: "About Agora",
      title: "나만의 AI 시사 메이트,\nAgora",
      description: "읽는 뉴스에서 생각하는 뉴스로, AI 에이전트와 함께 깊이 있는 이해를 경험해보세요.",
      color: slideColors[0], // 첫 번째 슬라이드 색상
      isAboutAgora: true, // About Agora 슬라이드임을 나타내는 플래그
    };
    const fetchTrending = async () => {
      let debatesToProcess: TrendingDebate[] = []; // 처리할 토론 데이터를 담을 변수

      try {
        const response = await debateApi.getTrending();
        console.log("Trending API Response:", response);

        // API 응답이 유효하고 데이터가 있을 경우 사용
        if (Array.isArray(response) && response.length > 0) {
          debatesToProcess = response;
        } else {
          // API 응답이 없거나 비어있을 경우 mock 데이터 사용
          console.warn(
            "API 응답이 비어있거나 예상치 못한 형식입니다. Mock 데이터를 사용합니다.",
            response,
          );
          debatesToProcess = MOCK_TOPICS;
        }
      } catch (error) {
        // API 호출 실패 시 mock 데이터 사용
        console.error(
          "트렌딩 토론을 가져오는 데 실패했습니다. MOCK_TOPICS를 사용합니다:",
          error,
        );
        debatesToProcess = MOCK_TOPICS; // MOCK_TOPICS 사용
      } finally {
        // About Agora 슬라이드를 첫 번째로 추가
        const initialSlides: HeroSlide[] = [aboutAgoraSlide];

        // debatesToProcess에서 최대 2개의 트렌딩 토론을 가져와 슬라이더 데이터로 매핑
        // (총 3개의 슬라이드를 유지하기 위해 aboutAgoraSlide 1개 + 트렌딩 2개)
        const trendingSlides: HeroSlide[] = debatesToProcess
          .slice(0, 2)
          .map((topicItem, index) => ({
            id: `trending-${topicItem.id}`, // 고유 ID 추가
            tag: topicItem.category,
            title: topicItem.title, // 토론 제목
            description: topicItem.description.replace(/^\[.*?\]\s*/, ''), // [카테고리] 문구 제거
            // About Agora 슬라이드 다음 색상부터 순환 적용
            // slideColors[0]은 aboutAgoraSlide가 사용했으므로 index + 1부터 시작
            color: slideColors[(index + 1) % slideColors.length],
            isAboutAgora: false,
          }));

        // baseSlides를 여기서 정의하여 스코프 문제를 해결
        const baseSlides = [...initialSlides, ...trendingSlides];

        if (baseSlides.length > 1) {
          // 클론 슬라이드 추가: 마지막 슬라이드를 맨 앞에, 첫 번째 슬라이드를 맨 뒤에 추가하여 무한 루프 효과
          const clonedSlides = [baseSlides[baseSlides.length - 1], ...baseSlides, baseSlides[0]];
          setHeroSlides(clonedSlides);
          setCurrentSlide(1); // 실제 첫 번째 슬라이드 (클론 다음)로 시작
        } else {
          setHeroSlides(baseSlides);
          setCurrentSlide(0);
        }
      }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    // 자동 슬라이드 타이머
    if (heroSlides.length > 1 && !isAnimating) { // 실제 슬라이드가 1개 초과이고 애니메이션 중이 아닐 때만 자동 슬라이드
      const timer = setInterval(() => {
        setCurrentSlide((prev) => prev + 1);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [heroSlides, isAnimating]); // heroSlides 또는 isAnimating이 변경될 때마다 타이머 재설정

  // 애니메이션 완료 핸들러 (무한 루프 처리)
  const handleAnimationComplete = () => {
    setIsAnimating(false); // 애니메이션 완료
    if (currentSlide === heroSlides.length - 1) { // 마지막 클론 슬라이드에 도달하면
      setCurrentSlide(1); // 실제 첫 번째 슬라이드로 즉시 이동 (애니메이션 없이)
    } else if (currentSlide === 0) { // 첫 번째 클론 슬라이드에 도달하면
      setCurrentSlide(heroSlides.length - 2); // 실제 마지막 슬라이드로 즉시 이동 (애니메이션 없이)
    }
  };

  // 드래그 종료 핸들러
  const handleDragEnd = (_: any, info: any) => {
    const threshold = 50;
    if (heroSlides.length <= 1 || isAnimating) return; // 실제 슬라이드가 1개 이하이거나 애니메이션 중이면 무시

    setIsAnimating(true); // 드래그 후 애니메이션 시작

    if (info.offset.x < -threshold) {
      // 왼쪽으로 드래그 (다음 슬라이드)
      setCurrentSlide((prev) => prev + 1);
    } else if (info.offset.x > threshold) {
      // 오른쪽으로 드래그 (이전 슬라이드)
      setCurrentSlide((prev) => prev - 1);
    } else {
      setIsAnimating(false); // 드래그했지만 슬라이드 변경 없으면 애니메이션 종료
    }
  };

  // 다음 슬라이드로 이동
  const goToNextSlide = () => {
    if (heroSlides.length <= 1 || isAnimating) return; // 실제 슬라이드가 1개 이하이거나 애니메이션 중이면 무시
    setIsAnimating(true); // 애니메이션 시작
    setCurrentSlide((prev) => prev + 1);
  };

  // 이전 슬라이드로 이동
  const goToPrevSlide = () => {
    if (heroSlides.length <= 1 || isAnimating) return; // 실제 슬라이드가 1개 이하이거나 애니메이션 중이면 무시
    setIsAnimating(true); // 애니메이션 시작
    setCurrentSlide((prev) => prev - 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pt-0 pb-6 md:pb-10 overflow-x-hidden">
      {/* 전체 컨테이너 패딩 조정 */}
      <div className="relative mb-6 md:mb-12 min-h-125 flex items-center w-full"> {/* 배너 높이 조정 및 내용 수직 중앙 정렬 */}
        <motion.div
          className="flex cursor-grab active:cursor-grabbing w-full" // motion.div가 부모의 전체 너비를 차지하도록 w-full 추가
          animate={{ x: `-${currentSlide * 100}%` }} // 슬라이드 애니메이션
          transition={isAnimating ? { type: "spring", damping: 25, stiffness: 120 } : { duration: 0 }} // 애니메이션 중일 때만 spring, 아니면 즉시 이동
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          onAnimationComplete={handleAnimationComplete} // 애니메이션 완료 시 호출
        >
          {heroSlides.length > 0 ? (
            heroSlides.map((slide, i) => (
              <div // 슬라이드 패딩 조정 및 배경 그라데이션 클래스 수정, 내용 중앙 정렬
                key={slide.id || i} // id가 있으면 id 사용, 없으면 index 사용
                className={`relative bg-linear-to-br ${slide.color} rounded-3xl md:rounded-[2.5rem] p-4 md:p-8 w-full shrink-0 overflow-hidden`}
              >
                {slide.isAboutAgora ? ( // About Agora 슬라이드 내용
                  <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center relative z-10">
                    <div>
                      {/* bg-primary 제거 */}
                      <span className="inline-block px-3 py-1  text-white text-[10px] md:text-sm font-bold rounded-full mb-4 md:mb-6 tracking-widest uppercase">
                        {/* {slide.tag} */}
                      </span>
                      <h1 className="text-xl md:text-3xl lg:text-4xl font-extrabold font-headline tracking-tight mb-6 md:mb-8 leading-tight">
                        {" "}
                        {/* 제목 크기 조정 */}
                        {slide.title.split("\n").map(
                          (
                            line,
                            idx, // 줄바꿈 처리
                          ) => (
                            <span key={idx}>
                              {line}
                              <br />
                            </span>
                          ),
                        )}
                      </h1>
                      <p className="text-base md:text-lg text-outline mb-8 md:mb-10 leading-relaxed max-w-xl">
                        {" "}
                        {/* 설명 크기 조정 */}
                        {slide.description}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                        {" "}
                        {/* 버튼 그룹 */}
                        {/* "자세히 보기" 버튼 삭제 */}
                        {/* 토론 참여하기 버튼: About Agora 슬라이드이므로 주제를 초기화하고 토론 시작 화면으로 이동 */}
                        <button
                          onClick={() => {
                            setTopic(""); // 주제 초기화
                            navigate("/setup");
                          }}
                          className="px-6 md:px-8 py-3 md:py-4 bg-primary text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm md:text-base"
                        >
                          토론 참여하기 {/* 토론 참여하기 버튼만 남김 */}
                        </button>
                      </div>{" "}
                      {/* 버튼 그룹 끝 */}
                    </div>
                    <div className="relative">
                      <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                        <img
                          src="/about_image.jpg"
                          alt="AI Analysis"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/10 blur-[100px] -z-10" />
                    </div>
                  </div>
                ) : (
                  // 기존 트렌딩 토론 슬라이드 내용
                  <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center relative z-10">
                    <div>
                      <span className="inline-block px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full mb-4 md:mb-6 tracking-widest uppercase">
                        {slide.tag}
                      </span>
                      <h1 className="text-xl md:text-3xl lg:text-4xl font-extrabold font-headline tracking-tight mb-6 md:mb-8 leading-tight">
                        {" "}
                        {/* 제목 크기 조정 */}
                        {slide.title}
                      </h1>
                      <p className="text-sm md:text-base text-outline mb-8 md:mb-10 leading-relaxed max-w-md">
                        {" "}
                        {/* 설명 크기 조정 */}
                        {slide.description}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                        {" "}
                        {/* 버튼 그룹 */}
                        {/* "자세히 보기" 버튼 삭제 */}
                        {/* 토론 참여하기 버튼: 트렌딩 토론 슬라이드이므로 해당 슬라이드의 제목을 주제로 설정하고 토론 시작 화면으로 이동 */}
                        <button
                          onClick={() => {
                            setTopic(slide.title); // 슬라이드의 제목을 주제로 설정
                            navigate("/setup");
                          }}
                          className="px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur border border-gray-200 text-on-surface font-bold rounded-xl hover:bg-white transition-all text-sm md:text-base pointer-events-auto"
                        >
                          토론 참여하기 {/* 토론 참여하기 버튼만 남김 */}
                        </button>
                      </div>{" "}
                      {/* 버튼 그룹 끝 */}
                    </div>
                    <div className="hidden lg:block relative">
                      <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-2xl rotate-3">
                        <div className="flex justify-between items-start mb-8">
                          <div className="w-12 h-12 bg-primary-fixed rounded-xl flex items-center justify-center text-primary">
                            <Brain size={24} />
                          </div>
                          <span className="text-[10px] font-bold text-outline uppercase tracking-widest">
                            Live Debate
                          </span>
                        </div>
                        <div className="space-y-4 mb-12">
                          <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
                          <div className="h-3 w-full bg-gray-100 rounded-full" />
                          <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map((j) => (
                              <div
                                key={j}
                                className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white"
                              />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-primary">
                            2.4k 참여 중
                          </span>
                        </div>
                      </div>
                      <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl -rotate-6 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-50 rounded-lg text-secondary">
                            <TrendingUp size={16} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-outline uppercase">
                              Conflict Index
                            </p>
                            <p className="text-lg font-black leading-none">
                              High (82%)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="w-full h-64 flex items-center justify-center text-outline">
              <Loader2 className="animate-spin mr-2" size={20} /> 로딩 중...
            </div>
          )}
        </motion.div>
      </div>

      {/* 슬라이드 인디케이터 (배너 안으로 이동) */}
      {heroSlides.length > 3 && ( // 실제 슬라이드 개수 (클론 제외)가 1개 초과일 때만 인디케이터 표시 (클론 포함 3개 이상)
        <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center gap-3">
          {heroSlides.slice(1, heroSlides.length - 1).map((_, i) => { 
            // 실제 슬라이드 개수 (클론 제외)
            const actualSlideCount = heroSlides.length - 2;
            // 현재 활성화되어야 할 인디케이터의 실제 슬라이드 인덱스 계산
            let activeIndicatorIndex = -1;
            if (currentSlide >= 1 && currentSlide <= actualSlideCount) {
              activeIndicatorIndex = currentSlide - 1;
            } else if (currentSlide === 0) { // 첫 번째 클론 슬라이드 (실제 마지막 슬라이드)
              activeIndicatorIndex = actualSlideCount - 1;
            } else if (currentSlide === heroSlides.length - 1) { // 마지막 클론 슬라이드 (실제 첫 번째 슬라이드)
              activeIndicatorIndex = 0;
            }

            return (
            <button
              key={heroSlides[i + 1].id || i + 1} // 실제 슬라이드의 id 또는 인덱스 사용
              onClick={() => {
                if (isAnimating) return; // 애니메이션 중이면 클릭 무시
                setIsAnimating(true); // 애니메이션 시작
                setCurrentSlide(i + 1); // 실제 슬라이드 인덱스로 이동
              }}
              className={`h-2 rounded-full transition-all duration-300 ${i === activeIndicatorIndex ? "w-4 bg-primary" : "w-2 bg-gray-300"}`}
              aria-label={`Go to slide ${i + 1}`} // 접근성을 위한 라벨
            />
            );
            })}
        </div>
      )}

      {/* 이전/다음 슬라이드 버튼 */}
      {heroSlides.length > 3 && ( // 실제 슬라이드 개수 (클론 제외)가 1개 초과일 때만 버튼 표시 (클론 포함 3개 이상)
        <>
          <button
            onClick={goToPrevSlide}
            className="absolute top-1/2 -translate-y-1/2 left-4 md:left-8 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:scale-105 transition-transform hidden md:block" // 모바일에서는 숨김
            aria-label="Previous slide"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={goToNextSlide}
            className="absolute top-1/2 -translate-y-1/2 right-4 md:right-8 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:scale-105 transition-transform hidden md:block" // 모바일에서는 숨김
            aria-label="Next slide"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="grid md:grid-cols-3 gap-6 md:gap-12 mb-16 md:mb-32">
        {[
          {
            icon: "📰",
            title: "뉴스 기반 토론, 정보에서 이해로",
            description: "Agora의 모든 토론은 실제 뉴스에서 시작됩니다. 단순히 기사를 읽는 것이 아니라 주제를 입체적으로 이해할 수 있게 도와줍니다.",
          },
          {
            icon: "🤖",
            title: "AI 에이전트 토론, 살아있는 다양성",
            description: "다양한 입장을 대변하는 AI 에이전트들이 논리적인 토론을 펼칩니다. 편향되지 않은 균형 잡힌 시각을 제공합니다.",
          },
          {
            icon: "🗣️",
            title: "직접 참여, 생각이 깊어지는 경험",
            description: "토론에 참여하며 자신의 논리를 다듬고 사고의 확장을 경험해보세요.",
          },
          {
            icon: "🪄",
            title: "토론 보조 에이전트",
            description: "토론 중 막히는 부분이 있거나 도움이 필요할 때, 보조 에이전트가 논리적인 근거나 반박 전략을 제시하여 토론을 풍성하게 돕습니다.",
          },
          {
            icon: "⚖️",
            title: "자동 판정 시스템",
            description: "AI 에이전트가 토론 참여자들의 논리력, 근거 활용 등을 분석하여 객관적인 평가와 피드백을 제공합니다.",
          },{
            icon: "📋",
            title: "최종 리포트 제공",
            description: "토론 종료 후, AI 분석 결과가 담긴 상세 리포트를 제공하여 이해도를 높입니다. 샘플 리포트를 다운로드하여 확인해보세요.",
            hasDownloadButton: true, // 다운로드 버튼이 필요한 항목임을 표시
          },
        ].map((item, i) => (
          <div
            key={i}
            className="p-6 md:p-8 bg-white border border-gray-100 rounded-2xl group"
          >
            <div className="text-3xl md:text-4xl mb-4 md:mb-6">{item.icon}</div>
            <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">
              {item.title}
            </h3>
            <p className="text-xs md:text-sm text-outline leading-relaxed">
              {item.description}
            </p>
            {item.hasDownloadButton && ( // hasDownloadButton이 true일 때만 버튼 렌더링
              <button
                onClick={handleDownloadSamplePdf}
                className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors text-sm"
              >
                <Download size={16} /> 샘플 리포트 PDF 다운로드
              </button>
            )}
          </div>
        ))
      }
      </div>
    </div>
  );
};
