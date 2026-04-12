import { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  User, 
  Settings, 
  Power,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { userApi } from '../services/api';

const logo = '/src/assets/logo.png';

interface NavbarProps {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
}

export const Navbar = ({ isLoggedIn, setIsLoggedIn }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPath = location.pathname;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserClick = () => {
    if (isLoggedIn) {
      setIsDropdownOpen(!isDropdownOpen);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    userApi.logout();
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const handleProfileUpdate = () => {
    navigate('/profile');
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navigateTo = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-6 md:gap-12">
          <button onClick={() => navigateTo('/')} className="flex items-center gap-2 md:gap-3 text-xl md:text-2xl font-black tracking-tighter font-headline cursor-pointer group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl overflow-hidden group-hover:scale-110 transition-transform">
              <img 
                src={logo} 
                alt="Agora Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span>Agora</span>
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <button onClick={() => navigateTo('/about')} className={`${isActive('/about') ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>소개</button>
            <button onClick={() => navigateTo('/search')} className={`${isActive('/search') ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>주제 탐색</button>
            <button onClick={() => navigateTo('/setup')} className={`${isActive('/debate') || isActive('/setup') ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>토론</button>
            <button onClick={() => navigateTo('/result')} className={`${isActive('/result') ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>결과</button>
            <button onClick={() => navigateTo('/faq')} className={`${isActive('/faq') ? 'text-primary border-b-2 border-primary' : 'text-outline'} pb-1 transition-colors`}>자주 묻는 질문</button>
          </nav>
        </div>
        
        <div className="hidden md:flex items-center gap-4 relative" ref={dropdownRef}>
          <button className="p-2 text-outline hover:bg-gray-100 rounded-full transition-colors"><Bell size={20} /></button>
          <button 
            onClick={handleUserClick} 
            className={`p-2 rounded-full transition-colors ${isActive('/profile') || isActive('/login') || isActive('/signup') ? 'bg-primary/10 text-primary' : 'text-outline hover:bg-gray-100'}`}
          >
            <User size={20} />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 overflow-hidden"
              >
                <button 
                  onClick={handleProfileUpdate}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-on-surface hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <Settings size={16} className="text-outline" />
                  회원 정보
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-secondary hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <Power size={16} />
                  로그아웃
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="md:hidden flex items-center">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-outline hover:bg-gray-100 rounded-full transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-60 md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-70 bg-white z-70 shadow-2xl md:hidden flex flex-col"
              style={{ backgroundColor: 'white' }}
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <span className="text-xl font-black font-headline tracking-tighter">Agora</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-outline hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {!isLoggedIn ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => navigateTo('/login')}
                      className="py-3 px-4 bg-primary/10 text-primary font-bold rounded-xl text-sm"
                    >
                      로그인
                    </button>
                    <button 
                      onClick={() => navigateTo('/signup')}
                      className="py-3 px-4 bg-primary text-white font-bold rounded-xl text-sm shadow-lg shadow-primary/20"
                    >
                      회원가입
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-surface-container rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                      <User size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm truncate">사용자 님</p>
                      <button onClick={handleProfileUpdate} className="text-xs text-primary font-medium">회원 정보 관리</button>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-secondary hover:bg-red-50 rounded-lg transition-colors">
                      <Power size={18} />
                    </button>
                  </div>
                )}
              </div>

              <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto">
                {[
                  { path: '/about', label: '소개' },
                  { path: '/search', label: '주제 탐색' },
                  { path: '/setup', label: '토론' },
                  { path: '/result', label: '결과' },
                  { path: '/faq', label: '자주 묻는 질문' },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${
                      isActive(item.path) || (item.path === '/setup' && isActive('/debate'))
                        ? 'bg-primary text-white'
                        : 'text-outline hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};
