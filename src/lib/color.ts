// Brand colours are chosen by business owners, so text colour must adapt to stay readable.
const hex = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };

export function luminance(h: string): number {
  const rgb = hex(h) ?? [0, 0, 0];
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** White or near-black, whichever reads better on `bg`. */
export function readableOn(bg: string): '#FFFFFF' | '#2B2523' {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#2B2523') ? '#FFFFFF' : '#2B2523';
}
export function safeColor(h: string | null | undefined, fallback: string): string {
  return h && /^#[0-9a-f]{6}$/i.test(h) ? h : fallback;
}
