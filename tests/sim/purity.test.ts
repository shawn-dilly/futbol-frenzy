import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { test, expect } from 'vitest';
test('sim is pure: no engine, DOM, clock, or Math.random', () => {
  expect(existsSync('src/sim')).toBe(true);
  for (const f of readdirSync('src/sim')) {
    const src = readFileSync(`src/sim/${f}`, 'utf8');
    expect(src, f).not.toMatch(/from ['"]phaser['"]|from ['"]\.\.\/|Math\.random|Date\.now|performance\.now|\bwindow\b|\bdocument\b/);
  }
});
