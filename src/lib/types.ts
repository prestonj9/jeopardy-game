// ── Game Status ──────────────────────────────────────────────────────────────

export const GameStatus = {
  LOBBY: "lobby",
  ACTIVE: "active",
  FINAL_JEOPARDY: "final_jeopardy",
  FINISHED: "finished",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

// ── Clue State ──────────────────────────────────────────────────────────────

export const ClueState = {
  SHOWING_CLUE: "showing_clue",
  BUZZING_OPEN: "buzzing_open",
  PLAYER_ANSWERING: "player_answering",
  DAILY_DOUBLE_WAGER: "daily_double_wager",
  AWAITING_REVEAL: "awaiting_reveal",
  ANSWER_REVEALED: "answer_revealed",
} as const;
export type ClueState = (typeof ClueState)[keyof typeof ClueState];

// ── Final Jeopardy State ────────────────────────────────────────────────────

export const FinalState = {
  NOT_STARTED: "not_started",
  SHOW_CATEGORY: "show_category",
  WAGERING: "wagering",
  ANSWERING: "answering",
  REVEALING: "revealing",
  WINNER: "winner",
} as const;
export type FinalState = (typeof FinalState)[keyof typeof FinalState];

export const RevealStep = {
  FOCUS: "focus",
  ANSWER: "answer",
  JUDGED: "judged",
  WAGER: "wager",
  SCORE: "score",
} as const;
export type RevealStep = (typeof RevealStep)[keyof typeof RevealStep];

// ── Core Data Models ────────────────────────────────────────────────────────

export interface Clue {
  value: number; // 200, 400, 600, 800, 1000
  clueText: string; // the prompt shown on screen
  correctResponse: string; // "What is..." — visible only to host
  isRevealed: boolean;
  isDailyDouble: boolean;
}

export interface Category {
  name: string;
  clues: Clue[]; // exactly 5, index 0=$200 through index 4=$1000
}

export interface Board {
  categories: Category[]; // exactly 6
  dailyDoubleLocation: { categoryIndex: number; clueIndex: number };
}

export interface Player {
  id: string; // nanoid
  socketId: string;
  name: string;
  score: number; // can go negative
  isConnected: boolean;
  finalWager: number | null;
  finalAnswer: string | null;
}

export interface BuzzEntry {
  playerId: string;
  timestamp: number; // server-side Date.now()
}

export interface ActiveClue {
  categoryIndex: number;
  clueIndex: number;
  state: ClueState;
  answeringPlayerId: string | null;
  dailyDoubleWager: number | null;
  buzzWindowOpenedAt: number;
  playersWhoAttempted: Set<string>;
}

export interface FinalJeopardyState {
  category: string;
  clueText: string;
  correctResponse: string;
  state: FinalState;
  submissions: Map<string, { wager: number; answer: string }>;
  // Reveal sequence state
  revealOrder: string[]; // player IDs sorted by lowest score first
  currentRevealIndex: number; // -1 = pre-reveal, 0..N-1 = active player
  currentRevealStep: RevealStep;
  judgments: Map<string, boolean>; // playerId → correct
  preRevealScores: Record<string, number>; // snapshot of scores entering reveal
}

// ── Countdown Type ────────────────────────────────────────────────────────────

export type CountdownType = "reading" | "buzz_window" | "answer" | "final_answer";

export interface Game {
  id: string; // nanoid, 6 chars uppercase — also the join code
  hostSocketId: string;
  displaySocketIds: Set<string>; // passive viewer sockets (TV/projector)
  status: GameStatus;
  board: Board;
  boardStatus: "generating" | "ready" | "failed";
  boardError?: string;
  generationParams?: GenerateBoardRequest;
  startRequested: boolean; // true if host clicked Start before board was ready
  players: Map<string, Player>; // keyed by player.id
  currentClue: ActiveClue | null;
  buzzOrder: BuzzEntry[];
  buzzDelayTimer: ReturnType<typeof setTimeout> | null; // 4s reading countdown
  buzzWindowTimer: ReturnType<typeof setTimeout> | null; // 10s buzz-in window
  answerTimer: ReturnType<typeof setTimeout> | null; // 5s answer countdown
  finalJeopardy: FinalJeopardyState;
  finalAnswerTimer: ReturnType<typeof setTimeout> | null;
  lastCorrectPlayerId: string | null;
  createdAt: number;
}

// ── Serializable Types (for socket transmission) ────────────────────────────

export interface SerializablePlayer {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
}

export interface SerializableClue {
  value: number;
  clueText: string;
  isRevealed: boolean;
  isDailyDouble: boolean;
  // correctResponse intentionally omitted for players
}

export interface SerializableHostClue extends SerializableClue {
  correctResponse: string;
}

export interface SerializableCategory {
  name: string;
  clues: SerializableClue[];
}

export interface SerializableBoard {
  categories: SerializableCategory[];
  dailyDoubleLocation: { categoryIndex: number; clueIndex: number };
}

export type ScoreMap = Record<string, number>; // playerId -> score

export interface SerializableGameState {
  id: string;
  status: GameStatus;
  players: SerializablePlayer[];
  board: SerializableBoard;
  currentClue: {
    categoryIndex: number;
    clueIndex: number;
    state: ClueState;
    answeringPlayerId: string | null;
    dailyDoubleWager: number | null;
    playersWhoAttempted: string[];
    revealedCorrectResponse?: string;
  } | null;
  buzzOrder: BuzzEntry[];
  finalJeopardy: {
    category: string;
    clueText: string;
    state: FinalState;
    submissions: Record<string, { wager: number; answer: string }>;
    revealOrder: string[];
    currentRevealIndex: number;
    currentRevealStep: RevealStep;
    judgments: Record<string, boolean>;
    preRevealScores: Record<string, number>;
  };
  lastCorrectPlayerId: string | null;
  scores: ScoreMap;
  boardStatus: "generating" | "ready" | "failed";
  boardError?: string;
}

// ── AI Board Response (shared between generator & validator) ─────────────────

export interface AIBoardResponse {
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

// ── API Types ───────────────────────────────────────────────────────────────

export interface GenerateBoardRequest {
  mode: "topic" | "upload";
  topic?: string; // max 500 chars
  content?: string; // extracted text from uploaded file; truncate to 50,000 chars
}

export interface GenerateBoardResponse {
  board: Board;
  finalJeopardy: {
    category: string;
    clueText: string;
    correctResponse: string;
  };
}

// ── Socket.io Event Types ───────────────────────────────────────────────────

export interface ServerToClientEvents {
  "game:joined": (data: {
    playerId: string;
    gameState: SerializableGameState;
  }) => void;
  "game:player_joined": (data: SerializablePlayer) => void;
  "game:player_left": (data: { playerId: string }) => void;
  "game:started": () => void;
  "game:clue_selected": (data: {
    categoryIndex: number;
    clueIndex: number;
    clueText: string;
    value: number;
    isDailyDouble: boolean;
  }) => void;
  "game:daily_double_wager_prompt": (data: { maxWager: number }) => void;
  "game:buzzing_open": () => void;
  "game:player_buzzed": (data: {
    playerId: string;
    playerName: string;
  }) => void;
  "game:judge_result": (data: {
    playerId: string;
    correct: boolean;
    scores: ScoreMap;
    clueComplete: boolean;
  }) => void;
  "game:clue_complete": (data: { correctResponse: string }) => void;
  "game:answer_revealed": (data: { correctResponse: string }) => void;
  "game:final_started": (data: { category: string }) => void;
  "game:final_advanced": (data: { newState: FinalState }) => void;
  "game:final_clue": (data: { clueText: string }) => void;
  "game:final_judge_result": (data: {
    playerId: string;
    playerName: string;
    correct: boolean;
    wager: number;
    answer: string;
    finalScores: ScoreMap;
  }) => void;
  "game:reveal_score_update": (data: {
    playerId: string;
    newScore: number;
    finalScores: ScoreMap;
  }) => void;
  "game:finished": (data: { finalScores: ScoreMap }) => void;
  "game:buzz_countdown": (data: { secondsRemaining: number; type: CountdownType; totalSeconds: number }) => void;
  "game:error": (data: { message: string }) => void;
  "game:state_sync": (data: SerializableGameState) => void;
  "game:host_clue_answer": (data: { correctResponse: string }) => void;
  "game:new_round_loading": () => void;
  "game:board_ready": () => void;
  "game:board_failed": (data: { error: string }) => void;
}

export interface ClientToServerEvents {
  "host:create_game": (data: {
    gameId: string;
  }) => void;
  "display:join": (data: { gameId: string }) => void;
  "host:start_game": () => void;
  "host:select_clue": (data: {
    categoryIndex: number;
    clueIndex: number;
  }) => void;
  "host:judge": (data: { correct: boolean }) => void;
  "host:skip_clue": () => void;
  "host:reveal_answer": () => void;
  "host:start_final": () => void;
  "host:advance_final": () => void;
  "host:reveal_advance": () => void;
  "host:judge_final": (data: {
    playerId: string;
    correct: boolean;
  }) => void;
  "player:join": (
    data: { gameId: string; playerName: string },
    callback: (result: {
      success: boolean;
      playerId?: string;
      error?: string;
    }) => void
  ) => void;
  "player:buzz": () => void;
  "player:daily_double_wager": (data: { amount: number }) => void;
  "player:final_wager": (data: { amount: number }) => void;
  "player:final_answer": (data: { answer: string }) => void;
  "host:new_round": (data: { topic: string }) => void;
  "host:retry_generation": () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  gameId?: string;
  playerId?: string;
  isHost?: boolean;
  isDisplay?: boolean;
}
