// public/traitGeneration/eyesTrait.js
// Psychedelic eyes: concentric rainbow rings + phyllotaxis dots,
// clipped to the eye path, with a clean white frame and lens glow.

import { getSecureRandomNumber } from "../utils/colorUtils.js";
import { validateSVGSize } from "../utils/sizeValidation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SIZE = 420;

// ---------- small utils ----------
const R  = (min, max) => min + getSecureRandomNumber() * (max - min);
const RI = (min, max) => Math.floor(R(min, max + 1));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (n, d = 2) => Number(n.toFixed(d));

function uid(prefix = "u") {
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  return prefix + "-" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// very compact HSL → HEX (h in [0,360), s,l in [0,1])
function hslToHex(h, s, l) {
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

// Hit-test using rasterization to ensure points land inside the path.
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

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

// ---------- visual builders ----------
function buildDefs({ cx, cy, lensR }) {
  const idDot   = uid("d");
  const idGlow  = uid("glow");
  const idGloss = uid("gloss");

  const defs = `
    <defs>
      <symbol id="${idDot}" overflow="visible">
        <circle cx="0" cy="0" r="1"/>
      </symbol>

      <!-- Soft lens glow centered near chosen cx,cy -->
      <radialGradient id="${idGlow}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${lensR}">
        <stop offset="0"   stop-color="#ffffff" stop-opacity="0.65"/>
        <stop offset="0.5" stop-color="#fbcfe8" stop-opacity="0.35"/>
        <stop offset="1"   stop-color="#a78bfa" stop-opacity="0"/>
      </radialGradient>

      <!-- Specular highlight for glass sheen -->
      <radialGradient id="${idGloss}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
  `.replace(/\s*\n\s*/g, " ").trim();

  return { defs, idDot, idGlow, idGloss };
}

function buildRainbowRings({ cx, cy, maxR, ringCount = 60, strokeBase = 1.6 }) {
  let g = `<g id="iris-rings" fill="none">`;
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1 || 1);
    const r = round((0.06 + 0.94 * t) * maxR + R(-0.35, 0.35), 2);
    const hue = (360 * t + RI(0, 5) * 5) % 360;
    const sat = 0.75 + 0.20 * Math.sin(t * 6.28);
    const light = 0.45 + 0.10 * Math.cos(t * 7.1);
    const col = hslToHex(hue, clamp01(sat), clamp01(light));
    const sw = round(strokeBase * (0.85 + 0.35 * (1 - t)), 2);
    const op = round(0.85 * (1 - Math.pow(t, 1.4)), 2);

    const rx = round(r * (1 + R(-0.015, 0.015)), 3);
    const ry = round(r * (1 + R(-0.015, 0.015)), 3);
    const rot = round(R(-8, 8), 2);

    g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" stroke="${col}" stroke-width="${sw}" opacity="${op}"/>`;
  }
  g += `</g>`;
  return g;
}

function buildPhylloDots({ cx, cy, maxR, idDot }) {
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const seeds = 420;
  let g = `<g id="iris-dots">`;
  for (let i = 0; i < seeds; i++) {
    const t = (i + 1) / seeds;
    const r = Math.sqrt(t) * maxR * (0.96 + 0.02 * Math.sin(i * 0.13));
    const theta = i * GOLDEN_ANGLE;
    const x = round(cx + Math.cos(theta) * r, 2);
    const y = round(cy + Math.sin(theta) * r, 2);

    const hue = (i * 3.6 + 200) % 360;
    const col = hslToHex(hue, 0.75, 0.55);
    const rad = round(0.7 + 1.6 * (1 - t), 2);
    const op = round(0.65 * (1 - t) + 0.15, 2);
    g += `<use href="#${idDot}" transform="translate(${x} ${y}) scale(${rad})" fill="${col}" opacity="${op}"/>`;
  }
  g += `</g>`;
  return g;
}

function buildGlossHighlight({ idGloss, cx, cy }) {
  const rx = round(R(32, 44), 2);
  const ry = round(R(18, 26), 2);
  const dx = round(R(-22, -10), 2);
  const dy = round(R(-18, -6), 2);
  const rot = round(R(-18, 18), 2);
  return `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="${rx}" ry="${ry}" fill="url(#${idGloss})" transform="rotate(${rot} ${cx + dx} ${cy + dy})" opacity="0.7"/>`;
}

function pickCenterInside(pathData, viewBox) {
  const [minX, minY, w, h] = viewBox.split(" ").map(Number);
  for (let attempts = 0; attempts < 800; attempts++) {
    const x = minX + w * (0.35 + getSecureRandomNumber() * 0.30);
    const y = minY + h * (0.35 + getSecureRandomNumber() * 0.30);
    if (isPointInPathRasterized(pathData, x, y, viewBox)) return { cx: x, cy: y };
  }
  return { cx: minX + w / 2, cy: minY + h / 2 };
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

  const maxR = Math.min(SIZE, SIZE) * R(0.27, 0.33);
  const lensR = round(maxR * R(1.05, 1.25), 2);

  const { defs, idDot, idGlow, idGloss } = buildDefs({ cx, cy, lensR });
  const rings = buildRainbowRings({ cx, cy, maxR, ringCount: RI(54, 72), strokeBase: R(1.2, 1.9) });
  const dots  = buildPhylloDots({ cx, cy, maxR: maxR * R(0.88, 1.02), idDot });
  const gloss = buildGlossHighlight({ idGloss, cx, cy });

  const frameFill = "#ffffff";
  const lensTint = `url(#${idGlow})`;

  // Define mask ID once and reuse
  const maskId = uid("mask");

  const svg = `
    <svg xmlns="${SVG_NS}" width="${SIZE}" height="${SIZE}" viewBox="${viewBox}">
      ${defs}

      <!-- Frame on top of everything -->
      <path d="${jsonData.frames.pathData}" fill="${frameFill}" opacity="1"/>

      <!-- Lens base + iris content, clipped to eye -->
      <mask id="${maskId}">
        <path d="${jsonData.eyes.pathData}" fill="#fff"/>
      </mask>
      <g mask="url(#${maskId})">
        <rect x="0" y="0" width="100%" height="100%" fill="${lensTint}"/>
        ${rings}
        ${dots}
        ${gloss}
      </g>

      <!-- Eye outline on top for crisp edge -->
      <path d="${jsonData.eyes.pathData}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.9"/>
    </svg>
  `.replace(/\s*\n\s*/g, " ").trim();

  validateSVGSize(svg);
  return svg;
}

export default { generateTrait };