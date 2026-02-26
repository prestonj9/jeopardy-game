#!/usr/bin/env node
/**
 * Generate game show sound effects as WAV files.
 * Run: node scripts/generate-sounds.js
 * Output: public/sounds/*.wav
 *
 * These are placeholder sounds — swap any file with a real .wav or .mp3 later.
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const outDir = path.join(__dirname, "..", "public", "sounds");

fs.mkdirSync(outDir, { recursive: true });

/** Write a WAV file from float samples (-1..1) */
function writeWav(filename, samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB, ${(numSamples / SAMPLE_RATE).toFixed(2)}s)`);
}

/** Generate a sine wave tone */
function sine(freq, duration, volume = 0.5) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE) * volume;
  }
  return samples;
}

/** Apply fade-in and fade-out (in seconds) */
function fade(samples, fadeIn = 0.005, fadeOut = 0.02) {
  const inSamples = Math.floor(fadeIn * SAMPLE_RATE);
  const outSamples = Math.floor(fadeOut * SAMPLE_RATE);
  for (let i = 0; i < inSamples && i < samples.length; i++) {
    samples[i] *= i / inSamples;
  }
  for (let i = 0; i < outSamples && i < samples.length; i++) {
    const idx = samples.length - 1 - i;
    samples[idx] *= i / outSamples;
  }
  return samples;
}

/** Mix multiple sample arrays together */
function mix(...arrays) {
  const maxLen = Math.max(...arrays.map((a) => a.length));
  const out = new Float64Array(maxLen);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      out[i] += arr[i];
    }
  }
  return out;
}

/** Concatenate sample arrays */
function concat(...arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Float64Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

/** Apply envelope to samples */
function envelope(samples, attack, decay, sustain, release) {
  const a = Math.floor(attack * SAMPLE_RATE);
  const d = Math.floor(decay * SAMPLE_RATE);
  const r = Math.floor(release * SAMPLE_RATE);
  const sustainEnd = samples.length - r;
  for (let i = 0; i < samples.length; i++) {
    let env;
    if (i < a) env = i / a;
    else if (i < a + d) env = 1 - ((1 - sustain) * (i - a) / d);
    else if (i < sustainEnd) env = sustain;
    else env = sustain * (samples.length - i) / r;
    samples[i] *= Math.max(0, env);
  }
  return samples;
}

/** White noise */
function noise(duration, volume = 0.3) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = (Math.random() * 2 - 1) * volume;
  }
  return samples;
}

// ── 1. Buzz-in: Short punchy electronic buzzer ──────────────────
function generateBuzzIn() {
  const duration = 0.25;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Square-ish wave with harmonics for that buzzer feel
    samples[i] =
      0.4 * Math.sin(2 * Math.PI * 440 * t) +
      0.2 * Math.sin(2 * Math.PI * 880 * t) +
      0.1 * Math.sin(2 * Math.PI * 1320 * t) +
      0.08 * Math.sin(2 * Math.PI * 1760 * t);
  }
  return fade(envelope(samples, 0.005, 0.02, 0.8, 0.05), 0.005, 0.05);
}

// ── 2. Correct answer: Bright ascending two-tone chime ──────────
function generateCorrect() {
  // Two quick ascending tones — like a "ding-DING!"
  const tone1 = fade(sine(880, 0.15, 0.5), 0.005, 0.04);
  const gap = new Float64Array(Math.floor(SAMPLE_RATE * 0.05));
  const tone2 = fade(sine(1175, 0.3, 0.6), 0.005, 0.15); // D6 — bright
  // Add sparkle harmonics to tone2
  const sparkle = fade(sine(2350, 0.2, 0.15), 0.005, 0.1);
  const combined2 = mix(tone2, sparkle);
  return concat(tone1, gap, combined2);
}

// ── 3. Wrong answer: Low descending buzzer ──────────────────────
function generateWrong() {
  const duration = 0.6;
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Descending frequency from 300Hz to 150Hz
    const freq = 300 - 150 * (t / duration);
    // Harsh square-ish wave
    samples[i] =
      0.35 * Math.sin(2 * Math.PI * freq * t) +
      0.2 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.15 * Math.sin(2 * Math.PI * freq * 3 * t) +
      0.05 * (Math.random() * 2 - 1); // slight noise
  }
  return fade(envelope(samples, 0.01, 0.05, 0.7, 0.15), 0.01, 0.15);
}

// ── 4. Daily Double: Dramatic reveal stinger ────────────────────
function generateDailyDouble() {
  // Rising dramatic chord: C-E-G-C (major chord sweep up)
  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  const parts = [];
  for (let j = 0; j < freqs.length; j++) {
    const delay = new Float64Array(Math.floor(SAMPLE_RATE * j * 0.08));
    const toneDur = 0.6 - j * 0.05;
    const t = sine(freqs[j], toneDur, 0.3);
    // Add shimmer
    const shimmer = sine(freqs[j] * 2, toneDur, 0.08);
    const combined = fade(mix(t, shimmer), 0.005, 0.2);
    parts.push(concat(delay, combined));
  }
  // Mix all chord tones
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = mix(result, parts[i]);
  }
  // Add a subtle impact at start
  const impact = fade(noise(0.03, 0.3), 0.001, 0.02);
  return mix(concat(impact, new Float64Array(result.length - impact.length)), result);
}

// ── 5. Times up: Urgent alert beep ──────────────────────────────
function generateTimesUp() {
  // Three quick beeps
  const beep = fade(sine(1000, 0.1, 0.5), 0.005, 0.03);
  const gap = new Float64Array(Math.floor(SAMPLE_RATE * 0.08));
  return concat(beep, gap, beep, gap, beep);
}

// ── 6. Final Jeopardy: Thinking music (30 second loop) ─────────
function generateFinalJeopardy() {
  // Classic "thinking" style music — simple repeating melodic pattern
  // We'll create a 30-second piece with a ticking rhythm + simple melody

  const bpm = 120;
  const beatDur = 60 / bpm;

  // Base tick pattern (pizzicato-style plucks)
  function pluck(freq, dur = 0.15) {
    const n = Math.floor(SAMPLE_RATE * dur);
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const decay = Math.exp(-t * 15);
      samples[i] =
        decay *
        0.3 *
        (Math.sin(2 * Math.PI * freq * t) +
          0.3 * Math.sin(2 * Math.PI * freq * 2 * t) +
          0.1 * Math.sin(2 * Math.PI * freq * 3 * t));
    }
    return samples;
  }

  // Melody notes (simple pattern that repeats) — in key of C
  // Pattern inspired by thinking/suspense music
  const melodyPattern = [
    // Bar 1
    { note: 523, dur: beatDur }, // C5
    { note: 494, dur: beatDur }, // B4
    { note: 523, dur: beatDur }, // C5
    { note: 587, dur: beatDur }, // D5
    // Bar 2
    { note: 523, dur: beatDur }, // C5
    { note: 494, dur: beatDur }, // B4
    { note: 440, dur: beatDur }, // A4
    { note: 494, dur: beatDur }, // B4
    // Bar 3
    { note: 523, dur: beatDur }, // C5
    { note: 587, dur: beatDur }, // D5
    { note: 659, dur: beatDur }, // E5
    { note: 587, dur: beatDur }, // D5
    // Bar 4
    { note: 523, dur: beatDur * 2 }, // C5 (held)
    { note: 0, dur: beatDur * 2 }, // rest
  ];

  // Bass notes (root notes, slower)
  const bassPattern = [
    { note: 131, dur: beatDur * 2 }, // C3
    { note: 131, dur: beatDur * 2 }, // C3
    { note: 110, dur: beatDur * 2 }, // A2
    { note: 123, dur: beatDur * 2 }, // B2
    { note: 131, dur: beatDur * 2 }, // C3
    { note: 147, dur: beatDur * 2 }, // D3
    { note: 131, dur: beatDur * 4 }, // C3 (held)
  ];

  // Generate melody
  const melodyParts = [];
  for (const { note, dur } of melodyPattern) {
    if (note === 0) {
      melodyParts.push(new Float64Array(Math.floor(SAMPLE_RATE * dur)));
    } else {
      const p = pluck(note, dur);
      // Pad to full beat duration
      const padded = new Float64Array(Math.floor(SAMPLE_RATE * dur));
      padded.set(p.slice(0, padded.length));
      melodyParts.push(padded);
    }
  }
  const melodyOnce = concat(...melodyParts);

  // Generate bass
  const bassParts = [];
  for (const { note, dur } of bassPattern) {
    const t = sine(note, dur, 0.2);
    fade(t, 0.01, 0.05);
    bassParts.push(t);
  }
  const bassOnce = concat(...bassParts);

  // Loop to fill 30 seconds
  const totalDuration = 30;
  const totalSamples = Math.floor(SAMPLE_RATE * totalDuration);

  const melody = new Float64Array(totalSamples);
  const bass = new Float64Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    melody[i] = melodyOnce[i % melodyOnce.length];
    bass[i] = bassOnce[i % bassOnce.length];
  }

  // Add subtle ticking (metronome feel)
  const tick = new Float64Array(totalSamples);
  const tickInterval = Math.floor(SAMPLE_RATE * beatDur);
  for (let beat = 0; beat * tickInterval < totalSamples; beat++) {
    const start = beat * tickInterval;
    const tickSound = fade(noise(0.01, 0.08), 0.001, 0.005);
    for (let j = 0; j < tickSound.length && start + j < totalSamples; j++) {
      tick[start + j] = tickSound[j];
    }
  }

  return mix(melody, bass, tick);
}

// ── Generate all sounds ─────────────────────────────────────────
console.log("Generating sound effects...\n");

writeWav("buzz-in.wav", generateBuzzIn());
writeWav("correct.wav", generateCorrect());
writeWav("wrong.wav", generateWrong());
writeWav("daily-double.wav", generateDailyDouble());
writeWav("times-up.wav", generateTimesUp());
writeWav("final-jeopardy.wav", generateFinalJeopardy());

console.log("\nDone! Files saved to public/sounds/");
console.log("Swap any file with a real .wav or .mp3 to upgrade the sound.");
