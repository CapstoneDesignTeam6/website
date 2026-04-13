import { Download, RefreshCw, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom"; // useNavigate 훅 임포트
import React, { useRef } from "react"; // useRef 임포트
import html2pdf from "html2pdf.js"; // html2pdf.js 임포트

interface ResultViewProps {
  topic: string;
  result: string;
}

export const ResultView = ({ topic, result }: ResultViewProps) => {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null); // PDF로 변환할 리포트 섹션에 대한 ref 생성
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false); // PDF 다운로드 중인지 여부를 나타내는 상태

  // PDF 다운로드 핸들러
  const handleDownloadPdf = async () => {
    // 비동기 함수로 변경
    if (reportRef.current) {
      setIsDownloadingPdf(true); // 다운로드 시작 시 로딩 상태 활성화
      const element = reportRef.current; // PDF로 변환할 HTML 요소

      // PDF 변환 전에 OKLCH 제거용 스타일 주입
      const style = document.createElement("style");
      style.innerHTML = `
      * {
        color: #000 !important;
        background-color: #fff !important;
        border-color: #e5e7eb !important;
      }
      
      /* theme 색상 반영 */
      .bg-primary { background-color: #004ac6 !important; }
      .bg-primary-container { background-color: #2563eb !important; }
      .bg-secondary { background-color: #bb0112 !important; }
      .bg-secondary-container { background-color: #e02928 !important; }
      .bg-surface { background-color: #f8f9fa !important; }
      .bg-surface-container { background-color: #f3f4f5 !important; }

      .text-primary { color: #004ac6 !important; }
      .text-secondary { color: #bb0112 !important; }
      .text-outline { color: #737686 !important; }

      .border-primary { border-color: #004ac6 !important; }
      .border-outline { border-color: #737686 !important; }

      /* Tailwind 기본 gray도 fallback */
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .border-gray-100 { border-color: #f3f4f6 !important; }

      /* 버튼/텍스트 가독성 보정 */
      .text-white { color: #ffffff !important; }
    `;
      document.head.appendChild(style);

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number], // 페이지 여백 (top, left, bottom, right)
        filename: `${topic}_토론_결과_리포트.pdf`, // 파일 이름
        image: { type: "jpeg", quality: 0.98 }, // 이미지 품질
        html2canvas: {
          scale: 2,
          logging: true,
          dpi: 192,
          letterRendering: true,
        }, // html2canvas 설정
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, // jsPDF 설정 (A4 세로 방향)
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }, // 페이지 나누기 설정 (컨텐츠가 잘리지 않도록)
      };

      try {
        // html2pdf 라이브러리를 사용하여 PDF 생성 및 저장
        await html2pdf().set(opt).from(element).save(); // await를 사용하여 비동기 처리
      } catch (error) {
        console.error("PDF 다운로드 중 오류 발생:", error); // 오류 발생 시 콘솔에 기록
        alert("PDF 다운로드 중 오류가 발생했습니다."); // 사용자에게 알림
      } finally {
        document.head.removeChild(style); // PDF 변환 후 스타일 제거                  
        setIsDownloadingPdf(false); // 다운로드 완료 또는 오류 발생 시 로딩 상태 비활성화
      }
    }
  };
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <section className="bg-white rounded-3xl md:rounded-4xl p-6 md:p-12 editorial-shadow mb-8 md:mb-12 relative overflow-hidden card-hover">
        <div className="absolute top-0 right-0 p-4 md:p-6">
          <span className="px-3 md:px-4 py-1 md:py-1.5 bg-primary-fixed text-primary text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full">
            Final Verdict
          </span>
        </div>
        <div className="max-w-3xl">
          <h1 className="text-2xl md:text-4xl font-black font-headline tracking-tight mb-4 md:mb-6">
            {topic}
          </h1>
          <p className="text-base md:text-lg text-outline mb-8 md:mb-10 leading-relaxed">
            AI 에이전트가 도출한 최종 결론입니다.
          </p>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12">
            <div className="w-full flex-1">
              <div className="flex justify-between mb-2 md:mb-3 text-xs md:text-sm font-bold">
                <span className="text-primary">찬성 68%</span>
                <span className="text-secondary">반대 32%</span>
              </div>
              <div className="h-3 md:h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-primary" style={{ width: "68%" }} />
                <div className="h-full bg-secondary" style={{ width: "32%" }} />
              </div>
            </div>
            <div className="bg-gray-50 p-4 md:p-6 rounded-2xl border border-gray-100 text-center w-full md:w-auto">
              <span className="text-[9px] md:text-[10px] text-outline font-bold uppercase block mb-1">
                Conflict Index
              </span>
              <span className="text-2xl md:text-3xl font-black text-orange-600">
                4.2
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PDF로 변환할 리포트 섹션을 ref로 감싸기 */}
      <div ref={reportRef}>
        <section className="bg-white p-8 md:p-16 editorial-shadow rounded-2xl border-t-8 border-primary card-hover">
          <div className="flex flex-col md:flex-row justify-between items-start border-b border-gray-100 pb-8 md:pb-10 mb-8 md:mb-12 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black font-headline mb-2">
                토론 분석 리포트
              </h2>
              <p className="text-[10px] md:text-xs text-outline">
                Agora Editorial Analysis #{new Date().getFullYear()}-
                {Math.floor(Math.random() * 9000 + 1000)}
              </p>
            </div>
            <div className="text-left md:text-right text-[10px] md:text-xs text-outline space-y-1">
              <p>발행일: {new Date().toLocaleDateString("ko-KR")}</p>
              <p>분석 대상: {topic}</p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-outline leading-relaxed whitespace-pre-wrap">
            {result || "리포트를 생성하는 중입니다..."}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 py-4 md:py-6 px-4 md:px-8 z-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-outline text-[9px] md:text-[10px] font-bold">
            <FileText size={14} /> 이 리포트는 토론 내용과 AI 판정 결과를
            바탕으로 자동 생성되었습니다.
          </div>
          <div className="flex gap-3 md:gap-4 w-full md:w-auto">
            <button
              onClick={() => navigate("/setup")}
              className="flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3 bg-gray-100 text-on-surface font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all text-xs md:text-sm"
            >
              <RefreshCw size={16} /> 다시 시작
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex-1 md:flex-none px-6 md:px-10 py-2.5 md:py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloadingPdf ? (
                "PDF 생성 중..."
              ) : (
                <>
                  <Download size={16} /> PDF 다운로드
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="h-24" />
    </div>
  );
};
