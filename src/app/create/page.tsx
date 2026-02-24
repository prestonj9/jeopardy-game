"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOADING_MESSAGES } from "@/lib/constants";
import InteractiveHero from "@/components/InteractiveHero";

type Mode = "topic" | "upload";

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState("topic" as Mode);
  const [topic, setTopic] = useState("");
  const [uploadedContent, setUploadedContent] = useState(null as string | null);
  const [fileName, setFileName] = useState(null as string | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [uploadLoading, setUploadLoading] = useState(false);

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

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const body =
        mode === "topic"
          ? { mode: "topic" as const, topic }
          : { mode: "upload" as const, content: uploadedContent || "" };

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
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = !loading && (mode === "topic" ? topic.trim() !== "" : uploadedContent !== null);

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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface rounded-2xl p-8 shadow-sm border border-border">
        <h1 className="text-3xl font-bold text-text-primary text-center mb-8">
          Create a Game
        </h1>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("topic")}
            className={"flex-1 py-3 rounded-lg font-bold text-lg transition-colors " + (mode === "topic" ? "bg-gradient-to-r from-accent to-accent-cyan text-white" : "bg-white text-text-secondary border border-border")}
          >
            Enter a Topic
          </button>
          <button
            onClick={() => setMode("upload")}
            className={"flex-1 py-3 rounded-lg font-bold text-lg transition-colors " + (mode === "upload" ? "bg-gradient-to-r from-accent to-accent-cyan text-white" : "bg-white text-text-secondary border border-border")}
          >
            Upload a File
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
              className="w-full px-4 py-3 rounded-lg bg-white border border-border text-text-primary placeholder-text-tertiary text-lg focus:outline-none focus:ring-2 focus:ring-accent"
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

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-4 rounded-lg font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent-cyan text-white hover:opacity-90"
        >
          Generate Game
        </button>
      </div>
    </div>
  );
}
