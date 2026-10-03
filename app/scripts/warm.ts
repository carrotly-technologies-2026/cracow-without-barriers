setInterval(() => {}, 1000);
// Pre-fetch OSM tiles for a bbox into data/snapshot (shipped with the image as an offline fallback).
// usage: node --experimental-strip-types scripts/warm.ts 19.90 50.03 19.99 50.09
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import path from 'node:path';
process.env.CACHE_DIR = path.join(process.cwd(), 'data', 'snapshot');
const { tilesForBbox, loadTile } = await import('../src/lib/osm.ts');
const bb = process.argv.slice(2).map(Number) as [number, number, number, number];
const tiles = tilesForBbox(bb);
console.log(tiles.length, 'tiles');
let ok = 0;
for (const t of tiles) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await loadTile(t.x, t.y);
    if (r.state === 'ok') { ok++; console.log('ok', t.x, t.y, ok + '/' + tiles.length); break; }
    console.log('retry', t.x, t.y); await new Promise((r) => setTimeout(r, 5000));
  }
}
