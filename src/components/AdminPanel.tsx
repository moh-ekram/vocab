import React, { useState, useEffect } from 'react';
import { 
  db, 
  auth 
} from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { VocabularyWord, UserProgress } from '../types';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  ChevronRight, 
  Calendar, 
  Flame, 
  TrendingUp, 
  Award, 
  Info, 
  RefreshCw, 
  Database, 
  HeartCrack, 
  User as UserIcon, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  Clock, 
  Sliders,
  ChevronDown
} from 'lucide-react';

interface FirestoreUserDoc {
  id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  progress?: Record<string, UserProgress>;
  goal?: {
    dailyTarget?: number;
    streak?: number;
    lastStudyDate?: string;
    history?: Record<string, any>;
  };
  synonymProgress?: Record<string, { correct: boolean; updatedAt: string }>;
  settings?: any;
}

interface AdminPanelProps {
  words: VocabularyWord[];
}

enum OperationType {
  LIST = 'list',
  GET = 'get',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function getProgressValues(progObj: Record<string, UserProgress> | undefined): UserProgress[] {
  return Object.values(progObj || {}) as UserProgress[];
}

function getProgressEntries(progObj: Record<string, UserProgress> | undefined): [string, UserProgress][] {
  return Object.entries(progObj || {}) as [string, UserProgress][];
}

export default function AdminPanel({ words }: AdminPanelProps) {
  const [users, setUsers] = useState<FirestoreUserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'email' | 'streak' | 'progress' | 'lastActive'>('lastActive');
  const [selectedUser, setSelectedUser] = useState<FirestoreUserDoc | null>(null);
  const [activeUserTab, setActiveUserTab] = useState<'progress' | 'analytics' | 'settings'>('progress');
  const [activeWordFilter, setActiveWordFilter] = useState<'all' | 'know' | 'confusion' | 'dont_know'>('all');

  // Hardest words statistics across all users
  const [hardestWords, setHardestWords] = useState<{ word: VocabularyWord; count: number; type: 'confusion' | 'dont_know' }[]>([]);

  const fetchUsersData = async () => {
    setLoading(true);
    setError(null);
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const fetchedUsers: FirestoreUserDoc[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUsers.push({
          id: doc.id,
          email: data.email || 'unknown@user.com',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          progress: data.progress || {},
          goal: data.goal || {},
          synonymProgress: data.synonymProgress || {},
          settings: data.settings || {}
        });
      });
      setUsers(fetchedUsers);
      calculateHardestWords(fetchedUsers);
    } catch (err) {
      setError('ফায়ারস্টোর থেকে ইউজার ডাটা লোড করতে ব্যর্থ হয়েছে। ফায়ারবেজ সিকিউরিটি রুলস চেক করুন।');
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (e) {
        // Suppress or handle rethrown JSON error
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  const calculateHardestWords = (userList: FirestoreUserDoc[]) => {
    const wordCounts: Record<string, { count: number; type: 'confusion' | 'dont_know' }> = {};
    
    userList.forEach(u => {
      if (u.progress) {
        getProgressEntries(u.progress).forEach(([wordId, prog]) => {
          if (prog.status === 'dont_know' || prog.status === 'confusion') {
            const existing = wordCounts[wordId];
            if (!existing || prog.status === 'dont_know') {
              wordCounts[wordId] = {
                count: (existing?.count || 0) + 1,
                type: prog.status
              };
            } else {
              wordCounts[wordId].count += 1;
            }
          }
        });
      }
    });

    const sorted = Object.entries(wordCounts)
      .map(([wordId, info]) => {
        const foundWord = words.find(w => w.id === wordId);
        return {
          word: foundWord!,
          count: info.count,
          type: info.type
        };
      })
      .filter(item => item.word !== undefined)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setHardestWords(sorted);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`কপি করা হয়েছে: ${text}`);
  };

  // Processing users stats
  const totalUsers = users.length;
  
  const averageStreak = totalUsers > 0 
    ? Math.round(users.reduce((acc, curr) => acc + (curr.goal?.streak || 0), 0) / totalUsers)
    : 0;

  const topStreak = totalUsers > 0
    ? Math.max(...users.map(u => u.goal?.streak || 0))
    : 0;

  const totalWordsKnownAll = users.reduce((acc, u) => {
    if (!u.progress) return acc;
    return acc + getProgressValues(u.progress).filter(p => p.status === 'know').length;
  }, 0);

  const averageWordsKnown = totalUsers > 0 ? Math.round(totalWordsKnownAll / totalUsers) : 0;

  // Filter & Sort Users
  const filteredUsers = users
    .filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'streak') {
        return (b.goal?.streak || 0) - (a.goal?.streak || 0);
      } else if (sortBy === 'progress') {
        const aKnown = getProgressValues(a.progress).filter(p => p.status === 'know').length;
        const bKnown = getProgressValues(b.progress).filter(p => p.status === 'know').length;
        return bKnown - aKnown;
      } else {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      }
    });

  return (
    <div className="space-y-8 font-sans" id="admin-panel-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-500/10" id="admin-header-banner">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute left-1/3 bottom-0 -mb-10 w-52 h-52 bg-emerald-500/15 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 rounded-full text-indigo-300 text-xs font-bold border border-indigo-400/20">
              <ShieldCheck className="w-3.5 h-3.5" /> সিস্টেম এডমিন ড্যাশবোর্ড
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">ভোকাবুলারি মেমোরি কন্ট্রোল প্যানেল</h2>
            <p className="text-sm text-slate-300 max-w-xl">
              ফায়ারবেজ ক্লাউড ফায়ারস্টোরে সংরক্ষিত ব্যবহারকারীদের প্রগ্রেস ট্র্যাকিং, রিয়েল-টাইম ডাটাবেজ হেলথ এবং কঠিন শব্দসমূহের সেন্ট্রাল অ্যানালিটিক্স।
            </p>
          </div>
          
          <button 
            onClick={fetchUsersData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 transition cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>ডাটা রিফ্রেশ করুন</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="admin-stats-row">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">মোট ইউজার</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{totalUsers}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">ফায়ারস্টোর ডাটাবেজ</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">গড় স্ট্রিক</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{averageStreak} দিন</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">সর্বোচ্চ স্ট্রিক: {topStreak} দিন</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">গড় আয়ত্তাধীন শব্দ</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{averageWordsKnown} টি</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">প্রতি ইউজার (পারি)</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">ফায়ারবেজ ফ্রি টায়ার</span>
            <span className="text-base font-black text-emerald-400 truncate block">১০০% অপ্টিমাইজড</span>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">অফলাইন পারসিস্টেন্স অ্যাক্টিভ</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Directory & Hardest Words */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Directory Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden lg:col-span-2 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">ব্যবহারকারী ডিরেক্টরি</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">সকল নিবন্ধিত শিক্ষার্থীদের তালিকা এবং পড়ার সংক্ষিপ্ত বিবরণী</p>
            </div>

            {/* Filter Sliders */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ইমেইল দিয়ে খুঁজুন..."
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs rounded-xl w-48 transition font-semibold"
                />
              </div>

              {/* Sorting trigger */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-600">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 cursor-pointer pr-1"
                >
                  <option value="lastActive">সর্বশেষ সক্রিয়</option>
                  <option value="email">বর্ণানুক্রমিক</option>
                  <option value="streak">স্ট্রিক (🔥)</option>
                  <option value="progress">অগ্রগতি (পারি)</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-bold">ফায়ারস্টোর থেকে রিয়েল-টাইম তথ্য সংগ্রহ করা হচ্ছে...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500 flex flex-col items-center justify-center gap-3">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-xs font-bold">{error}</p>
              <button 
                onClick={fetchUsersData}
                className="px-4 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100 hover:bg-rose-100 transition"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Users className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold">কোনো ব্যবহারকারী পাওয়া যায়নি!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-4 px-6 text-left">ব্যবহারকারী</th>
                    <th className="py-4 px-3 text-center">স্ট্রিক (Streak)</th>
                    <th className="py-4 px-4 text-left">অগ্রগতি (শব্দাবলি)</th>
                    <th className="py-4 px-4 text-right">শেষ সিঙ্ক</th>
                    <th className="py-4 px-4 text-center">বিশদ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-sans">
                  {filteredUsers.map(u => {
                    // Calc user metrics
                    const progValues = getProgressValues(u.progress);
                    const totalRated = progValues.length;
                    const knowCount = progValues.filter(p => p.status === 'know').length;
                    const confusionCount = progValues.filter(p => p.status === 'confusion').length;
                    const dontKnowCount = progValues.filter(p => p.status === 'dont_know').length;
                    const percentKnow = Math.round((knowCount / 1110) * 100) || 0;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold border border-slate-200 text-xs flex-shrink-0">
                              {u.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 truncate" title={u.email}>
                                {u.email.split('@')[0]}
                              </p>
                              <span className="text-[10px] text-slate-400 font-semibold block truncate" title={u.email}>
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-full font-mono text-[11px]">
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            <span>{u.goal?.streak || 0} দিন</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1 w-32 sm:w-44">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                              <span>{knowCount} টি (পারি)</span>
                              <span>{percentKnow}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (knowCount/1110)*100)}%` }} title="পারি"></div>
                              <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, (confusionCount/1110)*100)}%` }} title="কনফিউশন"></div>
                              <div className="h-full bg-rose-400" style={{ width: `${Math.min(100, (dontKnowCount/1110)*100)}%` }} title="পারি না"></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-slate-500 font-mono text-[10px] font-bold">
                            {u.updatedAt ? (
                              <span className="flex items-center justify-end gap-1 text-slate-600">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Date(u.updatedAt).toLocaleDateString('bn-BD', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : (
                              <span className="text-slate-400">অজানা</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button 
                            onClick={() => {
                              setSelectedUser(u);
                              setActiveUserTab('progress');
                              setActiveWordFilter('all');
                            }}
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition border border-transparent hover:border-indigo-100 cursor-pointer inline-flex items-center"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hardest Vocabulary Words Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <HeartCrack className="w-5 h-5 text-rose-500" />
                <span>শীর্ষ ১০ কঠিন শব্দ</span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">সবচেয়ে বেশি সংখ্যক ব্যবহারকারী যে শব্দগুলোকে কঠিন চিহ্নিত করেছেন</p>
            </div>

            {loading ? (
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="h-10 bg-slate-50 animate-pulse rounded-xl"></div>
                ))}
              </div>
            ) : hardestWords.length === 0 ? (
              <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <Info className="w-6 h-6 text-slate-300" />
                <p className="text-xs font-bold">পর্যাপ্ত ডেটা পাওয়া যায়নি!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {hardestWords.map((item, idx) => (
                  <div key={item.word.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-sm hover:border-slate-200 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 font-mono text-sm tracking-tight">{item.word.word}</span>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded font-bold">G-{item.word.group}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate font-semibold mt-0.5">{item.word.meaning}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-black text-slate-700 font-mono">{item.count} বার</div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                        item.type === 'dont_know' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {item.type === 'dont_know' ? 'পারি না' : 'কনফিউশন'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spark Tier Optimizations Guideline Card */}
          <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-sm">Spark Plan এবং কোটা মনিটর</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">ফ্রি টায়ারে রিয়েল-টাইম ডাটাবেজ ব্যবহারে সেরা কর্মক্ষমতা নিশ্চিত করা হয়েছে:</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs font-medium text-slate-400">
              <div className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></div>
                <p><strong className="text-slate-200">১০০% অপ্টিমাইজড কুয়েরি:</strong> অতিরিক্ত রিড এড়াতে ইউজার রিলেটেড কুয়েরি ও সিঙ্গেল নোড ডাটা স্ট্রাকচার ব্যবহৃত হচ্ছে।</p>
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></div>
                <p><strong className="text-slate-200">লোকাল অফলাইন ক্যাশিং:</strong> ইন্ডেক্সডডিবি (IndexedDB) দিয়ে অফলাইনে প্রগ্রেস সেভ হচ্ছে যা সার্ভার কল কমায়।</p>
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></div>
                <p><strong className="text-slate-200">স্মার্ট ডিবান্সড সিঙ্ক:</strong> প্রতিটি শব্দ পড়ার পর সাথে সাথে ফায়ারস্টোরে রিকোয়েস্ট না পাঠিয়ে ১ সেকেন্ড ডিবান্স করে পাঠানো হয়।</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed font-semibold">
              দৈনিক ফ্রি কোটা: ৫০,০০০ রিড, ২০,০০০ রাইট ও ২০,০০০ ডিলিট। অ্যাপটি সাধারণ ব্যবহারের ক্ষেত্রে দৈনিক কোটা সীমার নিচে স্বাচ্ছন্দ্যে চলতে সক্ষম।
            </div>
          </div>
        </div>
      </div>

      {/* User Details Slideover / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end z-50 animate-fade-in" id="user-details-modal">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl relative animate-slide-left font-sans">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-black text-sm">
                  {selectedUser.email[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                    <span>{selectedUser.email.split('@')[0]}</span>
                    <button 
                      onClick={() => copyToClipboard(selectedUser.email)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition" 
                      title="ইমেইল কপি করুন"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold font-mono uppercase tracking-wide">ID: {selectedUser.id}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 px-6 bg-slate-50 text-xs font-bold text-slate-500 gap-6">
              <button 
                onClick={() => setActiveUserTab('progress')}
                className={`py-3.5 border-b-2 transition outline-none cursor-pointer ${
                  activeUserTab === 'progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                }`}
              >
                পড়াশোনার অগ্রগতি (Progress)
              </button>
              <button 
                onClick={() => setActiveUserTab('analytics')}
                className={`py-3.5 border-b-2 transition outline-none cursor-pointer ${
                  activeUserTab === 'analytics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                }`}
              >
                টার্গেট ও প্ল্যানার (Goals)
              </button>
              <button 
                onClick={() => setActiveUserTab('settings')}
                className={`py-3.5 border-b-2 transition outline-none cursor-pointer ${
                  activeUserTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                }`}
              >
                ব্যবহারকারীর সেটিংস
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeUserTab === 'progress' && (
                <div className="space-y-6">
                  {/* Progress Summary Mini-Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-emerald-800/80 font-bold block">পারি (Know)</span>
                      <span className="text-xl font-black text-emerald-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'know').length}
                      </span>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-amber-800/80 font-bold block">কনফিউশন (Confusion)</span>
                      <span className="text-xl font-black text-amber-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'confusion').length}
                      </span>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-rose-800/80 font-bold block">পারি না (Don't Know)</span>
                      <span className="text-xl font-black text-rose-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'dont_know').length}
                      </span>
                    </div>
                  </div>

                  {/* Word Filter Tabs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-800 text-sm">শব্দভিত্তিক মূল্যায়ন বিবরণী</h4>
                      
                      <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold text-slate-500 gap-1">
                        {[
                          { key: 'all' as const, label: 'সব' },
                          { key: 'know' as const, label: 'পারি' },
                          { key: 'confusion' as const, label: 'কনফিউশন' },
                          { key: 'dont_know' as const, label: 'পারি না' }
                        ].map(f => (
                          <button
                            key={f.key}
                            onClick={() => setActiveWordFilter(f.key)}
                            className={`px-2.5 py-1 rounded-lg transition outline-none cursor-pointer ${
                              activeWordFilter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Word List Render */}
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden max-h-80 overflow-y-auto">
                      {getProgressEntries(selectedUser.progress)
                        .filter(([_, p]) => activeWordFilter === 'all' || p.status === activeWordFilter)
                        .length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-bold text-xs">
                            এই ক্যাটাগরিতে কোনো শব্দ নেই।
                          </div>
                        ) : (
                          getProgressEntries(selectedUser.progress)
                            .filter(([_, p]) => activeWordFilter === 'all' || p.status === activeWordFilter)
                            .map(([wordId, p]) => {
                              const w = words.find(item => item.id === wordId);
                              if (!w) return null;
                              return (
                                <div key={wordId} className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between transition">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-slate-800">{w.word}</span>
                                      <span className="text-[9px] text-slate-400 font-bold">গ্রুপ {w.group}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{w.meaning}</p>
                                    {p.notes && (
                                      <p className="text-[10px] text-indigo-600 font-medium italic mt-1 bg-indigo-50/50 px-2 py-1 rounded">
                                        নোট: {p.notes}
                                      </p>
                                    )}
                                  </div>

                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                                    p.status === 'know' ? 'bg-emerald-50 text-emerald-700' :
                                    p.status === 'confusion' ? 'bg-amber-50 text-amber-700' :
                                    'bg-rose-50 text-rose-700'
                                  }`}>
                                    {p.status === 'know' && <CheckCircle className="w-3 h-3" />}
                                    {p.status === 'confusion' && <AlertTriangle className="w-3 h-3" />}
                                    {p.status === 'dont_know' && <XCircle className="w-3 h-3" />}
                                    {p.status === 'know' ? 'পারি' : p.status === 'confusion' ? 'কনফিউশন' : 'পারি না'}
                                  </span>
                                </div>
                              );
                            })
                        )}
                    </div>
                  </div>
                </div>
              )}

              {activeUserTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Study Streak & Target */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">দৈনিক পড়াশোনার লক্ষ্য</span>
                      <span className="text-xl font-black text-slate-800 font-mono">{selectedUser.goal?.dailyTarget || 15} টি শব্দ</span>
                    </div>

                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-2xl text-amber-800">
                      <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
                      <div>
                        <span className="text-[10px] text-amber-700 font-bold block">বর্তমান স্ট্রিক</span>
                        <span className="text-base font-black font-mono">{selectedUser.goal?.streak || 0} দিন</span>
                      </div>
                    </div>
                  </div>

                  {/* Study History Days list */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      <span>পড়াশোনার দিনলিপি (Study History)</span>
                    </h4>

                    {!selectedUser.goal?.history || Object.keys(selectedUser.goal.history).length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl text-xs">
                        কোনো দিনলিপি রেকর্ড করা হয়নি।
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(selectedUser.goal.history)
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([dateStr, count]) => (
                            <div key={dateStr} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                              <span className="text-slate-600 font-bold text-xs">{dateStr}</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded-lg font-black">
                                +{Number(count)} শব্দ
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeUserTab === 'settings' && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-sm">অ্যাপ কনফিগারেশন সেটিংস</h4>
                  
                  <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                    <div className="p-4 flex items-center justify-between">
                      <span>ডিফল্ট ফ্ল্যাশকার্ড ক্রম</span>
                      <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-extrabold uppercase text-[10px] tracking-wider">
                        {selectedUser.settings?.defaultFlashcardOrder || 'random'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>অটো-প্লে অডিও উচ্চারণ</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        selectedUser.settings?.autoPlayAudio ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedUser.settings?.autoPlayAudio ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>কুইজের শব্দসংখ্যা</span>
                      <span className="bg-indigo-50 text-indigo-700 font-mono font-black px-3 py-1 rounded-lg">
                        {selectedUser.settings?.quizLength || 10} টি
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>ফ্ল্যাশকার্ড রোটেশন অ্যানিমেশন</span>
                      <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-bold font-mono">
                        {selectedUser.settings?.flashcardAnimation || 'flip-h'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
