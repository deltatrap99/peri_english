
export enum ProgramType {
  IELTS = 'IELTS',
  COMMUNICATION = 'COMMUNICATION',
  YLE = 'YLE',
  UNIVERSITY = 'UNIVERSITY'
}

export type Language = 'VN' | 'EN' | 'KR';
export type Theme = 'light' | 'dark' | 'system';

export interface Word {
  id: string;
  word: string;
  wordType: string; // n, v, adj, adv, etc.
  ipa: string;
  meaning: string;
  alternativeMeanings?: string[];
  usage: string;
  synonyms: string[];
  antonyms: string[];
  example: string;
  illustrationBase64?: string;
}

export interface Topic {
  id: string;
  title: string;
  count: number;
  description?: string;
}

export interface LearningSession {
  id: string;
  date: string;
  topic: string;
  wordCount: number;
  program: string;
}

export interface UserScore {
  identifier: string;
  dailyScore: number;
  weeklyScore: number;
  monthlyScore: number;
}

export interface UserProfile {
  identifier: string; // Email or Phone
  history: LearningSession[];
  completedPassages: string[]; // List of passage IDs
  lastLogin: string;
}

export type AppView = 'home' | 'programs' | 'levels' | 'topics' | 'learning' | 'review' | 'reading' | 'history' | 'leaderboard';
