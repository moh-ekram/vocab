import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, CustomFolder, AppSettings } from '../types';
import sentencesDataRaw from '../data/sentences.json';
const sentencesData = sentencesDataRaw as Record<string, string[]>;

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
  RotateCcw,
  Quote,
  Loader2
} from 'lucide-react';

interface FlashcardViewerProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  initialGroup?: number | null;
  settings?: AppSettings;
}

export default function FlashcardViewer({
  words,
  progress,
  folders,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  initialGroup = null,
  settings
}: FlashcardViewerProps) {
  // Filter States
  const maxGroupNum = words.length > 0 ? Math.max(...words.map(w => w.group)) : 37;

  const [selectedGroups, setSelectedGroups] = useState<number[]>(() => {
    if (initialGroup) {
      return [initialGroup];
    }
    return Array.from({ length: maxGroupNum }, (_, i) => i + 1);
  });

  useEffect(() => {
    if (initialGroup) {
      setSelectedGroups([initialGroup]);
    } else {
      setSelectedGroups(Array.from({ length: maxGroupNum }, (_, i) => i + 1));
    }
  }, [words, initialGroup, maxGroupNum]);

  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    return settings?.defaultFlashcardTags || ['know', 'confusion', 'dont_know', 'unrated'];
  });
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  
  // Study Order Mode: 'serial' (সিরিয়াল), 'alphabetical' (A-Z), 'random' (র্যান্ডম)
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
      case 'know': return 'পারি (সবুজ)';
      case 'confusion': return 'কনফিউশন (হলুদ)';
      case 'dont_know': return 'পারি না (লাল)';
      case 'unrated': return 'পড়া হয়নি (ধূসর)';
      default: return 'পড়া হয়নি';
    }
  };

  // Phase 1: Filter words by selected groups, tag status, and custom bookmark folder
  useEffect(() => {
    let result = [...words];

    // Filter by multiple selected groups
    if (selectedGroups.length < maxGroupNum) {
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
      setNoteText(progress[currentActiveWord.id]?.notes || '');
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
          const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(currentActiveWord.word)}+meaning`;
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
    if (settings?.autoPlayAudio && currentActiveWord.word) {
      const timer = setTimeout(() => {
        speakWord();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentActiveWord.id, settings?.autoPlayAudio]);

  // Select a random animation if "shuffle" is configured
  useEffect(() => {
    if (settings?.flashcardAnimation === 'shuffle') {
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

  const animationType = settings?.flashcardAnimation === 'shuffle' ? currentRandomAnim : (settings?.flashcardAnimation || 'flip-h');

  // Determine stage & face class names based on animation type
  let outerWrapperClass = '';
  let frontFaceClass = '';
  let backFaceClass = '';

  if (animationType === 'flip-h') {
    outerWrapperClass = `w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`;
    frontFaceClass = 'absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col justify-between backface-hidden shadow-sm hover:shadow-md transition-all duration-300';
    backFaceClass = 'absolute inset-0 bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-md transform rotate-y-180 backface-hidden flex flex-col justify-between';
  } else if (animationType === 'flip-v') {
    outerWrapperClass = `w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-x-180' : ''}`;
    frontFaceClass = 'absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col justify-between backface-hidden shadow-sm hover:shadow-md transition-all duration-300';
    backFaceClass = 'absolute inset-0 bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-md transform rotate-x-180 backface-hidden flex flex-col justify-between';
  } else if (animationType === 'slide') {
    outerWrapperClass = 'w-full h-full relative';
    frontFaceClass = `absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-500 ease-in-out ${
      isFlipped ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
    }`;
    backFaceClass = `absolute inset-0 bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-md flex flex-col justify-between transition-all duration-500 ease-in-out ${
      isFlipped ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
    }`;
  } else if (animationType === 'fade') {
    outerWrapperClass = 'w-full h-full relative';
    frontFaceClass = `absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-opacity duration-300 ease-in-out ${
      isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`;
    backFaceClass = `absolute inset-0 bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-md flex flex-col justify-between transition-opacity duration-300 ease-in-out ${
      isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`;
  } else if (animationType === 'zoom') {
    outerWrapperClass = 'w-full h-full relative';
    frontFaceClass = `absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 ease-in-out ${
      isFlipped ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
    }`;
    backFaceClass = `absolute inset-0 bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-md flex flex-col justify-between transition-all duration-300 ease-in-out ${
      isFlipped ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
    }`;
  }

  return (
    <div className="space-y-6" id="flashcard-viewer-container">
      {/* Top Filter and Customization Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-wrap gap-4 items-center justify-between" id="flashcard-filters">
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Select Group (Multi-select) */}
          <div className="space-y-1 relative" id="group-multi-selector">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">ভোকাবুলারি গ্রুপ</label>
            <button
              type="button"
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 flex items-center justify-between gap-2 min-w-[180px] cursor-pointer text-left"
            >
              <span className="truncate max-w-[160px]">
                {selectedGroups.length === maxGroupNum 
                  ? `সকল গ্রুপ (১-${maxGroupNum})` 
                  : selectedGroups.length === 0 
                  ? 'কোনো গ্রুপ নেই' 
                  : `${selectedGroups.length} টি গ্রুপ নির্বাচিত`}
              </span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {isGroupDropdownOpen && (
              <>
                {/* Click outside overlay */}
                <div className="fixed inset-0 z-10" onClick={() => setIsGroupDropdownOpen(false)} />
                
                {/* Dropdown panel */}
                <div className="absolute left-0 mt-2 w-72 md:w-80 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 z-20 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-600">গ্রুপ ফিল্টার ({selectedGroups.length} টি)</span>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedGroups(Array.from({ length: maxGroupNum }, (_, i) => i + 1))}
                        className="text-indigo-600 hover:text-indigo-700 font-extrabold cursor-pointer hover:underline"
                      >
                        সব সিলেক্ট
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroups([])}
                        className="text-rose-600 hover:text-rose-700 font-extrabold cursor-pointer hover:underline"
                      >
                        সব মুছুন
                      </button>
                    </div>
                  </div>

                  {/* Grid of Groups */}
                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: maxGroupNum }, (_, i) => {
                      const gNum = i + 1;
                      const isSelected = selectedGroups.includes(gNum);
                      return (
                        <button
                          key={gNum}
                          type="button"
                          onClick={() => {
                            setSelectedGroups(prev => 
                              prev.includes(gNum)
                                ? prev.filter(x => x !== gNum)
                                : [...prev, gNum]
                            );
                          }}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                          }`}
                        >
                          {gNum}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsGroupDropdownOpen(false)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      ঠিক আছে
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Select Status (Multi-select) */}
          <div className="space-y-1 relative" id="status-multi-selector">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">ট্যাগ ফিল্টার</label>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 flex items-center justify-between gap-2 min-w-[180px] cursor-pointer text-left"
            >
              <span className="truncate max-w-[160px]">
                {selectedStatuses.length === 4 
                  ? 'সকল ট্যাগ' 
                  : selectedStatuses.length === 0 
                  ? 'কোনো ট্যাগ নেই' 
                  : selectedStatuses.map(s => {
                      if (s === 'know') return 'পারি';
                      if (s === 'dont_know') return 'পারি না';
                      if (s === 'confusion') return 'কনফিউশন';
                      return 'পড়া হয়নি';
                    }).join(', ')}
              </span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {isStatusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)} />
                <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 z-20 space-y-2.5 font-sans animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-600 font-sans">ট্যাগ ফিল্টার</span>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses(['know', 'dont_know', 'confusion', 'unrated'])}
                        className="text-indigo-600 hover:text-indigo-700 font-extrabold cursor-pointer hover:underline"
                      >
                        সব সিলেক্ট
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses([])}
                        className="text-rose-600 hover:text-rose-700 font-extrabold cursor-pointer hover:underline"
                      >
                        সব মুছুন
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { key: 'know', label: 'পারি (সবুজ)', color: 'bg-emerald-500' },
                      { key: 'confusion', label: 'কনফিউশন (হলুদ)', color: 'bg-amber-500' },
                      { key: 'dont_know', label: 'পারি না (লাল)', color: 'bg-rose-500' },
                      { key: 'unrated', label: 'পড়া হয়নি (ধূসর)', color: 'bg-slate-400' }
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
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
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
                      className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                    >
                      ঠিক আছে
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Custom Bookmarks Select */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">বুকমার্ক লিস্ট</label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 cursor-pointer"
            >
              <option value="all">সকল লিস্ট</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Study Order Control */}
          <div className="space-y-1 font-sans">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">পড়ার ক্রম (Study Order)</label>
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setStudyOrder('serial')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  studyOrder === 'serial'
                    ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                সিরিয়াল
              </button>
              <button
                type="button"
                onClick={() => setStudyOrder('alphabetical')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  studyOrder === 'alphabetical'
                    ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                A-Z
              </button>
              <button
                type="button"
                onClick={() => setStudyOrder('random')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  studyOrder === 'random'
                    ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                র্যান্ডম
              </button>
            </div>
            {studyOrder === 'random' && (
              <button
                type="button"
                onClick={() => setShuffleKey(prev => prev + 1)}
                className="text-[10px] text-indigo-600 hover:text-indigo-700 font-extrabold flex items-center gap-0.5 cursor-pointer transition hover:underline mt-0.5 ml-1 absolute"
                title="নতুন করে শাফেল করুন"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>পুনরায় শাফেল করুন</span>
              </button>
            )}
          </div>
        </div>

        {/* Hotkeys helper button */}
        <button
          onClick={() => setShowHotkeysHelp(prev => !prev)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-semibold transition ${
            showHotkeysHelp ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-250'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span className="font-sans">কীবোর্ড শর্টকাট</span>
        </button>
      </div>

      {/* Hotkeys Help Tooltip Box */}
      {showHotkeysHelp && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-inner animate-fadeIn">
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">Space</kbd> বা ক্লিক</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">কার্ড উল্টানো / Flip</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">➡</kbd> ডান অ্যারো</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">"পারি" চিহ্নিত করে পরবর্তী</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">⬅</kbd> বাম অ্যারো</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">"পারি না" চিহ্নিত করে পরবর্তী</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">⬆</kbd> / <kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">Enter</kbd></p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">কনফিউশন চিহ্নিত করা / উচ্চারণ শোনা</p>
          </div>
        </div>
      )}

      {/* Empty State Guard */}
      {filteredWords.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4" id="flashcard-empty-state">
          <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center">
            <Info className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-800">কোনো শব্দ মেলেনি!</h3>
            <p className="text-sm text-gray-500 font-sans">
              আপনার নির্বাচিত ফিল্টার বা ক্যাটাগরিতে কোনো শব্দ খুঁজে পাওয়া যায়নি। অনুগ্রহ করে ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedGroups(Array.from({ length: 37 }, (_, i) => i + 1));
              setSelectedStatuses(['dont_know']);
              setSelectedFolder('all');
            }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm font-sans"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="flashcard-interactive-grid">
          {/* Main Flashcard Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* The Flash Card Container with Flip Animation */}
            <div
              onClick={() => setIsFlipped(prev => !prev)}
              className="group cursor-pointer perspective h-[28rem] relative w-full"
              id="vocabulary-card-stage"
            >
              <div className={outerWrapperClass}>
                {/* FRONT FACE (Word) */}
                <div className={frontFaceClass}>
                  {/* Spacer to keep layout centered */}
                  <div className="h-8"></div>

                  {/* Main display word */}
                  <div className="text-center space-y-3">
                    <h1 className={`text-6xl md:text-7xl lg:text-8xl font-black tracking-tight select-none py-1 ${frontWordColorClass}`}>
                      {currentActiveWord.word}
                    </h1>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord();
                        }}
                        className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition shadow-xs animate-pulse"
                        title="উচ্চারণ শুনুন"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(currentActiveWord.word)}+meaning`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-xl transition shadow-xs flex items-center justify-center"
                        title="গুগলে সার্চ করুন"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                        </svg>
                      </a>
                    </div>
                    {currentActiveWord.extraWord && (
                      <div className="text-sm sm:text-base font-extrabold text-[#009966] font-[Verdana] select-none tracking-wide flex items-center justify-center gap-1.5 pt-1">
                        <span>{currentActiveWord.extraWord}</span>
                        <span className="text-[#009966] font-black">:</span>
                        <span className="font-bold text-[#009966]">{currentActiveWord.extraMeaning}</span>
                      </div>
                    )}
                  </div>

                  {/* Hints at footer */}
                  <div className="flex justify-end items-center text-xs text-slate-400 font-sans border-t border-slate-100 pt-4">
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                      ID: {currentActiveWord.id}
                    </span>
                  </div>
                </div>

                {/* BACK FACE (Meaning & Synonyms) */}
                <div className={backFaceClass}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider font-sans">গ্রুপ {currentActiveWord.group} • উত্তর</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xl font-black ${backWordColorClass}`}>{currentActiveWord.word}</span>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(currentActiveWord.word)}+meaning`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-lg transition"
                          title="গুগলে সার্চ করুন"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                          </svg>
                        </a>
                      </div>
                    </div>

                    {/* Bengali Meaning */}
                    <div className="text-center py-0.5">
                      <p className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-emerald-600 leading-normal">{currentActiveWord.meaning}</p>
                    </div>

                    {/* Synonyms */}
                    <div className="space-y-0 text-center py-1.5 border-t border-slate-100/30">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Synonyms</p>
                      <p className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-indigo-950 tracking-tight leading-normal">{currentActiveWord.synonyms || 'N/A'}</p>
                    </div>

                    {/* Example Sentences */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-left max-w-xl mx-auto">
                      {currentActiveWord.example || (sentencesData[currentActiveWord.id] && sentencesData[currentActiveWord.id].length > 0) ? (
                        <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                          {currentActiveWord.example ? (
                            <div className="flex items-start gap-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                              <span className="text-indigo-500 mt-1 flex-shrink-0 text-sm leading-none">•</span>
                              <p className="flex-1">
                                {renderSentence(currentActiveWord.example)}
                              </p>
                            </div>
                          ) : (
                            sentencesData[currentActiveWord.id].slice(0, 2).map((sent, index) => (
                              <div key={index} className="flex items-start gap-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                                <span className="text-indigo-500 mt-1 flex-shrink-0 text-sm leading-none">•</span>
                                <p className="flex-1">
                                  {renderSentence(sent)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-450 italic font-sans pl-3">কোনো উদাহরণ পাওয়া যায়নি।</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rating Controllers & Navigation */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4" id="card-controls">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                {/* Navigation arrows */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrev}
                    className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold text-slate-500 font-sans select-none">
                    {currentIndex + 1} / {filteredWords.length}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Tag Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Mark as Don't Know */}
                  <button
                    onClick={() => rateAndMaybeConfirm('dont_know', true)}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border cursor-pointer ${
                      activeStatus === 'dont_know'
                        ? 'bg-red-500 border-red-600 text-white shadow-md shadow-red-500/10'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>পারি না</span>
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
                    <span>কনফিউশন</span>
                  </button>

                  {/* Mark as Know */}
                  <button
                    onClick={() => rateAndMaybeConfirm('know', true)}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border cursor-pointer ${
                      activeStatus === 'know'
                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/15'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>পারি</span>
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
                    ব্যক্তিগত নোট ও নেমোনিক
                  </h3>
                  {!isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 font-sans"
                    >
                      সম্পাদনা
                    </button>
                  )}
                </div>

                {isEditingNote ? (
                  <div className="space-y-3">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="শব্দটি সহজে মনে রাখার সূত্র বা কোনো উদাহরণ বাক্য এখানে লিখুন..."
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
                        সেভ করুন
                      </button>
                      <button
                        onClick={() => {
                          setNoteText(progress[currentActiveWord.id]?.notes || '');
                          setIsEditingNote(false);
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition font-sans"
                      >
                        বাতিল
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-20 flex flex-col justify-center">
                    {noteText ? (
                      <p className="text-sm text-slate-600 font-sans italic bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-200 leading-relaxed">
                        "{noteText}"
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 font-sans text-center py-6">
                        কোনো স্মৃতিসহায়ক নোট বা নেমোনিক যুক্ত করা নেই। ডানে 'সম্পাদনা' বাটনে ক্লিক করে লিখে রাখুন!
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
                শব্দের অগ্রগতি ও স্থিতি
              </h3>

              <div className="flex flex-col gap-3 font-sans pt-1">
                {/* Tag 1: Group and Index position */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">শব্দের অবস্থান:</span>
                  <span className="px-3 py-1.5 bg-indigo-50 text-indigo-800 font-extrabold text-xs rounded-lg border border-indigo-100 shadow-3xs">
                    গ্রুপ {currentActiveWord.group} • শব্দ {currentIndex + 1} / {filteredWords.length}
                  </span>
                </div>

                {/* Tag 2: Active Tag/Status */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ট্যাগ স্থিতি:</span>
                  <div className="flex items-center">
                    {activeStatus === 'know' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> পারি
                      </span>
                    )}
                    {activeStatus === 'confusion' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> কনফিউশন
                      </span>
                    )}
                    {activeStatus === 'dont_know' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" /> পারি না
                      </span>
                    )}
                    {activeStatus === 'unrated' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
                        পড়া হয়নি
                      </span>
                    )}
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
                <h3 className="text-lg font-bold text-slate-950 font-sans">ট্যাগ পরিবর্তন নিশ্চিতকরণ</h3>
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  আপনি ইতিমধ্যে <span className="font-extrabold text-slate-800">"{pendingRating.wordName}"</span> শব্দটিকে{' '}
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    pendingRating.oldStatus === 'know' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    pendingRating.oldStatus === 'confusion' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {getStatusLabel(pendingRating.oldStatus)}
                  </span>{' '}
                  হিসেবে চিহ্নিত করেছেন।
                </p>
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  আপনি কি নিশ্চিত যে এর ট্যাগ পরিবর্তন করে{' '}
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    pendingRating.newStatus === 'know' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    pendingRating.newStatus === 'confusion' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    pendingRating.newStatus === 'dont_know' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    'bg-slate-50 text-slate-700 border border-slate-100'
                  }`}>
                    {getStatusLabel(pendingRating.newStatus)}
                  </span>{' '}
                  করতে চান?
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
                  হ্যাঁ, পরিবর্তন করুন
                </button>
                <button
                  onClick={() => setPendingRating(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition font-sans cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
