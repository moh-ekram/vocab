import React, { useState, useEffect } from 'react';
import { 
  db, 
  auth,
  doc,
  setDoc
} from '../lib/firebase';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { VocabularyWord, UserProgress, Course } from '../types';
import { read, utils } from 'xlsx';
import { CourseSettings } from './CourseSettings';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  ChevronRight, 
  Calendar, 
  Flame, 
  TrendingUp, 
  Award, 
  Info, 
  RefreshCw, 
  Database, 
  HeartCrack, 
  User as UserIcon, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  Clock, 
  Sliders,
  ChevronDown,
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  PlusCircle,
  BookOpen
} from 'lucide-react';

interface FirestoreUserDoc {
  id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  progress?: Record<string, UserProgress>;
  goal?: {
    dailyTarget?: number;
    streak?: number;
    lastStudyDate?: string;
    history?: Record<string, any>;
  };
  synonymProgress?: Record<string, { correct: boolean; updatedAt: string }>;
  settings?: any;
}

interface AdminPanelProps {
  words: VocabularyWord[];
}

enum OperationType {
  LIST = 'list',
  GET = 'get',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function getProgressValues(progObj: Record<string, UserProgress> | undefined): UserProgress[] {
  return Object.values(progObj || {}) as UserProgress[];
}

function getProgressEntries(progObj: Record<string, UserProgress> | undefined): [string, UserProgress][] {
  return Object.entries(progObj || {}) as [string, UserProgress][];
}

export default function AdminPanel({ words }: AdminPanelProps) {
  const [users, setUsers] = useState<FirestoreUserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'email' | 'streak' | 'progress' | 'lastActive'>('lastActive');
  const [selectedUser, setSelectedUser] = useState<FirestoreUserDoc | null>(null);
  const [activeUserTab, setActiveUserTab] = useState<'progress' | 'analytics' | 'settings'>('progress');
  const [activeWordFilter, setActiveWordFilter] = useState<'all' | 'know' | 'confusion' | 'dont_know'>('all');

  // Course management and upload states
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'courses'>('users');
  const [customCourses, setCustomCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // New course form states
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [uploadedWords, setUploadedWords] = useState<VocabularyWord[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [creationMethod, setCreationMethod] = useState<'excel' | 'paste'>('excel');
  const [pasteInputText, setPasteInputText] = useState('');

  // Course access and default settings states
  const [newCourseIsDefault, setNewCourseIsDefault] = useState(false);
  const [newCourseIsRestricted, setNewCourseIsRestricted] = useState(false);
  const [newCourseAllowedUsersText, setNewCourseAllowedUsersText] = useState('');

  // Editing course states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Fetch custom courses
  const fetchCustomCourses = async () => {
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const qSnap = await getDocs(collection(db, 'courses'));
      const list: Course[] = [];
      qSnap.forEach(docSnap => {
        list.push(docSnap.data() as Course);
      });
      setCustomCourses(list);
    } catch (err) {
      console.error('Error fetching custom courses:', err);
      setCoursesError('Failed to load courses list from Cloud Firestore.');
    } finally {
      setCoursesLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomCourses();
  }, []);

  // Sync slug from title
  useEffect(() => {
    const slug = newCourseTitle
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove special chars
      .replace(/[\s_]+/g, '-')  // replace spaces with hyphen
      .replace(/^-+|-+$/g, ''); // trim outer hyphens
    setNewCourseId(slug);
  }, [newCourseTitle]);

  const fetchUsersData = async () => {
    setLoading(true);
    setError(null);
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const fetchedUsers: FirestoreUserDoc[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUsers.push({
          id: doc.id,
          email: data.email || 'unknown@user.com',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          progress: data.progress || {},
          goal: data.goal || {},
          synonymProgress: data.synonymProgress || {},
          settings: data.settings || {}
        });
      });
      setUsers(fetchedUsers);
    } catch (err) {
      setError('Failed to load users data from Firestore. Please verify Firestore Security Rules.');
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (e) {
        // Suppress or handle rethrown JSON error
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadError(null);
    setUploadedWords([]);
    
    if (!newCourseId) {
      setUploadError('Please provide a course title before uploading files.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          setUploadError('No data found in the selected Excel sheet.');
          return;
        }

        const wordsList: VocabularyWord[] = [];
        let index = 1;

        for (const row of rawRows) {
          // Normalise keys to lowercase, trimming whitespaces
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
          const synonym1Key = findKey(['synonym1', 'synonm1', 'syn1']);
          const synonym2Key = findKey(['synonym2', 'synonm2', 'syn2']);
          const synonymsKey = findKey(['synonyms']);
          const extraWordKey = findKey(['extra word']);
          const extraMeaningKey = findKey(['extra meaning']);
          const exampleKey = findKey(['example']);

          const baseWord = wordKey ? String(row[wordKey]).trim() : '';
          const banglaMeaning = meaningKey ? String(row[meaningKey]).trim() : '';

          if (!baseWord || !banglaMeaning) {
            continue; // Skip invalid rows
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
          const synParts = [];
          if (synonym1Key && row[synonym1Key]) synParts.push(String(row[synonym1Key]).trim());
          if (synonym2Key && row[synonym2Key]) synParts.push(String(row[synonym2Key]).trim());

          if (synParts.length > 0) {
            synonyms = synParts.join(', ');
          } else if (synonymsKey && row[synonymsKey]) {
            synonyms = String(row[synonymsKey]).trim();
          }

          const example = exampleKey ? String(row[exampleKey]).trim() : '';
          const extraWord = extraWordKey ? String(row[extraWordKey]).trim() : '';
          const extraMeaning = extraMeaningKey ? String(row[extraMeaningKey]).trim() : '';

          wordsList.push({
            id: `${newCourseId}_g${group}_w${index}`,
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
          setUploadError('Columns did not match! Please make sure you have at least "main word" and "bangla meaning" columns.');
          return;
        }

        setUploadedWords(wordsList);
      } catch (err) {
        console.error(err);
        setUploadError('Failed to process Excel file. Please use a valid spreadsheet format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processPastedText = (text: string) => {
    setUploadError(null);
    setUploadedWords([]);
    
    if (!newCourseId) {
      setUploadError('Please provide a course title first to generate course ID.');
      return;
    }

    if (!text.trim()) {
      return;
    }

    try {
      const lines = text.split(/\r?\n/);
      const parsedWords: VocabularyWord[] = [];
      let index = 1;

      // Check if first line has headers like 'word', 'meaning'
      let startIdx = 0;
      let colIdxs = {
        word: 0,
        meaning: 1,
        group: 2,
        synonym1: -1,
        synonym2: -1,
        synonyms: 3,
        extraWord: 4,
        extraMeaning: 5,
        example: 6
      };

      if (lines.length > 0) {
        const firstLineCells = lines[0].split('\t').map(c => c.toLowerCase().trim());
        const hasHeader = firstLineCells.some(c => c === 'word' || c === 'main word' || c === 'meaning' || c === 'bangla meaning');
        if (hasHeader) {
          startIdx = 1; // skip header row
          const wordPos = firstLineCells.findIndex(c => c === 'word' || c === 'main word');
          const meaningPos = firstLineCells.findIndex(c => c === 'meaning' || c === 'bangla meaning');
          const groupPos = firstLineCells.findIndex(c => c === 'group');
          const syn1Pos = firstLineCells.findIndex(c => c === 'synonym1' || c === 'synonm1' || c === 'syn1');
          const syn2Pos = firstLineCells.findIndex(c => c === 'synonym2' || c === 'synonm2' || c === 'syn2');
          const synsPos = firstLineCells.findIndex(c => c === 'synonyms');
          const extraWPos = firstLineCells.findIndex(c => c === 'extra word');
          const extraMPos = firstLineCells.findIndex(c => c === 'extra meaning');
          const exPos = firstLineCells.findIndex(c => c === 'example');

          if (wordPos !== -1) colIdxs.word = wordPos;
          if (meaningPos !== -1) colIdxs.meaning = meaningPos;
          colIdxs.group = groupPos !== -1 ? groupPos : -1;
          colIdxs.synonym1 = syn1Pos !== -1 ? syn1Pos : -1;
          colIdxs.synonym2 = syn2Pos !== -1 ? syn2Pos : -1;
          colIdxs.synonyms = synsPos !== -1 ? synsPos : -1;
          colIdxs.extraWord = extraWPos !== -1 ? extraWPos : -1;
          colIdxs.extraMeaning = extraMPos !== -1 ? extraMPos : -1;
          colIdxs.example = exPos !== -1 ? exPos : -1;
        }
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const cells = line.split('\t');
        if (cells.length < 2) {
          // Try split by comma or semi-colon if they pasted CSV/SSV
          const commaCells = line.split(',');
          if (commaCells.length >= 2) {
            cells.splice(0, cells.length, ...commaCells);
          }
        }

        const baseWord = cells[colIdxs.word]?.trim() || '';
        const banglaMeaning = cells[colIdxs.meaning]?.trim() || '';

        if (!baseWord || !banglaMeaning) {
          continue; // Skip invalid rows
        }

        let group: string | number = 1;
        if (colIdxs.group !== -1 && cells[colIdxs.group]) {
          const rawGrp = cells[colIdxs.group].trim();
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
        const synParts = [];
        if (colIdxs.synonym1 !== -1 && cells[colIdxs.synonym1]) synParts.push(cells[colIdxs.synonym1].trim());
        if (colIdxs.synonym2 !== -1 && cells[colIdxs.synonym2]) synParts.push(cells[colIdxs.synonym2].trim());

        if (synParts.length > 0) {
          synonyms = synParts.join(', ');
        } else if (colIdxs.synonyms !== -1 && cells[colIdxs.synonyms]) {
          synonyms = cells[colIdxs.synonyms].trim();
        }

        const extraWord = colIdxs.extraWord !== -1 ? cells[colIdxs.extraWord]?.trim() || '' : '';
        const extraMeaning = colIdxs.extraMeaning !== -1 ? cells[colIdxs.extraMeaning]?.trim() || '' : '';
        const example = colIdxs.example !== -1 ? cells[colIdxs.example]?.trim() || '' : '';

        parsedWords.push({
          id: `${newCourseId}_g${group}_w${index}`,
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

      if (parsedWords.length === 0) {
        setUploadError('No valid data found. First column must be the word, and second column must be the meaning.');
        return;
      }

      setUploadedWords(parsedWords);
    } catch (err) {
      console.error(err);
      setUploadError('Failed to process pasted text. Please make sure columns are separated by Tabs or Commas.');
    }
  };

  const handleSaveCourse = async () => {
    if (!newCourseTitle.trim() || !newCourseId.trim() || uploadedWords.length === 0) {
      setSaveError('Please complete all required fields and provide valid data.');
      return;
    }

    if (!window.confirm('Are you sure you want to create and save this course?')) {
      return;
    }

    setSaveStatus('saving');
    setSaveError(null);

    try {
      // Find total number of unique groups in uploaded word list
      const groups = new Set(uploadedWords.map(w => w.group));
      const totalGroups = groups.size;

      // Parse allowed users list from text area (one user per line)
      const allowedUsers: string[] = [];
      if (newCourseIsRestricted && newCourseAllowedUsersText.trim()) {
        newCourseAllowedUsersText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .forEach(user => allowedUsers.push(user));
      }

      const courseData: Course = {
        id: newCourseId,
        title: newCourseTitle.trim(),
        description: newCourseDesc.trim() || `${uploadedWords.length} words vocabulary course.`,
        totalGroups,
        words: uploadedWords,
        isDefault: newCourseIsDefault,
        isRestricted: newCourseIsRestricted,
        allowedUsers: allowedUsers,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'admin@gmail.com'
      };

      await setDoc(doc(db, 'courses', newCourseId), courseData);
      
      setSaveStatus('saved');
      setNewCourseTitle('');
      setNewCourseDesc('');
      setUploadedWords([]);
      setPasteInputText('');
      setNewCourseIsDefault(false);
      setNewCourseIsRestricted(false);
      setNewCourseAllowedUsersText('');
      fetchCustomCourses();
    } catch (err) {
      console.error('Error saving course to Firestore:', err);
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this course? All cloud records will be permanently erased!')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      fetchCustomCourses();
      alert('Course deleted successfully!');
    } catch (err) {
      console.error('Error deleting course:', err);
      alert('Failed to delete course.');
    }
  };

  const handleOpenEditModal = (course: Course) => {
    setEditingCourse(course);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  // Processing users stats
  const totalUsers = users.length;
  
  const averageStreak = totalUsers > 0 
    ? Math.round(users.reduce((acc, curr) => acc + (curr.goal?.streak || 0), 0) / totalUsers)
    : 0;

  const topStreak = totalUsers > 0
    ? Math.max(...users.map(u => u.goal?.streak || 0))
    : 0;

  const totalWordsKnownAll = users.reduce((acc, u) => {
    if (!u.progress) return acc;
    return acc + getProgressValues(u.progress).filter(p => p.status === 'know').length;
  }, 0);

  const averageWordsKnown = totalUsers > 0 ? Math.round(totalWordsKnownAll / totalUsers) : 0;

  // Filter & Sort Users
  const filteredUsers = users
    .filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'streak') {
        return (b.goal?.streak || 0) - (a.goal?.streak || 0);
      } else if (sortBy === 'progress') {
        const aKnown = getProgressValues(a.progress).filter(p => p.status === 'know').length;
        const bKnown = getProgressValues(b.progress).filter(p => p.status === 'know').length;
        return bKnown - aKnown;
      } else {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      }
    });

  // Default course with potential Firestore updates
  const dbGreCourse = customCourses.find(c => c.id === 'gre');
  const defaultGreCourse: Course = {
    id: 'gre',
    title: dbGreCourse?.title || 'BARC Vocabulary Book',
    description: dbGreCourse?.description || 'Standard preparation course with 1,110 high-frequency words grouped into 37 levels.',
    totalGroups: 37,
    words: words,
    isDefault: dbGreCourse !== undefined ? dbGreCourse.isDefault : true,
    isRestricted: dbGreCourse?.isRestricted || false,
    allowedUsers: dbGreCourse?.allowedUsers || [],
    createdAt: dbGreCourse?.createdAt || new Date('2026-01-01').toISOString(),
    createdBy: dbGreCourse?.createdBy || 'system'
  };

  const filteredCustomCoursesList = customCourses.filter(c => c.id !== 'gre');

  return (
    <div className="space-y-8 font-sans" id="admin-panel-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-500/10" id="admin-header-banner">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute left-1/3 bottom-0 -mb-10 w-52 h-52 bg-emerald-500/15 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 rounded-full text-indigo-300 text-xs font-bold border border-indigo-400/20">
              <ShieldCheck className="w-3.5 h-3.5" /> System Admin Dashboard
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Vocabulary Memory Control Panel</h2>
            <p className="text-sm text-slate-300 max-w-xl font-medium">
              Manage user progress, database health, custom course configurations, and view central analytics synced with Firebase Cloud Firestore.
            </p>
          </div>
          
          <button 
            onClick={fetchUsersData}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 transition cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="admin-stats-row">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">Total Users</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{totalUsers}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Firestore Database</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">Avg Streak</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{averageStreak} days</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Max Streak: {topStreak} days</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">Avg Learned Words</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{averageWordsKnown} words</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Per user status</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">Firebase Status</span>
            <span className="text-base font-black text-emerald-400 truncate block">100% Optimized</span>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">Offline Persistence Active</span>
          </div>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeAdminTab === 'users'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Analytics</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('courses')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeAdminTab === 'courses'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Course Upload & Creation</span>
        </button>
      </div>

      {/* Main Grid: Directory */}
      {activeAdminTab === 'users' ? (
        <div className="grid grid-cols-1 gap-6">
          {/* User Directory Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">User Directory</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">List of registered students and summary of their study performance</p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by email..."
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs rounded-xl w-48 transition font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-600">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 cursor-pointer pr-1"
                  >
                    <option value="lastActive">Recently Active</option>
                    <option value="email">Alphabetical</option>
                    <option value="streak">Streak (🔥)</option>
                    <option value="progress">Progress (Learned)</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-xs font-bold">Fetching real-time data from Cloud Firestore...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-500 flex flex-col items-center justify-center gap-3">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-xs font-bold">{error}</p>
                <button 
                  onClick={fetchUsersData}
                  className="px-4 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100 hover:bg-rose-100 transition"
                >
                  Retry
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Users className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold">No users matched your query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-4 px-6 text-left">Student Profile</th>
                      <th className="py-4 px-3 text-center">Streak</th>
                      <th className="py-4 px-4 text-left">Progress Breakdown</th>
                      <th className="py-4 px-4 text-right">Last Synced</th>
                      <th className="py-4 px-4 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-sans">
                    {filteredUsers.map(u => {
                      const progValues = getProgressValues(u.progress);
                      const totalRated = progValues.length;
                      const knowCount = progValues.filter(p => p.status === 'know').length;
                      const confusionCount = progValues.filter(p => p.status === 'confusion').length;
                      const dontKnowCount = progValues.filter(p => p.status === 'dont_know').length;
                      const percentKnow = Math.round((knowCount / 1110) * 100) || 0;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold border border-slate-200 text-xs flex-shrink-0">
                                {u.email[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-800 truncate" title={u.email}>
                                  {u.email.split('@')[0]}
                                </p>
                                <span className="text-[10px] text-slate-400 font-semibold block truncate" title={u.email}>
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-full font-mono text-[11px]">
                              <Flame className="w-3.5 h-3.5 text-amber-500" />
                              <span>{u.goal?.streak || 0} d</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                <span>Know: {knowCount} ({percentKnow}%)</span>
                                <span className="text-[9px] font-semibold text-slate-400">
                                  {confusionCount}❓ • {dontKnowCount}❌
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${percentKnow}%` }} />
                                <div className="bg-amber-400 h-full" style={{ width: `${Math.round((confusionCount / 1110) * 100)}%` }} />
                                <div className="bg-rose-400 h-full" style={{ width: `${Math.round((dontKnowCount / 1110) * 100)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-[10px] text-slate-500 font-mono font-semibold">
                              {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black transition cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Management Left Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6 lg:col-span-2">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Course Management</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Control system defaults and manage custom uploaded courses</p>
            </div>

            <div className="space-y-4">
              {/* Default Course Card */}
              <div 
                onClick={() => handleOpenEditModal(defaultGreCourse)}
                className="p-5 border border-indigo-150 hover:border-indigo-300 rounded-2xl bg-indigo-50/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:shadow-sm cursor-pointer group"
                title="Click to edit default course settings"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-600 transition">
                      {defaultGreCourse.title}
                    </h4>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded font-black uppercase font-mono">default</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{defaultGreCourse.description}</p>
                  <div className="text-[10px] text-slate-400 font-bold flex gap-3 font-mono">
                    <span>Words: {defaultGreCourse.words?.length || 1110}</span>
                    <span>Groups: {defaultGreCourse.totalGroups}</span>
                  </div>
                  <span className="text-[9px] text-indigo-500 font-bold block pt-1 opacity-60 group-hover:opacity-100 transition">⚙️ Click here to change settings</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-indigo-600 font-extrabold font-mono uppercase bg-indigo-100/50 px-2.5 py-1 rounded-lg">EDITABLE SYSTEM DEFAULT</span>
                </div>
              </div>

              {/* Custom uploaded courses card list */}
              {filteredCustomCoursesList.length === 0 ? (
                <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl text-xs flex flex-col items-center gap-2 animate-fadeIn">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                  <div>
                    <p className="font-bold text-slate-600">No custom courses found in Firestore.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Use the right side panel to upload spreadsheet files and build dynamic custom courses!</p>
                  </div>
                </div>
              ) : (
                filteredCustomCoursesList.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleOpenEditModal(c)}
                    className="p-5 border border-slate-150 hover:border-indigo-300 rounded-2xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:shadow-sm animate-fadeIn cursor-pointer group"
                    title="Click to modify settings"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-600 transition">{c.title}</h4>
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-black uppercase font-mono">{c.id}</span>
                        {c.isDefault && (
                          <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-black uppercase">default</span>
                        )}
                        {c.isRestricted && (
                          <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-black uppercase">restricted</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{c.description}</p>
                      <div className="text-[10px] text-slate-400 font-bold flex gap-4 font-mono">
                        <span>Words: {c.words?.length || 0}</span>
                        <span>Groups: {c.totalGroups}</span>
                        <span>By: {c.createdBy || 'Unknown'}</span>
                      </div>
                      <span className="text-[9px] text-indigo-500 font-bold block pt-1 opacity-60 group-hover:opacity-100 transition">⚙️ Click here to change settings</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(c.id);
                          alert(`Course share code "${c.id}" copied to clipboard! Share this code with students.`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-xs rounded-xl transition cursor-pointer"
                        title="Copy course share code"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(c.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-105 hover:border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition font-bold text-xs rounded-xl cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Upload Form */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-5">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-600" />
                  <span>Upload & Build Course</span>
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Auto-generate courses and vocabulary content from sheets</p>
              </div>

              {/* Course Info Form Inputs */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Course Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="e.g., IELTS 500 High-Frequency Words"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Course Identifier (ID / Slug)</label>
                  <input
                    type="text"
                    disabled
                    value={newCourseId}
                    placeholder="Auto-generated from title"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-xs font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                  <span className="text-[9px] text-slate-400 block font-semibold leading-relaxed">This slug will be used as the central database identifier.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Course Description</label>
                  <textarea
                    rows={2}
                    value={newCourseDesc}
                    onChange={(e) => setNewCourseDesc(e.target.value)}
                    placeholder="Brief information about this course shown to enrolled students."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-semibold transition resize-none text-slate-700"
                  />
                </div>
              </div>

              {/* Method switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCreationMethod('excel');
                    setUploadError(null);
                    setUploadedWords([]);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    creationMethod === 'excel'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  1. Excel Upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreationMethod('paste');
                    setUploadError(null);
                    setUploadedWords([]);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    creationMethod === 'paste'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  2. Copy-Paste Grid
                </button>
              </div>

              {/* Excel Drag and Drop / Select Zone */}
              {creationMethod === 'excel' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 block">Spreadsheet File (.xlsx / .xls) <span className="text-rose-500">*</span></label>
                  
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      dragActive 
                        ? "border-indigo-500 bg-indigo-50/50" 
                        : "border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50/75"
                    }`}
                    onClick={() => document.getElementById('excel-file-picker')?.click()}
                  >
                    <UploadCloud className="w-8 h-8 text-slate-400 animate-pulse" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-700">Click or drag file here to import</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Supports: .xlsx, .xls</p>
                    </div>
                    <input
                      id="excel-file-picker"
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-600 block">Paste values from sheet grid <span className="text-rose-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = `word\tmeaning\tgroup\tsynonyms\textraWord\textraMeaning\texample\nApple\tআপেল\t1\tMalus domestica\t\t\tAn apple a day keeps the doctor away.\nBanana\tকলা\t1\tMusa sapientum\t\t\tBananas are rich in potassium.`;
                        setPasteInputText(sample);
                        processPastedText(sample);
                      }}
                      className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      Load Sample Data
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={pasteInputText}
                    onChange={(e) => {
                      setPasteInputText(e.target.value);
                      processPastedText(e.target.value);
                    }}
                    placeholder="Word[Tab]Meaning[Tab]Group[Tab]Synonyms&#10;e.g.:&#10;Abate&#09;প্রশমিত হওয়া&#09;1&#09;subside, decrease&#10;Banal&#09;তুচ্ছ বা সাধারণ&#09;1&#09;hackneyed, trite"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition text-slate-700"
                  />
                  <p className="text-[9px] text-slate-400 leading-relaxed font-semibold">
                    Copy cells (Ctrl+C) directly from Google Sheets or Excel, then paste (Ctrl+V) them here. The parser will automatically map the tab-separated content.
                  </p>
                </div>
              )}

              {/* Requirement guidelines column checker */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 text-xs text-slate-600">
                <span className="font-extrabold text-slate-800 block text-sm">এক্সেল কলাম নির্দেশিকা (Excel Column Guidelines):</span>
                <div className="flex flex-col space-y-1.5 text-[11px] font-bold">
                  <span className="text-indigo-600 flex items-center gap-1.5">• [word] (বা [main word]) (আবশ্যক)</span>
                  <span className="text-indigo-600 flex items-center gap-1.5">• [meaning] (বা [bangla meaning]) (আবশ্যক)</span>
                  <span className="text-slate-600 flex items-center gap-1.5">• [group] (ঐচ্ছিক)</span>
                  <span className="text-slate-600 flex items-center gap-1.5">• [synonm1] (বা [synonym1]) (ঐচ্ছিক)</span>
                  <span className="text-slate-600 flex items-center gap-1.5">• [synonm2] (বা [synonym2]) (ঐচ্ছিক)</span>
                  <span className="text-slate-600 flex items-center gap-1.5">• [extra word] (ঐচ্ছিক)</span>
                  <span className="text-slate-600 flex items-center gap-1.5">• [extra meaning] (ঐচ্ছিক)</span>
                  <span className="text-slate-600 flex items-center gap-1.5">• [example] (ঐচ্ছিক)</span>
                </div>
                
                <div className="border-t border-slate-200/80 pt-3 space-y-2 text-[11px] leading-relaxed font-semibold text-slate-500">
                  <p className="flex gap-1.5 items-start">
                    <span className="text-indigo-500 font-extrabold flex-shrink-0">📌 সিনোনিম রিকোয়ারমেন্ট:</span>
                    <span>প্রতিটি ফ্ল্যাশ কার্ডে ২টি সিনোনিম রাখার জন্য Excel ফাইলে <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">synonm1</code> এবং <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">synonm2</code> কলামে আলাদা আলাদা লিখবেন (অথবা <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">synonyms</code> কলামে কমা দিয়ে আলাদা করে লিখবেন, যেমন: <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">subside, decrease</code>)।</span>
                  </p>
                  <p className="flex gap-1.5 items-start">
                    <span className="text-indigo-500 font-extrabold flex-shrink-0">📌 গ্রুপ নাম ম্যাপিং:</span>
                    <span>গ্রুপের নাম এক্সেল টেবিলে যা থাকবে ঠিক সেই নামেই সেট হবে। যেমন: যদি গ্রুপ কলামে <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">ক</code> থাকে, তবে শব্দটি <strong className="text-slate-700 font-extrabold">"গ্রুপ ক"</strong> এর অন্তর্ভুক্ত হয়ে যাবে।</span>
                  </p>
                </div>
              </div>

              {/* Parse/Upload Error */}
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 font-bold leading-relaxed flex gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Save Status / Errors */}
              {saveStatus === 'saved' && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-bold flex gap-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Course created and successfully saved to the Cloud Database!</span>
                </div>
              )}

              {saveStatus === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 font-bold flex gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Failed to save course: {saveError}</span>
                </div>
              )}

              {/* Uploaded Words Preview Table */}
              {uploadedWords.length > 0 && (
                <div className="space-y-3.5 pt-2 border-t border-slate-100 animate-fadeIn">
                  <div className="flex justify-between items-center text-xs font-extrabold text-slate-700">
                    <span>Spreadsheet Preview ({uploadedWords.length} words mapped)</span>
                    <span className="text-emerald-600 font-bold">Columns verified</span>
                  </div>

                  {/* Excel Spreadsheet Style Large Overview Grid */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-[11px] font-sans shadow-xs bg-white">
                    {/* Grid Header Info */}
                    <div className="bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500 font-mono">
                      <span className="flex items-center gap-1.5 text-indigo-600">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        SPREADSHEET VIEWER (GRID)
                      </span>
                      <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-600">
                        COLS: A - G • ROWS: 1 - {uploadedWords.length}
                      </span>
                    </div>

                    {/* Horizontally and Vertically scrollable table viewport */}
                    <div className="overflow-auto max-h-[250px] w-full" id="excel-spreadsheet-grid-viewport">
                      <table className="w-full border-collapse text-left min-w-[850px]">
                        <thead>
                          {/* Excel Letter Row */}
                          <tr className="bg-slate-50 border-b border-slate-200 divide-x divide-slate-200 text-center font-mono text-[9px] text-slate-400 font-bold h-6">
                            <th className="w-10 bg-slate-100 sticky left-0 z-10 border-r border-slate-200">#</th>
                            <th className="px-2 w-1/8">A (Word)</th>
                            <th className="px-2 w-1/6">B (Meaning)</th>
                            <th className="px-2 w-12 text-center">C (Group)</th>
                            <th className="px-2 w-1/5">D (Synonyms)</th>
                            <th className="px-2 w-1/8">E (Extra Word)</th>
                            <th className="px-2 w-1/8">F (Extra Meaning)</th>
                            <th className="px-2">G (Example Sentence)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-sans">
                          {uploadedWords.slice(0, 50).map((w, index) => (
                            <tr key={index} className="hover:bg-indigo-50/20 divide-x divide-slate-150 transition h-8 text-[11px]">
                              {/* Row counter (Excel style sticky left column) */}
                              <td className="bg-slate-100 border-r border-slate-200 text-slate-400 text-center font-mono font-bold sticky left-0 z-10 w-10 select-none">
                                {index + 1}
                              </td>
                              {/* Columns A to G */}
                              <td className="p-1.5 font-bold text-slate-800 truncate max-w-[120px]" title={w.word}>{w.word}</td>
                              <td className="p-1.5 font-medium text-slate-700 truncate max-w-[180px]" title={w.meaning}>{w.meaning}</td>
                              <td className="p-1.5 text-center font-mono font-black text-indigo-600">{w.group}</td>
                              <td className="p-1.5 text-slate-500 truncate max-w-[180px]" title={w.synonyms}>{w.synonyms || <span className="text-slate-300 italic">none</span>}</td>
                              <td className="p-1.5 text-emerald-700 font-semibold truncate max-w-[100px]" title={w.extraWord}>{w.extraWord || <span className="text-slate-300">--</span>}</td>
                              <td className="p-1.5 text-emerald-600 truncate max-w-[120px]" title={w.extraMeaning}>{w.extraMeaning || <span className="text-slate-300">--</span>}</td>
                              <td className="p-1.5 text-slate-550 font-sans italic truncate max-w-[280px]" title={w.example}>{w.example || <span className="text-slate-300">--</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Showing summary of rows */}
                    <div className="p-2 bg-slate-50 text-center text-[10px] font-bold text-slate-400 border-t border-slate-200 font-mono">
                      {uploadedWords.length > 50 ? (
                        <span>
                          PREVIEWING FIRST 50 ROWS • TOTAL ROWS IN SHEET: {uploadedWords.length}
                        </span>
                      ) : (
                        <span>
                          PREVIEWING ALL {uploadedWords.length} ROWS OF THE SPREADSHEET
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submission triggers */}
                  <button
                    disabled={saveStatus === 'saving' || !newCourseTitle.trim()}
                    onClick={handleSaveCourse}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:bg-slate-200 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/10 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {saveStatus === 'saving' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Uploading Course...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Upload & Publish Course</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Details Slideover / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end z-50 animate-fade-in" id="user-details-modal">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl relative animate-slide-left font-sans">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-black text-sm">
                  {selectedUser.email[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                    <span>{selectedUser.email.split('@')[0]}</span>
                    <button 
                      onClick={() => copyToClipboard(selectedUser.email)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer" 
                      title="Copy email address"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold font-mono uppercase tracking-wide">ID: {selectedUser.id}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 px-6 bg-slate-50 text-xs font-bold text-slate-500 gap-6">
              <button 
                onClick={() => setActiveUserTab('progress')}
                className={`py-3.5 border-b-2 transition outline-none cursor-pointer ${
                  activeUserTab === 'progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                }`}
              >
                Vocabulary Progress
              </button>
              <button 
                onClick={() => setActiveUserTab('analytics')}
                className={`py-3.5 border-b-2 transition outline-none cursor-pointer ${
                  activeUserTab === 'analytics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                }`}
              >
                Targets & Goals
              </button>
              <button 
                onClick={() => setActiveUserTab('settings')}
                className={`py-3.5 border-b-2 transition outline-none cursor-pointer ${
                  activeUserTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                }`}
              >
                User Settings
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeUserTab === 'progress' && (
                <div className="space-y-6">
                  {/* Progress Summary Mini-Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-emerald-800/80 font-bold block">Know</span>
                      <span className="text-xl font-black text-emerald-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'know').length}
                      </span>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-amber-800/80 font-bold block">Confusion</span>
                      <span className="text-xl font-black text-amber-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'confusion').length}
                      </span>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-rose-800/80 font-bold block">Don't Know</span>
                      <span className="text-xl font-black text-rose-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'dont_know').length}
                      </span>
                    </div>
                  </div>

                  {/* Word Filter Tabs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-800 text-sm">Evaluation List</h4>
                      
                      <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold text-slate-500 gap-1">
                        {[
                          { key: 'all' as const, label: 'All' },
                          { key: 'know' as const, label: 'Know' },
                          { key: 'confusion' as const, label: 'Confusion' },
                          { key: 'dont_know' as const, label: 'Don\'t Know' }
                        ].map(f => (
                          <button
                            key={f.key}
                            onClick={() => setActiveWordFilter(f.key)}
                            className={`px-2.5 py-1 rounded-lg transition outline-none cursor-pointer ${
                              activeWordFilter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Word List Render */}
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden max-h-80 overflow-y-auto">
                      {getProgressEntries(selectedUser.progress)
                        .filter(([_, p]) => activeWordFilter === 'all' || p.status === activeWordFilter)
                        .length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-bold text-xs">
                            No words recorded in this category.
                          </div>
                        ) : (
                          getProgressEntries(selectedUser.progress)
                            .filter(([_, p]) => activeWordFilter === 'all' || p.status === activeWordFilter)
                            .map(([wordId, p]) => {
                              const w = words.find(item => item.id === wordId);
                              if (!w) return null;
                              return (
                                <div key={wordId} className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between transition">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-slate-800">{w.word}</span>
                                      <span className="text-[9px] text-slate-400 font-bold">Group {w.group}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{w.meaning}</p>
                                    {p.notes && (
                                      <p className="text-[10px] text-indigo-600 font-medium italic mt-1 bg-indigo-50/50 px-2 py-1 rounded">
                                        Note: {p.notes}
                                      </p>
                                    )}
                                  </div>

                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                                    p.status === 'know' ? 'bg-emerald-50 text-emerald-700' :
                                    p.status === 'confusion' ? 'bg-amber-50 text-amber-700' :
                                    'bg-rose-50 text-rose-700'
                                  }`}>
                                    {p.status === 'know' && <CheckCircle className="w-3 h-3" />}
                                    {p.status === 'confusion' && <AlertTriangle className="w-3 h-3" />}
                                    {p.status === 'dont_know' && <XCircle className="w-3 h-3" />}
                                    {p.status === 'know' ? 'Know' : p.status === 'confusion' ? 'Confusion' : 'Don\'t Know'}
                                  </span>
                                </div>
                              );
                            })
                        )}
                    </div>
                  </div>
                </div>
              )}

              {activeUserTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Study Streak & Target */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">Daily Study Target</span>
                      <span className="text-xl font-black text-slate-800 font-mono">{selectedUser.goal?.dailyTarget || 15} words</span>
                    </div>

                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-2xl text-amber-800">
                      <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
                      <div>
                        <span className="text-[10px] text-amber-700 font-bold block">Current Streak</span>
                        <span className="text-base font-black font-mono">{selectedUser.goal?.streak || 0} days</span>
                      </div>
                    </div>
                  </div>

                  {/* Study History Days list */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      <span>Study History Log</span>
                    </h4>

                    {!selectedUser.goal?.history || Object.keys(selectedUser.goal.history).length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl text-xs">
                        No study history logs recorded yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(selectedUser.goal.history)
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([dateStr, count]) => (
                            <div key={dateStr} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                              <span className="text-slate-600 font-bold text-xs">{dateStr}</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded-lg font-black">
                                +{Number(count)} words
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeUserTab === 'settings' && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-sm">App Configuration Settings</h4>
                  
                  <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                    <div className="p-4 flex items-center justify-between">
                      <span>Default Flashcard Order</span>
                      <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-extrabold uppercase text-[10px] tracking-wider">
                        {selectedUser.settings?.defaultFlashcardOrder || 'random'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Auto-play Audio Pronunciation</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        selectedUser.settings?.autoPlayAudio ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedUser.settings?.autoPlayAudio ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Quiz Length</span>
                      <span className="bg-indigo-50 text-indigo-700 font-mono font-black px-3 py-1 rounded-lg">
                        {selectedUser.settings?.quizLength || 10} words
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Flashcard Rotation Animation</span>
                      <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-bold font-mono">
                        {selectedUser.settings?.flashcardAnimation || 'flip-h'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Course Settings Modal */}
      {editingCourse && (
        <CourseSettings 
          course={editingCourse} 
          onClose={() => setEditingCourse(null)} 
          onSaveSuccess={fetchCustomCourses} 
        />
      )}
    </div>
  );
}
