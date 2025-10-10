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

// --- NEW: polyline clip to path (delete outside segments) -------------------
function clipPolylineToPath(pathData, points, viewBox = `0 0 ${SIZE} ${SIZE}`, tol = 0.5) {
  if (!points || points.length < 2) return [];
  const isInside = (x, y) => isPointInPathRasterized(pathData, x, y, viewBox);

  const segs = [];
  let cur = [];

  const bisectToBoundary = (ax, ay, bx, by) => {
    // A and B straddle the boundary. Find boundary point from A->B.
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const mx = ax + (bx - ax) * mid;
      const my = ay + (by - ay) * mid;
      if (isInside(mx, my)) lo = mid; else hi = mid;
      if ((hi - lo) * Math.hypot(bx - ax, by - ay) <= tol) break;
    }
    const t = lo;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
  };

  let prev = points[0];
  let prevIn = isInside(prev.x, prev.y);
  if (prevIn) cur.push(prev);

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const nowIn = isInside(p.x, p.y);

    if (prevIn && nowIn) {
      if (cur.length === 0) cur.push(prev);
      cur.push(p);
    } else if (prevIn && !nowIn) {
      const cut = bisectToBoundary(prev.x, prev.y, p.x, p.y);
      if (cur.length === 0) cur.push(prev);
      cur.push(cut);
      if (cur.length >= 2) segs.push(cur);
      cur = [];
    } else if (!prevIn && nowIn) {
      const cut = bisectToBoundary(p.x, p.y, prev.x, prev.y); // reverse to find boundary from inside side
      cur = [cut, p];
    } else {
      // both outside -> skip
    }

    prev = p;
    prevIn = nowIn;
  }
  if (cur.length >= 2) segs.push(cur);

  return segs;
}

function segmentToPathD(seg) {
  let d = `M ${round(seg[0].x,2)} ${round(seg[0].y,2)}`;
  for (let i = 1; i < seg.length; i++) d += ` L ${round(seg[i].x,2)} ${round(seg[i].y,2)}`;
  return d;
}
// ---------------------------------------------------------------------------

// Generate spiral points around (cx,cy)
function genSpiralPoints({ type, cx, cy, maxR, turns = 3.2, steps = 420 }) {
  const pts = [];
  const twoPiT = turns * 2 * Math.PI;

  const normAndPush = (x, y, t) => { pts.push({ x, y, t }); };

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1 || 1);
    const theta = t * twoPiT;

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

      // additional types supported but not selected unless added to SPIRAL_STYLES
      case "spiro_epitro": {
        const Rb = maxR * 0.28 * (1 + 0.2 * getSecureRandomNumber());
        const rb = Rb * (0.30 + 0.25 * getSecureRandomNumber());
        const d  = rb * (0.8 + 0.6 * getSecureRandomNumber());
        const k  = (Rb + rb) / rb;
        const xx = (Rb + rb) * Math.cos(theta) - d * Math.cos(k * theta);
        const yy = (Rb + rb) * Math.sin(theta) - d * Math.sin(k * theta);
        x = cx + xx; y = cy + yy;
        break;
      }
      case "spiro_hypo": {
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
        const a = maxR * 0.18;
        const th = t * (twoPiT * 0.9);
        const xx = a * (Math.cos(th) + th * Math.sin(th));
        const yy = a * (Math.sin(th) - th * Math.cos(th));
        x = cx + xx; y = cy + yy;
        break;
      }
      case "lissajous_polar": {
        const n = 6 + Math.floor(getSecureRandomNumber() * 5);
        const m = 3 + Math.floor(getSecureRandomNumber() * 3);
        const mod = 0.45 + 0.40 * Math.sin(n * theta + m * 0.7);
        r = maxR * 0.82 * t * (0.65 + 0.35 * mod);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "bundle": {
        const base = t * maxR * 0.85;
        const wob  = 0.12 * Math.sin(7.0 * theta) + 0.08 * Math.cos(11.0 * theta);
        r = base * (1 + wob);
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }

      default: {
        r = t * maxR; x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
    }
    normAndPush(x, y, t);
  }
  return pts;
}

// Concentric ellipse "rings" (alternating the two dark colors)
// Slight inward buffer to avoid brushing the lens edge.
function buildRings({ cx, cy, maxR, colorA, colorB }) {
  const count = RI(54, 72);
  const baseW = R(1.2, 1.9);
  const buffer = 0.6; // px inward safety
  let g = `<g id="iris-rings" fill="none">`;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1 || 1);
    const rBase = (0.06 + 0.94 * t) * maxR + R(-0.25, 0.25);
    const r = Math.max(0, Math.min(rBase, maxR - buffer));
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

// Spiral strokes (two passes, A on top of B), trimmed to lens path via polyline clipping
function buildSpiralStrokes({ cx, cy, maxR, colorA, colorB, style, lensPath, viewBox = `0 0 ${SIZE} ${SIZE}` }) {
  const steps = 540;                 // a bit denser for compact styles
  const turns = (style === "involute") ? 2.2 : 3.2;

  // primary polyline
  const pts0 = genSpiralPoints({ type: style, cx, cy, maxR, turns, steps });

  // clip the polyline to the lens shape into inside-only segments
  const segments = clipPolylineToPath(lensPath, pts0, viewBox, 0.5);
  if (segments.length === 0) {
    return `<g id="iris-spiral" fill="none"></g>`;
  }

  // base widths/opacity (same look you had)
  const wB = round(R(6.0, 8.0), 2);
  const wA = round(wB * R(0.45, 0.62), 2);
  const opB = round(R(0.28, 0.42), 2);
  const opA = round(R(0.68, 0.9),  2);

  const dashB = `${round(R(9, 16),1)} ${round(R(6, 12),1)}`;
  const dashA = `${round(R(6, 11),1)} ${round(R(5, 10),1)}`;

  let out = `<g id="iris-spiral" fill="none">`;

  // draw each kept segment twice (B under A), preserving visual style
  for (const seg of segments) {
    const d = segmentToPathD(seg);
    out += `
      <path d="${d}" stroke="${colorB}" stroke-width="${wB}" opacity="${opB}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashB}"/>
      <path d="${d}" stroke="${colorA}" stroke-width="${wA}" opacity="${opA}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashA}"/>
    `;
  }

  // Optional: extra phases for 'bundle', also clipped
  if (style === "bundle") {
    const mkPhasePts = (phase) => pts0.map((p, i) => {
      const t = i / (pts0.length - 1 || 1);
      const th = t * turns * 2 * Math.PI + phase;
      const wob = 0.11 * Math.sin(7.0 * th) + 0.08 * Math.cos(11.0 * th);
      const r = t * maxR * 0.82 * (1 + wob);
      return { x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r };
    });

    for (const phase of [0.35, -0.35]) {
      const segs = clipPolylineToPath(lensPath, mkPhasePts(phase), viewBox, 0.5);
      const wSub = round(wA * 0.8, 2);
      for (const seg of segs) {
        const d = segmentToPathD(seg);
        out += `<path d="${d}" stroke="${colorA}" stroke-width="${wSub}" opacity="${opA}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
  }

  out += `</g>`;
  return out;
}

// Lens glow gradient tinted by the bright frame color
function buildDefs({ cx, cy, lensR, bright, lensPath }) {
  const idGlow  = uid("glow");
  const idGloss = uid("gloss");
  const idClip  = uid("clip");
  const defs = `
    <defs>
      <radialGradient id="${idGlow}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${lensR}">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.65"/>
        <stop offset="0.55" stop-color="${bright}" stop-opacity="0.35"/>
        <stop offset="1" stop-color="${bright}" stop-opacity="0"/>
      </radialGradient>

      <radialGradient id="${idGloss}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>

      <!-- hard clip to the lens shape -->
      <clipPath id="${idClip}" clipPathUnits="userSpaceOnUse">
        <path d="${lensPath}"/>
      </clipPath>
    </defs>
  `.replace(/\s*\n\s*/g, " ").trim();

  return { defs, idGlow, idGloss, idClip };
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

  const viewBox  = jsonData.eyes.viewBox || `0 0 ${SIZE} ${SIZE}`;
  const lensPath = jsonData.eyes.pathData;
  const { cx, cy } = pickCenterInside(lensPath, viewBox);

  // pick palette -> [bright, darkA, darkB]
  const [bright, darkA, darkB] = PALETTES[RI(0, PALETTES.length - 1)];

  // keep your original sizing to preserve look
  const maxR  = Math.min(SIZE, SIZE) * R(0.27, 0.33);
  const lensR = round(maxR * R(1.05, 1.25), 2);

  const { defs, idGlow, idGloss, idClip } = buildDefs({ cx, cy, lensR, bright, lensPath });
  // choose spiral style
  const style = SPIRAL_STYLES[RI(0, SPIRAL_STYLES.length - 1)];

  // build iris content (either rings or stroke spirals)
  const iris =
    style === "rings"
      ? buildRings({ cx, cy, maxR, colorA: darkA, colorB: darkB })
      : buildSpiralStrokes({ cx, cy, maxR, colorA: darkA, colorB: darkB, style, lensPath, viewBox });

  const gloss = buildGloss({ idGloss, cx, cy });

  // Keep your existing mask block if you like the glow confined.
  // (Spiral is hard-trimmed already, so even if mask is flaky in some editors, the iris won't bleed.)
  const maskId = uid("mask");

  const svg = `
    <svg xmlns="${SVG_NS}" width="${SIZE}" height="${SIZE}" viewBox="${viewBox}">
      ${defs}

      <!-- Frame uses the bright color from the palette -->
      <path d="${jsonData.frames.pathData}" fill="${bright}" opacity="1"/>

      <!-- Lens base + iris; mask is optional safety for glow -->
      <mask id="${maskId}">
        <path d="${lensPath}" fill="#fff"/>
      </mask>
      <g mask="url(#${maskId})" clip-path="url(#${idClip})">
        <rect x="0" y="0" width="100%" height="100%" fill="url(#${idGlow})"/>
        ${iris}
        ${gloss}
      </g>

      <!-- Lens outline on top for crisp edge -->
      <path d="${lensPath}" fill="none" stroke="${bright}" stroke-width="1.2" opacity="0.9"/>
    </svg>
  `.replace(/\s*\n\s*/g, " ").trim();

  validateSVGSize(svg);
  return svg;
}

export default { generateTrait };