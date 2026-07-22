import React, { useState } from 'react';
import { FlashcardCustomStyle } from '../types';
import { 
  FLASHCARD_PRESETS, 
  DEFAULT_FLASHCARD_STYLE,
  getWordSizeClass,
  getWordPosClass,
  getWordVerticalPosClass,
  getMeaningSizeClass,
  getBorderStyleClass,
  getShadowStyleClass
} from '../lib/flashcardPresets';
import { 
  Palette, 
  Sparkles, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  ArrowUp, 
  ArrowDown, 
  Maximize2, 
  Check, 
  RotateCw, 
  Save, 
  Volume2, 
  Layers, 
  Sliders, 
  Type, 
  Maximize, 
  Minimize2,
  Eye,
  Globe
} from 'lucide-react';
import { db, setDoc, doc } from '../lib/firebase';

interface AdminFlashcardEditorProps {
  currentStyle?: FlashcardCustomStyle;
  onStyleSaved?: (newStyle: FlashcardCustomStyle) => void;
}

export const AdminFlashcardEditor: React.FC<AdminFlashcardEditorProps> = ({
  currentStyle,
  onStyleSaved
}) => {
  const [style, setStyle] = useState<FlashcardCustomStyle>(() => {
    return currentStyle || DEFAULT_FLASHCARD_STYLE;
  });

  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Apply a preset
  const handleApplyPreset = (presetId: 'preset-1' | 'preset-2' | 'preset-3' | 'preset-4' | 'preset-5') => {
    const preset = FLASHCARD_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setStyle({ ...preset.style });
      showToast(`${preset.title} কম্বিনেশন সিলেক্ট করা হয়েছে!`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Save to Firestore globally for all users
  const handleSaveGlobalStyle = async () => {
    setIsSaving(true);
    try {
      const updatedStyle: FlashcardCustomStyle = {
        ...style,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin'
      };

      await setDoc(doc(db, 'system_settings', 'flashcard_design'), updatedStyle);
      
      // Cache locally for instant availability
      localStorage.setItem('vocab_flashcard_custom_style', JSON.stringify(updatedStyle));

      if (onStyleSaved) {
        onStyleSaved(updatedStyle);
      }

      showToast('🎉 ফ্ল্যাশকার্ড ডিজাইন সফলভাবে সেভ হয়েছে! এটি এখন সকল ইউজারের জন্য প্রযোজ্য।');
    } catch (err) {
      console.error('Error saving global flashcard style:', err);
      showToast('❌ সেভ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  // Color options swatches
  const colorSwatches = [
    { label: 'White', hex: '#ffffff' },
    { label: 'Charcoal', hex: '#0f172a' },
    { label: 'Cyan', hex: '#38bdf8' },
    { label: 'Amber', hex: '#fbbf24' },
    { label: 'Emerald', hex: '#34d399' },
    { label: 'Rose', hex: '#f43f5e' },
    { label: 'Indigo', hex: '#818cf8' },
    { label: 'Purple', hex: '#c084fc' }
  ];

  const bgSwatches = [
    { label: 'Pitch Slate', hex: '#0f172a' },
    { label: 'Obsidian Black', hex: '#000000' },
    { label: 'Studio White', hex: '#ffffff' },
    { label: 'Pastel Lavender', hex: '#f5f3ff' },
    { label: 'Dark Navy', hex: '#111827' },
    { label: 'Midnight Cyan', hex: '#090d16' }
  ];

  return (
    <div className="space-y-8 animate-fadeIn text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl border border-indigo-500/30 flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-2xl border border-indigo-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5" />
            Global Admin Setting
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Palette className="w-7 h-7 text-indigo-400" />
            ফ্ল্যাশকার্ড ডিজাইন কাস্টমাইজেশন
          </h2>
          <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
            এখানে মাউস ক্লিক করে ফ্লাশকার্ডের টেক্সট সাইজ, কালার, পজিশন ও ব্যাকগ্রাউন্ড চেঞ্জ করুন। এডমিন যা সেট করে দিবে, সকল ইউজারের জন্য তা প্রযোজ্য হবে।
          </p>
        </div>

        <button
          onClick={handleSaveGlobalStyle}
          disabled={isSaving}
          className="w-full md:w-auto px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50 flex-shrink-0"
        >
          {isSaving ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>সেভ হচ্ছে...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>সকল ইউজারের জন্য সেভ করুন</span>
            </>
          )}
        </button>
      </div>

      {/* SECTION 1: 5 DEFAULT PRESETS */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              ৫টি ডিফল্ট ডিজাইন কম্বিনেশন (Default Presets)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              যেকোনো ১টি রেডিমেড স্টাইলে ক্লিক করে ইনস্ট্যান্ট সেট করুন
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
          {FLASHCARD_PRESETS.map((preset, idx) => {
            const isSelected = style.presetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id)}
                className={`group p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected 
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                      Preset {idx + 1}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  {/* Preset Mini Sample Box */}
                  <div 
                    className="h-16 rounded-lg p-2.5 flex items-center justify-center border text-center shadow-2xs my-2 transition group-hover:scale-[1.02]"
                    style={{
                      backgroundColor: preset.style.cardBgColor,
                      borderColor: preset.style.borderStyle === 'neon' ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                      borderRadius: preset.style.borderRadius
                    }}
                  >
                    <span 
                      className="font-black text-sm truncate px-1"
                      style={{ color: preset.style.wordColor }}
                    >
                      Ebullient
                    </span>
                  </div>

                  <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                    {preset.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: MAIN WORKSPACE - CONTROLS & LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE CONTROLS (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* CONTROL BLOCK 1: WORD TYPOGRAPHY & ALIGNMENT */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Type className="w-4 h-4 text-indigo-600" />
              ১. প্রধান শব্দের ফন্ট সাইজ, কালার ও পজিশন
            </h3>

            {/* Word Font Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>শব্দের লেখার সাইজ (Word Font Size):</span>
                <span className="text-indigo-600 uppercase font-black">{style.wordFontSize}</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setStyle(prev => ({ ...prev, wordFontSize: sz, presetId: 'custom' }))}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg border transition cursor-pointer ${
                      style.wordFontSize === sz
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Word Horizontal Alignment */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                অনুভূমিক পজিশন (Horizontal Alignment):
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'left', label: 'বাম ঘেঁষা (Left)', icon: AlignLeft },
                  { key: 'center', label: 'মাঝখানে (Center)', icon: AlignCenter },
                  { key: 'right', label: 'ডান ঘেঁষা (Right)', icon: AlignRight }
                ].map(item => {
                  const IconComp = item.icon;
                  const isAct = style.wordPosition === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setStyle(prev => ({ ...prev, wordPosition: item.key as any, presetId: 'custom' }))}
                      className={`py-2.5 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer ${
                        isAct
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Word Vertical Position */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                উল্লম্ব পজিশন (Vertical Alignment):
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'top', label: 'উপরে (Top)', icon: ArrowUp },
                  { key: 'center', label: 'মাঝখানে (Middle)', icon: AlignCenter },
                  { key: 'bottom', label: 'নিচে (Bottom)', icon: ArrowDown }
                ].map(item => {
                  const IconComp = item.icon;
                  const isAct = style.wordVerticalPos === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setStyle(prev => ({ ...prev, wordVerticalPos: item.key as any, presetId: 'custom' }))}
                      className={`py-2.5 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer ${
                        isAct
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Word Color Picker */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>শব্দের রং (Word Color):</span>
                <span className="font-mono text-xs text-slate-500">{style.wordColor}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {colorSwatches.map(sw => (
                  <button
                    key={sw.hex}
                    onClick={() => setStyle(prev => ({ ...prev, wordColor: sw.hex, presetId: 'custom' }))}
                    className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                      style.wordColor.toLowerCase() === sw.hex.toLowerCase()
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-110'
                        : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                    title={sw.label}
                  >
                    {style.wordColor.toLowerCase() === sw.hex.toLowerCase() && (
                      <Check className={`w-4 h-4 ${sw.hex === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                    )}
                  </button>
                ))}
                
                {/* Custom Color Input */}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                  <input
                    type="color"
                    value={style.wordColor}
                    onChange={(e) => setStyle(prev => ({ ...prev, wordColor: e.target.value, presetId: 'custom' }))}
                    className="w-9 h-9 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                    title="Custom Color"
                  />
                  <span className="text-xs text-slate-500 font-medium">কাস্টম কালার</span>
                </div>
              </div>
            </div>

          </div>

          {/* CONTROL BLOCK 2: MEANING & BACK SIDE STYLING */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-emerald-600" />
              ২. বাংলা অর্থ ও ব্যাকসাইড ডিজাইন
            </h3>

            {/* Meaning Font Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>অর্থের লেখার সাইজ (Meaning Font Size):</span>
                <span className="text-emerald-600 uppercase font-black">{style.meaningFontSize}</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setStyle(prev => ({ ...prev, meaningFontSize: sz, presetId: 'custom' }))}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg border transition cursor-pointer ${
                      style.meaningFontSize === sz
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Meaning Color */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>অর্থের কালার (Meaning Text Color):</span>
                <span className="font-mono text-xs text-slate-500">{style.meaningColor}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: 'Emerald', hex: '#34d399' },
                  { label: 'Dark Emerald', hex: '#059669' },
                  { label: 'Cyan', hex: '#38bdf8' },
                  { label: 'Purple', hex: '#c084fc' },
                  { label: 'Amber', hex: '#fbbf24' },
                  { label: 'White', hex: '#ffffff' },
                  { label: 'Dark Slate', hex: '#0f172a' }
                ].map(sw => (
                  <button
                    key={sw.hex}
                    onClick={() => setStyle(prev => ({ ...prev, meaningColor: sw.hex, presetId: 'custom' }))}
                    className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                      style.meaningColor.toLowerCase() === sw.hex.toLowerCase()
                        ? 'border-emerald-600 ring-2 ring-emerald-500/30 scale-110'
                        : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  >
                    {style.meaningColor.toLowerCase() === sw.hex.toLowerCase() && (
                      <Check className={`w-4 h-4 ${sw.hex === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                    )}
                  </button>
                ))}

                <input
                  type="color"
                  value={style.meaningColor}
                  onChange={(e) => setStyle(prev => ({ ...prev, meaningColor: e.target.value, presetId: 'custom' }))}
                  className="w-9 h-9 rounded-lg border border-slate-300 p-0.5 cursor-pointer ml-2"
                />
              </div>
            </div>
          </div>

          {/* CONTROL BLOCK 3: CARD CONTAINER (BACKGROUND, BORDER, RADIUS, SHADOW) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="w-4 h-4 text-purple-600" />
              ৩. কার্ড ব্যাকগ্রাউন্ড, বর্ডার ও শ্যাডো
            </h3>

            {/* Background Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>কার্ড ব্যাকগ্রাউন্ড কালার (Card Background):</span>
                <span className="font-mono text-xs text-slate-500">{style.cardBgColor}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {bgSwatches.map(sw => (
                  <button
                    key={sw.hex}
                    onClick={() => setStyle(prev => ({ ...prev, cardBgColor: sw.hex, presetId: 'custom' }))}
                    className={`w-9 h-9 rounded-xl border-2 transition transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                      style.cardBgColor.toLowerCase() === sw.hex.toLowerCase()
                        ? 'border-purple-600 ring-2 ring-purple-500/30 scale-105'
                        : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                    title={sw.label}
                  >
                    {style.cardBgColor.toLowerCase() === sw.hex.toLowerCase() && (
                      <Check className={`w-4 h-4 ${sw.hex === '#ffffff' || sw.hex === '#f5f3ff' ? 'text-slate-900' : 'text-white'}`} />
                    )}
                  </button>
                ))}

                <input
                  type="color"
                  value={style.cardBgColor}
                  onChange={(e) => setStyle(prev => ({ ...prev, cardBgColor: e.target.value, presetId: 'custom' }))}
                  className="w-9 h-9 rounded-lg border border-slate-300 p-0.5 cursor-pointer ml-2"
                />
              </div>
            </div>

            {/* Corner Radius */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                কার্ডের কোণার রাউন্ডনেস (Corner Radius):
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { value: '12px', label: '12px' },
                  { value: '16px', label: '16px' },
                  { value: '20px', label: '20px' },
                  { value: '24px', label: '24px' },
                  { value: '32px', label: '32px' }
                ].map(r => (
                  <button
                    key={r.value}
                    onClick={() => setStyle(prev => ({ ...prev, borderRadius: r.value as any, presetId: 'custom' }))}
                    className={`py-2 px-2 text-xs font-extrabold rounded-xl border transition cursor-pointer text-center ${
                      style.borderRadius === r.value
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Border Style */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                বর্ডার স্টাইল (Border Style):
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { key: 'none', label: 'None' },
                  { key: 'subtle', label: 'Subtle' },
                  { key: 'bold', label: 'Bold' },
                  { key: 'accent', label: 'Accent' },
                  { key: 'neon', label: 'Neon Glow' }
                ].map(b => (
                  <button
                    key={b.key}
                    onClick={() => setStyle(prev => ({ ...prev, borderStyle: b.key as any, presetId: 'custom' }))}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                      style.borderStyle === b.key
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shadow Effect */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                শ্যাডো ইফেক্ট (Shadow Style):
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { key: 'none', label: 'None' },
                  { key: 'soft', label: 'Soft' },
                  { key: 'diffused', label: 'Diffused' },
                  { key: 'glow', label: 'Glow' },
                  { key: 'deep', label: 'Deep' }
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setStyle(prev => ({ ...prev, shadowStyle: s.key as any, presetId: 'custom' }))}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                      style.shadowStyle === s.key
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: STICKY REAL-TIME LIVE PREVIEW (5 Cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <h3 className="font-black text-sm text-slate-200 uppercase tracking-wider">
                  লাইভ কার্ড প্রিভিউ (Live Preview)
                </h3>
              </div>

              <button
                onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{isPreviewFlipped ? 'সামনের সাইড দেখুন' : 'কার্ড উল্টান (Flip)'}</span>
              </button>
            </div>

            {/* LIVE PREVIEW CONTAINER */}
            <div className="w-full h-80 sm:h-96 rounded-xl flex flex-col justify-between p-6 relative transition-all duration-300 overflow-hidden"
                 style={{
                   backgroundColor: style.cardBgColor,
                   borderRadius: style.borderRadius,
                 }}
            >
              {/* Card Outer Border & Shadow wrapper classes */}
              <div 
                className={`absolute inset-0 pointer-events-none transition-all ${getBorderStyleClass(style.borderStyle)} ${getShadowStyleClass(style.shadowStyle)}`}
                style={{ borderRadius: style.borderRadius }}
              />

              {/* Top Meta Bar */}
              <div className="flex items-center justify-between z-10 w-full text-xs font-semibold opacity-80">
                <span className="px-2.5 py-1 rounded-md bg-black/20 backdrop-blur-md text-slate-300 border border-white/10">
                  Group 1
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-slate-200">
                    <Volume2 className="w-3.5 h-3.5" />
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                    Unrated
                  </span>
                </div>
              </div>

              {/* CARD MAIN CONTENT (FRONT vs BACK) */}
              {!isPreviewFlipped ? (
                /* FRONT SIDE */
                <div className={`w-full h-full flex flex-col z-10 ${getWordVerticalPosClass(style.wordVerticalPos)} ${getWordPosClass(style.wordPosition)}`}>
                  <h2 
                    className={`font-black tracking-tight transition-all duration-200 select-none ${getWordSizeClass(style.wordFontSize)}`}
                    style={{ color: style.wordColor }}
                  >
                    Ebullient
                  </h2>
                  <p className="text-xs text-slate-400 mt-2 opacity-75 font-mono">
                    /ɪˈbʌliənt/ • Adjective
                  </p>
                </div>
              ) : (
                /* BACK SIDE */
                <div className="w-full h-full flex flex-col justify-center items-center text-center space-y-4 z-10 my-auto">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1 opacity-80">
                      Bengali Meaning
                    </span>
                    <h3 
                      className={`font-black transition-all ${getMeaningSizeClass(style.meaningFontSize)}`}
                      style={{ color: style.meaningColor }}
                    >
                      উচ্ছ্বসিত ও অত্যন্ত প্রফুল্ল
                    </h3>
                  </div>

                  <div className="space-y-1 bg-black/20 p-3 rounded-xl border border-white/5 max-w-xs w-full text-left">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Synonyms:
                    </span>
                    <p className="text-xs text-slate-200 font-medium">
                      Exuberant, High-spirited, Buoyant
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Hint */}
              <div className="text-center z-10 text-[11px] text-slate-400/80 font-medium">
                {isPreviewFlipped ? 'কার্ডটি সামনে ফিরাতে উপরে ক্লিক করুন' : 'স্পেসবার বা মাউস ক্লিক দিয়ে কার্ড উল্টানো যাবে'}
              </div>
            </div>

            {/* Quick Summary Badge */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">সিলেক্টেড প্রিসেট:</span>
                <span className="font-bold text-indigo-400 uppercase">{style.presetId || 'Custom'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">শব্দের কালার:</span>
                <span className="font-mono text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block border" style={{ backgroundColor: style.wordColor }} />
                  {style.wordColor}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">ব্যাকগ্রাউন্ড:</span>
                <span className="font-mono text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block border" style={{ backgroundColor: style.cardBgColor }} />
                  {style.cardBgColor}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveGlobalStyle}
              disabled={isSaving}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>সকল ইউজারের জন্য সেভ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
