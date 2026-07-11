import React, { useState, useEffect } from 'react';
import { VocabularyWord, WordStatus, UserProgress, AppSettings } from '../types';
import { CheckCircle2, XCircle, RefreshCw, HelpCircle, AlertCircle, Award, Sparkles, ChevronRight, HelpCircle as HelpIcon, ArrowRight } from 'lucide-react';

interface PracticeQuizProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onRateWord: (wordId: string, status: WordStatus) => void;
  activeGroup: number | null;
  settings?: AppSettings;
}

type QuizType = 'mcq_en_bn' | 'mcq_bn_en' | 'typing_spelling';

interface Question {
  word: VocabularyWord;
  options: string[];
  correctAnswer: string;
}

export default function PracticeQuiz({ words, progress, onRateWord, activeGroup, settings }: PracticeQuizProps) {
  // Quiz states
  const [quizType, setQuizType] = useState<QuizType>('mcq_en_bn');
  const [quizLength, setQuizLength] = useState<number>(() => {
    return settings?.quizLength || 10;
  });
  const [filterMode, setFilterMode] = useState<'group' | 'weak' | 'all'>(activeGroup ? 'group' : 'all');

  const [gameState, setGameState] = useState<'setup' | 'playing' | 'summary'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // User input states
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  // Scoring
  const [score, setScore] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState<VocabularyWord[]>([]);

  // Spelling Hints helper
  const [hintsUsed, setHintsUsed] = useState(0);

  // Generate Questions when game starts
  const startQuiz = () => {
    let sourcePool = [...words];

    if (filterMode === 'group' && activeGroup) {
      sourcePool = sourcePool.filter(w => w.group === activeGroup);
    } else if (filterMode === 'weak') {
      sourcePool = sourcePool.filter(w => {
        const s = progress[w.id]?.status;
        return s === 'dont_know' || s === 'confusion';
      });
    }

    if (sourcePool.length < 4 && quizType !== 'typing_spelling') {
      alert('পরীক্ষা শুরু করার জন্য অন্তত ৪টি শব্দ প্রয়োজন। আপনার ফিল্টার পরিবর্তন করুন।');
      return;
    }
    if (sourcePool.length === 0) {
      alert('কোনো শব্দ পাওয়া যায়নি!');
      return;
    }

    // Shuffle and pick limit
    sourcePool.sort(() => Math.random() - 0.5);
    const selectedBatch = sourcePool.slice(0, Math.min(quizLength, sourcePool.length));

    // Map questions
    const generatedQuestions: Question[] = selectedBatch.map(currentWord => {
      if (quizType === 'typing_spelling') {
        return {
          word: currentWord,
          options: [],
          correctAnswer: currentWord.word.trim().toLowerCase()
        };
      }

      // Generate MCQ Options
      const distractors = words
        .filter(w => w.id !== currentWord.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const isEnToBn = quizType === 'mcq_en_bn';
      const correctText = isEnToBn ? currentWord.meaning : currentWord.word;
      const optionTexts = distractors.map(d => isEnToBn ? d.meaning : d.word);
      optionTexts.push(correctText);

      // Shuffle options
      optionTexts.sort(() => Math.random() - 0.5);

      return {
        word: currentWord,
        options: optionTexts,
        correctAnswer: correctText
      };
    });

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setAnswerSubmitted(false);
    setScore(0);
    setIncorrectWords([]);
    setHintsUsed(0);
    setGameState('playing');
  };

  const handleMCQOptionClick = (option: string) => {
    if (answerSubmitted) return;
    setSelectedAnswer(option);
  };

  const submitAnswer = () => {
    if (answerSubmitted) return;

    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;

    if (quizType === 'typing_spelling') {
      isCorrect = typedAnswer.trim().toLowerCase() === currentQuestion.correctAnswer;
    } else {
      isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    }

    if (isCorrect) {
      setScore(prev => prev + 1);
      // Boost rate in background automatically
      onRateWord(currentQuestion.word.id, 'know');
    } else {
      setIncorrectWords(prev => [...prev, currentQuestion.word]);
      // Mark as weak automatically in background
      onRateWord(currentQuestion.word.id, 'dont_know');
    }

    setAnswerSubmitted(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setTypedAnswer('');
      setAnswerSubmitted(false);
      setHintsUsed(0);
    } else {
      setGameState('summary');
    }
  };

  // Give spelling typing hints
  const getTypingHint = () => {
    if (!questions[currentQuestionIndex]) return;
    const correct = questions[currentQuestionIndex].correctAnswer;
    setHintsUsed(prev => prev + 1);
    setTypedAnswer(correct.slice(0, hintsUsed + 1));
  };

  const progressPercent = questions.length > 0 ? Math.round(((currentQuestionIndex) / questions.length) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-xs max-w-3xl mx-auto" id="quiz-container">
      {/* 1. SETUP GAME */}
      {gameState === 'setup' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-2">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">ভোকাবুলারি পরীক্ষা ও কুইজ</h2>
            <p className="text-sm text-slate-500 font-sans max-w-md mx-auto">
              কাস্টম পরীক্ষার মাধ্যমে আপনার মেমোরাইজেশন যাচাই করুন। MCQ বা স্পেলিং টাইপিং চ্যালেঞ্জ বেছে নিন।
            </p>
          </div>

          <div className="space-y-6">
            {/* Quiz Type Selector */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-450 uppercase tracking-wider font-sans">পরীক্ষার ধরন নির্বাচন</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-sans">
                <button
                  onClick={() => setQuizType('mcq_en_bn')}
                  className={`p-4 text-left border rounded-2xl transition flex flex-col justify-between h-28 ${
                    quizType === 'mcq_en_bn'
                      ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-white hover:bg-slate-50 border-slate-200/60'
                  }`}
                >
                  <span className="font-bold text-slate-800 text-sm">MCQ (ইংরেজি ➡ বাংলা)</span>
                  <span className="text-xs text-slate-400">ইংরেজি শব্দ দেখে সঠিক বাংলা অর্থ চিহ্নিত করুন।</span>
                </button>

                <button
                  onClick={() => setQuizType('mcq_bn_en')}
                  className={`p-4 text-left border rounded-2xl transition flex flex-col justify-between h-28 ${
                    quizType === 'mcq_bn_en'
                      ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-white hover:bg-slate-50 border-slate-200/60'
                  }`}
                >
                  <span className="font-bold text-slate-800 text-sm">MCQ (বাংলা ➡ ইংরেজি)</span>
                  <span className="text-xs text-slate-400">বাংলা অর্থ দেখে সঠিক ইংরেজি শব্দ চিহ্নিত করুন।</span>
                </button>

                <button
                  onClick={() => setQuizType('typing_spelling')}
                  className={`p-4 text-left border rounded-2xl transition flex flex-col justify-between h-28 ${
                    quizType === 'typing_spelling'
                      ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-white hover:bg-slate-50 border-slate-200/60'
                  }`}
                >
                  <span className="font-bold text-slate-800 text-sm">স্পেলিং টাইপিং চ্যালেঞ্জ</span>
                  <span className="text-xs text-slate-400">অর্থ ও সিনোনিম দেখে সঠিক ইংরেজি বানান টাইপ করুন।</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Question Pool Filters */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider font-sans">প্রশ্নের সোর্স</span>
                <div className="grid grid-cols-3 gap-2 font-sans text-xs font-bold">
                  {activeGroup && (
                    <button
                      onClick={() => setFilterMode('group')}
                      className={`py-3 rounded-xl border transition ${
                        filterMode === 'group' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                      }`}
                    >
                      গ্রুপ {activeGroup}
                    </button>
                  )}
                  <button
                    onClick={() => setFilterMode('weak')}
                    className={`py-3 rounded-xl border transition ${
                      filterMode === 'weak' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                    }`}
                  >
                    দুর্বল শব্দসমূহ
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`py-3 rounded-xl border transition ${
                      filterMode === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                    }`}
                  >
                    সকল শব্দ
                  </button>
                </div>
              </div>

              {/* Quiz Length */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider font-sans">প্রশ্নের সংখ্যা</span>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map(count => (
                    <button
                      key={count}
                      onClick={() => setQuizLength(count)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl border transition font-sans ${
                        quizLength === count
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60'
                      }`}
                    >
                      {count} টি
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={startQuiz}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-md shadow-indigo-600/10 transition flex items-center justify-center gap-2 font-sans"
          >
            <Sparkles className="w-5 h-5" />
            কুইজ শুরু করুন
          </button>
        </div>
      )}

      {/* 2. PLAYING GAME */}
      {gameState === 'playing' && questions[currentQuestionIndex] && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Stats */}
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 font-sans border-b border-slate-100 pb-3">
            <span>প্রশ্ন {currentQuestionIndex + 1} / {questions.length}</span>
            <div className="flex items-center gap-2">
              <span className="text-indigo-600">স্কোর: {score}</span>
              <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Question display */}
          <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-200/60 text-center space-y-4">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-800 text-[10px] font-extrabold uppercase rounded-full tracking-wider font-sans">
              {quizType === 'mcq_bn_en' ? 'বাংলা অর্থ' : 'ইংরেজি শব্দ'}
            </span>

            <h1 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
              {quizType === 'mcq_bn_en'
                ? questions[currentQuestionIndex].word.meaning
                : questions[currentQuestionIndex].word.word}
            </h1>

            {/* Display synonyms context */}
            {questions[currentQuestionIndex].word.synonyms && (
              <p className="text-sm font-semibold text-indigo-700 font-sans">
                Synonyms: {questions[currentQuestionIndex].word.synonyms}
              </p>
            )}
          </div>

          {/* MCQ Options representation */}
          {quizType !== 'typing_spelling' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
              {questions[currentQuestionIndex].options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOpt = option === questions[currentQuestionIndex].correctAnswer;

                let btnStyle = 'border-slate-200/60 hover:border-indigo-300 hover:bg-indigo-50/10 text-slate-700 bg-white';
                if (answerSubmitted) {
                  if (isCorrectOpt) {
                    btnStyle = 'border-indigo-500 bg-indigo-50/60 text-indigo-900 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'border-rose-500 bg-rose-50 text-rose-800';
                  } else {
                    btnStyle = 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60';
                  }
                } else if (isSelected) {
                  btnStyle = 'border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-50/30 text-indigo-950 font-bold';
                }

                return (
                  <button
                    key={idx}
                    disabled={answerSubmitted}
                    onClick={() => handleMCQOptionClick(option)}
                    className={`p-4 text-left rounded-xl border text-sm transition flex items-center justify-between min-h-14 ${btnStyle}`}
                  >
                    <span>{option}</span>
                    {answerSubmitted && isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                    {answerSubmitted && isSelected && !isCorrectOpt && <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Spelling Typing Mode input fields */
            <div className="space-y-4">
              <div className="space-y-1 font-sans">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ইংরেজি বানান টাইপ করুন</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={answerSubmitted}
                    placeholder="বানান লিখুন..."
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && typedAnswer.trim()) {
                        submitAnswer();
                      }
                    }}
                    className={`w-full p-4 border rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                      answerSubmitted
                        ? typedAnswer.trim().toLowerCase() === questions[currentQuestionIndex].correctAnswer
                          ? 'border-indigo-500 bg-indigo-50/30 text-indigo-800'
                          : 'border-rose-500 bg-rose-50 text-rose-800'
                        : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Hint Support */}
              {!answerSubmitted && (
                <div className="flex justify-between items-center font-sans">
                  <button
                    onClick={getTypingHint}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1.5"
                  >
                    <HelpIcon className="w-4 h-4" />
                    <span>বানানের সাহায্য (Hint)</span>
                  </button>
                  <span className="text-[11px] text-slate-400">মোট বর্ণ: {questions[currentQuestionIndex].correctAnswer.length} টি</span>
                </div>
              )}
            </div>
          )}

          {/* Action Controllers */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 font-sans">
            {!answerSubmitted ? (
              <button
                onClick={submitAnswer}
                disabled={quizType === 'typing_spelling' ? !typedAnswer.trim() : !selectedAnswer}
                className="px-6 py-3 bg-indigo-600 disabled:opacity-50 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm"
              >
                উত্তর যাচাই করুন
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm flex items-center gap-1.5"
              >
                <span>{currentQuestionIndex === questions.length - 1 ? 'ফলাফল দেখুন' : 'পরবর্তী প্রশ্ন'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. SUMMARY PANEL */}
      {gameState === 'summary' && (
        <div className="text-center space-y-8 animate-fadeIn">
          <div className="space-y-3">
            <div className="mx-auto w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center animate-bounce">
              <Trophy className="w-10 h-10 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">পরীক্ষার ফলাফল রিপোর্ট</h2>
            <p className="text-sm text-slate-500 font-sans">
              দারুণ চেষ্টা! নিচে আপনার সঠিক উত্তরের পরিসংখ্যান দেওয়া হল।
            </p>
          </div>

          {/* Dashboard metric rings */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-sans max-w-md mx-auto">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-2xl font-black text-indigo-600">{score} / {questions.length}</p>
              <p className="text-xs text-slate-400 mt-1">সঠিক উত্তর</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-2xl font-black text-rose-500">{questions.length - score}</p>
              <p className="text-xs text-slate-400 mt-1">ভুল উত্তর</p>
            </div>
            <div className="bg-slate-50 col-span-2 md:col-span-1 p-4 rounded-2xl border border-slate-100">
              <p className="text-2xl font-black text-indigo-750">{Math.round((score / questions.length) * 100)}%</p>
              <p className="text-xs text-slate-400 mt-1">সফলতার হার</p>
            </div>
          </div>

          {/* Weak vocabulary list to review */}
          {incorrectWords.length > 0 && (
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">ভুল হওয়া দুর্বল শব্দসমূহ (পুনরায় পড়ুন)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-2">
                {incorrectWords.map((w, idx) => (
                  <div key={idx} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{w.word}</p>
                      <p className="text-xs text-rose-700 font-sans mt-0.5">{w.meaning}</p>
                    </div>
                    <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-sans">গ্রুপ {w.group}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Action controls */}
          <div className="flex gap-4 pt-4 border-t border-slate-100 font-sans">
            <button
              onClick={() => setGameState('setup')}
              className="flex-1 py-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              সেটআপ পেজে যান
            </button>
            <button
              onClick={startQuiz}
              className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              আবার পরীক্ষা দিন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline missing icon
function Trophy(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
      <path d="M12 2a6 6 0 0 1 6 6v5H6V8a6 6 0 0 1 6-6z" />
    </svg>
  );
}
