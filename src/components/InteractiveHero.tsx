"use client";

import { useCallback, useEffect, useRef } from "react";

interface GradientLayer {
  x: number;
  y: number;
  lerp: number;
  radius: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  // Sine-wave drift parameters
  phaseX: number;
  phaseY: number;
  freqX: number;
  freqY: number;
  ampX: number;
  ampY: number;
  // Color
  hue: number; // 210 (blue) to 190 (cyan)
}

function createParticles(width: number, height: number, count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.15,
    radius: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.25 + 0.15,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    freqX: Math.random() * 0.003 + 0.001,
    freqY: Math.random() * 0.003 + 0.001,
    ampX: Math.random() * 0.3 + 0.1,
    ampY: Math.random() * 0.3 + 0.1,
    hue: Math.random() * 20 + 190, // 190-210 range (cyan to blue)
  }));
}

export default function InteractiveHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const mousePxRef = useRef({ x: -1000, y: -1000 }); // pixel coords for particle repulsion
  const layersRef = useRef<GradientLayer[]>([
    { x: 50, y: 50, lerp: 0.015, radius: 900, color: "rgba(0, 102, 255, 0.10)" },
    { x: 50, y: 50, lerp: 0.035, radius: 600, color: "rgba(0, 212, 255, 0.08)" },
    { x: 50, y: 50, lerp: 0.06, radius: 400, color: "rgba(0, 102, 255, 0.06)" },
  ]);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    mousePxRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mousePxRef.current = { x: -1000, y: -1000 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Re-init particles if empty or on resize
      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(rect.width, rect.height, 80);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const CONNECTION_DIST = 120;
    const MOUSE_REPEL_DIST = 100;
    const MOUSE_REPEL_FORCE = 0.8;

    const animate = () => {
      timeRef.current++;
      const { width, height } = canvas;
      const particles = particlesRef.current;
      const mouse = mousePxRef.current;
      const layers = layersRef.current;
      const mousePercent = mouseRef.current;

      // --- Gradient aurora ---
      let gradientMoved = false;
      for (const layer of layers) {
        const dx = mousePercent.x - layer.x;
        const dy = mousePercent.y - layer.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          layer.x += dx * layer.lerp;
          layer.y += dy * layer.lerp;
          gradientMoved = true;
        }
      }
      if (gradientMoved && elementRef.current) {
        const bg = `
          radial-gradient(${layers[0].radius}px circle at ${layers[0].x}% ${layers[0].y}%, ${layers[0].color}, transparent 45%),
          radial-gradient(${layers[1].radius}px circle at ${layers[1].x + 8}% ${layers[1].y - 6}%, ${layers[1].color}, transparent 45%),
          radial-gradient(${layers[2].radius}px circle at ${100 - layers[2].x * 0.4}% ${100 - layers[2].y * 0.4}%, ${layers[2].color}, transparent 50%)
        `;
        elementRef.current.style.background = bg;
      }

      // --- Particles ---
      ctx.clearRect(0, 0, width, height);
      const t = timeRef.current;

      for (const p of particles) {
        // Sine-wave drift
        const sineX = Math.sin(t * p.freqX + p.phaseX) * p.ampX;
        const sineY = Math.cos(t * p.freqY + p.phaseY) * p.ampY;

        p.x += p.vx + sineX;
        p.y += p.vy + sineY;

        // Mouse repulsion
        const dmx = p.x - mouse.x;
        const dmy = p.y - mouse.y;
        const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);
        if (distMouse < MOUSE_REPEL_DIST && distMouse > 0) {
          const force = (1 - distMouse / MOUSE_REPEL_DIST) * MOUSE_REPEL_FORCE;
          p.x += (dmx / distMouse) * force;
          p.y += (dmy / distMouse) * force;
        }

        // Wrap edges with padding
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${p.opacity})`;
        ctx.fill();
      }

      // --- Connections (synapse lines) ---
      {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONNECTION_DIST) {
              const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(0, 140, 255, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="absolute inset-0 overflow-hidden"
    >
      {/* Gradient aurora layer */}
      <div
        ref={elementRef}
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(900px circle at 50% 50%, rgba(0, 102, 255, 0.10), transparent 45%),
            radial-gradient(600px circle at 58% 44%, rgba(0, 212, 255, 0.08), transparent 45%),
            radial-gradient(400px circle at 80% 80%, rgba(0, 102, 255, 0.06), transparent 50%)
          `,
        }}
      />

      {/* Particle canvas layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />

    </div>
  );
}
