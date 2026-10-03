import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
export const dynamic = 'force-dynamic';

/** Curated Old Town venues that have real accessibility tags in OpenStreetMap (shown as pins on the map). */
export async function GET() {
  try {
    const j = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'featured-places.json'), 'utf8'));
    return NextResponse.json({ places: j.places.map((p: any) => ({ osm: p.osm, name: p.name, category: p.category, lat: p.lat, lon: p.lon, wheelchair: p.tags.wheelchair ?? 'unknown' })) });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
