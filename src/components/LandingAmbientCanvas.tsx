import React, { useEffect, useRef } from 'react';

export type LandingTheme = 'dark' | 'light';

interface LandingAmbientCanvasProps {
  theme: LandingTheme;
  active: boolean;
}

interface Pt {
  x: number;
  y: number;
}

type ArtifactKind = 'stroke' | 'card' | 'sticky' | 'arrow' | 'highlight' | 'code';

interface Artifact {
  id: number;
  kind: ArtifactKind;
  x: number;
  y: number;
  w: number;
  h: number;
  points: Pt[];
  colorIdx: number;
  createdAt: number;
  duration: number;
  lifetime: number;
  rotation: number;
  lineCount: number;
}

interface VirtualAgent {
  name: string;
  colorIdx: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  state: 'travel' | 'work' | 'pause';
  stateStart: number;
  stateDuration: number;
  activeArtifactId: number | null;
  phaseOffset: number;
}

const AGENT_NAMES = ['Selin', 'Kaan', 'Elif', 'Mert', 'Deniz', 'Arda'];

const DARK_COLORS = [
  '#60a5fa', // cobalt blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#fb7185', // rose
  '#38bdf8', // sky
];

const LIGHT_COLORS = [
  '#2563eb', // cobalt blue
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#e11d48', // rose
  '#0284c7', // sky
];

const DARK_STICKY_BG = [
  'rgba(251, 191, 36, 0.22)',
  'rgba(52, 211, 153, 0.20)',
  'rgba(96, 165, 250, 0.22)',
  'rgba(251, 113, 133, 0.20)',
  'rgba(167, 139, 250, 0.22)',
  'rgba(56, 189, 248, 0.20)',
];

const LIGHT_STICKY_BG = [
  'rgba(254, 240, 138, 0.90)',
  'rgba(167, 243, 208, 0.85)',
  'rgba(191, 219, 254, 0.88)',
  'rgba(254, 205, 211, 0.86)',
  'rgba(221, 214, 254, 0.86)',
  'rgba(186, 230, 253, 0.86)',
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 4);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${b})`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function buildOrganicStroke(startX: number, startY: number, seed: number): Pt[] {
  const pts: Pt[] = [];
  const segments = 26;
  const style = Math.floor(Math.abs(Math.sin(seed * 13.7)) * 3);
  const dir = Math.cos(seed * 7.1) >= 0 ? 1 : -1;
  const span = 150 + (Math.abs(Math.sin(seed * 3.9)) * 160);
  const amp = 28 + Math.abs(Math.cos(seed * 5.3)) * 55;

  if (style === 0) {
    // Expressive flowing wave / sketch underline
    for (let i = 0; i <= segments; i++) {
      const p = i / segments;
      pts.push({
        x: startX + dir * p * span,
        y: startY + Math.sin(p * Math.PI * 2.2 + seed) * amp,
      });
    }
  } else if (style === 1) {
    // Loose hand-drawn circle / loop
    const rx = 52 + Math.abs(Math.sin(seed * 2.3)) * 45;
    const ry = 38 + Math.abs(Math.cos(seed * 4.1)) * 35;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2.08;
      pts.push({
        x: startX + Math.cos(a) * rx - rx,
        y: startY + Math.sin(a) * ry,
      });
    }
  } else {
    // Architectural zig-zag / diagram arc
    for (let i = 0; i <= segments; i++) {
      const p = i / segments;
      const arch = Math.sin(p * Math.PI) * amp * 1.15;
      pts.push({
        x: startX + dir * p * span,
        y: startY - arch + Math.sin(p * Math.PI * 4) * 8,
      });
    }
  }
  return pts;
}

export const LandingAmbientCanvas: React.FC<LandingAmbientCanvasProps> = ({
  theme,
  active,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetThemeMixRef = useRef<number>(theme === 'light' ? 1 : 0);
  const activeRef = useRef<boolean>(active);

  useEffect(() => {
    targetThemeMixRef.current = theme === 'light' ? 1 : 0;
  }, [theme]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    let nextArtifactId = 1;
    let simTime = 0;
    let camX = 0;
    let camY = 0;
    let themeMix = targetThemeMixRef.current;

    const artifacts: Artifact[] = [];

    // Helper: pick a point around the current camera, gently favoring left & right outer lanes
    // so activity frames the centered 440px entry card cleanly
    const pickSpawnPoint = (seed: number, preferSides = true): Pt => {
      const halfW = width * 0.5;
      const halfH = height * 0.5;
      let ox: number;
      if (preferSides && width > 680) {
        const side = Math.sin(seed * 19.3) >= 0 ? 1 : -1;
        const innerSafe = Math.min(230, halfW * 0.34);
        const outerBound = Math.max(innerSafe + 120, halfW * 0.92);
        ox = side * lerp(innerSafe, outerBound, Math.abs(Math.sin(seed * 7.7)));
      } else {
        ox = (Math.sin(seed * 11.3) * 0.82) * halfW;
      }
      const oy = (Math.cos(seed * 5.9) * 0.78) * halfH;
      return { x: camX + ox, y: camY + oy };
    };

    const createArtifactAt = (
      x: number,
      y: number,
      colorIdx: number,
      now: number,
      seed: number,
      alreadyBuilt = false
    ): Artifact => {
      const kinds: ArtifactKind[] = ['stroke', 'card', 'sticky', 'arrow', 'highlight', 'code'];
      const kind = kinds[Math.floor(Math.abs(Math.sin(seed * 23.1)) * kinds.length) % kinds.length];
      const duration = 2.4 + Math.abs(Math.cos(seed * 4.7)) * 2.2;
      const lifetime = 19 + Math.abs(Math.sin(seed * 9.1)) * 12;

      let w = 150 + Math.abs(Math.sin(seed * 6.3)) * 85;
      let h = 95 + Math.abs(Math.cos(seed * 3.1)) * 55;
      let points: Pt[] = [];

      if (kind === 'stroke') {
        points = buildOrganicStroke(x, y, seed);
      } else if (kind === 'highlight') {
        const len = 140 + Math.abs(Math.sin(seed * 8.2)) * 140;
        const dir = Math.cos(seed * 3.3) >= 0 ? 1 : -1;
        points = [
          { x, y },
          { x: x + dir * len * 0.5, y: y + Math.sin(seed) * 14 },
          { x: x + dir * len, y: y + Math.cos(seed) * 10 },
        ];
      } else if (kind === 'arrow') {
        const dx = (Math.cos(seed * 5.7) >= 0 ? 1 : -1) * (130 + Math.abs(Math.sin(seed)) * 120);
        const dy = Math.sin(seed * 3.7) * 95;
        points = [
          { x, y },
          { x: x + dx * 0.5, y: y + dy * 0.25 - 38 },
          { x: x + dx, y: y + dy },
        ];
      } else if (kind === 'sticky') {
        w = 128 + Math.abs(Math.sin(seed * 4.4)) * 34;
        h = 112 + Math.abs(Math.cos(seed * 2.7)) * 26;
      } else if (kind === 'code') {
        w = 190 + Math.abs(Math.sin(seed * 5.1)) * 50;
        h = 118 + Math.abs(Math.cos(seed * 3.9)) * 24;
      }

      return {
        id: nextArtifactId++,
        kind,
        x,
        y,
        w,
        h,
        points,
        colorIdx,
        createdAt: alreadyBuilt ? now - duration - Math.abs(Math.sin(seed)) * 8 : now,
        duration,
        lifetime,
        rotation: kind === 'sticky' ? (Math.sin(seed * 17) * 0.08) : 0,
        lineCount: 3 + (Math.floor(Math.abs(Math.sin(seed * 11)) * 3)),
      };
    };

    // Pre-seed rich initial collaborative board so frame 0 is immediately alive
    for (let i = 0; i < 16; i++) {
      const pt = pickSpawnPoint(i + 1.37, true);
      artifacts.push(createArtifactAt(pt.x, pt.y, i % DARK_COLORS.length, 0, i * 2.13 + 0.7, true));
    }

    // Spawn 6 independent autonomous collaborator agents
    const agents: VirtualAgent[] = AGENT_NAMES.map((name, idx) => {
      const start = pickSpawnPoint(idx * 3.7 + 10, true);
      const target = pickSpawnPoint(idx * 5.1 + 21, true);
      return {
        name,
        colorIdx: idx % DARK_COLORS.length,
        x: start.x,
        y: start.y,
        startX: start.x,
        startY: start.y,
        targetX: target.x,
        targetY: target.y,
        state: 'travel',
        stateStart: -idx * 0.45,
        stateDuration: 1.8 + (idx % 3) * 0.7,
        activeArtifactId: null,
        phaseOffset: idx * 1.91 + 0.5,
      };
    });

    const drawArtifact = (a: Artifact, now: number, tMix: number) => {
      const age = now - a.createdAt;
      if (age < 0 || age > a.lifetime) return;

      const buildProgress = Math.min(1, age / Math.max(0.1, a.duration));
      const fadeIn = Math.min(1, age / 0.45);
      const fadeOut = age > a.lifetime - 4.5 ? Math.max(0, (a.lifetime - age) / 4.5) : 1;
      const alpha = fadeIn * fadeOut;
      if (alpha <= 0.01) return;

      const sx = a.x - camX + width * 0.5;
      const sy = a.y - camY + height * 0.5;

      // Broad frustum culling
      if (sx < -420 || sx > width + 420 || sy < -420 || sy > height + 420) return;

      const strokeColor = mixHex(DARK_COLORS[a.colorIdx], LIGHT_COLORS[a.colorIdx], tMix);
      const cardFill =
        tMix < 0.5
          ? `rgba(15, 23, 42, ${0.72 * alpha})`
          : `rgba(255, 255, 255, ${0.9 * alpha})`;
      const cardLine =
        tMix < 0.5
          ? `rgba(148, 163, 184, ${0.32 * alpha})`
          : `rgba(100, 116, 139, ${0.32 * alpha})`;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (a.kind === 'stroke' && a.points.length > 1) {
        const maxIdx = Math.max(1, Math.floor(buildProgress * (a.points.length - 1)));
        ctx.beginPath();
        const p0 = a.points[0];
        ctx.moveTo(p0.x - camX + width * 0.5, p0.y - camY + height * 0.5);
        for (let i = 1; i <= maxIdx; i++) {
          const prev = a.points[i - 1];
          const curr = a.points[i];
          const mx = ((prev.x + curr.x) * 0.5) - camX + width * 0.5;
          const my = ((prev.y + curr.y) * 0.5) - camY + height * 0.5;
          ctx.quadraticCurveTo(
            prev.x - camX + width * 0.5,
            prev.y - camY + height * 0.5,
            mx,
            my
          );
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (a.kind === 'highlight' && a.points.length >= 3) {
        const p0 = a.points[0];
        const p1 = a.points[1];
        const p2 = a.points[2];
        const t = easeOutQuart(buildProgress);
        const ex = lerp(p0.x, p2.x, t);
        const ey = lerp(p0.y, p2.y, t);
        ctx.beginPath();
        ctx.moveTo(p0.x - camX + width * 0.5, p0.y - camY + height * 0.5);
        ctx.quadraticCurveTo(
          lerp(p0.x, p1.x, t) - camX + width * 0.5,
          lerp(p0.y, p1.y, t) - camY + height * 0.5,
          ex - camX + width * 0.5,
          ey - camY + height * 0.5
        );
        ctx.globalAlpha = alpha * (tMix < 0.5 ? 0.3 : 0.28);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else if (a.kind === 'arrow' && a.points.length >= 3) {
        const [p0, p1, p2] = a.points;
        const steps = Math.max(2, Math.floor(easeOutQuart(buildProgress) * 20));
        ctx.beginPath();
        let lastX = p0.x;
        let lastY = p0.y;
        let prevX = p0.x;
        let prevY = p0.y;
        for (let i = 0; i <= steps; i++) {
          const u = i / 20;
          const inv = 1 - u;
          const bx = inv * inv * p0.x + 2 * inv * u * p1.x + u * u * p2.x;
          const by = inv * inv * p0.y + 2 * inv * u * p1.y + u * u * p2.y;
          if (i === 0) {
            ctx.moveTo(bx - camX + width * 0.5, by - camY + height * 0.5);
          } else {
            ctx.lineTo(bx - camX + width * 0.5, by - camY + height * 0.5);
          }
          prevX = lastX;
          prevY = lastY;
          lastX = bx;
          lastY = by;
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Arrowhead
        if (steps >= 4) {
          const ang = Math.atan2(lastY - prevY, lastX - prevX);
          const tipX = lastX - camX + width * 0.5;
          const tipY = lastY - camY + height * 0.5;
          const headLen = 11;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(
            tipX - headLen * Math.cos(ang - Math.PI / 6),
            tipY - headLen * Math.sin(ang - Math.PI / 6)
          );
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(
            tipX - headLen * Math.cos(ang + Math.PI / 6),
            tipY - headLen * Math.sin(ang + Math.PI / 6)
          );
          ctx.stroke();
        }
      } else if (a.kind === 'card') {
        const bw = a.w * easeOutQuart(Math.min(1, buildProgress * 1.4));
        const bh = a.h * easeOutQuart(Math.min(1, buildProgress * 1.4));
        roundRectPath(ctx, sx, sy, bw, bh, 14);
        ctx.fillStyle = cardFill;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Selection handles while being constructed
        if (buildProgress < 0.98) {
          ctx.fillStyle = strokeColor;
          const hs = 6;
          ctx.fillRect(sx - hs / 2, sy - hs / 2, hs, hs);
          ctx.fillRect(sx + bw - hs / 2, sy - hs / 2, hs, hs);
          ctx.fillRect(sx - hs / 2, sy + bh - hs / 2, hs, hs);
          ctx.fillRect(sx + bw - hs / 2, sy + bh - hs / 2, hs, hs);
        }

        // Wireframe content lines
        const lineProgress = Math.max(0, (buildProgress - 0.35) / 0.65);
        if (lineProgress > 0 && bw > 50) {
          ctx.fillStyle = strokeColor;
          ctx.globalAlpha = alpha * 0.65;
          roundRectPath(ctx, sx + 14, sy + 14, (bw - 28) * 0.45 * lineProgress, 8, 4);
          ctx.fill();

          ctx.fillStyle = cardLine;
          ctx.globalAlpha = alpha * 0.9;
          for (let i = 0; i < 3; i++) {
            const ly = sy + 34 + i * 16;
            if (ly + 8 < sy + bh - 10) {
              const frac = i === 2 ? 0.55 : 0.85;
              roundRectPath(ctx, sx + 14, ly, (bw - 28) * frac * lineProgress, 6, 3);
              ctx.fill();
            }
          }
        }
      } else if (a.kind === 'sticky') {
        const scale = easeOutQuart(Math.min(1, buildProgress * 1.6));
        ctx.translate(sx + a.w * 0.5, sy + a.h * 0.5);
        ctx.rotate(a.rotation);
        ctx.scale(scale, scale);

        roundRectPath(ctx, -a.w * 0.5, -a.h * 0.5, a.w, a.h, 12);
        ctx.fillStyle =
          tMix < 0.5 ? DARK_STICKY_BG[a.colorIdx] : LIGHT_STICKY_BG[a.colorIdx];
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Simulated handwritten note lines
        const textP = Math.max(0, (buildProgress - 0.3) / 0.7);
        ctx.fillStyle = tMix < 0.5 ? 'rgba(241,245,249,0.55)' : 'rgba(15,23,42,0.38)';
        for (let i = 0; i < 3; i++) {
          const lp = Math.max(0, Math.min(1, textP * 3 - i));
          if (lp > 0) {
            const lw = (a.w - 30) * (i === 2 ? 0.6 : 0.9) * lp;
            roundRectPath(ctx, -a.w * 0.5 + 15, -a.h * 0.5 + 22 + i * 20, lw, 6, 3);
            ctx.fill();
          }
        }
      } else if (a.kind === 'code') {
        const bw = a.w * easeOutQuart(Math.min(1, buildProgress * 1.35));
        const bh = a.h * easeOutQuart(Math.min(1, buildProgress * 1.35));
        roundRectPath(ctx, sx, sy, bw, bh, 12);
        ctx.fillStyle =
          tMix < 0.5 ? `rgba(9, 13, 24, ${0.84 * alpha})` : `rgba(15, 23, 42, ${0.88 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Syntax bar lines inside mini code block
        const lineP = Math.max(0, (buildProgress - 0.25) / 0.75);
        if (lineP > 0 && bw > 60) {
          const codePalette = ['#60a5fa', '#34d399', '#fbbf24', '#c084fc'];
          for (let i = 0; i < 4; i++) {
            const lp = Math.max(0, Math.min(1, lineP * 4 - i));
            if (lp <= 0) continue;
            const indent = i === 1 || i === 2 ? 26 : 14;
            const ly = sy + 20 + i * 18;
            if (ly + 6 > sy + bh - 10) break;
            ctx.fillStyle = codePalette[(a.colorIdx + i) % codePalette.length];
            roundRectPath(ctx, sx + indent, ly, Math.max(14, (bw - indent - 24) * 0.35 * lp), 6, 3);
            ctx.fill();
            ctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
            const secondX = sx + indent + Math.max(18, (bw - indent - 24) * 0.4);
            if (secondX < sx + bw - 16) {
              roundRectPath(
                ctx,
                secondX,
                ly,
                Math.max(8, (sx + bw - 16 - secondX) * (i % 2 === 0 ? 0.8 : 0.55) * lp),
                6,
                3
              );
              ctx.fill();
            }
          }
        }
      }

      ctx.restore();
    };

    const drawCursor = (agent: VirtualAgent, tMix: number) => {
      const sx = agent.x - camX + width * 0.5;
      const sy = agent.y - camY + height * 0.5;
      if (sx < -120 || sx > width + 120 || sy < -120 || sy > height + 120) return;

      const color = mixHex(DARK_COLORS[agent.colorIdx], LIGHT_COLORS[agent.colorIdx], tMix);

      ctx.save();
      ctx.translate(sx, sy);

      // Crisp SVG-style collaborative pointer arrow
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(5, 14);
      ctx.lineTo(9.5, 21);
      ctx.lineTo(12.5, 19.5);
      ctx.lineTo(8, 12.5);
      ctx.lineTo(14, 12);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = tMix < 0.5 ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Subtle name label next to pointer
      ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
      const labelW = ctx.measureText(agent.name).width + 14;
      roundRectPath(ctx, 13, 14, labelW, 20, 6);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(agent.name, 20, 24.5);

      ctx.restore();
    };

    let rafId = 0;
    let lastTimestamp = performance.now();

    const frame = (nowMs: number) => {
      rafId = window.requestAnimationFrame(frame);
      if (document.hidden || !activeRef.current) {
        lastTimestamp = nowMs;
        return;
      }

      const rawDt = (nowMs - lastTimestamp) / 1000;
      lastTimestamp = nowMs;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      // Smoothly interpolate theme color transition
      const targetMix = targetThemeMixRef.current;
      themeMix += (targetMix - themeMix) * Math.min(1, dt * 6.5);

      const speedScale = prefersReducedMotion ? 0.12 : 1;
      simTime += dt * speedScale;

      // Infinite non-repeating organic camera drift (never jumps or resets)
      const vx =
        (24 + 14 * Math.sin(simTime * 0.19) + 9 * Math.cos(simTime * 0.073)) * speedScale;
      const vy =
        (13 * Math.cos(simTime * 0.14) + 10 * Math.sin(simTime * 0.089)) * speedScale;
      camX += vx * dt;
      camY += vy * dt;

      // Update autonomous collaborator agents
      for (let i = 0; i < agents.length; i++) {
        const ag = agents[i];
        const elapsed = simTime - ag.stateStart;
        const p = Math.min(1, Math.max(0, elapsed / Math.max(0.1, ag.stateDuration)));

        if (ag.state === 'travel') {
          const ep = easeInOutCubic(p);
          const arcLift = Math.sin(p * Math.PI) * 28 * (i % 2 === 0 ? 1 : -1);
          ag.x = lerp(ag.startX, ag.targetX, ep);
          ag.y = lerp(ag.startY, ag.targetY, ep) + arcLift;

          if (p >= 1) {
            const seed = simTime * 1.7 + ag.phaseOffset + nextArtifactId * 0.37;
            const art = createArtifactAt(ag.x, ag.y, ag.colorIdx, simTime, seed, false);
            artifacts.push(art);
            ag.activeArtifactId = art.id;
            ag.state = 'work';
            ag.stateStart = simTime;
            ag.stateDuration = art.duration;
          }
        } else if (ag.state === 'work') {
          const art = artifacts.find((item) => item.id === ag.activeArtifactId);
          if (art) {
            if (art.kind === 'stroke' && art.points.length > 1) {
              const fIdx = p * (art.points.length - 1);
              const lo = Math.floor(fIdx);
              const hi = Math.min(art.points.length - 1, lo + 1);
              const frac = fIdx - lo;
              ag.x = lerp(art.points[lo].x, art.points[hi].x, frac);
              ag.y = lerp(art.points[lo].y, art.points[hi].y, frac);
            } else if ((art.kind === 'arrow' || art.kind === 'highlight') && art.points.length >= 3) {
              const [p0, p1, p2] = art.points;
              const u = easeOutQuart(p);
              const inv = 1 - u;
              ag.x = inv * inv * p0.x + 2 * inv * u * p1.x + u * u * p2.x;
              ag.y = inv * inv * p0.y + 2 * inv * u * p1.y + u * u * p2.y;
            } else {
              // Dragging bottom-right corner of card/sticky/code block
              const u = easeOutQuart(Math.min(1, p * 1.4));
              ag.x = art.x + art.w * u;
              ag.y = art.y + art.h * u;
            }
          }

          if (p >= 1) {
            ag.state = 'pause';
            ag.stateStart = simTime;
            ag.stateDuration = 0.55 + Math.abs(Math.sin(simTime + ag.phaseOffset)) * 0.9;
            ag.activeArtifactId = null;
          }
        } else {
          // Subtle idle micro-drift
          ag.x += Math.sin(simTime * 3 + ag.phaseOffset) * 0.25;
          ag.y += Math.cos(simTime * 2.6 + ag.phaseOffset) * 0.25;
          if (p >= 1) {
            const nextSeed = simTime * 2.3 + ag.phaseOffset * 4.1 + i * 7.3;
            const nextTarget = pickSpawnPoint(nextSeed, true);
            ag.startX = ag.x;
            ag.startY = ag.y;
            ag.targetX = nextTarget.x;
            ag.targetY = nextTarget.y;
            ag.state = 'travel';
            ag.stateStart = simTime;
            ag.stateDuration = 1.6 + Math.abs(Math.cos(nextSeed)) * 1.5;
          }
        }
      }

      // Prune expired artifacts to keep memory strictly bounded
      for (let i = artifacts.length - 1; i >= 0; i--) {
        if (simTime - artifacts[i].createdAt > artifacts[i].lifetime) {
          artifacts.splice(i, 1);
        }
      }
      if (artifacts.length > 48) {
        artifacts.splice(0, artifacts.length - 48);
      }

      // Render frame
      ctx.save();
      ctx.scale(dpr, dpr);

      // Background surface
      ctx.fillStyle = mixHex('#080d1a', '#f1f5f9', themeMix);
      ctx.fillRect(0, 0, width, height);

      // Infinite drifting whiteboard dot-grid
      const step = 30;
      const offsetX = ((-camX % step) + step) % step;
      const offsetY = ((-camY % step) + step) % step;
      ctx.fillStyle = mixHex('#1e293b', '#cbd5e1', themeMix);
      for (let gx = offsetX; gx < width; gx += step) {
        for (let gy = offsetY; gy < height; gy += step) {
          ctx.fillRect(gx, gy, 1.75, 1.75);
        }
      }

      // Subtle atmospheric depth washes
      const g1 = ctx.createRadialGradient(
        width * 0.2,
        height * 0.28,
        0,
        width * 0.2,
        height * 0.28,
        Math.max(width, height) * 0.55
      );
      g1.addColorStop(
        0,
        themeMix < 0.5 ? 'rgba(37, 99, 235, 0.14)' : 'rgba(59, 130, 246, 0.08)'
      );
      g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(
        width * 0.82,
        height * 0.72,
        0,
        width * 0.82,
        height * 0.72,
        Math.max(width, height) * 0.5
      );
      g2.addColorStop(
        0,
        themeMix < 0.5 ? 'rgba(16, 185, 129, 0.10)' : 'rgba(16, 185, 129, 0.07)'
      );
      g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      // Draw all live board artifacts
      for (let i = 0; i < artifacts.length; i++) {
        drawArtifact(artifacts[i], simTime, themeMix);
      }

      // Draw all live collaborator cursors on top
      for (let i = 0; i < agents.length; i++) {
        drawCursor(agents[i], themeMix);
      }

      ctx.restore();
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Live procedural infinite whiteboard canvas with gentle cinematic blur */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full scale-[1.03] transition-[filter] duration-500"
        style={{
          filter: isDark ? 'blur(4px) saturate(1.12)' : 'blur(3.5px) saturate(1.05)',
        }}
      />

      {/* Soft depth vignette so the centered entry card stays razor-focused */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: isDark
            ? 'radial-gradient(circle at 50% 48%, rgba(8, 13, 26, 0.18) 0%, rgba(8, 13, 26, 0.52) 62%, rgba(8, 13, 26, 0.76) 100%)'
            : 'radial-gradient(circle at 50% 48%, rgba(248, 250, 252, 0.12) 0%, rgba(241, 245, 249, 0.42) 64%, rgba(226, 232, 240, 0.68) 100%)',
        }}
      />
    </div>
  );
};
