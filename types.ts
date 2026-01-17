
export enum MaterialType {
  SENTENCE_TEMPLATE = 'SENTENCE_TEMPLATE',
  WORD_CHUNK = 'WORD_CHUNK'
}

export interface RawSentence {
  id: string;
  text: string;
  source: string; // Original input source/timestamp
  isProcessed: boolean;
  practiceCount: number; // Added to track usage
}

export interface Example {
  kr: string;
  cn: string;
  mastery: number; // 0-100
  lastReviewed: number;
}

export interface SentenceTemplate {
  id: string;
  pattern: string;
  topic: string;
  examples: Example[];
  sourceId?: string; // Link back to raw material
}

export interface WordChunk {
  id: string;
  root: string;
  translation: string;
  topic: string;
  variations: { kr: string; cn?: string; mastery: number; lastReviewed: number }[];
  sourceId?: string; // Link back to raw material
}

export interface Material {
  id: string;
  original: string;
  translation: string;
  keywords?: string[];
  topic: string;
  type: MaterialType;
  mastery: number;
  lastReviewed: number;
  sourceId?: string;
}

export interface ReviewConfig {
  topic: string;
  sentenceCount: number;
  chunkCount: number;
}

export interface ShadowingLine {
  korean: string;
  chinese: string;
}

export enum AppMode {
  HOME = 'HOME',
  LEARN_SENTENCE = 'LEARN_SENTENCE',
  LEARN_CHUNK = 'LEARN_CHUNK',
  REVIEW_SHADOWING = 'REVIEW_SHADOWING',
  LIBRARY = 'LIBRARY'
}
