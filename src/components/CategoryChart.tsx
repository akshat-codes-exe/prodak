import React, { useState, useMemo } from "react";
import { Task } from "../types";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip 
} from "recharts";
import { 
  Layers, CheckCircle2, Activity, LayoutDashboard, ArrowRight, RefreshCw
} from "lucide-react";
import { motion } from "motion/react";

interface CategoryChartProps {
  tasks: Task[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

// Custom colors that align perfectly with the "Nexus Sync" earthy/slate theme
const CATEGORY_COLORS: { [key: string]: string } = {
  Work: "#A3AD9A",      // Sage Green
  Personal: "#D4A373",  // Muted Amber/Sand
  Health: "#829373",    // Dark Sage
  Growth: "#CBBF7A",    // Soft Earthy Gold
  Urgent: "#8C5B42",    // Deep Terracotta
  Finance: "#5B708C",   // Muted Slate Blue
  Other: "#666660",     // Muted Gray
};

const DEFAULT_COLOR = "#888880";

export default function CategoryChart({ tasks, selectedCategory, onSelectCategory }: CategoryChartProps) {
  const [filterMode, setFilterMode] = useState<"all" | "active" | "completed">("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Compute category data based on current tasks and filter mode
  const chartData = useMemo(() => {
    // Group tasks by category
    const counts: { [key: string]: { total: number; active: number; completed: number } } = {};

    tasks.forEach(task => {
      const cat = task.category || "Unassigned";
      if (!counts[cat]) {
        counts[cat] = { total: 0, active: 0, completed: 0 };
      }
      counts[cat].total += 1;
      if (task.status === "completed") {
        counts[cat].completed += 1;
      } else {
        counts[cat].active += 1;
      }
    });

    // Transform into array for the chart depending on the active filter mode
    const rawData = Object.entries(counts).map(([name, stats]) => {
      let value = 0;
      if (filterMode === "all") value = stats.total;
      else if (filterMode === "active") value = stats.active;
      else if (filterMode === "completed") value = stats.completed;

      return {
        name,
        value,
        ...stats
      };
    });

    // Filter out entries with 0 count in the current filter mode to keep the pie clean
    return rawData.filter(d => d.value > 0);
  }, [tasks, filterMode]);

  const totalFilteredCount = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  // Handle segment hover/click
  const handlePieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const handlePieLeave = () => {
    setActiveIndex(null);
  };

  const handleSliceClick = (data: any) => {
    if (data && data.name) {
      onSelectCategory(data.name === selectedCategory ? "All" : data.name);
    }
  };

  // Safe color resolver
  const getColor = (name: string) => {
    return CATEGORY_COLORS[name] || DEFAULT_COLOR;
  };

  return (
    <div 
      id="category-distribution-panel"
      className="p-6 md:p-8 bg-[#181816] rounded-2xl border border-[#2C2C2A] flex flex-col gap-6"
    >
      {/* Header section of visualizer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2C2C2A]/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#A3AD9A]/10 flex items-center justify-center text-[#A3AD9A]">
            <LayoutDashboard size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#E5E5E0]">Category Distribution</h2>
            <p className="text-[11px] text-[#888880] font-mono">Visualizing task allocation and focus balance</p>
          </div>
        </div>

        {/* Filter buttons for the chart */}
        <div className="flex bg-[#121211] border border-[#2C2C2A] rounded-xl p-1 text-[11px] font-mono self-start sm:self-auto">
          <button
            id="chart-filter-all"
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              filterMode === "all" ? "bg-[#2C2C2A] text-[#A3AD9A] font-medium" : "text-[#888880] hover:text-[#E5E5E0]"
            }`}
          >
            <Layers size={11} />
            All ({tasks.length})
          </button>
          <button
            id="chart-filter-active"
            onClick={() => setFilterMode("active")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              filterMode === "active" ? "bg-[#2C2C2A] text-[#A3AD9A] font-medium" : "text-[#888880] hover:text-[#E5E5E0]"
            }`}
          >
            <Activity size={11} />
            Active ({tasks.filter(t => t.status !== "completed").length})
          </button>
          <button
            id="chart-filter-completed"
            onClick={() => setFilterMode("completed")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              filterMode === "completed" ? "bg-[#2C2C2A] text-[#A3AD9A] font-medium" : "text-[#888880] hover:text-[#E5E5E0]"
            }`}
          >
            <CheckCircle2 size={11} />
            Done ({tasks.filter(t => t.status === "completed").length})
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#888880] font-mono flex flex-col items-center justify-center gap-2">
          <Layers size={24} className="text-[#666660] opacity-50 mb-1" />
          <span>No task data available to visualize.</span>
          <span className="text-[10px] text-[#666660]">Create tasks with categories to populate the breakdown.</span>
        </div>
      ) : chartData.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#888880] font-mono flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="text-[#666660] opacity-50 animate-spin-slow mb-1" />
          <span>No tasks found in this state.</span>
          <span className="text-[10px] text-[#666660]">Try toggling back to All or Active view.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Pie Chart display block (5 columns on large screens) */}
          <div className="col-span-1 lg:col-span-5 flex flex-col items-center justify-center relative min-h-[220px]">
            <div className="w-full h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    onMouseEnter={handlePieEnter}
                    onMouseLeave={handlePieLeave}
                    onClick={handleSliceClick}
                    cursor="pointer"
                    animationDuration={600}
                  >
                    {chartData.map((entry, index) => {
                      const isHighlighted = activeIndex === index;
                      const isSelected = entry.name === selectedCategory;
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getColor(entry.name)} 
                          style={{
                            filter: isHighlighted || isSelected 
                              ? "drop-shadow(0px 0px 6px rgba(163, 173, 154, 0.4))" 
                              : "none",
                            opacity: activeIndex !== null && activeIndex !== index ? 0.6 : 1,
                            transition: "all 0.2s ease"
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const percentage = ((data.value / totalFilteredCount) * 100).toFixed(0);
                        return (
                          <div className="bg-[#121211] border border-[#2C2C2A] px-3 py-2 rounded-xl shadow-xl text-[11px] font-mono text-[#E5E5E0]">
                            <span className="font-semibold block text-[#A3AD9A] mb-0.5">{data.name}</span>
                            <div className="space-y-0.5">
                              <div>Count: <span className="text-white font-bold">{data.value}</span></div>
                              <div>Ratio: <span className="text-white font-bold">{percentage}%</span></div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Absolute center of doughnut/pie chart */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-light text-[#E5E5E0] font-display">
                  {totalFilteredCount}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#888880] font-mono">
                  {filterMode === "all" ? "Total" : filterMode}
                </span>
              </div>
            </div>
          </div>

          {/* Details & Interactive Legend (7 columns on large screens) */}
          <div className="col-span-1 lg:col-span-7 flex flex-col gap-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#666660]">Distribution Breakdown</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {chartData.map((item, index) => {
                const percentage = ((item.value / totalFilteredCount) * 100).toFixed(0);
                const isSelected = item.name === selectedCategory;
                const isHovered = activeIndex === index;
                
                return (
                  <div
                    id={`chart-legend-item-${item.name.replace(/\s+/g, "-")}`}
                    key={item.name}
                    onClick={() => onSelectCategory(item.name === selectedCategory ? "All" : item.name)}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                      isSelected 
                        ? "bg-[#2C2C2A]/40 border-[#A3AD9A] shadow-md" 
                        : "bg-[#1C1C1A] border-[#2C2C2A]/60 hover:border-[#666660]"
                    } ${isHovered ? "scale-[1.01]" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Name with color circle badge */}
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: getColor(item.name) }}
                        />
                        <span className="text-xs font-medium text-[#E5E5E0] truncate group-hover:text-white transition-colors">
                          {item.name}
                        </span>
                      </div>
                      
                      {/* Count & Percent */}
                      <div className="text-right flex items-baseline gap-1 font-mono">
                        <span className="text-xs font-bold text-[#E5E5E0]">{item.value}</span>
                        <span className="text-[10px] text-[#888880]">({percentage}%)</span>
                      </div>
                    </div>

                    {/* Progress representation visual bar */}
                    <div className="w-full h-1 bg-[#121211] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: getColor(item.name)
                        }}
                      />
                    </div>

                    {/* Sub-counts breakdown */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-[#888880] pt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>Active: {item.active}</span>
                      <span>Done: {item.completed}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hint message */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#888880] font-mono mt-2 pl-1">
              <ArrowRight size={10} className="text-[#A3AD9A]" />
              <span>Click any category card or pie slice above to filter the main task list!</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
