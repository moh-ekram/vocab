export interface VocabularyWord {
  id: string; // unique id, e.g. "g1-w1"
  group: number; // 1 to 37
  word: string; // Base Word
  meaning: string; // Bengali Meaning
  synonyms: string; // Synonyms
  extraWord: string; // Word from extra column
  extraMeaning: string; // Meaning from extra column
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

export type ActiveTab = 'dashboard' | 'flashcard' | 'synonym' | 'quiz' | 'match' | 'dictionary' | 'lists' | 'planner';

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
