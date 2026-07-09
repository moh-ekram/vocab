import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord } from '../types';
import { Sparkles, Trophy, RotateCw, Play, Timer, Flame, Check } from 'lucide-react';

interface WordMatchGameProps {
  words: VocabularyWord[];
  activeGroup: number | null;
}

interface MatchCard {
  id: string;
  wordId: string;
  text: string;
  type: 'english' | 'bengali';
  isMatched: boolean;
}

export default function WordMatchGame({ words, activeGroup }: WordMatchGameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<MatchCard | null>(null);
  const [selectedRight, setSelectedRight] = useState<MatchCard | null>(null);

  // Score states
  const [attempts, setAttempts] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  // Timer reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start game / Reset Game
  const initGame = () => {
    let sourcePool = [...words];

    // Filter by group if possible
    if (activeGroup) {
      sourcePool = sourcePool.filter(w => w.group === activeGroup);
    }

    if (sourcePool.length < 5) {
      // Fallback to general pool if the group is too small
      sourcePool = [...words];
    }

    // Pick 6 random words
    sourcePool.sort(() => Math.random() - 0.5);
    const selectedWords = sourcePool.slice(0, 6);

    // Create cards
    const leftCards: MatchCard[] = selectedWords.map(w => ({
      id: `${w.id}-left`,
      wordId: w.id,
      text: w.word,
      type: 'english',
      isMatched: false
    }));

    const rightCards: MatchCard[] = selectedWords.map(w => ({
      id: `${w.id}-right`,
      wordId: w.id,
      text: w.meaning,
      type: 'bengali',
      isMatched: false
    }));

    // Shuffle left and right independently
    leftCards.sort(() => Math.random() - 0.5);
    rightCards.sort(() => Math.random() - 0.5);

    setCards([...leftCards, ...rightCards]);
    setSelectedLeft(null);
    setSelectedRight(null);
    setAttempts(0);
    setMatchesCount(0);
    setTimeElapsed(0);
    setIsGameOver(false);
    setIsPlaying(true);

    // Setup timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
  };

  // Clean timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Card select controller
  const handleCardClick = (card: MatchCard) => {
    if (card.isMatched) return;

    if (card.type === 'english') {
      if (selectedLeft?.id === card.id) {
        setSelectedLeft(null); // Deselect
      } else {
        setSelectedLeft(card);
      }
    } else {
      if (selectedRight?.id === card.id) {
        setSelectedRight(null); // Deselect
      } else {
        setSelectedRight(card);
      }
    }
  };

  // Matching check Effect
  useEffect(() => {
    if (selectedLeft && selectedRight) {
      setAttempts(prev => prev + 1);

      // Check match
      if (selectedLeft.wordId === selectedRight.wordId) {
        // MATCH FOUND
        setCards(prevCards =>
          prevCards.map(c =>
            c.wordId === selectedLeft.wordId ? { ...c, isMatched: true } : c
          )
        );
        setMatchesCount(prev => prev + 1);

        // Deselect
        setSelectedLeft(null);
        setSelectedRight(null);
      } else {
        // MISMATCH
        // Small delay so user sees selection, then clear
        const timeout = setTimeout(() => {
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 1000);
        return () => clearTimeout(timeout);
      }
    }
  }, [selectedLeft, selectedRight]);

  // Victory Condition Checker
  useEffect(() => {
    if (matchesCount === 6 && isPlaying) {
      setIsGameOver(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [matchesCount, isPlaying]);

  const leftColumn = cards.filter(c => c.type === 'english');
  const rightColumn = cards.filter(c => c.type === 'bengali');

  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-xs max-w-2xl mx-auto space-y-6" id="match-game-container">
      {/* 1. SETUP GAME */}
      {!isPlaying ? (
        <div className="text-center space-y-6 py-6 animate-fadeIn">
          <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">শব্দমিল খেলা (Word Match)</h2>
            <p className="text-sm text-slate-500 font-sans max-w-sm mx-auto">
              বাম পাশের ইংরেজি শব্দের সাথে ডান পাশের সঠিক বাংলা অর্থটি মিলাতে হবে। দ্রুততম সময়ে মিলাতে পারেন কি না দেখুন!
            </p>
          </div>

          <button
            onClick={initGame}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 font-sans"
          >
            <Play className="w-4 h-4 fill-current" />
            খেলা শুরু করুন
          </button>
        </div>
      ) : (
        /* 2. GAME BOARD */
        <div className="space-y-6 animate-fadeIn">
          {/* Header Progress */}
          <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 font-sans">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Timer className="w-4 h-4 text-indigo-500" />
              <span>সময়: {timeElapsed} সেকেন্ড</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span>চেষ্টা: {attempts} বার</span>
            </div>
            <span className="text-xs font-extrabold text-indigo-600">
              মিলেছে: {matchesCount} / 6
            </span>
          </div>

          {/* Cards Table */}
          {!isGameOver ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Left Side: English */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">ইংরেজি শব্দ</span>
                {leftColumn.map(card => {
                  const isSelected = selectedLeft?.id === card.id;
                  let borderStyle = 'border-slate-200/60 bg-white text-slate-700 hover:border-indigo-200 hover:shadow-xs';

                  if (card.isMatched) {
                    borderStyle = 'border-indigo-500 bg-indigo-50/40 text-indigo-800 opacity-60';
                  } else if (isSelected) {
                    borderStyle = 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-bold shadow-xs';
                  }

                  return (
                    <button
                      key={card.id}
                      disabled={card.isMatched}
                      onClick={() => handleCardClick(card)}
                      className={`w-full py-4 px-4 rounded-xl border text-sm font-semibold transition text-left h-16 flex items-center justify-between ${borderStyle}`}
                    >
                      <span>{card.text}</span>
                      {card.isMatched && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Right Side: Bengali */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">বাংলা অর্থ</span>
                {rightColumn.map(card => {
                  const isSelected = selectedRight?.id === card.id;
                  let borderStyle = 'border-slate-200/60 bg-white text-slate-700 hover:border-indigo-200 hover:shadow-xs';

                  if (card.isMatched) {
                    borderStyle = 'border-indigo-500 bg-indigo-50/40 text-indigo-800 opacity-60';
                  } else if (isSelected) {
                    borderStyle = 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-bold shadow-xs';
                  }

                  return (
                    <button
                      key={card.id}
                      disabled={card.isMatched}
                      onClick={() => handleCardClick(card)}
                      className={`w-full py-4 px-4 rounded-xl border text-xs sm:text-sm font-semibold transition text-left h-16 flex items-center justify-between font-sans ${borderStyle}`}
                    >
                      <span>{card.text}</span>
                      {card.isMatched && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 3. GAME OVER SUMMARY */
            <div className="text-center space-y-6 py-6">
              <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center animate-bounce">
                <Sparkles className="w-8 h-8 fill-current" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">অভিনন্দন! আপনি জয়ী হয়েছেন</h3>
                <p className="text-sm text-slate-500 font-sans">
                  আপনি <span className="font-bold text-indigo-600">{timeElapsed} সেকেন্ডে</span> এবং <span className="font-bold text-indigo-600">{attempts} টি চেষ্টায়</span> সফলভাবে সব শব্দ জোড়া মিলিয়েছেন!
                </p>
              </div>

              <button
                onClick={initGame}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 font-sans"
              >
                <RotateCw className="w-4 h-4" />
                আবার খেলুন
              </button>
            </div>
          )}

          {/* Quick instructions / reset */}
          {!isGameOver && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 font-sans">
              <span className="text-[11px] text-slate-400">টিপস: শব্দ মেলালে অটোমেটিক অগ্রগতি ড্যাশবোর্ডে আপডেট হবে।</span>
              <button
                onClick={initGame}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <RotateCw className="w-3.5 h-3.5" />
                রিসেট
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
