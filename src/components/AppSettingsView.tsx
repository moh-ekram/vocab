import React from 'react';
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

  const handleToggleTag = (tag: WordStatus) => {
    let newTags = [...settings.defaultFlashcardTags];
    if (newTags.includes(tag)) {
      newTags = newTags.filter(t => t !== tag);
    } else {
      newTags.push(tag);
    }
    // Don't allow empty defaults, keep at least one
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
    if (confirm('আপনি কি সেটিংস ডিফল্ট মানে ফিরিয়ে নিতে চান?')) {
      onUpdateSettings({
        defaultFlashcardTags: ['dont_know'],
        defaultFlashcardOrder: 'random',
        autoPlayAudio: false,
        quizLength: 10,
        defaultSynonymOrder: 'random',
        defaultSynonymTags: ['dont_know', 'unrated'],
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
        flashcardAnimation: 'flip-h'
      });
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-4xl mx-auto" id="app-settings-page">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-sans">অ্যাপ সেটিংস ও কনফিগারেশন</h1>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-1 font-sans">
            আপনার ফ্ল্যাশ কার্ড, কুইজ এবং স্পিচ প্লেব্যাকের ডিফল্ট অপশন সেট করুন
          </p>
        </div>

        <button
          onClick={triggerResetSettings}
          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-white hover:bg-emerald-500 hover:border-emerald-600 border border-slate-200 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 font-sans self-start md:self-auto shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>সেটিংস ডিফল্ট করুন</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 columns: Config Cards */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Section 1: Flashcard settings */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Layers className="w-4.5 h-4.5 text-emerald-500" />
              <h2 className="text-sm font-extrabold text-slate-800 font-sans">ফ্ল্যাশ কার্ড ডিফল্ট অপশনসমূহ</h2>
            </div>

            {/* Default Tag Filter */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 font-sans">ডিফল্ট ট্যাগ ফিল্টার (Default Tags)</label>
                <span className="text-[10px] text-slate-400 font-sans">কমপক্ষে ১টি সিলেক্ট করুন</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                ফ্ল্যাশ কার্ড স্ক্রিনটি প্রথম লোড হলে কোন ট্যাগ বিশিষ্ট শব্দগুলো স্বয়ংক্রিয়ভাবে ফিল্টার হয়ে থাকবে তা নির্বাচন করুন।
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { key: 'know' as WordStatus, icon: CheckCircle2, label: 'পারি', color: 'text-emerald-500', activeBg: 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20' },
                  { key: 'confusion' as WordStatus, icon: HelpCircle, label: 'কনফিউশন', color: 'text-amber-500', activeBg: 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20' },
                  { key: 'dont_know' as WordStatus, icon: XCircle, label: 'পারি না', color: 'text-rose-500', activeBg: 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20' },
                  { key: 'unrated' as WordStatus, icon: Circle, label: 'পড়া হয়নি', color: 'text-slate-400', activeBg: 'bg-slate-50 border-slate-400 text-slate-800 ring-2 ring-slate-400/20' }
                ].map(st => {
                  const isSelected = settings.defaultFlashcardTags.includes(st.key);
                  const Icon = st.icon;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleToggleTag(st.key)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        isSelected 
                          ? `${st.activeBg} shadow-md scale-102` 
                          : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-500'
                      }`}
                      title={st.label}
                    >
                      <Icon className={`w-6 h-6 mb-1.5 transition-transform duration-300 group-hover:scale-110 ${isSelected ? st.color : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-bold font-sans tracking-tight ${isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-500'}`}>
                        {st.label}
                      </span>
                      {isSelected && (
                        <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${st.key === 'know' ? 'bg-emerald-500' : st.key === 'confusion' ? 'bg-amber-500' : st.key === 'dont_know' ? 'bg-rose-500' : 'bg-slate-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Study Order */}
            <div className="space-y-2.5 pt-3 border-t border-slate-50">
              <label className="block text-xs font-bold text-slate-700 font-sans">ডিফল্ট স্টাডি অর্ডার (Default Order)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                ফ্ল্যাশ কার্ড রিভিউ করার সময় শব্দগুলোর ডিফল্ট সাজানোর ধরন কেমন হবে।
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: 'serial' as const, icon: ListOrdered, label: 'সিরিয়াল', desc: 'গ্রুপ অনুযায়ী সাজানো' },
                  { key: 'alphabetical' as const, icon: BookOpen, label: 'A-Z', desc: 'ইংরেজি বর্ণানুক্রমিক' },
                  { key: 'random' as const, icon: Shuffle, label: 'র্যান্ডম', desc: 'এলোমেলো বা শাফেল' }
                ].map(item => {
                  const isSelected = settings.defaultFlashcardOrder === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleOrderChange(item.key)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/15 scale-102'
                          : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-600'
                      }`}
                      title={item.desc}
                    >
                      <Icon className={`w-6 h-6 mb-1.5 transition-transform duration-300 group-hover:scale-110 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-bold font-sans tracking-tight ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Flashcard Rotation Animation */}
            <div className="space-y-2.5 pt-3 border-t border-slate-50">
              <label className="block text-xs font-bold text-slate-700 font-sans">ফ্ল্যাশকার্ড রোটেশন অ্যানিমেশন (Card Flip Animation)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                ফ্ল্যাশকার্ডের পিঠ পরিবর্তন বা ঘোরার জন্য আপনার পছন্দের ট্রানজিশন অ্যানিমেশন সিলেক্ট করুন।
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 font-sans">
                {[
                  { key: 'flip-h' as const, icon: MoveHorizontal, label: 'Flip (H)', desc: '3D ফ্লিপ ডান-বাম ঘূর্ণন' },
                  { key: 'flip-v' as const, icon: MoveVertical, label: 'Flip (V)', desc: '3D ফ্লিপ উপর-নিচ ঘূর্ণন' },
                  { key: 'slide' as const, icon: ArrowLeftRight, label: 'Slide', desc: 'মসৃণ স্লাইড' },
                  { key: 'fade' as const, icon: Eye, label: 'Fade', desc: 'ধীরে প্রকাশ' },
                  { key: 'zoom' as const, icon: ZoomIn, label: 'Zoom', desc: 'ছোট-বড় হওয়া' },
                  { key: 'shuffle' as const, icon: Shuffle, label: 'Shuffle', desc: 'এলোমেলো ট্রানজিশন' }
                ].map(item => {
                  const currentAnim = settings.flashcardAnimation || 'flip-h';
                  const isSelected = currentAnim === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleAnimationChange(item.key)}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/15 scale-102'
                          : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-500'
                      }`}
                      title={item.desc}
                    >
                      <Icon className={`w-5.5 h-5.5 mb-1 transition-transform duration-300 group-hover:scale-110 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className={`text-[9px] font-bold font-sans tracking-tight ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Quiz & Pronunciation */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Sliders className="w-4.5 h-4.5 text-emerald-500" />
              <h2 className="text-sm font-extrabold text-slate-800 font-sans">কুইজ ও এক্সট্রা অপশনসমূহ</h2>
            </div>

            {/* Default Quiz Questions Limit */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 font-sans">ডিফল্ট কুইজ প্রশ্ন সংখ্যা (Default Quiz Length)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                অনুশীলন কুইজ শুরু করার সময় ডিফল্ট প্রশ্ন সংখ্যা কত থাকবে।
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                {[5, 10, 15, 20, 25, 30].map(val => {
                  const isSelected = settings.quizLength === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuizLengthChange(val)}
                      className={`w-10 h-10 rounded-full font-black text-xs font-mono transition-all duration-300 cursor-pointer flex items-center justify-center border ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-md scale-105'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Quiz Type */}
            <div className="space-y-2.5 pt-3 border-t border-slate-50">
              <label className="block text-xs font-bold text-slate-700 font-sans">ডিফল্ট কুইজ টাইপ (Default Quiz Type)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                অনুশীলন কুইজে কোন ধরণের প্রশ্ন ডিফল্ট হিসেবে দেখতে চান।
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: 'mcq_en_bn' as const, icon: Languages, label: 'En ➔ Bn MCQ', desc: 'ইংরেজি দেখে বাংলা অর্থ' },
                  { key: 'mcq_bn_en' as const, icon: BookOpen, label: 'Bn ➔ En MCQ', desc: 'বাংলা দেখে ইংরেজি শব্দ' },
                  { key: 'typing_spelling' as const, icon: Keyboard, label: 'লিখিত টাইপিং', desc: 'লিখিত ও স্পেলিং টেস্ট' }
                ].map(item => {
                  const currentQuizType = settings.defaultQuizType || 'mcq_en_bn';
                  const isSelected = currentQuizType === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleQuizTypeChange(item.key)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/15 scale-102'
                          : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-650'
                      }`}
                      title={item.desc}
                    >
                      <Icon className={`w-6 h-6 mb-1.5 transition-transform duration-300 group-hover:scale-110 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-bold font-sans tracking-tight text-center ${isSelected ? 'text-white' : 'text-slate-600'}`} id={`quiz-type-btn-${item.key}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Match Size */}
            <div className="space-y-2.5 pt-3 border-t border-slate-50">
              <label className="block text-xs font-bold text-slate-700 font-sans">শব্দমিল খেলার জোড়া সংখ্যা (Default Match Size)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                ম্যাচ গেমে কতটি শব্দের জোড়া একসঙ্গে মিলিয়ে খেলার চ্যালেঞ্জ নিতে চান।
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                {[4, 6, 8, 10, 12].map(val => {
                  const currentMatchSize = settings.defaultMatchSize || 8;
                  const isSelected = currentMatchSize === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleMatchSizeChange(val)}
                      className={`w-10 h-10 rounded-full font-black text-xs font-mono transition-all duration-300 cursor-pointer flex items-center justify-center border ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-md scale-105'
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
            <div className="space-y-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 font-sans">অটো স্পিচ উচ্চারণ (Auto Play Pronunciation)</label>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  ফ্ল্যাশ কার্ড উল্টিয়ে দেখলে বা লোড হলে স্বয়ংক্রিয় ইংরেজি উচ্চারণ প্লে করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleAudio}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoPlayAudio ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoPlayAudio ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 3: Synonym check settings */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Sparkles className="w-4.5 h-4.5 text-emerald-500" />
              <h2 className="text-sm font-extrabold text-slate-800 font-sans">সিনোনিম চেক ডিফল্ট অপশনসমূহ</h2>
            </div>

            {/* Default Synonym Statuses Filter */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 font-sans">ডিফল্ট ট্যাগ ফিল্টার (Default Synonym Tags)</label>
                <span className="text-[10px] text-slate-400 font-sans">কমপক্ষে ১টি সিলেক্ট করুন</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                সিনোনিম স্ক্রিন প্রথম লোড হলে কোন ট্যাগ বিশিষ্ট শব্দগুলো স্বয়ংক্রিয়ভাবে ফিল্টার হয়ে থাকবে তা নির্বাচন করুন।
              </p>
              
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: 'know' as const, icon: CheckCircle, label: 'পারি', color: 'text-emerald-500', activeBg: 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20' },
                  { key: 'dont_know' as const, icon: XCircle, label: 'পারি না', color: 'text-rose-500', activeBg: 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20' },
                  { key: 'unrated' as const, icon: Circle, label: 'পড়া হয়নি', color: 'text-slate-400', activeBg: 'bg-slate-50 border-slate-400 text-slate-850 ring-2 ring-slate-400/20' }
                ].map(st => {
                  const defaultTags = settings.defaultSynonymTags || ['dont_know', 'unrated'];
                  const isSelected = defaultTags.includes(st.key);
                  const Icon = st.icon;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleToggleSynonymTag(st.key)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        isSelected 
                          ? `${st.activeBg} shadow-md scale-102` 
                          : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-500'
                      }`}
                      title={st.label}
                    >
                      <Icon className={`w-6 h-6 mb-1.5 transition-transform duration-300 group-hover:scale-110 ${isSelected ? st.color : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-bold font-sans tracking-tight ${isSelected ? 'text-slate-850 font-extrabold' : 'text-slate-500'}`}>
                        {st.label}
                      </span>
                      {isSelected && (
                        <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${st.key === 'know' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Synonym Study Order */}
            <div className="space-y-2.5 pt-3 border-t border-slate-50">
              <label className="block text-xs font-bold text-slate-700 font-sans">ডিফল্ট পড়ার ক্রম (Default Synonym Order)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                সিনোনিম চেক করার সময় শব্দগুলোর ডিফল্ট সাজানোর ধরন কেমন হবে।
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { key: 'serial' as const, icon: ListOrdered, label: 'সিরিয়াল', desc: 'গ্রুপ অনুযায়ী সাজানো' },
                  { key: 'alphabetical' as const, icon: BookOpen, label: 'A-Z', desc: 'ইংরেজি বর্ণানুক্রমিক' },
                  { key: 'random' as const, icon: Shuffle, label: 'র্যান্ডম', desc: 'এলোমেলো বা শাফেল' }
                ].map(item => {
                  const defaultOrder = settings.defaultSynonymOrder || 'random';
                  const isSelected = defaultOrder === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSynonymOrderChange(item.key)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/15 scale-102'
                          : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-600'
                      }`}
                      title={item.desc}
                    >
                      <Icon className={`w-6 h-6 mb-1.5 transition-transform duration-300 group-hover:scale-110 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-bold font-sans tracking-tight ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Keyboard Shortcuts Configuration */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                <h2 className="text-sm font-extrabold text-slate-800 font-sans">কীবোর্ড শর্টকাট কাস্টমাইজেশন</h2>
              </div>
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
                className="text-[10px] text-emerald-600 hover:text-white hover:bg-emerald-500 border border-emerald-100 px-2.5 py-1 rounded-lg font-bold transition-all duration-300 cursor-pointer"
              >
                শর্টকাট রিসেট করুন
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              বিভিন্ন কীবোর্ড বাটন/কি-এর বিপরীতে আপনার পছন্দের অ্যাকশন নির্বাচন করুন। টাইপিং ইনপুট ফিল্ড ছাড়া অন্য যেকোনো অবস্থায় এই শর্টকাটগুলো কাজ করবে।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                { id: 'Space', bn: 'স্পেসবার (Space)', icon: RectangleHorizontal },
                { id: 'Enter', bn: 'এন্টার (Enter)', icon: CornerDownLeft },
                { id: 'ArrowRight', bn: 'ডানমুখী তীর (→)', icon: ArrowRight },
                { id: 'ArrowLeft', bn: 'বামমুখী তীর (←)', icon: ArrowLeft },
                { id: 'ArrowUp', bn: 'উপরমুখী তীর (↑)', icon: ArrowUp },
                { id: 'ArrowDown', bn: 'নিচমুখী তীর (↓)', icon: ArrowDown },
                { id: 'Digit1', bn: 'সংখ্যা ১', icon: Hash },
                { id: 'Digit2', bn: 'সংখ্যা ২', icon: Hash },
                { id: 'Digit3', bn: 'সংখ্যা ৩', icon: Hash },
                { id: 'Digit4', bn: 'সংখ্যা ৪', icon: Hash },
                { id: 'Digit5', bn: 'সংখ্যা ৫', icon: Hash },
                { id: 'Digit6', bn: 'সংখ্যা ৬', icon: Hash },
                { id: 'KeyA', bn: 'বর্ণ A', icon: Type },
                { id: 'KeyS', bn: 'বর্ণ S', icon: Type },
                { id: 'KeyD', bn: 'বর্ণ D', icon: Type },
                { id: 'KeyF', bn: 'বর্ণ F', icon: Type },
                { id: 'KeyG', bn: 'বর্ণ G', icon: Type },
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
 
                // Helper mapping of action to matching icon and visual details
                const actionIconsMap: Record<string, { icon: any; color: string; bg: string; label: string }> = {
                  none: { icon: Circle, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-150', label: 'নিষ্ক্রিয়' },
                  know: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100', label: 'পারি' },
                  dont_know: { icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100', label: 'পারি না' },
                  confusion: { icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100', label: 'কনফিউশন' },
                  skip: { icon: ChevronRight, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100', label: 'পরবর্তী' },
                  prev: { icon: ChevronLeft, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100', label: 'পূর্ববর্তী' },
                  flip: { icon: RotateCcw, color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-100', label: 'উল্টানো' },
                  google: { icon: Search, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100', label: 'গুগল' },
                  audio: { icon: Volume2, color: 'text-teal-500', bg: 'bg-teal-50 border-teal-100', label: 'উচ্চারণ' },
                };
 
                const actionDetail = actionIconsMap[assignedAction] || actionIconsMap.none;
                const ActionIcon = actionDetail.icon;
                const KeyIcon = keyObj.icon;
 
                return (
                  <div key={keyObj.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all duration-300">
                    {/* Left: Key Icon and Key Label */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-500 shadow-2xs flex-shrink-0">
                        <KeyIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 truncate font-sans">{keyObj.bn}</span>
                    </div>
 
                    {/* Right: Select Dropdown and small action icon */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${actionDetail.bg}`} title={actionDetail.label}>
                        <ActionIcon className={`w-3 h-3 ${actionDetail.color}`} />
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
                          className="w-28 sm:w-32 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-medium rounded-lg pl-2 pr-5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 cursor-pointer appearance-none transition-all duration-150 font-sans"
                        >
                          <option value="none">নিষ্ক্রিয়</option>
                          <option value="know">পারি (Learned)</option>
                          <option value="dont_know">পারি না (Unlearned)</option>
                          <option value="confusion">কনফিউশন (Confused)</option>
                          <option value="skip">পরবর্তী শব্দ (Next)</option>
                          <option value="prev">পূর্ববর্তী শব্দ (Prev)</option>
                          <option value="flip">কার্ড উলটানো (Flip)</option>
                          <option value="google">গুগল সার্চ (Google)</option>
                          <option value="audio">উচ্চারণ প্লে (Speak)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                          <ChevronRight className="w-2.5 h-2.5 rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 column: Account Info & Clear Storage */}
        <div className="space-y-6">
          {/* Cloud Sync Status info */}
          <div className="bg-indigo-950/95 text-white rounded-2xl p-5 space-y-4 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 opacity-10">
              <Settings className="w-32 h-32" />
            </div>
            
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200 font-sans">ক্লাউড সিঙ্ক স্ট্যাটাস</span>
            </div>

            <div className="space-y-1.5 z-10 relative">
              <p className="text-xs text-indigo-200 font-sans font-medium">লগইন অ্যাকাউন্ট:</p>
              <p className="text-xs font-black tracking-tight truncate font-sans">
                {userEmail ? userEmail : 'লগইন করা নেই (শুধুমাত্র লোকাল)'}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-indigo-800 pt-3 text-[10px]">
              <span className="text-indigo-200 font-sans">সিঙ্ক অবস্থা:</span>
              <span className="font-extrabold bg-indigo-900 px-2 py-0.5 rounded text-indigo-300 font-sans">
                {syncStatus === 'synced' ? 'সিঙ্কড (Synced)' : 
                 syncStatus === 'syncing' ? 'সিঙ্ক হচ্ছে...' : 'লোকাল মেমোরি'}
              </span>
            </div>

            {userEmail && onForceSync && (
              <button
                onClick={onForceSync}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] rounded-xl transition cursor-pointer font-sans"
              >
                ম্যানুয়ালি ব্যাকআপ করুন
              </button>
            )}
          </div>

          {/* Dangerous Zone */}
          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-800">
              <Trash2 className="w-4.5 h-4.5 text-rose-500" />
              <h2 className="text-xs font-black font-sans uppercase tracking-wider">ডেঞ্জার জোন (Danger Zone)</h2>
            </div>
            
            <p className="text-[11px] text-rose-600 font-sans leading-relaxed">
              আপনার সমস্ত পড়াশোনার অগ্রগতি, ট্যাগ করা প্রগ্রেস, গোল, দৈনিক হিস্ট্রি এবং কাস্টম ফোল্ডার চিরতরে মুছে ফেলতে চাইলে নিচের বোতামটি চাপুন।
            </p>

            <button
              onClick={onClearAllProgress}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 font-sans"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>সমস্ত প্রগ্রেস রিসেট করুন</span>
            </button>
          </div>

          {/* Help box */}
          <div className="bg-slate-100/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Info className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black font-sans">জানুন কীভাবে কাজ করে</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              এখানে সেট করা সেটিংসসমূহ লোকাল স্টোরেজে স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকে। ক্লাউড অ্যাকাউন্ট লগইন থাকলে এগুলো ক্লাউডেও সিঙ্কড থাকে, যাতে অন্য ডিভাইস থেকে একই অভিজ্ঞতা পান।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
