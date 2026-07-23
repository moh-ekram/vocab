import React, { useState, useEffect } from 'react';
import { VocabularyWord, UserProgress, CustomFolder, WordStatus, AppSettings } from '../types';
import { 
  Search, 
  Volume2, 
  Bookmark, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown, 
  Download, 
  Filter, 
  RotateCcw, 
  Check, 
  Grid, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  FolderHeart
} from 'lucide-react';

interface SearchDictionaryProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  settings?: AppSettings;
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
}

export default function SearchDictionary({
  words,
  progress,
  folders,
  settings,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark
}: SearchDictionaryProps) {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');

  // Dynamic unique groups from words list
  const uniqueGroups = React.useMemo(() => {
    const grps = new Set<string | number>();
    words.forEach(w => {
      if (w.group !== undefined && w.group !== null) {
        grps.add(w.group);
      }
    });
    return Array.from(grps).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b), 'bn');
    });
  }, [words]);

  // Session stable states to prevent immediate list re-ordering or item removal when tag/bookmark is changed
  const [originalStatuses, setOriginalStatuses] = useState<Record<string, WordStatus>>({});
  const [originalBookmarks, setOriginalBookmarks] = useState<Record<string, string[]>>({});

  // Sorting State
  const [sortColumn, setSortColumn] = useState<'word' | 'meaning' | 'group' | 'status' | 'notes' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Active word for bookmark dropdown
  const [activeBookmarkWordId, setActiveBookmarkWordId] = useState<string | null>(null);

  // Reset page and caches when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
    setOriginalStatuses({});
    setOriginalBookmarks({});
  }, [searchTerm, selectedGroup, selectedStatus, selectedFolder, sortColumn, sortDirection]);

  const handleRateWordWithSession = (wordId: string, status: WordStatus) => {
    const currentStatus = progress[wordId]?.status || 'unrated';
    setOriginalStatuses(prev => {
      if (prev[wordId] !== undefined) return prev;
      return { ...prev, [wordId]: currentStatus };
    });
    onRateWord(wordId, status);
  };

  const handleToggleBookmarkWithSession = (wordId: string, folderId: string) => {
    const currentBookmarks = progress[wordId]?.bookmarks || [];
    setOriginalBookmarks(prev => {
      if (prev[wordId] !== undefined) return prev;
      return { ...prev, [wordId]: currentBookmarks };
    });
    onToggleBookmark(wordId, folderId);
  };

  // Handle Sort Toggle
  const handleSort = (column: 'word' | 'meaning' | 'group' | 'status' | 'notes') => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Speak Word
  const speak = (wordText: string) => {
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedGroup('all');
    setSelectedStatus('all');
    setSelectedFolder('all');
    setSortColumn(null);
    setSortDirection('asc');
  };

  // Filter word list based on inputs
  const searchResults = words.filter(w => {
    // Search query match
    const matchesSearch =
      w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.synonyms && w.synonyms.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (w.extraWord && w.extraWord.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (progress[w.id]?.notes && progress[w.id]?.notes?.toLowerCase().includes(searchTerm.toLowerCase()));

    // Group filter match
    const matchesGroup = selectedGroup === 'all' ? true : String(w.group) === selectedGroup;

    // Status filter match using session-stable status
    const status = progress[w.id]?.status || 'unrated';
    const filterStatus = originalStatuses[w.id] !== undefined ? originalStatuses[w.id] : status;
    const matchesStatus = selectedStatus === 'all' ? true : filterStatus === selectedStatus;

    // Folder bookmark filter match using session-stable bookmarks
    const folderList = progress[w.id]?.bookmarks || [];
    const filterFolders = originalBookmarks[w.id] !== undefined ? originalBookmarks[w.id] : folderList;
    const matchesFolder = selectedFolder === 'all' ? true : filterFolders.includes(selectedFolder);

    return matchesSearch && matchesGroup && matchesStatus && matchesFolder;
  });

  // Sort filtered word list
  const sortedResults = [...searchResults].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let valA: any = '';
    let valB: any = '';

    if (sortColumn === 'word') {
      valA = a.word.toLowerCase();
      valB = b.word.toLowerCase();
    } else if (sortColumn === 'meaning') {
      valA = a.meaning;
      valB = b.meaning;
    } else if (sortColumn === 'group') {
      valA = a.group;
      valB = b.group;
    } else if (sortColumn === 'status') {
      const statusA = progress[a.id]?.status || 'unrated';
      const statusB = progress[b.id]?.status || 'unrated';
      valA = originalStatuses[a.id] !== undefined ? originalStatuses[a.id] : statusA;
      valB = originalStatuses[b.id] !== undefined ? originalStatuses[b.id] : statusB;
    } else if (sortColumn === 'notes') {
      valA = (progress[a.id]?.notes || '').toLowerCase();
      valB = (progress[b.id]?.notes || '').toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination bounds calculation
  const totalItems = sortedResults.length;
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === -1 ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedResults = itemsPerPage === -1 ? sortedResults : sortedResults.slice(startIndex, endIndex);

  // Statistics Calculation
  const stats = {
    total: words.length,
    filtered: searchResults.length,
    know: searchResults.filter(w => progress[w.id]?.status === 'know').length,
    confusion: searchResults.filter(w => progress[w.id]?.status === 'confusion').length,
    dont_know: searchResults.filter(w => progress[w.id]?.status === 'dont_know').length,
    unrated: searchResults.filter(w => !progress[w.id]?.status || progress[w.id]?.status === 'unrated').length,
  };

  // Export visible items to CSV Excel sheet
  const exportToCSV = () => {
    const headers = [
      'Serial', 
      'Word', 
      'Bengali Meaning', 
      'Group', 
      'Synonyms', 
      'Extra Word', 
      'Extra Meaning', 
      'Status', 
      'Mnemonic Notes'
    ];
    
    const rows = sortedResults.map((w, index) => {
      const statusVal = progress[w.id]?.status || 'unrated';
      const statusText = 
        statusVal === 'know' ? 'Learned' : 
        statusVal === 'confusion' ? 'Confused' : 
        statusVal === 'dont_know' ? 'Unlearned' : 'Unrated';
      
      const notesVal = progress[w.id]?.notes || '';
      
      return [
        index + 1,
        w.word,
        w.meaning,
        w.group,
        w.synonyms || '',
        w.extraWord || '',
        w.extraMeaning || '',
        statusText,
        notesVal
      ];
    });

    const csvString = [
      headers.join(','), 
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vocabulary_group_${selectedGroup}_status_${selectedStatus}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-xs space-y-6" id="vocabulary-catalog-container">
      {/* Invisible backdrop to dismiss bookmark dropdown on click outside */}
      {activeBookmarkWordId && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveBookmarkWordId(null)} />
      )}

      {/* 1. Dashboard Title & Quick Insights */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Vocabulary Catalog
          </h2>
          <p className="text-sm text-slate-500 font-sans mt-1 leading-relaxed">
            View all English words, definitions, and synonyms in a spreadsheet-style grid table, filter records, and update your learning progress.
          </p>
        </div>

        {/* CSV export and filter reset buttons */}
        <div className="flex items-center gap-2.5 font-sans">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          
          <button
            onClick={exportToCSV}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer"
            title="Download as CSV file"
          >
            <Download className="w-3.5 h-3.5" /> Download Excel / CSV
          </button>
        </div>
      </div>

      {/* 2. Spreadsheet Stats Indicator Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 font-sans">
        <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Words</span>
          <span className="text-lg font-black text-slate-800">{stats.filtered} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span></span>
        </div>
        <div className="bg-emerald-50/40 border border-emerald-100/50 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider block">Learned (Green)</span>
          <span className="text-lg font-black text-emerald-700">{stats.know}</span>
        </div>
        <div className="bg-amber-50/40 border border-amber-100/50 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Confused (Yellow)</span>
          <span className="text-lg font-black text-amber-700">{stats.confusion}</span>
        </div>
        <div className="bg-rose-50/40 border border-rose-100/50 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Unlearned (Red)</span>
          <span className="text-lg font-black text-rose-700">{stats.dont_know}</span>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-slate-50/50 border border-slate-100 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unrated</span>
          <span className="text-lg font-black text-slate-600">{stats.unrated}</span>
        </div>
      </div>

      {/* 3. Advanced Filtering Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-sans bg-slate-50/30 p-4 border border-slate-200/50 rounded-2xl">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="English word, meaning, synonym, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          />
        </div>

        {/* Group select dropdown */}
        <div className="relative">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 appearance-none cursor-pointer"
          >
            <option value="all">Group Filter: All Groups</option>
            {uniqueGroups.map((gVal) => (
              <option key={gVal} value={String(gVal)}>Group {gVal}</option>
            ))}
          </select>
          <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status selection */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 appearance-none cursor-pointer"
          >
            <option value="all">Status Filter: All Conditions</option>
            <option value="know">Learned (Green)</option>
            <option value="confusion">Confused (Yellow)</option>
            <option value="dont_know">Unlearned (Red)</option>
            <option value="unrated">Unrated (Grey)</option>
          </select>
          <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Bookmark folder filter */}
        <div className="relative">
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 appearance-none cursor-pointer"
          >
            <option value="all">Bookmark Folder: All Bookmarks</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <FolderHeart className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 4. Excel spreadsheet table */}
      <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full border-collapse table-auto text-sm text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs font-bold font-sans uppercase select-none border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                <th className="px-3 py-3.5 text-center border-r border-slate-200 bg-slate-100 w-12 shrink-0">#</th>
                
                {/* Column English Word */}
                <th 
                  onClick={() => handleSort('word')}
                  className="px-4 py-3.5 text-left border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200/70 transition min-w-[150px]"
                >
                  <div className="flex items-center gap-1">
                    <span>English Word</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Column Meaning */}
                <th 
                  onClick={() => handleSort('meaning')}
                  className="px-4 py-3.5 text-left border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200/70 transition min-w-[160px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Meaning</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Column Group */}
                <th 
                  onClick={() => handleSort('group')}
                  className="px-3 py-3.5 text-center border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200/70 transition w-24"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Group</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Column Synonyms */}
                <th className="px-4 py-3.5 text-left border-r border-slate-200 bg-slate-100 min-w-[180px]">Synonyms</th>
                
                {/* Column Companion Extra Word */}
                <th className="px-4 py-3.5 text-left border-r border-slate-200 bg-slate-100 min-w-[160px]">Companion Word & Meaning</th>

                {/* Column Status (Rating) */}
                <th 
                  onClick={() => handleSort('status')}
                  className="px-4 py-3.5 text-center border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200/70 transition min-w-[140px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Column Mnemonic memory aid notes */}
                <th 
                  onClick={() => handleSort('notes')}
                  className="px-4 py-3.5 text-left border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200/70 transition min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Mnemonic Note</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Column Bookmarks Folder selection */}
                <th className="px-4 py-3.5 text-center border-r border-slate-200 bg-slate-100 min-w-[120px]">Bookmark Folder</th>
                
                {/* Column Voice Speaker */}
                <th className="px-3 py-3.5 text-center bg-slate-100 w-16">Audio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-sans">
              {paginatedResults.map((w, index) => {
                const globalIndex = startIndex + index + 1;
                const status = progress[w.id]?.status || 'unrated';
                const notes = progress[w.id]?.notes || '';
                const wordFolders = progress[w.id]?.bookmarks || [];

                return (
                  <tr 
                    key={w.id} 
                    className="hover:bg-indigo-50/20 odd:bg-white even:bg-slate-50/30 transition text-slate-700"
                  >
                    {/* # Index Row */}
                    <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-slate-400 border-r border-slate-100">
                      {globalIndex}
                    </td>

                    {/* Word row */}
                    <td className={`px-4 py-2.5 font-extrabold font-mono border-r border-slate-100 tracking-tight transition-colors ${
                      settings?.colorizeMainWord !== false
                        ? status === 'know'
                          ? 'text-emerald-600 font-black'
                          : status === 'dont_know'
                          ? 'text-rose-600 font-black'
                          : status === 'confusion'
                          ? 'text-amber-600 font-black'
                          : 'text-slate-900'
                        : 'text-slate-900'
                    }`}>
                      {w.word}
                    </td>

                    {/* Bengali Meaning */}
                    <td className="px-4 py-2.5 text-xs text-slate-800 border-r border-slate-100 font-semibold">
                      {w.meaning}
                    </td>

                    {/* Group number */}
                    <td className="px-3 py-2.5 text-center border-r border-slate-100 font-bold text-xs text-indigo-700">
                      Group {w.group}
                    </td>

                    {/* Synonyms */}
                    <td className="px-4 py-2.5 text-xs text-slate-500 border-r border-slate-100 max-w-[200px] truncate" title={w.synonyms || ''}>
                      {w.synonyms || <span className="text-slate-300">-</span>}
                    </td>

                    {/* Extra companion words */}
                    <td className="px-4 py-2.5 text-xs text-slate-500 border-r border-slate-100">
                      {w.extraWord ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-700 font-mono">{w.extraWord}</span>
                          <span className="text-[10px] text-slate-400">{w.extraMeaning}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Status inline editor dropdown */}
                    <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                      <select
                        value={status}
                        onChange={(e) => handleRateWordWithSession(w.id, e.target.value as WordStatus)}
                        className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/35 cursor-pointer text-center w-full max-w-[110px] transition ${
                          status === 'know' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : status === 'confusion' 
                            ? 'bg-amber-50 border-amber-200 text-amber-800' 
                            : status === 'dont_know' 
                            ? 'bg-rose-50 border-rose-200 text-rose-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <option value="unrated">Unrated</option>
                        <option value="know">Learned</option>
                        <option value="confusion">Confused</option>
                        <option value="dont_know">Unlearned</option>
                      </select>
                    </td>

                    {/* Editable notes cell (behaves like an Excel sheet cell) */}
                    <td className="px-4 py-2 border-r border-slate-100">
                      <input
                        type="text"
                        value={notes}
                        placeholder="Type note..."
                        onChange={(e) => onUpdateNotes(w.id, e.target.value)}
                        className="w-full bg-transparent hover:bg-slate-50 focus:bg-white border-b border-transparent hover:border-slate-300 focus:border-indigo-500 px-1 py-1 text-xs text-slate-700 focus:outline-none transition rounded font-sans"
                      />
                    </td>

                    {/* Bookmarks multi select custom folder button */}
                    <td className="px-4 py-2 border-r border-slate-100 text-center relative">
                      <button
                        onClick={() => setActiveBookmarkWordId(activeBookmarkWordId === w.id ? null : w.id)}
                        className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer select-none ${
                          wordFolders.length > 0 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Bookmark className={`w-3 h-3 ${wordFolders.length > 0 ? 'fill-indigo-600 text-indigo-600' : ''}`} />
                        <span>{wordFolders.length > 0 ? `${wordFolders.length} folders` : 'Bookmark'}</span>
                      </button>

                      {/* Floating overlay popover for folder bookmarks */}
                      {activeBookmarkWordId === w.id && (
                        <div className="absolute right-2 top-full mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl p-2.5 z-20 w-48 text-left space-y-1.5 font-sans">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
                            Select Bookmark
                          </p>
                          <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                            {folders.map(f => {
                              const isBookmarked = wordFolders.includes(f.id);
                              return (
                                <button
                                  key={f.id}
                                  onClick={() => handleToggleBookmarkWithSession(w.id, f.id)}
                                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 p-1.5 rounded-lg transition text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }}></div>
                                    <span className="truncate max-w-[110px]">{f.name}</span>
                                  </div>
                                  {isBookmarked ? (
                                    <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 border border-slate-300 rounded shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {folders.length === 0 && (
                            <p className="text-[11px] text-slate-400 p-1.5 leading-relaxed">No bookmark folders created. Go to Folders View.</p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Vocal audio Pronunciation play icon */}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => speak(w.word)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer inline-flex items-center justify-center"
                        title="Listen to pronunciation"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedResults.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-400 font-sans py-16">
                    <Grid className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No words found in the vocabulary catalog. Try changing your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Pagination spreadsheet bottom panel */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 p-4 border border-slate-200/50 rounded-2xl font-sans text-xs text-slate-500">
          {/* Row count limit selector */}
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={-1}>All words</option>
            </select>
          </div>

          {/* Records summary */}
          <div>
            <span>Rows {startIndex + 1} - {endIndex} (Total {totalItems} results)</span>
          </div>

          {/* Dynamic pagination step selectors */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                // Guard page boundary
                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 font-semibold rounded-lg border transition cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
