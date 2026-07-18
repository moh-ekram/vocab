import React, { useState, useEffect, useMemo } from 'react';
import { Course, VocabularyWord } from '../types';
import { 
  X, 
  CheckCircle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Sliders, 
  Users, 
  ToggleLeft, 
  ToggleRight, 
  Edit, 
  AlertCircle, 
  Copy, 
  Check, 
  BookOpen, 
  Search, 
  UploadCloud, 
  FileSpreadsheet, 
  PlusCircle, 
  ArrowLeft, 
  ArrowRight 
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { read, utils } from 'xlsx';

interface CourseSettingsProps {
  course: Course;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const CourseSettings: React.FC<CourseSettingsProps> = ({
  course,
  onClose,
  onSaveSuccess,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'words'>('settings');

  // --- COURSE SETTINGS STATES ---
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [isDefault, setIsDefault] = useState(!!course.isDefault);
  const [isRestricted, setIsRestricted] = useState(!!course.isRestricted);
  const [allowedUsers, setAllowedUsers] = useState<string[]>(course.allowedUsers || []);
  const [newUserInput, setNewUserInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);

  // --- WORDS MANAGEMENT STATES ---
  const [localWords, setLocalWords] = useState<VocabularyWord[]>(course.words || []);
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [wordGroupFilter, setWordGroupFilter] = useState<string>('all');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentWordPage, setCurrentWordPage] = useState(1);
  const wordsPerPage = 10;

  // Form: Single word addition
  const [singleWord, setSingleWord] = useState('');
  const [singleMeaning, setSingleMeaning] = useState('');
  const [singleGroup, setSingleGroup] = useState<string>('1');
  const [singleSynonyms, setSingleSynonyms] = useState('');
  const [singleExtraWord, setSingleExtraWord] = useState('');
  const [singleExtraMeaning, setSingleExtraMeaning] = useState('');
  const [singleExample, setSingleExample] = useState('');
  const [addFormMessage, setAddFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form: Bulk spreadsheet uploading
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [dragActiveWords, setDragActiveWords] = useState(false);

  // --- GENERAL STATES ---
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Synchronize on course prop changes
  useEffect(() => {
    setTitle(course.title);
    setDescription(course.description);
    setIsDefault(!!course.isDefault);
    setIsRestricted(!!course.isRestricted);
    setAllowedUsers(course.allowedUsers || []);
    setBulkInput((course.allowedUsers || []).join('\n'));
    setLocalWords(course.words || []);
    setSelectedWordIds(new Set());
  }, [course]);

  // Handle adding a single user to restricted access list
  const handleAddUser = () => {
    const input = newUserInput.trim();
    if (!input) return;

    if (allowedUsers.includes(input)) {
      setError('This user is already in the list.');
      return;
    }

    setAllowedUsers(prev => [...prev, input]);
    setNewUserInput('');
    setError(null);
  };

  // Handle removing a single user
  const handleRemoveUser = (userToRemove: string) => {
    setAllowedUsers(prev => prev.filter(u => u !== userToRemove));
  };

  // Sync bulk input when switching modes
  useEffect(() => {
    if (!isBulkMode) {
      setBulkInput(allowedUsers.join('\n'));
    }
  }, [isBulkMode, allowedUsers]);

  // Apply bulk user changes
  const handleApplyBulk = () => {
    const parsed = bulkInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const unique = Array.from(new Set(parsed));
    setAllowedUsers(unique);
    setIsBulkMode(false);
    setError(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(course.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // --- SINGLE WORD ADDITION HANDLER ---
  const handleAddSingleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormMessage(null);

    if (!singleWord.trim() || !singleMeaning.trim()) {
      setAddFormMessage({ type: 'error', text: 'শব্দ এবং অর্থ ফিল্ড দুটি অবশ্যই পূরণ করতে হবে।' });
      return;
    }

    let groupVal: string | number = singleGroup.trim();
    const numGrp = parseInt(singleGroup.trim(), 10);
    if (!isNaN(numGrp) && String(numGrp) === singleGroup.trim()) {
      groupVal = numGrp;
    }

    const uniqueIndexSuffix = localWords.length + 1;
    const newWordItem: VocabularyWord = {
      id: `${course.id}_g${groupVal}_w_${Date.now()}_${uniqueIndexSuffix}`,
      word: singleWord.trim(),
      meaning: singleMeaning.trim(),
      group: groupVal,
      synonyms: singleSynonyms.trim(),
      extraWord: singleExtraWord.trim(),
      extraMeaning: singleExtraMeaning.trim(),
      example: singleExample.trim()
    };

    setLocalWords(prev => [...prev, newWordItem]);

    // Reset single word inputs
    setSingleWord('');
    setSingleMeaning('');
    setSingleSynonyms('');
    setSingleExtraWord('');
    setSingleExtraMeaning('');
    setSingleExample('');

    setAddFormMessage({ 
      type: 'success', 
      text: `"${newWordItem.word}" শব্দটি সফলভাবে স্থানীয় তালিকায় যোগ করা হয়েছে! এটি চূড়ান্তভাবে সংরক্ষণ করতে নিচে "Update Settings" বাটনে চাপুন।` 
    });
  };

  // --- EXCEL DRAG & DROP FOR WORDS ---
  const handleWordsDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveWords(true);
    } else if (e.type === "dragleave") {
      setDragActiveWords(false);
    }
  };

  const handleWordsDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveWords(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processWordsExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleWordsFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processWordsExcelFile(e.target.files[0]);
    }
  };

  const processWordsExcelFile = (file: File) => {
    setExcelError(null);
    setExcelSuccess(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          setExcelError('স্প্রেডশীটে কোনো শব্দ পাওয়া যায়নি।');
          return;
        }

        const wordsList: VocabularyWord[] = [];
        let index = localWords.length + 1;

        for (const row of rawRows) {
          const rowKeys = Object.keys(row);
          
          const findKey = (candidates: string[]) => {
            return rowKeys.find(k => {
              const cleanK = k.toLowerCase().trim();
              return candidates.some(c => cleanK === c);
            });
          };

          const wordKey = findKey(['word', 'main word']);
          const meaningKey = findKey(['meaning', 'bangla meaning']);
          const groupKey = findKey(['group']);
          const synonym1Key = findKey(['synonym1', 'syn1']);
          const synonym2Key = findKey(['synonym2', 'syn2']);
          const synonymsKey = findKey(['synonyms']);
          const extraWordKey = findKey(['extra word']);
          const extraMeaningKey = findKey(['extra meaning']);
          const exampleKey = findKey(['example']);

          const baseWord = wordKey ? String(row[wordKey]).trim() : '';
          const banglaMeaning = meaningKey ? String(row[meaningKey]).trim() : '';

          if (!baseWord || !banglaMeaning) {
            continue; 
          }

          let group: string | number = 1;
          if (groupKey && row[groupKey] !== undefined && row[groupKey] !== null) {
            const rawGrp = String(row[groupKey]).trim();
            if (rawGrp) {
              const num = parseInt(rawGrp, 10);
              if (!isNaN(num) && String(num) === rawGrp) {
                group = num;
              } else {
                group = rawGrp;
              }
            }
          }

          let synonyms = '';
          if (synonymsKey && row[synonymsKey]) {
            synonyms = String(row[synonymsKey]).trim();
          } else {
            const synParts = [];
            if (synonym1Key && row[synonym1Key]) synParts.push(String(row[synonym1Key]).trim());
            if (synonym2Key && row[synonym2Key]) synParts.push(String(row[synonym2Key]).trim());
            synonyms = synParts.join(', ');
          }

          const example = exampleKey ? String(row[exampleKey]).trim() : '';
          const extraWord = extraWordKey ? String(row[extraWordKey]).trim() : '';
          const extraMeaning = extraMeaningKey ? String(row[extraMeaningKey]).trim() : '';

          wordsList.push({
            id: `${course.id}_g${group}_w_${Date.now()}_${index}`,
            group,
            word: baseWord,
            meaning: banglaMeaning,
            synonyms,
            extraWord,
            extraMeaning,
            example
          });

          index++;
        }

        if (wordsList.length === 0) {
          setExcelError('কলাম মিলেনি! অন্তত "main word" এবং "bangla meaning" কলাম থাকতে হবে।');
          return;
        }

        setLocalWords(prev => [...prev, ...wordsList]);
        setExcelSuccess(`এক্সেল ফাইল থেকে সফলভাবে ${wordsList.length} টি নতুন শব্দ যোগ করা হয়েছে! চূড়ান্ত সংরক্ষণ করতে নিচে "Update Settings" এ চাপুন।`);
      } catch (err) {
        console.error(err);
        setExcelError('ফাইল প্রসেস করতে ব্যর্থ হয়েছে। অনুগ্রহ করে একটি বৈধ স্প্রেডশীট ফাইল ব্যবহার করুন।');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- DELETION ACTIONS ---
  const handleDeleteWord = (id: string) => {
    if (window.confirm('আপনি কি নিশ্চিতভাবে এই শব্দটি কোর্স থেকে ডিলিট করতে চান?')) {
      setLocalWords(prev => prev.filter(w => w.id !== id));
      setSelectedWordIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteSelectedWords = () => {
    if (selectedWordIds.size === 0) return;
    if (window.confirm(`আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedWordIds.size} টি শব্দ কোর্স থেকে মুছে ফেলতে চান?`)) {
      setLocalWords(prev => prev.filter(w => !selectedWordIds.has(w.id)));
      setSelectedWordIds(new Set());
      setCurrentWordPage(1);
    }
  };

  // --- FILTERS & PAGINATION COMPUTATIONS ---
  const filteredWords = useMemo(() => {
    return localWords.filter(w => {
      const q = wordSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        w.word.toLowerCase().includes(q) || 
        w.meaning.toLowerCase().includes(q) || 
        (w.synonyms && w.synonyms.toLowerCase().includes(q)) ||
        (w.extraWord && w.extraWord.toLowerCase().includes(q)) ||
        (w.extraMeaning && w.extraMeaning.toLowerCase().includes(q));

      const matchesGroup = wordGroupFilter === 'all' || String(w.group) === wordGroupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [localWords, wordSearchQuery, wordGroupFilter]);

  // Reset pagination on search filter adjustments
  useEffect(() => {
    setCurrentWordPage(1);
  }, [wordSearchQuery, wordGroupFilter]);

  const totalWordPages = Math.max(1, Math.ceil(filteredWords.length / wordsPerPage));
  const paginatedWords = useMemo(() => {
    const startIdx = (currentWordPage - 1) * wordsPerPage;
    return filteredWords.slice(startIdx, startIdx + wordsPerPage);
  }, [filteredWords, currentWordPage]);

  // Get unique groups for the filters
  const uniqueLocalGroups = useMemo(() => {
    const grps = new Set<string | number>();
    localWords.forEach(w => {
      if (w.group !== undefined && w.group !== null) {
        grps.add(w.group);
      }
    });
    return Array.from(grps).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b), 'bn');
    });
  }, [localWords]);

  // Bulk check box handling
  const isAllPageSelected = paginatedWords.length > 0 && paginatedWords.every(w => selectedWordIds.has(w.id));
  const handleSelectAllPage = () => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        paginatedWords.forEach(w => next.delete(w.id));
      } else {
        paginatedWords.forEach(w => next.add(w.id));
      }
      return next;
    });
  };

  const handleCheckboxChange = (id: string) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // --- SAVE OPERATION (MUTATE FIRESTORE) ---
  const handleSave = async () => {
    if (!title.trim()) {
      setError('Course title is required!');
      return;
    }

    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই কোর্সের সমস্ত পরিবর্তন ক্লাউড ডেটাবেজে সংরক্ষণ করতে চান?')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      let finalAllowedUsers = [...allowedUsers];
      if (isBulkMode) {
        finalAllowedUsers = Array.from(new Set(
          bulkInput
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
        ));
      }

      // Compute total groups dynamically
      const uniqueGroupsSize = new Set(localWords.map(w => w.group)).size;

      const updatedCourse: Course = {
        ...course,
        title: title.trim(),
        description: description.trim(),
        isDefault: isDefault,
        isRestricted: isRestricted,
        allowedUsers: isRestricted ? finalAllowedUsers : [],
        words: localWords,
        totalGroups: uniqueGroupsSize || 1,
      };

      await setDoc(doc(db, 'courses', course.id), updatedCourse);
      
      setSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error updating course in Firestore:', err);
      setError('ক্লাউডে ডেটা সেভ করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in text-slate-700" id="course-settings-modal">
      <div className={`bg-white w-full rounded-2xl shadow-2xl relative animate-scale-up font-sans overflow-hidden border border-slate-100 flex flex-col m-4 max-h-[92vh] transition-all duration-300 ${
        activeSubTab === 'words' ? 'max-w-4xl' : 'max-w-lg'
      }`}>
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">{course.title} — কন্ট্রোল প্যানেল</h3>
              <p className="text-[10px] text-indigo-600 font-bold mt-0.5 font-sans flex items-center gap-1.5">
                <span>Code: {course.id}</span>
                <button 
                  onClick={handleCopyCode} 
                  className="p-1 hover:bg-indigo-100/50 rounded text-indigo-500 hover:text-indigo-700 transition cursor-pointer"
                  title="Copy share code"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6">
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`py-3 px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'settings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>কোর্স সেটিংস (Settings)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('words')}
            className={`py-3 px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'words'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>শব্দ তালিকা ও পরিবর্তন (Words & Bulk Data)</span>
            <span className="bg-indigo-50 text-indigo-600 text-[9px] px-2 py-0.5 rounded-full font-bold">
              {localWords.length}
            </span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>কোর্সের সমস্ত পরিবর্তন ক্লাউডে সফলভাবে সংরক্ষিত হয়েছে!</span>
            </div>
          )}

          {/* TAB 1: GENERAL SETTINGS */}
          {activeSubTab === 'settings' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-600 block">Course Title <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  placeholder="Enter course title"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-600 block">Course Description</label>
                <textarea
                  rows={2.5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-semibold transition resize-none text-slate-700"
                  placeholder="Enter course description..."
                />
              </div>

              {/* Access configurations */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/60 space-y-4">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide block">Course Access Configuration</span>
                
                {/* Toggle: Default Course */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-700 block">Set as Default Course</span>
                    <span className="text-[10px] text-slate-400 font-medium block">When active, this course will automatically be enrolled for all students.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDefault(!isDefault)}
                    className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
                  >
                    {isDefault ? (
                      <ToggleRight className="w-9 h-9 text-indigo-600" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-300" />
                    )}
                  </button>
                </div>

                {/* Toggle: Restricted Access */}
                <div className="border-t border-slate-200/60 pt-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-700 block">Restricted Access</span>
                    <span className="text-[10px] text-slate-400 font-medium block">When active, only enrolled email or phone numbers can access this course.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRestricted(!isRestricted)}
                    className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
                  >
                    {isRestricted ? (
                      <ToggleRight className="w-9 h-9 text-indigo-600" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-300" />
                    )}
                  </button>
                </div>

                {/* Restricted Users List */}
                {isRestricted && (
                  <div className="border-t border-slate-200/60 pt-4 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-extrabold text-slate-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>Allowed Users ({allowedUsers.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsBulkMode(!isBulkMode)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3 h-3" />
                        <span>{isBulkMode ? 'List Mode' : 'Bulk Import'}</span>
                      </button>
                    </div>

                    {isBulkMode ? (
                      <div className="space-y-2">
                        <textarea
                          rows={4}
                          value={bulkInput}
                          onChange={(e) => setBulkInput(e.target.value)}
                          placeholder="Enter one email or phone number per line. Example:&#10;user@example.com&#10;01712345678"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition resize-none text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulk}
                          className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-xs rounded-xl transition cursor-pointer"
                        >
                          Apply List Changes
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newUserInput}
                            onChange={(e) => setNewUserInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddUser();
                              }
                            }}
                            placeholder="Enter email or phone number"
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-medium transition text-slate-700"
                          />
                          <button
                            type="button"
                            onClick={handleAddUser}
                            className="px-3 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl transition flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {allowedUsers.length === 0 ? (
                          <div className="p-6 text-center text-slate-450 bg-white/50 border border-dashed border-slate-200 rounded-xl text-[10px] font-semibold">
                            No students are authorized yet. Add an email or phone number above.
                          </div>
                        ) : (
                          <div className="max-h-36 overflow-y-auto bg-white border border-slate-150 rounded-xl divide-y divide-slate-100 scrollbar-thin">
                            {allowedUsers.map(user => (
                              <div key={user} className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                                <span className="font-mono truncate">{user}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUser(user)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WORDS MANAGEMENT */}
          {activeSubTab === 'words' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Top Panels: Form and Bulk Spreadsheets side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Sub-panel 1: Add Individual Word */}
                <form onSubmit={handleAddSingleWordSubmit} className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/50 space-y-3.5">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-150">
                    <PlusCircle className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-700">১. একক নতুন শব্দ যোগ করুন</span>
                  </div>

                  {addFormMessage && (
                    <div className={`p-2.5 rounded-lg text-xs font-bold ${
                      addFormMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {addFormMessage.text}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">মূল শব্দ (English) <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={singleWord}
                        onChange={(e) => setSingleWord(e.target.value)}
                        placeholder="e.g. Abate" 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">বাংলা অর্থ (Bangla) <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={singleMeaning}
                        onChange={(e) => setSingleMeaning(e.target.value)}
                        placeholder="e.g. হ্রাস পাওয়া" 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">গ্রুপ/লেভেল (Group Name/No.) <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={singleGroup}
                        onChange={(e) => setSingleGroup(e.target.value)}
                        placeholder="e.g. 1" 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">সমার্থক শব্দ (Synonyms)</label>
                      <input 
                        type="text" 
                        value={singleSynonyms}
                        onChange={(e) => setSingleSynonyms(e.target.value)}
                        placeholder="comma separated" 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">অতিরিক্ত শব্দ (Extra Word)</label>
                      <input 
                        type="text" 
                        value={singleExtraWord}
                        onChange={(e) => setSingleExtraWord(e.target.value)}
                        placeholder="e.g. Abated" 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">অতিরিক্ত শব্দার্থ (Extra Meaning)</label>
                      <input 
                        type="text" 
                        value={singleExtraMeaning}
                        onChange={(e) => setSingleExtraMeaning(e.target.value)}
                        placeholder="e.g. উপশমিত" 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 block">ব্যবহারের উদাহরণ বাক্য (Example Sentence)</label>
                    <input 
                      type="text" 
                      value={singleExample}
                      onChange={(e) => setSingleExample(e.target.value)}
                      placeholder="e.g. The storm abated after midnight." 
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>তালিকায় শব্দ যোগ করুন</span>
                  </button>
                </form>

                {/* Sub-panel 2: Bulk Upload Words via Excel */}
                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/50 flex flex-col justify-between space-y-3.5">
                  <div>
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-150">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black text-slate-700">২. এক্সেল ফাইল দিয়ে বাল্ক শব্দ যোগ</span>
                    </div>

                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2">
                      আপনার স্প্রেডশীটে (Excel) অন্তত দুটি কলাম থাকতে হবে: <strong className="text-slate-600">word</strong> (বা <strong className="text-slate-600">main word</strong>) এবং <strong className="text-slate-600">meaning</strong> (বা <strong className="text-slate-600">bangla meaning</strong>)। আপনি <strong className="text-slate-600">group, synonyms, extra word, extra meaning, example</strong> কলামগুলোও আপলোড করতে পারেন।
                    </p>

                    {excelError && (
                      <div className="p-2.5 mt-2 bg-rose-50 border border-rose-100 text-rose-700 font-bold text-xs rounded-lg">
                        {excelError}
                      </div>
                    )}

                    {excelSuccess && (
                      <div className="p-2.5 mt-2 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-xs rounded-lg">
                        {excelSuccess}
                      </div>
                    )}
                  </div>

                  {/* Drag and Drop Zone */}
                  <div 
                    onDragEnter={handleWordsDrag}
                    onDragOver={handleWordsDrag}
                    onDragLeave={handleWordsDrag}
                    onDrop={handleWordsDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer h-32 ${
                      dragActiveWords 
                        ? 'border-indigo-500 bg-indigo-50/20' 
                        : 'border-slate-250 bg-white hover:border-slate-350'
                    }`}
                  >
                    <UploadCloud className="w-7 h-7 text-indigo-500" />
                    <div>
                      <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer">
                        এক্সেল ফাইল আপলোড করুন
                        <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          onChange={handleWordsFileInputChange} 
                          className="hidden" 
                        />
                      </label>
                      <span className="text-[9px] text-slate-400 block mt-0.5">অথবা ড্র্যাগ করে এখানে ফেলুন (Drag and Drop)</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Central Section: Filterable Word Table & Pagination */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-650" />
                      <span>শব্দসমূহ সংশোধন ও বাছবিচার তালিকা</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">মোট শব্দ: {localWords.length} টি | ফিল্টার অনুযায়ী: {filteredWords.length} টি</p>
                  </div>

                  {/* Selective Deletion Actions */}
                  {selectedWordIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedWords}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-650 border border-rose-200 hover:border-rose-300 font-black text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer animate-fadeIn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>নির্বাচিত {selectedWordIds.size} টি ডিলিট করুন</span>
                    </button>
                  )}
                </div>

                {/* Filters Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={wordSearchQuery}
                      onChange={(e) => setWordSearchQuery(e.target.value)}
                      placeholder="শব্দ বা অর্থ লিখে খুঁজুন..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <select
                    value={wordGroupFilter}
                    onChange={(e) => setWordGroupFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">সকল গ্রুপ (All Groups)</option>
                    {uniqueLocalGroups.map(g => (
                      <option key={g} value={String(g)}>গ্রুপ {g}</option>
                    ))}
                  </select>
                </div>

                {/* Words Table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/15">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 text-[10px] font-black text-slate-500 border-b border-slate-200/60 uppercase tracking-wider">
                          <th className="px-4 py-2.5 w-10 text-center">
                            <input 
                              type="checkbox" 
                              checked={isAllPageSelected}
                              onChange={handleSelectAllPage}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                              title="চলতি পৃষ্ঠার সব শব্দ সিলেক্ট"
                            />
                          </th>
                          <th className="px-4 py-2.5">শব্দ (English)</th>
                          <th className="px-4 py-2.5">বাংলা অর্থ (Meaning)</th>
                          <th className="px-4 py-2.5 w-16 text-center">গ্রুপ</th>
                          <th className="px-4 py-2.5 hidden sm:table-cell">সমার্থক / অতিরিক্ত শব্দার্থ</th>
                          <th className="px-4 py-2.5 w-16 text-center">ডিলিট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedWords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold bg-white">
                              কোনো শব্দ পাওয়া যায়নি। ফিল্টার পরিবর্তন করে বা নতুন শব্দ যোগ করে ট্রাই করুন।
                            </td>
                          </tr>
                        ) : (
                          paginatedWords.map(w => {
                            const isSelected = selectedWordIds.has(w.id);
                            return (
                              <tr key={w.id} className={`hover:bg-indigo-50/10 transition ${
                                isSelected ? 'bg-indigo-50/20' : 'bg-white'
                              }`}>
                                <td className="px-4 py-2 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(w.id)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-2 font-black text-slate-800 font-sans">{w.word}</td>
                                <td className="px-4 py-2 font-semibold text-slate-600">{w.meaning}</td>
                                <td className="px-4 py-2 text-center font-mono font-bold text-indigo-600 bg-slate-50/30">{w.group}</td>
                                <td className="px-4 py-2 text-slate-400 text-[10px] hidden sm:table-cell truncate max-w-xs font-semibold">
                                  {w.synonyms && <span>সমার্থক: {w.synonyms} </span>}
                                  {w.extraWord && <span className="block mt-0.5">অতিরিক্ত: {w.extraWord} ({w.extraMeaning})</span>}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWord(w.id)}
                                    className="p-1 text-slate-350 hover:text-rose-500 rounded hover:bg-rose-50 transition cursor-pointer"
                                    title="মুছে ফেলুন"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Pagination Controls */}
                {totalWordPages > 1 && (
                  <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <button
                      type="button"
                      disabled={currentWordPage === 1}
                      onClick={() => setCurrentWordPage(prev => Math.max(1, prev - 1))}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>পূর্ববর্তী</span>
                    </button>
                    
                    <span className="font-extrabold text-slate-600">
                      পৃষ্ঠা {currentWordPage} / {totalWordPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentWordPage === totalWordPages}
                      onClick={() => setCurrentWordPage(prev => Math.min(totalWordPages, prev + 1))}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>পরবর্তী</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3.5">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>সংরক্ষণ হচ্ছে...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Update Settings</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
