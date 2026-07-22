export interface VocabularyWord {
  id: string; // unique id, e.g. "g1-w1"
  group: number | string; // Support both numeric (1 to 37) and custom group names (like letter-based)
  word: string; // Base Word
  meaning: string; // Bengali Meaning
  synonyms: string; // Synonyms
  extraWord: string; // Word from extra column
  extraMeaning: string; // Meaning from extra column
  example?: string; // Optional usage sentence/example
  mnemonic?: string; // Mnemonic / memory aid note
}

export type WordStatus = 'know' | 'dont_know' | 'confusion' | 'unrated'; // 'know', 'dont_know', 'confusion', 'unrated'

export interface UserProgress {
  status: WordStatus;
  updatedAt: string;
  notes?: string; // Custom notes/mnemonic memory aid
  bookmarks?: string[]; // Custom folder IDs
  reviewAt?: string; // ISO date string for spaced repetition review
  repetitionCount?: number; // count of times studied
}

export interface CustomFolder {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export type ActiveTab = 'dashboard' | 'my_courses' | 'flashcard' | 'synonym' | 'quiz' | 'match' | 'dictionary' | 'lists' | 'planner' | 'settings' | 'admin' | 'leaderboard' | 'practice' | 'study_tools';

export interface FlashcardCustomStyle {
  presetId?: 'preset-1' | 'preset-2' | 'preset-3' | 'preset-4' | 'preset-5' | 'custom';
  // Main Word Styling
  wordFontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  wordColor: string;
  wordPosition: 'left' | 'center' | 'right';
  wordVerticalPos: 'top' | 'center' | 'bottom';
  // Meaning / Secondary Text Styling
  meaningFontSize: 'sm' | 'md' | 'lg' | 'xl';
  meaningColor: string;
  // Card Styling
  cardBgColor: string;
  cardTextColor: string;
  borderRadius: '12px' | '16px' | '20px' | '24px' | '32px';
  borderStyle: 'none' | 'subtle' | 'bold' | 'accent' | 'neon';
  shadowStyle: 'none' | 'soft' | 'diffused' | 'glow' | 'deep';
  updatedAt?: string;
  updatedBy?: string;
}

export interface AppSettings {
  defaultFlashcardTags: WordStatus[];
  defaultFlashcardOrder: 'serial' | 'alphabetical' | 'random';
  autoPlayAudio: boolean;
  quizLength: number;
  
  // New default settings fields for custom user defaults everywhere
  defaultSynonymOrder?: 'serial' | 'alphabetical' | 'random';
  defaultSynonymTags?: ('know' | 'dont_know' | 'unrated')[];
  defaultQuizType?: 'mcq_en_bn' | 'mcq_bn_en' | 'typing_spelling';
  defaultMatchSize?: number;

  // Keyboard Shortcuts Mapping: e.g. { "Space": "flip", "ArrowRight": "know" }
  shortcuts?: Record<string, string>;

  // Flashcard rotation animation
  flashcardAnimation?: 'flip-h' | 'flip-v' | 'slide' | 'fade' | 'zoom' | 'shuffle';

  // Option to colorize main words on flashcards based on their status (Green for Learned/know, Red for Unlearned/dont_know, Amber for Confused/confusion)
  colorizeMainWord?: boolean;

  // Global admin flashcard custom design style
  flashcardCustomStyle?: FlashcardCustomStyle;
}

export interface StudySession {
  date: string; // YYYY-MM-DD
  wordsStudied: number;
  correctAnswers: number;
  quizTaken: number;
}

export interface StudyGoal {
  dailyTarget: number; // e.g. 20 words
  streak: number;
  lastActiveDate?: string;
  history: Record<string, number>; // date YYYY-MM-DD -> words studied count
}

export interface Course {
  id: string;
  title: string;
  description: string;
  totalGroups: number;
  words: VocabularyWord[];
  isDefault?: boolean;
  isRestricted?: boolean;
  allowedUsers?: string[];
  allowedUsersExpiry?: Record<string, string>;
  variableToggles?: Record<string, boolean>;
  enabledGames?: Record<string, boolean>;
  createdAt: string;
  createdBy: string;
  price?: number;
  bkashNumber?: string;
  verifiedPayments?: { bkashNumber: string; trxId: string }[];
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
  googleSearchQuery?: string;
}

export interface AccessRequest {
  id: string;
  courseId: string;
  courseTitle: string;
  bkashNumber: string;
  email: string;
  trxId: string;
  status: 'pending' | 'approved' | 'rejected';
  price?: number;
  createdAt: string;
  requestedBy?: string;
}

export interface BlankQuestion {
  id: string;
  sentence: string;
  options: string[];
  answer: string;
  explanation?: string;
  courseId?: string;
  createdAt?: string;
}

export interface OddOneOutQuestion {
  id: string;
  words: string[]; // 4 words, e.g. ["benevolent", "generous", "kind", "malevolent"]
  answer: string;  // e.g. "malevolent"
  reason?: string; // explanation
  courseId?: string;
  createdAt?: string;
}

export interface WordAnalogyQuestion {
  id: string;
  analogy: string;  // e.g. "light : dark"
  options: string[]; // 4 word pairs, e.g. ["hot : cold", "big : huge", "fast : quick", "soft : smooth"]
  answer: string;   // e.g. "hot : cold"
  explanation?: string;
  courseId?: string;
  createdAt?: string;
}


