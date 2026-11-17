import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/sim';
import { outgoingAt } from '../../src/game/outgoing';

describe('outgoing actor', () => {
  it('moves from the impact with decaying knockback without mutating the snapshot', () => {
    const p = createMatch({ seed: 1, halfSeconds: 60, human: [false, false], level: ['rookie', 'rookie'] }).players[1];
    p.pos = { x: 100, y: 62 }; p.knock = { x: 60, y: 0 };
    const before = structuredClone(p);
    expect(outgoingAt(p, 2).pos).toEqual({ x: 101.9, y: 62 });
    expect(p).toEqual(before);
  });
});
