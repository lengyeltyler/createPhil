// public/traitGeneration/teethTrait.js
import { Delaunay } from 'https://cdn.skypack.dev/d3-delaunay@6';

// ----- Clipper (optional: if not present we fallback to mask-only) -----
const hasClipper = typeof window !== "undefined" && typeof window.ClipperLib !== "undefined";
const Clipper = hasClipper ? window.ClipperLib.Clipper : null;
const PolyType = hasClipper ? window.ClipperLib.PolyType : null;
const ClipType = hasClipper ? window.ClipperLib.ClipType : null;

// ----- constants -----
const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_SIZE = 420;
const NUM_POINTS = 369;          // Voronoi sites
const TEETH_COLOR_COUNT = 3;     // palette size for cells (1..NUM_POINTS)

// Integer scaling for Clipper (Clipper wants ints)
const CLIPPER_SCALE = 100;

// ----- color utils -----
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => {
    const h = Math.round(v).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
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
function hslToRgb(h, s, l) {
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
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function pickRandomColor(colors) { return colors[Math.floor(Math.random() * colors.length)]; }

function generateTeethColors() {
  const count = Math.min(Math.max(TEETH_COLOR_COUNT, 1), NUM_POINTS);
  const base = getRandomColor();
  if (count === 1) return [base];

  const colors = [base];
  const baseHsl = rgbToHsl(...Object.values(hexToRgb(base)));
  for (let i = 1; i < count; i++) {
    const newHue = count <= 3
      ? (baseHsl.h + (360 / count) * i) % 360
      : (baseHsl.h + (360 / count) * i + (Math.random() * 30 - 15)) % 360;
    const newSat = clamp(baseHsl.s + (Math.random() * 0.4 - 0.2), 0.3, 1);
    const newLight = clamp(baseHsl.l + (Math.random() * 0.3 - 0.15), 0.3, 0.8);
    const rgb = hslToRgb(newHue, newSat, newLight);
    colors.push(rgbToHex(rgb.r, rgb.g, rgb.b));
  }
  return colors;
}

// ----- geometry + SVG helpers -----
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch JSON from ${url} (${res.status})`);
  return res.json();
}

// Fast raster hit-test (no DOM thrash)
function isPointInPathRasterized(pathData, x, y, viewBox = `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`) {
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);
  const c = document.createElement("canvas");
  c.width = Math.ceil(width); c.height = Math.ceil(height);
  const ctx = c.getContext("2d");
  const p = new Path2D(pathData);
  ctx.fillStyle = "#000";
  ctx.fill(p);
  return ctx.isPointInPath(p, x - minX, y - minY);
}

function getPathBBox(pathData) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  const tmp = document.createElementNS(SVG_NS, "svg");
  tmp.setAttribute("width", "0"); tmp.setAttribute("height", "0");
  tmp.appendChild(path);
  document.body.appendChild(tmp);
  const bbox = path.getBBox();
  document.body.removeChild(tmp);
  return { bbox };
}

function generatePointsInPath(pathData, bbox, numPoints, viewBox) {
  const points = [];
  const safety = 3.5; // px inset; keeps cells off the exact edge

  // boundary points (≈45%) to stabilize edges
  const boundaryCount = Math.floor(numPoints * 0.45);
  // need path to sample length
  const pathEl = document.createElementNS(SVG_NS, "path");
  pathEl.setAttribute("d", pathData);
  const len = pathEl.getTotalLength();

  for (let i = 0; i < boundaryCount; i++) {
    const t = (i + 0.5) / boundaryCount;
    const pt = pathEl.getPointAtLength(t * len);
    const prev = pathEl.getPointAtLength(Math.max(0, t * len - 1));
    const next = pathEl.getPointAtLength(Math.min(len, t * len + 1));
    const tx = next.x - prev.x, ty = next.y - prev.y;
    let nx = -ty, ny = tx;
    const nlen = Math.hypot(nx, ny);
    if (nlen > 0) { nx /= nlen; ny /= nlen; }
    const cand = { x: pt.x + nx * safety, y: pt.y + ny * safety };
    if (isPointInPathRasterized(pathData, cand.x, cand.y, viewBox)) {
      points.push([cand.x, cand.y]);
    }
  }

  // grid-ish interior points (+ jitter)
  const inset = { x: bbox.x + safety, y: bbox.y + safety, w: bbox.width - 2 * safety, h: bbox.height - 2 * safety };
  const remain = Math.max(0, numPoints - points.length);
  const grid = Math.ceil(Math.sqrt(remain));
  const cw = inset.w / grid, ch = inset.h / grid;

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const x = inset.x + c * cw + Math.random() * cw * 0.85;
      const y = inset.y + r * ch + Math.random() * ch * 0.85;
      if (isPointInPathRasterized(pathData, x, y, viewBox)) {
        points.push([x, y]);
        if (points.length >= numPoints) break;
      }
    }
    if (points.length >= numPoints) break;
  }
  // fill any shortfall randomly
  while (points.length < numPoints) {
    const x = inset.x + Math.random() * inset.w;
    const y = inset.y + Math.random() * inset.h;
    if (isPointInPathRasterized(pathData, x, y, viewBox)) points.push([x, y]);
  }
  return points;
}

function approximatePathAsPolygon(pathData, sampleDistance = 0.25) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  const len = path.getTotalLength();
  const n = Math.max(12, Math.ceil(len / sampleDistance));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const pt = path.getPointAtLength((i / n) * len);
    pts.push({ X: pt.x, Y: pt.y });
  }
  if (pts.length && (pts[0].X !== pts[pts.length - 1].X || pts[0].Y !== pts[pts.length - 1].Y)) {
    pts.push({ ...pts[0] });
  }
  return pts;
}

function pathFromClipperPoly(points) {
  if (!points || points.length < 3) return "";
  let d = `M ${points[0].X},${points[0].Y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].X},${points[i].Y}`;
  return d + " Z";
}

// ----- main -----
export async function generateTrait() {
  const baseURL = "/traits_json";
  const teethURL = `${baseURL}/teethOutline.json`;
  const gumsURL  = `${baseURL}/gumsOutline.json`;

  const [teethData, gumsData] = await Promise.all([fetchJSON(teethURL), fetchJSON(gumsURL)]);
  if (!teethData?.pathData || !gumsData?.pathData) {
    throw new Error("Missing pathData for one or more parts of the Teeth trait.");
  }

  const viewBox = teethData.viewBox || `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`;
  const { bbox } = getPathBBox(teethData.pathData);

  // palette + base fills
  const baseTeethFill = getRandomColor();
  const baseGumsFill  = getRandomColor();
  const cellPalette   = generateTeethColors();

  // Voronoi sites
  const points = generatePointsInPath(teethData.pathData, bbox, NUM_POINTS, viewBox);

  // Voronoi
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height]);

  // If Clipper present, do geometry-accurate clipping; else we’ll mask later.
  let voronoiPaths = "";
  if (hasClipper) {
    const outlinePoly = approximatePathAsPolygon(teethData.pathData, 0.2)  // fine enough
      .map(p => ({ X: Math.round(p.X * CLIPPER_SCALE), Y: Math.round(p.Y * CLIPPER_SCALE) }));

    for (let i = 0; i < points.length; i++) {
      const cell = voronoi.cellPolygon(i);
      if (!cell) continue;
      // scale to ints for Clipper
      const subj = cell.map(([x, y]) => ({ X: Math.round(x * CLIPPER_SCALE), Y: Math.round(y * CLIPPER_SCALE) }));

      const clipper = new Clipper();
      clipper.AddPath(subj, PolyType.ptSubject, true);
      clipper.AddPath(outlinePoly, PolyType.ptClip, true);
      const solution = [];
      clipper.Execute(ClipType.ctIntersection, solution);

      if (solution && solution.length) {
        for (const poly of solution) {
          if (poly.length < 3) continue;
          // scale back down
          const down = poly.map(p => ({ X: p.X / CLIPPER_SCALE, Y: p.Y / CLIPPER_SCALE }));
          const d = pathFromClipperPoly(down);
          if (d) {
            const fill = pickRandomColor(cellPalette);
            voronoiPaths += `<path d="${d}" fill="${fill}" shape-rendering="geometricPrecision"/>`;
          }
        }
      }
    }
  } else {
    // No clipper: still render Voronoi and let an SVG mask enforce boundaries.
    for (let i = 0; i < points.length; i++) {
      const cell = voronoi.cellPolygon(i);
      if (!cell) continue;
      const d = (() => {
        let s = `M ${cell[0][0]},${cell[0][1]}`;
        for (let k = 1; k < cell.length; k++) s += ` L ${cell[k][0]},${cell[k][1]}`;
        return s + " Z";
      })();
      const fill = pickRandomColor(cellPalette);
      voronoiPaths += `<path d="${d}" fill="${fill}" shape-rendering="geometricPrecision"/>`;
    }
  }

  // Build one SVG: gums under teeth; if no clipper, use a mask to clip cells.
  const maskId = `teeth-mask-${Math.floor(Math.random() * 1e9)}`;

  const svg = `
    <svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="${viewBox}">
      ${hasClipper ? "" : `
      <defs>
        <mask id="${maskId}">
          <rect x="0" y="0" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="#000"/>
          <path d="${teethData.pathData}" fill="#fff"/>
        </mask>
      </defs>`}

      <!-- gums (below) -->
      <g id="gums">
        <path d="${gumsData.pathData}" fill="${baseGumsFill}" shape-rendering="geometricPrecision"/>
      </g>

      <!-- teeth base -->
      <g id="teeth">
        <path d="${teethData.pathData}" fill="${baseTeethFill}" shape-rendering="geometricPrecision"/>
        ${hasClipper
          ? voronoiPaths
          : `<g mask="url(#${maskId})">${voronoiPaths}</g>`
        }
      </g>
    </svg>
  `.replace(/\s*\n\s*/g, " ").trim();

  return svg;
}