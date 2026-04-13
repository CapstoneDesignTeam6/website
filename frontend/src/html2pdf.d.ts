// html2pdf.js 모듈에 대한 타입 선언 파일
// TypeScript가 html2pdf.js 라이브러리를 인식하고 타입 검사를 수행할 수 있도록 돕습니다.

declare module 'html2pdf.js' { // 모듈 경로를 실제 임포트 경로에 맞게 수정
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number]; // 페이지 여백 (top, left, bottom, right)
    filename?: string; // 저장될 파일 이름
    image?: { type: string; quality: number }; // 이미지 설정
    html2canvas?: { scale?: number; logging?: boolean; dpi?: number; letterRendering?: boolean }; // html2canvas 설정
    jsPDF?: { unit?: string; format?: string; orientation?: string }; // jsPDF 설정
    pagebreak?: { mode?: string | string[]; before?: string | string[]; after?: string | string[]; avoid?: string | string[] }; // 페이지 나누기 설정
  }

  interface Html2Pdf {
    set: (opt: Html2PdfOptions) => Html2Pdf; // 옵션 설정
    from: (element: HTMLElement | string) => Html2Pdf; // PDF로 변환할 요소 지정
    save: () => void; // PDF 저장
  }

  function html2pdf(): Html2Pdf; // html2pdf 함수 선언
  export default html2pdf;
}
