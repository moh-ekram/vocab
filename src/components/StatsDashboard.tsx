import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, StudyGoal, Course } from '../types';
import { Award, BookOpen, Flame, CheckCircle, AlertTriangle, XCircle, HelpCircle, Trophy, TrendingUp, Search, Plus, Sparkles, Check, ChevronRight, X, Crown, RefreshCw, KeyRound, Copy } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';

interface StatsDashboardProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  goal: StudyGoal;
  setGoal: React.Dispatch<React.SetStateAction<StudyGoal>>;
  onSelectGroup: (group: number | string) => void;
  allCourses: Course[];
  enrolledCourseIds: string[];
  activeCourseId: string;
  setActiveCourseId: (id: string) => void;
  setEnrolledCourseIds: React.Dispatch<React.SetStateAction<string[]>>;
  onImportCourse: (course: Course) => void;
  onSelectTab?: (tab: any) => void;
}

export default function StatsDashboard({ 
  words, 
  progress, 
  goal, 
  setGoal, 
  onSelectGroup,
  allCourses,
  enrolledCourseIds,
  activeCourseId,
  setActiveCourseId,
  setEnrolledCourseIds,
  onImportCourse,
  onSelectTab
}: StatsDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // --- COURSE CODE IMPORT STATES & LOGIC ---
  const [inputCourseCode, setInputCourseCode] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleImportByCode = async () => {
    const rawCode = inputCourseCode.trim();
    if (!rawCode) {
      setImportError('অনুগ্রহ করে একটি কোর্স কোড লিখুন।');
      return;
    }
    
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    const codeLower = rawCode.toLowerCase();

    try {
      // First, check if it's already in allCourses (exact or lowercase)
      const existing = allCourses.find(c => c.id === rawCode || c.id === codeLower);
      if (existing) {
        onImportCourse(existing);
        setImportSuccess(`সফলভাবে "${existing.title}" কোর্সে যুক্ত হয়েছেন!`);
        setInputCourseCode('');
        setTimeout(() => {
          setShowEnrollModal(false);
          setImportSuccess(null);
        }, 1500);
        return;
      }

      // Fetch from Firestore (exact first, then fallback to lowercase)
      let courseDocRef = doc(db, 'courses', rawCode);
      let docSnap = await getDoc(courseDocRef);

      if (!docSnap.exists() && rawCode !== codeLower) {
        courseDocRef = doc(db, 'courses', codeLower);
        docSnap = await getDoc(courseDocRef);
      }

      if (docSnap.exists()) {
        const courseData = docSnap.data() as Course;
        onImportCourse(courseData);
        setImportSuccess(`সফলভাবে "${courseData.title}" কোর্সটি ক্লাউড থেকে ইমপোর্ট করা হয়েছে!`);
        setInputCourseCode('');
        setTimeout(() => {
          setShowEnrollModal(false);
          setImportSuccess(null);
        }, 1500);
      } else {
        setImportError('এই কোডের কোনো কোর্স পাওয়া যায়নি। অনুগ্রহ করে সঠিক কোর্স কোড দিন।');
      }
    } catch (err) {
      console.error('Error importing course by code:', err);
      setImportError('কোর্স ইমপোর্ট করতে ব্যর্থ হয়েছে। নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।');
    } finally {
      setIsImporting(false);
    }
  };

  // --- LEADERBOARD LOGIC & STATES ---
  const [dbLeaderboard, setDbLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const fetchLeaderboard = async (forceRefetch = false) => {
    if (!forceRefetch) {
      const cached = localStorage.getItem('vocab_memorizer_cached_dashboard_leaderboard');
      const cachedTime = localStorage.getItem('vocab_memorizer_cached_dashboard_leaderboard_timestamp');
      if (cached && cachedTime) {
        const ageInMs = Date.now() - Number(cachedTime);
        const fifteenMinutesInMs = 15 * 60 * 1000;
        if (ageInMs < fifteenMinutesInMs) {
          try {
            setDbLeaderboard(JSON.parse(cached));
            return;
          } catch (e) {
            console.error("Failed to parse cached dashboard leaderboard:", e);
          }
        }
      }
    }

    setLoadingLeaderboard(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, limit(30));
      const snapshot = await getDocs(q);
      const fetchedList: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const progressObj = data.progress || {};
        let knowWordCount = 0;
        Object.values(progressObj).forEach((p: any) => {
          if (p?.status === 'know') knowWordCount++;
        });
        fetchedList.push({
          id: doc.id,
          email: data.email || 'Anonymous',
          displayName: data.displayName || data.email?.split('@')[0] || 'শিক্ষার্থী',
          streak: data.goal?.streak || 0,
          knowCount: knowWordCount,
          isCurrentUser: auth.currentUser?.uid === doc.id
        });
      });
      setDbLeaderboard(fetchedList);
      localStorage.setItem('vocab_memorizer_cached_dashboard_leaderboard', JSON.stringify(fetchedList));
      localStorage.setItem('vocab_memorizer_cached_dashboard_leaderboard_timestamp', String(Date.now()));
    } catch (err) {
      console.error("Error fetching leaderboard from Firestore:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(false);
  }, []);

  // 1. Calculate overall counts
  const totalWords = words.length;
  let knowCount = 0;
  let dontKnowCount = 0;
  let confusionCount = 0;
  let unratedCount = 0;

  words.forEach(w => {
    const status = progress[w.id]?.status || 'unrated';
    if (status === 'know') knowCount++;
    else if (status === 'dont_know') dontKnowCount++;
    else if (status === 'confusion') confusionCount++;
    else unratedCount++;
  });

  const overallCompleteness = totalWords > 0 ? Math.round((knowCount / totalWords) * 100) : 0;

  // Compute final merged leaderboard using ONLY real users
  const currentUserId = auth.currentUser?.uid || 'current-local';
  const currentUserStats = {
    id: currentUserId,
    displayName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'আপনি (You)',
    email: auth.currentUser?.email || 'local-user',
    streak: goal.streak || 1,
    knowCount: knowCount,
    isCurrentUser: true,
    isMock: false
  };

  const otherDbUsers = dbLeaderboard.filter(user => user.id !== currentUserId);
  const combinedLeaderboard = [
    ...otherDbUsers,
    currentUserStats
  ];

  const sortedLeaderboard = combinedLeaderboard.sort((a, b) => {
    if (b.knowCount !== a.knowCount) {
      return b.knowCount - a.knowCount;
    }
    return b.streak - a.streak;
  });

  // 2. Group wise statistics (dynamic number of groups based on current words list)
  const uniqueGroups = React.useMemo(() => {
    const grps = new Set<string | number>();
    words.forEach(w => {
      if (w.group !== undefined && w.group !== null) {
        grps.add(w.group);
      }
    });
    return Array.from(grps).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b), 'bn');
    });
  }, [words]);

  const groupStats = React.useMemo(() => {
    return uniqueGroups.map(gVal => {
      const groupWords = words.filter(w => w.group === gVal);
      const total = groupWords.length;
      let groupKnow = 0;
      let groupDontKnow = 0;
      let groupConfusion = 0;

      groupWords.forEach(w => {
        const status = progress[w.id]?.status || 'unrated';
        if (status === 'know') groupKnow++;
        else if (status === 'dont_know') groupDontKnow++;
        else if (status === 'confusion') groupConfusion++;
      });

      const completionPercent = total > 0 ? Math.round((groupKnow / total) * 100) : 0;

      return {
        group: gVal,
        total,
        know: groupKnow,
        dontKnow: groupDontKnow,
        confusion: groupConfusion,
        percent: completionPercent
      };
    }).filter(g => g.total > 0);
  }, [uniqueGroups, words, progress]);

  // Filter groups
  const filteredGroups = groupStats.filter(g => {
    if (!searchTerm) return true;
    return `গ্রুপ ${g.group}`.includes(searchTerm) || g.group.toString() === searchTerm;
  });

  // Calculate today's study progress
  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const todayStr = getTodayString();
  const wordsStudiedToday = goal.history[todayStr] || 0;
  const progressPercent = Math.min(100, Math.round((wordsStudiedToday / (goal.dailyTarget || 1)) * 100));

  const last7DaysData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const formattedDate = d.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' });
    return {
      date: dateStr,
      label: formattedDate,
      count: goal.history?.[dateStr] || 0,
      target: goal.dailyTarget || 20,
    };
  });

  // Motion variants for staggered animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="space-y-8" 
      id="stats-dashboard-container"
    >
      {/* Top Banner with Streak & Daily Target */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-indigo-950/15 relative overflow-hidden" 
        id="dashboard-welcome-banner"
      >
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black font-sans tracking-tight">আপনার শব্দভাণ্ডার ড্যাশবোর্ড</h2>
            <p className="text-indigo-200 text-sm md:text-base font-sans font-medium">
              ৩৭টি গ্রুপ জুড়ে আপনার শেখার অগ্রগতি ট্র্যাক করুন এবং ভোকাবুলারি আয়ত্তে আনুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Streak card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-white/10 shadow-xs"
            >
              <div className="p-2 bg-amber-400 rounded-xl text-amber-950 animate-pulse">
                <Flame className="w-6 h-6 fill-current" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-sans">অ্যাক্টিভ স্ট্রিক</p>
                <p className="text-xl font-black font-sans">{goal.streak} দিন</p>
              </div>
            </motion.div>

            {/* Daily Goal card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-white/10 shadow-xs"
            >
              <div className="p-2 bg-indigo-500 rounded-xl text-white">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-sans">আজকের লক্ষ্য ({wordsStudiedToday}/{goal.dailyTarget})</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black font-sans">{progressPercent}%</p>
                  <div className="w-20 bg-indigo-950/60 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="bg-indigo-400 h-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Course Enrollment & Active Course Selection */}
      <motion.div variants={itemVariants} className="space-y-4" id="dashboard-courses-section">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>আমার এনরোলড কোর্সসমূহ (My Courses)</span>
          </h3>
          <button
            onClick={() => setShowEnrollModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/85 text-indigo-600 font-extrabold text-xs rounded-xl transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>নতুন কোর্স যোগ করুন</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCourses.filter(c => enrolledCourseIds.includes(c.id)).map(c => {
            const isActive = activeCourseId === c.id;
            const courseWords = c.words || [];
            const courseKnowCount = courseWords.filter(w => progress[w.id]?.status === 'know').length;
            const courseDontKnowCount = courseWords.filter(w => progress[w.id]?.status === 'dont_know').length;
            const courseConfusionCount = courseWords.filter(w => progress[w.id]?.status === 'confusion').length;
            const courseUnratedCount = courseWords.length - courseKnowCount - courseDontKnowCount - courseConfusionCount;

            const coursePercent = courseWords.length > 0 ? Math.round((courseKnowCount / courseWords.length) * 100) : 0;

            return (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => setActiveCourseId(c.id)}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-4 min-h-[112px] h-auto py-4 ${
                  isActive
                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/25'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Left Side: Title and Green/Indigo Status Tag */}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
                  <h4 className={`font-black tracking-tight leading-snug line-clamp-2 text-base md:text-lg lg:text-xl ${isActive ? 'text-white' : 'text-slate-850'}`} title={c.title}>
                    {c.title}
                  </h4>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {isActive ? (
                      <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 bg-white text-emerald-600 font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                        <Check className="w-2.5 h-2.5" /> সক্রিয়
                      </span>
                    ) : (
                      <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs shadow-emerald-500/15">
                        <Check className="w-2.5 h-2.5" /> ইনরোলড
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`আপনি কি "${c.title}" কোর্সটির এনরোলমেন্ট বাতিল করতে চান?`)) {
                          setEnrolledCourseIds(prev => {
                            const updated = prev.filter(id => id !== c.id);
                            if (activeCourseId === c.id) {
                              if (updated.length > 0) {
                                setActiveCourseId(updated[0]);
                              } else {
                                const defaultC = allCourses.find(course => course.isDefault);
                                if (defaultC) {
                                  setActiveCourseId(defaultC.id);
                                  if (!updated.includes(defaultC.id)) {
                                    return [...updated, defaultC.id];
                                  }
                                } else if (allCourses.length > 0) {
                                  setActiveCourseId(allCourses[0].id);
                                  if (!updated.includes(allCourses[0].id)) {
                                    return [...updated, allCourses[0].id];
                                  }
                                }
                              }
                            }
                            return updated;
                          });
                        }
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase transition border cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600/40 border-white/30 text-emerald-100 hover:bg-emerald-600/70 hover:text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
                      }`}
                      title="এনরোলমেন্ট বাতিল করুন"
                    >
                      <XCircle className="w-2.5 h-2.5" /> বাতিল
                    </button>
                  </div>
                </div>

                {/* Right Side: Circular Border Progress matching overall learning distribution */}
                <div className={`relative w-16 h-16 flex items-center justify-center flex-shrink-0 rounded-full p-1 border shadow-inner ${isActive ? 'bg-emerald-600/30 border-white/10' : 'bg-slate-50/50 border-slate-150/30'}`}>
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 50 50">
                    {/* Base Background Circle */}
                    <circle
                      cx="25"
                      cy="25"
                      r="20"
                      className={isActive ? 'stroke-white/20' : 'stroke-slate-100'}
                      strokeWidth="4.5"
                      fill="transparent"
                    />
                    
                    {/* Progress Circle (Single completed arc matching overall distribution look) */}
                    <motion.circle
                      cx="25"
                      cy="25"
                      r="20"
                      className={isActive ? 'text-white' : 'text-emerald-500'}
                      strokeWidth="4.5"
                      fill="transparent"
                      pathLength="100"
                      strokeDasharray="100"
                      initial={{ strokeDashoffset: 100 }}
                      animate={{ strokeDashoffset: 100 - coursePercent }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      strokeLinecap="round"
                      stroke="currentColor"
                    />
                  </svg>
                  
                  {/* Centered progress percentage text and count */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className={`text-xs font-black font-mono leading-none ${isActive ? 'text-white' : 'text-slate-800'}`}>
                      {coursePercent}%
                    </span>
                    <span className={`block text-[7px] font-extrabold uppercase leading-none mt-0.5 font-mono ${isActive ? 'text-emerald-100/90' : 'text-slate-400'}`}>
                      {courseKnowCount}/{courseWords.length}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Enroll New Course Dialog/Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-200" id="course-enroll-modal">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[85vh] flex flex-col font-sans">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  নতুন কোর্সে এনরোল করুন
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">আপনার শব্দভাণ্ডার বৃদ্ধি করতে আরও কোর্স শুরু করুন</p>
              </div>
              <button 
                onClick={() => setShowEnrollModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Course code import section */}
              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                  <span>কোর্স কোড দিয়ে সরাসরি যুক্ত করুন (Enroll via Code)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="যেমন: chemistry-101"
                    value={inputCourseCode}
                    onChange={(e) => setInputCourseCode(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none font-mono text-slate-700 uppercase font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleImportByCode}
                    disabled={isImporting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? 'লোড হচ্ছে...' : 'যুক্ত করুন'}
                  </button>
                </div>
                {importError && (
                  <p className="text-[10px] text-rose-500 font-bold">{importError}</p>
                )}
                {importSuccess && (
                  <p className="text-[10px] text-emerald-600 font-bold">{importSuccess}</p>
                )}
                <p className="text-[9px] text-slate-400 font-semibold leading-normal">
                  অ্যাডমিন বা অন্য কোনো ইউজারের তৈরি করা কোর্সের ID বা কোডটি এখানে পেস্ট করে সরাসরি আপনার আইডিতে যুক্ত করে নিন।
                </p>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-150"></div>
                <span className="flex-shrink mx-3 text-[9px] text-slate-400 font-extrabold uppercase tracking-wider font-sans">পাবলিক কোর্স তালিকা</span>
                <div className="flex-grow border-t border-slate-150"></div>
              </div>

              {allCourses.filter(c => !enrolledCourseIds.includes(c.id)).length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl text-xs flex flex-col items-center gap-2">
                  <Check className="w-8 h-8 text-emerald-500 bg-emerald-50 p-1.5 rounded-full" />
                  <div>
                    <p className="text-slate-700">আপনি ইতিমধ্যেই সব কোর্সে যুক্ত আছেন!</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">নতুন নতুন কোর্স অ্যাডমিন প্যানেল থেকে আপলোড করার সাথে সাথেই এখানে তালিকাভুক্ত হয়ে যাবে।</p>
                  </div>
                </div>
              ) : (
                allCourses.filter(c => !enrolledCourseIds.includes(c.id)).map(c => {
                  const courseWords = c.words || [];
                  return (
                    <div key={c.id} className="p-4 border border-slate-150 hover:border-slate-200 rounded-2xl bg-white flex flex-col justify-between gap-4 transition hover:shadow-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-slate-800 text-sm leading-snug">{c.title}</h4>
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black font-mono uppercase">{c.id}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{c.description}</p>
                        <div className="text-[10px] text-slate-400 font-extrabold font-mono pt-1">
                          শব্দসংখ্যা: {courseWords.length} টি • গ্রুপসমূহ: {c.totalGroups} টি
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEnrolledCourseIds(prev => [...prev, c.id]);
                          // Automatically set the newly enrolled course as active
                          setActiveCourseId(c.id);
                          setShowEnrollModal(false);
                        }}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>এনরোল করুন ও পড়া শুরু করুন</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Visual Progress Chart & Goal Editing */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6" 
        id="charts-and-goals"
      >
        {/* Progress Representation */}
        <div className="lg:col-span-2 flex flex-col gap-6 p-0 border-0 shadow-none bg-transparent">
          {/* Header section with counts */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-4 gap-4">
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <span>অগ্রগতি ও শেখার বন্টন</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold font-sans">শব্দভাণ্ডারের সার্বিক অবস্থা এবং শিখন অগ্রগতির সামগ্রিক বিবরণী</p>
            </div>
          </div>

          {/* Large Beautiful English Numbers for Total Words & Unread */}
          <div className="flex flex-row items-center gap-12 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase font-sans">TOTAL WORDS</span>
              <span className="text-4xl md:text-5xl font-black text-indigo-600 tracking-tight font-sans mt-1 leading-none">{totalWords}</span>
            </div>
            <div className="h-10 w-[1.5px] bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase font-sans">NOT STUDIED</span>
              <span className="text-4xl md:text-5xl font-black text-slate-500 tracking-tight font-sans mt-1 leading-none">{unratedCount}</span>
            </div>
          </div>

          {/* Three large circular progress bars for status */}
          <div className="flex flex-row gap-2 sm:gap-4 pt-4 w-full max-w-md">
            {/* Know progress circle */}
            <div className="flex flex-col items-center text-center transition group flex-1">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" className="stroke-slate-100" strokeWidth="10" fill="transparent" />
                  <motion.circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    className="text-emerald-500" 
                    strokeWidth="11" 
                    strokeDasharray="238.76" 
                    initial={{ strokeDashoffset: 238.76 }}
                    animate={{ strokeDashoffset: 238.76 - (238.76 * (totalWords > 0 ? (knowCount / totalWords) * 100 : 0)) / 100 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base sm:text-xl font-black text-emerald-600 font-sans leading-none">{knowCount}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold font-sans mt-0.5 sm:mt-1">{totalWords > 0 ? Math.round((knowCount / totalWords) * 100) : 0}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-emerald-700 font-sans">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>পারি</span>
              </div>
            </div>

            {/* Confusion progress circle */}
            <div className="flex flex-col items-center text-center transition group flex-1">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" className="stroke-slate-100" strokeWidth="10" fill="transparent" />
                  <motion.circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    className="text-amber-500" 
                    strokeWidth="11" 
                    strokeDasharray="238.76" 
                    initial={{ strokeDashoffset: 238.76 }}
                    animate={{ strokeDashoffset: 238.76 - (238.76 * (totalWords > 0 ? (confusionCount / totalWords) * 100 : 0)) / 100 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base sm:text-xl font-black text-amber-600 font-sans leading-none">{confusionCount}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold font-sans mt-0.5 sm:mt-1">{totalWords > 0 ? Math.round((confusionCount / totalWords) * 100) : 0}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-amber-700 font-sans">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>কনফিউশন</span>
              </div>
            </div>

            {/* Don't Know progress circle */}
            <div className="flex flex-col items-center text-center transition group flex-1">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" className="stroke-slate-100" strokeWidth="10" fill="transparent" />
                  <motion.circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    className="text-rose-500" 
                    strokeWidth="11" 
                    strokeDasharray="238.76" 
                    initial={{ strokeDashoffset: 238.76 }}
                    animate={{ strokeDashoffset: 238.76 - (238.76 * (totalWords > 0 ? (dontKnowCount / totalWords) * 100 : 0)) / 100 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base sm:text-xl font-black text-rose-600 font-sans leading-none">{dontKnowCount}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold font-sans mt-0.5 sm:mt-1">{totalWords > 0 ? Math.round((dontKnowCount / totalWords) * 100) : 0}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-rose-700 font-sans">
                <XCircle className="w-3.5 h-3.5" />
                <span>পারি না</span>
              </div>
            </div>
          </div>

          {/* Daily Study Progress Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">গত ৭ দিনের পড়াশোনার অগ্রগতি</h4>
                <p className="text-[10px] text-slate-400 font-bold font-sans">প্রতিদিন কতগুলো নতুন শব্দ শিখেছেন তার ইতিহাস</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                  <span>পঠিত শব্দ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-rose-400 border-t-2 border-dashed border-rose-400" />
                  <span>দৈনিক লক্ষ্য ({goal.dailyTarget})</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full" id="daily-study-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={last7DaysData}
                  margin={{ top: 15, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.95}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc', radius: 4 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const completedTarget = data.count >= data.target;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-lg text-xs font-sans space-y-1">
                            <p className="font-extrabold text-slate-400">{data.label}</p>
                            <p className="font-black text-sm flex items-center gap-1">
                              <span>{data.count} টি শব্দ</span>
                              {completedTarget ? (
                                <span className="text-emerald-400 text-[9px] bg-emerald-500/10 px-1.5 py-0.2 rounded font-black">লক্ষ্য অর্জিত 🔥</span>
                              ) : (
                                <span className="text-rose-400 text-[9px] bg-rose-50/10 px-1.5 py-0.2 rounded font-semibold font-sans">বাকি {Math.max(0, data.target - data.count)} টি</span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500">দৈনিক লক্ষ্য: {data.target} টি</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine 
                    y={goal.dailyTarget} 
                    stroke="#f43f5e" 
                    strokeDasharray="4 4" 
                    strokeWidth={1.5}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#colorWords)" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Study Leaderboard Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col justify-between h-[480px] lg:h-[500px] min-h-[480px] my-1" id="leaderboard-panel-card">
          <div className="space-y-4 flex flex-col h-full justify-between">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500 fill-amber-100" />
                <span>মেমোরি লিডারবোর্ড</span>
              </h3>
              <button 
                onClick={fetchLeaderboard}
                disabled={loadingLeaderboard}
                className={`p-1.5 hover:bg-slate-100 active:scale-95 text-slate-400 hover:text-indigo-600 rounded-lg transition cursor-pointer ${loadingLeaderboard ? 'animate-spin text-indigo-600' : ''}`}
                title="রিলিজ ডেটা রিফ্রেশ করুন"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Subtitle / Context */}
            <p className="text-[11px] text-slate-400 leading-normal font-sans font-semibold">
              অন্যান্য ক্লাউড শিক্ষার্থীদের সাথে রিয়েল-টাইমে এগিয়ে যান।
            </p>

            {/* Rankings Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 max-h-[290px]">
              {sortedLeaderboard.map((player, index) => {
                const rank = index + 1;
                const isCurrentUser = player.isCurrentUser;
                
                return (
                  <div 
                    key={player.id} 
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isCurrentUser 
                        ? 'bg-gradient-to-r from-indigo-50/70 to-emerald-50/30 border-indigo-200 shadow-xs' 
                        : 'bg-slate-50/40 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank badge */}
                      <div className="w-6 h-6 flex items-center justify-center font-black text-xs flex-shrink-0">
                        {rank === 1 ? (
                          <Trophy className="w-4.5 h-4.5 text-amber-500 fill-amber-100" />
                        ) : rank === 2 ? (
                          <Trophy className="w-4.5 h-4.5 text-slate-400 fill-slate-50" />
                        ) : rank === 3 ? (
                          <Trophy className="w-4.5 h-4.5 text-amber-700 fill-amber-50" />
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">#{rank}</span>
                        )}
                      </div>

                      {/* Initial Avatar */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border flex-shrink-0 ${
                        isCurrentUser 
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-600 font-mono'
                      }`}>
                        {player.displayName ? player.displayName[0].toUpperCase() : 'U'}
                      </div>

                      {/* Display name */}
                      <div className="min-w-0 font-sans">
                        <p className={`text-xs font-black truncate flex items-center gap-1 ${isCurrentUser ? 'text-indigo-950' : 'text-slate-700'}`}>
                          {player.displayName}
                          {isCurrentUser && (
                            <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider scale-90">YOU</span>
                          )}
                        </p>
                        <p className="text-[9px] text-slate-400 font-semibold truncate">
                          {player.id === 'current-local' ? 'অফলাইন শিক্ষার্থী' : 'ক্লাউড শিক্ষার্থী'}
                        </p>
                      </div>
                    </div>

                    {/* Studied score & streak */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-right font-sans">
                      <div className="flex flex-col items-end">
                        <p className="text-xs font-black text-indigo-600 font-mono leading-none">
                          {player.knowCount} <span className="text-[9px] font-bold text-slate-400">শব্দ</span>
                        </p>
                        {player.streak > 0 && (
                          <div className="flex items-center gap-0.5 text-amber-500 mt-1 leading-none">
                            <Flame className="w-3 h-3 fill-current" />
                            <span className="text-[9px] font-black font-mono">{player.streak}d</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer text */}
            <div className="pt-2 border-t border-slate-100 text-center flex-shrink-0 space-y-2">
              <p className="text-[10px] text-slate-400 font-sans font-medium">
                ধারাবাহিক পড়াশোনা করুন এবং লিডারবোর্ডের শীর্ষে উঠে আসুন!
              </p>
              {onSelectTab && (
                <button
                  onClick={() => onSelectTab('leaderboard')}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer font-sans"
                >
                  <span>গ্লোবাল লিডারবোর্ড দেখুন</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 37 Groups Navigation Section */}
      <motion.div 
        variants={itemVariants}
        className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-6" 
        id="groups-directory-section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              ভোকাবুলারি গ্রুপসমূহ (১-৩৭)
            </h3>
            <p className="text-sm text-slate-500 font-sans">
              যেকোনো নির্দিষ্ট গ্রুপে ক্লিক করে ফ্ল্যাশ কার্ড এবং শেখার গেম শুরু করুন।
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="গ্রুপ নাম্বার বা নাম লিখুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-sans text-slate-700"
            />
          </div>
        </div>

        {/* Group Cards Grid */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2" 
          id="group-grid"
        >
          {filteredGroups.map((g) => (
            <motion.button
               key={g.group}
               variants={itemVariants}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={() => onSelectGroup(g.group)}
               className="group relative overflow-hidden rounded-full border border-slate-200 hover:border-emerald-300 hover:shadow-xs bg-slate-50/50 transition flex items-center justify-between px-3 py-2 h-9 cursor-pointer"
            >
              {/* Progress background fill (two-color indicator) */}
              <div 
                className="absolute top-0 left-0 bottom-0 bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-all duration-300" 
                style={{ width: `${g.percent}%` }} 
              />
              
              {/* Content */}
              <div className="relative z-10 flex items-center justify-between w-full font-sans">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  গ্রুপ {g.group}
                </span>
                <div className="flex items-center gap-1 font-sans">
                  <span className="text-[9px] text-slate-400 font-medium">({g.total})</span>
                  <span className="text-[11px] font-black text-emerald-600">{g.percent}%</span>
                </div>
              </div>
            </motion.button>
          ))}

          {filteredGroups.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 font-sans">
              কোনো গ্রুপ পাওয়া যায়নি।
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
