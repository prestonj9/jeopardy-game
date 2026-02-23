import Anthropic from "@anthropic-ai/sdk";
import type { Board, GenerateBoardRequest, GenerateBoardResponse } from "./types.ts";

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
Draw all clues from this content — do not use outside knowledge.

SOURCE MATERIAL:
${req.content}`;
  }

  return `Generate a complete Jeopardy board about: ${req.topic}
Use your general knowledge. Make it fun and varied.`;
}

interface AIBoardResponse {
  categories: Array<{
    name: string;
    clues: Array<{
      value: number;
      clueText: string;
      correctResponse: string;
    }>;
  }>;
  dailyDouble: { categoryIndex: number; clueIndex: number };
  finalJeopardy: {
    category: string;
    clueText: string;
    correctResponse: string;
  };
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

export async function generateBoard(
  req: GenerateBoardRequest
): Promise<GenerateBoardResponse> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("xxxxx")) {
    throw new Error(
      "Missing or invalid ANTHROPIC_API_KEY. Add a valid key to your .env.local file."
    );
  }

  const userMessage = buildUserMessage(req);

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
      const parsed = parseResponse(text);
      return transformToBoard(parsed);
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

  throw new Error("Board generation failed — please try again.");
}
