import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, WordStatus, UserProgress, CustomFolder, AppSettings } from '../types';
import { getGoogleSearchUrl } from '../lib/searchUtils';
import sentencesDataRaw from '../data/sentences.json';
const sentencesData = sentencesDataRaw as Record<string, string[]>;
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

import { 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  AlertTriangle, 
  Sparkles,
  RotateCcw,
  Loader2,
  ArrowUpDown,
  Filter,
  Play,
  X,
  BookOpen,
  Check,
  Lightbulb,
  ArrowLeft,
  Search,
  HelpCircle,
  Brain
} from 'lucide-react';

interface FlashcardViewerProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  initialGroup?: number | string | null;
  settings?: AppSettings;
  variableToggles?: Record<string, boolean>;
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
  googleSearchQuery?: string;
}

// Google 'G' icon component
const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

// Helper function to scale word font size based on length so it never breaks onto multiple lines
const getWordFontSize = (word: string) => {
  const len = word ? word.trim().length : 0;
  if (len <= 5) return 'text-5xl sm:text-6xl md:text-7xl';
  if (len <= 8) return 'text-4xl sm:text-5xl md:text-6xl';
  if (len <= 11) return 'text-3xl sm:text-4xl md:text-5xl';
  if (len <= 15) return 'text-2xl sm:text-3xl md:text-4xl';
  return 'text-xl sm:text-2xl md:text-3xl';
};

export default function FlashcardViewer({
  words,
  progress,
  folders,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  initialGroup = null,
  settings,
  variableToggles,
  placeLabels,
  googleSearchQuery
}: FlashcardViewerProps) {
  // Helper to resolve place labels handling both flat and nested placeLabels structure safely
  const getPlaceLabel = (
    key: 'place1' | 'place2' | 'place3' | 'place4' | 'place5' | 'place6',
    fallback: string
  ) => {
    if (!placeLabels) return fallback;
    if ((placeLabels as any)[key] && typeof (placeLabels as any)[key] === 'string') return (placeLabels as any)[key];
    if ((placeLabels as any).placeLabels?.[key] && typeof (placeLabels as any).placeLabels[key] === 'string') return (placeLabels as any).placeLabels[key];
    return fallback;
  };
  // Session active state - true when inside the full-screen card focus mode, false when on intermediate filter setup screen
  const [isSessionActive, setIsSessionActive] = useState<boolean>(() => Boolean(initialGroup));

  // Filter States - Dynamic unique groups from words list
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

  const [selectedGroups, setSelectedGroups] = useState<(number | string)[]>(() => {
    if (initialGroup) {
      return [initialGroup];
    }
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
  });

  useEffect(() => {
    if (initialGroup) {
      setSelectedGroups([initialGroup]);
      setIsSessionActive(true);
    }
  }, [initialGroup]);

  const [userHasManuallyChangedStatuses, setUserHasManuallyChangedStatuses] = useState(false);

  // Swipe gesture refs for mobile navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchHandled = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchHandled.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      touchHandled.current = true;
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    if (words && words.length > 0) {
      let hasUnrated = false;
      let hasStrugglingOrConfusion = false;

      words.forEach(w => {
        const status = progress[w.id]?.status || 'unrated';
        if (status === 'unrated') {
          hasUnrated = true;
        } else if (status === 'dont_know' || status === 'confusion') {
          hasStrugglingOrConfusion = true;
        }
      });

      if (hasUnrated) {
        return ['unrated'];
      } else if (hasStrugglingOrConfusion) {
        return ['dont_know', 'confusion'];
      } else {
        return ['know'];
      }
    }
    return settings?.defaultFlashcardTags || ['know', 'confusion', 'dont_know', 'unrated'];
  });

  // Automatically adapt selectedStatuses to progress changes if user has not manually modified it
  useEffect(() => {
    if (userHasManuallyChangedStatuses) return;
    if (!words || words.length === 0) return;

    let hasUnrated = false;
    let hasStrugglingOrConfusion = false;

    words.forEach(w => {
      const status = progress[w.id]?.status || 'unrated';
      if (status === 'unrated') {
        hasUnrated = true;
      } else if (status === 'dont_know' || status === 'confusion') {
        hasStrugglingOrConfusion = true;
      }
    });

    let targetStatuses: string[];
    if (hasUnrated) {
      targetStatuses = ['unrated'];
    } else if (hasStrugglingOrConfusion) {
      targetStatuses = ['dont_know', 'confusion'];
    } else {
      targetStatuses = ['know'];
    }

    const currentSorted = [...selectedStatuses].sort().join(',');
    const targetSorted = [...targetStatuses].sort().join(',');
    if (currentSorted !== targetSorted) {
      setSelectedStatuses(targetStatuses);
    }
  }, [words, progress, userHasManuallyChangedStatuses, selectedStatuses]);

  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  
  // Study Order Mode: 'serial', 'alphabetical' (A-Z), 'random'
  const [studyOrder, setStudyOrder] = useState<'serial' | 'alphabetical' | 'random'>(() => {
    return settings?.defaultFlashcardOrder || 'random';
  });

  // Card orientation
  const [isFlipped, setIsFlipped] = useState(false);

  // Vocabulary Index State
  const [currentIndex, setCurrentIndex] = useState(0);

  // Active note state
  const [noteText, setNoteText] = useState('');

  // Word reporting states
  const [reportingWord, setReportingWord] = useState<VocabularyWord | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportType, setReportType] = useState('wrong_meaning');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleOpenReportModal = (word: VocabularyWord) => {
    setReportingWord(word);
    setReportDescription('');
    setReportType('wrong_meaning');
    setIsSubmittingReport(false);
    setReportMessage(null);
  };

  const handleSubmitReport = async () => {
    if (!reportingWord) return;
    setIsSubmittingReport(true);
    setReportMessage(null);
    try {
      const email = auth.currentUser?.email || 'anonymous@vocab.com';
      const uid = auth.currentUser?.uid || 'anonymous';
      const reportId = `rep_${Date.now()}_${uid}`;

      let courseId = 'gre';
      if (reportingWord.id.includes('_g')) {
        courseId = reportingWord.id.split('_g')[0];
      }

      await setDoc(doc(db, 'reports', reportId), {
        wordId: reportingWord.id,
        word: reportingWord.word,
        meaning: reportingWord.meaning,
        group: reportingWord.group,
        issueType: reportType,
        description: reportDescription.trim(),
        reportedBy: email,
        reportedAt: new Date().toISOString(),
        courseId: courseId,
        status: 'pending'
      });

      setReportMessage({
        type: 'success',
        text: 'আপনার রিপোর্ট সফলভাবে জমা করা হয়েছে। ধন্যবাদ!'
      });
      setTimeout(() => {
        setReportingWord(null);
      }, 1500);
    } catch (err) {
      console.error('Error submitting report:', err);
      setReportMessage({
        type: 'error',
        text: 'রিপোর্ট পাঠানো ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Filtered List generator
  const [baseFilteredWords, setBaseFilteredWords] = useState<VocabularyWord[]>([]);
  const [filteredWords, setFilteredWords] = useState<VocabularyWord[]>([]);

  const rateAndMaybeConfirm = (newStatus: WordStatus, autoAdvance = true) => {
    if (!currentActiveWord.id) return;
    onRateWord(currentActiveWord.id, newStatus);
    if (autoAdvance) {
      handleNext();
    }
  };

  // Phase 1: Filter words by selected groups, tag status, and custom bookmark folder
  useEffect(() => {
    let result = [...words];

    if (selectedGroups.length < uniqueGroups.length) {
      result = result.filter(w => selectedGroups.includes(w.group));
    }

    if (selectedStatuses.length < 4) {
      result = result.filter(w => {
        const status = progress[w.id]?.status || 'unrated';
        return selectedStatuses.includes(status);
      });
    }

    if (selectedFolder !== 'all') {
      result = result.filter(w => {
        const bookmarks = progress[w.id]?.bookmarks || [];
        return bookmarks.includes(selectedFolder);
      });
    }

    setBaseFilteredWords(result);
  }, [selectedGroups, selectedStatuses, selectedFolder, words, progress, uniqueGroups.length]);

  const wordIdsString = baseFilteredWords.map(w => w.id).join(',');

  // Phase 2: Order/shuffle selected words
  useEffect(() => {
    let result = [...baseFilteredWords];

    if (studyOrder === 'random') {
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
      }
    } else if (studyOrder === 'alphabetical') {
      result.sort((a, b) => a.word.localeCompare(b.word));
    }

    setFilteredWords(result);

    const firstNonPariIndex = result.findIndex(w => {
      const status = progress[w.id]?.status || 'unrated';
      return status !== 'know';
    });

    setCurrentIndex(firstNonPariIndex !== -1 ? firstNonPariIndex : 0);
    setIsFlipped(false);
  }, [wordIdsString, studyOrder]);

  const currentActiveWord: VocabularyWord = filteredWords[currentIndex] || {
    id: '',
    group: 1,
    word: '',
    meaning: '',
    synonyms: '',
    extraWord: '',
    extraMeaning: ''
  };

  // Helper to parse double asterisks and render bold words
  const renderSentence = (text: string) => {
    if (!text) return null;
    const parts = text.split('**');
    return (
      <>
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            return (
              <strong key={index} className="font-extrabold text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded-md border border-amber-500/30">
                {part}
              </strong>
            );
          }
          return part;
        })}
      </>
    );
  };

  // Sync note text when index shifts
  useEffect(() => {
    if (filteredWords.length > 0) {
      setNoteText(progress[currentActiveWord.id]?.notes ?? currentActiveWord.mnemonic ?? '');
      setIsFlipped(false);
    }
  }, [currentIndex, filteredWords.length, currentActiveWord.id, progress, currentActiveWord.mnemonic]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(filteredWords.length - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (filteredWords.length === 0 || !isSessionActive) return;

      const userShortcuts = settings?.shortcuts || {
        'Space': 'flip',
        'ArrowRight': 'know',
        'ArrowLeft': 'dont_know',
        'ArrowUp': 'confusion',
        'ArrowDown': 'skip',
        'Enter': 'audio'
      };

      const keyIdentifier = e.code === 'Space' ? 'Space' : e.code;
      const action = userShortcuts[keyIdentifier];

      if (!action || action === 'none') return;

      switch (action) {
        case 'flip':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case 'dont_know':
          e.preventDefault();
          rateAndMaybeConfirm('dont_know', true);
          break;
        case 'know':
          e.preventDefault();
          rateAndMaybeConfirm('know', true);
          break;
        case 'confusion':
          e.preventDefault();
          rateAndMaybeConfirm('confusion', true);
          break;
        case 'skip':
          e.preventDefault();
          handleNext();
          break;
        case 'prev':
          e.preventDefault();
          handlePrev();
          break;
        case 'audio':
          e.preventDefault();
          speakWord();
          break;
        case 'google':
          e.preventDefault();
          const googleUrl = getGoogleSearchUrl(currentActiveWord.word, googleSearchQuery);
          window.open(googleUrl, '_blank');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredWords, currentIndex, currentActiveWord.id, isSessionActive, settings?.shortcuts]);

  // Text to Speech
  const speakWord = () => {
    if (!currentActiveWord.word) return;
    const utterance = new SpeechSynthesisUtterance(currentActiveWord.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (isSessionActive && settings?.autoPlayAudio && currentActiveWord.word && variableToggles?.audio !== false) {
      const timer = setTimeout(() => {
        speakWord();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentActiveWord.id, isSessionActive, settings?.autoPlayAudio, variableToggles]);

  const activeStatus = progress[currentActiveWord.id]?.status || 'unrated';

  // Get active example sentence
  const activeExampleSentence = currentActiveWord.example || 
    (sentencesData[currentActiveWord.id] && sentencesData[currentActiveWord.id][0]) || 
    `Take the time to sit back and listen to ${currentActiveWord.word} and establish a routine for yourself.`;

  // =========================================================================
  // RENDER STAGE 1: INTERMEDIATE FILTER & SETUP SCREEN (isSessionActive = false)
  // =========================================================================
  if (!isSessionActive) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-2 sm:p-4 font-sans" id="flashcard-setup-view">
        {/* Compact Header Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/80">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Flashcard Deck Setup
              </h1>
              <p className="text-xs font-medium text-slate-500">
                {filteredWords.length} words selected
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSessionActive(true)}
            disabled={filteredWords.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Flashcards ({filteredWords.length})</span>
          </button>
        </div>

        {/* Minimal Filter Configuration */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          {/* Group Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Vocabulary Groups ({selectedGroups.length}/{uniqueGroups.length})
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedGroups(uniqueGroups)}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setSelectedGroups([])}
                  className="text-rose-600 font-bold hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200/60 rounded-xl">
              {uniqueGroups.map((gVal) => {
                const isSelected = selectedGroups.includes(gVal);
                return (
                  <button
                    key={gVal}
                    type="button"
                    onClick={() => {
                      setSelectedGroups(prev => 
                        prev.includes(gVal) ? prev.filter(x => x !== gVal) : [...prev, gVal]
                      );
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                    }`}
                  >
                    {gVal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Tags Selection */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Status Tags</span>
              <button
                onClick={() => {
                  setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated']);
                  setUserHasManuallyChangedStatuses(true);
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'unrated', label: 'Unrated', color: 'bg-slate-400' },
                { key: 'dont_know', label: 'Not Learned', color: 'bg-rose-500' },
                { key: 'confusion', label: 'Confused', color: 'bg-amber-500' },
                { key: 'know', label: 'Learned', color: 'bg-emerald-500' }
              ].map(st => {
                const isSelected = selectedStatuses.includes(st.key);
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      setSelectedStatuses(prev => 
                        prev.includes(st.key)
                          ? prev.filter(x => x !== st.key)
                          : [...prev, st.key]
                      );
                      setUserHasManuallyChangedStatuses(true);
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer border ${
                      isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-3xs' : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                      <span>{st.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Folder & Order Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bookmark Collection</label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Words (No Folder Limit)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Study Order</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStudyOrder('serial')}
                  className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'serial' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <span>Serial</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('alphabetical')}
                  className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'alphabetical' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-[10px] font-black">A-Z</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('random')}
                  className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'random' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER STAGE 2: IMMERSIVE FULL-SCREEN FLASHCARD FOCUS MODE (isSessionActive = true)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col h-screen w-screen overflow-hidden animate-fadeIn select-none font-sans" id="flashcard-fullscreen-view">
      {/* 1. Fullscreen Top Header Bar */}
      <header className="h-12 sm:h-14 px-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-slate-900/90 backdrop-blur-md z-30">
        <button
          onClick={() => setIsSessionActive(false)}
          className="p-2 text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer border border-white/10"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="text-center">
          <span className="text-xs sm:text-sm font-extrabold text-white font-mono tracking-wider bg-white/10 border border-white/10 px-3.5 py-1 rounded-full">
            {currentIndex + 1} / {filteredWords.length}
          </span>
        </div>

        <button
          onClick={() => setIsSessionActive(false)}
          className="p-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-full transition cursor-pointer border border-white/10"
          title="Close Session"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </header>

      {/* 2. Main Flashcard Canvas Area - Occupies full available space */}
      <main 
        className="flex-1 p-3 sm:p-5 flex flex-col items-center justify-between max-w-2xl mx-auto w-full relative h-[calc(100vh-3.5rem)] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Desktop Left/Right Navigation Arrows */}
        <div className="hidden md:flex items-center justify-between absolute -inset-x-16 top-1/2 -translate-y-1/2 pointer-events-none z-20">
          <button
            onClick={handlePrev}
            className="p-3 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md text-white border border-white/20 transition shadow-xl pointer-events-auto cursor-pointer hover:scale-110 active:scale-95"
            title="Previous Card"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="p-3 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md text-white border border-white/20 transition shadow-xl pointer-events-auto cursor-pointer hover:scale-110 active:scale-95"
            title="Next Card"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Flashcard Stack Stage with Dynamic Animation */}
        {(() => {
          const animStyle = settings?.flashcardAnimation || 'shuffle';

          let containerAnimClass = 'relative w-full h-full flex-1 cursor-pointer';
          let frontFaceAnimClass = 'absolute inset-0 backface-hidden bg-white text-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-100 flex flex-col justify-between z-10 overflow-hidden';
          let backFaceAnimClass = 'absolute inset-0 backface-hidden bg-white text-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-100 flex flex-col justify-between z-10 overflow-hidden';

          if (animStyle === 'fade') {
            frontFaceAnimClass += ` transition-opacity duration-300 ${isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'}`;
            backFaceAnimClass += ` transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
          } else if (animStyle === 'flip-v') {
            containerAnimClass += ` transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-x-180' : ''}`;
            frontFaceAnimClass += ` ${isFlipped ? 'pointer-events-none' : ''}`;
            backFaceAnimClass += ` rotate-x-180 ${!isFlipped ? 'pointer-events-none' : ''}`;
          } else if (animStyle === 'slide') {
            containerAnimClass += ` transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180 translate-x-3' : ''}`;
            frontFaceAnimClass += ` ${isFlipped ? 'pointer-events-none' : ''}`;
            backFaceAnimClass += ` rotate-y-180 ${!isFlipped ? 'pointer-events-none' : ''}`;
          } else if (animStyle === 'zoom') {
            containerAnimClass += ` transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180 scale-102' : 'scale-100'}`;
            frontFaceAnimClass += ` ${isFlipped ? 'pointer-events-none' : ''}`;
            backFaceAnimClass += ` rotate-y-180 ${!isFlipped ? 'pointer-events-none' : ''}`;
          } else if (animStyle === 'shuffle') {
            containerAnimClass += ` transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180 -rotate-2 -translate-y-2' : ''}`;
            frontFaceAnimClass += ` ${isFlipped ? 'pointer-events-none' : ''}`;
            backFaceAnimClass += ` rotate-y-180 ${!isFlipped ? 'pointer-events-none' : ''}`;
          } else {
            // default: flip-h
            containerAnimClass += ` transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`;
            frontFaceAnimClass += ` ${isFlipped ? 'pointer-events-none' : ''}`;
            backFaceAnimClass += ` rotate-y-180 ${!isFlipped ? 'pointer-events-none' : ''}`;
          }

          return (
            <div className="w-full h-full flex-1 relative perspective my-auto">
              {/* Stacked Cards depth effect */}
              <div className="absolute inset-x-5 sm:inset-x-8 bottom-[-10px] h-full bg-indigo-900/40 border border-indigo-500/20 rounded-3xl rotate-2 pointer-events-none z-0"></div>
              <div className="absolute inset-x-2.5 sm:inset-x-4 bottom-[-5px] h-full bg-indigo-800/60 border border-indigo-400/30 rounded-3xl -rotate-1 pointer-events-none z-0"></div>

              {/* Active Flip Card Container */}
              <div
                onClick={() => {
                  if (touchHandled.current) {
                    touchHandled.current = false;
                    return;
                  }
                  setIsFlipped(prev => !prev);
                }}
                className={containerAnimClass}
              >
                {/* FRONT FACE */}
                <div className={frontFaceAnimClass}>
                  {/* Top Row: Group & Number on Left, Report Button on Right */}
                  <div className="flex items-center justify-between w-full flex-shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
                      Group {currentActiveWord.group} • #{currentIndex + 1}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReportModal(currentActiveWord);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-full text-xs font-bold transition cursor-pointer active:scale-95"
                      title="Report Issue"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Report</span>
                    </button>
                  </div>

                  {/* Middle: Main Word + Pronounce & Google Buttons directly under (icon-only) */}
                  <div className="my-auto text-center space-y-4 py-4 w-full overflow-hidden flex flex-col items-center justify-center">
                    <h1 className={`font-black text-slate-900 tracking-tight font-sans text-center whitespace-nowrap overflow-hidden text-ellipsis px-1 leading-none ${getWordFontSize(currentActiveWord.word)}`}>
                      {currentActiveWord.word}
                    </h1>

                    {/* Pronunciation & Google search buttons directly under main word (icon-only) */}
                    <div className="flex items-center justify-center gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
                      {variableToggles?.audio !== false && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWord();
                          }}
                          className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition flex items-center justify-center shadow-xs cursor-pointer active:scale-95 border border-indigo-100"
                          title="Speak / Pronounce Word"
                        >
                          <Volume2 className="w-5 h-5 text-indigo-600" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const googleUrl = getGoogleSearchUrl(currentActiveWord.word, googleSearchQuery);
                          window.open(googleUrl, '_blank');
                        }}
                        className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition flex items-center justify-center shadow-xs cursor-pointer active:scale-95 border border-slate-200/60"
                        title="Google Search Word"
                      >
                        <GoogleIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom: 3 Status Rating Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-around w-full gap-1 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => rateAndMaybeConfirm('dont_know', true)}
                      className={`px-3 sm:px-4 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition cursor-pointer border ${
                        activeStatus === 'dont_know'
                          ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                      }`}
                      title="Not Learned / Red"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Not Learned</span>
                    </button>

                    <button
                      onClick={() => rateAndMaybeConfirm('confusion', true)}
                      className={`px-3 sm:px-4 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition cursor-pointer border ${
                        activeStatus === 'confusion'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105'
                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                      }`}
                      title="Confused / Yellow"
                    >
                      <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Confused</span>
                    </button>

                    <button
                      onClick={() => rateAndMaybeConfirm('know', true)}
                      className={`px-3 sm:px-4 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition cursor-pointer border ${
                        activeStatus === 'know'
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                      }`}
                      title="Learned / Green"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Learned</span>
                    </button>
                  </div>
                </div>

                {/* BACK FACE */}
                <div className={backFaceAnimClass}>
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between w-full flex-shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
                      Group {currentActiveWord.group} • #{currentIndex + 1}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReportModal(currentActiveWord);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-full text-xs font-bold transition cursor-pointer active:scale-95"
                      title="Report Issue"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Report</span>
                    </button>
                  </div>

                  {/* Middle Content Area: items a, b, c, d, e */}
                  <div className="my-auto space-y-3.5 py-3 text-center w-full max-w-lg mx-auto overflow-y-auto">
                    {/* a. Placemarker 1 (Word title / place1) + Pronounce & Google Search buttons */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block font-sans">
                        {getPlaceLabel('place1', 'Word')}
                      </span>
                      <div className="flex items-center justify-center gap-3">
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-sans">
                          {currentActiveWord.word}
                        </h2>

                        {/* Pronunciation & Google search buttons on Back Face */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {variableToggles?.audio !== false && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speakWord();
                              }}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition flex items-center justify-center cursor-pointer active:scale-95 border border-indigo-100"
                              title="Speak / Pronounce Word"
                            >
                              <Volume2 className="w-4 h-4 text-indigo-600" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const googleUrl = getGoogleSearchUrl(currentActiveWord.word, googleSearchQuery);
                              window.open(googleUrl, '_blank');
                            }}
                            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-full transition flex items-center justify-center cursor-pointer active:scale-95 border border-slate-200/80"
                            title="Google Search Word"
                          >
                            <GoogleIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* b. Placemarker 2 (Meaning, just below placemarker 1) */}
                    <div className="space-y-0.5 pt-0.5">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block font-sans">
                        {getPlaceLabel('place2', 'Meaning')}
                      </span>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-600 font-bengali leading-relaxed">
                        {currentActiveWord.meaning}
                      </p>
                    </div>

                    {/* c. Placemarker 5,6 (Synonyms / Extra meaning, just below placemarker 2) */}
                    {((currentActiveWord.synonyms || currentActiveWord.synonym1 || currentActiveWord.synonym2) || (currentActiveWord.extraWord || currentActiveWord.extraMeaning)) && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700 font-sans">
                        {(currentActiveWord.synonyms || currentActiveWord.synonym1 || currentActiveWord.synonym2) && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-500 block">
                              {getPlaceLabel('place5', 'Synonyms')}
                            </span>
                            <p className="font-semibold text-slate-800 break-words">
                              {currentActiveWord.synonyms || [currentActiveWord.synonym1, currentActiveWord.synonym2].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        )}
                        {(currentActiveWord.extraWord || currentActiveWord.extraMeaning) && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-500 block">
                              {getPlaceLabel('place4', 'Derivatives')}
                            </span>
                            <p className="font-semibold text-indigo-700 font-bengali break-words">
                              {currentActiveWord.extraWord}{currentActiveWord.extraMeaning ? ` - ${currentActiveWord.extraMeaning}` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* d. Placemarker 3 (Word in use / example sentence in smaller Poppins / font-sans) */}
                    {activeExampleSentence && (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-left space-y-1">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block font-sans">
                          {getPlaceLabel('place3', 'Word in use')}
                        </span>
                        <p className="text-xs sm:text-sm font-medium text-slate-800 font-sans leading-relaxed break-words">
                          {renderSentence(activeExampleSentence)}
                        </p>
                      </div>
                    )}

                    {/* e. Mnemonic (if present in Excel / word data, otherwise blank) */}
                    {(noteText || currentActiveWord.mnemonic) ? (
                      <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-left space-y-1">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block font-sans">
                          Mnemonic
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-amber-900 font-bengali leading-relaxed break-words">
                          {noteText || currentActiveWord.mnemonic}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Bottom: 3 Status Rating Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-around w-full gap-1 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => rateAndMaybeConfirm('dont_know', true)}
                      className={`px-3 sm:px-4 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition cursor-pointer border ${
                        activeStatus === 'dont_know'
                          ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                      }`}
                      title="Not Learned / Red"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Not Learned</span>
                    </button>

                    <button
                      onClick={() => rateAndMaybeConfirm('confusion', true)}
                      className={`px-3 sm:px-4 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition cursor-pointer border ${
                        activeStatus === 'confusion'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105'
                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                      }`}
                      title="Confused / Yellow"
                    >
                      <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Confused</span>
                    </button>

                    <button
                      onClick={() => rateAndMaybeConfirm('know', true)}
                      className={`px-3 sm:px-4 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition cursor-pointer border ${
                        activeStatus === 'know'
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                      }`}
                      title="Learned / Green"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Learned</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* Word Issue Report Modal */}
      {reportingWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => !isSubmittingReport && setReportingWord(null)}
          />
          <div className="relative bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10 animate-fadeIn">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center border border-rose-100">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-sans">Report Error</h3>
                  <p className="text-xs text-slate-500 font-sans">
                    Word: <span className="font-extrabold text-slate-800">{reportingWord.word}</span>
                  </p>
                </div>
              </div>

              {reportMessage ? (
                <div className={`p-4 rounded-xl text-center text-sm font-sans font-medium ${
                  reportMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
                }`}>
                  {reportMessage.text}
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 font-sans">Issue Type:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReportType('wrong_meaning')}
                        className={`py-2 px-3 text-left rounded-xl text-xs font-semibold border transition font-sans cursor-pointer ${
                          reportType === 'wrong_meaning' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-650'
                        }`}
                      >
                        Incorrect Meaning
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('wrong_synonym')}
                        className={`py-2 px-3 text-left rounded-xl text-xs font-semibold border transition font-sans cursor-pointer ${
                          reportType === 'wrong_synonym' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-650'
                        }`}
                      >
                        Incorrect Synonyms
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 font-sans">Provide description:</label>
                    <textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      rows={3}
                      placeholder="Write correct info..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isSubmittingReport || !reportDescription.trim()}
                      onClick={handleSubmitReport}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition font-sans cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {isSubmittingReport && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Send Report
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingReport}
                      onClick={() => setReportingWord(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition font-sans cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
