import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, AppSettings } from '../types';
import { Sparkles, Trophy, RotateCw, Play, Timer, Flame, Check, ArrowLeft } from 'lucide-react';

interface WordMatchGameProps {
  words: VocabularyWord[];
  activeGroup: number | null;
  settings?: AppSettings;
  onBack: () => void;
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
}

interface MatchCard {
  id: string;
  wordId: string;
  text: string;
  type: 'english' | 'bengali';
  isMatched: boolean;
}

export default function WordMatchGame({ words, activeGroup, settings, onBack, placeLabels }: WordMatchGameProps) {
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

    const matchSize = settings?.defaultMatchSize || 6;

    if (sourcePool.length < matchSize) {
      // Fallback to general pool if the group is too small
      sourcePool = [...words];
    }

    // Pick random words
    sourcePool.sort(() => Math.random() - 0.5);
    const selectedWords = sourcePool.slice(0, matchSize);

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
    <div className="bg-white border border-slate-200/60 rounded-3xl p-4 sm:p-6 md:p-8 shadow-xs max-w-2xl mx-auto space-y-4 sm:space-y-6" id="match-game-container">
      {/* Mini top row for back */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
        <button 
          onClick={onBack}
          className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-850 transition cursor-pointer flex items-center justify-center"
          title="Back to Hub"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="h-4 w-[1px] bg-slate-200" />
        <span className="text-xs font-black text-slate-600 font-sans">Practice Match Game</span>
      </div>

      {/* 1. SETUP GAME */}
      {!isPlaying ? (
        <div className="text-center space-y-6 py-6 animate-fadeIn">
          <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">Word Match Game</h2>
            <p className="text-sm text-slate-500 font-sans max-w-sm mx-auto">
              Match the {placeLabels?.place1 || 'English'} words on the left with their correct {placeLabels?.place2?.toLowerCase() || 'meanings'} on the right. See how fast you can complete the pairs!
            </p>
          </div>

          <button
            onClick={initGame}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 font-sans"
          >
            <Play className="w-4 h-4 fill-current" />
            Start Game
          </button>
        </div>
      ) : (
        /* 2. GAME BOARD */
        <div className="space-y-6 animate-fadeIn">
          {/* Header Progress */}
          <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 font-sans">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Timer className="w-4 h-4 text-indigo-500" />
              <span>Time: {timeElapsed} seconds</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span>Attempts: {attempts}</span>
            </div>
            <span className="text-xs font-extrabold text-indigo-600">
              Matched: {matchesCount} / 6
            </span>
          </div>

          {/* Cards Table */}
          {!isGameOver ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Left Side: English */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">{placeLabels?.place1 || 'English Word'}</span>
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

              {/* Right Side: Bengali meaning */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">{placeLabels?.place2 || 'Meaning'}</span>
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
                <h3 className="text-xl font-bold text-slate-800">Congratulations! You won!</h3>
                <p className="text-sm text-slate-500 font-sans">
                  You successfully matched all word pairs in <span className="font-bold text-indigo-600">{timeElapsed} seconds</span> and <span className="font-bold text-indigo-600">{attempts} attempts</span>!
                </p>
              </div>

              <button
                onClick={initGame}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 font-sans"
              >
                <RotateCw className="w-4 h-4" />
                Play Again
              </button>
            </div>
          )}

          {/* Quick instructions / reset */}
          {!isGameOver && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 font-sans">
              <span className="text-[11px] text-slate-400">Tip: Matching words automatically records progress to your dashboard.</span>
              <button
                onClick={initGame}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
