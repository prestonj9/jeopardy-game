import { NextRequest, NextResponse } from "next/server";
import { getGame, serializeGameState } from "@/lib/game-manager";

export async function GET(
  _request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const game = getGame(params.gameId);

  if (!game) {
    return NextResponse.json(
      { error: "Game not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(serializeGameState(game));
}
