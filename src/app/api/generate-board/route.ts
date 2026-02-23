import { NextRequest, NextResponse } from "next/server";
import { generateBoard } from "@/lib/ai-generator";
import type { GenerateBoardRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBoardRequest;

    // Validate
    if (body.mode === "topic") {
      if (!body.topic || body.topic.trim().length === 0) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
        );
      }
      if (body.topic.length > 500) {
        return NextResponse.json(
          { error: "Topic must be 500 characters or fewer" },
          { status: 400 }
        );
      }
    } else if (body.mode === "upload") {
      if (!body.content || body.content.trim().length === 0) {
        return NextResponse.json(
          { error: "Content is required for upload mode" },
          { status: 400 }
        );
      }
      // Truncate content to 50,000 chars
      body.content = body.content.slice(0, 50000);
    } else {
      return NextResponse.json(
        { error: 'Mode must be "topic" or "upload"' },
        { status: 400 }
      );
    }

    const result = await generateBoard(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Board generation error:", err);
    const message =
      err instanceof Error
        ? err.message
        : "Board generation failed — please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
