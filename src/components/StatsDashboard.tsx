import React, { useState } from 'react';
import { VocabularyWord, WordStatus, UserProgress, StudyGoal } from '../types';
import { Award, BookOpen, Flame, CheckCircle, AlertTriangle, XCircle, HelpCircle, Trophy, TrendingUp, Search } from 'lucide-react';

interface StatsDashboardProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  goal: StudyGoal;
  setGoal: React.Dispatch<React.SetStateAction<StudyGoal>>;
  onSelectGroup: (group: number) => void;
}

export default function StatsDashboard({ words, progress, goal, setGoal, onSelectGroup }: StatsDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Calculate overall counts
  const totalWords = words.length;
  let knowCount = 0;
  let dontKnowCount = 0;
  let confusionCount = 0;
  let unratedCount = 0;

  words.forEach(w => {
    const status = progress[w.id]?.status || 'unrated';
    if (status === 'know') knowCount++;
    else if (status === 'dont_know') dontKnowCount++;
    else if (status === 'confusion') confusionCount++;
    else unratedCount++;
  });

  const overallCompleteness = totalWords > 0 ? Math.round((knowCount / totalWords) * 100) : 0;

  // 2. Group wise statistics
  const groupStats = Array.from({ length: 37 }, (_, i) => {
    const groupNum = i + 1;
    const groupWords = words.filter(w => w.group === groupNum);
    const total = groupWords.length;
    let groupKnow = 0;
    let groupDontKnow = 0;
    let groupConfusion = 0;

    groupWords.forEach(w => {
      const status = progress[w.id]?.status || 'unrated';
      if (status === 'know') groupKnow++;
      else if (status === 'dont_know') groupDontKnow++;
      else if (status === 'confusion') groupConfusion++;
    });

    const completionPercent = total > 0 ? Math.round((groupKnow / total) * 100) : 0;

    return {
      group: groupNum,
      total,
      know: groupKnow,
      dontKnow: groupDontKnow,
      confusion: groupConfusion,
      percent: completionPercent
    };
  });

  // Filter groups
  const filteredGroups = groupStats.filter(g => {
    if (!searchTerm) return true;
    return `গ্রুপ ${g.group}`.includes(searchTerm) || g.group.toString() === searchTerm;
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

  return (
    <div className="space-y-8" id="stats-dashboard-container">
      {/* Top Banner with Streak & Daily Target */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-indigo-950/15 relative overflow-hidden" id="dashboard-welcome-banner">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black font-sans tracking-tight">আপনার শব্দভাণ্ডার ড্যাশবোর্ড</h2>
            <p className="text-indigo-200 text-sm md:text-base font-sans font-medium">
              ৩৭টি গ্রুপ জুড়ে আপনার শেখার অগ্রগতি ট্র্যাক করুন এবং ভোকাবুলারি আয়ত্তে আনুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Streak card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-white/10 shadow-xs">
              <div className="p-2 bg-amber-400 rounded-xl text-amber-950 animate-pulse">
                <Flame className="w-6 h-6 fill-current" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-sans">অ্যাক্টিভ স্ট্রিক</p>
                <p className="text-xl font-black font-sans">{goal.streak} দিন</p>
              </div>
            </div>

            {/* Daily Goal card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-white/10 shadow-xs">
              <div className="p-2 bg-indigo-500 rounded-xl text-white">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-sans">আজকের লক্ষ্য ({wordsStudiedToday}/{goal.dailyTarget})</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black font-sans">{progressPercent}%</p>
                  <div className="w-20 bg-indigo-950/60 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full transition-all duration-350" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" id="stats-grid-cards">
        {/* Total words */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট শব্দ</p>
            <p className="text-2xl font-black font-sans text-slate-850">{totalWords}</p>
          </div>
        </div>

        {/* Know */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">পারি</p>
            <p className="text-2xl font-black font-sans text-indigo-600">{knowCount}</p>
          </div>
        </div>

        {/* Confusion */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">কনফিউশন</p>
            <p className="text-2xl font-black font-sans text-amber-600">{confusionCount}</p>
          </div>
        </div>

        {/* Don't Know */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">পারি না</p>
            <p className="text-2xl font-black font-sans text-rose-600">{dontKnowCount}</p>
          </div>
        </div>

        {/* Unrated */}
        <div className="bg-white col-span-2 lg:col-span-1 p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">পড়া হয়নি</p>
            <p className="text-2xl font-black font-sans text-slate-500">{unratedCount}</p>
          </div>
        </div>
      </div>

      {/* Visual Progress Chart & Goal Editing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="charts-and-goals">
        {/* Progress Representation */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs lg:col-span-2 flex flex-col md:flex-row items-center gap-8">
          <div className="relative flex-shrink-0 w-36 h-36">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="72" cy="72" r="60" className="text-slate-100" strokeWidth="12" stroke="currentColor" fill="transparent" />
              <circle cx="72" cy="72" r="60" className="text-indigo-600 transition-all duration-500" strokeWidth="12" strokeDasharray={376.8} strokeDashoffset={376.8 - (376.8 * overallCompleteness) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black text-slate-800 font-sans">{overallCompleteness}%</p>
              <p className="text-xs text-slate-450 font-bold font-sans">সম্পন্ন</p>
            </div>
          </div>

          <div className="flex-1 space-y-4 w-full">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              শেখার সামগ্রিক বন্টন
            </h3>
            <p className="text-sm text-slate-500 font-sans leading-relaxed">
              আপনার অগ্রগতি এবং শেখা শব্দের পরিসংখ্যান। যত বেশি শব্দ সম্পন্ন হবে, আপনার ভোকাবুলারি মেমোরি রিটেনশন তত বাড়বে!
            </p>

            {/* Custom Bar Breakdown */}
            <div className="space-y-3 font-sans">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>পারি (সম্পন্ন)</span>
                  <span className="text-indigo-600">{knowCount} শব্দ ({totalWords > 0 ? Math.round((knowCount / totalWords) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full" style={{ width: `${totalWords > 0 ? (knowCount / totalWords) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>কনফিউশন আছে</span>
                  <span className="text-amber-600">{confusionCount} শব্দ ({totalWords > 0 ? Math.round((confusionCount / totalWords) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full" style={{ width: `${totalWords > 0 ? (confusionCount / totalWords) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>পারি না</span>
                  <span className="text-rose-600">{dontKnowCount} শব্দ ({totalWords > 0 ? Math.round((dontKnowCount / totalWords) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full" style={{ width: `${totalWords > 0 ? (dontKnowCount / totalWords) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Goal Settings Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-indigo-600" />
              দৈনিক লক্ষ্য সেট করুন
            </h3>
            <p className="text-sm text-slate-500 font-sans mb-4 leading-relaxed">
              আপনার শেখার গতি বাড়াতে প্রতিদিন কতটি শব্দ রিভিউ বা শিখবেন তা নির্ধারণ করুন।
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-sm font-bold text-slate-500 font-sans">প্রতিদিনের লক্ষ্য:</span>
                <span className="text-2xl font-black text-indigo-600 font-sans">{goal.dailyTarget} <span className="text-xs font-normal text-slate-400">শব্দ</span></span>
              </div>

              <div className="flex gap-2">
                {[10, 15, 20, 30, 50].map((t) => (
                  <button
                    key={t}
                    onClick={() => setGoal(prev => ({ ...prev, dailyTarget: t }))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition font-sans ${
                      goal.dailyTarget === t
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-center">
            <p className="text-xs text-slate-400 font-sans">
              ধারাবাহিক পড়াশোনা করলে আপনার মেমোরি রিটেনশন ৮০% পর্যন্ত বেড়ে যাবে!
            </p>
          </div>
        </div>
      </div>

      {/* 37 Groups Navigation Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-6" id="groups-directory-section">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              ভোকাবুলারি গ্রুপসমূহ (১-৩৭)
            </h3>
            <p className="text-sm text-slate-500 font-sans">
              যেকোনো নির্দিষ্ট গ্রুপে ক্লিক করে ফ্ল্যাশ কার্ড এবং শেখার গেম শুরু করুন।
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="গ্রুপ নাম্বার বা নাম লিখুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-sans text-slate-700"
            />
          </div>
        </div>

        {/* Group Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" id="group-grid">
          {filteredGroups.map((g) => (
            <button
              key={g.group}
              onClick={() => onSelectGroup(g.group)}
              className="group text-left p-4 rounded-xl border border-slate-200/60 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/10 transition flex flex-col justify-between h-36"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-extrabold rounded-md">
                    গ্রুপ {g.group}
                  </span>
                  <span className="text-xs text-slate-400 font-sans">{g.total} শব্দ</span>
                </div>
                <div className="flex justify-between items-end mb-1 mt-1 font-sans">
                  <span className="text-xs text-slate-500">অগ্রগতি</span>
                  <span className="text-xs font-bold text-indigo-600">{g.percent}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full" style={{ width: `${g.percent}%` }}></div>
                </div>
              </div>

              {/* Status Pills */}
              <div className="grid grid-cols-3 gap-1 pt-2 border-t border-dashed border-slate-100 font-mono text-[10px] text-center">
                <div className="text-indigo-600 bg-indigo-50/50 rounded-sm py-0.5 font-bold" title="পারি">
                  ✔ {g.know}
                </div>
                <div className="text-amber-600 bg-amber-50/50 rounded-sm py-0.5 font-bold" title="কনফিউশন">
                  ⚠ {g.confusion}
                </div>
                <div className="text-rose-600 bg-rose-50/50 rounded-sm py-0.5 font-bold" title="পারি না">
                  ✖ {g.dontKnow}
                </div>
              </div>
            </button>
          ))}

          {filteredGroups.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 font-sans">
              কোনো গ্রুপ পাওয়া যায়নি।
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function dateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
