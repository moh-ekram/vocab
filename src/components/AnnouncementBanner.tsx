import React, { useState } from 'react';
import { Megaphone, X, ExternalLink, AlertCircle, CheckCircle2, Sparkles, Bell } from 'lucide-react';
import { AppSettings } from '../types';

interface AnnouncementBannerProps {
  settings: AppSettings;
}

export default function AnnouncementBanner({ settings }: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!settings.announcementEnabled || !settings.announcementText || dismissed) {
    return null;
  }

  const type = settings.announcementType || 'info';
  const isClosable = settings.announcementClosable !== false;

  const styleMap = {
    info: {
      bg: 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 text-white border-indigo-500/30 shadow-indigo-500/10',
      badge: 'bg-white/20 text-white',
      button: 'bg-white text-indigo-900 hover:bg-indigo-50 shadow-sm',
      icon: <Bell className="w-4 h-4 text-indigo-200 shrink-0 animate-bounce" />
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white border-amber-400/30 shadow-amber-500/10',
      badge: 'bg-black/20 text-white',
      button: 'bg-slate-900 text-amber-300 hover:bg-black shadow-sm',
      icon: <AlertCircle className="w-4 h-4 text-amber-200 shrink-0" />
    },
    success: {
      bg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-500/30 shadow-emerald-500/10',
      badge: 'bg-white/20 text-white',
      button: 'bg-white text-emerald-900 hover:bg-emerald-50 shadow-sm',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
    },
    promo: {
      bg: 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 text-white border-purple-500/30 shadow-purple-500/10',
      badge: 'bg-white/20 text-white',
      button: 'bg-white text-purple-900 hover:bg-purple-50 shadow-sm',
      icon: <Sparkles className="w-4 h-4 text-pink-200 shrink-0" />
    }
  };

  const currentStyle = styleMap[type] || styleMap.info;

  return (
    <div className={`relative z-40 border-b shadow-xs transition-all duration-300 ${currentStyle.bg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-white/10 shrink-0">
            <Megaphone className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${currentStyle.badge} shrink-0`}>
              Notice
            </span>
            <p className="text-xs sm:text-sm font-semibold leading-snug break-words">
              {settings.announcementText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-center">
          {settings.announcementLink && (
            <a
              href={settings.announcementLink}
              target={settings.announcementLink.startsWith('http') ? '_blank' : '_self'}
              rel="noopener noreferrer"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${currentStyle.button}`}
            >
              <span>{settings.announcementLinkText || 'বিস্তারিত দেখুন'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {isClosable && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Close notification"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
