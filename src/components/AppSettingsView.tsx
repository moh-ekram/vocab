import React, { useState } from 'react';
import { AppSettings, WordStatus } from '../types';
import { 
  Settings, 
  Layers, 
  Sliders, 
  RotateCcw, 
  Volume2, 
  HelpCircle, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  Info,
  Keyboard,
  CheckCircle,
  XCircle,
  Circle,
  ListOrdered,
  BookOpen,
  Shuffle,
  MoveHorizontal,
  MoveVertical,
  ArrowLeftRight,
  Eye,
  ZoomIn,
  Languages,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  RectangleHorizontal,
  Hash,
  Type
} from 'lucide-react';

interface AppSettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClearAllProgress: () => void;
  userEmail?: string | null;
  syncStatus: string;
  onForceSync?: () => void;
}

export default function AppSettingsView({
  settings,
  onUpdateSettings,
  onClearAllProgress,
  userEmail,
  syncStatus,
  onForceSync
}: AppSettingsViewProps) {

  const [activeTab, setActiveTab] = useState<'flashcards' | 'quiz' | 'synonyms' | 'shortcuts' | 'account'>('flashcards');

  const handleToggleTag = (tag: WordStatus) => {
    let newTags = [...settings.defaultFlashcardTags];
    if (newTags.includes(tag)) {
      newTags = newTags.filter(t => t !== tag);
    } else {
      newTags.push(tag);
    }
    if (newTags.length === 0) return;
    
    onUpdateSettings({
      ...settings,
      defaultFlashcardTags: newTags
    });
  };

  const handleOrderChange = (order: 'serial' | 'alphabetical' | 'random') => {
    onUpdateSettings({
      ...settings,
      defaultFlashcardOrder: order
    });
  };

  const handleQuizLengthChange = (length: number) => {
    onUpdateSettings({
      ...settings,
      quizLength: length
    });
  };

  const handleToggleAudio = () => {
    onUpdateSettings({
      ...settings,
      autoPlayAudio: !settings.autoPlayAudio
    });
  };

  const handleToggleColorizeMainWord = () => {
    onUpdateSettings({
      ...settings,
      colorizeMainWord: settings.colorizeMainWord !== false ? false : true
    });
  };

  const handleToggleSynonymTag = (tag: 'know' | 'dont_know' | 'unrated') => {
    let newTags = [...(settings.defaultSynonymTags || ['dont_know', 'unrated'])];
    if (newTags.includes(tag)) {
      newTags = newTags.filter(t => t !== tag);
    } else {
      newTags.push(tag);
    }
    if (newTags.length === 0) return;

    onUpdateSettings({
      ...settings,
      defaultSynonymTags: newTags
    });
  };

  const handleSynonymOrderChange = (order: 'serial' | 'alphabetical' | 'random') => {
    onUpdateSettings({
      ...settings,
      defaultSynonymOrder: order
    });
  };

  const handleQuizTypeChange = (type: 'mcq_en_bn' | 'mcq_bn_en' | 'typing_spelling') => {
    onUpdateSettings({
      ...settings,
      defaultQuizType: type
    });
  };

  const handleMatchSizeChange = (size: number) => {
    onUpdateSettings({
      ...settings,
      defaultMatchSize: size
    });
  };

  const handleAnimationChange = (anim: 'flip-h' | 'flip-v' | 'slide' | 'fade' | 'zoom' | 'shuffle') => {
    onUpdateSettings({
      ...settings,
      flashcardAnimation: anim
    });
  };

  const triggerResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      onUpdateSettings({
        defaultFlashcardTags: ['know', 'confusion', 'dont_know', 'unrated'],
        defaultFlashcardOrder: 'random',
        autoPlayAudio: false,
        quizLength: 10,
        defaultSynonymOrder: 'random',
        defaultSynonymTags: ['know', 'dont_know', 'unrated'],
        defaultQuizType: 'mcq_en_bn',
        defaultMatchSize: 8,
        shortcuts: {
          'Space': 'flip',
          'ArrowRight': 'know',
          'ArrowLeft': 'dont_know',
          'ArrowUp': 'confusion',
          'ArrowDown': 'skip',
          'Enter': 'audio'
        },
        flashcardAnimation: 'flip-h',
        colorizeMainWord: true
      });
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-4xl mx-auto font-sans text-slate-800" id="app-settings-page">
      {/* Top title and resetting button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Manage your account settings and preferences.</p>
        </div>
        <button
          onClick={triggerResetSettings}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-white hover:bg-slate-800 hover:border-slate-800 border border-slate-200 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm bg-white self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {/* Navigation tabs styled elegantly & minimally */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-6 pb-px">
        {[
          { key: 'flashcards' as const, label: 'Flashcards', icon: Layers },
          { key: 'quiz' as const, label: 'Quizzes', icon: Sliders },
          { key: 'synonyms' as const, label: 'Synonyms', icon: Sparkles },
          { key: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
          { key: 'account' as const, label: 'Account & Storage', icon: Settings }
        ].map(tab => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
                isActive
                  ? 'border-slate-800 text-slate-900 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="mt-4 transition-all duration-200">
        
        {/* Flashcards Settings Tab */}
        {activeTab === 'flashcards' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
              
              {/* Default Tag Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 tracking-wider uppercase">Flashcard Default Tags</label>
                  <span className="text-[10px] text-slate-400 font-bold">Select at least one</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { key: 'know' as WordStatus, icon: CheckCircle2, label: 'Known', color: 'text-emerald-500', activeBg: 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/25 text-emerald-950' },
                    { key: 'confusion' as WordStatus, icon: HelpCircle, label: 'Confused', color: 'text-amber-500', activeBg: 'bg-slate-50 border-amber-500 ring-1 ring-amber-500/25 text-amber-950' },
                    { key: 'dont_know' as WordStatus, icon: XCircle, label: 'Unknown', color: 'text-rose-500', activeBg: 'bg-slate-50 border-rose-500 ring-1 ring-rose-500/25 text-rose-950' },
                    { key: 'unrated' as WordStatus, icon: Circle, label: 'Unstudied', color: 'text-slate-400', activeBg: 'bg-slate-50 border-slate-500 ring-1 ring-slate-500/25 text-slate-950' }
                  ].map(st => {
                    const isSelected = settings.defaultFlashcardTags.includes(st.key);
                    const Icon = st.icon;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleToggleTag(st.key)}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 cursor-pointer group ${
                          isSelected 
                            ? `${st.activeBg} font-semibold shadow-2xs` 
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1 transition-transform duration-150 group-hover:scale-105 ${isSelected ? st.color : 'text-slate-400'}`} />
                        <span className={`text-[10px] tracking-tight ${isSelected ? 'font-bold' : 'font-medium'}`}>
                          {st.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Study Order */}
              <div className="space-y-3 pt-5 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Default Study Order</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { key: 'serial' as const, icon: ListOrdered, label: 'Sequential' },
                    { key: 'alphabetical' as const, icon: BookOpen, label: 'Alphabetical' },
                    { key: 'random' as const, icon: Shuffle, label: 'Random' }
                  ].map(item => {
                    const isSelected = settings.defaultFlashcardOrder === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleOrderChange(item.key)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 cursor-pointer group ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-semibold'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1 transition-transform duration-150 group-hover:scale-105 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[10px] tracking-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Flip Animation */}
              <div className="space-y-3 pt-5 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Card Flip Animation</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { key: 'flip-h' as const, icon: MoveHorizontal, label: 'Flip (H)' },
                    { key: 'flip-v' as const, icon: MoveVertical, label: 'Flip (V)' },
                    { key: 'slide' as const, icon: ArrowLeftRight, label: 'Slide' },
                    { key: 'fade' as const, icon: Eye, label: 'Fade' },
                    { key: 'zoom' as const, icon: ZoomIn, label: 'Zoom' },
                    { key: 'shuffle' as const, icon: Shuffle, label: 'Shuffle' }
                  ].map(item => {
                    const currentAnim = settings.flashcardAnimation || 'flip-h';
                    const isSelected = currentAnim === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleAnimationChange(item.key)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-150 cursor-pointer group ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-semibold'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Icon className={`w-4.5 h-4.5 mb-1 transition-transform duration-150 group-hover:scale-105 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[9px] tracking-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colorize Main Words Option */}
              <div className="pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
                <label className="text-xs font-bold text-slate-800 tracking-wider uppercase cursor-pointer" onClick={handleToggleColorizeMainWord}>
                  Colorize Main Words
                </label>
                <button
                  type="button"
                  onClick={handleToggleColorizeMainWord}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.colorizeMainWord !== false ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      settings.colorizeMainWord !== false ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Quizzes Settings Tab */}
        {activeTab === 'quiz' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
              
              {/* Default Quiz Length */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Default Quiz Length</label>
                <div className="flex flex-wrap gap-2.5">
                  {[5, 10, 15, 20, 25, 30].map(val => {
                    const isSelected = settings.quizLength === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuizLengthChange(val)}
                        className={`w-9 h-9 rounded-lg font-bold text-xs transition-all duration-150 cursor-pointer flex items-center justify-center border ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-sm scale-102'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Quiz Type */}
              <div className="space-y-3 pt-5 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Default Quiz Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { key: 'mcq_en_bn' as const, icon: Languages, label: 'English to Bengali MCQ' },
                    { key: 'mcq_bn_en' as const, icon: BookOpen, label: 'Bengali to English MCQ' },
                    { key: 'typing_spelling' as const, icon: Keyboard, label: 'Spelling & Written' }
                  ].map(item => {
                    const currentQuizType = settings.defaultQuizType || 'mcq_en_bn';
                    const isSelected = currentQuizType === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleQuizTypeChange(item.key)}
                        className={`flex flex-col sm:flex-row items-center gap-2 p-3 rounded-xl border transition-all duration-150 cursor-pointer text-left group ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[10px] tracking-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Match Size */}
              <div className="space-y-3 pt-5 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Default Match Size</label>
                <div className="flex flex-wrap gap-2.5">
                  {[4, 6, 8, 10, 12].map(val => {
                    const currentMatchSize = settings.defaultMatchSize || 8;
                    const isSelected = currentMatchSize === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleMatchSizeChange(val)}
                        className={`w-9 h-9 rounded-lg font-bold text-xs transition-all duration-150 cursor-pointer flex items-center justify-center border ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-sm scale-102'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto Play Speech Pronunciation */}
              <div className="pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
                <label className="text-xs font-bold text-slate-800 tracking-wider uppercase cursor-pointer" onClick={handleToggleAudio}>
                  Auto Play Pronunciation
                </label>
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.autoPlayAudio ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      settings.autoPlayAudio ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Synonyms Settings Tab */}
        {activeTab === 'synonyms' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
              
              {/* Synonym Default Tags */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 tracking-wider uppercase">Synonym Default Tags</label>
                  <span className="text-[10px] text-slate-400 font-bold">Select at least one</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { key: 'know' as const, icon: CheckCircle, label: 'Known', color: 'text-emerald-500', activeBg: 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/25 text-emerald-950' },
                    { key: 'dont_know' as const, icon: XCircle, label: 'Unknown', color: 'text-rose-500', activeBg: 'bg-slate-50 border-rose-500 ring-1 ring-rose-500/25 text-rose-950' },
                    { key: 'unrated' as const, icon: Circle, label: 'Unstudied', color: 'text-slate-400', activeBg: 'bg-slate-50 border-slate-500 ring-1 ring-slate-500/25 text-slate-950' }
                  ].map(st => {
                    const defaultTags = settings.defaultSynonymTags || ['dont_know', 'unrated'];
                    const isSelected = defaultTags.includes(st.key);
                    const Icon = st.icon;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleToggleSynonymTag(st.key)}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 cursor-pointer group ${
                          isSelected 
                            ? `${st.activeBg} font-semibold shadow-2xs` 
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1 transition-transform duration-150 group-hover:scale-105 ${isSelected ? st.color : 'text-slate-400'}`} />
                        <span className={`text-[10px] tracking-tight ${isSelected ? 'font-bold' : 'font-medium'}`}>
                          {st.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Synonym Order */}
              <div className="space-y-3 pt-5 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Default Synonym Order</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { key: 'serial' as const, icon: ListOrdered, label: 'Sequential' },
                    { key: 'alphabetical' as const, icon: BookOpen, label: 'Alphabetical' },
                    { key: 'random' as const, icon: Shuffle, label: 'Random' }
                  ].map(item => {
                    const defaultOrder = settings.defaultSynonymOrder || 'random';
                    const isSelected = defaultOrder === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSynonymOrderChange(item.key)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 cursor-pointer group ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-semibold'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1 transition-transform duration-150 group-hover:scale-105 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[10px] tracking-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Shortcuts Settings Tab */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <label className="text-xs font-bold text-slate-800 tracking-wider uppercase">Keyboard Shortcuts</label>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({
                      ...settings,
                      shortcuts: {
                        'Space': 'flip',
                        'ArrowRight': 'know',
                        'ArrowLeft': 'dont_know',
                        'ArrowUp': 'confusion',
                        'ArrowDown': 'skip',
                        'Enter': 'audio'
                      }
                    });
                  }}
                  className="text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-bold transition-all duration-150 cursor-pointer"
                >
                  Reset Shortcuts
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {[
                  { id: 'Space', label: 'Spacebar', icon: RectangleHorizontal },
                  { id: 'Enter', label: 'Enter Key', icon: CornerDownLeft },
                  { id: 'ArrowRight', label: 'Right Arrow (→)', icon: ArrowRight },
                  { id: 'ArrowLeft', label: 'Left Arrow (←)', icon: ArrowLeft },
                  { id: 'ArrowUp', label: 'Up Arrow (↑)', icon: ArrowUp },
                  { id: 'ArrowDown', label: 'Down Arrow (↓)', icon: ArrowDown },
                  { id: 'Digit1', label: 'Number 1', icon: Hash },
                  { id: 'Digit2', label: 'Number 2', icon: Hash },
                  { id: 'Digit3', label: 'Number 3', icon: Hash },
                  { id: 'Digit4', label: 'Number 4', icon: Hash },
                  { id: 'Digit5', label: 'Number 5', icon: Hash },
                  { id: 'Digit6', label: 'Number 6', icon: Hash },
                  { id: 'KeyA', label: 'Letter A', icon: Type },
                  { id: 'KeyS', label: 'Letter S', icon: Type },
                  { id: 'KeyD', label: 'Letter D', icon: Type },
                  { id: 'KeyF', label: 'Letter F', icon: Type },
                  { id: 'KeyG', label: 'Letter G', icon: Type },
                ].map(keyObj => {
                  const currentShortcuts = settings.shortcuts || {
                    'Space': 'flip',
                    'ArrowRight': 'know',
                    'ArrowLeft': 'dont_know',
                    'ArrowUp': 'confusion',
                    'ArrowDown': 'skip',
                    'Enter': 'audio'
                  };
                  const assignedAction = currentShortcuts[keyObj.id] || 'none';
   
                  const actionIconsMap: Record<string, { icon: any; color: string; bg: string; label: string }> = {
                    none: { icon: Circle, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-150', label: 'Disabled' },
                    know: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100', label: 'Learned' },
                    dont_know: { icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100', label: 'Unlearned' },
                    confusion: { icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100', label: 'Confused' },
                    skip: { icon: ChevronRight, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100', label: 'Next' },
                    prev: { icon: ChevronLeft, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100', label: 'Prev' },
                    flip: { icon: RotateCcw, color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-100', label: 'Flip' },
                    google: { icon: Search, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100', label: 'Google' },
                    audio: { icon: Volume2, color: 'text-teal-500', bg: 'bg-teal-50 border-teal-100', label: 'Speak' },
                  };
   
                  const actionDetail = actionIconsMap[assignedAction] || actionIconsMap.none;
                  const ActionIcon = actionDetail.icon;
                  const KeyIcon = keyObj.icon;
   
                  return (
                    <div key={keyObj.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-150 transition-all duration-150">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-400 shadow-2xs flex-shrink-0">
                          <KeyIcon className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 truncate">{keyObj.label}</span>
                      </div>
   
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`w-5.5 h-5.5 rounded-md flex items-center justify-center border ${actionDetail.bg}`} title={actionDetail.label}>
                          <ActionIcon className={`w-2.5 h-2.5 ${actionDetail.color}`} />
                        </div>
                        <div className="relative">
                          <select
                            value={assignedAction}
                            onChange={(e) => {
                              onUpdateSettings({
                                ...settings,
                                shortcuts: {
                                  ...currentShortcuts,
                                  [keyObj.id]: e.target.value
                                }
                              });
                            }}
                            className="w-24 sm:w-28 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-semibold rounded-lg pl-1.5 pr-4 py-1 focus:outline-none focus:ring-1 focus:ring-slate-800 text-slate-700 cursor-pointer appearance-none transition-all duration-150"
                          >
                            <option value="none">Disabled</option>
                            <option value="know">Learned</option>
                            <option value="dont_know">Unlearned</option>
                            <option value="confusion">Confused</option>
                            <option value="skip">Next Card</option>
                            <option value="prev">Prev Card</option>
                            <option value="flip">Flip Card</option>
                            <option value="google">Google Search</option>
                            <option value="audio">Speak Audio</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-slate-400">
                            <ChevronRight className="w-2 h-2 rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Account & Storage Settings Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            
            {/* Cloud Sync Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <label className="block text-xs font-bold text-slate-800 tracking-wider uppercase">Cloud Sync Status</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Logged in as:</p>
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {userEmail ? userEmail : 'Not logged in (Local only)'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sync status:</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {syncStatus === 'synced' ? 'Synced' : 
                     syncStatus === 'syncing' ? 'Syncing...' : 'Local Memory'}
                  </span>
                </div>
              </div>

              {userEmail && onForceSync && (
                <button
                  onClick={onForceSync}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Backup Now
                </button>
              )}
            </div>

            {/* Danger Zone */}
            <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-rose-800">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h2 className="text-xs font-bold tracking-wider uppercase">Danger Zone</h2>
              </div>
              
              <p className="text-xs text-rose-600/90 leading-relaxed font-semibold">
                Click here to permanently delete all your study progress, streaks, and custom lists. This action cannot be undone.
              </p>

              <button
                onClick={onClearAllProgress}
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-rose-500/10 hover:shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All Progress</span>
              </button>
            </div>

            {/* How it works */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-slate-750">
                <Info className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold tracking-wider uppercase">How it works</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Your preferences are saved locally and synced with your cloud account automatically.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
