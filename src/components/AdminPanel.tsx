import React, { useState, useEffect } from 'react';
import { 
  db, 
  auth,
  doc,
  setDoc
} from '../lib/firebase';
import { collection, getDocs, deleteDoc, updateDoc, getDoc, query, where } from 'firebase/firestore';
import { VocabularyWord, UserProgress, Course, AccessRequest, BlankQuestion, AppSettings } from '../types';
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
  CheckCircle2,
  AlertTriangle, 
  XCircle, 
  Copy, 
  Clock, 
  Sliders,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  PlusCircle,
  BookOpen,
  Edit,
  Lock,
  Layers,
  Globe,
  Gamepad2,
  DollarSign,
  Zap,
  Wallet,
  CreditCard,
  Megaphone,
  Bell
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
  settings?: AppSettings;
  onUpdateSettings?: (settings: AppSettings) => void;
  onCoursesUpdated?: (updatedCourses: Course[]) => void;
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

export default function AdminPanel({ words, settings, onUpdateSettings, onCoursesUpdated }: AdminPanelProps) {
  const [users, setUsers] = useState<FirestoreUserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'email' | 'streak' | 'progress' | 'lastActive'>('lastActive');
  const [selectedUser, setSelectedUser] = useState<FirestoreUserDoc | null>(null);
  const [activeUserTab, setActiveUserTab] = useState<'progress' | 'analytics' | 'settings'>('progress');
  const [activeWordFilter, setActiveWordFilter] = useState<'all' | 'know' | 'confusion' | 'dont_know'>('all');

  // Course management and upload states
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'courses' | 'reports' | 'access-requests' | 'autoverify' | 'system-settings'>('courses');
  const [customCourses, setCustomCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [hasFetchedCourses, setHasFetchedCourses] = useState(false);

  // Pending Access Requests Expiry Inputs state
  const [requestExpiryDates, setRequestExpiryDates] = useState<Record<string, string>>({});

  // Global bKash Auto-Verification Gateway state
  const [globalVerifiedPayments, setGlobalVerifiedPayments] = useState<{ bkashNumber: string; trxId: string; amount?: number; createdAt?: string }[]>([]);
  const [globalVpLoading, setGlobalVpLoading] = useState(false);
  const [newGlobalVpNumber, setNewGlobalVpNumber] = useState('');
  const [newGlobalVpTrxId, setNewGlobalVpTrxId] = useState('');
  const [newGlobalVpAmount, setNewGlobalVpAmount] = useState<number>(75);
  const [globalVpSearch, setGlobalVpSearch] = useState('');
  const [globalVpPasteInput, setGlobalVpPasteInput] = useState('');
  const [isAutoVerifyingAll, setIsAutoVerifyingAll] = useState(false);
  const [autoVerifyResultMessage, setAutoVerifyResultMessage] = useState<string | null>(null);

  useEffect(() => {
    if (onCoursesUpdated && hasFetchedCourses) {
      onCoursesUpdated(customCourses);
    }
  }, [customCourses, hasFetchedCourses, onCoursesUpdated]);

  // New course form states
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [uploadedWords, setUploadedWords] = useState<VocabularyWord[]>([]);
  const [parsedPlaceLabels, setParsedPlaceLabels] = useState<Record<string, string>>({});
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
  const [courseSettingsInitialTab, setCourseSettingsInitialTab] = useState<'general' | 'variables' | 'access' | 'students' | 'wordlist' | 'addwords' | 'verification' | 'blank-questions' | undefined>(undefined);
  const [courseSettingsInitialEditWordName, setCourseSettingsInitialEditWordName] = useState<string | undefined>(undefined);

  // Access requests states
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false);

  // Blank questions states
  const [blankQuestions, setBlankQuestions] = useState<BlankQuestion[]>([]);
  const [blankQuestionsLoading, setBlankQuestionsLoading] = useState(false);
  const [blankQuestionsError, setBlankQuestionsError] = useState<string | null>(null);

  const [newSentence, setNewSentence] = useState('');
  const [newOpt1, setNewOpt1] = useState('');
  const [newOpt2, setNewOpt2] = useState('');
  const [newOpt3, setNewOpt3] = useState('');
  const [newOpt4, setNewOpt4] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);

  const [excelQuestionsPreview, setExcelQuestionsPreview] = useState<BlankQuestion[]>([]);
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelSaveStatus, setExcelSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const fetchBlankQuestions = async () => {
    setBlankQuestionsLoading(true);
    setBlankQuestionsError(null);
    try {
      const qSnap = await getDocs(collection(db, 'blank_questions'));
      const list: BlankQuestion[] = [];
      qSnap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as BlankQuestion);
      });
      setBlankQuestions(list);
    } catch (err) {
      console.error('Error fetching blank questions:', err);
      setBlankQuestionsError('Failed to load blank questions.');
    } finally {
      setBlankQuestionsLoading(false);
    }
  };

  const handleUploadBlankExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelUploadError(null);
    setExcelQuestionsPreview([]);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rawRows.length === 0) {
          setExcelUploadError('No data found in the selected Excel sheet.');
          return;
        }

        const questionsList: BlankQuestion[] = [];

        for (let idx = 0; idx < rawRows.length; idx++) {
          const row = rawRows[idx];
          if (!row || row.length < 2) continue;

          const sentence = row[0] ? String(row[0]).trim() : '';
          if (!sentence) continue;

          // If it's the first row and lacks '#' anywhere, assume it's headers and skip
          if (idx === 0) {
            const hasHash = row.slice(1, 5).some(cell => cell && String(cell).includes('#'));
            if (!hasHash && (sentence.toLowerCase().includes('sentence') || sentence.toLowerCase().includes('blank'))) {
              continue;
            }
          }

          const opts: string[] = [];
          let answer = '';

          for (let col = 1; col <= 4; col++) {
            const val = row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : '';
            if (val) {
              if (val.includes('#')) {
                const cleanVal = val.replace('#', '').trim();
                opts.push(cleanVal);
                answer = cleanVal;
              } else {
                opts.push(val);
              }
            }
          }

          const explanation = row[5] ? String(row[5]).trim() : (row[4] ? String(row[4]).trim() : '');

          if (opts.length > 0 && answer) {
            questionsList.push({
              id: `bq-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              sentence,
              options: opts,
              answer,
              explanation,
              createdAt: new Date().toISOString()
            });
          }
        }

        if (questionsList.length === 0) {
          setExcelUploadError('No valid questions found. Ensure one of the option columns contains a "#" to indicate the correct answer.');
        } else {
          setExcelQuestionsPreview(questionsList);
        }
      } catch (err) {
        console.error('Error parsing blank excel:', err);
        setExcelUploadError('Failed to parse Excel file. Make sure it is a valid .xlsx file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveBlankExcelQuestions = async () => {
    if (excelQuestionsPreview.length === 0) return;
    setExcelSaveStatus('saving');
    try {
      for (const q of excelQuestionsPreview) {
        await setDoc(doc(db, 'blank_questions', q.id), q);
      }
      setExcelSaveStatus('saved');
      setExcelQuestionsPreview([]);
      fetchBlankQuestions();
      setTimeout(() => setExcelSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving blank questions:', err);
      setExcelSaveStatus('error');
    }
  };

  const handleManualAddBlankQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSentence.trim() || !newOpt1.trim() || !newOpt2.trim() || !newOpt3.trim() || !newOpt4.trim()) {
      alert('Please fill out the sentence and all 4 options.');
      return;
    }
    const rawOpts = [newOpt1.trim(), newOpt2.trim(), newOpt3.trim(), newOpt4.trim()];
    const answer = rawOpts[newCorrectIndex];
    const newQ: BlankQuestion = {
      id: `bq-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      sentence: newSentence.trim(),
      options: rawOpts,
      answer,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'blank_questions', newQ.id), newQ);
      setNewSentence('');
      setNewOpt1('');
      setNewOpt2('');
      setNewOpt3('');
      setNewOpt4('');
      setNewCorrectIndex(0);
      fetchBlankQuestions();
      alert('Question added successfully!');
    } catch (err) {
      console.error('Error adding question manually:', err);
      alert('Failed to add question.');
    }
  };

  const handleDeleteBlankQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'blank_questions', id));
      setBlankQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting blank question:', err);
      alert('Failed to delete question.');
    }
  };

  const fetchAccessRequests = async () => {
    setAccessRequestsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'access_requests'));
      const list: AccessRequest[] = [];
      qSnap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AccessRequest);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAccessRequests(list);
    } catch (err) {
      console.error('Error fetching access requests:', err);
    } finally {
      setAccessRequestsLoading(false);
    }
  };

  const handleApproveAccessRequest = async (req: AccessRequest) => {
    try {
      const selectedExpiry = requestExpiryDates[req.id] || '';
      
      // 1. Update request status to 'approved'
      const reqRef = doc(db, 'access_requests', req.id);
      await updateDoc(reqRef, { status: 'approved' });

      // 2. Add email to the course(s) allowed users list with expiry
      const userEmail = req.email.toLowerCase().trim();

      if (req.courseId === 'wallet_recharge') {
        const rechargeAmt = req.totalPrice || req.price || (req as any).amount || 50;
        const walletRef = doc(db, 'user_wallets', userEmail);
        const walletSnap = await getDoc(walletRef);
        const curBal = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
        const newBal = curBal + rechargeAmt;
        await setDoc(walletRef, {
          email: userEmail,
          balance: newBal,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setAccessRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
        alert(`Wallet recharge request approved! ৳${rechargeAmt} BDT added to ${userEmail}'s wallet (New Balance: ৳${newBal} BDT).`);
        return;
      }

      const targetCourseIds = (req.courseIds && req.courseIds.length > 0) 
        ? req.courseIds 
        : [req.courseId];

      for (const courseId of targetCourseIds) {
        if (!courseId) continue;
        let courseObj = customCourses.find(c => c.id === courseId);
        let currentAllowed: string[] = [];
        let currentAllowedExpiry: Record<string, string> = {};
        
        if (courseObj) {
          currentAllowed = courseObj.allowedUsers || [];
          currentAllowedExpiry = courseObj.allowedUsersExpiry || {};
        } else {
          const courseDoc = await getDoc(doc(db, 'courses', courseId));
          if (courseDoc.exists()) {
            const courseData = courseDoc.data() as Course;
            currentAllowed = courseData.allowedUsers || [];
            currentAllowedExpiry = courseData.allowedUsersExpiry || {};
          }
        }

        const updatedAllowed = currentAllowed.includes(userEmail) ? currentAllowed : [...currentAllowed, userEmail];
        const updatedExpiryMap = { ...currentAllowedExpiry };
        if (selectedExpiry) {
          updatedExpiryMap[userEmail] = selectedExpiry;
        }

        // Update the course in Firestore
        const courseRef = doc(db, 'courses', courseId);
        await setDoc(courseRef, { 
          allowedUsers: updatedAllowed,
          allowedUsersExpiry: updatedExpiryMap
        }, { merge: true });
        
        // Update local state
        setCustomCourses(prev => prev.map(c => c.id === courseId ? { 
          ...c, 
          allowedUsers: updatedAllowed,
          allowedUsersExpiry: updatedExpiryMap
        } : c));
      }

      // Update local requests state
      setAccessRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
      alert(`Access request approved successfully! User ${userEmail} granted access to ${targetCourseIds.length} course(s) ${selectedExpiry ? `until ${selectedExpiry}` : 'permanently'}.`);
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRejectAccessRequest = async (reqId: string) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      const reqRef = doc(db, 'access_requests', reqId);
      await updateDoc(reqRef, { status: 'rejected' });
      
      setAccessRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
      alert('Access request rejected.');
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Failed to reject request: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Word issue reports states
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'reports'));
      const list: any[] = [];
      qSnap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
      setReports(list);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to mark this report as resolved? It will be deleted.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
      alert('Report marked as resolved!');
    } catch (err) {
      console.error('Error resolving report:', err);
      alert('Failed to resolve report.');
    }
  };

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
      setHasFetchedCourses(true);
    } catch (err) {
      console.error('Error fetching custom courses:', err);
      setCoursesError('Failed to load courses list from Cloud Firestore.');
    } finally {
      setCoursesLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomCourses();
    fetchReports();
    fetchAccessRequests();
    fetchBlankQuestions();
  }, []);

  // Sync slug from title
  useEffect(() => {
    if (isSlugTouched) return;
    let slug = newCourseTitle
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove special chars
      .replace(/[\s_]+/g, '-')  // replace spaces with hyphen
      .replace(/^-+|-+$/g, ''); // trim outer hyphens
    
    // If slug is empty (due to Bangla/unicode characters), auto-generate a fallback ID
    if (!slug && newCourseTitle.trim()) {
      const hash = Math.random().toString(36).substring(2, 8);
      slug = `course-${hash}`;
    }
    setNewCourseId(slug);
  }, [newCourseTitle, isSlugTouched]);

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

        // Extract place labels from headers
        let detectedLabels: Record<string, string> = {};
        const firstRowKeys = Object.keys(rawRows[0]);
        firstRowKeys.forEach(k => {
          const match = k.match(/^place(1|2|3|4|5|6):(.*)$/i);
          if (match) {
            const num = match[1];
            detectedLabels[`place${num}`] = match[2].trim();
          }
        });
        setParsedPlaceLabels(detectedLabels);

        const wordsList: VocabularyWord[] = [];
        let index = 1;

        for (const row of rawRows) {
          // Normalise keys to lowercase, trimming whitespaces
          const rowKeys = Object.keys(row);
          const usedKeys = new Set<string>();
          
          const findKey = (candidates: string[], placePrefix?: string) => {
            if (placePrefix) {
              const placeKey = rowKeys.find(k => {
                if (usedKeys.has(k)) return false;
                const cleanK = k.toLowerCase().trim();
                return new RegExp(`^${placePrefix.toLowerCase()}(\\s*[:_\\-]|\\s*$)`, 'i').test(cleanK);
              });
              if (placeKey) {
                usedKeys.add(placeKey);
                return placeKey;
              }
            }
            const key = rowKeys.find(k => {
              if (usedKeys.has(k)) return false;
              const cleanK = k.toLowerCase().trim();
              if (/^place[1-6](\s*[:_\-]|\s*$)/i.test(cleanK)) {
                return false;
              }
              if (candidates.some(c => cleanK === c)) return true;
              const normK = cleanK.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
              if (candidates.some(c => normK === c.replace(/[^a-z0-9\u0980-\u09FF]/g, ''))) return true;
              return candidates.some(c => c.length >= 3 && (cleanK.includes(c) || c.includes(cleanK)));
            });
            if (key) usedKeys.add(key);
            return key;
          };

          const idKey = findKey(['id', 'unique id', 'word id', 'uid', 'sl', 'serial']);
          if (!idKey) {
            setUploadError('The spreadsheet is missing the mandatory "id" column. Please make sure your spreadsheet has an "id" column.');
            return;
          }
          const rawId = row[idKey] ? String(row[idKey]).trim() : '';
          if (!rawId) {
            setUploadError('Error parsing: A row is missing a unique ID in the mandatory "id" column.');
            return;
          }

          const wordKey = findKey(['word', 'main word', 'english word'], 'place1');
          const meaningKey = findKey(['meaning', 'bangla meaning', 'bengali meaning'], 'place2');
          const groupKey = findKey(['group', 'level']);
          const synonym1Key = findKey(['synonym1', 'synonm1', 'syn1'], 'place5');
          const synonym2Key = findKey(['synonym2', 'synonm2', 'syn2']);
          const synonymsKey = findKey(['synonyms', 'synonym']);
          const extraWordKey = findKey(['extra word', 'derivative'], 'place4');
          const extraMeaningKey = findKey(['extra meaning']);
          const exampleKey = findKey(['example', 'example sentence'], 'place3');
          const mnemonicKey = findKey(['place6', 'mnemonic', 'mnemonics', 'personal notes', 'personal note', 'notes', 'note', 'nemonik', 'nemoniq', 'নেমোনিক', 'mnemonic note', 'mnemonic notes'], 'place6');

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
          const mnemonic = mnemonicKey ? String(row[mnemonicKey]).trim() : '';

          wordsList.push({
            id: rawId,
            group,
            word: baseWord,
            meaning: banglaMeaning,
            synonyms,
            extraWord: extraWord,
            extraMeaning: extraMeaning,
            example,
            mnemonic
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
        id: 0,
        word: 1,
        meaning: 2,
        group: 3,
        synonym1: -1,
        synonym2: -1,
        synonyms: 4,
        extraWord: 5,
        extraMeaning: 6,
        example: 7,
        mnemonic: -1
      };

      if (lines.length > 0) {
        const firstLineRawCells = lines[0].split('\t');
        const firstLineCells = firstLineRawCells.map(c => c.toLowerCase().trim());
        
        // Extract place labels from headers
        let detectedLabels: Record<string, string> = {};
        firstLineRawCells.forEach(cell => {
          const match = cell.trim().match(/^place(1|2|3|4|5|6):(.*)$/i);
          if (match) {
            const num = match[1];
            detectedLabels[`place${num}`] = match[2].trim();
          }
        });
        setParsedPlaceLabels(detectedLabels);

        const hasHeader = firstLineCells.some(c => 
          c === 'word' || c === 'main word' || c.startsWith('place1:') ||
          c === 'meaning' || c === 'bangla meaning' || c.startsWith('place2:') ||
          c === 'id' || c === 'unique id' || c === 'word id' || c === 'uid'
        );

        if (hasHeader) {
          startIdx = 1; // skip header row
          
          const findPos = (candidates: string[], placePrefix?: string) => {
            if (placePrefix) {
              const placeIdx = firstLineCells.findIndex(c => {
                const cleanC = c.trim().toLowerCase();
                return new RegExp(`^${placePrefix.toLowerCase()}(\\s*[:_\\-]|\\s*$)`, 'i').test(cleanC);
              });
              if (placeIdx !== -1) return placeIdx;
            }
            return firstLineCells.findIndex(c => {
              const cleanC = c.trim().toLowerCase();
              if (/^place[1-6](\s*[:_\-]|\s*$)/i.test(cleanC)) return false;
              return candidates.some(cand => cleanC === cand || cleanC.includes(cand));
            });
          };

          const idPos = findPos(['id', 'unique id', 'word id', 'uid']);
          const wordPos = findPos(['word', 'main word'], 'place1');
          const meaningPos = findPos(['meaning', 'bangla meaning'], 'place2');
          const groupPos = findPos(['group']);
          const exPos = findPos(['example', 'example sentence'], 'place3');
          const extraWPos = findPos(['extra word', 'derivative'], 'place4');
          const synsPos = findPos(['synonyms', 'synonym', 'syn1', 'synonym1'], 'place5');
          const extraMPos = findPos(['extra meaning']);
          const mnemPos = findPos(['mnemonic', 'mnemonics', 'notes', 'note', 'nemonik', 'নেমোনিক'], 'place6');

          if (idPos !== -1) colIdxs.id = idPos;
          if (wordPos !== -1) colIdxs.word = wordPos;
          if (meaningPos !== -1) colIdxs.meaning = meaningPos;
          colIdxs.group = groupPos !== -1 ? groupPos : -1;
          colIdxs.synonyms = synsPos !== -1 ? synsPos : -1;
          colIdxs.extraWord = extraWPos !== -1 ? extraWPos : -1;
          colIdxs.extraMeaning = extraMPos !== -1 ? extraMPos : -1;
          colIdxs.example = exPos !== -1 ? exPos : -1;
          colIdxs.mnemonic = mnemPos !== -1 ? mnemPos : -1;
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

        const rawId = colIdxs.id !== -1 && cells[colIdxs.id] ? cells[colIdxs.id].trim() : '';
        const baseWord = cells[colIdxs.word]?.trim() || '';
        const banglaMeaning = cells[colIdxs.meaning]?.trim() || '';

        if (!rawId) {
          setUploadError(`Error at line ${i + 1}: Unique ID is missing or empty in the mandatory "id" column.`);
          return;
        }

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
        const mnemonic = colIdxs.mnemonic && colIdxs.mnemonic !== -1 ? cells[colIdxs.mnemonic]?.trim() || '' : '';

        parsedWords.push({
          id: rawId,
          group,
          word: baseWord,
          meaning: banglaMeaning,
          synonyms,
          extraWord,
          extraMeaning,
          example,
          mnemonic
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
        price: 30,
        bkashNumber: '01581624202',
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'admin@gmail.com',
        placeLabels: parsedPlaceLabels
      };

      await setDoc(doc(db, 'courses', newCourseId), courseData);
      
      setSaveStatus('saved');
      setNewCourseTitle('');
      setNewCourseDesc('');
      setUploadedWords([]);
      setParsedPlaceLabels({});
      setPasteInputText('');
      setNewCourseIsDefault(false);
      setNewCourseIsRestricted(false);
      setNewCourseAllowedUsersText('');
      setIsSlugTouched(false);
      fetchCustomCourses();
    } catch (err) {
      console.error('Error saving course to Firestore:', err);
      setSaveStatus('error');
      setSaveError(`${err instanceof Error ? err.message : String(err)} (Course ID: ${newCourseId})`);
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

  const handleMoveCourseOrder = async (courseId: string, delta: number, currentList: Course[]) => {
    const sorted = [...currentList].sort((a, b) => (a.order !== undefined ? a.order : 999) - (b.order !== undefined ? b.order : 999));
    const idx = sorted.findIndex(c => c.id === courseId);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    const itemA = sorted[idx];
    const itemB = sorted[newIdx];

    const orderA = itemB.order !== undefined ? itemB.order : newIdx;
    const orderB = itemA.order !== undefined ? itemA.order : idx;

    try {
      await setDoc(doc(db, 'courses', itemA.id), { order: orderA }, { merge: true });
      await setDoc(doc(db, 'courses', itemB.id), { order: orderB }, { merge: true });
      fetchCustomCourses();
    } catch (e) {
      console.error("Error updating course order:", e);
    }
  };

  const fetchGlobalVerifiedPayments = async () => {
    setGlobalVpLoading(true);
    try {
      const snap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
      if (snap.exists()) {
        setGlobalVerifiedPayments(snap.data().verifiedPayments || []);
      } else {
        setGlobalVerifiedPayments([]);
      }
    } catch (err) {
      console.error("Error fetching global verified payments:", err);
    } finally {
      setGlobalVpLoading(false);
    }
  };

  const cleanVpRecord = (vp: any) => ({
    bkashNumber: String(vp.bkashNumber || '').trim(),
    trxId: String(vp.trxId || '').trim(),
    amount: Number(vp.amount) || 30,
    createdAt: String(vp.createdAt || new Date().toISOString())
  });

  const handleAddGlobalVerifiedPayment = async () => {
    const num = newGlobalVpNumber.trim();
    const trx = newGlobalVpTrxId.trim();
    const amt = Number(newGlobalVpAmount) || 30;

    if (!num || !trx) {
      alert("Please enter both bKash Number and Transaction ID.");
      return;
    }

    const newRecord = cleanVpRecord({
      bkashNumber: num,
      trxId: trx,
      amount: amt,
      createdAt: new Date().toISOString()
    });

    const updated = [newRecord, ...globalVerifiedPayments.filter(vp => !(vp.bkashNumber === num && vp.trxId.toLowerCase() === trx.toLowerCase()))].map(cleanVpRecord);

    try {
      await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: updated }, { merge: true });
      setGlobalVerifiedPayments(updated);
      setNewGlobalVpNumber('');
      setNewGlobalVpTrxId('');
      setNewGlobalVpAmount(75);
    } catch (err) {
      console.error("Error saving global verified payment:", err);
      alert("Failed to save verified payment: " + (err instanceof Error ? err.message : String(err)));
      return;
    }

    try {
      await handleRunCentralAutoVerification(updated);
    } catch (err) {
      console.error("Auto verification error:", err);
    }
  };

  const handleDeleteGlobalVerifiedPayment = async (num: string, trx: string) => {
    if (!confirm(`Remove bKash ${num} (${trx}) from verification gateway?`)) return;
    const updated = globalVerifiedPayments.filter(vp => !(vp.bkashNumber === num && vp.trxId.toLowerCase() === trx.toLowerCase())).map(cleanVpRecord);
    setGlobalVerifiedPayments(updated);
    try {
      await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: updated }, { merge: true });
    } catch (err) {
      console.error("Error deleting global verified payment:", err);
    }
  };

  const handleBulkImportGlobalVp = async (textInput: string) => {
    if (!textInput.trim()) return;
    const lines = textInput.split(/\r?\n/);
    const parsed: { bkashNumber: string; trxId: string; amount: number; createdAt: string }[] = [];

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      const parts = cleanLine.split(/[,;\t\s]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const num = parts[0];
        const trx = parts[1];
        let amt = 75;
        if (parts[2] && !isNaN(Number(parts[2]))) {
          amt = Number(parts[2]);
        }
        parsed.push({
          bkashNumber: num,
          trxId: trx,
          amount: amt,
          createdAt: new Date().toISOString()
        });
      }
    }

    if (parsed.length === 0) {
      alert("No valid lines found. Format: MobileNumber, TrxID, Amount (e.g. 01712345678, 8N29X1A, 90)");
      return;
    }

    const existingKeys = new Set(globalVerifiedPayments.map(v => `${v.bkashNumber}_${v.trxId.toLowerCase()}`));
    const newItems = parsed.filter(item => !existingKeys.has(`${item.bkashNumber}_${item.trxId.toLowerCase()}`));

    const updated = [...newItems, ...globalVerifiedPayments].map(cleanVpRecord);

    try {
      await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: updated }, { merge: true });
      setGlobalVerifiedPayments(updated);
      setGlobalVpPasteInput('');
    } catch (e) {
      console.error("Error saving bulk verified payments:", e);
      alert("Error saving bulk verified payments: " + (e instanceof Error ? e.message : String(e)));
      return;
    }

    try {
      await handleRunCentralAutoVerification(updated);
    } catch (err) {
      console.error("Auto verification error:", err);
    }
  };

  const handleRunCentralAutoVerification = async (currentVpsList?: typeof globalVerifiedPayments) => {
    setIsAutoVerifyingAll(true);
    setAutoVerifyResultMessage(null);

    try {
      const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10);

      let vpsToUse = currentVpsList || globalVerifiedPayments;
      if (vpsToUse.length === 0) {
        const snap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
        if (snap.exists()) {
          vpsToUse = snap.data().verifiedPayments || [];
        }
      }

      let combinedVps = [...vpsToUse];
      for (const c of customCourses) {
        if (c.verifiedPayments) {
          for (const vp of c.verifiedPayments) {
            if (!combinedVps.some(cvp => cvp.bkashNumber === vp.bkashNumber && cvp.trxId.toLowerCase() === vp.trxId.toLowerCase())) {
              combinedVps.push(vp);
            }
          }
        }
      }

      const requestsSnap = await getDocs(query(collection(db, 'access_requests'), where('status', '==', 'pending')));
      const pendingReqs = requestsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) } as unknown as AccessRequest));

      if (pendingReqs.length === 0) {
        setAutoVerifyResultMessage("No pending requests found.");
        setIsAutoVerifyingAll(false);
        return;
      }

      const coursesSnap = await getDocs(collection(db, 'courses'));
      const coursesMap: Record<string, Course> = {};
      coursesSnap.forEach(d => {
        coursesMap[d.id] = { id: d.id, ...d.data() } as Course;
      });

      let autoApprovedRequestsCount = 0;
      let totalCoursesGranted = 0;

      for (const req of pendingReqs) {
        const reqPhone = cleanPhone(req.bkashNumber);
        const reqTrx = req.trxId.toLowerCase().trim();
        const reqEmail = req.email.toLowerCase().trim();

        const matchedVp = combinedVps.find(vp => {
          const vpPhone = cleanPhone(vp.bkashNumber);
          const vpTrx = vp.trxId.toLowerCase().trim();
          return (vpPhone === reqPhone || vp.bkashNumber.trim() === req.bkashNumber.trim()) && vpTrx === reqTrx;
        });

        let walletRef = doc(db, 'user_wallets', reqEmail);
        let walletSnap = await getDoc(walletRef);
        let existingWalletBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;

        if (req.courseId === 'wallet_recharge') {
          if (matchedVp) {
            const rechargeAmt = matchedVp.amount || req.totalPrice || req.price || 50;
            const newBal = existingWalletBalance + rechargeAmt;
            await setDoc(walletRef, {
              email: reqEmail,
              bkashNumber: req.bkashNumber,
              balance: newBal,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            await setDoc(doc(db, 'access_requests', req.id), {
              status: 'approved',
              remainingWalletBalance: newBal,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            autoApprovedRequestsCount++;
          }
          continue;
        }

        let totalFundsAvailable = existingWalletBalance + (matchedVp ? (matchedVp.amount || req.totalPrice || req.price || 30) : 0);

        if (matchedVp || existingWalletBalance > 0) {
          let targetIds: string[] = [];
          if (req.courseIds && req.courseIds.length > 0) {
            targetIds = req.courseIds;
          } else if (req.courseId && req.courseId !== 'multi_cart') {
            targetIds = [req.courseId];
          }

          let approvedTargetIds: string[] = [];
          let remainingBalance = totalFundsAvailable;

          for (const cid of targetIds) {
            const courseObj = coursesMap[cid];
            const coursePrice = (courseObj && courseObj.price && courseObj.price > 0) ? courseObj.price : (req.price || 30);

            if (remainingBalance >= coursePrice) {
              approvedTargetIds.push(cid);
              remainingBalance -= coursePrice;

              if (courseObj) {
                const currentAllowed = courseObj.allowedUsers || [];
                if (!currentAllowed.includes(reqEmail)) {
                  const updatedAllowed = [...currentAllowed, reqEmail];
                  courseObj.allowedUsers = updatedAllowed;
                  await setDoc(doc(db, 'courses', cid), { allowedUsers: updatedAllowed }, { merge: true });
                }
              }
              totalCoursesGranted++;
            }
          }

          if (approvedTargetIds.length > 0) {
            autoApprovedRequestsCount++;

            await setDoc(walletRef, {
              email: reqEmail,
              bkashNumber: req.bkashNumber,
              balance: remainingBalance,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            await setDoc(doc(db, 'access_requests', req.id), {
              status: 'approved',
              approvedCoursesCount: approvedTargetIds.length,
              remainingWalletBalance: remainingBalance,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      }

      fetchAccessRequests();
      setAutoVerifyResultMessage(`Auto-verification complete! Approved ${autoApprovedRequestsCount} requests and granted access to ${totalCoursesGranted} courses.`);
    } catch (err) {
      console.error("Error running central auto-verification:", err);
      setAutoVerifyResultMessage("Error occurred during auto-verification execution.");
    } finally {
      setIsAutoVerifyingAll(false);
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
  const dbGreCourse = customCourses.find(c => c.id.trim().toLowerCase() === 'gre');
  const defaultGreCourse: Course = {
    ...(dbGreCourse || {}),
    id: dbGreCourse?.id || 'gre',
    title: dbGreCourse?.title || 'BARC Vocabulary Book',
    description: dbGreCourse?.description || 'Standard preparation course with 1,110 high-frequency words grouped into 37 levels.',
    totalGroups: dbGreCourse?.totalGroups || (dbGreCourse?.words && dbGreCourse.words.length > 0 ? new Set(dbGreCourse.words.map(w => w.group)).size : 37),
    words: (dbGreCourse?.words && dbGreCourse.words.length > 0) ? dbGreCourse.words : words,
    isDefault: dbGreCourse !== undefined ? dbGreCourse.isDefault : true,
    isRestricted: dbGreCourse?.isRestricted || false,
    allowedUsers: dbGreCourse?.allowedUsers || [],
    price: (dbGreCourse?.price && dbGreCourse.price > 0) ? dbGreCourse.price : 30,
    bkashNumber: (dbGreCourse?.bkashNumber && dbGreCourse.bkashNumber !== '01700000000' && dbGreCourse.bkashNumber.trim() !== '') ? dbGreCourse.bkashNumber : '01581624202',
    googleSearchQuery: dbGreCourse?.googleSearchQuery || '',
    createdAt: dbGreCourse?.createdAt || new Date('2026-01-01').toISOString(),
    createdBy: dbGreCourse?.createdBy || 'system'
  };

  const filteredCustomCoursesList = customCourses.filter(c => c.id.trim().toLowerCase() !== 'gre');

  const getCourseUserCount = (courseId: string) => {
    return users.filter(u => {
      const enrolled = (u as any).enrolledCourseIds || [];
      if (Array.isArray(enrolled) && enrolled.includes(courseId)) return true;
      if (courseId.trim().toLowerCase() === 'gre') return true;
      return false;
    }).length;
  };

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

      {/* Admin Tab Navigation - Responsive Wrapping Pill Grid */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        <button
          onClick={() => setActiveAdminTab('courses')}
          className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeAdminTab === 'courses'
              ? 'bg-white text-indigo-700 shadow-xs font-black border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">Courses ({customCourses.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeAdminTab === 'users'
              ? 'bg-white text-indigo-700 shadow-xs font-black border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">Users & Stats</span>
        </button>

        <button
          onClick={() => {
            setActiveAdminTab('reports');
            fetchReports();
          }}
          className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeAdminTab === 'reports'
              ? 'bg-white text-indigo-700 shadow-xs font-black border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">Reports ({reports.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveAdminTab('access-requests');
            fetchAccessRequests();
          }}
          className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center relative ${
            activeAdminTab === 'access-requests'
              ? 'bg-white text-indigo-700 shadow-xs font-black border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">Pending ({accessRequests.filter(r => r.status === 'pending').length})</span>
          {accessRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => {
            setActiveAdminTab('autoverify');
            fetchGlobalVerifiedPayments();
          }}
          className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeAdminTab === 'autoverify'
              ? 'bg-amber-400 text-slate-950 font-black shadow-xs border border-amber-300'
              : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100/80 border border-amber-200/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-700 shrink-0" />
          <span className="truncate">bKash Gateway</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('system-settings')}
          className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeAdminTab === 'system-settings'
              ? 'bg-white text-indigo-700 shadow-xs font-black border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">Settings</span>
        </button>
      </div>

      {/* Main Grid: Directory */}
      {activeAdminTab === 'users' && (
        <div className="grid grid-cols-1 gap-6">
          {/* User Directory Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">User Directory</h3>
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
      )}

      {activeAdminTab === 'courses' && (
        <div className="space-y-6">
          {/* Course Management Table - Full Width Excel Sheet Layout */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 w-full" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Course Management Table</h3>
                <p className="text-xs text-slate-400 font-medium">Spreadsheet view of all created & default courses</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-mono">
                {1 + filteredCustomCoursesList.length} Courses
              </span>
            </div>

            {/* Excel Table Grid Container */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-16">ID</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Title & Description</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">Words</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">Users</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">Price</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-16">Access</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-24">Order</th>
                    <th className="py-2.5 px-3 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {[defaultGreCourse, ...filteredCustomCoursesList].map((c) => {
                    const isDefault = c.id.trim().toLowerCase() === 'gre';
                    const wordCount = c.words?.length || (isDefault ? 1110 : 0);
                    const userCount = getCourseUserCount(c.id);
                    const price = (c.price && c.price > 0) ? c.price : 30;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition border-b border-slate-200">
                        {/* Column 1: ID */}
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-extrabold text-indigo-700 text-center uppercase">
                          {c.id}
                        </td>

                        {/* Column 2: Title & Description */}
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900 leading-tight">
                            {c.title} {isDefault && <span className="text-[10px] font-mono font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-1 border border-indigo-200">Default</span>}
                          </div>
                          {c.description && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                              {c.description}
                            </div>
                          )}
                        </td>

                        {/* Column 3: Words */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                          {wordCount}
                        </td>

                        {/* Column 4: Users */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                          {userCount}
                        </td>

                        {/* Column 5: Price */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                          ৳{price} BDT
                        </td>

                        {/* Column 6: Access Status (Minimal Black Icon) */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                          {c.isRestricted ? (
                            <Lock className="w-4 h-4 text-slate-900 mx-auto" title="Restricted" />
                          ) : (
                            <Globe className="w-4 h-4 text-slate-900 mx-auto" title="Public" />
                          )}
                        </td>

                        {/* Column 7: Minimal Order Controls */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                          <div className="inline-flex items-center justify-center gap-0.5 font-mono text-xs">
                            <button
                              type="button"
                              onClick={() => handleMoveCourseOrder(c.id, -1, [defaultGreCourse, ...filteredCustomCoursesList])}
                              className="p-1 hover:bg-slate-100 text-slate-700 hover:text-slate-950 rounded transition cursor-pointer"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono font-bold text-slate-900 px-0.5 text-xs">
                              #{c.order !== undefined ? c.order : '0'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMoveCourseOrder(c.id, 1, [defaultGreCourse, ...filteredCustomCoursesList])}
                              className="p-1 hover:bg-slate-100 text-slate-700 hover:text-slate-950 rounded transition cursor-pointer"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Column 8: Actions */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 font-sans">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(c)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-bold transition cursor-pointer border border-indigo-200/80"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(c.id);
                                alert(`Course Code "${c.id}" copied to clipboard!`);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition cursor-pointer border border-slate-200"
                            >
                              Copy
                            </button>
                            {!isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCourse(c.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-bold transition cursor-pointer border border-rose-200/80"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Section: Upload Form (Full Width) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-5 w-full">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                <span>Upload & Build Course</span>
              </h3>
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
                    value={newCourseId}
                    onChange={(e) => {
                      setIsSlugTouched(true);
                      // Only allow simple ASCII alphanumeric, hyphen and underscore
                      setNewCourseId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                    }}
                    placeholder="Auto-generated or type a custom English ID"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono font-bold text-slate-800 transition"
                  />
                  <span className="text-[9px] text-slate-400 block font-semibold leading-relaxed">This slug will be used as the central database identifier. (If your title is in Bangla, you can write a unique English ID here!)</span>
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
                        const sample = `id\tword\tmeaning\tgroup\tsynonyms\textraWord\textraMeaning\texample\napple-101\tApple\tA sweet red round fruit\t1\tMalus domestica\t\t\tAn apple a day keeps the doctor away.\nbanana-101\tBanana\tA long curved yellow fruit\t1\tMusa sapientum\t\t\tBananas are rich in potassium.`;
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
                    placeholder="ID[Tab]Word[Tab]Meaning[Tab]Group[Tab]Synonyms&#10;e.g.:&#10;word-101&#09;Abate&#09;subside or decrease&#09;1&#09;subside, decrease&#10;word-102&#09;Banal&#09;trite or commonplace&#09;1&#09;hackneyed, trite"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition text-slate-700"
                  />
                  <p className="text-[9px] text-slate-400 leading-relaxed font-semibold">
                    Copy cells (Ctrl+C) directly from Google Sheets or Excel, then paste (Ctrl+V) them here. The parser will automatically map the tab-separated content.
                  </p>
                </div>
              )}

              {/* Requirement guidelines column checker */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 text-xs text-slate-600">
                <span className="font-extrabold text-slate-800 block text-sm">Excel Column Guidelines:</span>
                <div className="flex flex-col space-y-1">
                  <span className="text-rose-600 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-rose-600 font-black">id</strong> (Unique ID)</span>
                  <span className="text-indigo-650 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-indigo-600 font-black">place1:###</strong> — Main Front Display</span>
                  <span className="text-indigo-650 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-indigo-600 font-black">place2:###</strong> — Main Back Display</span>
                  <span className="text-indigo-650 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-indigo-600 font-black">place3:###</strong> — Back Secondary Display</span>
                  <span className="text-indigo-650 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-indigo-600 font-black">place4:###</strong> — Front Sub-Header</span>
                  <span className="text-indigo-650 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-indigo-600 font-black">place5:###</strong> — Back Extra Section 1</span>
                  <span className="text-slate-600 flex items-center gap-1.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>* <strong className="text-slate-600 font-bold">group</strong> (Optional Group Name/Number)</span>
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
      )}

      {activeAdminTab === 'reports' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">User Word Issue Reports</h3>
          </div>

          {reportsLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs font-bold font-mono">Loading active issue logs...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">All Clear!</p>
                <p className="text-[10px] text-slate-400 font-semibold">No issues or incorrect vocabulary translations have been reported yet.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase h-10">
                    <th className="px-4 py-2">Word Details</th>
                    <th className="px-4 py-2">Issue Category</th>
                    <th className="px-4 py-2">Report Description</th>
                    <th className="px-4 py-2">Reported By</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-sans text-xs">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            // Find the course
                            let targetCourse: Course | undefined = undefined;
                            if (rep.courseId === 'gre') {
                              targetCourse = defaultGreCourse;
                            } else {
                              targetCourse = customCourses.find(c => c.id === rep.courseId);
                            }

                            if (!targetCourse) {
                              alert(`Course for this word (ID: ${rep.courseId || 'unknown'}) was not found.`);
                              return;
                            }

                            setCourseSettingsInitialTab('wordlist');
                            setCourseSettingsInitialEditWordName(rep.word);
                            setEditingCourse(targetCourse);
                          }}
                          className="font-extrabold text-indigo-600 hover:text-indigo-800 text-sm hover:underline cursor-pointer text-left flex items-center gap-1.5 focus:outline-none"
                          title="Click to directly edit this word inside course list"
                        >
                          <span>{rep.word}</span>
                          <Edit className="w-3.5 h-3.5 opacity-60 inline" />
                        </button>
                        <div className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wide mt-0.5">
                          Course ID: {rep.courseId || 'unknown'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-full text-[10px] uppercase font-mono tracking-wider border border-amber-200/50">
                          {rep.issueType?.replace('_', ' ') || 'Other Error'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-650 font-medium max-w-xs truncate" title={rep.description}>
                        {rep.description || <span className="text-slate-350 italic">No description provided</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700 text-[11px]">{rep.reportedBy?.split('@')[0]}</div>
                        <div className="text-[9px] text-slate-450 font-mono font-semibold mt-0.5">
                          {rep.reportedAt ? new Date(rep.reportedAt).toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              // If they want to inspect the details
                              alert(`Word: ${rep.word}\nIssue: ${rep.issueType}\n\nDescription:\n${rep.description || 'No description'}\n\nReported By: ${rep.reportedBy}\nAt: ${rep.reportedAt}`);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                            title="Inspect Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResolveReport(rep.id)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                          >
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'access-requests' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
          {/* Central Gateway Quick Action Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-indigo-800/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-full text-[10px] font-extrabold border border-amber-400/30">
                <Zap className="w-3 h-3 fill-amber-300" />
                <span>Central bKash Gateway</span>
              </div>
              <h4 className="font-black text-white text-sm sm:text-base">Auto-Verification Engine</h4>
              <p className="text-xs text-indigo-200 font-medium">Verify pending requests automatically against verified transaction records.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleRunCentralAutoVerification()}
                disabled={isAutoVerifyingAll}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 fill-slate-950 ${isAutoVerifyingAll ? 'animate-spin' : ''}`} />
                <span>{isAutoVerifyingAll ? 'Verifying...' : '⚡ Auto-Verify All'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAdminTab('autoverify');
                  fetchGlobalVerifiedPayments();
                }}
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition flex items-center gap-1 cursor-pointer border border-white/20"
              >
                <span>Manage Gateway ➔</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Course Access Requests</h3>
              <p className="text-xs text-slate-400 font-medium">Verify bKash transactions and approve access to restricted/paid courses.</p>
            </div>
            <button
              onClick={fetchAccessRequests}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer self-start sm:self-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${accessRequestsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {accessRequestsLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs font-bold font-mono">Loading access requests...</span>
            </div>
          ) : accessRequests.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">No requests found</p>
                <p className="text-[10px] text-slate-400 font-semibold">No students have requested access yet.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase h-10">
                    <th className="px-4 py-2">Course Details</th>
                    <th className="px-4 py-2">Course Code</th>
                    <th className="px-4 py-2">Student Email</th>
                    <th className="px-4 py-2">bKash Number</th>
                    <th className="px-4 py-2">Transaction ID</th>
                    <th className="px-4 py-2">Access Expiration</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-sans text-xs">
                  {accessRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        {req.courseIds && req.courseIds.length > 1 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 font-extrabold text-[10px] rounded-full border border-indigo-200">
                              🛒 Multi-Course Cart Bundle ({req.courseIds.length} Courses)
                            </span>
                            <div className="text-[11px] font-bold text-slate-800 pl-1 space-y-0.5">
                              {req.courseTitles && req.courseTitles.length > 0 ? (
                                req.courseTitles.map((t, idx) => (
                                  <div key={idx} className="flex items-center gap-1 text-slate-700">
                                    <span className="text-indigo-500 font-black">•</span> {t}
                                  </div>
                                ))
                              ) : (
                                <div>{req.courseTitle}</div>
                              )}
                            </div>
                            <div className="text-[10px] text-emerald-700 font-black font-mono mt-1">
                              Total Paid Amount: ৳{req.totalPrice || req.price} BDT
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-extrabold text-slate-800 text-sm">{req.courseTitle}</div>
                            <div className="text-[10px] text-indigo-600 font-bold font-mono uppercase tracking-wide mt-0.5">
                              Price: ৳{req.totalPrice || req.price || 30} BDT
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-xs font-mono tracking-wide border border-indigo-200/60 uppercase">
                          {req.courseCode || (req.courseIds && req.courseIds.join(', ')) || req.courseId}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {req.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 text-pink-700 font-bold rounded-full text-[10px] font-mono tracking-wider border border-pink-200/50">
                          {req.bkashNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono bg-slate-50 border border-slate-200 text-slate-650 px-2 py-0.5 rounded text-xs select-all">
                            {req.trxId}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(req.trxId);
                              alert('Copied Transaction ID: ' + req.trxId);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
                            title="Copy transaction ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={requestExpiryDates[req.id] || ''}
                                onChange={(e) => setRequestExpiryDates(prev => ({ ...prev, [req.id]: e.target.value }))}
                                className="px-2 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded font-bold text-slate-700 outline-none w-28 cursor-pointer focus:bg-white"
                                title="Exact Expiry Date"
                              />
                              <input
                                type="month"
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const [yStr, mStr] = e.target.value.split('-');
                                  const y = parseInt(yStr, 10);
                                  const m = parseInt(mStr, 10);
                                  const lastDay = new Date(y, m, 0).getDate();
                                  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                                  setRequestExpiryDates(prev => ({ ...prev, [req.id]: dateStr }));
                                }}
                                className="px-1.5 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded font-bold text-slate-700 outline-none w-24 cursor-pointer focus:bg-white"
                                title="Select Month (Sets expiry to end of month)"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              {[
                                { label: '+1 Mo', m: 1 },
                                { label: '+3 Mo', m: 3 },
                                { label: '+6 Mo', m: 6 },
                                { label: '+1 Yr', m: 12 },
                              ].map(preset => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() + preset.m);
                                    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                    setRequestExpiryDates(prev => ({ ...prev, [req.id]: dateStr }));
                                  }}
                                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 rounded text-[9px] font-bold transition cursor-pointer"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Processed'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'approved' ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded-full text-[10px] uppercase font-mono tracking-wider border border-emerald-200/50">
                            Approved
                          </span>
                        ) : req.status === 'rejected' ? (
                          <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-700 font-black rounded-full text-[10px] uppercase font-mono tracking-wider border border-rose-200/50">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 font-black rounded-full text-[10px] uppercase font-mono tracking-wider border border-amber-200/50">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveAccessRequest(req)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectAccessRequest(req.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-350 italic font-bold text-[10px]">Processed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'autoverify' && (
        <div className="space-y-6 font-sans" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-indigo-800/60 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-extrabold border border-amber-400/30 mb-2">
                  <Zap className="w-3.5 h-3.5 fill-amber-300" />
                  <span>Central bKash Gateway</span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white">Payment Auto-Verification Center</h2>
                <p className="text-xs text-indigo-200 mt-1 max-w-3xl leading-relaxed">
                  Add verified payment records to automatically approve course access and credit user wallet balances.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRunCentralAutoVerification()}
                  disabled={isAutoVerifyingAll}
                  className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 fill-slate-950 ${isAutoVerifyingAll ? 'animate-spin' : ''}`} />
                  <span>{isAutoVerifyingAll ? 'Verifying...' : '⚡ Run Verification'}</span>
                </button>
              </div>
            </div>

            {/* Execution Result Feedback */}
            {autoVerifyResultMessage && (
              <div className="mt-4 p-3.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{autoVerifyResultMessage}</span>
                </div>
                <button 
                  onClick={() => setAutoVerifyResultMessage(null)}
                  className="text-emerald-300 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Top Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center font-black text-lg shrink-0">
                ৳
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Verified Records</span>
                <span className="text-xl font-black text-slate-800 font-mono">{globalVerifiedPayments.length} Recs</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Multi-Course Cart</span>
                <span className="text-xl font-black text-indigo-600 font-mono">100% Active</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Auto Wallet Credit</span>
                <span className="text-xl font-black text-emerald-600 font-mono">Enabled</span>
              </div>
            </div>
          </div>

          {/* Grid: Add Single Payment vs Bulk Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form 1: Single Payment */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">Add Single Payment</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">bKash Mobile Number</label>
                  <input
                    type="text"
                    value={newGlobalVpNumber}
                    onChange={(e) => setNewGlobalVpNumber(e.target.value)}
                    placeholder="e.g. 01712345678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Transaction ID (TrxID)</label>
                  <input
                    type="text"
                    value={newGlobalVpTrxId}
                    onChange={(e) => setNewGlobalVpTrxId(e.target.value)}
                    placeholder="e.g. 8N29X1A"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-bold transition text-slate-800 uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Amount (BDT ৳)</label>
                  <input
                    type="number"
                    value={newGlobalVpAmount}
                    onChange={(e) => setNewGlobalVpAmount(Number(e.target.value))}
                    placeholder="e.g. 75"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-bold transition text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Auto-grants course access based on this paid amount.</p>
                </div>

                <button
                  type="button"
                  onClick={handleAddGlobalVerifiedPayment}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save & Verify</span>
                </button>
              </div>
            </div>

            {/* Form 2: Bulk Import / Paste */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">Bulk Import Payments</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Format: Mobile, TrxID, Amount (1 per line)</label>
                  <textarea
                    rows={4}
                    value={globalVpPasteInput}
                    onChange={(e) => setGlobalVpPasteInput(e.target.value)}
                    placeholder={`01712345678, 8N29X1A, 90\n01811223344, 9K12M8P, 150`}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-medium transition text-slate-800"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleBulkImportGlobalVp(globalVpPasteInput)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Bulk Import & Verify</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table of Verified Payments */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Verified Transactions</h3>
                <p className="text-xs text-slate-400 font-medium">All verified bKash payment records stored in system settings.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={globalVpSearch}
                    onChange={(e) => setGlobalVpSearch(e.target.value)}
                    placeholder="Search phone or TrxID..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-indigo-500 w-48 transition"
                  />
                </div>
                <button
                  onClick={fetchGlobalVerifiedPayments}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                  title="Refresh List"
                >
                  <RefreshCw className={`w-4 h-4 ${globalVpLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {globalVerifiedPayments.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-semibold">
                No verified records found. Add payments above.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase h-9">
                      <th className="px-4 py-2">bKash Mobile</th>
                      <th className="px-4 py-2">TrxID</th>
                      <th className="px-4 py-2">Paid Amount</th>
                      <th className="px-4 py-2">Added Date</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-mono">
                    {globalVerifiedPayments
                      .filter(vp => {
                        if (!globalVpSearch) return true;
                        const q = globalVpSearch.toLowerCase();
                        return vp.bkashNumber.includes(q) || vp.trxId.toLowerCase().includes(q);
                      })
                      .map((vp, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-2.5 font-bold text-slate-800">{vp.bkashNumber}</td>
                          <td className="px-4 py-2.5 font-bold text-indigo-600 uppercase">{vp.trxId}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded-full text-[10px] border border-emerald-200">
                              ৳{vp.amount || 30} BDT
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-slate-400">
                            {vp.createdAt ? new Date(vp.createdAt).toLocaleDateString() : 'Active'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteGlobalVerifiedPayment(vp.bkashNumber, vp.trxId)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'system-settings' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>System Settings & Banner Control</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Configure global app announcements, ads, notice banners, and system defaults across the platform.
            </p>
          </div>

          {/* User Announcement / Notice / Ad Banner Control */}
          <div className="bg-white p-6 rounded-2xl border border-indigo-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-extrabold text-slate-900 text-base">
                    User Announcement & Notification Banner System
                  </h4>
                </div>
                <p className="mt-0.5" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>
                  Control for displaying special notices, announcements, or banner alerts at the top of the application.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">Banner Status:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (settings && onUpdateSettings) {
                      onUpdateSettings({
                        ...settings,
                        announcementEnabled: !settings.announcementEnabled
                      });
                    }
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    settings?.announcementEnabled 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{settings?.announcementEnabled ? 'Active (Published)' : 'Disabled'}</span>
                </button>
              </div>
            </div>

            {/* Config Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Announcement Message */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Announcement / Notice Text:
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 🎉 New course updates and features added! Check them out now."
                  value={settings?.announcementText || ''}
                  onChange={(e) => {
                    if (settings && onUpdateSettings) {
                      onUpdateSettings({
                        ...settings,
                        announcementText: e.target.value
                      });
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                />
              </div>

              {/* Banner Type / Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Banner Color Theme / Type:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'info', label: 'Info (Blue)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                    { key: 'warning', label: 'Notice (Amber)', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                    { key: 'success', label: 'Offer (Emerald)', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                    { key: 'promo', label: 'Promo (Purple)', bg: 'bg-purple-50 text-purple-800 border-purple-200' },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        if (settings && onUpdateSettings) {
                          onUpdateSettings({
                            ...settings,
                            announcementType: t.key as any
                          });
                        }
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                        (settings?.announcementType || 'info') === t.key 
                          ? 'ring-2 ring-indigo-600 font-extrabold ' + t.bg
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Closable Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Dismissable / Closable by User?
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (settings && onUpdateSettings) {
                        onUpdateSettings({
                          ...settings,
                          announcementClosable: settings.announcementClosable !== false ? false : true
                        });
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      settings?.announcementClosable !== false
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {settings?.announcementClosable !== false ? 'Yes (User can dismiss)' : 'No (Persistent banner)'}
                  </button>
                </div>
              </div>

              {/* Action Link & Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Optional Button Link URL:
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://facebook.com or /#courses"
                  value={settings?.announcementLink || ''}
                  onChange={(e) => {
                    if (settings && onUpdateSettings) {
                      onUpdateSettings({
                        ...settings,
                        announcementLink: e.target.value
                      });
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  Optional Button Label:
                </label>
                <input
                  type="text"
                  placeholder="e.g. View Details"
                  value={settings?.announcementLinkText || ''}
                  onChange={(e) => {
                    if (settings && onUpdateSettings) {
                      onUpdateSettings({
                        ...settings,
                        announcementLinkText: e.target.value
                      });
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Live Banner Preview */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <span className="block" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>Live Banner Preview:</span>
              {settings?.announcementEnabled ? (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 flex-wrap ${
                  settings.announcementType === 'warning' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                  settings.announcementType === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
                  settings.announcementType === 'promo' ? 'bg-purple-50 text-purple-900 border-purple-200' :
                  'bg-indigo-50 text-indigo-900 border-indigo-200'
                }`}>
                  <div className="flex items-center gap-2.5 text-xs font-bold">
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span>{settings.announcementText || 'Your announcement text will appear here.'}</span>
                  </div>
                  {settings.announcementLink && (
                    <a
                      href={settings.announcementLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-white shadow-2xs rounded-lg text-xs font-extrabold border border-black/10 hover:bg-slate-50 transition"
                    >
                      {settings.announcementLinkText || 'View Details'}
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-400 text-xs font-semibold text-center italic" style={{ fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif', fontSize: '10px', color: 'oklch(0.704 0.04 256.788)', fontWeight: 500, lineHeight: '10px', letterSpacing: '-0.25px' }}>
                  Announcement banner is currently disabled.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daily Dashboard Banner Flashcard Overlay Setting */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Daily Banner Flashcard Overlay</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Controls automated flashcard banner overlay popups on the dashboard
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] rounded-lg uppercase">
                  Banner Control
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Input Box: Times Per Day */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Frequency (Times Per Day):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={settings?.flashcardBannerCountPerDay !== undefined ? settings.flashcardBannerCountPerDay : (settings?.flashcardBannerAnim === 'once_daily' ? 1 : settings?.flashcardBannerAnim === 'disabled' ? 0 : 2)}
                      onChange={(e) => {
                        const count = parseInt(e.target.value, 10) || 0;
                        if (settings && onUpdateSettings) {
                          onUpdateSettings({
                            ...settings,
                            flashcardBannerCountPerDay: Math.max(0, count),
                            flashcardBannerAnim: count === 0 ? 'disabled' : count === 1 ? 'once_daily' : 'twice_daily'
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                      times/day
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {[0, 1, 2, 3, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          if (settings && onUpdateSettings) {
                            onUpdateSettings({
                              ...settings,
                              flashcardBannerCountPerDay: num,
                              flashcardBannerAnim: num === 0 ? 'disabled' : num === 1 ? 'once_daily' : 'twice_daily'
                            });
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          (settings?.flashcardBannerCountPerDay ?? (settings?.flashcardBannerAnim === 'once_daily' ? 1 : settings?.flashcardBannerAnim === 'disabled' ? 0 : 2)) === num
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num === 0 ? 'Off' : `${num}x`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Box: Duration in Seconds */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Overlay Duration (Seconds):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.5"
                      max="60"
                      step="0.5"
                      value={settings?.flashcardBannerDurationSec ?? 3.0}
                      onChange={(e) => {
                        const dur = parseFloat(e.target.value) || 3.0;
                        if (settings && onUpdateSettings) {
                          onUpdateSettings({
                            ...settings,
                            flashcardBannerDurationSec: Math.max(0.5, dur)
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                      seconds
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1, 2, 3, 5, 10].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => {
                          if (settings && onUpdateSettings) {
                            onUpdateSettings({
                              ...settings,
                              flashcardBannerDurationSec: dur
                            });
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          (settings?.flashcardBannerDurationSec ?? 3.0) === dur
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {dur}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Default Flashcard Configurations */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>Default Flashcard Order & Audio</span>
                </h4>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] rounded-lg uppercase">
                  Defaults
                </span>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Default Flashcard Card Order
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'random', label: 'Random' },
                      { key: 'serial', label: 'Serial' },
                      { key: 'alphabetical', label: 'Alphabetical' }
                    ].map(ord => {
                      const isSel = (settings?.defaultFlashcardOrder || 'random') === ord.key;
                      return (
                        <button
                          key={ord.key}
                          type="button"
                          onClick={() => {
                            if (settings && onUpdateSettings) {
                              onUpdateSettings({
                                ...settings,
                                defaultFlashcardOrder: ord.key as any
                              });
                            }
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                            isSel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ord.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Auto-play Audio Pronunciation</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (settings && onUpdateSettings) {
                        onUpdateSettings({
                          ...settings,
                          autoPlayAudio: !settings.autoPlayAudio
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      settings?.autoPlayAudio ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {settings?.autoPlayAudio ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'blank-questions' && (
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <h3 className="font-extrabold text-slate-800 text-lg">Blank Filling Practice Management</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Manage blank filling questions from the Admin Panel. You can upload an Excel file or add questions manually.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Excel Upload Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Excel Upload</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  File format: First column has Sentence with blank (e.g., "He is a ___ boy."), next 4 columns are options. The correct option must have '#' appended (e.g., "good#").
                </p>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleUploadBlankExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Click or drag file to select</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .xlsx, .xls, .csv</p>
              </div>

              {excelUploadError && (
                <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{excelUploadError}</span>
                </div>
              )}

              {excelQuestionsPreview.length > 0 && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{excelQuestionsPreview.length} questions found</span>
                    </span>
                    <button
                      onClick={handleSaveBlankExcelQuestions}
                      disabled={excelSaveStatus === 'saving'}
                      className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                        excelSaveStatus === 'saving' ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {excelSaveStatus === 'saving' ? 'Saving...' : 'Save to Firestore'}
                    </button>
                  </div>

                  {/* Preview list */}
                  <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/20 text-xs">
                    {excelQuestionsPreview.map((q, idx) => (
                      <div key={idx} className="p-3">
                        <p className="font-bold text-slate-850"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.sentence}</p>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5 font-mono text-[11px] text-slate-500">
                          {q.options.map((opt, oIdx) => (
                            <span key={oIdx} className={opt === q.answer ? 'text-emerald-600 font-extrabold bg-emerald-50/50 px-1 rounded' : ''}>
                              {opt} {opt === q.answer ? '✓' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {excelSaveStatus === 'saved' && (
                <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Questions successfully saved to Firestore!</span>
                </div>
              )}
            </div>

            {/* Manual Form Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-500" />
                  <span>Add Question Manually</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Fill out the form below to add a new question directly to the database.</p>
              </div>

              <form onSubmit={handleManualAddBlankQuestion} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sentence with blank</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., The rich man was very ___ about his wealth."
                    value={newSentence}
                    onChange={(e) => setNewSentence(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 1</label>
                    <input
                      type="text"
                      required
                      placeholder="Option 1"
                      value={newOpt1}
                      onChange={(e) => setNewOpt1(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 2</label>
                    <input
                      type="text"
                      required
                      placeholder="Option 2"
                      value={newOpt2}
                      onChange={(e) => setNewOpt2(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 3</label>
                    <input
                      type="text"
                      required
                      placeholder="Option 3"
                      value={newOpt3}
                      onChange={(e) => setNewOpt3(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 4</label>
                    <input
                      type="text"
                      required
                      placeholder="Option 4"
                      value={newOpt4}
                      onChange={(e) => setNewOpt4(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Correct Option</label>
                  <select
                    value={newCorrectIndex}
                    onChange={(e) => setNewCorrectIndex(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold transition"
                  >
                    <option value={0}>Option 1: {newOpt1 || '(Empty)'}</option>
                    <option value={1}>Option 2: {newOpt2 || '(Empty)'}</option>
                    <option value={2}>Option 3: {newOpt3 || '(Empty)'}</option>
                    <option value={3}>Option 4: {newOpt4 || '(Empty)'}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                >
                  Add to Database
                </button>
              </form>
            </div>
          </div>

          {/* Current Questions List */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Existing Questions ({blankQuestions.length})</h4>
                <p className="text-[11px] text-slate-400 font-medium">All blank filling questions stored in the database.</p>
              </div>
              <button
                onClick={fetchBlankQuestions}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer self-start sm:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${blankQuestionsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {blankQuestionsLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span className="text-xs font-bold font-mono">Loading blank questions...</span>
              </div>
            ) : blankQuestions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No questions found</p>
                <p className="text-[10px] text-slate-400 font-semibold">Please upload an Excel sheet or add questions manually.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 font-sans">
                      <th className="px-4 py-3">Sentence</th>
                      <th className="px-4 py-3">Options</th>
                      <th className="px-4 py-3">Answer</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {blankQuestions.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-medium text-slate-800 max-w-xs truncate" title={q.sentence}>
                          {q.sentence}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                          {q.options.join(', ')}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded text-[10px] uppercase">
                            {q.answer}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteBlankQuestion(q.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                            title="Delete question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                        {selectedUser.settings?.flashcardAnimation || 'shuffle'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Daily Banner Flashcard Overlay</span>
                      <span className="bg-indigo-50 text-indigo-800 px-3 py-1 rounded-lg font-extrabold text-[10px]">
                        {selectedUser.settings?.flashcardBannerAnim === 'once_daily'
                          ? '1 Time / Day'
                          : selectedUser.settings?.flashcardBannerAnim === 'disabled'
                          ? 'Disabled (0)'
                          : '2 Times / Day'}
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
          onClose={() => {
            setEditingCourse(null);
            setCourseSettingsInitialTab(undefined);
            setCourseSettingsInitialEditWordName(undefined);
          }} 
          onSaveSuccess={fetchCustomCourses} 
          initialTab={courseSettingsInitialTab}
          initialEditWordName={courseSettingsInitialEditWordName}
        />
      )}
    </div>
  );
}
