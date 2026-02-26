import Anthropic from "@anthropic-ai/sdk";
import type { AIBoardResponse, Board, GenerateBoardRequest, GenerateBoardResponse } from "./types.ts";
import { validateBoard, type ClueValidationResult } from "./clue-validator.ts";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a Jeopardy game board generator. Create engaging, accurate trivia content.

Rules:
- Generate exactly 6 categories with creative, punny, or thematic names (like real Jeopardy)
- Each category has exactly 5 clues at values $200, $400, $600, $800, $1000
- $200 = easy/obvious, $1000 = requires deep knowledge or clever thinking
- Each clue must be a declarative statement (the "answer" in Jeopardy terms)
- Each correctResponse must be phrased as a question: "What is..." or "Who is..."
- Clues must be unambiguous with one clear correct response
- Generate 1 Final Jeopardy clue with its own unique category name
- Assign exactly one Daily Double to a non-$200 clue (clueIndex 1-4)
- CRITICAL: The clueText must NEVER contain the answer. The correctResponse word(s) must not appear anywhere in the clueText, even partially. The player needs to GUESS the answer — if it's in the clue, the question is broken.
  - BAD: clueText "Paris, the capital of France, has this tower" with correctResponse "What is Paris?" — "Paris" is in the clue!
  - BAD: clueText "This element Oxygen makes up 21% of the atmosphere" with correctResponse "What is Oxygen?" — "Oxygen" is in the clue!
  - GOOD: clueText "This City of Light is home to the Eiffel Tower" with correctResponse "What is Paris?" — answer not revealed
  - GOOD: clueText "This element makes up about 21% of Earth's atmosphere" with correctResponse "What is Oxygen?" — answer not revealed
- Use descriptive language, context clues, and indirect references instead of naming the answer.
- Before outputting, review every clue to verify the answer does not appear in the clue text. Rewrite any that do.

STRUCTURED CONTENT DETECTION:
When given source material, first check if it contains pre-structured Jeopardy content:
- If the content has EXACTLY 6 categories, each with EXACTLY 5 clue/answer pairs (30 total clues), use the provided content VERBATIM:
  - Use the provided category names exactly as given
  - Use the provided clue texts exactly as given
  - Use the provided answers exactly as given, formatted as "What is..." or "Who is..." questions
  - Assign dollar values $200-$1000 to the 5 clues in each category in order: $200, $400, $600, $800, $1000
  - You must still assign exactly one Daily Double to a non-$200 clue
  - If a Final Jeopardy clue is provided in the content, use it verbatim. If not, generate one based on the subject matter of the categories.
- If the content does NOT match this exact structure (wrong number of categories, wrong number of clues, or is just general text/notes), treat it as unstructured source material and generate original clues from it as normal.

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

function buildUserMessage(req: GenerateBoardRequest): string {
  if (req.mode === "upload" && req.content) {
    return `Generate a complete Jeopardy board based on the following source material.

IMPORTANT: First, determine if this content is pre-structured Jeopardy content (exactly 6 categories with exactly 5 clue/answer pairs each). If it is, use the clues VERBATIM as described in your instructions. If it's general text, generate original clues from it.

Do not use outside knowledge — draw all clues from this content.

SOURCE MATERIAL:
${req.content}`;
  }

  return `Generate a complete Jeopardy board about: ${req.topic}
Use your general knowledge. Make it fun and varied.`;
}

function parseResponse(text: string): AIBoardResponse {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(cleaned) as AIBoardResponse;
}

function transformToBoard(data: AIBoardResponse): GenerateBoardResponse {
  const board: Board = {
    categories: data.categories.map((cat) => ({
      name: cat.name,
      clues: cat.clues.map((clue, clueIndex) => ({
        value: clue.value,
        clueText: clue.clueText,
        correctResponse: clue.correctResponse,
        isRevealed: false,
        isDailyDouble:
          data.dailyDouble.categoryIndex ===
            data.categories.indexOf(cat) &&
          data.dailyDouble.clueIndex === clueIndex,
      })),
    })),
    dailyDoubleLocation: data.dailyDouble,
  };

  return {
    board,
    finalJeopardy: data.finalJeopardy,
  };
}

// ── Fix Failing Clues ────────────────────────────────────────────────────────

const FIX_SYSTEM_PROMPT = `You are a Jeopardy clue fixer. You will receive clues that have a problem: the answer is revealed in the clue text. Generate a replacement clue for each that does NOT contain the answer.

Rules:
- Keep the same category context and dollar value difficulty level
- The replacement clueText must NOT contain any word from the correctResponse
- Keep the same correctResponse (answer) — only rewrite the clueText
- Use descriptive language, context clues, and indirect references
- Respond with ONLY valid JSON — no markdown, no explanation, no code fences`;

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
  // Build a description of the failing clues
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
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: FIX_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const fixes: FixedClue[] = JSON.parse(cleaned);

    // Patch fixes into the board
    const patched = structuredClone(board);
    for (const fix of fixes) {
      if (fix.categoryIndex === -1) {
        patched.finalJeopardy.clueText = fix.clueText;
        patched.finalJeopardy.correctResponse = fix.correctResponse;
      } else if (
        patched.categories[fix.categoryIndex]?.clues[fix.clueIndex]
      ) {
        patched.categories[fix.categoryIndex].clues[fix.clueIndex].clueText =
          fix.clueText;
        patched.categories[fix.categoryIndex].clues[
          fix.clueIndex
        ].correctResponse = fix.correctResponse;
      }
    }

    return patched;
  } catch (err) {
    console.error("Failed to fix clues, proceeding with original board:", err);
    return board;
  }
}

// ── Main Generation Function ─────────────────────────────────────────────────

const MAX_VALIDATION_ROUNDS = 2;

export async function generateBoard(
  req: GenerateBoardRequest
): Promise<GenerateBoardResponse> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("xxxxx")) {
    throw new Error(
      "Missing or invalid ANTHROPIC_API_KEY. Add a valid key to your .env.local file."
    );
  }

  const userMessage = buildUserMessage(req);

  // Step 1: Generate the initial board (with retry on parse/network errors)
  let parsed: AIBoardResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      parsed = parseResponse(text);
      break;
    } catch (err) {
      console.error(`Board generation attempt ${attempt + 1} failed:`, err);

      // Don't retry on authentication errors
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("authentication") || errMsg.includes("401") || errMsg.includes("api-key")) {
        throw new Error(
          "Invalid API key. Please check your ANTHROPIC_API_KEY in .env.local."
        );
      }

      if (attempt === 1) {
        throw new Error(
          `Board generation failed: ${errMsg}`
        );
      }
      // Retry once on parse/network errors
    }
  }

  if (!parsed) {
    throw new Error("Board generation failed — please try again.");
  }

  // Step 2: Validate and fix (up to MAX_VALIDATION_ROUNDS)
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
      console.warn(
        "Max validation rounds reached, accepting board with flagged clues"
      );
      break;
    }

    // Fix the failing clues with a targeted API call
    parsed = await fixFailingClues(parsed, failures);
  }

  return transformToBoard(parsed);
}
