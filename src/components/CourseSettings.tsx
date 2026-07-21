import React, { useState, useEffect, useMemo } from 'react';
import { Course, VocabularyWord, BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion } from '../types';
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
  UserCheck,
  ShieldCheck,
  Gamepad2,
  GraduationCap,
  Sparkles,
  Shuffle
} from 'lucide-react';
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { read, utils } from 'xlsx';

interface CourseSettingsProps {
  course: Course;
  onClose: () => void;
  onSaveSuccess: () => void;
  initialTab?: 'general' | 'variables' | 'access' | 'students' | 'wordlist' | 'addwords' | 'verification' | 'blank-questions' | 'ooo-questions' | 'analogy-questions' | 'practice-games';
  initialEditWordName?: string;
}

export const CourseSettings: React.FC<CourseSettingsProps> = ({
  course,
  onClose,
  onSaveSuccess,
  initialTab,
  initialEditWordName,
}) => {
  // Navigation Section (Settings Sidebar style)
  const [activeTab, setActiveTab] = useState<'general' | 'variables' | 'access' | 'students' | 'wordlist' | 'addwords' | 'verification' | 'blank-questions' | 'ooo-questions' | 'analogy-questions' | 'practice-games'>(initialTab || 'general');

  // --- BLANK QUESTIONS STATES ---
  const [courseBlankQuestions, setCourseBlankQuestions] = useState<BlankQuestion[]>([]);
  const [blankQuestionsLoading, setBlankQuestionsLoading] = useState(false);
  const [newSentence, setNewSentence] = useState('');
  const [newOpt1, setNewOpt1] = useState('');
  const [newOpt2, setNewOpt2] = useState('');
  const [newOpt3, setNewOpt3] = useState('');
  const [newOpt4, setNewOpt4] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);

  const [excelQuestionsPreview, setExcelQuestionsPreview] = useState<BlankQuestion[]>([]);
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelSaveStatus, setExcelSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- OOO QUESTIONS STATES ---
  const [courseOooQuestions, setCourseOooQuestions] = useState<OddOneOutQuestion[]>([]);
  const [oooQuestionsLoading, setOooQuestionsLoading] = useState(false);
  const [newOooWords, setNewOooWords] = useState<string[]>(['', '', '', '']);
  const [newOooCorrectIndex, setNewOooCorrectIndex] = useState<number>(0);
  const [newOooReason, setNewOooReason] = useState('');
  const [excelOooPreview, setExcelOooPreview] = useState<OddOneOutQuestion[]>([]);
  const [excelOooUploadError, setExcelOooUploadError] = useState<string | null>(null);
  const [excelOooSaveStatus, setExcelOooSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- ANALOGY QUESTIONS STATES ---
  const [courseAnalogyQuestions, setCourseAnalogyQuestions] = useState<WordAnalogyQuestion[]>([]);
  const [analogyQuestionsLoading, setAnalogyQuestionsLoading] = useState(false);
  const [newAnalogy, setNewAnalogy] = useState('');
  const [newAnalogyOpts, setNewAnalogyOpts] = useState<string[]>(['', '', '', '']);
  const [newAnalogyCorrectIndex, setNewAnalogyCorrectIndex] = useState<number>(0);
  const [newAnalogyExplanation, setNewAnalogyExplanation] = useState('');
  const [excelAnalogyPreview, setExcelAnalogyPreview] = useState<WordAnalogyQuestion[]>([]);
  const [excelAnalogyUploadError, setExcelAnalogyUploadError] = useState<string | null>(null);
  const [excelAnalogySaveStatus, setExcelAnalogySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

  // --- AUTO-VERIFICATION PAYMENT STATES ---
  const [verifiedPayments, setVerifiedPayments] = useState<{ bkashNumber: string; trxId: string }[]>(course.verifiedPayments || []);
  const [newVpNumber, setNewVpNumber] = useState('');
  const [newVpTrxId, setNewVpTrxId] = useState('');
  const [vpBulkInput, setVpBulkInput] = useState('');
  const [dragActiveVp, setDragActiveVp] = useState(false);
  const [vpExcelError, setVpExcelError] = useState<string | null>(null);
  const [vpExcelSuccess, setVpExcelSuccess] = useState<string | null>(null);
  const [vpSearchQuery, setVpSearchQuery] = useState('');

  // --- ACCESS REQUESTS STATES & FUNCTIONS ---
  const [courseRequests, setCourseRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const qSnap = await getDocs(collection(db, 'access_requests'));
      const list: any[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseId === course.id) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCourseRequests(list);
    } catch (err) {
      console.error('Error fetching access requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const runAutoApprovals = async (requestsToProcess: any[], currentAllowed: string[], currentVps: typeof verifiedPayments) => {
    const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10); // match last 10 digits
    let updatedAllowed = [...currentAllowed];
    let hasChanges = false;

    for (const req of requestsToProcess) {
      if (req.status !== 'pending') continue;

      const matchTrx = req.trxId.toLowerCase().trim();
      const matchPhone = cleanPhone(req.bkashNumber);

      const isMatch = currentVps.some(vp => {
        const vpPhone = cleanPhone(vp.bkashNumber);
        const vpTrx = vp.trxId.toLowerCase().trim();
        return (vpPhone === matchPhone || vp.bkashNumber.trim() === req.bkashNumber.trim()) && vpTrx === matchTrx;
      });

      if (isMatch) {
        try {
          const reqRef = doc(db, 'access_requests', req.id);
          await updateDoc(reqRef, { status: 'approved' });
          req.status = 'approved';

          if (!updatedAllowed.includes(req.email.toLowerCase())) {
            updatedAllowed.push(req.email.toLowerCase());
            hasChanges = true;
          }
        } catch (e) {
          console.error(`Failed to auto-approve request ${req.id}:`, e);
        }
      }
    }

    if (hasChanges) {
      setAllowedUsers(updatedAllowed);
      try {
        const courseRef = doc(db, 'courses', course.id);
        await updateDoc(courseRef, {
          allowedUsers: updatedAllowed
        });
      } catch (e) {
        console.error('Failed to update allowedUsers on course:', e);
      }
    }
  };

  const handleApproveRequest = async (req: any) => {
    try {
      const reqRef = doc(db, 'access_requests', req.id);
      await updateDoc(reqRef, { status: 'approved' });
      
      setCourseRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

      const emailLower = req.email.toLowerCase();
      if (!allowedUsers.includes(emailLower)) {
        const updatedAllowed = [...allowedUsers, emailLower];
        setAllowedUsers(updatedAllowed);
        
        const courseRef = doc(db, 'courses', course.id);
        await updateDoc(courseRef, {
          allowedUsers: updatedAllowed
        });
      }
    } catch (e) {
      console.error('Failed to approve request:', e);
      alert('Failed to approve request.');
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      const reqRef = doc(db, 'access_requests', reqId);
      await updateDoc(reqRef, { status: 'rejected' });
      
      setCourseRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
    } catch (e) {
      console.error('Failed to reject request:', e);
      alert('Failed to reject request.');
    }
  };

  useEffect(() => {
    if (activeTab === 'verification') {
      fetchRequests();
    }
  }, [activeTab]);

  useEffect(() => {
    if (courseRequests.length > 0 && verifiedPayments.length > 0) {
      runAutoApprovals(courseRequests, allowedUsers, verifiedPayments);
    }
  }, [courseRequests, verifiedPayments]);

  const fetchBlankQuestions = async () => {
    setBlankQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'blank_questions'));
      const list: BlankQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseId === course.id) {
          list.push({ id: docSnap.id, ...data } as BlankQuestion);
        }
      });
      setCourseBlankQuestions(list);
    } catch (err) {
      console.error('Error fetching course blank questions:', err);
    } finally {
      setBlankQuestionsLoading(false);
    }
  };

  const fetchOooQuestions = async () => {
    setOooQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'odd_one_out_questions'));
      const list: OddOneOutQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseId === course.id) {
          list.push({ id: docSnap.id, ...data } as OddOneOutQuestion);
        }
      });
      setCourseOooQuestions(list);
    } catch (err) {
      console.error('Error fetching course OOO questions:', err);
    } finally {
      setOooQuestionsLoading(false);
    }
  };

  const fetchAnalogyQuestions = async () => {
    setAnalogyQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'word_analogy_questions'));
      const list: WordAnalogyQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseId === course.id) {
          list.push({ id: docSnap.id, ...data } as WordAnalogyQuestion);
        }
      });
      setCourseAnalogyQuestions(list);
    } catch (err) {
      console.error('Error fetching course analogy questions:', err);
    } finally {
      setAnalogyQuestionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'blank-questions') {
      fetchBlankQuestions();
    } else if (activeTab === 'ooo-questions') {
      fetchOooQuestions();
    } else if (activeTab === 'analogy-questions') {
      fetchAnalogyQuestions();
    }
  }, [activeTab, course.id]);

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
          if (!row || row.length < 3) continue;

          const rawId = row[0] ? String(row[0]).trim() : '';
          const sentence = row[1] ? String(row[1]).trim() : '';

          // Skip header row
          if (idx === 0 && (rawId.toLowerCase() === 'id' || rawId.toLowerCase() === 'unique id' || rawId.toLowerCase() === 'uid' || sentence.toLowerCase().includes('sentence') || sentence.toLowerCase().includes('blank'))) {
            continue;
          }

          if (!rawId) {
            setExcelUploadError(`Error at Row ${idx + 1}: The first column must contain a mandatory unique ID.`);
            return;
          }

          if (!sentence) continue;

          const opts: string[] = [];
          let answer = '';

          for (let col = 2; col <= 5; col++) {
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

          const explanation = row[6] ? String(row[6]).trim() : '';

          if (opts.length > 0 && answer) {
            questionsList.push({
              id: rawId,
              sentence,
              options: opts,
              answer,
              explanation,
              courseId: course.id,
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
        setExcelUploadError('Failed to parse Excel file. Make sure it is a valid .xlsx or .xls file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveBlankExcelQuestions = async () => {
    if (excelQuestionsPreview.length === 0) return;
    setExcelSaveStatus('saving');
    try {
      for (const q of excelQuestionsPreview) {
        const updatedQ = { ...q, courseId: course.id };
        await setDoc(doc(db, 'blank_questions', q.id), updatedQ);
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
      courseId: course.id,
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
      setCourseBlankQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting blank question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteBlankQuestions = async () => {
    if (courseBlankQuestions.length === 0) {
      alert('No blank questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseBlankQuestions.length} Blank Filling questions for this course? This action is permanent and cannot be undone.`)) return;
    setBlankQuestionsLoading(true);
    try {
      for (const q of courseBlankQuestions) {
        await deleteDoc(doc(db, 'blank_questions', q.id));
      }
      setCourseBlankQuestions([]);
      alert('All Blank Filling questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting blank questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setBlankQuestionsLoading(false);
      fetchBlankQuestions();
    }
  };

  // --- OOO QUESTIONS EXCEL & MANUAL HANDLERS ---
  const handleUploadOooExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelOooUploadError(null);
    setExcelOooPreview([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rawRows.length === 0) {
          setExcelOooUploadError('No data found in the selected Excel sheet.');
          return;
        }

        const questionsList: OddOneOutQuestion[] = [];

        for (let idx = 0; idx < rawRows.length; idx++) {
          const row = rawRows[idx];
          if (!row || row.length < 5) continue;

          const rawId = row[0] ? String(row[0]).trim() : '';

          // Skip header row
          if (idx === 0 && (rawId.toLowerCase() === 'id' || rawId.toLowerCase() === 'unique id' || rawId.toLowerCase() === 'uid')) {
            continue;
          }

          if (!rawId) {
            setExcelOooUploadError(`Error at Row ${idx + 1}: The first column must contain a mandatory unique ID.`);
            return;
          }

          const wordsOpts: string[] = [];
          let answer = '';

          for (let col = 1; col <= 4; col++) {
            const val = row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : '';
            if (val) {
              if (val.includes('#')) {
                const cleanVal = val.replace('#', '').trim();
                wordsOpts.push(cleanVal);
                answer = cleanVal;
              } else {
                wordsOpts.push(val);
              }
            }
          }

          const reason = row[5] ? String(row[5]).trim() : '';

          if (wordsOpts.length === 4 && answer) {
            questionsList.push({
              id: rawId,
              words: wordsOpts,
              answer,
              reason,
              courseId: course.id,
              createdAt: new Date().toISOString()
            });
          }
        }

        if (questionsList.length === 0) {
          setExcelOooUploadError('No valid questions found. Ensure one of the 4 words contains a "#" to mark the odd one out.');
        } else {
          setExcelOooPreview(questionsList);
        }
      } catch (err) {
        console.error('Error parsing OOO excel:', err);
        setExcelOooUploadError('Failed to parse Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveOooExcelQuestions = async () => {
    if (excelOooPreview.length === 0) return;
    setExcelOooSaveStatus('saving');
    try {
      for (const q of excelOooPreview) {
        const updatedQ = { ...q, courseId: course.id };
        await setDoc(doc(db, 'odd_one_out_questions', q.id), updatedQ);
      }
      setExcelOooSaveStatus('saved');
      setExcelOooPreview([]);
      fetchOooQuestions();
      setTimeout(() => setExcelOooSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving OOO questions:', err);
      setExcelOooSaveStatus('error');
    }
  };

  const handleManualAddOooQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOooWords.some(w => !w.trim())) {
      alert('Please fill out all 4 words.');
      return;
    }
    const rawWords = newOooWords.map(w => w.trim());
    const answer = rawWords[newOooCorrectIndex];
    const newQ: OddOneOutQuestion = {
      id: `ooo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      words: rawWords,
      answer,
      reason: newOooReason.trim(),
      courseId: course.id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'odd_one_out_questions', newQ.id), newQ);
      setNewOooWords(['', '', '', '']);
      setNewOooCorrectIndex(0);
      setNewOooReason('');
      fetchOooQuestions();
      alert('Question added successfully!');
    } catch (err) {
      console.error('Error adding OOO question manually:', err);
      alert('Failed to add question.');
    }
  };

  const handleDeleteOooQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'odd_one_out_questions', id));
      setCourseOooQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting OOO question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteOooQuestions = async () => {
    if (courseOooQuestions.length === 0) {
      alert('No Odd One Out questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseOooQuestions.length} Odd One Out questions for this course? This action is permanent and cannot be undone.`)) return;
    setOooQuestionsLoading(true);
    try {
      for (const q of courseOooQuestions) {
        await deleteDoc(doc(db, 'odd_one_out_questions', q.id));
      }
      setCourseOooQuestions([]);
      alert('All Odd One Out questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting OOO questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setOooQuestionsLoading(false);
      fetchOooQuestions();
    }
  };

  // --- ANALOGY QUESTIONS EXCEL & MANUAL HANDLERS ---
  const handleUploadAnalogyExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelAnalogyUploadError(null);
    setExcelAnalogyPreview([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rawRows.length === 0) {
          setExcelAnalogyUploadError('No data found in the selected Excel sheet.');
          return;
        }

        const questionsList: WordAnalogyQuestion[] = [];

        for (let idx = 0; idx < rawRows.length; idx++) {
          const row = rawRows[idx];
          if (!row || row.length < 6) continue;

          const rawId = row[0] ? String(row[0]).trim() : '';
          const analogy = row[1] ? String(row[1]).trim() : '';

          // Skip header row
          if (idx === 0 && (rawId.toLowerCase() === 'id' || rawId.toLowerCase() === 'unique id' || rawId.toLowerCase() === 'uid' || analogy.toLowerCase().includes('analogy') || analogy.toLowerCase().includes('question'))) {
            continue;
          }

          if (!rawId) {
            setExcelAnalogyUploadError(`Error at Row ${idx + 1}: The first column must contain a mandatory unique ID.`);
            return;
          }

          if (!analogy) continue;

          const opts: string[] = [];
          let answer = '';

          for (let col = 2; col <= 5; col++) {
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

          const explanation = row[6] ? String(row[6]).trim() : '';

          if (analogy && opts.length === 4 && answer) {
            questionsList.push({
              id: rawId,
              analogy,
              options: opts,
              answer,
              explanation,
              courseId: course.id,
              createdAt: new Date().toISOString()
            });
          }
        }

        if (questionsList.length === 0) {
          setExcelAnalogyUploadError('No valid questions found. Ensure one of the option columns (1 to 4) contains a "#" to mark the correct analogy option.');
        } else {
          setExcelAnalogyPreview(questionsList);
        }
      } catch (err) {
        console.error('Error parsing analogy excel:', err);
        setExcelAnalogyUploadError('Failed to parse Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveAnalogyExcelQuestions = async () => {
    if (excelAnalogyPreview.length === 0) return;
    setExcelAnalogySaveStatus('saving');
    try {
      for (const q of excelAnalogyPreview) {
        const updatedQ = { ...q, courseId: course.id };
        await setDoc(doc(db, 'word_analogy_questions', q.id), updatedQ);
      }
      setExcelAnalogySaveStatus('saved');
      setExcelAnalogyPreview([]);
      fetchAnalogyQuestions();
      setTimeout(() => setExcelAnalogySaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving analogy questions:', err);
      setExcelAnalogySaveStatus('error');
    }
  };

  const handleManualAddAnalogyQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnalogy.trim() || newAnalogyOpts.some(o => !o.trim())) {
      alert('Please fill out the base analogy and all 4 options.');
      return;
    }
    const rawOpts = newAnalogyOpts.map(o => o.trim());
    const answer = rawOpts[newAnalogyCorrectIndex];
    const newQ: WordAnalogyQuestion = {
      id: `ana-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      analogy: newAnalogy.trim(),
      options: rawOpts,
      answer,
      explanation: newAnalogyExplanation.trim(),
      courseId: course.id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'word_analogy_questions', newQ.id), newQ);
      setNewAnalogy('');
      setNewAnalogyOpts(['', '', '', '']);
      setNewAnalogyCorrectIndex(0);
      setNewAnalogyExplanation('');
      fetchAnalogyQuestions();
      alert('Question added successfully!');
    } catch (err) {
      console.error('Error adding analogy question manually:', err);
      alert('Failed to add question.');
    }
  };

  const handleDeleteAnalogyQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'word_analogy_questions', id));
      setCourseAnalogyQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting analogy question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteAnalogyQuestions = async () => {
    if (courseAnalogyQuestions.length === 0) {
      alert('No Word Analogy questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseAnalogyQuestions.length} Word Analogy questions for this course? This action is permanent and cannot be undone.`)) return;
    setAnalogyQuestionsLoading(true);
    try {
      for (const q of courseAnalogyQuestions) {
        await deleteDoc(doc(db, 'word_analogy_questions', q.id));
      }
      setCourseAnalogyQuestions([]);
      alert('All Word Analogy questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting analogy questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setAnalogyQuestionsLoading(false);
      fetchAnalogyQuestions();
    }
  };

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

  const [enabledGames, setEnabledGames] = useState<Record<string, boolean>>({
    quiz: true,
    match: true,
    synonym: true,
    blank: true,
    ...(course.enabledGames || {})
  });

  // --- WORDS LIST STATES ---
  const sanitizeWordsList = (wordsList: VocabularyWord[]) => {
    return (wordsList || []).map((w, idx) => {
      if (!w.id) {
        return {
          ...w,
          id: `w-${course.id}-${w.group || 'all'}-${idx}-${Math.random().toString(36).substr(2, 5)}`
        };
      }
      return w;
    });
  };

  const [localWords, setLocalWords] = useState<VocabularyWord[]>(sanitizeWordsList(course.words || []));
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [wordGroupFilter, setWordGroupFilter] = useState<string>('all');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  
  // Word editing states
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [editedWordId, setEditedWordId] = useState('');
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
  const [singleWordId, setSingleWordId] = useState('');
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
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

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
    setLocalWords(sanitizeWordsList(course.words || []));
    setVerifiedPayments(course.verifiedPayments || []);
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
    setActiveTab(initialTab || 'general');
    setHasAutoOpened(false);
  }, [course, initialTab]);

  // Handle auto-editing of a specified word
  useEffect(() => {
    if (initialEditWordName && localWords.length > 0 && !hasAutoOpened) {
      const match = localWords.find(w => w.word.toLowerCase() === initialEditWordName.trim().toLowerCase());
      if (match) {
        handleStartEditWord(match);
        setWordSearchQuery(match.word);
        setHasAutoOpened(true);
      }
    }
  }, [initialEditWordName, localWords, hasAutoOpened]);

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

  // --- AUTO-VERIFICATION PAYMENT HANDLERS ---
  const handleAddVerifiedPayment = () => {
    const num = newVpNumber.trim();
    const trx = newVpTrxId.trim();
    if (!num || !trx) {
      setError('Mobile number and Transaction ID are required.');
      return;
    }

    if (verifiedPayments.some(vp => vp.bkashNumber === num && vp.trxId.toLowerCase() === trx.toLowerCase())) {
      setError('This payment entry is already verified.');
      return;
    }

    setVerifiedPayments(prev => [...prev, { bkashNumber: num, trxId: trx }]);
    setNewVpNumber('');
    setNewVpTrxId('');
    setError(null);
  };

  const handleVpDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveVp(true);
    } else if (e.type === "dragleave") {
      setDragActiveVp(false);
    }
  };

  const handleVpDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveVp(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processVpExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleVpFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processVpExcelFile(e.target.files[0]);
    }
  };

  const processVpExcelFile = (file: File) => {
    setVpExcelError(null);
    setVpExcelSuccess(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          setVpExcelError('Spreadsheet is empty.');
          return;
        }

        const vpList: { bkashNumber: string; trxId: string }[] = [];

        for (const row of rawRows) {
          const rowKeys = Object.keys(row);
          
          const findKey = (candidates: string[]) => {
            return rowKeys.find(k => {
              const cleanK = k.toLowerCase().trim();
              return candidates.some(c => cleanK === c);
            });
          };

          const mobileKey = findKey(['mobile', 'bkashnumber', 'bkash', 'phone', 'number']);
          const trxKey = findKey(['trxid', 'transaction', 'txid', 'transactionid']);

          const mobileVal = mobileKey ? String(row[mobileKey]).trim() : '';
          const trxVal = trxKey ? String(row[trxKey]).trim() : '';

          if (mobileVal && trxVal) {
            vpList.push({
              bkashNumber: mobileVal,
              trxId: trxVal
            });
          }
        }

        if (vpList.length === 0) {
          setVpExcelError('Columns did not match! Spreadsheet must contain "mobile" or "bKash" and "trxId" or "transaction" columns.');
          return;
        }

        // Merge and avoid duplicates
        setVerifiedPayments(prev => {
          const merged = [...prev];
          vpList.forEach(item => {
            if (!merged.some(m => m.bkashNumber === item.bkashNumber && m.trxId.toLowerCase() === item.trxId.toLowerCase())) {
              merged.push(item);
            }
          });
          return merged;
        });

        setVpExcelSuccess(`Successfully added ${vpList.length} verified payment records from file!`);
      } catch (err) {
        console.error(err);
        setVpExcelError('Failed to parse Excel spreadsheet.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyVpBulk = () => {
    if (!vpBulkInput.trim()) return;
    const lines = vpBulkInput.split('\n');
    const parsed: { bkashNumber: string; trxId: string }[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      // split by comma, tab, space or semicolon
      const parts = line.split(/[,\t;]+/).map(p => p.trim());
      if (parts.length >= 2) {
        parsed.push({
          bkashNumber: parts[0],
          trxId: parts[1]
        });
      }
    });

    if (parsed.length === 0) {
      setError('No valid comma/tab separated lines found.');
      return;
    }

    setVerifiedPayments(prev => {
      const merged = [...prev];
      parsed.forEach(item => {
        if (!merged.some(m => m.bkashNumber === item.bkashNumber && m.trxId.toLowerCase() === item.trxId.toLowerCase())) {
          merged.push(item);
        }
      });
      return merged;
    });

    setVpBulkInput('');
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
    setEditedWordId(w.id || '');
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

    const newId = editedWordId.trim();
    if (!newId) {
      alert('Word Unique ID cannot be empty.');
      return;
    }

    // Check for duplicate ID in other words
    const hasDuplicate = localWords.some(w => w.id === newId && w.id !== editingWord.id);
    if (hasDuplicate) {
      alert(`The ID "${newId}" is already used by another word in this course.`);
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
          id: newId,
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
    const finalId = singleWordId.trim() || `${course.id}_g${groupVal}_w_${Date.now()}_${uniqueIndexSuffix}`;

    // Check duplicate
    const hasDuplicate = localWords.some(w => w.id === finalId);
    if (hasDuplicate) {
      setAddFormMessage({ type: 'error', text: `The ID "${finalId}" is already in use.` });
      return;
    }

    const newWordItem: VocabularyWord = {
      id: finalId,
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
    setSingleWordId('');
    setSingleWord('');
    setSingleMeaning('');
    setSingleSynonyms('');
    setSingleExtraWord('');
    setSingleExtraMeaning('');
    setSingleExample('');

    setAddFormMessage({ 
      type: 'success', 
      text: `"${newWordItem.word}" has been successfully added to the local list with ID "${finalId}"! Click "Update Settings" below to save changes permanently.` 
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
          const idKey = findKey(['id', 'unique id', 'word id', 'uid']);

          if (!idKey) {
            setExcelError('The spreadsheet is missing the mandatory "ID" column. Please make sure your spreadsheet has an "ID" column.');
            return;
          }

          const rawId = row[idKey] ? String(row[idKey]).trim() : '';
          if (!rawId) {
            setExcelError('Error parsing: A row is missing a unique ID in the mandatory "ID" column.');
            return;
          }

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
            id: rawId,
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
        enabledGames: enabledGames, // Save practice and games toggles!
        totalGroups: uniqueGroupsSize || 1,
        price: Number(price) || 0,
        bkashNumber: bkashNumber.trim(),
        verifiedPayments: verifiedPayments,
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
    { id: 'practice-games' as const, label: 'Practice & Games', icon: Gamepad2 },
    { id: 'access' as const, label: 'Student Access', icon: Users },
    { id: 'students' as const, label: 'Allowed Students', icon: UserCheck, badge: allowedUsers.length },
    { id: 'verification' as const, label: 'Auto-Verification', icon: ShieldCheck, badge: verifiedPayments.length },
    { id: 'wordlist' as const, label: 'Word List & Editing', icon: BookOpen, badge: localWords.length },
    { id: 'addwords' as const, label: 'Add & Upload Words', icon: PlusCircle },
    { id: 'blank-questions' as const, label: 'Blank Questions', icon: FileSpreadsheet, badge: courseBlankQuestions.length },
    { id: 'ooo-questions' as const, label: 'Odd One Out', icon: HelpCircle, badge: courseOooQuestions.length },
    { id: 'analogy-questions' as const, label: 'Word Analogy', icon: Shuffle, badge: courseAnalogyQuestions.length },
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
                    <label className="text-xs font-extrabold text-slate-600 block">Course Price (TK)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">bKash Number (Send Money)</label>
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

            {/* --- SECTION 2.5: PRACTICE & GAMES ON/OFF CONTROL --- */}
            {activeTab === 'practice-games' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Practice & Games Controller</h4>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 p-4 rounded-2xl text-xs flex items-start gap-2.5 leading-relaxed">
                  <Gamepad2 className="w-4.5 h-4.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-black text-indigo-950 block">Games Control Policy</span>
                    <p className="mt-0.5">
                      Practice and game options that are turned off will not be visible to students in the Practice & Games Hub. Toggle them on to make them available.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white divide-y divide-slate-100">
                  {[
                    { key: 'quiz', label: 'MCQ Quiz', desc: 'Multiple choice questions and spelling practice games.', icon: GraduationCap },
                    { key: 'match', label: 'Word Match Game', desc: 'Card matching memory training game.', icon: Gamepad2 },
                    { key: 'synonym', label: 'Synonym Check', desc: 'Synonym matching and verification game.', icon: Sparkles },
                    { key: 'blank', label: 'Blank Filling Practice', desc: 'Sentence fill-in-the-blanks practice.', icon: BookOpen },
                    { key: 'odd_one_out', label: 'Odd One Out', desc: 'Synonyms word selection challenge.', icon: HelpCircle },
                    { key: 'analogy', label: 'Word Analogy', desc: 'Word pairs analogy logic challenge.', icon: Shuffle }
                  ].map(item => {
                    const isEnabled = enabledGames[item.key] !== false;
                    
                    return (
                      <div 
                        key={item.key} 
                        className="p-4 flex items-start justify-between gap-4 transition-all duration-200 bg-white hover:bg-slate-50/40"
                      >
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <item.icon className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {item.label}
                            </span>
                            <span className="text-[10px] text-slate-450 font-medium block mt-1 leading-relaxed">{item.desc}</span>
                          </div>
                        </div>

                        {/* Switch Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEnabledGames(prev => ({
                              ...prev,
                              [item.key]: !prev[item.key]
                            }));
                          }}
                          className="mt-1 transition-all cursor-pointer active:scale-95"
                        >
                          {isEnabled ? (
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

            {/* --- SECTION: AUTO-VERIFICATION PAYMENTS --- */}
            {activeTab === 'verification' && (
              <div className="space-y-6 animate-fadeIn text-slate-700 flex-1 flex flex-col min-h-0">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">bKash Auto-Verification Gateway</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1 leading-relaxed">
                    Store mobile numbers and transaction IDs (TrxID) of students who have completed payments. Students' access requests with matching details will be automatically approved.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto pb-4">
                  {/* Left Column: Form & Import */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Add Single Record */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-indigo-600" />
                        <span>Add Record Manually</span>
                      </h5>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">bKash Mobile Number</label>
                          <input
                            type="text"
                            value={newVpNumber}
                            onChange={(e) => setNewVpNumber(e.target.value)}
                            placeholder="e.g. 01712345678"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold transition text-slate-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Transaction ID (TrxID)</label>
                          <input
                            type="text"
                            value={newVpTrxId}
                            onChange={(e) => setNewVpTrxId(e.target.value)}
                            placeholder="e.g. K8B9H5J2D"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-mono font-bold transition text-slate-800 uppercase"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleAddVerifiedPayment}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Record</span>
                        </button>
                      </div>
                    </div>

                    {/* Bulk Import Section */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-indigo-600" />
                        <span>Bulk Import (Excel / Text)</span>
                      </h5>

                      {/* Spreadsheet Drag-n-Drop */}
                      <div className="space-y-3">
                        <div 
                          onDragEnter={handleVpDrag}
                          onDragLeave={handleVpDrag}
                          onDragOver={handleVpDrag}
                          onDrop={handleVpDrop}
                          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition relative ${
                            dragActiveVp 
                              ? 'border-indigo-500 bg-indigo-50/30' 
                              : 'border-slate-200 hover:border-slate-350 bg-white'
                          }`}
                        >
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv"
                            onChange={handleVpFileInputChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <FileSpreadsheet className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-700">Upload Excel / CSV File</p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Drag and drop or browse files</p>
                        </div>

                        {vpExcelError && <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">{vpExcelError}</p>}
                        {vpExcelSuccess && <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">{vpExcelSuccess}</p>}

                        <div className="relative flex items-center my-3">
                          <div className="flex-grow border-t border-slate-200"></div>
                          <span className="flex-shrink mx-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Or copy & paste</span>
                          <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        {/* Paste area */}
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={vpBulkInput}
                            onChange={(e) => setVpBulkInput(e.target.value)}
                            placeholder="Mobile, Transaction ID (one per line)&#13;e.g.&#13;01712345678, K8B9H5J2D&#13;01822334455, J3L4K2M5N"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold font-sans resize-none"
                          />
                          <button
                            type="button"
                            onClick={handleApplyVpBulk}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                          >
                            Add Text Data
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Pre-verified Entries List */}
                  <div className="lg:col-span-7 flex flex-col h-full min-h-[300px]">
                    <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white flex flex-col h-full">
                      {/* List Header */}
                      <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Verified List</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {verifiedPayments.length} records
                          </span>
                        </div>
                        {verifiedPayments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Do you want to delete all records?')) {
                                setVerifiedPayments([]);
                              }
                            }}
                            className="text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {/* Search Bar */}
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={vpSearchQuery}
                            onChange={(e) => setVpSearchQuery(e.target.value)}
                            placeholder="Search by Mobile or TrxID..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                          />
                        </div>
                      </div>

                      {/* Scrollable list */}
                      <div className="flex-grow overflow-y-auto divide-y divide-slate-100 max-h-[350px]">
                        {verifiedPayments.filter(vp => {
                          const q = vpSearchQuery.toLowerCase().trim();
                          return !q || vp.bkashNumber.toLowerCase().includes(q) || vp.trxId.toLowerCase().includes(q);
                        }).length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center h-48">
                            <ShieldCheck className="w-8 h-8 text-slate-300 mb-2" />
                            <p>No verified payment data found.</p>
                          </div>
                        ) : (
                          verifiedPayments
                            .filter(vp => {
                              const q = vpSearchQuery.toLowerCase().trim();
                              return !q || vp.bkashNumber.toLowerCase().includes(q) || vp.trxId.toLowerCase().includes(q);
                            })
                            .map((vp, index) => (
                              <div key={index} className="px-4 py-3 hover:bg-slate-50/50 transition flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <p className="text-xs font-black text-slate-800 font-mono">{vp.bkashNumber}</p>
                                  <p className="text-[10px] text-indigo-600 font-bold font-mono">TrxID: <span className="uppercase">{vp.trxId}</span></p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setVerifiedPayments(prev => prev.filter((_, i) => i !== index))}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* student access requests subsection */}
                <div className="border-t border-slate-200/60 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <span>Student Access Requests & Status</span>
                      </h5>
                      <p className="text-[10px] text-slate-450 font-semibold mt-0.5">
                        View bKash payment requests submitted by students. Approve pending requests manually or wait for auto-verification.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchRequests}
                      disabled={loadingRequests}
                      className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 transition cursor-pointer"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                    {loadingRequests ? (
                      <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                        <p>Loading requests...</p>
                      </div>
                    ) : courseRequests.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
                        <Users className="w-8 h-8 text-slate-300 mb-2" />
                        <p>No requests received yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-4">Student Email</th>
                              <th className="py-2.5 px-4">bKash Number</th>
                              <th className="py-2.5 px-4">Transaction ID</th>
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4 text-center">Status</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {courseRequests.map((req) => {
                              const isApproved = req.status === 'approved';
                              const isRejected = req.status === 'rejected';
                              return (
                                <tr key={req.id} className="hover:bg-slate-50/50 transition">
                                  <td className="py-2.5 px-4 font-semibold text-slate-800">{req.email}</td>
                                  <td className="py-2.5 px-4 font-mono text-slate-600 font-bold">{req.bkashNumber}</td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 uppercase">{req.trxId}</td>
                                  <td className="py-2.5 px-4 text-[10px] text-slate-400 font-bold">
                                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString('bn-BD') : 'N/A'}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {isApproved ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Approved
                                      </span>
                                    ) : isRejected ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100">
                                        Rejected
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    {!isApproved && !isRejected && (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleApproveRequest(req)}
                                          className="px-2 py-1 bg-emerald-650 hover:bg-emerald-600 text-white font-extrabold text-[10px] rounded-lg transition cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectRequest(req.id)}
                                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 font-extrabold text-[10px] rounded-lg transition cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
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

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">Unique ID (Optional - auto-generated if left blank)</label>
                      <input 
                        type="text" 
                        value={singleWordId}
                        onChange={(e) => setSingleWordId(e.target.value)}
                        placeholder="e.g. word-101 (leave blank for auto-generation)" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>

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
                        Your spreadsheet must contain a mandatory <strong className="text-rose-600 font-extrabold">id</strong> (or <strong className="text-rose-600 font-extrabold">unique id</strong>, <strong className="text-rose-600 font-extrabold">word id</strong>, <strong className="text-rose-600 font-extrabold">uid</strong>) column for each word, plus <strong className="text-slate-700 font-extrabold">word</strong> (or <strong className="text-slate-700 font-extrabold">main word</strong>) and <strong className="text-slate-700 font-extrabold">meaning</strong> (or <strong className="text-slate-700 font-extrabold">bangla meaning</strong>) columns. You can optionally include <strong className="text-slate-700 font-extrabold">group, synonyms, extra word, extra meaning, example</strong> columns.
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

            {activeTab === 'blank-questions' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Blank Filling Practice</h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Manage blank-filling questions specifically for this course. You can upload an Excel spreadsheet or add questions manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                      <span className="text-xs font-black text-slate-800">Upload via Excel</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Format:</strong> Column 1: Mandatory Unique ID (e.g. <code>bq-101</code>). Column 2: Sentence with blank (e.g. "Success is not ___."). Columns 3-6: Options. Mark the correct option with a trailing "#" (e.g., "final#"). Column 7 (optional): Explanation.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadBlankExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelUploadError}</span>
                      </div>
                    )}

                    {excelQuestionsPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                            {excelQuestionsPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveBlankExcelQuestions}
                            disabled={excelSaveStatus === 'saving'}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelQuestionsPreview.map((q, idx) => (
                            <div key={idx} className="p-3">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.sentence}</p>
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
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddBlankQuestion} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Sentence with Blank</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., The journey begins with a single ___."
                          value={newSentence}
                          onChange={(e) => setNewSentence(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 1</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 1"
                            value={newOpt1}
                            onChange={(e) => setNewOpt1(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 2</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 2"
                            value={newOpt2}
                            onChange={(e) => setNewOpt2(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 3</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 3"
                            value={newOpt3}
                            onChange={(e) => setNewOpt3(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 4</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 4"
                            value={newOpt4}
                            onChange={(e) => setNewOpt4(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Correct Answer Option</label>
                        <select
                          value={newCorrectIndex}
                          onChange={(e) => setNewCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Option 1: {newOpt1 || '(empty)'}</option>
                          <option value={1}>Option 2: {newOpt2 || '(empty)'}</option>
                          <option value={2}>Option 3: {newOpt3 || '(empty)'}</option>
                          <option value={3}>Option 4: {newOpt4 || '(empty)'}</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Blank Questions ({courseBlankQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Questions currently available for this specific course</p>
                    </div>
                    <div className="flex gap-2">
                      {courseBlankQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteBlankQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchBlankQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${blankQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {blankQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseBlankQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No questions found. Add questions manually or upload an Excel sheet to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">Sentence</th>
                            <th className="px-4 py-2.5">Options</th>
                            <th className="px-4 py-2.5">Answer</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseBlankQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={q.sentence}>
                                {q.sentence}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                                {q.options.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteBlankQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

            {activeTab === 'ooo-questions' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Odd One Out Practice</h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Manage Odd One Out questions specifically for this course. Upload an Excel spreadsheet or add questions manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <FileSpreadsheet className="w-4.5 h-4.5 text-sky-650" />
                      <span className="text-xs font-black text-slate-800">Upload via Excel</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Format:</strong> Column 1: Mandatory Unique ID (e.g. <code>ooo-101</code>). Columns 2-5: 4 Words. Mark the odd-one-out word with a trailing "#" (e.g. "harmful#"). Column 6 (optional): Reason / explanation.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadOooExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelOooUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelOooUploadError}</span>
                      </div>
                    )}

                    {excelOooPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                            {excelOooPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveOooExcelQuestions}
                            disabled={excelOooSaveStatus === 'saving'}
                            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelOooSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelOooPreview.map((q, idx) => (
                            <div key={idx} className="p-3">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.words.join(' | ')}</p>
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Correct: <span className="text-sky-600 font-extrabold">{q.answer}</span></p>
                              {q.reason && <p className="text-[10px] text-slate-400 mt-0.5">Reason: {q.reason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {excelOooSaveStatus === 'saved' && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddOooQuestion} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {newOooWords.map((word, wIdx) => (
                          <div className="space-y-1" key={wIdx}>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Word {wIdx + 1}</label>
                            <input
                              type="text"
                              required
                              placeholder={`Word ${wIdx + 1}`}
                              value={word}
                              onChange={(e) => {
                                const next = [...newOooWords];
                                next[wIdx] = e.target.value;
                                setNewOooWords(next);
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Select Odd One Out (Correct Answer)</label>
                        <select
                          value={newOooCorrectIndex}
                          onChange={(e) => setNewOooCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Word 1: {newOooWords[0] || '(empty)'}</option>
                          <option value={1}>Word 2: {newOooWords[1] || '(empty)'}</option>
                          <option value={2}>Word 3: {newOooWords[2] || '(empty)'}</option>
                          <option value={3}>Word 4: {newOooWords[3] || '(empty)'}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Reason / Explanation (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. This word has a negative connotation, whereas others are positive."
                          value={newOooReason}
                          onChange={(e) => setNewOooReason(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Odd One Out Questions ({courseOooQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Questions currently available for this specific course</p>
                    </div>
                    <div className="flex gap-2">
                      {courseOooQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteOooQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchOooQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${oooQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {oooQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseOooQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No questions found. Add questions manually or upload an Excel sheet to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">Words Set</th>
                            <th className="px-4 py-2.5">Odd One Out (Answer)</th>
                            <th className="px-4 py-2.5">Reason / Explanation</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseOooQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={q.words.join(', ')}>
                                {q.words.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-sky-50 text-sky-750 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 italic max-w-xs truncate" title={q.reason}>
                                {q.reason || 'None'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteOooQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

            {activeTab === 'analogy-questions' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Word Analogy Practice</h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Manage Word Analogy questions specifically for this course. Upload an Excel spreadsheet or add questions manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <FileSpreadsheet className="w-4.5 h-4.5 text-purple-650" />
                      <span className="text-xs font-black text-slate-800">Upload via Excel</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Format:</strong> Column 1: Mandatory Unique ID (e.g. <code>ana-101</code>). Column 2: Base analogy (e.g. "hot : cold"). Columns 3-6: Pair options. Mark the correct answer option pair with a trailing "#" (e.g. "up : down#"). Column 7 (optional): Explanation.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadAnalogyExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelAnalogyUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelAnalogyUploadError}</span>
                      </div>
                    )}

                    {excelAnalogyPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                            {excelAnalogyPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveAnalogyExcelQuestions}
                            disabled={excelAnalogySaveStatus === 'saving'}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelAnalogySaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelAnalogyPreview.map((q, idx) => (
                            <div key={idx} className="p-3">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.analogy}</p>
                              <div className="grid grid-cols-2 gap-1.5 mt-1.5 font-mono text-[11px] text-slate-500">
                                {q.options.map((opt, oIdx) => (
                                  <span key={oIdx} className={opt === q.answer ? 'text-purple-600 font-extrabold bg-purple-50 px-1 rounded' : ''}>
                                    {opt} {opt === q.answer ? '✓' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {excelAnalogySaveStatus === 'saved' && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddAnalogyQuestion} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Base Analogy</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. cold : hot"
                          value={newAnalogy}
                          onChange={(e) => setNewAnalogy(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {newAnalogyOpts.map((opt, oIdx) => (
                          <div className="space-y-1" key={oIdx}>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option {oIdx + 1}</label>
                            <input
                              type="text"
                              required
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const next = [...newAnalogyOpts];
                                next[oIdx] = e.target.value;
                                setNewAnalogyOpts(next);
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Correct Answer Option</label>
                        <select
                          value={newAnalogyCorrectIndex}
                          onChange={(e) => setNewAnalogyCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Option 1: {newAnalogyOpts[0] || '(empty)'}</option>
                          <option value={1}>Option 2: {newAnalogyOpts[1] || '(empty)'}</option>
                          <option value={2}>Option 3: {newAnalogyOpts[2] || '(empty)'}</option>
                          <option value={3}>Option 4: {newAnalogyOpts[3] || '(empty)'}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Explanation (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Cold and hot are opposites, just like up and down."
                          value={newAnalogyExplanation}
                          onChange={(e) => setNewAnalogyExplanation(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Word Analogy Questions ({courseAnalogyQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Questions currently available for this specific course</p>
                    </div>
                    <div className="flex gap-2">
                      {courseAnalogyQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteAnalogyQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchAnalogyQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${analogyQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {analogyQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseAnalogyQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No questions found. Add questions manually or upload an Excel sheet to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">Base Analogy</th>
                            <th className="px-4 py-2.5">Options</th>
                            <th className="px-4 py-2.5">Answer</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseAnalogyQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={q.analogy}>
                                {q.analogy}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={q.options.join(', ')}>
                                {q.options.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-755 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteAnalogyQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Word Unique ID (Mandatory)</label>
                <input 
                  type="text" 
                  value={editedWordId}
                  onChange={(e) => setEditedWordId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  placeholder="Unique ID"
                />
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
