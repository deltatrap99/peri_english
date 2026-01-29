
import React from 'react';
import { AppView, Language, Theme } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  setView: (view: AppView) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  setView, 
  language, 
  setLanguage, 
  theme, 
  setTheme 
}) => {
  const translations = {
    VN: { home: 'Trang chủ', learn: 'Chinh phục', review: 'Thử thách', reading: 'Đọc sách', rank: 'Bảng thi đua' },
    EN: { home: 'Home', learn: 'Mastery', review: 'Challenge', reading: 'Reading', rank: 'Leaderboard' },
    KR: { home: '홈', learn: '정복', review: '도전', reading: '독서', rank: '리더보드' }
  };

  const t = translations[language];

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
    
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      localStorage.removeItem('theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#011627] transition-colors duration-300">
      <header className="bg-white/90 dark:bg-[#011627]/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 h-20 flex items-center px-4 md:px-10 justify-between sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
          <div className="w-12 h-12 peri-gradient rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-orange-200 dark:shadow-none transition-transform group-hover:scale-110 group-hover:rotate-6">P</div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-gray-800 dark:text-white leading-tight">Peri English</span>
            <span className="text-[10px] font-black text-peri-orange tracking-widest uppercase opacity-70">Space Adventure</span>
          </div>
        </div>
        
        <nav className="hidden xl:flex items-center gap-2">
          {[
            { id: 'home', label: t.home, icon: '🏠' },
            { id: 'programs', label: t.learn, icon: '🚀' },
            { id: 'review', label: t.review, icon: '🎯' },
            { id: 'reading', label: t.reading, icon: '📖' },
            { id: 'leaderboard', label: t.rank, icon: '🏆' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setView(item.id as AppView)} 
              className={`px-5 py-2.5 rounded-2xl font-black transition-all flex items-center gap-2 group ${
                currentView === item.id || (item.id === 'programs' && ['programs', 'levels', 'topics', 'learning'].includes(currentView))
                  ? 'bg-peri-orange text-white shadow-lg shadow-orange-100 dark:shadow-none scale-105' 
                  : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="text-lg group-hover:animate-bounce">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl">
            {(['VN', 'EN', 'KR'] as Language[]).map(l => (
              <button 
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${language === l ? 'bg-white dark:bg-slate-700 text-peri-orange shadow-sm' : 'text-gray-400'}`}
              >
                {l}
              </button>
            ))}
          </div>

          <button 
            onClick={toggleTheme}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-peri-orange transition-all hover:rotate-12"
          >
            {theme === 'light' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M24 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            ) : theme === 'dark' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            )}
          </button>

          <div className="w-11 h-11 bg-gray-200 dark:bg-white/10 rounded-2xl overflow-hidden border-2 border-white dark:border-white/10 shadow-sm cursor-pointer hover:scale-105 transition-transform">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=PeriExplorer" alt="Avatar" />
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
        {children}
      </main>

      <footer className="py-12 text-center text-gray-400 dark:text-gray-600 text-sm border-t border-gray-100 dark:border-white/5">
        <p className="font-bold">&copy; 2024 Học Tiếng Anh cùng Peri • Khám phá vũ trụ kiến thức 🚀</p>
      </footer>
    </div>
  );
};

export default Layout;
