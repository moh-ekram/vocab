import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, CustomFolder } from '../types';
import { ChevronLeft, ChevronRight, Volume2, CheckCircle, AlertTriangle, XCircle, Info, Tag, Bookmark, Edit3, Keyboard, Sparkles } from 'lucide-react';

interface FlashcardViewerProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  initialGroup?: number | null;
}

export default function FlashcardViewer({
  words,
  progress,
  folders,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  initialGroup = null
}: FlashcardViewerProps) {
  // Filter States
  const [selectedGroup, setSelectedGroup] = useState<string>(initialGroup ? initialGroup.toString() : 'all');
  const [selectedStatus, setSelectedGroupStatus] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default'); // 'default', 'alphabetical', 'shuffle'

  // Card orientation
  const [isFlipped, setIsFlipped] = useState(false);

  // Vocabulary Index State
  const [currentIndex, setCurrentIndex] = useState(0);

  // Active note state
  const [noteText, setNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);

  // Hotkey helper tooltip
  const [showHotkeysHelp, setShowHotkeysHelp] = useState(false);

  // Filtered List generator
  const [filteredWords, setFilteredWords] = useState<VocabularyWord[]>([]);

  useEffect(() => {
    let result = [...words];

    // Filter by group
    if (selectedGroup !== 'all') {
      const gNum = parseInt(selectedGroup, 10);
      result = result.filter(w => w.group === gNum);
    }

    // Filter by tag
    if (selectedStatus !== 'all') {
      result = result.filter(w => {
        const status = progress[w.id]?.status || 'unrated';
        return status === selectedStatus;
      });
    }

    // Filter by folder/bookmark
    if (selectedFolder !== 'all') {
      result = result.filter(w => {
        const bookmarks = progress[w.id]?.bookmarks || [];
        return bookmarks.includes(selectedFolder);
      });
    }

    // Sort options
    if (sortBy === 'alphabetical') {
      result.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortBy === 'shuffle') {
      result.sort(() => Math.random() - 0.5);
    }

    setFilteredWords(result);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedGroup, selectedStatus, selectedFolder, sortBy, words, progress]);

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

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentActiveWord.id) {
            onRateWord(currentActiveWord.id, 'dont_know');
            handleNext();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentActiveWord.id) {
            onRateWord(currentActiveWord.id, 'know');
            handleNext();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentActiveWord.id) {
            onRateWord(currentActiveWord.id, 'confusion');
            handleNext();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentActiveWord.id) {
            onRateWord(currentActiveWord.id, 'unrated');
          }
          break;
        case 'KeyP':
        case 'Enter':
          e.preventDefault();
          speakWord();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredWords, currentIndex, currentActiveWord.id]);

  // Text to Speech
  const speakWord = () => {
    if (!currentActiveWord.word) return;
    const utterance = new SpeechSynthesisUtterance(currentActiveWord.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel(); // Clear queued speech
    window.speechSynthesis.speak(utterance);
  };

  const activeStatus = progress[currentActiveWord.id]?.status || 'unrated';

  return (
    <div className="space-y-6" id="flashcard-viewer-container">
      {/* Top Filter and Customization Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-wrap gap-4 items-center justify-between" id="flashcard-filters">
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Group */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">ভোকাবুলারি গ্রুপ</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
            >
              <option value="all">সকল গ্রুপ (১-৩৭)</option>
              {Array.from({ length: 37 }, (_, i) => (
                <option key={i + 1} value={i + 1}>গ্রুপ {i + 1}</option>
              ))}
            </select>
          </div>

          {/* Select Status */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">ট্যাগ ফিল্টার</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedGroupStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
            >
              <option value="all">সকল ট্যাগ</option>
              <option value="know">পারি (সবুজ)</option>
              <option value="confusion">কনফিউশন (হলুদ)</option>
              <option value="dont_know">পারি না (লাল)</option>
              <option value="unrated">পড়া হয়নি (ধূসর)</option>
            </select>
          </div>

          {/* Custom Bookmarks Select */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">বুকমার্ক লিস্ট</label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
            >
              <option value="all">সকল লিস্ট</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Sorting */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">সাজানোর নিয়ম</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
            >
              <option value="default">সিরিয়াল নম্বর</option>
              <option value="alphabetical">বর্ণানুক্রমিক (A-Z)</option>
              <option value="shuffle">এলোমেলো (Shuffle)</option>
            </select>
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
              setSelectedGroup('all');
              setSelectedGroupStatus('all');
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
              className="group cursor-pointer perspective h-96 relative w-full"
              id="vocabulary-card-stage"
            >
              <div
                className={`w-full h-full relative transition-transform duration-500 transform-style-3d ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* FRONT FACE (Word) */}
                <div className="absolute inset-0 bg-white border-2 border-indigo-100 rounded-3xl p-8 flex flex-col justify-between backface-hidden shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1.5 bg-indigo-50 text-indigo-800 font-extrabold text-xs rounded-lg font-sans">
                      গ্রুপ {currentActiveWord.group} • শব্দ {currentIndex + 1} / {filteredWords.length}
                    </span>

                    {/* Active Tag indicator */}
                    <div className="flex items-center gap-2">
                      {activeStatus === 'know' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full font-sans">
                          <CheckCircle className="w-3.5 h-3.5" /> পারি
                        </span>
                      )}
                      {activeStatus === 'confusion' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-sans">
                          <AlertTriangle className="w-3.5 h-3.5" /> কনফিউশন
                        </span>
                      )}
                      {activeStatus === 'dont_know' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full font-sans">
                          <XCircle className="w-3.5 h-3.5" /> পারি না
                        </span>
                      )}
                      {activeStatus === 'unrated' && (
                        <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full font-sans">
                          পড়া হয়নি
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main display word */}
                  <div className="text-center space-y-4">
                    <h1 className="text-5xl md:text-6xl font-black text-slate-800 tracking-tight select-none">
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
                    </div>
                  </div>

                  {/* Hints at footer */}
                  <div className="flex justify-between items-center text-xs text-slate-400 font-sans border-t border-slate-100 pt-4">
                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      ক্লিক করুন উল্টানোর জন্য
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                      ID: {currentActiveWord.id}
                    </span>
                  </div>
                </div>

                {/* BACK FACE (Meaning & Synonyms) */}
                <div className="absolute inset-0 bg-white p-8 rounded-3xl border-2 border-indigo-100 shadow-md transform rotate-y-180 backface-hidden flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider font-sans">গ্রুপ {currentActiveWord.group} • উত্তর</span>
                      <span className="text-2xl font-black text-slate-800">{currentActiveWord.word}</span>
                    </div>

                    {/* Bengali Meaning */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-sans">বাংলা অর্থ</p>
                      <p className="text-xl font-bold text-gray-800 font-sans leading-relaxed">{currentActiveWord.meaning}</p>
                    </div>

                    {/* Synonyms */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Synonyms</p>
                      <p className="text-base text-teal-800 font-semibold font-sans">{currentActiveWord.synonyms || 'N/A'}</p>
                    </div>

                    {/* Extra Word Reference */}
                    {currentActiveWord.extraWord && (
                      <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100/50">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1 font-sans">सहযোগী অতিরিক্ত শব্দ (Extra Column)</p>
                        <p className="text-sm font-bold text-gray-700 font-sans">
                          {currentActiveWord.extraWord} : <span className="font-normal text-gray-600">{currentActiveWord.extraMeaning}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-center text-xs text-gray-300 font-sans">ট্যাপ করুন পুনরায় উল্টাতে</p>
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
                    onClick={() => {
                      onRateWord(currentActiveWord.id, 'dont_know');
                      handleNext();
                    }}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border ${
                      activeStatus === 'dont_know'
                        ? 'bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-500/10'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>পারি না</span>
                  </button>

                  {/* Mark as Confusion */}
                  <button
                    onClick={() => {
                      onRateWord(currentActiveWord.id, 'confusion');
                      handleNext();
                    }}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border ${
                      activeStatus === 'confusion'
                        ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-md shadow-amber-500/10'
                        : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>কনফিউশন</span>
                  </button>

                  {/* Mark as Know */}
                  <button
                    onClick={() => {
                      onRateWord(currentActiveWord.id, 'know');
                      handleNext();
                    }}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition border ${
                      activeStatus === 'know'
                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-500/15'
                        : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800'
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

            {/* Folder / Bookmark Lists integration */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                ফোল্ডার লিস্টে সেভ করুন
              </h3>

              <div className="space-y-2.5 font-sans">
                {folders.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    কোনো কাস্টম ফোল্ডার নেই। বাম পাশের মেনু থেকে ফোল্ডার তৈরি করুন।
                  </div>
                ) : (
                  folders.map(f => {
                    const isBookmarked = (progress[currentActiveWord.id]?.bookmarks || []).includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => onToggleBookmark(currentActiveWord.id, f.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold border transition ${
                          isBookmarked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                            : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: f.color }}></div>
                          <span>{f.name}</span>
                        </div>
                        <Tag className={`w-4 h-4 ${isBookmarked ? 'fill-current text-indigo-600' : 'text-slate-300'}`} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
