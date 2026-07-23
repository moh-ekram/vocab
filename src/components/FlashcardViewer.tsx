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
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Tag, 
  Bookmark, 
  Edit3, 
  Keyboard, 
  Sparkles,
  Eye,
  RotateCcw,
  Quote,
  Loader2,
  Layers,
  ArrowUpDown,
  Filter,
  Play,
  Send,
  X,
  Maximize2,
  Minimize2,
  BookOpen,
  Check,
  Lightbulb,
  ArrowLeft,
  Settings,
  HelpCircle
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

  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
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

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  
  // Study Order Mode: 'serial', 'alphabetical' (A-Z), 'random'
  const [studyOrder, setStudyOrder] = useState<'serial' | 'alphabetical' | 'random'>(() => {
    return settings?.defaultFlashcardOrder || 'random';
  });
  const [shuffleKey, setShuffleKey] = useState(0);

  // Card orientation
  const [isFlipped, setIsFlipped] = useState(false);

  // Random animation state for shuffle option
  const [currentRandomAnim, setCurrentRandomAnim] = useState<'flip-h' | 'flip-v' | 'slide' | 'fade' | 'zoom'>('flip-h');

  // Vocabulary Index State
  const [currentIndex, setCurrentIndex] = useState(0);

  // Active note state & custom sentence state
  const [noteText, setNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [customSentenceInput, setCustomSentenceInput] = useState('');
  const [sentenceSaveToast, setSentenceSaveToast] = useState(false);

  // Hotkey helper tooltip
  const [showHotkeysHelp, setShowHotkeysHelp] = useState(false);

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
        text: 'Your report has been successfully submitted to the admin. Thank you for the correction!'
      });
      setTimeout(() => {
        setReportingWord(null);
      }, 1500);
    } catch (err) {
      console.error('Error submitting report:', err);
      setReportMessage({
        type: 'error',
        text: 'Failed to submit report. Please try again.'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Filtered List generator
  const [baseFilteredWords, setBaseFilteredWords] = useState<VocabularyWord[]>([]);
  const [filteredWords, setFilteredWords] = useState<VocabularyWord[]>([]);

  // Pending rating confirmation state
  const [pendingRating, setPendingRating] = useState<{
    wordId: string;
    newStatus: WordStatus;
    oldStatus: WordStatus;
    wordName: string;
    autoAdvance: boolean;
  } | null>(null);

  const rateAndMaybeConfirm = (newStatus: WordStatus, autoAdvance = true) => {
    if (!currentActiveWord.id) return;
    const oldStatus = progress[currentActiveWord.id]?.status || 'unrated';

    if (oldStatus !== 'unrated' && oldStatus !== newStatus) {
      setPendingRating({
        wordId: currentActiveWord.id,
        newStatus,
        oldStatus,
        wordName: currentActiveWord.word,
        autoAdvance
      });
      return;
    }

    onRateWord(currentActiveWord.id, newStatus);
    if (autoAdvance) {
      handleNext();
    }
  };

  const getStatusLabel = (status: WordStatus) => {
    switch (status) {
      case 'know': return 'Learned (Green)';
      case 'confusion': return 'Confused (Yellow)';
      case 'dont_know': return 'Not Learned (Red)';
      case 'unrated': return 'Unrated (Gray)';
      default: return 'Unrated';
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
  }, [wordIdsString, studyOrder, shuffleKey]);

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
              <strong key={index} className="font-extrabold text-indigo-400 bg-indigo-900/60 px-1.5 py-0.5 rounded-md border border-indigo-500/30">
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
      setIsEditingNote(false);
      setIsFlipped(false);
      setCustomSentenceInput('');
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

  useEffect(() => {
    if ((settings?.flashcardAnimation || 'shuffle') === 'shuffle') {
      const animations = ['flip-h', 'flip-v', 'slide', 'fade', 'zoom'] as const;
      const randomIdx = Math.floor(Math.random() * animations.length);
      setCurrentRandomAnim(animations[randomIdx]);
    }
  }, [currentActiveWord.id, settings?.flashcardAnimation]);

  const activeStatus = progress[currentActiveWord.id]?.status || 'unrated';

  const handleSaveCustomSentence = () => {
    if (!customSentenceInput.trim() || !currentActiveWord.id) return;
    const existing = progress[currentActiveWord.id]?.notes || '';
    const updated = existing 
      ? `${existing}\nSentence: ${customSentenceInput.trim()}`
      : `Sentence: ${customSentenceInput.trim()}`;
    
    onUpdateNotes(currentActiveWord.id, updated);
    setNoteText(updated);
    setCustomSentenceInput('');
    setSentenceSaveToast(true);
    setTimeout(() => setSentenceSaveToast(false), 2000);
  };

  // Helper to dynamically adjust font size
  const getDynamicFontSizeClass = (word: string) => {
    const len = word ? word.length : 0;
    if (len <= 6) return 'text-4xl sm:text-6xl md:text-7xl font-black';
    if (len <= 9) return 'text-3xl sm:text-5xl md:text-6xl font-black';
    if (len <= 12) return 'text-2xl sm:text-4xl md:text-5xl font-black';
    return 'text-xl sm:text-3xl md:text-4xl font-black break-all';
  };

  // Generate IPA phonetic string for visual display
  const getPhoneticSpelling = (word: string) => {
    if (!word) return '';
    return `/${word.toLowerCase()}/`;
  };

  // Get active example sentence
  const activeExampleSentence = currentActiveWord.example || 
    (sentencesData[currentActiveWord.id] && sentencesData[currentActiveWord.id][0]) || 
    `Take the time to sit back and listen to ${currentActiveWord.word} and establish a routine for yourself.`;

  // =========================================================================
  // RENDER STAGE 1: INTERMEDIATE FILTER & SETUP SCREEN (isSessionActive = false)
  // =========================================================================
  if (!isSessionActive) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto" id="flashcard-setup-view">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-indigo-300 to-transparent pointer-events-none" />
          
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-indigo-200 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Flashcard Focus Mode</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-sans">
              Flashcard Study Setup
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 max-w-2xl font-sans leading-relaxed">
              Configure your group filters and study options. Entering flashcards will open an immersive, distraction-free card deck with maximum screen space.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-3">
              <div className="bg-white/10 border border-white/15 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Ready Words</p>
                  <p className="text-lg font-black text-white">{filteredWords.length} Words Selected</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSessionActive(true)}
                disabled={filteredWords.length === 0}
                className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-2.5 text-sm font-sans"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Start Flashcards ({filteredWords.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Configuration Controls */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <span>Study Deck Filters</span>
            </h3>
            <button
              onClick={() => {
                setSelectedGroups(uniqueGroups);
                setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated']);
                setSelectedFolder('all');
                setStudyOrder('random');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer hover:underline"
            >
              Reset All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Group Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Vocabulary Groups ({selectedGroups.length}/{uniqueGroups.length})
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setSelectedGroups(uniqueGroups)}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setSelectedGroups([])}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-50 border border-slate-200/60 rounded-2xl">
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
                      className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tag Status Filter
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => {
                      setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated']);
                      setUserHasManuallyChangedStatuses(true);
                    }}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    All Tags
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'unrated', label: 'Unrated (Gray)', color: 'bg-slate-400' },
                  { key: 'dont_know', label: 'Not Learned (Red)', color: 'bg-rose-500' },
                  { key: 'confusion', label: 'Confused (Yellow)', color: 'bg-amber-500' },
                  { key: 'know', label: 'Learned (Green)', color: 'bg-emerald-500' }
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
                      className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between transition cursor-pointer border ${
                        isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-3xs' : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${st.color}`} />
                        <span>{st.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
            {/* Bookmark Folder */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bookmark Collection</label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Words (No Folder Limit)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Study Order */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sequence / Order</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStudyOrder('serial')}
                  className={`py-3 text-xs font-bold rounded-2xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    studyOrder === 'serial' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Serial</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('alphabetical')}
                  className={`py-3 text-xs font-bold rounded-2xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    studyOrder === 'alphabetical' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-[10px] font-black">A-Z</span>
                  <span>Alphabetical</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('random')}
                  className={`py-3 text-xs font-bold rounded-2xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    studyOrder === 'random' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Matching Words: <span className="text-indigo-600 font-extrabold">{filteredWords.length}</span>
            </span>

            <button
              type="button"
              onClick={() => setIsSessionActive(true)}
              disabled={filteredWords.length === 0}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl transition cursor-pointer shadow-md shadow-indigo-500/20 flex items-center gap-2 text-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Enter Focus Mode →</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER STAGE 2: IMMERSIVE FULL-SCREEN FLASHCARD FOCUS MODE (isSessionActive = true)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 text-white flex flex-col h-screen w-screen overflow-hidden animate-fadeIn select-none font-sans" id="flashcard-fullscreen-view">
      {/* 1. Fullscreen Top Header Bar */}
      <header className="h-14 sm:h-16 px-4 sm:px-8 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-slate-950/60 backdrop-blur-md z-30">
        <button
          onClick={() => setIsSessionActive(false)}
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full transition cursor-pointer border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Focus Mode</span>
        </button>

        {/* Center Title & Counter */}
        <div className="text-center">
          <h2 className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center justify-center gap-1.5">
            <span>Group {currentActiveWord.group || 1}</span>
            <span className="text-indigo-400">•</span>
            <span className="text-indigo-200 font-mono text-[11px] sm:text-xs">
              {currentIndex + 1}/{filteredWords.length}
            </span>
          </h2>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {variableToggles?.audio !== false && (
            <button
              onClick={speakWord}
              className="p-2 bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white rounded-full transition cursor-pointer"
              title="Listen Audio"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => handleOpenReportModal(currentActiveWord)}
            className="p-2 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-full transition cursor-pointer"
            title="Report Word Error"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSessionActive(false)}
            className="p-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-full transition cursor-pointer"
            title="Close Session"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Flashcard Canvas Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 sm:py-6 flex flex-col items-center justify-between max-w-xl mx-auto w-full gap-4">
        
        {/* Flashcard Stack Stage */}
        <div className="w-full relative my-auto perspective">
          {/* Stacked Cards visual depth effect underneath */}
          <div className="absolute inset-x-6 sm:inset-x-8 bottom-[-14px] h-full bg-indigo-900/40 border border-indigo-500/20 rounded-3xl rotate-2 pointer-events-none z-0"></div>
          <div className="absolute inset-x-3 sm:inset-x-4 bottom-[-7px] h-full bg-indigo-800/60 border border-indigo-400/30 rounded-3xl -rotate-1 pointer-events-none z-0"></div>

          {/* Active Card Container - 3D Inner Wrapper */}
          <div
            onClick={() => {
              if (touchHandled.current) {
                touchHandled.current = false;
                return;
              }
              setIsFlipped(prev => !prev);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`relative w-full h-[380px] sm:h-[420px] z-10 cursor-pointer transition-transform duration-500 transform-style-3d ${
              isFlipped ? 'flipped rotate-y-180' : ''
            }`}
          >
            {/* FRONT FACE */}
            <div className="absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl border border-slate-100 flex flex-col justify-between backface-hidden">
              {/* Top Row: Speaker Icon & Word Meta */}
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                  Group {currentActiveWord.group}
                </span>

                <div className="flex items-center gap-2">
                  {variableToggles?.audio !== false && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord();
                      }}
                      className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition shadow-xs cursor-pointer active:scale-90"
                      title="Speak word"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Center Content: Front Face */}
              <div className="my-auto text-center space-y-2 py-4">
                <h1 className={`${getDynamicFontSizeClass(currentActiveWord.word)} text-slate-900 tracking-tight font-sans`}>
                  {currentActiveWord.word}
                </h1>
                <p className="text-sm font-semibold font-mono text-slate-400">
                  {getPhoneticSpelling(currentActiveWord.word)}
                </p>
                {currentActiveWord.extraWord && (
                  <p className="text-xs font-bold text-emerald-600 font-bengali pt-1">
                    {currentActiveWord.extraWord}: {currentActiveWord.extraMeaning}
                  </p>
                )}
                <p className="text-[11px] text-indigo-400 font-medium pt-3 animate-pulse font-sans">
                  Tap card to reveal definition ↺
                </p>
              </div>

              {/* Card Footer Response Controls */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-around w-full" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => rateAndMaybeConfirm('dont_know', true)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                    activeStatus === 'dont_know'
                      ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                      : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                  }`}
                  title="Not Learned / Hard"
                >
                  <X className="w-6 h-6 stroke-[3]" />
                </button>

                <button
                  onClick={() => setIsFlipped(prev => !prev)}
                  className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center transition cursor-pointer"
                  title="Flip Card"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => rateAndMaybeConfirm('know', true)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                    activeStatus === 'know'
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                  }`}
                  title="Learned / Easy"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                </button>
              </div>
            </div>

            {/* BACK FACE */}
            <div className="absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl border border-slate-100 flex flex-col justify-between backface-hidden rotate-y-180">
              {/* Top Row: Speaker Icon & Word Meta */}
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                  Group {currentActiveWord.group}
                </span>

                <div className="flex items-center gap-2">
                  {variableToggles?.audio !== false && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord();
                      }}
                      className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition shadow-xs cursor-pointer active:scale-90"
                      title="Speak word"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Center Content: Back Face */}
              <div className="my-auto text-center space-y-3 py-2 overflow-y-auto max-h-[220px] scrollbar-none">
                <h2 className="text-xl font-black text-slate-800">{currentActiveWord.word}</h2>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 font-bengali leading-relaxed">
                  {currentActiveWord.meaning}
                </p>
                {currentActiveWord.synonyms && (
                  <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block pb-0.5">Synonyms</span>
                    <span>{currentActiveWord.synonyms}</span>
                  </div>
                )}
                {noteText && (
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl font-bengali">
                    "{noteText}"
                  </div>
                )}
              </div>

              {/* Card Footer Response Controls */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-around w-full" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => rateAndMaybeConfirm('dont_know', true)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                    activeStatus === 'dont_know'
                      ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                      : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                  }`}
                  title="Not Learned / Hard"
                >
                  <X className="w-6 h-6 stroke-[3]" />
                </button>

                <button
                  onClick={() => setIsFlipped(prev => !prev)}
                  className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center transition cursor-pointer"
                  title="Flip Card"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => rateAndMaybeConfirm('know', true)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                    activeStatus === 'know'
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                  }`}
                  title="Learned / Easy"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* "Word in Use" Box (Below Card Stack as seen in attached images) */}
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl space-y-2 text-indigo-100 font-sans shadow-lg">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Lightbulb className="w-4 h-4 text-amber-300 fill-amber-300/20" />
            <span>Word in use</span>
          </div>
          <p className="text-xs sm:text-sm font-medium leading-relaxed text-white">
            {renderSentence(activeExampleSentence)}
          </p>
        </div>

        {/* Interactive Sentence Writer Input Box */}
        <div className="w-full space-y-2">
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-1.5 rounded-full flex items-center gap-2 w-full shadow-lg">
            <input
              type="text"
              value={customSentenceInput}
              onChange={(e) => setCustomSentenceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveCustomSentence();
                }
              }}
              placeholder="Write your sentence..."
              className="bg-transparent border-0 px-4 py-2 text-xs sm:text-sm text-white placeholder-indigo-300/60 focus:outline-none flex-1 font-sans"
            />
            <button
              onClick={handleSaveCustomSentence}
              disabled={!customSentenceInput.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white p-2.5 rounded-full transition cursor-pointer shadow-md flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {sentenceSaveToast && (
            <p className="text-[11px] font-bold text-emerald-400 text-center animate-fadeIn">
              ✓ Sentence saved to your word notes!
            </p>
          )}
        </div>
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
