import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { X, CheckCircle, RefreshCw, Plus, Trash2, Sliders, Users, ToggleLeft, ToggleRight, Edit, AlertCircle, Copy, Check } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CourseSettingsProps {
  course: Course;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const CourseSettings: React.FC<CourseSettingsProps> = ({
  course,
  onClose,
  onSaveSuccess,
}) => {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [isDefault, setIsDefault] = useState(!!course.isDefault);
  const [isRestricted, setIsRestricted] = useState(!!course.isRestricted);
  
  // Manage list of authorized users as a state array
  const [allowedUsers, setAllowedUsers] = useState<string[]>(course.allowedUsers || []);
  const [newUserInput, setNewUserInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setTitle(course.title);
    setDescription(course.description);
    setIsDefault(!!course.isDefault);
    setIsRestricted(!!course.isRestricted);
    setAllowedUsers(course.allowedUsers || []);
    setBulkInput((course.allowedUsers || []).join('\n'));
  }, [course]);

  // Handle adding a single user
  const handleAddUser = () => {
    const input = newUserInput.trim();
    if (!input) return;

    if (allowedUsers.includes(input)) {
      setError('This user is already in the list.');
      return;
    }

    setAllowedUsers(prev => [...prev, input]);
    setNewUserInput('');
    setError(null);
  };

  // Handle removing a single user
  const handleRemoveUser = (userToRemove: string) => {
    setAllowedUsers(prev => prev.filter(u => u !== userToRemove));
  };

  // Sync bulk input when switching to bulk mode
  useEffect(() => {
    if (!isBulkMode) {
      setBulkInput(allowedUsers.join('\n'));
    }
  }, [isBulkMode, allowedUsers]);

  // Apply bulk input changes
  const handleApplyBulk = () => {
    const parsed = bulkInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Remove duplicates
    const unique = Array.from(new Set(parsed));
    setAllowedUsers(unique);
    setIsBulkMode(false);
    setError(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(course.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Course title is required!');
      return;
    }

    if (!window.confirm('Are you sure you want to update this course\'s settings?')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // If bulk mode is active, make sure we apply the current bulk changes before saving
      let finalAllowedUsers = [...allowedUsers];
      if (isBulkMode) {
        finalAllowedUsers = Array.from(new Set(
          bulkInput
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
        ));
      }

      const updatedCourse: Course = {
        ...course,
        title: title.trim(),
        description: description.trim(),
        isDefault: isDefault,
        isRestricted: isRestricted,
        allowedUsers: isRestricted ? finalAllowedUsers : [],
      };

      await setDoc(doc(db, 'courses', course.id), updatedCourse);
      
      setSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error updating course settings:', err);
      setError('Failed to update settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" id="course-settings-modal">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative animate-scale-up font-sans overflow-hidden border border-slate-100 flex flex-col m-4 max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Course Settings & Controls</h3>
              <p className="text-[10px] text-indigo-600 font-bold mt-0.5 font-sans flex items-center gap-1.5">
                <span>Code: {course.id}</span>
                <button 
                  onClick={handleCopyCode} 
                  className="p-1 hover:bg-indigo-100/50 rounded text-indigo-500 hover:text-indigo-700 transition cursor-pointer"
                  title="Copy share code"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Course settings updated successfully!</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-600 block">Course Title <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
              placeholder="Enter course title"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-600 block">Course Description</label>
            <textarea
              rows={2.5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-semibold transition resize-none text-slate-700"
              placeholder="Enter course description..."
            />
          </div>

          {/* Control Toggles */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/60 space-y-4">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide block">Course Access Configuration</span>
            
            {/* Toggle: Default Course */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-700 block">Set as Default Course</span>
                <span className="text-[10px] text-slate-400 font-medium block">When active, this course will automatically be enrolled for all students.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDefault(!isDefault)}
                className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
              >
                {isDefault ? (
                  <ToggleRight className="w-9 h-9 text-indigo-600" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-350" />
                )}
              </button>
            </div>

            {/* Toggle: Restricted Access */}
            <div className="border-t border-slate-200/60 pt-3.5 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-700 block">Restricted Access</span>
                <span className="text-[10px] text-slate-400 font-medium block">When active, only enrolled email or phone numbers can access this course.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRestricted(!isRestricted)}
                className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
              >
                {isRestricted ? (
                  <ToggleRight className="w-9 h-9 text-indigo-600" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-350" />
                )}
              </button>
            </div>

            {/* Restricted User Management Area */}
            {isRestricted && (
              <div className="border-t border-slate-200/60 pt-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold text-slate-600 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>Allowed Users ({allowedUsers.length})</span>
                  </span>
                  
                  {/* Mode switcher */}
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(!isBulkMode)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                    <span>{isBulkMode ? 'List Mode' : 'Bulk Import'}</span>
                  </button>
                </div>

                {isBulkMode ? (
                  /* Bulk Textarea Input Mode */
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="Enter one email or phone number per line. Example:&#10;user@example.com&#10;01712345678"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition resize-none text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulk}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-xs rounded-xl transition cursor-pointer"
                    >
                      Apply List Changes
                    </button>
                  </div>
                ) : (
                  /* Individual Add / List Mode */
                  <div className="space-y-3">
                    {/* Add Inline Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUserInput}
                        onChange={(e) => setNewUserInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddUser();
                          }
                        }}
                        placeholder="Enter email or phone number"
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-medium transition text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={handleAddUser}
                        className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center justify-center cursor-pointer"
                        title="Add to List"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Interactive List view */}
                    {allowedUsers.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-white/50 border border-dashed border-slate-200 rounded-xl text-[10px] font-semibold">
                        No students are authorized yet. Add an email or phone number above.
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto bg-white border border-slate-150 rounded-xl divide-y divide-slate-100 scrollbar-thin">
                        {allowedUsers.map(user => (
                          <div key={user} className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                            <span className="font-mono truncate">{user}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(user)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3.5">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Update Settings</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
