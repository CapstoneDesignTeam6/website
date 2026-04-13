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
  desc: string;
  color: string;
  isAboutAgora: boolean; // About Agora 슬라이드 여부를 나타내는 플래그
}

export const HomeView = ({ setTopic }: HomeViewProps) => {
  const navigate = useNavigate();
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]); // 슬라이드 데이터 상태
  const [cardDebates, setCardDebates] = useState<CardDebate[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

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
      desc: "읽는 뉴스에서 생각하는 뉴스로, AI 에이전트와 함께 깊이 있는 이해를 경험해보세요.",
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
            title: topicItem.title,
            desc: topicItem.description,
            // About Agora 슬라이드 다음 색상부터 순환 적용
            // slideColors[0]은 aboutAgoraSlide가 사용했으므로 index + 1부터 시작
            color: slideColors[(index + 1) % slideColors.length],
            isAboutAgora: false,
          }));
        setHeroSlides([...initialSlides, ...trendingSlides]);
      }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    if (heroSlides.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [heroSlides]); // heroSlides가 변경될 때마다 타이머 재설정

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 50;
    if (heroSlides.length === 0) return;

    if (info.offset.x < -threshold) {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    } else if (info.offset.x > threshold) {
      setCurrentSlide(
        (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 overflow-x-hidden">
      {" "}
      {/* 전체 컨테이너 패딩 조정 */}
      <div className="relative mb-6 md:mb-12">
        <motion.div
          className="flex cursor-grab active:cursor-grabbing"
          animate={{ x: `-${currentSlide * 100}%` }} // 슬라이드 애니메이션
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
        >
          {heroSlides.length > 0 ? (
            heroSlides.map((slide, i) => (
              <div // 슬라이드 패딩 조정 및 배경 그라데이션 클래스 수정
                key={slide.id || i} // id가 있으면 id 사용, 없으면 index 사용
                className={`relative bg-linear-to-br ${slide.color} rounded-3xl md:rounded-[2.5rem] p-4 md:p-8 w-full shrink-0 overflow-hidden`}
              >
                {slide.isAboutAgora ? ( // About Agora 슬라이드 내용
                  <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center relative z-10">
                    <div>
                      <span className="inline-block px-3 py-1 bg-primary text-white text-[10px] md:text-sm font-bold rounded-full mb-4 md:mb-6 tracking-widest uppercase">
                        {slide.tag}
                      </span>
                      <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold font-headline tracking-tight mb-6 md:mb-8 leading-tight">
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
                        {slide.desc}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                        {" "}
                        {/* 버튼 그룹 */}
                        {/* "자세히 보기" 버튼 삭제 */}
                        <button
                          onClick={() => navigate("/setup")}
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
                          src="https://picsum.photos/seed/agora-ai/1200/800"
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
                      <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold font-headline tracking-tight mb-6 md:mb-8 leading-tight">
                        {" "}
                        {/* 제목 크기 조정 */}
                        {slide.title}
                      </h1>
                      <p className="text-sm md:text-base text-outline mb-8 md:mb-10 leading-relaxed max-w-md">
                        {" "}
                        {/* 설명 크기 조정 */}
                        {slide.desc}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                        {" "}
                        {/* 버튼 그룹 */}
                        {/* "자세히 보기" 버튼 삭제 */}
                        <button
                          onClick={() => navigate("/setup")}
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
      <div className="flex justify-center gap-3 mb-12 md:mb-24">
        {heroSlides.map(
          (
            _,
            i, // heroSlides의 길이를 사용하여 인디케이터 렌더링
          ) => (
            <button
              key={heroSlides[i].id || i} // id가 있으면 id 사용, 없으면 index 사용
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all duration-300 ${currentSlide === i ? "w-4 bg-primary" : "w-2 bg-gray-300"}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ),
        )}
      </div>
      <div className="grid md:grid-cols-3 gap-6 md:gap-12 mb-16 md:mb-32">
        {[
          {
            icon: "🗞️",
            title: "뉴스 기반 토론, 정보에서 이해로",
            desc: "Agora의 모든 토론은 실제 뉴스에서 시작됩니다. 단순히 기사를 읽는 것이 아니라 맥락을 입체적으로 이해합니다.",
          },
          {
            icon: "🤖",
            title: "AI 에이전트 토론, 살아있는 다양성",
            desc: "다양한 입장을 대변하는 AI 에이전트들이 논리적인 토론을 펼칠니다. 편향되지 않은 균형 잡힌 시각을 제공합니다.",
          },
          {
            icon: "💬",
            title: "직접 참여, 생각이 깊어지는 경험",
            desc: "AI 에이전트와 직접 토론하며 자신의 논리를 다듬고 사고의 확장을 경험해보세요.",
          },
          {
            icon: "🗞️",
            title: "최종 리포트 제공",
            desc: "Agora의 모든 토론은 실제 뉴스에서 시작됩니다. 단순히 기사를 읽는 것이 아니라 맥락을 입체적으로 이해합니다.",
          },
          {
            icon: "🗞️",
            title: "자동 판정 시스템",
            desc: "Agora의 모든 토론은 실제 뉴스에서 시작됩니다. 단순히 기사를 읽는 것이 아니라 맥락을 입체적으로 이해합니다.",
          },
          {
            icon: "🗞️",
            title: "진행률 시각화",
            desc: "Agora의 모든 토론은 실제 뉴스에서 시작됩니다. 단순히 기사를 읽는 것이 아니라 맥락을 입체적으로 이해합니다.",
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
              {item.desc}
            </p>
          </div>
        ))}
      </div>
      {/*
      <section className="bg-surface-container rounded-3xl md:rounded-[2.5rem] p-8 md:p-16">
        <div className="grid lg:grid-cols-3 gap-8 md:gap-12">
          <div className="lg:col-span-1">
            <h2 className="text-2xl md:text-3xl font-extrabold font-headline mb-6 leading-tight">
              Agora 핵심 기능
            </h2>
            <button className="w-full flex items-center justify-between px-6 md:px-8 py-4 md:py-5 bg-primary text-white font-bold rounded-xl transition-all text-sm md:text-base">
              샘플 리포트 PDF 다운로드 <Download size={20} />
            </button>
          </div>
          
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <MessageSquare />,
                title: "AI 에이전트 토론",
                desc: "다양한 관점을 가진 AI 에이전트와 토론",
              },
              {
                icon: <User />,
                title: "사용자 참여형 토론",
                desc: "사용자가 직접 의견 입력 및 개입",
              },
              {
                icon: <TrendingUp />,
                title: "진행률 시각화",
                desc: "토론 진행률을 제공",
              },
              {
                icon: <Library />,
                title: "뉴스 기반 토론",
                desc: "뉴스 및 출처 기반 주장 제공",
              },
              {
                icon: <Gavel />,
                title: "자동 판정 시스템",
                desc: "토론 결과 및 논리 분석 제공",
              },
              {
                icon: <FileText />,
                title: "최종 리포트 제공",
                desc: "토론 결과 리포트 ",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-xl flex items-start gap-4 border border-gray-100"
              >
                <div className="p-2 bg-primary/5 text-primary rounded-lg">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-bold mb-1">{feature.title}</h4>
                  <p className="text-xs text-outline">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </section>
      */}
    </div>
  );
};
