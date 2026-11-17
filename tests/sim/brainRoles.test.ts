import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { hurtPlayer } from '../../src/sim/hurt';
import { assignRoles, markedOpponent } from '../../src/sim/brainRoles';
import type { MatchState } from '../../src/sim/types';
import { matchConfig, runTicks } from '../helpers';

/** Both sides computer, in play. Team 1 (ids 5..9, defending x = 480): keeper 5, outfield 6..9. Team 0 outfield 1..4. */
function scene(human: [boolean, boolean] = [false, false]): MatchState {
  const s = createMatch(matchConfig({ human }));
  runTicks(s, 60);
  const at = (id: number, x: number, y: number) => { s.players[id].pos = { x, y }; };
  at(4, 300, 62); at(1, 350, 30); at(2, 200, 100); at(3, 420, 90);
  at(6, 320, 62); at(7, 340, 20); at(8, 400, 100); at(9, 450, 62);
  s.ball.pos = { x: 300, y: 62 }; s.ball.owner = null; s.ball.passTarget = null;
  return s;
}
const knockDown = (s: MatchState, id: number) => hurtPlayer(s, s.players[id], 'knockdown', { x: 1, y: 0 }, 30);

describe('assignRoles', () => {
  test('the other team has the ball: presser, cover, markers', () => {
    const s = scene(); s.ball.owner = 4;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'presser', 'marker', 'cover', 'marker']);
  });
  test('a loose ball: the nearest outfielder chases, the rest support', () => {
    expect(assignRoles(scene(), 1)).toEqual(['keeper', 'chaser', 'support', 'support', 'support']);
  });
  test('a loose ball that is a pass to a teammate: he receives, nobody chases', () => {
    const s = scene(); s.ball.passTarget = 8;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'support', 'receiver', 'support']);
  });
  test('a pass to the other team does not make a receiver of this team', () => {
    const s = scene(); s.ball.passTarget = 4;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'chaser', 'support', 'support', 'support']);
  });
  test('own ball: the owner carries, the rest support', () => {
    const s = scene(); s.ball.owner = 7;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'carrier', 'support', 'support']);
    expect(assignRoles(s, 0)).toEqual(['keeper', 'presser', 'cover', 'marker', 'marker']);
  });
  test('a keeper with the ball stays keeper, the rest support', () => {
    const s = scene(); s.ball.owner = 5;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'support', 'support', 'support']);
  });
  test('downed players get no pressing or chasing role', () => {
    const s = scene(); s.ball.owner = 4; knockDown(s, 6);
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'presser', 'cover', 'marker']);
    const loose = scene(); knockDown(loose, 6);
    expect(assignRoles(loose, 1)).toEqual(['keeper', 'support', 'chaser', 'support', 'support']);
  });
  test('only when every outfielder is down does a downed player take a role', () => {
    const s = scene(); s.ball.owner = 4;
    for (const id of [6, 7, 8, 9]) knockDown(s, id);
    expect(assignRoles(s, 1)).toEqual(['keeper', 'presser', 'marker', 'cover', 'marker']);
  });
  test('a loose ball on a human team: no brain teammate chases it, but one still receives a pass', () => {
    const s = scene([false, true]); s.controlled[1] = 6;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'support', 'support', 'support']);
    s.ball.passTarget = 8;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'support', 'receiver', 'support']);
  });
  test('a human team: the controlled player is skipped, the others take the roles in order', () => {
    const s = scene([false, true]); s.ball.owner = 4; s.controlled[1] = 6;
    expect(assignRoles(s, 1)).toEqual(['keeper', 'support', 'presser', 'cover', 'marker']);
  });
});
describe('markedOpponent', () => {
  test('each marker takes the nearest opponent nobody else has, ascending id, never the carrier', () => {
    const s = scene(); s.ball.owner = 4;
    s.players[9].pos = { x: 345, y: 40 }; // both markers are now nearest to player 1
    expect(assignRoles(s, 1)).toEqual(['keeper', 'presser', 'marker', 'cover', 'marker']);
    expect(markedOpponent(s, s.players[7])?.id).toBe(1);
    expect(markedOpponent(s, s.players[9])?.id).toBe(3);
  });
  test('a player who is not a marker marks nobody', () => {
    const s = scene(); s.ball.owner = 4;
    expect(markedOpponent(s, s.players[6])).toBeNull();
  });
});
