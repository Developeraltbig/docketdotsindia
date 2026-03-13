import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    navigationLinks: [
      {
        label: String,
        route: String,
        description: String,
      },
    ],
    queryResults: [String],
    intent: String,
    entities: mongoose.Schema.Types.Mixed,
  },
});

const chatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
    },
    messages: [messageSchema],
    context: {
      lastQueryType: String,
      lastEntities: mongoose.Schema.Types.Mixed,
      preferences: mongoose.Schema.Types.Mixed,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      totalMessages: {
        type: Number,
        default: 0,
      },
      totalQueries: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
chatSessionSchema.index({ user: 1, lastActivity: -1 });
chatSessionSchema.index({ user: 1, isActive: 1 });

// Auto-generate title from first message
chatSessionSchema.pre("save", async function () {
  if (this.messages.length > 0 && this.title === "New Chat") {
    const firstUserMessage = this.messages.find((m) => m.role === "user");
    if (firstUserMessage) {
      this.title =
        firstUserMessage.content.substring(0, 50) +
        (firstUserMessage.content.length > 50 ? "..." : "");
    }
  }
  this.metadata.totalMessages = this.messages.length;
});

// Static method to get recent sessions
chatSessionSchema.statics.getRecentByUser = function (userId, limit = 20) {
  return this.find({ user: userId, isActive: true })
    .sort({ lastActivity: -1 })
    .limit(limit)
    .select("title lastActivity metadata createdAt")
    .lean();
};

// Static method to cleanup old sessions
chatSessionSchema.statics.cleanupOldSessions = function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  return this.updateMany(
    { lastActivity: { $lt: cutoffDate }, isActive: true },
    { $set: { isActive: false } },
  );
};

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

export default ChatSession;
