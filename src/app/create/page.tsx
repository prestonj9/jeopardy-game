"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InteractiveHero from "@/components/InteractiveHero";

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Mode = "topic" | "upload" | "link";

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState("topic" as Mode);
  const [topic, setTopic] = useState("");
  const [uploadedContent, setUploadedContent] = useState(null as string | null);
  const [fileName, setFileName] = useState(null as string | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkContent, setLinkContent] = useState(null as string | null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkSourceName, setLinkSourceName] = useState(null as string | null);
  const [showLinkInfo, setShowLinkInfo] = useState(false);

  async function handleFileUpload(file: File) {
    setUploadLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadedContent(data.content);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleLinkFetch() {
    setLinkLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch content");
      setLinkContent(data.content);
      setLinkSourceName(data.sourceName || "Content");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch content");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const generationParams =
        mode === "topic"
          ? { mode: "topic" as const, topic }
          : { mode: "upload" as const, content: (mode === "link" ? linkContent : uploadedContent) || "" };

      const gameRes = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationParams }),
      });
      const gameData = await gameRes.json();
      if (!gameRes.ok) throw new Error(gameData.error || "Game creation failed");

      // Redirect to lobby immediately — board generates in the background
      router.push("/host/" + gameData.gameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const canGenerate =
    !loading &&
    (mode === "topic"
      ? topic.trim() !== ""
      : mode === "upload"
      ? uploadedContent !== null
      : linkContent !== null);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      <InteractiveHero />
      <div className="w-full max-w-lg bg-white/25 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/60 relative z-10">
        <h1 className="text-3xl font-bold text-text-primary text-center mb-8">
          Create a Game
        </h1>

        <div className="flex bg-white/50 border border-white/60 rounded-full p-1 mb-6">
          <button
            onClick={() => { setMode("topic"); setError(null); }}
            className={"flex-1 py-2.5 rounded-full font-bold text-sm transition-all " + (mode === "topic" ? "bg-text-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary")}
          >
            Topic
          </button>
          <button
            onClick={() => { setMode("upload"); setError(null); }}
            className={"flex-1 py-2.5 rounded-full font-bold text-sm transition-all " + (mode === "upload" ? "bg-text-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary")}
          >
            Upload
          </button>
          <button
            onClick={() => { setMode("link"); setError(null); }}
            className={"flex-1 py-2.5 rounded-full font-bold text-sm transition-all " + (mode === "link" ? "bg-text-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary")}
          >
            Link
          </button>
        </div>

        {mode === "topic" && (
          <div className="mb-6">
            <label className="block text-text-primary text-sm font-medium mb-2">
              What should the game be about?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Harry Potter, US History, Science"
              maxLength={500}
              className="w-full px-5 py-3 rounded-full bg-white/50 border border-white/60 text-text-primary placeholder-text-tertiary text-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-text-tertiary text-sm mt-1">
              {topic.length}/500 characters
            </p>
          </div>
        )}

        {mode === "upload" && (
          <div className="mb-6">
            <label className="block text-text-primary text-sm font-medium mb-2">
              Upload source material (.pdf or .txt)
            </label>
            <label className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/50 transition-colors block">
              {uploadLoading ? (
                <span className="text-text-secondary">Extracting text...</span>
              ) : fileName ? (
                <span className="text-accent font-bold">{fileName}</span>
              ) : (
                <span className="text-text-secondary">Click to upload (PDF or TXT, max 10MB)</span>
              )}
              <input
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>
        )}

        {mode === "link" && (
          <div className="mb-6">
            <label className="block text-text-primary text-sm font-medium mb-2">
              Paste a URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkContent(null);
                  setLinkSourceName(null);
                }}
                placeholder="https://example.com/article"
                className="flex-1 px-5 py-3 rounded-full bg-white/50 border border-white/60 text-text-primary placeholder-text-tertiary text-base focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleLinkFetch}
                disabled={!linkUrl.trim() || !isValidUrl(linkUrl) || linkLoading}
                className="px-5 py-3 rounded-full font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-accent text-white hover:opacity-90"
              >
                {linkLoading ? "Fetching..." : "Fetch"}
              </button>
            </div>

            <button
              onClick={() => setShowLinkInfo(!showLinkInfo)}
              className="flex items-center gap-1.5 text-text-tertiary hover:text-text-secondary text-sm mt-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              {showLinkInfo ? "Hide tips" : "What links work?"}
            </button>

            {showLinkInfo && (
              <div className="mt-2 p-4 bg-white/40 border border-white/60 rounded-xl text-sm text-text-secondary space-y-2.5">
                <p className="font-medium text-text-primary">Supported links</p>
                <ul className="space-y-1.5 list-none">
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5 flex-shrink-0">&#10003;</span>
                    <span><strong>Articles &amp; blog posts</strong> &mdash; news stories, tutorials, Wikipedia pages, and any content-rich web page</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5 flex-shrink-0">&#10003;</span>
                    <span><strong>Lesson pages &amp; course content</strong> &mdash; educational sites, textbook chapters, study guides</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5 flex-shrink-0">&#10003;</span>
                    <span><strong>Google Docs &amp; Sheets</strong> &mdash; set sharing to &ldquo;Anyone with the link can view&rdquo;</span>
                  </li>
                </ul>
                <p className="font-medium text-text-primary pt-1">Tips for best results</p>
                <ul className="space-y-1.5 list-none">
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5 flex-shrink-0">&bull;</span>
                    <span>Pages with more text generate better games &mdash; aim for at least a few paragraphs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5 flex-shrink-0">&bull;</span>
                    <span>The page must be publicly accessible (no login required)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning mt-0.5 flex-shrink-0">&times;</span>
                    <span>Pages that are mostly images, videos, or interactive apps won&rsquo;t have enough text to extract</span>
                  </li>
                </ul>
              </div>
            )}

            {linkContent && linkSourceName && (
              <div className="mt-3 p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm">
                {linkSourceName} content loaded ({linkContent.length.toLocaleString()} characters)
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-4 rounded-full font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-text-primary text-white hover:opacity-90"
        >
          {loading ? "Creating Game..." : "Generate Game"}
        </button>
      </div>
    </div>
  );
}
