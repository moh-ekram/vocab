import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, StudyGoal, Course } from '../types';
import { Award, BookOpen, Flame, CheckCircle, AlertTriangle, XCircle, HelpCircle, Trophy, TrendingUp, Search, Plus, Sparkles, Check, ChevronRight, X, Crown, RefreshCw, KeyRound, Copy, CreditCard, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, limit, query, doc, getDoc, setDoc } from 'firebase/firestore';

interface StatsDashboardProps {
  user: any;
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
  user,
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

  // --- bKash Checkout States ---
  const [selectedBuyCourse, setSelectedBuyCourse] = useState<Course | null>(null);
  const [bkashSender, setBkashSender] = useState('');
  const [accessEmail, setAccessEmail] = useState(user?.email || '');
  const [trxId, setTrxId] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync accessEmail when user changes
  useEffect(() => {
    if (user?.email) {
      setAccessEmail(user.email);
    }
  }, [user]);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyCourse) return;

    const cleanSender = bkashSender.trim();
    const cleanEmail = accessEmail.trim();
    const cleanTrx = trxId.trim();

    if (!cleanSender || !cleanEmail || !cleanTrx) {
      setCheckoutMessage({ type: 'error', text: 'অনুগ্রহ করে সবগুলো ঘর সঠিকভাবে পূরণ করুন।' });
      return;
    }

    setIsSubmittingRequest(true);
    setCheckoutMessage(null);

    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requestPayload = {
        id: requestId,
        courseId: selectedBuyCourse.id,
        courseTitle: selectedBuyCourse.title,
        bkashNumber: cleanSender,
        email: cleanEmail.toLowerCase(),
        trxId: cleanTrx,
        status: 'pending',
        price: selectedBuyCourse.price || 0,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || 'anonymous'
      };

      await setDoc(doc(db, 'access_requests', requestId), requestPayload);

      setCheckoutMessage({
        type: 'success',
        text: 'আপনার রিক্যুয়েস্টটি সফলভাবে পাঠানো হয়েছে! এডমিন শীঘ্রই যাচাই করে আপনার কোর্সের এক্সেস এপ্রুভ করে দেবেন।'
      });
      setBkashSender('');
      setTrxId('');
      
      // Auto-dismiss or reset after 4 seconds
      setTimeout(() => {
        setSelectedBuyCourse(null);
        setCheckoutMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Error submitting access request:', err);
      setCheckoutMessage({
        type: 'error',
        text: 'অনুরোধ পাঠাতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

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
        className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl shadow-indigo-950/15 relative overflow-hidden" 
        id="dashboard-welcome-banner"
      >
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          <div className="space-y-1 md:space-y-2">
            <h2 className="text-xl md:text-3xl font-black font-sans tracking-tight">আপনার শব্দভাণ্ডার ড্যাশবোর্ড</h2>
          </div>

          <div className="grid grid-cols-3 md:flex md:items-center md:justify-end gap-2.5 sm:gap-4 w-full md:w-auto">
            {/* Streak card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-2 sm:p-4 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-3 border border-white/10 shadow-xs w-full justify-center sm:justify-start col-span-1 md:w-36 md:flex-shrink-0"
            >
              <div className="p-1 sm:p-2 bg-amber-400 rounded-xl text-amber-950 animate-pulse flex-shrink-0">
                <Flame className="w-4 h-4 sm:w-6 sm:h-6 fill-current" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-sans truncate">স্ট্রিক</p>
                <p className="text-xs sm:text-xl font-black font-sans truncate">{goal.streak} দিন</p>
              </div>
            </motion.div>

            {/* Daily Goal card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              onClick={() => onSelectTab?.('flashcard')}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-2 sm:p-4 flex flex-row items-center text-left gap-2 sm:gap-3 border border-white/10 shadow-xs cursor-pointer hover:bg-white/15 transition-all w-full justify-start col-span-2 md:flex-1 md:max-w-[280px]"
              title="ফ্ল্যাশকার্ডে যান"
            >
              <div className="p-1 sm:p-2 bg-indigo-500 rounded-xl text-white flex-shrink-0">
                <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 animate-icon-flip" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-xl font-black font-sans flex items-center justify-between sm:justify-start gap-1 truncate">
                  <span>ফ্ল্যাশকার্ড প্র্যাকটিস</span>
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-200 flex-shrink-0" />
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Course Enrollment & Active Course Selection */}
      <motion.div variants={itemVariants} className="space-y-4" id="dashboard-courses-section">
        <div className="flex flex-row justify-between items-center gap-2 w-full">
          <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
            <span className="truncate">My Courses</span>
          </h3>
          <button
            onClick={() => setShowEnrollModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100/85 text-indigo-600 font-extrabold text-xs rounded-xl transition cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course</span>
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
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-rose-50/50 hover:text-rose-600 hover:border-rose-150'
                      }`}
                    >
                      <Trash2 className="w-2.5 h-2.5" /> ডিলিট
                    </button>
                  </div>
                </div>

                {/* Right Side: Circular Progress */}
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90">
                    {/* Background Circle */}
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      className={isActive ? 'text-emerald-600/40' : 'text-slate-100'}
                      strokeWidth="5"
                      fill="transparent"
                    />
                    {/* Progress Circle */}
                    <motion.circle
                      cx="24"
                      cy="24"
                      r="20"
                      className={isActive ? 'text-white' : 'text-emerald-500'}
                      strokeWidth="5"
                      fill="transparent"
                      pathLength="100"
                      strokeDasharray="100"
                      initial={{ strokeDashoffset: 100 }}
                      animate={{ strokeDashoffset: 100 - coursePercent }}
                      transition={{ type: "spring", stiffness: 70, damping: 14 }}
                      strokeLinecap="round"
                      stroke="currentColor"
                    />
                  </svg>
                  
                  {/* Centered progress percentage text and count */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                    <span className={`text-xs font-black font-mono leading-none tracking-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                      {coursePercent}%
                    </span>
                    <span className={`block text-[7px] font-black uppercase leading-none mt-0.5 font-mono ${isActive ? 'text-emerald-100/90' : 'text-slate-400'}`}>
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
                  const isUserAllowed = !c.isRestricted || (
                    user?.email && (
                      c.allowedUsers?.map(email => email.toLowerCase()).includes(user.email.toLowerCase()) ||
                      user.email.toLowerCase() === 'mohammad.001ekram@gmail.com'
                    )
                  );

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
                        {c.isRestricted && (
                          <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg font-bold mt-1.5 flex items-center gap-1">
                            <span>🔒 রেস্ট্রিকটেড কোর্স (Restricted Course)</span>
                          </div>
                        )}
                      </div>

                      {isUserAllowed ? (
                        <button
                          onClick={() => {
                            setEnrolledCourseIds(prev => [...prev, c.id]);
                            // Automatically set the newly enrolled course as active
                            setActiveCourseId(c.id);
                            setShowEnrollModal(false);
                          }}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm animate-fade-in"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>এনরোল করুন ও পড়া শুরু করুন</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedBuyCourse(c);
                            setBkashSender('');
                            setTrxId('');
                            setCheckoutMessage(null);
                          }}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm animate-fade-in"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Buy Now - {c.price || 0} TK</span>
                        </button>
                      )}
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

      {/* bKash Payment / Access Request Dialog */}
      {selectedBuyCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-200" id="bkash-payment-modal">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col font-sans">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                  <span className="p-1 bg-pink-500 rounded-lg text-white font-black text-xs font-mono px-1.5">bKash</span>
                  কোর্স এক্সেস রিক্যুয়েস্ট
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{selectedBuyCourse.title}</p>
              </div>
              <button 
                onClick={() => setSelectedBuyCourse(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestAccess} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-4 bg-pink-50 border border-pink-100 rounded-2xl space-y-2 text-xs">
                <p className="font-black text-pink-700">বিকাশ সেন্ড মানি নির্দেশাবলী:</p>
                <p className="font-semibold text-slate-700 leading-relaxed">
                  নিচের বিকাশ নাম্বারে <strong className="text-pink-600 font-black text-sm">{selectedBuyCourse.price || 0} টাকা</strong> সেন্ড মানি (Send Money) করে নিচের ফরমটি ফিলাপ করুন।
                </p>
                <div className="flex items-center justify-between p-2.5 bg-white border border-pink-100 rounded-xl mt-1.5">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold">বিকাশ পার্সোনাল নাম্বার:</p>
                    <p className="font-black text-slate-800 text-xs font-mono">{selectedBuyCourse.bkashNumber || '01700000000'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedBuyCourse.bkashNumber || '01700000000');
                      alert('নাম্বারটি কপি করা হয়েছে!');
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 font-bold text-[10px] flex items-center gap-1 cursor-pointer border border-indigo-100"
                  >
                    <Copy className="w-3 h-3" /> কপি করুন
                  </button>
                </div>
              </div>

              {checkoutMessage && (
                <div className={`p-4 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2 ${
                  checkoutMessage.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-100 text-rose-800'
                }`}>
                  {checkoutMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{checkoutMessage.text}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">১/ বিকাশ নাম্বার (যেটি দিয়ে {selectedBuyCourse.price || 0} টাকা সেন্ড মানি করেছেন) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={bkashSender}
                    onChange={(e) => setBkashSender(e.target.value)}
                    placeholder="যেমন: 01712345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">২/ ইমেইল (যেখানে কোর্সের এক্সেস দেওয়া হবে) <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="যেমন: student@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">৩/ বিকাশ ট্রাঞ্জেকশন নাম্বার (TrxID) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="যেমন: K8B9H5J2D"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono font-bold transition text-slate-800 uppercase"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-200 text-white font-black text-xs rounded-2xl shadow-lg shadow-pink-600/10 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingRequest ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>অনুরোধ পাঠানো হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>রিক্যুয়েস্ট এক্সেস (Request Access)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Visual Progress Chart & Goal Editing */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 gap-6" 
        id="charts-and-goals"
      >
        {/* Progress Representation */}
        <div className="flex flex-col gap-6 p-0 border-0 shadow-none bg-transparent">
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

          {/* Desktop Row, Mobile Centered Column container */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 w-full border-b border-slate-100 pb-6 md:pb-4">
            {/* Large Beautiful English Numbers for Total Words & Unread */}
            <div className="flex flex-row items-center justify-center md:justify-start gap-12 py-3">
              <div className="flex flex-col items-center md:items-start">
                <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase font-sans">TOTAL WORDS</span>
                <span className="text-4xl md:text-5xl font-black text-indigo-600 tracking-tight font-sans mt-1 leading-none">{totalWords}</span>
              </div>
              <div className="h-10 w-[1.5px] bg-slate-200" />
              <div className="flex flex-col items-center md:items-start">
                <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase font-sans">NOT STUDIED</span>
                <span className="text-4xl md:text-5xl font-black text-slate-500 tracking-tight font-sans mt-1 leading-none">{unratedCount}</span>
              </div>
            </div>

            {/* Three large circular progress bars for status */}
            <div className="flex flex-row gap-2 sm:gap-4 pt-4 w-full max-w-md justify-center md:justify-end mx-auto md:mx-0">
              {/* Know progress circle */}
              <div className="flex flex-col items-center text-center transition group flex-1">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3 p-1 rounded-full bg-slate-50 border border-slate-100/50 shadow-inner">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="38" className="stroke-slate-200/50" strokeWidth="10" fill="transparent" />
                    <motion.circle 
                      cx="50" 
                      cy="50" 
                      r="38" 
                      className="text-emerald-500" 
                      strokeWidth="11" 
                      strokeDasharray="238.76" 
                      initial={{ strokeDashoffset: 238.76 }}
                      animate={{ strokeDashoffset: 238.76 - (238.76 * (totalWords > 0 ? (knowCount / totalWords) * 100 : 0)) / 100 }}
                      transition={{ type: "spring", stiffness: 60, damping: 13 }}
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
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3 p-1 rounded-full bg-slate-50 border border-slate-100/50 shadow-inner">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="38" className="stroke-slate-200/50" strokeWidth="10" fill="transparent" />
                    <motion.circle 
                      cx="50" 
                      cy="50" 
                      r="38" 
                      className="text-amber-500" 
                      strokeWidth="11" 
                      strokeDasharray="238.76" 
                      initial={{ strokeDashoffset: 238.76 }}
                      animate={{ strokeDashoffset: 238.76 - (238.76 * (totalWords > 0 ? (confusionCount / totalWords) * 100 : 0)) / 100 }}
                      transition={{ type: "spring", stiffness: 60, damping: 13 }}
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
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3 p-1 rounded-full bg-slate-50 border border-slate-100/50 shadow-inner">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="38" className="stroke-slate-200/50" strokeWidth="10" fill="transparent" />
                    <motion.circle 
                      cx="50" 
                      cy="50" 
                      r="38" 
                      className="text-rose-500" 
                      strokeWidth="11" 
                      strokeDasharray="238.76" 
                      initial={{ strokeDashoffset: 238.76 }}
                      animate={{ strokeDashoffset: 238.76 - (238.76 * (totalWords > 0 ? (dontKnowCount / totalWords) * 100 : 0)) / 100 }}
                      transition={{ type: "spring", stiffness: 60, damping: 13 }}
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
