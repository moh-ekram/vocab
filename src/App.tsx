import React, { useState, useEffect, useRef } from 'react';
import { vocabulary } from './data/vocabulary';
import { UserProgress, WordStatus, CustomFolder, StudyGoal, ActiveTab, AppSettings } from './types';
import StatsDashboard from './components/StatsDashboard';
import FlashcardViewer from './components/FlashcardViewer';
import SynonymCheck from './components/SynonymCheck';
import PracticeQuiz from './components/PracticeQuiz';
import WordMatchGame from './components/WordMatchGame';
import CustomLists from './components/CustomLists';
import SearchDictionary from './components/SearchDictionary';
import DailyPlanner from './components/DailyPlanner';
import AppSettingsView from './components/AppSettingsView';
import AdminPanel from './components/AdminPanel';
import GlobalLeaderboard from './components/GlobalLeaderboard';

import {
  LayoutDashboard,
  Layers,
  GraduationCap,
  Sparkles,
  BookMarked,
  Search,
  CalendarCheck2,
  BookOpen,
  FolderLock,
  RotateCcw,
  Sparkle,
  Cloud,
  LogOut,
  User,
  AlertCircle,
  Trophy,
  Settings,
  CreditCard
} from 'lucide-react';

import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from './lib/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { Course } from './types';
import AuthModal from './components/AuthModal';

const LOCAL_STORAGE_PROGRESS_KEY = 'vocab_memorizer_progress_v2';
const LOCAL_STORAGE_FOLDERS_KEY = 'vocab_memorizer_folders_v2';
const LOCAL_STORAGE_GOALS_KEY = 'vocab_memorizer_goals_v2';
const LOCAL_STORAGE_SYNONYM_PROGRESS_KEY = 'vocab_memorizer_synonym_progress_v2';
const LOCAL_STORAGE_SETTINGS_KEY = 'vocab_memorizer_settings_v3';
const LOCAL_STORAGE_ENROLLED_COURSES_KEY = 'vocab_memorizer_enrolled_courses_v2';
const LOCAL_STORAGE_ACTIVE_COURSE_KEY = 'vocab_memorizer_active_course_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedGroupFromDash, setSelectedGroupFromDash] = useState<number | string | null>(null);

  // --- PERSISTED STATES ---
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_ENROLLED_COURSES_KEY);
    return saved ? JSON.parse(saved) : ['gre'];
  });

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVE_COURSE_KEY);
    return saved ? saved : 'gre';
  });

  const [customCourses, setCustomCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('vocab_memorizer_cached_custom_courses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [importedCourses, setImportedCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('vocab_memorizer_imported_courses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [progress, setProgress] = useState<Record<string, UserProgress>>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [folders, setFolders] = useState<CustomFolder[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'গুরুত্বপূর্ণ শব্দ (High Priority)', color: '#ef4444' },
      { id: '2', name: 'কঠিন সিনোনিম (Hard Synonyms)', color: '#f59e0b' }
    ];
  });

  const [goal, setGoal] = useState<StudyGoal>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
    return saved ? JSON.parse(saved) : {
      dailyTarget: 15,
      streak: 1,
      lastStudyDate: new Date().toISOString().split('T')[0],
      history: {}
    };
  });

  const [synonymProgress, setSynonymProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SYNONYM_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      defaultFlashcardTags: parsed.defaultFlashcardTags || ['know', 'confusion', 'dont_know', 'unrated'],
      defaultFlashcardOrder: parsed.defaultFlashcardOrder || 'random',
      autoPlayAudio: !!parsed.autoPlayAudio,
      quizLength: parsed.quizLength || 10,
      
      // New custom default settings fields
      defaultSynonymOrder: parsed.defaultSynonymOrder || 'random',
      defaultSynonymTags: parsed.defaultSynonymTags || ['know', 'dont_know', 'unrated'],
      defaultQuizType: parsed.defaultQuizType || 'mcq_en_bn',
      defaultMatchSize: parsed.defaultMatchSize || 8,

      // Default keyboard shortcuts mapping
      shortcuts: parsed.shortcuts || {
        'Space': 'flip',
        'ArrowRight': 'know',
        'ArrowLeft': 'dont_know',
        'ArrowUp': 'confusion',
        'ArrowDown': 'skip',
        'Enter': 'audio'
      },

      // Default flashcard rotation animation
      flashcardAnimation: parsed.flashcardAnimation || 'flip-h',

      // Default colorize main word setting
      colorizeMainWord: parsed.colorizeMainWord !== undefined ? !!parsed.colorizeMainWord : true
    };
  });

  const [quizScore, setQuizScore] = useState<number>(() => {
    const saved = localStorage.getItem('vocab_memorizer_quiz_score');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [quizTaken, setQuizTaken] = useState<number>(() => {
    const saved = localStorage.getItem('vocab_memorizer_quiz_taken');
    return saved ? parseInt(saved, 10) : 0;
  });

  // --- FIREBASE SYNC & AUTH STATES ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const isSyncingFromCloud = useRef(false);
  const [hasLoadedFromCloud, setHasLoadedFromCloud] = useState(false);

  // Local Storage Save
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(goal));
  }, [goal]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SYNONYM_PROGRESS_KEY, JSON.stringify(synonymProgress));
  }, [synonymProgress]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_ENROLLED_COURSES_KEY, JSON.stringify(enrolledCourseIds));
  }, [enrolledCourseIds]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_COURSE_KEY, activeCourseId);
  }, [activeCourseId]);

  useEffect(() => {
    localStorage.setItem('vocab_memorizer_quiz_score', String(quizScore));
  }, [quizScore]);

  useEffect(() => {
    localStorage.setItem('vocab_memorizer_quiz_taken', String(quizTaken));
  }, [quizTaken]);

  // Load custom courses with an offline-first caching mechanism (one-time fetch instead of continuous snapshot reads)
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const coursesRef = collection(db, 'courses');
        const querySnapshot = await getDocs(coursesRef);
        const loaded: Course[] = [];
        querySnapshot.forEach(doc => {
          loaded.push({ id: doc.id, ...doc.data() } as Course);
        });
        setCustomCourses(loaded);
        localStorage.setItem('vocab_memorizer_cached_custom_courses', JSON.stringify(loaded));
      } catch (error) {
        console.error("Error reading courses from Firestore (Offline-first mode active):", error);
      }
    };
    fetchCourses();
  }, []);

  // Filter custom courses based on user permissions
  const filteredCustomCourses = customCourses.filter(c => {
    // Admin user email bypasses all restrictions
    const isAdmin = user?.email === 'mohammad.001ekram@gmail.com';
    if (isAdmin) return true;

    // Course creator bypasses restrictions
    if (c.createdBy === user?.email) return true;

    // If restricted, check if user's email or mobile is listed
    if (c.isRestricted) {
      if (!user?.email) return false;
      const userIdentifier = user.email.trim().toLowerCase();
      return c.allowedUsers?.some(allowed => {
        const allowedClean = allowed.trim().toLowerCase();
        return allowedClean === userIdentifier;
      });
    }

    // Public courses (not restricted) are accessible to anyone
    return true;
  });

  // Auto-enroll default custom courses so they are immediately visible to users
  useEffect(() => {
    if (filteredCustomCourses.length > 0) {
      const defaultIds = filteredCustomCourses.filter(c => c.isDefault).map(c => c.id);
      if (defaultIds.length > 0) {
        setEnrolledCourseIds(prev => {
          const newIds = [...prev];
          let updated = false;
          defaultIds.forEach(id => {
            if (!newIds.includes(id)) {
              newIds.push(id);
              updated = true;
            }
          });
          return updated ? newIds : prev;
        });
      }
    }
  }, [filteredCustomCourses]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncStatus('syncing');
        setHasLoadedFromCloud(false);
        isSyncingFromCloud.current = true;
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();

            // Merge cloud progress with local progress
            if (data.progress) {
              setProgress(prev => ({ ...prev, ...data.progress }));
            }
            if (data.folders && Array.isArray(data.folders)) {
              setFolders(data.folders);
            }
            if (data.goal) {
              setGoal(prev => ({
                ...prev,
                ...data.goal,
                dailyTarget: data.goal.dailyTarget || prev.dailyTarget,
                streak: Math.max(prev.streak || 1, data.goal.streak || 1)
              }));
            }
            if (data.synonymProgress) {
              setSynonymProgress(prev => ({ ...prev, ...data.synonymProgress }));
            }
            if (data.settings) {
              setSettings(prev => ({ ...prev, ...data.settings }));
            }
            if (data.enrolledCourseIds && Array.isArray(data.enrolledCourseIds)) {
              setEnrolledCourseIds(data.enrolledCourseIds);
            }
            if (data.activeCourseId) {
              setActiveCourseId(data.activeCourseId);
            }
            if (data.quizScore !== undefined) {
              setQuizScore(data.quizScore);
            }
            if (data.quizTaken !== undefined) {
              setQuizTaken(data.quizTaken);
            }
            setSyncStatus('synced');
            setHasLoadedFromCloud(true);
          } else {
            // New user signup: back up current local state to cloud immediately
            await setDoc(userDocRef, {
              progress,
              folders,
              goal,
              synonymProgress,
              settings,
              enrolledCourseIds,
              activeCourseId,
              quizScore,
              quizTaken,
              email: currentUser.email,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            setSyncStatus('synced');
            setHasLoadedFromCloud(true);
          }
        } catch (err) {
          console.error('Error fetching user data from Firestore:', err);
          setSyncStatus('error');
        } finally {
          setTimeout(() => {
            isSyncingFromCloud.current = false;
          }, 500);
        }
      } else {
        isSyncingFromCloud.current = false;
        setHasLoadedFromCloud(false);
        setSyncStatus('idle');
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync to Cloud whenever state changes and user is logged in (debounced)
  useEffect(() => {
    if (!user || !hasLoadedFromCloud) {
      setSyncStatus('idle');
      return;
    }

    if (isSyncingFromCloud.current) {
      return;
    }

    const performSync = async () => {
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'users', user.uid), {
          progress,
          folders,
          goal,
          synonymProgress,
          settings,
          enrolledCourseIds,
          activeCourseId,
          quizScore,
          quizTaken,
          email: user.email,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('synced');
      } catch (err) {
        console.error('Error saving to Firestore:', err);
        setSyncStatus('error');
      }
    };

    const timer = setTimeout(() => {
      performSync();
    }, 1000);

    return () => clearTimeout(timer);
  }, [progress, folders, goal, synonymProgress, settings, enrolledCourseIds, activeCourseId, quizScore, quizTaken, user, hasLoadedFromCloud]);

  const forceSyncToCloud = async () => {
    if (!user || !hasLoadedFromCloud) return;
    setSyncStatus('syncing');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        progress,
        folders,
        goal,
        synonymProgress,
        settings,
        enrolledCourseIds,
        activeCourseId,
        quizScore,
        quizTaken,
        email: user.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSyncStatus('synced');
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
    }
  };

  const handleLogOut = async () => {
    if (confirm('আপনি কি নিশ্চিত যে লগআউট করতে চান?')) {
      try {
        await signOut(auth);
        
        // Reset to local Storage values
        const savedProgress = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
        setProgress(savedProgress ? JSON.parse(savedProgress) : {});

        const savedFolders = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
        setFolders(savedFolders ? JSON.parse(savedFolders) : [
          { id: '1', name: 'গুরুত্বপূর্ণ শব্দ (High Priority)', color: '#ef4444' },
          { id: '2', name: 'কঠিন সিনোনিম (Hard Synonyms)', color: '#f59e0b' }
        ]);

        const savedGoal = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
        setGoal(savedGoal ? JSON.parse(savedGoal) : {
          dailyTarget: 15,
          streak: 1,
          lastStudyDate: new Date().toISOString().split('T')[0],
          history: {}
        });

        const savedSynonymProgress = localStorage.getItem(LOCAL_STORAGE_SYNONYM_PROGRESS_KEY);
        setSynonymProgress(savedSynonymProgress ? JSON.parse(savedSynonymProgress) : {});

        const savedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
        setSettings(savedSettings ? JSON.parse(savedSettings) : {
          defaultFlashcardTags: ['dont_know'],
          defaultFlashcardOrder: 'random',
          autoPlayAudio: false,
          quizLength: 10
        });

        const savedEnrolled = localStorage.getItem(LOCAL_STORAGE_ENROLLED_COURSES_KEY);
        setEnrolledCourseIds(savedEnrolled ? JSON.parse(savedEnrolled) : ['gre']);

        const savedActive = localStorage.getItem(LOCAL_STORAGE_ACTIVE_COURSE_KEY);
        setActiveCourseId(savedActive ? savedActive : 'gre');

        setUser(null);
      } catch (err) {
        console.error('Log out failed:', err);
      }
    }
  };

  // Handle active streak checks on load
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    setGoal(prev => {
      let currentStreak = prev.streak || 1;
      let lastDate = prev.lastStudyDate || todayStr;

      if (lastDate === yesterdayStr) {
        // Streak continues, do nothing yet till they study today
      } else if (lastDate !== todayStr) {
        // Broke streak (inactive for over 1 day)
        currentStreak = 1;
      }

      return {
        ...prev,
        streak: currentStreak,
        lastStudyDate: todayStr
      };
    });
  }, []);

  // helper function to format current date string
  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // --- COURSE RESOLVERS ---
  const dbGreCourse = customCourses.find(c => c.id === 'gre');
  const defaultGreCourse: Course = {
    id: 'gre',
    title: dbGreCourse?.title || 'BARC Vocabulary Book',
    description: dbGreCourse?.description || '৩৮ গ্রুপের ১১লোটি ব্যারনস ওয়ার্ড প্রিপারেশন কোর্স (Default)',
    totalGroups: 37,
    words: vocabulary,
    isDefault: dbGreCourse !== undefined ? dbGreCourse.isDefault : true,
    isRestricted: dbGreCourse?.isRestricted || false,
    allowedUsers: dbGreCourse?.allowedUsers || [],
    createdAt: dbGreCourse?.createdAt || new Date('2026-01-01').toISOString(),
    createdBy: dbGreCourse?.createdBy || 'system'
  };

  const allCourses: Course[] = [defaultGreCourse, ...filteredCustomCourses.filter(c => c.id !== 'gre'), ...importedCourses];

  const handleImportCourse = (course: Course) => {
    setImportedCourses(prev => {
      if (prev.some(c => c.id === course.id)) {
        return prev;
      }
      const updated = [...prev, course];
      localStorage.setItem('vocab_memorizer_imported_courses', JSON.stringify(updated));
      return updated;
    });

    setEnrolledCourseIds(prev => {
      if (!prev.includes(course.id)) {
        return [...prev, course.id];
      }
      return prev;
    });

    setActiveCourseId(course.id);
  };

  const activeCourse = allCourses.find(c => c.id === activeCourseId) || defaultGreCourse;
  const activeWords = activeCourse.words || [];

  // --- DATABASE STATE HANDLERS ---

  // Rate/Tag word ('pari', 'pari na', 'confusion')
  const handleRateWord = (wordId: string, status: WordStatus) => {
    const oldStatus = progress[wordId]?.status || 'unrated';

    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          status
        }
      };
    });

    // Increment Today's Study counter if marked as "know" or completed
    if (status !== 'unrated' && oldStatus !== status) {
      const todayStr = getTodayString();
      setGoal(prev => {
        const currentCount = prev.history[todayStr] || 0;
        const newHistory = { ...prev.history, [todayStr]: currentCount + 1 };

        // Streak logic on studying
        let newStreak = prev.streak;
        if (prev.lastStudyDate !== todayStr) {
          newStreak += 1;
        }

        return {
          ...prev,
          streak: newStreak,
          lastStudyDate: todayStr,
          history: newHistory
        };
      });
    }
  };

  // Update personal Notes
  const handleUpdateNotes = (wordId: string, notes: string) => {
    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          notes
        }
      };
    });
  };

  // Toggle Bookmark inside custom lists
  const handleToggleBookmark = (wordId: string, folderId: string) => {
    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      const currentBookmarks = prevWord.bookmarks || [];
      const updatedBookmarks = currentBookmarks.includes(folderId)
        ? currentBookmarks.filter(id => id !== folderId)
        : [...currentBookmarks, folderId];

      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          bookmarks: updatedBookmarks
        }
      };
    });
  };

  // Folder creator
  const handleCreateFolder = (name: string, color: string) => {
    setFolders(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name,
        color
      }
    ]);
  };

  // Folder Deleter
  const handleDeleteFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    // clean from word bookmarks
    setProgress(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(key => {
        if (copy[key].bookmarks) {
          copy[key].bookmarks = copy[key].bookmarks.filter(id => id !== folderId);
        }
      });
      return copy;
    });
  };

  // Remove word from folder list directly
  const handleRemoveFromFolder = (wordId: string, folderId: string) => {
    handleToggleBookmark(wordId, folderId);
  };

  // Launch folder focused flashcard session
  const handleLaunchFolderStudy = (folderId: string) => {
    setSelectedGroupFromDash(null);
    setActiveTab('flashcard');
  };

  // Update Synonym Checking progress
  const handleUpdateSynonymProgress = (wordId: string, correct: boolean) => {
    setSynonymProgress(prev => {
      return {
        ...prev,
        [wordId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Clear data function for reset/refresh study
  const handleClearAllProgress = () => {
    if (confirm('আপনি কি নিশ্চিত যে আপনার পড়াশোনার সমস্ত প্রগ্রেস এবং স্ট্রিক মুছে ফেলতে চান? এটি পুনরায় ফিরিয়ে আনা সম্ভব নয়।')) {
      setProgress({});
      setGoal({
        dailyTarget: 15,
        streak: 1,
        lastStudyDate: new Date().toISOString().split('T')[0],
        history: {}
      });
      setSynonymProgress({});
      alert('সফলভাবে সমস্ত প্রগ্রেস মুছে ফেলা হয়েছে।');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800" id="main-layout-stage">
      {/* Top Header / Main Banner (Unified for Mobile & Desktop) */}
      <header className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 md:px-8 md:py-5 flex items-center justify-between shadow-md flex-shrink-0" id="main-header-banner">
        <div className="flex items-center gap-2.5 md:gap-3.5">
          <div className="p-2 md:p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
            <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black tracking-tight font-sans">ভোকাবুলারি মেমোরি</h1>
            <p className="text-[9px] md:text-xs text-indigo-200 font-bold uppercase tracking-wider font-sans">৩৭ গ্রুপ লার্নিং ড্যাশবোর্ড</p>
          </div>
        </div>

        {/* User Stats & Auth (Unified Header UI) */}
        <div className="flex items-center gap-2 md:gap-3.5">
          {user ? (
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl">
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-[10px] md:text-xs border border-white/10 flex-shrink-0">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block text-left max-w-[120px] md:max-w-[150px]">
                <p className="text-[11px] md:text-xs font-extrabold text-white truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </p>
                <span className="text-[9px] md:text-[10px] text-indigo-200 font-bold block truncate">
                  {user.email}
                </span>
              </div>
              
              {/* Sync Status Info */}
              <div className="hidden md:flex items-center gap-1.5 bg-indigo-950/45 border border-indigo-500/15 px-2 py-1 rounded-lg text-[9px]">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'synced' ? 'bg-emerald-400 animate-pulse' :
                  syncStatus === 'syncing' ? 'bg-indigo-400 animate-spin' :
                  syncStatus === 'error' ? 'bg-rose-400' : 'bg-slate-400'
                }`} />
                <span className="text-indigo-200 font-semibold">
                  {syncStatus === 'synced' && 'ব্যাকআপ সচল'}
                  {syncStatus === 'syncing' && 'সিঙ্ক হচ্ছে...'}
                  {syncStatus === 'error' && 'সিঙ্ক ত্রুটি!'}
                  {syncStatus === 'idle' && 'অপেক্ষমাণ'}
                </span>
              </div>

              {/* Force Sync button */}
              <button
                onClick={forceSyncToCloud}
                className="text-[10px] text-indigo-200 hover:text-white font-extrabold cursor-pointer hover:underline bg-white/10 px-2 py-0.5 rounded-md transition"
                disabled={syncStatus === 'syncing'}
                title="ম্যানুয়াল সিঙ্ক করুন"
              >
                {syncStatus === 'syncing' ? '...' : 'সিঙ্ক'}
              </button>

              <button
                onClick={handleLogOut}
                className="p-1 text-indigo-200 hover:text-rose-400 rounded-lg transition cursor-pointer"
                title="লগআউট"
              >
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-[10px] md:text-xs font-extrabold px-3 py-2 md:px-4 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shadow-md shadow-indigo-500/20"
            >
              ক্লাউড ব্যাকআপ (লগইন)
            </button>
          )}
        </div>
      </header>

      {/* Unified Horizontal Menu Bar (Sits directly under the main banner) */}
      <div className="bg-white border-b border-slate-200/60 overflow-x-auto flex items-center gap-1.5 p-2 md:px-8 md:py-3 scrollbar-none flex-shrink-0" id="horizontal-menu-navigation">
        <button
          onClick={() => {
            setSelectedGroupFromDash(null);
            setActiveTab('dashboard');
          }}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden md:inline">ড্যাশবোর্ড</span>
        </button>

        <button
          onClick={() => setActiveTab('flashcard')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'flashcard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4 animate-icon-flip" />
          <span className="hidden md:inline">ফ্ল্যাশ কার্ড</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="hidden md:inline">লিডারবোর্ড</span>
        </button>

        <button
          onClick={() => setActiveTab('synonym')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'synonym'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Sparkle className="w-4 h-4 text-amber-500" />
          <span className="hidden md:inline">সিনোনিম চেক</span>
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'quiz'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span className="hidden md:inline">পরীক্ষা ও কুইজ</span>
        </button>

        <button
          onClick={() => setActiveTab('match')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'match'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden md:inline">শব্দমিল</span>
        </button>

        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'dictionary'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden md:inline">শব্দ ভান্ডার</span>
        </button>

        <button
          onClick={() => setActiveTab('lists')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'lists'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <BookMarked className="w-4 h-4" />
          <span className="hidden md:inline">বুকমার্ক</span>
        </button>

        <button
          onClick={() => setActiveTab('planner')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'planner'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" />
          <span className="hidden md:inline">প্ল্যানার</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden md:inline">সেটিংস</span>
        </button>

        {user && user.email === 'mohammad.001ekram@gmail.com' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold border border-dashed border-rose-200 ${
              activeTab === 'admin'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/15 border-rose-500'
                : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            <span className="hidden md:inline">এডমিন প্যানেল</span>
          </button>
        )}

        {/* Separator / Spacer */}
        <div className="h-4 w-px bg-slate-200 flex-shrink-0 mx-1 hidden md:block" />

        {/* Clear/Reset progress button directly in header flow */}
        <button
          onClick={handleClearAllProgress}
          className="flex items-center justify-center gap-1.5 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold text-rose-500 hover:bg-rose-50 border border-dashed border-rose-100"
          title="প্রগ্রেস রিসেট করুন"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden md:inline">রিসেট করুন</span>
        </button>

        {/* App Meta Info */}
        <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-400 font-mono ml-auto pl-4 flex-shrink-0">
          <span>v2.5.0</span>
          <span>•</span>
          <span>{activeWords.length} Words ({activeCourseId.toUpperCase()})</span>
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8" id="main-content-display">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <StatsDashboard
              words={activeWords}
              progress={progress}
              goal={goal}
              setGoal={setGoal}
              allCourses={allCourses}
              enrolledCourseIds={enrolledCourseIds}
              activeCourseId={activeCourseId}
              setActiveCourseId={setActiveCourseId}
              setEnrolledCourseIds={setEnrolledCourseIds}
              onImportCourse={handleImportCourse}
              onSelectGroup={(gNum) => {
                setSelectedGroupFromDash(gNum);
                setActiveTab('flashcard');
              }}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'leaderboard' && (
            <GlobalLeaderboard />
          )}

          {activeTab === 'flashcard' && (
            <FlashcardViewer
              words={activeWords}
              progress={progress}
              folders={folders}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              initialGroup={selectedGroupFromDash}
              settings={settings}
            />
          )}

          {activeTab === 'synonym' && (
            <SynonymCheck
              words={activeWords}
              synonymProgress={synonymProgress}
              onUpdateSynonymProgress={handleUpdateSynonymProgress}
              activeGroup={selectedGroupFromDash}
              progress={progress}
              folders={folders}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              settings={settings}
            />
          )}

          {activeTab === 'quiz' && (
            <PracticeQuiz
              words={activeWords}
              progress={progress}
              onRateWord={handleRateWord}
              activeGroup={selectedGroupFromDash}
              settings={settings}
              onQuizComplete={(score, totalQuestions) => {
                setQuizScore(prev => prev + score);
                setQuizTaken(prev => prev + 1);
              }}
            />
          )}

          {activeTab === 'match' && (
            <WordMatchGame
              words={activeWords}
              activeGroup={selectedGroupFromDash}
              settings={settings}
            />
          )}

          {activeTab === 'dictionary' && (
            <SearchDictionary
              words={activeWords}
              progress={progress}
              folders={folders}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
            />
          )}

          {activeTab === 'lists' && (
            <CustomLists
              folders={folders}
              words={activeWords}
              progress={progress}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onRemoveFromFolder={handleRemoveFromFolder}
              onLaunchFolderStudy={handleLaunchFolderStudy}
            />
          )}

          {activeTab === 'planner' && (
            <DailyPlanner
              words={activeWords}
              progress={progress}
              goal={goal}
              setGoal={setGoal}
              onLaunchPractice={() => {
                setSelectedGroupFromDash(null);
                setActiveTab('flashcard');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <AppSettingsView
              settings={settings}
              onUpdateSettings={setSettings}
              onClearAllProgress={handleClearAllProgress}
              userEmail={user?.email}
              syncStatus={syncStatus}
              onForceSync={forceSyncToCloud}
            />
          )}

          {activeTab === 'admin' && user && user.email === 'mohammad.001ekram@gmail.com' && (
            <AdminPanel words={activeWords} />
          )}
        </div>
      </main>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={() => {}}
      />
    </div>
  );
}
