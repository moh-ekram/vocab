import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, StudyGoal, Course } from '../types';
import { isCourseEnrolled } from '../lib/courseAccess';
import { Award, BookOpen, Flame, CheckCircle, AlertTriangle, XCircle, HelpCircle, Trophy, TrendingUp, Search, Plus, Sparkles, Check, ChevronRight, X, Crown, RefreshCw, KeyRound, Copy, CreditCard, Trash2, Lock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
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

          {/* Daily Study Progress Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Last 7 Days Study Progress</h4>
                <p className="text-[10px] text-slate-400 font-bold font-sans">History of daily learned words</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                  <span>Words Studied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-rose-400 border-t-2 border-dashed border-rose-400" />
                  <span>Daily Goal ({goal.dailyTarget})</span>
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
              Vocabulary Groups (1-37)
            </h3>
            <p className="text-sm text-slate-500 font-sans">
              Click on any group to start flashcard studies and learning games.
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
                  Group {g.group}
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
              No groups found.
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
