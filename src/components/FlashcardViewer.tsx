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
  HelpCircle,
  SkipForward
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
  onUpdateSettings?: (newSettings: AppSettings) => void;
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
  onUpdateSettings,
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

  // Card orientation and flip animation styles
  type FlipAnimationKey = 'flip-h' | 'flip-v' | 'slide' | 'fade' | 'zoom' | 'shuffle';
  const [isFlipped, setIsFlipped] = useState(false);
  const [localAnimation, setLocalAnimation] = useState<FlipAnimationKey>('shuffle');
  const [isAnimPickerOpen, setIsAnimPickerOpen] = useState(false);

  // Random animation state for shuffle option
  const [currentRandomAnim, setCurrentRandomAnim] = useState<'flip-h' | 'flip-v' | 'slide' | 'fade' | 'zoom'>('flip-h');

  // Effective animation setting
  const effectiveAnimSetting: FlipAnimationKey = settings?.flashcardAnimation || localAnimation;

  // Active animation key applied to CSS
  const activeAnimKey: 'flip-h' | 'flip-v' | 'slide' | 'fade' | 'zoom' =
    effectiveAnimSetting === 'shuffle' ? currentRandomAnim : effectiveAnimSetting;

  const handleSelectAnimation = (anim: FlipAnimationKey) => {
    setLocalAnimation(anim);
    if (onUpdateSettings && settings) {
      onUpdateSettings({
        ...settings,
        flashcardAnimation: anim
      });
    }
  };

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
  }, [filteredWords, currentIndex, currentActiveWord.id, currentActiveWord.word, googleSearchQuery, isSessionActive, settings?.shortcuts]);

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
    if (effectiveAnimSetting === 'shuffle') {
      const animations = ['flip-h', 'flip-v', 'slide', 'fade', 'zoom'] as const;
      const randomIdx = Math.floor(Math.random() * animations.length);
      setCurrentRandomAnim(animations[randomIdx]);
    }
  }, [currentIndex, currentActiveWord.id, effectiveAnimSetting]);

  const activeStatus = progress[currentActiveWord.id]?.status || 'unrated';

  const getWordColorClass = (status: WordStatus) => {
    if (settings?.colorizeMainWord === false) return 'text-slate-900';
    switch (status) {
      case 'know':
        return 'text-emerald-600 font-extrabold';
      case 'dont_know':
        return 'text-rose-600 font-extrabold';
      case 'confusion':
        return 'text-amber-600 font-extrabold';
      default:
        return 'text-slate-900';
    }
  };

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
      <div className="space-y-4 max-w-5xl mx-auto" id="flashcard-setup-view">
        {/* Header Hero Banner / Start Flashcard Button */}
        <button
          type="button"
          onClick={() => setIsSessionActive(true)}
          disabled={filteredWords.length === 0}
          className="w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 hover:from-indigo-800 hover:to-slate-800 disabled:opacity-50 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-indigo-700/50 flex items-center justify-between transition cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/30 text-amber-300 border border-indigo-400/30 group-hover:scale-105 transition">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div className="text-left">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight font-sans text-white">
                Start Flashcard
              </h1>
              <p className="text-xs text-indigo-200">
                {filteredWords.length} words selected in current deck
              </p>
            </div>
          </div>
          <span className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm">
            <span>Start Now</span>
            <Play className="w-3.5 h-3.5 fill-current" />
          </span>
        </button>

        {/* Filter Configuration Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span style={{
                fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
                fontSize: '10px',
                color: 'oklch(0.704 0.04 256.788)',
                fontWeight: 500,
                lineHeight: '10px',
                letterSpacing: '-0.25px',
              }}>Study Deck Filters</span>
            </h3>
            <button
              onClick={() => {
                setSelectedGroups(uniqueGroups);
                setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated']);
                setSelectedFolder('all');
                setStudyOrder('random');
              }}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer hover:underline"
            >
              Reset All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Group Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label style={{
                  fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
                  fontSize: '10px',
                  color: 'oklch(0.704 0.04 256.788)',
                  fontWeight: 500,
                  lineHeight: '10px',
                  letterSpacing: '-0.25px',
                }} className="uppercase">
                  Vocabulary Groups ({selectedGroups.length}/{uniqueGroups.length})
                </label>
                <div className="flex gap-1.5 text-[10px]">
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

              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1 max-h-36 overflow-y-auto p-1 bg-slate-50 border border-slate-200/60 rounded-xl scrollbar-thin">
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
                      className={`py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs'
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label style={{
                  fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
                  fontSize: '10px',
                  color: 'oklch(0.704 0.04 256.788)',
                  fontWeight: 500,
                  lineHeight: '10px',
                  letterSpacing: '-0.25px',
                }} className="uppercase">
                  Tag Status Filter
                </label>
                <div className="flex gap-1.5 text-[10px]">
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

              <div className="grid grid-cols-2 gap-1.5">
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
                      className={`p-2 rounded-xl text-[11px] font-semibold flex items-center justify-between transition cursor-pointer border ${
                        isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                        <span>{st.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            {/* Bookmark Folder */}
            <div className="space-y-1.5">
              <label style={{
                fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
                fontSize: '10px',
                color: 'oklch(0.704 0.04 256.788)',
                fontWeight: 500,
                lineHeight: '10px',
                letterSpacing: '-0.25px',
              }} className="uppercase block">Bookmark Collection</label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Words (No Folder Limit)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Study Order */}
            <div className="space-y-1.5">
              <label style={{
                fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
                fontSize: '10px',
                color: 'oklch(0.704 0.04 256.788)',
                fontWeight: 500,
                lineHeight: '10px',
                letterSpacing: '-0.25px',
              }} className="uppercase block">Sequence / Order</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStudyOrder('serial')}
                  className={`py-2 text-[11px] font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'serial' ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <span>Serial</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('alphabetical')}
                  className={`py-2 text-[11px] font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'alphabetical' ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-[9px] font-black">A-Z</span>
                  <span>Alphabetical</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyOrder('random')}
                  className={`py-2 text-[11px] font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                    studyOrder === 'random' ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>

            {/* Flip Animation Style Selector */}
            <div className="space-y-1.5 col-span-1 sm:col-span-2 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Card Flip Animation
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { id: 'flip-h', label: 'Flip (H)', icon: '🔄' },
                  { id: 'flip-v', label: 'Flip (V)', icon: '↕️' },
                  { id: 'slide', label: 'Slide', icon: '↔️' },
                  { id: 'fade', label: 'Fade', icon: '👁️' },
                  { id: 'zoom', label: 'Zoom', icon: '🔍' },
                  { id: 'shuffle', label: 'Shuffle', icon: '🔀' },
                ].map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    onClick={() => handleSelectAnimation(anim.id as FlipAnimationKey)}
                    className={`py-2 px-1 text-[10px] sm:text-[11px] font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                      effectiveAnimSetting === anim.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs">{anim.icon}</span>
                    <span>{anim.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">
              Matching Words: <span className="text-indigo-600 font-extrabold">{filteredWords.length}</span>
            </span>

            <button
              type="button"
              onClick={() => setIsSessionActive(true)}
              disabled={filteredWords.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
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
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 p-2 sm:p-2.5 rounded-full transition cursor-pointer border border-white/10"
          title="Exit Focus Mode"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Flip Animation Quick Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsAnimPickerOpen(prev => !prev)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white rounded-full transition cursor-pointer border border-white/10 flex items-center gap-1.5 text-xs font-semibold"
              title="Change Card Flip Animation"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="capitalize text-[11px] hidden sm:inline">{effectiveAnimSetting.replace('flip-', '')} Flip</span>
            </button>

            {isAnimPickerOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-white/15 rounded-2xl shadow-xl p-1.5 z-50 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Flip Animation
                </div>
                {[
                  { id: 'flip-h', label: '1. Horizontal (3D)', desc: 'Horizontal 3D Flip' },
                  { id: 'flip-v', label: '2. Vertical (3D)', desc: 'Vertical 3D Flip' },
                  { id: 'slide', label: '3. Slide & Flip', desc: 'Slide 3D Flip' },
                  { id: 'fade', label: '4. Fade & Flip', desc: 'Fade & Flip' },
                  { id: 'zoom', label: '5. Zoom & Flip', desc: 'Zoom 3D Flip' },
                  { id: 'shuffle', label: '6. Random Shuffle', desc: 'Random per card' },
                ].map(anim => (
                  <button
                    key={anim.id}
                    onClick={() => {
                      handleSelectAnimation(anim.id as FlipAnimationKey);
                      setIsAnimPickerOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                      effectiveAnimSetting === anim.id ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">{anim.label}</div>
                      <div className="text-[10px] opacity-75">{anim.desc}</div>
                    </div>
                    {effectiveAnimSetting === anim.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

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
        
        {/* Flashcard Stage */}
        <div className="w-full relative my-auto perspective">

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
            className={`relative w-full h-[455px] sm:h-[475px] z-10 cursor-pointer transform-style-3d anim-${activeAnimKey} ${
              isFlipped ? 'is-flipped' : ''
            }`}
          >
            {/* FRONT FACE */}
            <div className={`absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-5 sm:p-6 md:p-7 shadow-2xl border border-slate-100 flex flex-col justify-between backface-hidden ${
              isFlipped ? 'pointer-events-none' : 'pointer-events-auto'
            }`}>
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
                {placeLabels?.place1?.trim() && (
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 block font-sans">
                    {placeLabels.place1.trim()}
                  </span>
                )}
                <h1 className={`${getDynamicFontSizeClass(currentActiveWord.word)} ${getWordColorClass(activeStatus)} tracking-tight font-sans transition-colors duration-200`}>
                  {currentActiveWord.word}
                </h1>
                <p className="text-[11px] text-indigo-400 font-medium pt-3 animate-pulse font-sans">
                  Tap card to reveal definition ↺
                </p>
              </div>

              {/* Card Footer Response Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-around w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => rateAndMaybeConfirm('dont_know', true)}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                      activeStatus === 'dont_know'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                    }`}
                    title="Not Learned / Hard"
                  >
                    <X className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    don't know
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => rateAndMaybeConfirm('confusion', true)}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                      activeStatus === 'confusion'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                    }`}
                    title="Confused / Medium"
                  >
                    <HelpCircle className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    confusion
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleNext}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer"
                    title="Skip Card"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    skip
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => rateAndMaybeConfirm('know', true)}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                      activeStatus === 'know'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                    }`}
                    title="Learned / Easy"
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    know
                  </span>
                </div>
              </div>
            </div>

            {/* BACK FACE */}
            <div className={`absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-5 sm:p-6 md:p-7 shadow-2xl border border-slate-100 flex flex-col justify-between backface-hidden backface-${activeAnimKey} ${
              isFlipped ? 'pointer-events-auto' : 'pointer-events-none'
            }`}>
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
              {(() => {
                const place1Label = placeLabels?.place1?.trim() || 'Word';
                const place2Label = placeLabels?.place2?.trim() || 'Meaning';
                const place3Label = placeLabels?.place3?.trim() || 'Example Sentence';
                const place4Label = placeLabels?.place4?.trim() || 'Derivative';
                const place5Label = placeLabels?.place5?.trim() || 'Synonyms';
                const place6Label = placeLabels?.place6?.trim() || 'Mnemonic / Note';

                const place2Val = currentActiveWord.meaning?.trim();
                const hasPlace2 = Boolean(place2Val);
                const place3Val = currentActiveWord.example?.trim();
                const hasPlace3 = Boolean(place3Val);
                const place4Val = currentActiveWord.extraWord?.trim();
                const hasPlace4 = Boolean(place4Val);
                const place5Val = currentActiveWord.synonyms?.trim();
                const hasPlace5 = Boolean(place5Val);
                const place6Val = (currentActiveWord.mnemonic || progress[currentActiveWord.id]?.notes)?.trim();
                const hasPlace6 = Boolean(place6Val);

                const labelClass = "text-[11px] font-extrabold uppercase tracking-widest text-slate-400 block pb-0.5 font-sans";

                const blocks: React.ReactNode[] = [];

                // Block 1: Place 2 (Meaning)
                if (hasPlace2 && place2Val) {
                  blocks.push(
                    <div key="place2" className="text-center w-full">
                      {place2Label && (
                        <span className={labelClass}>
                          {place2Label}
                        </span>
                      )}
                      <p className="text-xl sm:text-2xl font-black text-emerald-600 font-bengali leading-snug">
                        {place2Val}
                      </p>
                    </div>
                  );
                }

                // Block 2: Place 3 (Example Sentence / Secondary)
                if (hasPlace3 && place3Val && place3Val !== place2Val) {
                  blocks.push(
                    <div key="place3" className="w-full text-center space-y-0.5">
                      {place3Label && (
                        <span className={labelClass}>
                          {place3Label}
                        </span>
                      )}
                      <p className="text-xs sm:text-sm font-semibold text-slate-700 text-center">
                        {place3Val}
                      </p>
                    </div>
                  );
                }

                // Block 3: Place 4 (Extra Word / Derivatives)
                if (hasPlace4 && place4Val && place4Val !== place2Val && place4Val !== place3Val) {
                  blocks.push(
                    <div key="place4" className="w-full text-center space-y-0.5">
                      {place4Label && (
                        <span className={labelClass}>
                          {place4Label}
                        </span>
                      )}
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
                        {place4Val}
                      </p>
                    </div>
                  );
                }

                // Block 4: Place 5 (Synonyms / Extra Section 1)
                if (hasPlace5 && place5Val && place5Val !== place2Val && place5Val !== place3Val && place5Val !== place4Val) {
                  blocks.push(
                    <div key="place5" className="w-full text-center space-y-0.5">
                      {place5Label && (
                        <span className={labelClass}>
                          {place5Label}
                        </span>
                      )}
                      <p className="text-xs font-bold text-emerald-700 text-center">
                        {place5Val}
                      </p>
                    </div>
                  );
                }

                // Block 5: Place 6 (Mnemonic / Notes / Extra Section 2)
                if (hasPlace6 && place6Val && place6Val !== place2Val && place6Val !== place3Val && place6Val !== place4Val && place6Val !== place5Val) {
                  blocks.push(
                    <div key="place6" className="w-full text-center space-y-0.5">
                      {place6Label && (
                        <span className={labelClass}>
                          {place6Label}
                        </span>
                      )}
                      <p className="text-xs font-medium italic text-indigo-600 text-center">
                        {place6Val}
                      </p>
                    </div>
                  );
                }

                if (blocks.length === 0) {
                  return (
                    <div className="my-auto text-center py-2 w-full flex flex-col items-center justify-center">
                      <p className="text-sm font-medium text-slate-400 italic">No additional details available</p>
                    </div>
                  );
                }

                return (
                  <div className="flex-1 my-auto text-center py-1 w-full flex flex-col items-center justify-around gap-1 overflow-hidden">
                    {blocks.map((block, index) => (
                      <div
                        key={index}
                        className={`w-full flex flex-col items-center justify-center ${
                          index > 0 ? 'pt-1.5 border-t border-slate-100/80' : ''
                        }`}
                      >
                        {block}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Card Footer Response Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-around w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => rateAndMaybeConfirm('dont_know', true)}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                      activeStatus === 'dont_know'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                    }`}
                    title="Not Learned / Hard"
                  >
                    <X className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    don't know
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => rateAndMaybeConfirm('confusion', true)}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                      activeStatus === 'confusion'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                    }`}
                    title="Confused / Medium"
                  >
                    <HelpCircle className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    confusion
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleNext}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer"
                    title="Skip Card"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    skip
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => rateAndMaybeConfirm('know', true)}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
                      activeStatus === 'know'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                    }`}
                    title="Learned / Easy"
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                    know
                  </span>
                </div>
              </div>
            </div>
          </div>
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
