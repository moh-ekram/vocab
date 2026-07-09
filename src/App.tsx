import React, { useState, useEffect } from 'react';
import { vocabulary } from './data/vocabulary';
import { UserProgress, WordStatus, CustomFolder, StudyGoal, ActiveTab } from './types';
import StatsDashboard from './components/StatsDashboard';
import FlashcardViewer from './components/FlashcardViewer';
import PracticeQuiz from './components/PracticeQuiz';
import WordMatchGame from './components/WordMatchGame';
import CustomLists from './components/CustomLists';
import SearchDictionary from './components/SearchDictionary';
import DailyPlanner from './components/DailyPlanner';

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
  Sparkle
} from 'lucide-react';

const LOCAL_STORAGE_PROGRESS_KEY = 'vocab_memorizer_progress_v2';
const LOCAL_STORAGE_FOLDERS_KEY = 'vocab_memorizer_folders_v2';
const LOCAL_STORAGE_GOALS_KEY = 'vocab_memorizer_goals_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedGroupFromDash, setSelectedGroupFromDash] = useState<number | null>(null);

  // --- PERSISTED STATES ---
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

  // Save Progress, Folders, & Goals on edit
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(goal));
  }, [goal]);

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
            v2.4.0 • 1110 Vocab Words
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8" id="main-content-display">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <StatsDashboard
              words={vocabulary}
              progress={progress}
              goal={goal}
              setGoal={setGoal}
              onSelectGroup={(gNum) => {
                setSelectedGroupFromDash(gNum);
                setActiveTab('flashcard');
              }}
            />
          )}

          {activeTab === 'flashcard' && (
            <FlashcardViewer
              words={vocabulary}
              progress={progress}
              folders={folders}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              initialGroup={selectedGroupFromDash}
            />
          )}

          {activeTab === 'quiz' && (
            <PracticeQuiz
              words={vocabulary}
              progress={progress}
              onRateWord={handleRateWord}
              activeGroup={selectedGroupFromDash}
            />
          )}

          {activeTab === 'match' && (
            <WordMatchGame
              words={vocabulary}
              activeGroup={selectedGroupFromDash}
            />
          )}

          {activeTab === 'dictionary' && (
            <SearchDictionary
              words={vocabulary}
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
              words={vocabulary}
              progress={progress}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onRemoveFromFolder={handleRemoveFromFolder}
              onLaunchFolderStudy={handleLaunchFolderStudy}
            />
          )}

          {activeTab === 'planner' && (
            <DailyPlanner
              words={vocabulary}
              progress={progress}
              goal={goal}
              setGoal={setGoal}
              onLaunchPractice={() => {
                setSelectedGroupFromDash(null);
                setActiveTab('flashcard');
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
