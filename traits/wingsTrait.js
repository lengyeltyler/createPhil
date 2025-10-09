// public/traitGeneration/wingsTrait.js
import { getColorByNumber, getSecureRandomNumber } from "../utils/colorUtils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_SIZE = 420;

/* ---------------- helpers ---------------- */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch JSON from ${url} (${res.status})`);
  return res.json();
}

// HSL helpers for shading the same color
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
      if (t < 0) t += 1; if (t > 1) t -= 1;
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

// quick hit-test using canvas rasterization (keeps patterns inside)
function isPointInPath(pathData, x, y, viewBox = `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`) {
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  const c = document.createElement("canvas");
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  const ctx = c.getContext("2d");
  const p = new Path2D(pathData);
  ctx.fillStyle = "#000";
  ctx.fill(p);
  return ctx.isPointInPath(p, x - minX, y - minY);
}

/* ---------------- main ---------------- */
/**
 * Wings with reduced glow and 3 shaded layers of one random color.
 */
export async function generateTrait(_unused = null, _isStatic = true) {
  try {
    const [bottomData, middleData, topData] = await Promise.all([
      fetchJSON("/traits_json/wingsBottomOutline.json"),
      fetchJSON("/traits_json/wingsMiddleOutline.json"),
      fetchJSON("/traits_json/wingsTopOutline.json"),
    ]);

    if (!topData?.pathData || !middleData?.pathData || !bottomData?.pathData) {
      throw new Error("Invalid or missing pathData in one or more wing layer files.");
    }

    const viewBox = bottomData.viewBox || `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`;

    // -------- choose one random base color, make three shades
    const paletteIndex = Math.floor(getSecureRandomNumber() * 69); // 0..68
    const baseHex = getColorByNumber(paletteIndex);

    // light (top), base (middle), dark (bottom)
    const topHex    = shade(baseHex,  +0.18);
    const middleHex = baseHex;
    const bottomHex = shade(baseHex,  -0.18);

    // subtle gradients using the same shade family (adds depth without new hues)
    const grad = (id, hex) => {
      const hi = shade(hex, +0.08);
      const lo = shade(hex, -0.08);
      return `
        <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="${hi}" />
          <stop offset="50%"  stop-color="${hex}" />
          <stop offset="100%" stop-color="${lo}" />
        </linearGradient>`;
    };

    // patterns (kept subtle)
    const buildPatternDots = (pathData, viewBoxStr, hex) => {
      const tmp = document.createElementNS(SVG_NS, "path");
      tmp.setAttribute("d", pathData);
      const bbox = tmp.getBBox();
      const count = 10 + Math.floor(getSecureRandomNumber() * 16); // 10–25 dots
      let s = "";
      for (let i = 0; i < count; i++) {
        const x = bbox.x + getSecureRandomNumber() * bbox.width;
        const y = bbox.y + getSecureRandomNumber() * bbox.height;
        if (!isPointInPath(pathData, x, y, viewBoxStr)) continue;
        const r = 0.8 + getSecureRandomNumber() * 1.6; // tiny dots
        s += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${shade(hex, -0.10)}" opacity="0.35"/>`;
      }
      return s;
    };

    // HALF THE GLOW: lower blur + opacity
    const GLOW_STD = 2.5;   // was ~5
    const GLOW_OPA = 0.4;   // was ~0.8
    const SHADOW_OPACITY = 0.22;

    // namespaced IDs to avoid any cross-trait collisions
    const ID_GRAD_TOP = "wings-grad-top";
    const ID_GRAD_MID = "wings-grad-middle";
    const ID_GRAD_BOT = "wings-grad-bottom";
    const ID_FILTER   = "wings-glow";

    const svg = `
      <svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="${viewBox}">
        <defs>
          ${grad(ID_GRAD_TOP,    topHex)}
          ${grad(ID_GRAD_MID,    middleHex)}
          ${grad(ID_GRAD_BOT,    bottomHex)}
          <filter id="${ID_FILTER}" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${GLOW_STD}" result="b"/>
            <feColorMatrix in="b" type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 ${GLOW_OPA} 0" result="c"/>
            <feMerge>
              <feMergeNode in="c"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- bottom wing (darkest shade) -->
        <g class="wing-layer wing-bottom">
          <path d="${bottomData.pathData}" fill="#000" opacity="${SHADOW_OPACITY}" transform="translate(1.5,1.5)"/>
          <path d="${bottomData.pathData}" fill="url(#${ID_GRAD_BOT})" filter="url(#${ID_FILTER})"/>
          ${buildPatternDots(bottomData.pathData, viewBox, bottomHex)}
        </g>

        <!-- middle wing (base shade) -->
        <g class="wing-layer wing-middle">
          <path d="${middleData.pathData}" fill="#000" opacity="${SHADOW_OPACITY}" transform="translate(0.8,0.8)"/>
          <path d="${middleData.pathData}" fill="url(#${ID_GRAD_MID})" filter="url(#${ID_FILTER})"/>
          ${buildPatternDots(middleData.pathData, viewBox, middleHex)}
        </g>

        <!-- top wing (lightest shade) -->
        <g class="wing-layer wing-top">
          <path d="${topData.pathData}" fill="#000" opacity="${SHADOW_OPACITY}" transform="translate(0.3,0.3)"/>
          <path d="${topData.pathData}" fill="url(#${ID_GRAD_TOP})" filter="url(#${ID_FILTER})"/>
          ${buildPatternDots(topData.pathData, viewBox, topHex)}
        </g>
      </svg>
    `.replace(/\s*\n\s*/g, " ").trim();

    return svg;
  } catch (err) {
    console.error("Error generating wings trait:", err);
    return `<svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
      <text x="10" y="20">Wings error: ${String(err.message || err)}</text>
    </svg>`;
  }
}