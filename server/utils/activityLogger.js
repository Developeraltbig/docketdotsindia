import Activity from "../models/Activity.js";

/**
 * Log an activity to the database.
 * Call this from any controller after a successful DB operation.
 *
 * @param {Object} options
 * @param {string}   options.type         - Activity type (see Activity model enum)
 * @param {string}   options.description  - Human-readable description
 * @param {string}   [options.userId]     - ID of the acting user
 * @param {string}   [options.userName]   - Name/email of acting user (snapshot)
 * @param {string}   [options.entityId]   - ID of affected record
 * @param {string}   [options.entityType] - Type of affected record
 * @param {Object}   [options.metadata]   - Any extra data
 */
const logActivity = async ({
  type,
  description,
  userId = null,
  userName = "System",
  entityId = null,
  entityType = null,
  metadata = {},
}) => {
  try {
    await Activity.create({
      type,
      description,
      user_id: userId,
      done_by: userName,
      entity_id: entityId,
      entity_type: entityType,
      metadata,
    });
  } catch (err) {
    // Never let activity logging break the main flow
    console.error("[ActivityLogger] Failed to log activity:", err.message);
  }
};

export { logActivity };
