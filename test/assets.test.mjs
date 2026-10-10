import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('le service worker met en cache tous les fichiers JS du jeu', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk('js')) assert.ok(sw.includes(`'${f}'`), `${f} absent de sw.js`);
  for (const m of sw.matchAll(/'((?:js|css|icons)\/[^']+)'/g)) assert.ok(existsSync(m[1]), `${m[1]} introuvable`);
});
