// traits/topTrait.js (tiny vector smileys, tuned sizes)
import { getColorByNumber, getSecureRandomNumber } from "../utils/colorUtils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_SIZE = 420;

const TAG = "[TopTrait]";
console.log(`${TAG} module loaded at`, new Date().toISOString());

// ---------------- utils ----------------
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch JSON from ${url} (${res.status})`);
  return res.json();
}

function parseViewBox(vb) {
  if (!vb) return { minX: 0, minY: 0, width: DEFAULT_SIZE, height: DEFAULT_SIZE };
  const [minX, minY, width, height] = vb.trim().split(/\s+/).map(Number);
  return { minX, minY, width, height };
}

function isPointInPathRasterized(pathData, x, y, viewBox = `0 0 ${DEFAULT_SIZE} ${DEFAULT_SIZE}`) {
  const { minX, minY, width, height } = parseViewBox(viewBox);
  const c = document.createElement("canvas");
  c.width = Math.ceil(width);
  c.height = Math.ceil(height);
  const ctx = c.getContext("2d");
  const p = new Path2D(pathData);
  ctx.fillStyle = "#000";
  ctx.fill(p);
  return ctx.isPointInPath(p, x - minX, y - minY);
}

function getContrastingColor(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  return L > 150 ? "#111111" : "#FFFFFF";
}

function shiftHex(hex, deg = 30) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  h = (h * 360 + deg + 360) % 360;
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - C / 2;
  let rr = 0, gg = 0, bb = 0;
  if (0 <= h && h < 60) [rr, gg, bb] = [C, X, 0];
  else if (60 <= h && h < 120) [rr, gg, bb] = [X, C, 0];
  else if (120 <= h && h < 180) [rr, gg, bb] = [0, C, X];
  else if (180 <= h && h < 240) [rr, gg, bb] = [0, X, C];
  else if (240 <= h && h < 300) [rr, gg, bb] = [X, 0, C];
  else [rr, gg, bb] = [C, 0, X];
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function colorsNear(a, b) {
  const da = parseInt(a.slice(1), 16), db = parseInt(b.slice(1), 16);
  const rA = (da >> 16) & 0xff, gA = (da >> 8) & 0xff, bA = da & 0xff;
  const rB = (db >> 16) & 0xff, gB = (db >> 8) & 0xff, bB = db & 0xff;
  return Math.abs(rA - rB) < 24 && Math.abs(gA - gB) < 24 && Math.abs(bA - bB) < 24;
}

// Smaller vector smiley symbol
function buildSmileySymbol(id, stroke, fill) {
  // Base 20x20 viewBox; we also thin the stroke inside the symbol
  return `
    <symbol id="${id}" viewBox="-10 -10 20 20" overflow="visible">
      <circle cx="0" cy="0" r="8" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>
      <circle cx="-2.7" cy="-2.2" r="1" fill="${stroke}"/>
      <circle cx="2.7"  cy="-2.2" r="1" fill="${stroke}"/>
      <path d="M -4.4,1.8 A 4.4,4.4 0 0 0 4.4,1.8"
            fill="none" stroke="${stroke}" stroke-width="0.8" stroke-linecap="round"/>
    </symbol>
  `;
}

// ---------------- main ----------------
export async function generateTrait() {
  const jsonData = await fetchJSON("/traits_json/topOutline.json");
  const pathData = jsonData?.pathData;
  if (!pathData) throw new Error("Missing pathData for Top trait.");
  const viewBox = jsonData.viewBox || `0 0 ${DEFAULT_SIZE} ${DEFAULT_SIZE}`;
  const { width, height } = parseViewBox(viewBox);

  // colors
  const baseFill = getColorByNumber(0);
  const primaryStroke = getContrastingColor(baseFill);

  // derive smiley fill from base; ensure contrast
  let smileFill = shiftHex(baseFill, 50);
  if (smileFill.toLowerCase() === "#ffffff" || colorsNear(smileFill, baseFill)) {
    smileFill = primaryStroke === "#FFFFFF" ? "#111111" : "#FFFFFF";
  }

  // defs
  const smileId = `sm-${Math.floor(getSecureRandomNumber() * 1e9)}`;
  const maskId = `m-${Math.floor(getSecureRandomNumber() * 1e9)}`;
  const smileSymbol = buildSmileySymbol(smileId, primaryStroke, smileFill);

  // >>> tuned density & size <<<
  const N = 69;                 // more faces but tiny
  const minScale = 0.01;        // ~22% of 20×20 symbol
  const maxScale = 0.03;        // cap small so no big blobs

  let uses = "";
  for (let i = 0; i < N; i++) {
    let placed = false, x = 0, y = 0, s = 1;
    for (let k = 0; k < 120 && !placed; k++) {
      x = getSecureRandomNumber() * width;
      y = getSecureRandomNumber() * height;
      placed = isPointInPathRasterized(pathData, x, y, viewBox);
      if (placed) s = minScale + getSecureRandomNumber() * (maxScale - minScale);
    }
    if (!placed) continue;
    const rot = Math.round(getSecureRandomNumber() * 360);
    uses += `<use href="#${smileId}" xlink:href="#${smileId}"
                  transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rot}) scale(${s.toFixed(2)})"
                  opacity="0.95"
                  style="stroke:${primaryStroke};stroke-width:0.45;vector-effect:non-scaling-stroke"/>`;
  }

  // SVG
  const svg = `
    <svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"
         width="${width}" height="${height}" viewBox="${viewBox}">
      <defs>
        ${smileSymbol}
        <mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
          <rect x="0" y="0" width="${width}" height="${height}" fill="black"/>
          <path d="${pathData}" fill="white"/>
        </mask>
      </defs>

      <!-- base fill forced so theme CSS can't turn it white -->
      <path d="${pathData}"
            style="fill:${baseFill} !important; stroke:${primaryStroke};
                   stroke-width:0.3; vector-effect:non-scaling-stroke"/>

      <!-- tiny smileys on top, clipped -->
      <g mask="url(#${maskId})">
        ${uses}
      </g>
    </svg>
  `.replace(/\s*\n\s*/g, " ").trim();

  return svg;
}