import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Check, Trash2, Lock, Sparkles, Volume2, PlusCircle, 
  FileSpreadsheet, HelpCircle, Shuffle, GraduationCap, Trophy, 
  Gamepad2, Search, CheckCircle, AlertCircle, ShoppingBag, X, 
  Copy, ArrowRight, Star, Heart, Calendar, ShieldAlert, Layers, Play
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { Course, UserProgress, ActiveTab } from '../types';
import { isCourseEnrolled, isCourseAccessible } from '../lib/courseAccess';

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
  onSelectTab?: (tab: ActiveTab) => void;
}

export default function MyCoursesView({
  user,
  allCourses,
  enrolledCourseIds,
  activeCourseId,
  setActiveCourseId,
  setEnrolledCourseIds,
  progress,
  onImportCourse,
  onSelectTab
}: MyCoursesViewProps) {
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail popup modal
  const [selectedDetailCourse, setSelectedDetailCourse] = useState<Course | null>(null);

  // Cart States
  const [cart, setCart] = useState<Course[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartCheckoutMode, setIsCartCheckoutMode] = useState(false);

  // Payment states
  const [selectedBuyCourse, setSelectedBuyCourse] = useState<Course | null>(null);
  const [bkashSender, setBkashSender] = useState('');
  const [accessEmail, setAccessEmail] = useState(user?.email || '');
  const [trxId, setTrxId] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userWalletBalance, setUserWalletBalance] = useState<number>(0);

  useEffect(() => {
    if (user?.email) {
      setAccessEmail(user.email);
      // Fetch user's wallet credit balance
      const fetchWallet = async () => {
        try {
          const walletSnap = await getDoc(doc(db, 'user_wallets', user.email.toLowerCase()));
          if (walletSnap.exists()) {
            setUserWalletBalance(walletSnap.data().balance || 0);
          }
        } catch (e) {
          console.error("Error fetching wallet balance:", e);
        }
      };
      fetchWallet();
    }
  }, [user]);

  const toggleCartCourse = (course: Course, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      if (prev.some(c => c.id === course.id)) {
        return prev.filter(c => c.id !== course.id);
      } else {
        return [...prev, course];
      }
    });
  };

  const removeFromCart = (courseId: string) => {
    setCart(prev => prev.filter(c => c.id !== courseId));
  };

  const cartTotalPrice = cart.reduce((sum, c) => sum + ((c.price && c.price > 0) ? c.price : 30), 0);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isCartPurchase = isCartCheckoutMode && cart.length > 0;
    const targetCourses = isCartPurchase ? cart : (selectedBuyCourse ? [selectedBuyCourse] : []);

    if (targetCourses.length === 0) return;

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

      // --- TRANSACTION ID UNIQUENESS CHECK ---
      const requestsSnap = await getDocs(query(collection(db, 'access_requests')));
      const existingWithTrx = requestsSnap.docs.find(d => {
        const reqData = d.data();
        return reqData.trxId && reqData.trxId.toLowerCase().trim() === matchTrx;
      });

      if (existingWithTrx) {
        setIsSubmittingRequest(false);
        setCheckoutMessage({
          type: 'error',
          text: `এই ট্রাঞ্জেকশন আইডিটি (${cleanTrx}) ইতোমধ্যে একবার একটি কোর্স রিকুয়েস্টে ব্যবহৃত হয়েছে। একই ট্রাঞ্জেকশন আইডি দিয়ে একাধিকবার রিকুয়েস্ট করা সম্ভব নয়।`
        });
        return;
      }

      const courseIds = targetCourses.map(c => c.id);
      const courseTitles = targetCourses.map(c => c.title);
      const courseCodes = targetCourses.map(c => c.code || c.id);
      const totalPrice = targetCourses.reduce((sum, c) => sum + ((c.price && c.price > 0) ? c.price : 30), 0);

      // --- BKASH AUTO-VERIFICATION GATEWAY & WALLET ALLOCATION ---
      let walletRef = doc(db, 'user_wallets', cleanEmail.toLowerCase());
      let walletSnap = await getDoc(walletRef);
      let existingWalletBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;

      // Find matching verified payment entry across all courses
      let matchedVp: { bkashNumber: string; trxId: string; amount?: number } | null = null;
      for (const course of allCourses) {
        if (course.verifiedPayments && course.verifiedPayments.length > 0) {
          const found = course.verifiedPayments.find(vp => {
            const vpPhone = cleanPhone(vp.bkashNumber);
            const vpTrx = vp.trxId.toLowerCase().trim();
            return (vpPhone === matchPhone || vp.bkashNumber.trim() === cleanSender) && vpTrx === matchTrx;
          });
          if (found) {
            matchedVp = found;
            break;
          }
        }
      }

      let totalFundsAvailable = existingWalletBalance + (matchedVp ? (matchedVp.amount || 30) : 0);
      let approvedCourses: Course[] = [];
      let pendingCourses: Course[] = [];
      let remainingBalance = totalFundsAvailable;

      if (matchedVp || existingWalletBalance > 0) {
        for (const c of targetCourses) {
          const cPrice = (c.price && c.price > 0) ? c.price : 30;
          if (remainingBalance >= cPrice) {
            approvedCourses.push(c);
            remainingBalance -= cPrice;
          } else {
            pendingCourses.push(c);
          }
        }
      }

      // Save remaining wallet balance
      if (matchedVp || existingWalletBalance > 0) {
        await setDoc(walletRef, {
          email: cleanEmail.toLowerCase(),
          bkashNumber: cleanSender,
          balance: remainingBalance,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setUserWalletBalance(remainingBalance);
      }

      // Automatically activate approved courses
      if (approvedCourses.length > 0) {
        for (const appCourse of approvedCourses) {
          const courseRef = doc(db, 'courses', appCourse.id);
          const courseSnap = await getDoc(courseRef);
          if (courseSnap.exists()) {
            const currentAllowed = courseSnap.data().allowedUsers || [];
            if (!currentAllowed.includes(cleanEmail.toLowerCase())) {
              await setDoc(courseRef, {
                allowedUsers: [...currentAllowed, cleanEmail.toLowerCase()]
              }, { merge: true });
            }
          }
          onImportCourse(appCourse);
        }
      }

      const isFullyApproved = approvedCourses.length === targetCourses.length;
      const isPartiallyApproved = approvedCourses.length > 0 && !isFullyApproved;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requestPayload = {
        id: requestId,
        courseId: isCartPurchase ? 'multi_cart' : targetCourses[0].id,
        courseTitle: isCartPurchase ? `Cart Purchase (${targetCourses.length} Courses)` : targetCourses[0].title,
        courseCode: courseCodes.join(', '),
        courseIds,
        courseTitles,
        bkashNumber: cleanSender,
        email: cleanEmail.toLowerCase(),
        trxId: cleanTrx,
        status: isFullyApproved ? 'approved' : (isPartiallyApproved ? 'approved' : 'pending'),
        price: targetCourses[0].price || 30,
        totalPrice,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || 'anonymous'
      };

      await setDoc(doc(db, 'access_requests', requestId), requestPayload);

      if (isFullyApproved) {
        setCheckoutMessage({
          type: 'success',
          text: `পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে! আপনার ${targetCourses.length}টি কোর্সে অ্যাক্সেস দেওয়া হয়েছে। ${remainingBalance > 0 ? `অবশিষ্ট ৳${remainingBalance} টাকা আপনার ওয়ালেটে জমা রাখা হয়েছে।` : ''}`
        });
        if (isCartPurchase) setCart([]);
      } else if (isPartiallyApproved) {
        setCheckoutMessage({
          type: 'success',
          text: `প্রাপ্ত টাকার হিসাব অনুযায়ী ${approvedCourses.length}টি কোর্স বরাদ্দ দেওয়া হয়েছে (${approvedCourses.map(c => c.title).join(', ')})। অবশিষ্ট ৳${remainingBalance} টাকা ওয়ালেটে জমা রাখা রয়েছে।`
        });
        if (isCartPurchase) setCart([]);
      } else {
        setCheckoutMessage({
          type: 'success',
          text: isCartPurchase 
            ? `Access request for ${targetCourses.length} courses (Total ৳${totalPrice} BDT) submitted with Course Code(s): ${courseCodes.join(', ')}! Admin will verify and activate all courses shortly.`
            : `Access request submitted successfully for Course Code: ${courseCodes.join(', ')}! Admin will verify and activate your course access shortly.`
        });
        if (isCartPurchase) setCart([]);
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
      if (!prev.some(id => id.trim().toLowerCase() === course.id.trim().toLowerCase())) {
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
    
    const isEnrolled = isCourseEnrolled(c.id, enrolledCourseIds);
    const isUserAllowed = isCourseAccessible(c, enrolledCourseIds, user?.email);

    if (filter === 'enrolled') {
      return matchesSearch && (isEnrolled || isUserAllowed);
    } else if (filter === 'locked') {
      return matchesSearch && !isUserAllowed;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6" id="my-courses-view-root" style={{ fontFamily: "'Poppins', 'Kalpurush', 'SutonnyMJ', sans-serif" }}>
      {/* 1. Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden shadow-lg border border-indigo-950">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-black uppercase tracking-widest font-sans">
            <Trophy className="w-3 h-3 text-amber-400" /> Course & Syllabus Hub
          </span>
          <h2 className="text-lg sm:text-2xl font-black tracking-tight leading-tight text-white">
            My Courses & Syllabus Directory
          </h2>
        </div>
      </div>

      {/* 1.5 Wallet Credit Balance Banner */}
      {userWalletBalance > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
              ৳
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                <span>আপনার ওয়ালেট ব্যালেন্স (Wallet Credit)</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] rounded-full font-black">Active</span>
              </h4>
              <p className="text-xs text-emerald-800 font-normal mt-0.5" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}>
                পূর্বে জমা দেওয়া অবশিষ্ট অর্থ থেকে আপনার অ্যাকাউন্টে <strong>৳{userWalletBalance} BDT</strong> ওয়ালেট ব্যালেন্স জমা রয়েছে। এটি আপনার পরবর্তী কোর্স ক্রয়ে স্বয়ংক্রিয়ভাবে ব্যবহৃত হবে।
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono text-xl sm:text-2xl font-black text-emerald-700 px-3.5 py-1.5 bg-white rounded-xl border border-emerald-200 shadow-2xs block">
              ৳{userWalletBalance}
            </span>
          </div>
        </div>
      )}

      {/* 2. Advanced Search & Tabs Control */}
      <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-center bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 shadow-xs max-w-full overflow-hidden">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses by name or keyword..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-[11px] font-normal transition text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto max-w-full gap-1 shrink-0" id="course-filter-toggles">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap cursor-pointer shrink-0 ${
              filter === 'all' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Courses
          </button>
          <button
            onClick={() => setFilter('enrolled')}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap cursor-pointer shrink-0 ${
              filter === 'enrolled' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            My Active / Enrolled
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap cursor-pointer shrink-0 ${
              filter === 'locked' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Locked Courses
          </button>
        </div>
      </div>

      {/* 3. Modern Course Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5" id="courses-grid-container">
        {filteredCourses.map(course => {
          const isActive = course.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase();
          const isEnrolled = isCourseEnrolled(course.id, enrolledCourseIds);
          const isUserAllowed = isCourseAccessible(course, enrolledCourseIds, user?.email);
          const wordsCount = course.words?.length || 0;

          return (
            <motion.div
              key={course.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedDetailCourse(course)}
              className={`group relative rounded-3xl p-[2.5px] transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                isActive 
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500 shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/15' 
                  : isUserAllowed
                  ? 'bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-md hover:shadow-2xl'
                  : 'bg-gradient-to-r from-purple-400/30 via-pink-400/30 to-amber-400/30 hover:from-purple-500 hover:via-pink-500 hover:to-amber-500 shadow-sm hover:shadow-xl'
              }`}
            >
              {/* Inner Card Container */}
              <div className={`w-full h-full rounded-[22px] p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                isActive 
                  ? 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 text-white' 
                  : 'bg-white text-slate-900'
              }`}>
                {/* Header Row */}
                <div>
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isActive ? (
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white font-black text-[9px] rounded-full uppercase tracking-wider border border-white/30 flex items-center gap-1 shadow-2xs">
                          <Check className="w-3 h-3 text-emerald-200" /> Active Course
                        </span>
                      ) : !isUserAllowed ? (
                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 font-extrabold text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-[9px] rounded-full uppercase tracking-wider">
                          ✓ Enrolled
                        </span>
                      )}

                      {course.isDefault && (
                        <span className={`px-2 py-0.5 font-extrabold text-[9px] rounded-full uppercase tracking-wider ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          Default
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/10 text-emerald-100' : 'bg-slate-100 text-slate-400'
                    }`}>
                      #{course.id}
                    </span>
                  </div>

                  {/* Course Title */}
                  <h3 
                    style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
                    className={`text-base sm:text-lg tracking-tight leading-snug line-clamp-2 my-1.5 ${
                      isActive ? 'text-white' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'
                    }`}
                  >
                    {course.title}
                  </h3>

                  {/* Price Tag */}
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                      isActive ? 'text-white' : 'text-slate-900'
                    }`}>
                      ৳{(course.price && course.price > 0) ? course.price : 30}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isActive ? 'text-emerald-100' : 'text-slate-400'
                    }`}>
                      BDT
                    </span>
                  </div>
                </div>

                {/* Word Count & Feature Indicator */}
                <div 
                  style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
                  className={`mt-3 pt-3 border-t space-y-1 text-xs ${
                    isActive ? 'border-white/20 text-emerald-100' : 'border-slate-100 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-indigo-500'}`} />
                    <span>Vocabulary Words: <strong className={isActive ? 'text-white' : 'text-slate-900'} style={{ fontWeight: 400 }}>{wordsCount}</strong></span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 pt-1 flex items-center gap-2">
                  {!isUserAllowed && (
                    <button
                      type="button"
                      onClick={(e) => toggleCartCourse(course, e)}
                      title={cart.some(c => c.id === course.id) ? "Remove from Cart" : "Add to Cart"}
                      className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                        cart.some(c => c.id === course.id)
                          ? 'bg-emerald-500 text-white border-emerald-600 font-black shadow-2xs'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200/80 font-extrabold'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{cart.some(c => c.id === course.id) ? 'In Cart ✓' : '+ Cart'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isUserAllowed) {
                        setIsCartCheckoutMode(false);
                        setSelectedBuyCourse(course);
                        return;
                      }
                      setActiveCourseId(course.id);
                      if (onSelectTab) {
                        onSelectTab('flashcard');
                      }
                    }}
                    className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${
                      isActive
                        ? 'bg-white text-emerald-800 hover:bg-emerald-50 font-black'
                        : isUserAllowed
                        ? 'bg-slate-900 hover:bg-indigo-600 text-white font-extrabold'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isUserAllowed ? 'Start Flashcard' : 'Buy Now'}</span>
                  </button>
                </div>
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
          const isActive = course.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase();
          const isEnrolled = isCourseEnrolled(course.id, enrolledCourseIds);
          const isUserAllowed = isCourseAccessible(course, enrolledCourseIds, user?.email);
          const wordsCount = course.words?.length || 0;

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
                          <Lock className="w-3 h-3" /> Restricted (৳{(course.price && course.price > 0) ? course.price : 30})
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
                      <span className="text-lg font-black text-amber-900">৳{(course.price && course.price > 0) ? course.price : 30}</span>
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
                <div className="p-4 bg-slate-50 border-t border-slate-150 flex flex-wrap items-center gap-2">
                  {!isUserAllowed ? (
                    <button
                      onClick={() => {
                        setSelectedDetailCourse(null);
                        setSelectedBuyCourse(course);
                      }}
                      className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/10"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Request Access (Buy Course - ৳{(course.price && course.price > 0) ? course.price : 30})</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (!isEnrolled) {
                            handleFreeEnroll(course);
                          }
                          setActiveCourseId(course.id);
                          if (onSelectTab) {
                            onSelectTab('flashcard');
                          }
                          setSelectedDetailCourse(null);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Flashcards</span>
                      </button>

                      {!isActive && (
                        <button
                          onClick={() => {
                            if (!isEnrolled) {
                              handleFreeEnroll(course);
                            } else {
                              setActiveCourseId(course.id);
                            }
                            setSelectedDetailCourse(null);
                          }}
                          className="py-2.5 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>Set Active</span>
                        </button>
                      )}
                    </>
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

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white p-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-indigo-500/30 flex items-center gap-4 transition hover:scale-102">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              <span className="absolute -top-2 -right-2 bg-pink-600 text-white font-black text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-slate-900">
                {cart.length}
              </span>
            </div>
            <div>
              <span className="text-xs font-black block">{cart.length} Course{cart.length > 1 ? 's' : ''} in Cart</span>
              <span className="text-[10px] text-indigo-300 font-bold font-mono">Total: ৳{cartTotalPrice} BDT</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
          >
            View Cart
          </button>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border border-slate-100"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-900 text-base">Course Shopping Cart ({cart.length})</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="p-5 overflow-y-auto space-y-3 flex-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-2">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">Your cart is empty.</p>
                  </div>
                ) : (
                  cart.map((item, index) => {
                    const price = (item.price && item.price > 0) ? item.price : 30;
                    return (
                      <div key={item.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-mono text-indigo-600 font-extrabold block">Course #{index + 1}</span>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">{item.title}</h4>
                          <span className="text-[11px] font-bold text-slate-500 font-mono">৳{price} BDT</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200/60 rounded-xl transition cursor-pointer"
                          title="Remove course from cart"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-150 bg-slate-50/80 space-y-3">
                  <div className="flex items-center justify-between text-sm font-extrabold text-slate-900 px-1">
                    <span>Total Bundle Amount:</span>
                    <span className="text-indigo-600 font-black font-mono text-base">৳{cartTotalPrice} BDT</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Clear Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartCheckoutMode(true);
                        setIsCartOpen(false);
                      }}
                      className="py-2.5 px-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-pink-600/10 flex items-center justify-center gap-1.5"
                    >
                      <span>Checkout ({cart.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Course Access Request Modal (Single or Multi-Course Cart Checkout) */}
      <AnimatePresence>
        {(selectedBuyCourse || (isCartCheckoutMode && cart.length > 0)) && (
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
                    {isCartCheckoutMode && cart.length > 0 
                      ? `Cart Bundle Checkout (${cart.length} Courses)`
                      : 'Course Access Request'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold mt-0.5 truncate max-w-[260px]">
                    {isCartCheckoutMode && cart.length > 0
                      ? cart.map(c => c.title).join(', ')
                      : selectedBuyCourse?.title}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedBuyCourse(null);
                    setIsCartCheckoutMode(false);
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleRequestAccess} className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Cart Courses Breakdown Summary */}
                {isCartCheckoutMode && cart.length > 0 && (
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">Cart Items Summary:</span>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {cart.map((c, idx) => (
                        <div key={c.id} className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="truncate pr-2">{idx + 1}. {c.title}</span>
                          <span className="font-mono text-indigo-700 shrink-0">৳{(c.price && c.price > 0) ? c.price : 30} BDT</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions Box */}
                <div className="p-4 bg-pink-50 border border-pink-100 rounded-2xl space-y-2 text-xs">
                  <p className="font-black text-pink-700">bKash Send Money Instructions:</p>
                  <p className="font-semibold text-slate-700 leading-relaxed">
                    Send <strong className="text-pink-600 font-black text-sm">
                      ৳{isCartCheckoutMode && cart.length > 0 ? cartTotalPrice : ((selectedBuyCourse?.price && selectedBuyCourse.price > 0) ? selectedBuyCourse.price : 30)} BDT
                    </strong> via Send Money to the bKash Personal number below, then fill out and submit this form.
                  </p>
                  <div className="flex items-center justify-between p-2.5 bg-white border border-pink-100 rounded-xl mt-1.5">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">bKash Personal Number:</p>
                      <p className="font-black text-slate-800 text-sm font-mono">
                        {(selectedBuyCourse?.bkashNumber && selectedBuyCourse.bkashNumber !== '01700000000' && selectedBuyCourse.bkashNumber.trim() !== '') ? selectedBuyCourse.bkashNumber : '01581624202'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const num = (selectedBuyCourse?.bkashNumber && selectedBuyCourse.bkashNumber !== '01700000000' && selectedBuyCourse.bkashNumber.trim() !== '') ? selectedBuyCourse.bkashNumber : '01581624202';
                        navigator.clipboard.writeText(num);
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
                  {isSubmittingRequest 
                    ? 'Submitting Request...' 
                    : isCartCheckoutMode && cart.length > 0 
                    ? `Submit Request for ${cart.length} Courses (৳${cartTotalPrice})` 
                    : 'Submit Access Request'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
