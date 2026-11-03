// Minimal isometric engine: world units (x right-down, y left-down, z up) projected to 2D.
// The camera is orthographic, so pans and zooms are 2D transforms — fast to render and crisp.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Camera {
  target: Vec3;
  zoom: number; // pixels per world unit
  cx: number; // screen anchor
  cy: number;
}

const COS30 = Math.cos(Math.PI / 6);

export function project(p: Vec3): [number, number] {
  return [(p.x - p.y) * COS30, (p.x + p.y) * 0.5 - p.z];
}

export function toScreen(p: Vec3, cam: Camera): [number, number] {
  const [px, py] = project(p);
  const [tx, ty] = project(cam.target);
  return [cam.cx + (px - tx) * cam.zoom, cam.cy + (py - ty) * cam.zoom];
}

export function cameraTransform(cam: Camera): string {
  const [tx, ty] = project(cam.target);
  return `translate(${cam.cx} ${cam.cy}) scale(${cam.zoom}) translate(${-tx} ${-ty})`;
}

export function pts(points: Vec3[]): string {
  return points
    .map((p) => project(p))
    .map(([a, b]) => `${a.toFixed(3)},${b.toFixed(3)}`)
    .join(' ');
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
