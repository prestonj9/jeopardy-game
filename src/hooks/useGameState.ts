"use client";

import { useEffect, useReducer } from "react";
import type { TypedSocket } from "./useSocket";
import type {
  SerializableGameState,
  ServerToClientEvents,
  ScoreMap,
  FinalState,
  SerializablePlayer,
  CountdownType,
} from "@/lib/types";

type GameAction =
  | { type: "SET_STATE"; state: SerializableGameState }
  | { type: "PLAYER_JOINED"; player: SerializablePlayer }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "UPDATE_SCORES"; scores: ScoreMap }
  | { type: "GAME_STARTED" }
  | {
      type: "CLUE_SELECTED";
      data: {
        categoryIndex: number;
        clueIndex: number;
        clueText: string;
        value: number;
        isDailyDouble: boolean;
      };
    }
  | { type: "BUZZING_OPEN" }
  | {
      type: "PLAYER_BUZZED";
      data: { playerId: string; playerName: string };
    }
  | {
      type: "JUDGE_RESULT";
      data: {
        playerId: string;
        correct: boolean;
        scores: ScoreMap;
        clueComplete: boolean;
      };
    }
  | { type: "CLUE_COMPLETE"; correctResponse: string }
  | { type: "ANSWER_REVEALED"; correctResponse: string }
  | { type: "FINAL_STARTED"; category: string }
  | { type: "FINAL_ADVANCED"; newState: FinalState }
  | { type: "FINAL_CLUE"; clueText: string }
  | {
      type: "FINAL_JUDGE_RESULT";
      data: {
        playerId: string;
        playerName: string;
        correct: boolean;
        wager: number;
        answer: string;
        finalScores: ScoreMap;
      };
    }
  | { type: "REVEAL_SCORE_UPDATE"; data: { playerId: string; newScore: number; finalScores: ScoreMap } }
  | { type: "GAME_FINISHED"; finalScores: ScoreMap }
  | { type: "BUZZ_COUNTDOWN"; secondsRemaining: number; countdownType: CountdownType; totalSeconds: number }
  | { type: "NEW_ROUND_LOADING" };

interface GameUIState {
  gameState: SerializableGameState | null;
  lastJudgeResult: {
    playerId: string;
    correct: boolean;
  } | null;
  lastCorrectResponse: string | null;
  lastFinalResult: {
    playerId: string;
    playerName: string;
    correct: boolean;
    wager: number;
    answer: string;
  } | null;
  buzzCountdown: number | null;
  countdownType: CountdownType | null;
  countdownTotalSeconds: number | null;
  isNewRoundLoading: boolean;
  revealedAnswer: string | null;
}

function gameReducer(state: GameUIState, action: GameAction): GameUIState {
  switch (action.type) {
    case "SET_STATE":
      return {
        ...state,
        gameState: action.state,
        isNewRoundLoading: false,
        revealedAnswer: action.state.currentClue?.revealedCorrectResponse ?? state.revealedAnswer,
      };

    case "PLAYER_JOINED":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          players: [
            ...state.gameState.players.filter(
              (p) => p.id !== action.player.id
            ),
            action.player,
          ],
        },
      };

    case "PLAYER_LEFT":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          players: state.gameState.players.map((p) =>
            p.id === action.playerId
              ? { ...p, isConnected: false }
              : p
          ),
        },
      };

    case "UPDATE_SCORES":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          scores: action.scores,
          players: state.gameState.players.map((p) => ({
            ...p,
            score: action.scores[p.id] ?? p.score,
          })),
        },
      };

    case "GAME_STARTED":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: { ...state.gameState, status: "active" },
      };

    case "CLUE_SELECTED":
      if (!state.gameState) return state;
      return {
        ...state,
        lastJudgeResult: null,
        lastCorrectResponse: null,
        revealedAnswer: null,
        gameState: {
          ...state.gameState,
          currentClue: {
            categoryIndex: action.data.categoryIndex,
            clueIndex: action.data.clueIndex,
            state: action.data.isDailyDouble
              ? "daily_double_wager"
              : "showing_clue",
            answeringPlayerId: null,
            dailyDoubleWager: null,
            playersWhoAttempted: [],
          },
        },
      };

    case "BUZZ_COUNTDOWN":
      return {
        ...state,
        buzzCountdown: action.secondsRemaining,
        countdownType: action.countdownType,
        countdownTotalSeconds: action.totalSeconds,
      };

    case "BUZZING_OPEN":
      if (!state.gameState?.currentClue) return state;
      return {
        ...state,
        buzzCountdown: null,
        countdownType: null,
        countdownTotalSeconds: null,
        gameState: {
          ...state.gameState,
          currentClue: {
            ...state.gameState.currentClue,
            state: "buzzing_open",
          },
        },
      };

    case "PLAYER_BUZZED":
      if (!state.gameState?.currentClue) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          currentClue: {
            ...state.gameState.currentClue,
            state: "player_answering",
            answeringPlayerId: action.data.playerId,
          },
        },
      };

    case "JUDGE_RESULT":
      if (!state.gameState) return state;
      const updatedState: GameUIState = {
        ...state,
        lastJudgeResult: {
          playerId: action.data.playerId,
          correct: action.data.correct,
        },
        gameState: {
          ...state.gameState,
          scores: action.data.scores,
          players: state.gameState.players.map((p) => ({
            ...p,
            score: action.data.scores[p.id] ?? p.score,
          })),
        },
      };
      if (action.data.clueComplete) {
        updatedState.gameState!.currentClue = null;
      } else if (updatedState.gameState!.currentClue) {
        updatedState.gameState!.currentClue = {
          ...updatedState.gameState!.currentClue!,
          state: "buzzing_open",
          answeringPlayerId: null,
          playersWhoAttempted: [
            ...updatedState.gameState!.currentClue!.playersWhoAttempted,
            action.data.playerId,
          ],
        };
      }
      return updatedState;

    case "ANSWER_REVEALED":
      if (!state.gameState?.currentClue) return state;
      return {
        ...state,
        revealedAnswer: action.correctResponse,
        gameState: {
          ...state.gameState,
          currentClue: {
            ...state.gameState.currentClue,
            state: "answer_revealed",
          },
        },
      };

    case "CLUE_COMPLETE":
      if (!state.gameState) return state;
      return {
        ...state,
        buzzCountdown: null,
        countdownType: null,
        countdownTotalSeconds: null,
        lastCorrectResponse: action.correctResponse,
        revealedAnswer: null,
        gameState: {
          ...state.gameState,
          currentClue: null,
        },
      };

    case "FINAL_STARTED":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          status: "final_jeopardy",
          finalJeopardy: {
            ...state.gameState.finalJeopardy,
            state: "show_category",
          },
        },
      };

    case "FINAL_ADVANCED":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          finalJeopardy: {
            ...state.gameState.finalJeopardy,
            state: action.newState,
          },
        },
      };

    case "FINAL_CLUE":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          finalJeopardy: {
            ...state.gameState.finalJeopardy,
            clueText: action.clueText,
            state: "answering",
          },
        },
      };

    case "FINAL_JUDGE_RESULT":
      if (!state.gameState) return state;
      // During reveal: store judgment info but do NOT update scores
      // (scores are delayed until the "score" reveal step)
      return {
        ...state,
        lastFinalResult: {
          playerId: action.data.playerId,
          playerName: action.data.playerName,
          correct: action.data.correct,
          wager: action.data.wager,
          answer: action.data.answer,
        },
      };

    case "REVEAL_SCORE_UPDATE":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          scores: action.data.finalScores,
          players: state.gameState.players.map((p) => ({
            ...p,
            score: action.data.finalScores[p.id] ?? p.score,
          })),
        },
      };

    case "GAME_FINISHED":
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          status: "finished",
          scores: action.finalScores,
          players: state.gameState.players.map((p) => ({
            ...p,
            score: action.finalScores[p.id] ?? p.score,
          })),
        },
      };

    case "NEW_ROUND_LOADING":
      return { ...state, isNewRoundLoading: true };

    default:
      return state;
  }
}

const initialState: GameUIState = {
  gameState: null,
  lastJudgeResult: null,
  lastCorrectResponse: null,
  lastFinalResult: null,
  buzzCountdown: null,
  countdownType: null,
  countdownTotalSeconds: null,
  isNewRoundLoading: false,
  revealedAnswer: null,
};

export function useGameState(socket: TypedSocket | null) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    if (!socket) return;

    const handlers = {
      "game:state_sync": (data: SerializableGameState) =>
        dispatch({ type: "SET_STATE", state: data }),
      "game:joined": (data: {
        playerId: string;
        gameState: SerializableGameState;
      }) => dispatch({ type: "SET_STATE", state: data.gameState }),
      "game:player_joined": (data: SerializablePlayer) =>
        dispatch({ type: "PLAYER_JOINED", player: data }),
      "game:player_left": (data: { playerId: string }) =>
        dispatch({ type: "PLAYER_LEFT", playerId: data.playerId }),
      "game:started": () => dispatch({ type: "GAME_STARTED" }),
      "game:clue_selected": (data: {
        categoryIndex: number;
        clueIndex: number;
        clueText: string;
        value: number;
        isDailyDouble: boolean;
      }) => dispatch({ type: "CLUE_SELECTED", data }),
      "game:buzzing_open": () => dispatch({ type: "BUZZING_OPEN" }),
      "game:player_buzzed": (data: {
        playerId: string;
        playerName: string;
      }) => dispatch({ type: "PLAYER_BUZZED", data }),
      "game:judge_result": (data: {
        playerId: string;
        correct: boolean;
        scores: ScoreMap;
        clueComplete: boolean;
      }) => dispatch({ type: "JUDGE_RESULT", data }),
      "game:clue_complete": (data: { correctResponse: string }) =>
        dispatch({ type: "CLUE_COMPLETE", correctResponse: data.correctResponse }),
      "game:answer_revealed": (data: { correctResponse: string }) =>
        dispatch({ type: "ANSWER_REVEALED", correctResponse: data.correctResponse }),
      "game:final_started": (data: { category: string }) =>
        dispatch({ type: "FINAL_STARTED", category: data.category }),
      "game:final_advanced": (data: { newState: FinalState }) =>
        dispatch({ type: "FINAL_ADVANCED", newState: data.newState }),
      "game:final_clue": (data: { clueText: string }) =>
        dispatch({ type: "FINAL_CLUE", clueText: data.clueText }),
      "game:final_judge_result": (data: {
        playerId: string;
        playerName: string;
        correct: boolean;
        wager: number;
        answer: string;
        finalScores: ScoreMap;
      }) => dispatch({ type: "FINAL_JUDGE_RESULT", data }),
      "game:reveal_score_update": (data: {
        playerId: string;
        newScore: number;
        finalScores: ScoreMap;
      }) => dispatch({ type: "REVEAL_SCORE_UPDATE", data }),
      "game:finished": (data: { finalScores: ScoreMap }) =>
        dispatch({ type: "GAME_FINISHED", finalScores: data.finalScores }),
      "game:buzz_countdown": (data: { secondsRemaining: number; type: CountdownType; totalSeconds: number }) =>
        dispatch({ type: "BUZZ_COUNTDOWN", secondsRemaining: data.secondsRemaining, countdownType: data.type, totalSeconds: data.totalSeconds }),
      "game:new_round_loading": () =>
        dispatch({ type: "NEW_ROUND_LOADING" }),
      // Board generation events (state updates come via game:state_sync)
      "game:board_ready": () => {},
      "game:board_failed": () => {},
    };

    // Register all handlers
    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event as keyof ServerToClientEvents, handler as (...args: never[]) => void);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event as keyof ServerToClientEvents, handler as (...args: never[]) => void);
      }
    };
  }, [socket]);

  return state;
}
