# Prodak: Smart Task Manager & Productivity Behavioral Suite

A high-performance, real-time task manager and behavioral analytics companion designed to conquer task-snooze fatigue, analyze execution bottlenecks, and guide users toward friction-free focus.

---

## 1. Problem Statement Selected
In modern digital workspaces, standard todo lists are passive repositories of unexecuted intent. Users suffer from **"Snooze Fatigue" and "Backlog Stagnation"**—frequently postponing tasks, letting missed deadlines accumulate, and suffering from a complete lack of self-awareness regarding their procrastination patterns. 

Most productivity tools fail to address:
* **The Snooze Loop**: The behavioral friction of repeatedly pushing a deadline without evaluating *why* the task is stalled.
* **Accuracy Blindness**: Estimating tasks poorly (e.g., expecting a 20-minute task to take 2 hours) and never looking back at actual execution metrics.
* **Lack of Coaching**: Raw data dashboards exist, but users lack actionable, behavioral feedback tailored to their unique productivity bottlenecks.

---

## 2. Solution Overview
**Prodak** is a full-stack, behavior-aware task management application that transforms passive todo lists into an active, analytical, and coach-led system. 

By calculating a real-time, transparent **Procrastination Score (0-100)**, compiling custom-tailored **Snooze Bottlenecks**, implementing a **Critical Snooze Lock** with custom postponed scheduling options, and employing **Google Gemini AI Coaching**, Prodak actively guides the user to address why tasks are stalled. It provides clean, high-contrast, beautiful visualizations that let users understand when they are most productive, where their time is being misallocated, and how accurate their estimations are.

---

## 3. Key Features
* **Behavioral Diagnostics & Procrastination Score**: Displays an interactive score computed from overdue tasks, backlog stagnation age, alarm snoozing counts, and historical lateness percentages. Users can click the scoring card to view the exact math and formula weights.
* **Interactive Performance Dashboard**: Features a smooth-animated multi-tab analytical cockpit:
  * **Trends Tab**: Visualize 7-day task completion velocity (area chart) and stacked on-time vs. delayed task distribution.
  * **Efficiency Tab**: Compare estimated vs. actual minutes to improve planning accuracy, alongside a 24-hour focus density distribution heatmap.
  * **Allocation Tab**: Inspect weekday workload curves, completion rates by custom category, and priority volume distributions.
  * **GitHub-Style Contribution Calendar**: View focus density over the past 28 days to sustain daily consistency.
* **Snooze Bottlenecks Tracker**: Highlights the "most-snoozed" tasks explicitly, pointing directly to severe execution friction points.
* **Overdue Alerts & Snooze Engine**: Triggers auditory and visual alarm notifications when a task passes its deadline.
* **Critical Snooze Lock & Postponement Dialog**: Prevents endless snoozing. When a task reaches critical snooze thresholds, the user must either complete it, mark it incomplete, or engage the postponement scheduler (using preset offsets of +15m, +30m, +1h, +1d, or custom datetime picker) to reset the deadline with conscious friction.
* **Server-Side Gemini AI Coaching**: Analyses current tasks, completions, and procrastination metrics via a secure backend API proxy to generate tailored, highly specific suggestions.
* **Durable Cloud Sync**: Seamlessly syncs data with Firestore for reliable cross-device backup, degrading gracefully to standard local persistence for guests.

---

## 4. Technologies Used
* **Frontend**: React 18 with TypeScript, Vite (bundling), Tailwind CSS (styling), Recharts (data visualizations), and Motion/AnimatePresence (fluid UI transitions).
* **Backend**: Node.js, Express (custom full-stack server proxy for API security and static hosting).
* **Compiler/Dev Tooling**: `tsx` (for native dev execution), `esbuild` (bundling production server to robust `.cjs`).

---

## 5. Google Technologies Utilized
* **Google AI Studio (Gemini 2.5 / Flash)**: Leverages the official modern `@google/genai` TypeScript SDK on the server side to proxy AI prompt evaluations, ensuring API key security.
* **Google Cloud Run**: Container-native orchestration hosting the Node server behind high-performance Cloud ingress.
* **Firebase Firestore**: Secure, durable, real-time NoSQL cloud database providing lightning-fast task synchronization.
