import { FlashcardCustomStyle } from '../types';

export interface FlashcardPreset {
  id: 'preset-1' | 'preset-2' | 'preset-3' | 'preset-4' | 'preset-5';
  title: string;
  description: string;
  style: FlashcardCustomStyle;
}

export const FLASHCARD_PRESETS: FlashcardPreset[] = [
  {
    id: 'preset-1',
    title: 'Modern Minimalist (Dark)',
    description: 'Pitch-black canvas with crisp white typography and soft dark shadows.',
    style: {
      presetId: 'preset-1',
      wordFontSize: 'xl',
      wordColor: '#ffffff',
      wordPosition: 'center',
      wordVerticalPos: 'center',
      meaningFontSize: 'lg',
      meaningColor: '#34d399',
      cardBgColor: '#0f172a',
      cardTextColor: '#f8fafc',
      borderRadius: '16px',
      borderStyle: 'subtle',
      shadowStyle: 'diffused',
    },
  },
  {
    id: 'preset-2',
    title: 'Clean Studio (Light)',
    description: 'Pure bright studio layout with high contrast charcoal text.',
    style: {
      presetId: 'preset-2',
      wordFontSize: 'xl',
      wordColor: '#0f172a',
      wordPosition: 'center',
      wordVerticalPos: 'center',
      meaningFontSize: 'lg',
      meaningColor: '#059669',
      cardBgColor: '#ffffff',
      cardTextColor: '#0f172a',
      borderRadius: '16px',
      borderStyle: 'subtle',
      shadowStyle: 'soft',
    },
  },
  {
    id: 'preset-3',
    title: 'Midnight Neon',
    description: 'Vibrant cyan & purple neon theme on deep obsidian background.',
    style: {
      presetId: 'preset-3',
      wordFontSize: '2xl',
      wordColor: '#38bdf8',
      wordPosition: 'center',
      wordVerticalPos: 'center',
      meaningFontSize: 'xl',
      meaningColor: '#c084fc',
      cardBgColor: '#090d16',
      cardTextColor: '#f1f5f9',
      borderRadius: '24px',
      borderStyle: 'neon',
      shadowStyle: 'glow',
    },
  },
  {
    id: 'preset-4',
    title: 'Pastel Breeze',
    description: 'Soft lavender tinted card with indigo word contrast.',
    style: {
      presetId: 'preset-4',
      wordFontSize: 'lg',
      wordColor: '#312e81',
      wordPosition: 'center',
      wordVerticalPos: 'center',
      meaningFontSize: 'md',
      meaningColor: '#4f46e5',
      cardBgColor: '#f5f3ff',
      cardTextColor: '#1e1b4b',
      borderRadius: '20px',
      borderStyle: 'accent',
      shadowStyle: 'soft',
    },
  },
  {
    id: 'preset-5',
    title: 'Executive Gold',
    description: 'Dark luxury navy canvas with warm gold/amber text.',
    style: {
      presetId: 'preset-5',
      wordFontSize: 'xl',
      wordColor: '#fbbf24',
      wordPosition: 'center',
      wordVerticalPos: 'center',
      meaningFontSize: 'lg',
      meaningColor: '#f3f4f6',
      cardBgColor: '#111827',
      cardTextColor: '#f9fafb',
      borderRadius: '12px',
      borderStyle: 'bold',
      shadowStyle: 'deep',
    },
  },
];

export const DEFAULT_FLASHCARD_STYLE: FlashcardCustomStyle = FLASHCARD_PRESETS[0].style;

export function getWordSizeClass(size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'): string {
  switch (size) {
    case 'sm':
      return 'text-xl sm:text-2xl';
    case 'md':
      return 'text-2xl sm:text-3xl';
    case 'lg':
      return 'text-3xl sm:text-4xl';
    case 'xl':
      return 'text-4xl sm:text-5xl';
    case '2xl':
      return 'text-5xl sm:text-6xl';
    case '3xl':
      return 'text-6xl sm:text-7xl';
    default:
      return 'text-4xl sm:text-5xl';
  }
}

export function getWordPosClass(pos?: 'left' | 'center' | 'right'): string {
  switch (pos) {
    case 'left':
      return 'text-left items-start';
    case 'right':
      return 'text-right items-end';
    case 'center':
    default:
      return 'text-center items-center';
  }
}

export function getWordVerticalPosClass(vPos?: 'top' | 'center' | 'bottom'): string {
  switch (vPos) {
    case 'top':
      return 'justify-start pt-6';
    case 'bottom':
      return 'justify-end pb-6';
    case 'center':
    default:
      return 'justify-center my-auto';
  }
}

export function getMeaningSizeClass(size?: 'sm' | 'md' | 'lg' | 'xl'): string {
  switch (size) {
    case 'sm':
      return 'text-lg sm:text-xl';
    case 'md':
      return 'text-xl sm:text-2xl';
    case 'lg':
      return 'text-2xl sm:text-4xl';
    case 'xl':
      return 'text-3xl sm:text-5xl';
    default:
      return 'text-2xl sm:text-4xl';
  }
}

export function getBorderStyleClass(borderStyle?: 'none' | 'subtle' | 'bold' | 'accent' | 'neon'): string {
  switch (borderStyle) {
    case 'none':
      return 'border-0';
    case 'subtle':
      return 'border border-slate-200/20 dark:border-white/10';
    case 'bold':
      return 'border-2 border-indigo-500/40';
    case 'accent':
      return 'border-2 border-emerald-500/50';
    case 'neon':
      return 'border-2 border-sky-400/60';
    default:
      return 'border border-slate-200/20 dark:border-white/10';
  }
}

export function getShadowStyleClass(shadowStyle?: 'none' | 'soft' | 'diffused' | 'glow' | 'deep'): string {
  switch (shadowStyle) {
    case 'none':
      return 'shadow-none';
    case 'soft':
      return 'shadow-lg shadow-black/10';
    case 'diffused':
      return 'shadow-[0_20px_50px_rgba(0,0,0,0.35)]';
    case 'glow':
      return 'shadow-[0_0_35px_rgba(56,189,248,0.25)]';
    case 'deep':
      return 'shadow-2xl shadow-black/60';
    default:
      return 'shadow-[0_20px_50px_rgba(0,0,0,0.35)]';
  }
}
