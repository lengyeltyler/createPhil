// bgTrait.js — palette-based, random spiral type, defs/use reuse, crisp + smaller output
// Drop-in replacement for your current file.

import { getSecureRandomNumber } from "../utils/colorUtils.js"; // keep your RNG
import { validateSVGSize } from "../utils/sizeValidation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 420, HEIGHT = 420;

// ---------- utils ----------
const R = (min, max) => min + getSecureRandomNumber() * (max - min);
const RI = (min, max) => Math.floor(R(min, max + 1));
const pick = (arr) => arr[RI(0, arr.length - 1)];
const round = (n, d = 1) => Number(n.toFixed(d));

// ---------- harmonious palettes (hex) ----------
const PALETTES = [
  // Your example from coolors.co
  { name: "coolors-1",
    bg: "#011627", stars: "#FDFFFC", dust: "#41EAD4", armA: "#FF0022", armB: "#B91372", core: "#FDFFFC" },
  // Two more to start (tweak anytime)
  { name: "atelier",
    bg: "#0b0d10", stars: "#c8d1ff", dust: "#7cc5ff", armA: "#8b5cf6", armB: "#22d3ee", core: "#e0e7ff" },
  { name: "sunset-mint",
    bg: "#0f172a", stars: "#fef9c3", dust: "#86efac", armA: "#fb7185", armB: "#f97316", core: "#fde68a" },
];

// For subtle variance within a role color
function tint(hex, amt = 0.0) {
  // amt in [-0.2..0.2], small HSL lightness tweak to avoid flatness
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
  // r = a * e^(bθ)
  const r = a * Math.exp(b * theta);
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

// Pick a spiral “profile”
const SPIRAL_TYPES = [
  "log",
  "tight",
  "loose",
  "flower",
  "sinewave",
  "randomwalk",
  "mirror"
];

function generateArmPoints({cx, cy, armIndex, totalArms, type, points, maxRadius}) {
  const thetaStart = (armIndex / totalArms) * Math.PI * 2;
  const pts = [];

  for (let i = 0; i < points; i++) {
    const t = i / (points - 1 || 1);
    let x, y;

    switch (type) {
      case "log": {
        // Choose a,b to fit maxRadius at end
        const turns = 3.2;                          // ~how many rotations
        const theta = thetaStart + t * turns * 2*Math.PI;
        const a = 0.6;                              // base
        const b = Math.log(1 + maxRadius / a) / (turns * 2*Math.PI);
        const p = logSpiralPoint(cx, cy, a, b, theta);
        x = p.x; y = p.y;
        break;
      }
      case "tight": {
        const theta = thetaStart + t * 8 * Math.PI;
        const r = t * maxRadius * 0.95;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
        break;
      }
      case "loose": {
        const theta = thetaStart + t * 2 * Math.PI;
        const r = t * maxRadius * 1.15;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
        break;
      }
      case "flower": {
        const theta = thetaStart + Math.sin(t * Math.PI * 6);
        const r = Math.max(0, Math.sin(t * Math.PI)) * maxRadius * 1.15;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
        break;
      }
      case "sinewave": {
        const theta = thetaStart + t * 4 * Math.PI + Math.sin(t*8)*0.25;
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
        break;
      }
      case "randomwalk": {
        const theta = thetaStart + t * 4 * Math.PI + (getSecureRandomNumber()-0.5)*1.2;
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
        break;
      }
      case "mirror": {
        const theta = thetaStart + Math.PI * (i % 2);
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
        break;
      }
      default: {
        const theta = thetaStart + t * 4 * Math.PI;
        const r = t * maxRadius;
        x = cx + Math.cos(theta)*r;
        y = cy + Math.sin(theta)*r;
      }
    }
    pts.push({ x: round(x), y: round(y), t });
  }
  return pts;
}

// ---------- SVG builders (defs/use for size) ----------
function buildDefs() {
  // A single dot symbol reused everywhere
  return `
    <defs>
      <symbol id="d" overflow="visible">
        <circle cx="0" cy="0" r="1"></circle>
      </symbol>
      <radialGradient id="coreGlow">
        <stop offset="0" stop-opacity="0.65"/>
        <stop offset="0.55" stop-opacity="0.28"/>
        <stop offset="1" stop-opacity="0"/>
      </radialGradient>
    </defs>
  `;
}

function emitUses(points, { baseR = 2.2, minR = 0.5, fill, opacityCurve = (t)=>Math.pow(1-t,0.5)*0.8 }) {
  // Group shares fill; each <use> overrides transform and sets opacity via 'opacity' attr
  // r varies via scale
  let out = `<g fill="${fill}">`;
  for (const p of points) {
    const r = round(minR + (1 - p.t) * baseR, 1);
    const o = round(opacityCurve(p.t), 2);
    out += `<use href="#d" transform="translate(${p.x} ${p.y}) scale(${r})" opacity="${o}"/>`;
  }
  out += `</g>`;
  return out;
}

// Background stars as random points (cheaper: reuse the same dot)
function addBackgroundStars(num, color) {
  let out = `<g id="stars" fill="${color}">`;
  for (let i = 0; i < num; i++) {
    const x = round(R(0, WIDTH), 1);
    const y = round(R(0, HEIGHT), 1);
    const r = round(R(0.3, 1.6), 1);
    const o = round(R(0.25, 1), 2);
    out += `<use href="#d" transform="translate(${x} ${y}) scale(${r})" opacity="${o}"/>`;
  }
  out += `</g>`;
  return out;
}

function addGalaxyCore(coreColor) {
  return `
    <g id="core">
      <circle cx="${WIDTH/2}" cy="${HEIGHT/2}" r="${round(WIDTH*0.42)}"
        fill="${coreColor}" opacity="0.08"/>
      <circle cx="${WIDTH/2}" cy="${HEIGHT/2}" r="${round(WIDTH*0.42)}"
        fill="url(#coreGlow)" />
    </g>
  `;
}

// ---------- main ----------
export function generateTrait() {
  // 1) choose a palette
  const P = pick(PALETTES);

  // 2) spiral type: pick once (set perArmSpiralType=true to vary per arm)
  const perArmSpiralType = false;
  const spiralType = pick(SPIRAL_TYPES);

  // 3) config knobs
  const numArms = 6;
  const pointsPerArm = 69;                 // keep your vibe
  const maxRadius = WIDTH * 0.495;
  const numBackgroundStars = 369;
  const armColors = [P.armA, P.armB];      // will alternate A/B
  const dustEvery = 0.04;                  // probability per point

  // 4) build arms
  let arms = `<g id="arms">`;
  for (let i = 0; i < numArms; i++) {
    const type = perArmSpiralType ? pick(SPIRAL_TYPES) : spiralType;
    const pts = generateArmPoints({
      cx: WIDTH/2, cy: HEIGHT/2,
      armIndex: i, totalArms: numArms,
      type, points: pointsPerArm, maxRadius
    });

    // main arm dots (alternate colors A/B)
    const col = armColors[i % armColors.length];
    arms += `<g id="arm-${i}" data-type="${type}">`;
    arms += emitUses(pts, { baseR: 2.6, minR: 0.6, fill: col });

    // dust (larger soft dots, slight tint variance)
    if (dustEvery > 0) {
      const dustPts = pts.filter(()=> getSecureRandomNumber() < dustEvery);
      const dustCol = tint(P.dust, R(-0.08, 0.08));
      arms += emitUses(dustPts, { baseR: 6, minR: 3, fill: dustCol, opacityCurve:(t)=>round(Math.pow(1-t,0.35)*0.35,2) });
    }

    arms += `</g>`;
  }
  arms += `</g>`;

  // 5) assemble SVG
  const svg =
`<svg xmlns="${SVG_NS}" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${buildDefs()}
  <g id="bg"><rect width="100%" height="100%" fill="${P.bg}"/></g>
  ${addBackgroundStars(numBackgroundStars, P.stars)}
  ${arms}
  ${addGalaxyCore(P.core)}
</svg>`.replace(/\s*\n\s*/g, " ").trim();

  validateSVGSize(svg);
  return svg;
}