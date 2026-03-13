import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import PriorArtSearch from "../models/Priorartsearch.js";
import auth from "../middleware/auth.js"; // Adjust path as needed

dotenv.config({ quiet: true });

const router = express.Router();

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || "gemini-2.0-flash";

// Validate API keys on startup
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in environment variables!");
}
if (!SERPAPI_KEY) {
  console.error("SERPAPI_KEY is not set in environment variables!");
}

// Initialize Gemini
let genAI, geminiModel, geminiFlashModel;

try {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  geminiFlashModel = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });
  console.log("Gemini AI initialized successfully");
} catch (error) {
  console.error("Failed to initialize Gemini AI:", error.message);
}

const generationConfig = {
  temperature: 0.8,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 20000,
  responseMimeType: "text/plain",
};

// In-memory job queue (for tracking processing status)
const jobQueue = new Map();

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

// Health check endpoint (public)
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    geminiConfigured: !!GEMINI_API_KEY,
    serpApiConfigured: !!SERPAPI_KEY,
    geminiModel: GEMINI_MODEL,
    activeJobs: jobQueue.size,
  });
});

// Get recent searches for logged-in user
router.get("/recent", auth, async (req, res) => {
  try {
    const searches = await PriorArtSearch.find({
      user: req.user._id,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("inventionText keyFeatures comparisons createdAt status")
      .lean();

    const formatted = searches.map((search) => ({
      id: search._id,
      query: search.inventionText?.substring(0, 150),
      fullQuery: search.inventionText,
      timestamp: search.createdAt,
      resultsCount: search.comparisons?.length || 0,
      keyFeatures: search.keyFeatures,
      status: search.status,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching recent searches:", error);
    res.status(500).json({ error: "Failed to fetch recent searches" });
  }
});

// Get full search details by ID
router.get("/search/:searchId", auth, async (req, res) => {
  try {
    const search = await PriorArtSearch.findOne({
      _id: req.params.searchId,
      user: req.user._id,
    }).lean();

    if (!search) {
      return res.status(404).json({ error: "Search not found" });
    }

    res.json({
      id: search._id,
      keyFeatures: search.keyFeatures,
      comparisons: search.comparisons,
      patentResults: search.patentResults,
      searchQueries: search.searchQueries,
      inventionText: search.inventionText,
      createdAt: search.createdAt,
    });
  } catch (error) {
    console.error("Error fetching search details:", error);
    res.status(500).json({ error: "Failed to fetch search details" });
  }
});

// Delete a search
router.delete("/search/:searchId", auth, async (req, res) => {
  try {
    const result = await PriorArtSearch.findOneAndDelete({
      _id: req.params.searchId,
      user: req.user._id,
    });

    if (!result) {
      return res.status(404).json({ error: "Search not found" });
    }

    res.json({ success: true, message: "Search deleted successfully" });
  } catch (error) {
    console.error("Error deleting search:", error);
    res.status(500).json({ error: "Failed to delete search" });
  }
});

// 1. Start Analysis Job (authed)
router.post("/process-invention", auth, async (req, res) => {
  try {
    const { inventionText, keyFeatures } = req.body;
    if (!inventionText) {
      return res.status(400).json({ error: "inventionText is required" });
    }

    // Check if API keys are configured
    if (!GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY is not configured on server" });
    }
    if (!SERPAPI_KEY) {
      return res
        .status(500)
        .json({ error: "SERPAPI_KEY is not configured on server" });
    }

    const jobId = uuidv4();

    // Create initial database record
    const searchRecord = await PriorArtSearch.create({
      user: req.user._id,
      inventionText,
      jobId,
      status: "processing",
    });

    // Set up job queue entry
    jobQueue.set(jobId, {
      status: "processing",
      progress: 0,
      startTime: Date.now(),
      result: null,
      error: null,
      errorDetails: null,
      userId: req.user._id,
      searchRecordId: searchRecord._id,
    });

    // Run in background (do not await)
    processInventionAsync(
      jobId,
      inventionText,
      keyFeatures,
      req.user._id,
      searchRecord._id,
    );

    return res.status(202).json({
      jobId,
      searchId: searchRecord._id,
      status: "processing",
      message: "Invention analysis started.",
    });
  } catch (err) {
    console.error("Error initiating analysis:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Check Status
router.get("/process-invention/status/:jobId", auth, (req, res) => {
  const { jobId } = req.params;
  if (!jobQueue.has(jobId)) {
    return res.status(404).json({ error: "Job not found" });
  }

  const job = jobQueue.get(jobId);

  // Verify the job belongs to the user
  if (job.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  return res.json({
    jobId,
    status: job.status,
    progress: job.progress,
    elapsedTime: Date.now() - job.startTime,
    error: job.error,
    errorDetails: job.errorDetails,
    searchId: job.searchRecordId,
  });
});

// 3. Get Result
router.get("/process-invention/result/:jobId", auth, async (req, res) => {
  const { jobId } = req.params;

  // First check in-memory queue
  if (jobQueue.has(jobId)) {
    const job = jobQueue.get(jobId);

    // Verify the job belongs to the user
    if (job.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (job.status !== "completed") {
      return res.status(400).json({
        error: "Job is not yet completed",
        status: job.status,
        jobError: job.error,
        errorDetails: job.errorDetails,
      });
    }

    return res.json(job.result);
  }

  // If not in queue, check database
  try {
    const search = await PriorArtSearch.findOne({
      jobId,
      user: req.user._id,
    }).lean();

    if (!search) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (search.status !== "completed") {
      return res.status(400).json({
        error: "Job is not yet completed",
        status: search.status,
      });
    }

    return res.json({
      keyFeatures: search.keyFeatures,
      comparisons: search.comparisons,
      patentResults: search.patentResults,
      searchQueries: search.searchQueries,
    });
  } catch (error) {
    console.error("Error fetching result:", error);
    return res.status(500).json({ error: "Failed to fetch result" });
  }
});

// 4. Retry Comparison (authed)
router.post("/retry-patent-comparison", auth, async (req, res) => {
  try {
    const { patentId, keyFeatures } = req.body;
    if (!patentId || !keyFeatures) {
      return res
        .status(400)
        .json({ success: false, error: "Required fields missing" });
    }

    const details = await getPatentDetails(patentId);
    const patentDescription = details.fullDescription || "";

    if (!patentDescription) {
      return res
        .status(400)
        .json({ success: false, error: "Could not retrieve description" });
    }

    const prompt3 = generatePrompt3(keyFeatures, patentDescription);
    const geminiResponse3 = await runGeminiPrompt(prompt3);
    const parsed = parsePrompt3Output(geminiResponse3, patentId);

    return res.json({
      success: true,
      matrix: parsed.matrix,
      excerpts: parsed.excerpts,
    });
  } catch (error) {
    console.error("[Retry] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================================================
   CORE LOGIC & BACKGROUND PROCESSING
   ========================================================================== */

async function processInventionAsync(
  jobId,
  inventionText,
  providedKeyFeatures = null,
  userId,
  searchRecordId,
) {
  const job = jobQueue.get(jobId);
  const startTime = Date.now();
  console.log(`[${jobId}] Starting invention analysis for user ${userId}...`);
  const searchQueriesLog = [];

  try {
    // --- STEP 1: Key Features ---
    console.log(`[${jobId}] Step 1: Generating key features...`);
    job.progress = 10;
    let keyFeatures;
    if (providedKeyFeatures && providedKeyFeatures.trim() !== "") {
      keyFeatures = providedKeyFeatures
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      console.log(`[${jobId}] Using provided key features`);
    } else {
      const keyFeaturesPrompt = generateKeyFeaturesPrompt(inventionText);
      console.log(
        `[${jobId}] Calling Gemini (${GEMINI_MODEL}) for key features...`,
      );
      const keyFeaturesResponse = await runGeminiPrompt(keyFeaturesPrompt);
      keyFeatures = keyFeaturesResponse
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      console.log(`[${jobId}] Key features generated successfully`);
    }

    // --- STEP 2: Generate Queries ---
    console.log(`[${jobId}] Step 2: Generating search queries...`);
    job.progress = 25;
    const prompt1 = generatePrompt1(inventionText);
    const prompt1Variation = generatePrompt1(
      inventionText +
        `ADDITIONAL SEARCH STRATEGY FOR THIS VARIATION:
Consider also prior-art references that tackle the same underlying technical problem or stated drawbacks, even if they employ different architectures, materials, or control strategies. Broaden synonyms accordingly to surface functionally equivalent solutions and legacy terminology.

Focus on finding prior art that solves the SAME UNDERLYING PROBLEM using DIFFERENT APPROACHES:

1. PROBLEM-ORIENTED TERMS: What technical problem, limitation, or drawback does this invention address? Include terms like: improve*, enhance*, overcome*, reduce*, eliminat*, prevent*, optimi*, efficien*

2. FUNCTIONAL EQUIVALENTS: What other technologies or methods achieve the same goal? Consider alternative:
   - Materials (metal vs polymer vs ceramic vs composite)
   - Mechanisms (mechanical vs electronic vs hydraulic vs pneumatic)  
   - Sensing methods (optical vs acoustic vs magnetic vs thermal)
   - Processing approaches (analog vs digital vs hybrid)

3. LEGACY/ALTERNATIVE TERMINOLOGY: Include older industry terms, academic terminology, and synonyms from adjacent technical fields that describe the same concepts differently

4. BROADER APPLICATION AREAS: Where else might similar solutions apply? Medical, industrial, automotive, aerospace, consumer electronics often share similar technical challenges

Generate queries that would surface novelty-defeating prior art even if the implementation approach differs from the invention, as long as it addresses the same technical challenge or achieves the same functional result.`,
    );
    const prompt1Alt = generatePrompt1_Alt(inventionText);

    const [geminiResponse1, geminiResponse1Var, geminiResponse1Alt] =
      await Promise.all([
        runGeminiPrompt(prompt1),
        runGeminiPrompt(prompt1Variation),
        runGeminiPrompt(prompt1Alt),
      ]);

    const queries = [
      ...parseQueries(geminiResponse1),
      ...parseQueries(geminiResponse1Var),
      ...parseQueries(geminiResponse1Alt),
    ].filter((q) => q.trim() !== "");

    console.log(`[${jobId}] Generated ${queries.length} search queries`);

    // Log queries
    queries.forEach((q) =>
      searchQueriesLog.push({ type: "Initial Search", query: q }),
    );

    // --- STEP 3: Fetch Patents ---
    console.log(`[${jobId}] Step 3: Searching patents...`);
    job.progress = 40;
    const settledResults = await Promise.allSettled(
      queries.map((q) => searchPatents(q, 20)), // All queries
    );

    let patentResultsOnly = settledResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .flat();

    // Deduplicate
    const patentMap = new Map();
    patentResultsOnly.forEach((r) => {
      if (r.patent_id) patentMap.set(r.patent_id, r);
    });
    const uniqueResults = Array.from(patentMap.values());
    console.log(`[${jobId}] Found ${uniqueResults.length} unique patents`);

    // --- STEP 4: Select Top 30 ---
    console.log(`[${jobId}] Step 4: Selecting top 30 patents...`);
    job.progress = 50;
    const resultsText = buildResultsText(uniqueResults);
    const promptTop30 = generatePrompt_Top30Selection(
      inventionText,
      resultsText,
    );
    const top30Response = await runGeminiWithTemp(promptTop30, 0.2);
    const top30Ids = parseTop30Selection(top30Response);
    console.log(
      `[${jobId}] Selected ${top30Ids.length} patents for detailed analysis`,
    );

    // Fetch Details for Top 30
    console.log(`[${jobId}] Fetching patent details...`);
    job.progress = 55;
    const top30Details = await Promise.all(
      top30Ids.map(async (id) => {
        const d = await getPatentDetails(id);
        return {
          patentId: id,
          details: d,
          description: d.fullDescription || "",
        };
      }),
    );

    // --- STEP 5: Select Final 5 ---
    console.log(`[${jobId}] Step 5: Selecting final 5 patents...`);
    job.progress = 60;
    const partials = top30Details
      .map(
        (p) =>
          `Patent ID: ${p.patentId}\nTitle: ${
            p.details.title || "N/A"
          }\nAssignee: ${p.details.assignee || "N/A"}\nFiling Date: ${
            p.details.filing_date || "N/A"
          }\nPartial Description (40K chars): ${(
            p.description ||
            p.details.abstract ||
            ""
          ).substring(0, 40000)}`,
      )
      .join("\n\n---\n\n");
    const promptFinal5 = generatePrompt_Final5Selection(
      inventionText,
      partials,
    );
    const final5Response = await runGeminiPrompt(promptFinal5);
    const final5Ids = parseSelectionIds(final5Response);
    console.log(`[${jobId}] Final patents: ${final5Ids.join(", ")}`);

    // --- STEP 6: Matrices ---
    console.log(`[${jobId}] Step 6: Generating comparison matrices...`);
    job.progress = 75;
    const comparisons = await Promise.all(
      final5Ids.map(async (id) => {
        const data = top30Details.find((t) => t.patentId === id) || {
          description: "",
        };
        const prompt3 = generatePrompt3(keyFeatures, data.description);
        const res = await runGeminiPrompt(prompt3);
        const parsed = parsePrompt3Output(res, id);
        return {
          patentId: id,
          matrix: parsed.matrix,
          excerpts: parsed.excerpts,
          details: data.details,
        };
      }),
    );

    // --- STEP 7: Ranking ---
    console.log(`[${jobId}] Step 7: Ranking patents...`);
    job.progress = 90;
    const validComparisons = comparisons.filter((c) => c.matrix);
    if (validComparisons.length > 0) {
      const prompt4 = generatePrompt4(
        validComparisons.map((c) => c.matrix),
        validComparisons.map((c) => c.patentId),
      );
      const rankRes = await runGeminiPrompt(prompt4, true);
      const rankings = parsePrompt4Output(rankRes);

      // Apply rankings to comparisons
      comparisons.forEach((comp) => {
        const r = rankings.find((x) => x.patentId === comp.patentId);
        if (r) {
          comp.rank = r.rank;
          comp.foundSummary = r.foundSummary;
          comp.metrics = r.metrics;
        }
      });
      comparisons.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    }

    // --- STEP 7: Ranking ---
    // ... existing ranking code ...

    // --- STEP 8: Citation Enhancement ---
    console.log(`[${jobId}] Step 8: Citation enhancement...`);
    job.progress = 80;

    const citationResult = await processCitationEnhancement(
      comparisons,
      keyFeatures,
      inventionText,
      top30Details.map((d) => ({
        patentId: d.patentId,
        details: d.details,
        description: d.description,
      })),
      uniqueResults,
      jobId,
      searchQueriesLog,
    );

    // Use enhanced comparisons
    const finalComparisons = citationResult.enhancedComparisons;

    // Add additional citations to results
    const finalPatentResults = [
      ...uniqueResults,
      ...citationResult.additionalCitations.filter(
        (c) => !uniqueResults.some((r) => r.patent_id === c.patent_id),
      ),
    ];

    // Final Assembly
    job.progress = 95;
    const result = {
      keyFeatures,
      queries,
      patentResults: finalPatentResults,
      comparisons: finalComparisons, // Now has 10 patents
      searchQueries: searchQueriesLog,
    };

    // Update job queue
    job.progress = 100;
    job.status = "completed";
    job.result = result;

    // Save to database
    await PriorArtSearch.findByIdAndUpdate(searchRecordId, {
      status: "completed",
      keyFeatures,
      comparisons,
      patentResults: uniqueResults,
      searchQueries: searchQueriesLog,
      // processingTime,
    });

    console.log(`[${jobId}] ✅ Results saved to database`);

    // Cleanup job queue after 1 hour
    setTimeout(() => {
      if (jobQueue.has(jobId)) jobQueue.delete(jobId);
    }, 3600000);
  } catch (error) {
    console.error(`[${jobId}] ❌ Error at progress ${job.progress}:`, error);
    job.status = "failed";
    job.error = error.message;
    job.errorDetails = {
      step: job.progress,
      stack: error.stack,
      name: error.name,
    };

    // Update database with error
    await PriorArtSearch.findByIdAndUpdate(searchRecordId, {
      status: "failed",
      error: error.message,
    });
  }
}

/* ==========================================================================
   HELPER FUNCTIONS (GEMINI & SERPAPI)
   ========================================================================== */

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractPatentNumber(patentId) {
  if (!patentId) return "";
  return patentId.replace(/^patent\//, "").replace(/\/en$/, "");
}

async function runGeminiPrompt(prompt, useFlashModel = false) {
  try {
    if (!genAI) {
      throw new Error("Gemini AI is not initialized. Check GEMINI_API_KEY.");
    }
    const model = useFlashModel ? geminiFlashModel : geminiModel;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Error:", error.message);
    console.error("Gemini Error Details:", error);
    throw new Error(`Gemini API Error: ${error.message}`);
  }
}

async function runGeminiWithTemp(prompt, temperature) {
  try {
    if (!genAI) {
      throw new Error("Gemini AI is not initialized. Check GEMINI_API_KEY.");
    }
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { ...generationConfig, temperature },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Error (with temp):", error.message);
    throw new Error(`Gemini API Error: ${error.message}`);
  }
}

async function searchPatents(query, num = 20) {
  try {
    if (!SERPAPI_KEY) {
      throw new Error("SERPAPI_KEY is not configured");
    }
    const url = "https://serpapi.com/search";
    const params = {
      engine: "google_patents",
      q: query,
      num,
      api_key: SERPAPI_KEY,
      tbm: "patents",
    };
    const response = await axios.get(url, { params });
    return (response.data.organic_results || []).map((item) => ({
      patent_id: item.patent_id,
      title: item.title,
      snippet: item.snippet,
      assignee: item.assignee,
      filing_date: item.filing_date,
      patent_link: item.patent_link,
    }));
  } catch (error) {
    console.error("SerpApi Error:", error.message);
    return [];
  }
}

async function getPatentDetails(patentId) {
  try {
    if (!SERPAPI_KEY) {
      throw new Error("SERPAPI_KEY is not configured");
    }

    const url = "https://serpapi.com/search";
    const params = {
      engine: "google_patents_details",
      patent_id: patentId,
      api_key: SERPAPI_KEY,
    };

    const response = await axios.get(url, { params, timeout: 120000 });
    const patentData = response.data;

    let fullDescription = "";
    const abstract = patentData.abstract || "";
    const descriptionLink = patentData.description_link;
    const claims = patentData.claims || "";

    // Extract citations (CRITICAL for citation enhancement)
    const citations = {
      forward: patentData.patent_citations?.original || [],
      backward: patentData.cited_by?.original || [],
      family_id: patentData.family_id || null,
    };

    let assignees = [];
    if (patentData.assignees && Array.isArray(patentData.assignees)) {
      assignees = patentData.assignees;
    } else if (patentData.assignee) {
      assignees = [patentData.assignee];
    }

    // Fetch full description from description_link if available
    if (descriptionLink) {
      try {
        const descResponse = await axios.get(descriptionLink, {
          timeout: 120000,
          responseType: "text",
        });

        fullDescription = descResponse.data
          .replace(/<style[^>]*>.*<\/style>/gis, " ")
          .replace(/<script[^>]*>.*<\/script>/gis, " ")
          .replace(/<header[^>]*>.*<\/header>/gis, " ")
          .replace(/<footer[^>]*>.*<\/footer>/gis, " ")
          .replace(/<nav[^>]*>.*<\/nav>/gis, " ")
          .replace(/<img[^>]*>/gi, " ")
          .replace(/<a[^>]*>([^<]+)<\/a>/gi, "$1")
          .replace(/<[^>]+>/g, " ")
          .replace(/(&nbsp;|\s)+/g, " ")
          .trim();
      } catch (err) {
        console.warn(`Could not fetch description link: ${err.message}`);
        fullDescription = patentData.description || "";
      }
    } else {
      fullDescription = patentData.description || "";
    }

    // Truncate if necessary
    const MAX_DESC_LENGTH = 240000;
    if (fullDescription.length > MAX_DESC_LENGTH) {
      fullDescription = fullDescription.substring(0, MAX_DESC_LENGTH);
    }

    return {
      ...patentData,
      fullDescription,
      descriptionLink,
      abstract,
      claims,
      citations,
      family_id: patentData.family_id,
      title: patentData.title || "N/A",
      assignees: assignees,
      assignee: assignees[0] || "N/A",
      filing_date: patentData.filing_date || "N/A",
      inventor: patentData.inventor || "N/A",
      publication_number: patentData.publication_number || "N/A",
      country: patentData.country,
      publication_date: patentData.publication_date,
    };
  } catch (error) {
    console.error(`Patent Details Error for ${patentId}:`, error.message);
    return {
      fullDescription: "",
      descriptionLink: "",
      abstract: "",
      claims: "",
      citations: { forward: [], backward: [], family_id: null },
      title: "Error Processing Patent",
      assignee: "N/A",
      filing_date: "N/A",
      inventor: "N/A",
      publication_number: patentId,
    };
  }
}

function buildResultsText(results) {
  return results
    .slice(0, 60)
    .map(
      (result) =>
        `Patent ID: ${result.patent_id}, Title: ${result.title}, Assignee: ${result.assignee}, Snippet: ${result.snippet}`,
    )
    .join(" || ");
}

/* ==========================================================================
   PARSERS
   ========================================================================== */

function parseQueries(text) {
  const regex = /<h1>(.*?)<\/h1>/g;
  const queries = [];
  let match;
  while ((match = regex.exec(text)) !== null) queries.push(match[1].trim());
  return queries;
}

function parseTop30Selection(text) {
  const selections = [];
  const selectPattern = /<select>(\d+)\.\s*(patent\/[^<]+)<\/select>/g;
  let match;

  while ((match = selectPattern.exec(text)) !== null) {
    selections.push(match[2].trim());
  }

  if (selections.length < 30) {
    const fallbackPattern = /(\d+)\.\s*(patent\/[\w\d]+\/\w+)/g;
    const fallbackMatches = text.matchAll(fallbackPattern);
    for (const fbMatch of fallbackMatches) {
      const patentId = fbMatch[2].trim();
      if (!selections.includes(patentId)) {
        selections.push(patentId);
      }
    }
  }

  return selections.slice(0, 30);
}

function parseSelectionIds(text) {
  const regex = /<h1>(.*?)<\/h1>/g;
  const ids = [];
  let match;
  while ((match = regex.exec(text)) !== null) ids.push(match[1].trim());
  return ids;
}

function parsePrompt3Output(output, patentId) {
  const matrixMatch = output.match(/<h1>([\s\S]*?)<\/h1>/);
  let matrix = matrixMatch ? matrixMatch[1].trim() : "";

  if (patentId) {
    const simplifiedPatentId = extractPatentNumber(patentId);
    matrix = matrix.replace(/\|\s*Prior Art\s*\|/i, "| Search Result |");
    matrix = matrix.replace(/(P|p)rior (A|a)rt/g, simplifiedPatentId);
  }

  const excerptsMatch = output.match(/<h2>([\s\S]*?)<\/h2>/);
  const excerpts = excerptsMatch ? excerptsMatch[1].trim() : "";

  return { matrix, excerpts };
}

function parsePrompt4Output(output) {
  if (!output || typeof output !== "string") {
    console.error("Invalid output from Prompt 4");
    return [];
  }

  const patentBlocks = output.match(/<patent>[\s\S]*?<\/patent>/g) || [];

  return patentBlocks.map((block) => {
    const idMatch = block.match(/<id>(.*?)<\/id>/);
    const rankMatch = block.match(/<rank>(.*?)<\/rank>/);
    const foundMatch = block.match(/<found>(.*?)<\/found>/);
    const considerableMatch = block.match(
      /<considerable>(.*?)<\/considerable>/,
    );
    const partialMatch = block.match(/<partial>(.*?)<\/partial>/);
    const noneMatch = block.match(/<none>(.*?)<\/none>/);

    return {
      patentId: idMatch ? idMatch[1].trim() : "Unknown",
      rank: rankMatch ? parseInt(rankMatch[1].trim()) : 999,
      foundSummary: foundMatch
        ? foundMatch[1].trim()
        : "No feature summary available",
      metrics: {
        considerable: considerableMatch
          ? parseInt(considerableMatch[1].trim())
          : 0,
        partial: partialMatch ? parseInt(partialMatch[1].trim()) : 0,
        none: noneMatch ? parseInt(noneMatch[1].trim()) : 0,
      },
    };
  });
}

/* ==========================================================================
   PROMPTS (Updated from second file)
   ========================================================================== */

// Key Features Prompt
function generateKeyFeaturesPrompt(inventionText) {
  return `You are a patent search analyst tasked at patentability search projects. Understand the invention in detail and then start giving the key features focusing on the novel aspects and the solution of the invention mostly. The key features would have a preamble and then sub-features within it, the key features should further be nested like 1, 1.1, 1.2, 2, 2.1, and so on. The most important thing in key features is to divide them into really atomic units (like each key feature should be atomic, instead of clubbing features, look to divide them well). Note that the key features should describe the invention's solution and not the invention's prior art or application or advantage, should focus on the invention details so we can assist the patent searchers. Also note that the second key feature should refer to (like said X, if X was defined or explained in key feature 1) or kind of be in continuation to what was in the first key feature while being atomic. You can use up to 200 word max in total.

I am giving you 2 examples so you can use them for inspiration and writing style without getting affected by those invention data while doing your work.

Example 1 has Description: "We are engineering fusion proteins between an RNA-guided RNA- or DNA-targeting molecule (such as deactivated CRISPR-Cas proteins or CRISPR inspired RNA targeting proteins) and a pro-domain-truncated initiator caspase (Caspase-2, -8, -9 or -10 or modified version of these). These will constitute a system that can detect one or multiple specific and programmable RNA or DNA sequences (Target Sequences) in living cells and activate a downstream protease cascade switch only if these Target Sequences are present in the cell. We use 2 guide RNAs (gRNAs) to position 2 of these fusion proteins in close proximity on the Target Sequence, which provides a signal for the truncated Caspase submodules to dimerize and thereby activate their protease activity. In the absence of the Target Sequence, the gRNAs will not bring these fusion proteins into close proximity and dimerisation and Caspase activation will not occur. If the Target Sequence is present in the cell, the subsequent Caspase protease activity will trigger a downstream response, which can be customized: e.g. i) by activating executioner Caspases, such as Caspase 3, triggering apoptosis; ii) by using engineered initiator Caspases with modified specificity, we can uncouple from the Caspase initiated apoptotic pathway and instead activate zymogens (inactive enzymes that can be activated by a protease), transcription factors or other signalling molecules. Overall, our invention can detect a programmable Target Sequence in living cells and initiate a downstream response, such as apoptosis, only if the Target Sequence is present in these cells. Our system will be the first of its kind to use nucleic acid sequence markers in living cells and to allow a response to be activated dependent on the presence of these target sequences. A very new technology was recently published and patented, which has a similar objective but achieves it in a very different way and at this stage its sensitivity and selectivity is low."

Example 1 has Key Features: "Primary Features: 1. Method for activating protease cascade switch upon detection of a target sequence (specific nucleic acid sequence) such as DNA or RNA in living cells, wherein; 1.1 Said activation is performed through an engineered system which includes CRISPR RNA guided fusion proteins between either RNA-guided RNA or DNA-targeting molecule (such as deactivated CRISPR-Cas proteins or CRISPR inspired RNA targeting proteins) with a pro-domain-truncated initiator caspase such as Caspase-2, -8, -9 or -10 or type III/E Craspase systems to activate caspase-8/9; 1.2 Two of said guide RNAs (gRNAs) used to position two of the fusion proteins in close proximity on the target sequence, wherein; 1.2.1 Said guide RNA provides a signal for the truncated caspase submodules to dimerize and further activates/triggered their protease activity. 1.3 A triggered downstream response can be customized in following different manner: 1.3.1 Activating executioner caspases, such as Caspase 3, triggering apoptosis or 1.3.2 Using engineered initiator caspases with modified specificity, we can uncouple from the caspase initiated apoptotic pathway and instead activate zymogens (inactive enzymes that can be activated by a protease), transcription factors or other signalling molecules. Secondary Features: 1.4 Said method and engineered system is applicable in following areas: 1.4.1 Eliminating cancer cells very specifically and without or with minimal side effects and/or 1.4.2 Distinguishing and selectively eliminating one particular species from closely related species, effectively using it as an exceptionally selective pesticide or eliminating invasive species from endemic species and/or 1.4.3 Visualizing target cells (e.g. cancer cells) for surgical applications."

Example 2 has description: "Recently, an idea came up making a flow sensor obsolete. An electric pump pumping water (or aqueous liquid) through a tube system. Detect if just air is aspirated because the reservoir is empty or there is a significant leak in the aspiration tubing or an aspiration tube is disconnected. Detect if one of the tubings is clogged or kinked so that the tube is blocked Current solution is to use a flow sensor. A New approach - Monitor the power consumption of the pump (electromotor) If a defined threshold of power consumption is exceeded, it indicates a blockage or clogging. If a defined threshold of power consumption is undershot, air is aspirated. We want just to monitor if liquid flows by pumping. NO quantification of flow required. We want to evaluate if the concept is free to use or if still patents are in force. Does expired patents exist which describe the concept?"

Example 2 has key features: "Primary Features: 1. A Power Monitoring Device comprises: 1a. The device monitors the power consumption of the pump (electromotor). 1b. If a defined threshold of power consumption is exceeded, it indicates a blockage or clogging. 1c. If a defined threshold of power consumption is undershot, air is aspirated. Secondary Feature: 2. The pump is an electric pump pumping water (aqueous liquid) through a tube system."

I have given you description and key features pair examples. So learn my key feature writing style and generate the required key features in the format I want. Don't get influenced by the examples just use them for inspiration.

Ensure to give the top heading enclosed within a pair of h1 tags. The following content below that should be enclosed within p tags (one or multiple, as required) and if some other heading or sub-heading has to be there, that should be enclosed within h2 tags. Ensure to not use any other tags in the output.

The invention description you need to work on is:
${inventionText}`;
}

// Prompt 1: Query Generation (Basic Boolean with Synonyms)
function generatePrompt1(inventionText) {
  return `You are an expert patent searcher specialized in generating high-quality Google Patents search queries. Your biggest purpose is to create 3 best queries to find the most relevant or closely similar prior art to the given invention - we want novelty-defeating prior art, so do the best ever job here.

YOUR TASK:
1. First, perform brainstorming to identify the invention's key words, find an exhaustive set of synonyms, then select relevant synonyms and deselect irrelevant ones so we get the best results only. Write out this reasoning process.
2. Then, output exactly 3 queries, each enclosed within <h1> </h1> tags (single line each, no line breaks inside tags). No other tags should be used.

IMPORTANT: Write your analysis and reasoning BEFORE the queries. Only the final 3 queries go inside <h1> tags.

GOOGLE PATENTS SYNTAX RULES:
- Use Boolean operators: OR to indicate any of the keywords (single word synonyms separated by OR don't need quotes), AND to require all keyword groups
- Default operator is AND with left associativity
- CRITICAL: Always parenthesize OR groups! "safety OR seat belt" is searched as "(safety OR seat) AND belt" - NOT what you want!
- Correct: (safety OR seat) AND (belt OR strap)
- Use quotes ONLY for essential multi-word phrases like "machine learning" or "fuel cell" - we mostly don't want multi-word phrases but if needed, enclose them in double quotes
- Wildcards: * replaces zero or more characters (detect* finds detect, detection, detector, detecting). Example: car* means car and any word starting with car such as cars
- You can use NEAR operator for proximity, like (electric OR motor) NEAR (car OR vehicle), but use sparingly as it only affects ranking
- Do NOT use the minus (-) operator
- Do NOT use field codes like TI=, AB=, CL= - they often don't work reliably  
- Do NOT use CPC classification codes - use keywords only
- Don't use complicated codes or phrases - use queries that Google Patents will actually give good results on

QUERY STRATEGY:
The queries should be targeted, detailed, specific, and exhaustive, covering various synonyms properly. You may combine terms to refine precision and recall. Generate detailed yet simple and specific queries to get the best result set. Aim for 4-6 concept groups connected by AND per query.

Make all 3 queries meaningfully different:
- Query 1: Core structural terms - the main components and their key interactions
- Query 2: Method/process focus - how things work, actions, control mechanisms, steps
- Query 3: Problem/application focus - what problem is solved, use cases, alternative terminology

EXAMPLES OF WELL-FORMED QUERIES (for syntax patterns only - do NOT copy terms unless relevant):

Example 1 - Wearable heart monitoring:
Query 1: (wearable OR portable OR ambulatory) AND (ECG OR electrocardiogram OR "heart monitor") AND (arrhythmia OR "atrial fibrillation" OR "heart rhythm")
Query 2: (heart OR cardiac) AND (monitor* OR sens* OR detect*) AND (wireless OR bluetooth OR "real time") AND (wearable OR patch)
Query 3: (ECG OR electrocardiogram) AND (artifact OR noise OR motion) AND (filter* OR process* OR algorithm) AND (portable OR ambulatory)

Example 2 - Battery thermal management:
Query 1: (battery OR "lithium ion" OR "li-ion") AND (thermal OR heat OR temperature) AND (management OR control OR regulat*)
Query 2: (battery OR cell) AND (cool* OR heat*) AND (liquid OR air OR "phase change") AND (electric vehicle OR EV)
Query 3: ("thermal runaway" OR overheat* OR "temperature rise") AND (battery OR cell) AND (detect* OR prevent* OR protect*)

Example 3 - Autonomous vehicle perception:
Query 1: (autonomous OR "self driving" OR driverless) AND (vehicle OR car OR automobile) AND (sensor OR camera OR lidar OR radar)
Query 2: (object OR obstacle OR pedestrian) AND (detect* OR recogni* OR track*) AND (vehicle OR automotive) AND (neural network OR "deep learning")
Query 3: ("sensor fusion" OR "data fusion") AND (lidar OR radar OR camera) AND (autonomous OR automated) AND (navigation OR driving)

Example 4 - Smart irrigation:
Query 1: (irrigation OR watering OR sprinkler) AND (soil moisture OR humidity) AND (sensor OR monitor*) AND (automat* OR smart OR intelligent)
Query 2: (irrigation OR water*) AND (schedul* OR timing OR control*) AND (weather OR forecast OR evapotranspiration)
Query 3: (precision OR variable rate) AND (irrigation OR water*) AND (crop OR plant OR agriculture) AND (optimi* OR efficien*)

Example 5 - Payment fraud detection:
Query 1: (payment OR transaction OR "credit card") AND (fraud OR anomal* OR suspicious) AND (detect* OR identif* OR prevent*)
Query 2: (fraud OR fraudulent) AND (pattern OR behavior OR model*) AND ("machine learning" OR neural OR algorithm) AND (financial OR banking)
Query 3: ("real time" OR instant OR online) AND (transaction OR payment) AND (risk OR score OR assess*) AND (fraud OR suspicious)

Example 6 - Drug delivery system:
Query 1: (drug OR pharmaceutical OR medication) AND (delivery OR release OR administ*) AND (controlled OR sustained OR targeted)
Query 2: (nanoparticle OR liposome OR micelle OR carrier) AND (drug OR therapeutic) AND (encapsulat* OR load* OR deliver*)
Query 3: (implant* OR inject* OR transdermal) AND (drug OR medication) AND (release OR diffusion) AND (polymer OR hydrogel)

Example 7 - Voice assistant:
Query 1: (voice OR speech) AND (assistant OR interface OR command) AND (natural language OR NLP OR recogni*)
Query 2: (voice OR spoken) AND (control* OR activ* OR trigger*) AND (smart OR intelligent) AND (device OR home OR speaker)
Query 3: ("wake word" OR "hot word" OR activation) AND (voice OR speech) AND (detect* OR recogni*) AND (low power OR always on)

Example 8 - Robotic gripper:
Query 1: (robot* OR manipulator) AND (gripper OR grasp* OR grip) AND (object OR item) AND (pick* OR handl*)
Query 2: (gripper OR end effector) AND (soft OR flexible OR adaptive) AND (robot* OR automat*) AND (sens* OR feedback)
Query 3: (grasp* OR grip* OR hold*) AND (force OR pressure OR torque) AND (control* OR regulat*) AND (robot* OR manipulator)

BEFORE FINALIZING - VERIFY EACH QUERY:
- All OR groups are properly parenthesized
- Quotes only around essential multi-word technical terms
- No field codes (TI=, AB=, CL=) or CPC codes used
- Wildcards used appropriately on word stems
- Syntax is correct and query will give actual results on Google Patents
- Query is targeted yet covers synonyms exhaustively

OUTPUT FORMAT:
Write your brainstorming and reasoning first (not in any tags), then provide exactly 3 queries:
<h1>query 1 here on single line</h1>
<h1>query 2 here on single line</h1>
<h1>query 3 here on single line</h1>

The invention text is:
${inventionText}
`;
}

// Prompt 1 Alt: Narrow Novelty-Defeating Queries with Proximity Operators
function generatePrompt1_Alt(inventionText) {
  return `You are an expert patent prior art searcher. Your goal is to generate NARROW, SPECIFIC queries that find novelty-defeating prior art - documents that disclose the EXACT COMBINATION of features in the invention.

CRITICAL PRINCIPLE: Novelty-defeating prior art must disclose the specific feature combinations that make an invention novel. Broad queries find landscape documents; NARROW queries find the killer prior art.

═══════════════════════════════════════════════════════════════════════════════
WORKED EXAMPLE A: SOLID-STATE BATTERY WITH DENDRITE SUPPRESSION
═══════════════════════════════════════════════════════════════════════════════

KEY FEATURES:
1. A solid-state lithium battery comprising:
   1.1 a lithium metal anode layer
   1.2 a sulfide-based solid electrolyte layer comprising Li6PS5Cl argyrodite
   1.3 a nickel-rich layered oxide cathode (NCM811)
2. wherein a polymer buffer interlayer is disposed between the anode and electrolyte
   2.1 the polymer buffer comprising PEO with lithium salt
   2.2 the polymer buffer having thickness of 1-10 micrometers
3. wherein the polymer buffer suppresses lithium dendrite nucleation
4. wherein the electrolyte layer is formed by cold-pressing at room temperature

NOVELTY ANALYSIS - What makes this novel?
- The COMBINATION of: argyrodite sulfide electrolyte + polymer buffer interlayer + lithium metal anode
- The SPECIFIC FUNCTION: polymer buffer for dendrite suppression at sulfide interface
- The SPECIFIC METHOD: cold-pressing at room temperature

QUERY STRATEGY - Target the novel combinations:
- Query 1: Core material stack (argyrodite + polymer interlayer + Li metal anode)
- Query 2: Functional mechanism (dendrite suppression via polymer at interface)
- Query 3: Manufacturing method with specific materials

GENERATED QUERIES:

<h1>(Li6PS5Cl OR argyrodite OR "lithium thiophosphate") NEAR/5 electrolyte AND (polymer NEAR/3 interlayer OR "buffer layer") AND (lithium NEAR/3 metal NEAR/5 anode)</h1>

<h1>(dendrite NEAR/5 suppress* OR inhibit*) AND (polymer OR PEO) NEAR/10 (interface OR interlayer) AND (sulfide NEAR/5 electrolyte) AND ("solid state" OR "all-solid")</h1>

<h1>("cold press*" OR "room temperature" ADJ/3 process*) AND (argyrodite OR Li6PS5Cl) AND (NCM OR NMC OR "nickel rich") NEAR/10 cathode</h1>

═══════════════════════════════════════════════════════════════════════════════
WORKED EXAMPLE B: FEDERATED LEARNING FOR MEDICAL DIAGNOSIS
═══════════════════════════════════════════════════════════════════════════════

KEY FEATURES:
1. A privacy-preserving medical image analysis system comprising:
   1.1 a plurality of hospital client nodes storing local chest X-ray datasets
   1.2 a central aggregation server
   1.3 a CNN model for pneumonia classification
2. wherein each client node:
   2.1 trains the CNN locally on private data
   2.2 computes gradient updates without transmitting raw images
   2.3 applies differential privacy noise to gradients before transmission
3. wherein the central server:
   3.1 receives encrypted gradient updates
   3.2 performs secure aggregation using homomorphic encryption
   3.3 distributes updated global model weights
4. wherein membership inference attacks are prevented by differential privacy

NOVELTY ANALYSIS - What makes this novel?
- The COMBINATION of: federated learning + differential privacy + medical imaging
- The SPECIFIC MECHANISM: differential privacy on gradients + homomorphic encryption for aggregation
- The SPECIFIC APPLICATION: chest X-ray pneumonia detection across hospitals

QUERY STRATEGY - Target the novel combinations:
- Query 1: Federated + differential privacy + medical imaging
- Query 2: Secure aggregation mechanism for medical/hospital setting
- Query 3: Membership inference protection in distributed medical AI

GENERATED QUERIES:

<h1>("federated learning" OR "distributed learning") AND ("differential privacy" NEAR/10 gradient*) AND (medical NEAR/5 image* OR "chest X-ray" OR radiograph*)</h1>

<h1>("secure aggregation" OR "homomorphic encryption") NEAR/10 (gradient* OR weight* OR model*) AND (hospital* OR clinical) AND (CNN OR "neural network")</h1>

<h1>("membership inference" OR "privacy attack") NEAR/10 (prevent* OR protect*) AND (federat* OR distribut*) NEAR/5 (train* OR learn*) AND (medical OR health*)</h1>

═══════════════════════════════════════════════════════════════════════════════
WORKED EXAMPLE C: SELF-POWERED PIEZOELECTRIC WEARABLE SENSOR
═══════════════════════════════════════════════════════════════════════════════

KEY FEATURES:
1. A self-powered wearable sensor device comprising:
   1.1 a flexible PDMS substrate
   1.2 an array of zinc oxide nanowires grown vertically on the substrate
   1.3 a piezoelectric nanogenerator formed by the nanowire array
2. wherein the nanogenerator harvests biomechanical energy from joint movement
   2.1 converting mechanical strain to electrical output
   2.2 generating power in 1-100 microwatt range
3. a power management circuit comprising:
   3.1 a rectifier for AC to DC conversion
   3.2 a maximum power point tracking (MPPT) controller
   3.3 a supercapacitor for energy storage
4. a wireless transmitter powered by harvested energy
   4.1 transmitting to a body area network hub

NOVELTY ANALYSIS - What makes this novel?
- The COMBINATION of: ZnO nanowires + PDMS substrate + piezoelectric harvesting
- The SPECIFIC SYSTEM: MPPT + supercapacitor + wireless transmitter all powered by piezo harvesting
- The SPECIFIC APPLICATION: biomechanical energy from joints for body area network

QUERY STRATEGY - Target the novel combinations:
- Query 1: ZnO nanowires on flexible PDMS for piezoelectric harvesting
- Query 2: Biomechanical harvesting with MPPT for wearables
- Query 3: Self-powered piezo system with storage and wireless transmission

GENERATED QUERIES:

<h1>("zinc oxide" OR ZnO) NEAR/3 (nanowire* OR nanorod*) AND (PDMS OR silicone) NEAR/5 (substrate OR flexible) AND (piezoelectric NEAR/5 harvest* OR nanogenerator)</h1>

<h1>(biomechanical OR "joint movement" OR "body motion") NEAR/5 harvest* AND ("maximum power point" OR MPPT) AND (wearable OR "body worn") NEAR/10 piezo*</h1>

<h1>(piezoelectric NEAR/5 nanogenerator) AND (supercapacitor OR "energy storage") NEAR/10 (wireless NEAR/5 transmit*) AND ("body area network" OR wearable)</h1>

═══════════════════════════════════════════════════════════════════════════════
OPERATOR QUICK REFERENCE
═══════════════════════════════════════════════════════════════════════════════

PROXIMITY (boost ranking when terms appear near each other):
- NEAR/x - within x words, any order (use 3-5 for tight technical pairs)
- WITH - within 20 words, any order (sentence-level context)
- SAME - within 200 words, any order (paragraph/section level)
- ADJ/x - within x words, SAME order as typed

BOOLEAN:
- AND - both required (default between space-separated terms)
- OR - either term
- ( ) - ALWAYS parenthesize OR groups: (termA OR termB) AND termC

WILDCARDS:
- * - zero or more chars: detect* → detect, detection, detector, detecting
- ? - zero or one char
- # - exactly one char

RULES FOR NARROW QUERIES:
1. Include SPECIFIC material names, chemical formulas, technical terms
2. Use NEAR/3-5 for terms that MUST appear together in relevant documents
3. Target feature COMBINATIONS, not individual features
4. Include the specific application/function, not just components
5. Do NOT use field codes (TI=, AB=, CL=) or CPC classification codes

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

Analyze the target invention's key features and generate 3 NARROW, novelty-defeating queries.

STEP 1: NOVELTY ANALYSIS
- Which feature COMBINATIONS are likely novel?
- What specific materials, methods, or mechanisms are claimed?
- What is the specific application or function?

STEP 2: QUERY STRATEGY
- Query 1: Target the core novel component/material combination
- Query 2: Target the functional mechanism or method
- Query 3: Target the specific application or system integration

STEP 3: CONSTRUCT NARROW QUERIES
- Use specific technical terms, chemical names, acronyms
- Use NEAR/3-5 for tightly coupled feature pairs
- Include enough specificity to find EXACT prior art, not just related documents

Write your novelty analysis and query strategy first, then output exactly 3 queries:
<h1>query 1 - core component combination</h1>
<h1>query 2 - functional mechanism</h1>
<h1>query 3 - application/system integration</h1>

TARGET INVENTION KEY FEATURES:
${inventionText}
`;
}

// Prompt for Top 30 Selection
function generatePrompt_Top30Selection(inventionText, resultsText) {
  return `You are an expert patent searcher specialized in identifying potentially relevant prior art. Your task is to perform a preliminary screening of patent search results to identify the 30 most promising candidates for detailed analysis.

Given the invention description and approximately 120 patent search results (each with patent ID, title, assignee, and snippet), you must identify the 30 patents that show the highest potential for technical relevance.

SCREENING METHODOLOGY:
- Technical concept overlap: Look for patents mentioning similar technical elements, methods, or problems in title and snippet
- Snippet quality: Prioritize patents whose snippets contain substantive technical content rather than generic descriptions  
- Title relevance: Titles that describe specific technical solutions rather than broad categories
- Assignee diversity: Try to include patents from different organizations to ensure broad coverage
- Avoid clear mismatches: Exclude patents that are obviously in different technical domains despite keyword matches

INTERNAL ANALYSIS PROCESS:
1. Identify the core technical concepts from the invention
2. Scan each result for presence of relevant technical concepts in title and snippet
3. Weight patents that address similar technical problems or use similar technical approaches
4. Create mental buckets of patents by technical approach and select best representatives from each

OUTPUT REQUIREMENTS:
You must output EXACTLY 30 patent IDs in a numbered list format. Each line must follow this exact pattern:
<select>[NUMBER]. patent/[PUBLICATION_NUMBER]/en</select>

Example format:
<select>1. patent/US1234567B2/en</select>
<select>2. patent/WO2023123456A1/en</select>
... (continuing to exactly 30)

The invention description is: ${inventionText}

The patent search results are: ${resultsText}

Remember: Output exactly 30 selections in the specified format, no more, no less.`;
}

// Prompt for Final 5 Selection from Claims
function generatePrompt_Final5Selection(
  inventionText,
  patentsWithPartialDescriptions,
) {
  return `You are a patent prior art analyst with deep expertise in technical assessment. You have been provided with 30 pre-screened patents, each with their partial descriptions (first 50,000 characters), to make a final selection of the 5 most relevant prior art references.

IMPORTANT NOTE: You are seeing a substantial portion (up to 50,000 characters) of each patent's description. This extensive content typically includes the field of invention, background, summary, detailed description of embodiments, and often some claims. Use this comprehensive information to make a thorough assessment.

DESCRIPTION ANALYSIS METHODOLOGY:
With 50,000 characters available, you can analyze:

1. Field alignment: Complete understanding of the patent's technical domain
2. Problem-solution match: Full context of technical problems and their solutions
3. Technical approach similarity: Detailed methods, systems, and implementation details
4. Component overlap: Comprehensive mapping of technical elements to the invention
5. Embodiment variations: Multiple implementations that may relate to different aspects

SELECTION CRITERIA:
- Highest weight: Patents whose extensive descriptions show clear and comprehensive technical similarity
- Medium weight: Patents with strong relevance in core aspects but divergence in implementation
- Lower weight: Patents with transferable concepts or partial technical overlap
- Avoid: Patents that despite initial promise reveal fundamental differences in their detailed descriptions

The substantial descriptions provide deep insight into:
- Complete technical architecture
- Detailed implementation methods
- Multiple embodiments and variations
- Specific technical advantages and features
- Relationships between components

Perform systematic analysis:
1. Read all 30 partial descriptions thoroughly
2. Identify which 10-12 have strongest overall technical alignment
3. Among those, select the 5 with most comprehensive relevance
4. Consider both breadth and depth of technical overlap

The invention description is: ${inventionText}

The 30 patents with their partial descriptions are provided below: ${patentsWithPartialDescriptions}

Output EXACTLY 5 patent IDs in this format, each on its own line within h1 tags:
<h1>patent/[PUBLICATION_NUMBER]/en</h1>

Example:
<h1>patent/US1234567B2/en</h1>
<h1>patent/EP1234567B1/en</h1>
(continue for exactly 5 patents)`;
}

// Prompt 3: Comparison Matrix
function generatePrompt3(keyFeatures, patentDescription) {
  return `You are an expert patent analyst. Your task is to perform a one on one exhaustive comparison between the provided key features of a new invention and the provided patent prior art description. You must perform brainstorming internally to analyze and scrutinize the key features against all the prior art embodiments listed in the prior art description. You must do the brainstorming internally but not give that as output at all. Immediately after the brainstorming is done, then you will provide a 3-column matrix of comparison between the key features and the prior art. The 3-column matrix would have 3 columns called Key Feature, Prior Art, and Overlap. In the key feature column, you will write the exact key feature; in the prior art column, you will write about how similar/dissimilar the prior art is to the key feature based on your interpretation; and in the Overlap column, you will write either Considerable, - (just the hyphen symbol, no other text), or Partial. Ensure that the entire table is properly provided with the pipe symbols separating the data within properly, including at the beginning and end of each row as well among other places. Finally, you will provide relevant excerpts from the prior art (only a couple of lines each that are most relevant) enclosed within a single pair of <h2> tags. Take around 300 words for the table matrix and around 200 words for the excerpts. Your output format should be such that the entire key feature matrix is enclosed within a single pair of <h1> tags and the excerpts within a single pair of <h2> tags. Ensure that the entire table is properly provided with the pipe symbols separating the data within properly, including at the beginning and end of each row as well among other places. Think step by step. The key features are: ${keyFeatures} and the prior art is: ${patentDescription}. Importantly: after concluding the internal brainstorming, you must provide the required 3-column matrix within a pair of h1 tags and then the relevant excerpts within a pair of h2 tags and no irrelevant content apart from these`;
}

// Prompt 4: Patent Ranking
function generatePrompt4(allComparisonTables, patentIds) {
  return `
  You are a patent relevance analyst with expertise in evaluating invention similarities. I will provide you with comparison tables for ${
    patentIds.length
  } different patents, each showing how they compare to key features of a new invention.

  ===== YOUR TASK =====

  STEP 1: TABLE ANALYSIS
  For each patent's comparison table:
  - The first column contains key features of the invention
  - The second column explains how the patent compares to each feature
  - The third column shows the overlap rating: "Considerable" (strong match), "Partial" (partial match), or "-" (no match)

  STEP 2: CALCULATE RELEVANCE SCORES
  For each patent:
  - Count occurrences of "Considerable" in the Overlap column
  - Count occurrences of "Partial" in the Overlap column 
  - Count occurrences of "-" in the Overlap column
  - Calculate total score = (Considerable_count × 2) + (Partial_count × 1)

  STEP 3: RANK THE PATENTS
  Assign ranks 1-${patentIds.length} where:
  - Rank 1 = Highest relevance score (most relevant)
  - Rank ${patentIds.length} = Lowest relevance score (least relevant)
  - For tied scores: patent with more "Considerable" ratings ranks higher
  - If still tied: patent with fewer "-" ratings ranks higher

  STEP 4: CREATE FEATURE SUMMARY
  For each patent, create a summary line:
  FOUND FEATURES: List the key features found in this patent (those with "Considerable" or "Partial" overlap)
   - Format as a cohesive sentence starting with "This reference covers..."
   - Mention the feature numbers (e.g., "features 1a, 2, and 3c...") and short description of how mapping is
   - Prioritize mentioning "Considerable" matches first, then "Partial"
   
  STEP 5: FORMAT OUTPUT
  Provide your complete analysis using this exact XML structure for each patent:

  <patent>
  <id>\${EXACT_PATENT_ID}</id>
  <rank>\${NUMERICAL_RANK}</rank>
  <found>\${FOUND_FEATURES_SUMMARY}</found>
  <considerable>\${COUNT_OF_CONSIDERABLE_MATCHES}</considerable>
  <partial>\${COUNT_OF_PARTIAL_MATCHES}</partial>
  <none>\${COUNT_OF_NO_MATCHES}</none>
  </patent>

  ===== INPUT DATA =====

  ${allComparisonTables
    .map(
      (table, index) => `
  PATENT ID: ${patentIds[index]}
  ${table}
  ------------------------------
  `,
    )
    .join("\n\n")}

  ===== IMPORTANT NOTES =====
  
  1. Return exactly ${
    patentIds.length
  } <patent> blocks in order of descending relevance (highest rank first)
  2. Use the exact patent IDs as provided
  3. Make summary concise (under 80 words) but comprehensive
  4. Ensure your output is strictly formatted as specified - no additional text
  5. Include the count values to verify your calculations
  `;
}

/* ==========================================================================
   CITATION ENHANCEMENT FUNCTIONS
   ========================================================================== */

function extractCitationPool(comparisons, top30Details, level = 1) {
  // Get top 3 strongest patents based on metrics
  const sortedByStrength = [...comparisons]
    .filter((comp) => comp.metrics)
    .sort((a, b) => {
      const scoreA =
        (a.metrics?.considerable || 0) * 2 + (a.metrics?.partial || 0);
      const scoreB =
        (b.metrics?.considerable || 0) * 2 + (b.metrics?.partial || 0);
      return scoreB - scoreA;
    })
    .slice(0, 3);

  const citationMap = new Map();
  const convergenceCount = new Map();
  const processedFamilies = new Set();

  // Collect family IDs of current patents
  comparisons.forEach((comp) => {
    const details = top30Details.find((d) => d.patentId === comp.patentId);
    if (details?.details?.family_id) {
      processedFamilies.add(details.details.family_id);
    }
  });

  // Extract citations from top patents
  sortedByStrength.forEach((comp) => {
    const patentDetails = top30Details.find(
      (d) => d.patentId === comp.patentId,
    );
    if (!patentDetails?.details?.citations) return;

    const citations = patentDetails.details.citations;

    // Add forward citations
    (citations.forward || []).forEach((citation) => {
      const citationFamilyId =
        citation.family_id || "unknown_" + citation.patent_id;
      convergenceCount.set(
        citation.patent_id,
        (convergenceCount.get(citation.patent_id) || 0) + 1,
      );

      if (
        !citationMap.has(citation.patent_id) &&
        !processedFamilies.has(citationFamilyId)
      ) {
        citationMap.set(citation.patent_id, {
          ...citation,
          source: comp.patentId,
          direction: "forward",
          level: level,
          convergenceScore: 0,
        });
      }
    });

    // Add backward citations (limit to 10 per patent)
    (citations.backward || []).slice(0, 10).forEach((citation) => {
      const citationFamilyId =
        citation.family_id || "unknown_" + citation.patent_id;
      convergenceCount.set(
        citation.patent_id,
        (convergenceCount.get(citation.patent_id) || 0) + 1,
      );

      if (
        !citationMap.has(citation.patent_id) &&
        !processedFamilies.has(citationFamilyId)
      ) {
        citationMap.set(citation.patent_id, {
          ...citation,
          source: comp.patentId,
          direction: "backward",
          level: level,
          convergenceScore: 0,
        });
      }
    });
  });

  // Update convergence scores
  citationMap.forEach((citation, patentId) => {
    citation.convergenceScore = convergenceCount.get(patentId) || 1;
  });

  return Array.from(citationMap.values()).sort(
    (a, b) => b.convergenceScore - a.convergenceScore,
  );
}

async function fetchSecondLevelCitations(firstLevelCitations, jobId) {
  console.log(`[${jobId}] Fetching second-level citations...`);

  try {
    const topCitations = firstLevelCitations.slice(0, 5);

    const detailsPromises = topCitations.map(async (citation) => {
      try {
        const details = await getPatentDetails(citation.patent_id);
        return {
          parentId: citation.patent_id,
          citations: details.citations || { forward: [], backward: [] },
        };
      } catch (error) {
        console.error(
          `Error fetching details for ${citation.patent_id}:`,
          error.message,
        );
        return null;
      }
    });

    const citationDetails = (await Promise.all(detailsPromises)).filter(
      Boolean,
    );

    const secondLevelMap = new Map();
    const processedFamilies = new Set();

    citationDetails.forEach(({ parentId, citations }) => {
      (citations.forward || []).slice(0, 8).forEach((citation) => {
        const citationFamilyId =
          citation.family_id || "unknown_" + citation.patent_id;

        if (
          !secondLevelMap.has(citation.patent_id) &&
          !processedFamilies.has(citationFamilyId)
        ) {
          secondLevelMap.set(citation.patent_id, {
            ...citation,
            source: parentId,
            direction: "forward",
            level: 2,
            convergenceScore: 0,
          });
          processedFamilies.add(citationFamilyId);
        }
      });
    });

    console.log(
      `[${jobId}] Found ${secondLevelMap.size} second-level citations`,
    );
    return Array.from(secondLevelMap.values());
  } catch (error) {
    console.error(`[${jobId}] Second-level citation error:`, error);
    return [];
  }
}

function generatePrompt_CitationScreening(
  keyFeatures,
  citationsText,
  level = 1,
) {
  return `You are an expert patent examiner evaluating ${
    level === 1 ? "direct" : "second-level"
  } citation relevance. Given the key features of an invention and a list of ${
    level === 1 ? "cited" : "second-degree"
  } patents, identify the ${
    level === 1 ? "25" : "15"
  } most technically relevant citations.

KEY FEATURES OF THE INVENTION:
${keyFeatures}

EVALUATION CRITERIA:
- Direct technical overlap with key features
- Problem-solution correspondence
- Implementation methodology similarity
- Component and architecture alignment
${
  level === 2
    ? "- Consider that these are second-degree citations (citations of citations)"
    : ""
}
- Prioritize convergence patents (cited by multiple sources)
- Avoid redundant patents covering identical concepts

CITATION PATENTS:
${citationsText}

OUTPUT REQUIREMENTS:
You must output EXACTLY ${
    level === 1 ? "25" : "15"
  } patent IDs in order of relevance. Each line must follow this exact pattern:
<cite>[NUMBER]. patent/[PUBLICATION_NUMBER]/en</cite>

Example format:
<cite>1. patent/US1234567B2/en</cite>
<cite>2. patent/EP1234567B1/en</cite>
... (continuing to exactly ${level === 1 ? "25" : "15"})

Remember: Output exactly ${
    level === 1 ? "25" : "15"
  } citations in the specified format.`;
}

function parseCitationScreening(output, expectedCount = 25) {
  const citations = [];
  const citePattern = /<cite>(\d+)\.\s*(patent\/[^<]+)<\/cite>/g;
  let match;

  while ((match = citePattern.exec(output)) !== null) {
    citations.push(match[2].trim());
  }

  if (citations.length !== expectedCount) {
    console.warn(
      `Expected ${expectedCount} citations but got ${citations.length}`,
    );
  }

  return citations.slice(0, expectedCount);
}

function generatePrompt_Final10Selection(
  keyFeatures,
  inventionText,
  allPatentsWithDescriptions,
) {
  return `You are a patent prior art analyst performing final selection. You have approximately 45 patents (5 initial + 25 first-level citations + 15 second-level citations) and must choose the absolute best 10 prior art references.

INVENTION KEY FEATURES:
${keyFeatures}

INVENTION DESCRIPTION:
${inventionText}

SELECTION METHODOLOGY:
1. Comprehensive feature coverage - patents covering most key features
2. Technical depth - detailed disclosure of implementation
3. Citation importance - prioritize convergence patents (cited by multiple sources)
4. Citation level diversity - include mix of original, first-level, and second-level citations
5. Priority date advantage - earlier filing dates are valuable
6. Avoid family duplicates - diversify across patent families

THE CANDIDATE PATENTS (each with 40K chars):
${allPatentsWithDescriptions}

CRITICAL REQUIREMENTS:
- Select exactly 10 patents that provide the best prior art coverage
- Ensure at least 3 are from the original 5 if they're strong
- Include convergence patents (cited by multiple sources) when relevant
- Balance between direct matches and foundational patents
- Consider both breadth and depth of technical overlap

Output EXACTLY 10 patent IDs in order of relevance, each on its own line within h1 tags:
<h1>patent/[PUBLICATION_NUMBER]/en</h1>

Example:
<h1>patent/US1234567B2/en</h1>
<h1>patent/EP1234567B1/en</h1>
(continue for exactly 10 patents)`;
}

async function processCitationEnhancement(
  comparisons,
  keyFeatures,
  inventionText,
  top30Details,
  allResults,
  jobId,
  searchQueriesLog,
) {
  console.log(`[${jobId}] Starting citation enhancement...`);

  try {
    // Step 1: Extract first-level citations
    const firstLevelCitations = extractCitationPool(
      comparisons,
      top30Details,
      1,
    );
    console.log(
      `[${jobId}] First-level citation pool: ${firstLevelCitations.length}`,
    );

    if (firstLevelCitations.length === 0) {
      console.log(`[${jobId}] No citations found, returning original results`);
      return { enhancedComparisons: comparisons, additionalCitations: [] };
    }

    searchQueriesLog.push({
      type: "Citation Network Analysis",
      query: `Extracted ${firstLevelCitations.length} first-level citations from top 3 patents`,
      step: "Citation Enhancement - Level 1",
    });

    // Step 2: Screen first-level citations to 25
    const firstLevelText = firstLevelCitations
      .slice(0, 100)
      .map(
        (c) =>
          `Patent ID: ${c.patent_id}, Title: ${
            c.title || "N/A"
          }, Convergence: ${c.convergenceScore}`,
      )
      .join(" || ");

    const firstLevelPrompt = generatePrompt_CitationScreening(
      keyFeatures,
      firstLevelText,
      1,
    );
    const firstLevelResponse = await runGeminiPrompt(firstLevelPrompt);
    const topFirstLevelIds = parseCitationScreening(firstLevelResponse, 25);
    console.log(
      `[${jobId}] Selected ${topFirstLevelIds.length} first-level citations`,
    );

    searchQueriesLog.push({
      type: "Citation Screening",
      query: `Selected top ${topFirstLevelIds.length} from ${firstLevelCitations.length} candidates`,
      step: "Citation Enhancement - Level 1 Screening",
    });

    // Step 3: Fetch first-level details AND second-level citations in parallel
    const [firstLevelDetails, secondLevelCitations] = await Promise.all([
      Promise.all(
        topFirstLevelIds.slice(0, 25).map(async (patentId) => {
          const details = await getPatentDetails(patentId);
          return {
            patentId,
            details,
            description: details.fullDescription || "",
            descriptionLink: details.descriptionLink || "",
            level: 1,
          };
        }),
      ),
      fetchSecondLevelCitations(firstLevelCitations, jobId),
    ]);

    console.log(
      `[${jobId}] Fetched ${firstLevelDetails.length} first-level details`,
    );
    console.log(
      `[${jobId}] Found ${secondLevelCitations.length} second-level citations`,
    );

    // Step 4: Screen second-level citations to 15
    let topSecondLevelDetails = [];
    if (secondLevelCitations.length > 0) {
      searchQueriesLog.push({
        type: "Citation Network Analysis",
        query: `Extracted ${secondLevelCitations.length} second-level citations`,
        step: "Citation Enhancement - Level 2",
      });

      const secondLevelText = secondLevelCitations
        .slice(0, 60)
        .map(
          (c) =>
            `Patent ID: ${c.patent_id}, Title: ${c.title || "N/A"}, Source: ${
              c.source
            }`,
        )
        .join(" || ");

      const secondLevelPrompt = generatePrompt_CitationScreening(
        keyFeatures,
        secondLevelText,
        2,
      );
      const secondLevelResponse = await runGeminiPrompt(secondLevelPrompt);
      const topSecondLevelIds = parseCitationScreening(secondLevelResponse, 15);

      searchQueriesLog.push({
        type: "Citation Screening",
        query: `Selected top ${topSecondLevelIds.length} second-level citations`,
        step: "Citation Enhancement - Level 2 Screening",
      });

      topSecondLevelDetails = await Promise.all(
        topSecondLevelIds.slice(0, 15).map(async (patentId) => {
          const details = await getPatentDetails(patentId);
          return {
            patentId,
            details,
            description: details.fullDescription || "",
            descriptionLink: details.descriptionLink || "",
            level: 2,
          };
        }),
      );

      console.log(
        `[${jobId}] Fetched ${topSecondLevelDetails.length} second-level details`,
      );
    }

    // Step 5: Build descriptions for final selection
    const originalDescriptions = comparisons
      .map((comp) => {
        const patentData = top30Details.find(
          (d) => d.patentId === comp.patentId,
        );
        const description = (
          patentData?.description ||
          patentData?.details?.abstract ||
          ""
        ).substring(0, 40000);
        return `[ORIGINAL SELECTION - Rank ${comp.rank || "N/A"}]
Patent ID: ${comp.patentId}
Title: ${comp.details?.title || "N/A"}
Filing Date: ${comp.details?.filing_date || "N/A"}
Partial Description (40K chars): ${description}`;
      })
      .join("\n\n---\n\n");

    const firstLevelDescriptions = firstLevelDetails
      .map((c) => {
        const description = (
          c.description ||
          c.details?.abstract ||
          ""
        ).substring(0, 40000);
        const convergenceInfo = firstLevelCitations.find(
          (fc) => fc.patent_id === c.patentId,
        );
        return `[FIRST-LEVEL CITATION${
          convergenceInfo?.convergenceScore > 1 ? " - CONVERGENCE PATENT" : ""
        }]
Patent ID: ${c.patentId}
Title: ${c.details?.title || "N/A"}
Filing Date: ${c.details?.filing_date || "N/A"}
Partial Description (40K chars): ${description}`;
      })
      .join("\n\n---\n\n");

    const secondLevelDescriptions = topSecondLevelDetails
      .map((c) => {
        const description = (
          c.description ||
          c.details?.abstract ||
          ""
        ).substring(0, 40000);
        return `[SECOND-LEVEL CITATION]
Patent ID: ${c.patentId}
Title: ${c.details?.title || "N/A"}
Filing Date: ${c.details?.filing_date || "N/A"}
Partial Description (40K chars): ${description}`;
      })
      .join("\n\n---\n\n");

    const allDescriptions = [
      originalDescriptions,
      firstLevelDescriptions,
      secondLevelDescriptions,
    ]
      .filter((d) => d.length > 0)
      .join("\n\n---\n\n");

    // Step 6: Select final 10
    const selectionPrompt = generatePrompt_Final10Selection(
      keyFeatures,
      inventionText,
      allDescriptions,
    );
    console.log(
      `[${jobId}] Selecting final 10 from ~${
        comparisons.length +
        firstLevelDetails.length +
        topSecondLevelDetails.length
      } candidates`,
    );
    const selectionResponse = await runGeminiPrompt(selectionPrompt);

    const final10Ids = [];
    const h1Pattern = /<h1>(.*?)<\/h1>/g;
    let match;
    while ((match = h1Pattern.exec(selectionResponse)) !== null) {
      final10Ids.push(match[1].trim());
    }

    console.log(`[${jobId}] Final 10 selected: ${final10Ids.join(", ")}`);

    searchQueriesLog.push({
      type: "Final Selection",
      query: `Selected final ${final10Ids.length} patents from all candidates`,
      step: "Citation Enhancement - Final Selection",
    });

    // Step 7: Generate matrices for new patents (PARALLEL)
    const allCitationDetails = [...firstLevelDetails, ...topSecondLevelDetails];
    const existingComparisons = [];
    const patentsNeedingMatrices = [];

    for (const patentId of final10Ids) {
      const existingComp = comparisons.find((c) => c.patentId === patentId);
      if (existingComp) {
        existingComparisons.push(existingComp);
      } else {
        const citationData = allCitationDetails.find(
          (c) => c.patentId === patentId,
        );
        if (citationData) {
          patentsNeedingMatrices.push({ patentId, citationData });
        }
      }
    }

    console.log(
      `[${jobId}] Generating ${patentsNeedingMatrices.length} new matrices in parallel`,
    );

    const newMatrixPromises = patentsNeedingMatrices.map(
      async ({ patentId, citationData }) => {
        console.log(`[${jobId}] Generating matrix for citation: ${patentId}`);

        const prompt3 = generatePrompt3(keyFeatures, citationData.description);
        const matrixResponse = await runGeminiPrompt(prompt3);
        const parsed = parsePrompt3Output(matrixResponse, patentId);

        const matrixRows = parsed.matrix
          .split("\n")
          .filter((line) => line.includes("|"));
        let considerable = 0,
          partial = 0;
        matrixRows.forEach((row) => {
          if (row.includes("Considerable")) considerable++;
          if (row.includes("Partial")) partial++;
        });

        return {
          patentId,
          details: {
            title: citationData.details?.title,
            assignee: citationData.details?.assignee,
            filing_date: citationData.details?.filing_date,
            inventor: citationData.details?.inventor,
            abstract: citationData.details?.abstract,
            snippet: citationData.details?.abstract,
            pdf: citationData.details?.pdf,
            publication_number: citationData.details?.publication_number,
            country: citationData.details?.country,
            publication_date: citationData.details?.publication_date,
          },
          matrix: parsed.matrix,
          excerpts: parsed.excerpts,
          descriptionWordCount: countWords(citationData.description),
          descriptionLink: citationData.descriptionLink,
          fromCitationEnhancement: true,
          citationLevel: citationData.level,
          metrics: {
            considerable,
            partial,
            none: Math.max(0, matrixRows.length - considerable - partial - 2),
          },
        };
      },
    );

    const newMatrixComparisons = await Promise.all(newMatrixPromises);

    // Combine and maintain order
    const finalComparisons = final10Ids
      .map((patentId) => {
        const existing = existingComparisons.find(
          (c) => c.patentId === patentId,
        );
        if (existing) return existing;
        return newMatrixComparisons.find((c) => c.patentId === patentId);
      })
      .filter(Boolean);

    // Step 8: Re-rank all 10
    if (finalComparisons.length > 0) {
      console.log(`[${jobId}] Re-ranking ${finalComparisons.length} patents`);

      const matrices = finalComparisons
        .map((c) => c.matrix || "")
        .filter(Boolean);
      const ids = finalComparisons.map((c) => c.patentId);

      if (matrices.length > 0) {
        const rankingPrompt = generatePrompt4(matrices, ids);
        const rankingResponse = await runGeminiPrompt(rankingPrompt, true);
        const newRankings = parsePrompt4Output(rankingResponse);

        const rankingMap = new Map();
        newRankings.forEach((r) => rankingMap.set(r.patentId, r));

        finalComparisons.forEach((comp) => {
          if (rankingMap.has(comp.patentId)) {
            const ranking = rankingMap.get(comp.patentId);
            comp.rank = ranking.rank;
            comp.foundSummary = ranking.foundSummary;
            comp.metrics = ranking.metrics;
          }
        });

        finalComparisons.sort((a, b) => (a.rank || 999) - (b.rank || 999));
      }

      // Ensure sequential ranks
      finalComparisons.forEach((comp, index) => {
        comp.rank = index + 1;
      });
    }

    // Build additional citations for display
    const additionalCitations = [];
    allCitationDetails.forEach((citation) => {
      if (!final10Ids.includes(citation.patentId)) {
        additionalCitations.push({
          patent_id: citation.patentId,
          title: citation.details?.title || "",
          assignee: citation.details?.assignee || "",
          snippet: citation.details?.abstract || "",
          filing_date: citation.details?.filing_date || "",
          inventor: citation.details?.inventor || "",
          patent_link: `https://patents.google.com/patent/${extractPatentNumber(
            citation.patentId,
          )}`,
          is_scholar: false,
          citationLevel: citation.level,
          fromCitationPool: true,
        });
      }
    });

    console.log(
      `[${jobId}] Citation enhancement complete: ${finalComparisons.length} final patents`,
    );

    return {
      enhancedComparisons: finalComparisons,
      additionalCitations,
    };
  } catch (error) {
    console.error(`[${jobId}] Citation enhancement error:`, error);
    return { enhancedComparisons: comparisons, additionalCitations: [] };
  }
}

export default router;
