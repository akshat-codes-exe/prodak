import React, { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { db, auth } from "./lib/firebase";
import { Task, AIPlanResult } from "./types";
import { playCompletionSound, playTimerEndSound, playTaskStartAlarmSound, playOverdueUrgentAlarmSound, startLoopingAlarm, stopLoopingAlarm } from "./lib/audio";
import AuthOverlay from "./components/AuthOverlay";
import TaskForm from "./components/TaskForm";
import TaskCard from "./components/TaskCard";
import AIPrioritizer from "./components/AIPrioritizer";
import CalendarView from "./components/CalendarView";
import CategoryChart from "./components/CategoryChart";
import AIAnalysisView from "./components/AIAnalysisView";
import { 
  Plus, Search, SlidersHorizontal, Sparkles, Filter, CheckCircle2, AlertTriangle, Layers, Calendar, CheckSquare, Clock, Menu, X, CheckSquare2, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout & Filter States
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiPrioritizerOpen, setAiPrioritizerOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSidebarOpen(!window.matchMedia("(max-width: 1023px)").matches);
    }
  }, []);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState<"all" | "high" | "medium" | "low">("all");
  const [selectedView, setSelectedView] = useState<"today" | "inbox" | "upcoming" | "completed" | "calendar" | "analysis">("today");
  const [sortBy, setSortBy] = useState<"manual" | "deadline" | "priority" | "title">("manual");

  // Focus Session Pomodoro Timer
  const [timerSeconds, setTimerSeconds] = useState(24 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMaxSeconds, setTimerMaxSeconds] = useState(24 * 60);

  // AI Plan states
  const [currentPlan, setCurrentPlan] = useState<AIPlanResult | null>(null);

  // Task Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultFormDate, setDefaultFormDate] = useState<string | undefined>(undefined);

  // Dynamic Categories from Firestore
  const [categories, setCategories] = useState<string[]>([]);

  // Task Start Alarms & Notifications State
  const [activeAlarms, setActiveAlarms] = useState<Task[]>([]);
  const [notifiedTaskIds, setNotifiedTaskIds] = useState<{ [id: string]: boolean }>({});
  const [snoozedUntil, setSnoozedUntil] = useState<{ [id: string]: number }>({});

  // Overdue Alarms & Escalation State
  const [activeOverdueAlarms, setActiveOverdueAlarms] = useState<Task[]>([]);
  const [overdueAlarmsState, setOverdueAlarmsState] = useState<{
    [taskId: string]: {
      nextTriggerTime: number;
      currentIntervalMs: number;
      hasTriggeredInitial: boolean;
    }
  }>(() => {
    try {
      const saved = localStorage.getItem("nexus_sync_overdue_alarms");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Sync overdue state to localStorage
  useEffect(() => {
    localStorage.setItem("nexus_sync_overdue_alarms", JSON.stringify(overdueAlarmsState));
  }, [overdueAlarmsState]);

  // Postpone task States
  const [postponeTaskId, setPostponeTaskId] = useState<string | null>(null);
  const [customPostponeDate, setCustomPostponeDate] = useState<string>("");

  // Synchronize looping alarm play/stop with active alert overlays
  useEffect(() => {
    if (activeOverdueAlarms.length > 0) {
      // Overdue alarms take priority and play high-tension siren loops
      startLoopingAlarm('overdue');
    } else if (activeAlarms.length > 0) {
      // Start alarms play persistent rhythmic bell chiming loops
      startLoopingAlarm('start');
    } else {
      stopLoopingAlarm();
    }

    return () => {
      stopLoopingAlarm();
    };
  }, [activeAlarms, activeOverdueAlarms]);

  // Background alarm and notification scheduler
  useEffect(() => {
    // Request permission on load
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(console.error);
      }
    }

    const checkAlarms = () => {
      const now = Date.now();
      
      // 1. Task Start Alarms
      const alarmsToTrigger: Task[] = [];
      const newNotified = { ...notifiedTaskIds };
      let updated = false;

      tasks.forEach((task) => {
        // Only trigger for todo status that has a deadline and is not completed/in_progress
        if (task.status === "todo" && task.deadline) {
          // Skip if snoozed
          if (snoozedUntil[task.id] && now < snoozedUntil[task.id]) {
            return;
          }

          const deadlineTime = new Date(task.deadline).getTime();
          const estMinutes = task.estimatedMinutes || 30;
          const mustStartTime = deadlineTime - estMinutes * 60 * 1000;

          // Check if we are past or at the must-start time, before deadline, and haven't notified yet
          if (now >= mustStartTime && now < deadlineTime && !notifiedTaskIds[task.id]) {
            alarmsToTrigger.push(task);
            newNotified[task.id] = true;
            updated = true;
          }
        }
      });

      if (alarmsToTrigger.length > 0) {
        // Play the premium alarm chime
        playTaskStartAlarmSound();

        // Add to active alarms list
        setActiveAlarms((prev) => {
          const filtered = prev.filter(p => !alarmsToTrigger.some(t => t.id === p.id));
          return [...filtered, ...alarmsToTrigger];
        });

        // Trigger native notifications
        alarmsToTrigger.forEach((task) => {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`⏰ Begin Task: ${task.title}`, {
                body: `You should begin this task now (Estimated duration: ${task.estimatedMinutes || 30}m) to finish before the deadline!`,
                tag: task.id,
              });
            } catch (err) {
              console.warn("Failed to send native notification:", err);
            }
          }
        });
      }

      if (updated) {
        setNotifiedTaskIds(newNotified);
      }

      // 2. Overdue Escalation Alarms
      const overdueToTrigger: Task[] = [];
      const updatedOverdueState = { ...overdueAlarmsState };
      let overdueStateChanged = false;

      tasks.forEach((task) => {
        if (task.status !== "completed" && task.deadline) {
          const deadlineTime = new Date(task.deadline).getTime();
          if (now > deadlineTime) {
            const state = updatedOverdueState[task.id];
            
            if (!state) {
              // Initialize overdue state: half the task estimated duration (or default to 5m/300k ms)
              const taskDurationMs = (task.estimatedMinutes || 30) * 60 * 1000;
              const initialIntervalMs = Math.max(30000, Math.min(10 * 60 * 1000, taskDurationMs / 2));
              
              updatedOverdueState[task.id] = {
                nextTriggerTime: now, // trigger the initial overdue alarm immediately!
                currentIntervalMs: initialIntervalMs,
                hasTriggeredInitial: true
              };
              overdueStateChanged = true;
              overdueToTrigger.push(task);
            } else {
              // Check if it's time to trigger another alarm
              if (now >= state.nextTriggerTime) {
                overdueToTrigger.push(task);
                
                // Set next trigger to Infinity temporarily while alarm is active so it doesn't repeatedly ring every 10s tick
                updatedOverdueState[task.id] = {
                  ...state,
                  nextTriggerTime: Infinity
                };
                overdueStateChanged = true;
              }
            }
          }
        } else {
          // Clean up if completed
          if (updatedOverdueState[task.id]) {
            delete updatedOverdueState[task.id];
            overdueStateChanged = true;
          }
        }
      });

      if (overdueStateChanged) {
        setOverdueAlarmsState(updatedOverdueState);
      }

      if (overdueToTrigger.length > 0) {
        // Play the urgent overdue alarm beeping
        playOverdueUrgentAlarmSound();

        setActiveOverdueAlarms((prev) => {
          const filtered = prev.filter(p => !overdueToTrigger.some(t => t.id === p.id));
          return [...filtered, ...overdueToTrigger];
        });

        overdueToTrigger.forEach((task) => {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`⚠️ Task OVERDUE: ${task.title}`, {
                body: `The deadline has passed! Please mark as complete or keep working under urgency.`,
                tag: `overdue-${task.id}`,
              });
            } catch (err) {
              console.warn("Failed to send native notification:", err);
            }
          }
        });
      }
    };

    // Check immediately and then every 10 seconds
    checkAlarms();
    const interval = setInterval(checkAlarms, 10000);
    return () => clearInterval(interval);
  }, [tasks, notifiedTaskIds, snoozedUntil, overdueAlarmsState]);

  // Handler to mark task as in_progress (Started)
  const handleStartTask = async (id: string) => {
    // Clear active alarm for this task if any
    setActiveAlarms((prev) => prev.filter((a) => a.id !== id));

    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!currentUser) {
      // Guest mode
      const updatedTask = { ...task, status: "in_progress" as const, updatedAt: new Date().toISOString() };
      const newTasks = tasks.map(t => t.id === id ? updatedTask : t);
      setTasks(newTasks);
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
      return;
    }

    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        status: "in_progress",
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error starting task:", error);
    }
  };

  // Handler to record snooze and increment count
  const handleSnoozeTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const currentSnoozes = task.snoozeCount || 0;

    if (!currentUser) {
      const updatedTask = { ...task, snoozeCount: currentSnoozes + 1, updatedAt: new Date().toISOString() };
      const newTasks = tasks.map(t => t.id === id ? updatedTask : t);
      setTasks(newTasks);
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
      return;
    }

    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        snoozeCount: currentSnoozes + 1,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating snooze count:", error);
    }
  };

  // Handler to postpone a task's deadline and clear overdue states
  const handlePostponeTask = async (id: string, minutes: number, customDateTime?: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let newDeadline = "";
    if (customDateTime) {
      newDeadline = new Date(customDateTime).toISOString();
    } else {
      newDeadline = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    // Clear from active overdue alarms immediately
    setActiveOverdueAlarms((prev) => prev.filter((a) => a.id !== id));
    setPostponeTaskId(null);
    setCustomPostponeDate("");
    
    setOverdueAlarmsState((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    if (!currentUser) {
      // Guest mode
      const updatedTask = { ...task, deadline: newDeadline, updatedAt: new Date().toISOString() };
      const newTasks = tasks.map(t => t.id === id ? updatedTask : t);
      setTasks(newTasks);
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
      return;
    }

    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        deadline: newDeadline,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error postponing task deadline:", error);
    }
  };

  // Handler to start a task and configure the Pomodoro timer for its estimated minutes
  const handleStartTaskWithTimer = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Start the task status change
    await handleStartTask(id);

    // Set and start the Pomodoro Focus Session timer
    const estMinutes = task.estimatedMinutes || 30;
    const estSeconds = estMinutes * 60;
    setTimerSeconds(estSeconds);
    setTimerMaxSeconds(estSeconds);
    setIsTimerRunning(true);
  };

  // Handler to mark overdue task as complete
  const handleMarkOverdueComplete = async (id: string) => {
    setActiveOverdueAlarms((prev) => prev.filter((a) => a.id !== id));
    
    setOverdueAlarmsState((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Toggle status to complete (which plays completion sound and handles recurrence advance)
    await handleToggleStatus(id);
  };

  // Handler to schedule the next overdue alarm with half the current interval
  const handleMarkOverdueIncomplete = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const now = Date.now();
    const currentState = overdueAlarmsState[id];
    let prevInterval = 300000; // default 5 minutes
    
    if (currentState && currentState.currentIntervalMs) {
      prevInterval = currentState.currentIntervalMs;
    } else {
      const taskDurationMs = (task.estimatedMinutes || 30) * 60 * 1000;
      prevInterval = Math.max(30000, Math.min(10 * 60 * 1000, taskDurationMs / 2));
    }

    // Exponentially decrease interval (divide by 2) with a safety minimum of 10 seconds to avoid browser locks
    const nextInterval = Math.max(10000, prevInterval / 2);
    const nextTrigger = now + nextInterval;

    setOverdueAlarmsState((prev) => ({
      ...prev,
      [id]: {
        nextTriggerTime: nextTrigger,
        currentIntervalMs: nextInterval,
        hasTriggeredInitial: true
      }
    }));

    // Dismiss active overdue list alert
    setActiveOverdueAlarms((prev) => prev.filter((a) => a.id !== id));
    handleSnoozeTask(id);

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const secondsLeft = Math.round(nextInterval / 1000);
        const formatStr = secondsLeft >= 60 
          ? `${Math.round(secondsLeft / 60)}m` 
          : `${secondsLeft}s`;
        new Notification(`⏳ Urgency Escalated: ${task.title}`, {
          body: `Next alarm scheduled in ${formatStr}! Keep going!`,
          tag: `urgency-${task.id}`,
        });
      } catch (err) {
        console.warn(err);
      }
    }
  };


  // Root-level Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Timer tick effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      playTimerEndSound();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  const handleStartStopTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(timerMaxSeconds);
  };

  // Real-time Firestore Sync & Guest Local Sync
  useEffect(() => {
    if (!currentUser) {
      // Guest mode fallback
      const localTasksData = localStorage.getItem("nexus_sync_local_tasks");
      if (localTasksData) {
        try {
          const parsed = JSON.parse(localTasksData);
          setTasks(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          console.error("Failed to parse local tasks:", e);
          setTasks([]);
        }
      } else {
        setTasks([]);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "tasks"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksList: Task[] = [];
      snapshot.forEach((doc) => {
        tasksList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tasksList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Derive unique categories dynamically whenever tasks change (works for both Guest and Cloud modes)
  useEffect(() => {
    const customCats = Array.from(new Set(tasks.map(t => t.category))).filter(Boolean);
    setCategories(customCats);
  }, [tasks]);

  // Migrate local tasks to Firestore upon successful login
  useEffect(() => {
    if (currentUser) {
      const localTasksData = localStorage.getItem("nexus_sync_local_tasks");
      if (localTasksData) {
        try {
          const localTasks = JSON.parse(localTasksData);
          if (Array.isArray(localTasks) && localTasks.length > 0) {
            console.log("[Firebase] Syncing local tasks to cloud database...");
            const syncTasks = async () => {
              for (const task of localTasks) {
                // Strip the temporary local ID and upload to Firestore
                const { id, ...firebaseTask } = task;
                await addDoc(collection(db, "tasks"), {
                  ...firebaseTask,
                  userId: currentUser.uid,
                  createdAt: task.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              }
              // Clear local tasks after sync
              localStorage.removeItem("nexus_sync_local_tasks");
            };
            syncTasks().catch(err => console.error("Failed to migrate local tasks:", err));
          }
        } catch (e) {
          console.error("Failed to parse local tasks for migration:", e);
        }
      }
    }
  }, [currentUser]);

  // Form Submission
  const handleTaskSubmit = async (taskData: any) => {
    if (!currentUser) {
      // Guest mode: Save to local state and localStorage
      const newTasks = [...tasks];
      if (editingTask) {
        const index = newTasks.findIndex(t => t.id === editingTask.id);
        if (index !== -1) {
          newTasks[index] = {
            ...editingTask,
            ...taskData,
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        const nextPos = tasks.length > 0 ? Math.max(...tasks.map(t => t.position ?? 0)) + 1 : 0;
        const newTask: Task = {
          id: `local-${Date.now()}`,
          ...taskData,
          position: nextPos,
          userId: "guest",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        newTasks.push(newTask);
      }
      setTasks(newTasks);
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
      setIsFormOpen(false);
      setEditingTask(null);
      return;
    }

    try {
      if (editingTask) {
        const taskDocRef = doc(db, "tasks", editingTask.id);
        await updateDoc(taskDocRef, {
          ...taskData,
          updatedAt: new Date().toISOString()
        });
      } else {
        const nextPos = tasks.length > 0 ? Math.max(...tasks.map(t => t.position ?? 0)) + 1 : 0;
        await addDoc(collection(db, "tasks"), {
          ...taskData,
          position: nextPos,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setIsFormOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  // Helper: Calculate next recurrence deadline
  const calculateNextOccurrence = (currentDeadline: string, recurrencePattern: string): string => {
    const baseDate = currentDeadline ? new Date(currentDeadline) : new Date();
    if (isNaN(baseDate.getTime())) {
      return currentDeadline;
    }
    const nextDate = new Date(baseDate.getTime());
    
    if (recurrencePattern === "daily") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (recurrencePattern === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (recurrencePattern === "3_days_a_week") {
      const day = nextDate.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
      if (day === 1) { // Mon -> Wed
        nextDate.setDate(nextDate.getDate() + 2);
      } else if (day === 3) { // Wed -> Fri
        nextDate.setDate(nextDate.getDate() + 2);
      } else if (day === 5) { // Fri -> Mon
        nextDate.setDate(nextDate.getDate() + 3);
      } else {
        if (day === 0 || day === 2 || day === 4) {
          nextDate.setDate(nextDate.getDate() + 1);
        } else {
          nextDate.setDate(nextDate.getDate() + 2);
        }
      }
    } else if (recurrencePattern === "monthly") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const date = String(nextDate.getDate()).padStart(2, "0");
    const hours = String(nextDate.getHours()).padStart(2, "0");
    const minutes = String(nextDate.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${date}T${hours}:${minutes}`;
  };

  // Toggle task completed/todo
  const handleToggleStatus = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const isCompleting = task.status !== "completed";
    const hasRecurrence = task.recurrence && task.recurrence !== "none";

    if (isCompleting) {
      playCompletionSound();
    }

    if (!currentUser) {
      // Guest mode
      let updatedTask = { ...task };
      if (isCompleting && hasRecurrence) {
        // Advance recurrence deadline and increment completions
        updatedTask.deadline = calculateNextOccurrence(task.deadline, task.recurrence!);
        updatedTask.completedOccurrences = (task.completedOccurrences || 0) + 1;
        updatedTask.status = "todo"; // Keep active for next occurrence
        updatedTask.updatedAt = new Date().toISOString();
      } else {
        updatedTask.status = task.status === "completed" ? "todo" : "completed";
        updatedTask.updatedAt = new Date().toISOString();
      }

      const newTasks = tasks.map(t => t.id === id ? updatedTask : t);
      setTasks(newTasks);
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
      return;
    }

    try {
      const taskDocRef = doc(db, "tasks", id);
      if (isCompleting && hasRecurrence) {
        const nextDeadline = calculateNextOccurrence(task.deadline, task.recurrence!);
        const nextCompletions = (task.completedOccurrences || 0) + 1;
        await updateDoc(taskDocRef, {
          deadline: nextDeadline,
          completedOccurrences: nextCompletions,
          status: "todo", // Keep active for next occurrence
          updatedAt: new Date().toISOString()
        });
      } else {
        const newStatus = task.status === "completed" ? "todo" : "completed";
        await updateDoc(taskDocRef, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error toggling task status:", error);
    }
  };

  // Toggle specific subtask completion
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!currentUser) {
      // Guest mode
      const updatedSubtasks = task.subtasks.map(s => 
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      const newTasks = tasks.map(t => 
        t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() } : t
      );
      setTasks(newTasks);
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
      return;
    }

    try {
      const updatedSubtasks = task.subtasks.map(s => 
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      const taskDocRef = doc(db, "tasks", taskId);
      await updateDoc(taskDocRef, {
        subtasks: updatedSubtasks,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error toggling subtask:", error);
    }
  };

  // Edit Trigger
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  // Delete Operation
  const handleDeleteTask = async (id: string) => {
    if (confirm("Are you sure you want to delete this scheduled task?")) {
      if (!currentUser) {
        // Guest mode
        const newTasks = tasks.filter(t => t.id !== id);
        setTasks(newTasks);
        localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(newTasks));
        return;
      }

      try {
        await deleteDoc(doc(db, "tasks", id));
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  // Drag and Drop States & Handlers
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || index < 0 || index >= sortedTasks.length) return;

    if (sortBy !== "manual") {
      setSortBy("manual");
    }

    const updated = [...sortedTasks];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    const updatedWithPositions = updated.map((t, i) => ({
      ...t,
      position: i
    }));

    const newTasks = tasks.map(t => {
      const found = updatedWithPositions.find(ut => ut.id === t.id);
      if (found) {
        return found;
      }
      return t;
    });

    setTasks(newTasks);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);

    if (!currentUser) {
      localStorage.setItem("nexus_sync_local_tasks", JSON.stringify(tasks));
      return;
    }

    try {
      const promises = tasks.map(t => {
        const docRef = doc(db, "tasks", t.id);
        return updateDoc(docRef, {
          position: t.position ?? 0,
          updatedAt: new Date().toISOString()
        });
      });
      await Promise.all(promises);
    } catch (error) {
      console.error("Error saving positions to Firestore:", error);
    }
  };

  // Compute Weekdays for Dynamic Timeline (Monday to Sunday)
  const getWeekDays = () => {
    const current = new Date();
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    
    const days = [];
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        label: dayLabels[i],
        dateString: d.toDateString(),
        isToday: d.toDateString() === new Date().toDateString()
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  const getTimelineColorForDay = (dateStr: string) => {
    const tasksOnDay = tasks.filter(t => {
      if (!t.deadline || t.status === "completed") return false;
      const tDate = new Date(t.deadline).toDateString();
      return tDate === dateStr;
    });
    if (tasksOnDay.length === 0) return "bg-[#2C2C2A]";
    const hasHigh = tasksOnDay.some(t => t.priority === "high");
    if (hasHigh) return "bg-[#D4A373]"; // Clay Orange
    return "bg-[#A3AD9A]"; // Sage Green
  };

  // Filter & Sort Logic
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) || 
                          (task.description && task.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = selectedCategory === "All" || task.category === selectedCategory;
    const matchesPriority = selectedPriority === "all" || task.priority === selectedPriority;
    
    let matchesView = true;
    if (selectedView === "today") {
      const isCompleted = task.status === "completed";
      if (isCompleted) {
        matchesView = false;
      } else if (task.deadline) {
        const isToday = new Date(task.deadline).toDateString() === new Date().toDateString();
        matchesView = isToday || task.priority === "high";
      } else {
        matchesView = true; // Show active tasks without deadlines as well
      }
    } else if (selectedView === "inbox") {
      matchesView = task.status !== "completed";
    } else if (selectedView === "upcoming") {
      const isCompleted = task.status === "completed";
      if (isCompleted) {
        matchesView = false;
      } else if (task.deadline) {
        const deadlineTime = new Date(task.deadline).getTime();
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        matchesView = deadlineTime >= todayStart.getTime();
      } else {
        matchesView = false;
      }
    } else if (selectedView === "completed") {
      matchesView = task.status === "completed";
    }

    return matchesSearch && matchesCategory && matchesPriority && matchesView;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "manual") {
      const posA = a.position !== undefined ? a.position : 0;
      const posB = b.position !== undefined ? b.position : 0;
      if (posA !== posB) return posA - posB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === "title") {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === "priority") {
      const weight = { high: 3, medium: 2, low: 1 };
      return weight[b.priority] - weight[a.priority];
    }
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  // Stats calculation
  const activeTasks = tasks.filter(t => t.status !== "completed");
  const completedTasks = tasks.filter(t => t.status === "completed");
  
  // Remaining priorities count
  const remainingPriorities = tasks.filter(t => {
    if (t.status === "completed") return false;
    if (t.priority === "high") return true;
    if (t.deadline) {
      return new Date(t.deadline).toDateString() === new Date().toDateString();
    }
    return false;
  }).length;

  // Daily Progress specifically for tasks scheduled on the current date (today)
  const todayStr = new Date().toDateString();
  const todayTasks = tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === todayStr);
  const completedTodayTasks = todayTasks.filter(t => t.status === "completed");
  const progressPercent = todayTasks.length > 0 ? Math.round((completedTodayTasks.length / todayTasks.length) * 100) : 0;

  // Streak calculator
  const calculateStreak = () => {
    const completedDates = tasks
      .filter(t => t.status === "completed" && t.updatedAt)
      .map(t => new Date(t.updatedAt!).toDateString());
    
    if (completedDates.length === 0) return 0;
    
    const uniqueDateStrings = Array.from(new Set(completedDates));
    
    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0,0,0,0);
    
    const hasToday = uniqueDateStrings.includes(checkDate.toDateString());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0,0,0,0);
    const hasYesterday = uniqueDateStrings.includes(yesterday.toDateString());
    
    if (!hasToday && !hasYesterday) return 0;
    
    const currentCheck = new Date(hasToday ? checkDate : yesterday);
    while (true) {
      const checkStr = currentCheck.toDateString();
      if (uniqueDateStrings.includes(checkStr)) {
        streak++;
        currentCheck.setDate(currentCheck.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const calculatedStreak = calculateStreak();
  const streakDays = calculatedStreak; // Real, accurate streak without hardcoded fallbacks!

  // Current week days generator (Monday to Sunday)
  const getCurrentWeekDays = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + mondayOffset + i);
      d.setHours(0,0,0,0);
      days.push(d);
    }
    return days;
  };

  const streakWeekDays = getCurrentWeekDays();
  const completedWeekDays = streakWeekDays.map(day => {
    const dayStr = day.toDateString();
    const isCompleted = tasks.some(t => 
      t.status === "completed" && 
      t.updatedAt && 
      new Date(t.updatedAt).toDateString() === dayStr
    );
    return {
      date: day,
      label: day.toLocaleDateString("en-US", { weekday: "narrow" }),
      isCompleted,
      isToday: day.toDateString() === new Date().toDateString()
    };
  });

  // Timer format & circle calculation
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const timerRatio = timerSeconds / timerMaxSeconds;
  const strokeDashoffset = Math.round(477 - 477 * timerRatio);

  const formattedDateString = new Intl.DateTimeFormat("en-US", { 
    weekday: "long", 
    month: "short", 
    day: "numeric" 
  }).format(new Date());

  // Detect urgent deadline warning (due within 24 hours)
  const loomingTasks = activeTasks.filter(t => {
    if (!t.deadline) return false;
    const diff = new Date(t.deadline).getTime() - Date.now();
    return diff > 0 && diff < 1000 * 60 * 60 * 24;
  });

  return (
    <div className="flex w-full h-screen bg-[#121211] text-[#E5E5E0] font-sans overflow-hidden selection:bg-[#A3AD9A] selection:text-[#121211]">
      
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-[#181816] border-b border-[#2C2C2A] flex justify-between items-center px-6 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#A3AD9A] flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-[#121211] rounded-sm"></div>
          </div>
          <span className="font-semibold tracking-tight text-lg">Prodak</span>
        </div>
        <button 
          id="toggle-mobile-menu-btn"
          onClick={() => setSidebarOpen(prev => !prev)}
          className="p-2 hover:bg-[#2C2C2A] rounded-xl text-[#888880] hover:text-[#E5E5E0] transition-colors cursor-pointer"
          title={sidebarOpen ? "Close Workspace Sidebar" : "Open Workspace Sidebar"}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Sidebar: Navigation & Context */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside 
            id="workspace-left-sidebar"
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: "tween", duration: 0.2 }}
            className={`fixed lg:relative inset-y-0 left-0 z-40 w-64 flex flex-col border-r border-[#2C2C2A] bg-[#181816] shrink-0`}
          >
            {/* Sidebar header */}
            <div className="p-8 flex flex-col h-full">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#A3AD9A] flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-[#121211] rounded-sm"></div>
                  </div>
                  <span className="font-semibold tracking-tight text-xl">Prodak</span>
                </div>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 hover:bg-[#2C2C2A] rounded-lg text-[#888880] hover:text-[#E5E5E0] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <nav className="space-y-6 flex-1 overflow-y-auto pr-1">
                {/* Workspace segment */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#666660] mb-4 font-mono font-semibold">Workspace</p>
                  <ul className="space-y-3">
                    {[
                      { key: "today", label: "Today" },
                      { key: "inbox", label: "Inbox" },
                      { key: "upcoming", label: "Upcoming" },
                      { key: "completed", label: "Completed" },
                      { key: "calendar", label: "Calendar" },
                      { key: "analysis", label: "AI Analysis", isAi: true }
                    ].map((item) => {
                      const isSelected = selectedView === item.key && selectedCategory === "All";
                      return (
                        <li 
                          id={`sidebar-view-${item.key}`}
                          key={item.key}
                          onClick={() => {
                            setSelectedView(item.key as any);
                            setSelectedCategory("All");
                            if (window.matchMedia("(max-width: 1023px)").matches) {
                              setSidebarOpen(false);
                            }
                          }}
                          className={`flex items-center gap-3 cursor-pointer transition-colors text-sm font-medium ${
                            isSelected ? "text-[#A3AD9A]" : "text-[#888880] hover:text-[#E5E5E0]"
                          }`}
                        >
                          {isSelected ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#A3AD9A]" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                          )}
                          <span className="flex items-center gap-1.5">
                            {item.label}
                            {item.isAi && (
                              <Sparkles size={11} className={`text-[#A3AD9A] ${isSelected ? "animate-pulse" : "opacity-75"}`} />
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                
                {/* Projects segment */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#666660] mb-4 font-mono font-semibold">Projects</p>
                  <ul className="space-y-3">
                    {categories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const count = tasks.filter(t => t.category === cat && t.status !== "completed").length;
                      return (
                        <li 
                          id={`sidebar-cat-${cat}`}
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setSelectedView("inbox");
                            if (window.matchMedia("(max-width: 1023px)").matches) {
                              setSidebarOpen(false);
                            }
                          }}
                          className={`cursor-pointer flex justify-between items-center text-sm transition-colors ${
                            isSelected ? "text-[#A3AD9A] font-medium" : "text-[#888880] hover:text-[#E5E5E0]"
                          }`}
                        >
                          <span>{cat}</span>
                          <span className="text-[10px] bg-[#2C2C2A] text-[#888880] px-1.5 py-0.5 rounded font-mono">
                            {count}
                          </span>
                        </li>
                      );
                    })}
                    {categories.length === 0 && (
                      <li className="text-[11px] text-[#666660] italic font-mono pl-3">
                        No custom lists yet
                      </li>
                    )}
                  </ul>
                </div>
              </nav>
              
              {/* Sync Status area */}
              <div className="mt-auto pt-6 border-t border-[#2C2C2A] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                  <span className="text-xs text-[#888880] font-medium">All devices synced</span>
                </div>
                
                {/* Auth Setup Button inside sidebar footer */}
                <AuthOverlay currentUser={currentUser} />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto p-6 pt-24 md:p-12 md:pt-28">
        
        {/* Header section matching Geometric Balance */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight mb-2 font-display">
              {formattedDateString}
            </h1>
            <p className="text-[#888880] text-sm md:text-base">
              {selectedView === "analysis" ? (
                <span>Visual intelligence, task trends, and professional coaching insights.</span>
              ) : (
                <span>You have <span className="text-[#E5E5E0] font-medium">{remainingPriorities} priorities</span> remaining for today.</span>
              )}
            </p>
          </div>
          
          <div className="flex flex-wrap md:flex-nowrap gap-3.5 w-full md:w-auto">
            {/* New Task Trigger Button */}
            <button 
              id="header-new-task-btn"
              onClick={() => {
                setEditingTask(null);
                setIsFormOpen(true);
              }}
              className="flex-1 md:flex-none px-5 py-2 rounded-full bg-[#A3AD9A] text-[#121211] font-semibold text-xs transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
            >
              + New Task
            </button>
          </div>
        </header>

        {/* Dynamic Content Views */}
        {selectedView === "analysis" ? (
          <AIAnalysisView tasks={tasks} />
        ) : selectedView === "calendar" ? (
          <CalendarView
            tasks={tasks}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsFormOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onToggleStatus={handleToggleStatus}
            onAddTaskOnDate={(date) => {
              const offsetMs = date.getTimezoneOffset() * 60 * 1000;
              const localDate = new Date(date.getTime() - offsetMs);
              localDate.setUTCHours(9, 0, 0, 0);
              const isoString = localDate.toISOString().slice(0, 16);
              setDefaultFormDate(isoString);
              setEditingTask(null);
              setIsFormOpen(true);
            }}
          />
        ) : (
          <>
            <section className="mb-10">
              <div className="grid grid-cols-7 gap-4 text-center text-[10px] uppercase tracking-tighter text-[#666660] mb-3 font-mono font-medium">
                {weekDays.map(day => (
                  <div key={day.label} className={day.isToday ? "text-[#A3AD9A] font-bold" : ""}>
                    {day.label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4">
                {weekDays.map(day => (
                  <div 
                    key={day.label} 
                    className={`h-1 rounded-full transition-colors ${getTimelineColorForDay(day.dateString)}`}
                    title={day.isToday ? "Today" : undefined}
                  />
                ))}
              </div>
            </section>

            {/* Interactive AI Planner Module Block */}
            <AnimatePresence>
              {aiPrioritizerOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <AIPrioritizer 
                    tasks={tasks} 
                    onAIPlanGenerated={(plan) => setCurrentPlan(plan)}
                    currentPlan={currentPlan}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Urgent Alerts Warning */}
            <AnimatePresence>
              {loomingTasks.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 bg-red-950/10 border border-red-900/30 rounded-2xl flex gap-3.5 items-start text-xs text-[#D4A373] mb-6"
                >
                  <AlertTriangle size={16} className="shrink-0 text-[#D4A373] animate-bounce" />
                  <div>
                    <span className="font-mono uppercase font-bold tracking-wide block mb-0.5">Looming Deadline Alert:</span>
                    You have {loomingTasks.length} task(s) expiring within 24 hours. Ensure priorities are executed to avoid missed schedules!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search, Sorters, & Category selection block */}
            <div className="mb-6 p-4 bg-[#181816] rounded-2xl border border-[#2C2C2A] flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-[#888880]" />
                  <input 
                    id="main-search-input"
                    type="text" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search plan title or notes..."
                    className="w-full bg-[#121211] border border-[#2C2C2A] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#E5E5E0] placeholder-[#666660]"
                  />
                </div>
                
                {/* View filter selection dropdown for easy mobile/desktop access */}
                <div className="flex items-center gap-2 bg-[#121211] border border-[#2C2C2A] rounded-xl px-3 py-1 text-xs">
                  <Filter size={12} className="text-[#888880]" />
                  <select
                    id="view-select-filter"
                    value={selectedView}
                    onChange={(e) => {
                      setSelectedView(e.target.value as any);
                      setSelectedCategory("All");
                    }}
                    className="bg-transparent border-none text-[#888880] hover:text-[#E5E5E0] cursor-pointer font-mono outline-none"
                  >
                    <option value="today">Today's Focus</option>
                    <option value="inbox">Active Inbox</option>
                    <option value="upcoming">Upcoming Deadlines</option>
                    <option value="completed">Completed Logs</option>
                    <option value="calendar">Calendar Schedule</option>
                  </select>
                </div>

                {/* Priority Filter Selector */}
                <div className="flex items-center gap-2 bg-[#121211] border border-[#2C2C2A] rounded-xl px-3 py-1 text-xs">
                  <AlertCircle size={12} className="text-[#888880]" />
                  <select
                    id="priority-select-filter"
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as any)}
                    className="bg-transparent border-none text-[#888880] hover:text-[#E5E5E0] cursor-pointer font-mono outline-none"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                {/* Sorter Selector */}
                <div className="flex items-center gap-2 bg-[#121211] border border-[#2C2C2A] rounded-xl px-3 py-1 text-xs">
                  <SlidersHorizontal size={12} className="text-[#888880]" />
                  <select
                    id="sort-select-filter"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none text-[#888880] hover:text-[#E5E5E0] cursor-pointer font-mono outline-none"
                  >
                    <option value="manual">Sort: Custom Order</option>
                    <option value="deadline">Sort: Deadline</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="title">Sort: Title</option>
                  </select>
                </div>
              </div>

              {/* Quick Filters category row */}
              {(selectedCategory !== "All" || selectedPriority !== "all") && (
                <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-[#2C2C2A]/40 text-xs">
                  <span className="text-[#666660] font-mono uppercase text-[10px]">Active Filters:</span>
                  {selectedCategory !== "All" && (
                    <span className="px-3 py-1 rounded-full bg-[#2C2C2A] text-[#A3AD9A] font-medium flex items-center gap-1.5 font-mono text-[11px]">
                      Project: {selectedCategory}
                      <button 
                        onClick={() => setSelectedCategory("All")}
                        className="hover:text-red-400 transition-colors text-[10px] ml-1"
                        title="Clear Project Filter"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedPriority !== "all" && (
                    <span className="px-3 py-1 rounded-full bg-[#2C2C2A] text-[#D4A373] font-medium flex items-center gap-1.5 font-mono text-[11px]">
                      Priority: {selectedPriority.toUpperCase()}
                      <button 
                        onClick={() => setSelectedPriority("all")}
                        className="hover:text-red-400 transition-colors text-[10px] ml-1"
                        title="Clear Priority Filter"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Task List container */}
            <section className="space-y-4 flex-1">
              {loading ? (
                <div className="p-16 text-center text-xs text-[#888880] font-mono animate-pulse">
                  Synchronizing with Cloud State Engine...
                </div>
              ) : sortedTasks.length > 0 ? (
                <div className="space-y-4">
                  {sortedTasks.map((task, index) => {
                    const recommendation = currentPlan?.taskRecommendations?.find(r => r.id === task.id);
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onToggleStatus={handleToggleStatus}
                        onToggleSubtask={handleToggleSubtask}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onStartTask={handleStartTaskWithTimer}
                        aiRecommendation={recommendation}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedIndex === index}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-16 text-center rounded-2xl border border-[#2C2C2A]/60 bg-[#181816]/40 flex flex-col items-center justify-center gap-2 text-[#888880]">
                  <CheckCircle2 size={36} className="text-[#666660] mb-1" />
                  <span className="text-sm font-medium text-[#E5E5E0]">No items in view</span>
                  <span className="text-xs text-[#888880]">
                    {search ? "Relax search query filters" : "Add some items to build up your focus daily targets."}
                  </span>
                </div>
              )}
            </section>

            {/* Category Task Distribution Visualizer Section */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <CategoryChart 
                tasks={tasks}
                selectedCategory={selectedCategory}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  setSelectedView("inbox");
                }}
              />
            </motion.div>
          </>
        )}
      </main>

      {/* Right Sidebar: Focus Timer & Metrics */}
      <aside className="hidden xl:flex w-80 bg-[#181816] border-l border-[#2C2C2A] p-10 flex-col overflow-y-auto shrink-0">
        
        {/* Pomodoro Focus Timer Section */}
        <div className="text-center mb-10 pb-10 border-b border-[#2C2C2A]/60">
          <p className="text-[10px] uppercase tracking-widest text-[#666660] mb-8 font-mono font-bold">Focus Session</p>
          
          <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center group/timer">
            <svg className="absolute w-full h-full -rotate-90">
              <circle cx="80" cy="80" r="76" stroke="#2C2C2A" strokeWidth="4" fill="transparent" />
              <circle 
                cx="80" 
                cy="80" 
                r="76" 
                stroke="#A3AD9A" 
                strokeWidth="4" 
                fill="transparent" 
                strokeDasharray="477" 
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            
            {isTimerRunning ? (
              <span className="text-4xl font-light tabular-nums text-[#E5E5E0] z-10">
                {formatTimer(timerSeconds)}
              </span>
            ) : (
              <div className="flex flex-col items-center justify-center z-10 select-none">
                <div className="flex items-center justify-center text-4xl font-light tabular-nums text-[#E5E5E0]">
                  <input
                    id="focus-timer-minutes-input"
                    type="number"
                    min="1"
                    max="1440"
                    value={Math.floor(timerSeconds / 60)}
                    onChange={(e) => {
                      const mins = Math.max(1, Math.min(1440, parseInt(e.target.value) || 1));
                      const secs = mins * 60;
                      setTimerSeconds(secs);
                      setTimerMaxSeconds(secs);
                    }}
                    className="w-16 bg-transparent text-center focus:outline-none border-b border-dashed border-[#A3AD9A]/40 focus:border-[#A3AD9A] p-0 font-sans font-light [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text hover:border-[#A3AD9A] transition-colors"
                    title="Type custom minutes"
                  />
                  <span className="text-2xl text-[#666660] ml-0.5">:</span>
                  <span className="text-4xl font-light text-[#666660]">
                    {timerSeconds % 60 === 0 ? "00" : (timerSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                
                {/* Micro-adjusters for quick changes */}
                <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover/timer:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => {
                      const currentMins = Math.floor(timerSeconds / 60);
                      const newMins = Math.max(1, currentMins - 1);
                      const secs = newMins * 60;
                      setTimerSeconds(secs);
                      setTimerMaxSeconds(secs);
                    }}
                    className="w-4 h-4 rounded bg-[#2C2C2A] text-[#888880] hover:text-[#E5E5E0] hover:bg-[#3C3C3A] flex items-center justify-center text-[10px] transition-colors cursor-pointer select-none font-bold"
                    title="-1 Minute"
                  >
                    -
                  </button>
                  <span className="text-[9px] uppercase font-mono tracking-wider text-[#666660] select-none">Mins</span>
                  <button
                    onClick={() => {
                      const currentMins = Math.floor(timerSeconds / 60);
                      const newMins = Math.min(1440, currentMins + 1);
                      const secs = newMins * 60;
                      setTimerSeconds(secs);
                      setTimerMaxSeconds(secs);
                    }}
                    className="w-4 h-4 rounded bg-[#2C2C2A] text-[#888880] hover:text-[#E5E5E0] hover:bg-[#3C3C3A] flex items-center justify-center text-[10px] transition-colors cursor-pointer select-none font-bold"
                    title="+1 Minute"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button 
            id="focus-timer-action-btn"
            onClick={handleStartStopTimer}
            className="w-full py-3 rounded-full border border-[#A3AD9A] text-[#A3AD9A] text-sm font-medium transition-all hover:bg-[#A3AD9A]/10 active:scale-[0.98] cursor-pointer"
          >
            {isTimerRunning ? "Pause Session" : "Start Timer"}
          </button>
          
          <button 
            id="focus-timer-reset-btn"
            onClick={handleResetTimer}
            className="text-[10px] uppercase tracking-wider text-[#666660] hover:text-[#A3AD9A] mt-3 transition-colors cursor-pointer font-mono inline-block"
          >
            Reset Session
          </button>
        </div>

        {/* Metrics/Streak Section */}
        <div className="mt-auto space-y-8">
          {/* Daily Progress Widget */}
          <div className="p-6 rounded-2xl bg-[#1C1C1A] border border-[#2C2C2A]">
            <p className="text-[10px] uppercase tracking-widest text-[#666660] mb-3 font-mono font-bold">Daily Progress</p>
            <div className="text-3xl font-light mb-4 font-display">{progressPercent}%</div>
            <div className="w-full h-1 bg-[#2C2C2A] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#A3AD9A] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Daily Streak Widget */}
          <div className="p-6 rounded-2xl bg-[#1C1C1A] border border-[#2C2C2A] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-[#666660] font-mono font-bold">Weekly Streak</span>
                <span className="font-semibold text-lg text-[#E5E5E0] mt-0.5">
                  {streakDays} {streakDays === 1 ? "Day" : "Days"}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${
                streakDays > 0 
                  ? "bg-[#D4A373]/15 text-[#D4A373] shadow-[0_0_15px_rgba(212,163,115,0.25)] animate-pulse" 
                  : "bg-[#2C2C2A] text-[#666660]"
              }`}>
                ✦
              </div>
            </div>

            {/* 7-Day Completion Dots Grid */}
            <div className="pt-2.5 border-t border-[#2C2C2A]/60">
              <div className="grid grid-cols-7 gap-1 text-center">
                {completedWeekDays.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[9px] font-mono font-medium ${
                      day.isToday ? "text-[#A3AD9A] font-bold" : "text-[#666660]"
                    }`}>
                      {day.label}
                    </span>
                    <div 
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-300 ${
                        day.isCompleted 
                          ? "bg-[#A3AD9A] text-[#181816] font-bold shadow-[0_2px_10px_rgba(163,173,154,0.3)]" 
                          : day.isToday
                            ? "border border-dashed border-[#A3AD9A]/60 bg-[#A3AD9A]/5 text-[#A3AD9A]/80 font-bold"
                            : "bg-[#2C2C2A]/60 border border-[#2C2C2A] text-[#555550]"
                      }`}
                      title={`${day.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} - ${day.isCompleted ? "Completed task!" : "No tasks completed"}`}
                    >
                      {day.isCompleted ? "✓" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Motivation micro-text */}
            <p className="text-[9px] text-[#888880] font-mono text-center">
              {streakDays > 0 
                ? "You're doing great! Keep it up to build your momentum." 
                : "Complete a task today to kickstart your weekly streak!"}
            </p>
          </div>
        </div>
      </aside>

      {/* Active Alarms overlay */}
      <AnimatePresence>
        {activeAlarms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[400px] bg-[#1C1C1A] border-2 border-red-500/30 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />
            
            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-2 bg-red-950/40 rounded-xl border border-red-500/30 text-red-400 shrink-0 animate-bounce">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-widest font-mono font-bold text-red-400">Must Begin Alert!</span>
                <h3 className="text-sm font-semibold text-white truncate mt-0.5">
                  Begin Scheduled Tasks
                </h3>
                <p className="text-[11px] text-[#888880] mt-0.5 leading-relaxed">
                  Start these now to finish before their deadlines!
                </p>
              </div>
              <button 
                onClick={() => {
                  const now = Date.now();
                  const snoozeTimes: { [id: string]: number } = {};
                  activeAlarms.forEach(a => {
                    snoozeTimes[a.id] = now + 5 * 60 * 1000;
                    handleSnoozeTask(a.id);
                  });
                  setSnoozedUntil(prev => ({ ...prev, ...snoozeTimes }));
                  setActiveAlarms([]);
                }}
                className="text-[#888880] hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-[#2C2C2A]"
                title="Snooze all alarms for 5 minutes"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
              {activeAlarms.map((alarm) => {
                const estMinutes = alarm.estimatedMinutes || 30;
                return (
                  <div 
                    key={alarm.id} 
                    className="p-3 bg-[#121210] rounded-xl border border-[#2C2C2A] flex flex-col gap-2"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-white leading-tight">{alarm.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#888880] font-mono">
                        <span className="text-red-400 font-medium uppercase text-[9px]">{alarm.priority} Priority</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {estMinutes}m duration</span>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end mt-1">
                      <button
                        onClick={() => {
                          const now = Date.now();
                          setSnoozedUntil(prev => ({ ...prev, [alarm.id]: now + 5 * 60 * 1000 }));
                          setActiveAlarms(prev => prev.filter(p => p.id !== alarm.id));
                          handleSnoozeTask(alarm.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#2C2C2A] hover:bg-[#3C3C3A] text-white text-[10px] font-medium transition-all cursor-pointer font-mono uppercase tracking-wider"
                      >
                        Snooze (5m)
                      </button>
                      <button
                        onClick={() => handleStartTask(alarm.id)}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer font-mono uppercase tracking-wider"
                      >
                        Start Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Overdue Alarms overlay */}
      <AnimatePresence>
        {activeOverdueAlarms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-[420px] md:w-[400px] bg-[#121210] border-2 border-amber-500/60 rounded-2xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.6)] z-50 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />
            
            <div className="flex items-start gap-3.5 mb-4">
              <div className="p-2 bg-amber-950/40 rounded-xl border border-amber-500/30 text-amber-400 shrink-0 animate-pulse">
                <Clock size={18} className="animate-spin" style={{ animationDuration: "4s" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-widest font-mono font-bold text-amber-400">⚠️ TASK OVERDUE ALERT!</span>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  Overdue Task Tracker
                </h3>
                <p className="text-[11px] text-[#888880] mt-0.5 leading-relaxed">
                  Have you completed this task, or is it still in progress?
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {activeOverdueAlarms.map((task) => {
                const state = overdueAlarmsState[task.id];
                const intervalMs = state ? state.currentIntervalMs : 300000;
                
                const secondsLeft = Math.round(intervalMs / 1000);
                const nextIntervalStr = secondsLeft >= 60 
                  ? `${Math.round(secondsLeft / 60)}m` 
                  : `${secondsLeft}s`;

                const initialIntervalMs = Math.max(30000, ((task.estimatedMinutes || 30) * 60 * 1000) / 2);
                const compressionFactor = Math.max(1, Math.round(initialIntervalMs / intervalMs));
                
                let urgencyBadge = "Urgent Check";
                let urgencyColor = "text-amber-400 bg-amber-950/40 border-amber-500/30";
                if (compressionFactor >= 8) {
                  urgencyBadge = "CRITICAL LIMIT";
                  urgencyColor = "text-red-500 bg-red-950/60 border-red-500/50 animate-pulse font-extrabold";
                } else if (compressionFactor >= 4) {
                  urgencyBadge = "HIGH URGENCY";
                  urgencyColor = "text-red-400 bg-red-950/40 border-red-500/30 animate-pulse font-bold";
                }

                const isCriticalSnoozeLocked = intervalMs < 60000;

                return (
                  <div 
                    key={task.id} 
                    className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-all duration-300 ${
                      isCriticalSnoozeLocked 
                        ? "bg-red-950/20 border-red-500/40 shadow-[0_4px_20px_rgba(239,68,68,0.15)]" 
                        : "bg-[#1C1C1A] border-amber-500/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white leading-tight truncate max-w-[200px]" title={task.title}>
                          {task.title}
                        </h4>
                        <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono border ${
                          isCriticalSnoozeLocked 
                            ? "text-red-400 bg-red-950/70 border-red-500/50 font-extrabold animate-pulse" 
                            : `${urgencyColor}`
                        }`}>
                          {isCriticalSnoozeLocked ? "🚨 LOCKOUT" : `${urgencyBadge} (${compressionFactor}x)`}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 mt-2 text-[10px] text-[#888880] font-mono">
                        <div className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-400" />
                          <span>Deadline passed at {task.deadline ? new Date(task.deadline).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-amber-400" />
                          <span>Urgency reminder: <span className="text-amber-400 font-semibold">every {nextIntervalStr}</span></span>
                        </div>
                        {isCriticalSnoozeLocked && (
                          <div className="flex items-center gap-1 text-red-400 font-extrabold mt-1 uppercase text-[8px] animate-pulse">
                            <AlertTriangle size={11} className="shrink-0" />
                            <span>Interval &lt; 1m: Snooze disabled! Complete task to silence.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {postponeTaskId === task.id ? (
                      <div className="bg-[#121211] p-3 rounded-xl border border-[#2C2C2A]/60 mt-2 space-y-2.5">
                        <span className="text-[9px] uppercase tracking-wider font-mono text-[#888880] block font-bold">
                          Select Postponement Offset:
                        </span>
                        
                        {/* Preset buttons */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handlePostponeTask(task.id, 15)}
                            className="px-2 py-1 bg-[#1C1C1A] hover:bg-[#A3AD9A] hover:text-black border border-[#2C2C2A] text-white rounded text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            +15 Minutes
                          </button>
                          <button
                            onClick={() => handlePostponeTask(task.id, 30)}
                            className="px-2 py-1 bg-[#1C1C1A] hover:bg-[#A3AD9A] hover:text-black border border-[#2C2C2A] text-white rounded text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            +30 Minutes
                          </button>
                          <button
                            onClick={() => handlePostponeTask(task.id, 60)}
                            className="px-2 py-1 bg-[#1C1C1A] hover:bg-[#A3AD9A] hover:text-black border border-[#2C2C2A] text-white rounded text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            +1 Hour
                          </button>
                          <button
                            onClick={() => handlePostponeTask(task.id, 1440)}
                            className="px-2 py-1 bg-[#1C1C1A] hover:bg-[#A3AD9A] hover:text-black border border-[#2C2C2A] text-white rounded text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            +1 Day
                          </button>
                        </div>

                        {/* Custom Datetime Picker */}
                        <div className="space-y-1">
                          <span className="text-[8px] uppercase tracking-wider font-mono text-[#666660] block font-bold">
                            Or Set Custom DateTime:
                          </span>
                          <div className="flex gap-1.5">
                            <input
                              type="datetime-local"
                              value={customPostponeDate}
                              onChange={(e) => setCustomPostponeDate(e.target.value)}
                              className="flex-1 bg-[#1C1C1A] border border-[#2C2C2A] rounded px-2 py-1 text-[10px] text-white font-mono"
                            />
                            <button
                              disabled={!customPostponeDate}
                              onClick={() => handlePostponeTask(task.id, 0, customPostponeDate)}
                              className="px-2.5 py-1 bg-[#A3AD9A] disabled:opacity-40 text-black rounded text-[10px] font-bold font-mono cursor-pointer"
                            >
                              Set
                            </button>
                          </div>
                        </div>

                        {/* Cancel Button */}
                        <button
                          onClick={() => {
                            setPostponeTaskId(null);
                            setCustomPostponeDate("");
                          }}
                          className="w-full text-center text-[9px] font-mono text-rose-400 hover:text-rose-300 pt-1 border-t border-[#2C2C2A]/40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#2C2C2A]">
                        {!isCriticalSnoozeLocked ? (
                          <button
                            onClick={() => handleMarkOverdueIncomplete(task.id)}
                            className="px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer font-mono uppercase tracking-wider border border-amber-600/30"
                          >
                            ❌ Incomplete
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setPostponeTaskId(task.id);
                              // set default custom postpone time to tomorrow
                              const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                              tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
                              setCustomPostponeDate(tomorrow.toISOString().slice(0, 16));
                            }}
                            className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer font-mono uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.1)] border border-amber-500/30"
                          >
                            ⏳ Postpone
                          </button>
                        )}
                        <button
                          onClick={() => handleMarkOverdueComplete(task.id)}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer font-mono uppercase tracking-wider ${
                            isCriticalSnoozeLocked 
                              ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                              : "bg-emerald-600 hover:bg-emerald-500 text-white"
                          }`}
                        >
                          ✓ Complete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Creation & Edit Modal Drawer */}
      <AnimatePresence>
        {isFormOpen && (
          <TaskForm 
            task={editingTask}
            onSubmit={handleTaskSubmit}
            onClose={() => {
              setIsFormOpen(false);
              setEditingTask(null);
              setDefaultFormDate(undefined);
            }}
            defaultDate={defaultFormDate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
