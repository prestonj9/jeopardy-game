export type GoogleDocType = "document" | "spreadsheet";

export interface GoogleDocInfo {
  type: GoogleDocType;
  id: string;
}

/**
 * Parses a Google Docs or Sheets URL and extracts the document type and ID.
 * Returns null if the URL doesn't match a known pattern.
 */
export function parseGoogleUrl(url: string): GoogleDocInfo | null {
  const trimmed = url.trim();

  const docsMatch = trimmed.match(
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/
  );
  if (docsMatch) {
    return { type: "document", id: docsMatch[1] };
  }

  const sheetsMatch = trimmed.match(
    /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
  );
  if (sheetsMatch) {
    return { type: "spreadsheet", id: sheetsMatch[1] };
  }

  return null;
}

function buildExportUrl(info: GoogleDocInfo): string {
  if (info.type === "document") {
    return `https://docs.google.com/document/d/${info.id}/export?format=txt`;
  }
  return `https://docs.google.com/spreadsheets/d/${info.id}/export?format=csv`;
}

const MAX_CONTENT_LENGTH = 50_000;

/**
 * Fetches the text content of a publicly-shared Google Doc or Sheet.
 * Throws a descriptive error if the document is not accessible or the URL is invalid.
 */
export async function fetchGoogleDocContent(url: string): Promise<string> {
  const info = parseGoogleUrl(url);
  if (!info) {
    throw new Error(
      "Invalid Google Docs/Sheets URL. Please paste a link like: https://docs.google.com/document/d/..."
    );
  }

  const exportUrl = buildExportUrl(info);

  const response = await fetch(exportUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "JeopardyGameBot/1.0",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Document not found. Please check the URL and try again."
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'This document is not publicly accessible. Please set sharing to "Anyone with the link" and try again.'
      );
    }
    throw new Error(
      `Failed to fetch document (HTTP ${response.status}). Make sure the document is publicly shared.`
    );
  }

  const text = await response.text();

  // Google returns an HTML login page (200 status) for non-public documents
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(
      'This document is not publicly accessible. Please set sharing to "Anyone with the link" and try again.'
    );
  }

  if (text.trim().length < 20) {
    throw new Error(
      "The document appears to be empty or contains very little text."
    );
  }

  return text.slice(0, MAX_CONTENT_LENGTH);
}
