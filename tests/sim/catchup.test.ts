import { expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { applyMovement, updateTurboMeters } from '../../src/sim/movement';
import { RUN_SPEED, TURBO_REFILL_PER_TICK } from '../../src/sim/constants';
import { matchConfig } from '../helpers';

test.each([0, 1] as const)('catch-up applies at a two-goal deficit for team %i', team => {
  for (const gap of [1, 2, 3]) {
    const state = createMatch(matchConfig({ human: [true, false] }));
    state.score[1 - team] = gap;
    state.turbo = [0, 0];
    const player = state.players[team * 5 + 1];
    applyMovement(state, player, { moveX: 1, moveY: 0, pass: false, shoot: false, turbo: false, hitPress: false, hitHeld: false });
    expect(player.vel.x).toBeCloseTo(RUN_SPEED * (gap >= 2 ? 1.06 : 1));
    updateTurboMeters(state);
    expect(state.turbo[team]).toBeCloseTo(TURBO_REFILL_PER_TICK * (gap >= 2 ? 1.5 : 1));
    expect(state.turbo[1 - team]).toBeCloseTo(TURBO_REFILL_PER_TICK);
  }
});
