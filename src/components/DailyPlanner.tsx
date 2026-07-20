import React from 'react';
import { StudyGoal, VocabularyWord, UserProgress } from '../types';
import { Calendar, CheckSquare, BrainCircuit, Calendar as CalIcon, Flame, Clock, RefreshCw, Star } from 'lucide-react';

interface DailyPlannerProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  goal: StudyGoal;
  setGoal: React.Dispatch<React.SetStateAction<StudyGoal>>;
  onLaunchPractice: () => void;
}

export default function DailyPlanner({ words, progress, goal, setGoal, onLaunchPractice }: DailyPlannerProps) {
  // Get weak words due for study
  const weakWords = words.filter(w => {
    const s = progress[w.id]?.status;
    return s === 'dont_know' || s === 'confusion';
  });

  // Calculate today's study progress
  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const todayStr = getTodayString();
  const wordsStudiedToday = goal.history[todayStr] || 0;
  const progressPercent = Math.min(100, Math.round((wordsStudiedToday / (goal.dailyTarget || 1)) * 100));

  // Calendar visualization helper (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const weekday = d.toLocaleDateString('bn-BD', { weekday: 'short' });
    const dayNum = d.getDate();
    const active = (goal.history[dStr] || 0) > 0;
    const studiedCount = goal.history[dStr] || 0;

    return {
      dateStr: dStr,
      weekday,
      dayNum,
      active,
      studiedCount
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn" id="daily-planner-container">
      {/* Left 2 Columns: Task Planner & Recommendations */}
      <div className="md:col-span-2 space-y-6">
        {/* Daily Study Planner List */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-600" />
              Today's Study Checklist
            </h3>
            <span className="text-xs text-slate-400 font-sans">Daily Action Plan</span>
          </div>

          <div className="space-y-4 font-sans">
            {/* Task 1 */}
            <div className="flex gap-4 p-4 bg-indigo-50/20 border border-indigo-100/50 rounded-xl">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm">Complete Daily Target</p>
                <p className="text-xs text-slate-500">You need to study {Math.max(0, goal.dailyTarget - wordsStudiedToday)} more words today.</p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-32 bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600">{progressPercent}% Completed</span>
                </div>
              </div>
            </div>

            {/* Task 2 */}
            <div className="flex gap-4 p-4 bg-amber-50/20 border border-amber-100/50 rounded-xl">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm">Review Weak Words</p>
                <p className="text-xs text-slate-500">You need to review <span className="font-bold text-amber-600">{weakWords.length} weak/confused words</span>.</p>
                {weakWords.length > 0 && (
                  <button
                    onClick={onLaunchPractice}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                  >
                    Start Review Session &rarr;
                  </button>
                )}
              </div>
            </div>

            {/* Task 3 */}
            <div className="flex gap-4 p-4 bg-blue-50/20 border border-blue-100/50 rounded-xl">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm">Word Match & Quiz Practice</p>
                <p className="text-xs text-slate-500">Regular quiz and word match practice doubles retention power.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cognitive Science Recommendations Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            Scientific Memory Boost Tips
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans text-xs">
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                <Star className="w-4 h-4 fill-current" />
                <span>Spaced Repetition</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Review the confused or incorrect words the next day, then 3 days later, and then 7 days later.
              </p>
            </div>

            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                <Clock className="w-4 h-4" />
                <span>Morning Reading Effect</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Cognitive learning is fastest during the first hour after waking up. Make a habit of learning at least 10 words in the morning.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Calendar Tracking Widget */}
      <div className="space-y-6">
        {/* Streak and mini-calendar tracker card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
          <div className="space-y-1 pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
              <CalIcon className="w-5 h-5 text-indigo-600" />
              Calendar & Streak Tracker
            </h3>
            <p className="text-xs text-slate-400 font-sans">Your Consistency Report</p>
          </div>

          {/* Large Streak Gauge */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-slate-50/50 p-4 rounded-xl border border-indigo-100/60 flex items-center justify-between">
            <div className="space-y-1 font-sans">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Active Streak</span>
              <p className="text-2xl font-black text-indigo-950">{goal.streak} Days</p>
            </div>
            <div className="p-3 bg-indigo-600 rounded-xl text-white animate-pulse shadow-md shadow-indigo-600/20">
              <Flame className="w-7 h-7 fill-current" />
            </div>
          </div>

          {/* Week Calendar visual */}
          <div className="space-y-3 font-sans">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last 7 Days Report</p>
            <div className="grid grid-cols-7 gap-1.5">
              {last7Days.map((d, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg flex flex-col items-center justify-between border h-16 transition ${
                    d.active
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm font-bold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                  title={`${d.dateStr}: ${d.studiedCount} words studied`}
                >
                  <span className="text-[9px] uppercase">{d.weekday}</span>
                  <span className="text-xs">{d.dayNum}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-sans text-center">
            Studying at least 1 word a day keeps your active streak alive!
          </p>
        </div>
      </div>


    </div>
  );
}
