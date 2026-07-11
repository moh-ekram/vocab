import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, CustomFolder, AppSettings } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Award, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  ArrowRight, 
  Volume2, 
  BookOpen, 
  HelpCircle as HelpIcon, 
  Info,
  Check,
  RotateCcw,
  AlertTriangle,
  Keyboard,
  Compass,
  Zap,
  Bookmark,
  Tag
} from 'lucide-react';

interface SynonymCheckProps {
  words: VocabularyWord[];
  synonymProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateSynonymProgress: (wordId: string, correct: boolean) => void;
  activeGroup: number | null;
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  settings?: AppSettings;
}

export default function SynonymCheck({ 
  words, 
  synonymProgress, 
  onUpdateSynonymProgress, 
  activeGroup,
  progress,
  folders,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  settings
}: SynonymCheckProps) {
  
  // Filter States (Same as FlashcardViewer)
  const [selectedGroups, setSelectedGroups] = useState<number[]>(() => {
    if (activeGroup) return [activeGroup];
    return Array.from({ length: 37 }, (_, i) => i + 1);
  });
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    // Default to show incorrect and unrated synonyms to help users practice
    return ['dont_know', 'unrated'];
  });
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  
  const [studyOrder, setStudyOrder] = useState<'serial' | 'alphabetical' | 'random'>(() => {
    return settings?.defaultFlashcardOrder || 'random';
  });
  const [shuffleKey, setShuffleKey] = useState(0);

  // Active word index tracking
  const [baseFilteredWords, setBaseFilteredWords] = useState<VocabularyWord[]>([]);
  const [filteredWords, setFilteredWords] = useState<VocabularyWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Challenge game status for the active word
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showHotkeysHelp, setShowHotkeysHelp] = useState(false);

  // Voice/Speech helper
  const speakWord = (wordText: string) => {
    if (!wordText) return;
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Parse synonyms list
  const getSynonymsList = (word: VocabularyWord): string[] => {
    if (!word.synonyms) return [];
    return word.synonyms.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Generate unique synonyms pool from the entire vocab
  const getAllSynonymsPool = (): string[] => {
    const list: string[] = [];
    words.forEach(w => {
      getSynonymsList(w).forEach(s => {
        if (s && !list.includes(s)) {
          list.push(s);
        }
      });
    });
    return list;
  };

  // Phase 1: Filter words by selected groups, tag status, and custom bookmark folder
  useEffect(() => {
    let result = [...words];

    // Filter by multiple selected groups
    if (selectedGroups.length < 37) {
      result = result.filter(w => selectedGroups.includes(w.group));
    }

    // Filter by synonym progress status
    if (selectedStatuses.length < 3) {
      result = result.filter(w => {
        const hasProg = synonymProgress[w.id];
        const status = hasProg ? (hasProg.correct ? 'know' : 'dont_know') : 'unrated';
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

    // Filter words that actually have synonyms (should be all or almost all)
    result = result.filter(w => getSynonymsList(w).length >= 2);

    setBaseFilteredWords(result);
  }, [selectedGroups, selectedStatuses, selectedFolder, words, synonymProgress, progress]);

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
      // 'serial' -> sorted naturally by vocabulary list sequence
    }

    setFilteredWords(result);

    // Find first word that is not marked as correct/know
    const firstNonPariIndex = result.findIndex(w => {
      const hasProg = synonymProgress[w.id];
      return !hasProg || !hasProg.correct;
    });

    setCurrentIndex(firstNonPariIndex !== -1 ? firstNonPariIndex : 0);
    setIsSubmitted(false);
    setSelectedAnswers([]);
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

  // Generate options (2 correct synonyms + 3 distractors) whenever active word shifts
  useEffect(() => {
    if (!currentActiveWord || !currentActiveWord.id) return;

    const correct = getSynonymsList(currentActiveWord);
    setCorrectAnswers(correct);
    setSelectedAnswers([]);
    setIsSubmitted(false);

    // Generate options pool
    const allSynonyms = getAllSynonymsPool();
    const lowercaseCorrect = correct.map(c => c.toLowerCase());
    const possibleDistractors = allSynonyms.filter(syn => 
      !lowercaseCorrect.includes(syn.toLowerCase()) && 
      syn.toLowerCase() !== currentActiveWord.word.toLowerCase()
    );

    // Pick 3 random unique distractors
    const shuffledDistractors = [...possibleDistractors].sort(() => Math.random() - 0.5);
    const distractors = shuffledDistractors.slice(0, 3);

    // Combine and shuffle options
    const options = [...correct, ...distractors].sort(() => Math.random() - 0.5);
    setCurrentOptions(options);
  }, [currentActiveWord?.id]);

  // Autoplay voice pronunciation if enabled
  useEffect(() => {
    if (settings?.autoPlayAudio && currentActiveWord?.word) {
      const timer = setTimeout(() => {
        speakWord(currentActiveWord.word);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentActiveWord?.id, settings?.autoPlayAudio]);

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

      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '1') {
        if (!isSubmitted && currentOptions[0]) handleOptionClick(currentOptions[0]);
      } else if (e.key === '2') {
        if (!isSubmitted && currentOptions[1]) handleOptionClick(currentOptions[1]);
      } else if (e.key === '3') {
        if (!isSubmitted && currentOptions[2]) handleOptionClick(currentOptions[2]);
      } else if (e.key === '4') {
        if (!isSubmitted && currentOptions[3]) handleOptionClick(currentOptions[3]);
      } else if (e.key === '5') {
        if (!isSubmitted && currentOptions[4]) handleOptionClick(currentOptions[4]);
      } else if (e.key === 'Enter') {
        if (!isSubmitted) {
          if (selectedAnswers.length === 2) {
            submitAnswer();
          }
        } else {
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredWords.length, selectedAnswers, isSubmitted, currentOptions]);

  // Option selection handler
  const handleOptionClick = (option: string) => {
    if (isSubmitted) return;
    
    setSelectedAnswers(prev => {
      if (prev.includes(option)) {
        return prev.filter(x => x !== option);
      }
      if (prev.length < 2) {
        return [...prev, option];
      }
      // Max 2 selections allowed
      return prev;
    });
  };

  // Submit and verify option answers
  const submitAnswer = () => {
    if (isSubmitted || selectedAnswers.length !== 2) return;

    const correctLower = correctAnswers.map(c => c.toLowerCase());
    const isCorrect = selectedAnswers.every(ans => correctLower.includes(ans.toLowerCase()));

    onUpdateSynonymProgress(currentActiveWord.id, isCorrect);
    setIsSubmitted(true);
    speakWord(currentActiveWord.word);
  };

  // Group wise progress stats calculation
  const getGroupStats = (groupNum: number) => {
    const groupWords = words.filter(w => w.group === groupNum && getSynonymsList(w).length >= 2);
    const total = groupWords.length;
    let completed = 0;

    groupWords.forEach(w => {
      if (synonymProgress[w.id]?.correct) {
        completed++;
      }
    });

    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  // Overall accuracy and stats
  const getOverallStats = () => {
    const allWordsWithSyns = words.filter(w => getSynonymsList(w).length >= 2);
    const total = allWordsWithSyns.length;
    let completed = 0;

    allWordsWithSyns.forEach(w => {
      if (synonymProgress[w.id]?.correct) {
        completed++;
      }
    });

    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  // Bengali number converter helper
  const toBengaliNumber = (num: number) => {
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, d => bnNums[parseInt(d)]);
  };

  const overallStats = getOverallStats();
  const activeStatus = synonymProgress[currentActiveWord.id];

  return (
    <div className="space-y-6" id="synonym-check-container">
      {/* Top Filter and Customization Bar (Identical to FlashcardViewer) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-wrap gap-4 items-center justify-between" id="synonym-filters">
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Select Group (Multi-select) */}
          <div className="space-y-1 relative" id="synonym-group-multi-selector">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">ভোকাবুলারি গ্রুপ</label>
            <button
              type="button"
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 flex items-center justify-between gap-2 min-w-[180px] cursor-pointer text-left"
            >
              <span className="truncate max-w-[160px]">
                {selectedGroups.length === 37 
                  ? 'সকল গ্রুপ (১-৩৭)' 
                  : selectedGroups.length === 0 
                  ? 'কোনো গ্রুপ নেই' 
                  : `${selectedGroups.length} টি গ্রুপ নির্বাচিত`}
              </span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {isGroupDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsGroupDropdownOpen(false)} />
                <div className="absolute left-0 mt-2 w-72 md:w-80 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 z-20 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-600">গ্রুপ ফিল্টার ({selectedGroups.length} টি)</span>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedGroups(Array.from({ length: 37 }, (_, i) => i + 1))}
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

                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: 37 }, (_, i) => {
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

          {/* Select Status / Synonym Check tag (Multi-select) */}
          <div className="space-y-1 relative" id="synonym-status-multi-selector">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">সিনোনিম ট্যাগ ফিল্টার</label>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700 flex items-center justify-between gap-2 min-w-[180px] cursor-pointer text-left"
            >
              <span className="truncate max-w-[160px]">
                {selectedStatuses.length === 3 
                  ? 'সকল ট্যাগ' 
                  : selectedStatuses.length === 0 
                  ? 'কোনো ট্যাগ নেই' 
                  : selectedStatuses.map(s => {
                      if (s === 'know') return 'সঠিক';
                      if (s === 'dont_know') return 'ভুল';
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
                        onClick={() => setSelectedStatuses(['know', 'dont_know', 'unrated'])}
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
                      { key: 'know', label: 'সঠিক (সবুজ)', color: 'bg-emerald-500' },
                      { key: 'dont_know', label: 'ভুল (লাল)', color: 'bg-rose-500' },
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
          <div className="space-y-1" id="synonym-folder-selector">
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
          <div className="space-y-1 font-sans" id="synonym-study-order">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">পড়ার ক্রম (Study Order)</label>
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 items-center gap-1">
              {['serial', 'alphabetical', 'random'].map((order) => (
                <button
                  key={order}
                  type="button"
                  onClick={() => setStudyOrder(order as any)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    studyOrder === order
                      ? 'bg-white text-indigo-700 shadow-xs border-slate-100'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {order === 'serial' ? 'সিরিয়াল' : order === 'alphabetical' ? 'A-Z' : 'র্যান্ডম'}
                </button>
              ))}
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
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">1-5</kbd> নম্বর কী</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">১ম থেকে ৫offset অপশন সিলেক্ট</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">Enter</kbd> এন্টার কী</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">উত্তর যাচাই / পরবর্তী শব্দ</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">➡</kbd> ডান অ্যারো</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">পরবর্তী শব্দে যান</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1.5 font-sans"><kbd className="bg-white px-2 py-0.5 border rounded-md font-mono text-xs">⬅</kbd> বাম অ্যারো</p>
            <p className="text-xs text-amber-800 font-sans mt-0.5">পূর্ববর্তী শব্দে ফিরুন</p>
          </div>
        </div>
      )}

      {/* Empty State Guard */}
      {filteredWords.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4" id="synonym-empty-state">
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
              setSelectedStatuses(['dont_know', 'unrated']);
              setSelectedFolder('all');
            }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm font-sans"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="synonym-interactive-grid">
          
          {/* Left Columns: Main Challenge Card & Option Selector */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* The Synonym Flash Card */}
            <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 md:p-8 space-y-6 shadow-xs relative" id="synonym-word-card">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-800 font-extrabold text-xs rounded-lg font-sans">
                  গ্রুপ {currentActiveWord.group} • শব্দ {currentIndex + 1} / {filteredWords.length}
                </span>

                {/* Active Tag indicator */}
                <div className="flex items-center gap-2">
                  {activeStatus?.correct === true && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5" /> সঠিক
                    </span>
                  )}
                  {activeStatus?.correct === false && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full font-sans">
                      <XCircle className="w-3.5 h-3.5" /> ভুল
                    </span>
                  )}
                  {!activeStatus && (
                    <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full font-sans">
                      পড়া হয়নি
                    </span>
                  )}
                </div>
              </div>

              {/* Word Display */}
              <div className="text-center space-y-4 py-4">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-indigo-950 tracking-tight py-1 select-none">
                  {currentActiveWord.word}
                </h1>
                
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => speakWord(currentActiveWord.word)}
                    className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition shadow-xs cursor-pointer"
                    title="উচ্চারণ শুনুন"
                  >
                    <Volume2 className="w-5.5 h-5.5" />
                  </button>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(currentActiveWord.word)}+meaning`}
                    target="_blank"
                    rel="noopener noreferrer"
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

                {/* Extra words */}
                {currentActiveWord.extraWord && (
                  <p className="text-xs sm:text-sm font-extrabold text-amber-800 font-sans select-none tracking-wide flex items-center justify-center gap-1.5 pt-1">
                    <span>{currentActiveWord.extraWord}</span>
                    <span className="text-amber-500 font-black">:</span>
                    <span className="font-bold text-amber-700">{currentActiveWord.extraMeaning}</span>
                  </p>
                )}
              </div>

              {/* Submit answer or verified feedback details */}
              {!isSubmitted ? (
                <div className="text-center border-t border-slate-50 pt-4">
                  <p className="text-xs font-black text-indigo-600 bg-indigo-50/50 px-3.5 py-2.5 rounded-2xl border border-indigo-100/30 inline-block">
                    নিচের ৫টি অপশন থেকে এই শব্দটির সঠিক ২টি সমার্থক শব্দ (Synonyms) সিলেক্ট করে সাবমিট করুন
                  </p>
                </div>
              ) : (
                <div className="space-y-4 border-t border-slate-100 pt-5 animate-fadeIn">
                  
                  {/* Correct Answers & Meaning Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/40 space-y-1 text-center md:text-left">
                      <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">শব্দের বাংলা অর্থ</span>
                      <p className="text-xl md:text-2xl font-black text-emerald-700 leading-normal">{currentActiveWord.meaning}</p>
                    </div>

                    <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/40 space-y-1 text-center md:text-left">
                      <span className="text-[10px] text-indigo-500 font-black uppercase tracking-wider">সঠিক সিনোনিমসমূহ (Synonyms)</span>
                      <p className="text-xl md:text-2xl font-black text-indigo-950 tracking-tight leading-normal">
                        {correctAnswers.join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Feedback Box */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    selectedAnswers.every(ans => correctAnswers.map(c => c.toLowerCase()).includes(ans.toLowerCase()))
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-950 font-medium"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-950 font-medium"
                  }`}>
                    {selectedAnswers.every(ans => correctAnswers.map(c => c.toLowerCase()).includes(ans.toLowerCase())) ? (
                      <>
                        <CheckCircle2 className="w-5.5 h-5.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-black text-emerald-900">দারুণ হয়েছে! আপনার নির্বাচন সঠিক হয়েছে।</h4>
                          <p className="text-xs text-emerald-600 font-bold mt-0.5">
                            সমার্থক শব্দগুলো সাফল্যের সাথে শিখেছেন। প্রগ্রেস স্কোর যুক্ত হয়েছে।
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5.5 h-5.5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-black text-rose-900">উফ! দুঃখিত, উত্তরটি সঠিক হয়নি।</h4>
                          <p className="text-xs text-rose-600 font-bold mt-0.5 font-sans">
                            আপনার উত্তর ছিল: <span className="font-extrabold">{selectedAnswers.join(', ')}</span>। পুনরায় মনোযোগ দিয়ে পড়ুন।
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Synonym Options Grid Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 max-w-3xl mx-auto" id="synonym-options-container">
              {currentOptions.map((option, index) => {
                const isSelected = selectedAnswers.includes(option);
                const isCorrectOption = correctAnswers.includes(option);
                
                let optionStyle = "border-slate-200 bg-white hover:bg-slate-50/50 text-slate-700 shadow-sm";
                let indexStyle = "border-slate-300 bg-slate-50 text-slate-500";

                if (isSelected && !isSubmitted) {
                  optionStyle = "border-indigo-500 bg-indigo-50/30 text-indigo-950 shadow-md ring-2 ring-indigo-500/30";
                  indexStyle = "border-indigo-600 bg-indigo-600 text-white font-black";
                }

                if (isSubmitted) {
                  if (isCorrectOption) {
                    optionStyle = "border-emerald-500 bg-emerald-50 text-emerald-950 font-black shadow-emerald-500/10";
                    indexStyle = "border-emerald-600 bg-emerald-600 text-white";
                  } else if (isSelected && !isCorrectOption) {
                    optionStyle = "border-rose-400 bg-rose-50 text-rose-950 font-bold shadow-rose-400/10";
                    indexStyle = "border-rose-600 bg-rose-600 text-white";
                  } else {
                    optionStyle = "border-slate-100 bg-slate-50/30 text-slate-400 opacity-50";
                    indexStyle = "border-slate-200 bg-slate-50 text-slate-300";
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    disabled={isSubmitted}
                    className={`p-4 rounded-2xl border text-sm font-extrabold flex flex-col justify-between items-center text-center transition-all duration-200 cursor-pointer h-28 ${optionStyle}`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold ${indexStyle}`}>
                      {isSubmitted && isCorrectOption ? (
                        <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                      ) : isSubmitted && isSelected ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : isSelected ? (
                        "✓"
                      ) : (
                        toBengaliNumber(index + 1)
                      )}
                    </div>
                    
                    <span className="font-sans text-base tracking-wide select-none truncate max-w-full pb-1">{option}</span>
                    
                    {isSubmitted && isCorrectOption ? (
                      <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                        সিনোনিম
                      </span>
                    ) : (
                      <span className="h-3" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Verify Button & Next/Prev Navigation */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4" id="synonym-navigation-controls">
              
              {/* Previous / Next word indicators */}
              <div className="flex items-center gap-3 select-none">
                <button
                  onClick={handlePrev}
                  className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition cursor-pointer"
                  title="পূর্ববর্তী শব্দ"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold text-slate-500 font-sans">
                  {currentIndex + 1} / {filteredWords.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition cursor-pointer"
                  title="পরবর্তী শব্দ"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Action Trigger Buttons */}
              <div className="w-full sm:w-auto flex justify-end">
                {!isSubmitted ? (
                  <button
                    onClick={submitAnswer}
                    disabled={selectedAnswers.length !== 2}
                    className={`w-full sm:w-auto px-8 py-3 rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer flex items-center justify-center gap-2 ${
                      selectedAnswers.length === 2
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/15"
                        : "bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed"
                    }`}
                  >
                    <span>উত্তর যাচাই করুন ({toBengaliNumber(selectedAnswers.length)}/২ নির্বাচিত)</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>{currentIndex === filteredWords.length - 1 ? 'পুনরায় প্রথম শব্দ' : 'পরবর্তী শব্দে যান'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Global Stats, Bookmark integration & Groupwise Progress Scroll */}
          <div className="space-y-6">
            
            {/* Accuracy and Synonym stats overview card */}
            <div className="bg-indigo-950/95 text-white rounded-2xl p-5 space-y-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5">
                <Award className="w-36 h-36" />
              </div>
              
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">সার্বাঙ্গিক কুইজ অগ্রগতি</span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-indigo-900 pb-3 z-10 relative">
                <div>
                  <span className="text-[10px] text-indigo-300 block font-bold">মোট সম্পূর্ণ শব্দ</span>
                  <p className="text-xl font-black font-sans">{toBengaliNumber(overallStats.completed)} / {toBengaliNumber(overallStats.total)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-300 block font-bold">অর্জি অগ্রগতি</span>
                  <p className="text-xl font-black font-sans text-emerald-400">{toBengaliNumber(overallStats.percent)}%</p>
                </div>
              </div>

              <div className="w-full bg-indigo-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${overallStats.percent}%` }}
                />
              </div>

              <p className="text-[11px] text-indigo-200 font-sans leading-relaxed">
                সকল ভোকাবুলারি গ্রুপের শব্দগুলোর সমার্থক শব্দ সঠিক হলে আপনার প্রগ্রেস রেট বৃদ্ধি পাবে।
              </p>
            </div>

            {/* Folder list to Bookmark Word (Fully aligned with FlashcardViewer) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 text-xs">
                <Bookmark className="w-4 h-4 text-indigo-600" />
                ফোল্ডার লিস্টে সেভ করুন (Bookmarks)
              </h3>

              <div className="space-y-2 font-sans max-h-32 overflow-y-auto pr-0.5">
                {folders.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    কোনো কাস্টม ফোল্ডার নেই।
                  </div>
                ) : (
                  folders.map(f => {
                    const isBookmarked = (progress[currentActiveWord.id]?.bookmarks || []).includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => onToggleBookmark(currentActiveWord.id, f.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold border transition ${
                          isBookmarked
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                            : 'bg-white border-slate-150 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: f.color }}></div>
                          <span>{f.name}</span>
                        </div>
                        <Tag className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current text-indigo-600' : 'text-slate-300'}`} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Group Progress visualizer scroll lists */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>গ্রুপভিত্তিক অগ্রগতি (১-৩৭)</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-bold font-sans">ক্লিক করুন ফিল্টার করতে</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                {Array.from({ length: 37 }, (_, i) => {
                  const gNum = i + 1;
                  const stats = getGroupStats(gNum);
                  const isFiltered = selectedGroups.length === 1 && selectedGroups.includes(gNum);
                  
                  return (
                    <div 
                      key={gNum} 
                      onClick={() => {
                        // Clicking filters synonym check to exclusively study this group!
                        setSelectedGroups([gNum]);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        isFiltered 
                          ? 'border-indigo-400 bg-indigo-50/20 shadow-xs' 
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[11px] font-extrabold">
                        <span className="text-slate-700">গ্রুপ {toBengaliNumber(gNum)}</span>
                        <span className="text-slate-400 font-normal font-sans">
                          {toBengaliNumber(stats.completed)} / {toBengaliNumber(stats.total)}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="w-full bg-slate-200/70 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${stats.percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[8px] font-bold">
                          <span className="text-slate-400">অগ্রগতি</span>
                          <span className="text-indigo-600">{toBengaliNumber(stats.percent)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-1.5 text-center">
                <button
                  onClick={() => setSelectedGroups(Array.from({ length: 37 }, (_, i) => i + 1))}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition hover:underline cursor-pointer"
                >
                  সব গ্রুপ পুনরায় সিলেক্ট করুন
                </button>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
