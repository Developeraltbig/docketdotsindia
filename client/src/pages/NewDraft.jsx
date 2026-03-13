import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- SVG ICONS ---
const CopyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);
const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);
const PencilIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const SaveIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);
const FileIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#64748b"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

// --- HELPER FUNCTIONS ---
const stripHtml = (html) => {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDbContent = (text) => {
  // 1. Safety check: If null/undefined, return empty string
  if (!text) return "";

  // 2. FORCE to string (Fixes "trim is not a function" if data is a number)
  const safeText = String(text);

  // 3. Check if it's already HTML
  if (safeText.trim().startsWith("<") && safeText.includes(">")) {
    return safeText;
  }

  const lines = safeText.split("\n");
  let html = "";

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (
      /^\d+\./.test(trimmed) ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("• ")
    ) {
      html += `<li style="margin-left: 20px; margin-bottom: 5px;">${trimmed}</li>`;
    } else if (
      trimmed.length < 60 &&
      !trimmed.endsWith(".") &&
      !trimmed.startsWith("In ")
    ) {
      html += `<h6 style="margin-top: 20px; margin-bottom: 10px; font-weight: 700; color: #1e293b;">${trimmed}</h6>`;
    } else {
      html += `<p style="margin-bottom: 15px; line-height: 1.6;">${trimmed}</p>`;
    }
  });

  return html;
};

const SECTION_MAPPING = [
  { key: "title", label: "Title" },
  { key: "abstract", label: "Abstract" },
  { key: "field", label: "Field of Invention" },
  { key: "background", label: "Background" },
  { key: "description", label: "Detailed Description" },
  { key: "summary", label: "Summary" },
  { key: "advantages", label: "Advantages" },
];

// --- MAIN COMPONENT ---
const UnifiedPatentAssistant = () => {
  // State: General
  const [activeTab, setActiveTab] = useState("title");

  // State: Recent List
  const [recentDrafts, setRecentDrafts] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // State: Input & Generation
  const [inventionText, setInventionText] = useState("");

  // State: Current Active Draft
  const [currentDraft, setCurrentDraft] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editContent, setEditContent] = useState("");

  // State: Download Menu
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef(null);

  // State: Loader Modal
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // [NEW CHANGE] Add Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState(null);
  // [NEW CHANGE] Filter Logic
  const filteredDrafts = recentDrafts.filter((draft) => {
    const rawTitle = draft.sections?.title?.content || "Untitled Invention";
    const cleanTitle = stripHtml(rawTitle).toLowerCase();
    return cleanTitle.includes(searchTerm.toLowerCase());
  });
  // --- 1. INITIAL LOAD ---
  useEffect(() => {
    fetchRecentDrafts();
  }, []);

  // Close download menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target)
      ) {
        setShowDownloadMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchRecentDrafts = async () => {
    try {
      const response = await axios.get("/api/drafts/user/all");
      if (response.data.success) {
        setRecentDrafts(response.data.patents);
      }
    } catch (error) {
      console.error("Failed to fetch recent drafts", error);
    } finally {
      setLoadingRecent(false);
    }
  };

  // --- 2. GENERATE NEW DRAFT ---
  const handleGenerate = async () => {
    // Change this line:
    // if (inventionText.trim().length < 50) {

    // To this (adds a safety fallback):
    if ((inventionText || "").trim().length < 50) {
      toast.warn("Please provide a description of at least 50 characters.");
      return;
    }

    // ... rest of function

    setIsGenerating(true);
    setProgress(0);
    setElapsedTime(0);
    setCurrentDraft(null);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      const response = await axios.post("/api/drafts/generate", {
        inventionText: inventionText,
      });

      if (response.data.success) {
        clearInterval(interval);
        setProgress(100);
        setTimeout(async () => {
          setIsGenerating(false);
          setCurrentDraft(response.data.data);
          setRecentDrafts((prev) => [response.data.data, ...prev]);
        }, 800);
      } else {
        throw new Error(response.data.error || "Generation failed");
      }
    } catch (error) {
      clearInterval(interval);
      setIsGenerating(false);
      toast.error(error.message || "An error occurred during generation.");
    }
  };

  const handleRegenerate = async () => {
    if (!currentDraft || !activeTab) return;

    setIsRegenerating(true);
    setRegeneratingSection(activeTab);

    try {
      const response = await axios.post(
        `/api/drafts/${currentDraft.publicId}/regenerate`,
        {
          sectionKey: activeTab,
          inventionText: inventionText || currentDraft.inventionText,
        },
      );

      if (response.data.success) {
        // Update the current draft with new content
        setCurrentDraft((prev) => ({
          ...prev,
          sections: {
            ...prev.sections,
            [activeTab]: {
              ...prev.sections[activeTab],
              content: response.data.content,
            },
          },
        }));

        // Also update in recent drafts list
        setRecentDrafts((prev) =>
          prev.map((draft) =>
            draft.publicId === currentDraft.publicId
              ? {
                  ...draft,
                  sections: {
                    ...draft.sections,
                    [activeTab]: {
                      ...draft.sections[activeTab],
                      content: response.data.content,
                    },
                  },
                }
              : draft,
          ),
        );

        toast.success("Section regenerated successfully!");
      }
    } catch (error) {
      console.error("Regeneration error:", error);
      toast.error("Failed to regenerate section.");
    } finally {
      setIsRegenerating(false);
      setRegeneratingSection(null);
    }
  };
  // --- 3. LOAD DRAFT ---
  // const loadDraftDetails = async (id) => {
  //   try {
  //     const response = await axios.get(`/api/drafts/${id}`);
  //     if (response.data) {
  //       setCurrentDraft(response.data);
  //       if (response.data.inventionText) {
  //         setInventionText(response.data.inventionText);
  //       }
  //       setActiveTab("title");
  //     }
  //   } catch (error) {
  //     toast.error("Failed to load draft details.");
  //   }
  // };

  const handleRecentClick = (id) => {
    const currentDraft = recentDrafts.filter(
      (recent) => recent.publicId === id,
    );
    setCurrentDraft(currentDraft[0]);
    setInventionText(currentDraft[0].inventionText);
  };

  // --- 4. DOWNLOAD HANDLER ---
  const handleDownload = async (format) => {
    if (!currentDraft) return;

    setShowDownloadMenu(false);
    toast.info(`Generating ${format.toUpperCase()}...`);

    try {
      // Assuming API endpoint pattern from previous code
      const id = currentDraft.publicId || currentDraft._id;
      const response = await axios.get(`/api/drafts/${id}/export/${format}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Patent-Draft-${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Download started!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file.");
    }
  };

  // --- 5. EDITING LOGIC ---
  // --- 5. EDITING LOGIC ---
  const handleEditClick = () => {
    if (!currentDraft) return;

    // Get the raw content
    const rawContent = currentDraft.sections?.[activeTab]?.content || "";

    // Formatting it before passing to Quill ensures lists and headers appear correctly
    const formattedContent = formatDbContent(rawContent);

    setEditingSection(activeTab);
    setEditContent(formattedContent);
  };

  const handleSaveEdit = async () => {
    if (!currentDraft) return;

    try {
      const response = await axios.put(
        `/api/drafts/${currentDraft.publicId}/section`,
        {
          sectionKey: activeTab,
          content: editContent,
        },
      );

      if (response.data.success) {
        setCurrentDraft((prev) => ({
          ...prev,
          sections: {
            ...prev.sections,
            [activeTab]: {
              ...prev.sections[activeTab],
              content: editContent,
            },
          },
        }));
        setEditingSection(null);
        toast.success("Section updated successfully.");
      }
    } catch (error) {
      toast.error("Failed to save changes.");
    }
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
  };

  const copyToClipboard = () => {
    if (!currentDraft) return;
    const content = currentDraft.sections?.[activeTab]?.content || "";
    const plainText = stripHtml(content);
    navigator.clipboard.writeText(plainText);
    toast.success("Copied to clipboard!");
  };

  const getCurrentSectionContent = () => {
    if (!currentDraft || !currentDraft.sections)
      return "<p>No content generated yet.</p>";

    const raw = currentDraft.sections[activeTab]?.content || "";
    if (!raw) return "<p>Section empty.</p>";

    // CHANGE: Apply the formatter here
    return formatDbContent(raw);
  };

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  };

  return (
    <div className="layout-container">
      {/* HEADER */}
      <div className="app-header">
        <div className="brand">
          <h2>AI Drafting Assistant</h2>
          <p>Generate patent specification sections using AI</p>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="main-grid">
        {/* LEFT COLUMN: Inputs & Recent */}
        <div className="left-panel">
          <div className="panel-card input-section">
            <h3>Invention Details</h3>
            <textarea
              className="invention-input"
              placeholder="Describe your invention in detail (problem solved, solution, technical components)..."
              value={inventionText}
              onChange={(e) => setInventionText(e.target.value)}
              disabled={isGenerating}
            />
            <div className="input-footer">
              <p className="hint-text">
                Provide a detailed description for more accurate results.
              </p>
              <button
                className="btn-primary full-width"
                onClick={handleGenerate}
                disabled={
                  isGenerating || currentDraft?.inventionText === inventionText
                }
              >
                {isGenerating ? "Generating..." : "Generate Draft"}
              </button>
            </div>
          </div>

          {/* ... inside the Left Panel div ... */}

          <div className="panel-card recent-section">
            <div className="recent-header">
              <h3>Recent Drafts</h3>
              <input
                type="text"
                placeholder="Search..."
                className="search-input-compact"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="recent-list">
              {loadingRecent ? (
                /* LOADING STATE */
                <div className="empty-state-sidebar">
                  <div className="loader-spinner-small"></div>
                  <p>Loading history...</p>
                </div>
              ) : filteredDrafts.length === 0 ? (
                /* EMPTY / NO RESULTS STATE */
                <div className="empty-state-sidebar">
                  {/* Icon: Show Magnifying Glass if searching, else File Icon */}
                  {searchTerm ? (
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginBottom: "10px" }}
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  ) : (
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginBottom: "10px" }}
                    >
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                  )}

                  <h4>{searchTerm ? "No Matches" : "No Drafts"}</h4>
                  <p>
                    {searchTerm
                      ? `No results found for "${searchTerm}"`
                      : "Your generated history will appear here."}
                  </p>
                </div>
              ) : (
                /* [CHANGED] Map over filteredDrafts */
                filteredDrafts.map((draft) => {
                  const title = stripHtml(
                    draft.sections?.title?.content || "Untitled Invention",
                  );
                  return (
                    <div
                      key={draft._id}
                      className={`recent-item ${
                        currentDraft?.publicId === draft.publicId
                          ? "active"
                          : ""
                      }`}
                      onClick={() => handleRecentClick(draft.publicId)}
                    >
                      <div className="recent-icon">
                        <FileIcon />
                      </div>
                      <div className="recent-info">
                        <span className="recent-title">
                          {title.substring(0, 40) +
                            (title.length > 40 ? "..." : "")}
                        </span>
                        <span className="recent-date">
                          {formatDate(draft.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Output & Editor */}
        <div className="right-panel">
          {/* TABS + DOWNLOAD ACTION HEADER */}
          <div className="tabs-header">
            <div className="tabs-list">
              {SECTION_MAPPING.map((section) => (
                <button
                  key={section.key}
                  className={`tab-btn ${
                    activeTab === section.key ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveTab(section.key);
                    setEditingSection(null);
                  }}
                  disabled={!currentDraft}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {/* DOWNLOAD DROPDOWN (Only visible if draft loaded) */}
            {currentDraft && (
              <div className="download-wrapper" ref={downloadMenuRef}>
                <button
                  className="btn-download"
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                >
                  Download <DownloadIcon />
                </button>
                {showDownloadMenu && (
                  <div className="download-menu">
                    <button onClick={() => handleDownload("docx")}>
                      <span className="file-badge docx">W</span> Word Document
                      (.docx)
                    </button>
                    <button onClick={() => handleDownload("pdf")}>
                      <span className="file-badge pdf">PDF</span> PDF Document
                      (.pdf)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CONTENT AREA */}
          <div className="content-area">
            {!currentDraft ? (
              <div className="empty-state-large">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/7486/7486831.png"
                  alt="AI"
                  width="64"
                  style={{ opacity: 0.5 }}
                />
                <h3>Ready to Draft</h3>
                <p>
                  Enter your invention details on the left and click Generate,
                  or select a recent draft.
                </p>
              </div>
            ) : (
              <>
                <div className="content-toolbar">
                  <h3>
                    {SECTION_MAPPING.find((s) => s.key === activeTab)?.label}
                  </h3>
                  <div className="toolbar-actions">
                    <button className="tool-btn" onClick={copyToClipboard}>
                      <CopyIcon /> Copy
                    </button>
                    <button
                      className="tool-btn"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                    >
                      <RefreshIcon />
                      {isRegenerating && regeneratingSection === activeTab
                        ? "Regenerating..."
                        : "Regenerate"}
                    </button>
                    <button
                      className="tool-btn"
                      onClick={handleEditClick}
                      title="Edit Section"
                    >
                      <PencilIcon />
                      Edit
                    </button>
                  </div>
                </div>

                <div className="content-body">
                  {isRegenerating && regeneratingSection === activeTab ? (
                    <div className="regenerating-overlay">
                      <div className="loader-spinner-small"></div>
                      <p>Regenerating section...</p>
                    </div>
                  ) : editingSection === activeTab ? (
                    <div className="editor-wrapper">
                      <ReactQuill
                        theme="snow"
                        value={editContent}
                        onChange={setEditContent}
                        modules={quillModules}
                        className="custom-quill"
                      />
                      <div className="editor-actions">
                        <button
                          className="btn-secondary"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          onClick={handleSaveEdit}
                        >
                          <SaveIcon /> Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="viewer-wrapper">
                      <div
                        className="generated-text"
                        dangerouslySetInnerHTML={{
                          __html: getCurrentSectionContent(),
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GENERATE LOADER MODAL */}
      {isGenerating && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="loader-spinner"></div>
            <h3>Generating Patent Draft</h3>
            <p>
              Our AI is analyzing your disclosure and drafting specification
              sections.
            </p>

            <div className="progress-container">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="meta-info">
              <span>Status: Processing...</span>
              <span>Time Elapsed: {elapsedTime}s</span>
            </div>
          </div>
        </div>
      )}

      {/* STYLES */}
      <style>{`
        :root {
          --primary: #FF7F50; 
          --primary-light: #FFF0EB;
          --bg-body: #F8F9FA;
          --text-dark: #1E293B;
          --text-gray: #64748B;
          --border: #E2E8F0;
          --white: #FFFFFF;
        }

        .layout-container {
          display: flex;
          flex-direction: column;
          height:81vh;
        }

        .app-header {
          background: var(--white);
          padding: 20px 40px;
          border-bottom: 1px solid var(--border);
        }
        .app-header h2 { margin: 0; color: #334155; font-size: 18px; font-weight: 700; }
        .app-header p { margin: 4px 0 0; color: var(--text-gray); font-size: 13px; }

        .main-grid {
          display: grid;
          grid-template-columns: 30% 1fr;
          gap: 24px;
          padding: 20px 0px 0px 0px;
          flex: 1;
         
        }

        /* LEFT PANEL */
        .left-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
        }

        .panel-card {
          background: var(--white);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .input-section {
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .input-section h3, .recent-section h3 {
          margin-top: 0;
          font-size: 14px;
          color: var(--text-dark);
          font-weight: 600;
          margin-bottom: 15px;
        }

        .input-section label {
          font-size: 12px;
          color: var(--text-gray);
          margin-bottom: 8px;
          display: block;
        }

        .invention-input {
          width: 100%;
          min-height: 180px;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          font-family: inherit;
          font-size: 14px;
          background: #F8FAFC;
          resize: vertical;
          outline: none;
          resize: none;
        }
        .invention-input:focus {
          border-color: var(--primary);
          background: var(--white);
        }

        .input-footer {
          margin-top: 15px;
        }
        .hint-text {
          font-size: 11px;
          color: var(--text-gray);
          margin-bottom: 12px;
        }

        /* RECENT LIST */
        .recent-section {
         
          overflow: auto;
          display: flex;
          flex-direction: column;
          height:32vh;
        }
        .recent-list {
          overflow-y: auto;
          flex: 1;
          padding-right: 5px;
        }
        .recent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid #f1f5f9;
        }
        .recent-item:hover { background: #f8fafc; }
        .recent-item.active { background: var(--primary-light); border-left: 3px solid var(--primary); }
        .recent-info { display: flex; flex-direction: column; }
        .recent-title { font-size: 13px; font-weight: 500; color: var(--text-dark); }
        .recent-date { font-size: 11px; color: var(--text-gray); }

        /* RIGHT PANEL */
        .right-panel {
          background: var(--white);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* TABS HEADER & DOWNLOAD */
        .tabs-header {
            border-bottom: 1px solid var(--border);
            padding: 15px 20px 0 20px;
            background: #fff;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .tabs-list {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 0 5px 15px 5px;
          font-size: 13px;
          color: var(--text-gray);
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          font-weight: 500;
        }
        .tab-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* DOWNLOAD BUTTON & MENU */
        .download-wrapper {
            position: relative;
            margin-bottom: 10px;
        }
        .btn-download {
            background: white;
            border: 1px solid var(--border);
            color: var(--text-dark);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
        }
        .btn-download:hover { background: #f8fafc; border-color: #cbd5e1; }
        
        .download-menu {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 5px;
            background: white;
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 200px;
            z-index: 100;
            padding: 5px;
        }
        .download-menu button {
            width: 100%;
            text-align: left;
            background: none;
            border: none;
            padding: 8px 12px;
            font-size: 13px;
            color: var(--text-dark);
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .download-menu button:hover { background: #f1f5f9; }
        
        .file-badge {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            width: 20px; height: 20px;
            border-radius: 4px;
            color: white;
            font-size: 10px;
            font-weight: bold;
        }
        .file-badge.docx { background: #2B579A; }
        .file-badge.pdf { background: #B30B00; }

        /* CONTENT AREA */
        .content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 30px;
          position: relative;
        }
        
        .content-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .content-toolbar h3 {
          font-size: 18px;
          color: var(--text-dark);
          margin: 0;
        }
        .toolbar-actions { display: flex; gap: 10px; }
        .tool-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-gray);
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
        }
        .tool-btn:hover { color: var(--primary); }

        .content-body {
            position: relative;
            flex: 1;
        }
        
        .generated-text {
            font-size: 15px;
            line-height: 1.6;
            color: #334155;
            overflow:auto;
            height:50vh;
        }
        .generated-text p { margin-bottom: 1em; }
        
        .floating-edit-btn {
            position: absolute;
            top: 0;
            right: 0;
            background: var(--white);
            border: 1px solid var(--border);
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .floating-edit-btn:hover { border-color: var(--primary); color: var(--primary); }

        /* EDITOR */
        .editor-wrapper { display: flex; flex-direction: column; height: 100%; }
        .custom-quill { height: 300px; margin-bottom: 50px; }
        .editor-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 10px;
        }

        /* BUTTONS */
        .btn-primary {
          background: var(--primary);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { background: #cbd5e1; cursor: not-allowed; }
        .full-width { width: 100%; }

        .btn-secondary {
            background: white;
            border: 1px solid var(--border);
            color: var(--text-dark);
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
        }

        .empty-state-large {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--text-gray);
        }

        /* MODAL */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255,255,255,0.9);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .modal-card {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #f1f5f9;
            width: 450px;
            text-align: center;
        }
        .loader-spinner {
            width: 40px; height: 40px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .progress-container {
            width: 100%;
            background: #f1f5f9;
            height: 8px;
            border-radius: 4px;
            margin: 20px 0;
            overflow: hidden;
        }
        .progress-bar {
            height: 100%;
            background: var(--primary);
            transition: width 0.5s ease;
        }
        .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-gray);
            font-weight: 500;
        }

 /* [NEW CSS] Header Row Layout */
.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  gap: 10px;
}

/* Remove default margin from h3 so it aligns vertically with input */
.recent-header h3 {
  margin: 0 !important;
  white-space: nowrap;
}

/* Compact Search Input Styling */
.search-input-compact {
  width: 140px; /* Fixed width or use percentage like 50% */
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  background-color: #f8fafc;
  outline: none;
  transition: all 0.2s;
}

.search-input-compact:focus {
  border-color: var(--primary);
  background-color: #fff;
  width: 160px; /* Optional: Slight expansion on focus */
}       /* [NEW CHANGE] Search Input Style */
.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 10px;
  background-color: #f8fafc;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus {
  border-color: var(--primary);
  background-color: #fff;
}

/* [NEW CSS] Sidebar Empty State */
.empty-state-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 20px;
  color: var(--text-gray);
}

.empty-state-sidebar h4 {
  font-size: 14px;
  color: var(--text-dark);
  margin: 0 0 5px 0;
  font-weight: 600;
}

.empty-state-sidebar p {
  font-size: 12px;
  margin: 0;
  line-height: 1.4;
  color: #94a3b8;
}

/* Mini Spinner for Sidebar */
.loader-spinner-small {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.regenerating-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-gray);
}


  /* ============================================
     RESPONSIVE BREAKPOINTS
     ============================================ */

  /* Large Tablets and Small Laptops: 1024px - 1280px */
  @media (max-width: 1280px) {
    .main-grid {
      grid-template-columns: 320px 1fr;
      gap: 20px;
      padding: 15px 20px;
    }
    
    .app-header {
      padding: 15px 20px;
    }
    
    .content-area {
      padding: 20px;
    }
  }

  /* Tablets: 768px - 1024px */
  @media (max-width: 1024px) {
    .main-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
      gap: 15px;
      padding: 15px;
    }
    
    .left-panel {
      height: auto;
      min-height: 35vh;
      gap: 15px;
    }
    
    .input-section {
      order: 1;
    }
    
    .recent-section {
      order: 2;
      max-height: 300px;
    }
    
    .right-panel {
      order: 3;
      min-height: 500px;
    }
    
    .tabs-header {
      padding: 10px 15px 0 15px;
    }
    
    .content-area {
      padding: 15px;
    }
    
    .app-header h2 {
      font-size: 16px;
    }
    
    .app-header p {
      font-size: 12px;
    }
  }

  /* Mobile Landscape & Small Tablets: 640px - 768px */
  @media (max-width: 768px) {
    .layout-container {
      height: auto;
      min-height: 100vh;
    }
    
    .app-header {
      padding: 12px 15px;
    }
    
    .main-grid {
      padding: 10px;
      gap: 10px;
    }
    
    .panel-card {
      padding: 15px;
    }
    
    .invention-input {
      min-height: 120px;
      font-size: 13px;
    }
    
    .tabs-list {
      gap: 15px;
    }
    
    .tab-btn {
      font-size: 12px;
      padding: 0 3px 12px 3px;
    }
    
    .content-toolbar {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    
    .toolbar-actions {
      width: 100%;
      justify-content: flex-start;
    }
    
    .tool-btn {
      font-size: 12px;
    }
    
    .generated-text {
      font-size: 14px;
    }
    
    .modal-card {
      padding: 25px;
    }
    
    .download-menu {
      width: 180px;
    }
    
    .recent-header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .search-input-compact {
      width: 100%;
    }
    
    .search-input-compact:focus {
      width: 100%;
    }
  }

  /* Mobile Portrait: 480px - 640px */
  @media (max-width: 640px) {
    .app-header h2 {
      font-size: 14px;
    }
    
    .app-header p {
      font-size: 11px;
    }
    
    .tabs-header {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    
    .tabs-list {
      gap: 10px;
      padding-bottom: 5px;
    }
    
    .download-wrapper {
      margin-bottom: 0;
    }
    
    .btn-download {
      width: 100%;
      justify-content: center;
    }
    
    .content-area {
      padding: 12px;
    }
    
    .content-toolbar h3 {
      font-size: 16px;
    }
    
    .toolbar-actions {
      gap: 8px;
    }
    
    .tool-btn {
      font-size: 11px;
      gap: 4px;
    }
    
    .tool-btn svg {
      width: 14px;
      height: 14px;
    }
    
    .editor-actions {
      flex-direction: column;
    }
    
    .editor-actions button {
      width: 100%;
    }
    
    .recent-item {
      padding: 8px;
    }
    
    .recent-title {
      font-size: 12px;
    }
    
    .recent-date {
      font-size: 10px;
    }
  }

  /* Small Mobile: < 480px */
  @media (max-width: 480px) {
    .app-header {
      padding: 10px 12px;
    }
    
    .main-grid {
      padding: 8px;
    }
    
    .panel-card {
      padding: 12px;
      border-radius: 8px;
    }
    
    .modal-card {
      padding: 20px;
    }
    
    .modal-card h3 {
      font-size: 16px;
    }
    
    .btn-primary,
    .btn-secondary {
      padding: 8px 16px;
      font-size: 12px;
    }
    
    .input-section h3,
    .recent-section h3 {
      font-size: 13px;
    }
    
    .invention-input {
      min-height: 100px;
      font-size: 12px;
      padding: 10px;
    }
    
    .hint-text {
      font-size: 10px;
    }
    
    .recent-section {
      max-height: 250px;
    }
    
    .right-panel {
      min-height: 400px;
    }
  }
      `}</style>
    </div>
  );
};

export default UnifiedPatentAssistant;
