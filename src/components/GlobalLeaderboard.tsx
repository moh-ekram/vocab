import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { 
  Crown, Trophy, Award, Flame, RefreshCw, Search, 
  HelpCircle, Star, Users, Medal, GraduationCap 
} from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  email: string;
  displayName: string;
  streak: number;
  knowCount: number;
  quizScore: number;
  quizTaken: number;
  points: number;
  isCurrentUser: boolean;
}

export default function GlobalLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [currentUserData, setCurrentUserData] = useState<LeaderboardEntry | null>(null);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const list: LeaderboardEntry[] = [];
      const currentUserId = auth.currentUser?.uid;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const progressObj = data.progress || {};
        
        // Count words marked as 'know'
        let knowCount = 0;
        Object.values(progressObj).forEach((p: any) => {
          if (p?.status === 'know') {
            knowCount++;
          }
        });

        const streak = data.goal?.streak || 0;
        const quizScore = data.quizScore || 0;
        const quizTaken = data.quizTaken || 0;

        // Calculate total points
        // 10 pts per learned word, 15 pts per correct quiz answer, 25 pts per day streak
        const points = (knowCount * 10) + (quizScore * 15) + (streak * 25);

        list.push({
          id: doc.id,
          email: data.email || 'Anonymous',
          displayName: data.displayName || data.email?.split('@')[0] || 'শিক্ষার্থী',
          streak,
          knowCount,
          quizScore,
          quizTaken,
          points,
          isCurrentUser: currentUserId === doc.id
        });
      });

      // Sort by points descending, then streak descending
      const sorted = list.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.streak - a.streak;
      });

      setLeaderboard(sorted);

      // Locate current user rank
      if (currentUserId) {
        const rankIndex = sorted.findIndex(item => item.id === currentUserId);
        if (rankIndex !== -1) {
          setCurrentUserRank(rankIndex + 1);
          setCurrentUserData(sorted[rankIndex]);
        }
      }
    } catch (err) {
      console.error("Error fetching global leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const filteredLeaderboard = leaderboard.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const top10 = filteredLeaderboard.slice(0, 10);
  const podium = top10.slice(0, 3);
  // Re-order podium as: 2nd, 1st, 3rd for podium visualization
  const sortedPodium = [];
  if (podium[1]) sortedPodium.push(podium[1]); // 2nd
  if (podium[0]) sortedPodium.push(podium[0]); // 1st
  if (podium[2]) sortedPodium.push(podium[2]); // 3rd

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="global-leaderboard-panel">
      
      {/* Header banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-850 text-white rounded-3xl p-6 md:p-8 shadow-md border border-indigo-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="w-8 h-8 text-amber-400 animate-bounce" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">গ্লোবাল মেমোরি লিডারবোর্ড</h1>
          </div>
          <p className="text-indigo-200 text-sm font-sans font-medium leading-relaxed max-w-xl">
            অন্যান্য সকল বাস্তব শিক্ষার্থীর সাথে আপনার মেমোরি রিটেনশন এবং কুইজ পারফরম্যান্সের পয়েন্ট রিয়েল-টাইমে তুলনা করুন।
          </p>
        </div>

        <button 
          onClick={fetchLeaderboardData}
          disabled={loading}
          className="px-4 py-2.5 bg-indigo-700/50 hover:bg-indigo-600/60 border border-indigo-650/80 rounded-xl transition-all font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ করুন</span>
        </button>
      </div>

      {/* Point Rules & My Rank Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* How points are calculated */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-indigo-600 fill-indigo-100" />
            <span>পয়েন্ট হিসেব করার নিয়মাবলী</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">শব্দ জানা</span>
              <p className="text-lg font-black text-indigo-600 font-mono">+১০ পয়েন্ট</p>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 font-semibold">প্রতিটি 'পারি' (Learned) শব্দের জন্য</p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">কুইজ পারফরম্যান্স</span>
              <p className="text-lg font-black text-emerald-600 font-mono">+১৫ পয়েন্ট</p>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 font-semibold">কুইজে প্রতিটি সঠিক উত্তরের জন্য</p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">ধারাবাহিকতা বোনাস</span>
              <p className="text-lg font-black text-amber-600 font-mono">+২৫ পয়েন্ট</p>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 font-semibold">প্রতিদিনের মেমোরি স্ট্রাইক (Streak)-এর জন্য</p>
            </div>
          </div>
        </div>

        {/* Current User Rank Summary Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 border border-indigo-200/60 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-500 font-sans">আমার বর্তমান র‍্যাঙ্কিং</h3>
            {currentUserRank !== null && currentUserData ? (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-indigo-950 font-mono">#{currentUserRank}</span>
                <span className="text-xs font-semibold text-slate-500">তম স্থানে</span>
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500">লগইন করুন অথবা পয়েন্ট অর্জন করে নিজেকে তালিকায় যোগ করুন!</p>
            )}
          </div>

          {currentUserData && (
            <div className="flex justify-between items-center pt-4 border-t border-indigo-150/50 text-xs font-sans font-semibold text-slate-600">
              <div className="space-y-0.5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">আমার মোট পয়েন্ট</p>
                <p className="text-base font-black text-indigo-600 font-mono">{currentUserData.points} XP</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">জানা শব্দ</p>
                <p className="text-sm font-black text-slate-700 font-mono">{currentUserData.knowCount}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Podium Showcase for Top 3 (Responsive Container) */}
      {!loading && leaderboard.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
          <h2 className="text-base font-black text-slate-800 text-center flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 fill-amber-100" />
            <span>শীর্ষ মেমোরি চ্যাম্পিয়নদের পোডিয়াম</span>
          </h2>

          <div className="flex flex-col sm:flex-row justify-center items-end gap-6 sm:gap-4 max-w-2xl mx-auto pt-6 pb-2 min-h-[220px]">
            {/* 2nd place */}
            {podium[1] && (
              <div className="flex-1 w-full flex flex-col items-center order-2 sm:order-1">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center font-bold text-xl text-slate-600 font-mono relative">
                    {podium[1].displayName ? podium[1].displayName[0].toUpperCase() : 'U'}
                    <span className="absolute -bottom-1.5 -right-1 w-6 h-6 rounded-full bg-slate-300 border border-white text-[10px] font-black text-slate-800 flex items-center justify-center shadow-xs">#2</span>
                  </div>
                </div>
                <p className="mt-3 text-xs font-black text-slate-800 text-center truncate max-w-[120px]">{podium[1].displayName}</p>
                <p className="text-[11px] font-black text-indigo-600 font-mono mt-0.5">{podium[1].points} XP</p>
                
                {/* 2nd place Podium column block */}
                <div className="hidden sm:block mt-4 w-28 h-20 bg-gradient-to-t from-slate-200 to-slate-100 border-t border-slate-300 rounded-t-xl flex items-center justify-center text-slate-500 font-extrabold text-xs">
                  Silver
                </div>
              </div>
            )}

            {/* 1st place */}
            {podium[0] && (
              <div className="flex-1 w-full flex flex-col items-center order-1 sm:order-2">
                <div className="relative -mt-6">
                  {/* Glowing gold Crown */}
                  <Crown className="w-7 h-7 text-amber-500 fill-amber-100 absolute -top-5 left-1/2 transform -translate-x-1/2 filter drop-shadow-[0_1px_2px_rgba(217,119,6,0.3)]" />
                  <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-400 flex items-center justify-center font-black text-2xl text-amber-700 relative shadow-md shadow-amber-500/10">
                    {podium[0].displayName ? podium[0].displayName[0].toUpperCase() : 'U'}
                    <span className="absolute -bottom-1.5 -right-1 w-7 h-7 rounded-full bg-amber-400 border border-white text-xs font-black text-white flex items-center justify-center shadow-md">#1</span>
                  </div>
                </div>
                <p className="mt-3 text-sm font-black text-slate-900 text-center truncate max-w-[140px]">{podium[0].displayName}</p>
                <p className="text-xs font-black text-indigo-600 font-mono mt-0.5">{podium[0].points} XP</p>
                
                {/* 1st place Podium column block */}
                <div className="hidden sm:block mt-4 w-32 h-28 bg-gradient-to-t from-amber-100/80 to-amber-50/50 border-t border-amber-300 rounded-t-xl flex items-center justify-center text-amber-700 font-black text-sm shadow-xs">
                  Champion
                </div>
              </div>
            )}

            {/* 3rd place */}
            {podium[2] && (
              <div className="flex-1 w-full flex flex-col items-center order-3 sm:order-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-amber-100/30 border-2 border-amber-700/40 flex items-center justify-center font-bold text-lg text-amber-900 font-mono relative">
                    {podium[2].displayName ? podium[2].displayName[0].toUpperCase() : 'U'}
                    <span className="absolute -bottom-1.5 -right-1 w-5 h-5 rounded-full bg-amber-700/30 border border-white text-[9px] font-black text-amber-900 flex items-center justify-center shadow-xs">#3</span>
                  </div>
                </div>
                <p className="mt-3 text-xs font-black text-slate-800 text-center truncate max-w-[120px]">{podium[2].displayName}</p>
                <p className="text-[11px] font-black text-indigo-600 font-mono mt-0.5">{podium[2].points} XP</p>
                
                {/* 3rd place Podium column block */}
                <div className="hidden sm:block mt-4 w-28 h-14 bg-gradient-to-t from-amber-550/15 to-amber-100/5 border-t border-amber-700/20 rounded-t-xl flex items-center justify-center text-amber-850 font-extrabold text-xs">
                  Bronze
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Rankings List Card */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-4">
        
        {/* Search controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>শীর্ষ ১০ শিক্ষার্থী তালিকা</span>
          </h2>
          
          <div className="relative max-w-sm w-full font-sans">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="শিক্ষার্থীর নাম দিয়ে খুঁজুন..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-bold bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl outline-hidden transition"
            />
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-400">মেমোরি লিডারবোর্ড লোড হচ্ছে...</p>
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-slate-200 rounded-2xl">
            <p className="text-sm font-bold text-slate-400 font-sans">কোন শিক্ষার্থী পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="space-y-3">
            {top10.map((player, index) => {
              const rank = index + 1;
              const isCurrent = player.isCurrentUser;

              return (
                <div 
                  key={player.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrent 
                      ? 'bg-gradient-to-r from-indigo-50/50 to-indigo-100/10 border-indigo-200/80 shadow-xs ring-1 ring-indigo-100' 
                      : 'bg-slate-50/40 hover:bg-slate-50/90 border-slate-200/60'
                  }`}
                >
                  {/* Left Section: Rank, Avatar and Name */}
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Rank Badge */}
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      {rank === 1 ? (
                        <Medal className="w-7 h-7 text-amber-500 fill-amber-100" />
                      ) : rank === 2 ? (
                        <Medal className="w-7 h-7 text-slate-400 fill-slate-50" />
                      ) : rank === 3 ? (
                        <Medal className="w-7 h-7 text-amber-700 fill-amber-50" />
                      ) : (
                        <span className="text-slate-400 font-black font-mono text-xs">#{rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border flex-shrink-0 ${
                      isCurrent 
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-600 font-mono'
                    }`}>
                      {player.displayName ? player.displayName[0].toUpperCase() : 'U'}
                    </div>

                    {/* Name & Email */}
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate flex items-center gap-1.5">
                        {player.displayName}
                        {isCurrent && (
                          <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black tracking-wider uppercase">YOU</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">{player.email}</p>
                    </div>
                  </div>

                  {/* Right Section: Stats Row */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 sm:border-transparent">
                    {/* Stats badges */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
                      {/* Known words */}
                      <div className="px-2.5 py-1 bg-white border border-slate-150 rounded-xl flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <span className="text-slate-400 font-bold text-[9px] uppercase">জানা শব্দ:</span>
                        <span className="font-mono font-black text-slate-700">{player.knowCount}</span>
                      </div>

                      {/* Quiz Count */}
                      <div className="px-2.5 py-1 bg-white border border-slate-150 rounded-xl flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <span className="text-slate-400 font-bold text-[9px] uppercase">কুইজ:</span>
                        <span className="font-mono font-black text-slate-700">{player.quizTaken}</span>
                      </div>

                      {/* Quiz Score */}
                      <div className="px-2.5 py-1 bg-white border border-slate-150 rounded-xl flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <span className="text-slate-400 font-bold text-[9px] uppercase">স্কোর:</span>
                        <span className="font-mono font-black text-slate-700">{player.quizScore}</span>
                      </div>

                      {/* Streak */}
                      <div className="px-2.5 py-1 bg-white border border-slate-150 rounded-xl flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <span className="text-slate-400 font-bold text-[9px] uppercase">স্ট্রাইক:</span>
                        {player.streak > 0 ? (
                          <div className="flex items-center gap-0.5">
                            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span className="font-mono text-xs text-amber-600 font-black">{player.streak}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold font-mono">-</span>
                        )}
                      </div>
                    </div>

                    {/* Total points */}
                    <div className="text-right flex items-center gap-2 sm:flex-col sm:items-end justify-between w-full sm:w-auto bg-indigo-50/30 sm:bg-transparent px-2.5 py-1 sm:p-0 rounded-xl mt-1 sm:mt-0 min-w-[70px]">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider sm:hidden md:block">পয়েন্ট</span>
                      <span className="text-xs font-black text-indigo-600 font-mono block">
                        {player.points} XP
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-[11px] text-slate-400 font-sans font-semibold">
          <span>মোট শিক্ষার্থী: {filteredLeaderboard.length} জন</span>
          <span>শুধুমাত্র টপ ১০ মেম্বারদের প্রদর্শন করা হচ্ছে</span>
        </div>
      </div>
    </div>
  );
}
