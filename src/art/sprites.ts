import type { AnimName } from '../sim';
import { KITS, PAL, type Kit } from './palette';
import type { RectFn } from './pixelFont';

export const FRAME_W = 24;
export const FRAME_H = 20;
/** Feet centre inside a frame; poses below are offsets from it, facing right. */
const KIT_COUNT = KITS.length;
export const ORIGIN_X = 12;
export const ORIGIN_Y = 18;

export const ANIMS: Record<AnimName, { frames: number; ticksPerFrame: number; loop: boolean }> = {
  idle: { frames: 2, ticksPerFrame: 30, loop: true },
  run: { frames: 6, ticksPerFrame: 5, loop: true },
  kick: { frames: 3, ticksPerFrame: 4, loop: false },
};

/** [dx, dy, w, h] relative to the feet centre. */
type R = [number, number, number, number];

interface Pose {
  /** Pixels the head, torso and shorts sit lower than the standing height. */
  bob: 0 | 1;
  /** Skin-coloured leg pieces (drawn under the shorts). */
  legs: R[];
  /** Boot pieces. */
  boots: R[];
  /** Skin-coloured arm pieces (drawn over the torso). */
  arms: R[];
}

const ARM_FWD: R[] = [[4, -9, 1, 2], [5, -10, 1, 2]];
const ARM_BACK: R[] = [[-4, -9, 1, 2], [-5, -8, 1, 2]];
const ARM_HANG: R[] = [[-4, -9, 1, 3], [4, -9, 1, 3]];
const ARM_FWD_HANG: R[] = [[4, -8, 1, 3]];

export const POSES: Record<AnimName, Pose[]> = {
  idle: [
    { bob: 0, legs: [[-3, -3, 2, 2], [2, -3, 2, 2]], boots: [[-3, -1, 2, 1], [2, -1, 3, 1]], arms: ARM_HANG },
    { bob: 1, legs: [[-3, -2, 2, 1], [2, -2, 2, 1]], boots: [[-3, -1, 2, 1], [2, -1, 3, 1]], arms: ARM_HANG },
  ],
  run: [
    // 0 contact: near leg reaches forward, far arm forward
    { bob: 0, legs: [[2, -3, 2, 1], [3, -2, 2, 1], [-3, -3, 2, 1], [-4, -2, 2, 1]],
      boots: [[4, -1, 3, 1], [-6, -1, 3, 1]], arms: [...ARM_FWD, ...ARM_BACK] },
    // 1 down: body drops, front knee bent
    { bob: 1, legs: [[1, -2, 2, 1], [-3, -2, 2, 1]], boots: [[1, -1, 3, 1], [-5, -1, 3, 1]],
      arms: [[4, -8, 1, 2], [5, -9, 1, 2], [-4, -8, 1, 2], [-5, -7, 1, 2]] },
    // 2 passing: trailing foot kicked up behind
    { bob: 0, legs: [[-1, -3, 2, 2], [-4, -3, 2, 1], [-5, -2, 2, 1]], boots: [[-1, -1, 3, 1], [-7, -2, 2, 1]],
      arms: ARM_HANG },
    // 3 contact: far leg reaches forward, near arm forward
    { bob: 0, legs: [[3, -3, 2, 1], [4, -2, 2, 1], [-4, -3, 2, 1], [-5, -2, 2, 1]],
      boots: [[5, -1, 3, 1], [-7, -1, 3, 1]], arms: [...ARM_FWD, ...ARM_BACK].map(([x, y, w, h]): R => [x, y + 1, w, h]) },
    // 4 down
    { bob: 1, legs: [[2, -2, 2, 1], [-4, -2, 2, 1]], boots: [[2, -1, 3, 1], [-5, -1, 2, 1]],
      arms: [[4, -9, 1, 2], [5, -10, 1, 2], [-4, -9, 1, 2], [-5, -8, 1, 2]] },
    // 5 passing: frame 2 on the other leg (support leg mirrored about the body centre, trailing foot still behind), arms swapped
    { bob: 0, legs: [[0, -3, 2, 2], [-4, -3, 2, 1], [-5, -2, 2, 1]], boots: [[-1, -1, 3, 1], [-7, -2, 2, 1]],
      arms: [[-4, -8, 1, 3], [4, -10, 1, 3]] },
  ],
  kick: [
    // 0 wind-up: kicking foot cocked high behind
    { bob: 0, legs: [[-1, -3, 2, 2], [-4, -3, 2, 1], [-5, -4, 1, 2]], boots: [[-1, -1, 3, 1], [-7, -4, 2, 1]],
      arms: [...ARM_FWD, ...ARM_BACK] },
    // 1 strike: leg straight out forward
    { bob: 0, legs: [[-2, -3, 2, 2], [1, -3, 5, 1]], boots: [[-2, -1, 3, 1], [6, -3, 2, 1]],
      arms: [...ARM_BACK, ...ARM_FWD_HANG] },
    // 2 follow-through: leg swung up high
    { bob: 0, legs: [[-2, -3, 2, 2], [4, -4, 2, 1], [5, -5, 2, 1]], boots: [[-2, -1, 3, 1], [7, -5, 2, 1]],
      arms: [[-4, -9, 1, 2], [-5, -10, 1, 2], ...ARM_FWD_HANG] },
  ],
};

export function drawPlayerFrame(rect: RectFn, kit: Kit, anim: AnimName, frame: number): void {
  const pose = POSES[anim][frame];
  const put = ([dx, dy, w, h]: R, color: string, lower = 0) =>
    rect(ORIGIN_X + dx, ORIGIN_Y + dy + lower, w, h, color);
  const b = pose.bob;
  pose.legs.forEach(l => put(l, kit.skin));
  pose.boots.forEach(l => put(l, PAL.ink));
  put([-2, -15, 5, 2], kit.hair, b);
  put([-2, -13, 5, 3], kit.skin, b);
  put([2, -12, 1, 1], PAL.ink, b);
  put([-3, -10, 7, 5], kit.jersey, b);
  put([-3, -8, 7, 1], kit.trim, b);
  put([-3, -5, 7, 2], kit.shorts, b);
  pose.arms.forEach(a => put(a, kit.skin, b));
}

export function frameIndex(anim: AnimName, animTick: number): number {
  const { frames, ticksPerFrame, loop } = ANIMS[anim];
  const n = Math.floor(animTick / ticksPerFrame);
  return loop ? n % frames : Math.min(n, frames - 1);
}

export function frameKey(kitIndex: number, anim: AnimName, frame: number): string {
  return `k${kitIndex}_${anim}_${frame}`;
}

export function atlasLayout(): { key: string; x: number; y: number }[] {
  const out: { key: string; x: number; y: number }[] = [];
  for (let k = 0; k < KIT_COUNT; k++) {
    let col = 0;
    for (const anim of Object.keys(ANIMS) as AnimName[]) {
      for (let f = 0; f < ANIMS[anim].frames; f++) out.push({ key: frameKey(k, anim, f), x: col++ * FRAME_W, y: k * FRAME_H });
    }
  }
  return out;
}
