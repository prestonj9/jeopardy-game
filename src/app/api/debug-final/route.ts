import { NextResponse } from "next/server";
import { createGame, addPlayer } from "@/lib/game-manager";
import type { Board } from "@/lib/types";

/**
 * DEBUG ONLY — creates a game pre-loaded at the Final Jeopardy "show_category"
 * state with 3 fake players who have varied scores and pre-filled submissions.
 *
 * GET /api/debug-final → { gameId }
 *
 * Then open:
 *   Host remote: /host/{gameId}/remote
 *   Display:     /host/{gameId}
 */
export async function GET() {
  // Minimal dummy board (all clues revealed so "Start Final" is available)
  const dummyBoard: Board = {
    categories: Array.from({ length: 6 }, (_, ci) => ({
      name: `Category ${ci + 1}`,
      clues: Array.from({ length: 5 }, (_, ri) => ({
        value: (ri + 1) * 200,
        clueText: "Debug clue",
        correctResponse: "Debug answer",
        isRevealed: true,
        isDailyDouble: false,
      })),
    })),
    dailyDoubleLocation: { categoryIndex: 0, clueIndex: 0 },
  };

  const game = createGame("pending", dummyBoard, {
    category: "World Capitals",
    clueText: "This European capital city is split by the Danube River into a hilly western side and a flat eastern side.",
    correctResponse: "What is Budapest?",
  });

  // Add fake players with scores
  const alice = addPlayer(game, "fake-socket-alice", "Alice");
  alice.score = 4200;
  const bob = addPlayer(game, "fake-socket-bob", "Bob");
  bob.score = 6800;
  const carol = addPlayer(game, "fake-socket-carol", "Carol");
  carol.score = 3100;

  // Fast-forward to final jeopardy — show_category
  game.status = "final_jeopardy";
  game.finalJeopardy.state = "show_category";

  // Pre-fill wagers and answers (they'll be available when host reaches revealing)
  game.finalJeopardy.submissions.set(alice.id, {
    wager: 3000,
    answer: "What is Budapest?",
  });
  game.finalJeopardy.submissions.set(bob.id, {
    wager: 5000,
    answer: "What is Prague?",
  });
  game.finalJeopardy.submissions.set(carol.id, {
    wager: 2000,
    answer: "What is Budapest?",
  });

  return NextResponse.json({
    gameId: game.id,
    hostRemote: `/host/${game.id}/remote`,
    display: `/host/${game.id}`,
    players: [
      { name: alice.name, score: alice.score },
      { name: bob.name, score: bob.score },
      { name: carol.name, score: carol.score },
    ],
  });
}
