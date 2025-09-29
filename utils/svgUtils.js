// utils/svgUtils.js

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Generates a cryptographically secure unique identifier.
 * @returns {string} A unique identifier.
 */
export function generateUniqueId() {
    const array = new Uint8Array(8);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Computes the centroid of a polygon.
 * @param {Array<Array<number>>} points - An array of [x, y] pairs.
 * @returns {Array<number>} The [x, y] coordinates of the centroid.
 */
export function centroid(points) {
    let area = 0;
    let x = 0;
    let y = 0;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [x1, y1] = points[j];
        const [x2, y2] = points[i];
        const cross = x1 * y2 - x2 * y1;
        area += cross;
        x += (x1 + x2) * cross;
        y += (y1 + y2) * cross;
    }

    area = area / 2;
    if (area === 0) return [0, 0];
    const factor = 1 / (6 * area);
    return [x * factor, y * factor];
}

/**
 * Creates a smooth polygon path from points.
 * @param {Array<Array<number>>} points - An array of [x, y] pairs.
 * @param {string} fillColor - Fill color for the path.
 * @param {string} strokeColor - Stroke color for the path.
 * @param {number} strokeWidth - Stroke width.
 * @returns {SVGPathElement} An SVG <path> element.
 */
export function createSmoothPolygon(points, fillColor, strokeColor, strokeWidth) {
    let d = "";
    for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];

        if (i === 0) {
            d += `M ${x1},${y1} `;
        }

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        d += `Q ${x1},${y1} ${midX},${midY} `;
        d += `T ${x2},${y2} `;
    }
    d += "Z";

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", fillColor);
    path.setAttribute("stroke", strokeColor);
    path.setAttribute("stroke-width", strokeWidth.toFixed(2));
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");

    return path;
}

/**
 * Generates a secure random number in the range [0, 1).
 * Uses the window.crypto API for better randomness.
 * @returns {number} A random number between 0 (inclusive) and 1 (exclusive).
 */
export function getSecureRandomNumber() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
}

/**
 * Generates a pool of random hex color strings.
 *
 * @param {number} poolSize - The number of colors to generate.
 * @returns {string[]} An array of color strings (e.g., "#a3b1c2").
 */
export function generateColorPool(poolSize) {
    const colors = [];
    for (let i = 0; i < poolSize; i++) {
        const color = '#' + Math.floor(Math.random() * 0xFFFFFF)
            .toString(16)
            .padStart(6, '0');
        colors.push(color);
    }
    return colors;
}

export { SVG_NS };