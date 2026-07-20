import React, { useState } from 'react';
import { CustomFolder, VocabularyWord, UserProgress } from '../types';
import { FolderPlus, Trash2, BookOpen, Tag, Plus, Check, ChevronRight, X, Sparkles } from 'lucide-react';

interface CustomListsProps {
  folders: CustomFolder[];
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRemoveFromFolder: (wordId: string, folderId: string) => void;
  onLaunchFolderStudy: (folderId: string) => void;
}

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
];

export default function CustomLists({
  folders,
  words,
  progress,
  onCreateFolder,
  onDeleteFolder,
  onRemoveFromFolder,
  onLaunchFolderStudy
}: CustomListsProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(folders[0]?.id || null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), selectedColor);
    setNewFolderName('');
  };

  const activeFolder = folders.find(f => f.id === activeFolderId);

  // Get words in the active folder
  const folderWords = activeFolder
    ? words.filter(w => {
        const bookmarks = progress[w.id]?.bookmarks || [];
        return bookmarks.includes(activeFolder.id);
      })
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="custom-lists-container">
      {/* 1. Left side: Folders Checklist / Creator */}
      <div className="space-y-6">
        {/* Create new list folder */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <FolderPlus className="w-5 h-5 text-indigo-600" />
            Create New List
          </h3>

          <form onSubmit={handleCreate} className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">List Name</label>
              <input
                type="text"
                placeholder="e.g. GRE High Priority..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                maxLength={25}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-slate-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Tag Color</label>
              <div className="flex gap-2.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className="w-6 h-6 rounded-full flex items-center justify-center border border-white transition transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: c }}
                  >
                    {selectedColor === c && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!newFolderName.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              <Plus className="w-4 h-4" />
              Create List
            </button>
          </form>
        </div>

        {/* Existing Lists folders list */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <Tag className="w-5 h-5 text-indigo-600" />
            Your Lists
          </h3>

          <div className="space-y-2 font-sans">
            {folders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No custom lists created yet.</p>
            ) : (
              folders.map(f => {
                const count = words.filter(w => (progress[w.id]?.bookmarks || []).includes(f.id)).length;
                const isActive = activeFolderId === f.id;

                return (
                  <div
                    key={f.id}
                    onClick={() => setActiveFolderId(f.id)}
                    className={`group w-full flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: f.color }}></div>
                      <span className="text-xs">{f.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold text-[10px] rounded-md">
                        {count} Words
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(f.id);
                          if (activeFolderId === f.id) setActiveFolderId(folders[0]?.id || null);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 transition"
                        title="Delete List"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2. Right side: Folder details & terms table */}
      <div className="md:col-span-2 space-y-6">
        {activeFolder ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col justify-between min-h-[400px]">
            <div className="space-y-6">
              {/* Folder Details header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full shadow-inner" style={{ backgroundColor: activeFolder.color }}></div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{activeFolder.name}</h2>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">A total of {folderWords.length} words are saved in this list.</p>
                  </div>
                </div>

                {folderWords.length > 0 && (
                  <button
                    onClick={() => onLaunchFolderStudy(activeFolder.id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/10 font-sans"
                  >
                    <BookOpen className="w-4 h-4" />
                    Practice this List
                  </button>
                )}
              </div>

              {/* List of Words */}
              {folderWords.length === 0 ? (
                <div className="py-12 text-center max-w-sm mx-auto space-y-3 font-sans">
                  <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-700 text-sm">The list is empty!</p>
                    <p className="text-xs text-slate-400">Go to flashcards and add words to this list.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {folderWords.map(w => (
                    <div
                      key={w.id}
                      className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{w.word}</span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.5 rounded-md font-sans">
                            Group {w.group}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-sans">{w.meaning}</p>
                      </div>

                      <button
                        onClick={() => onRemoveFromFolder(w.id, activeFolder.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Remove from list"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 mt-6 text-xs text-slate-400 font-sans">
              Tip: You can create multiple lists to organize your studies.
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/60 shadow-xs text-center flex flex-col justify-center items-center h-[400px]">
            <p className="text-slate-400 font-sans">Please select a list or create a new list on the left.</p>
          </div>
        )}
      </div>
    </div>
  );
}
