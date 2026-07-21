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
import { Course, UserProgress, WordStatus } from '../types';

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
      setCheckoutMessage({ type: 'error', text: 'সবগুলো ঘর সঠিক তথ্য দিয়ে পূরণ করুন।' });
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
        price: selectedBuyCourse.price || 0,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || 'anonymous'
      };

      await setDoc(doc(db, 'access_requests', requestId), requestPayload);

      if (isAutoApproved) {
        onImportCourse(selectedBuyCourse);
        setCheckoutMessage({
          type: 'success',
          text: 'পেমেন্ট স্বয়ংক্রিয়ভাবে ভেরিফাই করা হয়েছে! কোর্সটিতে আপনার তাৎক্ষণিক এক্সেস দেওয়া হয়েছে।'
        });
      } else {
        setCheckoutMessage({
          type: 'success',
          text: 'আপনার এক্সেস রিকোয়েস্টটি সফলভাবে সাবমিট হয়েছে! এডমিন দ্রুত ভেরিফাই করে কোর্সটি একটিভ করে দেবেন।'
        });
      }
    } catch (err) {
      console.error("Error submitting access request:", err);
      setCheckoutMessage({
        type: "error",
        text: "রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।"
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
    let isExpired = false;
    
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
                isExpired = true;
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
    <div className="space-y-6" id="my-courses-view-root">
      {/* 1. Luxurious Banner */}
      <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-indigo-950">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-black uppercase tracking-widest">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> Course & Syllabus Hub
          </span>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-none text-white font-sans">
            আমার কোর্সসমূহ ও সিলেবাস গাইড
          </h2>
          <p className="text-xs sm:text-sm text-indigo-150 leading-relaxed font-medium">
            আপনার নিবন্ধিত সকল কোর্স, সিলেবাসের অন্তর্ভুক্ত কী কী ফিচার অন রয়েছে এবং প্র্যাক্টিসের জন্য কোন কোন গেম চালু আছে তা একনজরে দেখে নিন। এখান থেকে আপনার সক্রিয় কোর্স নিয়ন্ত্রণ করতে পারবেন।
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
            placeholder="কোর্স বা সিলেবাস খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto" id="course-filter-toggles">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            সব কোর্সসমূহ
          </button>
          <button
            onClick={() => setFilter('enrolled')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filter === 'enrolled' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            আমার এক্টিভ/নিবন্ধিত
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filter === 'locked' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            লকড কোর্সসমূহ
          </button>
        </div>
      </div>

      {/* 3. Course Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="compact-courses-grid">
        {filteredCourses.map(course => {
          const userEmailLower = user?.email?.trim().toLowerCase();
          const isAdmin = userEmailLower === 'mohammad.001ekram@gmail.com';
          const isCreator = course.createdBy === user?.email;
          
          let isUserAllowed = !course.isRestricted || isAdmin || isCreator;
          let isExpired = false;
          
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
                      isExpired = true;
                    }
                  }
                }
              }
            } else {
              isUserAllowed = false;
            }
          }

          const isEnrolled = enrolledCourseIds.includes(course.id);
          const isActive = activeCourseId === course.id;
          const courseWords = course.words || [];
          const wordsCount = courseWords.length;
          const progressCount = courseWords.filter(w => progress[w.id]?.status === 'know').length;
          const progressPercent = wordsCount > 0 ? Math.round((progressCount / wordsCount) * 100) : 0;

          // Features (Variables Toggles) List and Statuses
          const variables = [
            { key: 'meaning', label: 'বাংলা অর্থ', icon: BookOpen },
            { key: 'synonyms', label: 'সমার্থক শব্দ', icon: Sparkles },
            { key: 'extraWord', label: 'ডেরিভেটিভ', icon: PlusCircle },
            { key: 'extraMeaning', label: 'ডেরিভেটিভ অর্থ', icon: HelpCircle },
            { key: 'example', label: 'উদাহরণ বাক্য', icon: FileSpreadsheet },
            { key: 'audio', label: 'ভয়েস উচ্চারণ', icon: Volume2 }
          ];

          // Games/Practice Statuses
          const games = [
            { key: 'quiz', label: 'Quiz', icon: GraduationCap },
            { key: 'match', label: 'Match', icon: Gamepad2 },
            { key: 'synonym', label: 'Synonym', icon: Sparkles },
            { key: 'blank', label: 'Blank', icon: BookOpen },
            { key: 'odd_one_out', label: 'OddOne', icon: HelpCircle },
            { key: 'analogy', label: 'Analogy', icon: Shuffle }
          ];

          return (
            <motion.div
              key={course.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between hover:shadow-md ${
                isActive 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/15' 
                  : 'border-slate-200'
              }`}
            >
              {/* Card Header Area */}
              <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 relative">
                {/* Upper row: Status badge */}
                <div className="flex justify-between items-center gap-1.5 mb-2">
                  <div className="flex gap-1 flex-wrap">
                    {!isUserAllowed ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-500 text-white font-black text-[8px] rounded-md uppercase tracking-wider">
                        <Lock className="w-2 h-2" /> Locked (৳{course.price || 0})
                      </span>
                    ) : isActive ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white font-black text-[8px] rounded-md uppercase tracking-wider">
                        <Check className="w-2 h-2" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[8px] rounded-md uppercase tracking-wider border border-indigo-100">
                        Enrolled
                      </span>
                    )}

                    {course.isDefault && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[8px] rounded-md uppercase tracking-wider">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono font-bold">
                    Code: {course.id}
                  </span>
                </div>

                {/* Course Title */}
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight leading-snug line-clamp-1" title={course.title}>
                  {course.title}
                </h3>
                <p className="text-slate-500 text-[11px] mt-1 line-clamp-2 leading-relaxed">
                  {course.description || 'No description available for this course.'}
                </p>
                
                {/* Quick Info */}
                <div className="flex gap-2.5 mt-2 text-[9px] text-slate-400 font-bold">
                  <span>Groups: {course.totalGroups || 1}</span>
                  <span>•</span>
                  <span>Words: {wordsCount}</span>
                </div>
              </div>

              {/* Compact Active Toggles and Games */}
              <div className="p-3.5 space-y-2.5 flex-1">
                {/* Active Features list */}
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 block mb-1">সক্রিয় ফিচারসমূহ:</span>
                  <div className="flex flex-wrap gap-1">
                    {variables.map(v => {
                      const isEnabled = course.variableToggles ? course.variableToggles[v.key] !== false : true;
                      if (!isEnabled) return null;
                      return (
                        <span key={v.key} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50/50 text-indigo-700 border border-indigo-100/30 rounded-md text-[9px] font-bold">
                          <v.icon className="w-2.5 h-2.5" />
                          <span>{v.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Enabled Games list */}
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 block mb-1">প্র্যাক্টিস গেমস:</span>
                  <div className="flex flex-wrap gap-1">
                    {games.map(g => {
                      const isEnabled = course.enabledGames ? course.enabledGames[g.key] !== false : true;
                      if (!isEnabled) return null;
                      return (
                        <span key={g.key} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50/50 text-emerald-800 border border-emerald-100/30 rounded-md text-[9px] font-bold">
                          <g.icon className="w-2.5 h-2.5" />
                          <span>{g.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Course Progress */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-[9px] font-extrabold">
                    <span className="text-slate-400 uppercase tracking-wider">Syllabus Progress</span>
                    <span className="text-emerald-600 font-mono">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2">
                {!isUserAllowed ? (
                  <button
                    onClick={() => setSelectedBuyCourse(course)}
                    className="flex-1 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>কোর্সটি কিনুন (Buy Course - ৳{course.price || 0})</span>
                  </button>
                ) : isActive ? (
                  <div className="flex-1 text-center py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-extrabold rounded-lg border border-emerald-100 select-none">
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
                    }}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Set Active</span>
                  </button>
                )}

                {isUserAllowed && isEnrolled && !course.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`আপনি কি নিশ্চিত যে "${course.title}" কোর্সটি ডিলিট করতে চান?`)) {
                        setEnrolledCourseIds(prev => {
                          const updated = prev.filter(id => id !== course.id);
                          if (isActive && updated.length > 0) {
                            setActiveCourseId(updated[0]);
                          }
                          return updated;
                        });
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-lg transition cursor-pointer flex-shrink-0"
                    title="Delete Course"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 4. empty state */}
      {filteredCourses.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-250 p-12 text-center max-w-lg mx-auto space-y-4 shadow-xs">
          <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full w-fit mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-800 text-sm">কোনো কোর্স পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto leading-relaxed">
              আপনার সার্চ কোয়েরি বা সিলেক্ট করা ফিল্টারের সাথে মিলে যায় এমন কোনো সিলেবাস বা কোর্স পাওয়া যায়নি। অন্য কিছু লিখে খুঁজুন।
            </p>
          </div>
        </div>
      )}

      {/* 5. bKash payment process Modal */}
      <AnimatePresence>
        {selectedBuyCourse && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="course-hub-bkash-modal">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col font-sans border border-slate-100"
            >
              <div className="p-5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-850 text-sm sm:text-base flex items-center gap-2">
                    <span className="p-1 bg-pink-500 rounded-lg text-white font-black text-xs font-mono px-2 py-0.5">bKash</span>
                    Course Access Request
                  </h3>
                  <p className="text-[10px] text-slate-400 font-black mt-0.5">{selectedBuyCourse.title}</p>
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
                  <p className="font-black text-pink-700">বিকাশ সেন্ড মানি নিয়মাবলী (Send Money Instructions):</p>
                  <p className="font-bold text-slate-700 leading-relaxed">
                    নিচের বিকাশ নম্বরে <strong className="text-pink-600 font-black text-sm">{selectedBuyCourse.price || 0} BDT</strong> সেন্ড মানি করুন। এরপর ফর্মটি পূরণ করে রিকোয়েস্ট সাবমিট করুন।
                  </p>
                  <div className="flex items-center justify-between p-2.5 bg-white border border-pink-100 rounded-xl mt-1.5">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold">বিকাশ পার্সোনাল নম্বর:</p>
                      <p className="font-black text-slate-800 text-xs font-mono">{selectedBuyCourse.bkashNumber || '01700000000'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBuyCourse.bkashNumber || '01700000000');
                        alert('বিকাশ নম্বর কপি করা হয়েছে!');
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
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{checkoutMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">
                    ১. বিকাশ প্রেরক নম্বর (বিকাশ নম্বর যেখান থেকে টাকা পাঠিয়েছেন) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bkashSender}
                    onChange={(e) => setBkashSender(e.target.value)}
                    placeholder="যেমনঃ 01712345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">
                    ২. ইমেইল এড্রেস (যেই আইডিতে এক্সেস চালু হবে) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="যেমনঃ student@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">
                    ৩. বিকাশ ট্রানজেকশন আইডি (TrxID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="যেমনঃ K8L9O0P1Q2"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-md shadow-pink-600/10"
                >
                  {isSubmittingRequest ? 'অনুরোধ সাবমিট করা হচ্ছে...' : 'অনুরোধ সাবমিট করুন'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
