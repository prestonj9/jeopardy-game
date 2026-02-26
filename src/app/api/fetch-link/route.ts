import { NextRequest, NextResponse } from "next/server";
import {
  fetchGoogleDocContent,
  parseGoogleUrl,
} from "@/lib/google-fetcher";

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url || url.trim().length === 0) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const info = parseGoogleUrl(url);
    if (!info) {
      return NextResponse.json(
        {
          error:
            "Please paste a valid Google Docs or Google Sheets URL (e.g., https://docs.google.com/document/d/...)",
        },
        { status: 400 }
      );
    }

    const content = await fetchGoogleDocContent(url);

    return NextResponse.json({
      content,
      sourceType: info.type,
    });
  } catch (err) {
    console.error("Link fetch error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to fetch document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
