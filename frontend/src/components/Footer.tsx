export const Footer = () => (
  <footer className="bg-surface-container py-8 md:py-16 border-t border-gray-200">
    <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-start gap-8 md:gap-12">
      <div className="space-y-4">
        <span className="text-xl md:text-2xl font-black font-headline tracking-tighter">Agora</span>
        <p className="text-outline text-xs md:text-sm max-w-xs leading-relaxed">
          읽는 뉴스에서 생각하는 뉴스로, AI 에이전트와 함께 깊이 있는 이해를 경험해보세요.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-8 md:gap-16">
        <div className="space-y-4">
          <h4 className="font-bold text-xs md:text-sm text-on-surface">고객 지원</h4>
          <ul className="space-y-2 text-xs md:text-sm text-outline">
            <li><a href="#" className="hover:text-primary">자주 묻는 질문</a></li>
            <li><a href="#" className="hover:text-primary">문의하기</a></li>
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="font-bold text-xs md:text-sm text-on-surface">정책</h4>
          <ul className="space-y-2 text-xs md:text-sm text-outline">
            <li><a href="#" className="hover:text-primary">개인정보 처리방침</a></li>
            <li><a href="#" className="hover:text-primary">이용약관</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 md:mt-16 pt-6 md:pt-8 border-t border-gray-200 flex justify-between text-[10px] md:text-xs text-outline">
      <span>© 2026 Agora. All rights reserved.</span>
    </div>
  </footer>
);
