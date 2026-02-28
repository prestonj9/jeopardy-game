import Database from "better-sqlite3";
import { customAlphabet } from "nanoid";
import type { GameMode, GenerateBoardResponse, GenerateRapidFireResponse } from "./types.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

/** Stop growing the pool for a topic once it reaches this many boards */
export const MAX_POOL_SIZE = 50;

export interface CachedBoard {
  id: string;
  topic: string;
  game_mode: GameMode;
  board_json: string;
  final_json: string;
  model: string;
  clue_count: number | null;
  created_at: number;
  times_served: number;
  subtopics_used: string | null;
}

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      game_mode TEXT NOT NULL,
      board_json TEXT NOT NULL,
      final_json TEXT NOT NULL,
      model TEXT NOT NULL,
      clue_count INTEGER,
      created_at INTEGER NOT NULL,
      times_served INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_boards_topic_mode ON boards(topic, game_mode);
  `);

  // Migration: add subtopics_used column to boards if missing
  try {
    db.exec(`ALTER TABLE boards ADD COLUMN subtopics_used TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Subtopics table for diversity-driven generation
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtopics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      subtopic TEXT NOT NULL,
      times_used INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(topic, subtopic)
    );
    CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic);
  `);

  return db;
}

export function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim();
}

// ── Board Cache Functions ────────────────────────────────────────────────────

/** Look up a cached board for the given topic + mode, preferring least-served */
export function getCachedBoard(
  db: Database.Database,
  topic: string,
  gameMode: GameMode,
  clueCount?: number
): CachedBoard | undefined {
  const normalized = normalizeTopic(topic);

  if (gameMode === "rapid_fire" && clueCount) {
    const stmt = db.prepare(
      `SELECT * FROM boards WHERE topic = ? AND game_mode = ? AND clue_count = ? ORDER BY times_served ASC, RANDOM() LIMIT 1`
    );
    return stmt.get(normalized, gameMode, clueCount) as CachedBoard | undefined;
  }

  const stmt = db.prepare(
    `SELECT * FROM boards WHERE topic = ? AND game_mode = ? ORDER BY times_served ASC, RANDOM() LIMIT 1`
  );
  return stmt.get(normalized, gameMode) as CachedBoard | undefined;
}

/** Increment times_served counter for a cached board */
export function incrementServed(db: Database.Database, id: string): void {
  db.prepare(`UPDATE boards SET times_served = times_served + 1 WHERE id = ?`).run(id);
}

/** Save a generated board to the cache */
export function saveBoard(
  db: Database.Database,
  topic: string,
  gameMode: GameMode,
  boardJson: string,
  finalJson: string,
  model: string,
  clueCount?: number,
  subtopicsUsed?: string[]
): void {
  const id = nanoid();
  const normalized = normalizeTopic(topic);

  db.prepare(`
    INSERT INTO boards (id, topic, game_mode, board_json, final_json, model, clue_count, created_at, subtopics_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, normalized, gameMode, boardJson, finalJson, model,
    clueCount ?? null, Date.now(),
    subtopicsUsed ? JSON.stringify(subtopicsUsed) : null
  );
}

/** Count how many boards exist for a given topic + mode */
export function getPoolCount(
  db: Database.Database,
  topic: string,
  gameMode: GameMode,
  clueCount?: number
): number {
  const normalized = normalizeTopic(topic);

  if (gameMode === "rapid_fire" && clueCount) {
    const stmt = db.prepare(
      `SELECT COUNT(*) as count FROM boards WHERE topic = ? AND game_mode = ? AND clue_count = ?`
    );
    return (stmt.get(normalized, gameMode, clueCount) as { count: number }).count;
  }

  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM boards WHERE topic = ? AND game_mode = ?`
  );
  return (stmt.get(normalized, gameMode) as { count: number }).count;
}

/** Parse a cached board into the appropriate response type */
export function parseCachedClassic(cached: CachedBoard): GenerateBoardResponse {
  return {
    board: JSON.parse(cached.board_json),
    finalJeopardy: JSON.parse(cached.final_json),
  };
}

export function parseCachedRapidFire(cached: CachedBoard): GenerateRapidFireResponse {
  return {
    clues: JSON.parse(cached.board_json),
    finalJeopardy: JSON.parse(cached.final_json),
  };
}

// ── Subtopic Functions ───────────────────────────────────────────────────────

/** Count how many subtopics exist for a topic */
export function getSubtopicCount(db: Database.Database, topic: string): number {
  const normalized = normalizeTopic(topic);
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM subtopics WHERE topic = ?`
  ).get(normalized) as { count: number };
  return row.count;
}

/** Pick the N least-used subtopics for a topic (breaks ties randomly) */
export function pickSubtopics(db: Database.Database, topic: string, count: number): string[] {
  const normalized = normalizeTopic(topic);
  const rows = db.prepare(
    `SELECT subtopic FROM subtopics WHERE topic = ? ORDER BY times_used ASC, RANDOM() LIMIT ?`
  ).all(normalized, count) as Array<{ subtopic: string }>;
  return rows.map((r) => r.subtopic);
}

/** Increment times_used for a list of subtopics */
export function markSubtopicsUsed(db: Database.Database, topic: string, subtopics: string[]): void {
  const normalized = normalizeTopic(topic);
  const stmt = db.prepare(
    `UPDATE subtopics SET times_used = times_used + 1 WHERE topic = ? AND subtopic = ?`
  );
  for (const sub of subtopics) {
    stmt.run(normalized, sub);
  }
}

/** Bulk insert subtopics (INSERT OR IGNORE handles concurrent inserts and duplicates) */
export function saveSubtopics(db: Database.Database, topic: string, subtopics: string[]): void {
  const normalized = normalizeTopic(topic);
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO subtopics (topic, subtopic, created_at) VALUES (?, ?, ?)`
  );
  const now = Date.now();
  for (const sub of subtopics) {
    stmt.run(normalized, sub.trim(), now);
  }
}

/** Get all existing subtopic texts for a topic (for exclusion during regeneration) */
export function getExistingSubtopics(db: Database.Database, topic: string): string[] {
  const normalized = normalizeTopic(topic);
  const rows = db.prepare(
    `SELECT subtopic FROM subtopics WHERE topic = ?`
  ).all(normalized) as Array<{ subtopic: string }>;
  return rows.map((r) => r.subtopic);
}

/** Get the minimum times_used value for a topic's subtopics (for staleness detection) */
export function getMinSubtopicUsage(db: Database.Database, topic: string): number | null {
  const normalized = normalizeTopic(topic);
  const row = db.prepare(
    `SELECT MIN(times_used) as min_used FROM subtopics WHERE topic = ?`
  ).get(normalized) as { min_used: number | null };
  return row.min_used;
}
