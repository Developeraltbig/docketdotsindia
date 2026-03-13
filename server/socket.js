import { Server } from "socket.io";
import Message from "./models/Message.js";

const onlineUsers = new Map();

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      // Split the env string so it becomes an array of strings
      origin: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(",")
        : ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    /* ────────────────────────────────────────────────────────────────────────
       USER ONLINE
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("join", (userId) => {
      if (!userId) return;
      onlineUsers.set(userId.toString(), socket.id);
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });

    /* ────────────────────────────────────────────────────────────────────────
       JOIN ROOMS
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("join-conversation", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
    });

    socket.on("join-conversations", (conversationIds = []) => {
      if (!Array.isArray(conversationIds)) return;
      conversationIds.forEach((id) => {
        if (id) socket.join(id);
      });
    });

    /* ────────────────────────────────────────────────────────────────────────
       CHAT: SEND MESSAGE
       Emits "new-message" → handled by Header & ChatPage
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("send-message", ({ conversationId, message }) => {
      if (!conversationId || !message) return;

      // 1. Broadcast to everyone in the conversation room
      io.to(conversationId).emit("new-message", { message });

      // 2. Notify members who may not have the room joined yet
      const members = message.conversation?.members || [];
      members.forEach((member) => {
        const memberId = typeof member === "string" ? member : member._id;
        if (memberId?.toString() === message.sender?._id?.toString()) return;
        const recipientSocketId = onlineUsers.get(memberId.toString());
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("new-message", { message });
        }
      });
    });

    /* ────────────────────────────────────────────────────────────────────────
       TASK NOTIFICATIONS
       Emit "task-updated" from your task route after create/update.

       Usage in taskRoutes.js (after saving the task):
         req.io.emit("task-updated", {
           task,
           action: "created" | "updated" | "deleted",
           updatedBy: req.user,
           targetUserIds: [task.prepared_by, task.review_by, task.final_review_by]
             .filter(Boolean)
             .map(id => id.toString()),
         });

       The socket here:
         - Sends only to the affected staff members (targetUserIds)
         - Falls back to a room broadcast when targetUserIds is not provided
    ──────────────────────────────────────────────────────────────────────── */
    socket.on(
      "task-updated",
      ({ task, action, updatedBy, targetUserIds = [] }) => {
        if (!task) return;

        const payload = { task, action, updatedBy };

        if (targetUserIds && targetUserIds.length > 0) {
          // Send only to relevant staff
          targetUserIds.forEach((userId) => {
            // Don't notify the person who made the change
            if (updatedBy?._id?.toString() === userId?.toString()) return;
            const sockId = onlineUsers.get(userId.toString());
            if (sockId) {
              io.to(sockId).emit("task-updated", payload);
            }
          });
        } else {
          // Fallback: broadcast to everyone (restrict further if needed)
          socket.broadcast.emit("task-updated", payload);
        }
      },
    );

    /* ────────────────────────────────────────────────────────────────────────
       DEADLINE NOTIFICATIONS
       Emit "deadline-reminder" from your deadline cron job or route.

       Usage in deadlineReminderCron.js (after identifying reminder targets):
         io.emit("deadline-reminder", {
           deadline,
           targetUserIds: ["userId1", "userId2"],   // optional; omit = all
         });

       Or import the io instance and call:
         emitDeadlineReminder(io, deadline, targetUserIds)

       The socket here simply relays the event to the correct sockets.
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("deadline-reminder", ({ deadline, targetUserIds = [] }) => {
      if (!deadline) return;

      const payload = { deadline };

      if (targetUserIds && targetUserIds.length > 0) {
        targetUserIds.forEach((userId) => {
          const sockId = onlineUsers.get(userId.toString());
          if (sockId) {
            io.to(sockId).emit("deadline-reminder", payload);
          }
        });
      } else {
        // Broadcast to all connected users (staff & admins)
        socket.broadcast.emit("deadline-reminder", payload);
      }
    });

    /* ────────────────────────────────────────────────────────────────────────
       TYPING
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("typing", ({ conversationId, user }) => {
      if (conversationId && user) {
        socket.to(conversationId).emit("typing", { conversationId, user });
      }
    });

    socket.on("stop-typing", ({ conversationId, userId }) => {
      if (conversationId && userId) {
        socket
          .to(conversationId)
          .emit("stop-typing", { conversationId, userId });
      }
    });

    /* ────────────────────────────────────────────────────────────────────────
       DELETE MESSAGE
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("delete-message", ({ messageId, conversationId }) => {
      if (messageId && conversationId) {
        io.to(conversationId).emit("message-deleted", { messageId });
      }
    });

    /* ────────────────────────────────────────────────────────────────────────
       READ RECEIPTS
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("read-messages", async ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      await Message.updateMany(
        { conversation: conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } },
      );
      socket
        .to(conversationId)
        .emit("messages-read", { conversationId, userId });
    });

    /* ────────────────────────────────────────────────────────────────────────
       NEW CONVERSATION (notify recipient)
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("new-conversation", ({ conversation, targetUserId }) => {
      if (!conversation || !targetUserId) return;
      const recipientSocketId = onlineUsers.get(targetUserId.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("new-conversation", conversation);
      }
    });

    /* ────────────────────────────────────────────────────────────────────────
       DISCONNECT
    ──────────────────────────────────────────────────────────────────────── */
    socket.on("disconnect", () => {
      for (let [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};

/* ════════════════════════════════════════════════════════════════════════════
   HELPER EXPORTS
   Import `io` in your routes/cron to push server-initiated notifications.

   Example in taskRoutes.js:
     import { emitTaskUpdated } from "../socket.js";
     // after task.save():
     emitTaskUpdated(req.io, task, "created", req.user, [
       task.prepared_by?.toString(),
       task.review_by?.toString(),
       task.final_review_by?.toString(),
     ].filter(Boolean));

   Example in deadlineReminderCron.js:
     import { emitDeadlineReminder } from "../socket.js";
     emitDeadlineReminder(io, deadline);
════════════════════════════════════════════════════════════════════════════ */

/**
 * Emit a task-updated notification to specific users.
 * @param {import("socket.io").Server} io
 * @param {object} task  - Mongoose task document (plain object ok)
 * @param {string} action - "created" | "updated" | "deleted"
 * @param {object} updatedBy - req.user
 * @param {string[]} targetUserIds - user IDs to notify
 */
export const emitTaskUpdated = (
  io,
  task,
  action,
  updatedBy,
  targetUserIds = [],
) => {
  const payload = { task, action, updatedBy };
  // We re-use the onlineUsers map defined at module scope
  targetUserIds.forEach((userId) => {
    if (!userId) return;
    if (updatedBy?._id?.toString() === userId.toString()) return; // skip self
    // Note: onlineUsers is module-scoped so this works after initSocket() is called
    const sockId = _onlineUsers().get(userId.toString());
    if (sockId) {
      io.to(sockId).emit("task-updated", payload);
    }
  });
};

/**
 * Emit a deadline-reminder notification to specific users (or broadcast).
 * @param {import("socket.io").Server} io
 * @param {object} deadline - Mongoose deadline document
 * @param {string[]} [targetUserIds] - if omitted, broadcasts to all
 */
export const emitDeadlineReminder = (io, deadline, targetUserIds = []) => {
  const payload = { deadline };
  if (targetUserIds.length > 0) {
    targetUserIds.forEach((userId) => {
      if (!userId) return;
      const sockId = _onlineUsers().get(userId.toString());
      if (sockId) {
        io.to(sockId).emit("deadline-reminder", payload);
      }
    });
  } else {
    io.emit("deadline-reminder", payload); // broadcast to all staff
  }
};

// Internal accessor so exported helpers can read the module-scoped map
const _onlineUsers = () => onlineUsers;
