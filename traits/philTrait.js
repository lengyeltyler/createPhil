import { Delaunay } from 'https://cdn.skypack.dev/d3-delaunay@6';
import { getColorByNumber, getSecureRandomNumber } from "../utils/colorUtils.js";

const Clipper = ClipperLib.Clipper;
const PolyType = ClipperLib.PolyType;
const ClipType = ClipperLib.ClipType;

const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_SIZE = 420;
const NUM_POINTS = 169;

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch JSON from ${url}`);
  return await response.json();
}

function isPointInPath(path, x, y) {
  const tempSvg = document.createElementNS(SVG_NS, "svg");
  tempSvg.appendChild(path);
  document.body.appendChild(tempSvg);
  const point = tempSvg.createSVGPoint();
  point.x = x;
  point.y = y;
  const inside = path.isPointInFill(point);
  document.body.removeChild(tempSvg);
  return inside;
}

function getPathInfo(pathData) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  const tempSvg = document.createElementNS(SVG_NS, "svg");
  tempSvg.appendChild(path);
  document.body.appendChild(tempSvg);
  const bbox = path.getBBox();
  document.body.removeChild(tempSvg);
  return { path, bbox };
}

function generatePointsInPath(path, bbox, numPoints) {
  const points = [];
  const length = path.getTotalLength();
  const numBoundaryPoints = Math.floor(numPoints * 0.4);
  for (let i = 0; i < numBoundaryPoints; i++) {
    const t = i / numBoundaryPoints;
    const point = path.getPointAtLength(t * length);
    points.push([point.x + (getSecureRandomNumber() - 0.5) * 5, point.y + (getSecureRandomNumber() - 0.5) * 5]);
  }
  const numInteriorPoints = numPoints - numBoundaryPoints;
  const noiseScale = 0.1;
  while (points.length < numPoints) {
    const x = bbox.x + getSecureRandomNumber() * bbox.width;
    const y = bbox.y + getSecureRandomNumber() * bbox.height;
    const noise = Math.sin(x * noiseScale) * Math.sin(y * noiseScale);
    if (getSecureRandomNumber() < 0.5 + noise * 0.3 && isPointInPath(path, x, y)) {
      points.push([x, y]);
    }
  }
  return points.slice(0, numPoints);
}

function approximatePathAsPolygon(path, sampleDistance = 0.5) {
  const length = path.getTotalLength();
  const numSamples = Math.ceil(length / sampleDistance);
  const points = [];
  for (let i = 0; i <= numSamples; i++) {
    const point = path.getPointAtLength((i / numSamples) * length);
    points.push({ X: point.x, Y: point.y });
  }
  if (points[0].X !== points[points.length - 1].X || points[0].Y !== points[points.length - 1].Y) {
    points.push(points[0]);
  }
  return points;
}

function offsetCellPoints(points, maxOffset = 3) {
  return points.map(point => ({
    X: point.X + (getSecureRandomNumber() - 0.5) * maxOffset,
    Y: point.Y + (getSecureRandomNumber() - 0.5) * maxOffset
  }));
}

// Original function for straight-edged cells.
function createCellPath(points) {
  if (!points || points.length < 3) return '';
  return `M ${points[0].X},${points[0].Y} ${points.slice(1).map(p => `L ${p.X},${p.Y}`).join(' ')} Z`;
}

/*
 * New function: createSmoothCellPath
 *
 * This function converts a polygon into a smooth, curved path by using a Catmull-Rom-to-Bézier conversion.
 * A tension value (default 0.5) controls the tightness of the curves, and a random offset (default 2)
 * is added to the control points to yield more organic, unpredictable shapes.
 */
function createSmoothCellPath(points, tension = 0.2, randomOffset = 2) {
  // Remove duplicate last point if present for closed polygons.
  let pts = points.slice();
  if (pts.length > 1 && pts[0].X === pts[pts.length - 1].X && pts[0].Y === pts[pts.length - 1].Y) {
    pts.pop();
  }
  const n = pts.length;
  if (n < 2) return '';
  let pathData = `M ${pts[0].X},${pts[0].Y}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    let cp1x = p1.X + ((p2.X - p0.X) / 6) * tension;
    let cp1y = p1.Y + ((p2.Y - p0.Y) / 6) * tension;
    let cp2x = p2.X - ((p3.X - p1.X) / 6) * tension;
    let cp2y = p2.Y - ((p3.Y - p1.Y) / 6) * tension;
    // Apply a small random offset to the control points for added variation.
    cp1x += (getSecureRandomNumber() - 0.5) * randomOffset;
    cp1y += (getSecureRandomNumber() - 0.5) * randomOffset;
    cp2x += (getSecureRandomNumber() - 0.5) * randomOffset;
    cp2y += (getSecureRandomNumber() - 0.5) * randomOffset;
    pathData += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.X},${p2.Y}`;
  }
  pathData += ' Z';
  return pathData;
}

/*
 * Updated export: generateTrait now accepts a third parameter (useCurves) to toggle between
 * straight-line cells and curved cells.
 */
export async function generateTrait(unused = null, isStatic = true, useCurves = true) {
  const OVERALL_OPACITY = 1.0;
  const CELLS_MIN_OPACITY = 0.8;
  const CELLS_MAX_OPACITY = 1.0;
  const STROKE_WIDTH = 0.5; // Increased for better visibility
  const OUTLINE_STROKE_WIDTH = 1.5; // Increased for crisper outline
  const MAX_OFFSET = 0; // Keep at 0 for crisp edges

  // Generate random colors each time for variety
  const generateRandomColors = () => {
    const colorPool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68];
    
    const cellColor = colorPool[Math.floor(getSecureRandomNumber() * colorPool.length)];
    const strokeColor = colorPool[Math.floor(getSecureRandomNumber() * colorPool.length)];
    const outlineColor = colorPool[Math.floor(getSecureRandomNumber() * colorPool.length)];
    
    return { cellColor, strokeColor, outlineColor };
  };

  const colors = generateRandomColors();

  const PHIL_CONFIG = {
    cellColors: [colors.cellColor],
    strokeColor: colors.strokeColor,
    outlineStrokeColor: colors.outlineColor
  };

  try {
    const jsonData = await fetchJSON('./traits_json/philOutline.json');
    if (!jsonData.pathData) throw new Error('Missing pathData for Phil trait.');

    const { path, bbox } = getPathInfo(jsonData.pathData);
    const points = generatePointsInPath(path, bbox, NUM_POINTS);

    const delaunay = new Delaunay(points.flat());
    const voronoi = delaunay.voronoi([bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height]);
    const pathPoints = approximatePathAsPolygon(path);

    const cellColors = PHIL_CONFIG.cellColors.map(num => getColorByNumber(num));
    const strokeColor = getColorByNumber(PHIL_CONFIG.strokeColor);
    const outlineStrokeColor = cellColors[0]; // Use the same color as cells for outline

    let cellPaths = '';
    for (let i = 0; i < points.length; i++) {
      const cell = voronoi.cellPolygon(i);
      if (cell) {
        const cellPoints = cell.map(([x, y]) => ({ X: x, Y: y }));
        const clipper = new Clipper();
        clipper.AddPath(cellPoints, PolyType.ptSubject, true);
        clipper.AddPath(pathPoints, PolyType.ptClip, true);
        const solution = [];
        clipper.Execute(ClipType.ctIntersection, solution);

        for (const poly of solution) {
          const offsetPoints = offsetCellPoints(poly, MAX_OFFSET);
          // Use straight lines for crisper edges
          const pathData = createCellPath(offsetPoints);
          if (pathData) {
            const color = cellColors[i % cellColors.length];
            const opacity = CELLS_MIN_OPACITY + getSecureRandomNumber() * (CELLS_MAX_OPACITY - CELLS_MIN_OPACITY);
            cellPaths += `<path d="${pathData}" fill="${color}" opacity="${opacity}"/>`;
          }
        }
      }
    }

    const outlineStrokeAttr = OUTLINE_STROKE_WIDTH > 0 ? `stroke="${outlineStrokeColor}" stroke-width="${OUTLINE_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"` : '';
    const svg = `<svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" opacity="${OVERALL_OPACITY}">`
      + `<g stroke="${strokeColor}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${cellPaths}</g>`
      + `<path d="${jsonData.pathData}" fill="none" ${outlineStrokeAttr}/></svg>`;

    return svg.replace(/\s*\n\s*/g, " ").trim();
  } catch (error) {
    console.error('Error generating Phil trait:', error);
    return `<svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}"><path d="${jsonData?.pathData || ''}" fill="black" /></svg>`;
  }
}