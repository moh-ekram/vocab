import React, { useState, useEffect, useRef } from 'react';
import { vocabulary } from './data/vocabulary';
import { UserProgress, WordStatus, CustomFolder, StudyGoal, ActiveTab, AppSettings } from './types';
import StatsDashboard from './components/StatsDashboard';
import FlashcardViewer from './components/FlashcardViewer';
import PracticeCenter from './components/PracticeCenter';
import StudyToolsCenter from './components/StudyToolsCenter';
import AppSettingsView from './components/AppSettingsView';
import AdminPanel from './components/AdminPanel';
import GlobalLeaderboard from './components/GlobalLeaderboard';
import MyCoursesView from './components/MyCoursesView';

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
  CreditCard,
  Sun,
  Moon
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
import firebaseConfigJson from '../firebase-applet-config.json';
import { 
  saveProgressToIndexedDB, 
  getProgressFromIndexedDB, 
  addUpdateToSyncQueue, 
  getQueuedSyncItems, 
  clearSyncQueue,
  saveMetaValue,
  getMetaValue
} from './lib/offlineDb';

const LOCAL_STORAGE_PROGRESS_KEY = 'vocab_memorizer_progress_v2';
const LOCAL_STORAGE_FOLDERS_KEY = 'vocab_memorizer_folders_v2';
const LOCAL_STORAGE_GOALS_KEY = 'vocab_memorizer_goals_v2';
const LOCAL_STORAGE_SYNONYM_PROGRESS_KEY = 'vocab_memorizer_synonym_progress_v2';
const LOCAL_STORAGE_BLANK_PROGRESS_KEY = 'vocab_memorizer_blank_progress_v2';
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
      { id: '1', name: 'Important Words (High Priority)', color: '#ef4444' },
      { id: '2', name: 'Hard Synonyms', color: '#f59e0b' }
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

  const [blankProgress, setBlankProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_BLANK_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [oooProgress, setOooProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem('vocab_memorizer_ooo_progress');
    return saved ? JSON.parse(saved) : {};
  });

  const [analogyProgress, setAnalogyProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem('vocab_memorizer_analogy_progress');
    return saved ? JSON.parse(saved) : {};
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('vocab_memorizer_dark_mode');
    return saved ? JSON.parse(saved) : false;
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
      flashcardAnimation: (parsed.flashcardAnimation && parsed.flashcardAnimation !== 'flip-h') ? parsed.flashcardAnimation : 'shuffle',

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

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Load from IndexedDB on initial mount as a secure backup
  useEffect(() => {
    const loadIndexedDBCache = async () => {
      try {
        const cachedProgress = await getProgressFromIndexedDB();
        if (cachedProgress && Object.keys(cachedProgress).length > 0) {
          setProgress(prev => {
            const merged = { ...prev };
            Object.keys(cachedProgress).forEach(key => {
              const prevItem = prev[key];
              const cachedItem = cachedProgress[key];
              if (!prevItem) {
                merged[key] = cachedItem;
              } else {
                const prevTime = new Date(prevItem.updatedAt || 0).getTime();
                const cachedTime = new Date(cachedItem.updatedAt || 0).getTime();
                if (cachedTime > prevTime) {
                  merged[key] = cachedItem;
                }
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not read IndexedDB progress cache:', err);
      }
    };
    loadIndexedDBCache();
  }, []);

  // Service Worker Registration and Background Sync Listener
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered successfully:', registration);

          // Listen for messages from SW (e.g. SYNC_COMPLETE)
          const handleSWMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'SYNC_COMPLETE') {
              console.log('[App] Received SYNC_COMPLETE message from SW:', event.data);
              if (event.data.progress) {
                setProgress(prev => {
                  const merged = { ...prev };
                  Object.keys(event.data.progress).forEach(key => {
                    const prevItem = prev[key];
                    const incomingItem = event.data.progress[key];
                    if (!prevItem) {
                      merged[key] = incomingItem;
                    } else {
                      const prevTime = new Date(prevItem.updatedAt || 0).getTime();
                      const incomingTime = new Date(incomingItem.updatedAt || 0).getTime();
                      if (incomingTime > prevTime) {
                        merged[key] = incomingItem;
                      }
                    }
                  });
                  return merged;
                });
                setSyncStatus('synced');
                setPendingSyncCount(0);
              }
            }
          };

          navigator.serviceWorker.addEventListener('message', handleSWMessage);

          return () => {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
          };
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      };

      registerSW();
    }
  }, []);

  // Utility to register a background sync or fall back to manual postMessage triggering
  const triggerBackgroundSync = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await (registration as any).sync.register('sync-progress');
          console.log('[App] Registered sync-progress background sync');
        } else {
          // Fallback if background sync is not supported: post a message to trigger immediate sync in SW
          if (registration.active) {
            registration.active.postMessage({ type: 'TRIGGER_SYNC' });
          }
        }
      } catch (err) {
        console.warn('Background sync registration failed, falling back:', err);
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.active) {
            reg.active.postMessage({ type: 'TRIGGER_SYNC' });
          }
        } catch (e) {}
      }
    }
  };

  // Sync offline updates once connection is restored
  const syncOfflineQueueToFirestore = async (currentProgress: Record<string, UserProgress> = progress) => {
    if (!user || !hasLoadedFromCloud || !navigator.onLine) return;
    try {
      const queuedItems = await getQueuedSyncItems();
      if (queuedItems.length === 0) return;

      setSyncStatus('syncing');
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        progress: currentProgress,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await clearSyncQueue();
      setPendingSyncCount(0);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Error syncing offline queue to firestore:', err);
      setSyncStatus('error');
    }
  };

  // Sync network status & trigger automatic queue synchronization
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueueToFirestore();
      triggerBackgroundSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    const checkQueue = async () => {
      try {
        const items = await getQueuedSyncItems();
        setPendingSyncCount(items.length);
        if (items.length > 0 && navigator.onLine) {
          syncOfflineQueueToFirestore();
          triggerBackgroundSync();
        }
      } catch (e) {}
    };
    checkQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, hasLoadedFromCloud]);

  // Local Storage & IndexedDB Cache Save
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progress));
    saveProgressToIndexedDB(progress);
    
    // Also update pending count on progress change
    const updateCount = async () => {
      try {
        const items = await getQueuedSyncItems();
        setPendingSyncCount(items.length);
      } catch (e) {}
    };
    updateCount();
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
    localStorage.setItem(LOCAL_STORAGE_BLANK_PROGRESS_KEY, JSON.stringify(blankProgress));
  }, [blankProgress]);

  useEffect(() => {
    localStorage.setItem('vocab_memorizer_ooo_progress', JSON.stringify(oooProgress));
  }, [oooProgress]);

  useEffect(() => {
    localStorage.setItem('vocab_memorizer_analogy_progress', JSON.stringify(analogyProgress));
  }, [analogyProgress]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('vocab_memorizer_dark_mode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
    // If the user is already enrolled in this course, bypass restriction checks entirely
    if (enrolledCourseIds.includes(c.id)) return true;

    // Admin user email bypasses all restrictions
    const isAdmin = user?.email === 'mohammad.001ekram@gmail.com';
    if (isAdmin) return true;

    // Course creator bypasses restrictions
    if (c.createdBy === user?.email) return true;

    // If restricted, check if user's email or mobile is listed
    if (c.isRestricted) {
      if (!user?.email) return false;
      const userIdentifier = user.email.trim().toLowerCase();
      const isAllowed = c.allowedUsers?.some(allowed => {
        const allowedClean = allowed.trim().toLowerCase();
        return allowedClean === userIdentifier;
      });

      if (!isAllowed) return false;

      // Check expiry date
      if (c.allowedUsersExpiry) {
        // Find matching key case-insensitively
        const matchingKey = Object.keys(c.allowedUsersExpiry).find(k => k.trim().toLowerCase() === userIdentifier);
        if (matchingKey) {
          const expiryStr = c.allowedUsersExpiry[matchingKey];
          if (expiryStr) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const expiryDate = new Date(expiryStr);
            expiryDate.setHours(23, 59, 59, 999); // Allow access until end of day
            
            if (today > expiryDate) {
              return false; // Access expired!
            }
          }
        }
      }
      return true;
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
        // Save user UID and Firebase Config to meta store for Service Worker use
        try {
          await saveMetaValue('uid', currentUser.uid);
          const env = (import.meta as any).env || {};
          const config = {
            apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "AIzaSyCYIkpASqZD6R2bOOi9F3hvQMl_iTLsjBI",
            authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "myvocab-13ebc.firebaseapp.com",
            projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "myvocab-13ebc",
            storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "myvocab-13ebc.firebasestorage.app",
            messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "531149838847",
            appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "1:531149838847:web:a4577c60628b9c4c6b2fca",
            firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId || "(default)"
          };
          await saveMetaValue('firebaseConfig', config);
        } catch (e) {
          console.warn('Error saving meta values to IDB:', e);
        }

        setSyncStatus('syncing');
        setHasLoadedFromCloud(false);
        isSyncingFromCloud.current = true;
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();

            // Merge cloud progress with local progress safely (timestamp-based conflict resolution)
            if (data.progress) {
              setProgress(prev => {
                const merged = { ...data.progress };
                Object.keys(prev).forEach(key => {
                  const localItem = prev[key];
                  const cloudItem = data.progress[key];
                  if (!cloudItem) {
                    merged[key] = localItem;
                  } else {
                    const localTime = new Date(localItem.updatedAt || 0).getTime();
                    const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                    if (localTime > cloudTime) {
                      merged[key] = localItem;
                    }
                  }
                });
                return merged;
              });
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
              setSynonymProgress(prev => {
                const merged = { ...data.synonymProgress };
                Object.keys(prev).forEach(key => {
                  const localItem = prev[key];
                  const cloudItem = data.synonymProgress[key];
                  if (!cloudItem) {
                    merged[key] = localItem;
                  } else {
                    const localTime = new Date(localItem.updatedAt || 0).getTime();
                    const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                    if (localTime > cloudTime) {
                      merged[key] = localItem;
                    }
                  }
                });
                return merged;
              });
            }
            if (data.blankProgress) {
              setBlankProgress(prev => {
                const merged = { ...data.blankProgress };
                Object.keys(prev).forEach(key => {
                  const localItem = prev[key];
                  const cloudItem = data.blankProgress[key];
                  if (!cloudItem) {
                    merged[key] = localItem;
                  } else {
                    const localTime = new Date(localItem.updatedAt || 0).getTime();
                    const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                    if (localTime > cloudTime) {
                      merged[key] = localItem;
                    }
                  }
                });
                return merged;
              });
            }
            if (data.oooProgress) {
              setOooProgress(prev => {
                const merged = { ...data.oooProgress };
                Object.keys(prev).forEach(key => {
                  const localItem = prev[key];
                  const cloudItem = data.oooProgress[key];
                  if (!cloudItem) {
                    merged[key] = localItem;
                  } else {
                    const localTime = new Date(localItem.updatedAt || 0).getTime();
                    const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                    if (localTime > cloudTime) {
                      merged[key] = localItem;
                    }
                  }
                });
                return merged;
              });
            }
            if (data.analogyProgress) {
              setAnalogyProgress(prev => {
                const merged = { ...data.analogyProgress };
                Object.keys(prev).forEach(key => {
                  const localItem = prev[key];
                  const cloudItem = data.analogyProgress[key];
                  if (!cloudItem) {
                    merged[key] = localItem;
                  } else {
                    const localTime = new Date(localItem.updatedAt || 0).getTime();
                    const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                    if (localTime > cloudTime) {
                      merged[key] = localItem;
                    }
                  }
                });
                return merged;
              });
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
              blankProgress,
              oooProgress,
              analogyProgress,
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
        // Logged out
        try {
          await saveMetaValue('uid', null);
          await saveMetaValue('firebaseConfig', null);
        } catch (e) {}
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
          blankProgress,
          oooProgress,
          analogyProgress,
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
  }, [progress, folders, goal, synonymProgress, blankProgress, oooProgress, analogyProgress, settings, enrolledCourseIds, activeCourseId, quizScore, quizTaken, user, hasLoadedFromCloud]);

  const forceSyncToCloud = async () => {
    if (!user || !hasLoadedFromCloud) return;
    setSyncStatus('syncing');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        progress,
        folders,
        goal,
        synonymProgress,
        blankProgress,
        oooProgress,
        analogyProgress,
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
    if (confirm('Are you sure you want to log out?')) {
      try {
        await signOut(auth);
        
        // Reset to local Storage values
        const savedProgress = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
        setProgress(savedProgress ? JSON.parse(savedProgress) : {});

        const savedFolders = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
        setFolders(savedFolders ? JSON.parse(savedFolders) : [
          { id: '1', name: 'Important Words (High Priority)', color: '#ef4444' },
          { id: '2', name: 'Hard Synonyms', color: '#f59e0b' }
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

        const savedBlankProgress = localStorage.getItem(LOCAL_STORAGE_BLANK_PROGRESS_KEY);
        setBlankProgress(savedBlankProgress ? JSON.parse(savedBlankProgress) : {});

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

  // Keep users active in at least one enrolled course by default so it does not remain empty
  useEffect(() => {
    if (enrolledCourseIds && enrolledCourseIds.length > 0) {
      if (!activeCourseId || !enrolledCourseIds.includes(activeCourseId)) {
        setActiveCourseId(enrolledCourseIds[0]);
      }
    } else {
      setEnrolledCourseIds(['gre']);
      setActiveCourseId('gre');
    }
  }, [enrolledCourseIds, activeCourseId]);

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
    description: dbGreCourse?.description || '38 Groups containing 1100 Barron\'s Word Preparation Course (Default)',
    totalGroups: dbGreCourse?.totalGroups || 37,
    words: (dbGreCourse?.words && dbGreCourse.words.length > 0) ? dbGreCourse.words : vocabulary,
    isDefault: dbGreCourse !== undefined ? dbGreCourse.isDefault : true,
    isRestricted: dbGreCourse?.isRestricted || false,
    allowedUsers: dbGreCourse?.allowedUsers || [],
    price: (dbGreCourse?.price && dbGreCourse.price > 0) ? dbGreCourse.price : 30,
    bkashNumber: (dbGreCourse?.bkashNumber && dbGreCourse.bkashNumber !== '01700000000' && dbGreCourse.bkashNumber.trim() !== '') ? dbGreCourse.bkashNumber : '01581624202',
    googleSearchQuery: dbGreCourse?.googleSearchQuery || '',
    createdAt: dbGreCourse?.createdAt || new Date('2026-01-01').toISOString(),
    createdBy: dbGreCourse?.createdBy || 'system'
  };

  const rawAllCourses: Course[] = [defaultGreCourse, ...customCourses.filter(c => c.id !== 'gre'), ...importedCourses];
  const allCourses: Course[] = [];
  const seenCourseIds = new Set<string>();
  for (const c of rawAllCourses) {
    if (!seenCourseIds.has(c.id)) {
      seenCourseIds.add(c.id);
      allCourses.push({
        ...c,
        price: (c.price && c.price > 0) ? c.price : 30,
        bkashNumber: (c.bkashNumber && c.bkashNumber !== '01700000000' && c.bkashNumber.trim() !== '') ? c.bkashNumber : '01581624202'
      });
    }
  }
  const allAvailableCourses: Course[] = allCourses;

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

  const activeCourse = (() => {
    const course = allCourses.find(c => c.id === activeCourseId);
    if (!course) return defaultGreCourse;

    // Check access permissions - enrolled courses or admin/creator can always access
    const userEmailLower = user?.email?.trim().toLowerCase();
    const isAdmin = userEmailLower === 'mohammad.001ekram@gmail.com';
    const isCreator = course.createdBy === user?.email;
    const isEnrolled = enrolledCourseIds.includes(course.id);

    if (isEnrolled || isAdmin || isCreator) {
      return course;
    }

    if (course.isRestricted) {
      if (!userEmailLower) return defaultGreCourse;
      const isEmailInAllowed = course.allowedUsers?.some(allowed => allowed.trim().toLowerCase() === userEmailLower);
      if (!isEmailInAllowed) return defaultGreCourse;

      if (course.allowedUsersExpiry) {
        const matchingKey = Object.keys(course.allowedUsersExpiry).find(k => k.trim().toLowerCase() === userEmailLower);
        if (matchingKey) {
          const expiryStr = course.allowedUsersExpiry[matchingKey];
          if (expiryStr) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiryDate = new Date(expiryStr);
            expiryDate.setHours(23, 59, 59, 999);
            if (today > expiryDate) return defaultGreCourse; // Expired!
          }
        }
      }
    }
    return course;
  })() || defaultGreCourse;
  const activeWords = activeCourse.words || [];

  // --- DATABASE STATE HANDLERS ---

  // Rate/Tag word ('pari', 'pari na', 'confusion')
  const handleRateWord = (wordId: string, status: WordStatus) => {
    const oldStatus = progress[wordId]?.status || 'unrated';
    const timestamp = new Date().toISOString();

    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          status,
          updatedAt: timestamp
        }
      };
    });

    // Handle offline queueing
    if (!navigator.onLine) {
      addUpdateToSyncQueue({
        wordId,
        status,
        progressData: {
          status,
          updatedAt: timestamp,
          notes: progress[wordId]?.notes || '',
          bookmarks: progress[wordId]?.bookmarks || []
        },
        timestamp
      }).then(() => {
        getQueuedSyncItems().then(items => {
          setPendingSyncCount(items.length);
          triggerBackgroundSync();
        });
      });
    }

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
    const timestamp = new Date().toISOString();
    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          notes,
          updatedAt: timestamp
        }
      };
    });

    if (!navigator.onLine) {
      addUpdateToSyncQueue({
        wordId,
        status: progress[wordId]?.status || 'unrated',
        progressData: {
          status: progress[wordId]?.status || 'unrated',
          updatedAt: timestamp,
          notes,
          bookmarks: progress[wordId]?.bookmarks || []
        },
        timestamp
      }).then(() => {
        getQueuedSyncItems().then(items => {
          setPendingSyncCount(items.length);
          triggerBackgroundSync();
        });
      });
    }
  };

  // Toggle Bookmark inside custom lists
  const handleToggleBookmark = (wordId: string, folderId: string) => {
    const timestamp = new Date().toISOString();
    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      const currentBookmarks = prevWord.bookmarks || [];
      const updatedBookmarks = currentBookmarks.includes(folderId)
        ? currentBookmarks.filter(id => id !== folderId)
        : [...currentBookmarks, folderId];

      const updatedProgressData = {
        ...prevWord,
        bookmarks: updatedBookmarks,
        updatedAt: timestamp
      };

      if (!navigator.onLine) {
        addUpdateToSyncQueue({
          wordId,
          status: prevWord.status,
          progressData: updatedProgressData,
          timestamp
        }).then(() => {
          getQueuedSyncItems().then(items => {
            setPendingSyncCount(items.length);
            triggerBackgroundSync();
          });
        });
      }

      return {
        ...prev,
        [wordId]: updatedProgressData
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

  // Update Blank Filling progress
  const handleUpdateBlankProgress = (questionId: string, correct: boolean) => {
    setBlankProgress(prev => {
      return {
        ...prev,
        [questionId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Update Odd One Out progress
  const handleUpdateOooProgress = (questionId: string, correct: boolean) => {
    setOooProgress(prev => {
      return {
        ...prev,
        [questionId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Update Word Analogy progress
  const handleUpdateAnalogyProgress = (questionId: string, correct: boolean) => {
    setAnalogyProgress(prev => {
      return {
        ...prev,
        [questionId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Clear data function for reset/refresh study
  const handleClearAllProgress = () => {
    if (confirm('Are you sure you want to delete all your study progress and streaks? This action cannot be undone.')) {
      setProgress({});
      setGoal({
        dailyTarget: 15,
        streak: 1,
        lastStudyDate: new Date().toISOString().split('T')[0],
        history: {}
      });
      setSynonymProgress({});
      setBlankProgress({});
      setOooProgress({});
      setAnalogyProgress({});
      alert('All progress has been successfully deleted.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 w-full max-w-full overflow-x-hidden" id="main-layout-stage">
      {/* Top Header / Main Banner (Unified for Mobile & Desktop) */}
      <header className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 md:px-8 md:py-5 flex items-center justify-between shadow-md flex-shrink-0" id="main-header-banner">
        <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
          <div className="p-2 md:p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/20 flex-shrink-0">
            <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-black tracking-tight font-sans text-white uppercase leading-none">
              Memorizer
            </h1>
            <p className="text-[10px] md:text-xs font-semibold text-emerald-400 mt-1 truncate max-w-[120px] sm:max-w-xs md:max-w-md" title={activeCourse?.title}>
              {activeCourse?.title || 'Default Course'}
            </p>
          </div>
        </div>

        {/* User Stats & Auth (Unified Header UI) */}
        <div className="flex items-center gap-1.5 md:gap-3.5 flex-shrink-0">
          {/* Connection Status Badge (Visible for both logged in and anonymous users) */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 md:px-2.5 md:py-1.5 rounded-xl text-[9px] md:text-[10px] font-bold">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
            <span className={isOnline ? 'text-emerald-300' : 'text-amber-300'}>
              {isOnline ? 'Online' : 'Offline'}
              {!isOnline && pendingSyncCount > 0 && ` (${pendingSyncCount} pending)`}
            </span>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="p-1.5 md:p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/15 text-indigo-200 hover:text-white transition cursor-pointer flex items-center justify-center"
            title={darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
            id="dark-mode-toggle"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-300" /> : <Moon className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />}
          </button>

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
                  {syncStatus === 'synced' && 'Synced'}
                  {syncStatus === 'syncing' && 'Syncing...'}
                  {syncStatus === 'error' && 'Sync Error'}
                  {syncStatus === 'idle' && 'Idle'}
                </span>
              </div>

              {/* Force Sync button */}
              <button
                onClick={forceSyncToCloud}
                className="text-[10px] text-indigo-200 hover:text-white font-extrabold cursor-pointer hover:underline bg-white/10 px-2 py-0.5 rounded-md transition"
                disabled={syncStatus === 'syncing' || !isOnline}
                title="Force Sync"
              >
                {syncStatus === 'syncing' ? '...' : 'Sync'}
              </button>

              <button
                onClick={handleLogOut}
                className="p-1 text-indigo-200 hover:text-rose-400 rounded-lg transition cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-[10px] md:text-xs font-extrabold px-3 py-2 md:px-4 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shadow-md shadow-indigo-500/20"
            >
              Cloud Backup (Login)
            </button>
          )}
        </div>
      </header>

      {/* Unified Horizontal Menu Bar (Sits directly under the main banner) */}
      <div className="bg-white border-b border-slate-200/60 overflow-x-auto flex items-center justify-center gap-1.5 md:gap-2.5 p-2 md:px-8 md:py-3 scrollbar-none flex-shrink-0 relative w-full" id="horizontal-menu-navigation">
        <button
          onClick={() => {
            setSelectedGroupFromDash(null);
            setActiveTab('dashboard');
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden md:inline">Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('my_courses')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'my_courses'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-500" />
          <span className="hidden md:inline">My Courses</span>
        </button>

        <button
          onClick={() => setActiveTab('flashcard')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'flashcard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4 animate-icon-flip" />
          <span className="hidden md:inline">Flashcard</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="hidden md:inline">Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab('practice')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            ['practice', 'synonym', 'quiz', 'match'].includes(activeTab)
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span className="hidden md:inline">Practice & Games</span>
        </button>

        <button
          onClick={() => setActiveTab('study_tools')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            ['study_tools', 'dictionary', 'lists', 'planner'].includes(activeTab)
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden md:inline">Study Tools</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden md:inline">Settings</span>
        </button>

        {user && user.email === 'mohammad.001ekram@gmail.com' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold border border-dashed border-rose-200 ${
              activeTab === 'admin'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/15 border-rose-500'
                : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            <span className="hidden md:inline">Admin Panel</span>
          </button>
        )}

        {/* App Meta Info */}
        <div className="hidden xl:flex items-center gap-1 text-[10px] text-slate-400 font-mono absolute right-6 pointer-events-none">
          <span>v2.5.0</span>
          <span>•</span>
          <span>{activeWords.length} Words ({activeCourseId.toUpperCase()})</span>
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 w-full max-w-full" id="main-content-display">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <StatsDashboard
              user={user}
              words={activeWords}
              progress={progress}
              goal={goal}
              setGoal={setGoal}
              allCourses={allAvailableCourses}
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

          {activeTab === 'my_courses' && (
            <MyCoursesView
              user={user}
              allCourses={allAvailableCourses}
              enrolledCourseIds={enrolledCourseIds}
              activeCourseId={activeCourseId}
              setActiveCourseId={setActiveCourseId}
              setEnrolledCourseIds={setEnrolledCourseIds}
              progress={progress}
              onImportCourse={handleImportCourse}
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
              placeLabels={activeCourse?.placeLabels}
              googleSearchQuery={activeCourse?.googleSearchQuery}
            />
          )}

          {['practice', 'synonym', 'quiz', 'match'].includes(activeTab) && (
            <PracticeCenter
              words={activeWords}
              progress={progress}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              folders={folders}
              synonymProgress={synonymProgress}
              onUpdateSynonymProgress={handleUpdateSynonymProgress}
              blankProgress={blankProgress}
              onUpdateBlankProgress={handleUpdateBlankProgress}
              oooProgress={oooProgress}
              onUpdateOooProgress={handleUpdateOooProgress}
              analogyProgress={analogyProgress}
              onUpdateAnalogyProgress={handleUpdateAnalogyProgress}
              activeGroup={selectedGroupFromDash}
              settings={settings}
              onQuizComplete={(score, totalQuestions) => {
                setQuizScore(prev => prev + score);
                setQuizTaken(prev => prev + 1);
              }}
              activeCourseId={activeCourseId}
              enabledGames={activeCourse?.enabledGames}
              placeLabels={activeCourse?.placeLabels}
              googleSearchQuery={activeCourse?.googleSearchQuery}
            />
          )}

          {['study_tools', 'dictionary', 'lists', 'planner'].includes(activeTab) && (
            <StudyToolsCenter
              words={activeWords}
              progress={progress}
              folders={folders}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onRemoveFromFolder={handleRemoveFromFolder}
              onLaunchFolderStudy={handleLaunchFolderStudy}
              goal={goal}
              setGoal={setGoal}
              onLaunchPractice={() => {
                setSelectedGroupFromDash(null);
                setActiveTab('flashcard');
              }}
              initialSubTab={activeTab === 'study_tools' ? 'hub' : activeTab}
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
            <AdminPanel 
              words={activeWords} 
              onCoursesUpdated={(updatedCourses) => {
                setCustomCourses(updatedCourses);
                localStorage.setItem('vocab_memorizer_cached_custom_courses', JSON.stringify(updatedCourses));
              }}
            />
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
