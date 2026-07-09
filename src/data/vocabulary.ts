import { VocabularyWord } from '../types';
import { group1_10 } from './group1_10';
import { group11_20 } from './group11_20';
import { group21_30 } from './group21_30';
import { group31_37 } from './group31_37';

export const vocabulary: VocabularyWord[] = [
  ...group1_10,
  ...group11_20,
  ...group21_30,
  ...group31_37
];

export const TOTAL_GROUPS = 37;

export function getWordsByGroup(groupNumber: number): VocabularyWord[] {
  return vocabulary.filter(w => w.group === groupNumber);
}
