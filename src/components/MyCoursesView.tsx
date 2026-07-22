import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Check, Trash2, Lock, Sparkles, Volume2, PlusCircle, 
  FileSpreadsheet, HelpCircle, Shuffle, GraduationCap, Trophy, 
  Gamepad2, Search, CheckCircle, AlertCircle, ShoppingBag, X, 
  Copy, ArrowRight, Star, Heart, Calendar, ShieldAlert
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Course, UserProgress } from '../types';

const getEnglishFeatureLabel = (key: string, placeLabels?: Record<string, string>) => {
  switch (key) {
    case 'meaning': return placeLabels?.place2 || 'Word Meaning';
    case 'synonyms': return placeLabels?.place5 || 'Synonyms';
    case 'extraWord': return placeLabels?.place4 || 'Derivatives';
    case 'extraMeaning': return placeLabels?.place6 || 'Derivative Meaning';
    case 'example': return placeLabels?.place3 || 'Example Sentences';
    case 'audio': return 'Voice Pronunciation';
    default: return key;
  }
};

const getEnglishGameLabel = (key: string, placeLabels?: Record<string, string>) => {
  switch (key) {
    case 'quiz': return 'Practice Quiz';
    case 'match': return 'Word Match';
    case 'synonym': return 'Synonym Check';
    case 'blank': return 'Fill in the Blank';
    case 'odd_one_out': return 'Odd One Out';
    case 'analogy': return 'Word Analogy';
    default: return key;
  }
};

interface MyCoursesViewProps {
  user: any;
  allCourses: Course[];
  enrolledCourseIds: string[];
  activeCourseId: string;
  setActiveCourseId: (id: string) => void;
  setEnrolledCourseIds: React.Dispatch<React.SetStateAction<string[]>>;
  progress: Record<string, UserProgress>;
  onImportCourse: (course: Course) => void;
}

export default function MyCoursesView({
  user,
  allCourses,
  enrolledCourseIds,
  activeCourseId,
  setActiveCourseId,
  setEnrolledCourseIds,
  progress,
  onImportCourse
}: MyCoursesViewProps) {
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail popup modal
  const [selectedDetailCourse, setSelectedDetailCourse] = useState<Course | null>(null);

  // Payment states
  const [selectedBuyCourse, setSelectedBuyCourse] = useState<Course | null>(null);
  const [bkashSender, setBkashSender] = useState('');
  const [accessEmail, setAccessEmail] = useState(user?.email || '');
  const [trxId, setTrxId] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      setCheckoutMessage({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    setIsSubmittingRequest(true);
    setCheckoutMessage(null);

    try {
      const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10);
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
        price: selectedBuyCourse.price ?? 30,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || 'anonymous'
      };

      await setDoc(doc(db, 'access_requests', requestId), requestPayload);

      if (isAutoApproved) {
        onImportCourse(selectedBuyCourse);
        setCheckoutMessage({
          type: 'success',
          text: 'Payment automatically verified! You have been granted instant access to this course.'
        });
      } else {
        setCheckoutMessage({
          type: 'success',
          text: 'Access request submitted successfully! Admin will verify and activate your course access shortly.'
        });
      }
    } catch (err) {
      console.error("Error submitting access request:", err);
      setCheckoutMessage({
        type: "error",
        text: "Error submitting request. Please try again."
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleFreeEnroll = (course: Course) => {
    setEnrolledCourseIds(prev => {
      if (!prev.includes(course.id)) {
        return [...prev, course.id];
      }
      return prev;
    });
    setActiveCourseId(course.id);
  };

  // Filter courses based on selections
  const filteredCourses = allCourses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const userEmailLower = user?.email?.trim().toLowerCase();
    const isAdmin = userEmailLower === 'mohammad.001ekram@gmail.com';
    const isCreator = c.createdBy === user?.email;
    
    let isUserAllowed = !c.isRestricted || isAdmin || isCreator;
    
    if (c.isRestricted && !isAdmin && !isCreator && userEmailLower) {
      const isEmailInAllowed = c.allowedUsers?.some(allowed => allowed.trim().toLowerCase() === userEmailLower);
      if (isEmailInAllowed) {
        isUserAllowed = true;
        if (c.allowedUsersExpiry) {
          const matchingKey = Object.keys(c.allowedUsersExpiry).find(k => k.trim().toLowerCase() === userEmailLower);
          if (matchingKey) {
            const expiryStr = c.allowedUsersExpiry[matchingKey];
            if (expiryStr) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const expiryDate = new Date(expiryStr);
              expiryDate.setHours(23, 59, 59, 999);
              if (today > expiryDate) {
                isUserAllowed = false;
              }
            }
          }
        }
      } else {
        isUserAllowed = false;
      }
    }

    const isEnrolled = enrolledCourseIds.includes(c.id);

    if (filter === 'enrolled') {
      return matchesSearch && isEnrolled && isUserAllowed;
    } else if (filter === 'locked') {
      return matchesSearch && !isUserAllowed;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6" id="my-courses-view-root" style={{ fontFamily: "'Poppins', 'Kalpurush', 'SutonnyMJ', sans-serif" }}>
      {/* 1. Luxurious Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-indigo-950">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-black uppercase tracking-widest font-sans">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> Course & Syllabus Hub
          </span>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight text-white">
            My Courses & Syllabus Directory
          </h2>
          <p className="text-xs sm:text-sm text-indigo-150 leading-relaxed font-medium opacity-90">
            Select an active course, review vocabulary size, and explore enabled study features. Click any course card to open its details.
          </p>
        </div>
      </div>

      {/* 2. Advanced Search & Tabs Control */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses by name or keyword..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto" id="course-filter-toggles">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
              filter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Courses
          </button>
          <button
            onClick={() => setFilter('enrolled')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
              filter === 'enrolled' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            My Active / Enrolled
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
              filter === 'locked' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Locked Courses
          </button>
        </div>
      </div>

      {/* 3. Compact Course Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4" id="courses-grid-container">
        {filteredCourses.map(course => {
          const isActive = course.id === activeCourseId;
          const isEnrolled = enrolledCourseIds.includes(course.id);
          const wordsCount = course.words?.length || 0;

          const userEmailLower = user?.email?.trim().toLowerCase();
          const isAdmin = userEmailLower === 'mohammad.001ekram@gmail.com';
          const isCreator = course.createdBy === user?.email;
          let isUserAllowed = !course.isRestricted || isAdmin || isCreator;
          
          if (course.isRestricted && !isAdmin && !isCreator && userEmailLower) {
            const isEmailInAllowed = course.allowedUsers?.some(allowed => allowed.trim().toLowerCase() === userEmailLower);
            if (isEmailInAllowed) {
              isUserAllowed = true;
              if (course.allowedUsersExpiry) {
                const matchingKey = Object.keys(course.allowedUsersExpiry).find(k => k.trim().toLowerCase() === userEmailLower);
                if (matchingKey) {
                  const expiryStr = course.allowedUsersExpiry[matchingKey];
                  if (expiryStr) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const expiryDate = new Date(expiryStr);
                    expiryDate.setHours(23, 59, 59, 999);
                    if (today > expiryDate) {
                      isUserAllowed = false;
                    }
                  }
                }
              }
            } else {
              isUserAllowed = false;
            }
          }

          return (
            <motion.div
              key={course.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSelectedDetailCourse(course)}
              className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group min-h-[120px] ${
                isActive 
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-emerald-500/20 hover:bg-emerald-700' 
                  : 'bg-white border-slate-200/90 text-slate-900 hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {/* Header Row Badge */}
              <div className="flex justify-between items-center gap-1.5 mb-2.5">
                <div className="flex items-center gap-1 flex-wrap">
                  {isActive ? (
                    <span className="px-2.5 py-0.5 bg-emerald-800/80 text-emerald-100 font-black text-[9px] rounded-full uppercase tracking-wider border border-emerald-400/30 flex items-center gap-1 shadow-2xs">
                      <Check className="w-3 h-3 text-emerald-300" /> Active Course
                    </span>
                  ) : !isUserAllowed ? (
                    <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 border border-rose-200 font-extrabold text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked (৳{course.price ?? 30})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-[9px] rounded-full uppercase tracking-wider">
                      Enrolled
                    </span>
                  )}

                  {course.isDefault && (
                    <span className={`px-2 py-0.5 font-extrabold text-[9px] rounded-full uppercase tracking-wider ${
                      isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
                    }`}>
                      Default
                    </span>
                  )}
                </div>

                <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                  #{course.id}
                </span>
              </div>

              {/* Course Title - Large Poppins / Kalpurush / SutonnyMJ font */}
              <div className="my-1.5">
                <h3 
                  className={`text-base sm:text-lg font-black tracking-tight leading-snug line-clamp-2 ${
                    isActive ? 'text-white drop-shadow-xs' : 'text-slate-900'
                  }`}
                >
                  {course.title}
                </h3>
              </div>

              {/* Word Count - Large Poppins / Kalpurush / SutonnyMJ font */}
              <div className={`mt-3 pt-2.5 border-t flex justify-between items-center ${
                isActive ? 'border-emerald-500/60 text-emerald-100' : 'border-slate-100 text-slate-500'
              }`}>
                <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-85">
                  Total Words
                </span>
                <span className={`text-sm sm:text-base font-black ${isActive ? 'text-white' : 'text-indigo-600'}`}>
                  {wordsCount} Words
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredCourses.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4 shadow-xs">
          <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full w-fit mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">No courses found</h3>
            <p className="text-xs text-slate-500 mt-1">Try changing your search keywords or filter options.</p>
          </div>
        </div>
      )}

      {/* 4. Course Detail Pop-Up Modal */}
      <AnimatePresence>
        {selectedDetailCourse && (() => {
          const course = selectedDetailCourse;
          const isActive = course.id === activeCourseId;
          const isEnrolled = enrolledCourseIds.includes(course.id);
          const wordsCount = course.words?.length || 0;

          const userEmailLower = user?.email?.trim().toLowerCase();
          const isAdmin = userEmailLower === 'mohammad.001ekram@gmail.com';
          const isCreator = course.createdBy === user?.email;
          let isUserAllowed = !course.isRestricted || isAdmin || isCreator;
          
          if (course.isRestricted && !isAdmin && !isCreator && userEmailLower) {
            const isEmailInAllowed = course.allowedUsers?.some(allowed => allowed.trim().toLowerCase() === userEmailLower);
            if (isEmailInAllowed) {
              isUserAllowed = true;
            } else {
              isUserAllowed = false;
            }
          }

          const courseWords = course.words || [];
          const progressCount = courseWords.filter(w => progress[w.id]?.status === 'know').length;
          const progressPercent = wordsCount > 0 ? Math.round((progressCount / wordsCount) * 100) : 0;

          const variables = [
            { key: 'meaning', label: 'Word Meaning', icon: BookOpen },
            { key: 'synonyms', label: 'Synonyms', icon: Sparkles },
            { key: 'extraWord', label: 'Derivatives', icon: PlusCircle },
            { key: 'extraMeaning', label: 'Derivative Meaning', icon: HelpCircle },
            { key: 'example', label: 'Example Sentences', icon: FileSpreadsheet },
            { key: 'audio', label: 'Voice Pronunciation', icon: Volume2 }
          ];

          const games = [
            { key: 'quiz', label: 'Practice Quiz', icon: GraduationCap },
            { key: 'match', label: 'Word Match', icon: Gamepad2 },
            { key: 'synonym', label: 'Synonym Check', icon: Sparkles },
            { key: 'blank', label: 'Fill in the Blank', icon: BookOpen },
            { key: 'odd_one_out', label: 'Odd One Out', icon: HelpCircle },
            { key: 'analogy', label: 'Word Analogy', icon: Shuffle }
          ];

          return (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="course-detail-modal-container">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border border-slate-100"
                style={{ fontFamily: "'Poppins', 'Kalpurush', 'SutonnyMJ', sans-serif" }}
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isActive ? (
                        <span className="px-2.5 py-0.5 bg-emerald-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active Course
                        </span>
                      ) : !isUserAllowed ? (
                        <span className="px-2 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Restricted (৳{course.price ?? 30})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[9px] rounded-full uppercase tracking-wider border border-indigo-100">
                          Enrolled
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono font-bold">Code: {course.id}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                      {course.title}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedDetailCourse(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
                  {/* Course Description */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Description</span>
                    <p className="text-xs text-slate-650 leading-relaxed font-medium bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      {course.description || 'No description specified for this course.'}
                    </p>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100/60">
                      <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-wider block">Total Words</span>
                      <span className="text-lg font-black text-indigo-900">{wordsCount}</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100/60">
                      <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Total Groups</span>
                      <span className="text-lg font-black text-emerald-900">{course.totalGroups || 1}</span>
                    </div>
                    <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100/60">
                      <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-wider block">Course Price</span>
                      <span className="text-lg font-black text-amber-900">৳{course.price ?? 30}</span>
                    </div>
                  </div>

                  {/* Active Features & Games */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* Features */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Features</span>
                      <ul className="space-y-1 text-xs">
                        {variables.map(v => {
                          const isEnabled = course.variableToggles ? course.variableToggles[v.key] !== false : true;
                          if (!isEnabled) return null;
                          const label = getEnglishFeatureLabel(v.key, course.placeLabels);
                          return (
                            <li key={v.key} className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <span className="text-indigo-500 font-black">•</span>
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Games */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Practice Games</span>
                      <ul className="space-y-1 text-xs">
                        {games.map(g => {
                          const isEnabled = course.enabledGames ? course.enabledGames[g.key] !== false : true;
                          if (!isEnabled) return null;
                          const label = getEnglishGameLabel(g.key, course.placeLabels);
                          return (
                            <li key={g.key} className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <span className="text-emerald-500 font-black">•</span>
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center text-[10px] font-black">
                      <span className="text-slate-400 uppercase tracking-wider">Syllabus Progress</span>
                      <span className="text-emerald-600 font-mono">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center gap-2">
                  {!isUserAllowed ? (
                    <button
                      onClick={() => {
                        setSelectedDetailCourse(null);
                        setSelectedBuyCourse(course);
                      }}
                      className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/10"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Request Access (Buy Course - ৳{course.price ?? 30})</span>
                    </button>
                  ) : isActive ? (
                    <div className="flex-1 text-center py-2.5 bg-emerald-50 text-emerald-700 text-xs font-black rounded-xl border border-emerald-200 select-none">
                      ✓ Currently Active Course
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!isEnrolled) {
                          handleFreeEnroll(course);
                        } else {
                          setActiveCourseId(course.id);
                        }
                        setSelectedDetailCourse(null);
                      }}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Set as Active Course</span>
                    </button>
                  )}

                  {isUserAllowed && isEnrolled && !course.isDefault && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${course.title}"?`)) {
                          setEnrolledCourseIds(prev => {
                            const updated = prev.filter(id => id !== course.id);
                            if (isActive && updated.length > 0) {
                              setActiveCourseId(updated[0]);
                            }
                            return updated;
                          });
                          setSelectedDetailCourse(null);
                        }
                      }}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer flex-shrink-0"
                      title="Delete Course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 5. Course Access Request Modal */}
      <AnimatePresence>
        {selectedBuyCourse && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="course-hub-bkash-modal">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border border-slate-100"
              style={{ fontFamily: "'Poppins', 'Kalpurush', 'SutonnyMJ', sans-serif" }}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-850 text-base flex items-center gap-2">
                    <span className="p-1 bg-pink-500 rounded-lg text-white font-black text-xs font-mono px-2 py-0.5">bKash</span>
                    Course Access Request
                  </h3>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">{selectedBuyCourse.title}</p>
                </div>
                <button 
                  onClick={() => setSelectedBuyCourse(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleRequestAccess} className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Instructions Box */}
                <div className="p-4 bg-pink-50 border border-pink-100 rounded-2xl space-y-2 text-xs">
                  <p className="font-black text-pink-700">bKash Send Money Instructions:</p>
                  <p className="font-semibold text-slate-700 leading-relaxed">
                    Send <strong className="text-pink-600 font-black text-sm">৳{selectedBuyCourse.price ?? 30} BDT</strong> via Send Money to the bKash Personal number below, then fill out and submit this form.
                  </p>
                  <div className="flex items-center justify-between p-2.5 bg-white border border-pink-100 rounded-xl mt-1.5">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">bKash Personal Number:</p>
                      <p className="font-black text-slate-800 text-sm font-mono">{selectedBuyCourse.bkashNumber || '01581624202'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBuyCourse.bkashNumber || '01581624202');
                        alert('bKash number copied to clipboard!');
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer border border-indigo-100 shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Number
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
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{checkoutMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">
                    1. bKash Sender Number (Mobile number used for payment) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bkashSender}
                    onChange={(e) => setBkashSender(e.target.value)}
                    placeholder="e.g. 01712345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">
                    2. Email Address (Account email to unlock course) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="e.g. student@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">
                    3. Transaction ID (TrxID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="e.g. K8L9O0P1Q2"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-md shadow-pink-600/10"
                >
                  {isSubmittingRequest ? 'Submitting Request...' : 'Submit Access Request'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
