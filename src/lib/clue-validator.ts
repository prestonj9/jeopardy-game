import type { AIBoardResponse } from "./ai-generator";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClueValidationResult {
  valid: boolean;
  reason?: string;
  clueText: string;
  correctResponse: string;
  categoryIndex: number; // -1 for Final Jeopardy
  clueIndex: number; // -1 for Final Jeopardy
}

// ── Stop words to skip during token matching ─────────────────────────────────

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "been",
  "were",
  "they",
  "their",
  "them",
  "what",
  "when",
  "where",
  "which",
  "there",
  "these",
  "those",
  "about",
  "into",
  "over",
  "also",
  "than",
  "then",
  "some",
  "very",
  "just",
  "does",
  "will",
  "would",
  "could",
  "should",
  "being",
  "after",
  "before",
  "between",
  "under",
  "other",
]);

// ── Answer Extraction ────────────────────────────────────────────────────────

/**
 * Extracts the core answer string from a Jeopardy-style correctResponse.
 * "What is Paris?" → "paris"
 * "Who is Abraham Lincoln?" → "abraham lincoln"
 * "What are the Rocky Mountains?" → "rocky mountains"
 */
export function extractAnswer(correctResponse: string): string {
  let answer = correctResponse
    .replace(/^(what|who)\s+(is|are)\s+/i, "")
    .replace(/\?+$/, "")
    .trim();

  // Strip leading articles
  answer = answer.replace(/^(the|a|an)\s+/i, "").trim();

  return answer.toLowerCase();
}

// ── Token Generation ─────────────────────────────────────────────────────────

/**
 * Generates meaningful tokens from the answer for partial-match checking.
 * "Abraham Lincoln" → ["abraham lincoln", "abraham", "lincoln"]
 * "Rocky Mountains" → ["rocky mountains", "rocky", "mountains"]
 * Filters out short words (< 4 chars) and common stop words for individual tokens.
 */
export function getAnswerTokens(answer: string): string[] {
  const tokens: string[] = [];

  // Always include the full answer as the first token
  if (answer.length > 0) {
    tokens.push(answer);
  }

  // Split into individual words
  const words = answer.split(/\s+/).filter((w) => w.length > 0);

  // For multi-word answers, generate bigrams
  if (words.length >= 3) {
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!tokens.includes(bigram)) {
        tokens.push(bigram);
      }
    }
  }

  // Add individual significant words (4+ chars, not stop words)
  for (const word of words) {
    if (word.length >= 4 && !STOP_WORDS.has(word) && !tokens.includes(word)) {
      tokens.push(word);
    }
  }

  return tokens;
}

// ── Single Clue Validation ───────────────────────────────────────────────────

/**
 * Checks whether a clue's text reveals its answer.
 * Uses word-boundary regex to avoid false positives (e.g. "mars" in "marshlands").
 */
export function validateClue(
  clueText: string,
  correctResponse: string,
  categoryIndex: number,
  clueIndex: number
): ClueValidationResult {
  const answer = extractAnswer(correctResponse);

  // Skip validation for very short answers (< 3 chars) — too prone to false positives
  if (answer.length < 3) {
    return { valid: true, clueText, correctResponse, categoryIndex, clueIndex };
  }

  const normalizedClue = clueText.toLowerCase();
  const tokens = getAnswerTokens(answer);

  for (const token of tokens) {
    // Escape regex special characters in the token
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Use word boundary matching
    const regex = new RegExp(`\\b${escaped}\\b`, "i");

    if (regex.test(normalizedClue)) {
      return {
        valid: false,
        reason: `Answer "${token}" found in clue text`,
        clueText,
        correctResponse,
        categoryIndex,
        clueIndex,
      };
    }
  }

  return { valid: true, clueText, correctResponse, categoryIndex, clueIndex };
}

// ── Full Board Validation ────────────────────────────────────────────────────

/**
 * Validates all 31 clues (30 board + 1 Final Jeopardy).
 * Returns only the failures (empty array = all passed).
 */
export function validateBoard(data: AIBoardResponse): ClueValidationResult[] {
  const failures: ClueValidationResult[] = [];

  // Validate board clues
  for (let catIdx = 0; catIdx < data.categories.length; catIdx++) {
    const category = data.categories[catIdx];
    for (let clueIdx = 0; clueIdx < category.clues.length; clueIdx++) {
      const clue = category.clues[clueIdx];
      const result = validateClue(
        clue.clueText,
        clue.correctResponse,
        catIdx,
        clueIdx
      );
      if (!result.valid) {
        failures.push(result);
      }
    }
  }

  // Validate Final Jeopardy
  if (data.finalJeopardy) {
    const result = validateClue(
      data.finalJeopardy.clueText,
      data.finalJeopardy.correctResponse,
      -1,
      -1
    );
    if (!result.valid) {
      failures.push(result);
    }
  }

  return failures;
}
