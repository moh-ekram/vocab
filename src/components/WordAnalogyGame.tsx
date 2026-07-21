import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trophy,
  Activity,
  Check,
  X,
  HelpCircle,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WordAnalogyQuestion, VocabularyWord } from '../types';

interface WordAnalogyGameProps {
  progress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateProgress: (questionId: string, correct: boolean) => void;
  activeCourseId: string;
  words?: VocabularyWord[];
  onBack: () => void;
}

const DEFAULT_QUESTIONS: WordAnalogyQuestion[] = [
  {
    id: 'ana-def-1',
    analogy: "Meticulous : Care",
    options: ["Garrulous : Talk", "Taciturn : Words", "Frugal : Money", "Soporific : Sleep"],
    answer: "Garrulous : Talk",
    explanation: "A meticulous person is characterized by extreme care. Similarly, a garrulous person is characterized by excessive talk/chatter."
  },
  {
    id: 'ana-def-2',
    analogy: "Ephemeral : Eternity",
    options: ["Transient : Time", "Fleeting : Hour", "Taciturn : Speech", "Infinite : Space"],
    answer: "Taciturn : Speech",
    explanation: "Ephemeral represents a lack of eternity. Similarly, taciturn represents a lack of speech/talking."
  },
  {
    id: 'ana-def-3',
    analogy: "Benevolent : Kindness",
    options: ["Malevolent : Spite", "Magnanimous : Greed", "Honest : Deceit", "Parsimonious : Charity"],
    answer: "Malevolent : Spite",
    explanation: "A benevolent person displays kindness. Similarly, a malevolent person displays spite."
  },
  {
    id: 'ana-def-4',
    analogy: "Antipathy : Affection",
    options: ["Apathy : Interest", "Sympathy : Love", "Anger : Rage", "Pride : Arrogance"],
    answer: "Apathy : Interest",
    explanation: "Antipathy is the opposite of affection. Similarly, apathy is the opposite of interest."
  },
  {
    id: 'ana-def-5',
    analogy: "Gullible : Deceive",
    options: ["Docile : Control", "Stubborn : Persuade", "Smart : Teach", "Fearful : Scared"],
    answer: "Docile : Control",
    explanation: "A gullible person is easy to deceive. Similarly, a docile person is easy to control."
  }
];

export default function WordAnalogyGame({
  progress,
  onUpdateProgress,
  activeCourseId,
  words,
  onBack
}: WordAnalogyGameProps) {
  const [allQuestions, setAllQuestions] = useState<WordAnalogyQuestion[]>([]);
  const [questions, setQuestions] = useState<WordAnalogyQuestion[]>([]);
  const [activeFilter, setActiveFilter] = useState<'yet_to_try' | 'incorrect' | 'done'>('yet_to_try');
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  // Compute counts for filtering tabs
  const counts = React.useMemo(() => {
    let yetToTry = 0;
    let incorrect = 0;
    let done = 0;
    allQuestions.forEach(q => {
      const prog = progress[q.id];
      if (!prog) {
        yetToTry++;
      } else if (!prog.correct) {
        incorrect++;
      } else {
        done++;
      }
    });
    return { yet_to_try: yetToTry, incorrect, done };
  }, [allQuestions, progress]);

  // Fetch from Firestore or fallback
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const qSnap = await getDocs(collection(db, 'word_analogy_questions'));
        const loaded: WordAnalogyQuestion[] = [];
        qSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (
            (data.courseId && activeCourseId && data.courseId.toLowerCase() === activeCourseId.toLowerCase()) ||
            (!data.courseId && activeCourseId === 'gre')
          ) {
            loaded.push({ id: docSnap.id, ...data } as WordAnalogyQuestion);
          }
        });

        if (loaded.length > 0) {
          setAllQuestions(loaded);
        } else {
          // Fallback
          setAllQuestions(DEFAULT_QUESTIONS);
        }
      } catch (err) {
        console.error('Error loading analogy questions:', err);
        setAllQuestions(DEFAULT_QUESTIONS);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [activeCourseId, words]);

  const applyFilter = (filterType: 'yet_to_try' | 'incorrect' | 'done', pool = allQuestions) => {
    setActiveFilter(filterType);
    const filtered = pool.filter(q => {
      const prog = progress[q.id];
      if (filterType === 'yet_to_try') {
        return !prog;
      } else if (filterType === 'incorrect') {
        return prog && !prog.correct;
      } else {
        return prog && prog.correct;
      }
    });
    setQuestions(filtered);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setSessionCompleted(false);
    setShowFeedbackPopup(false);
  };

  useEffect(() => {
    if (allQuestions.length === 0) {
      setQuestions([]);
      return;
    }

    let yetToTryCount = 0;
    let incorrectCount = 0;

    allQuestions.forEach(q => {
      const prog = progress[q.id];
      if (!prog) {
        yetToTryCount++;
      } else if (!prog.correct) {
        incorrectCount++;
      }
    });

    let targetFilter: 'yet_to_try' | 'incorrect' | 'done' = 'yet_to_try';
    if (yetToTryCount > 0) {
      targetFilter = 'yet_to_try';
    } else if (incorrectCount > 0) {
      targetFilter = 'incorrect';
    } else {
      targetFilter = 'done';
    }

    applyFilter(targetFilter, allQuestions);
  }, [allQuestions]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col items-center justify-center space-y-4 min-h-[350px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 font-mono">Loading game...</p>
      </div>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs text-center space-y-4">
        <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
        <div>
          <p className="text-sm font-bold text-slate-700">No questions found</p>
          <p className="text-xs text-slate-400 mt-1">No Analogy questions are loaded yet.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalCorrectInHistory = Object.values(progress).filter(p => p.correct).length;
  const totalQuestionsInDatabase = allQuestions.length;

  const handleSelectOption = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQuestion.answer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    onUpdateProgress(currentQuestion.id, isCorrect);
    setShowFeedbackPopup(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setSessionCompleted(true);
    }
  };

  const handleRestart = () => {
    applyFilter(activeFilter);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4" id="analogy-game-container">
      {/* Unified Compact Header */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-850 transition cursor-pointer flex items-center justify-center"
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-[1px] bg-slate-200" />
          <div>
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <span>Word Analogy</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-md font-mono font-bold">
                {questions.length > 0 ? `${currentIndex + 1} / ${questions.length}` : '0 / 0'}
              </span>
            </h4>
          </div>
        </div>

        {/* Slim Segmented Filter Row */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/55">
          <button
            onClick={() => applyFilter('yet_to_try')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'yet_to_try'
                ? 'bg-white text-indigo-600 shadow-xs border border-indigo-100/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>Yet to Try ({counts.yet_to_try})</span>
          </button>

          <button
            onClick={() => applyFilter('incorrect')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'incorrect'
                ? 'bg-white text-rose-600 shadow-xs border border-rose-100/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>Incorrect ({counts.incorrect})</span>
          </button>

          <button
            onClick={() => applyFilter('done')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'done'
                ? 'bg-white text-emerald-600 shadow-xs border border-emerald-100/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span>Correct ({counts.done})</span>
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs text-center space-y-4">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-sm font-extrabold text-slate-700">No questions found in this category</h4>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              {activeFilter === 'yet_to_try' && "You have tried all the Word Analogy questions! Excellent job!"}
              {activeFilter === 'incorrect' && "Fantastic accuracy! You have no incorrect Word Analogy questions!"}
              {activeFilter === 'done' && "Answer questions correctly to see them here!"}
            </p>
          </div>
        </div>
      ) : sessionCompleted ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/60 shadow-md text-center space-y-8 max-w-lg mx-auto"
        >
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-sm">
            <Trophy className="w-10 h-10 text-indigo-500" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Game Completed!</h3>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider font-mono">Session Summary</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <span className="text-2xl font-black text-slate-800">{score} / {questions.length}</span>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Correct Choices</p>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <span className="text-2xl font-black text-indigo-600">{Math.round((score / questions.length) * 100)}%</span>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Accuracy Level</p>
            </div>
          </div>

          <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 flex items-center gap-3 justify-center text-left">
            <Activity className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-xs font-black text-slate-800">Total Progress</p>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                You have solved {totalCorrectInHistory} of {totalQuestionsInDatabase} total questions.
              </p>
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl transition cursor-pointer shadow-sm shadow-indigo-500/10 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restart Session</span>
          </button>
        </motion.div>
      ) : (
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/60 shadow-sm space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-2 text-center py-4">
            <h3 className="text-xs font-extrabold text-indigo-600 tracking-wider uppercase font-mono">Word Analogy</h3>
            <p className="text-sm text-slate-500">Select the pair of words that best matches the relationship of the given pair:</p>
            
            <div className="my-6 inline-block bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4">
              <span className="text-xl font-black text-indigo-900 font-mono tracking-tight">{currentQuestion.analogy}</span>
            </div>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentQuestion.answer;
              
              let btnClass = "bg-slate-50 hover:bg-slate-100/70 border-slate-200 text-slate-700 hover:border-indigo-200";
              if (isAnswered) {
                if (isCorrect) {
                  btnClass = "bg-emerald-50 border-emerald-300 text-emerald-700 font-black";
                } else if (isSelected) {
                  btnClass = "bg-rose-50 border-rose-300 text-rose-700 font-black";
                } else {
                  btnClass = "bg-slate-50/50 border-slate-100 text-slate-400 opacity-60";
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(option)}
                  disabled={isAnswered}
                  className={`p-4 rounded-xl border-2 text-left text-sm font-bold font-mono transition duration-200 flex items-center justify-between cursor-pointer ${btnClass}`}
                >
                  <span>{option}</span>
                  {isAnswered && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                  {isAnswered && !isCorrect && isSelected && <XCircle className="w-4 h-4 text-rose-600" />}
                </button>
              );
            })}
          </div>

          {/* Explanation & Next */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-6 pt-6 border-t border-slate-100"
              >
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                  <span className="font-extrabold text-slate-800 block mb-1">Explanation / Analogy Logic:</span>
                  {currentQuestion.explanation ? currentQuestion.explanation : "Explanation not found"}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    {selectedOption === currentQuestion.answer ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-extrabold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-xs">
                        <Check className="w-3.5 h-3.5" /> Correct
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-600 font-extrabold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 text-xs">
                        <X className="w-3.5 h-3.5" /> Incorrect
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleNext}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <span>{currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Feedback Popup Modal */}
      <AnimatePresence>
        {showFeedbackPopup && currentQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden relative"
            >
              {/* Top Banner indicating success/fail */}
              <div className={`p-6 text-center relative ${
                selectedOption === currentQuestion.answer 
                  ? 'bg-emerald-50 text-emerald-850 border-b border-emerald-100' 
                  : 'bg-rose-50 text-rose-800 border-b border-rose-100'
              }`}>
                {/* Close Button top-right */}
                <button
                  onClick={() => setShowFeedbackPopup(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 text-slate-450 hover:text-slate-750 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-3">
                  {selectedOption === currentQuestion.answer ? (
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md">
                      <X className="w-6 h-6 stroke-[3]" />
                    </div>
                  )}
                </div>

                <h4 className="text-3xl font-extrabold tracking-tight font-sans">
                  {selectedOption === currentQuestion.answer ? 'Correct' : 'Incorrect'}
                </h4>
                <div className="mt-4 px-6 py-2.5 bg-white/60 dark:bg-black/25 rounded-2xl inline-block border border-white/50 dark:border-white/5 shadow-inner">
                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-sans">Correct Answer</div>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-850 dark:text-white font-sans select-all">
                    {currentQuestion.answer}
                  </div>
                </div>
              </div>

              {/* Middle Explanation */}
              <div className="p-6 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">ব্যাখ্যা (Explanation)</span>
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-xs font-semibold text-slate-600 leading-relaxed max-h-[200px] overflow-y-auto">
                  {currentQuestion.explanation ? currentQuestion.explanation : "এই প্রশ্নের জন্য কোনো ব্যাখ্যা পাওয়া যায়নি।"}
                </div>
              </div>

              {/* Bottom Next Button */}
              <div className="p-6 pt-0 flex justify-end">
                <button
                  onClick={() => {
                    setShowFeedbackPopup(false);
                    handleNext();
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl transition cursor-pointer shadow-sm shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  <span>{currentIndex === questions.length - 1 ? 'সব শেষ (Finish)' : 'পরবর্তী প্রশ্ন (Next Question)'}</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
