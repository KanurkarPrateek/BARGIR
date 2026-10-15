// A gym's brand colour (Gym Settings) and the colours worked out from it for
// invoices: text that stays readable on it, a light tint, and a version dark
// enough to use as text on white.

export const DEFAULT_BRAND = "#1f2937";

export function normalizeHex(value: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((value ?? "").trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

// WCAG relative luminance.
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// White or near-black, whichever reads better on the colour.
export const textOn = (hex: string) => (contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111");

// Mixed with white: `amount` 0 = white, 1 = the colour.
export const tint = (hex: string, amount: number) => toHex(channels(hex).map((v) => 255 - (255 - v) * amount));

// The colour, darkened until it is readable as text on white (4.5:1).
export function inkOnWhite(hex: string): string {
  let c = channels(hex);
  for (let i = 0; i < 20 && contrast(toHex(c), "#ffffff") < 4.5; i++) c = c.map((v) => v * 0.85);
  return toHex(c);
}

export function brandColors(value: string | null | undefined) {
  const brand = normalizeHex(value) ?? DEFAULT_BRAND;
  return { brand, onBrand: textOn(brand), soft: tint(brand, 0.1), ink: inkOnWhite(brand) };
}

// The main colour of a logo, from its pixels (RGBA): the most common clearly
// coloured shade, ignoring white, black, greys and transparent parts. Null
// for a logo with no real colour.
export function dominantColor(pixels: Uint8ClampedArray): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 40 || min > 225 || max - min < 40) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    const weight = (max - min) / 255;
    e.n += weight; e.r += r * weight; e.g += g * weight; e.b += b * weight;
    buckets.set(key, e);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  return best && best.n > 20 ? toHex([best.r / best.n, best.g / best.n, best.b / best.n]) : null;
}
