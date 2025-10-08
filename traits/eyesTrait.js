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
  ["#08090A", "#A7A2A9", "#F4F7F5"],
  ["#00ffffff", "#EEE4E1", "#E7D8C9"],
  ["#F79D5C", "#F52F57", "#A20021"],
  ["#E3EBFF", "#ECE8EF", "#4392F1"],
  ["#845A6D", "#3E1929", "#6E75A8"],
  ["#DAFFED", "#9BF3F0", "#473198"],
  ["#655A7C", "#AB92BF", "#AFC1D6"],
  ["#454851", "#73956F", "#7BAE7F"],
  ["#95F9E3", "#69EBD0", "#49D49D"],
  ["#463730", "#1F5673", "#759FBC"],
  ["#FFBC42", "#D81159", "#8F2D56"],
  ["#F1DAC4", "#A69CAC", "#474973"],
  ["#C4BBB8", "#F5B0CB", "#DC6ACF"],   
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

  // helpers for trochoids
  const normAndPush = (x, y, t) => {
    // center already around (cx,cy); scale handled per-case
    pts.push({ x, y, t });
  };

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1);
    const theta = t * twoPiT;

    // Defaults for legacy styles
    let r, x, y;

    switch (type) {
      case "log": {
        const a = 0.75;
        const b = Math.log(1 + maxR / a) / twoPiT;
        r = a * Math.exp(b * theta);
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      case "tight": { r = t * maxR * 0.85; x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break; }
      case "loose": { r = t * maxR * 1.15; x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break; }
      case "rose": {
        const k = 5 + Math.floor(getSecureRandomNumber() * 4);
        const envelope = t * maxR * 1.05;
        r = envelope * (0.5 + 0.5 * Math.abs(Math.sin(k * theta)));
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "sinewave": { r = t * maxR * (1 + 0.12 * Math.sin(theta * 2.3)); x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break; }
      case "noisy": {
        const wob = 0.3 * Math.sin(t * 6.0) + 0.2 * Math.sin(t * 11.3);
        r = t * maxR * (1 + wob * 0.2);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "fermat": {
        const c = maxR / Math.sqrt(twoPiT);
        r = c * Math.sqrt(theta);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "lituus": {
        const eps = 1e-3;
        const k = maxR * Math.sqrt(twoPiT);
        const th = (1 - t) * twoPiT + eps;
        r = Math.min(k / Math.sqrt(th), maxR);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "arch": {
        const k = maxR / twoPiT;
        r = k * theta;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }

      // ---------- NEW compact / complex ----------
      case "spiro_epitro": {
        // Epitrochoid: R, r, d scaled to stay compact
        const Rb = maxR * 0.28 * (1 + 0.2 * getSecureRandomNumber());
        const rb = Rb * (0.30 + 0.25 * getSecureRandomNumber()); // small gear
        const d  = rb * (0.8 + 0.6 * getSecureRandomNumber());
        const k  = (Rb + rb) / rb;
        const xx = (Rb + rb) * Math.cos(theta) - d * Math.cos(k * theta);
        const yy = (Rb + rb) * Math.sin(theta) - d * Math.sin(k * theta);
        x = cx + xx; y = cy + yy;
        break;
      }
      case "spiro_hypo": {
        // Hypotrochoid (inside). Denser near center.
        const Rb = maxR * 0.32 * (1 + 0.2 * getSecureRandomNumber());
        const rb = Rb * (0.32 + 0.25 * getSecureRandomNumber());
        const d  = rb * (0.7 + 0.5 * getSecureRandomNumber());
        const k  = (Rb - rb) / rb;
        const xx = (Rb - rb) * Math.cos(theta) + d * Math.cos(k * theta);
        const yy = (Rb - rb) * Math.sin(theta) - d * Math.sin(k * theta);
        x = cx + xx; y = cy + yy;
        break;
      }
      case "involute": {
        // Involute of a circle (scaled to ~0.8 maxR)
        const a = maxR * 0.18;
        const th = t * (twoPiT * 0.9);
        const xx = a * (Math.cos(th) + th * Math.sin(th));
        const yy = a * (Math.sin(th) - th * Math.cos(th));
        x = cx + xx; y = cy + yy;
        break;
      }
      case "lissajous_polar": {
        // Dense lobes via radial modulation
        const n = 6 + Math.floor(getSecureRandomNumber() * 5);   // 6–10 lobes
        const m = 3 + Math.floor(getSecureRandomNumber() * 3);   // frequency mix
        const mod = 0.45 + 0.40 * Math.sin(n * theta + m * 0.7);
        r = maxR * 0.82 * t * (0.65 + 0.35 * mod);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "bundle": {
        // Single path here (phase 0). Two extra phases drawn in the stroke builder.
        const base = t * maxR * 0.85;
        const wob  = 0.12 * Math.sin(7.0 * theta) + 0.08 * Math.cos(11.0 * theta);
        r = base * (1 + wob);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }

      // fallback (rings-esque)
      default: {
        r = t * maxR; x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
    }

    normAndPush(x, y, t);
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
  const steps = 540;                 // a bit denser for compact styles
  const turns = (style === "involute") ? 2.2 : 3.2;

  // primary
  const pts0 = genSpiralPoints({ type: style, cx, cy, maxR, turns, steps });
  const d0 = toPath(pts0);

  // base widths/opacity
  const wB = round(R(6.0, 8.0), 2);
  const wA = round(wB * R(0.45, 0.62), 2);
  const opB = round(R(0.28, 0.42), 2);
  const opA = round(R(0.68, 0.9),  2);

  const dashB = `${round(R(9, 16),1)} ${round(R(6, 12),1)}`;
  const dashA = `${round(R(6, 11),1)} ${round(R(5, 10),1)}`;

  // default 2-layer stroke
  let out = `
    <g id="iris-spiral" fill="none">
      <path d="${d0}" stroke="${colorB}" stroke-width="${wB}" opacity="${opB}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashB}"/>
      <path d="${d0}" stroke="${colorA}" stroke-width="${wA}" opacity="${opA}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashA}"/>
  `;

  // EXTRA: for 'bundle', add two phase-shifted tight spirals for a compact “vortex”
  if (style === "bundle") {
    const mkPhase = (phase) => {
      const pts = pts0.map((p, i) => {
        const th = (i / (pts0.length - 1 || 1)) * turns * 2 * Math.PI + phase;
        const wob = 0.11 * Math.sin(7.0 * th) + 0.08 * Math.cos(11.0 * th);
        const r = (i / (pts0.length - 1 || 1)) * maxR * 0.82 * (1 + wob);
        return { x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r };
      });
      return toPath(pts);
    };
    const d1 = mkPhase( 0.35);
    const d2 = mkPhase(-0.35);
    const wSub = round(wA * 0.8, 2);
    out += `
      <path d="${d1}" stroke="${colorA}" stroke-width="${wSub}" opacity="${opA}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d2}" stroke="${colorB}" stroke-width="${wSub}" opacity="${opA}" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  out += `</g>`;
  return out;
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