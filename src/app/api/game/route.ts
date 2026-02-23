import { NextRequest, NextResponse } from "next/server";
import { createGame } from "@/lib/game-manager";
import type { Board } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      board: Board;
      finalJeopardy: {
        category: string;
        clueText: string;
        correctResponse: string;
      };
    };

    if (!body.board || !body.finalJeopardy) {
      return NextResponse.json(
        { error: "Board and finalJeopardy are required" },
        { status: 400 }
      );
    }

    // Create game with a placeholder host socket ID — will be set when host connects via socket
    const game = createGame("pending", body.board, body.finalJeopardy);

    return NextResponse.json({ gameId: game.id });
  } catch (err) {
    console.error("Game creation error:", err);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}
