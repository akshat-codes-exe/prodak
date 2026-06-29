import React, { useState } from "react";
import { Task } from "../types";
import { 
  TrendingUp, BarChart2, Award, AlertTriangle, RefreshCw, 
  Sparkles, CheckCircle2, Clock, Zap, ShieldAlert, BookOpen, ThumbsUp,
  Target, TrendingDown, Calendar, Flame, Hourglass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine
} from "recharts";

interface AIAnalysisViewProps {
  tasks: Task[];
}

interface AIReport {
  assessment: string;
  strengths: string[];
  recommendations: string[];
  focusWarning: string;
}

export default function AIAnalysisView({ tasks }: AIAnalysisViewProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AIReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisualTab, setSelectedVisualTab] = useState<"trends" | "efficiency" | "allocation" | "workload">("trends");
  const [showProcrastinationBreakdown, setShowProcrastinationBreakdown] = useState(false);
  const [dailyWorkloadLimit, setDailyWorkloadLimit] = useState<number>(() => {
    const saved = localStorage.getItem("nexus_sync_daily_workload_limit");
    return saved ? parseInt(saved, 10) : 240;
  });

  const handleLimitChange = (val: number) => {
    setDailyWorkloadLimit(val);
    localStorage.setItem("nexus_sync_daily_workload_limit", val.toString());
  };

  // Math & Metric Calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed");
  const activeTasks = tasks.filter(t => t.status !== "completed");
  
  // 1. Task Completion Rate
  const taskCompletionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

  // 2 & 3. On-time and Late completed percentages
  const completedWithDeadlines = completedTasks.filter(t => t.deadline);
  const onTimeCompleted = completedWithDeadlines.filter(t => {
    const completionTime = new Date(t.updatedAt).getTime();
    const deadlineTime = new Date(t.deadline).getTime();
    return completionTime <= deadlineTime;
  });
  const lateCompleted = completedWithDeadlines.filter(t => {
    const completionTime = new Date(t.updatedAt).getTime();
    const deadlineTime = new Date(t.deadline).getTime();
    return completionTime > deadlineTime;
  });

  const onTimePercentage = completedWithDeadlines.length > 0 
    ? (onTimeCompleted.length / completedWithDeadlines.length) * 100 
    : 0;
  
  const latePercentage = completedWithDeadlines.length > 0 
    ? (lateCompleted.length / completedWithDeadlines.length) * 100 
    : 0;

  // Format Duration Helper
  const formatDuration = (ms: number) => {
    if (ms <= 0) return "0m";
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  // 4. Average delay after deadline (for late tasks)
  const totalDelayMs = lateCompleted.reduce((acc, t) => {
    const delay = new Date(t.updatedAt).getTime() - new Date(t.deadline).getTime();
    return acc + (delay > 0 ? delay : 0);
  }, 0);
  const avgDelayMs = lateCompleted.length > 0 ? totalDelayMs / lateCompleted.length : 0;
  const avgDelayStr = lateCompleted.length > 0 ? formatDuration(avgDelayMs) : "No late delays";

  // 5. Average completion time (createdAt -> updatedAt for completed tasks)
  const totalCompletionTimeMs = completedTasks.reduce((acc, t) => {
    const duration = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
    return acc + (duration > 0 ? duration : 0);
  }, 0);
  const avgCompletionTimeMs = completedTasks.length > 0 ? totalCompletionTimeMs / completedTasks.length : 0;
  const avgCompletionTimeStr = completedTasks.length > 0 ? formatDuration(avgCompletionTimeMs) : "No completions yet";

  // 6. Completion rate by category
  const categories = Array.from(new Set(tasks.map(t => t.category).filter(Boolean)));
  const categoryStats = categories.map(cat => {
    const catTasks = tasks.filter(t => t.category === cat);
    const catCompleted = catTasks.filter(t => t.status === "completed");
    const rate = catTasks.length > 0 ? (catCompleted.length / catTasks.length) * 100 : 0;
    return { category: cat, total: catTasks.length, completed: catCompleted.length, rate };
  }).sort((a, b) => b.rate - a.rate);

  // 7. Completion rate by priority
  const priorities: Array<"low" | "medium" | "high"> = ["high", "medium", "low"];
  const priorityStats = priorities.map(prio => {
    const prioTasks = tasks.filter(t => t.priority === prio);
    const prioCompleted = prioTasks.filter(t => t.status === "completed");
    const rate = prioTasks.length > 0 ? (prioCompleted.length / prioTasks.length) * 100 : 0;
    return { priority: prio, total: prioTasks.length, completed: prioCompleted.length, rate };
  });

  // 8. Most frequently completed task type (category)
  const completedCounts: Record<string, number> = {};
  completedTasks.forEach(t => {
    if (t.category) {
      completedCounts[t.category] = (completedCounts[t.category] || 0) + 1;
    }
  });
  let maxCompletedCount = 0;
  let mostCompletedType = "None yet";
  Object.entries(completedCounts).forEach(([cat, count]) => {
    if (count > maxCompletedCount) {
      maxCompletedCount = count;
      mostCompletedType = cat;
    }
  });

  // 9. Most frequently abandoned task type (incomplete, and either overdue or stale > 3 days)
  const nowTime = new Date().getTime();
  const abandonedTasks = tasks.filter(t => {
    if (t.status === "completed") return false;
    const isOverdue = t.deadline && new Date(t.deadline).getTime() < nowTime;
    const isStale = (nowTime - new Date(t.createdAt).getTime()) > 3 * 24 * 60 * 60 * 1000;
    return isOverdue || isStale;
  });
  
  const abandonedCounts: Record<string, number> = {};
  abandonedTasks.forEach(t => {
    if (t.category) {
      abandonedCounts[t.category] = (abandonedCounts[t.category] || 0) + 1;
    }
  });
  let maxAbandonedCount = 0;
  let mostAbandonedType = "None identified";
  Object.entries(abandonedCounts).forEach(([cat, count]) => {
    if (count > maxAbandonedCount) {
      maxAbandonedCount = count;
      mostAbandonedType = cat;
    }
  });

  // --- Behavioral & Procrastination Analytics ---
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const completedByDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  completedTasks.forEach(t => {
    const day = new Date(t.updatedAt).getDay();
    completedByDay[day] = completedByDay[day] + 1;
  });

  let maxCompletions = -1;
  let mostProductiveDayNum = -1;
  let minCompletions = Infinity;
  let leastProductiveDayNum = -1;

  Object.entries(completedByDay).forEach(([dayStr, count]) => {
    const dayNum = parseInt(dayStr);
    if (count > maxCompletions) {
      maxCompletions = count;
      mostProductiveDayNum = dayNum;
    }
    if (count < minCompletions) {
      minCompletions = count;
      leastProductiveDayNum = dayNum;
    }
  });

  const mostProductiveDay = maxCompletions > 0 ? dayNames[mostProductiveDayNum] : "N/A";
  const leastProductiveDay = maxCompletions > 0 && minCompletions !== Infinity ? dayNames[leastProductiveDayNum] : "N/A";

  // Average tasks completed per day
  const completedByDate: Record<string, number> = {};
  completedTasks.forEach(t => {
    const dateStr = new Date(t.updatedAt).toISOString().split("T")[0];
    completedByDate[dateStr] = (completedByDate[dateStr] || 0) + 1;
  });
  const uniqueDatesCount = Object.keys(completedByDate).length;
  const avgCompletedPerDay = uniqueDatesCount > 0 ? completedTasks.length / uniqueDatesCount : 0;

  // Average snoozes before completion
  const totalSnoozes = completedTasks.reduce((acc, t) => acc + (t.snoozeCount || 0), 0);
  const avgSnoozesBeforeCompletion = completedTasks.length > 0 ? totalSnoozes / completedTasks.length : 0;

  // Procrastination score logic
  const overdueTasksCount = activeTasks.filter(t => t.deadline && new Date(t.deadline).getTime() < nowTime).length;
  const activeWithDeadlinesCount = activeTasks.filter(t => t.deadline).length;
  const overdueRatio = activeWithDeadlinesCount > 0 ? overdueTasksCount / activeWithDeadlinesCount : 0;

  const allTasksSnoozes = tasks.reduce((acc, t) => acc + (t.snoozeCount || 0), 0);
  const avgSnoozesAll = tasks.length > 0 ? allTasksSnoozes / tasks.length : 0;

  let oldestTaskAgeDays = 0;
  let longestPendingTask: Task | null = null;
  if (activeTasks.length > 0) {
    activeTasks.forEach(t => {
      const ageMs = nowTime - new Date(t.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > oldestTaskAgeDays) {
        oldestTaskAgeDays = ageDays;
        longestPendingTask = t;
      }
    });
  }

  const overduePoints = Math.round(overdueRatio * 35);
  const snoozePoints = Math.round(Math.min(2.5, avgSnoozesAll) * 10);
  const stalePoints = Math.round(Math.min(20, oldestTaskAgeDays));
  const latePoints = Math.round(latePercentage * 0.2);
  const procrastinationScore = Math.min(100, overduePoints + snoozePoints + stalePoints + latePoints);

  let procrastinationLabel = "Optimal Focus";
  let procrastinationColor = "text-emerald-400";
  let procrastinationAdvice = "Exceptional pace! You address deadlines instantly with minimum friction.";
  if (procrastinationScore > 75) {
    procrastinationLabel = "Severe Delays";
    procrastinationColor = "text-rose-500 animate-pulse";
    procrastinationAdvice = "High backlog and multiple alarm snoozes. Clear overdue subtasks or use shorter 15m intervals.";
  } else if (procrastinationScore > 50) {
    procrastinationLabel = "Moderate Procrastination";
    procrastinationColor = "text-amber-500";
    procrastinationAdvice = "Deadlines are starting to slip. Lock in custom Pomodoro timers to execute high-priority items.";
  } else if (procrastinationScore > 25) {
    procrastinationLabel = "Healthy Rhythm";
    procrastinationColor = "text-yellow-300";
    procrastinationAdvice = "Good consistency. Minimize alarm snoozes by breaking complex tasks down.";
  }

  // --- Snooze Tracking Analytics ---
  const tasksSortedBySnoozes = [...tasks]
    .filter(t => (t.snoozeCount || 0) > 0)
    .sort((a, b) => (b.snoozeCount || 0) - (a.snoozeCount || 0));
  const topSnoozedTasks = tasksSortedBySnoozes.slice(0, 3);


  // --- Time Estimation and Accuracy Intelligence ---
  const getActualMinutesForTask = (t: Task): number => {
    if (t.actualMinutes !== undefined && t.actualMinutes !== null) {
      return t.actualMinutes;
    }
    // Dynamically fallback based on real timestamps of completed task
    const created = new Date(t.createdAt).getTime();
    const completed = new Date(t.updatedAt).getTime();
    const diffMins = Math.round((completed - created) / 60000);
    if (diffMins > 0) {
      return Math.min(480, Math.max(5, diffMins));
    }
    // Safe logical default fallback based on priority
    const multiplier = t.priority === "high" ? 1.25 : t.priority === "medium" ? 1.0 : 0.85;
    return Math.round((t.estimatedMinutes || 30) * multiplier);
  };

  const completedWithEstimates = completedTasks.map(t => ({
    id: t.id,
    title: t.title,
    estimated: t.estimatedMinutes || 30,
    actual: getActualMinutesForTask(t),
    completedAt: new Date(t.updatedAt)
  }));

  const totalError = completedWithEstimates.reduce((acc, curr) => acc + Math.abs(curr.estimated - curr.actual), 0);
  const avgEstimationError = completedWithEstimates.length > 0 ? totalError / completedWithEstimates.length : 0;

  const totalPctError = completedWithEstimates.reduce((acc, curr) => {
    const error = Math.abs(curr.estimated - curr.actual);
    return acc + (error / curr.estimated) * 100;
  }, 0);
  const avgEstimationErrorPct = completedWithEstimates.length > 0 ? totalPctError / completedWithEstimates.length : 0;

  const totalEstimated = completedWithEstimates.reduce((acc, curr) => acc + curr.estimated, 0);
  const totalActual = completedWithEstimates.reduce((acc, curr) => acc + curr.actual, 0);

  let aiEstimationSuggestion = "Build a baseline by completing your first estimated tasks. We'll analyze your precision patterns!";
  if (completedWithEstimates.length > 0) {
    const ratio = totalActual / totalEstimated;
    if (ratio > 1.12) {
      aiEstimationSuggestion = `You tend to underestimate tasks by ${Math.round((ratio - 1) * 100)}%. We recommend adding a ${Math.round((ratio - 1) * 100)}% buffer (roughly ${Math.round((ratio - 1) * 15)}m per hour) to your future task estimates.`;
    } else if (ratio < 0.88) {
      aiEstimationSuggestion = `You tend to overestimate tasks by ${Math.round((1 - ratio) * 100)}%. Consider reducing your estimated durations by ${Math.round((1 - ratio) * 100)}% to optimize your scheduled calendar blocks.`;
    } else {
      aiEstimationSuggestion = "Phenomenal accuracy! Your estimates align almost perfectly with your actual completion times (within 10% variance). Continue with this high-fidelity pacing!";
    }
  }

  const sortedByCompletionTime = [...completedWithEstimates].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  const halfLength = Math.floor(sortedByCompletionTime.length / 2);
  let accuracyTrend = "Establish multiple completions to visualize accuracy maturation.";
  let accuracyChangeStr = "Awaiting data";
  let isImproving = true;

  if (sortedByCompletionTime.length >= 2) {
    const firstHalf = sortedByCompletionTime.slice(0, Math.max(1, halfLength));
    const secondHalf = sortedByCompletionTime.slice(Math.max(1, halfLength));

    const avgErrFirst = firstHalf.reduce((acc, curr) => acc + Math.abs(curr.estimated - curr.actual), 0) / firstHalf.length;
    const avgErrSecond = secondHalf.reduce((acc, curr) => acc + Math.abs(curr.estimated - curr.actual), 0) / secondHalf.length;

    if (avgErrFirst > avgErrSecond) {
      const pctImprovement = ((avgErrFirst - avgErrSecond) / (avgErrFirst || 1)) * 100;
      accuracyTrend = `Your estimation variance decreased from ${avgErrFirst.toFixed(0)}m in early tasks to ${avgErrSecond.toFixed(0)}m in recent completions!`;
      accuracyChangeStr = `+${pctImprovement.toFixed(0)}% focus refinement`;
      isImproving = true;
    } else if (avgErrFirst < avgErrSecond) {
      const pctDecline = ((avgErrSecond - avgErrFirst) / (avgErrFirst || 1)) * 100;
      accuracyTrend = `Variance increased slightly by ${Math.abs(avgErrFirst - avgErrSecond).toFixed(0)}m. Remember to log focused intervals using the pomodoro timer.`;
      accuracyChangeStr = `-${pctDecline.toFixed(0)}% deviation`;
      isImproving = false;
    } else {
      accuracyTrend = "Your estimation precision has completely locked into a balanced, stabilized rhythm.";
      accuracyChangeStr = "Stable precision";
      isImproving = true;
    }
  }

  // --- Visual Analytics Datasets ---
  
  // 1. Productivity over time (Last 7 Days completions)
  const last7DaysList = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  }).reverse();

  const productivityOverTimeData = last7DaysList.map(date => {
    const dateString = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("en-US", { weekday: "short" }) + " " + date.getDate();
    const count = completedTasks.filter(t => t.updatedAt && t.updatedAt.startsWith(dateString)).length;
    return {
      day: label,
      Completions: count
    };
  });

  // 2. Completed vs Delayed Tasks
  const completedVsDelayedData = last7DaysList.map(date => {
    const dateString = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    
    const completedOnDay = completedTasks.filter(t => t.updatedAt && t.updatedAt.startsWith(dateString));
    const completedOnTime = completedOnDay.filter(t => {
      if (!t.deadline) return true;
      return new Date(t.updatedAt).getTime() <= new Date(t.deadline).getTime();
    }).length;
    
    const completedDelayed = completedOnDay.filter(t => {
      if (!t.deadline) return false;
      return new Date(t.updatedAt).getTime() > new Date(t.deadline).getTime();
    }).length;

    return {
      day: label,
      "On-Time": completedOnTime,
      "Delayed": completedDelayed
    };
  });

  // 3. Estimated vs Actual Time
  const estimatedVsActualData = completedTasks
    .filter(t => t.estimatedMinutes !== undefined)
    .slice(-7) // Show last 7 completed tasks with estimates
    .map(t => {
      let act = t.actualMinutes;
      if (act === undefined || act === null) {
        const diffMs = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
        const diffMins = Math.round(diffMs / 60000);
        act = diffMins > 0 ? Math.min(480, Math.max(5, diffMins)) : (t.estimatedMinutes || 30);
      }
      return {
        taskName: t.title.length > 12 ? t.title.substring(0, 10) + "..." : t.title,
        Estimated: t.estimatedMinutes || 30,
        Actual: act
      };
    });

  // 4. Workload by Weekday (Active vs Completed by day of creation/completion)
  const workloadByWeekdayData = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((dayName, idx) => {
    const activeOnDay = activeTasks.filter(t => new Date(t.createdAt).getDay() === idx).length;
    const completedOnDay = completedTasks.filter(t => new Date(t.updatedAt).getDay() === idx).length;
    return {
      weekday: dayName.substring(0, 3),
      Active: activeOnDay,
      Completed: completedOnDay
    };
  });

  // 5. Completion rate by Category
  const uniqueCategories = Array.from(new Set(tasks.map(t => t.category || "General")));
  const categoryCompletionRateData = uniqueCategories.map(cat => {
    const categoryTasks = tasks.filter(t => (t.category || "General") === cat);
    const completedInCat = categoryTasks.filter(t => t.status === "completed").length;
    const rate = categoryTasks.length > 0 ? Math.round((completedInCat / categoryTasks.length) * 100) : 0;
    return {
      category: cat,
      "Completion Rate": rate,
      Total: categoryTasks.length
    };
  }).sort((a, b) => b["Completion Rate"] - a["Completion Rate"]);

  // 6. Priority distribution
  const priorityDistributionData = [
    { name: "High", value: tasks.filter(t => t.priority === "high").length, color: "#EF4444" },
    { name: "Medium", value: tasks.filter(t => t.priority === "medium").length, color: "#F59E0B" },
    { name: "Low", value: tasks.filter(t => t.priority === "low").length, color: "#10B981" }
  ].filter(p => p.value > 0);

  // 7. Focus hours heatmap (Hourly Completed Tasks distribution)
  const focusHoursDistribution = Array.from({ length: 24 }, (_, hour) => {
    const count = completedTasks.filter(t => new Date(t.updatedAt).getHours() === hour).length;
    const hourLabel = hour >= 12 ? (hour === 12 ? "12 PM" : `${hour - 12} PM`) : (hour === 0 ? "12 AM" : `${hour} AM`);
    return {
      hourLabel,
      Completions: count,
      hour
    };
  });

  // 8. Streak calendar (GitHub-style) - past 28 days
  const past28Days = Array.from({ length: 28 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const dateStr = d.toISOString().split("T")[0];
    const completedCount = completedTasks.filter(t => t.updatedAt && t.updatedAt.startsWith(dateStr)).length;
    
    let shade = "bg-[#1E1E1C] border border-[#2C2C2A]/40"; 
    if (completedCount === 1) shade = "bg-[#A3AD9A]/20 border border-[#A3AD9A]/30";
    else if (completedCount === 2) shade = "bg-[#A3AD9A]/50 border border-[#A3AD9A]/40";
    else if (completedCount >= 3) shade = "bg-[#A3AD9A] border border-[#E5E5E0]/30";

    return {
      date: dateStr,
      dayOfMonth: d.getDate(),
      monthLabel: d.toLocaleDateString("en-US", { month: "short" }),
      completedCount,
      shadeClass: shade
    };
  });

  // 9. Upcoming Workload Prediction (Next 7 Days)
  const upcomingWeekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const upcomingWorkloadData = upcomingWeekDays.map(date => {
    const dateString = date.toISOString().split("T")[0];
    const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    
    // Find active tasks whose deadline is on this date
    const tasksDueThisDay = activeTasks.filter(t => {
      if (!t.deadline) return false;
      return t.deadline.startsWith(dateString);
    });

    const totalDuration = tasksDueThisDay.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const taskCount = tasksDueThisDay.length;

    return {
      day: dayLabel,
      "Workload (Mins)": totalDuration,
      "Task Count": taskCount
    };
  });

  const triggerAIAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/analyze-productivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      
      if (!response.ok) {
        throw new Error("Server failed to respond to analysis request.");
      }
      
      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate AI report.");
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-2.5 rounded-xl font-mono text-[10px] space-y-1 shadow-xl">
          <p className="text-[#888880] border-b border-[#2C2C2A] pb-1 mb-1">{label}</p>
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center gap-3.5 justify-between">
              <span className="text-[#888880]" style={{ color: item.color }}>{item.name}:</span>
              <span className="text-white font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="ai-analysis-container" className="flex flex-col gap-6 h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2C2C2A]/30 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#E5E5E0] flex items-center gap-2">
            <Sparkles size={18} className="text-[#A3AD9A]" />
            Task Completion Analysis
          </h2>
          <p className="text-xs text-[#888880] font-mono mt-1">
            Advanced productivity indicators computed from your workspace session.
          </p>
        </div>
        
        <button
          id="trigger-ai-analysis-btn"
          onClick={triggerAIAnalysis}
          disabled={loading || totalTasks === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
            totalTasks === 0 
              ? "bg-[#2C2C2A]/40 text-[#666660] cursor-not-allowed" 
              : "bg-[#A3AD9A]/10 text-[#A3AD9A] border border-[#A3AD9A]/30 hover:bg-[#A3AD9A]/20 cursor-pointer active:scale-95"
          }`}
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Analyzing Workspace...
            </>
          ) : (
            <>
              <Sparkles size={12} className="animate-pulse" />
              Generate AI Insight Report
            </>
          )}
        </button>
      </div>

      {totalTasks === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#2C2C2A] rounded-2xl bg-[#1C1C1A]/40">
          <BookOpen size={40} className="text-[#666660] mb-4 stroke-[1.5]" />
          <p className="text-[#888880] text-sm max-w-sm font-mono">
            Create some tasks first to populate your real-time performance analytics workspace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Analytics Cards Column */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Row 1: Core completion metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Task Completion Rate card */}
              <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CheckCircle2 size={48} className="text-[#A3AD9A]" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-mono text-[#666660]">Completion Rate</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-light text-[#E5E5E0] tabular-nums">
                      {taskCompletionRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-[#121211] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#A3AD9A] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${taskCompletionRate}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#888880] mt-1.5 block">
                    {completedTasks.length} of {totalTasks} tasks completed
                  </span>
                </div>
              </div>

              {/* On-Time Completion percentage */}
              <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap size={48} className="text-[#D4A373]" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-mono text-[#666660]">On-Time Rate</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-light text-[#E5E5E0] tabular-nums">
                      {completedWithDeadlines.length > 0 ? `${onTimePercentage.toFixed(1)}%` : "100%"}
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-[#121211] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#D4A373] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${completedWithDeadlines.length > 0 ? onTimePercentage : 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#888880] mt-1.5 block">
                    {completedWithDeadlines.length > 0 
                      ? `${onTimeCompleted.length} of ${completedWithDeadlines.length} scheduled on-time`
                      : "No scheduled deadlines yet"
                    }
                  </span>
                </div>
              </div>

              {/* Late Completion percentage */}
              <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertTriangle size={48} className="text-red-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-mono text-[#666660]">Late Rate</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-light text-[#E5E5E0] tabular-nums">
                      {latePercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-[#121211] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-red-400/80 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${latePercentage}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#888880] mt-1.5 block">
                    {lateCompleted.length} task{lateCompleted.length === 1 ? "" : "s"} completed past deadline
                  </span>
                </div>
              </div>

              {/* Snooze Bottlenecks card */}
              <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Flame size={48} className="text-amber-500 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-mono text-[#666660]">Snooze Resistance</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-light text-[#E5E5E0] tabular-nums">
                      {allTasksSnoozes}
                    </span>
                    <span className="text-[9px] text-[#888880] font-mono">snoozes</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-[#121211] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (allTasksSnoozes / Math.max(1, tasks.length)) * 20)}%` }}
                    />
                  </div>
                  <div className="text-[9px] font-mono text-[#888880] mt-1.5 block leading-tight">
                    {topSnoozedTasks.length > 0 ? (
                      <div className="space-y-1">
                        <span className="text-[#666660] uppercase tracking-wider text-[8px] block font-bold">Top Bottlenecks:</span>
                        {topSnoozedTasks.map((t, idx) => (
                          <div key={t.id} className="flex items-center justify-between text-[#E5E5E0]">
                            <span className="truncate max-w-[100px]" title={t.title}>
                              {idx + 1}. {t.title}
                            </span>
                            <span className="text-amber-400 font-semibold shrink-0 ml-1">
                              {t.snoozeCount}x
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "No tasks have been snoozed yet"
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Row 2: Average Time metrics & Most Frequent categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Average delay and completion time */}
              <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold">Speed & Delay Analysis</h3>
                
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between border-b border-[#2C2C2A]/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Clock size={16} className="text-[#888880]" />
                      <span className="text-xs text-[#E5E5E0] font-medium">Avg Completion Time</span>
                    </div>
                    <span className="text-sm font-mono text-[#A3AD9A] font-medium">{avgCompletionTimeStr}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert size={16} className="text-red-400/80" />
                      <span className="text-xs text-[#E5E5E0] font-medium">Avg Delay After Deadline</span>
                    </div>
                    <span className="text-sm font-mono text-red-400/80 font-medium">{avgDelayStr}</span>
                  </div>
                </div>
                <p className="text-[9px] font-mono text-[#666660] mt-1 leading-relaxed">
                  Calculated from creation timestamps to completed status changes.
                </p>
              </div>

              {/* Task Type Frequency (Most Completed & Most Abandoned) */}
              <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold">Task Type Frequencies</h3>
                
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between border-b border-[#2C2C2A]/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Award size={16} className="text-emerald-400/80" />
                      <span className="text-xs text-[#E5E5E0] font-medium">Most Completed Type</span>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 max-w-[120px] truncate" title={mostCompletedType}>
                      {mostCompletedType}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={16} className="text-amber-500/80" />
                      <span className="text-xs text-[#E5E5E0] font-medium">Most Abandoned Type</span>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 max-w-[120px] truncate" title={mostAbandonedType}>
                      {mostAbandonedType}
                    </span>
                  </div>
                </div>
                <p className="text-[9px] font-mono text-[#666660] mt-1 leading-relaxed">
                  "Abandoned" refers to active stale tasks or overdue incomplete tasks.
                </p>
              </div>

            </div>

            {/* Row 3: Category stats list */}
            <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl">
              <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold mb-4">Completion Rate by Project Category</h3>
              
              {categoryStats.length === 0 ? (
                <p className="text-xs font-mono text-[#666660] py-3 text-center">No categorized tasks created yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryStats.map((stat, idx) => (
                    <div key={idx} className="bg-[#121211] p-3 rounded-xl border border-[#2C2C2A]/40 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-[#E5E5E0] truncate block">{stat.category}</span>
                        <span className="text-[9px] font-mono text-[#666660] block mt-0.5">
                          {stat.completed}/{stat.total} completed
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-mono text-[#A3AD9A] font-semibold">{stat.rate.toFixed(0)}%</span>
                        <div className="w-16 bg-[#2C2C2A] h-1 rounded-full overflow-hidden mt-1">
                          <div className="bg-[#A3AD9A] h-full" style={{ width: `${stat.rate}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Priority stats list */}
            <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl">
              <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold mb-4">Completion Rate by Priority Level</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {priorityStats.map((stat, idx) => {
                  const colors = {
                    high: { text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", progress: "bg-red-400" },
                    medium: { text: "text-[#D4A373]", bg: "bg-[#D4A373]/10", border: "border-[#D4A373]/20", progress: "bg-[#D4A373]" },
                    low: { text: "text-[#888880]", bg: "bg-[#888880]/10", border: "border-[#888880]/20", progress: "bg-[#888880]" }
                  };
                  const prioColor = colors[stat.priority] || colors.low;
                  
                  return (
                    <div key={idx} className={`bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/40 flex flex-col justify-between`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md ${prioColor.bg} ${prioColor.text} ${prioColor.border}`}>
                          {stat.priority}
                        </span>
                        <span className="text-xs font-mono text-[#E5E5E0] font-semibold">{stat.rate.toFixed(0)}%</span>
                      </div>
                      
                      <div className="w-full bg-[#2C2C2A] h-1 rounded-full overflow-hidden mb-2">
                        <div className={`h-full ${prioColor.progress}`} style={{ width: `${stat.rate}%` }} />
                      </div>
                      
                      <span className="text-[9px] font-mono text-[#666660]">
                        {stat.completed} of {stat.total} tasks done
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row 4.5: Behavioral Diagnostics & Procrastination Analysis */}
            <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl space-y-6">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[#A3AD9A]" />
                <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold">Behavioral Diagnostics & Procrastination</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left panel: Procrastination Meter */}
                <div className="lg:col-span-5 bg-[#121211] p-5 rounded-xl border border-[#2C2C2A]/50 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">Procrastination Score</span>
                      <button 
                        onClick={() => setShowProcrastinationBreakdown(!showProcrastinationBreakdown)}
                        className="text-[9px] font-mono text-[#A3AD9A] hover:text-white underline transition-colors cursor-pointer"
                      >
                        {showProcrastinationBreakdown ? "Hide Formula" : "How is this calculated?"}
                      </button>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-light text-[#E5E5E0] font-mono">{procrastinationScore}</span>
                      <span className="text-xs text-[#888880] font-mono">/ 100</span>
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono block mt-1 ${procrastinationColor}`}>
                      ● {procrastinationLabel}
                    </span>
                  </div>

                  <AnimatePresence>
                    {showProcrastinationBreakdown ? (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2.5 text-[10px] font-mono text-[#888880] border-t border-[#2C2C2A] pt-3 overflow-hidden"
                      >
                        <p className="text-[9px] text-[#666660] leading-normal uppercase tracking-wider font-bold">Calculation Breakdown:</p>
                        
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span>1. Overdue Deadlines (Max 35)</span>
                            <span className="text-white font-medium">+{overduePoints} pts</span>
                          </div>
                          <div className="w-full bg-[#1C1C1A] h-1 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full" style={{ width: `${(overduePoints / 35) * 100}%` }} />
                          </div>
                          <span className="text-[8px] text-[#666660] block -mt-0.5">Ratio of active items with missed deadlines ({overdueTasksCount}/{activeWithDeadlinesCount || 0})</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span>2. Alarm Snoozing (Max 25)</span>
                            <span className="text-white font-medium">+{snoozePoints} pts</span>
                          </div>
                          <div className="w-full bg-[#1C1C1A] h-1 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full" style={{ width: `${(snoozePoints / 25) * 100}%` }} />
                          </div>
                          <span className="text-[8px] text-[#666660] block -mt-0.5">Snoozing average across all tasks ({avgSnoozesAll.toFixed(1)}/2.5)</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span>3. Backlog Stagnation (Max 20)</span>
                            <span className="text-white font-medium">+{stalePoints} pts</span>
                          </div>
                          <div className="w-full bg-[#1C1C1A] h-1 rounded-full overflow-hidden">
                            <div className="bg-yellow-500 h-full" style={{ width: `${(stalePoints / 20) * 100}%` }} />
                          </div>
                          <span className="text-[8px] text-[#666660] block -mt-0.5">Age in days of oldest active item ({oldestTaskAgeDays.toFixed(0)} days pending)</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span>4. Historical Lateness (Max 20)</span>
                            <span className="text-white font-medium">+{latePoints} pts</span>
                          </div>
                          <div className="w-full bg-[#1C1C1A] h-1 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${(latePoints / 20) * 100}%` }} />
                          </div>
                          <span className="text-[8px] text-[#666660] block -mt-0.5">Completed late ratio ({latePercentage.toFixed(0)}% of done tasks)</span>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-full bg-[#1C1C1A] h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#A3AD9A] h-full rounded-full transition-all duration-500" 
                            style={{ width: `${procrastinationScore}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#888880] leading-relaxed">
                          {procrastinationAdvice}
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right panel: Multi-Metric Behavioral Grid */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Most & Least Productive Day */}
                  <div className="bg-[#121211]/60 p-3.5 rounded-xl border border-[#2C2C2A]/30 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">Most Productive Day</span>
                    <div className="text-sm font-semibold text-white pt-0.5">{mostProductiveDay}</div>
                    <span className="text-[9px] font-mono text-[#666660] block pt-1">
                      Highest volume of completed items.
                    </span>
                  </div>

                  <div className="bg-[#121211]/60 p-3.5 rounded-xl border border-[#2C2C2A]/30 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">Least Productive Day</span>
                    <div className="text-sm font-semibold text-[#888880] pt-0.5">{leastProductiveDay}</div>
                    <span className="text-[9px] font-mono text-[#666660] block pt-1">
                      Lowest volume of completed items.
                    </span>
                  </div>

                  {/* Avg Completed Per Day & Avg Snoozes */}
                  <div className="bg-[#121211]/60 p-3.5 rounded-xl border border-[#2C2C2A]/30 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">Completions Cadence</span>
                    <div className="text-sm font-mono font-semibold text-white pt-0.5">
                      {avgCompletedPerDay.toFixed(1)} <span className="text-[10px] text-[#888880] font-normal">tasks/day</span>
                    </div>
                    <span className="text-[9px] font-mono text-[#666660] block pt-1">
                      Average daily completion speed.
                    </span>
                  </div>

                  <div className="bg-[#121211]/60 p-3.5 rounded-xl border border-[#2C2C2A]/30 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">Average Alarm Snoozes</span>
                    <div className="text-sm font-mono font-semibold text-white pt-0.5">
                      {avgSnoozesBeforeCompletion.toFixed(1)} <span className="text-[10px] text-[#888880] font-normal">snoozes/task</span>
                    </div>
                    <span className="text-[9px] font-mono text-[#666660] block pt-1">
                      Resistance frequency before completion.
                    </span>
                  </div>
                </div>
              </div>

              {/* Longest Pending Task display block */}
              <div className="bg-[#121211]/40 border border-[#2C2C2A]/30 p-4 rounded-xl space-y-2">
                <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660] block">Longest Pending active Task</span>
                {longestPendingTask ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-[#E5E5E0] truncate">{longestPendingTask.title}</h4>
                      <p className="text-[10px] text-[#888880] mt-0.5 font-mono">
                        Created on {new Date(longestPendingTask.createdAt).toLocaleDateString()} • {longestPendingTask.category || "General"}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md shrink-0">
                      {oldestTaskAgeDays.toFixed(0)} {oldestTaskAgeDays.toFixed(0) === "1" ? "day" : "days"} pending
                    </span>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-[#666660] text-center py-2">
                    No active tasks are currently pending in your backlog. Fully synchronized!
                  </p>
                )}
              </div>
            </div>

            {/* Row 5: Time Estimation Intelligence */}
            <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-[#A3AD9A]" />
                  <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold">Time Estimation Intelligence</h3>
                </div>
                {completedWithEstimates.length > 0 && (
                  <span className="text-[10px] font-mono bg-[#A3AD9A]/10 text-[#A3AD9A] px-2 py-0.5 rounded border border-[#A3AD9A]/20">
                    Accuracy Score: {Math.max(0, Math.round(100 - Math.min(100, avgEstimationErrorPct)))}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Average Estimation Error */}
                <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-2">
                  <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660] flex items-center gap-1.5">
                    <Clock size={12} className="text-[#A3AD9A]" /> Average Estimation Error
                  </span>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-2xl font-light text-[#E5E5E0] font-mono">
                      {completedWithEstimates.length > 0 ? `${avgEstimationError.toFixed(0)}m` : "N/A"}
                    </span>
                    {completedWithEstimates.length > 0 && (
                      <span className="text-xs text-[#888880] font-mono">
                        (avg. {avgEstimationErrorPct.toFixed(0)}% deviation)
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-mono text-[#666660] leading-normal pt-1">
                    The average absolute variance between your estimated task durations and completed times.
                  </p>
                </div>

                {/* Card 2: Estimation Improvement Over Time */}
                <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-2">
                  <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660] flex items-center gap-1.5">
                    {isImproving ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-amber-500" />}
                    Accuracy Shift Over Time
                  </span>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className={`text-xl font-medium font-mono ${isImproving ? "text-emerald-400" : "text-amber-500"}`}>
                      {accuracyChangeStr}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-[#888880] leading-normal pt-1">
                    {accuracyTrend}
                  </p>
                </div>
              </div>

              {/* AI Suggestions Callout */}
              <div className="bg-[#A3AD9A]/5 border border-[#A3AD9A]/15 p-4 rounded-xl flex items-start gap-3">
                <Sparkles size={16} className="text-[#A3AD9A] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono text-[#A3AD9A] font-bold block">AI Suggestions for Future Estimates</span>
                  <p className="text-xs text-[#C8C8C0] leading-relaxed font-sans font-normal">
                    {aiEstimationSuggestion}
                  </p>
                </div>
              </div>

              {/* Estimated vs Actual Time Comparison List */}
              <div className="space-y-3">
                <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660] block">Estimated vs Actual Duration Comparison</span>
                
                {completedWithEstimates.length === 0 ? (
                  <p className="text-xs font-mono text-[#666660] py-3 text-center bg-[#121211]/30 border border-dashed border-[#2C2C2A] rounded-xl">
                    Complete tasks containing estimated durations to trigger interactive visual comparison scales.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1.5 custom-scrollbar">
                    {completedWithEstimates.slice(-5).map((item, idx) => {
                      const maxVal = Math.max(item.estimated, item.actual, 5);
                      const estPercent = (item.estimated / maxVal) * 100;
                      const actPercent = (item.actual / maxVal) * 100;
                      
                      return (
                        <div key={idx} className="bg-[#121211]/40 border border-[#2C2C2A]/30 p-3 rounded-xl space-y-2 hover:border-[#2C2C2A] transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-medium text-[#E5E5E0] truncate max-w-[200px]" title={item.title}>
                              {item.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#888880] shrink-0">
                              Est: <span className="text-white font-medium">{item.estimated}m</span> / Act: <span className="text-emerald-400 font-medium">{item.actual}m</span>
                            </span>
                          </div>
                          
                          {/* Visual Comparison Bar Scales */}
                          <div className="space-y-1 pt-0.5">
                            {/* Estimated Scale */}
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-mono text-[#666660] w-7 text-right">EST</span>
                              <div className="flex-1 h-1.5 bg-[#121211] rounded-full overflow-hidden">
                                <div className="bg-[#888880]/60 h-full rounded-full" style={{ width: `${estPercent}%` }} />
                              </div>
                            </div>
                            {/* Actual Scale */}
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-mono text-emerald-400/80 w-7 text-right">ACT</span>
                              <div className="flex-1 h-1.5 bg-[#121211] rounded-full overflow-hidden">
                                <div className="bg-emerald-400/80 h-full rounded-full" style={{ width: `${actPercent}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Row 6: Interactive Performance & Visual Analytics Dashboard */}
            <div className="bg-[#1C1C1A] border border-[#2C2C2A] p-5 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C2A]/40 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={16} className="text-[#A3AD9A]" />
                    <h3 className="text-xs uppercase tracking-widest font-mono text-[#666660] font-bold">Interactive Performance Dashboard</h3>
                  </div>
                  <p className="text-[10px] text-[#888880] font-mono">
                    Multi-dimensional productivity indicators & focus charts
                  </p>
                </div>
                
                {/* Visual Tab Selectors */}
                <div className="flex items-center bg-[#121211] p-1 rounded-lg border border-[#2C2C2A]/50 self-start sm:self-auto">
                  <button
                    onClick={() => setSelectedVisualTab("trends")}
                    className={`px-3 py-1 text-[9px] font-mono rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      selectedVisualTab === "trends" 
                        ? "bg-[#A3AD9A] text-black font-semibold" 
                        : "text-[#888880] hover:text-white"
                    }`}
                  >
                    Trends
                  </button>
                  <button
                    onClick={() => setSelectedVisualTab("efficiency")}
                    className={`px-3 py-1 text-[9px] font-mono rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      selectedVisualTab === "efficiency" 
                        ? "bg-[#A3AD9A] text-black font-semibold" 
                        : "text-[#888880] hover:text-white"
                    }`}
                  >
                    Efficiency
                  </button>
                  <button
                    onClick={() => setSelectedVisualTab("allocation")}
                    className={`px-3 py-1 text-[9px] font-mono rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      selectedVisualTab === "allocation" 
                        ? "bg-[#A3AD9A] text-black font-semibold" 
                        : "text-[#888880] hover:text-white"
                    }`}
                  >
                    Allocation
                  </button>
                  <button
                    onClick={() => setSelectedVisualTab("workload")}
                    className={`px-3 py-1 text-[9px] font-mono rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      selectedVisualTab === "workload" 
                        ? "bg-[#A3AD9A] text-black font-semibold" 
                        : "text-[#888880] hover:text-white"
                    }`}
                  >
                    Workload
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedVisualTab}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {selectedVisualTab === "trends" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Productivity over time */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                          Productivity Over Time (7-Day Completion Velocity)
                        </span>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={productivityOverTimeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient id="completionsGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#A3AD9A" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#A3AD9A" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="day" stroke="#666660" fontSize={9} tickLine={false} />
                              <YAxis stroke="#666660" fontSize={9} tickLine={false} allowDecimals={false} />
                              <RechartsTooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="Completions" stroke="#A3AD9A" strokeWidth={1.5} fillOpacity={1} fill="url(#completionsGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Completed vs delayed tasks */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                          Completed vs Delayed Tasks (7-Day Check)
                        </span>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={completedVsDelayedData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <XAxis dataKey="day" stroke="#666660" fontSize={9} tickLine={false} />
                              <YAxis stroke="#666660" fontSize={9} tickLine={false} allowDecimals={false} />
                              <RechartsTooltip content={<CustomTooltip />} />
                              <Legend verticalAlign="top" height={36} iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                              <Bar dataKey="On-Time" stackId="a" fill="#A3AD9A" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="Delayed" stackId="a" fill="#D4A373" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedVisualTab === "efficiency" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Estimated vs actual time */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                            Estimated vs Actual Time (Minutes)
                          </span>
                          <span className="text-[8px] font-mono text-[#888880]">Last 7 completed tasks</span>
                        </div>
                        {estimatedVsActualData.length === 0 ? (
                          <div className="h-56 flex flex-col items-center justify-center text-center font-mono text-xs text-[#666660] border border-dashed border-[#2C2C2A] rounded-lg">
                            No estimates found.<br/>Set estimation times on active tasks.
                          </div>
                        ) : (
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={estimatedVsActualData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <XAxis dataKey="taskName" stroke="#666660" fontSize={8} tickLine={false} />
                                <YAxis stroke="#666660" fontSize={9} tickLine={false} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={36} iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                                <Bar dataKey="Estimated" fill="#666660" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="Actual" fill="#10B981" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>

                      {/* Focus hours heatmap (Hourly Completed Tasks distribution) */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                            Focus Hours Density Distribution (24h Clock)
                          </span>
                          <Hourglass size={12} className="text-[#A3AD9A]" />
                        </div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={focusHoursDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient id="focusHoursGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="hourLabel" stroke="#666660" fontSize={8} tickLine={false} interval={4} />
                              <YAxis stroke="#666660" fontSize={9} tickLine={false} allowDecimals={false} />
                              <RechartsTooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="Completions" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#focusHoursGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedVisualTab === "allocation" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Workload by weekday */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4 md:col-span-1">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                          Workload by Weekday
                        </span>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={workloadByWeekdayData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <XAxis dataKey="weekday" stroke="#666660" fontSize={9} tickLine={false} />
                              <YAxis stroke="#666660" fontSize={9} tickLine={false} allowDecimals={false} />
                              <RechartsTooltip content={<CustomTooltip />} />
                              <Legend verticalAlign="top" height={30} iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                              <Line type="monotone" dataKey="Active" stroke="#F59E0B" strokeWidth={1.5} activeDot={{ r: 4 }} />
                              <Line type="monotone" dataKey="Completed" stroke="#10B981" strokeWidth={1.5} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Completion rate by Category */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4 md:col-span-1">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                          Completion Rate by Category
                        </span>
                        {categoryCompletionRateData.length === 0 ? (
                          <div className="h-48 flex items-center justify-center text-[#666660] font-mono text-xs">
                            No categories found
                          </div>
                        ) : (
                          <div className="h-48 overflow-y-auto pr-1.5 custom-scrollbar space-y-3.5">
                            {categoryCompletionRateData.map((item, idx) => (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-[#E5E5E0] font-medium truncate max-w-[100px]">{item.category}</span>
                                  <span className="text-[#A3AD9A]">{item["Completion Rate"]}% ({item.Total} tasks)</span>
                                </div>
                                <div className="w-full bg-[#1C1C1A] h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-[#A3AD9A] h-full rounded-full" 
                                    style={{ width: `${item["Completion Rate"]}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Priority distribution */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4 md:col-span-1">
                        <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                          Priority Distribution (All Tasks)
                        </span>
                        {priorityDistributionData.length === 0 ? (
                          <div className="h-48 flex items-center justify-center text-[#666660] font-mono text-xs">
                            Create tasks to view distribution
                          </div>
                        ) : (
                          <div className="h-48 flex flex-col items-center justify-center">
                            <div className="h-32 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={priorityDistributionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={28}
                                    outerRadius={45}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {priorityDistributionData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-3.5 flex-wrap pt-2">
                              {priorityDistributionData.map((entry, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-[9px] font-mono text-white">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span>{entry.name} ({entry.value})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedVisualTab === "workload" && (
                    <div className="space-y-6">
                      {/* Configuration Panel: Daily Workload Limit Slider */}
                      <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider font-mono text-[#A3AD9A] block font-bold">
                            Customize Daily Workload Threshold
                          </span>
                          <span className="text-[9px] font-mono text-[#888880] block">
                            Set your maximum expected work hours/minutes per day. Days exceeding this will be marked "Overloaded".
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Quick presets */}
                          <div className="flex gap-1">
                            {[120, 240, 360, 480].map((preset) => (
                              <button
                                key={preset}
                                onClick={() => handleLimitChange(preset)}
                                className={`px-2 py-0.5 rounded text-[8px] font-mono border cursor-pointer transition-colors ${
                                  dailyWorkloadLimit === preset
                                    ? "bg-[#A3AD9A] text-black border-[#A3AD9A]"
                                    : "bg-[#1C1C1A] text-[#888880] border-[#2C2C2A] hover:text-white"
                                }`}
                              >
                                {preset / 60}h ({preset}m)
                              </button>
                            ))}
                          </div>
                          {/* Slider & manual adjustment input */}
                          <div className="flex items-center gap-2 bg-[#1C1C1A] px-3 py-1.5 rounded-lg border border-[#2C2C2A]">
                            <input
                              type="range"
                              min="30"
                              max="720"
                              step="30"
                              value={dailyWorkloadLimit}
                              onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
                              className="w-24 h-1 bg-[#2C2C2A] rounded-lg appearance-none cursor-pointer accent-[#A3AD9A]"
                            />
                            <div className="flex items-center gap-1 min-w-[50px]">
                              <input
                                type="number"
                                min="10"
                                max="1440"
                                value={dailyWorkloadLimit}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) handleLimitChange(val);
                                }}
                                className="w-8 bg-transparent text-[10px] font-mono text-white text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-bold"
                              />
                              <span className="text-[8px] font-mono text-[#888880]">min</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Upcoming Week Workload Prediction Chart */}
                        <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                                Upcoming Week Workload Prediction
                              </span>
                              <span className="text-[8px] font-mono text-[#888880] block">
                                Aggregated estimated task durations due each day
                              </span>
                            </div>
                            <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Max Threshold: {dailyWorkloadLimit}m / day
                            </span>
                          </div>
                          
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={upcomingWorkloadData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="workloadGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#D4A373" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#D4A373" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="day" stroke="#666660" fontSize={8} tickLine={false} />
                                <YAxis stroke="#666660" fontSize={9} tickLine={false} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                {/* Dynamic Reference line based on user-defined daily capacity limit */}
                                <ReferenceLine y={dailyWorkloadLimit} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `Limit (${dailyWorkloadLimit}m)`, fill: "#EF4444", fontSize: 8, position: "top", fontFamily: "monospace" }} />
                                <Area type="monotone" dataKey="Workload (Mins)" stroke="#D4A373" strokeWidth={1.5} fillOpacity={1} fill="url(#workloadGrad)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Right: Balance & Schedule Optimization Assistant */}
                        <div className="bg-[#121211] p-4 rounded-xl border border-[#2C2C2A]/50 space-y-4">
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] block">
                              Schedule Balancing Assistant
                            </span>
                            <span className="text-[8px] font-mono text-[#888880] block">
                              Daily breakdown of upcoming task deadlines
                            </span>
                          </div>

                          <div className="h-56 overflow-y-auto pr-1.5 custom-scrollbar space-y-3">
                            {upcomingWeekDays.map((date, idx) => {
                              const dateString = date.toISOString().split("T")[0];
                              const label = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                              const isToday = idx === 0;
                              
                              const tasksDue = activeTasks.filter(t => t.deadline && t.deadline.startsWith(dateString));
                              const dailyMinutes = tasksDue.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
                              
                              let loadStatus = "Optimal";
                              let statusColor = "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20";
                              if (dailyMinutes > dailyWorkloadLimit) {
                                loadStatus = "Overloaded";
                                statusColor = "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20";
                              } else if (dailyMinutes > dailyWorkloadLimit * 0.5) {
                                loadStatus = "Balanced";
                                statusColor = "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20";
                              } else if (tasksDue.length === 0) {
                                loadStatus = "Free";
                                statusColor = "text-[#888880] bg-[#121211] border-[#2C2C2A]/40";
                              }

                              return (
                                <div key={idx} className={`p-2.5 rounded-lg border ${isToday ? "bg-[#1C1C1A]/60 border-[#A3AD9A]/30" : "bg-[#1C1C1A]/20 border-[#2C2C2A]/40"} space-y-1.5`}>
                                  <div className="flex items-center justify-between text-[10px] font-mono">
                                    <span className={`font-medium ${isToday ? "text-[#A3AD9A]" : "text-white"}`}>
                                      {isToday ? `Today (${label})` : label}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider border ${statusColor}`}>
                                      {loadStatus} ({dailyMinutes}m)
                                    </span>
                                  </div>
                                  
                                  {tasksDue.length > 0 ? (
                                    <div className="space-y-1">
                                      {tasksDue.map(t => (
                                        <div key={t.id} className="flex items-center justify-between text-[9px] font-mono text-[#888880] hover:text-white transition-colors pl-1 border-l border-[#2C2C2A]">
                                          <span className="truncate max-w-[180px]">{t.title}</span>
                                          <span className="shrink-0 text-[#E5E5E0] ml-1">{t.estimatedMinutes || 30}m</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[9px] font-mono text-[#666660] italic pl-1">
                                      No deadlines scheduled for this day
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Streak Calendar (GitHub-style) */}
              <div className="bg-[#121211] p-5 rounded-xl border border-[#2C2C2A]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-[#666660] flex items-center gap-1.5">
                    <Calendar size={12} className="text-[#A3AD9A]" /> Streak Calendar (Past 28 Days)
                  </span>
                  <div className="flex items-center gap-2 text-[8px] font-mono text-[#666660]">
                    <span>Less</span>
                    <div className="w-2.5 h-2.5 rounded bg-[#1E1E1C] border border-[#2C2C2A]/40" />
                    <div className="w-2.5 h-2.5 rounded bg-[#A3AD9A]/20 border border-[#A3AD9A]/30" />
                    <div className="w-2.5 h-2.5 rounded bg-[#A3AD9A]/50 border border-[#A3AD9A]/40" />
                    <div className="w-2.5 h-2.5 rounded bg-[#A3AD9A] border border-[#E5E5E0]/30" />
                    <span>More</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2.5 pt-1">
                  {past28Days.map((day, idx) => (
                    <div 
                      key={idx} 
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center relative group transition-all duration-300 ${day.shadeClass}`}
                    >
                      <span className="text-[9px] font-mono text-[#888880] group-hover:text-white transition-colors">{day.dayOfMonth}</span>
                      {day.completedCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1C1C1A] border border-[#2C2C2A] text-[9px] font-mono rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 text-white shadow-lg">
                        {day.monthLabel} {day.dayOfMonth}: {day.completedCount} task{day.completedCount === 1 ? "" : "s"} completed
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[8px] font-mono text-[#666660] pt-1">
                  <span>{past28Days[0]?.monthLabel} {past28Days[0]?.dayOfMonth}</span>
                  <span>{past28Days[14]?.monthLabel} {past28Days[14]?.dayOfMonth}</span>
                  <span>{past28Days[27]?.monthLabel} {past28Days[27]?.dayOfMonth}</span>
                </div>
              </div>
            </div>

          </div>

          {/* AI Coaching & Insights Sidepanel Column */}
          <div className="space-y-6">
            <div className="bg-[#1C1C1A] border border-[#A3AD9A]/20 p-6 rounded-2xl relative overflow-hidden flex flex-col min-h-[450px]">
              
              {/* Decorative backdrop */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#A3AD9A]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-[#A3AD9A]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#E5E5E0]">AI Productivity Advisor</h3>
              </div>

              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-12"
                  >
                    <RefreshCw size={28} className="text-[#A3AD9A] animate-spin mb-4" />
                    <p className="text-xs font-mono text-[#888880] animate-pulse">
                      Synthesizing completion rates, speed averages, and prioritizing behaviors...
                    </p>
                  </motion.div>
                ) : error ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-8"
                  >
                    <AlertTriangle size={24} className="text-red-400 mb-3" />
                    <p className="text-xs font-mono text-red-400 mb-4">{error}</p>
                    <button 
                      onClick={triggerAIAnalysis}
                      className="px-3 py-1.5 rounded-lg bg-[#2C2C2A] text-[10px] text-[#E5E5E0] font-mono border border-[#3C3C3A] hover:bg-[#3C3C3A] cursor-pointer"
                    >
                      Retry Analysis
                    </button>
                  </motion.div>
                ) : report ? (
                  <motion.div 
                    key="report"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col justify-between space-y-5"
                  >
                    {/* Report Assessment */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">Strategic Assessment</span>
                      <p className="text-xs text-[#E5E5E0] leading-relaxed font-sans font-normal bg-[#121211]/50 p-3.5 rounded-xl border border-[#2C2C2A]/30">
                        {report.assessment}
                      </p>
                    </div>

                    {/* Report Strengths */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660] flex items-center gap-1.5">
                        <ThumbsUp size={10} className="text-emerald-400" /> Key Strengths
                      </span>
                      <ul className="space-y-1.5">
                        {report.strengths.map((s, idx) => (
                          <li key={idx} className="text-xs text-[#A3AD9A] flex items-start gap-2 leading-relaxed">
                            <span className="text-[#A3AD9A] mt-0.5 font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Report Recommendations */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-[#666660]">AI Recommended Action Items</span>
                      <div className="space-y-2">
                        {report.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 bg-[#121211]/30 p-2.5 rounded-lg border border-[#2C2C2A]/35">
                            <span className="w-4 h-4 rounded-full bg-[#2C2C2A] text-[#888880] flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-[#C8C8C0] leading-normal">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Focus warning area */}
                    {report.focusWarning && (
                      <div className="space-y-2 pt-2 border-t border-[#2C2C2A]/40">
                        <span className="text-[9px] uppercase tracking-wider font-mono text-amber-500/80">Focus Bottleneck Warn</span>
                        <p className="text-xs text-[#D4A373] leading-relaxed italic bg-[#D4A373]/5 p-3 rounded-xl border border-[#D4A373]/10">
                          {report.focusWarning}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-12"
                  >
                    <Sparkles size={32} className="text-[#666660] mb-4 stroke-[1.2] animate-pulse" />
                    <p className="text-xs text-[#888880] max-w-xs font-mono leading-relaxed mb-6">
                      Let Gemini analyze your actual project data, on-time rates, and overdue metrics to produce a custom, tailored executive performance audit.
                    </p>
                    <button
                      onClick={triggerAIAnalysis}
                      className="px-4 py-2 rounded-xl bg-[#A3AD9A] text-[#121211] font-mono font-medium text-xs hover:bg-[#B4BFAB] active:scale-95 transition-all cursor-pointer"
                    >
                      Run Performance Audit
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
