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

  return db;
}

export function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim();
}

/** Look up a random cached board for the given topic + mode */
export function getCachedBoard(
  db: Database.Database,
  topic: string,
  gameMode: GameMode,
  clueCount?: number
): CachedBoard | undefined {
  const normalized = normalizeTopic(topic);

  if (gameMode === "rapid_fire" && clueCount) {
    const stmt = db.prepare(
      `SELECT * FROM boards WHERE topic = ? AND game_mode = ? AND clue_count = ? ORDER BY RANDOM() LIMIT 1`
    );
    return stmt.get(normalized, gameMode, clueCount) as CachedBoard | undefined;
  }

  const stmt = db.prepare(
    `SELECT * FROM boards WHERE topic = ? AND game_mode = ? ORDER BY RANDOM() LIMIT 1`
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
  clueCount?: number
): void {
  const id = nanoid();
  const normalized = normalizeTopic(topic);

  db.prepare(`
    INSERT INTO boards (id, topic, game_mode, board_json, final_json, model, clue_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, normalized, gameMode, boardJson, finalJson, model, clueCount ?? null, Date.now());
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
