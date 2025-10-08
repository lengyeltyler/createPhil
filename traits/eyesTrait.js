// public/traitGeneration/eyesTrait.js
// Eyes: palette-driven frame + randomized spiral iris (no dots).
// - 13 palettes, each with [bright, darkA, darkB]
// - frame uses bright; spirals use darks
// - randomized spiral styles (rings/log/tight/loose/rose/sinewave/noisy/fermat/lituus/arch)

import { getSecureRandomNumber } from "../utils/colorUtils.js";
import { validateSVGSize } from "../utils/sizeValidation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SIZE = 420;

// ---------- rng & helpers ----------
const R  = (min, max) => min + getSecureRandomNumber() * (max - min);
const RI = (min, max) => Math.floor(R(min, max + 1));
const round = (n, d = 2) => Number(n.toFixed(d));

function uid(prefix = "u") {
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  return prefix + "-" + Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("");
}

// Hit-test to ensure we pick a center inside the eye path
function isPointInPathRasterized(pathData, x, y, viewBox = `0 0 ${SIZE} ${SIZE}`) {
  const [minX, minY, width, height] = viewBox.split(" ").map(Number);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  const p = new Path2D(pathData);
  ctx.fill(p);
  const nx = x - minX, ny = y - minY;
  return ctx.isPointInPath(p, nx, ny);
}

function pickCenterInside(pathData, viewBox) {
  const [minX, minY, w, h] = viewBox.split(" ").map(Number);
  for (let attempts = 0; attempts < 800; attempts++) {
    const x = minX + w * (0.35 + getSecureRandomNumber() * 0.30);
    const y = minY + h * (0.35 + getSecureRandomNumber() * 0.30);
    if (isPointInPathRasterized(pathData, x, y, viewBox)) return { cx: x, cy: y };
  }
  return { cx: minX + w/2, cy: minY + h/2 };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

// ---------- palettes: [bright, darkA, darkB] ----------
const PALETTES = [
  ["#ffffff", "#3a8bff", "#2c2f73"],   // 1 bright white, blue, deep indigo
  ["#ffe066", "#7c2d12", "#1f2937"],   // 2 warm bright, rust, slate
  ["#f5f5f5", "#06b6d4", "#0e7490"],   // 3 cool gray, cyan, teal
  ["#fef3c7", "#7dd3fc", "#1f2a44"],   // 4 cream, sky, navy
  ["#fff7ed", "#fb7185", "#7c2040"],   // 5 peach, rose, wine
  ["#e5e7eb", "#a78bfa", "#3730a3"],   // 6 gray, purple, indigo
  ["#fef9c3", "#34d399", "#065f46"],   // 7 lemon, green, pine
  ["#fafaf9", "#f97316", "#7c2d12"],   // 8 offwhite, orange, rust
  ["#fdf2f8", "#22d3ee", "#155e75"],   // 9 pinkish, cyan, petrol
  ["#fff1f2", "#f472b6", "#831843"],   // 10 blush, pink, plum
  ["#f0fdf4", "#10b981", "#064e3b"],   // 11 mint, emerald, forest
  ["#f1f5f9", "#60a5fa", "#1e3a8a"],   // 12 cool gray, blue, deep blue
  ["#fde68a", "#ef4444", "#1f2937"],   // 13 gold, red, slate
];

// ---------- spiral styles ----------
const SPIRAL_STYLES = [
  "rings", "log", "tight", "loose", "rose", "sinewave", "noisy", "fermat", "lituus", "arch"
];

// Build a polyline spiral path string from points
function toPath(points) {
  if (!points.length) return "";
  let d = `M ${round(points[0].x,2)} ${round(points[0].y,2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${round(points[i].x,2)} ${round(points[i].y,2)}`;
  }
  return d;
}

// Generate spiral points around (cx,cy)
function genSpiralPoints({ type, cx, cy, maxR, turns = 3.2, steps = 420 }) {
  const pts = [];
  const twoPiT = turns * 2 * Math.PI;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1);
    const theta = t * twoPiT;
    let r;

    switch (type) {
      case "log": {
        const a = 0.75;
        const b = Math.log(1 + maxR / a) / twoPiT;
        r = a * Math.exp(b * theta);
        break;
      }
      case "tight": {
        r = t * maxR * 0.85;
        break;
      }
      case "loose": {
        r = t * maxR * 1.15;
        break;
      }
      case "rose": {
        const k = 5 + Math.floor(getSecureRandomNumber() * 4); // 5–8 lobes
        const envelope = t * maxR * 1.05;
        r = envelope * (0.5 + 0.5 * Math.abs(Math.sin(k * theta)));
        break;
      }
      case "sinewave": {
        r = t * maxR * (1 + 0.12 * Math.sin(theta * 2.3));
        break;
      }
      case "noisy": {
        const wob = 0.3 * Math.sin(t * 6.0) + 0.2 * Math.sin(t * 11.3);
        r = t * maxR * (1 + wob * 0.2);
        break;
      }
      case "fermat": { // r ∝ √θ
        const c = maxR / Math.sqrt(twoPiT);
        r = c * Math.sqrt(theta);
        break;
      }
      case "lituus": { // r ∝ 1/√θ (reverse)
        const eps = 1e-3;
        const k = maxR * Math.sqrt(twoPiT);
        const th = (1 - t) * twoPiT + eps;
        r = Math.min(k / Math.sqrt(th), maxR);
        break;
      }
      case "arch": { // r ∝ θ
        const k = maxR / twoPiT;
        r = k * theta;
        break;
      }
      case "rings":
      default: {
        r = t * maxR;
      }
    }

    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    pts.push({ x, y, t });
  }
  return pts;
}

// Concentric ellipse "rings" (alternating the two dark colors)
function buildRings({ cx, cy, maxR, colorA, colorB }) {
  const count = RI(54, 72);
  const baseW = R(1.2, 1.9);
  let g = `<g id="iris-rings" fill="none">`;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1 || 1);
    const r = (0.06 + 0.94 * t) * maxR + R(-0.25, 0.25);
    const rx = round(r * (1 + R(-0.015, 0.015)), 3);
    const ry = round(r * (1 + R(-0.015, 0.015)), 3);
    const rot = round(R(-8, 8), 2);
    const sw  = round(baseW * (0.85 + 0.35 * (1 - t)), 2);
    const op  = round(0.85 * (1 - Math.pow(t, 1.3)), 2);
    const col = (i % 2 === 0) ? colorA : colorB;
    g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" stroke="${col}" stroke-width="${sw}" opacity="${op}"/>`;
  }
  g += `</g>`;
  return g;
}

// Spiral strokes (two passes, A on top of B)
function buildSpiralStrokes({ cx, cy, maxR, colorA, colorB, style }) {
  const steps = 360 + RI(-24, 24);
  const turns = 3.0 + R(-0.3, 0.4);
  const pts = genSpiralPoints({ type: style, cx, cy, maxR, turns, steps });
  const d = toPath(pts);

  const wB = round(R(6.5, 9.0), 2);
  const wA = round(wB * R(0.45, 0.65), 2);

  const opB = round(R(0.25, 0.45), 2);
  const opA = round(R(0.65, 0.9),  2);

  // dash pattern to create banding feel
  const dashB = `${round(R(10, 18),1)} ${round(R(7, 14),1)}`;
  const dashA = `${round(R(7, 12),1)} ${round(R(6, 11),1)}`;

  return `
    <g id="iris-spiral" fill="none">
      <path d="${d}" stroke="${colorB}" stroke-width="${wB}" opacity="${opB}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashB}"/>
      <path d="${d}" stroke="${colorA}" stroke-width="${wA}" opacity="${opA}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashA}"/>
    </g>
  `;
}

// Lens glow gradient tinted by the bright frame color
function buildDefs({ cx, cy, lensR, bright }) {
  const idGlow  = uid("glow");
  const idGloss = uid("gloss");
  const defs = `
    <defs>
      <radialGradient id="${idGlow}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${lensR}">
        <stop offset="0"   stop-color="#ffffff" stop-opacity="0.65"/>
        <stop offset="0.55" stop-color="${bright}" stop-opacity="0.35"/>
        <stop offset="1"   stop-color="${bright}" stop-opacity="0"/>
      </radialGradient>

      <radialGradient id="${idGloss}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
  `.replace(/\s*\n\s*/g, " ").trim();

  return { defs, idGlow, idGloss };
}

function buildGloss({ idGloss, cx, cy }) {
  const rx = round(R(32, 44), 2);
  const ry = round(R(18, 26), 2);
  const dx = round(R(-22, -10), 2);
  const dy = round(R(-18, -6), 2);
  const rot = round(R(-18, 18), 2);
  return `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="${rx}" ry="${ry}" fill="url(#${idGloss})" transform="rotate(${rot} ${cx + dx} ${cy + dy})" opacity="0.7"/>`;
}

// ---------- main ----------
export async function generateTrait(jsonData) {
  if (!jsonData) {
    const base = "/traits_json";
    const [eyesData, frameData] = await Promise.all([
      fetchJSON(`${base}/eyesOutline.json`),
      fetchJSON(`${base}/frameOutline.json`),
    ]);
    jsonData = { eyes: eyesData, frames: frameData };
  }

  if (!jsonData?.eyes?.pathData || !jsonData?.frames?.pathData) {
    throw new Error("Eyes trait requires eyes.pathData and frames.pathData.");
  }

  const viewBox = jsonData.eyes.viewBox || `0 0 ${SIZE} ${SIZE}`;
  const { cx, cy } = pickCenterInside(jsonData.eyes.pathData, viewBox);

  // pick palette -> [bright, darkA, darkB]
  const [bright, darkA, darkB] = PALETTES[RI(0, PALETTES.length - 1)];

  const maxR  = Math.min(SIZE, SIZE) * R(0.27, 0.33);
  const lensR = round(maxR * R(1.05, 1.25), 2);

  const { defs, idGlow, idGloss } = buildDefs({ cx, cy, lensR, bright });

  // choose spiral style
  const style = SPIRAL_STYLES[RI(0, SPIRAL_STYLES.length - 1)];

  // build iris content (either rings or stroke spirals)
  const iris =
    style === "rings"
      ? buildRings({ cx, cy, maxR, colorA: darkA, colorB: darkB })
      : buildSpiralStrokes({ cx, cy, maxR, colorA: darkA, colorB: darkB, style });

  const gloss = buildGloss({ idGloss, cx, cy });
  const maskId = uid("mask");

  const svg = `
    <svg xmlns="${SVG_NS}" width="${SIZE}" height="${SIZE}" viewBox="${viewBox}">
      ${defs}

      <!-- Frame uses the bright color from the palette -->
      <path d="${jsonData.frames.pathData}" fill="${bright}" opacity="1"/>

      <!-- Lens base + iris, clipped to eye -->
      <mask id="${maskId}">
        <path d="${jsonData.eyes.pathData}" fill="#fff"/>
      </mask>
      <g mask="url(#${maskId})">
        <rect x="0" y="0" width="100%" height="100%" fill="url(#${idGlow})"/>
        ${iris}
        ${gloss}
      </g>

      <!-- Eye outline on top for crisp edge -->
      <path d="${jsonData.eyes.pathData}" fill="none" stroke="${bright}" stroke-width="1.2" opacity="0.9"/>
    </svg>
  `.replace(/\s*\n\s*/g, " ").trim();

  validateSVGSize(svg);
  return svg;
}

export default { generateTrait };