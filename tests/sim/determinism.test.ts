import { expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { runTicks } from '../helpers';

const cpu = { seed: 7, halfSeconds: 120, human: [false, false] as [boolean, boolean] };

test('two CPU-v-CPU matches with the same seed are identical; a full match finishes', () => {
  const a = createMatch({ ...cpu, halfSeconds: 30 }), b = createMatch({ ...cpu, halfSeconds: 30 });
  runTicks(a, 12000); runTicks(b, 12000);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(a.phase).toBe('fulltime');
  for (const p of a.players) { expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true); }
});
