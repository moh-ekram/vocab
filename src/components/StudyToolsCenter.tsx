import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookMarked, 
  BookOpen, 
  CalendarCheck2, 
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import CustomLists from './CustomLists';
import SearchDictionary from './SearchDictionary';
import DailyPlanner from './DailyPlanner';
import { VocabularyWord, WordStatus, CustomFolder, UserProgress, StudyGoal } from '../types';

interface StudyToolsCenterProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRemoveFromFolder: (wordId: string, folderId: string) => void;
  onLaunchFolderStudy: (folderId: string) => void;
  goal: StudyGoal;
  setGoal: (goal: StudyGoal) => void;
  onLaunchPractice: () => void;
  initialSubTab?: 'hub' | 'lists' | 'dictionary' | 'planner';
}

export default function StudyToolsCenter({
  words,
  progress,
  folders,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  onCreateFolder,
  onDeleteFolder,
  onRemoveFromFolder,
  onLaunchFolderStudy,
  goal,
  setGoal,
  onLaunchPractice,
  initialSubTab = 'hub'
}: StudyToolsCenterProps) {
  const [subTab, setSubTab] = useState<'hub' | 'lists' | 'dictionary' | 'planner'>(initialSubTab);

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
    <div className="space-y-6" id="study-tools-center-wrapper">
      {/* Top Bar navigation when inside a specific study tool */}
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
            <button
              onClick={() => setSubTab('lists')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                subTab === 'lists'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Bookmark</span>
            </button>
            <button
              onClick={() => setSubTab('dictionary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                subTab === 'dictionary'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Dictionary</span>
            </button>
            <button
              onClick={() => setSubTab('planner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                subTab === 'planner'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>Planner</span>
            </button>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE MODE */}
      {subTab === 'hub' && (
        <div className="space-y-6">
          {/* Header Hero Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-md">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-500/30">
                Resource Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Study Tools</h2>
              <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed font-medium">
                Use the study tools below to make your learning organized and planned. Bookmarks, Dictionary, and Daily Planner are integrated here.
              </p>
            </div>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* 1. Bookmarks & Folder Lists */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setSubTab('lists')}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <BookMarked className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-lg">Bookmark & Lists</h3>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    Keep your revision process customized by bookmarking important and difficult words in custom lists.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase font-mono">{folders.length} Folders</span>
                <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-indigo-600 transition">
                  <span>Open Lists</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </motion.div>

            {/* 2. Dictionary Search Card */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setSubTab('dictionary')}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-lg">Dictionary</h3>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    Quickly search any word from the vocabulary to learn its meaning, example sentences, and synonyms.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase font-mono">Search Words</span>
                <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-indigo-600 transition">
                  <span>Open Dictionary</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </motion.div>

            {/* 3. Daily Planner Card */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setSubTab('planner')}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition duration-300 p-6 flex flex-col justify-between cursor-pointer space-y-6"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <CalendarCheck2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-lg">Daily Planner</h3>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                    Set your daily study goals and track progress to maintain consistency in your studies.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase font-mono">Goal: {goal.dailyTarget} Words</span>
                <span className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-indigo-600 transition">
                  <span>Open Planner</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}

      {subTab === 'lists' && (
        <CustomLists
          folders={folders}
          words={words}
          progress={progress}
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onRemoveFromFolder={onRemoveFromFolder}
          onLaunchFolderStudy={onLaunchFolderStudy}
        />
      )}

      {subTab === 'dictionary' && (
        <SearchDictionary
          words={words}
          progress={progress}
          folders={folders}
          onRateWord={onRateWord}
          onUpdateNotes={onUpdateNotes}
          onToggleBookmark={onToggleBookmark}
        />
      )}

      {subTab === 'planner' && (
        <DailyPlanner
          words={words}
          progress={progress}
          goal={goal}
          setGoal={setGoal}
          onLaunchPractice={onLaunchPractice}
        />
      )}
    </div>
  );
}
