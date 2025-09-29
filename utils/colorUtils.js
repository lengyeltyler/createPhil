/**
 * Utility functions for color manipulation and generation
 */

/**
 * Color key: Map numbers to specific colors. 0 is random. Total of 69 colors (0–68).
 */
const COLOR_KEY = {
    0: null, // Random color
    1: "#FF0000", // Red
    2: "#00FF00", // Green
    3: "#0000FF", // Blue
    4: "#FFFF00", // Yellow
    5: "#FF00FF", // Magenta
    6: "#00FFFF", // Cyan
    7: "#FFFFFF", // White
    8: "#000000", // Black
    9: "#FFA500", // Orange
    10: "#800080", // Purple
    11: "#808080", // Gray
    12: "#A52A2A", // Brown
    13: "#FF4500", // OrangeRed
    14: "#FFD700", // Gold
    15: "#00CED1", // DarkTurquoise
    16: "#FF69B4", // HotPink
    17: "#0073CF", // UclaBlue
    18: "#9ACD32", // YellowGreen
    19: "#DAA520", // GoldenRod
    20: "#4B0082", // Indigo
    21: "#F0E68C", // Khaki
    22: "#DC143C", // Crimson
    23: "#ADFF2F", // GreenYellow
    24: "#20B2AA", // LightSeaGreen
    25: "#FF6347", // Tomato
    26: "#6A5ACD", // SlateBlue
    27: "#FFD100", // UclaGold
    28: "#9932CC", // DarkOrchid
    29: "#32CD32", // LimeGreen
    30: "#FF1493", // DeepPink
    31: "#4169E1", // RoyalBlue
    32: "#CD5C5C", // IndianRed
    33: "#FF5F1F", // NeonOrange
    34: "#8A2BE2", // BlueViolet
    35: "#228B22", // ForestGreen
    36: "#D2691E", // Chocolate
    37: "#BA55D3", // MediumOrchid
    38: "#5F9EA0", // CadetBlue
    39: "#FF8C00", // DarkOrange
    40: "#7B68EE", // MediumSlateBlue
    41: "#48D1CC", // MediumTurquoise
    42: "#C71585", // MediumVioletRed
    43: "#191970", // MidnightBlue
    44: "#E9967A", // DarkSalmon
    45: "#9400D3", // DarkViolet
    46: "#00B7EB", // SkyBlue
    47: "#FFDAB9", // PeachPuff
    48: "#2E8B57", // SeaGreen
    49: "#D2B48C", // Tan
    50: "#DB7093", // PaleVioletRed
    51: "#87CEEB", // LightSkyBlue
    52: "#8B4513", // SaddleBrown
    53: "#F08080", // LightCoral
    54: "#6B8E23", // OliveDrab
    55: "#CD853F", // Peru
    56: "#EEE8AA", // PaleGoldenRod
    57: "#483D8B", // DarkSlateBlue
    58: "#98FB98", // PaleGreen
    59: "#B8860B", // DarkGoldenRod
    60: "#00FA9A", // MediumSpringGreen
    61: "#E6E6FA", // Lavender
    62: "#FFB6C1", // LightPink
    63: "#3CB371", // MediumSeaGreen
    64: "#ADD8E6", // LightBlue
    65: "#8B008B", // DarkMagenta
    66: "#BC8F8F", // RosyBrown
    67: "#40E0D0", // Turquoise
    68: "#F5DEB3"  // Wheat
  };
  
  /**
   * Get a color from the key or generate a random one if 0.
   * @param {number} colorNum - Number corresponding to COLOR_KEY (0–68)
   * @returns {string} Hex color string
   */
  export function getColorByNumber(colorNum) {
    if (colorNum === 0 || !COLOR_KEY.hasOwnProperty(colorNum)) {
      return generateSecureRandomHexColor(); // Random if 0 or invalid
    }
    return COLOR_KEY[colorNum];
  }
  
  export function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return `rgb(${Math.round(f(0) * 255)}, ${Math.round(f(8) * 255)}, ${Math.round(f(4) * 255)})`;
  }
  
  export function generateSecureRandomHexColor() {
    const array = new Uint8Array(3);
    window.crypto.getRandomValues(array);
    return `#${Array.from(array)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")}`;
  }
  
  export function getSecureRandomNumber() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
  }