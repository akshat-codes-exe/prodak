import React, { useState } from "react";
import { Task, AIPlanResult } from "../types";
import { Sparkles, Loader2, CalendarRange, Clock, AlertTriangle, Coffee, Compass } from "lucide-react";
import { motion } from "motion/react";

interface AIPrioritizerProps {
  tasks: Task[];
  onAIPlanGenerated: (plan: AIPlanResult) => void;
  currentPlan: AIPlanResult | null;
}

export default function AIPrioritizer({ tasks, onAIPlanGenerated, currentPlan }: AIPrioritizerProps) {
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const [error, setError] = useState("");

  const handleGeneratePlan = async () => {
    if (tasks.length === 0) {
      setError("Add some tasks to your plan first before initiating the AI Daily Planner.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const activeTasks = tasks.filter(t => t.status !== "completed");
      const response = await fetch("/api/ai/prioritize-and-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tasks: activeTasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            category: t.category,
            deadline: t.deadline,
            estimatedMinutes: t.estimatedMinutes,
            status: t.status,
            subtasksCount: t.subtasks?.length || 0,
            completedSubtasksCount: t.subtasks?.filter(s => s.completed).length || 0
          })), 
          userContext: context 
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to trigger AI prioritization engine.");
      }

      const data = await response.json();
      onAIPlanGenerated(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to reach priority planning engine. Is the server running with an API Key?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-prioritizer-panel" className="p-6 bg-forest-card border border-forest-border rounded-3xl shadow-xl flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display font-medium text-earth-sand text-lg tracking-wide flex items-center gap-2">
            <Sparkles size={18} className="text-earth-sand animate-pulse" />
            AI Daily Focus Planner
          </h2>
          <p className="text-xs text-earth-sage mt-0.5">
            Analyze deadlines, priorities, and custom contexts to generate a focus schedule.
          </p>
        </div>

        <button
          id="generate-ai-plan-btn"
          onClick={handleGeneratePlan}
          disabled={loading || tasks.length === 0}
          className="px-4 py-2 bg-earth-sand hover:bg-earth-sand/90 text-forest-darkest font-medium rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-earth-sand/10 cursor-pointer disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          {currentPlan ? "Re-Schedule with AI" : "Optimize Daily Focus"}
        </button>
      </div>

      {/* User Context input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase tracking-wider text-earth-sage/80 font-mono">
          Custom Context or Focus (Optional)
        </label>
        <input
          id="ai-context-input"
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value.substring(0, 150))}
          placeholder="e.g., 'Low energy morning', 'Focus heavily on work deadlines', 'Busy afternoon'"
          className="w-full bg-forest-darkest border border-forest-border rounded-xl px-3.5 py-2.5 text-xs text-white"
        />
      </div>

      {error && (
        <div className="flex gap-2 p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl text-xs text-earth-clay">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {currentPlan ? (
        <div className="space-y-5 pt-1 border-t border-forest-border/20">
          {/* Daily Advisory */}
          <div className="p-4 rounded-2xl bg-earth-moss/10 border border-earth-moss/30">
            <h4 className="text-xs font-mono uppercase tracking-wider text-earth-sand mb-1.5 flex items-center gap-1.5 font-bold">
              <Compass size={14} />
              Daily Planning Advisory
            </h4>
            <p className="text-xs text-earth-sage leading-relaxed font-sans">
              {currentPlan.advisory}
            </p>
          </div>

          {/* Focus Blocks */}
          {currentPlan.focusBlocks && currentPlan.focusBlocks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-earth-sage flex items-center gap-1.5">
                <CalendarRange size={13} />
                Recommended Focus Interval Blocks
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentPlan.focusBlocks.map((block, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-2xl bg-forest-darkest/60 border border-forest-border/40 hover:border-forest-border/80 transition-all flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-earth-sand font-bold flex items-center gap-1">
                        <Coffee size={13} className="text-earth-amber" />
                        {block.timeBlock}
                      </span>
                      <span className="text-earth-sage/60 text-[10px]">
                        Block {idx + 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-earth-sage/90 font-sans leading-relaxed">
                      {block.focusDescription}
                    </p>
                    
                    {/* Associated Task Titles inside this block */}
                    {block.taskIds && block.taskIds.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-forest-border/20 space-y-1.5">
                        <span className="text-[9px] uppercase tracking-wider font-mono text-earth-sage/40 block">
                          Included Targets:
                        </span>
                        {block.taskIds.map((tid) => {
                          const matchingTask = tasks.find(t => t.id === tid);
                          if (!matchingTask) return null;
                          return (
                            <div key={tid} className="flex items-center gap-2 text-xs text-white bg-forest-card/50 px-2 py-1 rounded border border-forest-border/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-earth-sand" />
                              <span className="truncate">{matchingTask.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-forest-darkest/30 border border-forest-border/20 text-xs text-earth-sage flex flex-col items-center justify-center gap-2">
          <CalendarRange size={24} className="text-earth-sage/30 mb-1" />
          <span>No optimized daily scheduler computed yet.</span>
          <button
            id="prompt-optimize-btn"
            onClick={handleGeneratePlan}
            disabled={tasks.length === 0}
            className="text-earth-sand hover:underline font-mono cursor-pointer disabled:opacity-40"
          >
            Click here to initialize your focus plan.
          </button>
        </div>
      )}
    </div>
  );
}
