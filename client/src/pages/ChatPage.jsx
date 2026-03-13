import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";
import { toast } from "react-toastify";
import useChatStore from "../store/chatStore";
import Uppy from "@uppy/core";
import AwsS3Multipart from "@uppy/aws-s3-multipart";
import { DashboardModal } from "@uppy/react";
import EmojiPicker from "emoji-picker-react";
import { Smile } from "lucide-react";

import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

const isUserDeleted = (user) => {
  return !user || user.isDeleted || user.deleted || !user.name;
};

const getDisplayName = (user) => {
  if (isUserDeleted(user)) return "Deleted User";
  return user.name || "Unknown User";
};

const getFileIcon = (fileType) => {
  if (fileType?.startsWith("image/")) return "bi-image";
  if (fileType?.includes("pdf")) return "bi-file-pdf";
  if (fileType?.includes("word") || fileType?.includes("document"))
    return "bi-file-word";
  if (fileType?.includes("excel") || fileType?.includes("sheet"))
    return "bi-file-excel";
  if (fileType?.includes("text")) return "bi-file-text";
  return "bi-file-earmark";
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const getImageUrl = async (fileKey) => {
  try {
    const cleanKey = fileKey.startsWith("/") ? fileKey.substring(1) : fileKey;
    const res = await axios.get(
      `/api/chat/download-url?fileKey=${encodeURIComponent(cleanKey)}`,
    );
    return res.data.downloadUrl;
  } catch (error) {
    return null;
  }
};

const FileAttachment = ({ file, isOwnMessage, onDownload, onImageClick }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (file.fileType?.startsWith("image/")) {
      getImageUrl(file.key).then((url) => {
        setImageUrl(url);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [file.key, file.fileType]);

  if (file.fileType?.startsWith("image/")) {
    if (loading || !imageUrl) {
      return (
        <div
          className="d-flex flex-column align-items-center justify-content-center bg-light text-muted border"
          style={{ width: 200, height: 150, borderRadius: 8 }}
        >
          <i className="bi bi-image-fill fs-1 text-secondary opacity-50"></i>
          <span style={{ fontSize: "10px" }}>Image Unavailable</span>
        </div>
      );
    }

    return (
      <div
        className="position-relative"
        style={{ cursor: "zoom-in", maxWidth: 250 }}
        onClick={() =>
          onImageClick({
            url: imageUrl,
            filename: file.filename,
            key: file.key,
          })
        }
      >
        <img
          src={imageUrl}
          alt={file.filename}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentNode.innerHTML =
              '<div class="p-4 bg-light text-center text-muted small border rounded">Image Deleted</div>';
          }}
          style={{
            width: "100%",
            maxHeight: 200,
            objectFit: "cover",
            borderRadius: 8,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`file-attachment d-flex align-items-center gap-2 p-2 rounded border mb-1 ${
        isOwnMessage ? "bg-primary-subtle border-primary" : "bg-light"
      }`}
      style={{ cursor: "pointer", minWidth: "180px" }}
      onClick={() => onDownload(file.key, file.filename)}
    >
      <i className={`bi ${getFileIcon(file.fileType)} fs-4 text-primary`} />
      <div className="flex-grow-1 overflow-hidden">
        <div
          className="text-truncate fw-medium"
          style={{ fontSize: "0.85rem" }}
        >
          {file.filename}
        </div>
        <small className="text-muted">{formatFileSize(file.fileSize)}</small>
      </div>
      <i className="bi bi-download text-primary ms-2" />
    </div>
  );
};

export default function ChatPage() {
  const socketRef = useRef(null);
  const activeChatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const { socket, user } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const menuRef = useRef(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [selectedModalImage, setSelectedModalImage] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupUserList, setGroupUserList] = useState([]); // New state for group selection
  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "users"
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const messageRefs = useRef({});
  // --- EMOJI STATE ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const { fetchTotalUnreadCount } = useChatStore();
  const [uploading, setUploading] = useState(false);
  const [isUppyModalOpen, setIsUppyModalOpen] = useState(false);

  // Initialize Uppy
  const uppy = useMemo(() => {
    const uppyInstance = new Uppy({
      id: "chat-uploader",
      restrictions: {
        maxNumberOfFiles: 100,
        maxTotalFileSize: 5 * 1024 * 1024 * 1024,
      },
      autoProceed: false,
    });

    uppyInstance.use(AwsS3Multipart, {
      shouldUseMultipart: (file) => file.size > 5 * 1024 * 1024,
      limit: 4,

      async createMultipartUpload(file) {
        const res = await axios.post("/api/chat/s3/multipart/start", {
          filename: file.name,
          contentType: file.type,
        });
        file.meta.key = res.data.key;
        return { uploadId: res.data.uploadId, key: res.data.key };
      },

      async signPart(file, { uploadId, key, partNumber }) {
        const res = await axios.post("/api/chat/s3/multipart/sign-part", {
          uploadId,
          key,
          partNumber,
        });
        return { url: res.data.url };
      },

      async completeMultipartUpload(file, { uploadId, key, parts }) {
        const res = await axios.post("/api/chat/s3/multipart/complete", {
          uploadId,
          key,
          parts,
        });
        return { location: res.data.location };
      },

      async abortMultipartUpload(file, { uploadId, key }) {
        await axios.post("/api/chat/s3/multipart/abort", { uploadId, key });
      },

      async getUploadParameters(file) {
        const res = await axios.post("/api/chat/s3/presigned-url", {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        });
        file.meta.key = res.data.key;
        return {
          method: "PUT",
          url: res.data.uploadUrl,
          fields: {},
          headers: { "Content-Type": file.type || "application/octet-stream" },
        };
      },
    });

    return uppyInstance;
  }, []);

  // Cleanup Uppy on unmount
  useEffect(() => {
    return () => uppy.close();
  }, [uppy]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        // Handle click outside if needed
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Uppy upload complete
  useEffect(() => {
    const handleComplete = async (result) => {
      if (result.successful.length > 0 && activeChat) {
        const filesForDb = result.successful.map((f) => ({
          key: f.meta.key,
          filename: f.name,
          fileType: f.type,
          fileSize: f.size,
          etag: f.response?.body?.etag || "",
        }));

        await sendChatWithFiles(filesForDb);
        setIsUppyModalOpen(false);
        uppy.cancelAll();
      }
    };

    uppy.on("complete", handleComplete);
    return () => uppy.off("complete", handleComplete);
  }, [activeChat, uppy]);

  // Close Emoji Picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        !event.target.closest(".emoji-btn")
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onEmojiClick = (emojiObject) => {
    setText((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const openUppyModal = () => {
    if (!activeChat) {
      toast.error("Please select a chat first");
      return;
    }
    setIsUppyModalOpen(true);
  };

  const closeUppyModal = () => {
    setIsUppyModalOpen(false);
    uppy.cancelAll();
  };

  // --- LOAD ALL USERS ---
  const loadAllUsers = async () => {
    setAllUsersLoading(true);
    try {
      const res = await axios.get(`/api/chat/users`);
      setAllUsers(
        res.data.filter(
          (u) =>
            u._id !== user._id &&
            !isUserDeleted(u) &&
            u.role_id?.name?.toLowerCase() !== "client", // Key Change
        ),
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load users");
    } finally {
      setAllUsersLoading(false);
    }
  };

  // Load all users when tab switches to "users"
  useEffect(() => {
    if (activeTab === "users" && allUsers.length === 0) {
      loadAllUsers();
    }
  }, [activeTab]);

  const sendChatWithFiles = async (filesData) => {
    if (!activeChat) return;

    try {
      const res = await axios.post(`/api/chat/message`, {
        conversationId: activeChat._id,
        text: text.trim() || "",
        files: filesData,
      });

      setMessages((prev) => [...prev, res.data]);
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeChat._id ? { ...c, lastMessage: res.data } : c,
        ),
      );

      socketRef.current?.emit("send-message", {
        conversationId: activeChat._id,
        message: res.data,
      });

      setText("");
    } catch (err) {
      toast.error("Message failed to save");
    }
  };

  const loadConversations = async () => {
    try {
      const res = await axios.get(`/api/chat/conversations`);
      setConversations(res.data);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to load conversations",
      );
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const res = await axios.get(`/api/chat/messages/${conversationId}`);
      setMessages(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load messages");
    }
  };

  const handleDownload = async (fileKey, filename) => {
    try {
      const cleanKey = fileKey.startsWith("/") ? fileKey.substring(1) : fileKey;

      // Update this URL to pass download=true and the filename
      const res = await axios.get(
        `/api/chat/download-url?fileKey=${encodeURIComponent(cleanKey)}&download=true&filename=${encodeURIComponent(filename)}`,
      );

      const { downloadUrl } = res.data;

      const link = document.createElement("a");
      link.href = downloadUrl;
      // You no longer technically need link.setAttribute("download", filename)
      // because S3 handles it now, but keeping it won't hurt.
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      if (error.response && error.response.status === 404) {
        toast.error("This file has been deleted!");
      } else {
        toast.error("Failed to download file");
      }
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeChat) return;

    setUploading(true);
    try {
      const res = await axios.post(`/api/chat/message`, {
        conversationId: activeChat._id,
        text: text.trim(),
      });

      setMessages((prev) => [...prev, res.data]);
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeChat._id ? { ...c, lastMessage: res.data } : c,
        ),
      );

      socketRef.current?.emit("send-message", {
        conversationId: activeChat._id,
        message: res.data,
      });

      setText("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  const searchUsers = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) return setSearchResults([]);

    try {
      const res = await axios.get(`/api/chat/search?query=${query}`);
      setSearchResults(
        res.data.filter(
          (u) =>
            u._id !== user._id &&
            !isUserDeleted(u) &&
            u.role_id?.name !== "client", // Check the populated name
        ),
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Search failed");
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(`/api/chat/message/${messageId}`);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      socketRef.current?.emit("delete-message", {
        messageId,
        conversationId: activeChat._id,
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  useEffect(() => {
    if (!socket) return;

    socketRef.current = socket;
    socket.emit("join", user._id);

    socket.on("online-users", setOnlineUsers);

    socket.on("new-message", ({ message }) => {
      if (!message?.conversation) return;
      if (message.sender?._id === user._id) return;

      const convId = message.conversation._id || message.conversation;

      setConversations((prev) => {
        const exists = prev.some((c) => c._id === convId);
        if (!exists) {
          loadConversations();
          return prev;
        }
        return prev
          .map((c) => (c._id === convId ? { ...c, lastMessage: message } : c))
          .sort(
            (a, b) =>
              new Date(b.lastMessage?.createdAt) -
              new Date(a.lastMessage?.createdAt),
          );
      });

      if (activeChatRef.current?._id === convId) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        socketRef.current?.emit("read-messages", {
          conversationId: convId,
          userId: user._id,
        });
      } else {
        setUnreadMap((prev) => ({
          ...prev,
          [convId]: (prev[convId] || 0) + 1,
        }));
      }
    });

    socket.on("messages-read", ({ conversationId, userId }) => {
      fetchTotalUnreadCount();
      if (activeChatRef.current?._id !== conversationId) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.sender?._id === user._id && !m.readBy?.includes(userId)
            ? { ...m, readBy: [...(m.readBy || []), userId] }
            : m,
        ),
      );
    });

    socket.on("typing", ({ conversationId, user: typingUser }) => {
      if (activeChatRef.current?._id === conversationId) {
        setTypingUsers((prev) => ({
          ...prev,
          [typingUser._id]: getDisplayName(typingUser),
        }));
      }
    });

    socket.on("stop-typing", ({ conversationId, userId }) => {
      if (activeChatRef.current?._id === conversationId) {
        setTypingUsers((prev) => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      }
    });

    socket.on("message-deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    return () => {
      socket.off("online-users");
      socket.off("new-message");
      socket.off("typing");
      socket.off("stop-typing");
      socket.off("message-deleted");
      socket.off("messages-read");
    };
  }, [socket, user, fetchTotalUnreadCount]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  const startChatWithUser = async (selectedUser) => {
    if (isUserDeleted(selectedUser)) {
      toast.error("Cannot start chat with deleted user.");
      return;
    }

    try {
      const res = await axios.post(`/api/chat/conversation`, {
        userId: selectedUser._id,
      });

      const conversation = res.data;
      setSearchQuery("");
      setSearchResults([]);

      setConversations((prev) => {
        if (!prev.some((c) => c._id === conversation._id)) {
          const populatedConv = {
            ...conversation,
            members: conversation.members.map((m) =>
              typeof m === "string"
                ? m === selectedUser._id
                  ? selectedUser
                  : user
                : m,
            ),
          };
          return [populatedConv, ...prev];
        }
        return prev;
      });

      openChat(conversation);
      setActiveTab("chats"); // Switch to chats tab after starting chat
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to start chat.");
    }
  };

  const createGroup = async () => {
    if (!groupName || groupMembers.length < 1) return;

    try {
      const res = await axios.post(`/api/chat/group`, {
        name: groupName,
        members: groupMembers,
      });

      setConversations((prev) => [res.data, ...prev]);
      setActiveChat(res.data);
      socketRef.current?.emit("join-conversation", res.data._id);

      setShowGroupModal(false);
      setGroupName("");
      setGroupMembers([]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Group creation failed");
    }
  };

  const loadUsersForGroup = async () => {
    try {
      const res = await axios.get(`/api/chat/users`);
      setGroupUserList(res.data.filter((u) => !isUserDeleted(u)));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load users");
    }
  };

  const openChat = async (chat) => {
    let conversation = { ...chat };

    if (!chat.isGroup && typeof chat.members[0] === "string") {
      const otherUserId = chat.members.find((id) => id !== user._id);
      const otherUser = chat.otherUserDetails ||
        searchResults.find((u) => u._id === otherUserId) || {
          _id: otherUserId,
          name: "User",
          isDeleted: false,
        };
      conversation.members = [user, otherUser];
    }

    localStorage.setItem("activeChatId", conversation._id);
    setActiveChat(conversation);
    activeChatRef.current = conversation;

    setUnreadMap((prev) => ({ ...prev, [conversation._id]: 0 }));
    await loadMessages(conversation._id);

    socketRef.current?.emit("join-conversation", conversation._id);
    socketRef.current?.emit("read-messages", {
      conversationId: conversation._id,
      userId: user._id,
    });

    setTimeout(() => fetchTotalUnreadCount(), 500);
  };

  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const savedChatId = localStorage.getItem("activeChatId");
    if (!savedChatId || activeChat?._id === savedChatId) return;

    const chat = conversations.find((c) => c._id === savedChatId);
    if (chat) openChat(chat);
  }, [user, conversations]);

  const renderTicks = (m) => {
    const senderId = typeof m.sender === "string" ? m.sender : m.sender?._id;
    if (senderId !== user._id) return null;

    const readBy = (m.readBy || []).map((u) =>
      typeof u === "string" ? u : u._id,
    );

    if (!activeChat?.isGroup) {
      return readBy.length > 1 ? (
        <i className="bi bi-check-all text-white"></i>
      ) : (
        <i className="bi bi-check text-muted"></i>
      );
    }

    const readersExceptMe = readBy.filter((id) => id !== user._id);
    const requiredReaders = (activeChat?.members?.length || 1) - 1;

    if (readersExceptMe.length === 0)
      return <i className="bi bi-check text-muted"></i>;
    if (readersExceptMe.length < requiredReaders)
      return <i className="bi bi-check-all text-muted"></i>;
    return <i className="bi bi-check-all text-white"></i>;
  };

  useEffect(() => {
    if (!socketRef.current || conversations.length === 0) return;
    socketRef.current.emit(
      "join-conversations",
      conversations.map((c) => c._id),
    );
  }, [conversations]);

  const getInitials = (name = "") => {
    if (!name || name === "Deleted User") return "DU";
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getDateLabel = (date) => {
    const msgDate = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(msgDate, today)) return "Today";
    if (isSameDay(msgDate, yesterday)) return "Yesterday";
    return msgDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getOtherUser = (chat) => {
    if (!chat || chat.isGroup) return null;
    return chat.members?.find((m) => m._id !== user._id);
  };

  const renderFileAttachments = (files, isOwnMessage) => {
    if (!files || files.length === 0) return null;

    const images = files.filter((file) => file.fileType?.startsWith("image/"));
    const nonImages = files.filter(
      (file) => !file.fileType?.startsWith("image/"),
    );

    return (
      <div className="files-container mb-2">
        {images.length > 0 && (
          <div
            className="images-grid mb-2"
            style={{
              display: "grid",
              gap: "4px",
              gridTemplateColumns:
                images.length === 1
                  ? "1fr"
                  : images.length === 2
                    ? "repeat(2, 1fr)"
                    : "repeat(3, 1fr)",
              maxWidth: images.length === 1 ? "250px" : "300px",
            }}
          >
            {images.slice(0, 5).map((file, index) => (
              <FileAttachment
                key={index}
                file={file}
                isOwnMessage={isOwnMessage}
                onDownload={handleDownload}
                onImageClick={setSelectedModalImage}
              />
            ))}
            {images.length > 5 && (
              <div
                className="d-flex align-items-center justify-content-center bg-dark text-white"
                style={{ borderRadius: 8, aspectRatio: "1" }}
              >
                +{images.length - 5}
              </div>
            )}
          </div>
        )}
        {nonImages.map((file, index) => (
          <FileAttachment
            key={`doc-${index}`}
            file={file}
            isOwnMessage={isOwnMessage}
            onDownload={handleDownload}
            onImageClick={setSelectedModalImage}
          />
        ))}
      </div>
    );
  };

  if (!user) return <div className="p-5 text-center">Loading chat...</div>;

  return (
    <div className="container-fluid vh-72 bg-light">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .sidebar-tab {
          flex: 1;
          padding: 8px 4px;
          border: none;
          background: transparent;
          border-bottom: 2px solid transparent;
          font-size: 0.85rem;
          font-weight: 500;
          color: #6c757d;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sidebar-tab.active {
          border-bottom: 2px solid #FF6C2F;
          color: #FF6C2F;
        }
        .sidebar-tab:hover:not(.active) {
          color: #343a40;
          background: #f8f9fa;
        }
        .user-list-item {
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 8px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .user-list-item:hover {
          background: #f8f9fa;
        }
      `}</style>
      <div className="row h-100">
        {/* SIDEBAR */}
        <div
          className="col-3 border-end bg-white p-3 chat-sidebar d-flex flex-column"
          style={{ borderLeft: "10px solid #FF6C2F" }}
        >
          {/* Search */}
          <input
            className="form-control rounded-pill mb-2"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => searchUsers(e.target.value)}
            onBlur={() => setTimeout(() => setSearchResults([]), 200)}
          />

          {searchResults.length > 0 && (
            <div
              className="mb-2 border rounded p-2 bg-white"
              style={{
                maxHeight: 500,
                overflowY: "auto",
                position: "absolute",
                zIndex: 1000,
                minWidth: "20vw",
              }}
            >
              {searchResults.map((searchUser) => (
                <div
                  key={searchUser._id}
                  className="p-2 d-flex align-items-center rounded hover-bg mb-1"
                  onClick={() => startChatWithUser(searchUser)}
                >
                  <div
                    className={`${
                      isUserDeleted(searchUser) ? "bg-secondary" : "bg-primary"
                    } text-white rounded-circle d-flex align-items-center justify-content-center me-2`}
                    style={{ width: 40, height: 40 }}
                  >
                    {getInitials(getDisplayName(searchUser))}
                  </div>
                  <div
                    className={
                      isUserDeleted(searchUser) ? "text-muted fst-italic" : ""
                    }
                  >
                    {getDisplayName(searchUser)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB BUTTONS */}
          <div className="d-flex border-bottom mb-2">
            <button
              className={`sidebar-tab ${activeTab === "chats" ? "active" : ""}`}
              onClick={() => setActiveTab("chats")}
            >
              <i className="bi bi-chat-dots me-1"></i>Chats
            </button>
            <button
              className={`sidebar-tab ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <i className="bi bi-people me-1"></i>All Users
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-grow-1 overflow-auto hide-scrollbar">
            {/* CHATS TAB */}
            {activeTab === "chats" && (
              <>
                {/* <button
                  className="btn btn-sm btn-outline-primary w-100 mb-2"
                  onClick={() => {
                    setShowGroupModal(true);
                    loadUsersForGroup();
                  }}
                >
                  + Create New Group
                </button> */}

                {conversations.map((c) => {
                  const otherUser = getOtherUser(c);
                  const isDeleted = !c.isGroup && isUserDeleted(otherUser);
                  const displayName = c.isGroup
                    ? c.name
                    : getDisplayName(otherUser);
                  const isOnline =
                    otherUser &&
                    !isDeleted &&
                    onlineUsers.includes(otherUser._id?.toString());

                  return (
                    <div
                      key={c._id}
                      className={`d-flex align-items-center p-2 rounded mb-2 ${
                        activeChat?._id === c._id ? "bg-light" : ""
                      }`}
                      style={{ cursor: "pointer" }}
                      onClick={() => openChat(c)}
                    >
                      <div
                        className="position-relative me-2"
                        style={{ width: 40, height: 40 }}
                      >
                        <div
                          className="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: 40, height: 40 }}
                        >
                          {c.isGroup ? (
                            <i
                              className="bi bi-people-fill"
                              style={{ fontSize: 18 }}
                            ></i>
                          ) : (
                            getInitials(displayName)
                          )}
                        </div>
                        {!c.isGroup && !isDeleted && isOnline && (
                          <span
                            className="position-absolute bottom-0 end-0 border border-white rounded-circle"
                            style={{
                              width: 15,
                              height: 15,
                              top: -5,
                              backgroundColor: "#25D366",
                            }}
                          ></span>
                        )}
                      </div>
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="d-flex align-items-center gap-1">
                          <span
                            className={`fw-semibold text-truncate ${
                              isDeleted ? "text-muted fst-italic" : ""
                            }`}
                          >
                            {displayName}
                          </span>
                          {c.isGroup && (
                            <i
                              className="bi bi-people-fill text-muted"
                              style={{ fontSize: "0.7rem" }}
                              title="Group"
                            ></i>
                          )}
                        </div>
                        <small className="text-muted text-truncate d-block">
                          {c.lastMessage?.files?.length > 0
                            ? `📎 ${c.lastMessage.files.length} file(s)`
                            : c.lastMessage?.text || "No messages yet"}
                        </small>
                      </div>
                      {unreadMap[c._id] > 0 && (
                        <span className="badge bg-success rounded-pill ms-2">
                          {unreadMap[c._id]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ALL USERS TAB */}
            {activeTab === "users" && (
              <>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <small className="text-muted fw-semibold">
                    {allUsers.length} user{allUsers.length !== 1 ? "s" : ""}
                  </small>
                  <button
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    onClick={() => {
                      setShowGroupModal(true);
                      loadUsersForGroup();
                    }}
                    title="Create Group"
                  >
                    <i className="bi bi-people-fill"></i>
                    <span style={{ fontSize: "0.75rem" }}>New Group</span>
                  </button>
                </div>

                {allUsersLoading ? (
                  <div className="text-center py-4">
                    <div
                      className="spinner-border spinner-border-sm text-primary"
                      role="status"
                    ></div>
                    <p className="text-muted small mt-2">Loading users...</p>
                  </div>
                ) : allUsers.length === 0 ? (
                  <p className="text-muted text-center small py-4">
                    No users found
                  </p>
                ) : (
                  allUsers.map((u) => {
                    const isOnline = onlineUsers.includes(u._id?.toString());
                    return (
                      <div
                        key={u._id}
                        className="user-list-item"
                        onClick={() => startChatWithUser(u)}
                      >
                        <div
                          className="position-relative me-2 flex-shrink-0"
                          style={{ width: 40, height: 40 }}
                        >
                          <div
                            className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 40, height: 40, fontWeight: 600 }}
                          >
                            {getInitials(getDisplayName(u))}
                          </div>
                          {isOnline && (
                            <span
                              className="position-absolute border border-white rounded-circle"
                              style={{
                                width: 12,
                                height: 12,
                                bottom: 0,
                                right: 0,
                                backgroundColor: "#25D366",
                              }}
                            ></span>
                          )}
                        </div>
                        <div className="flex-grow-1 overflow-hidden">
                          <div
                            className="fw-semibold text-truncate"
                            style={{ fontSize: "0.9rem" }}
                          >
                            {getDisplayName(u)}
                          </div>
                          <small
                            className={isOnline ? "text-success" : "text-muted"}
                          >
                            {isOnline ? "Online" : "Offline"}
                          </small>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          title="Send Message"
                          onClick={(e) => {
                            e.stopPropagation();
                            startChatWithUser(u);
                          }}
                          style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                        >
                          <i className="bi bi-chat-dots"></i>
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>

        {/* CHAT WINDOW */}
        <div className="col-9 d-flex flex-column bg-white chat-main">
          {/* Header */}
          <div className="d-flex align-items-center border-bottom p-2">
            {activeChat && (
              <>
                <div
                  className={`rounded-circle ${
                    !activeChat.isGroup &&
                    isUserDeleted(getOtherUser(activeChat))
                      ? "bg-secondary"
                      : "bg-primary"
                  } text-white d-flex align-items-center justify-content-center me-3`}
                  style={{ width: 40, height: 40, fontWeight: 600 }}
                >
                  {activeChat.isGroup ? (
                    <i
                      className="bi bi-people-fill"
                      style={{ fontSize: 18 }}
                    ></i>
                  ) : (
                    getInitials(getDisplayName(getOtherUser(activeChat)))
                  )}
                </div>
                <div className="d-flex flex-column justify-content-center">
                  <span
                    className={`fw-bold ${
                      !activeChat.isGroup &&
                      isUserDeleted(getOtherUser(activeChat))
                        ? "text-muted fst-italic"
                        : ""
                    }`}
                  >
                    {activeChat.isGroup
                      ? activeChat.name
                      : getDisplayName(getOtherUser(activeChat))}
                  </span>
                  {Object.keys(typingUsers).length > 0 &&
                    (activeChat.isGroup ? (
                      <small className="text-primary">
                        {Object.values(typingUsers).join(", ")} typing...
                      </small>
                    ) : (
                      <div
                        className="d-flex align-items-center gap-1 typetext"
                        style={{ fontSize: "0.85rem" }}
                      >
                        <span className="fw-bold txt">Typing</span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                    ))}
                  <small className="text-muted">
                    {activeChat.isGroup
                      ? `${activeChat.members?.length || 0} members`
                      : isUserDeleted(getOtherUser(activeChat))
                        ? "User no longer available"
                        : "Private Chat"}
                  </small>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary ms-auto"
                  onClick={() => setShowFilter((v) => !v)}
                  title="Filter messages"
                >
                  <i className="bi bi-funnel-fill"></i>
                </button>
                {showFilter && (
                  <div className="d-flex align-items-center gap-2 px-3 py-2  bg-white">
                    <input
                      className="form-control form-control-sm"
                      placeholder="Search messages..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      style={{ maxWidth: 200 }}
                    />
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={filterDate}
                      style={{ maxWidth: 160 }}
                      onChange={(e) => {
                        setFilterDate(e.target.value);
                        // Auto-scroll to first message on that date
                        const target = messages.find(
                          (m) =>
                            new Date(m.createdAt)
                              .toISOString()
                              .split("T")[0] === e.target.value,
                        );
                        if (target && messageRefs.current[target._id]) {
                          messageRefs.current[target._id].scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }
                      }}
                    />
                    {(filterText || filterDate) && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          setFilterText("");
                          setFilterDate("");
                        }}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Messages */}
          <div
            className="flex-grow-1 p-3 overflow-auto chat-messages"
            style={{ background: "#f5f7fb" }}
          >
            {messages.map((m, index) => {
              const currentDate = new Date(m.createdAt);
              const prevDate =
                index > 0 ? new Date(messages[index - 1].createdAt) : null;
              const showDate = !prevDate || !isSameDay(currentDate, prevDate);
              const isOwnMessage = m?.sender?._id === user._id;
              const senderDeleted = isUserDeleted(m?.sender);

              return (
                <React.Fragment key={m._id}>
                  {showDate && (
                    <div className="date-separator">
                      {getDateLabel(m.createdAt)}
                    </div>
                  )}
                  <div
                    key={m._id}
                    ref={(el) => (messageRefs.current[m._id] = el)} // ← ADD THIS
                    className={`mb-2 d-flex ${isOwnMessage ? "justify-content-end" : "justify-content-start"}`}
                    // ADD: hide non-matching messages when filter is active
                    style={{
                      display:
                        filterText &&
                        !m.text
                          ?.toLowerCase()
                          .includes(filterText.toLowerCase()) &&
                        !(
                          filterDate &&
                          new Date(m.createdAt).toISOString().split("T")[0] ===
                            filterDate
                        ) &&
                        (filterText || filterDate)
                          ? "none"
                          : "flex",
                    }}
                  >
                    {activeChat?.isGroup && !isOwnMessage && (
                      <div
                        className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: 32,
                          height: 32,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(getDisplayName(m?.sender))}
                      </div>
                    )}
                    <div
                      className={`p-2 px-3 position-relative ${
                        isOwnMessage
                          ? "bg-primary text-white rounded-3"
                          : activeChat?.isGroup
                            ? "bg-white border rounded"
                            : "bg-white border rounded-3"
                      }`}
                      style={{ maxWidth: "70%" }}
                    >
                      <div className="d-flex flex-column">
                        {activeChat?.isGroup && !isOwnMessage && (
                          <span
                            className={`${
                              senderDeleted
                                ? "text-muted fst-italic"
                                : "text-primary"
                            }`}
                            style={{ fontSize: "0.7rem" }}
                          >
                            {getDisplayName(m?.sender)}
                          </span>
                        )}
                        {m.files &&
                          renderFileAttachments(m.files, isOwnMessage)}
                        <div className="d-flex align-items-end gap-2 flex-wrap">
                          {m.text && (
                            <span
                              style={{
                                wordBreak: "break-word",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {filterText &&
                              m.text
                                .toLowerCase()
                                .includes(filterText.toLowerCase())
                                ? m.text
                                    .split(new RegExp(`(${filterText})`, "gi"))
                                    .map((part, i) =>
                                      part.toLowerCase() ===
                                      filterText.toLowerCase() ? (
                                        <mark
                                          key={i}
                                          style={{
                                            backgroundColor: "#facc15",
                                            borderRadius: 3,
                                            padding: "0 2px",
                                          }}
                                        >
                                          {part}
                                        </mark>
                                      ) : (
                                        part
                                      ),
                                    )
                                : m.text}
                            </span>
                          )}
                          <small className="d-flex align-items-center gap-1 time">
                            <span
                              className={
                                isOwnMessage ? "text-white-50" : "text-muted"
                              }
                            >
                              {formatTime(m.createdAt)}
                            </span>
                            {renderTicks(m)}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef}></div>
          </div>

          {/* Input Area */}
          {activeChat && (
            <div className="border-top p-3 position-relative">
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: "absolute",
                    bottom: "80px",
                    left: "20px",
                    zIndex: 100,
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={400}
                    height={500}
                  />
                </div>
              )}
              <div className="d-flex align-items-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-circle mb-1"
                  onClick={openUppyModal}
                  disabled={uploading}
                  title="Attach files"
                >
                  <i className="bi bi-paperclip"></i>
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-circle emoji-btn mb-1"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Insert Emoji"
                >
                  <i className="bi bi-emoji-smile"></i>
                </button>

                <textarea
                  className="form-control hide-scrollbar"
                  placeholder="Type your message..."
                  value={text}
                  disabled={uploading}
                  rows={1}
                  style={{
                    resize: "none",
                    borderRadius: "20px",
                    minHeight: "40px",
                    maxHeight: "150px",
                    overflow: "auto",
                    paddingTop: "8px",
                  }}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;

                    if (!activeChat) return;
                    socketRef.current?.emit("typing", {
                      conversationId: activeChat._id,
                      user: { _id: user._id, name: user.name },
                    });
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      socketRef.current?.emit("stop-typing", {
                        conversationId: activeChat._id,
                        userId: user._id,
                      });
                    }, 1200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !uploading) {
                      e.preventDefault();
                      sendMessage();
                      e.target.style.height = "auto";
                    }
                  }}
                />

                <button
                  className="btn btn-primary rounded-circle px-3 mb-1"
                  onClick={() => {
                    sendMessage();
                    const textarea = document.querySelector(
                      "textarea.form-control",
                    );
                    if (textarea) textarea.style.height = "auto";
                  }}
                  disabled={uploading || !text.trim()}
                >
                  {uploading ? (
                    <span className="spinner-border spinner-border-sm"></span>
                  ) : (
                    <i className="bi bi-send"></i>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GROUP MODAL */}
      {showGroupModal && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h6 className="modal-title">Create Group</h6>
                  <button
                    className="btn-close"
                    onClick={() => setShowGroupModal(false)}
                  />
                </div>
                <div className="modal-body">
                  <input
                    className="form-control mb-2"
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: 150, overflowY: "auto" }}
                  >
                    {/* Change searchResults to groupUserList */}
                    {groupUserList.map((u) => (
                      <label key={u._id} className="d-flex gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={groupMembers.includes(u._id)}
                          onChange={(e) =>
                            setGroupMembers((prev) =>
                              e.target.checked
                                ? [...prev, u._id]
                                : prev.filter((id) => id !== u._id),
                            )
                          }
                        />
                        {getDisplayName(u)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowGroupModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!groupName || groupMembers.length === 0}
                    onClick={createGroup}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {selectedModalImage && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", zIndex: 1060 }}
          onClick={() => setSelectedModalImage(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div
              className="modal-content bg-transparent border-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header border-0 pb-0">
                <h6 className="text-white text-truncate me-3">
                  {selectedModalImage.filename}
                </h6>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      handleDownload(
                        selectedModalImage.key,
                        selectedModalImage.filename,
                      )
                    }
                  >
                    <i className="bi bi-download me-1"></i> Download
                  </button>
                  <button
                    className="btn-close btn-close-white"
                    onClick={() => setSelectedModalImage(null)}
                  ></button>
                </div>
              </div>
              <div className="modal-body text-center">
                <img
                  src={selectedModalImage.url}
                  alt="Preview"
                  className="img-fluid rounded"
                  style={{ maxHeight: "80vh" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPPY DASHBOARD MODAL */}
      {isUppyModalOpen && (
        <DashboardModal
          uppy={uppy}
          open={isUppyModalOpen}
          onRequestClose={closeUppyModal}
          closeModalOnClickOutside={true}
          closeAfterFinish={false}
          proudlyDisplayPoweredByUppy={false}
          note="Upload files up to 500MB. Large files are chunked automatically."
          showProgressDetails={true}
          theme="light"
        />
      )}
    </div>
  );
}
