import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
// Add at top of PriorArtSearch.jsx
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// ==================== HELPER FUNCTIONS ====================

const extractPatentNumber = (patentId) => {
  if (!patentId || typeof patentId !== "string") return "";
  return patentId.replace(/^patent\//, "").replace(/\/en$/, "");
};

function parseMarkdownTable(text) {
  if (!text || typeof text !== "string") {
    return { headers: [], rows: [] };
  }
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0]
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());

  if (headers.length === 0) return { headers: [], rows: [] };

  const rows = lines.slice(2).map((row) =>
    row
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((cell) => cell.replace(/\\\|/g, "|").trim())
  );

  return { headers, rows };
}

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ==================== TABLE COMPONENT ====================

const TableComponent = ({ tableData }) => {
  if (!tableData || !tableData.headers || tableData.headers.length === 0) {
    return <div className="no-data">No table data available</div>;
  }

  return (
    <table className="matrix-table">
      <thead>
        <tr>
          {tableData.headers.map((header, index) => (
            <th key={index}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={
                  cell === "Considerable"
                    ? "overlap-considerable"
                    : cell === "Partial"
                    ? "overlap-partial"
                    : cell === "-"
                    ? "overlap-none"
                    : ""
                }
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ==================== ICONS ====================

const Icons = {
  Search: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  Clock: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  File: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  ),
  ArrowLeft: () => (
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
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
  ),
  ExternalLink: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  ),
  Download: () => (
    <svg
      width="18"
      height="18"
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
  ),
  Word: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M7 8L9.5 16L12 10L14.5 16L17 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  PDF: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
      <text x="7" y="17" fontSize="6" fill="currentColor" fontWeight="bold">
        PDF
      </text>
    </svg>
  ),
  Trash: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  Refresh: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10"></polyline>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
  ),
  Lightbulb: () => "💡",
  Grid: () => "📊",
  Quote: () => "📝",
  NewSearch: () => (
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
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
};

// ==================== MAIN APP COMPONENT ====================

function PriorArtSearch() {
  // State management
  const [inventionText, setInventionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [retryingPatents, setRetryingPatents] = useState({});

  // Recent searches state
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");

  // View state
  const [viewMode, setViewMode] = useState("list"); // "list" or "details"
  const [selectedPatentId, setSelectedPatentId] = useState(null);
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  // Add to state declarations (around line 236)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  // Fetch recent searches from API
  const fetchRecentSearches = useCallback(async () => {
    try {
      setRecentLoading(true);
      const response = await axios.get("/api/prior-art/recent");
      setRecentSearches(response.data);
    } catch (err) {
      console.error("Error fetching recent searches:", err);
      // Don't show error to user, just keep empty list
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // Load recent searches on mount
  useEffect(() => {
    fetchRecentSearches();
  }, [fetchRecentSearches]);

  // Filter recent searches
  const filteredRecentSearches = useMemo(() => {
    if (!filterQuery.trim()) return recentSearches;
    const query = filterQuery.toLowerCase();
    return recentSearches.filter(
      (s) =>
        s.query?.toLowerCase().includes(query) ||
        s.keyFeatures?.toLowerCase().includes(query)
    );
  }, [recentSearches, filterQuery]);

  // Get selected patent details
  const selectedPatent = useMemo(() => {
    if (!selectedPatentId || !resultData) return null;
    const comparison = resultData.comparisons?.find(
      (c) => c.patentId === selectedPatentId
    );
    if (comparison) {
      const matrix = comparison?.matrix || "";
      let parsedMatrix;
      try {
        parsedMatrix = parseMarkdownTable(matrix);
      } catch (error) {
        parsedMatrix = { headers: [], rows: [] };
      }
      return { ...comparison, parsedMatrix };
    }
    // Check in additional results
    const additional = resultData.patentResults?.find(
      (r) => r.patent_id === selectedPatentId
    );
    return additional ? { ...additional, isAdditional: true } : null;
  }, [selectedPatentId, resultData]);

  // Handle retry patent analysis
  const handleRetryPatent = async (patentId) => {
    try {
      setRetryingPatents((prev) => ({ ...prev, [patentId]: true }));

      const response = await axios.post(
        "/api/prior-art/retry-patent-comparison",
        {
          patentId,
          keyFeatures: resultData.keyFeatures,
        }
      );

      if (response.data && response.data.success) {
        setResultData((prevData) => {
          const updatedComparisons = prevData.comparisons.map((comparison) => {
            if (comparison.patentId === patentId) {
              return {
                ...comparison,
                matrix: response.data.matrix,
                excerpts: response.data.excerpts,
              };
            }
            return comparison;
          });
          return { ...prevData, comparisons: updatedComparisons };
        });
      } else {
        throw new Error(response.data.error || "Retry failed");
      }
    } catch (err) {
      console.error("Error retrying patent analysis:", err);
      setError(`Failed to retry analysis: ${err.message}`);
    } finally {
      setRetryingPatents((prev) => ({ ...prev, [patentId]: false }));
    }
  };

  // Polling effect for job status
  useEffect(() => {
    if (!jobId) return;

    let interval;

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/prior-art/process-invention/status/${jobId}`
        );
        if (!response.ok) throw new Error("Status check failed");

        const statusData = await response.json();
        setProgress(statusData.progress);

        if (statusData.progress <= 10) {
          setProgressMessage("Analyzing your invention");
        } else if (statusData.progress <= 25) {
          setProgressMessage("Generating search queries");
        } else if (statusData.progress <= 35) {
          setProgressMessage("Searching patent databases");
        } else if (statusData.progress <= 50) {
          setProgressMessage("Identifying most relevant patents");
        } else if (statusData.progress <= 60) {
          setProgressMessage("Comparing with your invention");
        } else if (statusData.progress <= 70) {
          setProgressMessage("Generating detailed comparisons");
        } else if (statusData.progress <= 78) {
          setProgressMessage("Finding related patents");
        } else if (statusData.progress <= 82) {
          setProgressMessage("Analyzing patent connections");
        } else if (statusData.progress <= 86) {
          setProgressMessage("Exploring citation networks");
        } else if (statusData.progress <= 88) {
          setProgressMessage("Evaluating additional references");
        } else if (statusData.progress <= 92) {
          setProgressMessage("Finalizing patent selection");
        } else if (statusData.progress <= 95) {
          setProgressMessage("Completing analysis");
        } else {
          setProgressMessage("Preparing your report");
        }

        if (statusData.status === "completed") {
          clearInterval(interval);

          const resultResponse = await fetch(
            `/api/prior-art/process-invention/result/${jobId}`
          );
          if (!resultResponse.ok) throw new Error("Failed to fetch results");

          const data = await resultResponse.json();
          setResultData(data);
          setLoading(false);
          setViewMode("list");
          setJobId(null);

          // Refresh recent searches from API
          fetchRecentSearches();
        } else if (statusData.status === "failed") {
          clearInterval(interval);
          setError(statusData.error || "Analysis failed. Please try again.");
          setLoading(false);
          setJobId(null);
        }
      } catch (err) {
        console.error("Error checking job status:", err);
      }
    };

    interval = setInterval(checkStatus, 3000);
    checkStatus();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, fetchRecentSearches]);

  // Submit handler
  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!inventionText.trim()) {
      setError("Please enter your invention description");
      return;
    }

    setLoading(true);
    setError("");
    setResultData(null);
    setJobId(null);
    setProgress(0);
    setViewMode("list");
    setSelectedPatentId(null);
    setSelectedSearch(null);

    try {
      const response = await fetch("/api/prior-art/process-invention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventionText }),
      });

      if (!response.ok) {
        const errRes = await response.json();
        throw new Error(errRes.error || "API Error");
      }

      const data = await response.json();
      setJobId(data.jobId);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Handle selecting a recent search - fetch full details from API
  const handleSelectRecentSearch = async (search) => {
    try {
      setSelectedSearch(search);
      setInventionText(search.fullQuery || search.query);
      setViewMode("list");
      setSelectedPatentId(null);

      // Fetch full search data from API
      const response = await axios.get(`/api/prior-art/search/${search.id}`);
      setResultData(response.data);
    } catch (err) {
      console.error("Error fetching search details:", err);
      setError("Failed to load search details");
    }
  };

  // Handle deleting a recent search
  const handleDeleteSearch = async (searchId, e) => {
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this search?")) {
      return;
    }

    try {
      await axios.delete(`/api/prior-art/search/${searchId}`);

      // Remove from local state
      setRecentSearches((prev) => prev.filter((s) => s.id !== searchId));

      // If this was the selected search, clear the results
      if (selectedSearch?.id === searchId) {
        setSelectedSearch(null);
        setResultData(null);
        setInventionText("");
      }
    } catch (err) {
      console.error("Error deleting search:", err);
      setError("Failed to delete search");
    }
  };

  // Handle clicking a patent result
  const handleSelectPatent = (patentId) => {
    setSelectedPatentId(patentId);
    setViewMode("details");
    setAbstractExpanded(false);
  };

  // Handle back to list
  const handleBackToList = () => {
    setViewMode("list");
    setSelectedPatentId(null);
  };

  // Download handlers
  const handleDownloadWord = async () => {
    if (!resultData || !selectedPatent) return;

    const htmlContent = generateReportHTML("word");
    const blob = new Blob([htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patent-analysis-${extractPatentNumber(selectedPatentId)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!resultData || !selectedPatent) return;

    const htmlContent = generateReportHTML("pdf");
    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Download all results handler
  const handleDownload = async (format) => {
    if (!resultData) return;
    setShowDownloadMenu(false);

    if (format === "pdf") {
      generateFullPdf(resultData);
    } else {
      generateFullDocx(resultData);
    }
  };

  const generateFullPdf = (data) => {
    const { keyFeatures, comparisons, timestamp } = data;
    const reportDate = new Date(timestamp || Date.now()).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    const checkNewPage = (neededHeight = 20) => {
      if (yPos + neededHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    const addWrappedText = (text, x, maxWidth, lineHeight = 5) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line) => {
        checkNewPage(lineHeight);
        doc.text(line, x, yPos);
        yPos += lineHeight;
      });
      return yPos;
    };

    // --- SHARED HELPER: Normalize Text for PDF ---
    const getNormalizedLines = (text) => {
      if (!text) return [];
      let formatted = text;
      // Replicate UI Regex Logic
      // Headers
      formatted = formatted.replace(/([.:;])\s+(\d+\.\d+\.\d+\.?)/g, "$1\n$2"); // 1.4.1
      formatted = formatted.replace(/([.:;])\s+(\d+\.\d+\.?)/g, "$1\n$2"); // 1.1
      formatted = formatted.replace(/([.:;])\s+(\d+\.)/g, "$1\n$2"); // 1.
      formatted = formatted.replace(/(:)\s+(\d+)/g, "$1\n$2"); // Colon follower
      formatted = formatted.replace(/(\s)(?=\d+\.\d+)/g, "\n"); // Fallback
      return formatted.split("\n").filter((line) => line.trim());
    };

    // --- HELPER: Render Indented List in PDF ---
    const renderIndentedList = (rawText, startX, width) => {
      const lines = getNormalizedLines(rawText);

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        checkNewPage(6);

        // Detect Levels
        const isHeader = /^[A-Z][a-zA-Z\s]+:$/.test(trimmed);
        const deepSubMatch = trimmed.match(/^(\d+\.\d+\.\d+)\.?\s+(.+)/); // 1.4.1
        const subMatch = trimmed.match(/^(\d+\.\d+)\.?\s+(.+)/); // 1.1
        const mainMatch = trimmed.match(/^(\d+)\.\s+(.+)/); // 1.

        let currentX = startX;
        let fontSize = 9;
        let fontType = "normal";

        if (isHeader) {
          // Header Style
          yPos += 2;
          doc.setFont(undefined, "bold");
          doc.setFontSize(10);
          addWrappedText(trimmed, currentX, width, 5);
          doc.setFont(undefined, "normal");
          doc.setFontSize(9);
          yPos += 1;
        } else if (deepSubMatch) {
          // Level 3 (Indent 15mm)
          currentX += 15;
          const num = deepSubMatch[1];
          const txt = deepSubMatch[2];
          doc.setTextColor(100, 100, 100); // Muted color for sub-items
          doc.text(num, currentX, yPos);
          doc.setTextColor(60, 60, 60);
          addWrappedText(txt, currentX + 12, width - 27, 5);
        } else if (subMatch) {
          // Level 2 (Indent 8mm)
          currentX += 8;
          const num = subMatch[1];
          const txt = subMatch[2];
          doc.text(num, currentX, yPos);
          addWrappedText(txt, currentX + 10, width - 18, 5);
        } else if (mainMatch) {
          // Level 1 (No indent, Bold number)
          const num = mainMatch[1] + ".";
          const txt = mainMatch[2];
          doc.setFont(undefined, "bold");
          doc.setTextColor(255, 108, 47); // Orange accent
          doc.text(num, currentX, yPos);
          doc.setFont(undefined, "normal");
          doc.setTextColor(60, 60, 60);
          addWrappedText(txt, currentX + 8, width - 8, 5);
        } else {
          // Regular Paragraph
          addWrappedText(trimmed, currentX, width, 5);
        }
        yPos += 1; // Spacing between items
      });
    };

    // ... (Keep Excerpt Helper exactly as it was in previous code) ...
    const addFormattedExcerpts = (excerpts, x, maxWidth) => {
      // Paste your existing addFormattedExcerpts code here
      // (I won't repeat it to save space, assuming it's unchanged)
      if (!excerpts) return;
      const paragraphs = excerpts.split(/\n\n+/).filter((p) => p.trim());
      paragraphs.forEach((para) => {
        checkNewPage(10);
        const lines = doc.splitTextToSize(para, maxWidth);
        lines.forEach((line) => {
          checkNewPage(5);
          doc.text(line, x, yPos);
          yPos += 5;
        });
        yPos += 3;
      });
    };

    // ========== COVER PAGE (Same as before) ==========
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 8, "F");
    yPos = 60;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("CONFIDENTIAL", pageWidth / 2, yPos, { align: "center" });
    yPos += 20;
    doc.setFontSize(24);
    doc.setTextColor(26, 26, 26);
    doc.setFont(undefined, "bold");
    doc.text("PRIOR ART SEARCH REPORT", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 30;
    doc.setFontSize(11);
    doc.setFont(undefined, "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(`Date: ${reportDate}`, pageWidth / 2, yPos, { align: "center" });
    doc.addPage();
    yPos = margin;

    // ========== KEY FEATURES PAGE ==========
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, yPos, contentWidth, 8, "F");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.text("KEY FEATURES OF THE INVENTION", margin + 3, yPos + 5.5);
    yPos += 15;

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont(undefined, "normal");

    if (keyFeatures) {
      // USE NEW RENDERER
      renderIndentedList(keyFeatures, margin, contentWidth);
    }

    // ========== PATENT RESULTS ==========
    if (comparisons && comparisons.length > 0) {
      comparisons.forEach((comparison, index) => {
        doc.addPage();
        yPos = margin;
        const patentNum = extractPatentNumber(comparison.patentId);
        const details = comparison.details || {};
        const matrix = parseMarkdownTable(comparison.matrix || "");

        // Header
        doc.setFillColor(245, 245, 240);
        doc.rect(margin, yPos, contentWidth, 20, "F");
        doc.setFontSize(11);
        doc.setTextColor(37, 99, 235);
        doc.setFont(undefined, "bold");
        doc.text(`Result #${index + 1}: ${patentNum}`, margin + 5, yPos + 7);
        doc.setFontSize(10);
        doc.setTextColor(26, 26, 26);
        doc.text(
          (details.title || "No title").substring(0, 80),
          margin + 5,
          yPos + 14
        );
        yPos += 25;

        // --- COVERAGE BOX (UPDATED) ---
        if (comparison.foundSummary) {
          checkNewPage(25);

          // 1. Calculate height dynamically based on content
          // We do a "dry run" or simple estimation
          const coverageLines = getNormalizedLines(
            comparison.foundSummary
          ).length;
          const estimatedHeight = Math.max(15, coverageLines * 6 + 12);

          doc.setFillColor(209, 250, 229); // Green bg
          doc.setDrawColor(5, 150, 105);
          doc.setLineWidth(0.3);
          doc.rect(margin, yPos, contentWidth, estimatedHeight, "FD");

          doc.setFontSize(9);
          doc.setTextColor(5, 150, 105);
          doc.setFont(undefined, "bold");
          doc.text("COVERAGE IDENTIFIED:", margin + 3, yPos + 6);

          // Render the list inside the box
          yPos += 10;
          doc.setTextColor(26, 26, 26);
          doc.setFont(undefined, "normal");

          // Render indented list inside the green box
          renderIndentedList(
            comparison.foundSummary,
            margin + 3,
            contentWidth - 6
          );

          // Adjust yPos after the list
          yPos += 5;
        }

        // Meta Info
        checkNewPage(20);
        yPos += 10;
        doc.setFontSize(10);
        doc.setTextColor(90, 90, 90);
        doc.text(`Inventor: ${details.inventor || "N/A"}`, margin, yPos);
        yPos += 10;

        // Abstract
        if (details.abstract) {
          checkNewPage(30);
          doc.setFont(undefined, "bold");
          doc.text("Abstract", margin, yPos);
          yPos += 5;
          doc.setFont(undefined, "normal");
          addWrappedText(
            details.abstract.substring(0, 800),
            margin,
            contentWidth,
            5
          );
          yPos += 10;
        }

        // Matrix (Keep existing autoTable logic)
        if (matrix.headers.length > 0) {
          // ... Copy your existing autoTable code here ...
          autoTable(doc, {
            startY: yPos,
            head: [matrix.headers],
            body: matrix.rows,
            margin: { left: margin, right: margin },
            // ... styles ...
          });
          yPos = doc.lastAutoTable.finalY + 10;
        }

        // Excerpts (Keep existing logic)
        if (comparison.excerpts) {
          // ... Copy existing excerpts logic ...
          doc.text("Relevant Excerpts", margin, yPos);
          yPos += 6;
          addFormattedExcerpts(comparison.excerpts, margin, contentWidth);
        }
      });
    }

    doc.save(`prior-art-search-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const generateFullDocx = (data) => {
    const { keyFeatures, comparisons, timestamp } = data;
    const reportDate = new Date(timestamp || Date.now()).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    const escapeHtml = (text) => {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    // --- HELPER: Create HTML with Indentation for Word ---
    const formatStructuredTextHTML = (text, isGreenBox = false) => {
      if (!text) return "";

      // 1. Normalize (same regex as UI)
      let formatted = text;
      formatted = formatted.replace(/([.:;])\s+(\d+\.\d+\.\d+\.?)/g, "$1\n$2");
      formatted = formatted.replace(/([.:;])\s+(\d+\.\d+\.?)/g, "$1\n$2");
      formatted = formatted.replace(/([.:;])\s+(\d+\.)/g, "$1\n$2");
      formatted = formatted.replace(/(:)\s+(\d+)/g, "$1\n$2");
      formatted = formatted.replace(/(\s)(?=\d+\.\d+)/g, "\n");

      const lines = formatted.split("\n").filter((l) => l.trim());
      let html = "";

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Patterns
        const isHeader = /^[A-Z][a-zA-Z\s]+:$/.test(trimmed);
        const deepSubMatch = trimmed.match(/^(\d+\.\d+\.\d+)\.?\s+(.+)/); // 1.4.1
        const subMatch = trimmed.match(/^(\d+\.\d+)\.?\s+(.+)/); // 1.1
        const mainMatch = trimmed.match(/^(\d+)\.\s+(.+)/); // 1.

        // Styles for Word (using simple div/p with margin-left)
        // Note: Word handles px margins reasonably well for HTML imports

        if (isHeader) {
          html += `<h4 style="margin: 12px 0 6px 0; font-size: 11pt; font-weight: bold; text-decoration: underline;">${escapeHtml(
            trimmed
          )}</h4>`;
        } else if (deepSubMatch) {
          // Level 3
          html += `
            <div style="margin-left: 40px; margin-bottom: 4px; font-size: 10pt; color: #555;">
              <span style="font-weight: bold; margin-right: 5px;">${
                deepSubMatch[1]
              }</span>
              <span>${escapeHtml(deepSubMatch[2])}</span>
            </div>`;
        } else if (subMatch) {
          // Level 2
          html += `
            <div style="margin-left: 20px; margin-bottom: 4px; font-size: 10.5pt; color: #333;">
              <span style="font-weight: bold; margin-right: 5px;">${
                subMatch[1]
              }</span>
              <span>${escapeHtml(subMatch[2])}</span>
            </div>`;
        } else if (mainMatch) {
          // Level 1
          const numColor = isGreenBox ? "#059669" : "#ff6c2f";
          html += `
            <div style="margin-left: 0px; margin-top: 8px; margin-bottom: 4px; font-size: 11pt; color: #000;">
              <span style="font-weight: bold; color: ${numColor}; margin-right: 8px;">${
            mainMatch[1]
          }.</span>
              <span>${escapeHtml(mainMatch[2])}</span>
            </div>`;
        } else {
          html += `<p style="margin: 4px 0;">${escapeHtml(trimmed)}</p>`;
        }
      });
      return html;
    };

    // --- Format Excerpts (Keep existing logic) ---
    const formatExcerptsHTML = (excerpts) => {
      // ... (Keep your existing formatExcerptsHTML logic) ...
      if (!excerpts) return "";
      return `<pre style="white-space: pre-wrap; font-family: Arial; font-size: 10pt;">${escapeHtml(
        excerpts
      )}</pre>`;
    };

    // --- BUILD HTML CONTENT ---
    let htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <!-- Title Page -->
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #2563eb;">PRIOR ART SEARCH REPORT</h1>
        <p>Date: ${reportDate}</p>
      </div>

      <!-- Key Features -->
      <h2 style="color: #2563eb; border-bottom: 1px solid #ccc;">Key Features of the Invention</h2>
      <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #ff6c2f;">
        ${formatStructuredTextHTML(keyFeatures, false)}
      </div>
      <br/>
    `;

    // Add Patents
    if (comparisons && comparisons.length > 0) {
      comparisons.forEach((comparison, index) => {
        const patentNum = comparison.patentId
          .replace(/^patent\//, "")
          .replace(/\/en$/, "");
        const details = comparison.details || {};
        const matrix = parseMarkdownTable(comparison.matrix || "");

        htmlContent += `
        <div style="border: 1px solid #ddd; padding: 20px; margin-bottom: 30px;">
          <h3 style="color: #2563eb;">Result #${index + 1}: ${patentNum}</h3>
          <h4>${escapeHtml(details.title)}</h4>

          ${
            comparison.foundSummary
              ? `
            <div style="background: #d1fae5; border: 1px solid #059669; padding: 15px; margin: 15px 0; border-radius: 5px;">
              <strong style="color: #059669; display:block; margin-bottom:10px;">COVERAGE IDENTIFIED:</strong>
              <!-- USE STRUCTURED FORMATTER HERE TOO -->
              ${comparison.foundSummary}
            </div>
          `
              : ""
          }

          <p><strong>Inventor:</strong> ${escapeHtml(
            details.inventor || "N/A"
          )}</p>
          
          ${
            details.abstract
              ? `
            <h5>Abstract</h5>
            <p>${escapeHtml(details.abstract)}</p>
          `
              : ""
          }

          ${
            matrix.headers.length > 0
              ? `
             <h5>Comparison Matrix</h5>
             <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
               <thead><tr style="background:#eee;">${matrix.headers
                 .map((h) => `<th>${escapeHtml(h)}</th>`)
                 .join("")}</tr></thead>
               <tbody>${matrix.rows
                 .map(
                   (row) =>
                     `<tr>${row
                       .map((c) => `<td>${escapeHtml(c)}</td>`)
                       .join("")}</tr>`
                 )
                 .join("")}</tbody>
             </table>
          `
              : ""
          }

          ${
            comparison.excerpts
              ? `
            <h5>Relevant Excerpts</h5>
            <div style="background:#f5f5f5; padding:10px;">${formatExcerptsHTML(
              comparison.excerpts
            )}</div>
          `
              : ""
          }
        </div>
        `;
      });
    }

    htmlContent += `</div>`;

    // Generate Blob
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"><title>Report</title></head>
      <body>${htmlContent}</body></html>
    `;

    const blob = new Blob([fullHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const generateReportHTML = (format) => {
    const patentNum = extractPatentNumber(selectedPatentId);
    const details = selectedPatent.details || selectedPatent;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Patent Analysis Report - ${patentNum}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2px; line-height: 1.6; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          h2 { color: #2563eb; margin-top: 30px; }
          .meta { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .meta-item { margin: 8px 0; }
          .meta-label { font-weight: bold; color: #666; }
          .coverage { background: #d1fae5; border: 1px solid #059669; padding: 15px; border-radius: 8px; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; }
          .excerpts { background: #f9f9f9; padding: 15px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Patent Analysis Report</h1>
        <p><strong>Patent ID:</strong> ${patentNum}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        
        <div class="meta">
          <div class="meta-item"><span class="meta-label">Title:</span> ${
            details.title || "N/A"
          }</div>
          <div class="meta-item"><span class="meta-label">Filing Date:</span> ${
            details.filing_date || "N/A"
          }</div>
          <div class="meta-item"><span class="meta-label">Inventor:</span> ${
            Array.isArray(details.inventors)
              ? details.inventors.map((inv) => inv.name).join(", ")
              : details.inventor || "N/A"
          }</div>
          <div class="meta-item"><span class="meta-label">Assignee:</span> ${
            details.assignees?.join(", ") || details.assignee || "N/A"
          }</div>
        </div>
        
        ${
          selectedPatent.foundSummary
            ? `<div class="coverage"><strong>Coverage Identified:</strong><br/>${selectedPatent.foundSummary}</div>`
            : ""
        }
        
        <h2>Abstract</h2>
        <p>${details.abstract || details.snippet || "No abstract available"}</p>
        
        ${
          selectedPatent.parsedMatrix?.headers?.length
            ? `
          <h2>Key Features Comparison Matrix</h2>
          <table>
            <thead><tr>${selectedPatent.parsedMatrix.headers
              .map((h) => `<th>${h}</th>`)
              .join("")}</tr></thead>
            <tbody>${selectedPatent.parsedMatrix.rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
              )
              .join("")}</tbody>
          </table>
        `
            : ""
        }
        
        ${
          selectedPatent.excerpts
            ? `<h2>Relevant Excerpts</h2><div class="excerpts">${selectedPatent.excerpts}</div>`
            : ""
        }
        
        <h2>Key Features Analyzed</h2>
        <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 8px;">${
          resultData.keyFeatures || "N/A"
        }</pre>
      </body>
      </html>
    `;
  };

  // Get additional results
  const getAdditionalResults = () => {
    if (!resultData?.patentResults) return [];

    const scholarResults = resultData.patentResults
      .filter((result) => result.is_scholar)
      .slice(0, 2);

    const additionalPatents = resultData.patentResults
      .filter((result) => {
        if (result.is_scholar) return false;
        const resultPatentNumber = extractPatentNumber(result.patent_id);
        const shownPatentNumbers = (resultData.comparisons || []).map((c) =>
          extractPatentNumber(c.patentId)
        );
        return !shownPatentNumbers.includes(resultPatentNumber);
      })
      .sort((a, b) => {
        if (a.fromCitationPool && !b.fromCitationPool) return -1;
        if (!a.fromCitationPool && b.fromCitationPool) return 1;
        return 0;
      })
      .slice(0, 18);

    return [...scholarResults, ...additionalPatents];
  };

  // Truncate text helper
  const truncateToWords = (text, wordCount) => {
    if (!text) return "";
    const words = text.split(/\s+/);
    if (words.length <= wordCount) return text;
    return words.slice(0, wordCount).join(" ") + "...";
  };

  const formatKeyFeaturesForDisplay = (keyFeatures) => {
    if (!keyFeatures) return null;

    let formatted = keyFeatures;

    // 2. Break "Deep" sub-items (e.g. "1.4.1." or "1.5.1")
    // Looks for punctuation/space -> number.number.number -> dot(optional)
    formatted = formatted.replace(/([.:;])\s+(\d+\.\d+\.\d+\.?)/g, "$1\n$2");

    // 3. Break "Sub" items (e.g. "1.1." or "1.2")
    // Looks for punctuation/space -> number.number -> dot(optional)
    formatted = formatted.replace(/([.:;])\s+(\d+\.\d+\.?)/g, "$1\n$2");

    // 4. Break "Main" items (e.g. "1.")
    // Looks for punctuation/space -> number -> dot
    formatted = formatted.replace(/([.:;])\s+(\d+\.)/g, "$1\n$2");

    // 5. Handle case where it starts immediately after a colon (e.g. "comprising: 1.1.")
    formatted = formatted.replace(/(:)\s+(\d+)/g, "$1\n$2");

    // =========================================================================
    // STEP 2: PARSE & RENDER
    // =========================================================================
    const lines = formatted.split("\n").filter((line) => line.trim());
    const elements = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // --- Regex Patterns ---
      const isHeader = /^[A-Z][a-zA-Z\s]+:$/.test(trimmed);
      const deepSubMatch = trimmed.match(/^(\d+\.\d+\.\d+)\.?\s+(.+)/); // 1.4.1
      const subMatch = trimmed.match(/^(\d+\.\d+)\.?\s+(.+)/); // 1.1
      const mainMatch = trimmed.match(/^(\d+)\.\s+(.+)/); // 1.

      if (isHeader) {
        elements.push(
          <h4 key={`head-${index}`} className="kf-header">
            {trimmed}
          </h4>
        );
      } else if (deepSubMatch) {
        // Level 3 (1.4.1)
        elements.push(
          <div key={`item-${index}`} className="kf-row level-3">
            <span className="kf-num">{deepSubMatch[1]}</span>
            <span className="kf-text">{deepSubMatch[2]}</span>
          </div>
        );
      } else if (subMatch) {
        // Level 2 (1.1)
        elements.push(
          <div key={`item-${index}`} className="kf-row level-2">
            <span className="kf-num">{subMatch[1]}</span>
            <span className="kf-text">{subMatch[2]}</span>
          </div>
        );
      } else if (mainMatch) {
        // Level 1 (1.)
        elements.push(
          <div key={`item-${index}`} className="kf-row level-1">
            <span className="kf-num">{mainMatch[1]}.</span>
            <span className="kf-text">{mainMatch[2]}</span>
          </div>
        );
      } else {
        // Regular text
        elements.push(
          <div key={`para-${index}`} className="kf-paragraph">
            {trimmed}
          </div>
        );
      }
    });

    return <div className="key-features-container">{elements}</div>;
  };

  const formatExcerptsForDisplay = (excerpts) => {
    if (!excerpts) return null;

    // Split by double newlines or single newlines for better paragraph handling
    const paragraphs = excerpts
      .split(/\n\n+|\n(?=\d+\.\d+|\d+\.|\[|\")/)
      .filter((p) => p.trim());

    return paragraphs.map((para, index) => {
      const trimmedPara = para.trim();

      // Check for sub-numbered items (e.g., "1.1", "1.2")
      const subNumberedMatch = trimmedPara.match(/^(\d+\.\d+\.?)\s*(.+)/s);
      // Check for main numbered items
      const numberedMatch = trimmedPara.match(/^(\d+)\.\s+(.+)/s);
      // Check for quoted text
      const isQuote =
        trimmedPara.startsWith('"') || trimmedPara.startsWith("'");
      // Check for claim references (e.g., "Claim 1:", "[0045]")
      const isClaimRef = /^(Claim \d+:|\[\d+\])/.test(trimmedPara);

      if (isQuote) {
        return (
          <blockquote key={index} className="excerpt-quote">
            {trimmedPara}
          </blockquote>
        );
      }
      if (isClaimRef) {
        return (
          <div key={index} className="excerpt-claim">
            {trimmedPara}
          </div>
        );
      }
      if (subNumberedMatch) {
        return (
          <div key={index} className="excerpt-numbered-item sub">
            <span className="excerpt-number">{subNumberedMatch[1]}</span>
            <span className="excerpt-text">{subNumberedMatch[2]}</span>
          </div>
        );
      }
      if (numberedMatch) {
        return (
          <div key={index} className="excerpt-numbered-item">
            <span className="excerpt-number">{numberedMatch[1]}.</span>
            <span className="excerpt-text">{numberedMatch[2]}</span>
          </div>
        );
      }
      return (
        <p key={index} className="excerpt-paragraph">
          {trimmedPara}
        </p>
      );
    });
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app-container">
        {/* Header */}
        <div className="app-header">
          <div className="header-content">
            <h4>Prior Art Search</h4>
            <p>Search multiple patent databases for relevant prior art</p>
          </div>
        </div>

        {/* Main Layout */}
        <div className="main-layout">
          {/* Left Panel - Search & Recent */}
          <aside className="left-panel">
            {/* Search Section */}
            <div className="search-section">
              <label className="section-label">Invention Disclosure</label>
              <textarea
                className="search-textarea"
                placeholder="Describe your invention in detail. Include the problem it solves, how it works, key components, novel features, and any technical specifications..."
                value={inventionText}
                onChange={(e) => setInventionText(e.target.value)}
              />
              <button
                className="search-button"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>Analyzing...</>
                ) : (
                  <>
                    <Icons.Search /> Search Prior Art
                  </>
                )}
              </button>
            </div>

            {/* Recent Searches */}
            <div className="recent-section">
              <div className="recent-header">
                <h3>Recent Searches</h3>
                <div className="recent-header-actions">
                  <button
                    className="refresh-button"
                    onClick={fetchRecentSearches}
                    disabled={recentLoading}
                    title="Refresh"
                  >
                    <Icons.Refresh />
                  </button>
                  <span className="recent-count">{recentSearches.length}</span>
                </div>
              </div>

              <div className="recent-filter">
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Filter searches..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>

              <div className="recent-list">
                {recentLoading ? (
                  <div className="empty-recent">
                    <div className="loading-spinner-small"></div>
                    <p>Loading searches...</p>
                  </div>
                ) : filteredRecentSearches.length > 0 ? (
                  filteredRecentSearches.map((search) => (
                    <div
                      key={search.id}
                      className={`recent-item ${
                        selectedSearch?.id === search.id ? "active" : ""
                      }`}
                      onClick={() => handleSelectRecentSearch(search)}
                    >
                      <div className="recent-item-content">
                        <div className="recent-item-title">{search.query}</div>
                        <div className="recent-item-meta">
                          <span className="recent-item-date">
                            <Icons.Clock />
                            {formatDate(search.timestamp)}
                          </span>
                          <span className="recent-item-results">
                            <Icons.File />
                            {search.resultsCount} results
                          </span>
                        </div>
                      </div>
                      <button
                        className="delete-button"
                        onClick={(e) => handleDeleteSearch(search.id, e)}
                        title="Delete search"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-recent">
                    <div className="empty-recent-icon">📋</div>
                    <p>
                      No recent searches yet.
                      <br />
                      Start by entering an invention description above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Right Panel - Results/Details */}
          <div className="right-panel">
            {/* Error Display */}
            {error && (
              <div className="results-view">
                <div className="error-container">
                  <strong>Error:</strong> {error}
                  <button className="error-close" onClick={() => setError("")}>
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <div className="loading-message">{progressMessage}</div>
                <div className="loading-submessage">
                  Please don't close this tab
                </div>
                <div className="progress-container">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {progress}% complete • ~
                    {Math.max(1, Math.round((100 - progress) / 8))} minutes
                    remaining
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !resultData && !error && (
              <div className="empty-state">
                <div className="empty-state-icon">🔎</div>
                <h2>Start Your Search</h2>
                <p>
                  Enter your invention disclosure to find relevant prior art
                  documents, or select a recent search from the list.
                </p>
              </div>
            )}

            {/* Results List View */}
            {!loading && resultData && viewMode === "list" && (
              <div className="results-view">
                <div className="results-header">
                  <h2 className="results-title">Search Results</h2>
                  <div className="results-actions">
                    <div className="download-dropdown">
                      <button
                        className="btn-download"
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      >
                        Download All <Icons.Download />
                      </button>

                      {showDownloadMenu && (
                        <div className="download-menu visible">
                          <button onClick={() => handleDownload("docx")}>
                            <Icons.Word /> Word Document (.docx)
                          </button>
                          <button onClick={() => handleDownload("pdf")}>
                            <Icons.PDF /> PDF Document (.pdf)
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      className="action-button"
                      onClick={() => {
                        setResultData(null);
                        setInventionText("");
                        setSelectedSearch(null);
                        setError("");
                      }}
                    >
                      <Icons.NewSearch /> New Search
                    </button>
                  </div>
                </div>

                {/* Key Features */}
                {resultData.keyFeatures && (
                  <div className="key-features-box">
                    <div className="key-features-header">
                      <div className="key-features-icon">
                        {Icons.Lightbulb()}
                      </div>
                      <span className="key-features-title">
                        Generated Key Features
                      </span>
                    </div>
                    <div className="key-features-content formatted">
                      {formatKeyFeaturesForDisplay(resultData.keyFeatures)}
                    </div>
                  </div>
                )}

                {/* Relevant Results */}
                <div className="results-grid">
                  {(resultData.comparisons || []).map((comparison, index) => {
                    const patentId = comparison.patentId;
                    const simplifiedId = extractPatentNumber(patentId);
                    const details = comparison.details || {};

                    return (
                      <div
                        key={`result-${index}`}
                        className="result-card"
                        onClick={() => handleSelectPatent(patentId)}
                        // Ensure the card itself has a white background and proper spacing
                        style={{
                          backgroundColor: "#fff",
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {/* 1. Reuse 'details-header-top' structure for Rank & Link */}
                        <div
                          className="details-header-top"
                          style={{ marginBottom: "8px" }}
                        >
                          <span
                            className="details-rank"
                            style={{ fontSize: "0.85rem" }}
                          >
                            Rank {comparison.rank || index + 1}
                          </span>
                          {/* <a
                            href="#"
                            className="details-id-link"
                            onClick={() => handleSelectPatent(patentId)}
                          >
                            View Detail Matrix
                          </a> */}
                          <a
                            href={`https://patents.google.com/patent/${simplifiedId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="details-id-link"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: "0.85rem" }}
                          >
                            {simplifiedId} <Icons.ExternalLink size={14} />
                          </a>
                        </div>

                        {/* 2. Title - Reuse 'details-title' class but override font size for list view */}
                        <h3
                          className="details-title"
                          style={{
                            fontSize: "1.1rem",
                            marginTop: "0",
                            marginBottom: "12px",
                          }}
                        >
                          {details.title || "No title available"}
                        </h3>

                        {/* 3. Coverage - Reuse 'details-coverage' class to inherit the EXACT background color */}
                        {comparison.foundSummary && (
                          <div
                            className="details-coverage"
                            style={{ padding: "10px", margin: "0 0 12px 0" }}
                          >
                            <div
                              className="details-coverage-label"
                              style={{ fontSize: "0.7rem" }}
                            >
                              Coverage Identified
                            </div>
                            <div
                              className="details-coverage-text"
                              style={{
                                fontSize: "0.85rem",
                                lineHeight: "1.5",
                                whiteSpace: "pre-line",
                              }}
                            >
                              {comparison.foundSummary}
                            </div>
                          </div>
                        )}

                        {/* 4. Meta Grid - Reuse 'details-meta-grid' class for exact layout match */}
                        <div
                          className="details-meta-grid"
                          style={{ gap: "12px", paddingTop: "8px" }}
                        >
                          {/* Filing Date */}
                          {details.filing_date && (
                            <div className="details-meta-item">
                              <div
                                className="details-meta-label"
                                style={{ fontSize: "0.7rem" }}
                              >
                                Filing Date
                              </div>
                              <div
                                className="details-meta-value"
                                style={{ fontSize: "0.8rem" }}
                              >
                                {details.filing_date}
                              </div>
                            </div>
                          )}

                          {/* Inventor */}
                          {(details.inventors || details.inventor) && (
                            <div className="details-meta-item">
                              <div
                                className="details-meta-label"
                                style={{ fontSize: "0.7rem" }}
                              >
                                Inventor
                              </div>
                              <div
                                className="details-meta-value"
                                style={{ fontSize: "0.8rem" }}
                              >
                                {Array.isArray(details.inventors)
                                  ? details.inventors
                                      .map((inv) => inv.name)
                                      .slice(0, 1)
                                      .join(", ") +
                                    (details.inventors.length > 1 ? "..." : "")
                                  : details.inventor || "N/A"}
                              </div>
                            </div>
                          )}

                          {/* Assignee */}
                          {(details.assignees?.length > 0 ||
                            details.assignee) && (
                            <div className="details-meta-item">
                              <div
                                className="details-meta-label"
                                style={{ fontSize: "0.7rem" }}
                              >
                                Assignee
                              </div>
                              <div
                                className="details-meta-value"
                                style={{ fontSize: "0.8rem" }}
                              >
                                {details.assignees?.[0] ||
                                  details.assignee ||
                                  "N/A"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Additional Results */}
                {/* {getAdditionalResults().length > 0 && (
                  <div className="additional-section">
                    <div className="additional-header">
                      <h3 className="additional-title">
                        Additional Search Results
                      </h3>
                      <span className="additional-count">
                        {getAdditionalResults().length}
                      </span>
                    </div>
                    <div className="additional-grid">
                      {getAdditionalResults().map((result, index) => {
                        const isScholar = result.is_scholar;
                        const displayId = isScholar
                          ? "Scholar Result"
                          : extractPatentNumber(result.patent_id);

                        return (
                          <div
                            key={`additional-${index}`}
                            className="additional-card"
                            onClick={() =>
                              !isScholar && handleSelectPatent(result.patent_id)
                            }
                          >
                            <div className="additional-card-id">
                              {isScholar ? (
                                <a
                                  href={result.scholar_link || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {displayId} <Icons.ExternalLink />
                                </a>
                              ) : (
                                displayId
                              )}
                            </div>
                            <div className="additional-card-title">
                              {result.title || "No title"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )} */}

                {/* Search Queries */}
                {/* {resultData.searchQueries &&
                  resultData.searchQueries.length > 0 && (
                    <div className="queries-section">
                      <h3 className="queries-title">
                        Search Strategy & Queries Used
                      </h3>
                      {(() => {
                        const groupedQueries = resultData.searchQueries.reduce(
                          (acc, query) => {
                            const step = query.step || "default";
                            if (!acc[step]) acc[step] = [];
                            acc[step].push(query);
                            return acc;
                          },
                          {}
                        );

                        return Object.entries(groupedQueries).map(
                          ([step, queries]) => (
                            <div key={step} className="query-group">
                              <h4 className="query-group-title">{step}</h4>
                              {queries.map((queryItem, index) => (
                                <div key={index} className="query-item">
                                  <span className="query-type-badge">
                                    {queryItem.type}
                                  </span>
                                  <code className="query-text">
                                    {queryItem.query}
                                  </code>
                                </div>
                              ))}
                            </div>
                          )
                        );
                      })()}
                    </div>
                  )} */}
              </div>
            )}

            {/* Details View */}
            {!loading &&
              resultData &&
              viewMode === "details" &&
              selectedPatent && (
                <div className="details-view">
                  <button className="details-back" onClick={handleBackToList}>
                    <Icons.ArrowLeft /> Back to Results
                  </button>

                  {/* Patent Header */}
                  <div className="details-header">
                    <div className="details-header-top">
                      {selectedPatent.rank && (
                        <span className="details-rank">
                          Rank {selectedPatent.rank}
                        </span>
                      )}
                      <a
                        href={`https://patents.google.com/patent/${extractPatentNumber(
                          selectedPatentId
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="details-id-link"
                      >
                        {extractPatentNumber(selectedPatentId)}{" "}
                        <Icons.ExternalLink />
                      </a>
                    </div>

                    <h1 className="details-title">
                      {selectedPatent.details?.title ||
                        selectedPatent.title ||
                        "No title available"}
                    </h1>

                    {selectedPatent.foundSummary && (
                      <div className="details-coverage">
                        <div className="details-coverage-label">
                          Coverage Identified
                        </div>
                        <div className="details-coverage-text">
                          {selectedPatent.foundSummary}
                        </div>
                      </div>
                    )}

                    <div className="details-meta-grid">
                      {(selectedPatent.details?.filing_date ||
                        selectedPatent.filing_date) && (
                        <div className="details-meta-item">
                          <div className="details-meta-label">Filing Date</div>
                          <div className="details-meta-value">
                            {selectedPatent.details?.filing_date ||
                              selectedPatent.filing_date}
                          </div>
                        </div>
                      )}
                      {(selectedPatent.details?.inventors ||
                        selectedPatent.details?.inventor ||
                        selectedPatent.inventor) && (
                        <div className="details-meta-item">
                          <div className="details-meta-label">Inventor</div>
                          <div className="details-meta-value">
                            {Array.isArray(selectedPatent.details?.inventors)
                              ? selectedPatent.details.inventors
                                  .map((inv) => inv.name)
                                  .join(", ")
                              : selectedPatent.details?.inventor ||
                                selectedPatent.inventor ||
                                "N/A"}
                          </div>
                        </div>
                      )}
                      {(selectedPatent.details?.assignees?.length > 0 ||
                        selectedPatent.details?.assignee ||
                        selectedPatent.assignee) && (
                        <div className="details-meta-item">
                          <div className="details-meta-label">Assignee</div>
                          <div className="details-meta-value">
                            {selectedPatent.details?.assignees?.join(", ") ||
                              selectedPatent.details?.assignee ||
                              selectedPatent.assignee ||
                              "N/A"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Abstract Section */}
                  <div className="details-section">
                    <div className="details-section-header">
                      <h3 className="details-section-title">
                        <span className="details-section-icon">📄</span>
                        Abstract
                      </h3>
                      <button
                        className="toggle-button"
                        onClick={() => setAbstractExpanded(!abstractExpanded)}
                      >
                        {abstractExpanded ? "Show Less" : "Show More"}
                      </button>
                    </div>
                    <p className="details-abstract">
                      {abstractExpanded
                        ? selectedPatent.details?.abstract ||
                          selectedPatent.details?.snippet ||
                          selectedPatent.abstract ||
                          selectedPatent.snippet ||
                          "No abstract available"
                        : truncateToWords(
                            selectedPatent.details?.abstract ||
                              selectedPatent.details?.snippet ||
                              selectedPatent.abstract ||
                              selectedPatent.snippet ||
                              "No abstract available",
                            50
                          )}
                    </p>
                  </div>

                  {/* Matrix Section */}
                  {selectedPatent.parsedMatrix?.headers?.length > 0 && (
                    <div className="details-section">
                      <div className="details-section-header">
                        <h3 className="details-section-title">
                          <span className="details-section-icon">
                            {Icons.Grid()}
                          </span>
                          Key Features Comparison Matrix
                        </h3>
                      </div>
                      <TableComponent tableData={selectedPatent.parsedMatrix} />
                    </div>
                  )}

                  {/* Excerpts Section */}
                  {selectedPatent.excerpts && (
                    <div className="details-section">
                      <div className="details-section-header">
                        <h3 className="details-section-title">
                          <span className="details-section-icon">
                            {Icons.Quote()}
                          </span>
                          Relevant Excerpts
                        </h3>
                      </div>
                      <div className="excerpts-content formatted">
                        {formatExcerptsForDisplay(selectedPatent.excerpts)}
                      </div>
                    </div>
                  )}

                  {/* Retry Button if needed */}
                  {!selectedPatent.isAdditional &&
                    (!selectedPatent.parsedMatrix?.headers?.length ||
                      !selectedPatent.excerpts) && (
                      <div className="details-section">
                        <button
                          className="action-button primary"
                          onClick={() => handleRetryPatent(selectedPatentId)}
                          disabled={retryingPatents[selectedPatentId]}
                          style={{ width: "100%" }}
                        >
                          {retryingPatents[selectedPatentId]
                            ? "Retrying Analysis..."
                            : "Retry Detailed Analysis"}
                        </button>
                      </div>
                    )}

                  {/* Download Section */}
                  {!selectedPatent.isAdditional && (
                    <div className="download-section">
                      <button
                        className="download-button"
                        onClick={handleDownloadWord}
                      >
                        <Icons.Word />
                        Download Word (.doc)
                      </button>
                      <button
                        className="download-button"
                        onClick={handleDownloadPDF}
                      >
                        <Icons.PDF />
                        Download PDF
                      </button>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== STYLES ====================

const styles = `
:root {
  --color-bg: #f8f7f4;
  --color-surface: #ffffff;
  --color-surface-alt: #f0efe9;
  --color-border: #e4e2db;
  --color-border-dark: #d1cfc6;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #5a5a5a;
  --color-text-muted: #8a8a8a;
  --color-accent: #ff6c2f;
  --color-accent-hover: #f74b01ff;
  --color-accent-light: #ff6d2f9d;
  --color-success: #059669;
  --color-success-light: #d1fae5;
  --color-warning: #d97706;
  --color-warning-light: #fef3c7;
  --color-error: #dc2626;
  --color-error-light: #fee2e2;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
}

.app-container {
  display: flex;
  flex-direction: column;
}

/* ========== HEADER ========== */
.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 10px 30px 5px 30px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-content h4 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.header-content p {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

/* ========== MAIN LAYOUT ========== */
.main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 30% 1fr;
  max-height: 75vh;
  margin-top: 30px;
}

/* ========== LEFT PANEL ========== */
.left-panel {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height:72vh;
}

.search-section {
  padding: 24px;
  border-bottom: 1px solid var(--color-border);
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.search-textarea {
  width: 100%;
  min-height: 220px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-surface);
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: none;
}

.search-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.search-textarea::placeholder {
  color: var(--color-text-muted);
}

.search-button {
  width: 100%;
  margin-top: 16px;
  padding: 14px 24px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;
}

.search-button:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.search-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ========== RECENT SEARCHES ========== */
.recent-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.recent-header {
  padding: 20px 24px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.recent-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-button {
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.refresh-button:hover {
  background: var(--color-surface-alt);
  color: var(--color-accent);
}

.recent-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  padding: 4px 10px;
  border-radius: 20px;
}

.recent-filter {
  padding: 0 24px 16px;
}

.filter-input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  background: var(--color-surface-alt);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a8a8a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 12px center;
  transition: all 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-accent);
  background-color: var(--color-surface);
}

.recent-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 24px;
}

.recent-item {
  padding: 14px 16px;
  margin-bottom: 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.recent-item:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-border);
}

.recent-item.active {
  background: var(--color-accent-light);
  border-color: var(--color-accent);
}

.recent-item-content {
  flex: 1;
  min-width: 0;
}

.recent-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recent-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.recent-item-date,
.recent-item-results {
  display: flex;
  align-items: center;
  gap: 4px;
}

.delete-button {
  padding: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
}

.recent-item:hover .delete-button {
  opacity: 1;
}

.delete-button:hover {
  background: var(--color-error-light);
  color: var(--color-error);
}

.empty-recent {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-muted);
}

.empty-recent-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-recent p {
  font-size: 0.875rem;
}

.loading-spinner-small {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

/* ========== RIGHT PANEL ========== */
.right-panel {
  background: var(--color-bg);
  overflow-y: auto;
  position: relative;
  max-height:72vh;
}

/* Empty State */
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
}

.empty-state-icon {
  width: 80px;
  height: 80px;
  background: var(--color-surface);
  border: 2px dashed var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 24px;
  color: var(--color-text-muted);
}

.empty-state h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  max-width: 320px;
}

/* Loading State */
.loading-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.loading-spinner {
  width: 56px;
  height: 56px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-message {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.loading-submessage {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 24px;
}

.progress-container {
  width: 100%;
  max-width: 400px;
}

.progress-bar {
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), #7c3aed);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 12px;
}

/* Results List View */
.results-view {
  padding: 24px;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.results-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.results-actions {
  display: flex;
  gap: 12px;
}

.action-button {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.action-button:hover {
  border-color: var(--color-border-dark);
  background: var(--color-surface-alt);
}

.action-button.primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.action-button.primary:hover {
  background: var(--color-accent-hover);
}

/* Key Features Box */
.key-features-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 24px;
}

.key-features-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.key-features-icon {
  width: 28px;
  height: 28px;
  background: var(--color-warning-light);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-warning);
  font-size: 14px;
}

.key-features-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.key-features-content {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}

/* Results Grid */
.results-grid {
  display: grid;
  gap: 16px;
}

.result-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.result-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-rank {
  background: var(--color-accent);
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.result-id {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
}

.result-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-coverage {
  font-size: 0.8125rem;
  color: var(--color-success);
  background: var(--color-success-light);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.result-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Additional Results Section */
.additional-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid var(--color-border);
}

.additional-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.additional-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.additional-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  padding: 4px 10px;
  border-radius: 20px;
}

.additional-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.additional-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.additional-card:hover {
  border-color: var(--color-border-dark);
  background: var(--color-surface-alt);
}

.additional-card-id {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
  margin-bottom: 6px;
}

.additional-card-title {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ========== DETAILS VIEW ========== */
.details-view {
  padding: 24px;
}

.details-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 24px;
}

.details-back:hover {
  border-color: var(--color-border-dark);
  background: var(--color-surface-alt);
}

.details-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
}

.details-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.details-rank {
  background: var(--color-accent);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.details-id-link {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.details-id-link:hover {
  text-decoration: underline;
}

.details-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 16px;
  line-height: 1.4;
}

.details-coverage {
  background: var(--color-success-light);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-md);
  padding: 14px 18px;
  margin-bottom: 20px;
}

.details-coverage-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-success);
  margin-bottom: 4px;
}

.details-coverage-text {
  font-size: 0.9375rem;
  color: var(--color-text-primary);
}

.details-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.details-meta-item {
  padding: 12px 16px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
}

.details-meta-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.details-meta-value {
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

/* Abstract Section */
.details-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
}

.details-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.details-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.details-section-icon {
  width: 28px;
  height: 28px;
  background: var(--color-accent-light);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  font-size: 14px;
}

.details-abstract {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.toggle-button {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-button:hover {
  background: var(--color-surface-alt);
}

/* Matrix Table */
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.matrix-table th,
.matrix-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.matrix-table th {
  background: var(--color-surface-alt);
  font-weight: 600;
  color: var(--color-text-primary);
}

.matrix-table td {
  color: var(--color-text-secondary);
}

.matrix-table tr:last-child td {
  border-bottom: none;
}

.overlap-considerable {
  background: var(--color-success-light);
  color: var(--color-success);
  font-weight: 600;
}

.overlap-partial {
  background: var(--color-warning-light);
  color: var(--color-warning);
  font-weight: 600;
}

.overlap-none {
  color: var(--color-text-muted);
}

/* Excerpts */
.excerpts-content {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
  background: var(--color-surface-alt);
  padding: 16px;
  border-radius: var(--radius-sm);
  max-height: 400px;
  overflow-y: auto;
}

/* Download Actions */
.download-section {
  display: flex;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
  margin-top: 24px;
}

.download-button {
  flex: 1;
  padding: 14px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;
}

.download-button:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.download-button svg {
  width: 18px;
  height: 18px;
}

/* Search Queries Section */
.queries-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid var(--color-border);
}

.queries-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 20px;
}

.query-group {
  margin-bottom: 20px;
}

.query-group-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
  padding-left: 12px;
  border-left: 3px solid var(--color-accent);
}

.query-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.query-type-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.query-text {
  font-size: 0.8125rem;
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
  color: var(--color-text-secondary);
}

/* Error State */
.error-container {
  background: var(--color-error-light);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  margin-bottom: 24px;
  color: var(--color-error);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-close {
  background: none;
  border: none;
  color: var(--color-error);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0 4px;
}

/* Responsive */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  
  .left-panel {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    max-height: 50vh;
  }
}

/* Download Dropdown */
.download-dropdown {
  position: relative;
  display: inline-block;
}

.btn-download {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-download:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.download-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 160px;
  display: none;
}

.download-menu.visible {
  display: block;
}

.download-menu button {
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  transition: background 0.15s;
}

.download-menu button:hover {
  background: var(--color-surface-alt);
}

.download-menu button:first-child {
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.download-menu button:last-child {
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

/* Formatted Key Features - Enhanced */
.key-features-content.formatted {
  white-space: normal;
}

.key-feature-header {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 20px 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.key-feature-header:first-child {
  margin-top: 0;
}

.key-feature-list {
  list-style: none;
  margin: 12px 0;
  padding: 0;
}

.key-feature-item-numbered,
.key-feature-subitem {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  line-height: 1.6;
}

.key-feature-item-numbered {
  padding: 12px 16px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
}

.key-feature-subitem {
  padding: 10px 16px 10px 32px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  margin-left: 20px;
}

.key-feature-item-numbered .item-number,
.key-feature-subitem .item-number {
  font-weight: 700;
  color: var(--color-accent);
  min-width: 28px;
  flex-shrink: 0;
}

.key-feature-subitem .item-number {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.key-feature-item-numbered .item-text,
.key-feature-subitem .item-text {
  flex: 1;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.key-feature-item-numbered .item-text {
  color: var(--color-text-primary);
  font-weight: 500;
}

.key-feature-item {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
  padding-left: 20px;
  position: relative;
}

.key-feature-item::before {
  content: "•";
  position: absolute;
  left: 6px;
  color: var(--color-accent);
}

.key-feature-paragraph {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 12px 0;
}

/* Formatted Excerpts - Enhanced */
.excerpts-content.formatted {
  white-space: normal;
  font-family: inherit;
  background: transparent;
  padding: 0;
}

.excerpt-paragraph {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 12px 0;
  padding: 12px 16px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
}

.excerpt-quote {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  font-style: italic;
  border-left: 3px solid var(--color-accent);
  padding: 12px 16px;
  margin: 16px 0;
  background: var(--color-surface);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.excerpt-claim {
  font-size: 0.8125rem;
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
  background: var(--color-surface);
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  margin: 12px 0;
  color: var(--color-text-secondary);
}

.excerpt-numbered-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 12px 0;
  padding: 14px 18px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
}

.excerpt-numbered-item.sub {
  margin-left: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border-dark);
}

.excerpt-number {
  font-weight: 700;
  color: var(--color-accent);
  min-width: 32px;
  flex-shrink: 0;
  font-size: 0.875rem;
}

.excerpt-numbered-item.sub .excerpt-number {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.excerpt-text {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* Coverage text formatting */
.details-coverage-text {
  font-size: 0.9375rem;
  color: var(--color-text-primary);
  line-height: 1.7;
  white-space: pre-line;
}

/* Container */
.key-features-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
}

/* Common Row Style */
.kf-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.5;
  padding: 4px 0;
}

/* LEVEL 1: Main Items (1., 2.) */
.kf-row.level-1 {
  background: var(--color-surface-alt); /* Light gray background */
  padding: 10px;
  border-radius: 6px;
  font-weight: 500;
  border-left: 4px solid var(--color-accent); /* Orange border */
  margin-top: 8px;
}
.kf-row.level-1 .kf-num {
  color: var(--color-accent);
  font-weight: 700;
}

/* LEVEL 2: Sub Items (1.1, 1.2) */
.kf-row.level-2 {
  margin-left: 20px; /* Indent */
  padding-left: 12px;
 
}

/* LEVEL 3: Deep Sub Items (1.4.1, 1.5.1) */
.kf-row.level-3 {
  margin-left: 45px; /* Deep Indent */
  background: #fff;
  padding: 6px 10px;
  border-radius: 4px;
}
.kf-row.level-3 .kf-num {
  font-size: 0.85em;
  color: var(--color-text-muted);
}

/* General Number Styling */
.kf-num {
  min-width: 40px;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* Headers */
.kf-header {
  color: var(--color-text-primary);
  font-weight: 700;
  margin: 16px 0 8px 0;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 5px;
}

/* Text */
.kf-text, .kf-paragraph {
  color: var(--color-text-secondary);
}

/* ========== RESPONSIVE ADJUSTMENTS ========== */

/* Tablet & Smaller Desktop (< 1024px) */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
    max-height: none; /* Remove fixed height constraint */
    margin-top: 15px;
  }
  
  .left-panel {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    max-height: none; /* Allow natural scrolling */
  }

  .right-panel {
    max-height: none;
  }
}

/* Mobile (< 768px) */
@media (max-width: 768px) {
  .app-header {
    padding: 12px 16px;
  }

  /* Reduce panel paddings for mobile */
  .search-section, 
  .recent-header, 
  .recent-filter,
  .results-view, 
  .details-view {
    padding: 16px;
  }

  /* Stack Results Header */
  .results-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .results-actions {
    width: 100%;
    justify-content: space-between;
  }

  /* Details view adjustments */
  .details-header {
    padding: 16px;
  }

  .details-title {
    font-size: 1.15rem;
  }

  .details-header-top {
    flex-direction: column;
    gap: 10px;
  }

  /* Stack Meta Items */
  .details-meta-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  /* Enable Horizontal Scrolling for Tables */
  .details-section {
    padding: 16px;
    overflow-x: auto;
  }

  .matrix-table {
    min-width: 600px; /* Forces table to scroll instead of squash */
  }

  /* Stack Download Buttons */
  .download-section {
    flex-direction: column;
  }

  .download-button {
    width: 100%;
  }

  /* Adjust Text Indentations for Mobile */
  .kf-row.level-2 { margin-left: 10px; }
  .kf-row.level-3 { margin-left: 20px; }
  .excerpt-numbered-item.sub { margin-left: 12px; }
}

/* Small Mobile (< 480px) */
@media (max-width: 480px) {
  .header-content h4 {
    font-size: 1.1rem;
  }
  
  .header-content p {
    font-size: 0.8rem;
  }

  /* Stack Header Action Buttons */
  .results-actions {
    flex-direction: column;
  }

  .results-actions > * {
    width: 100%;
  }

  .btn-download, .action-button {
    justify-content: center;
  }

  .download-dropdown {
    width: 100%;
  }

  /* Scale down cards */
  .result-card {
    padding: 16px;
  }
}

`;

export default PriorArtSearch;
