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
  Settings
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
import { collection, onSnapshot } from 'firebase/firestore';
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
  const [selectedGroupFromDash, setSelectedGroupFromDash] = useState<number | null>(null);

  // --- PERSISTED STATES ---
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_ENROLLED_COURSES_KEY);
    return saved ? JSON.parse(saved) : ['gre'];
  });

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVE_COURSE_KEY);
    return saved ? saved : 'gre';
  });

  const [customCourses, setCustomCourses] = useState<Course[]>([]);

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

  // --- FIREBASE SYNC & AUTH STATES ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const isSyncingFromCloud = useRef(false);

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

  // Live listener for Custom Courses
  useEffect(() => {
    const coursesRef = collection(db, 'courses');
    const unsubscribe = onSnapshot(coursesRef, (snapshot) => {
      const loaded: Course[] = [];
      snapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() } as Course);
      });
      setCustomCourses(loaded);
      
      // Auto-enroll all custom courses so they are immediately visible to all users (new or old)
      if (loaded.length > 0) {
        setEnrolledCourseIds(prev => {
          const newIds = [...prev];
          let updated = false;
          loaded.forEach(c => {
            if (!newIds.includes(c.id)) {
              newIds.push(c.id);
              updated = true;
            }
          });
          return updated ? newIds : prev;
        });
      }
    }, (error) => {
      console.error("Error reading courses collection inside App:", error);
    });
    return () => unsubscribe();
  }, []);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncStatus('syncing');
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
            setSyncStatus('synced');
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
              email: currentUser.email,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            setSyncStatus('synced');
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
        setSyncStatus('idle');
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync to Cloud whenever state changes and user is logged in (debounced)
  useEffect(() => {
    if (!user) {
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
  }, [progress, folders, goal, synonymProgress, settings, enrolledCourseIds, activeCourseId, user]);

  const forceSyncToCloud = async () => {
    if (!user) return;
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
  const defaultGreCourse: Course = {
    id: 'gre',
    title: 'GRE Vocabulary',
    description: '৩৮ গ্রুপের ১১লোটি ব্যারনস ওয়ার্ড প্রিপারেশন কোর্স (Default)',
    totalGroups: 37,
    words: vocabulary,
    isDefault: true,
    createdAt: new Date('2026-01-01').toISOString(),
    createdBy: 'system'
  };

  const allCourses: Course[] = [defaultGreCourse, ...customCourses];

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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800" id="main-layout-stage">
      {/* 1. Sidebar Panel Nav */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200/60 flex flex-col justify-between flex-shrink-0" id="sidebar-navigator">
        <div className="p-6 space-y-8">
          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight font-sans">ভোকাবুলারি মেমোরি</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">৩৭ গ্রুপ লার্নিং ড্যাশবোর্ড</p>
            </div>
          </div>

          {/* Navigation Checklist items */}
          <nav className="space-y-1.5 font-sans">
            <button
              onClick={() => {
                setSelectedGroupFromDash(null);
                setActiveTab('dashboard');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>অগ্রগতি ড্যাশবোর্ড</span>
            </button>

            <button
              onClick={() => setActiveTab('flashcard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'flashcard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>ফ্ল্যাশ কার্ড রিভিউ</span>
            </button>

            <button
              onClick={() => setActiveTab('synonym')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'synonym'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Sparkle className="w-4 h-4 text-amber-500" />
              <span>সিনোনিম চেক</span>
            </button>

            <button
              onClick={() => setActiveTab('quiz')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'quiz'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>পরীক্ষা ও কুইজ</span>
            </button>

            <button
              onClick={() => setActiveTab('match')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'match'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>শব্দমিল খেলা (Match)</span>
            </button>

            <button
              onClick={() => setActiveTab('dictionary')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'dictionary'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>সার্চ ডিকশনারি</span>
            </button>

            <button
              onClick={() => setActiveTab('lists')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'lists'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>বুকমার্ক ফোল্ডার</span>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'planner'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <CalendarCheck2 className="w-4 h-4" />
              <span>দৈনিক প্ল্যানার</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>সেটিংস ও ডিফল্ট</span>
            </button>

            {user && user.email === 'mohammad.001ekram@gmail.com' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition border border-dashed border-rose-200 ${
                  activeTab === 'admin'
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/15 border-rose-500 animate-pulse'
                    : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                }`}
              >
                <FolderLock className="w-4 h-4" />
                <span>সিস্টেম এডমিন প্যানেল</span>
              </button>
            )}

            {/* Aligned Cloud Sync / Login Button under Daily Planner */}
            <div className="pt-3 border-t border-slate-100 mt-2 space-y-2.5">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-100 flex-shrink-0">
                        {user.email ? user.email[0].toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold text-slate-800 truncate" title={user.email || ''}>
                          {user.displayName || user.email?.split('@')[0]}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block truncate">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogOut}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="লগআউট করুন"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Sync Status Badge */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-xl text-[9px]">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        syncStatus === 'synced' ? 'bg-emerald-500 animate-pulse' :
                        syncStatus === 'syncing' ? 'bg-indigo-500 animate-spin' :
                        syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'
                      }`} />
                      <span className="text-slate-500 font-semibold">
                        {syncStatus === 'synced' && 'ব্যাকআপ সচল'}
                        {syncStatus === 'syncing' && 'সিঙ্ক হচ্ছে...'}
                        {syncStatus === 'error' && 'সিঙ্ক ত্রুটি!'}
                        {syncStatus === 'idle' && 'অপেক্ষমাণ'}
                      </span>
                    </div>
                    <button
                      onClick={forceSyncToCloud}
                      className="text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer hover:underline"
                      disabled={syncStatus === 'syncing'}
                    >
                      {syncStatus === 'syncing' ? '...' : 'সিঙ্ক'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer border border-dashed border-indigo-200"
                >
                  <Cloud className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span>ক্লাউড ব্যাকআপ (লগইন)</span>
                </button>
              )}
            </div>
          </nav>
        </div>

        {/* Clear/Reset progress panel footer */}
        <div className="p-6 border-t border-slate-100 font-sans space-y-2">
          <button
            onClick={handleClearAllProgress}
            className="w-full py-2 px-3 hover:bg-rose-50 text-rose-500 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border border-transparent hover:border-rose-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>প্রগ্রেস রিসেট করুন</span>
          </button>
          <div className="text-center text-[10px] text-slate-400 font-mono">
            v2.5.0 • {activeWords.length} Vocab Words ({activeCourseId.toUpperCase()})
          </div>
        </div>
      </aside>

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
              onSelectGroup={(gNum) => {
                setSelectedGroupFromDash(gNum);
                setActiveTab('flashcard');
              }}
            />
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
