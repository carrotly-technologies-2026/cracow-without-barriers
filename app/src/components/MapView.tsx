'use client';
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { sampleLine } from '@/lib/geo';
import type { Issue, RouteResult } from '@/lib/types';
import { SEV_STYLE } from './icons';

export interface MapFeature { kind: string; label: string; lat: number; lon: number; prov: any; tags: Record<string, string>; id?: string; report?: any }
export interface Layers { bench: boolean; toilets: boolean; steps: boolean; kerb: boolean; reports: boolean }
interface Props {
  center: [number, number]; zoom: number;
  routes: RouteResult[]; selectedId: string | null; selectedIssueId: string | null;
  onSelectIssue: (id: string) => void; onPickRoute: (id: string) => void;
  from: { lat: number; lon: number } | null; to: { lat: number; lon: number } | null;
  features: MapFeature[]; layers: Layers; onFeature: (f: MapFeature) => void;
  pickMode: boolean; onPick: (lat: number, lon: number) => void;
  onViewport: (bbox: [number, number, number, number], zoom: number) => void;
  samplePlaces: { id: string; name: string; lat: number; lon: number }[]; onSamplePlace: (id: string) => void;
  featured: { osm: string; name: string; label: string; wheelchair: string; lat: number; lon: number }[]; onFeaturedPlace: (osm: string) => void;
  fitKey: number; flyTo: { lat: number; lon: number; k: number } | null; label: string;
}

const KIND_COLOR: Record<string, string> = { bench: '#0f766e', toilets: '#1d4ed8', steps: '#b91c1c', kerb: '#7c3aed', elevator: '#047857', report: '#c2410c' };
// Next's bundler can't resolve maplibre's module worker; serve it (and its shared chunk) from /public.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const OSM_STYLE: any = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.95 } }],
};
const EMPTY = { type: 'FeatureCollection', features: [] } as any;

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const markers = useRef<Marker[]>([]);
  const props = useRef(p); props.current = p;

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: OSM_STYLE, center: p.center, zoom: p.zoom, attributionControl: { compact: true } });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
    m.on('load', () => {
      m.addSource('routes', { type: 'geojson', data: EMPTY });
      m.addSource('segs', { type: 'geojson', data: EMPTY });
      m.addSource('feats', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'routes-case', type: 'line', source: 'routes', paint: { 'line-color': '#fff', 'line-width': ['case', ['get', 'sel'], 11, 7] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      m.addLayer({ id: 'routes-line', type: 'line', source: 'routes', paint: { 'line-color': ['case', ['get', 'sel'], '#0f766e', '#7a8b88'], 'line-width': ['case', ['get', 'sel'], 6, 4], 'line-opacity': ['case', ['get', 'sel'], 1, 0.8] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      m.addLayer({ id: 'segs', type: 'line', source: 'segs', paint: { 'line-color': ['get', 'color'], 'line-width': 6 }, layout: { 'line-cap': 'butt' } });
      m.addLayer({ id: 'feats', type: 'circle', source: 'feats', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 5, 18, 9], 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      m.on('click', 'routes-line', (e) => { const id = e.features?.[0]?.properties?.id; if (id) props.current.onPickRoute(id); });
      m.on('click', 'feats', (e) => { const i = e.features?.[0]?.properties?.i; if (i != null) props.current.onFeature(featList.current[i]); });
      m.on('mouseenter', 'feats', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'feats', () => (m.getCanvas().style.cursor = ''));
      ready.current = true;
      sync();
      report();
    });
    m.on('click', (e) => { if (props.current.pickMode) props.current.onPick(e.lngLat.lat, e.lngLat.lng); });
    m.on('moveend', report);
    function report() { const b = m.getBounds(); props.current.onViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], m.getZoom()); }
    return () => { m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line
  }, []);

  const featList = useRef<MapFeature[]>([]);

  function sync() {
    const m = map.current; if (!m || !ready.current) return;
    const { routes, selectedId, features, layers } = props.current;
    (m.getSource('routes') as any).setData({ type: 'FeatureCollection', features: [...routes].sort((a) => (a.id === selectedId ? 1 : -1)).map((r) => ({ type: 'Feature', properties: { id: r.id, sel: r.id === selectedId }, geometry: { type: 'LineString', coordinates: r.geometry } })) });
    const sel = routes.find((r) => r.id === selectedId);
    const segs: any[] = [];
    if (sel) {
      const line = sampleLine(sel.geometry, 6);
      for (const i of sel.issues) {
        if (!i.length || !['blocker', 'warning', 'unknown'].includes(i.severity) || i.type === 'nodata') continue;
        const pts = line.filter((s) => s.at >= i.at && s.at <= i.at + i.length!).map((s) => [s.pt.lon, s.pt.lat]);
        if (pts.length > 1) segs.push({ type: 'Feature', properties: { color: SEV_STYLE[i.severity].hex }, geometry: { type: 'LineString', coordinates: pts } });
      }
    }
    (m.getSource('segs') as any).setData({ type: 'FeatureCollection', features: segs });
    const list = features.filter((f) => f.kind === 'report' ? layers.reports : f.kind === 'elevator' ? true : (layers as any)[f.kind === 'bench' ? 'bench' : f.kind]);
    featList.current = list;
    (m.getSource('feats') as any).setData({ type: 'FeatureCollection', features: list.map((f, i) => ({ type: 'Feature', properties: { i, color: KIND_COLOR[f.kind] ?? '#333' }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } })) });
  }

  function syncMarkers() {
    const m = map.current; if (!m) return;
    markers.current.forEach((x) => x.remove()); markers.current = [];
    const { routes, selectedId, selectedIssueId, from, to, samplePlaces, featured } = props.current;
    const add = (node: HTMLElement, lat: number, lon: number, anchor: any = 'center', offset?: [number, number]) => markers.current.push(new maplibregl.Marker({ element: node, anchor, offset }).setLngLat([lon, lat]).addTo(m));
    const sel = routes.find((r) => r.id === selectedId);
    const placed: { lat: number; lon: number }[] = [];
    sel?.issues.filter((i) => i.severity !== 'info' && i.type !== 'nodata' && i.type !== 'surface').forEach((i: Issue) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'issue-marker';
      b.style.background = SEV_STYLE[i.severity].hex;
      b.dataset.sel = String(i.id === selectedIssueId);
      b.textContent = i.severity === 'blocker' ? '!' : i.severity === 'unknown' ? '?' : i.severity === 'good' ? '✓' : '▲';
      b.setAttribute('aria-label', i.title);
      b.onclick = (e) => { e.stopPropagation(); props.current.onSelectIssue(i.id); };
      add(b, i.pos.lat, i.pos.lon);
    });
        const pin = (color: string, text: string) => { const w = document.createElement('div'); w.innerHTML = `<div class="pin" style="background:${color}"></div><span style="position:absolute;left:0;top:5px;width:34px;text-align:center;color:#fff;font-weight:700;font-size:13px">${text}</span>`; w.style.cssText = 'position:relative;width:34px;height:34px'; w.setAttribute('aria-hidden', 'true'); return w; };
    if (from) add(pin('#0f766e', 'A'), from.lat, from.lon, 'bottom-left');
    if (to) add(pin('#b91c1c', 'B'), to.lat, to.lon, 'bottom-left');
    const FSTYLE: Record<string, [string, string]> = { yes: ['#047857', '✓'], designated: ['#047857', '✓'], limited: ['#b45309', '~'], no: ['#b91c1c', '✕'] };
    featured.forEach((f) => {
      const [bg, sym] = FSTYLE[f.wheelchair] ?? ['#52525b', '?'];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'issue-marker';
      b.style.cssText += `;background:${bg};width:28px;height:28px;font-size:14px`;
      b.textContent = sym; b.title = f.label; b.setAttribute('aria-label', f.label);
      b.onclick = (e) => { e.stopPropagation(); props.current.onFeaturedPlace(f.osm); };
      add(b, f.lat, f.lon);
    });
    samplePlaces.forEach((s) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'issue-marker'; b.style.cssText += ';background:#7c2d12;border-radius:6px;width:28px;height:28px';
      b.textContent = 'D'; b.title = s.name; b.setAttribute('aria-label', s.name);
      b.onclick = (e) => { e.stopPropagation(); props.current.onSamplePlace(s.id); };
      add(b, s.lat, s.lon);
    });
  }

  useEffect(() => { sync(); syncMarkers(); /* eslint-disable-next-line */ }, [p.routes, p.selectedId, p.selectedIssueId, p.features, p.layers, p.from, p.to, p.samplePlaces, p.featured]);

  useEffect(() => { if (map.current) map.current.getCanvas().style.cursor = p.pickMode ? 'crosshair' : ''; }, [p.pickMode]);

  useEffect(() => {
    const m = map.current; const sel = props.current.routes.find((r) => r.id === props.current.selectedId);
    if (!m || !sel) return;
    const b = new maplibregl.LngLatBounds();
    sel.geometry.forEach((c) => b.extend(c as [number, number]));
    const wide = window.innerWidth >= 1024;
    m.fitBounds(b, { padding: wide ? { top: 80, bottom: 80, left: 480, right: 60 } : 50, duration: 700, maxZoom: 17 });
  }, [p.fitKey]);

  useEffect(() => { if (p.flyTo && map.current) map.current.flyTo({ center: [p.flyTo.lon, p.flyTo.lat], zoom: Math.max(map.current.getZoom(), 17), duration: 600 }); }, [p.flyTo]);

  return <div ref={el} role="application" aria-label={p.label} className="h-full w-full" />;
}
