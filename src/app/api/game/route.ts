import { NextRequest, NextResponse } from "next/server";
import { createGame, createGameWithBackground } from "@/lib/game-manager";
import type { Board, GenerateBoardRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      board?: Board;
      finalJeopardy?: {
        category: string;
        clueText: string;
        correctResponse: string;
      };
      generationParams?: GenerateBoardRequest;
    };

    // Background generation mode — create game instantly, generate board in background
    if (body.generationParams) {
      const params = body.generationParams;
      if (params.mode === "topic" && (!params.topic || params.topic.trim().length === 0)) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 });
      }
      if (params.mode === "upload" && (!params.content || params.content.trim().length === 0)) {
        return NextResponse.json({ error: "Content is required" }, { status: 400 });
      }

      const game = createGameWithBackground(params);
      return NextResponse.json({ gameId: game.id });
    }

    // Legacy mode — board already generated
    if (body.board && body.finalJeopardy) {
      const game = createGame("pending", body.board, body.finalJeopardy);
      return NextResponse.json({ gameId: game.id });
    }

    return NextResponse.json(
      { error: "Either generationParams or board+finalJeopardy required" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Game creation error:", err);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}
