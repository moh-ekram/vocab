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
  Keyboard
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
        }
      });
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-4xl mx-auto" id="app-settings-page">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-sans">অ্যাপ সেটিংস ও কনফিগারেশন</h1>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-1 font-sans">
            আপনার ফ্ল্যাশ কার্ড, কুইজ এবং স্পিচ প্লেব্যাকের ডিফল্ট অপশন সেট করুন
          </p>
        </div>

        <button
          onClick={triggerResetSettings}
          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 font-sans self-start md:self-auto"
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
              <Layers className="w-4.5 h-4.5 text-indigo-500" />
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
              
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { key: 'know' as WordStatus, label: 'পারি (সবুজ)', color: 'bg-emerald-500', border: 'border-emerald-100' },
                  { key: 'confusion' as WordStatus, label: 'কনফিউশন (হলুদ)', color: 'bg-amber-500', border: 'border-amber-100' },
                  { key: 'dont_know' as WordStatus, label: 'পারি না (লাল)', color: 'bg-rose-500', border: 'border-rose-100' },
                  { key: 'unrated' as WordStatus, label: 'পড়া হয়নি (ধূসর)', color: 'bg-slate-400', border: 'border-slate-200' }
                ].map(st => {
                  const isSelected = settings.defaultFlashcardTags.includes(st.key);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleToggleTag(st.key)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' 
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${st.color}`} />
                        <span>{st.label}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
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
                  { key: 'serial' as const, label: 'সিরিয়াল', desc: '১ থেকে ৩৭ গ্রুপ অনু্যায়ী' },
                  { key: 'alphabetical' as const, label: 'A-Z', desc: 'ইংরেজি বর্ণানুক্রমিক' },
                  { key: 'random' as const, label: 'র্যান্ডম', desc: 'এলোমেলো বা শাফেল' }
                ].map(item => {
                  const isSelected = settings.defaultFlashcardOrder === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleOrderChange(item.key)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black font-sans">{item.label}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Quiz & Pronunciation */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Sliders className="w-4.5 h-4.5 text-amber-500" />
              <h2 className="text-sm font-extrabold text-slate-800 font-sans">কুইজ ও এক্সট্রা অপশনসমূহ</h2>
            </div>

            {/* Default Quiz Questions Limit */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 font-sans">ডিফল্ট কুইজ প্রশ্ন সংখ্যা (Default Quiz Length)</label>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                অনুশীলন কুইজ শুরু করার সময় ডিফল্ট প্রশ্ন সংখ্যা কত থাকবে।
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {[5, 10, 15, 20, 25, 30].map(val => {
                  const isSelected = settings.quizLength === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuizLengthChange(val)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      {val}টি
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
                  { key: 'mcq_en_bn' as const, label: 'En ➔ Bn MCQ', desc: 'ইংরেজি দেখে বাংলা অর্থ' },
                  { key: 'mcq_bn_en' as const, label: 'Bn ➔ En MCQ', desc: 'বাংলা দেখে ইংরেজি শব্দ' },
                  { key: 'typing_spelling' as const, label: 'লিখিত টাইপিং', desc: 'লিখিত ও স্পেলিং টেস্ট' }
                ].map(item => {
                  const currentQuizType = settings.defaultQuizType || 'mcq_en_bn';
                  const isSelected = currentQuizType === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleQuizTypeChange(item.key)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black font-sans">{item.label}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{item.desc}</span>
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

              <div className="flex flex-wrap gap-2 pt-1">
                {[4, 6, 8, 10, 12].map(val => {
                  const currentMatchSize = settings.defaultMatchSize || 8;
                  const isSelected = currentMatchSize === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleMatchSizeChange(val)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      {val} জোড়া
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
                  settings.autoPlayAudio ? 'bg-indigo-600' : 'bg-slate-200'
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
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
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
                  { key: 'know' as const, label: 'পারি', color: 'bg-emerald-500' },
                  { key: 'dont_know' as const, label: 'পারি না', color: 'bg-rose-500' },
                  { key: 'unrated' as const, label: 'পড়া হয়নি', color: 'bg-slate-400' }
                ].map(st => {
                  const defaultTags = settings.defaultSynonymTags || ['dont_know', 'unrated'];
                  const isSelected = defaultTags.includes(st.key);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleToggleSynonymTag(st.key)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' 
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${st.color}`} />
                        <span>{st.label}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
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
                  { key: 'serial' as const, label: 'সিরিয়াল', desc: '১ থেকে ৩৭ গ্রুপ অনু্যায়ী' },
                  { key: 'alphabetical' as const, label: 'A-Z', desc: 'ইংরেজি বর্ণানুক্রমিক' },
                  { key: 'random' as const, label: 'র্যান্ডম', desc: 'এলোমেলো বা শাফেল' }
                ].map(item => {
                  const defaultOrder = settings.defaultSynonymOrder || 'random';
                  const isSelected = defaultOrder === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSynonymOrderChange(item.key)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black font-sans">{item.label}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{item.desc}</span>
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
                <Keyboard className="w-4.5 h-4.5 text-violet-500" />
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
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
              >
                শর্টকাট রিসেট করুন
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              বিভিন্ন কীবোর্ড বাটন/কি-এর বিপরীতে আপনার পছন্দের অ্যাকশন নির্বাচন করুন। টাইপিং ইনপুট ফিল্ড ছাড়া অন্য যেকোনো অবস্থায় এই শর্টকাটগুলো কাজ করবে।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {[
                { id: 'Space', name: 'Space Key', bn: 'স্পেসবার (Space)' },
                { id: 'Enter', name: 'Enter Key', bn: 'এন্টার (Enter)' },
                { id: 'ArrowRight', name: 'Arrow Right', bn: 'ডানমুখী তীর (→)' },
                { id: 'ArrowLeft', name: 'Arrow Left', bn: 'বামমুখী তীর (←)' },
                { id: 'ArrowUp', name: 'Arrow Up', bn: 'উপরমুখী তীর (↑)' },
                { id: 'ArrowDown', name: 'Arrow Down', bn: 'নিচমুখী তীর (↓)' },
                { id: 'Digit1', name: 'Key 1', bn: 'কীবোর্ড সংখ্যা ১' },
                { id: 'Digit2', name: 'Key 2', bn: 'কীবোর্ড সংখ্যা ২' },
                { id: 'Digit3', name: 'Key 3', bn: 'কীবোর্ড সংখ্যা ৩' },
                { id: 'Digit4', name: 'Key 4', bn: 'কীবোর্ড সংখ্যা ৪' },
                { id: 'Digit5', name: 'Key 5', bn: 'কীবোর্ড সংখ্যা ৫' },
                { id: 'Digit6', name: 'Key 6', bn: 'কীবোর্ড সংখ্যা ৬' },
                { id: 'KeyA', name: 'Key A', bn: 'কীবোর্ড বর্ণ A' },
                { id: 'KeyS', name: 'Key S', bn: 'কীবোর্ড বর্ণ S' },
                { id: 'KeyD', name: 'Key D', bn: 'কীবোর্ড বর্ণ D' },
                { id: 'KeyF', name: 'Key F', bn: 'কীবোর্ড বর্ণ F' },
                { id: 'KeyG', name: 'Key G', bn: 'কীবোর্ড বর্ণ G' },
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

                return (
                  <div key={keyObj.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50/60 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 font-sans">{keyObj.bn}</span>
                      <span className="text-[9px] text-slate-400 font-sans tracking-wider uppercase">{keyObj.name}</span>
                    </div>

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
                      className="bg-white border border-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-slate-700 cursor-pointer"
                    >
                      <option value="none">নিষ্ক্রিয় (None)</option>
                      <option value="know">পারি (Mark as Learned)</option>
                      <option value="dont_know">পারি না (Mark as Not Learned)</option>
                      <option value="confusion">কনফিউশন (Mark as Confused)</option>
                      <option value="skip">স্কিপ / পরবর্তী শব্দ (Skip / Next)</option>
                      <option value="flip">ফ্ল্যাশকার্ড উলটানো (Flip Flashcard)</option>
                      <option value="google">গুগল সার্চ বাটন (Google Search)</option>
                      <option value="audio">অডিও উচ্চারণ (Speak Audio)</option>
                    </select>
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
