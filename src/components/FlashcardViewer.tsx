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
  Filter
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
    } else {
      setSelectedGroups(uniqueGroups);
    }
  }, [words, initialGroup, uniqueGroups]);

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

    // Only update if different to prevent infinite re-renders
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

  // Active note state
  const [noteText, setNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);

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

    // Check if word is already in 'know' or another tag, and we try to remove or change it
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

    // No confirmation needed: update immediately
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

    // Filter by multiple selected groups
    if (selectedGroups.length < uniqueGroups.length) {
      result = result.filter(w => selectedGroups.includes(w.group));
    }

    // Filter by tag/status (multi-select)
    if (selectedStatuses.length < 4) {
      result = result.filter(w => {
        const status = progress[w.id]?.status || 'unrated';
        return selectedStatuses.includes(status);
      });
    }

    // Filter by custom folders/bookmark list
    if (selectedFolder !== 'all') {
      result = result.filter(w => {
        const bookmarks = progress[w.id]?.bookmarks || [];
        return bookmarks.includes(selectedFolder);
      });
    }

    setBaseFilteredWords(result);
  }, [selectedGroups, selectedStatuses, selectedFolder, words, progress]);

  // Track the unique identity/IDs of filtered words to avoid reshuffling on rating updates
  const wordIdsString = baseFilteredWords.map(w => w.id).join(',');

  // Phase 2: Order/shuffle selected words
  useEffect(() => {
    let result = [...baseFilteredWords];

    if (studyOrder === 'random') {
      // Fisher-Yates shuffle algorithm
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
      }
    } else if (studyOrder === 'alphabetical') {
      result.sort((a, b) => a.word.localeCompare(b.word));
    } else {
      // 'serial' -> sorted naturally by vocabulary list sequence (Base list is already structured serially by group)
    }

    setFilteredWords(result);

    // Find first word that is not marked as 'pari' (know)
    const firstNonPariIndex = result.findIndex(w => {
      const status = progress[w.id]?.status || 'unrated';
      return status !== 'know';
    });

    setCurrentIndex(firstNonPariIndex !== -1 ? firstNonPariIndex : 0);
    setIsFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordIdsString, studyOrder, shuffleKey]);

  // Safe fallback current word definition
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
              <strong key={index} className="font-extrabold text-indigo-700 bg-indigo-50/70 px-1.5 py-0.5 rounded-md border border-indigo-100/50">
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
    }
  }, [currentIndex, filteredWords.length, currentActiveWord.id, progress]);

  // Navigate index safely
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(filteredWords.length - 1); // Wrap around
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0); // Wrap around
    }
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip hotkeys if focused inside an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (filteredWords.length === 0) return;

      const userShortcuts = settings?.shortcuts || {
        'Space': 'flip',
        'ArrowRight': 'know',
        'ArrowLeft': 'dont_know',
        'ArrowUp': 'confusion',
        'ArrowDown': 'skip',
        'Enter': 'audio'
      };

      // Handle standard space code normalization
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
  }, [filteredWords, currentIndex, currentActiveWord.id, rateAndMaybeConfirm, settings?.shortcuts, handleNext, handlePrev]);

  // Text to Speech
  const speakWord = () => {
    if (!currentActiveWord.word) return;
    const utterance = new SpeechSynthesisUtterance(currentActiveWord.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel(); // Clear queued speech
    window.speechSynthesis.speak(utterance);
  };

  // Autoplay voice pronunciation if enabled
  useEffect(() => {
    if (settings?.autoPlayAudio && currentActiveWord.word && variableToggles?.audio !== false) {
      const timer = setTimeout(() => {
        speakWord();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentActiveWord.id, settings?.autoPlayAudio, variableToggles]);

  // Select a random animation if "shuffle" is configured
  useEffect(() => {
    if ((settings?.flashcardAnimation || 'shuffle') === 'shuffle') {
      const animations = ['flip-h', 'flip-v', 'slide', 'fade', 'zoom'] as const;
      const randomIdx = Math.floor(Math.random() * animations.length);
      setCurrentRandomAnim(animations[randomIdx]);
    }
  }, [currentActiveWord.id, settings?.flashcardAnimation]);

  const activeStatus = progress[currentActiveWord.id]?.status || 'unrated';
  const shouldColorize = settings?.colorizeMainWord !== false;

  const frontWordColorClass = shouldColorize 
    ? (activeStatus === 'know' 
        ? 'text-emerald-600' 
        : activeStatus === 'dont_know' 
          ? 'text-rose-600' 
          : activeStatus === 'confusion' 
            ? 'text-amber-500' 
            : 'text-indigo-950')
    : 'text-indigo-950';

  const backWordColorClass = shouldColorize
    ? (activeStatus === 'know' 
        ? 'text-emerald-600' 
        : activeStatus === 'dont_know' 
          ? 'text-rose-600' 
          : activeStatus === 'confusion' 
            ? 'text-amber-500' 
            : 'text-slate-800')
    : 'text-slate-800';

  const animationType = (settings?.flashcardAnimation || 'shuffle') === 'shuffle' ? currentRandomAnim : (settings?.flashcardAnimation || 'shuffle');

  // Helper to dynamically adjust vocabulary word font size based on character count
  const getDynamicFontSizeClass = (word: string) => {
    const len = word ? word.length : 0;
    if (len <= 6) {
      return 'text-4xl sm:text-6xl md:text-7xl lg:text-8xl';
    } else if (len <= 9) {
      return 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl';
    } else if (len <= 12) {
      return 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl';
    } else if (len <= 15) {
      return 'text-xl sm:text-3xl md:text-4xl lg:text-5xl break-all';
    } else {
      return 'text-lg sm:text-2xl md:text-3xl lg:text-4xl break-all';
    }
  };

  // Helper to dynamically adjust synonyms font size based on character count
  const getDynamicSynonymsFontSizeClass = (synonyms: string) => {
    const len = synonyms ? synonyms.length : 0;
    if (len <= 12) {
      return 'text-lg sm:text-2xl md:text-3xl lg:text-4xl';
    } else if (len <= 20) {
      return 'text-base sm:text-xl md:text-2xl lg:text-3xl';
    } else if (len <= 30) {
      return 'text-sm sm:text-lg md:text-xl lg:text-2xl';
    } else {
      return 'text-xs sm:text-base md:text-lg lg:text-xl break-all';
    }
  };

  // Helper to retrieve shortcut key representations for each action
  const getShortcutKeyForAction = (action: string): string => {
    const userShortcuts = settings?.shortcuts || {
      'Space': 'flip',
      'ArrowRight': 'know',
      'ArrowLeft': 'dont_know',
      'ArrowUp': 'confusion',
      'ArrowDown': 'skip',
      'Enter': 'audio'
    };

    const keys = Object.entries(userShortcuts)
      .filter(([_, act]) => act === action)
      .map(([key, _]) => {
        switch (key) {
          case 'ArrowRight': return '→';
          case 'ArrowLeft': return '←';
          case 'ArrowUp': return '↑';
          case 'ArrowDown': return '↓';
          case 'Space': return 'Space';
          case 'Enter': return 'Enter';
          case 'Digit1': return '1';
          case 'Digit2': return '2';
          case 'Digit3': return '3';
          case 'Digit4': return '4';
          case 'Digit5': return '5';
          case 'Digit6': return '6';
          case 'KeyA': return 'A';
          case 'KeyS': return 'S';
          case 'KeyD': return 'D';
          case 'KeyF': return 'F';
          case 'KeyG': return 'G';
          default: return key;
        }
      });

    return keys.length > 0 ? keys.join('/') : '';
  };

  // Determine stage & face class names based on animation type
  let outerWrapperClass = '';
  let frontFaceClass = '';
  let backFaceClass = '';

  if (animationType === 'flip-h') {
    outerWrapperClass = `w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`;
    frontFaceClass = 'absolute inset-0 bg-white border border-indigo-100/80 rounded-3xl p-2.5 sm:p-6 md:p-8 flex flex-col justify-between backface-hidden shadow-xl hover:shadow-2xl transition-all duration-300 before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none';
    backFaceClass = 'absolute inset-0 bg-white p-2.5 sm:p-5 rounded-3xl border border-indigo-100/80 shadow-xl transform rotate-y-180 backface-hidden flex flex-col justify-between before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none';
  } else if (animationType === 'flip-v') {
    outerWrapperClass = `w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-x-180' : ''}`;
    frontFaceClass = 'absolute inset-0 bg-white border border-indigo-100/80 rounded-3xl p-2.5 sm:p-6 md:p-8 flex flex-col justify-between backface-hidden shadow-xl hover:shadow-2xl transition-all duration-300 before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none';
    backFaceClass = 'absolute inset-0 bg-white p-2.5 sm:p-5 rounded-3xl border border-indigo-100/80 shadow-xl transform rotate-x-180 backface-hidden flex flex-col justify-between before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none';
  } else if (animationType === 'slide') {
    outerWrapperClass = 'w-full h-full relative';
    frontFaceClass = `absolute inset-0 bg-white border border-indigo-100/80 rounded-3xl p-2.5 sm:p-6 md:p-8 flex flex-col justify-between shadow-xl hover:shadow-2xl transition-all duration-500 ease-in-out before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none ${
      isFlipped ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
    }`;
    backFaceClass = `absolute inset-0 bg-white p-2.5 sm:p-5 rounded-3xl border border-indigo-100/80 shadow-xl flex flex-col justify-between transition-all duration-500 ease-in-out before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none ${
      isFlipped ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
    }`;
  } else if (animationType === 'fade') {
    outerWrapperClass = 'w-full h-full relative';
    frontFaceClass = `absolute inset-0 bg-white border border-indigo-100/80 rounded-3xl p-2.5 sm:p-6 md:p-8 flex flex-col justify-between shadow-xl hover:shadow-2xl transition-opacity duration-300 ease-in-out before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none ${
      isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`;
    backFaceClass = `absolute inset-0 bg-white p-2.5 sm:p-5 rounded-3xl border border-indigo-100/80 shadow-xl flex flex-col justify-between transition-opacity duration-300 ease-in-out before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none ${
      isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`;
  } else if (animationType === 'zoom') {
    outerWrapperClass = 'w-full h-full relative';
    frontFaceClass = `absolute inset-0 bg-white border border-indigo-100/80 rounded-3xl p-2.5 sm:p-6 md:p-8 flex flex-col justify-between shadow-xl hover:shadow-2xl transition-all duration-300 ease-in-out before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none ${
      isFlipped ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
    }`;
    backFaceClass = `absolute inset-0 bg-white p-2.5 sm:p-5 rounded-3xl border border-indigo-100/80 shadow-xl flex flex-col justify-between transition-all duration-300 ease-in-out before:absolute before:inset-2 border:border-indigo-50/50 before:rounded-[20px] before:pointer-events-none ${
      isFlipped ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
    }`;
  }

  return (
    <div className="space-y-6" id="flashcard-viewer-container">
      {/* Top Filter and Customization Bar */}
      <div className="bg-white p-2.5 sm:p-3.5 md:p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-2 md:space-y-0 md:flex md:items-center md:justify-between" id="flashcard-filters">
        {/* Mobile Filter Toggle Button Bar */}
        <div className="flex items-center justify-between md:hidden w-full">
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 cursor-pointer transition"
          >
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filters & Order</span>
            <span className="text-[10px] text-indigo-400">{isMobileFiltersOpen ? '▲' : '▼'}</span>
          </button>
          <span className="text-xs font-bold text-slate-500 font-sans">
            {currentIndex + 1} / {filteredWords.length} Words
          </span>
        </div>

        <div className={`w-full md:w-auto flex-col md:flex-row gap-3 items-stretch md:items-center justify-between ${isMobileFiltersOpen ? 'flex pt-2 border-t border-slate-100 md:pt-0 md:border-0' : 'hidden md:flex'}`}>
          <div className="flex items-center gap-3 overflow-x-auto md:overflow-x-visible md:overflow-visible pb-2 md:pb-0 scrollbar-none flex-nowrap md:flex-wrap w-full md:w-auto">
          
          {/* Select Group (Multi-select) */}
          <div className="space-y-1 relative flex-shrink-0" id="group-multi-selector">
            <label className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">Vocabulary Group</label>
            <button
              type="button"
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 md:px-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer text-left"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {selectedGroups.length === uniqueGroups.length 
                    ? `All Groups` 
                    : selectedGroups.length === 0 
                    ? 'No Group Selected' 
                    : `${selectedGroups.length} Groups`}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {isGroupDropdownOpen && (
              <>
                {/* Click outside overlay */}
                <div className="fixed inset-0 bg-slate-900/40 md:bg-transparent z-40 md:z-10" onClick={() => setIsGroupDropdownOpen(false)} />
                
                {/* Dropdown panel / Bottom sheet */}
                <div className="fixed bottom-0 left-0 right-0 md:absolute md:top-full md:left-0 md:bottom-auto md:right-auto mt-2 w-full md:w-80 bg-white border border-slate-200/80 rounded-t-3xl md:rounded-2xl shadow-2xl md:shadow-xl p-6 md:p-4 z-50 md:z-20 space-y-3 font-sans animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm md:text-xs font-bold text-slate-600">Group Filter ({selectedGroups.length})</span>
                    <div className="flex gap-2 text-xs md:text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedGroups(uniqueGroups)}
                        className="text-indigo-600 hover:text-indigo-700 font-extrabold cursor-pointer hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroups([])}
                        className="text-rose-600 hover:text-rose-700 font-extrabold cursor-pointer hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Grid of Groups */}
                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {uniqueGroups.map((gVal) => {
                      const isSelected = selectedGroups.includes(gVal);
                      return (
                        <button
                          key={gVal}
                          type="button"
                          onClick={() => {
                            setSelectedGroups(prev => 
                              prev.includes(gVal)
                                ? prev.filter(x => x !== gVal)
                                : [...prev, gVal]
                            );
                          }}
                          className={`py-2 md:py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                          }`}
                        >
                          {gVal}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsGroupDropdownOpen(false)}
                      className="w-full md:w-auto px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white text-xs md:text-[11px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Select Status (Multi-select) */}
          <div className="space-y-1 relative flex-shrink-0" id="status-multi-selector">
            <label className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">Tag Filter</label>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 md:px-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer text-left"
            >
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {selectedStatuses.length === 4 
                    ? 'All Tags' 
                    : selectedStatuses.length === 0 
                    ? 'No Tag Selected' 
                    : selectedStatuses.length === 1
                    ? selectedStatuses.map(s => {
                        if (s === 'know') return 'Learned';
                        if (s === 'dont_know') return 'Not Learned';
                        if (s === 'confusion') return 'Confused';
                        return 'Unrated';
                      })[0]
                    : `${selectedStatuses.length} Tags`}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {isStatusDropdownOpen && (
              <>
                {/* Click outside overlay */}
                <div className="fixed inset-0 bg-slate-900/40 md:bg-transparent z-40 md:z-10" onClick={() => setIsStatusDropdownOpen(false)} />
                
                {/* Dropdown panel / Bottom sheet */}
                <div className="fixed bottom-0 left-0 right-0 md:absolute md:top-full md:left-0 md:bottom-auto md:right-auto mt-2 w-full md:w-56 bg-white border border-slate-200/80 rounded-t-3xl md:rounded-2xl shadow-2xl md:shadow-xl p-6 md:p-4 z-50 md:z-20 space-y-3 font-sans animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm md:text-xs font-bold text-slate-600 font-sans">Tag Filter</span>
                    <div className="flex gap-2 text-xs md:text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated']);
                          setUserHasManuallyChangedStatuses(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-700 font-extrabold cursor-pointer hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStatuses([]);
                          setUserHasManuallyChangedStatuses(true);
                        }}
                        className="text-rose-600 hover:text-rose-700 font-extrabold cursor-pointer hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { key: 'know', label: 'Learned (Green)', color: 'bg-emerald-500' },
                      { key: 'confusion', label: 'Confused (Yellow)', color: 'bg-amber-500' },
                      { key: 'dont_know', label: 'Not Learned (Red)', color: 'bg-rose-500' },
                      { key: 'unrated', label: 'Unrated (Gray)', color: 'bg-slate-400' }
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
                          className={`w-full text-left px-3 py-2 md:px-2.5 md:py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                            isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                            <span>{st.label}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] text-indigo-600 font-sans">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpen(false)}
                      className="w-full md:w-auto px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white text-xs md:text-[10px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Custom Bookmarks Select */}
          <div className="space-y-1 flex-shrink-0" id="bookmark-folder-selector">
            <label className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">Bookmark List</label>
            <div className="relative flex items-center">
              <Bookmark className="w-3.5 h-3.5 text-emerald-500 absolute left-3 pointer-events-none" />
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-8 pr-8 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 cursor-pointer appearance-none flex-shrink-0 min-w-[120px]"
              >
                <option value="all">All Lists</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 absolute right-3 pointer-events-none">▼</span>
            </div>
          </div>

          {/* Study Order Control */}
          <div className="space-y-1 font-sans flex-shrink-0" id="study-order-selector">
            <label className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Study Order</label>
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setStudyOrder('serial')}
                className={`px-2.5 py-1 text-[11px] md:text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  studyOrder === 'serial'
                    ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Serial</span>
              </button>
              <button
                type="button"
                onClick={() => setStudyOrder('alphabetical')}
                className={`px-2.5 py-1 text-[11px] md:text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  studyOrder === 'alphabetical'
                    ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="text-[9px] font-black font-mono">A-Z</span>
                <span>Alphabetical</span>
              </button>
              <button
                type="button"
                onClick={() => setStudyOrder('random')}
                className={`px-2.5 py-1 text-[11px] md:text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  studyOrder === 'random'
                    ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Random</span>
              </button>
            </div>
            {studyOrder === 'random' && (
              <button
                type="button"
                onClick={() => setShuffleKey(prev => prev + 1)}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-1 rounded-lg cursor-pointer transition flex items-center justify-center mt-0.5 ml-1 absolute left-full top-0"
                title="Reshuffle"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hotkeys helper button */}
        <button
          onClick={() => setShowHotkeysHelp(prev => !prev)}
          className={`hidden md:flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-semibold transition flex-shrink-0 ${
            showHotkeysHelp ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-250'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span className="font-sans">Keyboard Shortcuts</span>
        </button>
        </div>
      </div>

      {/* Hotkeys Help Tooltip Box */}
      {showHotkeysHelp && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-inner animate-fadeIn">
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">Space</kbd> or Click</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">Flip Card</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">➡</kbd> Right Arrow</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">Mark "Learned" & Next</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">⬅</kbd> Left Arrow</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">Mark "Not Learned" & Next</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">⬆</kbd> / <kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">Enter</kbd></p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">Mark "Confused" & Next</p>
          </div>
        </div>
      )}

      {filteredWords.length === 0 ? (
        <div className="text-center py-20 bg-amber-50/40 border border-dashed border-amber-200 rounded-3xl space-y-4 max-w-xl mx-auto" id="no-filtered-words">
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-800 text-base font-sans">No words found!</h3>
            <p className="text-xs text-slate-500 font-medium font-sans">There are no words under your selected filters or bookmark list.</p>
          </div>
          <button
            onClick={() => {
              setSelectedGroups(Array.from({ length: 37 }, (_, i) => i + 1));
              setSelectedStatuses(['dont_know', 'know', 'confusion', 'unrated']);
              setUserHasManuallyChangedStatuses(true);
              setSelectedFolder('all');
            }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm font-sans cursor-pointer shadow-md"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="flashcard-interactive-grid">
          {/* Main Flashcard Column */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* The Flash Card Container with Flip Animation */}
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
              className="group cursor-pointer perspective h-[20rem] sm:h-[25rem] md:h-[28rem] relative w-full animate-card-float select-none"
              id="vocabulary-card-stage"
            >
              {/* Stacked background cards below to show a pile */}
              <div className="absolute inset-x-4 bottom-[-14px] h-full bg-slate-100/70 border border-slate-200/50 rounded-3xl shadow-sm rotate-2 pointer-events-none z-0"></div>
              <div className="absolute inset-x-2 bottom-[-7px] h-full bg-slate-50 border border-slate-200/80 rounded-3xl shadow-md -rotate-1 pointer-events-none z-0"></div>

              <div className={`${outerWrapperClass} z-10 relative`}>
                {/* FRONT FACE (Word) */}
                <div className={frontFaceClass}>
                  {/* Main display word centered in card */}
                  <div className="my-auto text-center space-y-3 w-full max-w-full overflow-hidden px-2 flex flex-col items-center justify-center">
                    <h1 className={`${getDynamicFontSizeClass(currentActiveWord.word)} font-['Poppins'] font-black tracking-tight select-none py-1 break-words text-center ${frontWordColorClass}`}>
                      {currentActiveWord.word}
                    </h1>
                    <div className="flex items-center justify-center gap-2">
                      {variableToggles?.audio !== false && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWord();
                          }}
                          className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition shadow-xs animate-pulse cursor-pointer"
                          title="Listen Pronunciation"
                        >
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                      <a
                        href={getGoogleSearchUrl(currentActiveWord.word, googleSearchQuery)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-xl transition shadow-xs flex items-center justify-center"
                        title="Search on Google"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                        </svg>
                      </a>
                    </div>
                    {currentActiveWord.extraWord && variableToggles?.extraWord !== false && (
                      <div className="text-xs sm:text-base font-extrabold text-[#009966] font-[Verdana] select-none tracking-wide flex items-center justify-center gap-1.5 pt-0.5">
                        <span>{currentActiveWord.extraWord}</span>
                        <span className="text-[#009966] font-black">:</span>
                        <span className="font-bold text-[#009966] font-bengali">{currentActiveWord.extraMeaning}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer hint */}
                  <div className="flex justify-between items-center text-xs text-slate-400 font-sans border-t border-slate-100/60 pt-2 mt-auto">
                    <span className="text-[10px] text-indigo-400 font-semibold sm:hidden">Swipe left/right to navigate</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300 ml-auto">
                      ID: {currentActiveWord.id}
                    </span>
                  </div>
                </div>

                {/* BACK FACE (Meaning & Synonyms) */}
                <div className={backFaceClass}>
                  <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                    <div className="flex justify-end items-center pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-base sm:text-xl font-black ${backWordColorClass}`}>{currentActiveWord.word}</span>
                        <a
                          href={getGoogleSearchUrl(currentActiveWord.word, googleSearchQuery)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-lg transition"
                          title="Search on Google"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                          </svg>
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenReportModal(currentActiveWord);
                          }}
                          className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                          title="Report Error"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>
                    </div>

                    {/* Bengali Meaning & Synonyms layout with auto-centering */}
                    {(!currentActiveWord.synonyms || variableToggles?.synonyms === false) ? (
                      <div className="text-center py-4 flex flex-col items-center justify-center">
                        <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-emerald-600 leading-relaxed font-bengali">{currentActiveWord.meaning}</p>
                      </div>
                    ) : (
                      <>
                        {/* Bengali Meaning */}
                        <div className="text-center py-0.5">
                          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-emerald-600 leading-normal font-bengali">{currentActiveWord.meaning}</p>
                        </div>

                        {/* Synonyms */}
                        <div className="space-y-0 text-center py-1 border-t border-slate-100/40 w-full max-w-full overflow-hidden px-1">
                          <p className="text-[8px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-sans">{placeLabels?.place5 || 'Synonyms'}</p>
                          <p className={`${getDynamicSynonymsFontSizeClass(currentActiveWord.synonyms || '')} font-extrabold text-indigo-950 tracking-tight leading-normal break-words font-sans`}>{currentActiveWord.synonyms || 'N/A'}</p>
                        </div>
                      </>
                    )}

                    {/* Example Sentences */}
                    {variableToggles?.example !== false && (
                      <div className="pt-1 border-t border-slate-100 space-y-0.5 text-left max-w-xl mx-auto">
                        <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans text-center md:text-left">{placeLabels?.place3 || 'Example Sentence'}</p>
                        {currentActiveWord.example || (sentencesData[currentActiveWord.id] && sentencesData[currentActiveWord.id].length > 0) ? (
                          <div className="space-y-1 max-h-[80px] sm:max-h-[110px] overflow-y-auto pr-1 font-sans">
                            {currentActiveWord.example ? (
                              <div className="flex items-start gap-1 text-xs sm:text-[15px] font-medium text-slate-700 leading-relaxed font-sans">
                                <span className="text-indigo-500 mt-1 flex-shrink-0 text-xs leading-none">•</span>
                                <p className="flex-1">
                                  {renderSentence(currentActiveWord.example)}
                                </p>
                              </div>
                            ) : (
                              sentencesData[currentActiveWord.id].slice(0, 1).map((sent, index) => (
                                <div key={index} className="flex items-start gap-1 text-xs sm:text-[15px] font-medium text-slate-700 leading-relaxed font-sans">
                                  <span className="text-indigo-500 mt-1 flex-shrink-0 text-xs leading-none">•</span>
                                  <p className="flex-1">
                                    {renderSentence(sent)}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-450 italic font-sans pl-3">No example found.</p>
                        )}
                      </div>
                    )}

                    {/* Mnemonic / Memory Aid Note */}
                    {(noteText || currentActiveWord.mnemonic) && (
                      <div className="pt-1 border-t border-slate-100/80 space-y-0.5 text-left max-w-xl mx-auto font-sans">
                        <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans text-center md:text-left flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-500 inline" />
                          <span>Mnemonic / Memory Aid</span>
                        </p>
                        <p className="text-xs sm:text-sm md:text-[15px] font-extrabold text-slate-800 leading-relaxed font-bengali">
                          "{noteText || currentActiveWord.mnemonic}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rating Controllers & Navigation */}
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs" id="card-controls">
              {/* Mobile View: 3 Tag Buttons placed where prev-next buttons were */}
              <div className="flex sm:hidden items-center justify-between gap-1.5 w-full">
                <button
                  onClick={() => rateAndMaybeConfirm('dont_know', true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    activeStatus === 'dont_know'
                      ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not Learned</span>
                </button>

                <button
                  onClick={() => rateAndMaybeConfirm('confusion', true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    activeStatus === 'confusion'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Confused</span>
                </button>

                <button
                  onClick={() => rateAndMaybeConfirm('know', true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    activeStatus === 'know'
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Learned</span>
                </button>
              </div>

              {/* Desktop View: Prev/Next & Desktop Tag Buttons */}
              <div className="hidden sm:flex flex-row justify-between items-center gap-4">
                {/* Navigation arrows */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrev}
                    className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold text-slate-500 font-sans select-none">
                    {currentIndex + 1} / {filteredWords.length}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Tag Buttons (Desktop) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => rateAndMaybeConfirm('dont_know', true)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border cursor-pointer ${
                      activeStatus === 'dont_know'
                        ? 'bg-red-500 border-red-600 text-white shadow-md shadow-red-500/10'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Not Learned</span>
                    {getShortcutKeyForAction('dont_know') && (
                      <kbd className={`hidden md:inline-flex items-center justify-center h-4 px-1 text-[9px] font-mono rounded font-normal ml-1 ${
                        activeStatus === 'dont_know'
                          ? 'bg-red-600/50 border border-red-400/40 text-red-100'
                          : 'bg-slate-100 border border-slate-200 text-slate-400'
                      }`}>
                        {getShortcutKeyForAction('dont_know')}
                      </kbd>
                    )}
                  </button>

                  {/* Mark as Confusion */}
                  <button
                    onClick={() => rateAndMaybeConfirm('confusion', true)}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border cursor-pointer ${
                      activeStatus === 'confusion'
                        ? 'bg-amber-500 border-amber-600 text-white shadow-md shadow-amber-500/10'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Confused</span>
                    {getShortcutKeyForAction('confusion') && (
                      <kbd className={`hidden md:inline-flex items-center justify-center h-4 px-1 text-[9px] font-mono rounded font-normal ml-1 ${
                        activeStatus === 'confusion'
                          ? 'bg-amber-600/50 border border-amber-400/40 text-amber-100'
                          : 'bg-slate-100 border border-slate-200 text-slate-400'
                      }`}>
                        {getShortcutKeyForAction('confusion')}
                      </kbd>
                    )}
                  </button>

                  {/* Mark as Know */}            {/* Mark as Know */}
                  <button
                    onClick={() => rateAndMaybeConfirm('know', true)}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border cursor-pointer ${
                      activeStatus === 'know'
                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/15'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Learned</span>
                    {getShortcutKeyForAction('know') && (
                      <kbd className={`hidden md:inline-flex items-center justify-center h-4 px-1 text-[9px] font-mono rounded font-normal ml-1 ${
                        activeStatus === 'know'
                          ? 'bg-emerald-600/50 border border-emerald-400/40 text-emerald-100'
                          : 'bg-slate-100 border border-slate-200 text-slate-400'
                      }`}>
                        {getShortcutKeyForAction('know')}
                      </kbd>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Bookmark Folders & Personal Mnemonics */}
          <div className="space-y-6">
            {/* Quick notes mnemonic card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-indigo-600" />
                    Personal Notes & Mnemonics
                  </h3>
                  {!isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 font-sans"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditingNote ? (
                  <div className="space-y-3">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write mnemonics or example sentences to easily remember this word..."
                      rows={4}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
                    ></textarea>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onUpdateNotes(currentActiveWord.id, noteText);
                          setIsEditingNote(false);
                        }}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition font-sans"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setNoteText(progress[currentActiveWord.id]?.notes ?? currentActiveWord.mnemonic ?? '');
                          setIsEditingNote(false);
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition font-sans"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-20 flex flex-col justify-center">
                    {noteText ? (
                      isFlipped ? (
                        <div className="space-y-1.5 animate-fadeIn">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-xs">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Mnemonic / Note:</span>
                          </div>
                          <p className="text-sm font-black text-emerald-800 bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200/90 leading-relaxed font-sans shadow-2xs">
                            "{noteText}"
                          </p>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setIsFlipped(true)}
                          className="p-4 bg-slate-50 hover:bg-emerald-50/50 border border-dashed border-slate-200 hover:border-emerald-300 rounded-xl text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center gap-1.5"
                          title="Click to flip flashcard"
                        >
                          <Eye className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                          <p className="text-xs font-black text-emerald-800 font-sans">
                            ফ্লাশকার্ড উল্টালে Mnemonic দেখতে পাবেন
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium font-sans">(Click card or press Spacebar to flip)</span>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-slate-400 font-sans text-center py-6">
                        No mnemonic notes or hints have been added yet. Click 'Edit' to write one.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status & Position tags replacing the old folder bookmark lists widget */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                Word Progress & Status
              </h3>

              <div className="flex flex-col gap-3 font-sans pt-1">
                {/* Tag 1: Group and Index position */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Word Position:</span>
                  <span className="px-3 py-1.5 bg-indigo-50 text-indigo-800 font-extrabold text-xs rounded-lg border border-indigo-100 shadow-3xs">
                    Group {currentActiveWord.group} • Word {currentIndex + 1} / {filteredWords.length}
                  </span>
                </div>

                {/* Tag 2: Active Tag/Status */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tag Status:</span>
                  <div className="flex items-center">
                    {activeStatus === 'know' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Learned
                      </span>
                    )}
                    {activeStatus === 'confusion' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Confused
                      </span>
                    )}
                    {activeStatus === 'dont_know' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" /> Not Learned
                      </span>
                    )}
                    {activeStatus === 'unrated' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        Unrated
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Legend */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-around gap-2 text-xs font-medium text-slate-600">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>= learned</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span>= not learned</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>= confused</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Rating Confirmation Modal */}
      {pendingRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setPendingRating(null)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Warning Icon */}
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center border border-amber-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-950 font-sans">Confirm Tag Change</h3>
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  You have already marked <span className="font-extrabold text-slate-800">"{pendingRating.wordName}"</span> as{' '}
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    pendingRating.oldStatus === 'know' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    pendingRating.oldStatus === 'confusion' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {getStatusLabel(pendingRating.oldStatus)}
                  </span>{' '}
                  .
                </p>
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  Are you sure you want to change its tag to{' '}
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    pendingRating.newStatus === 'know' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    pendingRating.newStatus === 'confusion' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    pendingRating.newStatus === 'dont_know' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    'bg-slate-50 text-slate-700 border border-slate-100'
                  }`}>
                    {getStatusLabel(pendingRating.newStatus)}
                  </span>{' '}
                  ?
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 w-full pt-2">
                <button
                  onClick={() => {
                    onRateWord(pendingRating.wordId, pendingRating.newStatus);
                    if (pendingRating.autoAdvance) {
                      handleNext();
                    }
                    setPendingRating(null);
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition font-sans cursor-pointer shadow-xs"
                >
                  Yes, Change
                </button>
                <button
                  onClick={() => setPendingRating(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition font-sans cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Word Issue Report Modal */}
      {reportingWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => !isSubmittingReport && setReportingWord(null)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center border border-rose-100">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-sans">Report Error</h3>
                  <p className="text-xs text-slate-500 font-sans">
                    Word: <span className="font-extrabold text-slate-800">{reportingWord.word}</span> (Group: {reportingWord.group})
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
                  {/* Issue Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 font-sans">Issue Type:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReportType('wrong_meaning')}
                        className={`py-2 px-3 text-left rounded-xl text-xs font-semibold border transition font-sans cursor-pointer ${
                          reportType === 'wrong_meaning' 
                            ? 'bg-rose-50 border-rose-200 text-rose-700' 
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650'
                        }`}
                      >
                        Incorrect Meaning
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('wrong_synonym')}
                        className={`py-2 px-3 text-left rounded-xl text-xs font-semibold border transition font-sans cursor-pointer ${
                          reportType === 'wrong_synonym' 
                            ? 'bg-rose-50 border-rose-200 text-rose-700' 
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650'
                        }`}
                      >
                        Incorrect Synonyms
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('wrong_example')}
                        className={`py-2 px-3 text-left rounded-xl text-xs font-semibold border transition font-sans cursor-pointer ${
                          reportType === 'wrong_example' 
                            ? 'bg-rose-50 border-rose-200 text-rose-700' 
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650'
                        }`}
                      >
                        Incorrect Example
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportType('other')}
                        className={`py-2 px-3 text-left rounded-xl text-xs font-semibold border transition font-sans cursor-pointer ${
                          reportType === 'other' 
                            ? 'bg-rose-50 border-rose-200 text-rose-700' 
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650'
                        }`}
                      >
                        Other Issues
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 font-sans">Provide correct info or description:</label>
                    <textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      rows={3}
                      placeholder="Write the correct info here (e.g., correct meaning, spelling, or example sentence)..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-sans leading-relaxed resize-none"
                    />
                  </div>

                  {/* Action buttons */}
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
