import React, { useState, useEffect } from 'react';
import { VocabularyWord } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Award, 
  Sparkles, 
  ChevronRight, 
  ArrowRight, 
  Volume2, 
  BookOpen, 
  HelpCircle as HelpIcon, 
  Info,
  Check
} from 'lucide-react';

interface SynonymCheckProps {
  words: VocabularyWord[];
  synonymProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateSynonymProgress: (wordId: string, correct: boolean) => void;
  activeGroup: number | null;
}

interface Question {
  word: VocabularyWord;
  options: string[];
  correctAnswers: string[];
}

export default function SynonymCheck({ 
  words, 
  synonymProgress, 
  onUpdateSynonymProgress, 
  activeGroup 
}: SynonymCheckProps) {
  // Game screens: 'setup' | 'playing' | 'summary'
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'summary'>('setup');
  
  // Settings state
  const [selectedGroup, setSelectedGroup] = useState<number | 'all'>(activeGroup || 'all');
  const [quizLength, setQuizLength] = useState<number>(10);
  
  // Game play state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Scoring / Performance
  const [score, setScore] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState<VocabularyWord[]>([]);

  // Parse synonym string to list
  const getSynonymsList = (word: VocabularyWord): string[] => {
    if (!word.synonyms) return [];
    return word.synonyms.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Generate a pool of all unique synonyms in the selected words or entire dataset
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

  // Initialize and start quiz
  const startQuiz = () => {
    let sourcePool = [...words];

    if (selectedGroup !== 'all') {
      sourcePool = sourcePool.filter(w => w.group === selectedGroup);
    }

    // Filter words that actually have synonyms (should be all or almost all)
    sourcePool = sourcePool.filter(w => getSynonymsList(w).length >= 2);

    if (sourcePool.length === 0) {
      alert('পরীক্ষা শুরু করার জন্য কোনো উপযুক্ত শব্দ পাওয়া যায়নি!');
      return;
    }

    // Shuffle vocabulary pool
    sourcePool.sort(() => Math.random() - 0.5);
    const selectedBatch = sourcePool.slice(0, Math.min(quizLength, sourcePool.length));

    // Prepare pool of other synonyms for distractors
    const allSynonyms = getAllSynonymsPool();

    const generatedQuestions: Question[] = selectedBatch.map(currentWord => {
      const correctAnswers = getSynonymsList(currentWord); // e.g. ["Proliferate", "Burgeon"]

      // Distractors pool: exclude synonyms of current word (case-insensitive)
      const lowercaseCorrect = correctAnswers.map(c => c.toLowerCase());
      const possibleDistractors = allSynonyms.filter(syn => 
        !lowercaseCorrect.includes(syn.toLowerCase()) && 
        syn.toLowerCase() !== currentWord.word.toLowerCase()
      );

      // Shuffle and pick 3 unique distractors
      possibleDistractors.sort(() => Math.random() - 0.5);
      const distractors = possibleDistractors.slice(0, 3);

      // Combine and shuffle options
      const options = [...correctAnswers, ...distractors];
      options.sort(() => Math.random() - 0.5);

      return {
        word: currentWord,
        options,
        correctAnswers
      };
    });

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setSelectedAnswers([]);
    setIsSubmitted(false);
    setScore(0);
    setIncorrectWords([]);
    setGameState('playing');
  };

  // Option toggle selection
  const handleOptionClick = (option: string) => {
    if (isSubmitted) return;
    
    setSelectedAnswers(prev => {
      if (prev.includes(option)) {
        return prev.filter(x => x !== option);
      }
      if (prev.length < 2) {
        return [...prev, option];
      }
      // If already has 2 items, don't allow selecting more
      return prev;
    });
  };

  // Speech helper
  const speakWord = (wordText: string) => {
    if (!wordText) return;
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Submit/Verify current selection
  const submitAnswer = () => {
    if (isSubmitted || selectedAnswers.length !== 2) return;

    const currentQuestion = questions[currentQuestionIndex];
    
    // Check if the 2 user selected answers are exactly the correct answers (case-insensitive checking)
    const correctLower = currentQuestion.correctAnswers.map(c => c.toLowerCase());
    const isCorrect = selectedAnswers.every(ans => correctLower.includes(ans.toLowerCase()));

    if (isCorrect) {
      setScore(prev => prev + 1);
      onUpdateSynonymProgress(currentQuestion.word.id, true);
    } else {
      setIncorrectWords(prev => [...prev, currentQuestion.word]);
      onUpdateSynonymProgress(currentQuestion.word.id, false);
    }

    setIsSubmitted(true);
    speakWord(currentQuestion.word.word);
  };

  // Move to next question or end
  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setIsSubmitted(false);
    } else {
      setGameState('summary');
    }
  };

  // Group wise stats calculation
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

  // Helper to format Bengali numbers for aesthetics
  const toBengaliNumber = (num: number) => {
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, d => bnNums[parseInt(d)]);
  };

  return (
    <div className="space-y-6 font-sans" id="synonym-check-container">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>সিনোনিম চ্যালেঞ্জ</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">সিনোনিম চেক (Synonym Check)</h1>
          <p className="text-xs text-slate-400 mt-1">প্রতিটি শব্দের সঠিক দুটি সমার্থক শব্দ (Synonyms) খুঁজে বের করুন এবং গ্রুপভিত্তিক প্রগ্রেস বাড়ান।</p>
        </div>
        {gameState !== 'setup' && (
          <button
            onClick={() => setGameState('setup')}
            className="px-4 py-2 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>হোমে ফিরুন</span>
          </button>
        )}
      </div>

      {/* SETUP SCREEN */}
      {gameState === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Config Panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-5 h-fit">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-black text-slate-700">কুইজ কনফিগারেশন</h2>
            </div>

            {/* Choose Group */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">ভোকাবুলারি গ্রুপ সিলেক্ট</label>
              <select
                value={selectedGroup}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroup(val === 'all' ? 'all' : parseInt(val));
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer font-medium"
              >
                <option value="all">সকল গ্রুপ (১-৩৭)</option>
                {Array.from({ length: 37 }, (_, i) => i + 1).map(g => {
                  const stats = getGroupStats(g);
                  return (
                    <option key={g} value={g}>
                      গ্রুপ {g} ({stats.completed}/{stats.total} সম্পূর্ণ)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Choose Length */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">প্রশ্ন সংখ্যা</label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map(len => (
                  <button
                    key={len}
                    onClick={() => setQuizLength(len)}
                    className={`py-2 text-xs font-extrabold rounded-lg border transition-all cursor-pointer ${
                      quizLength === len
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {toBengaliNumber(len)}টি
                  </button>
                ))}
              </div>
            </div>

            {/* Hint Panel */}
            <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50 text-[11px] text-slate-500 leading-relaxed font-medium space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700 uppercase tracking-wide text-[10px]">
                <Info className="w-3.5 h-3.5" />
                <span>কীভাবে খেলবেন?</span>
              </div>
              <p>১. আপনার কাঙ্ক্ষিত গ্রুপ সিলেক্ট করুন।</p>
              <p>২. প্রতিটি প্রশ্নে ৫টি সমার্থক শব্দের অপশন থাকবে।</p>
              <p>৩. সঠিক ২টি সিনোনিম বেছে নিয়ে "যাচাই করুন" বাটনে ক্লিক করুন।</p>
              <p>৪. দুটি অপশনই সঠিক হলে তবেই প্রশ্নটি সঠিক হিসেবে গণ্য হবে।</p>
            </div>

            <button
              onClick={startQuiz}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-2 transition"
            >
              <span>সিনোনিম চ্যালেঞ্জ শুরু করুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Groups Progress Visualizer */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <h3 className="text-sm font-black text-slate-700 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>সিনোনিম চেক গ্রুপভিত্তিক অগ্রগতি</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 max-h-[420px] overflow-y-auto pr-1">
              {Array.from({ length: 37 }, (_, i) => {
                const gNum = i + 1;
                const stats = getGroupStats(gNum);
                return (
                  <div 
                    key={gNum} 
                    onClick={() => setSelectedGroup(gNum)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      selectedGroup === gNum 
                        ? 'border-indigo-300 bg-indigo-50/20 shadow-xs' 
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-700">গ্রুপ {toBengaliNumber(gNum)}</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {toBengaliNumber(stats.completed)} / {toBengaliNumber(stats.total)} সঠিক
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-slate-400">অগ্রগতি</span>
                        <span className="text-indigo-600">{toBengaliNumber(stats.percent)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GAMEPLAY SCREEN */}
      {gameState === 'playing' && questions.length > 0 && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200/60 shadow-md overflow-hidden">
          {/* Header Progress Bar */}
          <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
              প্রশ্ন: {toBengaliNumber(currentQuestionIndex + 1)} / {toBengaliNumber(questions.length)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
              <span>সঠিক:</span>
              <span className="text-emerald-600 font-extrabold">{toBengaliNumber(score)}</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-1">
            <div 
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Core Card Section */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Target Word Display */}
            <div className="text-center space-y-2 py-4">
              <span className="text-[10px] font-extrabold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">
                গ্রুপ {toBengaliNumber(questions[currentQuestionIndex].word.group)}
              </span>
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-4xl md:text-5xl font-black text-indigo-950 tracking-tight">
                  {questions[currentQuestionIndex].word.word}
                </h2>
                <button
                  onClick={() => speakWord(questions[currentQuestionIndex].word.word)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                  title="উচ্চারণ শুনুন"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-400">({questions[currentQuestionIndex].word.meaning})</p>
              
              <div className="pt-2">
                <p className="text-xs font-bold text-indigo-600 bg-indigo-50/40 px-3 py-1.5 rounded-xl border border-indigo-100/30 inline-block">
                  নিচের ৫টি অপশন থেকে এই শব্দটির সঠিক ২টি সমার্থক শব্দ (Synonyms) সিলেক্ট করুন
                </p>
              </div>
            </div>

            {/* Options Selector Grid */}
            <div className="space-y-2.5 max-w-md mx-auto">
              {questions[currentQuestionIndex].options.map((option, index) => {
                const isSelected = selectedAnswers.includes(option);
                const isCorrectOption = questions[currentQuestionIndex].correctAnswers.includes(option);
                
                // Styling classes based on state
                let optionStyle = "border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700";
                let badgeStyle = "border-slate-300 bg-white";

                if (isSelected && !isSubmitted) {
                  optionStyle = "border-indigo-400 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-400";
                  badgeStyle = "border-indigo-600 bg-indigo-600 text-white";
                }

                if (isSubmitted) {
                  if (isCorrectOption) {
                    // Correct options show in green regardless
                    optionStyle = "border-emerald-400 bg-emerald-50 text-emerald-950 font-bold";
                    badgeStyle = "border-emerald-600 bg-emerald-600 text-white";
                  } else if (isSelected && !isCorrectOption) {
                    // Incorrect selection shows in red
                    optionStyle = "border-rose-300 bg-rose-50 text-rose-950 font-medium";
                    badgeStyle = "border-rose-600 bg-rose-600 text-white";
                  } else {
                    // Non-selected incorrect options are dimmed
                    optionStyle = "border-slate-100 bg-slate-50/30 text-slate-400 opacity-60";
                    badgeStyle = "border-slate-200 bg-slate-50";
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    disabled={isSubmitted}
                    className={`w-full p-3.5 rounded-2xl border text-sm font-extrabold flex items-center justify-between transition-all duration-150 cursor-pointer ${optionStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${badgeStyle}`}>
                        {isSubmitted && isCorrectOption ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : isSubmitted && isSelected ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : isSelected ? (
                          "✓"
                        ) : (
                          toBengaliNumber(index + 1)
                        )}
                      </div>
                      <span className="font-sans text-base tracking-wide">{option}</span>
                    </div>

                    {isSubmitted && isCorrectOption && (
                      <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        সিনোনিম
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status alerts */}
            {isSubmitted && (
              <div className={`max-w-md mx-auto p-4 rounded-2xl border flex items-start gap-3 transition-all duration-300 ${
                selectedAnswers.every(ans => questions[currentQuestionIndex].correctAnswers.includes(ans))
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-rose-50 border-rose-100 text-rose-800"
              }`}>
                {selectedAnswers.every(ans => questions[currentQuestionIndex].correctAnswers.includes(ans)) ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black">চমৎকার! আপনার উত্তর সঠিক হয়েছে।</h4>
                      <p className="text-[11px] font-medium text-emerald-600/90 mt-0.5">
                        সমার্থক শব্দগুলো হলো: <span className="font-extrabold font-sans">{questions[currentQuestionIndex].correctAnswers.join(', ')}</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black">দুঃখিত, উত্তরটি সঠিক হয়নি।</h4>
                      <p className="text-[11px] font-medium text-rose-600/90 mt-0.5">
                        সঠিক উত্তর হবে: <span className="font-extrabold font-sans">{questions[currentQuestionIndex].correctAnswers.join(', ')}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex justify-center pt-3">
              {!isSubmitted ? (
                <button
                  onClick={submitAnswer}
                  disabled={selectedAnswers.length !== 2}
                  className={`px-8 py-3 rounded-2xl text-xs font-extrabold shadow-md transition cursor-pointer ${
                    selectedAnswers.length === 2
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/15"
                      : "bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed"
                  }`}
                >
                  উত্তর যাচাই করুন ({toBengaliNumber(selectedAnswers.length)}/২ নির্বাচিত)
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-extrabold shadow-md flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>{currentQuestionIndex === questions.length - 1 ? 'ফলাফল দেখুন' : 'পরবর্তী প্রশ্ন'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY SCREEN */}
      {gameState === 'summary' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200/60 shadow-md p-6 md:p-8 space-y-6 text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Award className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-800">সিনোনিম কুইজ সম্পন্ন হয়েছে!</h2>
            <p className="text-sm text-slate-400 font-medium">নিচে আপনার কুইজের ফলাফল বিস্তারিত দেওয়া হলো।</p>
          </div>

          {/* Score card */}
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl max-w-sm mx-auto flex items-center justify-around gap-4">
            <div className="text-left space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">মোট প্রশ্ন</span>
              <p className="text-2xl font-black text-slate-700">{toBengaliNumber(questions.length)}টি</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-left space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">সঠিক উত্তর</span>
              <p className="text-2xl font-black text-emerald-600">{toBengaliNumber(score)}টি</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-left space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">সফলতা</span>
              <p className="text-2xl font-black text-indigo-600">
                {toBengaliNumber(Math.round((score / questions.length) * 100))}%
              </p>
            </div>
          </div>

          {/* Incorrect review panel */}
          {incorrectWords.length > 0 && (
            <div className="space-y-3 text-left">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <HelpIcon className="w-4 h-4 text-rose-400" /> ভুল হওয়া শব্দগুলো রিভিশন দিন:
              </h3>
              <div className="border border-slate-150 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                {incorrectWords.map((word, index) => (
                  <div key={index} className="p-3.5 flex justify-between items-center bg-slate-50/30 hover:bg-slate-50">
                    <div>
                      <h4 className="text-sm font-black text-slate-800">{word.word}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">{word.meaning}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-indigo-700 block font-sans">
                        {getSynonymsList(word).join(', ')}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase mt-0.5">সঠিক সমার্থক</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation panel */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-3">
            <button
              onClick={startQuiz}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>আবার খেলুন</span>
            </button>
            <button
              onClick={() => setGameState('setup')}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>হোম স্ক্রিনে যান</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
