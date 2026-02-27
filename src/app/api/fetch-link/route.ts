import { NextRequest, NextResponse } from "next/server";
import {
  fetchGoogleDocContent,
  parseGoogleUrl,
} from "@/lib/google-fetcher";
import {
  fetchWebPageContent,
  isValidHttpUrl,
} from "@/lib/web-scraper";

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url || url.trim().length === 0) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Branch 1: Google Doc/Sheet — use existing export-based fetcher
    const googleInfo = parseGoogleUrl(url);
    if (googleInfo) {
      const content = await fetchGoogleDocContent(url);
      return NextResponse.json({
        content,
        sourceType: googleInfo.type,
        sourceName:
          googleInfo.type === "spreadsheet" ? "Google Sheet" : "Google Doc",
      });
    }

    // Branch 2: Generic web URL — use Readability extraction
    if (!isValidHttpUrl(url)) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid URL starting with http:// or https://",
        },
        { status: 400 }
      );
    }

    const result = await fetchWebPageContent(url);

    return NextResponse.json({
      content: result.content,
      sourceType: "webpage",
      sourceName: result.title || result.siteName || "Web page",
    });
  } catch (err) {
    console.error("Link fetch error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to fetch content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
