import { expect, it } from 'vitest';
import { resultScreen } from '../../src/game/resultScreen';

it('maps each settled Cup state to its available result action', () => {
  expect(resultScreen(null)).toEqual({ title: 'FULL TIME', action: 'NEW MATCH' });
  expect(resultScreen('active').action).toBe('NEXT ROUND');
  expect(resultScreen('ended')).toEqual({ title: 'CUP ELIMINATION', action: 'RETRY' });
  expect(resultScreen('completed')).toEqual({ title: 'CUP CHAMPIONS', action: null });
});
