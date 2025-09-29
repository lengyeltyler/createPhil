// bgTrait.js (updated with configurable random color counts for arms, stars, and dust)

import { getSecureRandomNumber, getColorByNumber } from "../utils/colorUtils.js";
import { validateSVGSize } from "../utils/sizeValidation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 420;
const HEIGHT = 420;

function roundTo(num, decimals = 1) {
  return parseFloat(num.toFixed(decimals));
}

/**
 * For arms and stars:
 * - If colorInput is an array, use it (or default to [0] if empty).
 * - If colorInput is 0, generate an array of random colors of length randomCount.
 * - Otherwise, return an array with the provided color.
 */
function normalizeGeneralColorArray(colorInput, randomCount) {
  if (Array.isArray(colorInput)) {
    return colorInput.length ? colorInput : [0];
  } else {
    if (colorInput === 0) {
      let colors = [];
      for (let i = 0; i < randomCount; i++) {
        colors.push(getSecureRandomColorIndex());
      }
      return colors;
    } else {
      return [colorInput];
    }
  }
}

/**
 * For dust:
 * - If colorInput is an array, use it (or default to [0] if empty).
 * - If colorInput is 0, generate an array of random dust colors of length count.
 * - Otherwise, return an array filled with the provided color repeated.
 */
function normalizeDustColorArray(colorInput, count) {
  if (Array.isArray(colorInput)) {
    return colorInput.length ? colorInput : [0];
  } else {
    if (colorInput === 0) {
      let colors = [];
      for (let i = 0; i < count; i++) {
        colors.push(getSecureRandomColorIndex());
      }
      return colors;
    } else {
      return Array(count).fill(colorInput);
    }
  }
}

function getSecureRandomColorIndex() {
  return Math.floor(getSecureRandomNumber() * 68) + 1;
}

function createSpiralArm(centerX, centerY, armIndex, totalArms, config) {
  const POINTS = config.particlesPerArm || 69;
  const MAX_RADIUS = WIDTH * 0.4963;
  const type = config.spiralType || "classic";

  const rotationOffset = (armIndex / totalArms) * Math.PI * 2;
  let content = "";

  for (let i = 0; i < POINTS; i++) {
    const t = i / POINTS;
    let radius = t * MAX_RADIUS;
    let angle;

    switch (type) {
      case "tight":
        angle = rotationOffset + t * Math.PI * 8;
        radius *= 1;
        break;
      case "loose":
        angle = rotationOffset + t * Math.PI * 2;
        radius *= 1.25;
        break;
      case "sinewave":
        angle = rotationOffset + Math.sin(t * Math.PI * 4);
        radius *= 1;
        break;
      case "zigzag":
        angle = rotationOffset + (i % 2 === 0 ? 1 : -1) * Math.PI * t;
        break;
      case "randomwalk":
        angle = rotationOffset + t * Math.PI * 4 + (getSecureRandomNumber() - 0.5) * 2;
        break;
      case "logarithmic":
        angle = rotationOffset + t * Math.log(1 + t * 20);
        break;
      case "flower":
        angle = rotationOffset + Math.sin(t * Math.PI * 6);
        radius *= Math.sin(t * Math.PI) * 1.369;
        break;
      case "mirror":
        angle = rotationOffset + Math.PI * (i % 2);
        break;
      default:
        angle = rotationOffset + t * Math.PI * 4;
    }

    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const opacity = Math.pow(1 - t, 0.5) * 0.8;
    const size = roundTo((1 - t) * 3 + 0.5, 1);
    // Use the normalized armColors array (cycles through random or specified colors)
    const color = getColorByNumber(config.armColors[i % config.armColors.length]);

    content += `<circle cx="${roundTo(x)}" cy="${roundTo(y)}" r="${size}" fill="${color}" opacity="${roundTo(opacity, 2)}"/>`;

    if (getSecureRandomNumber() < config.dustDensity) {
      const dustSize = roundTo(getSecureRandomNumber() * 15 + 5, 1);
      // Use the precomputed normalizedDustColors array.
      const dustColor = getColorByNumber(config.normalizedDustColors[i % config.normalizedDustColors.length]);
      content += `<circle cx="${roundTo(x)}" cy="${roundTo(y)}" r="${dustSize}" fill="${dustColor}" opacity="${roundTo(opacity * 0.3, 2)}"/>`;
    }
  }

  return content;
}

function addGalaxyCore(config) {
  const radius = config.coreRadius;
  const color = getColorByNumber(config.coreColor);
  const stops = config.coreOpacityStops;

  return `
    <defs>
      <radialGradient id="coreGlow">
        <stop offset="0" stop-color="${color}" stop-opacity="${stops[0]}"/>
        <stop offset="0.5" stop-color="${color}" stop-opacity="${stops[1]}"/>
        <stop offset="1" stop-color="${color}" stop-opacity="${stops[2]}"/>
      </radialGradient>
    </defs>
    <g id="core">
      <circle cx="${WIDTH / 2}" cy="${HEIGHT / 2}" r="${radius}" fill="url(#coreGlow)"/>
    </g>
  `;
}

function addBackgroundStars(config) {
  const numStars = config.numStars;
  // Use normalized starColors array based on the new random count setting.
  const colors = config.starColors;

  let content = "<g id='stars'>";
  for (let i = 0; i < numStars; i++) {
    const x = roundTo(getSecureRandomNumber() * WIDTH, 1);
    const y = roundTo(getSecureRandomNumber() * HEIGHT, 1);
    const size = roundTo(getSecureRandomNumber() * 1.5 + 0.5, 1);
    const opacity = roundTo(getSecureRandomNumber(), 2);
    const color = getColorByNumber(colors[i % colors.length]);

    content += `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}" opacity="${opacity}"/>`;
  }
  content += "</g>";
  return content;
}

export function generateTrait() {
  const config = {
    backgroundColor: 0,
    numArms: 6,
    particlesPerArm: 69,
    spiralType: "tight",
    // For arms: set armColors to 0 for random; armRandomCount controls how many random colors are generated
    armColors: 0,
    armRandomCount: 1, // Change this (e.g., 1, 2, 3, ...) for multiple random arm colors
    dustDensity: 0.0369,
    // For dust: set dustColor to 0 for random; dustRandomCount controls how many random dust colors are generated
    dustColor: 0, // Set to 0 to use random dust colors
    dustRandomCount: 1,
    coreColor: 0,
    coreRadius: WIDTH * 0.42,
    coreOpacityStops: [0.6, 0.3, 0],
    numStars: 369,
    // For stars: set starColors to 0 for random; starRandomCount controls how many random star colors are generated
    starColors: 0,
    starRandomCount: 1 // Change this (e.g., 1, 2, 3, ...) for multiple random star colors
  };

  // Normalize color arrays for arms, stars, and dust.
  config.armColors = normalizeGeneralColorArray(config.armColors, config.armRandomCount);
  config.starColors = normalizeGeneralColorArray(config.starColors, config.starRandomCount);
  config.normalizedDustColors = normalizeDustColorArray(config.dustColor, config.dustRandomCount);

  const svg = `
    <svg xmlns="${SVG_NS}" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <rect width="100%" height="100%" fill="${getColorByNumber(config.backgroundColor)}"/>
      ${addBackgroundStars(config)}
      <g id="arms">
        ${Array.from({ length: config.numArms }).map((_, i) =>
          createSpiralArm(WIDTH / 2, HEIGHT / 2, i, config.numArms, config)
        ).join("")}
      </g>
      ${addGalaxyCore(config)}
    </svg>
  `.replace(/\s*\n\s*/g, " ").trim();

  validateSVGSize(svg);
  return svg;
}

/**
 * --- README for bgTrait.js ---
 *
 * You can customize this trait by editing the `config` object in `generateTrait()`:
 *
 * - `backgroundColor`: Integer 0–68 (0 = random single color)
 * - `numArms`: Number of spiral arms (e.g., 2–9)
 * - `particlesPerArm`: Number of stars/points in each spiral arm
 * - `spiralType`: Choose from: "classic", "tight", "loose", "sinewave", "zigzag", "randomwalk", "logarithmic", "flower", "mirror"
 * - `armColors`: 0 = use random colors, or provide an array of numbers (from colorUtils.js)
 * - `armRandomCount`: When `armColors` is 0, this sets how many random colors to generate for the arms
 * - `dustDensity`: 0.01 (low dust) to 1.0 (high dust fill)
 * - `dustColor`: 0 = use random dust colors, or provide a specific color index or array of color indices
 * - `dustRandomCount`: When `dustColor` is 0, this sets how many random dust colors to generate
 * - `coreColor`: 0 = random or specify a color index
 * - `coreRadius`: Radius of glowing core (e.g., WIDTH * 0.2)
 * - `coreOpacityStops`: Array of 3 values between 0–1 to control glow transparency
 * - `numStars`: Total number of background stars (e.g., 10–200)
 * - `starColors`: 0 = use random colors, or provide an array of numbers
 * - `starRandomCount`: When `starColors` is 0, this sets how many random colors to generate for the stars
 */