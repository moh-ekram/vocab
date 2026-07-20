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
  ChevronRight
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OddOneOutQuestion, VocabularyWord } from '../types';

interface OddOneOutGameProps {
  progress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateProgress: (questionId: string, correct: boolean) => void;
  activeCourseId: string;
  words?: VocabularyWord[];
}

const DEFAULT_QUESTIONS: OddOneOutQuestion[] = [
  {
    id: 'ooo-def-1',
    words: ["benevolent", "generous", "kind", "malevolent"],
    answer: "malevolent",
    reason: "malevolent means showing ill-will, whereas others mean kind and giving."
  },
  {
    id: 'ooo-def-2',
    words: ["ephemeral", "transient", "fleeting", "permanent"],
    answer: "permanent",
    reason: "permanent means lasting forever, whereas others mean short-lived."
  },
  {
    id: 'ooo-def-3',
    words: ["frugal", "thrifty", "economical", "extravagant"],
    answer: "extravagant",
    reason: "extravagant means wasteful with money, whereas others mean wise spending."
  },
  {
    id: 'ooo-def-4',
    words: ["lucid", "coherent", "clear", "opaque"],
    answer: "opaque",
    reason: "opaque means difficult to understand or see through, whereas others mean clear."
  },
  {
    id: 'ooo-def-5',
    words: ["loquacious", "garrulous", "talkative", "taciturn"],
    answer: "taciturn",
    reason: "taciturn means reserved or uncommunicative in speech, whereas others mean talkative."
  }
];

export default function OddOneOutGame({
  progress,
  onUpdateProgress,
  activeCourseId,
  words
}: OddOneOutGameProps) {
  const [allQuestions, setAllQuestions] = useState<OddOneOutQuestion[]>([]);
  const [questions, setQuestions] = useState<OddOneOutQuestion[]>([]);
  const [activeFilter, setActiveFilter] = useState<'yet_to_try' | 'incorrect' | 'done'>('yet_to_try');
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

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

  // Fetch from Firestore or auto-generate
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const qSnap = await getDocs(collection(db, 'odd_one_out_questions'));
        const loaded: OddOneOutQuestion[] = [];
        qSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (
            (data.courseId && activeCourseId && data.courseId.toLowerCase() === activeCourseId.toLowerCase()) ||
            (!data.courseId && activeCourseId === 'gre')
          ) {
            loaded.push({ id: docSnap.id, ...data } as OddOneOutQuestion);
          }
        });

        if (loaded.length > 0) {
          setAllQuestions(loaded);
        } else {
          // Fallback or generator
          if (activeCourseId === 'gre') {
            setAllQuestions(DEFAULT_QUESTIONS);
          } else if (words && words.length > 3) {
            // Smart automatic generation based on vocabulary synonyms!
            const generated: OddOneOutQuestion[] = [];
            
            // Loop through words and see if we have synonyms declared
            words.forEach((w, idx) => {
              const synonymsList = w.synonyms
                ? w.synonyms.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)
                : [];
              
              if (synonymsList.length >= 2) {
                // Find a distractor word that is NOT in the synonyms list
                const distractors = words
                  .filter(other => other.id !== w.id && !synonymsList.includes(other.word.toLowerCase()) && other.word.toLowerCase() !== w.word.toLowerCase())
                  .map(other => other.word);
                
                if (distractors.length > 0) {
                  const oddWord = distractors[Math.floor(Math.random() * distractors.length)];
                  const oooWords = [w.word, ...synonymsList.slice(0, 2), oddWord];
                  // Shuffle choices
                  const shuffled = [...oooWords].sort(() => 0.5 - Math.random());
                  
                  generated.push({
                    id: `ooo-gen-${w.id}-${idx}`,
                    words: shuffled,
                    answer: oddWord,
                    reason: `"${oddWord}" is the odd one out because the other three words ("${w.word}", "${synonymsList[0]}", "${synonymsList[1]}") are synonyms meaning "${w.meaning}".`,
                    courseId: activeCourseId
                  });
                }
              }
            });

            if (generated.length >= 5) {
              setAllQuestions(generated.slice(0, 20));
            } else {
              setAllQuestions(DEFAULT_QUESTIONS);
            }
          } else {
            setAllQuestions(DEFAULT_QUESTIONS);
          }
        }
      } catch (err) {
        console.error('Error loading OOO questions:', err);
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
          <p className="text-xs text-slate-400 mt-1">No Odd One Out questions are loaded yet.</p>
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
    <div className="max-w-2xl mx-auto space-y-6" id="ooo-game-container">
      {/* Game Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest font-mono">Active Game Mode</span>
          <h4 className="text-sm font-extrabold text-slate-800">Odd One Out Quiz</h4>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-400">Question: </span>
          <span className="text-xs font-black text-indigo-600 font-mono">
            {questions.length > 0 ? `${currentIndex + 1} / ${questions.length}` : '0 / 0'}
          </span>
        </div>
      </div>

      {/* Segmented Filter Control */}
      <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200/55 flex gap-1 w-full" id="ooo-practice-filters">
        <button
          onClick={() => applyFilter('yet_to_try')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeFilter === 'yet_to_try'
              ? 'bg-white text-indigo-600 shadow-xs font-extrabold border border-indigo-100/30'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <HelpCircle className={`w-3.5 h-3.5 ${activeFilter === 'yet_to_try' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span>Yet to Try ({counts.yet_to_try})</span>
        </button>

        <button
          onClick={() => applyFilter('incorrect')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeFilter === 'incorrect'
              ? 'bg-white text-rose-600 shadow-xs font-extrabold border border-rose-100/30'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <XCircle className={`w-3.5 h-3.5 ${activeFilter === 'incorrect' ? 'text-rose-500' : 'text-slate-400'}`} />
          <span>Incorrect ({counts.incorrect})</span>
        </button>

        <button
          onClick={() => applyFilter('done')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeFilter === 'done'
              ? 'bg-white text-emerald-600 shadow-xs font-extrabold border border-emerald-100/30'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
          }`}
        >
          <CheckCircle className={`w-3.5 h-3.5 ${activeFilter === 'done' ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span>Correct ({counts.done})</span>
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs text-center space-y-4">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-sm font-extrabold text-slate-700">No questions found in this category</h4>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              {activeFilter === 'yet_to_try' && "You have tried all the Odd One Out questions! Great job!"}
              {activeFilter === 'incorrect' && "Excellent accuracy! You have no incorrect Odd One Out questions!"}
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
            <h3 className="text-lg font-extrabold text-slate-800">Identify the Odd One Out</h3>
            <p className="text-xs text-slate-400">Three of these words share a meaning or relationship. One is different.</p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-4">
            {currentQuestion.words.map((option, index) => {
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
                  className={`p-5 rounded-2xl border-2 text-center text-sm font-bold font-mono transition duration-200 cursor-pointer ${btnClass}`}
                >
                  <span className="block mb-1">{option}</span>
                  <div className="flex justify-center mt-1">
                    {isAnswered && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    {isAnswered && !isCorrect && isSelected && <XCircle className="w-4 h-4 text-rose-600" />}
                  </div>
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
                  <span className="font-extrabold text-slate-800 block mb-1">Explanation:</span>
                  {currentQuestion.reason ? currentQuestion.reason : "Explanation not found"}
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
    </div>
  );
}
