import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
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
  CheckCircle2
} from 'lucide-react';

// --- Safe Environment Variable Fetching ---
const getEnv = (key) => {
  try {
    // Check Vite/Vercel standard
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
    // Check internal environment provided by the platform
    if (key === 'VITE_FIREBASE_CONFIG' && typeof __firebase_config !== 'undefined') {
      return __firebase_config;
    }
    if (key === 'VITE_APP_ID' && typeof __app_id !== 'undefined') {
      return __app_id;
    }
  } catch (e) { /* fallback */ }
  return null;
};

// --- Firebase Initialization Logic ---
const firebaseConfigRaw = getEnv('VITE_FIREBASE_CONFIG');
let firebaseConfig = null;

if (firebaseConfigRaw) {
  try {
    firebaseConfig = typeof firebaseConfigRaw === 'string' ? JSON.parse(firebaseConfigRaw) : firebaseConfigRaw;
  } catch (e) {
    console.error("Failed to parse Firebase Config JSON", e);
  }
}

let app, auth, db;
const appId = getEnv('VITE_APP_ID') || 'spire-rule-of-life';

if (firebaseConfig && firebaseConfig.apiKey) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.error("Firebase Config missing! Add VITE_FIREBASE_CONFIG to your environment variables.");
}

// --- Default Data ---
const INITIAL_SCHEMA = {
  categories: [
    { id: 'spiritual', label: 'Spiritual', icon: 'Heart', color: 'indigo', purpose: 'Connection with God', habits: [{ id: 's1', name: 'Scripture', rhythm: 'weekly', target: 7, type: 'count' }] },
    { id: 'physical', label: 'Physical', icon: 'Dumbbell', color: 'emerald', purpose: 'Health & Vitality', habits: [{ id: 'p1', name: 'Exercise', rhythm: 'weekly', target: 5, type: 'count' }] },
    { id: 'intellectual', label: 'Intellectual', icon: 'Brain', color: 'sky', purpose: 'Learning', habits: [{ id: 'i1', name: 'Reading', rhythm: 'weekly', target: 5, type: 'count' }] },
    { id: 'relational', label: 'Relational', icon: 'Users', color: 'rose', purpose: 'Community', habits: [{ id: 'r1', name: 'Family Time', rhythm: 'weekly', target: 7, type: 'count' }] },
    { id: 'emotional', label: 'Emotional', icon: 'Smile', color: 'amber', purpose: 'Inner Peace', habits: [{ id: 'e1', name: 'Reflection', rhythm: 'weekly', target: 1, type: 'boolean' }] },
    { id: 'career', label: 'Career', icon: 'Briefcase', color: 'slate', purpose: 'Impact', habits: [{ id: 'c1', name: 'Deep Work', rhythm: 'weekly', target: 10, type: 'count' }] }
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

  // 1. Auth Lifecycle
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error("Auth error", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Sync Lifecycle
  useEffect(() => {
    if (!user || !db) return;
    const schemaDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'schema');
    const logsQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'));

    const unsubSchema = onSnapshot(schemaDoc, (d) => {
      if (d.exists()) setSchema(d.data());
      else setDoc(schemaDoc, INITIAL_SCHEMA);
    }, (err) => console.error("Firestore schema error", err));

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setLogs(data);
      setLoading(false);
    }, (err) => console.error("Firestore logs error", err));

    return () => { unsubSchema(); unsubLogs(); };
  }, [user]);

  const saveSchema = async (newSchema) => {
    if (!user || !db) return;
    const schemaDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'schema');
    await setDoc(schemaDoc, newSchema);
  };

  const submitLog = async () => {
    if (!user || !db) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'), {
      data: inputData,
      reflection,
      timestamp: serverTimestamp()
    });
    setInputData({});
    setReflection('');
    setView('dashboard');
  };

  // Guard: If config is missing, show a user-friendly setup guide
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-8 font-sans">
        <div className="max-w-sm text-center space-y-4">
          <div className="bg-amber-100 text-amber-700 p-4 rounded-2xl font-bold">
            Configuration Required
          </div>
          <p className="text-sm text-slate-500">
            Please add your <strong>VITE_FIREBASE_CONFIG</strong> (as a JSON string) to your environment variables to activate the database.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-sans">Syncing with SPIRE...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-200">
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
        <div>
          <h1 className="font-black text-xl tracking-tight text-slate-800 italic uppercase">Rule of Life</h1>
          <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">SPIRE Pilot</p>
        </div>
        <button onClick={() => setView(view === 'settings' ? 'dashboard' : 'settings')} className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white transition">
          <Settings size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-6">
        {view === 'dashboard' && (
          <>
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Weekly Pulse</h2>
               <div className="text-3xl font-black mb-4">Steady & Slow</div>
               <div className="absolute -right-8 -bottom-8 text-white/5 rotate-12">
                 <LayoutDashboard size={140} />
               </div>
            </div>

            {schema.categories.map(cat => {
              const Icon = ICON_MAP[cat.icon] || Heart;
              return (
                <div key={cat.id} className="space-y-3">
                  <div className="flex items-center space-x-3 px-2">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-600"><Icon size={20} /></div>
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wider">{cat.label}</h3>
                      <p className="text-[11px] text-slate-400 font-medium italic">{cat.purpose}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {cat.habits.map(habit => (
                      <div key={habit.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{habit.name}</span>
                        <div className="text-right">
                           <div className="text-xs font-bold text-slate-400 uppercase">{habit.rhythm}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {view === 'input' && (
          <div className="space-y-8">
             <div className="text-center"><h2 className="text-2xl font-black text-slate-800">Review</h2></div>
             {schema.categories.map(cat => (
               <div key={cat.id} className="space-y-4">
                 <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 border-b pb-1">{cat.label}</h3>
                 {cat.habits.map(habit => (
                   <div key={habit.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
                     <span className="text-sm font-bold">{habit.name}</span>
                     <button onClick={() => setInputData(p => ({ ...p, [habit.id]: p[habit.id] ? 0 : 1 }))} className={`p-2 rounded-xl transition ${inputData[habit.id] ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>
                       <CheckCircle2 size={24} />
                     </button>
                   </div>
                 ))}
               </div>
             ))}
             <textarea className="w-full p-4 rounded-3xl bg-white border border-slate-100 h-32 outline-none" placeholder="Notes on your soul..." value={reflection} onChange={e => setReflection(e.target.value)} />
             <button onClick={submitLog} className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black uppercase shadow-xl">Save Entry</button>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black">Architect Mode</h2>
            {schema.categories.map((cat, cIdx) => (
              <div key={cat.id} className="bg-white rounded-3xl p-5 border border-slate-100 space-y-4">
                <input type="text" value={cat.purpose} onChange={(e) => {
                    const s = { ...schema }; s.categories[cIdx].purpose = e.target.value; setSchema(s); saveSchema(s);
                  }} className="w-full bg-slate-50 p-3 rounded-xl text-sm font-medium outline-none" />
                {cat.habits.map((h, hIdx) => (
                   <div key={h.id} className="flex space-x-2 items-center">
                     <input value={h.name} onChange={(e) => {
                       const s = { ...schema }; s.categories[cIdx].habits[hIdx].name = e.target.value; setSchema(s); saveSchema(s);
                     }} className="flex-1 bg-slate-50 p-2 rounded-lg text-sm" />
                     <button onClick={() => {
                       const s = { ...schema }; s.categories[cIdx].habits.splice(hIdx, 1); setSchema(s); saveSchema(s);
                     }}><Trash2 size={16} className="text-slate-300" /></button>
                   </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-around items-center py-6 px-8 z-30">
        <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-slate-900' : 'text-slate-300'}><LayoutDashboard size={24} /></button>
        <button onClick={() => setView('input')} className="w-14 h-14 -top-6 relative rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xl"><PlusCircle size={28} /></button>
        <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-slate-900' : 'text-slate-300'}><Settings size={24} /></button>
      </div>
    </div>
  );
}
