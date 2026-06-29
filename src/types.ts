export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO datetime string "YYYY-MM-DDTHH:mm"
  priority: "low" | "medium" | "high";
  category: string;
  status: "todo" | "in_progress" | "completed";
  userId: string;
  createdAt: string;
  updatedAt: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  snoozeCount?: number;
  subtasks: SubTask[];
  position?: number;
  recurrence?: "none" | "daily" | "weekly" | "3_days_a_week" | "monthly";
  completedOccurrences?: number;
}

export interface TaskRecommendation {
  id: string;
  dynamicPriority: "low" | "medium" | "high";
  planningScore: number; // 0-100
  rationale: string;
  suggestedAction: string;
  suggestedEstimatedMinutes?: number;
}

export interface FocusBlock {
  timeBlock: string;
  taskIds: string[];
  focusDescription: string;
}

export interface AIPlanResult {
  taskRecommendations: TaskRecommendation[];
  advisory: string;
  focusBlocks: FocusBlock[];
}
