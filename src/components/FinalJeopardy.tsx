"use client";

import { useState } from "react";
import type { FinalState, SerializablePlayer } from "@/lib/types";
import WagerInput from "./WagerInput";

interface FinalJeopardyProps {
  state: FinalState;
  category: string;
  clueText: string;
  correctResponse?: string; // host only
  isHost: boolean;
  players: SerializablePlayer[];
  myPlayerId?: string;
  submissions: Record<string, { wager: number; answer: string }>;
  onAdvance?: () => void;
  onJudge?: (playerId: string, correct: boolean) => void;
  onSubmitWager?: (amount: number) => void;
  onSubmitAnswer?: (answer: string) => void;
  lastFinalResult?: {
    playerId: string;
    playerName: string;
    correct: boolean;
    wager: number;
    answer: string;
  } | null;
}

export default function FinalJeopardy({
  state,
  category,
  clueText,
  correctResponse,
  isHost,
  players,
  myPlayerId,
  submissions,
  onAdvance,
  onJudge,
  onSubmitWager,
  onSubmitAnswer,
  lastFinalResult,
}: FinalJeopardyProps) {
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [submittedWager, setSubmittedWager] = useState(false);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score); // lowest first for reveal

  // Track which players have been judged
  const [judgedPlayers, setJudgedPlayers] = useState<Set<string>>(new Set());

  return (
    <div className="fixed inset-0 bg-jeopardy-category z-50 flex flex-col items-center justify-center p-6">
      {/* Show Category */}
      {state === "show_category" && (
        <div className="text-center">
          <p className="text-white/60 text-sm uppercase tracking-wider mb-2">
            Final Jeopardy Category
          </p>
          <h2 className="text-4xl md:text-6xl font-bold text-jeopardy-gold">
            {category}
          </h2>
          {isHost && (
            <button
              onClick={onAdvance}
              className="mt-8 px-8 py-4 bg-jeopardy-gold text-jeopardy-category font-bold text-xl rounded-lg hover:brightness-110"
            >
              Begin Wagering
            </button>
          )}
        </div>
      )}

      {/* Wagering */}
      {state === "wagering" && (
        <div className="text-center w-full max-w-md">
          <h2 className="text-3xl font-bold text-jeopardy-gold mb-2">
            {category}
          </h2>
          {isHost ? (
            <div>
              <p className="text-white text-lg mb-4">
                Waiting for wagers...
              </p>
              <div className="space-y-2 mb-6">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center px-4 py-2 bg-white/5 rounded-lg"
                  >
                    <span className="text-white">{p.name}</span>
                    <span className="text-jeopardy-gold">
                      {submissions[p.id]
                        ? "Wager submitted"
                        : "Waiting..."}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onAdvance}
                className="px-8 py-4 bg-jeopardy-gold text-jeopardy-category font-bold text-xl rounded-lg hover:brightness-110"
              >
                Show Clue
              </button>
            </div>
          ) : !submittedWager && myPlayer ? (
            <WagerInput
              maxWager={Math.max(myPlayer.score, 0)}
              minWager={0}
              playerScore={myPlayer.score}
              onSubmit={(amount) => {
                onSubmitWager?.(amount);
                setSubmittedWager(true);
              }}
              label="How much will you wager?"
            />
          ) : (
            <p className="text-white text-lg">
              Wager submitted! Waiting for other players...
            </p>
          )}
        </div>
      )}

      {/* Show Clue / Answering */}
      {(state === "show_clue" || state === "answering") && (
        <div className="text-center w-full max-w-2xl">
          <p className="text-white/60 text-sm uppercase tracking-wider mb-2">
            {category}
          </p>
          <p className="text-white text-2xl md:text-4xl font-medium leading-relaxed mb-8">
            {clueText}
          </p>

          {isHost && correctResponse && (
            <div className="max-w-xl mx-auto mb-6 p-4 border-2 border-jeopardy-gold/50 rounded-lg bg-white/5">
              <p className="text-jeopardy-gold/70 text-xs uppercase tracking-wider mb-1">
                Answer
              </p>
              <p className="text-jeopardy-gold text-xl font-bold">
                {correctResponse}
              </p>
            </div>
          )}

          {isHost ? (
            <div>
              <div className="space-y-2 mb-6">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center px-4 py-2 bg-white/5 rounded-lg"
                  >
                    <span className="text-white">{p.name}</span>
                    <span className="text-jeopardy-gold">
                      {submissions[p.id]?.answer
                        ? "Answer submitted"
                        : "Writing..."}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onAdvance}
                className="px-8 py-4 bg-jeopardy-gold text-jeopardy-category font-bold text-xl rounded-lg hover:brightness-110"
              >
                Begin Judging
              </button>
            </div>
          ) : !submittedAnswer ? (
            <div className="max-w-md mx-auto">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="What is..."
                className="w-full px-4 py-3 text-xl bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-jeopardy-gold mb-4"
              />
              <button
                onClick={() => {
                  onSubmitAnswer?.(answer);
                  setSubmittedAnswer(true);
                }}
                disabled={!answer.trim()}
                className="w-full py-4 bg-jeopardy-gold text-jeopardy-category font-bold text-xl rounded-lg hover:brightness-110 disabled:opacity-40"
              >
                Submit Answer
              </button>
            </div>
          ) : (
            <p className="text-white text-lg">
              Answer submitted! Waiting for results...
            </p>
          )}
        </div>
      )}

      {/* Judging */}
      {state === "judging" && isHost && (
        <div className="text-center w-full max-w-lg">
          <h2 className="text-3xl font-bold text-jeopardy-gold mb-6">
            Judge Final Answers
          </h2>
          {correctResponse && (
            <div className="mb-6 p-4 border-2 border-jeopardy-gold/50 rounded-lg bg-white/5">
              <p className="text-jeopardy-gold/70 text-xs uppercase tracking-wider mb-1">
                Correct Response
              </p>
              <p className="text-jeopardy-gold text-xl font-bold">
                {correctResponse}
              </p>
            </div>
          )}
          <div className="space-y-4">
            {sortedPlayers.map((player) => {
              const sub = submissions[player.id];
              const isJudged = judgedPlayers.has(player.id);
              return (
                <div
                  key={player.id}
                  className={`p-4 rounded-lg ${
                    isJudged ? "bg-white/5 opacity-50" : "bg-white/10"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-bold text-lg">
                      {player.name}
                    </span>
                    <span className="text-jeopardy-gold">
                      Wagered: ${sub?.wager ?? 0}
                    </span>
                  </div>
                  <p className="text-white text-lg mb-3">
                    &quot;{sub?.answer || "(no answer)"}&quot;
                  </p>
                  {!isJudged && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          onJudge?.(player.id, true);
                          setJudgedPlayers((prev) => { const next = new Set(Array.from(prev)); next.add(player.id); return next; });
                        }}
                        className="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-400"
                      >
                        CORRECT
                      </button>
                      <button
                        onClick={() => {
                          onJudge?.(player.id, false);
                          setJudgedPlayers((prev) => { const next = new Set(Array.from(prev)); next.add(player.id); return next; });
                        }}
                        className="flex-1 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400"
                      >
                        INCORRECT
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {judgedPlayers.size === players.length && (
            <button
              onClick={onAdvance}
              className="mt-6 px-8 py-4 bg-jeopardy-gold text-jeopardy-category font-bold text-xl rounded-lg hover:brightness-110"
            >
              Show Final Results
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {state === "results" && (
        <div className="text-center w-full max-w-lg">
          <h2 className="text-4xl font-bold text-jeopardy-gold mb-8">
            Final Scores
          </h2>
          <div className="space-y-3">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((player, i) => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center px-6 py-4 rounded-lg ${
                    i === 0
                      ? "bg-jeopardy-gold/20 ring-2 ring-jeopardy-gold"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-jeopardy-gold font-bold text-lg">
                      #{i + 1}
                    </span>
                    <span className="text-white font-bold text-lg">
                      {player.name}
                    </span>
                  </div>
                  <span
                    className={`font-bold text-xl ${
                      player.score < 0 ? "text-red-400" : "text-jeopardy-gold"
                    }`}
                  >
                    ${player.score.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Non-host judging/results view */}
      {state === "judging" && !isHost && (
        <div className="text-center">
          <h2 className="text-3xl font-bold text-jeopardy-gold mb-4">
            Judging Answers...
          </h2>
          {lastFinalResult && (
            <div className="p-4 bg-white/10 rounded-lg mb-4">
              <p className="text-white font-bold">
                {lastFinalResult.playerName}:{" "}
                <span
                  className={
                    lastFinalResult.correct
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {lastFinalResult.correct ? "Correct!" : "Incorrect"}
                </span>
              </p>
              <p className="text-white/60 text-sm">
                Wagered: ${lastFinalResult.wager}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
