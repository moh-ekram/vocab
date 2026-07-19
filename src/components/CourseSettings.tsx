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
  ArrowRight,
  Settings,
  HelpCircle,
  Eye,
  Volume2,
  UserCheck
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
  // Navigation Section (Settings Sidebar style)
  const [activeTab, setActiveTab] = useState<'general' | 'variables' | 'access' | 'students' | 'wordlist' | 'addwords'>('general');

  // --- GENERAL COURSE STATES ---
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [isDefault, setIsDefault] = useState(!!course.isDefault);
  const [isRestricted, setIsRestricted] = useState(!!course.isRestricted);
  const [price, setPrice] = useState<number>(course.price || 0);
  const [bkashNumber, setBkashNumber] = useState<string>(course.bkashNumber || '01700000000');
  const [allowedUsers, setAllowedUsers] = useState<string[]>(course.allowedUsers || []);
  const [allowedUsersExpiry, setAllowedUsersExpiry] = useState<Record<string, string>>(course.allowedUsersExpiry || {});
  const [newUserInput, setNewUserInput] = useState('');
  const [newStudentExpiry, setNewStudentExpiry] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkExpiryDate, setBulkExpiryDate] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);

  // --- FEATURE & VARIABLE TOGGLES ---
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    meaning: true,
    synonyms: true,
    extraWord: true,
    extraMeaning: true,
    example: true,
    audio: true,
    ...(course.variableToggles || {})
  });

  // --- WORDS LIST STATES ---
  const [localWords, setLocalWords] = useState<VocabularyWord[]>(course.words || []);
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [wordGroupFilter, setWordGroupFilter] = useState<string>('all');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  
  // Word editing states
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [editedWord, setEditedWord] = useState('');
  const [editedMeaning, setEditedMeaning] = useState('');
  const [editedGroup, setEditedGroup] = useState<string>('1');
  const [editedSynonyms, setEditedSynonyms] = useState('');
  const [editedExtraWord, setEditedExtraWord] = useState('');
  const [editedExtraMeaning, setEditedExtraMeaning] = useState('');
  const [editedExample, setEditedExample] = useState('');

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

  // --- GENERAL ACTIONS ---
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
    setPrice(course.price || 0);
    setBkashNumber(course.bkashNumber || '01700000000');
    setAllowedUsers(course.allowedUsers || []);
    setAllowedUsersExpiry(course.allowedUsersExpiry || {});
    setBulkInput((course.allowedUsers || []).join('\n'));
    setLocalWords(course.words || []);
    setToggles({
      meaning: true,
      synonyms: true,
      extraWord: true,
      extraMeaning: true,
      example: true,
      audio: true,
      ...(course.variableToggles || {})
    });
    setSelectedWordIds(new Set());
    setActiveTab('general');
  }, [course]);

  // Compute variable availability based on real word list data
  const variableAvailability = useMemo(() => {
    const status = {
      meaning: false,
      synonyms: false,
      extraWord: false,
      extraMeaning: false,
      example: false,
      audio: true, // Audio can always be enabled
    };
    localWords.forEach(w => {
      if (w.meaning && w.meaning.trim() !== '') status.meaning = true;
      if (w.synonyms && w.synonyms.trim() !== '') status.synonyms = true;
      if (w.extraWord && w.extraWord.trim() !== '') status.extraWord = true;
      if (w.extraMeaning && w.extraMeaning.trim() !== '') status.extraMeaning = true;
      if (w.example && w.example.trim() !== '') status.example = true;
    });
    return status;
  }, [localWords]);

  // Handle adding a single user to restricted access list
  const handleAddUser = () => {
    const input = newUserInput.trim();
    if (!input) return;

    if (allowedUsers.includes(input)) {
      setError('This student is already in the list.');
      return;
    }

    setAllowedUsers(prev => [...prev, input]);
    if (newStudentExpiry) {
      setAllowedUsersExpiry(prev => ({
        ...prev,
        [input]: newStudentExpiry
      }));
    }
    setNewUserInput('');
    setNewStudentExpiry('');
    setError(null);
  };

  // Handle removing a single user
  const handleRemoveUser = (userToRemove: string) => {
    setAllowedUsers(prev => prev.filter(u => u !== userToRemove));
    setAllowedUsersExpiry(prev => {
      const copy = { ...prev };
      delete copy[userToRemove];
      return copy;
    });
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
    
    const unique: string[] = Array.from(new Set(parsed));
    setAllowedUsers(unique);

    if (bulkExpiryDate) {
      const newExpiries: Record<string, string> = { ...allowedUsersExpiry };
      unique.forEach(user => {
        newExpiries[user] = bulkExpiryDate;
      });
      setAllowedUsersExpiry(newExpiries);
    }
    
    setIsBulkMode(false);
    setError(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(course.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // --- INDIVIDUAL WORD EDITING ACTION ---
  const handleStartEditWord = (w: VocabularyWord) => {
    setEditingWord(w);
    setEditedWord(w.word || '');
    setEditedMeaning(w.meaning || '');
    setEditedGroup(String(w.group || '1'));
    setEditedSynonyms(w.synonyms || '');
    setEditedExtraWord(w.extraWord || '');
    setEditedExtraMeaning(w.extraMeaning || '');
    setEditedExample(w.example || '');
  };

  const handleSaveWordEdit = () => {
    if (!editingWord) return;
    if (!editedWord.trim() || !editedMeaning.trim()) {
      alert('Word and meaning fields are required.');
      return;
    }

    let groupVal: string | number = editedGroup.trim();
    const numGrp = parseInt(editedGroup.trim(), 10);
    if (!isNaN(numGrp) && String(numGrp) === editedGroup.trim()) {
      groupVal = numGrp;
    }

    setLocalWords(prev => prev.map(w => {
      if (w.id === editingWord.id) {
        return {
          ...w,
          word: editedWord.trim(),
          meaning: editedMeaning.trim(),
          group: groupVal,
          synonyms: editedSynonyms.trim(),
          extraWord: editedExtraWord.trim(),
          extraMeaning: editedExtraMeaning.trim(),
          example: editedExample.trim()
        };
      }
      return w;
    }));

    setEditingWord(null);
  };

  // --- SINGLE WORD ADDITION HANDLER ---
  const handleAddSingleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormMessage(null);

    if (!singleWord.trim() || !singleMeaning.trim()) {
      setAddFormMessage({ type: 'error', text: 'Word and meaning fields are required.' });
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
      text: `"${newWordItem.word}" has been successfully added to the local list! Click "Update Settings" below to save changes permanently.` 
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
          setExcelError('No words found in the spreadsheet.');
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
          setExcelError('Columns did not match! The spreadsheet must contain at least "main word" and "bangla meaning" columns.');
          return;
        }

        setLocalWords(prev => [...prev, ...wordsList]);
        setExcelSuccess(`Successfully added ${wordsList.length} new words from the Excel file! Click "Update Settings" below to save permanently.`);
      } catch (err) {
        console.error(err);
        setExcelError('Failed to process spreadsheet file. Please verify it is a valid format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- DELETION ACTIONS ---
  const handleDeleteWord = (id: string) => {
    if (window.confirm('Are you sure you want to delete this word from the course?')) {
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
    if (window.confirm(`Are you sure you want to delete the selected ${selectedWordIds.size} words from the course?`)) {
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

    if (!window.confirm('Are you sure you want to save all changes for this course to the cloud database?')) {
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

      // Force toggles off for variables which have no data
      const finalToggles = { ...toggles };
      Object.keys(variableAvailability).forEach(key => {
        if (!variableAvailability[key as keyof typeof variableAvailability]) {
          finalToggles[key] = false;
        }
      });

      const updatedCourse: Course = {
        ...course,
        title: title.trim(),
        description: description.trim(),
        isDefault: isDefault,
        isRestricted: isRestricted,
        allowedUsers: finalAllowedUsers, // Always preserve the allowed users list
        allowedUsersExpiry: allowedUsersExpiry, // Save student access expiry dates map
        words: localWords,
        variableToggles: finalToggles,
        totalGroups: uniqueGroupsSize || 1,
        price: Number(price) || 0,
        bkashNumber: bkashNumber.trim(),
      };

      await setDoc(doc(db, 'courses', course.id), updatedCourse);
      
      setSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error updating course in Firestore:', err);
      setError('Failed to save data to the cloud. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Navigation Items with Icons and Count Badges
  const menuItems = [
    { id: 'general' as const, label: 'Course Identity', icon: Sliders },
    { id: 'variables' as const, label: 'Features & Variables', icon: Settings },
    { id: 'access' as const, label: 'Student Access', icon: Users },
    { id: 'students' as const, label: 'Allowed Students', icon: UserCheck, badge: allowedUsers.length },
    { id: 'wordlist' as const, label: 'Word List & Editing', icon: BookOpen, badge: localWords.length },
    { id: 'addwords' as const, label: 'Add & Upload Words', icon: PlusCircle },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in text-slate-700" id="course-settings-modal">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl relative animate-scale-up font-sans overflow-hidden border border-slate-100 flex flex-col m-4 h-[90vh] transition-all duration-300">
        
        {/* Modal Main Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">{course.title} — Course Settings Panel</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5 font-sans flex items-center gap-2">
                <span>Code: {course.id}</span>
                <button 
                  onClick={handleCopyCode} 
                  className="p-1 hover:bg-indigo-100/50 rounded text-indigo-500 hover:text-indigo-700 transition cursor-pointer flex items-center gap-1"
                  title="Copy share code"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold">Copy Code</span>
                </button>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified Layout with Left Sidebar and Right Pane Content */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Sidebar */}
          <aside className="w-64 border-r border-slate-100 bg-slate-50/50 hidden md:flex flex-col p-4 space-y-2 overflow-y-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 mb-2 block">Course Control Section</span>
            {menuItems.map(item => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition text-left cursor-pointer outline-none ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                    </div>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Right Pane (Scrollable Content area) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Mobile Tab Select Overlay (only visible on small screens) */}
            <div className="md:hidden flex border-b border-slate-100 pb-3 overflow-x-auto gap-2 scrollbar-none">
              {menuItems.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-4 py-2 text-xs font-black rounded-full flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                      isActive ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[9px] bg-slate-900/10 px-1.5 py-0.2 rounded-full">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Error & Success Messages */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
                <span>All course changes have been successfully saved to the cloud!</span>
              </div>
            )}

            {/* --- SECTION 1: GENERAL INFO --- */}
            {activeTab === 'general' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Identity & Basic Information</h4>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-600 block">Course Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                    placeholder="Enter course title"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-600 block">Course Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-semibold transition resize-none text-slate-700 leading-relaxed"
                    placeholder="Enter course description..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">কোর্সের মূল্য (টাকা) / Course Price (TK)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">বিকাশ নাম্বার (সেন্ড মানি) / bKash Number</label>
                    <input
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                      placeholder="e.g. 017XXXXXXXX"
                    />
                  </div>
                </div>

                <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-3.5">
                  <HelpCircle className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs leading-relaxed text-indigo-950 font-medium">
                    <p className="font-black text-indigo-900 text-xs">Sharing Guidelines</p>
                    <p className="mt-1">
                      Students can use the unique share code above to search and enroll in this custom course from their home dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECTION 2: VARIABLE OPTION SWITCHES --- */}
            {activeTab === 'variables' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Feature & Variable Controller</h4>
                </div>

                <div className="bg-amber-50 border border-amber-100 text-amber-900 p-4 rounded-2xl text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-black text-amber-950 block">Variable Auto-Alignment Policy</span>
                    <p className="mt-0.5">
                      Switches for variables with no data in your word list are automatically disabled. Content is seamlessly adapted if features (such as synonyms) are disabled.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white divide-y divide-slate-100">
                  {[
                    { key: 'meaning', label: 'Bengali Meaning', desc: 'Displays the Bengali translation on the back side of the flashcard', icon: BookOpen },
                    { key: 'synonyms', label: 'Synonyms', desc: 'Displays synonyms on the back side of the flashcard. If disabled, the primary meaning is centered.', icon: Eye },
                    { key: 'extraWord', label: 'Extra Word Derivative', desc: 'Displays word derivatives below the main word on the front side of the flashcard', icon: PlusCircle },
                    { key: 'extraMeaning', label: 'Extra Derivative Meaning', desc: 'Displays the Bengali meaning of the derivative word on the front side of the flashcard', icon: HelpCircle },
                    { key: 'example', label: 'Example Sentences', desc: 'Displays real-world usage examples and sentences on the back side of the flashcard', icon: FileSpreadsheet },
                    { key: 'audio', label: 'Voice Pronunciation Audio', desc: 'Enables audio speaker button for word pronunciation on the flashcard', icon: Volume2 },
                  ].map(item => {
                    const hasData = variableAvailability[item.key as keyof typeof variableAvailability];
                    const isEnabled = toggles[item.key] !== false;
                    
                    return (
                      <div 
                        key={item.key} 
                        className={`p-4 flex items-start justify-between gap-4 transition-all duration-200 ${
                          !hasData ? 'bg-slate-50/70 opacity-55' : 'bg-white hover:bg-slate-50/40'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            !hasData ? 'bg-slate-200 text-slate-400' : isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {item.label}
                              {!hasData && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-black">
                                  No Data
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-450 font-medium block mt-1 leading-relaxed">{item.desc}</span>
                          </div>
                        </div>

                        {/* Switch Switch Button */}
                        <button
                          type="button"
                          disabled={!hasData}
                          onClick={() => {
                            if (hasData) {
                              setToggles(prev => ({
                                ...prev,
                                [item.key]: !prev[item.key]
                              }));
                            }
                          }}
                          className={`mt-1 transition-all ${!hasData ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
                        >
                          {isEnabled && hasData ? (
                            <ToggleRight className="w-10 h-10 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-300" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- SECTION 3: STUDENT ACCESS & PRIVACY SETTINGS --- */}
            {activeTab === 'access' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Student Access & Enroll Security</h4>
                </div>

                {/* Switch list */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-4">
                  {/* Default Course */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-slate-800 block">Set as Default Course for All Users</span>
                      <span className="text-[10px] text-slate-450 font-medium block leading-normal">If enabled, all registered users will see this course automatically on their dashboard.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDefault(!isDefault)}
                      className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer active:scale-95"
                    >
                      {isDefault ? (
                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Restricted access */}
                  <div className="border-t border-slate-200/50 pt-3.5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-slate-800 block">Restricted Access (Restricted Course)</span>
                      <span className="text-[10px] text-slate-450 font-medium block leading-normal">If enabled, only registered students in the allowed list can access and enroll in this course.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRestricted(!isRestricted)}
                      className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer active:scale-95"
                    >
                      {isRestricted ? (
                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-950 flex items-start gap-2.5 leading-relaxed font-semibold">
                  <AlertCircle className="w-4.5 h-4.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span>Access Configuration Guideline</span>
                    <p className="font-normal text-[11px] text-indigo-900 mt-0.5">
                      To manage allowed students or configure their individual access expiration dates, please switch to the <strong className="font-extrabold text-indigo-950">Allowed Students</strong> menu tab in the sidebar on the left. The student roster remains fully preserved regardless of whether this course is currently public or restricted.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECTION 3.5: ALLOWED STUDENTS LIST & EXPIRY (NEW) --- */}
            {activeTab === 'students' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm">Allowed Students Access & Expiry Management</h4>
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(!isBulkMode)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1.5 rounded-lg"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{isBulkMode ? 'Back to Individual Add' : 'Bulk Import Lists'}</span>
                  </button>
                </div>

                {isBulkMode ? (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <span className="text-xs font-extrabold text-slate-800 block">Bulk Import Student List</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Default Expiry Date (Optional)</label>
                        <input
                          type="date"
                          value={bulkExpiryDate}
                          onChange={(e) => setBulkExpiryDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition cursor-pointer"
                        />
                      </div>
                      <div className="text-xs text-slate-500 flex items-center font-semibold leading-relaxed">
                        If specified, this expiration date will be applied to all students in the bulk import list. If left empty, their access will be permanent.
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Paste Emails or Phone Numbers (One per line)</label>
                      <textarea
                        rows={6}
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        placeholder="user1@gmail.com&#10;user2@gmail.com&#10;01712345678"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition resize-none text-slate-700"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyBulk}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition cursor-pointer"
                    >
                      Apply Bulk List
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <span className="text-xs font-extrabold text-slate-800 block">Add Individual Student</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Email or Phone Number</label>
                        <input
                          type="text"
                          value={newUserInput}
                          onChange={(e) => setNewUserInput(e.target.value)}
                          placeholder="student@gmail.com or 01712345678"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold text-slate-700 transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Access Expiration Date (Optional)</label>
                        <input
                          type="date"
                          value={newStudentExpiry}
                          onChange={(e) => setNewStudentExpiry(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold text-slate-700 transition cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddUser}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Student to Allowed List</span>
                    </button>
                  </div>
                )}

                {/* Always Show the List */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span>Allowed Student List ({allowedUsers.length})</span>
                    </span>
                    {allowedUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Clear all students from the list?')) {
                            setAllowedUsers([]);
                            setAllowedUsersExpiry({});
                          }
                        }}
                        className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-1 rounded transition"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {allowedUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs font-semibold">
                      No students registered in the allowed list yet. Use the fields above to add students.
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-150">
                      {/* Header Row */}
                      <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <div className="col-span-5">Student Identifier</div>
                        <div className="col-span-4">Access Expiry Date</div>
                        <div className="col-span-2 text-center">Status</div>
                        <div className="col-span-1 text-right">Action</div>
                      </div>

                      {/* Student List */}
                      <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                        {allowedUsers.map(user => {
                          const expiry = allowedUsersExpiry[user] || '';
                          let isExpired = false;
                          if (expiry) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const expDate = new Date(expiry);
                            expDate.setHours(23, 59, 59, 999);
                            if (today > expDate) {
                              isExpired = true;
                            }
                          }

                          return (
                            <div key={user} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs text-slate-700 hover:bg-slate-50 transition">
                              <div className="col-span-5 font-mono font-bold truncate" title={user}>
                                {user}
                              </div>
                              <div className="col-span-4 pr-2">
                                <input
                                  type="date"
                                  value={expiry}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAllowedUsersExpiry(prev => ({
                                      ...prev,
                                      [user]: val
                                    }));
                                  }}
                                  className="px-2 py-1 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 transition w-full cursor-pointer"
                                  title="Change expiration date anytime"
                                />
                              </div>
                              <div className="col-span-2 text-center">
                                {expiry ? (
                                  isExpired ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100 inline-block">
                                      Expired
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100 inline-block">
                                      Active
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100 inline-block">
                                    Permanent
                                  </span>
                                )}
                              </div>
                              <div className="col-span-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUser(user)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove from allowed list"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- SECTION 4: WORD DIRECTORY & INDIVIDUAL EDIT --- */}
            {activeTab === 'wordlist' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Word Directory & Individual Editing</h4>
                  </div>

                  {selectedWordIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedWords}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer animate-fadeIn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedWordIds.size})</span>
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={wordSearchQuery}
                      onChange={(e) => setWordSearchQuery(e.target.value)}
                      placeholder="Search by word or meaning..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <select
                    value={wordGroupFilter}
                    onChange={(e) => setWordGroupFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-black focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Groups</option>
                    {uniqueLocalGroups.map(g => (
                      <option key={g} value={String(g)}>Group {g}</option>
                    ))}
                  </select>
                </div>

                {/* Word list table */}
                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 border-b border-slate-200/65 uppercase tracking-wider">
                          <th className="px-4 py-3 w-10 text-center">
                            <input 
                              type="checkbox" 
                              checked={isAllPageSelected}
                              onChange={handleSelectAllPage}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3">Word (English)</th>
                          <th className="px-4 py-3">Meaning (Bangla)</th>
                          <th className="px-4 py-3 text-center">Group</th>
                          <th className="px-4 py-3 hidden sm:table-cell">Synonyms / Derivatives</th>
                          <th className="px-4 py-3 w-24 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {paginatedWords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold bg-white">
                              No words found. Try changing filters or adding some words.
                            </td>
                          </tr>
                        ) : (
                          paginatedWords.map(w => {
                            const isSelected = selectedWordIds.has(w.id);
                            return (
                              <tr key={w.id} className={`hover:bg-slate-50/50 transition ${
                                isSelected ? 'bg-indigo-50/15' : 'bg-white'
                              }`}>
                                <td className="px-4 py-2 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(w.id)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-2 font-black text-slate-900 font-sans">{w.word}</td>
                                <td className="px-4 py-2 text-slate-600 font-bold">{w.meaning}</td>
                                <td className="px-4 py-2 text-center"><span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black text-[10px]">{w.group}</span></td>
                                <td className="px-4 py-2 text-slate-400 text-[10px] hidden sm:table-cell truncate max-w-xs leading-relaxed">
                                  {w.synonyms && <span className="block truncate">Synonyms: {w.synonyms}</span>}
                                  {w.extraWord && <span className="block truncate mt-0.5">Derivative: {w.extraWord} ({w.extraMeaning})</span>}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditWord(w)}
                                      className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                                      title="Edit Word"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWord(w.id)}
                                      className="p-1.5 text-slate-350 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                      title="Delete Word"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Pagination */}
                {totalWordPages > 1 && (
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs font-semibold">
                    <button
                      type="button"
                      disabled={currentWordPage === 1}
                      onClick={() => setCurrentWordPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    
                    <span className="font-extrabold text-slate-500">
                      Page {currentWordPage} of {totalWordPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentWordPage === totalWordPages}
                      onClick={() => setCurrentWordPage(prev => Math.min(totalWordPages, prev + 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* --- SECTION 5: ADD NEW WORDS (SINGLE OR EXCEL) --- */}
            {activeTab === 'addwords' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Add Words & Upload Excel Spreadsheets</h4>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* Single Word Form */}
                  <form onSubmit={handleAddSingleWordSubmit} className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">1. Individual Word</span>
                    </div>

                    {addFormMessage && (
                      <div className={`p-3 rounded-xl text-xs font-bold ${
                        addFormMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {addFormMessage.text}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Word (English) <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          value={singleWord}
                          onChange={(e) => setSingleWord(e.target.value)}
                          placeholder="e.g. Abate" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Bangla Meaning <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          value={singleMeaning}
                          onChange={(e) => setSingleMeaning(e.target.value)}
                          placeholder="e.g. decrease / reduce (or Bangla equivalent)" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Group/Level (Group Name/No.) <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          value={singleGroup}
                          onChange={(e) => setSingleGroup(e.target.value)}
                          placeholder="e.g. 1" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Synonyms</label>
                        <input 
                          type="text" 
                          value={singleSynonyms}
                          onChange={(e) => setSingleSynonyms(e.target.value)}
                          placeholder="e.g. decrease, subside" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Extra Word (Derivative)</label>
                        <input 
                          type="text" 
                          value={singleExtraWord}
                          onChange={(e) => setSingleExtraWord(e.target.value)}
                          placeholder="e.g. Abated" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Extra Meaning (Derivative Meaning)</label>
                        <input 
                          type="text" 
                          value={singleExtraMeaning}
                          onChange={(e) => setSingleExtraMeaning(e.target.value)}
                          placeholder="e.g. Bangla translation for derivative" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">Example Sentence</label>
                      <input 
                        type="text" 
                        value={singleExample}
                        onChange={(e) => setSingleExample(e.target.value)}
                        placeholder="e.g. The storm abated after midnight." 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Save Word</span>
                    </button>
                  </form>

                  {/* Excel Upload Sub-panel */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                        <span className="text-xs font-black text-slate-800">2. Bulk Import Excel</span>
                      </div>

                      <p className="text-[11px] text-slate-450 leading-relaxed mt-2 font-medium">
                        Your spreadsheet must contain <strong className="text-slate-700 font-extrabold">word</strong> (or <strong className="text-slate-700 font-extrabold">main word</strong>) and <strong className="text-slate-700 font-extrabold">meaning</strong> (or <strong className="text-slate-700 font-extrabold">bangla meaning</strong>) columns. You can optionally include <strong className="text-slate-700 font-extrabold">group, synonyms, extra word, extra meaning, example</strong> columns.
                      </p>

                      {excelError && (
                        <div className="p-3 mt-3 bg-rose-50 border border-rose-100 text-rose-700 font-bold text-xs rounded-xl">
                          {excelError}
                        </div>
                      )}

                      {excelSuccess && (
                        <div className="p-3 mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-xs rounded-xl animate-fadeIn">
                          {excelSuccess}
                        </div>
                      )}
                    </div>

                    {/* Drag & Drop Zone */}
                    <div 
                      onDragEnter={handleWordsDrag}
                      onDragOver={handleWordsDrag}
                      onDragLeave={handleWordsDrag}
                      onDrop={handleWordsDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer h-40 ${
                        dragActiveWords 
                          ? 'border-indigo-500 bg-indigo-50/30' 
                          : 'border-slate-250 bg-white hover:border-slate-350'
                      }`}
                    >
                      <UploadCloud className="w-8 h-8 text-indigo-500" />
                      <div>
                        <label className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition cursor-pointer">
                          Select Excel File
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleWordsFileInputChange} 
                            className="hidden" 
                          />
                        </label>
                        <span className="text-[10px] text-slate-400 block mt-1 font-medium">or drag and drop here (xlsx, xls format)</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>

        {/* Word Editing Inline Modal/Overlay Overlay */}
        {editingWord && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 animate-fade-in text-slate-700">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 relative space-y-4 animate-scale-up border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Edit className="w-4 h-4 text-indigo-650" />
                  <span>Word Individual Editor</span>
                </span>
                <button onClick={() => setEditingWord(null)} className="p-1 hover:bg-slate-100 rounded text-slate-450 hover:text-slate-650 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Word (English)</label>
                  <input 
                    type="text" 
                    value={editedWord}
                    onChange={(e) => setEditedWord(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Bangla Meaning</label>
                  <input 
                    type="text" 
                    value={editedMeaning}
                    onChange={(e) => setEditedMeaning(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Group / Level</label>
                  <input 
                    type="text" 
                    value={editedGroup}
                    onChange={(e) => setEditedGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Synonyms</label>
                  <input 
                    type="text" 
                    value={editedSynonyms}
                    onChange={(e) => setEditedSynonyms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Derivative / Extra Word</label>
                  <input 
                    type="text" 
                    value={editedExtraWord}
                    onChange={(e) => setEditedExtraWord(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Derivative Meaning</label>
                  <input 
                    type="text" 
                    value={editedExtraMeaning}
                    onChange={(e) => setEditedExtraMeaning(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Example Sentence</label>
                <textarea 
                  rows={2}
                  value={editedExample}
                  onChange={(e) => setEditedExample(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium resize-none leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  onClick={() => setEditingWord(null)} 
                  className="px-4 py-2 bg-slate-200 text-slate-650 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveWordEdit} 
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-550 transition shadow-md"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Main Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3.5">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Update Settings</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
