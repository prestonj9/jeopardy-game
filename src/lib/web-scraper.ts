import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const MAX_CONTENT_LENGTH = 50_000;
const FETCH_TIMEOUT_MS = 15_000;

export interface WebScrapingResult {
  content: string;
  title: string | null;
  siteName: string | null;
}

/**
 * Validates that a string is a well-formed HTTP(S) URL.
 */
export function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetches an arbitrary web page and extracts its article content
 * using Mozilla Readability (the same engine behind Firefox Reader View).
 *
 * Throws descriptive errors for common failure modes.
 */
export async function fetchWebPageContent(
  url: string
): Promise<WebScrapingResult> {
  if (!isValidHttpUrl(url)) {
    throw new Error(
      "Please enter a valid URL starting with http:// or https://"
    );
  }

  // Fetch with timeout and browser-like User-Agent
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.trim(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JeopardyGameBot/1.0; +https://example.com)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "The page took too long to respond. Please try a different URL."
      );
    }
    throw new Error(
      "Could not reach that URL. Please check the address and try again."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Page not found (404). Please check the URL.");
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error(
        "Access denied. This page may require login or is behind a paywall."
      );
    }
    throw new Error(`Failed to fetch page (HTTP ${response.status}).`);
  }

  // Verify content type is HTML
  const contentType = response.headers.get("content-type") || "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml")
  ) {
    throw new Error(
      "This URL does not point to a web page. Please use a link to an article or web page."
    );
  }

  const html = await response.text();

  // Parse with jsdom and extract with Readability
  const dom = new JSDOM(html, { url: url.trim() });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (
    !article ||
    !article.textContent ||
    article.textContent.trim().length < 50
  ) {
    throw new Error(
      "Could not extract enough readable content from this page. Try a different URL with more text content (articles, blog posts, lessons, etc.)."
    );
  }

  // Clean up the text: collapse excessive whitespace
  const cleanedText = article.textContent
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return {
    content: cleanedText.slice(0, MAX_CONTENT_LENGTH),
    title: article.title || null,
    siteName: article.siteName || null,
  };
}
