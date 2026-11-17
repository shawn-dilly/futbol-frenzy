import { describe, expect, test } from 'vitest';
import { ANIMATIONS, GETUP_TICKS, airTicks, hurtAnimKey, type ColorRole, type Px } from '../../src/content/animations';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y } from '../../src/art/sprites';
import { HURT, HURT_TIERS, type HitType, type PlayerState, type PlayerStatus } from '../../src/sim';
import { createMatch } from '../../src/sim/setup';
import { animFor } from '../../src/game/playerAnim';

const HITS: HitType[] = ['shoulder', 'slide', 'big'];
const base = createMatch({ seed: 1, halfSeconds: 120, human: [true, false] }).players[4];
const keyFor = (status: PlayerStatus, moving = false): string => {
  const p: PlayerState = { ...base, status, vel: { x: moving ? 60 : 0, y: 0 } };
  return animFor(p, 0).key;
};

/** Roles that may float apart from the body. */
const DETACHED_ROLES_ALLOWED: ColorRole[] = ['star'];

/** Number of 8-connected groups among the cells the frame draws, ignoring the allowed detached roles. */
function bodyPieces(frame: Px[]): number {
  const cells = new Set<string>();
  for (const [dx, dy, w, h, role] of frame) {
    if (DETACHED_ROLES_ALLOWED.includes(role)) continue;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.add(`${dx + i},${dy + j}`);
  }
  let pieces = 0;
  while (cells.size > 0) {
    pieces++;
    const [first] = cells; cells.delete(first);
    const stack = [first];
    while (stack.length > 0) {
      const [x, y] = stack.pop()!.split(',').map(Number);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const n = `${x + ox},${y + oy}`;
        if (cells.delete(n)) stack.push(n);
      }
    }
  }
  return pieces;
}

describe('animation data', () => {
  test('every frame is one connected body, with no detached pieces', () => {
    for (const [key, def] of Object.entries(ANIMATIONS)) {
      def.frames.forEach((frame, i) => expect(bodyPieces(frame), `${key}_${i}`).toBe(1));
    }
  });

  test('hurtAnimKey names a tier and variant', () => {
    expect(hurtAnimKey('wipeout', 1)).toBe('hurt_wipeout_1');
  });

  test('every key animFor can return exists in ANIMATIONS', () => {
    const statuses: PlayerStatus[] = [{ kind: 'free' }, { kind: 'kicking' }, { kind: 'charging' }];
    for (const hit of HITS) {
      statuses.push({ kind: 'lunging', hit }, { kind: 'recovering', hit, landed: true }, { kind: 'recovering', hit, landed: false });
    }
    for (const tier of HURT_TIERS) for (let variant = 0; variant < HURT[tier].variants; variant++) {
      statuses.push({ kind: 'hurt', tier, variant });
    }
    for (const s of statuses) for (const moving of [false, true]) {
      const key = keyFor(s, moving);
      expect(Object.hasOwn(ANIMATIONS, key), key).toBe(true);
    }
    expect(Object.hasOwn(ANIMATIONS, 'getup')).toBe(true);
  });

  test('every frame has a rect and every rect lies inside the cell', () => {
    for (const [key, def] of Object.entries(ANIMATIONS)) {
      expect(def.frames.length, key).toBeGreaterThan(0);
      expect(def.ticksPerFrame, key).toBeGreaterThan(0);
      def.frames.forEach((frame, i) => {
        expect(frame.length, `${key}_${i}`).toBeGreaterThan(0);
        for (const [dx, dy, w, h] of frame) {
          expect(ORIGIN_X + dx, `${key}_${i}`).toBeGreaterThanOrEqual(0);
          expect(ORIGIN_Y + dy, `${key}_${i}`).toBeGreaterThanOrEqual(0);
          expect(ORIGIN_X + dx + w, `${key}_${i}`).toBeLessThanOrEqual(FRAME_W);
          expect(ORIGIN_Y + dy + h, `${key}_${i}`).toBeLessThanOrEqual(FRAME_H);
        }
      });
    }
  });

  test('the brief poses: loops and arcs', () => {
    expect(ANIMATIONS.hurt_wipeout_0.loop).toBe(true);
    expect(ANIMATIONS.hurt_wipeout_1.loop).toBe(true);
    expect(ANIMATIONS.hurt_overTheTop_0.arcHeight).toBe(22);
    expect(ANIMATIONS.hurt_overTheTop_1.arcHeight).toBe(10);
    expect(ANIMATIONS.hurt_overTheTop_2.arcHeight).toBe(30);
    expect(ANIMATIONS.charge.frames.length).toBe(2);
  });

  test('a hurt animation that does not loop reaches its last frame within its own tier down time', () => {
    for (const tier of HURT_TIERS) for (let v = 0; v < HURT[tier].variants; v++) {
      const def = ANIMATIONS[hurtAnimKey(tier, v)];
      if (!def.loop) expect(def.frames.length * def.ticksPerFrame, hurtAnimKey(tier, v)).toBeLessThanOrEqual(HURT[tier].downTicks);
    }
  });

  test('every animation with an arc has between 1 and all of its frames airborne, and a landed frame to rest on', () => {
    for (const [key, def] of Object.entries(ANIMATIONS)) {
      if (def.arcHeight === undefined) { expect(def.airFrames, key).toBeUndefined(); continue; }
      expect(def.airFrames, key).toBeGreaterThanOrEqual(1);
      expect(def.airFrames, key).toBeLessThan(def.frames.length);
    }
    for (const key of ['hurt_overTheTop_0', 'hurt_overTheTop_1', 'hurt_overTheTop_2']) expect(ANIMATIONS[key].airFrames, key).toBeDefined();
  });

  test('getup is two frames that fill the get-up window', () => {
    const def = ANIMATIONS.getup;
    expect(def.loop).toBe(false);
    expect(def.frames.length * def.ticksPerFrame).toBe(GETUP_TICKS);
    expect(GETUP_TICKS).toBe(12);
  });

  test('wipeout_0 rocks: its four frames are all different', () => {
    expect(new Set(ANIMATIONS.hurt_wipeout_0.frames.map(f => JSON.stringify(f))).size).toBe(4);
  });

  test('wipeout_1 shows orbiting stars and the stars move', () => {
    const stars = (i: number) => JSON.stringify(ANIMATIONS.hurt_wipeout_1.frames[i].filter(r => r[4] === 'star'));
    expect(stars(0)).not.toBe('[]');
    expect(stars(0)).not.toBe(stars(1));
  });
});

test('airTicks is airFrames x ticksPerFrame, 0 without air time', () => {
  expect(airTicks(ANIMATIONS.hurt_overTheTop_2)).toBe(60);
  expect(airTicks({ frames: [], ticksPerFrame: 9, loop: false })).toBe(0);
});
