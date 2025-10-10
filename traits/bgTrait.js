// bgTrait.js — editor-safe: no <defs>, no <symbol>/<use>, no filters

import { getSecureRandomNumber } from "../utils/colorUtils.js";
import { validateSVGSize } from "../utils/sizeValidation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 420, HEIGHT = 420;

// ---------- rng & helpers ----------
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const R  = (min, max) => min + getSecureRandomNumber() * (max - min);
const RI = (min, max) => Math.floor(R(min, max + 1));
const round = (n, d = 1) => Number(n.toFixed(d));
const pick  = (arr) => arr[RI(0, arr.length - 1)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a=0, b=1) => Math.min(b, Math.max(a, x));
const smoother = (t) => t*t*(3 - 2*t);
const easeExpOut = (t) => 1 - Math.pow(2, -10 * t);
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(getSecureRandomNumber() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- color utils ----------
function tint(hex, amt = 0.0) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const l2 = Math.max(0, Math.min(1, l + amt));
  return rgbToHex(hslToRgb({ h, s, l: l2 }));
}
function hexToRgb(hex) {
  const m = hex.replace("#","").match(/.{2}/g).map(x => parseInt(x,16));
  return { r:m[0], g:m[1], b:m[2] };
}
function rgbToHex({r,g,b}) {
  const h = (n)=>n.toString(16).padStart(2,"0");
  return "#"+h(r)+h(g)+h(b);
}
function rgbToHsl({r,g,b}) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){ h=s=0; } else {
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return {h,s,l};
}
function hslToRgb({h,s,l}) {
  let r,g,b;
  if(s===0){ r=g=b=l; }
  else {
    const hue2rgb=(p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return { r:Math.round(r*255), g:Math.round(g*255), b:Math.round(b*255) };
}

// ---------- spiral math ----------
function logSpiralPoint(cx, cy, a, b, theta) {
  const r = a * Math.exp(b * theta);
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

const SPIRAL_TYPES = [
  "log", "tight", "loose", "flower", "sinewave", "randomwalk", "mirror",
  "arch", "fermat", "lituus", "rose", "phyllo", "noisy"
];

function generateArmPoints({cx, cy, armIndex, totalArms, type, points, maxRadius}) {
  const thetaStart = (armIndex / totalArms) * Math.PI * 2;
  const pts = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1 || 1);
    let x, y;
    switch (type) {
      case "log": {
        const turns = 3.2;
        const theta = thetaStart + t * turns * 2*Math.PI;
        const a = 0.6;
        const b = Math.log(1 + maxRadius / a) / (turns * 2*Math.PI);
        const p = logSpiralPoint(cx, cy, a, b, theta);
        x = p.x; y = p.y; break;
      }
      case "tight": {
        const theta = thetaStart + t * 8 * Math.PI;
        const r = t * maxRadius * 0.95;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "loose": {
        const theta = thetaStart + t * 2 * Math.PI;
        const r = t * maxRadius * 1.15;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "flower": {
        const theta = thetaStart + Math.sin(t * Math.PI * 6);
        const r = Math.max(0, Math.sin(t * Math.PI)) * maxRadius * 1.15;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "sinewave": {
        const theta = thetaStart + t * 4 * Math.PI + Math.sin(t*8)*0.25;
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "randomwalk": {
        const theta = thetaStart + t * 4 * Math.PI + (getSecureRandomNumber()-0.5)*1.2;
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "mirror": {
        const theta = thetaStart + Math.PI * (i % 2);
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r; break;
      }
      case "arch": {
        const turns = 3.6;
        const theta = thetaStart + t * turns * 2 * Math.PI;
        const k = maxRadius / (turns * 2 * Math.PI);
        const r = k * (theta - thetaStart);
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      case "fermat": {
        const turns = 3.2;
        const theta = thetaStart + t * turns * 2 * Math.PI;
        const total = turns * 2 * Math.PI;
        const c = maxRadius / Math.sqrt(total);
        const r = c * Math.sqrt(Math.max(0, theta - thetaStart));
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      case "lituus": {
        const turns = 3.0;
        const theta = thetaStart + (1 - t) * turns * 2 * Math.PI + 1e-3;
        const k = maxRadius * Math.sqrt(turns * 2 * Math.PI);
        const rRaw = k / Math.sqrt(theta - thetaStart);
        const r = Math.min(rRaw, maxRadius);
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      case "rose": {
        const turns = 3.2;
        const theta = thetaStart + t * turns * 2 * Math.PI;
        const lobes = 5 + Math.floor(getSecureRandomNumber() * 4); // 5–8
        const envelope = easeOutCubic(t) * maxRadius;
        const r = envelope * (0.55 + 0.45 * Math.abs(Math.sin(lobes * theta)));
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      case "phyllo": {
        const s = i + armIndex * 7;
        const r = Math.sqrt(s / (points - 1 || 1)) * maxRadius;
        const theta = thetaStart + s * GOLDEN_ANGLE;
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      case "noisy": {
        const baseTurns = 3.8;
        const wob = 0.35 * Math.sin(t * 6 + armIndex * 0.9) +
                    0.2  * Math.sin(t * 11.3 + i * 0.17);
        const theta = thetaStart + t * baseTurns * 2 * Math.PI + wob * 0.35;
        const r = (easeOutCubic(t) * maxRadius) * (1 + wob * 0.15);
        x = cx + Math.cos(theta) * r;
        y = cy + Math.sin(theta) * r;
        break;
      }
      default: {
        const theta = thetaStart + t * 4 * Math.PI;
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r; y = cy + Math.sin(theta)*r;
      }
    }
    pts.push({ x: round(x), y: round(y), t });
  }
  return pts;
}

// ---------- 13 palettes (each has 6 distinct colors) ----------
const PALETTES = [
  { name: "one", colors: ["#FDFFFC","#41EAD4","#B91372","#FF0022","#011627","#F7B32B"] },
  { name: "two",   colors: ["#91C4F2","#8CA0D7","#9D79BC","#A14DA0","#7E1F86","#E0E7FF"] },
  { name: "three", colors:["#20BF55","#0B4F6C","#01BAEF","#FBFBFF","#757575","#FDE68A"] },
  { name: "four",  colors: ["#0b0d10","#94a3b8","#7dd3fc","#38bdf8","#f472b6","#e2e8f0"] },
  { name: "five",colors: ["#0f172a","#fef08a","#34d399","#f97316","#ef4444","#a78bfa"] },
  { name: "six",colors: ["#111827","#60a5fa","#22d3ee","#a78bfa","#fb7185","#f8fafc"] },
  { name: "seven",     colors: ["#052e16","#16a34a","#86efac","#22c55e","#065f46","#bbf7d0"] },
  { name: "eight",      colors: ["#1b1a1f","#ef4444","#f59e0b","#fde68a","#fca5a5","#e5e7eb"] },
  { name: "nine",    colors: ["#0b132b","#1c2541","#3a506b","#5bc0be","#a0e7e5","#fafafa"] },
  { name: "ten",    colors: ["#0a0a0a","#fecdd3","#fda4af","#fb7185","#fdba74","#fff1f2"] },
  { name: "eleven",colors: ["#111111","#cccccc","#999999","#ff6b6b","#ffd93d","#6bcBef"] },
  { name: "twelve",   colors: ["#052e1a","#10b981","#34d399","#6ee7b7","#a7f3d0","#ecfeff"] },
  { name: "thirteen",   colors: ["#0f0f0f","#ffdd00","#00e5ff","#ff3b3b","#7cff00","#ffffff"] },
];

// ---------- main ----------
export function generateTrait() {
  // choose palette and map roles each time
  const chosen = pick(PALETTES);
  const [bg, stars, dust, armA, armB, core] = shuffle(chosen.colors.slice());
  const spiralType = pick(SPIRAL_TYPES);

  const numArms = 6;
  const pointsPerArm = 36;
  const maxRadius = WIDTH * 0.369;
  const numBackgroundStars = 69;
  const dustEvery = 0.04;

  // build arms as literal circles (no <use>)
  let arms = `<g>`;
  for (let i = 0; i < numArms; i++) {
    const pts = generateArmPoints({
      cx: WIDTH/2, cy: HEIGHT/2,
      armIndex: i, totalArms: numArms,
      type: spiralType, points: pointsPerArm, maxRadius
    });
    const col = (i % 2 === 0) ? armA : armB;

    // main dots
    for (const p of pts) {
      const r = round(0.6 + (1 - p.t) * 2.6, 1);
      const o = round(Math.pow(1 - p.t, 0.5) * 0.8, 2);
      arms += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${col}" opacity="${o}"/>`;
    }

    // dust dots
    if (dustEvery > 0) {
      const dustPts = pts.filter(()=> getSecureRandomNumber() < dustEvery);
      const dustCol = tint(dust, R(-0.08, 0.08));
      for (const p of dustPts) {
        const r = round(3 + (1 - p.t) * 3, 1);
        const o = round(Math.pow(1 - p.t, 0.35) * 0.35, 2);
        arms += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${dustCol}" opacity="${o}"/>`;
      }
    }
  }
  arms += `</g>`;

const coreR = Math.round(R(34, 40)); // your halved size (or your multi-scale choice)

// ... keep coreMode as you have it ...
const coreMode = getSecureRandomNumber() < 0.5 ? "mono" : "stacked";

// If stacked, use more/lighter layers for smoothness
const layers = (coreMode === "mono") ? 1 : RI(6, 9); // was 3–5

const scheme = (coreMode === "mono")
  ? "mono"
  : (getSecureRandomNumber() < 0.5 ? "soft" : "inverted");

let coreGlow = `<g>`;
for (let i = 0; i < layers; i++) {
  // normalized layer position 0..1 (outer→inner)
  const tRaw = (layers === 1) ? 0 : i / (layers - 1);

  // Use smootherstep so spacing is denser near edges (more overlap)
  const t = smoother(tRaw);

  // ---- Radius curve ----
  // Heavier overlap: shrink more slowly at first, faster at the end
  // r goes from 100% down to ~28% with an exponential feel
  const r = Math.round(coreR * (0.28 + 0.72 * (1 - easeExpOut(t))));

  // ---- Opacity ramp ----
  // Outer very faint, inner stronger, kept subtle to avoid banding
  const baseOpacity = 0.06 + 0.36 * smoother(1 - t);
  const o = round(coreMode === "mono" ? Math.min(0.5, baseOpacity + 0.1) : baseOpacity, 3);

  // ---- Same-hue lightness tweaks (VERY gentle steps) ----
  // Smaller deltas = less visible seams
  let amt = 0.0;
  if (scheme === "soft")      amt = lerp(+0.12, -0.08, t);       // lighter → darker
  else if (scheme === "inverted") amt = lerp(-0.08, +0.12, t);   // darker → lighter
  const col = tint(core, amt);

  coreGlow += `<circle cx="${WIDTH/2}" cy="${HEIGHT/2}" r="${r}" fill="${col}" opacity="${o}"/>`;
}
coreGlow += `</g>`;

  const svg =
`<svg xmlns="${SVG_NS}" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <g> ${
    Array.from({length: numBackgroundStars}).map(() => {
      const x = round(R(0, WIDTH), 1);
      const y = round(R(0, HEIGHT), 1);
      const r = round(R(0.3, 1.6), 1);
      const o = round(R(0.25, 1), 2);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${stars}" opacity="${o}"/>`;
    }).join("")
  } </g>
  ${arms}
  ${coreGlow}
</svg>`.replace(/\s*\n\s*/g, " ").trim();

  validateSVGSize(svg);
  return svg;
}