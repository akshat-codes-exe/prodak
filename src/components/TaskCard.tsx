import React, { useState, useEffect } from "react";
import { Task } from "../types";
import { 
  Clock, CheckCircle, Circle, Edit2, Trash2, Calendar, ChevronDown, ChevronUp, AlertCircle, Sparkles, CheckSquare, GripVertical, Repeat, Play 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TaskCardProps {
  key?: string;
  task: Task;
  onToggleStatus: (id: string) => void | Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string) => void | Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void | Promise<void>;
  onStartTask?: (id: string) => void | Promise<void>;
  aiRecommendation?: {
    dynamicPriority: "low" | "medium" | "high";
    planningScore: number;
    rationale: string;
    suggestedAction: string;
  };
  index?: number;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

export default function TaskCard({ 
  task, 
  onToggleStatus, 
  onToggleSubtask, 
  onEdit, 
  onDelete,
  onStartTask,
  aiRecommendation,
  index,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging = false
}: TaskCardProps) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isOverdue, setIsOverdue] = useState(false);
  const [isCardDraggable, setIsCardDraggable] = useState(false);

  const startMs = task.deadline ? new Date(task.deadline).getTime() - (task.estimatedMinutes || 30) * 60 * 1000 : 0;
  const isPastStart = task.deadline ? Date.now() >= startMs : false;

  // Dynamic Deadline Ticker
  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!task.deadline) {
        setTimeLeft("No deadline");
        setIsUrgent(false);
        setIsOverdue(false);
        return;
      }

      const diff = new Date(task.deadline).getTime() - Date.now();
      
      if (diff <= 0) {
        setTimeLeft("Overdue");
        setIsOverdue(true);
        setIsUrgent(true);
        return;
      }

      setIsOverdue(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);

      // Mark as urgent if less than 24 hours left
      setIsUrgent(diff < 1000 * 60 * 60 * 24);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m remaining`);
      } else {
        setTimeLeft(`${mins}m remaining`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 30000); // update every 30 seconds

    return () => clearInterval(interval);
  }, [task.deadline]);

  // Compute subtask progress
  const completedSubs = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubs = task.subtasks?.length || 0;
  const progressPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  // Visual Styling depending on priority
  let priorityBorder = "border-forest-border/40 hover:border-forest-border";
  let priorityLabelColor = "text-earth-sage bg-forest-light/40";
  
  if (task.status !== "completed") {
    if (task.priority === "high") {
      priorityBorder = "border-red-500/35 hover:border-red-400/60 bg-gradient-to-br from-red-950/20 to-forest-card shadow-[0_0_12px_rgba(239,68,68,0.08)] hover:shadow-[0_0_20px_rgba(239,68,68,0.18)]";
      priorityLabelColor = "text-red-400 bg-red-950/40 border border-red-500/20";
    } else if (task.priority === "medium") {
      priorityBorder = "border-amber-500/25 hover:border-amber-400/50 bg-gradient-to-br from-amber-950/15 to-forest-card shadow-[0_0_10px_rgba(245,158,11,0.04)] hover:shadow-[0_0_16px_rgba(245,158,11,0.10)]";
      priorityLabelColor = "text-amber-400 bg-amber-950/40 border border-amber-500/20";
    } else if (task.priority === "low") {
      priorityBorder = "border-emerald-600/20 hover:border-emerald-500/40 bg-gradient-to-br from-emerald-950/15 to-forest-card shadow-sm";
      priorityLabelColor = "text-emerald-400 bg-emerald-950/40 border border-emerald-500/20";
    }
  } else {
    priorityBorder = "border-forest-border/20 bg-forest-darkest/10 opacity-50 shadow-none";
    priorityLabelColor = "text-earth-sage/50 bg-forest-light/10 border border-transparent";
  }

  return (
    <motion.div
      id={`task-card-${task.id}`}
      layout
      draggable={isCardDraggable}
      onDragStart={(e) => {
        if (onDragStart && index !== undefined) {
          onDragStart(e, index);
        }
      }}
      onDragOver={(e) => {
        if (onDragOver && index !== undefined) {
          onDragOver(e, index);
        }
      }}
      onDragEnd={() => {
        setIsCardDraggable(false);
        if (onDragEnd) {
          onDragEnd();
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`p-5 rounded-2xl bg-forest-card border shadow-lg flex flex-col gap-4.5 transition-all ${priorityBorder} ${
        isDragging ? "opacity-35 border-dashed border-earth-sand/60 bg-forest-card/50 scale-[0.98] select-none" : ""
      }`}
    >
      {/* Top row: Title & Checkbox */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 w-full">
          {onDragStart && (
            <button
              id={`drag-handle-${task.id}`}
              type="button"
              onMouseDown={() => setIsCardDraggable(true)}
              onMouseUp={() => setIsCardDraggable(false)}
              onMouseLeave={() => setIsCardDraggable(false)}
              onTouchStart={() => setIsCardDraggable(true)}
              onTouchEnd={() => setIsCardDraggable(false)}
              className="mt-1 text-earth-sage/35 hover:text-earth-sand cursor-grab active:cursor-grabbing transition-colors shrink-0 p-0.5 rounded hover:bg-forest-light/30"
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>
          )}

          <button
            id={`toggle-status-btn-${task.id}`}
            onClick={() => onToggleStatus(task.id)}
            className="mt-1 text-earth-sage hover:text-earth-sand transition-colors shrink-0 cursor-pointer"
          >
            {task.status === "completed" ? (
              <CheckCircle size={20} className="text-earth-sand fill-earth-sand/10" />
            ) : (
              <Circle size={20} className="hover:scale-105 transition-transform" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {/* Category */}
              <span className="text-[10px] uppercase tracking-wider font-mono text-earth-sage font-medium">
                {task.category}
              </span>
              
              <span className="text-[10px] text-earth-sage/40 font-mono">•</span>
              
              {/* Priority Label */}
              <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded font-mono font-medium ${priorityLabelColor}`}>
                {task.priority}
              </span>

              {/* In Progress Status Badge */}
              {task.status === "in_progress" && (
                <>
                  <span className="text-[10px] text-earth-sage/40 font-mono">•</span>
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-mono font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    In Progress
                  </span>
                </>
              )}

              {/* Estimated minutes */}
              {task.estimatedMinutes && (
                <>
                  <span className="text-[10px] text-earth-sage/40 font-mono">•</span>
                  <span className="text-[10px] text-earth-sage flex items-center gap-1 font-mono">
                    <Clock size={11} />
                    {task.estimatedMinutes}m
                  </span>
                </>
              )}

              {/* Recurrence Pattern */}
              {task.recurrence && task.recurrence !== "none" && (
                <>
                  <span className="text-[10px] text-earth-sage/40 font-mono">•</span>
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-mono font-medium text-earth-amber bg-yellow-950/20 flex items-center gap-1">
                    <Repeat size={10} />
                    {task.recurrence === "3_days_a_week" ? "3x/week" : task.recurrence}
                    {task.completedOccurrences && task.completedOccurrences > 0 ? (
                      <span className="text-earth-sage/80 normal-case font-mono ml-1">
                        ({task.completedOccurrences} {task.completedOccurrences === 1 ? "completion" : "completions"})
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </div>

            <h3 
              className={`font-sans text-base font-medium tracking-tight text-white ${
                task.status === "completed" ? "line-through text-earth-sage/40" : ""
              }`}
            >
              {task.title}
            </h3>

            {task.description && task.status !== "completed" && (
              <p className="text-xs text-earth-sage/80 mt-1 leading-relaxed line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {task.status === "todo" && onStartTask && (
            <button
              id={`start-task-timer-btn-${task.id}`}
              onClick={() => onStartTask(task.id)}
              className="px-2.5 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/25 rounded-lg transition-all duration-250 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(16,185,129,0.05)] text-[10px] font-bold font-mono tracking-wider uppercase"
              title={`Start Task & Focus Timer for ${task.estimatedMinutes || 30} minutes`}
            >
              <Play size={10} fill="currentColor" className="opacity-95" />
              <span>Start</span>
            </button>
          )}
          <button
            id={`edit-task-btn-${task.id}`}
            onClick={() => onEdit(task)}
            className="p-1.5 hover:bg-forest-light rounded-lg text-earth-sage hover:text-white transition-colors cursor-pointer"
            title="Edit Plan"
          >
            <Edit2 size={13} />
          </button>
          <button
            id={`delete-task-btn-${task.id}`}
            onClick={() => onDelete(task.id)}
            className="p-1.5 hover:bg-red-950/20 rounded-lg text-earth-sage hover:text-earth-clay transition-colors cursor-pointer"
            title="Delete Plan"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Mid row: Time Countdown ticker and Subtask Progress */}
      {task.status !== "completed" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-forest-border/20 text-xs">
          {/* Deadline Countdown */}
          {task.deadline ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-earth-sage font-mono">
                <Calendar size={13} className="shrink-0" />
                <span className={`text-[11px] font-medium ${
                  isOverdue 
                    ? "text-earth-clay font-bold" 
                    : isUrgent 
                      ? "text-earth-amber font-semibold animate-pulse" 
                      : "text-earth-sage"
                }`}>
                  {timeLeft}
                </span>
              </div>
              
              {/* Must-start visual hint */}
              {task.status === "todo" && (
                <div className={`text-[10px] font-mono flex items-center gap-1 ${
                  isPastStart 
                    ? "text-red-400 font-semibold animate-pulse" 
                    : "text-earth-sage/75"
                }`}>
                  <Clock size={11} className="shrink-0" />
                  <span>
                    {isPastStart 
                      ? `Must start now (Est: ${task.estimatedMinutes || 30}m)` 
                      : `Start by: ${new Date(startMs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`
                    }
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-earth-sage/50 italic font-mono">
              No target deadline
            </div>
          )}

          {/* Subtask count & progress bar */}
          {totalSubs > 0 && (
            <div className="flex flex-col gap-1.5 justify-center">
              <div className="flex justify-between text-[10px] text-earth-sage font-mono">
                <span>Steps: {completedSubs}/{totalSubs}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-1 bg-forest-darkest rounded-full overflow-hidden">
                <div 
                  className="h-full bg-earth-sand transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Recommendation Alert */}
      {task.status !== "completed" && aiRecommendation && (
        <div className="mt-1 p-3 bg-earth-moss/20 border border-earth-moss/40 rounded-xl flex gap-2.5 items-start">
          <Sparkles size={14} className="text-earth-sand shrink-0 mt-0.5" />
          <div className="text-[11px] text-earth-sage leading-relaxed">
            <span className="font-mono text-earth-sand uppercase font-bold tracking-wider mr-1.5 block md:inline">
              AI Recommendation ({aiRecommendation.planningScore} Urgent Score):
            </span>
            {aiRecommendation.rationale} <b className="text-white block mt-1 font-sans">{aiRecommendation.suggestedAction}</b>
          </div>
        </div>
      )}

      {/* Expand subtasks list checklist */}
      {totalSubs > 0 && (
        <div>
          <button
            id={`toggle-subtasks-drawer-${task.id}`}
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="flex items-center gap-1.5 text-[11px] text-earth-sage hover:text-earth-sand transition-colors font-mono cursor-pointer"
          >
            {showSubtasks ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showSubtasks ? "Hide action checklist" : `View action checklist (${totalSubs} steps)`}
          </button>

          <AnimatePresence>
            {showSubtasks && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pl-2 border-l border-forest-border/60 space-y-2 pt-1">
                  {task.subtasks.map((sub) => (
                    <div 
                      key={sub.id}
                      className="flex items-center gap-2.5 py-0.5"
                    >
                      <button
                        id={`toggle-subtask-state-${task.id}-${sub.id}`}
                        onClick={() => onToggleSubtask(task.id, sub.id)}
                        className="text-earth-sage hover:text-earth-sand transition-colors cursor-pointer shrink-0"
                      >
                        {sub.completed ? (
                          <CheckSquare size={13} className="text-earth-sand fill-earth-sand/10" />
                        ) : (
                          <div className="w-3.5 h-3.5 border border-earth-sage/60 rounded" />
                        )}
                      </button>
                      <span className={`text-xs text-earth-sage font-sans ${sub.completed ? "line-through text-earth-sage/40" : "text-white/90"}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
