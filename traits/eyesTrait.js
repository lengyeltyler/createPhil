// public/traitGeneration/eyesTrait.js

const SVG_NS = "http://www.w3.org/2000/svg";
const CANVAS_SIZE = 420;

/**
 * Generates a cryptographically secure random number between 0 and 1.
 * @returns {number} Random number between 0 and 1.
 */
function getSecureRandomNumber() {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] / (0xFFFFFFFF + 1);
}

/**
 * Generates a unique identifier using the Web Crypto API.
 * @returns {string} A unique identifier string.
 */
function generateUniqueId() {
  const array = new Uint8Array(8);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts HSL to RGB.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {Object} RGB representation with r, g, b properties
 */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1, g1, b1;
  if (0 <= hp && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (1 <= hp && hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (2 <= hp && hp < 3) [r1, g1, b1] = [0, c, x];
  else if (3 <= hp && hp < 4) [r1, g1, b1] = [0, x, c];
  else if (4 <= hp && hp < 5) [r1, g1, b1] = [x, 0, c];
  else if (5 <= hp && hp < 6) [r1, g1, b1] = [c, 0, x];
  else [r1, g1, b1] = [0, 0, 0];
  const m = l - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Converts RGB to Hex.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {string} Hexadecimal color string
 */
function rgbToHex(r, g, b) {
  const hr = r.toString(16).padStart(2, "0");
  const hg = g.toString(16).padStart(2, "0");
  const hb = b.toString(16).padStart(2, "0");
  return `#${hr}${hg}${hb}`;
}

/**
 * Generates a random lighter HEX color for characters.
 * @returns {string} Light HEX color string
 */
function generateRandomHexColor() {
  const r = Math.floor(getSecureRandomNumber() * 156) + 100; // 100-255
  const g = Math.floor(getSecureRandomNumber() * 156) + 100;
  const b = Math.floor(getSecureRandomNumber() * 156) + 100;
  return rgbToHex(r, g, b);
}

/**
 * Generate a random dark HEX color (e.g., #1a0f2b).
 * @returns {string} Dark HEX color string
 */
function generateRandomDarkHexColor() {
  const r = Math.floor(getSecureRandomNumber() * 64); // 0-63
  const g = Math.floor(getSecureRandomNumber() * 64);
  const b = Math.floor(getSecureRandomNumber() * 64);
  return rgbToHex(r, g, b);
}

/**
 * Generate a bright neon HEX color (e.g., #40ff00).
 * @returns {string} Neon HEX color string
 */
function generateRandomNeonHexColor() {
  const r = Math.floor(getSecureRandomNumber() * 156) + 100; // 100-255
  const g = Math.floor(getSecureRandomNumber() * 156) + 100;
  const b = Math.floor(getSecureRandomNumber() * 156) + 100;
  return rgbToHex(r, g, b);
}

/**
 * Rasterized hit-testing function to ensure generated text lands inside the shape path.
 * Adjusted to match the SVG viewBox.
 */
function isPointInPathRasterized(pathData, x, y, viewBox = "0 0 420 420") {
  const [minX, minY, width, height] = viewBox.split(" ").map(Number);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const path = new Path2D(pathData);
  ctx.fillStyle = "black";
  ctx.fill(path);
  // Normalize x, y to canvas coordinates based on viewBox
  const normalizedX = x - minX;
  const normalizedY = y - minY;
  return ctx.isPointInPath(path, normalizedX, normalizedY);
}

/**
 * Generate falling code characters (static positions for now).
 * @param {string} pathData - SVG path data for the mask.
 * @param {string} quote - The quote to display.
 * @param {string} color - Hex color for the characters.
 * @param {number} minSpeed - Minimum fall speed (for potential animation).
 * @param {number} maxSpeed - Maximum fall speed (for potential animation).
 * @returns {string} SVG group string with static text positions.
 */
function generateFallingCode(pathData, quote, color, minSpeed, maxSpeed, viewBox = "0 0 420 420") {
  let groupContent = '<g>';
  const [minX, minY, width, height] = viewBox.split(" ").map(Number);

  for (const char of quote) {
    let x, y, pointValid = false;
    for (let attempts = 0; attempts < 100; attempts++) { // Increased attempts for better fit
      x = minX + getSecureRandomNumber() * width;
      y = minY + getSecureRandomNumber() * height;
      if (isPointInPathRasterized(pathData, x, y, viewBox)) {
        pointValid = true;
        break;
      }
    }
    if (pointValid) {
      groupContent += `
        <text x="${x}" y="${y}" fill="${color}" font-family="monospace" font-size="14">
          ${char}
        </text>
      `;
    }
  }
  groupContent += '</g>';
  return groupContent;
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON from ${url}`);
  }
  return await response.json();
}

const quotes = [
  ".",
  "fuck you",
  "kiss my ass",
  "kiss his ass",
  "kiss your own ass",
  "happy hanukkah",
  "<3"
];

/**
 * Helper: Get a random quote from the list using secure randomness.
 * @returns {string} A random quote.
 */
const getRandomQuote = () => {
  const randomIndex = Math.floor(getSecureRandomNumber() * quotes.length);
  return quotes[randomIndex];
};

/**
 * Adds a linear gradient with two random dark hex stops for the frame.
 * @param {string} id - The ID for the gradient.
 * @returns {string} Gradient definition as a string.
 */
function addDarkGradient(id) {
  const stop1 = generateRandomDarkHexColor();
  const stop2 = generateRandomDarkHexColor();
  return `
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${stop1}" />
        <stop offset="100%" style="stop-color:${stop2}" />
      </linearGradient>
    </defs>
  `;
}

/**
 * Adds a radial gradient with a bright neon outer color in hex for the lens.
 * @param {string} id - The ID for the gradient.
 * @returns {string} Gradient definition as a string.
 */
function addLaserGradient(id) {
  const neonColor = generateRandomNeonHexColor();
  return `
    <defs>
      <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#ffffff" />
        <stop offset="100%" style="stop-color:${neonColor}" />
      </radialGradient>
    </defs>
  `;
}

async function generateTrait(jsonData) {
  if (!jsonData) {
    const baseURL = "/traits_json";
    const eyesURL = `${baseURL}/eyesOutline.json`;
    const framesURL = `${baseURL}/frameOutline.json`;
    const [eyesData, framesData] = await Promise.all([
      fetchJSON(eyesURL),
      fetchJSON(framesURL)
    ]);
    jsonData = {
      eyes: eyesData,
      frames: framesData
    };
  }

  if (
    !jsonData.eyes || !jsonData.eyes.pathData ||
    !jsonData.frames || !jsonData.frames.pathData
  ) {
    throw new Error("Missing pathData for one or more parts of the Eyes trait.");
  }

  const colorEyes = generateRandomHexColor();
  const frameGradientId = `frameGradient-${generateUniqueId()}`;
  const lensGradientId = `lensGradient-${generateUniqueId()}`;
  const maskId = `mask-${generateUniqueId()}`;

  const quote = getRandomQuote();
  const codeColor = generateRandomHexColor();

  // Generate falling code (static positions)
  const fallingCode = generateFallingCode(jsonData.eyes.pathData, quote, codeColor, 0.69, 6.9, jsonData.eyes.viewBox || `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`);

  // Combine all SVG elements
  const svg = `
    <svg xmlns="${SVG_NS}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="${jsonData.eyes.viewBox || `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}">
      ${addDarkGradient(frameGradientId)}
      ${addLaserGradient(lensGradientId)}
      <mask id="${maskId}">
        <path d="${jsonData.eyes.pathData}" fill="white" />
      </mask>
      <path d="${jsonData.frames.pathData}" fill="url(#${frameGradientId})" />
      <path d="${jsonData.eyes.pathData}" fill="url(#${lensGradientId})" />
      <g mask="url(#${maskId})">
        ${fallingCode}
      </g>
    </svg>
  `;

  return svg.trim();
}

export { generateTrait };