import { describe, expect, test } from 'vitest';
import { ANIMATIONS, hurtAnimKey } from '../../src/content/animations';
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

describe('animation data', () => {
  test('hurtAnimKey names a tier and variant', () => {
    expect(hurtAnimKey('wipeout', 1)).toBe('hurt_wipeout_1');
  });

  test('every key animFor can return exists in ANIMATIONS', () => {
    const statuses: PlayerStatus[] = [{ kind: 'free' }, { kind: 'kicking' }, { kind: 'charging' }];
    for (const hit of HITS) {
      statuses.push({ kind: 'lunging', hit }, { kind: 'recovering', hit, landed: true }, { kind: 'recovering', hit, landed: false });
    }
    for (const tier of HURT_TIERS) for (let variant = 0; variant < HURT[tier].variants; variant++) statuses.push({ kind: 'hurt', tier, variant });
    for (const s of statuses) for (const moving of [false, true]) {
      const key = keyFor(s, moving);
      expect(Object.hasOwn(ANIMATIONS, key), key).toBe(true);
    }
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

  test('a hurt animation that does not loop shows its lying frame within the shortest down time', () => {
    for (const tier of HURT_TIERS) for (let v = 0; v < HURT[tier].variants; v++) {
      const def = ANIMATIONS[hurtAnimKey(tier, v)];
      if (!def.loop) expect(def.frames.length * def.ticksPerFrame, hurtAnimKey(tier, v)).toBeLessThanOrEqual(HURT[tier].downTicks);
    }
  });

  test('wipeout_1 shows orbiting stars and the stars move', () => {
    const stars = (i: number) => JSON.stringify(ANIMATIONS.hurt_wipeout_1.frames[i].filter(r => r[4] === 'star'));
    expect(stars(0)).not.toBe('[]');
    expect(stars(0)).not.toBe(stars(1));
  });
});
