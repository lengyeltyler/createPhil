import { getColorByNumber, getSecureRandomNumber } from "../utils/colorUtils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_SIZE = 420;

// Configurable constants
const MIN_ELEMENTS = 3;           // Minimum number of cracks/dots
const MAX_ELEMENTS = 36;         // Maximum number of cracks/dots
const OPACITY_MIN = 0.63;        // Minimum opacity for effects
const OPACITY_MAX = 0.9;         // Maximum opacity for effects
const STROKE_WIDTH_MIN = 0.3;    // Minimum stroke width for cracks
const STROKE_WIDTH_MAX = 0.69;   // Maximum stroke width for cracks
const DOT_SIZE_MIN = 1;          // Minimum radius for dots
const DOT_SIZE_MAX = 3;          // Maximum radius for dots
const CRACK_LENGTH = 40;         // Max length variation for cracks (±20)

/**
 * Helper: Fetches and parses JSON from the given URL.
 * @param {string} url - The URL of the JSON file.
 * @returns {Promise<Object>} The parsed JSON.
 */
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON from ${url}`);
  }
  return await response.json();
}

/**
 * Generates a Spikes trait SVG with gradient fill and effects (cracks and dots).
 * @param {string} [rarity="common"] - The rarity level (e.g., "common", "rare", etc.).
 * @param {boolean} [isStatic=true] - Placeholder for animation (not used here).
 * @returns {Promise<string>} A Promise that resolves to the serialized SVG string.
 */
export async function generateTrait(rarity = "common", isStatic = true) {
  // Configurable constants
  const OVERALL_OPACITY = 1.0;       // Overall SVG opacity (0–1)
  const SPIKES_OPACITY = 1.0;        // Opacity for the main spikes path (0–1)
  const EFFECTS_OPACITY_RANGE = [OPACITY_MIN, OPACITY_MAX]; // Opacity range for cracks/dots

  // Generate random colors each time for variety - using standard/matte colors only
  const generateRandomColors = () => {
    // Standard/matte color palette (no bright hues) - ensure visibility
    const standardColors = [8, 11, 12, 13, 21, 22, 32, 33, 36, 38, 44, 49, 52, 53, 55, 56, 66];
    
    const spikeColor = standardColors[Math.floor(getSecureRandomNumber() * standardColors.length)];
    const crackColor = standardColors[Math.floor(getSecureRandomNumber() * standardColors.length)];
    const dotColor = standardColors[Math.floor(getSecureRandomNumber() * standardColors.length)];
    
    return { spikeColor, crackColor, dotColor };
  };

  const colors = generateRandomColors();

  // Color configurations using COLOR_KEY (0–68) - now dynamic with standard colors
  const SPIKES_CONFIG = {
    colors: [colors.spikeColor]  // Single solid color for spikes
  };
  const CRACKS_CONFIG = {
    color: colors.crackColor          // Crack color changes each time
  };
  const DOTS_CONFIG = {
    color: colors.dotColor          // Dot color changes each time
  };

  // Fetch JSON data
      const jsonData = await fetchJSON(`./traits_json/spikesOutline.json`);

  if (!jsonData.pathData) {
    throw new Error("Missing pathData for Spikes trait.");
  }

  const viewBox = jsonData.viewBox || `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`;

  // Generate colors from COLOR_KEY
  const spikesColors = SPIKES_CONFIG.colors.map(num => getColorByNumber(num));
  const crackColor = getColorByNumber(CRACKS_CONFIG.color);
  const dotColor = getColorByNumber(DOTS_CONFIG.color);

  // Create SVG structure
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", CANVAS_SIZE.toString());
  svg.setAttribute("height", CANVAS_SIZE.toString());
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("opacity", OVERALL_OPACITY.toString());

  // Create the main spikes path with solid fill
  const spikesGroup = document.createElementNS(SVG_NS, "g");
  const spikesPath = document.createElementNS(SVG_NS, "path");
  spikesPath.setAttribute("d", jsonData.pathData);
  spikesPath.setAttribute("fill", spikesColors[0]); // Solid color instead of gradient
  spikesPath.setAttribute("stroke", "#000000");
  spikesPath.setAttribute("stroke-width", "0.00005");
  spikesPath.setAttribute("opacity", SPIKES_OPACITY.toString());
  spikesGroup.appendChild(spikesPath);

  // Add effects (cracks and/or dots)
  const mode = selectGenerationMode();
  addEffects(spikesGroup, jsonData.pathData, mode, crackColor, dotColor);

  svg.appendChild(spikesGroup);

  return svg.outerHTML.trim();
}

/**
 * Create seamless gradient with configurable colors.
 * @param {string} id - The ID for the gradient.
 * @param {string[]} colors - Array of hex colors for gradient stops.
 * @returns {Element} Gradient DOM element.
 */
function createSeamlessGradient(id, colors) {
  const gradient = document.createElementNS(SVG_NS, "linearGradient");
  gradient.setAttribute("id", id);
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("x2", "100%");
  gradient.setAttribute("y2", "100%");

  colors.forEach((color, index) => {
    const offset = colors.length === 1 ? 0 : (index / (colors.length - 1)) * 100;
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", `${offset}%`);
    stop.setAttribute("stop-color", color);
    gradient.appendChild(stop);
  });

  return gradient;
}

/**
 * Select generation mode for effects.
 * @returns {string} Mode ("cracks", "dots", or "both").
 */
function selectGenerationMode() {
  const modes = ["cracks", "dots", "both"];
  return modes[Math.floor(getSecureRandomNumber() * modes.length)];
}

/**
 * Add effects to spike group.
 * @param {Element} group - SVG group element to append effects to.
 * @param {string} pathData - SVG path data for clipping.
 * @param {string} mode - Effect mode ("cracks", "dots", or "both").
 * @param {string} crackColor - Hex color for cracks.
 * @param {string} dotColor - Hex color for dots.
 */
function addEffects(group, pathData, mode, crackColor, dotColor) {
  if (mode === "cracks" || mode === "both") {
    const cracks = generateClippedCracks(pathData, crackColor);
    group.appendChild(cracks);
  }
  if (mode === "dots" || mode === "both") {
    const dots = generateClippedDots(pathData, dotColor);
    group.appendChild(dots);
  }
}

/**
 * Generate cracks effect.
 * @param {string} pathData - SVG path data for clipping.
 * @param {string} color - Hex color for cracks.
 * @returns {Element} SVG group element with cracks.
 */
function generateClippedCracks(pathData, color) {
  const group = document.createElementNS(SVG_NS, "g");
  const { ctx, path } = createClipPath(pathData);
  const numCracks = Math.floor(getSecureRandomNumber() * (MAX_ELEMENTS - MIN_ELEMENTS)) + MIN_ELEMENTS;

  for (let i = 0; i < numCracks; i++) {
    const crack = generateCrack({ ctx, path }, color);
    if (crack) group.appendChild(crack);
  }

  return group;
}

/**
 * Generate dots effect.
 * @param {string} pathData - SVG path data for clipping.
 * @param {string} color - Hex color for dots.
 * @returns {Element} SVG group element with dots.
 */
function generateClippedDots(pathData, color) {
  const group = document.createElementNS(SVG_NS, "g");
  const { ctx, path } = createClipPath(pathData);
  const numDots = Math.floor(getSecureRandomNumber() * (MAX_ELEMENTS - MIN_ELEMENTS)) + MIN_ELEMENTS;

  for (let i = 0; i < numDots; i++) {
    const dot = generateDot({ ctx, path }, color);
    if (dot) group.appendChild(dot);
  }

  return group;
}

/**
 * Create clip path context.
 * @param {string} pathData - SVG path data.
 * @returns {Object} Context and Path2D objects.
 */
function createClipPath(pathData) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  const path = new Path2D(pathData);
  ctx.fillStyle = "black";
  ctx.fill(path);
  return { ctx, path };
}

/**
 * Generate crack element.
 * @param {Object} options - Contains ctx and path for clipping.
 * @param {string} color - Hex color for the crack.
 * @returns {Element|null} SVG path element or null if invalid.
 */
function generateCrack({ ctx, path }, color) {
  const [start, end] = generateValidPoints(ctx, path);
  if (!start || !end) return null;

  const crackPath = document.createElementNS(SVG_NS, "path");
  crackPath.setAttribute("d", `M${start.x},${start.y} L${end.x},${end.y}`);
  crackPath.setAttribute("stroke", color);
  crackPath.setAttribute("stroke-width", 
    (getSecureRandomNumber() * (STROKE_WIDTH_MAX - STROKE_WIDTH_MIN) + STROKE_WIDTH_MIN).toString()
  );
  crackPath.setAttribute("opacity", 
    (getSecureRandomNumber() * (OPACITY_MAX - OPACITY_MIN) + OPACITY_MIN).toString()
  );

  return crackPath;
}

/**
 * Generate dot element.
 * @param {Object} options - Contains ctx and path for clipping.
 * @param {string} color - Hex color for the dot.
 * @returns {Element|null} SVG circle element or null if invalid.
 */
function generateDot({ ctx, path }, color) {
  const point = generateValidPoint(ctx, path);
  if (!point) return null;

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", point.x.toString());
  dot.setAttribute("cy", point.y.toString());
  dot.setAttribute("r", (getSecureRandomNumber() * (DOT_SIZE_MAX - DOT_SIZE_MIN) + DOT_SIZE_MIN).toString());
  dot.setAttribute("fill", color);
  dot.setAttribute("opacity", 
    (getSecureRandomNumber() * (OPACITY_MAX - OPACITY_MIN) + OPACITY_MIN).toString()
  );

  return dot;
}

/**
 * Generate valid points within path for cracks.
 * @param {CanvasRenderingContext2D} ctx - Canvas context.
 * @param {Path2D} path - Path2D object.
 * @returns {Array<Object|null>} Start and end points or [null, null] if invalid.
 */
function generateValidPoints(ctx, path) {
  const start = generateValidPoint(ctx, path);
  if (!start) return [null, null];

  const end = {
    x: start.x + (getSecureRandomNumber() * CRACK_LENGTH - CRACK_LENGTH / 2),
    y: start.y + (getSecureRandomNumber() * CRACK_LENGTH - CRACK_LENGTH / 2)
  };

  return ctx.isPointInPath(path, end.x, end.y) ? [start, end] : [null, null];
}

/**
 * Generate valid point within path.
 * @param {CanvasRenderingContext2D} ctx - Canvas context.
 * @param {Path2D} path - Path2D object.
 * @returns {Object|null} Point object with x, y or null if no valid point found.
 */
function generateValidPoint(ctx, path) {
  for (let i = 0; i < 10; i++) {
    const x = getSecureRandomNumber() * CANVAS_SIZE;
    const y = getSecureRandomNumber() * CANVAS_SIZE;
    if (ctx.isPointInPath(path, x, y)) {
      return { x, y };
    }
  }
  return null;
}