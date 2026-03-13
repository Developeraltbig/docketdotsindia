// components/Chatbot/Chatbot.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify"; // Ensure this is imported
import "./Chatbot.css";

// --- Icons (Same as before) ---
const SendIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);
const BotIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);
const UserIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const MinimizeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const ExpandIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
const NewChatIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const Chatbot = ({ isOpen, onClose, onToggle }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  // REFS
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatbotRef = useRef(null); // Ref for the main chatbot window
  const historyRef = useRef(null); // Ref for the history dropdown
  const historyBtnRef = useRef(null); // Ref for the history toggle button

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      loadSuggestions();
    }
  }, [isOpen]);

  // --- HANDLE CLICK OUTSIDE LOGIC ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 1. Close Main Chatbot if clicked outside
      if (
        isOpen &&
        chatbotRef.current &&
        !chatbotRef.current.contains(event.target) &&
        // Prevent closing if clicking the Floating Action Button (FAB)
        !event.target.closest(".chatbot-fab")
      ) {
        onClose();
      }

      // 2. Close History if clicked outside the history panel AND outside the toggle button
      if (
        showHistory &&
        historyRef.current &&
        !historyRef.current.contains(event.target) &&
        historyBtnRef.current &&
        !historyBtnRef.current.contains(event.target)
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, showHistory, onClose]);

  // Load initial suggestions
  const loadSuggestions = async () => {
    try {
      const response = await axios.get(`/api/chatbot/suggestions`);
      if (response.data.success) {
        setSuggestions(response.data.suggestions);
      }
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error("Failed to load suggestions:", error);
      }
    }
  };

  // Load chat history
  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`/api/chatbot/sessions`);
      if (response.data.success) {
        setChatHistory(response.data.sessions);
      }
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error("Failed to load chat history:", error);
      }
    }
  };

  // Load a specific session
  const loadSession = async (sessionIdToLoad) => {
    try {
      const response = await axios.get(
        `/api/chatbot/sessions/${sessionIdToLoad}`
      );
      if (response.data.success) {
        const session = response.data.session;
        setSessionId(session._id);
        setMessages(
          session.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            navigationLinks: msg.metadata?.navigationLinks || [],
          }))
        );
        setShowHistory(false); // Close history after selection
      }
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error("Failed to load session:", error);
      }
    }
  };

  // Send message
  const sendMessage = async (messageText = inputValue) => {
    // Close history if user starts typing/sending
    if (showHistory) setShowHistory(false);

    if (!messageText.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await axios.post(`/api/chatbot/message`, {
        message: messageText,
        sessionId,
        includeContext: true,
      });

      if (response.data.success) {
        const assistantMessage = {
          role: "assistant",
          content: response.data.response,
          timestamp: new Date().toISOString(),
          navigationLinks: response.data.navigationLinks || [],
          suggestions: response.data.suggestions || [],
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setSessionId(response.data.sessionId);

        // Update suggestions
        if (response.data.suggestions?.length > 0) {
          setSuggestions(response.data.suggestions);
        }
      }
    } catch (error) {
      if (!import.meta.env.PROD) console.error("Chat error:", error);

      const errorText =
        error?.response?.data?.message ||
        "I apologize, but I encountered an error. Please try again.";
      toast.error(errorText);

      const errorMessage = {
        role: "assistant",
        content: errorText,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (suggestion.route) {
      navigate(suggestion.route);
      onClose?.();
    } else {
      sendMessage(suggestion.text);
    }
  };

  // Handle navigation link click
  const handleNavigationClick = (route) => {
    navigate(route);
    onClose?.();
  };

  // Start new chat
  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setShowHistory(false); // Close history
    loadSuggestions();
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format message content with markdown-like styling
  const formatMessage = (content) => {
    if (!content) return "";

    // Convert markdown-style links to clickable elements
    let formatted = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="chat-link" data-route="$2">$1</a>'
    );

    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Convert bullet points
    formatted = formatted.replace(/^[•\-]\s/gm, "• ");

    // Convert newlines to <br>
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
  };

  // Handle link clicks in messages
  const handleMessageClick = (e) => {
    if (e.target.classList.contains("chat-link")) {
      e.preventDefault();
      const route = e.target.getAttribute("data-route");
      if (route) {
        navigate(route);
        onClose?.();
      }
    }
  };

  if (!isOpen) return null;

  return (
    // ATTACH REF TO MAIN CONTAINER
    <div
      className={`chatbot-container ${isExpanded ? "expanded" : ""}`}
      ref={chatbotRef}
    >
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <BotIcon />
          <span className="chatbot-title">DocketDots AI</span>
        </div>
        <div className="chatbot-header-actions">
          <button
            className="chatbot-header-btn"
            onClick={startNewChat}
            title="New Chat"
          >
            <NewChatIcon />
          </button>
          <button
            // ATTACH REF TO HISTORY BUTTON
            ref={historyBtnRef}
            className="chatbot-header-btn"
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadChatHistory();
            }}
            title="Chat History"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button
            className="chatbot-header-btn"
            onClick={() => {
              setIsExpanded(!isExpanded);
              setShowHistory(false); // Close history when resizing
            }}
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <MinimizeIcon /> : <ExpandIcon />}
          </button>
          <button
            className="chatbot-header-btn close-btn"
            onClick={onClose}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        // ATTACH REF TO HISTORY PANEL
        <div className="chatbot-history" ref={historyRef}>
          <h4>Recent Chats</h4>
          {chatHistory.length === 0 ? (
            <p className="no-history">No chat history</p>
          ) : (
            <ul>
              {chatHistory.map((session) => (
                <li
                  key={session._id}
                  onClick={() => loadSession(session._id)}
                  className="history-item"
                >
                  <span className="history-title">{session.title}</span>
                  <span className="history-date">
                    {new Date(session.lastActivity).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="chatbot-messages" onClick={handleMessageClick}>
        {messages.length === 0 ? (
          <div className="chatbot-welcome">
            <BotIcon />
            <h3>Hello! I'm your DocketDots AI Assistant</h3>
            <p>
              I can help you navigate the system, find information about your
              dockets, tasks, deadlines, and more. Ask me anything!
            </p>
            <div className="quick-suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="suggestion-btn"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.role} ${
                  message.isError ? "error" : ""
                }`}
              >
                <div className="message-avatar">
                  {message.role === "user" ? <UserIcon /> : <BotIcon />}
                </div>
                <div className="message-content">
                  <div
                    className="message-text"
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(message.content),
                    }}
                  />
                  {/* Navigation Links */}
                  {message.navigationLinks?.length > 0 && (
                    <div className="navigation-links">
                      {message.navigationLinks.map((link, linkIndex) => (
                        <button
                          key={linkIndex}
                          className="nav-link-btn"
                          onClick={() => handleNavigationClick(link.route)}
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Follow-up Suggestions */}
                  {message.suggestions?.length > 0 &&
                    index === messages.length - 1 && (
                      <div className="followup-suggestions">
                        {message.suggestions
                          .slice(0, 3)
                          .map((sug, sugIndex) => (
                            <button
                              key={sugIndex}
                              className="followup-btn"
                              onClick={() => handleSuggestionClick(sug)}
                            >
                              {sug.text}
                            </button>
                          ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <BotIcon />
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="chatbot-input-container">
        <textarea
          ref={inputRef}
          className="chatbot-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything..."
          rows={1}
          disabled={isLoading}
        />
        <button
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={!inputValue.trim() || isLoading}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
};

// Floating Chatbot Button Component
export const ChatbotButton = ({ onClick, hasUnread }) => {
  return (
    <button className="chatbot-fab" onClick={onClick}>
      <BotIcon />
      {hasUnread && <span className="unread-badge" />}
    </button>
  );
};

// Wrapper Component with Toggle State
export const ChatbotWrapper = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ChatbotButton onClick={() => setIsOpen(true)} />
      <Chatbot
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onToggle={() => setIsOpen((prev) => !prev)}
      />
    </>
  );
};

export default Chatbot;
