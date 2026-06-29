import React, { useState, useEffect } from "react";
import { Task, SubTask } from "../types";
import { 
  X, Sparkles, Plus, Trash2, Clock, Calendar, AlertTriangle, CheckSquare, ListPlus, Loader2, HelpCircle, Mic, MicOff 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TaskFormProps {
  task?: Task | null; // If editing
  onSubmit: (taskData: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
  defaultDate?: string;
}

const COMMON_CATEGORIES = ["Work", "Personal", "Health", "Growth", "Urgent", "Finance"];

export default function TaskForm({ task, onSubmit, onClose, defaultDate }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState("Work");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [actualMinutes, setActualMinutes] = useState<number | "">("");
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "3_days_a_week" | "monthly">("none");

  // Web Speech API Integration
  const [activeListeningField, setActiveListeningField] = useState<"title" | "description" | "subtask" | null>(null);
  const [recognition, setRecognition] = useState<any>(null);

  const SpeechRecognition = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const isSpeechSupported = !!SpeechRecognition;

  useEffect(() => {
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [recognition]);

  const toggleListening = (field: "title" | "description" | "subtask") => {
    if (!isSpeechSupported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (activeListeningField === field) {
      if (recognition) {
        recognition.stop();
      }
      setActiveListeningField(null);
      return;
    }

    if (recognition) {
      recognition.stop();
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setActiveListeningField(field);
        setError("");
      };

      rec.onresult = (event: any) => {
        const currentResultIndex = event.resultIndex;
        const transcript = event.results[currentResultIndex][0].transcript;
        if (!transcript) return;

        if (field === "title") {
          setTitle((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
          });
        } else if (field === "description") {
          setDescription((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
          });
        } else if (field === "subtask") {
          setNewSubtaskTitle((prev) => {
            const trimmed = prev.trim();
            const text = trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
            return text.substring(0, 60);
          });
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setError("Microphone permission denied. Please enable mic access in your browser settings.");
        } else if (event.error === "no-speech") {
          // Quiet ignore or timeout warning
        } else {
          setError(`Voice Dictation Error: ${event.error}`);
        }
        setActiveListeningField(null);
      };

      rec.onend = () => {
        setActiveListeningField(null);
      };

      rec.start();
      setRecognition(rec);
    } catch (err: any) {
      console.error("Failed to start speech recognition", err);
      setError("Failed to start voice dictation module.");
      setActiveListeningField(null);
    }
  };

  // Populate fields if editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      if (COMMON_CATEGORIES.includes(task.category)) {
        setCategory(task.category);
        setShowCustomCategory(false);
      } else {
        setCategory("custom");
        setCustomCategory(task.category);
        setShowCustomCategory(true);
      }
      setDeadline(task.deadline || "");
      setEstimatedMinutes(task.estimatedMinutes || 30);
      setActualMinutes(task.actualMinutes !== undefined ? task.actualMinutes : "");
      setSubtasks(task.subtasks || []);
      setRecurrence(task.recurrence || "none");
    } else if (defaultDate) {
      setDeadline(defaultDate);
    } else {
      // Default to tomorrow same time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setMinutes(0);
      const isoTomorrow = tomorrow.toISOString().slice(0, 16);
      setDeadline(isoTomorrow);
    }
  }, [task, defaultDate]);

  const handleSuggestSubtasks = async () => {
    if (!title.trim()) {
      setError("Please enter a task title first so the AI knows what to break down.");
      return;
    }
    setError("");
    setAiGenerating(true);

    try {
      const response = await fetch("/api/ai/suggest-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate AI plan.");
      }

      const data = await response.json();
      if (data.subtasks && Array.isArray(data.subtasks)) {
        // Map suggested titles to subtasks with generated IDs
        const newSubs: SubTask[] = data.subtasks.map((s: any, idx: number) => ({
          id: `ai-${Date.now()}-${idx}`,
          title: typeof s === "string" ? s : s.title,
          completed: false
        }));
        setSubtasks(newSubs);
        if (data.estimatedMinutes) {
          setEstimatedMinutes(data.estimatedMinutes);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to reach planning engine. Ensure API Key is configured.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    if (subtasks.length >= 10) {
      setError("Maximum 10 subtasks per task supported (keeps your action list focused).");
      return;
    }
    setError("");
    const newSub: SubTask = {
      id: `manual-${Date.now()}`,
      title: newSubtaskTitle.trim().substring(0, 60),
      completed: false
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle("");
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("A task title is required.");
      return;
    }
    const finalCategory = category === "custom" ? customCategory.trim() || "General" : category;
    
    onSubmit({
      title: title.trim().substring(0, 200),
      description: description.trim().substring(0, 2000),
      priority,
      category: finalCategory,
      deadline,
      estimatedMinutes,
      actualMinutes: actualMinutes !== "" ? Number(actualMinutes) : undefined,
      status: task ? task.status : "todo",
      subtasks,
      recurrence
    });
  };

  return (
    <div id="task-form-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black"
      />

      {/* Form Card */}
      <motion.div 
        id="task-form-card"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-forest-card border border-forest-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-forest-border/40">
          <h2 className="font-display font-medium text-earth-sand text-lg tracking-wide flex items-center gap-2">
            <ListPlus size={18} />
            {task ? "Edit Plan Item" : "Schedule New Task"}
          </h2>
          <button 
            id="close-form-btn"
            onClick={onClose}
            className="text-earth-sage hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form id="task-form" onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex gap-2 p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-xs text-earth-clay">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5">Task Title *</label>
            <div className="relative">
              <input 
                id="task-title-input"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError("");
                }}
                maxLength={200}
                placeholder="What needs to be done? (e.g., Finalize presentation)"
                className="w-full bg-forest-darkest border border-forest-border rounded-xl pl-4 pr-36 py-3 text-sm text-white focus:bg-forest-darkest/90"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
                {isSpeechSupported && (
                  <button
                    id="speech-title-btn"
                    type="button"
                    onClick={() => toggleListening("title")}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      activeListeningField === "title"
                        ? "bg-red-950/50 border-red-500/50 text-red-400 animate-pulse"
                        : "bg-forest-light/60 hover:bg-forest-light border-forest-border/45 text-earth-sage hover:text-white"
                    }`}
                    title={activeListeningField === "title" ? "Stop dictating" : "Dictate title"}
                  >
                    {activeListeningField === "title" ? <MicOff size={13} /> : <Mic size={13} />}
                  </button>
                )}
                <button
                  id="ai-assist-subtasks-btn"
                  type="button"
                  onClick={handleSuggestSubtasks}
                  disabled={aiGenerating || !title.trim()}
                  className="py-1 px-2.5 rounded-lg bg-earth-moss/40 hover:bg-earth-moss/70 text-earth-sand border border-earth-moss/50 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:bg-earth-moss/40 cursor-pointer"
                >
                  {aiGenerating ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Sparkles size={11} className="text-earth-sand" />
                  )}
                  AI Steps
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono">Notes & Context</label>
              {isSpeechSupported && (
                <button
                  id="speech-desc-btn"
                  type="button"
                  onClick={() => toggleListening("description")}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                    activeListeningField === "description"
                      ? "bg-red-950/50 border-red-500/50 text-red-400 animate-pulse"
                      : "bg-forest-light/60 hover:bg-forest-light border-forest-border/45 text-earth-sage hover:text-white"
                  }`}
                  title={activeListeningField === "description" ? "Stop dictating" : "Dictate notes"}
                >
                  {activeListeningField === "description" ? (
                    <>
                      <MicOff size={11} /> Stop Dictation
                    </>
                  ) : (
                    <>
                      <Mic size={11} /> Dictate Notes
                    </>
                  )}
                </button>
              )}
            </div>
            <textarea 
              id="task-desc-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Add optional notes, links, or context to help with completion..."
              rows={3}
              className="w-full bg-forest-darkest border border-forest-border rounded-xl px-4 py-3 text-xs text-white resize-none"
            />
          </div>

          {/* Grid fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5">Priority Level</label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((p) => {
                  const isActive = priority === p;
                  let activeColors = "bg-forest-light text-earth-sage border-forest-border";
                  if (isActive) {
                    if (p === "low") activeColors = "bg-green-950/40 text-green-300 border-green-800/60";
                    if (p === "medium") activeColors = "bg-yellow-950/40 text-earth-amber border-yellow-800/60";
                    if (p === "high") activeColors = "bg-red-950/40 text-earth-clay border-red-900/60";
                  }
                  return (
                    <button
                      id={`priority-btn-${p}`}
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 px-3 border rounded-xl text-xs font-medium capitalize transition-all cursor-pointer ${activeColors}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5">Category</label>
              <div className="flex gap-2">
                <select 
                  id="task-category-select"
                  value={category}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategory(val);
                    setShowCustomCategory(val === "custom");
                  }}
                  className="bg-forest-darkest border border-forest-border rounded-xl px-3 py-2 text-xs text-white flex-1"
                >
                  {COMMON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>

                {showCustomCategory && (
                  <input 
                    id="task-custom-category-input"
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value.substring(0, 50))}
                    placeholder="New Category"
                    className="bg-forest-darkest border border-forest-border rounded-xl px-3 py-2 text-xs text-white w-1/2"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Deadline */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5 flex items-center gap-1">
                <Calendar size={11} />
                Completion Deadline
              </label>
              <input 
                id="task-deadline-input"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-forest-darkest border border-forest-border rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            {/* Recurrence Pattern */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5 flex items-center gap-1">
                <Clock size={11} />
                Recurrence Pattern
              </label>
              <select
                id="task-recurrence-select"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full bg-forest-darkest border border-forest-border rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="none">One-time (None)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="3_days_a_week">3 Days a Week (M-W-F)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Estimated Minutes */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5 flex items-center gap-1">
                <Clock size={11} />
                Est. Mins
              </label>
              <div className="flex items-center gap-2">
                <input 
                  id="task-duration-input"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Math.max(5, parseInt(e.target.value) || 30))}
                  className="bg-forest-darkest border border-forest-border rounded-xl px-3 py-2 text-xs text-white font-mono w-full"
                />
              </div>
            </div>

            {/* Actual Minutes */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5 flex items-center gap-1">
                <Clock size={11} className="text-emerald-400" />
                Actual Mins
              </label>
              <div className="flex items-center gap-2">
                <input 
                  id="task-actual-duration-input"
                  type="number"
                  min={0}
                  max={480}
                  step={5}
                  value={actualMinutes}
                  placeholder="Not set"
                  onChange={(e) => {
                    const val = e.target.value;
                    setActualMinutes(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                  }}
                  className="bg-forest-darkest border border-forest-border rounded-xl px-3 py-2 text-xs text-white font-mono w-full"
                />
              </div>
            </div>
          </div>

          {/* Subtasks Builder */}
          <div className="border-t border-forest-border/40 pt-4">
            <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono mb-1.5 flex justify-between items-center">
              <span>Action Steps / Checklist ({subtasks.length}/10)</span>
              {subtasks.length === 0 && (
                <span className="text-earth-sage/60 font-sans normal-case italic flex items-center gap-1">
                  <HelpCircle size={10} /> Tip: Click "AI Steps" above to auto-breakdown!
                </span>
              )}
            </label>

            {/* Existing Subtasks */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
              {subtasks.map((sub, index) => (
                <div 
                  key={sub.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-forest-darkest/40 border border-forest-border/30 hover:border-forest-border transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      id={`toggle-subtask-form-${sub.id}`}
                      type="button"
                      onClick={() => handleToggleSubtask(sub.id)}
                      className="text-earth-sage hover:text-earth-sand transition-colors cursor-pointer"
                    >
                      <CheckSquare size={14} className={sub.completed ? "text-earth-sand fill-earth-sand/10" : "text-earth-sage/60"} />
                    </button>
                    <span className={`text-xs text-white font-sans ${sub.completed ? "line-through text-earth-sage/50" : ""}`}>
                      <b className="font-mono text-earth-sage text-[10px] mr-1.5">0{index + 1}.</b>
                      {sub.title}
                    </span>
                  </div>
                  <button
                    id={`remove-subtask-form-${sub.id}`}
                    type="button"
                    onClick={() => handleRemoveSubtask(sub.id)}
                    className="text-earth-sage hover:text-earth-clay transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Input to add subtask */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  id="task-new-subtask-input"
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value.substring(0, 60))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="e.g., Gather requirements (max 60 chars)"
                  className="w-full bg-forest-darkest border border-forest-border rounded-xl pl-3 pr-10 py-2 text-xs text-white"
                />
                {isSpeechSupported && (
                  <button
                    id="speech-subtask-btn"
                    type="button"
                    onClick={() => toggleListening("subtask")}
                    className={`absolute right-2 top-1.5 p-1 rounded-lg border transition-all cursor-pointer ${
                      activeListeningField === "subtask"
                        ? "bg-red-950/50 border-red-500/50 text-red-400 animate-pulse"
                        : "bg-forest-light/60 hover:bg-forest-light border-forest-border/45 text-earth-sage hover:text-white"
                    }`}
                    title={activeListeningField === "subtask" ? "Stop dictating" : "Dictate subtask"}
                  >
                    {activeListeningField === "subtask" ? <MicOff size={12} /> : <Mic size={12} />}
                  </button>
                )}
              </div>
              <button
                id="add-subtask-btn"
                type="button"
                onClick={handleAddSubtask}
                className="p-2 bg-forest-light hover:bg-forest-light/80 border border-forest-border text-earth-sand rounded-xl cursor-pointer transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-forest-border/40 bg-forest-darkest/40 flex justify-end gap-3">
          <button 
            id="cancel-form-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-transparent hover:bg-forest-light text-earth-sage hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            id="submit-form-btn"
            type="submit"
            onClick={handleFormSubmit}
            className="px-5 py-2 bg-earth-sand hover:bg-earth-sand/90 text-forest-darkest font-medium rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-earth-sand/10 cursor-pointer"
          >
            {task ? "Save Modifications" : "Schedule Task"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
