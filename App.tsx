
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from './components/Layout';
import { AppView, ProgramType, Topic, Word, Language, Theme, LearningSession, UserProfile, UserScore } from './types';
import { geminiService } from './services/geminiService';

// Fix: Declare confetti as a global function.
declare const confetti: any;

// --- Helpers ---

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const maskIdentifier = (id: string) => {
  if (!id) return 'Unknown';
  if (id.includes('@')) {
    const [name, domain] = id.split('@');
    return `${name.slice(0, 3)}****@${domain}`;
  }
  return `${id.slice(0, 3)}xxxxxxx`;
};

const playBase64Audio = async (base64: string) => {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch (e) {
    console.error("Audio error:", e);
  }
};

// --- Sub-Components ---

const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const isQuota = message.toLowerCase().includes('quota') || message.includes('429');
  
  const handleSwitchKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in text-center px-6">
      <div className="text-8xl mb-8">🛸</div>
      <h3 className="text-3xl font-black text-gray-800 dark:text-white mb-4 tracking-tight">
        {isQuota ? "Hết năng lượng rồi! ⚡" : "Gặp sự cố nhỏ rồi!"}
      </h3>
      <p className="text-gray-500 font-bold max-w-md mb-10 leading-relaxed">
        {isQuota 
          ? "Hệ thống đang quá tải do quá nhiều phi hành gia học cùng lúc. Bạn có thể đợi một chút hoặc dùng API Key cá nhân để học không giới hạn nhé!" 
          : message}
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        {onRetry && (
          <button onClick={onRetry} className="px-10 py-4 bg-peri-orange text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
            THỬ LẠI XEM SAO
          </button>
        )}
        {isQuota && (
          <button onClick={handleSwitchKey} className="px-10 py-4 bg-white dark:bg-white/5 text-peri-orange border-2 border-peri-orange rounded-2xl font-black hover:bg-peri-orange hover:text-white transition-all shadow-lg">
            DÙNG KEY CỦA TÔI (PRO)
          </button>
        )}
      </div>
      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-peri-orange">
        Tìm hiểu về Billing & Quota
      </a>
    </div>
  );
};

const LoadingHeart: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
    <div className="relative w-32 h-32 mb-10">
      <div className="absolute inset-0 bg-peri-orange/20 rounded-full animate-ping"></div>
      <div className="relative w-full h-full bg-white dark:bg-white/5 rounded-full flex items-center justify-center text-6xl shadow-xl animate-float">🛰️</div>
    </div>
    <p className="text-2xl font-black text-gray-800 dark:text-white mb-3 tracking-tight">{message}</p>
    <div className="flex gap-2">
      <div className="w-2 h-2 bg-peri-orange rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-peri-orange rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-peri-orange rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  </div>
);

const LeaderboardView: React.FC<{ currentUser: UserProfile | null }> = ({ currentUser }) => {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [ranks, setRanks] = useState<UserScore[]>([]);

  useEffect(() => {
    const generateLeaderboard = () => {
      const mockUsers = [
        { id: '0981234567', d: 156, w: 1250, m: 4500 },
        { id: 'peri_pro@space.com', d: 142, w: 1100, m: 3800 },
        { id: '0901239876', d: 128, w: 980, m: 3200 },
        { id: 'galaxy_traveler@edu.vn', d: 95, w: 850, m: 2800 },
        { id: '0349998887', d: 82, w: 720, m: 2100 },
        { id: 'luna_learner@moon.co', d: 45, w: 450, m: 1200 },
      ];

      if (currentUser) {
        const todayStr = new Date().toDateString();
        const daily = currentUser.history
          .filter(s => new Date(s.date).toDateString() === todayStr)
          .reduce((sum, s) => sum + s.wordCount, 0);
        const total = currentUser.history.reduce((sum, s) => sum + s.wordCount, 0);
        mockUsers.push({ id: currentUser.identifier, d: daily, w: total, m: total + 500 });
      }

      const sorted = [...mockUsers].sort((a, b) => {
        if (timeframe === 'day') return b.d - a.d;
        if (timeframe === 'week') return b.w - a.w;
        return b.m - a.m;
      });

      setRanks(sorted.map(u => ({
        identifier: u.id,
        dailyScore: u.d,
        weeklyScore: u.w,
        monthlyScore: u.m
      })));
    };
    generateLeaderboard();
  }, [timeframe, currentUser]);

  return (
    <div className="max-w-4xl mx-auto py-12 animate-slide-up">
      <div className="text-center mb-16">
        <h2 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter mb-4 leading-tight">Bảng Thi Đua 🏆</h2>
        <div className="flex items-center justify-center gap-2">
           <div className="h-1 w-12 bg-peri-orange rounded-full"></div>
           <p className="text-gray-400 font-extrabold uppercase tracking-[0.25em] text-[10px]">Cùng Peri Chinh Phục Vũ Trụ</p>
           <div className="h-1 w-12 bg-peri-orange rounded-full"></div>
        </div>
      </div>

      <div className="flex justify-center mb-12">
        <div className="bg-white dark:bg-white/5 p-2 rounded-[2.5rem] flex gap-1 shadow-premium">
          {(['day', 'week', 'month'] as const).map(t => (
            <button 
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-10 py-4 rounded-[2rem] font-black text-xs transition-all uppercase tracking-widest ${
                timeframe === t 
                  ? 'bg-peri-orange text-white shadow-lg scale-105' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              {t === 'day' ? 'Hôm nay' : t === 'week' ? 'Tuần này' : 'Tháng này'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {ranks.map((user, index) => {
          const isMe = currentUser?.identifier === user.identifier;
          const score = timeframe === 'day' ? user.dailyScore : timeframe === 'week' ? user.weeklyScore : user.monthlyScore;
          
          return (
            <div 
              key={user.identifier} 
              className={`group flex items-center gap-8 p-8 rounded-[3.5rem] border-b-8 transition-all duration-300 ${
                isMe 
                  ? 'bg-peri-orange/10 border-peri-orange/40 shadow-xl scale-[1.03]' 
                  : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 hover:translate-x-3 hover:shadow-premium'
              }`}
            >
              <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center font-black">
                {index === 0 ? <span className="text-6xl drop-shadow-xl animate-bounce">🥇</span> : 
                 index === 1 ? <span className="text-5xl drop-shadow-xl">🥈</span> : 
                 index === 2 ? <span className="text-4xl drop-shadow-xl">🥉</span> : 
                 <span className="text-3xl text-gray-200 dark:text-gray-700 font-black">#{index + 1}</span>}
              </div>

              <div className="flex-1 flex items-center gap-6">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner ${
                  index < 3 ? 'peri-gradient text-white' : 'bg-gray-100 dark:bg-white/10'
                }`}>
                  {isMe ? '⭐' : '🚀'}
                </div>
                <div>
                  <h3 className={`font-black text-2xl ${isMe ? 'text-peri-orange' : 'text-gray-800 dark:text-white'}`}>
                    {maskIdentifier(user.identifier)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`h-2 w-2 rounded-full ${isMe ? 'bg-peri-orange animate-pulse' : 'bg-green-400'}`}></span>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {index < 3 ? 'Huyền Thoại' : 'Nhà Thám Hiểm'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-4xl font-black ${index < 3 ? 'text-peri-orange' : 'text-gray-800 dark:text-white'}`}>
                  {score.toLocaleString()}
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Từ vựng</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AuthModal: React.FC<{ onLogin: (id: string) => void }> = ({ onLogin }) => {
  const [input, setInput] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().length > 5) onLogin(input.trim());
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-peri-deepBlue/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md p-12 rounded-[4rem] shadow-2xl border-b-8 border-gray-100 dark:border-white/5 space-y-10">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 peri-gradient rounded-[2rem] mx-auto flex items-center justify-center text-5xl shadow-2xl animate-float">👨‍🚀</div>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Xin chào!</h2>
          <p className="text-gray-400 font-bold px-4 leading-relaxed">Nhập Email hoặc SĐT để lưu lại hành trình học tập cùng Peri nhé!</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Email hoặc Số điện thoại..."
            className="w-full p-6 rounded-3xl bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-peri-orange outline-none font-black text-lg transition-all text-center"
            autoFocus
          />
          <button type="submit" className="w-full peri-gradient py-6 rounded-3xl text-white font-black text-xl shadow-xl duo-button border-peri-darkOrange uppercase tracking-widest">Bắt đầu ngay</button>
        </form>
      </div>
    </div>
  );
};

const GoalModal: React.FC<{ currentGoal: number, onSelect: (g: number) => void, onClose: () => void }> = ({ currentGoal, onSelect, onClose }) => {
  const goals = [5, 10, 15, 20, 25, 30, 40, 50];
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-peri-deepBlue/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md p-12 rounded-[4rem] shadow-2xl border-b-8 border-gray-100 dark:border-white/5 space-y-10">
        <div className="text-center">
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tighter">Đặt mục tiêu</h2>
          <p className="text-gray-400 font-bold px-4">Mỗi ngày bạn muốn chinh phục bao nhiêu từ vựng?</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {goals.map(g => (
            <button
              key={g}
              onClick={() => onSelect(g)}
              className={`p-5 rounded-2xl font-black text-xl transition-all border-b-4 ${
                currentGoal === g 
                  ? 'bg-peri-orange text-white border-peri-darkOrange scale-110 shadow-xl' 
                  : 'bg-gray-50 dark:bg-white/5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 border-gray-200 dark:border-white/10'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2 text-gray-300 font-black uppercase tracking-widest text-[10px] hover:text-peri-orange transition-colors">Để sau cũng được</button>
      </div>
    </div>
  );
};

const DailyProgress: React.FC<{ learned: number; goal: number; onEditGoal: () => void; lang: Language }> = ({ learned, goal, onEditGoal, lang }) => {
  const percentage = Math.min(100, (learned / goal) * 100);
  const isComplete = learned >= goal;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="bg-white dark:bg-white/5 p-10 rounded-[4rem] shadow-premium flex flex-col sm:flex-row items-center gap-10 border-b-8 border-gray-50 dark:border-white/5 animate-slide-up">
      <div className="relative w-32 h-32 flex-shrink-0 group">
        <svg className="w-32 h-32 transform transition-transform group-hover:scale-105 duration-500">
          <circle className="text-gray-100 dark:text-white/5" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="64" cy="64" />
          <circle 
            className={`${isComplete ? 'text-green-500' : 'text-peri-orange'} transition-all duration-1000 ease-out progress-ring__circle`} 
            strokeWidth="12" 
            strokeDasharray={circumference} 
            strokeDashoffset={offset} 
            strokeLinecap="round" 
            stroke="currentColor" 
            fill="transparent" 
            r={radius} 
            cx="64" 
            cy="64" 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className={`text-3xl font-black ${isComplete ? 'text-green-600' : 'text-gray-800 dark:text-white'}`}>{learned}</span>
          <div className="h-0.5 w-6 bg-gray-200 dark:bg-white/10 my-1"></div>
          <span className="text-[10px] font-black text-gray-300 uppercase">{goal}</span>
        </div>
      </div>
      <div className="flex-1 text-center sm:text-left space-y-2">
        <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Chuyến thám hiểm hôm nay</h3>
        <p className={`text-sm font-extrabold uppercase tracking-widest ${isComplete ? 'text-green-500' : 'text-gray-400'}`}>
          {isComplete ? '🚀 Đã cập bến mục tiêu!' : `Còn ${goal - learned} bước nữa là hoàn tất!`}
        </p>
        <button 
          onClick={onEditGoal} 
          className="inline-flex items-center gap-2 mt-4 text-[11px] font-black text-peri-orange hover:text-peri-darkOrange transition-all uppercase tracking-widest group"
        >
          Đặt lại mục tiêu <span className="group-hover:translate-x-2 transition-transform">→</span>
        </button>
      </div>
    </div>
  );
};

const HomeView: React.FC<{ 
  setView: (v: AppView) => void; 
  lang: Language; 
  learnedToday: number; 
  goal: number; 
  onEditGoal: () => void; 
  user: UserProfile | null;
  onLogout: () => void;
}> = ({ setView, lang, learnedToday, goal, onEditGoal, user, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await geminiService.lookupWord(searchQuery, lang);
      setLookupResult(data);
    } catch (e: any) { 
      console.error(e);
      setError(e.message || "Không thể kết nối với trung tâm điều khiển.");
    }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <DailyProgress learned={learnedToday} goal={goal} onEditGoal={onEditGoal} lang={lang} />
        </div>
        <div className="bg-[#011627] rounded-[4rem] p-10 text-white shadow-premium flex flex-col justify-between h-full border-b-8 border-black relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-10 group-hover:rotate-12 transition-transform duration-700">🚀</div>
          <div className="relative z-10">
            <h4 className="text-xl font-black mb-2 text-white">Chào mừng thám hiểm viên!</h4>
            <p className="text-blue-100/60 font-bold text-sm mb-6">{user ? maskIdentifier(user.identifier) : 'Peri Explorer'}</p>
          </div>
          <button onClick={onLogout} className="relative z-10 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Đăng xuất</button>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 rounded-[4rem] p-12 shadow-premium border-b-8 border-gray-100 dark:border-white/5 space-y-10">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Từ điển Không gian 🛸</h3>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">Gặp gỡ Peri để giải mã mọi từ vựng bí ẩn</p>
        </div>
        <form onSubmit={handleSearch} className="max-w-4xl mx-auto relative group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nhập từ cần giải mã..." 
            className="w-full p-8 pr-32 rounded-[2.5rem] bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-peri-orange outline-none font-black text-2xl transition-all shadow-inner dark:text-white"
          />
          <button type="submit" disabled={loading} className="absolute right-4 top-4 bottom-4 px-10 peri-gradient text-white rounded-[1.8rem] font-black uppercase tracking-widest text-sm shadow-xl duo-button border-peri-darkOrange flex items-center gap-2 group-focus-within:scale-105 transition-transform disabled:opacity-50">
            {loading ? <span className="animate-spin text-xl">🌀</span> : 'Dịch'}
          </button>
        </form>

        {error && <ErrorState message={error} onRetry={() => handleSearch({ preventDefault: () => {} } as any)} />}

        {lookupResult && !loading && (
          <div className="max-w-5xl mx-auto mt-16 animate-slide-up bg-orange-50/30 dark:bg-white/5 p-12 rounded-[3.5rem] border-2 border-dashed border-orange-200 dark:border-white/10">
             <div className="flex flex-col md:flex-row gap-10 items-start">
               <div className="flex-1 space-y-8">
                 <p className="text-peri-orange font-black italic text-lg">"{lookupResult.introMessage}"</p>
                 <div>
                   <h2 className="text-6xl font-black text-gray-900 dark:text-white mb-2">{lookupResult.word}</h2>
                   <div className="flex items-center gap-4">
                     <span className="text-gray-400 font-mono text-xl">[{lookupResult.ipa}]</span>
                     <span className="bg-peri-blue/10 text-peri-blue px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{lookupResult.wordType}</span>
                   </div>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ĐỊNH NGHĨA</p>
                    <p className="text-3xl font-black text-gray-800 dark:text-white leading-tight">{lookupResult.meaning}</p>
                 </div>
               </div>
               <div className="w-full md:w-64 aspect-square bg-white dark:bg-white/10 rounded-[2.5rem] shadow-xl overflow-hidden border-4 border-white dark:border-white/5">
                 <div className="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-slate-800 dark:to-slate-700">
                    🚀
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-8">
        {[
          { title: 'Bắt đầu thám hiểm', sub: 'Học từ vựng mới', icon: '🚀', view: 'programs', color: 'from-orange-400 to-orange-600' },
          { title: 'Sảnh luyện tập', sub: 'Ôn tập hiệu quả', icon: '🎯', view: 'review', color: 'from-blue-400 to-blue-600' },
          { title: 'Thư viện IELTS', sub: 'Đọc & Trau dồi', icon: '📖', view: 'reading', color: 'from-purple-400 to-purple-600' },
          { title: 'Bảng xếp hạng', sub: 'Cạnh tranh phi hành gia', icon: '🏆', view: 'leaderboard', color: 'from-teal-400 to-teal-600' },
        ].map(card => (
          <button 
            key={card.view}
            onClick={() => setView(card.view as AppView)}
            className="group relative bg-white dark:bg-white/5 p-10 rounded-[3.5rem] border-b-8 border-gray-100 dark:border-white/5 hover:border-peri-orange hover:translate-y-[-12px] transition-all text-left shadow-premium flex flex-col gap-8 overflow-hidden"
          >
             <div className={`w-20 h-20 rounded-[1.8rem] bg-gradient-to-br ${card.color} flex items-center justify-center text-4xl text-white shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-transform`}>{card.icon}</div>
             <div>
               <h3 className="text-2xl font-black text-gray-800 dark:text-white leading-tight mb-1">{card.title}</h3>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.sub}</p>
             </div>
             <div className="absolute right-[-10%] bottom-[-10%] text-9xl opacity-5 group-hover:opacity-10 group-hover:scale-125 transition-all">✨</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ReadingView: React.FC<{ lang: Language; completedPassages: string[]; onMarkRead: (id: string) => void }> = ({ lang, completedPassages, onMarkRead }) => {
  const [passages, setPassages] = useState<any[]>([]);
  const [selectedPassage, setSelectedPassage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPassages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await geminiService.generateReadingPassages(lang);
      setPassages(data);
    } catch (e: any) { 
      console.error(e);
      setError(e.message || "Hành tinh thư viện hiện không thể truy cập.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchPassages();
  }, [lang]);

  const handleSelect = async (p: any) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await geminiService.getPassageDetail(p.title, lang);
      setSelectedPassage({ ...detail, id: p.id });
    } catch (e: any) { 
      console.error(e);
      setError(e.message || "Không thể tải chi tiết bài đọc.");
    }
    finally { setLoadingDetail(false); }
  };

  if (loading) return <LoadingHeart message="Đang chuẩn bị thư viện IELTS... 📚" />;
  if (error && !selectedPassage) return <ErrorState message={error} onRetry={fetchPassages} />;

  if (selectedPassage) {
    const isDone = completedPassages.includes(selectedPassage.id);
    return (
      <div className="max-w-5xl mx-auto py-12 animate-slide-up space-y-12">
        <button onClick={() => { setSelectedPassage(null); setError(null); }} className="flex items-center gap-3 text-peri-orange font-black uppercase tracking-widest text-[11px] hover:translate-x-[-8px] transition-transform">
          ← Quay lại thư viện
        </button>
        
        {error ? (
          <ErrorState message={error} onRetry={() => handleSelect({ title: selectedPassage.title, id: selectedPassage.id })} />
        ) : (
          <div className="bg-white dark:bg-white/5 rounded-[4rem] p-12 md:p-20 shadow-premium border-b-8 border-gray-100 dark:border-white/5 space-y-12">
            <div className="text-center space-y-4">
               <h2 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">{selectedPassage.title}</h2>
               <div className="h-1.5 w-24 bg-peri-orange mx-auto rounded-full"></div>
            </div>
            <div className="max-w-none text-gray-700 dark:text-gray-300 font-medium leading-relaxed space-y-8 text-xl">
              {selectedPassage.content?.split('\n\n').map((para: string, i: number) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div className="pt-20 border-t-2 border-dashed border-gray-100 dark:border-white/10">
              <h3 className="text-3xl font-black text-gray-800 dark:text-white mb-10 text-center">Tư liệu Từ vựng Học thuật 💎</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedPassage.vocabulary?.map((v: any, i: number) => (
                  <div key={i} className="bg-gray-50 dark:bg-white/5 p-8 rounded-3xl border-b-4 border-gray-100 dark:border-white/5 hover:border-peri-blue transition-all group">
                     <div className="flex items-center justify-between mb-4">
                       <span className="text-xl font-black text-peri-blue">{v.word}</span>
                       <span className="text-[10px] font-black text-gray-300 uppercase">{v.wordType}</span>
                     </div>
                     <p className="text-sm font-bold text-gray-500 mb-2">[{v.ipa}]</p>
                     <p className="text-lg font-black text-gray-800 dark:text-white">{v.meaning}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center pt-10">
               {!isDone ? (
                 <button onClick={() => onMarkRead(selectedPassage.id)} className="peri-gradient text-white px-16 py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl duo-button border-peri-darkOrange uppercase tracking-[0.2em] animate-bounce">Đã đọc & Chinh phục! 🏁</button>
               ) : (
                 <div className="bg-green-100 text-green-600 px-12 py-6 rounded-full font-black text-xl flex items-center gap-4">
                   <span>✅ Nhiệm vụ hoàn tất</span>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loadingDetail) return <LoadingHeart message="Đang giải mã văn bản học thuật... 📖" />;

  return (
    <div className="max-w-6xl mx-auto py-12 animate-slide-up">
      <div className="text-center mb-16 space-y-4">
        <h2 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter">Thư viện IELTS Peri 🪐</h2>
        <p className="text-gray-400 font-extrabold uppercase tracking-widest text-xs">25 Thử thách đọc hiểu chuẩn học thuật đang chờ bạn</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {passages.map(p => (
          <button 
            key={p.id} 
            onClick={() => handleSelect(p)} 
            className="group bg-white dark:bg-white/5 p-10 rounded-[3.5rem] border-b-8 border-gray-100 dark:border-white/5 hover:border-peri-orange hover:translate-y-[-8px] transition-all text-left shadow-premium flex flex-col justify-between"
          >
            <div className="space-y-4">
              <span className="inline-block px-4 py-1.5 bg-peri-orange/10 text-peri-orange text-[10px] font-black rounded-full uppercase tracking-widest">{p.category}</span>
              <h3 className="text-2xl font-black text-gray-800 dark:text-white leading-tight group-hover:text-peri-orange transition-colors">{p.title}</h3>
              <p className="text-gray-500 font-medium text-sm line-clamp-2">{p.teaser}</p>
            </div>
            <div className="mt-8 flex items-center justify-between">
               <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Tiến độ: {completedPassages.includes(p.id) ? 'Đã đọc' : 'Chưa đọc'}</span>
               <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/10 flex items-center justify-center text-xl group-hover:bg-peri-orange group-hover:text-white transition-all">→</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Re-adding HistoryView ---
const HistoryView: React.FC<{ history: LearningSession[]; onBack: () => void }> = ({ history, onBack }) => {
  return (
    <div className="max-w-4xl mx-auto py-12 animate-slide-up space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">Nhật ký thám hiểm 🛰️</h2>
        <button onClick={onBack} className="bg-white dark:bg-white/5 px-8 py-4 rounded-2xl font-black text-xs text-gray-500 border-b-4 border-gray-100 dark:border-white/10 shadow-lg">Quay lại</button>
      </div>
      {history.length === 0 ? (
        <div className="bg-white dark:bg-white/5 p-20 rounded-[4rem] text-center space-y-6 shadow-premium">
           <div className="text-8xl">🏜️</div>
           <p className="text-2xl font-black text-gray-400">Chưa có dữ liệu thám hiểm nào được lưu lại.</p>
           <button onClick={onBack} className="peri-gradient text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl duo-button border-peri-darkOrange">Bắt đầu thám hiểm ngay</button>
        </div>
      ) : (
        <div className="space-y-6">
          {history.map(s => (
            <div key={s.id} className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border-b-4 border-gray-100 dark:border-white/5 flex items-center justify-between shadow-premium hover:translate-x-2 transition-transform">
               <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-2xl bg-peri-orange/10 flex items-center justify-center text-3xl text-peri-orange">✨</div>
                 <div>
                   <h3 className="text-xl font-black text-gray-800 dark:text-white">{s.topic}</h3>
                   <div className="flex items-center gap-3 mt-1">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.program}</span>
                     <span className="h-1 w-1 bg-gray-200 rounded-full"></span>
                     <span className="text-[10px] font-bold text-gray-400">{new Date(s.date).toLocaleDateString()}</span>
                   </div>
                 </div>
               </div>
               <div className="text-right">
                 <div className="text-3xl font-black text-peri-orange">+{s.wordCount}</div>
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Từ vựng</div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- REST OF THE COMPONENTS (Levels, Topics, Learning, Review) remain exactly as restored ---

const LevelsView: React.FC<{ program: ProgramType, onSelect: (lvl: string) => void }> = ({ program, onSelect }) => {
  const levelsMap: Record<ProgramType, { id: string, title: string, desc: string, icon: string }[]> = {
    [ProgramType.IELTS]: [
      { id: 'Band 5.0-6.0', title: 'Foundation', desc: 'Từ vựng nền tảng', icon: '🥉' },
      { id: 'Band 6.5-7.5', title: 'Professional', desc: 'Từ vựng học thuật cao', icon: '🥈' },
      { id: 'Band 8.0+', title: 'Mastery', desc: 'Từ vựng chuyên sâu/hiếm', icon: '🥇' },
    ],
    [ProgramType.COMMUNICATION]: [
      { id: 'A1-A2', title: 'Beginner', desc: 'Giao tiếp cơ bản hàng ngày', icon: '🌱' },
      { id: 'B1-B2', title: 'Intermediate', desc: 'Giao tiếp tự tin, lưu loát', icon: '🛰️' },
      { id: 'C1-C2', title: 'Advanced', desc: 'Giao tiếp như người bản xứ', icon: '👨‍🚀' },
    ],
    [ProgramType.YLE]: [
      { id: 'Starters', title: 'Starters', desc: 'Khởi đầu vui nhộn', icon: '⭐' },
      { id: 'Movers', title: 'Movers', desc: 'Khám phá thế giới', icon: '🏃' },
      { id: 'Flyers', title: 'Flyers', desc: 'Sẵn sàng cất cánh', icon: '🪁' },
    ],
    [ProgramType.UNIVERSITY]: [
      { id: 'Score 5-6', title: 'Tốt nghiệp', desc: 'Bám sát SGK & Cơ bản', icon: '📚' },
      { id: 'Score 7-8', title: 'Khá Giỏi', desc: 'Mở rộng cấu trúc & từ vựng', icon: '📝' },
      { id: 'Score 9+', title: 'Thủ khoa', desc: 'Idioms, Collocations khó', icon: '🏆' },
    ]
  };

  const levels = levelsMap[program] || [];

  return (
    <div className="max-w-4xl mx-auto py-12 animate-slide-up text-center">
      <h2 className="text-5xl font-black mb-6 text-gray-900 dark:text-white tracking-tighter">Chọn trạm dừng chân 🌌</h2>
      <p className="text-gray-400 font-extrabold uppercase tracking-widest text-xs mb-12">Chương trình: {program}</p>
      <div className="grid gap-8">
        {levels.map(l => (
          <button key={l.id} onClick={() => onSelect(l.id)} className="bg-white dark:bg-white/5 p-10 rounded-[3.5rem] border-b-8 border-gray-100 dark:border-white/5 hover:border-peri-orange hover:translate-y-[-8px] transition-all flex items-center gap-10 shadow-premium group text-left">
            <div className="w-24 h-24 bg-gray-50 dark:bg-white/10 rounded-[2rem] flex items-center justify-center text-5xl group-hover:scale-110 transition-transform shadow-inner">{l.icon}</div>
            <div className="flex-1">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{l.title} <span className="text-peri-orange text-lg opacity-60 ml-2">[{l.id}]</span></h3>
              <p className="text-gray-500 font-bold text-lg">{l.desc}</p>
            </div>
            <div className="text-4xl opacity-0 group-hover:opacity-100 transition-opacity">🚀</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const TopicsView: React.FC<{ program: string, level: string, lang: Language, onSelect: (t: Topic) => void }> = ({ program, level, lang, onSelect }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await geminiService.generateTopics(program, level, lang);
      setTopics(data);
    } catch (e: any) { 
      console.error(e); 
      setError(e.message || "Không thể tải danh sách chủ đề.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTopics();
  }, [program, level, lang]);

  if (loading) return <LoadingHeart message="Đang quét các hành tinh chủ đề... 🌌" />;
  if (error) return <ErrorState message={error} onRetry={fetchTopics} />;

  return (
    <div className="max-w-6xl mx-auto py-12 animate-slide-up">
      <h2 className="text-6xl font-black text-center mb-16 text-gray-900 dark:text-white tracking-tighter">Hành tinh mục tiêu của bạn?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {topics.map(t => (
          <button key={t.id} onClick={() => onSelect(t)} className="bg-white dark:bg-white/5 p-10 rounded-[4rem] border-b-8 border-gray-100 dark:border-white/5 hover:border-peri-orange hover:translate-y-[-12px] transition-all flex flex-col items-center gap-6 group shadow-premium">
             <div className="w-24 h-24 peri-gradient rounded-full flex items-center justify-center text-5xl shadow-2xl group-hover:rotate-12 transition-transform">🪐</div>
             <h3 className="text-2xl font-black text-gray-800 dark:text-white text-center leading-tight">{t.title}</h3>
             <span className="bg-peri-blue/10 text-peri-blue px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{t.count} Từ vựng</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const LearningView: React.FC<{ topic: Topic, program: string, lang: Language, onFinish: (count: number) => void }> = ({ topic, program, lang, onFinish }) => {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await geminiService.generateWordsForTopic(topic.title, program, lang);
      setWords(data);
    } catch (e: any) { 
      console.error(e); 
      setError(e.message || "Lỗi nạp dữ liệu từ vựng.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchWords();
  }, [topic, program, lang]);

  if (loading) return <LoadingHeart message="Đang nạp năng lượng từ vựng... 🛰️" />;
  if (error) return <ErrorState message={error} onRetry={fetchWords} />;
  if (words.length === 0) return <div className="text-center p-20 font-black text-2xl">Không tìm thấy từ vựng.</div>;

  const currentWord = words[currentIdx];

  const handleSpeak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audio = await geminiService.generateSpeech(currentWord.word);
      if (audio) await playBase64Audio(audio);
    } catch (e) { console.error(e); }
    finally { setIsSpeaking(false); }
  };

  const handleNext = () => {
    if (currentIdx < words.length - 1) {
      setCurrentIdx(c => c + 1);
      setFlipped(false);
    } else {
      onFinish(words.length);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 flex flex-col items-center gap-10 animate-slide-up">
      <div className="w-full flex justify-between items-center text-gray-400 font-black uppercase tracking-widest text-[11px] px-4">
        <span>Chủ đề: {topic.title}</span>
        <span>{currentIdx + 1} / {words.length} Trạm dừng</span>
      </div>

      <div className="w-full h-4 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner border border-gray-100/50">
        <div className="h-full bg-peri-orange transition-all duration-700 shadow-lg" style={{ width: `${((currentIdx + 1) / words.length) * 100}%` }}></div>
      </div>

      <div 
        onClick={() => setFlipped(!flipped)}
        className="w-full aspect-[16/11] perspective-2000 cursor-pointer group"
      >
        <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
          <div className="absolute inset-0 backface-hidden bg-white dark:bg-white/5 rounded-[5rem] shadow-2xl border-b-8 border-gray-100 dark:border-white/5 flex flex-col items-center justify-center p-16 text-center">
             <div className="mb-6">
               <span className="bg-peri-blue/10 text-peri-blue px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{currentWord.wordType}</span>
             </div>
             <h2 className="text-8xl md:text-9xl font-black text-gray-900 dark:text-white mb-8 tracking-tighter leading-none">{currentWord.word}</h2>
             <div className="flex items-center gap-6 mb-12">
               <p className="text-3xl font-mono text-gray-400/80">[{currentWord.ipa}]</p>
               <button onClick={handleSpeak} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${isSpeaking ? 'bg-peri-orange text-white animate-pulse' : 'bg-gray-50 dark:bg-white/10 text-gray-400 hover:text-peri-orange hover:scale-110'}`}>
                 <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.02C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z" /></svg>
               </button>
             </div>
             <div className="mt-6 p-10 bg-orange-50/50 dark:bg-peri-orange/5 rounded-[3rem] border-4 border-dashed border-orange-100 dark:border-white/10 w-full max-w-xl">
                <p className="text-xs font-black text-peri-orange uppercase tracking-[0.3em] mb-3">Tín hiệu từ Peri 💡</p>
                <p className="text-gray-600 dark:text-gray-300 font-bold italic text-lg leading-relaxed">Chạm vào thẻ để giải mã ý nghĩa bí mật!</p>
             </div>
          </div>
          
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white dark:bg-white/5 rounded-[5rem] shadow-2xl border-b-8 border-gray-100 dark:border-white/5 flex flex-col p-14 text-left overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-start mb-10 border-b-2 border-dashed border-gray-100 dark:border-white/5 pb-8">
                <div>
                  <div className="flex items-center gap-5 mb-2">
                    <h4 className="text-4xl font-black text-gray-900 dark:text-white leading-none">{currentWord.word}</h4>
                    <span className="text-[10px] font-black px-3 py-1 bg-gray-50 dark:bg-white/10 text-gray-400 rounded-lg uppercase tracking-widest">{currentWord.wordType}</span>
                    <button onClick={handleSpeak} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isSpeaking ? 'text-peri-orange scale-110' : 'text-gray-300 hover:text-peri-orange hover:scale-125'}`}>
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.02C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z" /></svg>
                    </button>
                  </div>
                  <p className="text-lg font-mono text-gray-400">[{currentWord.ipa}]</p>
                </div>
                <div className="px-4 py-2 bg-peri-orange/10 rounded-2xl">
                  <span className="text-[10px] font-black text-peri-orange uppercase tracking-[0.2em]">Giải mã thành công</span>
                </div>
             </div>
             
             <div className="space-y-10">
               <div>
                 <p className="text-[10px] font-black text-peri-orange uppercase tracking-[0.25em] mb-4">ĐỊNH NGHĨA VŨ TRỤ</p>
                 <h3 className="text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">{currentWord.meaning}</h3>
               </div>
               <div className="bg-gray-50 dark:bg-white/5 p-10 rounded-[3.5rem] border-l-[12px] border-peri-blue shadow-inner">
                  <p className="text-[10px] font-black text-peri-blue uppercase tracking-[0.2em] mb-4">Ví dụ trong hành trình</p>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 leading-relaxed italic">"{currentWord.example}"</p>
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 w-full max-w-3xl">
         <button onClick={() => setFlipped(!flipped)} className="flex-1 bg-white dark:bg-white/5 py-8 rounded-[2.5rem] font-black text-xl text-gray-500 border-b-4 border-gray-100 dark:border-white/10 duo-button uppercase tracking-widest shadow-lg">LẬT THẺ</button>
         <button onClick={handleNext} className="flex-[2] peri-gradient text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl duo-button border-peri-darkOrange uppercase tracking-[0.2em]">
           {currentIdx === words.length - 1 ? 'VỀ ĐÍCH 🎉' : 'TIẾP THEO 🚀'}
         </button>
      </div>
    </div>
  );
};

const ReviewView: React.FC<{ lang: Language; setView: (v: AppView) => void }> = ({ lang, setView }) => {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSelectGame = async (gameId: string) => { 
    setLoading(true); 
    setActiveGame(gameId); 
    setError(null);
    try { 
      const data = await geminiService.generateWordsForTopic('Common Phrases', 'General English', lang); 
      setWords(data); 
    } catch (e: any) { 
      console.error(e); 
      setError(e.message || "Lỗi trò chơi.");
    } 
    finally { setLoading(false); } 
  };

  if (loading) return <LoadingHeart message="Đang nạp năng lượng trò chơi... 🕹️" />;
  if (error) return <ErrorState message={error} onRetry={() => handleSelectGame(activeGame!)} />;
  
  if (activeGame === 'match') return <MatchGame words={words} onComplete={() => setActiveGame(null)} />;
  if (activeGame === 'quiz') return <QuizGame words={words} onComplete={() => setActiveGame(null)} />;
  if (activeGame === 'spell') return <SpellingGame words={words} onComplete={() => setActiveGame(null)} />;

  return (
    <div className="max-w-6xl mx-auto py-12 animate-slide-up">
      <div className="text-center mb-20 space-y-6">
        <h2 className="text-7xl font-black text-gray-900 dark:text-white tracking-tighter">Thử thách Peri 🎯</h2>
        <p className="text-2xl text-gray-400 font-extrabold italic uppercase tracking-[0.25em]">Vừa học vừa chơi, đỉnh cao trí tuệ!</p>
      </div>
      <div className="grid md:grid-cols-3 gap-12">
        {[ 
          { id: 'match', title: 'Trận chiến Ghép cặp', icon: '🧩', color: 'from-orange-400 to-orange-500', desc: 'Rèn luyện trí nhớ' }, 
          { id: 'quiz', title: 'Ngôi sao Trắc nghiệm', icon: '🌟', color: 'from-teal-400 to-teal-500', desc: 'Kiểm tra kiến thức' }, 
          { id: 'spell', title: 'Phi thuyền Đánh vần', icon: '🚀', color: 'from-purple-400 to-purple-500', desc: 'Làm chủ ký tự' } 
        ].map((game) => (
          <button key={game.id} onClick={() => handleSelectGame(game.id)} className="group bg-white dark:bg-white/5 p-12 rounded-[4.5rem] shadow-premium border-b-[12px] border-gray-100 dark:border-white/5 hover:border-peri-orange hover:translate-y-[-12px] transition-all flex flex-col items-center gap-8 text-center">
            <div className={`w-32 h-32 rounded-[2.5rem] bg-gradient-to-br ${game.color} flex items-center justify-center text-6xl text-white shadow-2xl group-hover:scale-110 transition-transform duration-500`}>{game.icon}</div>
            <div>
              <h3 className="text-2xl font-black dark:text-white mb-2">{game.title}</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{game.desc}</p>
            </div>
            <div className="mt-4 px-10 py-4 bg-gray-50 dark:bg-white/10 rounded-[1.5rem] font-black text-xs text-peri-orange uppercase tracking-[0.2em] group-hover:bg-peri-orange group-hover:text-white transition-all">CHƠI NGAY</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Re-adding MatchGame, QuizGame, SpellingGame from restored code ---
interface CardData { id: string; content: string; type: 'word' | 'meaning'; matched: boolean; }
const MatchGame: React.FC<{ words: Word[]; onComplete: (score: number) => void }> = ({ words, onComplete }) => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [disabled, setDisabled] = useState(false);
  useEffect(() => {
    const gameWords = words.slice(0, 6);
    const wordCards: CardData[] = gameWords.map((w: Word) => ({ id: w.word, content: w.word, type: 'word' as const, matched: false }));
    const meaningCards: CardData[] = gameWords.map((w: Word) => ({ id: w.word, content: w.meaning, type: 'meaning' as const, matched: false }));
    setCards(shuffleArray([...wordCards, ...meaningCards]));
  }, [words]);
  const handleFlip = (index: number) => {
    if (disabled || flipped.includes(index) || cards[index].matched) return;
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);
    if (newFlipped.length === 2) {
      setDisabled(true);
      const [first, second] = newFlipped;
      if (cards[first].id === cards[second].id && cards[first].type !== cards[second].type) {
        setTimeout(() => { setCards(prev => prev.map((c, i) => (i === first || i === second) ? { ...c, matched: true } : c)); setFlipped([]); setDisabled(false); }, 500);
      } else {
        setTimeout(() => { setFlipped([]); setDisabled(false); }, 1000);
      }
    }
  };
  useEffect(() => {
    if (cards.length > 0 && cards.every((c: CardData) => c.matched)) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => onComplete(words.length * 10), 2000);
    }
  }, [cards, onComplete, words.length]);
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-6 max-w-5xl mx-auto py-12 animate-slide-up">
      {cards.map((card, i) => (
        <div key={i} onClick={() => handleFlip(i)} className={`h-40 md:h-48 cursor-pointer rounded-[2.5rem] transition-all duration-500 flex items-center justify-center p-6 text-center font-black text-md md:text-lg border-b-[6px] shadow-lg ${card.matched ? 'bg-green-100 text-green-600 border-green-200 opacity-50 scale-95' : flipped.includes(i) ? 'bg-white text-peri-orange border-peri-orange scale-105' : 'bg-peri-orange text-white border-peri-darkOrange hover:scale-105 active:scale-95'}`}>
          {flipped.includes(i) || card.matched ? card.content : 'P'}
        </div>
      ))}
    </div>
  );
};

const QuizGame: React.FC<{ words: Word[]; onComplete: (score: number) => void }> = ({ words, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const currentWord = words[currentIdx] || { word: '', ipa: '', meaning: '' };
  const options = useMemo(() => {
    if (!currentWord.word) return [];
    const others = words.filter(w => w.word !== currentWord.word);
    const wrongOnes = shuffleArray(others).slice(0, 3).map((w: Word) => w.meaning);
    return shuffleArray([currentWord.meaning, ...wrongOnes]);
  }, [currentWord, words]);
  const handleAnswer = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const correct = opt === currentWord.meaning;
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
    setTimeout(() => {
      if (currentIdx < words.length - 1) { setCurrentIdx(c => c + 1); setSelected(null); setIsCorrect(null); } 
      else { onComplete(score * 100); }
    }, 1500);
  };
  if (!currentWord.word) return null;
  return (
    <div className="max-w-3xl mx-auto py-16 space-y-12 animate-slide-up">
      <div className="bg-white dark:bg-white/5 p-12 rounded-[4.5rem] shadow-premium text-center border-b-[12px] border-gray-100 dark:border-white/5">
        <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 block">THỬ THÁCH {currentIdx + 1}/{words.length}</span>
        <h2 className="text-7xl font-black text-gray-900 dark:text-white mb-8 tracking-tighter leading-none">{currentWord.word}</h2>
        <div className="h-1 w-20 bg-peri-orange mx-auto mb-6 rounded-full"></div>
        <p className="text-gray-400 font-mono text-2xl">[{currentWord.ipa}]</p>
      </div>
      <div className="grid gap-6">
        {options.map((opt, i) => (
          <button key={i} onClick={() => handleAnswer(opt)} className={`p-8 rounded-[2.5rem] text-left font-black text-2xl transition-all border-b-[8px] shadow-lg ${selected === opt ? (isCorrect ? 'bg-green-500 text-white border-green-700' : 'bg-red-500 text-white border-red-700') : (selected && opt === currentWord.meaning ? 'bg-green-500 text-white border-green-700 animate-pulse' : 'bg-white dark:bg-white/5 text-gray-700 dark:text-white border-gray-100 dark:border-white/10 hover:translate-y-[-6px] hover:border-peri-orange')}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const SpellingGame: React.FC<{ words: Word[]; onComplete: (score: number) => void }> = ({ words, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const currentWord = words[currentIdx] || { word: '', meaning: '' };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase().trim() === currentWord.word.toLowerCase()) {
      setStatus('correct');
      setTimeout(() => { if (currentIdx < words.length - 1) { setCurrentIdx(c => c + 1); setInput(''); setStatus('idle'); } else { onComplete(words.length * 50); } }, 1000);
    } else {
      setStatus('wrong'); setTimeout(() => setStatus('idle'), 1000);
    }
  };
  if (!currentWord.word) return null;
  return (
    <div className="max-w-3xl mx-auto py-16 space-y-12 text-center animate-slide-up">
      <div className="bg-white dark:bg-white/5 p-16 rounded-[5rem] shadow-premium space-y-8 border-b-[12px] border-gray-100 dark:border-white/5 relative">
        <div className="text-7xl animate-float">🛸</div>
        <h3 className="text-4xl font-black text-gray-800 dark:text-white leading-relaxed tracking-tight">"{currentWord.meaning}"</h3>
      </div>
      <form onSubmit={handleSubmit} className="relative space-y-10">
        <input 
          autoFocus 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          className={`w-full p-10 rounded-[3rem] text-center text-5xl font-black outline-none border-[6px] shadow-2xl transition-all ${status === 'correct' ? 'border-green-500 bg-green-50 text-green-600' : status === 'wrong' ? 'border-red-500 bg-red-50 text-red-600 animate-shake' : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white focus:border-peri-orange'}`} 
          placeholder="..." 
        />
        <button type="submit" className="peri-gradient text-white px-16 py-6 rounded-[2.5rem] font-black text-2xl shadow-xl duo-button border-peri-darkOrange uppercase tracking-[0.2em]">KIỂM TRA TÍN HIỆU</button>
      </form>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [language, setLanguage] = useState<Language>('VN');
  const [theme, setTheme] = useState<Theme>('system');
  const [learnedToday, setLearnedToday] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const savedGoal = localStorage.getItem('peri_goal');
    if (savedGoal) setDailyGoal(parseInt(savedGoal));
    const savedUser = localStorage.getItem('peri_current_user');
    if (savedUser) {
      const userData = localStorage.getItem(`peri_user_${savedUser}`);
      if (userData) {
        const profile = JSON.parse(userData) as UserProfile;
        setCurrentUser(profile);
        const todayStr = new Date().toDateString();
        const todayWords = profile.history
          .filter(s => new Date(s.date).toDateString() === todayStr)
          .reduce((sum, s) => sum + s.wordCount, 0);
        setLearnedToday(todayWords);
      }
    } else {
      setShowAuthModal(true);
    }
  }, []);

  const handleSetGoal = (newGoal: number) => {
    setDailyGoal(newGoal);
    localStorage.setItem('peri_goal', newGoal.toString());
    setShowGoalModal(false);
  };

  const handleLogin = (identifier: string) => {
    let userData = localStorage.getItem(`peri_user_${identifier}`);
    let profile: UserProfile;
    if (userData) {
      profile = JSON.parse(userData);
    } else {
      profile = { identifier, history: [], completedPassages: [], lastLogin: new Date().toISOString() };
      localStorage.setItem(`peri_user_${identifier}`, JSON.stringify(profile));
    }
    localStorage.setItem('peri_current_user', identifier);
    setCurrentUser(profile);
    setShowAuthModal(false);
    const todayStr = new Date().toDateString();
    const todayWords = profile.history
      .filter(s => new Date(s.date).toDateString() === todayStr)
      .reduce((sum, s) => sum + s.wordCount, 0);
    setLearnedToday(todayWords);
  };

  const handleLogout = () => {
    localStorage.removeItem('peri_current_user');
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  const handleFinishSession = (count: number) => {
    if (!currentUser || !selectedTopic || !selectedProgram) return;
    const newSession: LearningSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      topic: selectedTopic.title,
      wordCount: count,
      program: selectedProgram
    };
    const updatedProfile: UserProfile = { ...currentUser, history: [newSession, ...currentUser.history] };
    localStorage.setItem(`peri_user_${currentUser.identifier}`, JSON.stringify(updatedProfile));
    setCurrentUser(updatedProfile);
    const newTotal = learnedToday + count;
    setLearnedToday(newTotal);
    if (learnedToday < dailyGoal && newTotal >= dailyGoal) {
      confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
    }
    setView('home');
    setSelectedProgram(null);
    setSelectedLevel(null);
    setSelectedTopic(null);
  };

  const handleMarkPassageRead = (passageId: string) => {
    if (!currentUser) return;
    if (currentUser.completedPassages.includes(passageId)) return;
    const updatedProfile: UserProfile = { ...currentUser, completedPassages: [...currentUser.completedPassages, passageId] };
    localStorage.setItem(`peri_user_${currentUser.identifier}`, JSON.stringify(updatedProfile));
    setCurrentUser(updatedProfile);
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  };

  return (
    <Layout currentView={view} setView={setView} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme}>
      {showAuthModal && <AuthModal onLogin={handleLogin} />}
      {showGoalModal && <GoalModal currentGoal={dailyGoal} onSelect={handleSetGoal} onClose={() => setShowGoalModal(false)} />}
      
      {view === 'home' && (
        <HomeView 
          setView={setView} 
          lang={language} 
          learnedToday={learnedToday} 
          goal={dailyGoal} 
          onEditGoal={() => setShowGoalModal(true)} 
          user={currentUser}
          onLogout={handleLogout}
        />
      )}
      
      {view === 'programs' && (
        <div className="max-w-5xl mx-auto py-12 animate-slide-up">
          <h2 className="text-6xl font-black text-center mb-20 text-gray-900 dark:text-white tracking-tighter">Bạn muốn thám hiểm đâu?</h2>
          <div className="grid md:grid-cols-2 gap-12">
            {[
              { id: ProgramType.IELTS, icon: '🎓', color: 'bg-orange-500', label: 'IELTS Academy', desc: 'Luyện thi chuẩn học thuật' },
              { id: ProgramType.COMMUNICATION, icon: '🗣️', color: 'bg-teal-500', label: 'Daily Chat', desc: 'Giao tiếp hàng ngày tự tin' },
              { id: ProgramType.YLE, icon: '🧒', color: 'bg-blue-500', label: 'Kids Mission', desc: 'Tiếng Anh cho phi hành gia nhí' },
              { id: ProgramType.UNIVERSITY, icon: '🏛️', color: 'bg-purple-500', label: 'Exam Master', desc: 'Ôn thi THPT Quốc Gia' },
            ].map(p => (
              <button key={p.id} onClick={() => { setSelectedProgram(p.id); setView('levels'); }} className="group bg-white dark:bg-white/5 p-12 rounded-[4.5rem] border-b-[12px] border-gray-100 dark:border-white/5 hover:border-peri-orange hover:translate-y-[-12px] transition-all flex items-center gap-10 shadow-premium text-left">
                 <div className={`w-24 h-24 rounded-[2.5rem] ${p.color} flex items-center justify-center text-5xl shadow-2xl transition-transform group-hover:scale-110 group-hover:rotate-6`}>{p.icon}</div>
                 <div>
                   <h3 className="text-3xl font-black dark:text-white leading-tight mb-2">{p.label}</h3>
                   <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{p.desc}</p>
                 </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'levels' && selectedProgram && <LevelsView program={selectedProgram} onSelect={(lvl) => { setSelectedLevel(lvl); setView('topics'); }} />}
      {view === 'topics' && selectedProgram && selectedLevel && <TopicsView program={selectedProgram} level={selectedLevel} lang={language} onSelect={(t) => { setSelectedTopic(t); setView('learning'); }} />}
      {view === 'learning' && selectedTopic && selectedProgram && <LearningView topic={selectedTopic} program={selectedProgram} lang={language} onFinish={handleFinishSession} />}
      {view === 'review' && <ReviewView lang={language} setView={setView} />}
      {view === 'reading' && <ReadingView lang={language} completedPassages={currentUser?.completedPassages || []} onMarkRead={handleMarkPassageRead} />}
      {view === 'leaderboard' && <LeaderboardView currentUser={currentUser} />}
      {view === 'history' && currentUser && <HistoryView history={currentUser.history} onBack={() => setView('home')} />}
    </Layout>
  );
};

export default App;
