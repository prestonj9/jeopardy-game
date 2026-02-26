"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOADING_MESSAGES } from "@/lib/constants";
import InteractiveHero from "@/components/InteractiveHero";
import { parseGoogleUrl } from "@/lib/google-fetcher";

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
      if (!res.ok) throw new Error(data.error || "Failed to fetch document");
      setLinkContent(data.content);
      setLinkSourceName(
        data.sourceType === "spreadsheet" ? "Google Sheet" : "Google Doc"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch document");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const body =
        mode === "topic"
          ? { mode: "topic" as const, topic }
          : { mode: "upload" as const, content: (mode === "link" ? linkContent : uploadedContent) || "" };

      const boardRes = await fetch("/api/generate-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const boardData = await boardRes.json();
      if (!boardRes.ok) throw new Error(boardData.error || "Generation failed");

      const gameRes = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: boardData.board,
          finalJeopardy: boardData.finalJeopardy,
        }),
      });
      const gameData = await gameRes.json();
      if (!gameRes.ok) throw new Error(gameData.error || "Game creation failed");

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

  // Rotate loading messages
  const [messageIndex, setMessageIndex] = useState(0);
  useEffect(() => {
    if (!loading) return;
    // Pick a random starting point
    setMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
        <InteractiveHero />
        <div className="text-center max-w-md relative z-10">
          <p
            key={messageIndex}
            className="text-text-secondary text-xl animate-[fadeIn_0.5s_ease-in] min-h-[3.5rem]"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    );
  }

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
            Google Link
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
              Paste a Google Doc or Sheet link
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
                placeholder="https://docs.google.com/document/d/..."
                className="flex-1 px-5 py-3 rounded-full bg-white/50 border border-white/60 text-text-primary placeholder-text-tertiary text-base focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleLinkFetch}
                disabled={!linkUrl.trim() || !parseGoogleUrl(linkUrl) || linkLoading}
                className="px-5 py-3 rounded-full font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-accent text-white hover:opacity-90"
              >
                {linkLoading ? "Fetching..." : "Fetch"}
              </button>
            </div>
            <p className="text-text-tertiary text-sm mt-2">
              Document must be shared as &ldquo;Anyone with the link can view&rdquo;
            </p>
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
          Generate Game
        </button>
      </div>
    </div>
  );
}
