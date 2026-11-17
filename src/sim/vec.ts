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
export function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }
