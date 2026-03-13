// utils/chatbotHelpers.js
// Comprehensive helper functions for the DocketDots AI Chatbot

// ============================================
// NAVIGATION ROUTES CONFIGURATION
// ============================================

export const NAVIGATION_ROUTES = {
  // Dashboard
  dashboard: {
    route: "/dashboard",
    label: "Dashboard",
    description: "Main dashboard with overview and statistics",
    keywords: ["home", "overview", "main", "dashboard", "stats", "summary"],
  },

  // Dockets
  dockets: {
    route: "/docket",
    label: "All Dockets",
    description: "View and manage all dockets",
    keywords: ["docket", "dockets", "list", "all dockets", "view dockets"],
  },
  docketNew: {
    route: "/docket",
    label: "Create Docket",
    description: "Create a new docket entry",
    keywords: ["new docket", "create docket", "add docket"],
  },
  docketView: {
    route: "/docket",
    label: "View Docket",
    description: "View specific docket details",
    keywords: ["view docket", "docket details", "open docket"],
  },

  // Tasks
  tasks: {
    route: "/task",
    label: "All Tasks",
    description: "View and manage all tasks",
    keywords: [
      "task",
      "tasks",
      "list tasks",
      "all tasks",
      "work",
      "assignments",
    ],
  },
  taskNew: {
    route: "/task",
    label: "Create Task",
    description: "Create a new task",
    keywords: ["new task", "create task", "add task", "assign task"],
  },

  // Deadlines
  deadlines: {
    route: "/deadline",
    label: "All Deadlines",
    description: "View and manage all deadlines",
    keywords: ["deadline", "deadlines", "due date", "due dates", "reminders"],
  },
  deadlineNew: {
    route: "/deadline",
    label: "Add Deadline",
    description: "Add a new deadline",
    keywords: [
      "new deadline",
      "create deadline",
      "add deadline",
      "set reminder",
    ],
  },

  // Patents
  patents: {
    route: "/new-draft",
    label: "Patent Drafts",
    description: "View all patent drafts",
    keywords: ["patent", "patents", "draft", "drafts", "invention"],
  },
  patentNew: {
    route: "/new-draft",
    label: "Create Patent Draft",
    description: "Generate a new patent draft with AI",
    keywords: [
      "new patent",
      "create patent",
      "generate patent",
      "draft patent",
      "ai patent",
    ],
  },

  // Prior Art
  priorArt: {
    route: "/pas",
    label: "Prior Art Searches",
    description: "View prior art search results",
    keywords: [
      "prior art",
      "search",
      "prior art search",
      "patent search",
      "existing patents",
    ],
  },
  priorArtNew: {
    route: "/pas",
    label: "New Prior Art Search",
    description: "Start a new prior art search",
    keywords: [
      "new search",
      "search prior art",
      "find patents",
      "patent research",
    ],
  },

  // Applications
  applications: {
    route: "/application",
    label: "Applications",
    description: "View all patent applications",
    keywords: ["application", "applications", "filing", "filings", "submitted"],
  },
  applicationNew: {
    route: "/application",
    label: "New Application",
    description: "Create a new patent application",
    keywords: [
      "new application",
      "create application",
      "file application",
      "submit application",
    ],
  },

  // Users & Settings
  users: {
    route: "/create",
    label: "User Management",
    description: "Manage system users",
    keywords: ["users", "user", "team", "members", "staff", "employees"],
  },
  settings: {
    route: "/settings",
    label: "Settings",
    description: "System settings and preferences",
    keywords: ["settings", "preferences", "configuration", "config", "options"],
  },
  // reports: {
  //   route: "/reports",
  //   label: "Reports",
  //   description: "View reports and analytics",
  //   keywords: ["reports", "analytics", "statistics", "metrics", "data"],
  // },
};

// ============================================
// INTENT PATTERNS FOR QUERY CLASSIFICATION
// ============================================

export const INTENT_PATTERNS = {
  // Docket intents
  DOCKET_LIST: {
    patterns: [
      /\b(all|list|show|get|view|my|recent)\b.*\b(docket|dockets)\b/i,
      /\b(docket|dockets)\b.*\b(list|all|show)\b/i,
    ],
    action: "list_dockets",
    entity: "docket",
  },
  DOCKET_SEARCH: {
    patterns: [
      /\b(find|search|lookup|where|which|get)\b.*\b(docket)\b.*\b(number|no|#)?\s*([A-Z0-9-]+)/i,
      /\bdocket\s*(number|no|#)?\s*([A-Z0-9-]+)/i,
    ],
    action: "search_docket",
    entity: "docket",
  },
  DOCKET_CREATE: {
    patterns: [/\b(create|add|new|make|start)\b.*\b(docket)\b/i],
    action: "create_docket",
    entity: "docket",
  },
  DOCKET_COUNT: {
    patterns: [/\b(how many|count|total|number of)\b.*\b(docket|dockets)\b/i],
    action: "count_dockets",
    entity: "docket",
  },
  DOCKET_STATUS: {
    patterns: [/\b(status|state|progress)\b.*\b(docket|dockets)\b/i],
    action: "docket_status",
    entity: "docket",
  },

  // Task intents
  TASK_LIST: {
    patterns: [
      /\b(all|list|show|get|view|my|pending|assigned)\b.*\b(task|tasks)\b/i,
      /\b(task|tasks)\b.*\b(list|all|show)\b/i,
    ],
    action: "list_tasks",
    entity: "task",
  },
  TASK_PENDING: {
    patterns: [/\b(pending|incomplete|open|unfinished)\b.*\b(task|tasks)\b/i],
    action: "pending_tasks",
    entity: "task",
  },
  TASK_CREATE: {
    patterns: [/\b(create|add|new|make|assign)\b.*\b(task)\b/i],
    action: "create_task",
    entity: "task",
  },
  TASK_COUNT: {
    patterns: [/\b(how many|count|total|number of)\b.*\b(task|tasks)\b/i],
    action: "count_tasks",
    entity: "task",
  },
  TASK_BY_STATUS: {
    patterns: [/\b(task|tasks)\b.*\b(pending|progress|completed|hold)\b/i],
    action: "tasks_by_status",
    entity: "task",
  },

  // Deadline intents
  DEADLINE_LIST: {
    patterns: [
      /\b(all|list|show|get|view|upcoming|next)\b.*\b(deadline|deadlines)\b/i,
      /\b(deadline|deadlines)\b.*\b(list|all|show)\b/i,
    ],
    action: "list_deadlines",
    entity: "deadline",
  },
  DEADLINE_UPCOMING: {
    patterns: [
      /\b(upcoming|next|soon|due|approaching)\b.*\b(deadline|deadlines)\b/i,
      /\bwhat.*\b(due|deadline)\b.*\b(today|tomorrow|week|month)\b/i,
    ],
    action: "upcoming_deadlines",
    entity: "deadline",
  },
  DEADLINE_OVERDUE: {
    patterns: [/\b(overdue|missed|past|expired)\b.*\b(deadline|deadlines)\b/i],
    action: "overdue_deadlines",
    entity: "deadline",
  },
  DEADLINE_CREATE: {
    patterns: [/\b(create|add|new|set)\b.*\b(deadline|reminder)\b/i],
    action: "create_deadline",
    entity: "deadline",
  },

  // Patent intents
  PATENT_LIST: {
    patterns: [
      /\b(all|list|show|get|view|my)\b.*\b(patent|patents|draft|drafts)\b/i,
      /\b(patent|patents)\b.*\b(list|all|show)\b/i,
    ],
    action: "list_patents",
    entity: "patent",
  },
  PATENT_CREATE: {
    patterns: [
      /\b(create|generate|new|make|draft|write)\b.*\b(patent|draft)\b/i,
      /\b(patent)\b.*\b(create|generate|new|draft)\b/i,
    ],
    action: "create_patent",
    entity: "patent",
  },
  PATENT_SEARCH: {
    patterns: [/\b(find|search|lookup)\b.*\b(patent|draft)\b/i],
    action: "search_patent",
    entity: "patent",
  },

  // Prior Art intents
  PRIOR_ART_LIST: {
    patterns: [
      /\b(all|list|show|get|view|my)\b.*\b(prior art|searches)\b/i,
      /\bprior art\b.*\b(list|all|show|search|results)\b/i,
    ],
    action: "list_prior_art",
    entity: "prior_art",
  },
  PRIOR_ART_NEW: {
    patterns: [
      /\b(new|start|run|conduct)\b.*\b(prior art|search)\b/i,
      /\bsearch.*\b(prior art|existing patents)\b/i,
    ],
    action: "new_prior_art",
    entity: "prior_art",
  },

  // Application intents
  APPLICATION_LIST: {
    patterns: [
      /\b(all|list|show|get|view|my)\b.*\b(application|applications|filing|filings)\b/i,
    ],
    action: "list_applications",
    entity: "application",
  },
  APPLICATION_CREATE: {
    patterns: [/\b(create|new|file|submit)\b.*\b(application)\b/i],
    action: "create_application",
    entity: "application",
  },

  // Statistics & Reports
  STATISTICS: {
    patterns: [
      /\b(statistics|stats|metrics|numbers|overview|summary|report)\b/i,
      /\bhow (many|much)\b/i,
      /\b(total|count)\b.*\b(dockets|tasks|patents|deadlines|applications)\b/i,
    ],
    action: "get_statistics",
    entity: "statistics",
  },

  // Navigation & Help
  NAVIGATION: {
    patterns: [
      /\b(where|how|navigate|go to|find|open|access)\b.*\b(page|section|screen)\b/i,
      /\b(take me to|show me|open)\b/i,
    ],
    action: "navigate",
    entity: "navigation",
  },
  HELP: {
    patterns: [
      /\b(help|what can you do|capabilities|features|how to use)\b/i,
      /\bwhat.*\b(can|could)\b.*\b(you|this|chatbot)\b/i,
    ],
    action: "help",
    entity: "help",
  },

  // User related
  USER_LIST: {
    patterns: [/\b(all|list|show)\b.*\b(user|users|team|members)\b/i],
    action: "list_users",
    entity: "user",
  },

  // General queries
  GREETING: {
    patterns: [
      /^(hi|hello|hey|good morning|good afternoon|good evening)[\s!?.]*$/i,
    ],
    action: "greeting",
    entity: "greeting",
  },
};

// ============================================
// CLASSIFY USER INTENT
// ============================================

export function classifyIntent(message) {
  const normalizedMessage = message.toLowerCase().trim();

  for (const [intentName, intentConfig] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of intentConfig.patterns) {
      if (pattern.test(normalizedMessage)) {
        return {
          intent: intentName,
          action: intentConfig.action,
          entity: intentConfig.entity,
          confidence: 0.85,
        };
      }
    }
  }

  return {
    intent: "GENERAL",
    action: "general_query",
    entity: null,
    confidence: 0.5,
  };
}

// ============================================
// EXTRACT ENTITIES FROM MESSAGE
// ============================================

export function extractEntities(message) {
  const entities = {
    docketNumber: null,
    applicationNumber: null,
    status: null,
    dateRange: null,
    country: null,
    workType: null,
    userName: null,
  };

  // Extract docket number (e.g., DOC-2024-001, DOCK123)
  const docketMatch = message.match(
    /\b(DOC|DOCK|DKT)?[-_]?(\d{4})?[-_]?(\d{3,6})\b/i
  );
  if (docketMatch) {
    entities.docketNumber = docketMatch[0].toUpperCase();
  }

  // Extract application number
  const appMatch = message.match(/\b(APP|APPLICATION)?[-_]?(\d{4,})\b/i);
  if (appMatch) {
    entities.applicationNumber = appMatch[0].toUpperCase();
  }

  // Extract status
  const statusPatterns = {
    pending: /\bpending\b/i,
    "in progress": /\b(in progress|ongoing|active)\b/i,
    completed: /\b(completed|done|finished)\b/i,
    "on hold": /\b(on hold|paused|suspended)\b/i,
  };
  for (const [status, pattern] of Object.entries(statusPatterns)) {
    if (pattern.test(message)) {
      entities.status = status;
      break;
    }
  }

  // Extract date references
  if (/\btoday\b/i.test(message)) {
    entities.dateRange = "today";
  } else if (/\btomorrow\b/i.test(message)) {
    entities.dateRange = "tomorrow";
  } else if (/\bthis week\b/i.test(message)) {
    entities.dateRange = "this_week";
  } else if (/\bthis month\b/i.test(message)) {
    entities.dateRange = "this_month";
  } else if (/\bnext (\d+) days\b/i.test(message)) {
    const match = message.match(/\bnext (\d+) days\b/i);
    entities.dateRange = { days: parseInt(match[1]) };
  }

  // Extract country
  const countryMatch = message.match(
    /\b(India|US|USA|United States|UK|United Kingdom|China|Japan|Germany|France|Australia|Canada|Brazil|Korea|Singapore)\b/i
  );
  if (countryMatch) {
    entities.country = countryMatch[0];
  }

  // Extract work type
  const workTypes = [
    "Provisional",
    "Ordinary",
    "Conventional",
    "PCT-NP",
    "Annuity Fee",
  ];
  for (const workType of workTypes) {
    if (message.toLowerCase().includes(workType.toLowerCase())) {
      entities.workType = workType;
      break;
    }
  }

  return entities;
}

// ============================================
// GET NAVIGATION LINKS BASED ON QUERY
// ============================================

export function getNavigationLinks(message, queryResults = null) {
  const links = [];
  const normalizedMessage = message.toLowerCase();

  // Check each navigation route for keyword matches
  for (const [key, config] of Object.entries(NAVIGATION_ROUTES)) {
    const matchScore = config.keywords.reduce((score, keyword) => {
      if (normalizedMessage.includes(keyword.toLowerCase())) {
        return score + 1;
      }
      return score;
    }, 0);

    if (matchScore > 0) {
      links.push({
        ...config,
        key,
        relevance: matchScore,
      });
    }
  }

  // Sort by relevance and take top 3
  links.sort((a, b) => b.relevance - a.relevance);
  return links.slice(0, 3);
}

// ============================================
// GENERATE CONTEXTUAL SUGGESTIONS
// ============================================

export function generateSuggestions(message, queryResults, intent) {
  const suggestions = [];

  switch (intent?.entity) {
    case "docket":
      suggestions.push(
        { text: "Show all my dockets", type: "query" },
        { text: "Create a new docket", type: "action", route: "/docket" },
        { text: "Show dockets by status", type: "query" }
      );
      break;

    case "task":
      suggestions.push(
        { text: "Show pending tasks", type: "query" },
        { text: "Create a new task", type: "action", route: "/task" },
        { text: "Show tasks assigned to me", type: "query" }
      );
      break;

    case "deadline":
      suggestions.push(
        { text: "Show upcoming deadlines", type: "query" },
        { text: "Show deadlines this week", type: "query" },
        { text: "Add a new deadline", type: "action", route: "/deadline" }
      );
      break;

    case "patent":
      suggestions.push(
        { text: "Show my patent drafts", type: "query" },
        {
          text: "Generate a new patent draft",
          type: "action",
          route: "/new-draft",
        },
        { text: "Search prior art", type: "action", route: "/new-draft" }
      );
      break;

    case "prior_art":
      suggestions.push(
        { text: "View my search history", type: "query" },
        {
          text: "Start a new prior art search",
          type: "action",
          route: "/pas",
        }
      );
      break;

    case "application":
      suggestions.push(
        { text: "Show all applications", type: "query" },
        {
          text: "Create new application",
          type: "action",
          route: "/application",
        }
      );
      break;

    // case "statistics":
    //   suggestions.push(
    //     { text: "Show task statistics", type: "query" },
    //     { text: "Show deadline overview", type: "query" },
    //     { text: "View reports", type: "action", route: "/reports" }
    //   );
    //   break;

    default:
      suggestions.push(
        { text: "Show dashboard overview", type: "query" },
        { text: "What can you help me with?", type: "query" },
        { text: "Show upcoming deadlines", type: "query" }
      );
  }

  return suggestions.slice(0, 4);
}

// ============================================
// DATE HELPER FUNCTIONS
// ============================================

export function getDateRange(rangeType) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  switch (rangeType) {
    case "today":
      return { start: startOfDay, end: endOfDay };

    case "tomorrow":
      const tomorrow = new Date(startOfDay);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
      return { start: tomorrow, end: tomorrowEnd };

    case "this_week":
      const weekEnd = new Date(startOfDay);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return { start: startOfDay, end: weekEnd };

    case "this_month":
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfDay, end: monthEnd };

    case "next_7_days":
      const next7 = new Date(startOfDay);
      next7.setDate(next7.getDate() + 7);
      return { start: startOfDay, end: next7 };

    case "next_30_days":
      const next30 = new Date(startOfDay);
      next30.setDate(next30.getDate() + 30);
      return { start: startOfDay, end: next30 };

    default:
      if (typeof rangeType === "object" && rangeType.days) {
        const customEnd = new Date(startOfDay);
        customEnd.setDate(customEnd.getDate() + rangeType.days);
        return { start: startOfDay, end: customEnd };
      }
      return { start: startOfDay, end: endOfDay };
  }
}

export function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// FORMAT DATA FOR AI CONTEXT
// ============================================

export function formatDocketForContext(docket) {
  return `
Docket #${docket.docket_no}:
- Title: ${docket.title || "N/A"}
- Client: ${docket.firm_name || docket.spoc_name || "N/A"}
- Country: ${docket.country || docket.filling_country || "N/A"}
- Status: ${docket.application_status || docket.status || "N/A"}
- Application Type: ${docket.application_type || "N/A"}
- Filing Date: ${formatDate(docket.filling_date)}
- Due Date: ${formatDate(docket.due_date)}
- Total Fee: ${docket.currency || "USD"} ${docket.fee || 0}
`;
}

export function formatTaskForContext(task) {
  return `
Task for Docket #${task.docket_no}:
- Title: ${task.title || "N/A"}
- Status: ${task.task_status || "Pending"}
- Work Type: ${task.work_type || "N/A"}
- Client: ${task.client_name || "N/A"}
- Country: ${task.country || "N/A"}
- Internal Deadline: ${formatDate(task.internal_deadline)}
- Official Deadline: ${formatDate(task.official_deadline)}
`;
}

export function formatDeadlineForContext(deadline) {
  return `
Deadline for Application #${deadline.application_no}:
- Work Type: ${deadline.worktype}
- Deadline Date: ${formatDate(deadline.deadline_date)}
- Status: ${deadline.status}
- Remarks: ${deadline.remarks || "N/A"}
`;
}

export function formatPatentForContext(patent) {
  return `
Patent Draft (ID: ${patent.publicId}):
- Title: ${patent.sections?.title?.content?.substring(0, 100) || "Untitled"}
- Status: ${patent.status || "Draft"}
- Created: ${formatDate(patent.createdAt)}
- Sections: ${Object.keys(patent.sections || {}).join(", ")}
`;
}

export function formatApplicationForContext(application) {
  return `
Application (Doc #${application.DOC_NO}):
- Title: ${application.title || "N/A"}
- Type: ${application.application_type || "N/A"}
- Jurisdiction: ${application.jurisdiction || "N/A"}
- Status: ${application.status || "N/A"}
- Filing Date: ${formatDate(application.inter_filing_date)}
- Total Pages: ${application.total_pages || "N/A"}
`;
}

export function formatPriorArtForContext(search) {
  return `
Prior Art Search:
- Query: ${search.inventionText?.substring(0, 100)}...
- Status: ${search.status}
- Results Found: ${search.comparisons?.length || 0}
- Created: ${formatDate(search.createdAt)}
`;
}

export function formatStatisticsForContext(stats) {
  return `
Current System Statistics:
- Total Dockets: ${stats.dockets?.total || 0}
- Total Tasks: ${stats.tasks?.total || 0} (Pending: ${
    stats.tasks?.pending || 0
  }, Completed: ${stats.tasks?.completed || 0})
- Upcoming Deadlines: ${stats.deadlines?.upcoming || 0} (Overdue: ${
    stats.deadlines?.overdue || 0
  })
- Patent Drafts: ${stats.patents?.total || 0}
- Applications: ${stats.applications?.total || 0}
- Prior Art Searches: ${stats.priorArt?.total || 0}
`;
}
