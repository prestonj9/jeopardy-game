"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SerializableGameState } from "@/lib/types";

/**
 * Plays game-show sound effects on the TV display in response to state changes.
 *
 * Sound files live in /public/sounds/ — swap any file to change the sound.
 *
 * Browsers block audio until the user interacts with the page. This hook
 * returns `audioUnlocked` (boolean) so the display page can show a prompt
 * asking someone to click the screen once.
 */
export function useSoundEffects(
  gameState: SerializableGameState | null,
  buzzCountdown: number | null,
  lastJudgeResult: { playerId: string; correct: boolean } | null,
  muted: boolean = false
) {
  // Previous state refs for detecting transitions
  const prevClueState = useRef<string | null>(null);
  const prevBuzzCountdown = useRef<number | null>(null);
  const prevFinalState = useRef<string | null>(null);
  const prevJudgeResult = useRef<typeof lastJudgeResult>(null);

  // Keep muted in a ref so playSound always reads the latest value
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Ref for looping Final Jeopardy music
  const finalMusicRef = useRef<HTMLAudioElement | null>(null);

  // ── Audio unlock via AudioContext ────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Pre-loaded audio buffers for instant playback
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const ctx = new AudioContext();
      // Create and play a tiny silent buffer to unlock
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      audioCtxRef.current = ctx;
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);

      // Pre-load all sound files into AudioBuffers for reliable playback
      const files = [
        "buzz-in.wav",
        "correct.wav",
        "wrong.wav",
        "daily-double.wav",
        "times-up.wav",
        "final-jeopardy.wav",
      ];
      for (const file of files) {
        fetch(`/sounds/${file}`)
          .then((r) => r.arrayBuffer())
          .then((buf) => ctx.decodeAudioData(buf))
          .then((decoded) => audioBuffersRef.current.set(file, decoded))
          .catch(() => {});
      }
    } catch {
      // Fallback: just mark as unlocked so HTMLAudioElement attempts work
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
    }
  }, []);

  // Register a one-time click/touch handler on the document to unlock audio
  useEffect(() => {
    if (audioUnlockedRef.current) return;

    const handler = () => {
      unlockAudio();
      document.removeEventListener("click", handler, true);
      document.removeEventListener("touchstart", handler, true);
    };

    document.addEventListener("click", handler, true);
    document.addEventListener("touchstart", handler, true);

    return () => {
      document.removeEventListener("click", handler, true);
      document.removeEventListener("touchstart", handler, true);
    };
  }, [unlockAudio]);

  /** Play a one-shot sound using AudioContext (preferred) or HTMLAudioElement (fallback) */
  function playSound(file: string) {
    if (mutedRef.current) return;

    // Try AudioContext playback first (more reliable after unlock)
    const ctx = audioCtxRef.current;
    const buffer = audioBuffersRef.current.get(file);
    if (ctx && buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      return;
    }

    // Fallback to HTMLAudioElement
    try {
      const audio = new Audio(`/sounds/${file}`);
      audio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }

  // ── Clue state sounds (buzz-in + daily double) ──────────────
  useEffect(() => {
    const clueState = gameState?.currentClue?.state ?? null;
    const prev = prevClueState.current;

    if (clueState === "player_answering" && prev !== "player_answering") {
      playSound("buzz-in.wav");
    }
    if (clueState === "daily_double_wager" && prev !== "daily_double_wager") {
      playSound("daily-double.wav");
    }

    prevClueState.current = clueState;
  }, [gameState?.currentClue?.state]);

  // ── Correct / Wrong answer sound ────────────────────────────
  useEffect(() => {
    if (!lastJudgeResult) return;
    // Only play if this is a new result (different from previous)
    if (
      prevJudgeResult.current?.playerId !== lastJudgeResult.playerId ||
      prevJudgeResult.current?.correct !== lastJudgeResult.correct
    ) {
      playSound(lastJudgeResult.correct ? "correct.wav" : "wrong.wav");
    }
    prevJudgeResult.current = lastJudgeResult;
  }, [lastJudgeResult]);

  // ── Timer expire sound ──────────────────────────────────────
  useEffect(() => {
    if (
      buzzCountdown === 0 &&
      prevBuzzCountdown.current !== null &&
      prevBuzzCountdown.current > 0
    ) {
      playSound("times-up.wav");
    }
    prevBuzzCountdown.current = buzzCountdown;
  }, [buzzCountdown]);

  // ── Mute/unmute Final Jeopardy music in real-time ───────────
  useEffect(() => {
    if (!finalMusicRef.current) return;
    if (muted) {
      finalMusicRef.current.pause();
    } else {
      finalMusicRef.current.play().catch(() => {});
    }
  }, [muted]);

  // ── Final Jeopardy thinking music ───────────────────────────
  useEffect(() => {
    const finalState = gameState?.finalJeopardy?.state ?? null;

    // Start music when entering "answering" state
    if (
      finalState === "answering" &&
      prevFinalState.current !== "answering"
    ) {
      if (!mutedRef.current) {
        try {
          const audio = new Audio("/sounds/final-jeopardy.wav");
          audio.loop = true;
          audio.play().catch(() => {});
          finalMusicRef.current = audio;
        } catch {
          // Ignore
        }
      }
    }

    // Stop music when leaving "answering" state
    if (
      finalState !== "answering" &&
      prevFinalState.current === "answering" &&
      finalMusicRef.current
    ) {
      finalMusicRef.current.pause();
      finalMusicRef.current.currentTime = 0;
      finalMusicRef.current = null;
    }

    prevFinalState.current = finalState;

    // Cleanup on unmount
    return () => {
      if (finalMusicRef.current) {
        finalMusicRef.current.pause();
        finalMusicRef.current = null;
      }
    };
  }, [gameState?.finalJeopardy?.state]);

  return { unlockAudio, audioUnlocked };
}
