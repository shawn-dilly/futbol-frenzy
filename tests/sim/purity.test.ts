import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { test, expect } from 'vitest';

const FORBIDDEN =
  /from ['"]phaser['"]|from ['"]\.\.\/|Math\.random|Date\.now|performance\.now|\bwindow\b|\bdocument\b|\bprocess\b|\bBuffer\b|node:|\bsetTimeout\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}

test('sim is pure: no engine, DOM, clock, Node globals, timers, or Math.random', () => {
  expect(existsSync('src/sim')).toBe(true);
  const files = sourceFiles('src/sim');
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(FORBIDDEN);
});
