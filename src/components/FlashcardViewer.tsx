import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, WordStatus, UserProgress, CustomFolder, AppSettings } from '../types';
import { getGoogleSearchUrl } from '../lib/searchUtils';
import { 
  getWordSizeClass, 
  getWordPosClass, 
  getWordVerticalPosClass, 
  getMeaningSizeClass, 
  getBorderStyleClass, 
  getShadowStyleClass 
} from '../lib/flashcardPresets';
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
  Brain,
  SkipForward,
  MoveHorizontal,
  MoveVertical,
  ArrowLeftRight,
  Eye,
  ZoomIn,
  Shuffle
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
  onUpdateSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
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
  onUpdateSettings,
  variableToggles,
  placeLabels,
  googleSearchQuery
}: FlashcardViewerProps) {
  // Helper to resolve place labels handling both flat and nested placeLabels structure safely
  const getPlaceLabel = (
    key: 'place1' | 'place2' | 'place3' | 'place4' | 'place5' | 'place6' | 'mnemonic' | string,
    fallback: string
  ) => {
    if (!placeLabels) return fallback;
    const directVal = (placeLabels as any)[key];
    if (typeof directVal === 'string' && directVal.trim() !== '') return directVal.trim();
    const nestedVal = (placeLabels as any).placeLabels?.[key];
    if (typeof nestedVal === 'string' && nestedVal.trim() !== '') return nestedVal.trim();
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

  const handleSubmitReport = async (selectedIssueType?: string) => {
    if (!reportingWord) return;
    const issueToSubmit = selectedIssueType || reportType || 'wrong_meaning';
    setIsSubmittingReport(true);
    setReportMessage(null);

    const issueLabels: Record<string, string> = {
      wrong_meaning: 'ভুল অর্থ (Incorrect Meaning)',
      wrong_spelling: 'ভুল বানান / বিচ্ছেদ',
      wrong_category: 'ভুল সমাস / ক্যাটাগরি',
      other_issue: 'অন্যান্য সমস্যা'
    };

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
        issueType: issueToSubmit,
        description: issueLabels[issueToSubmit] || issueToSubmit,
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
        setReportMessage(null);
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
    (currentActiveWord as any).place3 ||
    (sentencesData[currentActiveWord.id] && sentencesData[currentActiveWord.id][0]) || 
    `Take the time to sit back and listen to ${currentActiveWord.word || (currentActiveWord as any).place1 || 'this word'} and establish a routine for yourself.`;

  // =========================================================================
  // RENDER STAGE 1: INTERMEDIATE FILTER & SETUP SCREEN (isSessionActive = false)
  // =========================================================================
  if (!isSessionActive) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-2 sm:p-4 font-sans" id="flashcard-setup-view">
        {/* Large Prominent Hero Card for Start Flashcards */}
        <div 
          onClick={() => filteredWords.length > 0 && setIsSessionActive(true)}
          className={`p-6 sm:p-8 rounded-3xl border transition-all shadow-md relative overflow-hidden group ${
            filteredWords.length > 0
              ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] border-indigo-500/80'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 relative z-10">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-indigo-100 text-xs font-bold border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span className="font-bengali">ফ্ল্যাশকার্ড সেশন</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Start Flashcards
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/90 font-medium font-bengali">
                {filteredWords.length > 0
                  ? `${filteredWords.length} টি শব্দ বাছাই করা হয়েছে`
                  : 'কোনো শব্দ পাওয়া যায়নি (নিচের ফিল্টার পরিবর্তন করুন)'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (filteredWords.length > 0) setIsSessionActive(true);
                }}
                disabled={filteredWords.length === 0}
                className="px-6 py-3.5 bg-white text-indigo-700 font-extrabold rounded-2xl text-sm sm:text-base shadow-lg transition group-hover:bg-indigo-50 flex items-center gap-2 cursor-pointer border border-white/40 active:scale-95"
              >
                <Play className="w-5 h-5 fill-current" />
                <span className="font-bengali">শুরু করুন ({filteredWords.length})</span>
              </button>
            </div>
          </div>

          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Minimal Filter Configuration */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          {/* Group Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 font-bengali">
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
                    className={`py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-3xs'
                        : 'bg-white hover:bg-slate-100 text-slate-650 border border-slate-200/60'
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
              <span className="font-bold text-slate-800 font-bengali">Status Filter</span>
              <button
                onClick={() => {
                  setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated']);
                  setUserHasManuallyChangedStatuses(true);
                }}
                className="text-indigo-600 font-bold hover:underline text-[11px]"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'unrated', label: 'Unrated', color: 'bg-slate-400' },
                { key: 'dont_know', label: 'Not Learned', color: 'bg-rose-500' },
                { key: 'confusion', label: 'Confused', color: 'bg-purple-500' },
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
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer border ${
                      isSelected ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${st.color}`} />
                      <span className="text-[11px]">{st.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Folder & Order Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Bookmark Collection</label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Words (No Folder Limit)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Study Order</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStudyOrder('serial')}
                  className={`py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'serial' ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <span>Serial</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('alphabetical')}
                  className={`py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'alphabetical' ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-[10px] font-black">A-Z</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('random')}
                  className={`py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'random' ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card Flip Animation Selection */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 font-bengali">
                Card Flip Animation (কার্ড এনিমেশন)
              </span>
              <span className="text-[10px] text-slate-400 font-medium capitalize">
                Selected: {settings?.flashcardAnimation || 'shuffle'}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { key: 'flip-h' as const, icon: MoveHorizontal, label: 'Flip (H)' },
                { key: 'flip-v' as const, icon: MoveVertical, label: 'Flip (V)' },
                { key: 'slide' as const, icon: ArrowLeftRight, label: 'Slide' },
                { key: 'fade' as const, icon: Eye, label: 'Fade' },
                { key: 'zoom' as const, icon: ZoomIn, label: 'Zoom' },
                { key: 'shuffle' as const, icon: Shuffle, label: 'Shuffle' }
              ].map(item => {
                const currentAnim = settings?.flashcardAnimation || 'shuffle';
                const isSelected = currentAnim === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (onUpdateSettings) {
                        onUpdateSettings(prev => ({ ...prev, flashcardAnimation: item.key }));
                      }
                    }}
                    className={`flex items-center justify-center gap-1 px-1.5 py-2 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700 font-medium'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                    <span className="text-[11px] font-sans tracking-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
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
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col h-[100dvh] w-full overflow-hidden animate-fadeIn select-none font-sans" id="flashcard-fullscreen-view">
      {/* 1. Fullscreen Top Header Bar - Minimalist Navigation & Progress */}
      <header className="h-14 px-4 sm:px-6 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-slate-950/80 backdrop-blur-xl z-30">
        <button
          onClick={() => setIsSessionActive(false)}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer active:scale-95"
          title="Exit Session"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Minimalist Progress Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <span className="text-xs font-semibold tracking-wider text-slate-300 font-mono">
            {currentIndex + 1} <span className="text-slate-500">/</span> {filteredWords.length}
          </span>
        </div>

        <button
          onClick={() => setIsSessionActive(false)}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer active:scale-95"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Main Flashcard Canvas Area */}
      <main 
        className="flex-1 px-4 py-3 sm:py-6 flex flex-col items-center justify-between max-w-xl mx-auto w-full relative h-full min-h-0 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Desktop Left/Right Navigation Arrows */}
        <div className="hidden md:flex items-center justify-between absolute -inset-x-16 top-1/2 -translate-y-1/2 pointer-events-none z-20">
          <button
            onClick={handlePrev}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10 transition shadow-xl pointer-events-auto cursor-pointer hover:scale-105 active:scale-95"
            title="Previous Card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10 transition shadow-xl pointer-events-auto cursor-pointer hover:scale-105 active:scale-95"
            title="Next Card"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Flashcard Stack Stage */}
        {(() => {
          const animStyle = settings?.flashcardAnimation || 'shuffle';
          const statusTheme = (() => {
            switch (activeStatus) {
              case 'dont_know':
                return {
                  wordColor: 'text-rose-600 dark:text-rose-400',
                  borderClass: 'border-rose-200 dark:border-rose-900/50',
                  badgeBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40',
                  dotBg: 'bg-rose-500',
                  label: 'Not Learned'
                };
              case 'confusion':
                return {
                  wordColor: 'text-purple-600 dark:text-purple-400',
                  borderClass: 'border-purple-200 dark:border-purple-900/50',
                  badgeBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
                  dotBg: 'bg-purple-500',
                  label: 'Confused'
                };
              case 'know':
                return {
                  wordColor: 'text-emerald-600 dark:text-emerald-400',
                  borderClass: 'border-emerald-200 dark:border-emerald-900/50',
                  badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
                  dotBg: 'bg-emerald-500',
                  label: 'Learned'
                };
              default:
                return {
                  wordColor: 'text-slate-900 dark:text-white',
                  borderClass: 'border-slate-200/80 dark:border-slate-800/80',
                  badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
                  dotBg: 'bg-slate-400',
                  label: 'Unrated'
                };
            }
          })();

          let containerTransform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
          let frontTransform = 'rotateY(0deg)';
          let backTransform = 'rotateY(180deg)';

          if (animStyle === 'fade') {
            containerTransform = 'none';
          } else if (animStyle === 'flip-v') {
            containerTransform = isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)';
            frontTransform = 'rotateX(0deg)';
            backTransform = 'rotateX(180deg)';
          }

          const containerStyle: React.CSSProperties = {
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            transform: containerTransform,
            transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)'
          };

          const customStyle = settings?.flashcardCustomStyle;

          const cardCustomBgStyle: React.CSSProperties = customStyle?.cardBgColor ? {
            backgroundColor: customStyle.cardBgColor,
            borderRadius: customStyle.borderRadius || '24px',
            color: customStyle.cardTextColor || undefined
          } : {};

          const borderStyleClass = customStyle ? getBorderStyleClass(customStyle.borderStyle) : statusTheme.borderClass;
          const shadowStyleClass = customStyle ? getShadowStyleClass(customStyle.shadowStyle) : 'shadow-[0_20px_50px_rgba(0,0,0,0.3)]';

          const faceBaseClass = `absolute inset-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-5 sm:p-7 border flex flex-col justify-between z-10 transition-all duration-300 ${borderStyleClass} ${shadowStyleClass}`;

          const frontFaceStyle: React.CSSProperties = {
            ...cardCustomBgStyle,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: frontTransform,
            opacity: animStyle === 'fade' ? (isFlipped ? 0 : 1) : 1,
            pointerEvents: isFlipped ? 'none' : 'auto',
            transition: animStyle === 'fade' ? 'opacity 0.3s ease-in-out' : undefined
          };

          const backFaceStyle: React.CSSProperties = {
            ...cardCustomBgStyle,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: backTransform,
            opacity: animStyle === 'fade' ? (isFlipped ? 1 : 0) : 1,
            pointerEvents: !isFlipped ? 'none' : 'auto',
            transition: animStyle === 'fade' ? 'opacity 0.3s ease-in-out' : undefined
          };

          const wordFontSizeClass = customStyle ? getWordSizeClass(customStyle.wordFontSize) : getWordFontSize(currentActiveWord.word || (currentActiveWord as any).place1);
          const wordPosClass = customStyle ? getWordPosClass(customStyle.wordPosition) : 'text-center items-center';
          const wordVPosClass = customStyle ? getWordVerticalPosClass(customStyle.wordVerticalPos) : 'justify-center my-auto';
          const customWordStyle: React.CSSProperties = customStyle?.wordColor ? { color: customStyle.wordColor } : {};

          const meaningSizeClass = customStyle ? getMeaningSizeClass(customStyle.meaningFontSize) : 'text-2xl sm:text-4xl';
          const customMeaningStyle: React.CSSProperties = customStyle?.meaningColor ? { color: customStyle.meaningColor } : {};

          return (
            <div className="w-full h-full flex-1 relative perspective my-auto min-h-0 flex flex-col justify-center">
              {/* Stacked Cards Background Depth Layers */}
              <div className="absolute inset-x-6 bottom-[-10px] top-[10px] bg-slate-900/60 border border-white/5 rounded-3xl pointer-events-none z-0 transform scale-[0.96] opacity-60" />
              <div className="absolute inset-x-3 bottom-[-5px] top-[5px] bg-slate-800/80 border border-white/10 rounded-3xl pointer-events-none z-0 transform scale-[0.98] opacity-80" />

              {/* Active Tap-to-Flip 3D Flashcard Container */}
              <div
                onClick={() => {
                  if (touchHandled.current) {
                    touchHandled.current = false;
                    return;
                  }
                  setIsFlipped(prev => !prev);
                }}
                className="relative w-full h-full flex-1 cursor-pointer select-none"
                style={containerStyle}
              >
                {/* FRONT FACE */}
                <div className={faceBaseClass} style={frontFaceStyle}>
                  <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                    {/* Top Row: Group Badge & Status on Left, Minimal Report on Right */}
                    <div className="flex items-center justify-between w-full flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-full border border-indigo-200/50 dark:border-indigo-800/50">
                          Group {currentActiveWord.group || 1}
                        </span>
                        {statusTheme.label && (
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1.5 ${statusTheme.badgeBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusTheme.dotBg}`} />
                            <span>{statusTheme.label}</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReportModal(currentActiveWord);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-full transition cursor-pointer active:scale-95"
                        title="Report Issue"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Middle: Main Word Centered + Pronounce & Search Minimal Icons */}
                    <div className={`flex-1 min-h-0 space-y-4 py-4 w-full overflow-y-auto flex flex-col ${wordVPosClass} ${wordPosClass}`}>
                      <span className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold font-sans">
                        {getPlaceLabel('place1', 'Vocabulary Word')}
                      </span>

                      <h1 
                        className={`font-extrabold tracking-tight font-sans px-2 transition-colors duration-300 ${wordFontSizeClass} ${!customStyle?.wordColor ? statusTheme.wordColor : ''}`}
                        style={customWordStyle}
                      >
                        {currentActiveWord.word || (currentActiveWord as any).place1}
                      </h1>

                      {/* Minimalist Outline Icons for Audio & Google Search */}
                      <div className="flex items-center justify-center gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
                        {variableToggles?.audio !== false && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord();
                            }}
                            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 border border-slate-200 dark:border-slate-700"
                            title="Listen Pronunciation"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const googleUrl = getGoogleSearchUrl(currentActiveWord.word || (currentActiveWord as any).place1 || '', googleSearchQuery);
                            window.open(googleUrl, '_blank');
                          }}
                          className="w-10 h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 border border-slate-200 dark:border-slate-700"
                          title="Search on Google"
                        >
                          <GoogleIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Extra Word / Derivatives if toggled */}
                      {(variableToggles?.extraWord !== false && (currentActiveWord.extraWord || (currentActiveWord as any).place4)) && (
                        <div className="pt-2 flex flex-col items-center justify-center space-y-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {getPlaceLabel('place4', 'Derivatives')}:
                          </span>
                          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full max-w-xs truncate">
                            {currentActiveWord.extraWord || (currentActiveWord as any).place4}
                            {(variableToggles?.extraMeaning !== false && (currentActiveWord.extraMeaning || (currentActiveWord as any).place6)) ? ` (${currentActiveWord.extraMeaning || (currentActiveWord as any).place6})` : ''}
                          </p>
                        </div>
                      )}

                      <span className="text-[11px] text-slate-400 dark:text-slate-500 pt-3 flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" /> Tap card to reveal answer
                      </span>
                    </div>

                    {/* Bottom Action Controls: Modern Minimalist Navigation & Rating Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between w-full gap-1.5 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrev();
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
                        title="Previous Card"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Minimalist Action Buttons */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rateAndMaybeConfirm('dont_know', true);
                        }}
                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer text-center justify-center items-center flex gap-1 border ${
                          activeStatus === 'dont_know'
                            ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                        }`}
                        title="Not Learned"
                      >
                        <span>Not Learned</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rateAndMaybeConfirm('confusion', true);
                        }}
                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer text-center justify-center items-center flex gap-1 border ${
                          activeStatus === 'confusion'
                            ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                            : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-900/60 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                        }`}
                        title="Confused"
                      >
                        <span>Confused</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rateAndMaybeConfirm('know', true);
                        }}
                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer text-center justify-center items-center flex gap-1 border ${
                          activeStatus === 'know'
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        }`}
                        title="Learned"
                      >
                        <span>Learned</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNext();
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
                        title="Next Card"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* BACK FACE */}
                <div className={faceBaseClass} style={backFaceStyle}>
                  <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                    {/* Top Header Row */}
                    <div className="flex items-center justify-between w-full flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-full border border-indigo-200/50 dark:border-indigo-800/50">
                          Group {currentActiveWord.group || 1}
                        </span>
                        {statusTheme.label && (
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1.5 ${statusTheme.badgeBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusTheme.dotBg}`} />
                            <span>{statusTheme.label}</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReportModal(currentActiveWord);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-full transition cursor-pointer active:scale-95"
                        title="Report Issue"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Top Section: Main Word Reference + Meaning */}
                    <div className="my-auto text-center space-y-2 pt-2 w-full">
                      <span className={`text-xs font-bold uppercase tracking-widest block ${statusTheme.wordColor}`}>
                        {currentActiveWord.word || (currentActiveWord as any).place1}
                      </span>
                      {variableToggles?.meaning !== false && (
                        <div className="space-y-1">
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block font-bengali">
                            {getPlaceLabel('place2', 'Meaning')}
                          </span>
                          <h2 
                            className={`font-extrabold font-bengali leading-tight tracking-tight text-center ${meaningSizeClass} ${!customStyle?.meaningColor ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                            style={customMeaningStyle}
                          >
                            {currentActiveWord.meaning || (currentActiveWord as any).place2}
                          </h2>
                        </div>
                      )}
                    </div>

                    {/* Horizontal Divider Line */}
                    <div className="w-full border-b border-slate-100 dark:border-slate-800 my-2 sm:my-3" />

                    {/* Middle Content Area */}
                    <div className="my-auto flex-1 min-h-0 space-y-3 text-center w-full max-w-lg mx-auto overflow-y-auto px-1">
                      {/* Grid for Synonyms & Extra Meaning */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
                        <div className="space-y-0.5">
                          <span className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-semibold font-bengali block">
                            {getPlaceLabel('place5', 'Synonyms')}
                          </span>
                          <p className="font-bold text-slate-800 dark:text-slate-200 font-bengali text-sm sm:text-base break-words leading-snug">
                            {currentActiveWord.synonyms || (currentActiveWord as any).place5 || [(currentActiveWord as any).synonym1, (currentActiveWord as any).synonym2].filter(Boolean).join(', ') || '-'}
                          </p>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-semibold font-bengali block">
                            {getPlaceLabel('place6', 'Extra Meaning')}
                          </span>
                          <p className="font-bold text-slate-800 dark:text-slate-200 font-bengali text-sm sm:text-base break-words leading-snug">
                            {(currentActiveWord as any).place6 || currentActiveWord.extraMeaning || '-'}
                          </p>
                        </div>
                      </div>

                      {/* Example Sentence */}
                      {variableToggles?.example !== false && (activeExampleSentence || (currentActiveWord as any).place3) && (
                        <div className="pt-1 space-y-0.5">
                          <span className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-semibold block font-bengali">
                            {getPlaceLabel('place3', 'Word in use')}
                          </span>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-bengali leading-relaxed text-center break-words px-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            {renderSentence(activeExampleSentence || (currentActiveWord as any).place3 || '')}
                          </p>
                        </div>
                      )}

                      {/* Mnemonic / Note */}
                      {(noteText || currentActiveWord.mnemonic) && (
                        <div className="pt-1 space-y-0.5">
                          <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-semibold block font-bengali">
                            {getPlaceLabel('mnemonic', 'Mnemonic / Note')}
                          </span>
                          <p className="text-xs sm:text-sm font-medium italic text-slate-600 dark:text-slate-300 font-bengali leading-relaxed text-center break-words px-1">
                            {noteText || currentActiveWord.mnemonic}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Controls */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between w-full gap-1.5 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrev();
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
                        title="Previous Card"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rateAndMaybeConfirm('dont_know', true);
                        }}
                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer text-center justify-center items-center flex gap-1 border ${
                          activeStatus === 'dont_know'
                            ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                        }`}
                        title="Not Learned"
                      >
                        <span>Not Learned</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rateAndMaybeConfirm('confusion', true);
                        }}
                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer text-center justify-center items-center flex gap-1 border ${
                          activeStatus === 'confusion'
                            ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                            : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-900/60 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                        }`}
                        title="Confused"
                      >
                        <span>Confused</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rateAndMaybeConfirm('know', true);
                        }}
                        className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer text-center justify-center items-center flex gap-1 border ${
                          activeStatus === 'know'
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        }`}
                        title="Learned"
                      >
                        <span>Learned</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNext();
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-90 flex-shrink-0"
                        title="Next Card"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
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
              <div className="flex items-center justify-between">
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
                <button
                  type="button"
                  disabled={isSubmittingReport}
                  onClick={() => setReportingWord(null)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {reportMessage ? (
                <div className={`p-4 rounded-xl text-center text-sm font-sans font-medium ${
                  reportMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
                }`}>
                  {reportMessage.text}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-bold text-slate-600 font-bengali">
                    সমস্যা নির্বাচন করুন (১-ক্লিকে রিপোর্ট জমা হবে):
                  </p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'wrong_meaning', label: 'ভুল অর্থ (Incorrect Meaning)', desc: 'অর্থ বা অনুবাদ সঠিক নয়' },
                      { id: 'wrong_spelling', label: 'ভুল বানান / বিচ্ছেদ', desc: 'বানান বা সন্ধিবিচ্ছেদে ভুল আছে' },
                      { id: 'wrong_category', label: 'ভুল সমাস / ক্যাটাগরি', desc: 'ব্যাকরণগত শ্রেণিবিভাগে ভুল' },
                      { id: 'other_issue', label: 'অন্যান্য সমস্যা', desc: 'অন্য কোনো তথ্যে অসঙ্গতি' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isSubmittingReport}
                        onClick={() => handleSubmitReport(opt.id)}
                        className="w-full p-3 text-left bg-slate-50 hover:bg-rose-50 hover:border-rose-200 text-slate-800 hover:text-rose-700 rounded-2xl border border-slate-200/80 transition flex items-center justify-between group cursor-pointer active:scale-[0.98]"
                      >
                        <div>
                          <p className="text-xs font-bold font-bengali group-hover:text-rose-600">{opt.label}</p>
                          <p className="text-[11px] text-slate-400 font-bengali">{opt.desc}</p>
                        </div>
                        {isSubmittingReport ? (
                          <Loader2 className="w-4 h-4 text-rose-500 animate-spin flex-shrink-0" />
                        ) : (
                          <span className="text-xs font-bold text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity font-bengali">
                            জমা দিন →
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isSubmittingReport}
                      onClick={() => setReportingWord(null)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition font-bengali cursor-pointer"
                    >
                      বাতিল করুন
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
