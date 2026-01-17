
import { Material, MaterialType } from './types';

export const INITIAL_MATERIALS: Material[] = [
  {
    id: '1',
    original: '저는 ~을/를 좋아해요',
    translation: '我喜欢~',
    keywords: ['좋아하다', '취향'],
    topic: 'Personal Info',
    type: MaterialType.SENTENCE_TEMPLATE,
    mastery: 0,
    lastReviewed: Date.now()
  },
  {
    id: '2',
    original: '커피 한 잔',
    translation: '一杯咖啡',
    topic: 'Daily Life',
    type: MaterialType.WORD_CHUNK,
    mastery: 0,
    lastReviewed: Date.now()
  }
];

export const INITIAL_TOPICS = ['General', 'Daily Life', 'Hobbies', 'Work', 'Travel', 'Interview'];
