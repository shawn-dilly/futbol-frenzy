import type { Vec } from './types';

export function add(a: Vec, b: Vec): Vec { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a: Vec, b: Vec): Vec { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(v: Vec, k: number): Vec { return { x: v.x * k, y: v.y * k }; }
export function len(v: Vec): number { return Math.hypot(v.x, v.y); }
export function dist(a: Vec, b: Vec): number { return len(sub(a, b)); }
export function isZero(v: Vec): boolean { return v.x === 0 && v.y === 0; }
/** Unit vector; the zero vector stays zero. */
export function norm(v: Vec): Vec {
  const l = len(v);
  return l === 0 ? { x: 0, y: 0 } : scale(v, 1 / l);
}
export function clampLen(v: Vec, max: number): Vec {
  const l = len(v);
  return l > max ? scale(v, max / l) : { x: v.x, y: v.y };
}
/** Angle between two vectors in radians, 0..PI. Zero if either is the zero vector. */
export function angleBetween(a: Vec, b: Vec): number {
  const la = len(a), lb = len(b);
  if (la === 0 || lb === 0) return 0;
  const cos = (a.x * b.x + a.y * b.y) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}
/** Rotates by `rad` radians, turning +x toward +y for a positive angle. */
export function rotate(v: Vec, rad: number): Vec {
  const c = Math.cos(rad), s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}
/** The item whose `pos` is nearest `to` and within `maxDist` (inclusive); ties go to the earlier item. Null if none. */
export function nearestTo<T extends { pos: Vec }>(items: readonly T[], to: Vec, maxDist = Infinity): T | null {
  let best: T | null = null, bestDist = Infinity;
  for (const item of items) {
    const d = dist(item.pos, to);
    if (d <= maxDist && d < bestDist) { best = item; bestDist = d; }
  }
  return best;
}
export function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }
/** Distance from `p` to the segment a-b (to the nearer end point when `p` projects beyond it). */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a), l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0, 1);
  return dist(p, add(a, scale(ab, t)));
}
