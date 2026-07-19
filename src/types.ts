export interface VocabularyWord {
  id: string; // unique id, e.g. "g1-w1"
  group: number | string; // Support both numeric (1 to 37) and custom group names (like 'ক')
  word: string; // Base Word
  meaning: string; // Bengali Meaning
  synonyms: string; // Synonyms
  extraWord: string; // Word from extra column
  extraMeaning: string; // Meaning from extra column
  example?: string; // Optional usage sentence/example
}

export type WordStatus = 'know' | 'dont_know' | 'confusion' | 'unrated'; // 'পারি', 'পারি না', 'কনফিউশন', 'Unrated'

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

export type ActiveTab = 'dashboard' | 'flashcard' | 'synonym' | 'quiz' | 'match' | 'dictionary' | 'lists' | 'planner' | 'settings' | 'admin' | 'leaderboard';

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
  variableToggles?: Record<string, boolean>;
  createdAt: string;
  createdBy: string;
}

