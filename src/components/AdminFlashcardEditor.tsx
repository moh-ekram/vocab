import React, { useState } from 'react';
import { FlashcardCustomStyle, ElementStyleConfig } from '../types';
import { 
  FLASHCARD_PRESETS, 
  DEFAULT_FLASHCARD_STYLE,
  getBorderStyleClass,
  getShadowStyleClass,
  getElementSizeClass
} from '../lib/flashcardPresets';
import { 
  Palette, 
  Sparkles, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Check, 
  RotateCw, 
  Save, 
  Volume2, 
  Layers, 
  Sliders, 
  Type, 
  Eye, 
  EyeOff,
  Globe,
  Tag,
  MousePointer,
  Layout,
  FileText
} from 'lucide-react';
import { db, setDoc, doc } from '../lib/firebase';

interface AdminFlashcardEditorProps {
  currentStyle?: FlashcardCustomStyle;
  onStyleSaved?: (newStyle: FlashcardCustomStyle) => void;
}

export interface ElementMeta {
  key: string;
  nameBn: string;
  nameEn: string;
  exampleText: string;
  defaultSide: 'front' | 'back';
  category: 'placemarker' | 'tag';
}

export const ALL_ELEMENTS_META: ElementMeta[] = [
  { key: 'place1', nameBn: 'প্লেসমার্কার ১: প্রধান শব্দ', nameEn: 'Main Word', exampleText: 'Ebullient', defaultSide: 'front', category: 'placemarker' },
  { key: 'place2', nameBn: 'প্লেসমার্কার ২: বাংলা অর্থ', nameEn: 'Bengali Meaning', exampleText: 'উচ্ছ্বসিত ও অত্যন্ত প্রফুল্ল', defaultSide: 'back', category: 'placemarker' },
  { key: 'place3', nameBn: 'প্লেসমার্কার ৩: সমার্থক শব্দ', nameEn: 'Synonyms', exampleText: 'Exuberant, High-spirited, Buoyant', defaultSide: 'back', category: 'placemarker' },
  { key: 'place4', nameBn: 'প্লেসমার্কার ৪: উদাহরণ বাক্য', nameEn: 'Example Sentence', exampleText: 'She sounded ebullient on the phone.', defaultSide: 'front', category: 'placemarker' },
  { key: 'place5', nameBn: 'প্লেসমার্কার ৫: নেমোনিক নোট', nameEn: 'Mnemonic Note', exampleText: 'Full of energy like a bull', defaultSide: 'back', category: 'placemarker' },
  { key: 'place6', nameBn: 'প্লেসমার্কার ৬: অতিরিক্ত শব্দ', nameEn: 'Extra Word / Derivatives', exampleText: 'Ebullience (noun), Ebulliently (adv)', defaultSide: 'front', category: 'placemarker' },
  { key: 'tag_know', nameBn: 'ট্যাগ ১: পারি (Learned)', nameEn: 'Tag: Learned', exampleText: 'Learned (পারি)', defaultSide: 'front', category: 'tag' },
  { key: 'tag_dont_know', nameBn: 'ট্যাগ ২: পারিনা (Not Learned)', nameEn: 'Tag: Not Learned', exampleText: 'Not Learned (পারিনা)', defaultSide: 'front', category: 'tag' },
  { key: 'tag_confusion', nameBn: 'ট্যাগ ৩: কনফিউশন (Confused)', nameEn: 'Tag: Confused', exampleText: 'Confused (কনফিউশন)', defaultSide: 'front', category: 'tag' },
];

export const DEFAULT_ELEMENTS: Record<string, ElementStyleConfig> = {
  place1: { fontSize: '2xl', color: '#ffffff', position: 'center', side: 'front', visible: true },
  place2: { fontSize: 'xl', color: '#34d399', position: 'center', side: 'back', visible: true },
  place3: { fontSize: 'md', color: '#38bdf8', position: 'center', side: 'back', visible: true },
  place4: { fontSize: 'sm', color: '#cbd5e1', position: 'center', side: 'front', visible: true },
  place5: { fontSize: 'sm', color: '#fbbf24', position: 'center', side: 'back', visible: true },
  place6: { fontSize: 'xs', color: '#c084fc', position: 'center', side: 'front', visible: true },
  tag_know: { fontSize: 'sm', color: '#10b981', position: 'center', side: 'front', visible: true },
  tag_dont_know: { fontSize: 'sm', color: '#f43f5e', position: 'center', side: 'front', visible: true },
  tag_confusion: { fontSize: 'sm', color: '#a855f7', position: 'center', side: 'front', visible: true },
};

export const AdminFlashcardEditor: React.FC<AdminFlashcardEditorProps> = ({
  currentStyle,
  onStyleSaved
}) => {
  const [style, setStyle] = useState<FlashcardCustomStyle>(() => {
    const base = currentStyle || DEFAULT_FLASHCARD_STYLE;
    return {
      ...base,
      elements: {
        ...DEFAULT_ELEMENTS,
        ...(base.elements || {})
      }
    };
  });

  const [selectedElementKey, setSelectedElementKey] = useState<string>('place1');
  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to get element style with fallbacks
  const getElementStyle = (key: string): ElementStyleConfig => {
    const custom = style.elements?.[key];
    const def = DEFAULT_ELEMENTS[key] || { fontSize: 'md', color: '#ffffff', position: 'center', side: 'front', visible: true };
    return {
      fontSize: custom?.fontSize || def.fontSize,
      color: custom?.color || def.color,
      position: custom?.position || def.position,
      side: custom?.side || def.side,
      visible: custom?.visible !== undefined ? custom.visible : def.visible
    };
  };

  // Helper to update specific element's style
  const updateElementStyle = (key: string, updates: Partial<ElementStyleConfig>) => {
    setStyle(prev => {
      const currentElem = prev.elements?.[key] || DEFAULT_ELEMENTS[key] || {};
      return {
        ...prev,
        presetId: 'custom',
        elements: {
          ...prev.elements,
          [key]: {
            ...currentElem,
            ...updates
          }
        }
      };
    });
  };

  // Apply preset
  const handleApplyPreset = (presetId: 'preset-1' | 'preset-2' | 'preset-3' | 'preset-4' | 'preset-5') => {
    const preset = FLASHCARD_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setStyle({
        ...preset.style,
        elements: {
          ...DEFAULT_ELEMENTS,
          place1: { ...DEFAULT_ELEMENTS.place1, color: preset.style.wordColor, fontSize: preset.style.wordFontSize },
          place2: { ...DEFAULT_ELEMENTS.place2, color: preset.style.meaningColor, fontSize: preset.style.meaningFontSize }
        }
      });
      showToast(`${preset.title} প্রিসেট সিলেক্ট করা হয়েছে!`);
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
        wordColor: getElementStyle('place1').color || style.wordColor,
        wordFontSize: (getElementStyle('place1').fontSize as any) || style.wordFontSize,
        meaningColor: getElementStyle('place2').color || style.meaningColor,
        meaningFontSize: (getElementStyle('place2').fontSize as any) || style.meaningFontSize,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin'
      };

      // Set directly to system_settings/flashcard_design doc
      await setDoc(doc(db, 'system_settings', 'flashcard_design'), updatedStyle, { merge: true });
      
      // LocalStorage Cache
      localStorage.setItem('vocab_flashcard_custom_style', JSON.stringify(updatedStyle));

      if (onStyleSaved) {
        onStyleSaved(updatedStyle);
      }

      showToast('🎉 ফ্ল্যাশকার্ড ডিজাইন সফলভাবে সেভ হয়েছে! এটি এখন সকল ইউজারের জন্য রিয়েলটাইমে প্রযোজ্য।');
    } catch (err: any) {
      console.error('Error saving global flashcard style:', err);
      showToast(`❌ সেভ করতে সমস্যা হয়েছে: ${err.message || 'Firestore Permission Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const colorSwatches = [
    { label: 'White', hex: '#ffffff' },
    { label: 'Charcoal', hex: '#0f172a' },
    { label: 'Emerald', hex: '#34d399' },
    { label: 'Cyan', hex: '#38bdf8' },
    { label: 'Amber', hex: '#fbbf24' },
    { label: 'Rose', hex: '#f43f5e' },
    { label: 'Purple', hex: '#c084fc' },
    { label: 'Indigo', hex: '#818cf8' }
  ];

  const bgSwatches = [
    { label: 'Pitch Slate', hex: '#0f172a' },
    { label: 'Obsidian Black', hex: '#000000' },
    { label: 'Studio White', hex: '#ffffff' },
    { label: 'Pastel Lavender', hex: '#f5f3ff' },
    { label: 'Dark Navy', hex: '#111827' },
    { label: 'Midnight Cyan', hex: '#090d16' }
  ];

  const activeElementMeta = ALL_ELEMENTS_META.find(m => m.key === selectedElementKey) || ALL_ELEMENTS_META[0];
  const activeElementStyle = getElementStyle(selectedElementKey);

  // Auto flip preview when admin clicks an element whose side doesn't match current preview side
  const handleSelectElement = (key: string) => {
    setSelectedElementKey(key);
    const elemStyle = getElementStyle(key);
    if (elemStyle.side === 'front' && isPreviewFlipped) {
      setIsPreviewFlipped(false);
    } else if (elemStyle.side === 'back' && !isPreviewFlipped) {
      setIsPreviewFlipped(true);
    }
  };

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
            Global Admin Settings
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Palette className="w-7 h-7 text-indigo-400" />
            ফ্ল্যাশকার্ড ডিজাইন কাস্টমাইজেশন
          </h2>
          <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
            লাইভ কার্ড প্রিভিউয়ের প্রতিটি টেক্সট বা ট্যাগে মাউস দিয়ে ক্লিক করে তার সাইজ, কালার, পজিশন ও কার্ড সাইড এডিট করুন। এডমিন যা সেট করবেন, তা সকল ইউজারের কাছে প্রযোজ্য হবে।
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              ৫টি রেডিমেড ডিজাইন প্রেসেট (Ready Presets)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              যেকোনো ১টি রেডিমেড থিমে ক্লিক করে পুরো ফ্ল্যাশকার্ডের থিম ইনস্ট্যান্ট সেট করুন
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {FLASHCARD_PRESETS.map((preset, idx) => {
            const isSelected = style.presetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id)}
                className={`group p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected 
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                      Preset {idx + 1}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <div 
                    className="h-12 rounded-lg p-2 flex items-center justify-center border text-center my-1"
                    style={{
                      backgroundColor: preset.style.cardBgColor,
                      borderColor: preset.style.borderStyle === 'neon' ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                      borderRadius: preset.style.borderRadius
                    }}
                  >
                    <span 
                      className="font-black text-xs truncate px-1"
                      style={{ color: preset.style.wordColor }}
                    >
                      Ebullient
                    </span>
                  </div>

                  <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-indigo-600 transition truncate">
                    {preset.title}
                  </h4>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE WORKSPACE (LEFT: CONTROLS, RIGHT: LIVE PREVIEW) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: ELEMENT SELECTION & CONTROLS (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">

          {/* ELEMENT SELECTOR TOOLBAR */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-indigo-600" />
                ফ্লাশকার্ডের ৬টি প্লেসমার্কার ও ৩টি ট্যাগ লিস্ট
              </h3>
              <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                নিচের যেকোনো উপাদানে ক্লিক করে কাস্টমাইজ করুন
              </span>
            </div>

            {/* Placemarkers Tabs */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                ৬টি প্লেসমার্কার (Placemarkers):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_ELEMENTS_META.filter(m => m.category === 'placemarker').map(meta => {
                  const isSelected = selectedElementKey === meta.key;
                  const elemStyle = getElementStyle(meta.key);
                  return (
                    <button
                      key={meta.key}
                      onClick={() => handleSelectElement(meta.key)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-mono block opacity-80 truncate">
                          {meta.nameEn}
                        </span>
                        <span className="text-xs truncate block">
                          {meta.nameBn.split(':')[1] || meta.nameBn}
                        </span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${elemStyle.side === 'front' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {elemStyle.side === 'front' ? 'Front' : 'Back'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Tags Tabs */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                ৩টি স্ট্যাটাস ট্যাগ (Status Tags):
              </span>
              <div className="grid grid-cols-3 gap-2">
                {ALL_ELEMENTS_META.filter(m => m.category === 'tag').map(meta => {
                  const isSelected = selectedElementKey === meta.key;
                  const elemStyle = getElementStyle(meta.key);
                  return (
                    <button
                      key={meta.key}
                      onClick={() => handleSelectElement(meta.key)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="text-xs truncate block font-bold">
                        {meta.nameBn.split(':')[1] || meta.nameBn}
                      </span>
                      <span className="text-[10px] opacity-75 font-mono block">
                        Side: {elemStyle.side}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ACTIVE ELEMENT CUSTOMIZATION CONTROLS */}
          <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500/30 shadow-md space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {activeElementMeta.nameBn} ({activeElementMeta.nameEn})
                  </h3>
                  <p className="text-xs text-slate-500">
                    সিলেক্টেড উপাদানের স্টাইল এডিট করছেন
                  </p>
                </div>
              </div>

              {/* Visibility Toggle */}
              <button
                onClick={() => updateElementStyle(selectedElementKey, { visible: !activeElementStyle.visible })}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                  activeElementStyle.visible
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-rose-50 text-rose-700 border-rose-300'
                }`}
              >
                {activeElementStyle.visible ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>দৃশ্যমান (Visible)</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>লুকানো (Hidden)</span>
                  </>
                )}
              </button>
            </div>

            {/* Font Size Option */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>লেখা সাইজ (Font Size):</span>
                <span className="text-indigo-600 font-black uppercase">{activeElementStyle.fontSize || 'md'}</span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => updateElementStyle(selectedElementKey, { fontSize: sz })}
                    className={`py-2 px-2 text-xs font-extrabold rounded-lg border transition cursor-pointer text-center ${
                      activeElementStyle.fontSize === sz
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Option */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>লেখার রং (Text Color):</span>
                <span className="font-mono text-xs text-slate-500">{activeElementStyle.color}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {colorSwatches.map(sw => (
                  <button
                    key={sw.hex}
                    onClick={() => updateElementStyle(selectedElementKey, { color: sw.hex })}
                    className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                      activeElementStyle.color?.toLowerCase() === sw.hex.toLowerCase()
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-110'
                        : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                    title={sw.label}
                  >
                    {activeElementStyle.color?.toLowerCase() === sw.hex.toLowerCase() && (
                      <Check className={`w-4 h-4 ${sw.hex === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                    )}
                  </button>
                ))}
                
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                  <input
                    type="color"
                    value={activeElementStyle.color || '#ffffff'}
                    onChange={(e) => updateElementStyle(selectedElementKey, { color: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                    title="Custom Color"
                  />
                  <span className="text-xs text-slate-500 font-medium">কাস্টম কালার</span>
                </div>
              </div>
            </div>

            {/* Horizontal Alignment */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                অনুভূমিক পজিশন (Horizontal Position):
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'left', label: 'বাম ঘেঁষা (Left)', icon: AlignLeft },
                  { key: 'center', label: 'মাঝখানে (Center)', icon: AlignCenter },
                  { key: 'right', label: 'ডান ঘেঁষা (Right)', icon: AlignRight }
                ].map(item => {
                  const IconComp = item.icon;
                  const isAct = activeElementStyle.position === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => updateElementStyle(selectedElementKey, { position: item.key as any })}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer ${
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

            {/* Card Side Placement (Front vs Back) */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                কার্ডের কোন পাশে থাকবে? (Card Side Placement):
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'front', label: 'সামনের পাশ (Front Side)', desc: 'শব্দ দেখা যাওয়ার সময়' },
                  { key: 'back', label: 'পেছনের পাশ (Back Side)', desc: 'ফ্লিপ বা অর্থ দেখার সময়' }
                ].map(side => {
                  const isAct = activeElementStyle.side === side.key;
                  return (
                    <button
                      key={side.key}
                      onClick={() => {
                        updateElementStyle(selectedElementKey, { side: side.key as any });
                        setIsPreviewFlipped(side.key === 'back');
                      }}
                      className={`p-3 text-left rounded-xl border transition cursor-pointer ${
                        isAct
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="text-xs block">{side.label}</span>
                      <span className={`text-[10px] ${isAct ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {side.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CARD CONTAINER STYLING BLOCK (BACKGROUND, BORDER, RADIUS, SHADOW) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="w-4 h-4 text-purple-600" />
              কার্ড ব্যাকগ্রাউন্ড, বর্ডার ও শ্যাডো স্টাইল
            </h3>

            {/* Card Background Color */}
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

            {/* Corner Radius & Border Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  কোণার রাউন্ডনেস (Corner Radius):
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['12px', '16px', '20px', '24px', '32px'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setStyle(prev => ({ ...prev, borderRadius: r, presetId: 'custom' }))}
                      className={`py-1.5 text-xs font-extrabold rounded-lg border transition cursor-pointer text-center ${
                        style.borderRadius === r
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  বর্ডার স্টাইল (Border Style):
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['none', 'subtle', 'bold', 'accent', 'neon'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setStyle(prev => ({ ...prev, borderStyle: b, presetId: 'custom' }))}
                      className={`py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer text-center capitalize ${
                        style.borderStyle === b
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: INTERACTIVE STICKY LIVE PREVIEW (5 COLS) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <h3 className="font-black text-sm text-slate-200 uppercase tracking-wider">
                  লাইভ ইন্টারেক্টিভ প্রিভিউ
                </h3>
              </div>

              <button
                onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{isPreviewFlipped ? 'সামনের পাশ দেখুন' : 'কার্ড উল্টান (Flip Back)'}</span>
              </button>
            </div>

            <p className="text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
              <MousePointer className="w-4 h-4 flex-shrink-0" />
              <span>কার্ডের টেক্সট বা ট্যাগে মাউস ক্লিক করে সরাসরি এডিট করুন</span>
            </p>

            {/* LIVE PREVIEW CONTAINER */}
            <div 
              className="w-full min-h-[380px] sm:min-h-[420px] rounded-xl flex flex-col justify-between p-5 relative transition-all duration-300 overflow-hidden shadow-xl"
              style={{
                backgroundColor: style.cardBgColor,
                borderRadius: style.borderRadius,
              }}
            >
              {/* Outer Border Overlay */}
              <div 
                className={`absolute inset-0 pointer-events-none transition-all ${getBorderStyleClass(style.borderStyle)} ${getShadowStyleClass(style.shadowStyle)}`}
                style={{ borderRadius: style.borderRadius }}
              />

              {/* CARD PREVIEW CONTENT DEPENDING ON FRONT/BACK */}
              {!isPreviewFlipped ? (
                /* FRONT SIDE PREVIEW */
                <div className="w-full h-full flex flex-col justify-between relative z-10 space-y-4">
                  {/* Top Meta Bar */}
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-black/30 backdrop-blur-md text-slate-300 border border-white/10 font-mono text-[11px]">
                      Group 1
                    </span>

                    {/* Status Tags on Front */}
                    <div className="flex items-center gap-1.5">
                      {['tag_know', 'tag_dont_know', 'tag_confusion'].map(tagKey => {
                        const tagStyle = getElementStyle(tagKey);
                        if (!tagStyle.visible || tagStyle.side !== 'front') return null;
                        const isSelected = selectedElementKey === tagKey;
                        const tagMeta = ALL_ELEMENTS_META.find(m => m.key === tagKey);
                        return (
                          <button
                            key={tagKey}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectElement(tagKey);
                            }}
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition cursor-pointer relative border ${
                              isSelected
                                ? 'ring-2 ring-indigo-400 border-white shadow-md'
                                : 'border-transparent hover:border-white/30'
                            }`}
                            style={{
                              backgroundColor: `${tagStyle.color}25`,
                              color: tagStyle.color
                            }}
                          >
                            {tagMeta?.exampleText.split(' ')[0]}
                            {isSelected && (
                              <span className="absolute -top-2 -right-1 bg-indigo-600 text-white text-[8px] px-1 rounded-full">
                                EDIT
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Center Content for Front Elements */}
                  <div className="flex-1 flex flex-col justify-center space-y-3 py-2">
                    {/* Render Front Elements in order: place1, place4, place6 */}
                    {['place1', 'place4', 'place6'].map(elemKey => {
                      const elemStyle = getElementStyle(elemKey);
                      if (!elemStyle.visible || elemStyle.side !== 'front') return null;
                      const isSelected = selectedElementKey === elemKey;
                      const meta = ALL_ELEMENTS_META.find(m => m.key === elemKey)!;

                      const alignClass = elemStyle.position === 'left' ? 'text-left items-start' : elemStyle.position === 'right' ? 'text-right items-end' : 'text-center items-center';

                      return (
                        <div
                          key={elemKey}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectElement(elemKey);
                          }}
                          className={`group relative p-2 rounded-xl transition cursor-pointer flex flex-col ${alignClass} ${
                            isSelected
                              ? 'ring-2 ring-indigo-500 bg-indigo-500/10 border border-indigo-400'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute -top-2.5 left-2 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                              {meta.nameEn} (Editing)
                            </span>
                          )}

                          <span 
                            className={`font-black transition-all ${getElementSizeClass(elemStyle.fontSize)}`}
                            style={{ color: elemStyle.color }}
                          >
                            {meta.exampleText}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Audio/Search Sample */}
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300">
                      <Volume2 className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      স্পেসবার বা ক্লিক করে পিছনের পাশ দেখুন
                    </span>
                  </div>
                </div>
              ) : (
                /* BACK SIDE PREVIEW */
                <div className="w-full h-full flex flex-col justify-between relative z-10 space-y-3">
                  {/* Top Meta Bar */}
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-black/30 backdrop-blur-md text-slate-300 border border-white/10 font-mono text-[11px]">
                      Group 1 (Back Side)
                    </span>

                    {/* Status Tags on Back */}
                    <div className="flex items-center gap-1.5">
                      {['tag_know', 'tag_dont_know', 'tag_confusion'].map(tagKey => {
                        const tagStyle = getElementStyle(tagKey);
                        if (!tagStyle.visible || tagStyle.side !== 'back') return null;
                        const isSelected = selectedElementKey === tagKey;
                        const tagMeta = ALL_ELEMENTS_META.find(m => m.key === tagKey);
                        return (
                          <button
                            key={tagKey}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectElement(tagKey);
                            }}
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition cursor-pointer relative border ${
                              isSelected
                                ? 'ring-2 ring-indigo-400 border-white shadow-md'
                                : 'border-transparent hover:border-white/30'
                            }`}
                            style={{
                              backgroundColor: `${tagStyle.color}25`,
                              color: tagStyle.color
                            }}
                          >
                            {tagMeta?.exampleText.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Back Elements: place2, place3, place5 */}
                  <div className="flex-1 flex flex-col justify-center space-y-3 py-2">
                    {['place2', 'place3', 'place5'].map(elemKey => {
                      const elemStyle = getElementStyle(elemKey);
                      if (!elemStyle.visible || elemStyle.side !== 'back') return null;
                      const isSelected = selectedElementKey === elemKey;
                      const meta = ALL_ELEMENTS_META.find(m => m.key === elemKey)!;

                      const alignClass = elemStyle.position === 'left' ? 'text-left items-start' : elemStyle.position === 'right' ? 'text-right items-end' : 'text-center items-center';

                      return (
                        <div
                          key={elemKey}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectElement(elemKey);
                          }}
                          className={`group relative p-2 rounded-xl transition cursor-pointer flex flex-col ${alignClass} ${
                            isSelected
                              ? 'ring-2 ring-indigo-500 bg-indigo-500/10 border border-indigo-400'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute -top-2.5 left-2 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                              {meta.nameEn} (Editing)
                            </span>
                          )}

                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
                            {meta.nameBn.split(':')[1] || meta.nameBn}
                          </span>

                          <span 
                            className={`font-black transition-all ${getElementSizeClass(elemStyle.fontSize)}`}
                            style={{ color: elemStyle.color }}
                          >
                            {meta.exampleText}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-center text-[10px] text-slate-400">
                    সামনের পাশ দেখতে উল্টান বাটনে ক্লিক করুন
                  </div>
                </div>
              )}
            </div>

            {/* Quick Summary Badge */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">সিলেক্টেড এলিমেন্ট:</span>
                <span className="font-bold text-indigo-400 uppercase">{activeElementMeta.nameEn}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">কালার & সাইজ:</span>
                <span className="font-mono text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block border" style={{ backgroundColor: activeElementStyle.color }} />
                  {activeElementStyle.color} ({activeElementStyle.fontSize})
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
