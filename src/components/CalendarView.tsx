import React, { useState } from "react";
import { Task } from "../types";
import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, 
  CheckCircle, Circle, Edit2, Trash2, Clock, AlertCircle, CalendarDays
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CalendarViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onAddTaskOnDate: (date: Date) => void;
}

export default function CalendarView({
  tasks,
  onEditTask,
  onDeleteTask,
  onToggleStatus,
  onAddTaskOnDate
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Move to next month
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Move to previous month
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // Jump back to today
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Generate calendar cells (Monday start)
  const getCalendarCells = () => {
    const firstDay = new Date(year, month, 1);
    // getDay() is 0 (Sun) to 6 (Sat). We want 0 (Mon) to 6 (Sun).
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes index 6

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; dateKey: string }[] = [];

    // Prior month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: d.toDateString()
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({
        date: d,
        isCurrentMonth: true,
        dateKey: d.toDateString()
      });
    }

    // Next month days to pad to a clean grid (usually 42 cells to cover all configurations gracefully)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: d.toDateString()
      });
    }

    return cells;
  };

  const cells = getCalendarCells();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Get tasks scheduled for a specific date
  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => {
      if (!t.deadline) return false;
      const tDate = new Date(t.deadline).toDateString();
      return tDate === date.toDateString();
    });
  };

  const selectedDateTasks = getTasksForDate(selectedDate);

  // Helper for priorities color mapping
  const getPriorityColorClass = (priority: "low" | "medium" | "high") => {
    if (priority === "high") return "bg-red-500/20 text-red-400 border-red-900/50";
    if (priority === "medium") return "bg-yellow-500/20 text-earth-amber border-yellow-900/50";
    return "bg-green-500/20 text-green-400 border-green-900/50";
  };

  const getPriorityDotClass = (priority: "low" | "medium" | "high") => {
    if (priority === "high") return "bg-red-400";
    if (priority === "medium") return "bg-[#D4A373]";
    return "bg-[#A3AD9A]";
  };

  // Helper to determine the day cell's background color based on occupation (task density)
  // "darker shade means more occupied and lighter means less occupied"
  // Since our default empty cell is bg-[#181816] (very dark, almost black), we'll use a elegant custom transition
  // of earthy sage/forest green shades. The shades get progressively richer, denser and darker green
  // (e.g. Level 1: bg-[#1D211A], Level 2: bg-[#2A3324], Level 3: bg-[#3C4A33], Level 4: bg-[#4E6041])
  const getOccupiedBgClass = (count: number, isCurrentMonth: boolean, isSelected: boolean) => {
    if (isSelected) {
      return "bg-[#1F211E]";
    }
    if (count === 0) {
      return isCurrentMonth ? "bg-[#181816]" : "bg-[#181816]/40";
    }
    
    // Progressively darker, more intense shades for higher task counts
    if (count === 1) {
      return isCurrentMonth ? "bg-[#252B1E]" : "bg-[#252B1E]/40"; // Lightest tint
    }
    if (count === 2) {
      return isCurrentMonth ? "bg-[#323D29]" : "bg-[#323D29]/40"; // Moderate
    }
    if (count === 3 || count === 4) {
      return isCurrentMonth ? "bg-[#425237]" : "bg-[#425237]/40"; // Busy
    }
    return isCurrentMonth ? "bg-[#556947]" : "bg-[#556947]/40"; // Darkest/Most Occupied
  };

  return (
    <div id="calendar-view-container" className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full overflow-hidden p-1">
      {/* Calendar Grid Section */}
      <div className="xl:col-span-3 flex flex-col h-full bg-[#181816] border border-[#2C2C2A] rounded-2xl p-6 overflow-hidden">
        {/* Month Selector Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <CalendarIcon size={20} className="text-[#A3AD9A]" />
            <h2 className="text-xl font-bold tracking-tight text-[#E5E5E0]">
              {monthNames[month]} <span className="font-mono text-base text-[#888880] font-normal">{year}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="calendar-today-btn"
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg bg-[#2C2C2A] hover:bg-[#3C3C3A] text-xs font-mono tracking-wider uppercase text-[#E5E5E0] transition-colors cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center rounded-lg bg-[#2C2C2A] p-0.5 border border-[#2C2C2A]">
              <button
                id="calendar-prev-month-btn"
                onClick={prevMonth}
                className="p-1.5 hover:bg-[#3C3C3A] rounded-md text-[#888880] hover:text-[#E5E5E0] transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="w-[1px] h-4 bg-[#3C3C3A] mx-0.5" />
              <button
                id="calendar-next-month-btn"
                onClick={nextMonth}
                className="p-1.5 hover:bg-[#3C3C3A] rounded-md text-[#888880] hover:text-[#E5E5E0] transition-all cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Labels */}
        <div className="grid grid-cols-7 text-center mb-2">
          {dayLabels.map((label) => (
            <div 
              key={label} 
              className="text-xs uppercase tracking-widest font-mono text-[#666660] py-2 font-semibold"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Month Calendar Cells Grid */}
        <div className="grid grid-cols-7 gap-[1px] bg-[#2C2C2A] rounded-xl overflow-hidden border border-[#2C2C2A] flex-1 min-h-0">
          {cells.map((cell, idx) => {
            const dayTasks = getTasksForDate(cell.date);
            const activeDayTasks = dayTasks.filter(t => t.status !== "completed");
            const isToday = cell.date.toDateString() === new Date().toDateString();
            const isSelected = cell.date.toDateString() === selectedDate.toDateString();
            const cellBgClass = getOccupiedBgClass(dayTasks.length, cell.isCurrentMonth, isSelected);

            return (
              <div
                key={`${cell.dateKey}-${idx}`}
                onClick={() => setSelectedDate(cell.date)}
                className={`relative group flex flex-col p-2 min-h-0 cursor-pointer transition-all duration-200 select-none ${cellBgClass} hover:brightness-110 ${
                  !cell.isCurrentMonth ? "opacity-35" : ""
                } ${
                  isSelected ? "ring-2 ring-inset ring-[#A3AD9A]/80" : ""
                }`}
              >
                {/* Header within cell */}
                <div className="flex justify-between items-center mb-1">
                  <span 
                    className={`text-xs font-mono rounded-full w-5 h-5 flex items-center justify-center font-semibold ${
                      isToday 
                        ? "bg-[#A3AD9A] text-[#121211]" 
                        : isSelected 
                          ? "text-[#A3AD9A]" 
                          : "text-[#888880] group-hover:text-[#E5E5E0]"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  {/* Add action on hover */}
                  <button
                    id={`quick-add-${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTaskOnDate(cell.date);
                    }}
                    className="p-0.5 rounded bg-[#2C2C2A] hover:bg-[#A3AD9A] hover:text-[#121211] text-[#888880] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer duration-150"
                    title="Add task to this date"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Day Tasks indicators */}
                <div className="flex-1 overflow-hidden space-y-1 mt-1 pr-0.5 scrollbar-none">
                  {/* Visual dots if viewport is too small, or small text titles */}
                  <div className="hidden sm:block space-y-1">
                    {dayTasks.slice(0, 2).map(t => (
                      <div 
                        key={t.id}
                        className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-sans truncate font-medium ${
                          t.status === "completed"
                            ? "bg-transparent text-[#666660] border-transparent line-through"
                            : getPriorityColorClass(t.priority)
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full shrink-0 ${getPriorityDotClass(t.priority)}`} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[9px] text-[#888880] font-mono px-1.5 font-medium">
                        + {dayTasks.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Mobile-friendly: simple dot list */}
                  <div className="sm:hidden flex flex-wrap gap-1 mt-1">
                    {dayTasks.map(t => (
                      <span 
                        key={t.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          t.status === "completed" 
                            ? "bg-[#2C2C2A]" 
                            : getPriorityDotClass(t.priority)
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Color Shade Legend for Day Occupation */}
        <div className="flex items-center justify-end gap-2 mt-4 text-[10px] font-mono text-[#888880] shrink-0 border-t border-[#2C2C2A]/30 pt-3">
          <span className="font-medium">Occupation Density:</span>
          <div className="flex items-center gap-1.5 bg-[#121211]/60 px-2.5 py-1 rounded-lg border border-[#2C2C2A]/45">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-[#181816] border border-[#2C2C2A]" title="0 tasks" />
              <span className="text-[9px] text-[#666660]">None</span>
            </div>
            <span className="text-[#3C3C3A]">•</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-[#252B1E] border border-[#353D2B]" title="1 task" />
              <span className="text-[9px] text-[#A3AD9A]/80">Light</span>
            </div>
            <span className="text-[#3C3C3A]">•</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-[#323D29] border border-[#445237]" title="2 tasks" />
              <span className="text-[9px] text-[#A3AD9A]/95">Medium</span>
            </div>
            <span className="text-[#3C3C3A]">•</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-[#425237] border border-[#566B48]" title="3-4 tasks" />
              <span className="text-[9px] text-emerald-500/80">Busy</span>
            </div>
            <span className="text-[#3C3C3A]">•</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-[#556947] border border-[#6B855A]" title="5+ tasks" />
              <span className="text-[9px] text-emerald-400 font-bold animate-pulse">Dense</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Day Panel */}
      <div className="xl:col-span-1 flex flex-col bg-[#181816] border border-[#2C2C2A] rounded-2xl p-6 h-[500px] xl:h-full overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-[#2C2C2A] mb-4 shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-mono text-[#888880]">Selected Day</p>
            <h3 className="text-sm font-bold text-[#E5E5E0] font-mono mt-0.5">
              {selectedDate.toLocaleDateString("en-US", { 
                weekday: "short", 
                month: "short", 
                day: "numeric" 
              })}
            </h3>
          </div>
          <button
            id="panel-add-task-btn"
            onClick={() => onAddTaskOnDate(selectedDate)}
            className="p-2 rounded-xl bg-[#A3AD9A] hover:bg-[#929C89] text-[#121211] font-semibold transition-colors flex items-center justify-center cursor-pointer"
            title="Create new task on this date"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Selected Date Tasks List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {selectedDateTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#888880] px-4 py-8">
              <CalendarDays size={32} className="text-[#2C2C2A] mb-2" />
              <p className="text-xs font-medium">No tasks scheduled for this date</p>
              <button
                onClick={() => onAddTaskOnDate(selectedDate)}
                className="mt-3 text-xs text-[#A3AD9A] hover:underline font-mono"
              >
                Create a task
              </button>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {selectedDateTasks.map((t) => (
                <motion.div
                  id={`calendar-list-item-${t.id}`}
                  key={t.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-3.5 rounded-xl border bg-[#121211]/40 hover:bg-[#121211]/80 transition-all flex flex-col gap-2 ${
                    t.status === "completed" ? "border-[#2C2C2A]/50 opacity-60" : "border-[#2C2C2A]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      id={`calendar-toggle-status-${t.id}`}
                      onClick={() => onToggleStatus(t.id)}
                      className="mt-0.5 text-[#888880] hover:text-[#A3AD9A] transition-colors shrink-0"
                    >
                      {t.status === "completed" ? (
                        <CheckCircle size={15} className="text-[#A3AD9A]" />
                      ) : (
                        <Circle size={15} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold leading-snug break-words text-[#E5E5E0] ${
                        t.status === "completed" ? "line-through text-[#888880]" : ""
                      }`}>
                        {t.title}
                      </p>
                      {t.description && (
                        <p className="text-[10px] text-[#888880] truncate mt-1 break-words">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer metadata & buttons */}
                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#2C2C2A]/30">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold tracking-wider ${
                        t.priority === "high" 
                          ? "bg-red-950/40 text-red-400" 
                          : t.priority === "medium"
                            ? "bg-yellow-950/40 text-earth-amber"
                            : "bg-green-950/40 text-green-400"
                      }`}>
                        {t.priority}
                      </span>
                      {t.deadline && (
                        <span className="text-[9px] text-[#888880] font-mono flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(t.deadline).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`calendar-edit-task-${t.id}`}
                        onClick={() => onEditTask(t)}
                        className="p-1 text-[#888880] hover:text-[#E5E5E0] hover:bg-[#2C2C2A] rounded transition-all cursor-pointer"
                        title="Edit task"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        id={`calendar-delete-task-${t.id}`}
                        onClick={() => onDeleteTask(t.id)}
                        className="p-1 text-[#888880] hover:text-red-400 hover:bg-[#2C2C2A] rounded transition-all cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
