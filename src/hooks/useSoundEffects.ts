"use client";

import { useEffect, useRef } from "react";
import type { SerializableGameState } from "@/lib/types";

/**
 * Plays game-show sound effects on the TV display in response to state changes.
 *
 * Sound files live in /public/sounds/ — swap any file to change the sound.
 * Sounds fail silently if the browser blocks autoplay (no user interaction yet).
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

  /** Play a one-shot sound */
  function playSound(file: string) {
    if (mutedRef.current) return;
    try {
      const audio = new Audio(`/sounds/${file}`);
      audio.play().catch(() => {
        // Silently ignore autoplay restrictions
      });
    } catch {
      // Ignore errors (e.g., SSR)
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
}
