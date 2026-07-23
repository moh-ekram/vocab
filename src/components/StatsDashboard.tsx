import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, StudyGoal, Course } from '../types';
import { isCourseEnrolled } from '../lib/courseAccess';
import { Award, BookOpen, Flame, CheckCircle, AlertTriangle, XCircle, HelpCircle, Trophy, TrendingUp, Search, Plus, Sparkles, Check, ChevronRight, X, Crown, RefreshCw, KeyRound, Copy, CreditCard, Trash2, Lock, CheckCircle2, Circle, CheckSquare, Square, Filter, Layers } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, limit, query, doc, getDoc, setDoc } from 'firebase/firestore';

interface StatsDashboardProps {
  user: any;
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  goal: StudyGoal;
  setGoal: React.Dispatch<React.SetStateAction<StudyGoal>>;
  onSelectGroup: (group: number | string) => void;
  onRateWord?: (wordId: string, status: WordStatus) => void;
  onBatchRateWords?: (wordIds: string[], status: WordStatus) => void;
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
  onRateWord,
  onBatchRateWords,
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
  const [chartType, setChartType] = useState<'trend' | 'bar' | 'time'>('trend');

  // --- Batch Word Status States ---
  const [batchGroup, setBatchGroup] = useState<number | string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | WordStatus>('all');
  const [batchToast, setBatchToast] = useState<string | null>(null);

  // Filter courses shown in the Enroll New Course modal
  // Strictly only show courses that are NOT yet enrolled! If a user has enrolled, they must not see it here.
  const modalCourses = allCourses.filter(c => !isCourseEnrolled(c.id, enrolledCourseIds));

  // --- bKash Checkout States ---
  const [selectedBuyCourse, setSelectedBuyCourse] = useState<Course | null>(null);
  const [bkashSender, setBkashSender] = useState('');
  const [accessEmail, setAccessEmail] = useState(user?.email || '');
  const [trxId, setTrxId] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Max 2 times a day with at least 12 hours interval Flashcard Practice cover animation for dashboard banner
  const [showFlashcardCoverAnim, setShowFlashcardCoverAnim] = useState(false);

  useEffect(() => {
    try {
      const now = Date.now();
      const todayStr = new Date().toISOString().split('T')[0];
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

      const rawData = localStorage.getItem('flashcard_banner_anim_data');
      let animRecord: { count: number; lastTimestamp: number; date: string } | null = null;

      if (rawData) {
        try {
          animRecord = JSON.parse(rawData);
        } catch {
          animRecord = null;
        }
      }

      if (!animRecord || animRecord.date !== todayStr) {
        // First trigger of the day
        setShowFlashcardCoverAnim(true);
        localStorage.setItem(
          'flashcard_banner_anim_data',
          JSON.stringify({ count: 1, lastTimestamp: now, date: todayStr })
        );
      } else if (animRecord.count < 2 && (now - animRecord.lastTimestamp >= TWELVE_HOURS_MS)) {
        // Second trigger of the day (at least 12 hours later)
        setShowFlashcardCoverAnim(true);
        localStorage.setItem(
          'flashcard_banner_anim_data',
          JSON.stringify({ count: animRecord.count + 1, lastTimestamp: now, date: todayStr })
        );
      }
    } catch (e) {
      console.error('Error handling flashcard animation tracking:', e);
    }
  }, []);

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
      setCheckoutMessage({ type: 'error', text: 'Please fill in all fields correctly.' });
      return;
    }

    setIsSubmittingRequest(true);
    setCheckoutMessage(null);

    try {
      const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10); // match last 10 digits
      const matchTrx = cleanTrx.toLowerCase().trim();
      const matchPhone = cleanPhone(cleanSender);

      const isAutoApproved = selectedBuyCourse.verifiedPayments && selectedBuyCourse.verifiedPayments.some(vp => {
        const vpPhone = cleanPhone(vp.bkashNumber);
        const vpTrx = vp.trxId.toLowerCase().trim();
        return (vpPhone === matchPhone || vp.bkashNumber.trim() === cleanSender) && vpTrx === matchTrx;
      });

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requestPayload = {
        id: requestId,
        courseId: selectedBuyCourse.id,
        courseTitle: selectedBuyCourse.title,
        bkashNumber: cleanSender,
        email: cleanEmail.toLowerCase(),
        trxId: cleanTrx,
        status: 'pending',
        price: (selectedBuyCourse.price && selectedBuyCourse.price > 0) ? selectedBuyCourse.price : 30,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || 'anonymous'
      };

      await setDoc(doc(db, 'access_requests', requestId), requestPayload);

      if (isAutoApproved) {
        // Automatically enroll the user immediately!
        onImportCourse(selectedBuyCourse);
        setCheckoutMessage({
          type: 'success',
          text: 'Payment automatically verified! You have been granted instant access. Start learning!'
        });
      } else {
        setCheckoutMessage({
          type: 'success',
          text: 'Your request has been successfully submitted! Admin will verify and activate your course access soon.'
        });
      }
    } catch (err) {
      console.error("Error submitting access request:", err);
      setCheckoutMessage({
        type: "error",
        text: "Failed to send request. Please try again."
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
      setImportError('Please enter a course code.');
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
        setImportSuccess(`Successfully joined "${existing.title}" course!`);
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
        setImportSuccess(`Successfully imported "${courseData.title}" course from cloud!`);
        setInputCourseCode('');
        setTimeout(() => {
          setShowEnrollModal(false);
          setImportSuccess(null);
        }, 1500);
      } else {
        setImportError('No course found with this code. Please enter a correct course code.');
      }
    } catch (err) {
      console.error('Error importing course by code:', err);
      setImportError('Failed to import course. Please check your network and try again.');
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
          displayName: data.displayName || data.email?.split('@')[0] || 'Student',
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
    displayName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'You',
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
    return `Group ${g.group}`.includes(searchTerm) || g.group.toString() === searchTerm;
  });

  // --- Active Group Batch Memoized Data & Handlers ---
  const activeGroupWords = React.useMemo(() => {
    if (batchGroup === null) return [];
    return words.filter(w => w.group === batchGroup);
  }, [words, batchGroup]);

  const activeGroupStats = React.useMemo(() => {
    let know = 0, dontKnow = 0, confusion = 0, unrated = 0;
    activeGroupWords.forEach(w => {
      const s = progress[w.id]?.status || 'unrated';
      if (s === 'know') know++;
      else if (s === 'dont_know') dontKnow++;
      else if (s === 'confusion') confusion++;
      else unrated++;
    });
    return { total: activeGroupWords.length, know, dontKnow, confusion, unrated };
  }, [activeGroupWords, progress]);

  const filteredGroupWords = React.useMemo(() => {
    return activeGroupWords.filter(w => {
      if (groupSearchTerm) {
        const q = groupSearchTerm.toLowerCase();
        const matchWord = w.word?.toLowerCase().includes(q);
        const matchMeaning = w.meaning?.toLowerCase().includes(q);
        if (!matchWord && !matchMeaning) return false;
      }
      if (groupStatusFilter !== 'all') {
        const s = progress[w.id]?.status || 'unrated';
        if (s !== groupStatusFilter) return false;
      }
      return true;
    });
  }, [activeGroupWords, groupSearchTerm, groupStatusFilter, progress]);

  const handleToggleSelectWord = (wordId: string) => {
    setSelectedWordIds(prev =>
      prev.includes(wordId)
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  const handleSelectAllGroupWords = () => {
    const visibleIds = filteredGroupWords.map(w => w.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedWordIds.includes(id));
    if (allVisibleSelected) {
      setSelectedWordIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      const newSet = new Set([...selectedWordIds, ...visibleIds]);
      setSelectedWordIds(Array.from(newSet));
    }
  };

  const handleApplyBatchStatus = (targetStatus: WordStatus) => {
    if (selectedWordIds.length === 0) return;

    if (onBatchRateWords) {
      onBatchRateWords(selectedWordIds, targetStatus);
    } else if (onRateWord) {
      selectedWordIds.forEach(id => onRateWord(id, targetStatus));
    }

    const statusLabels: Record<WordStatus, string> = {
      know: 'Known (পারি)',
      dont_know: 'Unknown (পারি না)',
      confusion: 'Confused (কনফিউশন)',
      unrated: 'Unstudied (পড়া হয়নি)'
    };

    setBatchToast(`Successfully marked ${selectedWordIds.length} word${selectedWordIds.length > 1 ? 's' : ''} as "${statusLabels[targetStatus]}"!`);
    setSelectedWordIds([]);

    setTimeout(() => {
      setBatchToast(null);
    }, 3000);
  };

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
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = goal.history?.[dateStr] || 0;
    const minutes = count > 0 ? Math.round(count * 1.5) : 0;
    return {
      date: dateStr,
      label: formattedDate,
      count,
      minutes,
      target: goal.dailyTarget || 20,
      targetMinutes: Math.round((goal.dailyTarget || 20) * 1.5)
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
        {/* Once a Day Flashcard Practice Overlay Animation */}
        <AnimatePresence>
          {showFlashcardCoverAnim && (
            <motion.div
              key="flashcard-cover-overlay"
              initial={{ opacity: 1, scale: 1, x: '0%', y: '0%' }}
              animate={{ 
                opacity: [1, 1, 0],
                scale: [1, 1, 0.35],
                x: ['0%', '0%', '25%'],
                y: ['0%', '0%', '15%']
              }}
              transition={{ 
                duration: 3.0, 
                times: [0, 0.65, 1],
                ease: [0.22, 1, 0.36, 1] 
              }}
              onAnimationComplete={() => setShowFlashcardCoverAnim(false)}
              className="absolute inset-0 z-30 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 rounded-3xl p-4 sm:p-6 md:p-8 flex items-center justify-center shadow-2xl border-2 border-indigo-300/40 pointer-events-none"
            >
              <div className="flex items-center gap-3 sm:gap-4 bg-white/15 backdrop-blur-xl px-5 sm:px-8 py-3.5 sm:py-5 rounded-2xl border border-white/30 shadow-2xl text-white">
                <div className="p-2 sm:p-3 bg-indigo-500 rounded-xl text-white shadow-md animate-bounce">
                  <CreditCard className="w-6 h-6 sm:w-10 sm:h-10" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    Flashcard Practice
                    <ChevronRight className="w-5 h-5 text-indigo-200" />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-indigo-200 font-bold uppercase tracking-wider">Daily Vocabulary Focus</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          <div className="space-y-1 md:space-y-2">
            <h2 className="text-xl md:text-3xl font-black font-sans tracking-tight">Your Vocabulary Dashboard</h2>
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
                <p className="text-[8px] sm:text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-sans truncate">Streak</p>
                <p className="text-xs sm:text-xl font-black font-sans truncate">{goal.streak} Days</p>
              </div>
            </motion.div>

            {/* Daily Goal card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              onClick={() => onSelectTab?.('flashcard')}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-2 sm:p-4 flex flex-row items-center text-left gap-2 sm:gap-3 border border-white/10 shadow-xs cursor-pointer hover:bg-white/15 transition-all w-full justify-start col-span-2 md:flex-1 md:max-w-[280px]"
              title="Go to Flashcards"
            >
              <div className="p-1 sm:p-2 bg-indigo-500 rounded-xl text-white flex-shrink-0">
                <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 animate-icon-flip" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-xl font-black font-sans flex items-center justify-between sm:justify-start gap-1 truncate">
                  <span>Flashcards Practice</span>
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-200 flex-shrink-0" />
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

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
                <span>Progress & Learning Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold font-sans">Overall vocabulary statistics and detailed study progress report</p>
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
                  <span>Known</span>
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
                  <span>Confused</span>
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
                  <span>Don't Know</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Study Progress & Trend Line Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Last 7 Days Study Trend
                </h4>
                <p className="text-[10px] text-slate-400 font-bold font-sans">
                  Visual history of learned words and estimated daily study time
                </p>
              </div>

              {/* Chart Mode Switchers & Legends */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-sans text-xs">
                  <button
                    type="button"
                    onClick={() => setChartType('trend')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      chartType === 'trend'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Area Trend
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      chartType === 'bar'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bar Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('time')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      chartType === 'time'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Study Time (Mins)
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 font-sans">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm ${chartType === 'time' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                    <span>{chartType === 'time' ? 'Study Minutes' : 'Words Studied'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-rose-400 border-t-2 border-dashed border-rose-400" />
                    <span>Goal ({chartType === 'time' ? `${Math.round((goal.dailyTarget || 20) * 1.5)}m` : goal.dailyTarget})</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-64 w-full" id="daily-study-chart">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'trend' ? (
                  <AreaChart
                    data={last7DaysData}
                    margin={{ top: 15, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorWordsTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
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
                      cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const completedTarget = data.count >= data.target;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-lg text-xs font-sans space-y-1">
                              <p className="font-extrabold text-slate-400">{data.label}</p>
                              <p className="font-black text-sm flex items-center gap-1.5">
                                <span className="text-indigo-400">{data.count} Words</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-emerald-400">~{data.minutes} mins</span>
                              </p>
                              {completedTarget ? (
                                <span className="inline-block text-emerald-400 text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded font-black">Daily Goal Achieved 🔥</span>
                              ) : (
                                <span className="inline-block text-rose-400 text-[9px] bg-rose-50/10 px-1.5 py-0.5 rounded font-semibold">{Math.max(0, data.target - data.count)} words left</span>
                              )}
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
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorWordsTrend)" 
                      dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                    />
                  </AreaChart>
                ) : chartType === 'time' ? (
                  <AreaChart
                    data={last7DaysData}
                    margin={{ top: 15, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTimeTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
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
                      cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-lg text-xs font-sans space-y-1">
                              <p className="font-extrabold text-slate-400">{data.label}</p>
                              <p className="font-black text-sm text-emerald-400">
                                ~{data.minutes} Minutes Spent
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Total {data.count} words reviewed
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine 
                      y={Math.round((goal.dailyTarget || 20) * 1.5)} 
                      stroke="#f43f5e" 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="minutes" 
                      stroke="#059669" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorTimeTrend)" 
                      dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                    />
                  </AreaChart>
                ) : (
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
                                <span>{data.count} Words</span>
                                {completedTarget ? (
                                  <span className="text-emerald-400 text-[9px] bg-emerald-500/10 px-1.5 py-0.2 rounded font-black">Goal Achieved 🔥</span>
                                ) : (
                                  <span className="text-rose-400 text-[9px] bg-rose-50/10 px-1.5 py-0.2 rounded font-semibold font-sans">{Math.max(0, data.target - data.count)} Left</span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500">Daily Goal: {data.target} Words</p>
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
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Vocabulary Groups Section */}
      <motion.div 
        variants={itemVariants}
        className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-6" 
        id="groups-directory-section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              Vocabulary Groups (1-37)
            </h3>
            <p className="text-sm text-slate-500 font-sans">
              Click any group to select words and batch assign statuses (e.g., mark as known), or click <BookOpen className="w-3.5 h-3.5 inline text-indigo-500" /> to start study.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search group number or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-sans text-slate-700"
            />
          </div>
        </div>

        {/* Group Cards Grid */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5" 
          id="group-grid"
        >
          {filteredGroups.map((g) => (
            <div key={g.group} className="relative group/card flex items-center">
              <motion.button
                 variants={itemVariants}
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => {
                   setBatchGroup(g.group);
                   setSelectedWordIds([]);
                   setGroupSearchTerm('');
                   setGroupStatusFilter('all');
                 }}
                 className="w-full relative overflow-hidden rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-md bg-slate-50/50 hover:bg-white transition flex items-center justify-between pl-3 pr-8 py-2.5 h-11 cursor-pointer"
                 title={`Group ${g.group}: Click to manage words & batch update status`}
              >
                {/* Progress background fill */}
                <div 
                  className="absolute top-0 left-0 bottom-0 bg-emerald-500/15 group-hover/card:bg-emerald-500/25 transition-all duration-300" 
                  style={{ width: `${g.percent}%` }} 
                />
                
                {/* Content */}
                <div className="relative z-10 flex items-center justify-between w-full font-sans pr-1">
                  <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    Group {g.group}
                  </span>
                  <div className="flex items-center gap-1 font-sans">
                    <span className="text-[10px] text-slate-400 font-semibold">({g.total})</span>
                    <span className="text-[11px] font-black text-emerald-600 ml-0.5">{g.percent}%</span>
                  </div>
                </div>
              </motion.button>

              {/* Direct Study Icon Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectGroup(g.group);
                }}
                className="absolute right-1.5 z-20 p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition cursor-pointer"
                title={`Start Flashcard Study for Group ${g.group}`}
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 font-sans">
              No groups found.
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* --- BATCH WORD STATUS MANAGER MODAL --- */}
      <AnimatePresence>
        {batchGroup !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                      Group {batchGroup}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-emerald-400" />
                      Batch Word Status Manager
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 font-sans text-xs text-slate-300">
                    <span>Total: <strong className="text-white">{activeGroupStats.total}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">Known: {activeGroupStats.know}</span>
                    <span>•</span>
                    <span className="text-rose-400 font-semibold">Unknown: {activeGroupStats.dontKnow}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-semibold">Confused: {activeGroupStats.confusion}</span>
                    <span>•</span>
                    <span className="text-slate-400 font-semibold">Unstudied: {activeGroupStats.unrated}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      const grp = batchGroup;
                      setBatchGroup(null);
                      onSelectGroup(grp);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Start Flashcard Study for this group"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Study Flashcards</span>
                  </button>
                  <button
                    onClick={() => {
                      setBatchGroup(null);
                      setSelectedWordIds([]);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Toolbar: Search, Status Filters & Select All */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search words or Bengali meanings..."
                      value={groupSearchTerm}
                      onChange={(e) => setGroupSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-sans"
                    />
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full font-sans text-xs">
                    {[
                      { id: 'all', label: `All (${activeGroupStats.total})` },
                      { id: 'know', label: `Known (${activeGroupStats.know})`, color: 'text-emerald-600' },
                      { id: 'dont_know', label: `Unknown (${activeGroupStats.dontKnow})`, color: 'text-rose-600' },
                      { id: 'confusion', label: `Confused (${activeGroupStats.confusion})`, color: 'text-amber-600' },
                      { id: 'unrated', label: `Unstudied (${activeGroupStats.unrated})`, color: 'text-slate-500' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setGroupStatusFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                          groupStatusFilter === tab.id
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select All Toggle & Selection Counter */}
                <div className="flex items-center justify-between pt-1 font-sans border-t border-slate-200/60">
                  <button
                    onClick={handleSelectAllGroupWords}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-emerald-600 transition cursor-pointer"
                  >
                    {filteredGroupWords.length > 0 && filteredGroupWords.every(w => selectedWordIds.includes(w.id)) ? (
                      <CheckSquare className="w-4.5 h-4.5 text-emerald-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-slate-400" />
                    )}
                    <span>
                      {filteredGroupWords.length > 0 && filteredGroupWords.every(w => selectedWordIds.includes(w.id))
                        ? 'Deselect All Visible'
                        : `Select All Visible (${filteredGroupWords.length})`}
                    </span>
                  </button>

                  <span className="text-xs text-slate-600 font-bold bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                    {selectedWordIds.length} word{selectedWordIds.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
              </div>

              {/* Floating / Sticky Batch Action Bar */}
              <AnimatePresence>
                {selectedWordIds.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                        {selectedWordIds.length}
                      </span>
                      <span>Assign status to selected words:</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-center font-sans">
                      <button
                        onClick={() => handleApplyBatchStatus('know')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark as Known (পারি)</span>
                      </button>

                      <button
                        onClick={() => handleApplyBatchStatus('dont_know')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Mark as Unknown (পারি না)</span>
                      </button>

                      <button
                        onClick={() => handleApplyBatchStatus('confusion')}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>Mark as Confused (কনফিউশন)</span>
                      </button>

                      <button
                        onClick={() => handleApplyBatchStatus('unrated')}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Circle className="w-4 h-4" />
                        <span>Reset to Unstudied</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toast Alert */}
              <AnimatePresence>
                {batchToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-inner"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{batchToast}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scrollable Words List */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-100/50">
                {filteredGroupWords.map(w => {
                  const isSelected = selectedWordIds.includes(w.id);
                  const currentStatus = progress[w.id]?.status || 'unrated';

                  return (
                    <div
                      key={w.id}
                      onClick={() => handleToggleSelectWord(w.id)}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-400/30 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 text-slate-400">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5 font-sans">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                              {w.word}
                            </span>
                            {w.phonetic && (
                              <span className="text-[10px] font-medium text-slate-400">
                                [{w.phonetic}]
                              </span>
                            )}
                          </div>
                          {w.meaning && (
                            <p className="text-xs sm:text-sm font-bold text-emerald-700 font-bengali truncate">
                              {w.meaning}
                            </p>
                          )}
                          {w.synonyms && (
                            <p className="text-[11px] text-slate-500 font-sans truncate">
                              <span className="font-semibold text-slate-400">Synonyms: </span>
                              {w.synonyms}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Individual Status Badges & Quick Change */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {[
                          { id: 'know', label: 'Known', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200' },
                          { id: 'dont_know', label: 'Unknown', color: 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200' },
                          { id: 'confusion', label: 'Confused', color: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' },
                          { id: 'unrated', label: 'Unstudied', color: 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200' }
                        ].map(st => {
                          const isActive = currentStatus === st.id;
                          return (
                            <button
                              key={st.id}
                              onClick={() => {
                                if (onRateWord) {
                                  onRateWord(w.id, st.id as WordStatus);
                                } else if (onBatchRateWords) {
                                  onBatchRateWords([w.id], st.id as WordStatus);
                                }
                              }}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap ${
                                isActive
                                  ? 'ring-2 ring-slate-800 font-black shadow-xs ' + st.color
                                  : 'opacity-40 hover:opacity-100 ' + st.color
                              }`}
                              title={`Set to ${st.label}`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {filteredGroupWords.length === 0 && (
                  <div className="py-12 text-center text-slate-400 font-sans text-sm">
                    No words match the current filters.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
