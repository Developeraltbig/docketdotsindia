// routes/chatbot.js
// Main chatbot routes for DocketDots AI Assistant

import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import auth from "../middleware/auth.js";
import ChatSession from "../models/ChatSession.js";
import {
  classifyIntent,
  extractEntities,
  getNavigationLinks,
  generateSuggestions,
  NAVIGATION_ROUTES,
} from "../utils/chatbotHelpers.js";
import {
  getSystemContext,
  getDockets,
  getDocketByNumber,
  getTasks,
  getPendingTasks,
  getDeadlines,
  getUpcomingDeadlines,
  getOverdueDeadlines,
  getPatents,
  getPatentById,
  getApplications,
  getPriorArtSearches,
  globalSearch,
} from "../utils/chatbotDatabase.js";

dotenv.config({ quiet: true });
const router = express.Router();

// ============================================
// INITIALIZE GEMINI AI
// ============================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  },
});

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are DocketDots AI Assistant - an intelligent, helpful, and professional assistant for a patent management and intellectual property (IP) software system.

## Your Core Capabilities:
1. **Data Queries**: Answer questions about dockets, tasks, deadlines, patents, applications, and prior art searches
2. **Navigation Assistance**: Guide users to the right pages and features
3. **Workflow Optimization**: Suggest best practices and efficient workflows
4. **Statistics & Insights**: Provide summaries and analytics of system data
5. **IP Knowledge**: Answer general questions about patent processes and IP management

## Your Personality:
- Professional yet friendly and approachable
- Concise but thorough in explanations
- Proactive in offering relevant suggestions
- Patient and helpful with all users

## Response Guidelines:
1. If data context is provided, reference it specifically with actual numbers and details
2. Always suggest 1-2 relevant navigation links when appropriate
3. Use bullet points for lists, but keep responses conversational
4. If uncertain, ask clarifying questions politely
5. For action requests (create, update), provide the relevant navigation link
6. Mention urgent items (overdue deadlines, pending tasks) when relevant

## Available Navigation Routes:
- /dashboard - Main dashboard with overview statistics
- /docket - View all dockets | /docket - Create new docket
- /task - View all tasks | /task - Create new task
- /deadline - View deadlines | /deadline - Add deadline
- /new-draft- Patent drafts | /new-draft - Generate patent with AI
- /pas- Prior art searches | /pas - Start new search
- /application - Patent applications | /application - New application
- /create - User management (admin only)
- /settings - System settings


## Formatting:
- Use **bold** for emphasis on important items
- Use bullet points (•) for lists
- Format navigation links as: [Link Text](/route)
- Keep responses focused and actionable

Remember: You're here to make IP management easier and more efficient for the user!`;

// ============================================
// MAIN CHAT ENDPOINT
// ============================================

router.post("/message", auth, async (req, res) => {
  try {
    const user = req.user;
    const { message, sessionId, includeContext = true } = req.body;

    // Validate input
    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    console.log(
      `[Chatbot] User ${user._id} sent: "${message.substring(0, 50)}..."`
    );

    // Get or create chat session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({
        _id: sessionId,
        user: user._id,
      });
    }

    if (!session) {
      session = new ChatSession({
        user: user._id,
        messages: [],
        context: {},
      });
    }

    // Classify intent and extract entities
    const intent = classifyIntent(message);
    const entities = extractEntities(message);

    console.log(`[Chatbot] Intent: ${intent.intent}, Entities:`, entities);

    // Get system context based on intent
    let dataContext = "";
    let queryResults = null;

    if (includeContext) {
      const contextData = await getSystemContext(user._id, message, intent);
      dataContext = contextData.contextString;
      queryResults = contextData.queryResults;
    }

    // Build conversation history (last 10 messages for context)
    const conversationHistory = session.messages.slice(-10).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Construct the full prompt
    const userPrompt = `${
      dataContext
        ? `\n--- CURRENT SYSTEM DATA ---\n${dataContext}\n--- END SYSTEM DATA ---\n\n`
        : ""
    }User's Question: ${message}

Please provide a helpful, specific response based on the data context above (if provided). Include relevant navigation links and suggestions.`;

    // Start chat with history
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [
            {
              text: "You are the DocketDots AI Assistant. Please follow the system instructions.",
            },
          ],
        },
        {
          role: "model",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        ...conversationHistory,
      ],
    });

    // Generate response
    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const aiResponse = response.text();

    // Get navigation suggestions
    const navigationLinks = getNavigationLinks(message, queryResults);

    // Generate contextual suggestions
    const suggestions = generateSuggestions(message, queryResults, intent);

    // Save messages to session
    session.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
      metadata: {
        intent: intent.intent,
        entities,
      },
    });

    session.messages.push({
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
      metadata: {
        navigationLinks,
        queryResults: queryResults ? Object.keys(queryResults) : [],
        intent: intent.intent,
      },
    });

    session.lastActivity = new Date();
    session.context.lastQueryType = intent.entity;
    session.context.lastEntities = entities;

    await session.save();

    // Return response
    res.json({
      success: true,
      sessionId: session._id,
      response: aiResponse,
      navigationLinks: navigationLinks.map((link) => ({
        label: link.label,
        route: link.route,
        description: link.description,
      })),
      suggestions,
      intent: intent.intent,
      dataFound: queryResults ? Object.keys(queryResults).length > 0 : false,
    });
  } catch (error) {
    console.error("[Chatbot] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process your request. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ============================================
// QUICK QUERY ENDPOINT (No session, faster)
// ============================================

router.post("/quick", auth, async (req, res) => {
  try {
    const user = req.user;
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Classify intent
    const intent = classifyIntent(message);
    const entities = extractEntities(message);

    // Get minimal context
    const contextData = await getSystemContext(user._id, message, intent);

    // Generate quick response
    const prompt = `${SYSTEM_PROMPT}

Current Data:
${contextData.contextString}

User asks: ${message}

Provide a brief, helpful response with relevant data and one navigation suggestion.`;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // Get navigation links
    const navigationLinks = getNavigationLinks(
      message,
      contextData.queryResults
    );

    res.json({
      success: true,
      response: aiResponse,
      navigationLinks: navigationLinks.slice(0, 2),
      intent: intent.intent,
    });
  } catch (error) {
    console.error("[Chatbot Quick] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process your request",
    });
  }
});

// ============================================
// GET CHAT SESSIONS
// ============================================

router.get("/sessions", auth, async (req, res) => {
  try {
    const sessions = await ChatSession.getRecentByUser(req.user._id, 20);

    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("[Chatbot] Error fetching sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat sessions",
    });
  }
});

// ============================================
// GET SPECIFIC SESSION
// ============================================

router.get("/sessions/:sessionId", auth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.sessionId,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("[Chatbot] Error fetching session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch session",
    });
  }
});

// ============================================
// DELETE SESSION
// ============================================

router.delete("/sessions/:sessionId", auth, async (req, res) => {
  try {
    const result = await ChatSession.findOneAndDelete({
      _id: req.params.sessionId,
      user: req.user._id,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("[Chatbot] Error deleting session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete session",
    });
  }
});

// ============================================
// CLEAR ALL SESSIONS
// ============================================

router.delete("/sessions", auth, async (req, res) => {
  try {
    await ChatSession.deleteMany({ user: req.user._id });

    res.json({
      success: true,
      message: "All sessions cleared",
    });
  } catch (error) {
    console.error("[Chatbot] Error clearing sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear sessions",
    });
  }
});

// ============================================
// GET SUGGESTIONS (Autocomplete/Quick Actions)
// ============================================

router.get("/suggestions", auth, async (req, res) => {
  try {
    const { query } = req.query;

    // Default suggestions
    let suggestions = [
      { text: "Show my pending tasks", type: "query", icon: "tasks" },
      {
        text: "What deadlines are coming up?",
        type: "query",
        icon: "calendar",
      },
      { text: "Show all dockets", type: "query", icon: "folder" },
      {
        text: "Generate a new patent draft",
        type: "action",
        route: "/patents/new",
        icon: "document",
      },
      {
        text: "Start prior art search",
        type: "action",
        route: "/prior-art/new",
        icon: "search",
      },
      { text: "Show dashboard overview", type: "query", icon: "dashboard" },
    ];

    // If query provided, filter/match suggestions
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();

      // Add dynamic suggestions based on query
      if (lowerQuery.includes("docket")) {
        suggestions = [
          { text: "Show all dockets", type: "query" },
          {
            text: "Create a new docket",
            type: "action",
            route: "/docket",
          },
          { text: "Search docket by number", type: "query" },
          { text: "Show dockets by country", type: "query" },
        ];
      } else if (lowerQuery.includes("task")) {
        suggestions = [
          { text: "Show pending tasks", type: "query" },
          { text: "Show completed tasks", type: "query" },
          { text: "Create a new task", type: "action", route: "/tasks/new" },
          { text: "Show tasks assigned to me", type: "query" },
        ];
      } else if (lowerQuery.includes("deadline")) {
        suggestions = [
          { text: "Show upcoming deadlines", type: "query" },
          { text: "Show overdue deadlines", type: "query" },
          {
            text: "Add a new deadline",
            type: "action",
            route: "/deadline",
          },
          { text: "Show deadlines this week", type: "query" },
        ];
      } else if (lowerQuery.includes("patent")) {
        suggestions = [
          { text: "Show my patent drafts", type: "query" },
          {
            text: "Generate new patent draft",
            type: "action",
            route: "/drafting",
          },
          { text: "Search prior art", type: "action", route: "/prior-art/new" },
        ];
      }
    }

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 6),
    });
  } catch (error) {
    console.error("[Chatbot] Error getting suggestions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get suggestions",
    });
  }
});

// ============================================
// GLOBAL SEARCH ENDPOINT
// ============================================

router.get("/search", auth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const results = await globalSearch(q, req.user._id);

    const totalResults =
      results.dockets.length +
      results.tasks.length +
      results.patents.length +
      results.applications.length +
      results.deadlines.length;

    res.json({
      success: true,
      query: q,
      totalResults,
      results,
    });
  } catch (error) {
    console.error("[Chatbot] Search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

// ============================================
// GET NAVIGATION ROUTES
// ============================================

router.get("/navigation", auth, async (req, res) => {
  try {
    const routes = Object.entries(NAVIGATION_ROUTES).map(([key, config]) => ({
      key,
      ...config,
    }));

    res.json({
      success: true,
      routes,
    });
  } catch (error) {
    console.error("[Chatbot] Error getting navigation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get navigation routes",
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

router.get("/health", async (req, res) => {
  try {
    // Test Gemini connection
    const testResult = await model.generateContent("Say 'OK' in one word.");
    const isGeminiHealthy = testResult.response
      .text()
      .toLowerCase()
      .includes("ok");

    res.json({
      success: true,
      status: "healthy",
      gemini: isGeminiHealthy ? "connected" : "error",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: "unhealthy",
      error: error.message,
    });
  }
});

export default router;
