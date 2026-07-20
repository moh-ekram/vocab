import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Award, 
  ChevronRight, 
  HelpCircle, 
  Trophy,
  Activity,
  Check,
  X
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BlankQuestion, VocabularyWord } from '../types';

interface BlankFillingPracticeProps {
  blankProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateBlankProgress: (questionId: string, correct: boolean) => void;
  activeCourseId: string;
  words?: VocabularyWord[];
}

const DEFAULT_QUESTIONS: BlankQuestion[] = [
  {
    id: 'bq-def-1',
    sentence: "Success is not final, failure is not fatal: it is the ___ to continue that counts.",
    options: ["courage", "fear", "money", "power"],
    answer: "courage"
  },
  {
    id: 'bq-def-2',
    sentence: "The weather is so ___ today that everyone wants to go outside and play.",
    options: ["sunny", "gloomy", "stormy", "freezing"],
    answer: "sunny"
  },
  {
    id: 'bq-def-3',
    sentence: "A journey of a thousand miles begins with a single ___.",
    options: ["step", "dream", "mile", "jump"],
    answer: "step"
  },
  {
    id: 'bq-def-4',
    sentence: "Reading is to the mind what ___ is to the body.",
    options: ["exercise", "sleep", "food", "music"],
    answer: "exercise"
  },
  {
    id: 'bq-def-5',
    sentence: "An apple a day keeps the ___ away.",
    options: ["doctor", "dentist", "teacher", "lawyer"],
    answer: "doctor"
  }
];

export default function BlankFillingPractice({
  blankProgress,
  onUpdateBlankProgress,
  activeCourseId,
  words
}: BlankFillingPracticeProps) {
  const [questions, setQuestions] = useState<BlankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Fetch blank questions from Firestore on mount/activeCourseId change
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const qSnap = await getDocs(collection(db, 'blank_questions'));
        const loaded: BlankQuestion[] = [];
        qSnap.forEach(docSnap => {
          const data = docSnap.data();
          // Filter by active course or if courseId is empty default to gre
          if (
            (data.courseId && activeCourseId && data.courseId.toLowerCase() === activeCourseId.toLowerCase()) ||
            (!data.courseId && activeCourseId === 'gre')
          ) {
            loaded.push({ id: docSnap.id, ...data } as BlankQuestion);
          }
        });
        
        if (loaded.length > 0) {
          setQuestions(loaded);
        } else {
          // Fallback to default high-quality questions for default GRE or if none uploaded yet
          if (activeCourseId === 'gre') {
            setQuestions(DEFAULT_QUESTIONS);
          } else if (words && words.length > 0) {
            // Auto-generate high-quality practice questions from vocabulary words
            const generated: BlankQuestion[] = [];
            
            const makeOptionsForWord = (correctWord: string) => {
              const distractors = words
                .filter(w => w.word !== correctWord)
                .map(w => w.word);
              const shuffledDist = [...distractors].sort(() => 0.5 - Math.random());
              const picked = shuffledDist.slice(0, 3);
              while (picked.length < 3) {
                picked.push("Option " + (picked.length + 1));
              }
              const opts = [correctWord, ...picked];
              return opts.sort(() => 0.5 - Math.random());
            };

            // First: Generate from words that have example sentences
            const wordsWithExample = words.filter(w => w.example && w.example.trim().length > 0);
            wordsWithExample.forEach((w, index) => {
              const wordLower = w.word.toLowerCase();
              let sentence = w.example || '';
              const regex = new RegExp(`\\b${w.word}[a-z]*\\b`, 'gi');
              let hasReplaced = false;

              if (sentence.toLowerCase().includes(wordLower)) {
                sentence = sentence.replace(regex, '___');
                hasReplaced = true;
              } else {
                const idx = sentence.toLowerCase().indexOf(wordLower);
                if (idx !== -1) {
                  sentence = sentence.substring(0, idx) + '___' + sentence.substring(idx + w.word.length);
                  hasReplaced = true;
                }
              }

              if (hasReplaced && sentence.includes('___')) {
                generated.push({
                  id: `bq-gen-${w.id}-${index}`,
                  sentence: sentence,
                  options: makeOptionsForWord(w.word),
                  answer: w.word,
                  courseId: activeCourseId
                });
              }
            });

            // Second: Generate definition/meaning match questions if we need more or don't have enough examples
            if (generated.length < 15 && words.length > 0) {
              const remainingNeeded = 20 - generated.length;
              const wordsForMeanings = words
                .filter(w => !generated.some(g => g.answer === w.word))
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.max(0, remainingNeeded));

              wordsForMeanings.forEach((w, index) => {
                generated.push({
                  id: `bq-gen-mean-${w.id}-${index}`,
                  sentence: `Choose the correct word that matches the meaning: "${w.meaning}"`,
                  options: makeOptionsForWord(w.word),
                  answer: w.word,
                  courseId: activeCourseId
                });
              });
            }

            // Shuffle the complete generated list and select up to 20 for a bite-sized practice session
            const randomized = [...generated].sort(() => 0.5 - Math.random()).slice(0, 20);
            setQuestions(randomized);
          } else {
            setQuestions([]);
          }
        }
      } catch (err) {
        console.error('Error fetching blank questions:', err);
        if (activeCourseId === 'gre') {
          setQuestions(DEFAULT_QUESTIONS);
        } else {
          setQuestions([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [activeCourseId, words]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col items-center justify-center space-y-4 min-h-[350px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 font-mono">Loading questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs text-center space-y-4">
        <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
        <div>
          <p className="text-sm font-bold text-slate-700">No questions found</p>
          <p className="text-xs text-slate-400 mt-1">No blank filling questions have been uploaded for this course yet.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  
  // Calculate total progress stats based on current database
  const totalCorrectInHistory = Object.values(blankProgress).filter(p => p.correct).length;
  const totalQuestionsInDatabase = questions.length;

  const handleSelectOption = (option: string) => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQuestion.answer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Save to Firestore and state via parent handler
    onUpdateBlankProgress(currentQuestion.id, isCorrect);
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
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setSessionCompleted(false);
  };

  // Render Completion Screen
  if (sessionCompleted) {
    const accuracy = Math.round((score / questions.length) * 100);
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/60 shadow-md text-center space-y-8 max-w-lg mx-auto"
      >
        <div className="w-20 h-20 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-sm">
          <Trophy className="w-10 h-10 text-indigo-500" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-black text-slate-800">Practice Completed!</h3>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Session Summary</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <span className="text-2xl font-black text-slate-850">{score} / {questions.length}</span>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Correct Answers</p>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <span className="text-2xl font-black text-indigo-600">{accuracy}%</span>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Accuracy Level</p>
          </div>
        </div>

        {/* Total stats progress */}
        <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 flex items-center gap-3 justify-center text-left">
          <Activity className="w-5 h-5 text-indigo-500" />
          <div>
            <p className="text-xs font-black text-slate-800">Total Progress</p>
            <p className="text-[11px] text-slate-500 font-medium">
              You have successfully answered {totalCorrectInHistory} of {totalQuestionsInDatabase} total questions in the database.
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
    );
  }

  const sentenceParts = currentQuestion.sentence.split('___');

  return (
    <div className="max-w-2xl mx-auto space-y-6" id="blank-practice-container">
      {/* Session Progress Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest font-mono">Active Game Mode</span>
          <h4 className="text-sm font-extrabold text-slate-800">Blank Filling Practice</h4>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-400">Question: </span>
          <span className="text-xs font-black text-indigo-600 font-mono">{currentIndex + 1} / {questions.length}</span>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/60 shadow-sm space-y-8 relative overflow-hidden">
        {/* Absolute Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Sentence display with styled blank */}
        <div className="text-base sm:text-lg font-extrabold text-slate-800 leading-relaxed text-center py-4">
          {sentenceParts[0]}
          <span className={`inline-block px-3 py-1 mx-1.5 rounded-xl border-2 font-mono text-xs sm:text-sm transition-all duration-300 ${
            isAnswered 
            ? (selectedOption === currentQuestion.answer 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                : 'bg-rose-50 text-rose-700 border-rose-300')
            : 'bg-indigo-50/50 text-indigo-600 border-dashed border-indigo-200 min-w-[70px] text-center'
          }`}>
            {isAnswered ? selectedOption : '___'}
          </span>
          {sentenceParts[1]}
        </div>

        {/* Options Cards Grid */}
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
                className={`p-4 rounded-xl border-2 text-left text-xs font-bold transition duration-200 flex items-center justify-between cursor-pointer ${btnClass}`}
              >
                <span>{option}</span>
                {isAnswered && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                {isAnswered && !isCorrect && isSelected && <XCircle className="w-4 h-4 text-rose-600" />}
              </button>
            );
          })}
        </div>

        {/* Answer feedback / Next Button */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100"
            >
              <div className="flex items-center gap-2.5 text-xs">
                {selectedOption === currentQuestion.answer ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-extrabold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                    <Check className="w-3.5 h-3.5" />
                    Correct Answer
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 font-extrabold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                    <X className="w-3.5 h-3.5" />
                    Incorrect! Correct answer is: {currentQuestion.answer}
                  </span>
                )}
              </div>

              <button
                onClick={handleNext}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>{currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress Counter Recording */}
      <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-slate-400" />
          <span>All-time Progress Record</span>
        </span>
        <span className="font-black text-slate-700">
          Correct Solutions: {totalCorrectInHistory} / {totalQuestionsInDatabase}
        </span>
      </div>
    </div>
  );
}
