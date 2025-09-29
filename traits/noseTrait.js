// public/traitGeneration/noseTrait.js
import { getColorByNumber, getSecureRandomNumber } from "../utils/colorUtils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_SIZE = 420;

/* ---------------- helpers ---------------- */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch JSON from ${url} (${res.status})`);
  return res.json();
}

// HSL helpers to make lighter/darker shades of the SAME color
function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s; const l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default:  h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}
function hslToHex(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = x => {
    const hx = Math.round(x * 255).toString(16);
    return hx.length === 1 ? "0" + hx : hx;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function shade(hex, dl) { // dl in [-0.5, 0.5]
  const { h, s, l } = hexToHSL(hex);
  return hslToHex(h, s, clamp01(l + dl));
}

/* ---------------- main ---------------- */
/**
 * Solid-color Nose with stroke as a darker shade of the same color.
 * No glow. Supports single path or paths[] with optional type:"shadow".
 */
export async function generateTrait(_unused = null, _isStatic = true) {
  try {
    const data = await fetchJSON("/traits_json/noseOutline.json");
    if (!data || (!data.pathData && !data.paths)) {
      throw new Error("Invalid or missing path data in noseOutline.json.");
    }

    const viewBox = data.viewBox || `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`;

    // Pick a random palette index (0..68) each run
    const baseIndex = Math.floor(getSecureRandomNumber() * 69);
    const baseHex = getColorByNumber(baseIndex);

    // Stroke and any "shadow" subpaths are just shades of the base
    const strokeHex = shade(baseHex, -0.22);    // slightly darker outline
    const shadowHex = shade(baseHex, -0.10);    // tiny dark shift for shadow subpaths
    const highlightHex = shade(baseHex, +0.10); // tiny light shift if a "highlight" type exists

    const paths = data.paths || [{ pathData: data.pathData, type: "base" }];

    const svgPaths = paths
      .map((p) => {
        if (!p?.pathData || typeof p.pathData !== "string") return "";

        const t = (p.type || "base").toLowerCase();
        let fill = baseHex;
        if (t === "shadow") fill = shadowHex;
        else if (t === "highlight") fill = highlightHex;

        // Force inline style to beat any global CSS that might set path{fill:#fff}
        return `<path d="${p.pathData}"
                      style="fill:${fill} !important; stroke:${strokeHex}; stroke-width:0.45; vector-effect:non-scaling-stroke"
                      fill-rule="evenodd"/>`;
      })
      .filter(Boolean)
      .join("");

    const svg = `
      <svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="${viewBox}">
        ${svgPaths}
      </svg>
    `.replace(/\s*\n\s*/g, " ").trim();

    return svg;
  } catch (err) {
    console.error("[NoseTrait] ERROR:", err);
    return `<svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
      <text x="10" y="20">Nose error: ${String(err.message || err)}</text>
    </svg>`;
  }
}