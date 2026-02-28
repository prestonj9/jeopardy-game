import Anthropic from "@anthropic-ai/sdk";
import type {
  AIBoardResponse,
  AIChunkResponse,
  AIRapidFireResponse,
  Board,
  RapidFireClue,
  GenerateBoardRequest,
  GenerateBoardResponse,
  GenerateRapidFireResponse,
} from "./types.ts";
import { validateBoard, validateRapidFireBoard, type ClueValidationResult } from "./clue-validator.ts";

const client = new Anthropic();

// ── Model Configuration ──────────────────────────────────────────────────────

const MODEL_GENERATE = "claude-opus-4-6";
const MODEL_FIX = "claude-haiku-4-5-20251001";

// ── Simplified Opus Prompts (Parallel Classic) ───────────────────────────────

const CHUNK_SYSTEM_PROMPT_A = `You are a Jeopardy board generator. Generate exactly 3 categories.

Rules:
- Creative, punny, or thematic category names in real Jeopardy style
- Each category: exactly 5 clues at $200, $400, $600, $800, $1000
- Clues are declarative statements; correctResponses are "What is..." or "Who is..." questions
- The clueText must NEVER contain any word from the correctResponse — the player must guess the answer
- Every correctResponse must be unique across all clues
- Layer 2-3 converging hints per clue for unambiguous answers. Vary sentence structure.
- Scale difficulty: $200 = common knowledge, $1000 = expert-level
- Only state facts you are highly confident about. Prefer a simpler correct fact over an impressive uncertain one.

Respond with ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "categories": [
    {
      "name": "string",
      "clues": [
        { "value": 200, "clueText": "string", "correctResponse": "string" },
        { "value": 400, "clueText": "string", "correctResponse": "string" },
        { "value": 600, "clueText": "string", "correctResponse": "string" },
        { "value": 800, "clueText": "string", "correctResponse": "string" },
        { "value": 1000, "clueText": "string", "correctResponse": "string" }
      ]
    }
  ]
}`;

const CHUNK_SYSTEM_PROMPT_B = `You are a Jeopardy board generator. Generate exactly 3 categories and 1 Final Jeopardy clue.

Rules:
- Creative, punny, or thematic category names in real Jeopardy style
- Each category: exactly 5 clues at $200, $400, $600, $800, $1000
- Clues are declarative statements; correctResponses are "What is..." or "Who is..." questions
- The clueText must NEVER contain any word from the correctResponse — the player must guess the answer
- Every correctResponse must be unique across all clues
- Layer 2-3 converging hints per clue for unambiguous answers. Vary sentence structure.
- Scale difficulty: $200 = common knowledge, $1000 = expert-level
- Only state facts you are highly confident about. Prefer a simpler correct fact over an impressive uncertain one.
- Final Jeopardy: its own unique category name, not duplicating any of your 3 categories

Respond with ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "categories": [
    {
      "name": "string",
      "clues": [
        { "value": 200, "clueText": "string", "correctResponse": "string" },
        { "value": 400, "clueText": "string", "correctResponse": "string" },
        { "value": 600, "clueText": "string", "correctResponse": "string" },
        { "value": 800, "clueText": "string", "correctResponse": "string" },
        { "value": 1000, "clueText": "string", "correctResponse": "string" }
      ]
    }
  ],
  "finalJeopardy": {
    "category": "string",
    "clueText": "string",
    "correctResponse": "string"
  }
}`;

// ── Upload Mode Prompt (Single Call — needs full document context) ────────────

const UPLOAD_SYSTEM_PROMPT = `You are a Jeopardy board generator. Generate exactly 6 categories, each with 5 clues, plus 1 Final Jeopardy.

Rules:
- Creative, punny, or thematic category names in real Jeopardy style
- Each category: exactly 5 clues at $200, $400, $600, $800, $1000
- Clues are declarative statements; correctResponses are "What is..." or "Who is..." questions
- The clueText must NEVER contain any word from the correctResponse — the player must guess the answer
- Every correctResponse must be unique across all clues
- Layer 2-3 converging hints per clue for unambiguous answers. Vary sentence structure.
- Scale difficulty: $200 = common knowledge, $1000 = expert-level
- Only state facts you are highly confident about.
- Final Jeopardy: its own unique category name

STRUCTURED CONTENT DETECTION:
When given source material, first check if it contains pre-structured Jeopardy content:
- If the content has EXACTLY 6 categories, each with EXACTLY 5 clue/answer pairs (30 total clues), use the provided content VERBATIM:
  - Use the provided category names, clue texts, and answers exactly as given, formatted as "What is..." or "Who is..." questions
  - Assign dollar values $200-$1000 to the 5 clues in each category in order
  - If a Final Jeopardy clue is provided, use it verbatim. If not, generate one.
- If the content does NOT match this exact structure, treat it as unstructured source material and generate original clues from it.

Respond with ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "categories": [
    {
      "name": "string",
      "clues": [
        { "value": 200, "clueText": "string", "correctResponse": "string" },
        { "value": 400, "clueText": "string", "correctResponse": "string" },
        { "value": 600, "clueText": "string", "correctResponse": "string" },
        { "value": 800, "clueText": "string", "correctResponse": "string" },
        { "value": 1000, "clueText": "string", "correctResponse": "string" }
      ]
    }
  ],
  "dailyDouble": { "categoryIndex": 0, "clueIndex": 2 },
  "finalJeopardy": {
    "category": "string",
    "clueText": "string",
    "correctResponse": "string"
  }
}`;

// ── Rapid Fire Prompt ────────────────────────────────────────────────────────

const RAPID_FIRE_SYSTEM_PROMPT = `You are a Jeopardy rapid-fire round generator. Create engaging, accurate trivia clues as a flat list.

Rules:
- Generate exactly the requested number of clues as a flat list (no categories or grid)
- Each clue has a "subtopic" label — a short 1-3 word descriptor of the clue's subject area
- Vary subtopics for broad coverage. Mix difficulty levels randomly ($200-$1000).
- Clues are declarative statements; correctResponses are "What is..." or "Who is..." questions
- The clueText must NEVER contain any word from the correctResponse
- Every correctResponse must be unique
- Layer 2-3 converging hints per clue. Vary sentence structure.
- Only state facts you are highly confident about.
- Generate 1 Final Jeopardy clue with its own unique category name

Respond with ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "clues": [
    { "value": 600, "subtopic": "Ancient Rome", "clueText": "string", "correctResponse": "string" },
    { "value": 200, "subtopic": "Pop Music", "clueText": "string", "correctResponse": "string" }
  ],
  "finalJeopardy": {
    "category": "string",
    "clueText": "string",
    "correctResponse": "string"
  }
}`;

// ── Fix Prompt (used with Haiku) ─────────────────────────────────────────────

const FIX_SYSTEM_PROMPT = `You are a Jeopardy clue fixer. You will receive clues that have a problem: the answer is revealed in the clue text. Generate a replacement clue for each that does NOT contain the answer.

Rules:
- Keep the same category context and dollar value difficulty level
- The replacement clueText must NOT contain any word from the correctResponse
- Keep the same correctResponse (answer) — only rewrite the clueText
- Use descriptive language, context clues, and indirect references
- Accuracy is paramount — only use facts you are highly confident about
- If unsure about a specific detail, use a different factual angle you ARE certain about
- Respond with ONLY valid JSON — no markdown, no explanation, no code fences`;

// ── Shared Helpers ───────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Extracts the text content from a Claude API response.
 * Handles both standard responses and extended-thinking responses
 * where content[] contains thinking blocks before the text block.
 */
function extractTextFromResponse(content: Anthropic.ContentBlock[]): string {
  const textBlock = content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

function checkApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("xxxxx")) {
    throw new Error(
      "Missing or invalid ANTHROPIC_API_KEY. Add a valid key to your .env.local file."
    );
  }
}

function isAuthError(err: unknown): boolean {
  const errMsg = err instanceof Error ? err.message : String(err);
  return errMsg.includes("authentication") || errMsg.includes("401") || errMsg.includes("api-key");
}

// ── Daily Double Assignment (in code, not by AI) ─────────────────────────────

function assignDailyDouble(categoryCount: number): { categoryIndex: number; clueIndex: number } {
  const categoryIndex = Math.floor(Math.random() * categoryCount);
  const clueIndex = 1 + Math.floor(Math.random() * 4); // indices 1-4 (non-$200)
  return { categoryIndex, clueIndex };
}

// ── Parallel Classic Board Generation ────────────────────────────────────────

async function callOpusChunk(
  systemPrompt: string,
  userMessage: string
): Promise<AIChunkResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL_GENERATE,
        max_tokens: 10000,
        thinking: { type: "enabled", budget_tokens: 8000 },
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = extractTextFromResponse(response.content);
      return parseJSON<AIChunkResponse>(text);
    } catch (err) {
      console.error(`Chunk generation attempt ${attempt + 1} failed:`, err);
      if (isAuthError(err)) {
        throw new Error("Invalid API key. Please check your ANTHROPIC_API_KEY in .env.local.");
      }
      if (attempt === 1) {
        throw new Error(`Chunk generation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  throw new Error("Chunk generation failed after retries");
}

function mergeChunks(chunkA: AIChunkResponse, chunkB: AIChunkResponse): AIBoardResponse {
  const allCategories = [...chunkA.categories, ...chunkB.categories];

  // Deduplicate category names
  const seen = new Set<string>();
  for (const cat of allCategories) {
    const key = cat.name.toLowerCase().trim();
    if (seen.has(key)) {
      cat.name = cat.name + " II";
    }
    seen.add(key);
  }

  // Log duplicate answers (validation loop will catch and fix)
  const answerSet = new Set<string>();
  for (const cat of allCategories) {
    for (const clue of cat.clues) {
      const normalized = clue.correctResponse.toLowerCase().trim();
      if (answerSet.has(normalized)) {
        console.warn(`[merge] Duplicate answer detected: "${clue.correctResponse}"`);
      }
      answerSet.add(normalized);
    }
  }

  const dailyDouble = assignDailyDouble(allCategories.length);

  const finalJeopardy = chunkB.finalJeopardy ?? {
    category: "Potpourri",
    clueText: "This catch-all Jeopardy category is a French word meaning a mixture of dried petals and spices",
    correctResponse: "What is potpourri?",
  };

  return { categories: allCategories, dailyDouble, finalJeopardy };
}

async function generateBoardParallel(req: GenerateBoardRequest): Promise<AIBoardResponse> {
  console.log("[gen] Starting parallel Opus generation (2 chunks)");

  const topic = req.topic ?? "General Knowledge";
  const userA = `Generate 3 Jeopardy categories about: ${topic}\nFocus on creative, unexpected angles. Make it fun and varied.`;
  const userB = `Generate 3 Jeopardy categories and 1 Final Jeopardy about: ${topic}\nCover different aspects than what another generator might pick. Explore surprising connections.`;

  const [chunkA, chunkB] = await Promise.all([
    callOpusChunk(CHUNK_SYSTEM_PROMPT_A, userA),
    callOpusChunk(CHUNK_SYSTEM_PROMPT_B, userB),
  ]);

  console.log("[gen] Both chunks received, merging");
  return mergeChunks(chunkA, chunkB);
}

// ── Single-Call Generation (Upload Mode) ─────────────────────────────────────

async function generateBoardSingle(req: GenerateBoardRequest): Promise<AIBoardResponse> {
  console.log("[gen] Starting single-call Opus generation (upload mode)");

  const userMessage = req.mode === "upload" && req.content
    ? `Generate a complete Jeopardy board based on the following source material.

IMPORTANT: First, determine if this content is pre-structured Jeopardy content (exactly 6 categories with exactly 5 clue/answer pairs each). If it is, use the clues VERBATIM as described in your instructions. If it's general text, generate original clues from it.

Do not use outside knowledge — draw all clues from this content.

SOURCE MATERIAL:
${req.content}`
    : `Generate a complete Jeopardy board about: ${req.topic ?? "General Knowledge"}
Use your general knowledge. Make it fun and varied.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL_GENERATE,
        max_tokens: 16000,
        thinking: { type: "enabled", budget_tokens: 10000 },
        system: UPLOAD_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = extractTextFromResponse(response.content);
      return parseJSON<AIBoardResponse>(text);
    } catch (err) {
      console.error(`Single-call generation attempt ${attempt + 1} failed:`, err);
      if (isAuthError(err)) {
        throw new Error("Invalid API key. Please check your ANTHROPIC_API_KEY in .env.local.");
      }
      if (attempt === 1) {
        throw new Error(`Board generation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  throw new Error("Board generation failed after retries");
}

// ── Board Transform ──────────────────────────────────────────────────────────

function transformToBoard(data: AIBoardResponse): GenerateBoardResponse {
  const board: Board = {
    categories: data.categories.map((cat, catIndex) => ({
      name: cat.name,
      clues: cat.clues.map((clue, clueIndex) => ({
        value: clue.value,
        clueText: clue.clueText,
        correctResponse: clue.correctResponse,
        isRevealed: false,
        isDailyDouble:
          data.dailyDouble.categoryIndex === catIndex &&
          data.dailyDouble.clueIndex === clueIndex,
      })),
    })),
    dailyDoubleLocation: data.dailyDouble,
  };

  return { board, finalJeopardy: data.finalJeopardy };
}

// ── Fix Failing Clues (Haiku — fast and cheap) ──────────────────────────────

interface FixedClue {
  categoryIndex: number;
  clueIndex: number;
  clueText: string;
  correctResponse: string;
}

async function fixFailingClues(
  board: AIBoardResponse,
  failures: ClueValidationResult[]
): Promise<AIBoardResponse> {
  const clueDescriptions = failures.map((f, i) => {
    const catName =
      f.categoryIndex === -1
        ? "Final Jeopardy"
        : board.categories[f.categoryIndex]?.name ?? "Unknown";
    const value =
      f.categoryIndex === -1
        ? "Final"
        : `$${board.categories[f.categoryIndex]?.clues[f.clueIndex]?.value ?? "?"}`;
    return `${i + 1}. Category "${catName}", ${value}: clueText "${f.clueText}" correctResponse "${f.correctResponse}" — Problem: ${f.reason}`;
  });

  const userMessage = `Fix the following Jeopardy clues. Each clue reveals its answer in the clue text.
Generate a replacement clue for each that does NOT contain the answer word(s).

Clues to fix:
${clueDescriptions.join("\n")}

Respond with a JSON array of fixed clues:
[{ "categoryIndex": number, "clueIndex": number, "clueText": "new clue text", "correctResponse": "same answer" }]

Use categoryIndex -1 and clueIndex -1 for Final Jeopardy.`;

  try {
    const response = await client.messages.create({
      model: MODEL_FIX,
      max_tokens: 8000,
      system: FIX_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = extractTextFromResponse(response.content);
    const fixes: FixedClue[] = parseJSON<FixedClue[]>(text);

    const patched = structuredClone(board);
    for (const fix of fixes) {
      if (fix.categoryIndex === -1) {
        patched.finalJeopardy.clueText = fix.clueText;
        patched.finalJeopardy.correctResponse = fix.correctResponse;
      } else if (patched.categories[fix.categoryIndex]?.clues[fix.clueIndex]) {
        patched.categories[fix.categoryIndex].clues[fix.clueIndex].clueText = fix.clueText;
        patched.categories[fix.categoryIndex].clues[fix.clueIndex].correctResponse = fix.correctResponse;
      }
    }

    return patched;
  } catch (err) {
    console.error("Failed to fix clues, proceeding with original board:", err);
    return board;
  }
}

// ── Rapid Fire Generation ────────────────────────────────────────────────────

function buildRapidFireUserMessage(req: GenerateBoardRequest): string {
  const count = req.clueCount ?? 10;

  if (req.mode === "upload" && req.content) {
    return `Generate exactly ${count} rapid-fire Jeopardy clues based on the following source material.

Do not use outside knowledge — draw all clues from this content. Vary the subtopics across different aspects of the material.

SOURCE MATERIAL:
${req.content}`;
  }

  return `Generate exactly ${count} rapid-fire Jeopardy clues about: ${req.topic}
Use your general knowledge. Make it fun and varied with diverse subtopics.`;
}

function transformToRapidFire(data: AIRapidFireResponse): GenerateRapidFireResponse {
  const clues: RapidFireClue[] = data.clues.map((clue) => ({
    clueText: clue.clueText,
    correctResponse: clue.correctResponse,
    value: clue.value,
    subtopic: clue.subtopic,
    isRevealed: false,
  }));

  return { clues, finalJeopardy: data.finalJeopardy };
}

async function fixFailingRapidFireClues(
  board: AIRapidFireResponse,
  failures: ClueValidationResult[]
): Promise<AIRapidFireResponse> {
  const clueDescriptions = failures.map((f, i) => {
    if (f.categoryIndex === -1) {
      return `${i + 1}. Final Jeopardy: clueText "${f.clueText}" correctResponse "${f.correctResponse}" — Problem: ${f.reason}`;
    }
    const clue = board.clues[f.clueIndex];
    return `${i + 1}. Clue #${f.clueIndex + 1} (${clue?.subtopic ?? "Unknown"}, $${clue?.value ?? "?"}): clueText "${f.clueText}" correctResponse "${f.correctResponse}" — Problem: ${f.reason}`;
  });

  const userMessage = `Fix the following Jeopardy clues. Each clue reveals its answer in the clue text.
Generate a replacement clue for each that does NOT contain the answer word(s).

Clues to fix:
${clueDescriptions.join("\n")}

Respond with a JSON array of fixed clues:
[{ "clueIndex": number, "clueText": "new clue text", "correctResponse": "same answer" }]

Use clueIndex -1 for Final Jeopardy.`;

  try {
    const response = await client.messages.create({
      model: MODEL_FIX,
      max_tokens: 8000,
      system: FIX_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = extractTextFromResponse(response.content);
    const fixes: Array<{ clueIndex: number; clueText: string; correctResponse: string }> =
      parseJSON(text);

    const patched = structuredClone(board);
    for (const fix of fixes) {
      if (fix.clueIndex === -1) {
        patched.finalJeopardy.clueText = fix.clueText;
        patched.finalJeopardy.correctResponse = fix.correctResponse;
      } else if (patched.clues[fix.clueIndex]) {
        patched.clues[fix.clueIndex].clueText = fix.clueText;
        patched.clues[fix.clueIndex].correctResponse = fix.correctResponse;
      }
    }

    return patched;
  } catch (err) {
    console.error("Failed to fix rapid fire clues, proceeding with original:", err);
    return board;
  }
}

async function generateRapidFireBoard(
  req: GenerateBoardRequest
): Promise<GenerateRapidFireResponse> {
  checkApiKey();

  const userMessage = buildRapidFireUserMessage(req);
  let parsed: AIRapidFireResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL_GENERATE,
        max_tokens: 16000,
        thinking: { type: "enabled", budget_tokens: 10000 },
        system: RAPID_FIRE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text = extractTextFromResponse(response.content);
      parsed = parseJSON<AIRapidFireResponse>(text);
      break;
    } catch (err) {
      console.error(`Rapid fire generation attempt ${attempt + 1} failed:`, err);
      if (isAuthError(err)) {
        throw new Error("Invalid API key. Please check your ANTHROPIC_API_KEY in .env.local.");
      }
      if (attempt === 1) {
        throw new Error(`Rapid fire generation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (!parsed) {
    throw new Error("Rapid fire generation failed — please try again.");
  }

  // Validate and fix (up to MAX_VALIDATION_ROUNDS)
  for (let round = 0; round < MAX_VALIDATION_ROUNDS; round++) {
    const failures = validateRapidFireBoard(parsed);

    if (failures.length === 0) {
      console.log(
        round === 0
          ? "✓ All rapid fire clues passed validation"
          : `✓ All rapid fire clues passed validation after ${round} fix round(s)`
      );
      break;
    }

    console.warn(
      `⚠ Rapid fire validation round ${round + 1}: ${failures.length} clue(s) leak their answer:`,
      failures.map((f) => `[${f.clueIndex}] ${f.reason}`)
    );

    if (round === MAX_VALIDATION_ROUNDS - 1) {
      console.warn("Max validation rounds reached, accepting rapid fire clues with flagged issues");
      break;
    }

    parsed = await fixFailingRapidFireClues(parsed, failures);
  }

  return transformToRapidFire(parsed);
}

// ── Main Generation Function ─────────────────────────────────────────────────

const MAX_VALIDATION_ROUNDS = 2;

export async function generateBoard(
  req: GenerateBoardRequest
): Promise<GenerateBoardResponse | GenerateRapidFireResponse> {
  // Dispatch to rapid fire if requested
  if (req.gameMode === "rapid_fire") {
    return generateRapidFireBoard(req);
  }

  checkApiKey();

  // Topic mode: parallel generation (2 chunks of 3 categories)
  // Upload mode: single call (needs full document context)
  let parsed: AIBoardResponse;
  if (req.mode === "topic") {
    parsed = await generateBoardParallel(req);
  } else {
    parsed = await generateBoardSingle(req);
  }

  // Validate and fix (up to MAX_VALIDATION_ROUNDS)
  for (let round = 0; round < MAX_VALIDATION_ROUNDS; round++) {
    const failures = validateBoard(parsed);

    if (failures.length === 0) {
      console.log(
        round === 0
          ? "✓ All clues passed validation"
          : `✓ All clues passed validation after ${round} fix round(s)`
      );
      break;
    }

    console.warn(
      `⚠ Validation round ${round + 1}: ${failures.length} clue(s) leak their answer:`,
      failures.map((f) => `[${f.categoryIndex},${f.clueIndex}] ${f.reason}`)
    );

    if (round === MAX_VALIDATION_ROUNDS - 1) {
      console.warn("Max validation rounds reached, accepting board with flagged clues");
      break;
    }

    parsed = await fixFailingClues(parsed, failures);
  }

  return transformToBoard(parsed);
}
