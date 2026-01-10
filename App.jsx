import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Settings, 
  LayoutDashboard, 
  PlusCircle, 
  Heart, 
  Dumbbell, 
  Brain, 
  Users, 
  Smile, 
  Briefcase, 
  Trash2, 
  CheckCircle2, 
  Calendar, 
  Save, 
  TrendingUp
} from 'lucide-react';

// ========================================================
// 1. CONFIGURATION
// ========================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAlYM5yXZTX878B5F4mT0MEQZhvtAzCsqE",
  authDomain: "spirepilot-c2d24.firebaseapp.com",
  projectId: "spirepilot-c2d24",
  storageBucket: "spirepilot-c2d24.firebasestorage.app",
  messagingSenderId: "506012819568",
  appId: "1:506012819568:web:949cc79adb1241fe1614b5"
};

// --- Initialization Logic ---
const getFirebaseConfig = () => {
  try {
    const viteConfig = typeof process !== 'undefined' && process.env?.VITE_FIREBASE_CONFIG;
    if (viteConfig) return JSON.parse(viteConfig);
    if (window.importMetaEnv?.VITE_FIREBASE_CONFIG) return JSON.parse(window.importMetaEnv.VITE_FIREBASE_CONFIG);
  } catch (e) {
    // Fallback to hardcoded
  }
  return FIREBASE_CONFIG;
};

const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'spire-rule-of-life-v2';

// ========================================================
// 2. DATA MODELS & ICONS
// ========================================================
const INITIAL_SCHEMA = {
  categories: [
    { id: 'spiritual', label: 'Spiritual', icon: 'Heart', color: 'indigo', purpose: 'Connection with the Divine', habits: [{ id: 's1', name: 'Morning Prayer', rhythm: 'daily', target: 7, type: 'count' }] },
    { id: 'physical', label: 'Physical', icon: 'Dumbbell', color: 'emerald', purpose: 'Body as a Temple', habits: [{ id: 'p1', name: 'Exercise', rhythm: 'weekly', target: 5, type: 'count' }] },
    { id: 'intellectual', label: 'Intellectual', icon: 'Brain', color: 'sky', purpose: 'The Deep Life', habits: [{ id: 'i1', name: 'Deep Work Hours', rhythm: 'weekly', target: 15, type: 'count' }] },
    { id: 'relational', label: 'Relational', icon: 'Users', color: 'rose', purpose: 'Force for Good', habits: [{ id: 'r1', name: 'Quality Time', rhythm: 'weekly', target: 7, type: 'count' }] },
    { id: 'emotional', label: 'Emotional', icon: 'Smile', color: 'amber', purpose: 'Internal Resilience', habits: [{ id: 'e1', name: 'Daily Examen', rhythm: 'daily', target: 7, type: 'count' }] },
    { id: 'career', label: 'Career', icon: 'Briefcase', color: 'slate', purpose: 'Impact & Stewardship', habits: [{ id: 'c1', name: 'Focus Blocks', rhythm: 'weekly', target: 10, type: 'count' }] }
  ]
};

const ICON_MAP = { Heart, Dumbbell, Brain, Users, Smile, Briefcase };

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [schema, setSchema] = useState(INITIAL_SCHEMA);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputData, setInputData] = useState({});
  const [reflection, setReflection] = useState('');

  // 1. AUTHENTICATION (FIXED: Handles Token Mismatch)
  useEffect(() => {
    const performAuth = async () => {
      // Check if we are in the Preview Environment
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          // Try to sign in with the preview token
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (tokenError) {
          // ERROR CAUGHT HERE: mismatch between Preview token and Your Firebase Config
          console.log("Environment token mismatch (expected). Falling back to anonymous auth for your DB.");
          try {
            await signInAnonymously(auth);
          } catch (anonError) {
            console.error("Anonymous auth failed:", anonError);
          }
        }
      } else {
        // Standard production environment (Vercel)
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Production auth failed:", err);
        }
      }
    };

    performAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. DATA SYNCHRONIZATION
  useEffect(() => {
    if (!user) return;
    
    // Strict path following RULE 1
    const schemaDoc = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'schema');
    const logsCol = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'logs');

    const unsubSchema = onSnapshot(schemaDoc, (d) => {
      if (d.exists()) {
        setSchema(d.data());
      } else {
        setDoc(schemaDoc, INITIAL_SCHEMA);
      }
    }, (err) => console.error("Sync Error (Schema):", err));

    const unsubLogs = onSnapshot(logsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.error("Sync Error (Logs):", err);
      setLoading(false);
    });

    return () => { unsubSchema(); unsubLogs(); };
  }, [user]);

  // 3. ACTIONS
  const saveSchema = async (newSchema) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'schema'), newSchema);
    } catch (e) { console.error("Save Error:", e); }
  };

  const submitLog = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'logs'), {
        data: inputData,
        reflection,
        timestamp: serverTimestamp()
      });
      setInputData({});
      setReflection('');
      setView('dashboard');
    } catch (e) { console.error("Submit Error:", e); }
  };

  // 4. DERIVED DATA
  const stats = useMemo(() => {
    const weeklyActivity = logs.slice(0, 7);
    return schema.categories.map(cat => {
      const habitStats = cat.habits.map(h => {
        const count = weeklyActivity.reduce((acc, log) => acc + (log.data[h.id] || 0), 0);
        return { ...h, current: count };
      });
      return { ...cat, habits: habitStats };
    });
  }, [logs, schema]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Syncing Sanctuary...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 font-sans max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-100">
      
      {/* --- HEADER --- */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 px-6 py-5 border-b border-slate-50 flex justify-between items-center z-50">
        <div>
          <h1 className="font-black text-xl tracking-tighter text-slate-900 uppercase italic leading-none">Rule of Life</h1>
          <div className="flex items-center space-x-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Live System</span>
          </div>
        </div>
        <button 
          onClick={() => setView(view === 'settings' ? 'dashboard' : 'settings')} 
          className={`p-2.5 rounded-2xl transition-all duration-300 ${view === 'settings' ? 'bg-slate-900 text-white rotate-90 shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-900'}`}
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-5 pt-6 space-y-8 scrollbar-hide">
        
        {/* --- VIEW: DASHBOARD --- */}
        {view === 'dashboard' && (
          <>
            <section className="bg-indigo-600 rounded-[2rem] p-7 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
               <div className="relative z-10">
                 <h2 className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-1">Soul Pulse</h2>
                 <div className="text-3xl font-black mb-1 tracking-tight">Steady Growth</div>
                 <p className="text-indigo-100 text-xs font-medium opacity-80">You've completed {logs.length} reviews.</p>
               </div>
               <TrendingUp className="absolute -right-6 -bottom-6 text-white/10 w-40 h-40 transform rotate-12 group-hover:scale-110 transition-transform duration-700" />
            </section>

            {stats.map(cat => {
              const Icon = ICON_MAP[cat.icon] || Heart;
              return (
                <div key={cat.id} className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-2xl bg-slate-50 text-slate-900 border border-slate-100`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">{cat.label}</h3>
                        <p className="text-[10px] text-slate-400 font-bold italic tracking-tight">{cat.purpose}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {cat.habits.map(habit => {
                      const progress = Math.min(100, (habit.current / habit.target) * 100);
                      return (
                        <div key={habit.id} className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-100/50 group">
                          <div className="flex justify-between items-end mb-2.5">
                            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{habit.name}</span>
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-900">{habit.current}</span>
                              <span className="text-[10px] font-black text-slate-300 ml-1">/ {habit.target}</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ease-out bg-slate-900`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* --- VIEW: INPUT --- */}
        {view === 'input' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
             <div className="text-center pt-4">
               <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Review Period</h2>
               <p className="text-sm text-slate-400 font-medium mt-1">Honest data leads to genuine change.</p>
             </div>
             {schema.categories.map(cat => (
               <div key={cat.id} className="space-y-4">
                 <div className="flex items-center space-x-2 px-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
                   <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">{cat.label}</h3>
                 </div>
                 <div className="space-y-2">
                   {cat.habits.map(habit => (
                     <div key={habit.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group">
                       <span className="text-sm font-bold text-slate-800">{habit.name}</span>
                       <div className="flex items-center space-x-4">
                          <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                            <button 
                              onClick={() => setInputData(p => ({ ...p, [habit.id]: Math.max(0, (p[habit.id] || 0) - 1) }))} 
                              className="w-8 h-8 flex items-center justify-center font-black text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all"
                            >-</button>
                            <span className="w-10 text-center font-black text-sm">{inputData[habit.id] || 0}</span>
                            <button 
                              onClick={() => setInputData(p => ({ ...p, [habit.id]: (p[habit.id] || 0) + 1 }))} 
                              className="w-8 h-8 flex items-center justify-center font-black text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all"
                            >+</button>
                          </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
             <div className="space-y-3">
               <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 px-2">Reflections</h3>
               <textarea 
                className="w-full p-6 rounded-[2rem] bg-slate-50 border-none text-sm font-medium focus:ring-2 focus:ring-slate-900/5 transition-all outline-none h-40 placeholder:text-slate-300 shadow-inner" 
                placeholder="How was your heart this week?" 
                value={reflection} 
                onChange={e => setReflection(e.target.value)} 
               />
             </div>
             <button 
              onClick={submitLog} 
              className="w-full py-6 rounded-[2rem] bg-slate-900 text-white font-black uppercase tracking-[0.1em] shadow-2xl shadow-slate-200 transform transition active:scale-95 flex items-center justify-center space-x-3 mb-10"
             >
               <Save size={20} />
               <span>Seal This Review</span>
             </button>
          </div>
        )}

        {/* --- VIEW: SETTINGS --- */}
        {view === 'settings' && (
          <div className="space-y-8 pb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Architect Mode</h2>
              <p className="text-sm text-slate-400 font-medium">Design the structure of your life.</p>
            </div>
            {schema.categories.map((cat, cIdx) => (
              <div key={cat.id} className="bg-slate-50/50 rounded-[2.5rem] p-6 border border-slate-100 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose: {cat.label}</label>
                  <input 
                    type="text" 
                    value={cat.purpose} 
                    onChange={(e) => {
                      const s = { ...schema }; s.categories[cIdx].purpose = e.target.value; setSchema(s); saveSchema(s);
                    }} 
                    className="w-full bg-white p-4 rounded-2xl text-xs font-bold text-slate-700 shadow-sm border-none focus:ring-2 focus:ring-slate-200 transition-all outline-none" 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Habits & Targets</label>
                  {cat.habits.map((h, hIdx) => (
                    <div key={h.id} className="flex space-x-2 items-center">
                      <input 
                        value={h.name} 
                        onChange={(e) => {
                          const s = { ...schema }; s.categories[cIdx].habits[hIdx].name = e.target.value; setSchema(s); saveSchema(s);
                        }} 
                        className="flex-1 bg-white p-3.5 rounded-xl text-xs font-bold border-none shadow-sm outline-none" 
                      />
                      <input 
                        type="number"
                        value={h.target} 
                        onChange={(e) => {
                          const s = { ...schema }; s.categories[cIdx].habits[hIdx].target = parseInt(e.target.value) || 0; setSchema(s); saveSchema(s);
                        }} 
                        className="w-14 bg-white p-3.5 rounded-xl text-xs font-black text-center border-none shadow-sm outline-none" 
                      />
                      <button 
                        onClick={() => {
                          const s = { ...schema }; s.categories[cIdx].habits.splice(hIdx, 1); setSchema(s); saveSchema(s);
                        }}
                        className="text-slate-300 hover:text-rose-500 p-2 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      const s = { ...schema };
                      const newHabit = { id: Date.now().toString(), name: 'New Rhythm', rhythm: 'weekly', target: 5, type: 'count' };
                      s.categories[cIdx].habits.push(newHabit);
                      setSchema(s);
                      saveSchema(s);
                    }}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-all"
                  >
                    + Add Habit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-50 flex justify-around items-center py-6 px-10 pb-10 z-50">
        <button 
          onClick={() => setView('dashboard')} 
          className={`flex flex-col items-center space-y-1.5 transition-all ${view === 'dashboard' ? 'text-slate-900 scale-110' : 'text-slate-300'}`}
        >
          <LayoutDashboard size={24} strokeWidth={view === 'dashboard' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Status</span>
        </button>

        <div className="relative -top-8">
          <button 
            onClick={() => setView('input')} 
            className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:scale-105 active:scale-90 transition-all duration-300"
          >
            {view === 'input' ? <CheckCircle2 size={32} /> : <PlusCircle size={32} />}
          </button>
        </div>

        <button 
          onClick={() => setView('settings')} 
          className={`flex flex-col items-center space-y-1.5 transition-all ${view === 'settings' ? 'text-slate-900 scale-110' : 'text-slate-300'}`}
        >
          <Settings size={24} strokeWidth={view === 'settings' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Architect</span>
        </button>
      </div>
    </div>
  );
}
