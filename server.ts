import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured on the server. Please add it via the Settings/Secrets panel.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// AI prioriziation and scheduling endpoint
app.post("/api/ai/prioritize-and-plan", async (req, res) => {
  try {
    const { tasks, userContext } = req.body;
    
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Tasks list is required and must be an array." });
    }

    const client = getAIClient();
    
    const prompt = `
You are an expert AI productivity planner. Analyze the following user tasks (with deadlines, status, subtasks, estimated duration, and priorities) and create an optimized, actionable daily plan that ensures deadlines are met, avoids cognitive overload, and respects user's natural work cadence.

User Specific Context/Focus: ${userContext || "None provided"}

Tasks:
${JSON.stringify(tasks, null, 2)}

Provide your response in STRICTLTY valid JSON format matching this TypeScript interface exactly, without any extra text or markdown code-block tags (other than pure raw JSON text):
{
  "taskRecommendations": [
    {
      "id": "string (the task id)",
      "dynamicPriority": "low" | "medium" | "high",
      "planningScore": "number (0-100 indicating how urgently this should be done today based on proximity of deadline, overall priority, and state)",
      "rationale": "string (1-2 sentences explaining why this task is prioritized/scheduled this way)",
      "suggestedAction": "string (e.g. 'Complete this morning', 'Delegate', 'Break down further', 'Reschedule after deadline')",
      "suggestedEstimatedMinutes": "number (optional recommended duration in minutes)"
    }
  ],
  "advisory": "string (A beautiful, encouraging 2-3 sentence overview of the daily plan, highlighting looming risks and suggesting a gentle focusing strategy)",
  "focusBlocks": [
    {
      "timeBlock": "string (e.g., 'Block 1: Deep Work - 90m')",
      "taskIds": ["array of task ids for this block"],
      "focusDescription": "string (what to focus on in this block)"
    }
  ]
}
`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const content = response.text;
    if (!content) {
      throw new Error("No response content from AI model.");
    }

    const parsed = JSON.parse(content.trim());
    return res.json(parsed);
  } catch (error: any) {
    console.error("AI Prioritize error:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to process task planning with AI.",
      details: "Ensure your GEMINI_API_KEY is set correctly in the Secrets panel."
    });
  }
});

// AI subtasks breakdown endpoint
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: "Task title is required." });
    }

    const client = getAIClient();
    
    const prompt = `
You are an expert project planner. Break down the following task into 3-6 clear, actionable, sequentially ordered subtasks. Also estimate the total completion time in minutes.

Task Title: ${title}
Task Description: ${description || "No description provided."}

Provide your response in STRICTLY valid JSON format matching this TypeScript interface exactly:
{
  "subtasks": [
    {
      "title": "string (concise actionable step, maximum 60 characters)",
      "completed": false
    }
  ],
  "estimatedMinutes": "number (realistic total estimate in minutes)"
}
`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const content = response.text;
    if (!content) {
      throw new Error("No response content from AI model.");
    }

    const parsed = JSON.parse(content.trim());
    return res.json(parsed);
  } catch (error: any) {
    console.error("AI Subtasks error:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to generate subtasks with AI.",
      details: "Ensure your GEMINI_API_KEY is set correctly in the Secrets panel." 
    });
  }
});

// AI Productivity and Task Completion Analysis endpoint
app.post("/api/ai/analyze-productivity", async (req, res) => {
  const { tasks } = req.body;
  
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: "Tasks list is required and must be an array." });
  }

  // Define smart rule-based fallback generator
  const getFallbackReport = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed");
    const incomplete = tasks.filter(t => t.status !== "completed");
    const completionRate = total > 0 ? (completed.length / total) * 100 : 0;
    
    const now = new Date().getTime();
    const overdue = tasks.filter(t => t.status !== "completed" && t.deadline && new Date(t.deadline).getTime() < now);
    const highPriority = tasks.filter(t => t.priority === "high");
    const completedHigh = highPriority.filter(t => t.status === "completed");
    const highPrioRate = highPriority.length > 0 ? (completedHigh.length / highPriority.length) * 100 : 0;

    // Analyze most used category
    const categoryCounts: Record<string, number> = {};
    tasks.forEach(t => { if (t.category) categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1; });
    const topCategory = Object.entries(categoryCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || "General";

    let assessment = `You are actively organizing your workflow with ${total} tracked tasks. Your current completion rate is ${completionRate.toFixed(0)}%, showing a steady foundation of focus and execution.`;
    if (completionRate > 75) {
      assessment = `Outstanding execution! Your task completion rate is exceptional at ${completionRate.toFixed(0)}%. You demonstrate excellent follow-through and a highly organized work cadence.`;
    } else if (completionRate > 40) {
      assessment = `You have built a solid rhythm with ${completionRate.toFixed(0)}% of your tasks successfully crossed off. Your focus is consistent, though there is room to refine deadlines and balance projects.`;
    }

    const strengths = [
      `Maintained a clear structured catalog across projects with a focus on "${topCategory}".`,
      highPriority.length > 0 
        ? `Tackled high priority initiatives, achieving a ${highPrioRate.toFixed(0)}% focus rate on high-stakes items.`
        : "Maintained a balanced prioritization model with clean manual execution lists."
    ];

    const recommendations = [
      completionRate < 50 
        ? "Break large tasks down into smaller, bite-sized items with Pomodoro sessions to lower friction."
        : "Incorporate regular weekly reviews to archive older, low-priority tasks and stay streamlined.",
      overdue.length > 0 
        ? "Reschedule overdue tasks immediately to remove visual clutter and relieve cognitive load."
        : "Keep leveraging the active calendar planner view to map out deadlines before they bunch up.",
      "Schedule active break cycles during longer study intervals using your newly-configured custom timer."
    ];

    let focusWarning = "Your workspace is highly balanced. Keep up the clean structure!";
    if (overdue.length > 0) {
      focusWarning = `You currently have ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} needing attention. Dedicate your next focus session to clearing these bottlenecks gently.`;
    }

    return {
      assessment,
      strengths,
      recommendations,
      focusWarning
    };
  };

  try {
    const client = getAIClient();
    
    const prompt = `
You are an expert elite performance coach and productivity analyst. Analyze the following list of tasks (including their status, deadlines, priorities, categories, createdAt, updatedAt, and subtasks) and generate a highly personalized, encouraging, and deeply insightful productivity coaching report.

Tasks:
${JSON.stringify(tasks, null, 2)}

Provide your analysis in STRICTLY valid JSON format matching this TypeScript interface exactly, without any extra text, HTML, or markdown code-block tags (return only the raw JSON text):
{
  "assessment": "string (A beautiful, professional, and encouraging 2-3 sentence overview of the user's productivity patterns, strengths, and work cadence)",
  "strengths": [
    "string (key strength 1, e.g. 'Highly consistent with High Priority items')",
    "string (key strength 2)"
  ],
  "recommendations": [
    "string (actionable, specific productivity advice 1 based on their data)",
    "string (actionable advice 2)",
    "string (actionable advice 3)"
  ],
  "focusWarning": "string (A supportive 1-2 sentence warning pointing out potential bottlenecks, like overdue tasks or abandoned categories, and how to address them gently)"
}
`;

    // Try highly stable gemini-2.5-flash as the primary API model
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const content = response.text;
    if (!content) {
      throw new Error("No response content from AI model.");
    }

    const parsed = JSON.parse(content.trim());
    return res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini API error (utilizing local analytical fallback):", error.message || error);
    // Graceful fallback prevents the workspace view from crashing when 503 high demand hits
    const fallbackReport = getFallbackReport();
    return res.json(fallbackReport);
  }
});

// Vite Middleware & Production Serving Configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Real-time Task Manager running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err);
});
