import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  Sparkles, 
  Sparkle, 
  ArrowLeft,
  Gamepad2,
  ChevronRight,
  BookOpen,
  HelpCircle,
  Shuffle
} from 'lucide-react';
import SynonymCheck from './SynonymCheck';
import PracticeQuiz from './PracticeQuiz';
import WordMatchGame from './WordMatchGame';
import BlankFillingPractice from './BlankFillingPractice';
import OddOneOutGame from './OddOneOutGame';
import WordAnalogyGame from './WordAnalogyGame';
import { VocabularyWord, WordStatus, CustomFolder, AppSettings, UserProgress } from '../types';

interface PracticeCenterProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  folders: CustomFolder[];
  synonymProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateSynonymProgress: (wordId: string, correct: boolean) => void;
  blankProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateBlankProgress: (questionId: string, correct: boolean) => void;
  oooProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateOooProgress: (questionId: string, correct: boolean) => void;
  analogyProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateAnalogyProgress: (questionId: string, correct: boolean) => void;
  activeGroup: number | string | null;
  settings: AppSettings;
  onQuizComplete: (score: number, totalQuestions: number) => void;
  activeCourseId: string;
  enabledGames?: Record<string, boolean>;
}

export default function PracticeCenter({
  words,
  progress,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  folders,
  synonymProgress,
  onUpdateSynonymProgress,
  blankProgress,
  onUpdateBlankProgress,
  oooProgress,
  onUpdateOooProgress,
  analogyProgress,
  onUpdateAnalogyProgress,
  activeGroup,
  settings,
  onQuizComplete,
  activeCourseId,
  enabledGames
}: PracticeCenterProps) {
  const [subTab, setSubTab] = useState<'hub' | 'quiz' | 'match' | 'synonym' | 'blank' | 'odd_one_out' | 'analogy'>('hub');

  const isQuizEnabled = !enabledGames || enabledGames.quiz !== false;
  const isMatchEnabled = !enabledGames || enabledGames.match !== false;
  const isSynonymEnabled = !enabledGames || enabledGames.synonym !== false;
  const isBlankEnabled = !enabledGames || enabledGames.blank !== false;
  const isOddOneOutEnabled = !enabledGames || enabledGames.odd_one_out !== false;
  const isAnalogyEnabled = !enabledGames || enabledGames.analogy !== false;

  // Stagger animation variants for cards
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-6" id="practice-center-wrapper">
      {/* Top Bar when inside a specific tool */}
      {subTab !== 'hub' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-250/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <button
            onClick={() => setSubTab('hub')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Hub</span>
          </button>

          {/* Sub Navigation Capsules */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 scrollbar-none">
            {isQuizEnabled && (
              <button
                onClick={() => setSubTab('quiz')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'quiz'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>MCQ Quiz</span>
              </button>
            )}
            {isMatchEnabled && (
              <button
                onClick={() => setSubTab('match')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'match'
                    ? 'bg-pink-50 text-pink-700 border border-pink-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5 text-pink-650" />
                <span>Word Match</span>
              </button>
            )}
            {isSynonymEnabled && (
              <button
                onClick={() => setSubTab('synonym')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'synonym'
                    ? 'bg-amber-50 text-amber-700 border border-amber-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <Sparkle className="w-3.5 h-3.5 text-amber-500" />
                <span>Synonym Check</span>
              </button>
            )}
            {isBlankEnabled && (
              <button
                onClick={() => setSubTab('blank')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'blank'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Blank Filling</span>
              </button>
            )}
            {isOddOneOutEnabled && (
              <button
                onClick={() => setSubTab('odd_one_out')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'odd_one_out'
                    ? 'bg-sky-50 text-sky-700 border border-sky-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-650" />
                <span>Odd One Out</span>
              </button>
            )}
            {isAnalogyEnabled && (
              <button
                onClick={() => setSubTab('analogy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'analogy'
                    ? 'bg-purple-50 text-purple-700 border border-purple-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5 text-purple-600" />
                <span>Word Analogy</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* RENDER ACTIVE MODE */}
      {subTab === 'hub' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-md">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-500/30">
                Practice Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Practice & Games</h2>
              <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed font-medium">
                Review your vocabulary words in fun, interactive ways. Select one of the practice modes below to test your recall and accuracy.
              </p>
            </div>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* 1. Practice & Quiz Card */}
            {isQuizEnabled && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSubTab('quiz')}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg">MCQ Quiz</h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Test your memory recall using multiple choice questions (MCQ) and spelling checks.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase font-mono">Test Recall</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-indigo-600 transition">
                    <span>Start Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </motion.div>
            )}

            {/* 2. Word Match Game Card */}
            {isMatchEnabled && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSubTab('match')}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-pink-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100">
                    <Gamepad2 className="w-6 h-6 text-pink-650" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg">Word Match</h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Boost your reflexes and memory retention through this fast-paced card matching game.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-pink-600 tracking-wider uppercase font-mono">Play Game</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-pink-600 transition">
                    <span>Start Play</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </motion.div>
            )}

            {/* 3. Synonym Check Card */}
            {isSynonymEnabled && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSubTab('synonym')}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <Sparkle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg">Synonym Check</h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Deepen your vocabulary knowledge by matching synonyms and word meanings.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-amber-600 tracking-wider uppercase font-mono">AI Verification</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-amber-600 transition">
                    <span>Verify Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </motion.div>
            )}

            {/* 4. Blank Filling Practice Card */}
            {isBlankEnabled && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSubTab('blank')}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <BookOpen className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg">Blank Filling</h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Practice grammar, syntax, and sentence memory recall by filling in correct blanks.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-emerald-600 tracking-wider uppercase font-mono">Sentence Quiz</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-600 transition">
                    <span>Practice Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </motion.div>
            )}

            {/* 5. Odd One Out Card */}
            {isOddOneOutEnabled && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSubTab('odd_one_out')}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-sky-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                    <HelpCircle className="w-6 h-6 text-sky-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg">Odd One Out</h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Identify the word that does not belong among a group of synonyms.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-sky-600 tracking-wider uppercase font-mono">Word Selection</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-sky-600 transition">
                    <span>Play Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </motion.div>
            )}

            {/* 6. Word Analogy Card */}
            {isAnalogyEnabled && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSubTab('analogy')}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center border border-purple-100">
                    <Shuffle className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-lg">Word Analogy</h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                      Solve logic relationships between word pairs.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-purple-600 tracking-wider uppercase font-mono">Logic Challenge</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-purple-600 transition">
                    <span>Solve Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </motion.div>
            )}

            {/* Empty State when no games are enabled */}
            {!isQuizEnabled && !isMatchEnabled && !isSynonymEnabled && !isBlankEnabled && !isOddOneOutEnabled && !isAnalogyEnabled && (
              <div className="col-span-full py-12 text-center bg-white border border-slate-150 rounded-3xl p-8 space-y-3">
                <Gamepad2 className="w-12 h-12 text-slate-350 mx-auto" />
                <h3 className="font-extrabold text-slate-700 text-base">No practices or games available</h3>
                <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                  The admin has not enabled any practice or game options for this course.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {subTab === 'quiz' && (
        <PracticeQuiz
          words={words}
          progress={progress}
          onRateWord={onRateWord}
          activeGroup={activeGroup}
          settings={settings}
          onQuizComplete={onQuizComplete}
        />
      )}

      {subTab === 'match' && (
        <WordMatchGame
          words={words}
          activeGroup={typeof activeGroup === 'number' ? activeGroup : (typeof activeGroup === 'string' ? parseInt(activeGroup, 10) || null : null)}
          settings={settings}
        />
      )}

      {subTab === 'synonym' && (
        <SynonymCheck
          words={words}
          synonymProgress={synonymProgress}
          onUpdateSynonymProgress={onUpdateSynonymProgress}
          activeGroup={activeGroup}
          progress={progress}
          folders={folders}
          onRateWord={onRateWord}
          onUpdateNotes={onUpdateNotes}
          onToggleBookmark={onToggleBookmark}
          settings={settings}
        />
      )}

      {subTab === 'blank' && (
        <BlankFillingPractice
          blankProgress={blankProgress}
          onUpdateBlankProgress={onUpdateBlankProgress}
          activeCourseId={activeCourseId}
          words={words}
        />
      )}

      {subTab === 'odd_one_out' && (
        <OddOneOutGame
          progress={oooProgress}
          onUpdateProgress={onUpdateOooProgress}
          activeCourseId={activeCourseId}
          words={words}
        />
      )}

      {subTab === 'analogy' && (
        <WordAnalogyGame
          progress={analogyProgress}
          onUpdateProgress={onUpdateAnalogyProgress}
          activeCourseId={activeCourseId}
          words={words}
        />
      )}
    </div>
  );
}
