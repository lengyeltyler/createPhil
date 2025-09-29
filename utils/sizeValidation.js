// utils/sizeValidation.js

// Default max size increased based on the new 469x469 canvas & improved compression
const DEFAULT_MAX_SIZE = 6666 * 1024; // 6,666KB (adjustable)

export function validateSVGSize(svgString, maxSize = DEFAULT_MAX_SIZE) {
    if (typeof svgString !== "string") {
        throw new Error("validateSVGSize: input must be a string");
    }

    const size = new Blob([svgString]).size;
    if (size > maxSize) {
        throw new Error(`SVG size ${size} bytes exceeds maximum size of ${maxSize} bytes`);
    }
    
    return true;
}