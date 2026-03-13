import mongoose from "mongoose";

const priorArtSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inventionText: {
      type: String,
      required: true,
    },
    keyFeatures: {
      type: String,
    },
    comparisons: [
      {
        patentId: String,
        rank: Number,
        foundSummary: String,
        matrix: String,
        excerpts: String,
        metrics: {
          considerable: Number,
          partial: Number,
          none: Number,
        },
        details: {
          title: String,
          abstract: String,
          filing_date: String,
          assignee: String,
          assignees: [String],
          inventor: String,
          inventors: [
            {
              name: String,
            },
          ],
        },
      },
    ],
    patentResults: [
      {
        patent_id: String,
        title: String,
        snippet: String,
        assignee: String,
        filing_date: String,
        patent_link: String,
        is_scholar: Boolean,
        scholar_link: String,
        fromCitationPool: Boolean,
        citationLevel: Number,
      },
    ],
    searchQueries: [
      {
        // FIX: Define 'type' explicitly
        type: { type: String },
        query: { type: String },
        step: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
    jobId: {
      type: String,
      index: true,
    },
    error: {
      type: String,
    },
    processingTime: {
      type: Number, // in milliseconds
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
priorArtSearchSchema.index({ user: 1, createdAt: -1 });
priorArtSearchSchema.index({ user: 1, status: 1 });

// Virtual for summary
priorArtSearchSchema.virtual("summary").get(function () {
  return {
    id: this._id,
    query: this.inventionText?.substring(0, 150),
    resultsCount: this.comparisons?.length || 0,
    status: this.status,
    createdAt: this.createdAt,
  };
});

// Static method to get recent searches for a user
priorArtSearchSchema.statics.getRecentByUser = function (userId, limit = 20) {
  return this.find({ user: userId, status: "completed" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-patentResults -searchQueries") // Exclude large fields for list view
    .lean();
};

// Static method to get full search by ID for a user
priorArtSearchSchema.statics.getByIdForUser = function (searchId, userId) {
  return this.findOne({ _id: searchId, user: userId }).lean();
};

const PriorArtSearch = mongoose.model("PriorArtSearch", priorArtSearchSchema);

export default PriorArtSearch;
