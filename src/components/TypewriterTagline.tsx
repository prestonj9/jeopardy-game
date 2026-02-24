"use client";

import { useEffect, useRef, useState } from "react";
import { TAGLINES } from "@/lib/constants";

type Phase = "typing" | "holding" | "deleting" | "pausing";

const TYPE_SPEED = 45; // ms per character
const DELETE_SPEED = 25; // ms per character (faster backspace)
const HOLD_DURATION = 2200; // ms to display full phrase
const PAUSE_DURATION = 400; // ms gap between phrases

export default function TypewriterTagline() {
  const [displayed, setDisplayed] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const phaseRef = useRef<Phase>("typing");
  const indexRef = useRef(0); // current phrase index
  const charRef = useRef(0); // current character position
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Blink cursor
  useEffect(() => {
    const blink = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(blink);
  }, []);

  // Shuffle on mount so it's not always the same order
  const phrasesRef = useRef<string[]>([]);
  useEffect(() => {
    phrasesRef.current = [...TAGLINES].sort(() => Math.random() - 0.5);
  }, []);

  useEffect(() => {
    if (phrasesRef.current.length === 0) {
      phrasesRef.current = [...TAGLINES].sort(() => Math.random() - 0.5);
    }

    const tick = () => {
      const phrase = phrasesRef.current[indexRef.current];
      const phase = phaseRef.current;

      if (phase === "typing") {
        charRef.current++;
        setDisplayed(phrase.slice(0, charRef.current));
        if (charRef.current >= phrase.length) {
          phaseRef.current = "holding";
          timerRef.current = setTimeout(tick, HOLD_DURATION);
        } else {
          timerRef.current = setTimeout(tick, TYPE_SPEED);
        }
      } else if (phase === "holding") {
        phaseRef.current = "deleting";
        timerRef.current = setTimeout(tick, DELETE_SPEED);
      } else if (phase === "deleting") {
        charRef.current--;
        setDisplayed(phrase.slice(0, charRef.current));
        if (charRef.current <= 0) {
          phaseRef.current = "pausing";
          timerRef.current = setTimeout(tick, PAUSE_DURATION);
        } else {
          timerRef.current = setTimeout(tick, DELETE_SPEED);
        }
      } else if (phase === "pausing") {
        indexRef.current = (indexRef.current + 1) % phrasesRef.current.length;
        charRef.current = 0;
        phaseRef.current = "typing";
        timerRef.current = setTimeout(tick, TYPE_SPEED);
      }
    };

    timerRef.current = setTimeout(tick, TYPE_SPEED);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <p className="text-text-secondary text-lg md:text-xl min-h-[1.75em]">
      {displayed}
      <span
        className={`inline-block w-[2px] h-[1.1em] bg-text-secondary align-middle ml-0.5 transition-opacity duration-100 ${
          cursorVisible ? "opacity-100" : "opacity-0"
        }`}
      />
    </p>
  );
}
