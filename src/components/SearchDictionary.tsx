import React, { useState } from 'react';
import { VocabularyWord, UserProgress, CustomFolder, WordStatus } from '../types';
import { Search, Volume2, Bookmark, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Edit3, Trash } from 'lucide-react';

interface SearchDictionaryProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
}

export default function SearchDictionary({
  words,
  progress,
  folders,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark
}: SearchDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Accordion details
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // Filter words
  const searchResults = words.filter(w => {
    // Search match
    const matchesSearch =
      w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.synonyms && w.synonyms.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (w.extraWord && w.extraWord.toLowerCase().includes(searchTerm.toLowerCase()));

    // Group filter
    const matchesGroup = selectedGroup === 'all' ? true : w.group === parseInt(selectedGroup, 10);

    // Status filter
    const status = progress[w.id]?.status || 'unrated';
    const matchesStatus = selectedStatus === 'all' ? true : status === selectedStatus;

    return matchesSearch && matchesGroup && matchesStatus;
  });

  const speak = (wordText: string) => {
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-xs space-y-6" id="dictionary-container">
      {/* 1. Header and search filters */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">শব্দকোষ ও সার্চ ডিকশনারি</h2>
          <p className="text-sm text-slate-500 font-sans mt-1 leading-relaxed">
            ৩৭ টি গ্রুপের সকল শব্দ এখান থেকে এক ক্লিকে সার্চ করুন, উচ্চারণ শুনুন এবং পড়ার প্রগ্রেস এডিট করুন।
          </p>
        </div>

        {/* Filters and Search Fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Main search bar */}
          <div className="md:col-span-2 relative font-sans">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ইংরেজি শব্দ, বাংলা অর্থ বা সিনোনিম দিয়ে খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            />
          </div>

          {/* Group dropdown */}
          <div className="font-sans">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="all">সকল গ্রুপ (১-৩৭)</option>
              {Array.from({ length: 37 }, (_, i) => (
                <option key={i + 1} value={i + 1}>গ্রুপ {i + 1}</option>
              ))}
            </select>
          </div>

          {/* Status tag filter */}
          <div className="font-sans">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="all">সকল কন্ডিশন</option>
              <option value="know">পারি (সবুজ)</option>
              <option value="confusion">কনফিউশন (হলুদ)</option>
              <option value="dont_know">পারি না (লাল)</option>
              <option value="unrated">পড়া হয়নি (ধূসর)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Results count */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider font-sans border-b border-slate-100 pb-3">
        <span>খুঁজে পাওয়া শব্দসমূহ</span>
        <span className="text-indigo-600">{searchResults.length} টি শব্দ মিলেছে</span>
      </div>

      {/* 3. Results List Accordion */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1" id="dictionary-results-list">
        {searchResults.map(w => {
          const isExpanded = expandedWordId === w.id;
          const status = progress[w.id]?.status || 'unrated';
          const notes = progress[w.id]?.notes || '';

          return (
            <div
              key={w.id}
              className={`border rounded-2xl transition ${
                isExpanded ? 'border-indigo-500 bg-indigo-50/5 shadow-xs' : 'border-slate-200/60 bg-white hover:border-slate-300'
              }`}
            >
              {/* Trigger row */}
              <div
                onClick={() => setExpandedWordId(isExpanded ? null : w.id)}
                className="p-4 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Status indicator badge */}
                  <div>
                    {status === 'know' && <CheckCircle className="w-5 h-5 text-indigo-600" />}
                    {status === 'confusion' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    {status === 'dont_know' && <XCircle className="w-5 h-5 text-rose-500" />}
                    {status === 'unrated' && <div className="w-5 h-5 rounded-full border-2 border-slate-200"></div>}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 text-base">{w.word}</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-md font-sans">
                        গ্রুপ {w.group}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-sans mt-0.5">{w.meaning}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(w.word);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                    title="উচ্চারণ শুনুন"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Collapsed content details */}
              {isExpanded && (
                <div className="px-12 pb-5 pt-1 border-t border-slate-100/50 space-y-4 text-sm text-slate-600 animate-slideDown">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Synonyms list */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">সমার্থক শব্দ (Synonyms)</span>
                      <p className="font-semibold text-slate-700">{w.synonyms || 'N/A'}</p>
                    </div>

                    {/* Companion reference */}
                    {w.extraWord && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">সহযোগী অতিরিক্ত শব্দ</span>
                        <p className="font-semibold text-slate-700">
                          {w.extraWord} : <span className="font-normal text-slate-500 font-sans">{w.extraMeaning}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bookmark quick folder toggle */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">বুকমার্ক ফোল্ডার</span>
                    <div className="flex flex-wrap gap-2.5 font-sans">
                      {folders.map(f => {
                        const isBookmarked = (progress[w.id]?.bookmarks || []).includes(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => onToggleBookmark(w.id, f.id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                              isBookmarked
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }}></div>
                            <span>{f.name}</span>
                          </button>
                        );
                      })}
                      {folders.length === 0 && (
                        <p className="text-xs text-slate-400">কোনো ফোল্ডার তৈরি করা নেই।</p>
                      )}
                    </div>
                  </div>

                  {/* Status ratings adjust */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">শেখার প্রগ্রেস পরিবর্তন করুন</span>
                    <div className="flex gap-2 font-sans">
                      <button
                        onClick={() => onRateWord(w.id, 'dont_know')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border flex items-center gap-1 ${
                          status === 'dont_know' ? 'bg-rose-500 border-rose-600 text-white' : 'bg-rose-50/50 border-rose-100 text-rose-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> পারি না
                      </button>
                      <button
                        onClick={() => onRateWord(w.id, 'confusion')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border flex items-center gap-1 ${
                          status === 'confusion' ? 'bg-amber-400 border-amber-500 text-amber-950' : 'bg-amber-50/50 border-amber-100 text-amber-800'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> কনফিউশন
                      </button>
                      <button
                        onClick={() => onRateWord(w.id, 'know')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border flex items-center gap-1 ${
                          status === 'know' ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-indigo-50/50 border-indigo-100 text-indigo-800'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> পারি
                      </button>
                    </div>
                  </div>

                  {/* Notes mnemonic viewer */}
                  <div className="pt-2 border-t border-slate-100/50 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-1">
                      <Edit3 className="w-3 h-3 text-indigo-600" />
                      স্মৃতিসহায়ক নোট
                    </span>
                    <input
                      type="text"
                      placeholder="শব্দটি মনে রাখার কোনো নোট বা বাক্য লিখুন..."
                      value={notes}
                      onChange={(e) => onUpdateNotes(w.id, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {searchResults.length === 0 && (
          <p className="text-center text-slate-400 font-sans py-12">কোনো শব্দ ডিকশনারিতে পাওয়া যায়নি।</p>
        )}
      </div>
    </div>
  );
}
