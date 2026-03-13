// utils/chatbotDatabase.js
// Database query functions for the DocketDots AI Chatbot

import mongoose from "mongoose";
import {
  getDateRange,
  formatDocketForContext,
  formatTaskForContext,
  formatDeadlineForContext,
  formatPatentForContext,
  formatApplicationForContext,
  formatPriorArtForContext,
  formatStatisticsForContext,
} from "./chatbotHelpers.js";

// ============================================
// DYNAMIC MODEL IMPORTS
// ============================================

// Import models dynamically to avoid circular dependencies
let models = {};

async function getModels() {
  if (Object.keys(models).length === 0) {
    try {
      models.Docket = (await import("../models/Docket.js")).default;
      models.Task = (await import("../models/Task.js")).default;
      models.Deadline = (await import("../models/Deadline.js")).default;
      models.Patent = (await import("../models/Patent.js")).default;
      models.Application = (await import("../models/Application.js")).default;
      models.PriorArtSearch = (
        await import("../models/Priorartsearch.js")
      ).default;
      models.User = (await import("../models/User.js")).default;
    } catch (error) {
      console.error("Error loading models:", error);
    }
  }
  return models;
}

// ============================================
// DOCKET QUERIES
// ============================================

export async function getDockets(userId, options = {}) {
  const { Docket } = await getModels();
  const { limit = 10, status, country, dateRange } = options;

  const query = {};

  if (status) {
    query.application_status = new RegExp(status, "i");
  }

  if (country) {
    query.$or = [
      { country: new RegExp(country, "i") },
      { filling_country: new RegExp(country, "i") },
    ];
  }

  if (dateRange) {
    const { start, end } = getDateRange(dateRange);
    query.createdAt = { $gte: start, $lte: end };
  }

  const dockets = await Docket.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    data: dockets,
    count: dockets.length,
    formatted: dockets.map(formatDocketForContext).join("\n"),
  };
}

export async function getDocketByNumber(docketNo) {
  const { Docket } = await getModels();
  const docket = await Docket.findOne({
    docket_no: new RegExp(docketNo, "i"),
  }).lean();

  if (!docket) return null;

  return {
    data: docket,
    formatted: formatDocketForContext(docket),
  };
}

export async function getDocketStats() {
  const { Docket } = await getModels();

  const [total, byStatus, byCountry, recentCount] = await Promise.all([
    Docket.countDocuments(),
    Docket.aggregate([
      { $group: { _id: "$application_status", count: { $sum: 1 } } },
    ]),
    Docket.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Docket.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item._id || "Unknown"] = item.count;
      return acc;
    }, {}),
    byCountry: byCountry.reduce((acc, item) => {
      acc[item._id || "Unknown"] = item.count;
      return acc;
    }, {}),
    recentCount,
  };
}

// ============================================
// TASK QUERIES
// ============================================

export async function getTasks(userId, options = {}) {
  const { Task } = await getModels();
  const { limit = 10, status, workType, assignedTo } = options;

  const query = {};

  if (status) {
    query.task_status = new RegExp(status, "i");
  }

  if (workType) {
    query.work_type = new RegExp(workType, "i");
  }

  if (assignedTo) {
    query.$or = [
      { prepared_by: assignedTo },
      { review_by: assignedTo },
      { final_review_by: assignedTo },
    ];
  }

  const tasks = await Task.find(query)
    .populate("prepared_by", "name email")
    .populate("review_by", "name email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    data: tasks,
    count: tasks.length,
    formatted: tasks.map(formatTaskForContext).join("\n"),
  };
}

export async function getPendingTasks(userId) {
  const { Task } = await getModels();

  const tasks = await Task.find({
    task_status: { $in: ["Pending", "In Progress"] },
  })
    .populate("prepared_by", "name")
    .sort({ official_deadline: 1 })
    .limit(15)
    .lean();

  return {
    data: tasks,
    count: tasks.length,
    formatted: tasks.map(formatTaskForContext).join("\n"),
  };
}

export async function getTaskStats() {
  const { Task } = await getModels();

  const [total, byStatus, byWorkType] = await Promise.all([
    Task.countDocuments(),
    Task.aggregate([{ $group: { _id: "$task_status", count: { $sum: 1 } } }]),
    Task.aggregate([
      { $group: { _id: "$work_type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const statusMap = byStatus.reduce((acc, item) => {
    acc[item._id || "Unknown"] = item.count;
    return acc;
  }, {});

  return {
    total,
    pending: statusMap["Pending"] || 0,
    inProgress: statusMap["In Progress"] || 0,
    completed: statusMap["Completed"] || 0,
    onHold: statusMap["On Hold"] || 0,
    byWorkType: byWorkType.reduce((acc, item) => {
      acc[item._id || "Unknown"] = item.count;
      return acc;
    }, {}),
  };
}

// ============================================
// DEADLINE QUERIES
// ============================================

export async function getDeadlines(userId, options = {}) {
  const { Deadline } = await getModels();
  const { limit = 10, status, dateRange, worktype } = options;

  const query = {};

  if (status) {
    query.status = status.toUpperCase();
  }

  if (worktype) {
    query.worktype = new RegExp(worktype, "i");
  }

  if (dateRange) {
    const { start, end } = getDateRange(dateRange);
    query.deadline_date = { $gte: start, $lte: end };
  }

  const deadlines = await Deadline.find(query)
    .populate("docket_id", "docket_no title")
    .sort({ deadline_date: 1 })
    .limit(limit)
    .lean();

  return {
    data: deadlines,
    count: deadlines.length,
    formatted: deadlines.map(formatDeadlineForContext).join("\n"),
  };
}

export async function getUpcomingDeadlines(days = 7) {
  const { Deadline } = await getModels();
  const { start, end } = getDateRange({ days });

  const deadlines = await Deadline.find({
    deadline_date: { $gte: start, $lte: end },
    status: { $in: ["ON", "PENDING"] },
  })
    .populate("docket_id", "docket_no title")
    .sort({ deadline_date: 1 })
    .lean();

  return {
    data: deadlines,
    count: deadlines.length,
    formatted: deadlines.map(formatDeadlineForContext).join("\n"),
  };
}

export async function getOverdueDeadlines() {
  const { Deadline } = await getModels();

  const deadlines = await Deadline.find({
    deadline_date: { $lt: new Date() },
    status: { $in: ["ON", "PENDING"] },
  })
    .populate("docket_id", "docket_no title")
    .sort({ deadline_date: 1 })
    .lean();

  return {
    data: deadlines,
    count: deadlines.length,
    formatted: deadlines.map(formatDeadlineForContext).join("\n"),
  };
}

export async function getDeadlineStats() {
  const { Deadline } = await getModels();
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, overdue, next7, next30, byStatus, byWorktype] =
    await Promise.all([
      Deadline.countDocuments(),
      Deadline.countDocuments({
        deadline_date: { $lt: now },
        status: { $in: ["ON", "PENDING"] },
      }),
      Deadline.countDocuments({
        deadline_date: { $gte: now, $lte: next7Days },
        status: { $in: ["ON", "PENDING"] },
      }),
      Deadline.countDocuments({
        deadline_date: { $gte: now, $lte: next30Days },
        status: { $in: ["ON", "PENDING"] },
      }),
      Deadline.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Deadline.aggregate([
        { $group: { _id: "$worktype", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

  return {
    total,
    overdue,
    upcoming: next7,
    thisMonth: next30,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byWorktype: byWorktype.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
  };
}

// ============================================
// PATENT QUERIES
// ============================================

export async function getPatents(userId, options = {}) {
  const { Patent } = await getModels();
  const { limit = 10 } = options;

  const query = {};
  if (userId) {
    query.user = userId;
  }

  const patents = await Patent.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    data: patents,
    count: patents.length,
    formatted: patents.map(formatPatentForContext).join("\n"),
  };
}

export async function getPatentById(patentId) {
  const { Patent } = await getModels();

  const patent = await Patent.findOne({
    $or: [
      { publicId: patentId },
      { _id: mongoose.Types.ObjectId.isValid(patentId) ? patentId : null },
    ],
  }).lean();

  if (!patent) return null;

  return {
    data: patent,
    formatted: formatPatentForContext(patent),
  };
}

export async function getPatentStats(userId) {
  const { Patent } = await getModels();

  const query = userId ? { user: userId } : {};

  const [total, recent] = await Promise.all([
    Patent.countDocuments(query),
    Patent.countDocuments({
      ...query,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    total,
    recentCount: recent,
  };
}

// ============================================
// APPLICATION QUERIES
// ============================================

export async function getApplications(userId, options = {}) {
  const { Application } = await getModels();
  const { limit = 10, type, status } = options;

  const query = {};
  if (userId) {
    query.created_by = userId;
  }
  if (type) {
    query.application_type = new RegExp(type, "i");
  }
  if (status) {
    query.status = new RegExp(status, "i");
  }

  const applications = await Application.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    data: applications,
    count: applications.length,
    formatted: applications.map(formatApplicationForContext).join("\n"),
  };
}

export async function getApplicationStats() {
  const { Application } = await getModels();

  const [total, byType, byJurisdiction] = await Promise.all([
    Application.countDocuments(),
    Application.aggregate([
      { $group: { _id: "$application_type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Application.aggregate([
      { $group: { _id: "$jurisdiction", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return {
    total,
    byType: byType.reduce((acc, item) => {
      acc[item._id || "Unknown"] = item.count;
      return acc;
    }, {}),
    byJurisdiction: byJurisdiction.reduce((acc, item) => {
      acc[item._id || "Unknown"] = item.count;
      return acc;
    }, {}),
  };
}

// ============================================
// PRIOR ART SEARCH QUERIES
// ============================================

export async function getPriorArtSearches(userId, options = {}) {
  const { PriorArtSearch } = await getModels();
  const { limit = 10, status } = options;

  const query = {};
  if (userId) {
    query.user = userId;
  }
  if (status) {
    query.status = status;
  }

  const searches = await PriorArtSearch.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-patentResults -searchQueries")
    .lean();

  return {
    data: searches,
    count: searches.length,
    formatted: searches.map(formatPriorArtForContext).join("\n"),
  };
}

export async function getPriorArtStats(userId) {
  const { PriorArtSearch } = await getModels();

  const query = userId ? { user: userId } : {};

  const [total, completed, processing, failed] = await Promise.all([
    PriorArtSearch.countDocuments(query),
    PriorArtSearch.countDocuments({ ...query, status: "completed" }),
    PriorArtSearch.countDocuments({ ...query, status: "processing" }),
    PriorArtSearch.countDocuments({ ...query, status: "failed" }),
  ]);

  return {
    total,
    completed,
    processing,
    failed,
  };
}

// ============================================
// USER QUERIES
// ============================================

export async function getUsers(options = {}) {
  const { User } = await getModels();
  const { limit = 20, status, department } = options;

  const query = {};
  if (status) {
    query.status = status;
  }
  if (department) {
    query.department = new RegExp(department, "i");
  }

  const users = await User.find(query)
    .select("-password")
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  return {
    data: users,
    count: users.length,
  };
}

export async function getUserStats() {
  const { User } = await getModels();

  const [total, active, byDepartment] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    User.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    byDepartment: byDepartment.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
  };
}

// ============================================
// COMPREHENSIVE SYSTEM CONTEXT
// ============================================

export async function getSystemContext(userId, message, intent) {
  const queryResults = {};
  let contextString = "";

  try {
    // Always get basic statistics
    const [
      docketStats,
      taskStats,
      deadlineStats,
      patentStats,
      appStats,
      priorArtStats,
    ] = await Promise.all([
      getDocketStats(),
      getTaskStats(),
      getDeadlineStats(),
      getPatentStats(userId),
      getApplicationStats(),
      getPriorArtStats(userId),
    ]);

    queryResults.statistics = {
      dockets: docketStats,
      tasks: taskStats,
      deadlines: deadlineStats,
      patents: patentStats,
      applications: appStats,
      priorArt: priorArtStats,
    };

    contextString += formatStatisticsForContext(queryResults.statistics);

    // Based on intent, fetch specific data
    if (intent) {
      switch (intent.entity) {
        case "docket":
          const dockets = await getDockets(userId, { limit: 5 });
          queryResults.dockets = dockets;
          if (dockets.data.length > 0) {
            contextString += `\n\nRecent Dockets:\n${dockets.formatted}`;
          }
          break;

        case "task":
          const tasks = await getPendingTasks(userId);
          queryResults.tasks = tasks;
          if (tasks.data.length > 0) {
            contextString += `\n\nPending Tasks:\n${tasks.formatted}`;
          }
          break;

        case "deadline":
          const [upcoming, overdue] = await Promise.all([
            getUpcomingDeadlines(7),
            getOverdueDeadlines(),
          ]);
          queryResults.upcomingDeadlines = upcoming;
          queryResults.overdueDeadlines = overdue;
          if (overdue.data.length > 0) {
            contextString += `\n\n⚠️ OVERDUE Deadlines (${overdue.count}):\n${overdue.formatted}`;
          }
          if (upcoming.data.length > 0) {
            contextString += `\n\nUpcoming Deadlines (Next 7 Days):\n${upcoming.formatted}`;
          }
          break;

        case "patent":
          const patents = await getPatents(userId, { limit: 5 });
          queryResults.patents = patents;
          if (patents.data.length > 0) {
            contextString += `\n\nRecent Patent Drafts:\n${patents.formatted}`;
          }
          break;

        case "prior_art":
          const searches = await getPriorArtSearches(userId, { limit: 5 });
          queryResults.priorArt = searches;
          if (searches.data.length > 0) {
            contextString += `\n\nRecent Prior Art Searches:\n${searches.formatted}`;
          }
          break;

        case "application":
          const applications = await getApplications(userId, { limit: 5 });
          queryResults.applications = applications;
          if (applications.data.length > 0) {
            contextString += `\n\nRecent Applications:\n${applications.formatted}`;
          }
          break;
      }
    }

    // Check for urgent items
    const urgentDeadlines = await getUpcomingDeadlines(3);
    if (urgentDeadlines.data.length > 0) {
      contextString += `\n\n🚨 URGENT: ${urgentDeadlines.count} deadline(s) due in the next 3 days!`;
    }
  } catch (error) {
    console.error("Error getting system context:", error);
    contextString += "\n\n[Note: Some data could not be retrieved]";
  }

  return {
    contextString,
    queryResults,
  };
}

// ============================================
// SEARCH ACROSS ALL ENTITIES
// ============================================

export async function globalSearch(searchTerm, userId) {
  const results = {
    dockets: [],
    tasks: [],
    patents: [],
    applications: [],
    deadlines: [],
  };

  try {
    const { Docket, Task, Patent, Application, Deadline } = await getModels();
    const searchRegex = new RegExp(searchTerm, "i");

    const [dockets, tasks, patents, applications, deadlines] =
      await Promise.all([
        Docket.find({
          $or: [
            { docket_no: searchRegex },
            { title: searchRegex },
            { firm_name: searchRegex },
            { spoc_name: searchRegex },
          ],
        })
          .limit(5)
          .lean(),

        Task.find({
          $or: [
            { docket_no: searchRegex },
            { title: searchRegex },
            { client_name: searchRegex },
          ],
        })
          .limit(5)
          .lean(),

        Patent.find({
          $or: [
            { publicId: searchRegex },
            { "sections.title.content": searchRegex },
          ],
        })
          .limit(5)
          .lean(),

        Application.find({
          $or: [{ DOC_NO: searchRegex }, { title: searchRegex }],
        })
          .limit(5)
          .lean(),

        Deadline.find({
          $or: [{ application_no: searchRegex }, { remarks: searchRegex }],
        })
          .limit(5)
          .lean(),
      ]);

    results.dockets = dockets;
    results.tasks = tasks;
    results.patents = patents;
    results.applications = applications;
    results.deadlines = deadlines;
  } catch (error) {
    console.error("Global search error:", error);
  }

  return results;
}
