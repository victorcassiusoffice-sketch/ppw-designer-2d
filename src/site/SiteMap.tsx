import { useEffect, useRef, useState } from 'react';
import {
  Map,
  Marker,
  NavigationControl,
  ScaleControl,
  addProtocol,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LonLat } from './types';
setWorkerUrl(workerUrl);
let installed = false;
function installProtocol() {
  if (installed) return;
  installed = true;
  addProtocol('olbmap', async (request, controller) => {
    const url = request.url.replace(/^olbmap:/, 'https:');
    const parsed = new URL(url);
    if (!['tiles.openfreemap.org', 'openfreemap.org'].includes(parsed.hostname))
      throw new Error('Unexpected map resource host.');
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        cache: 'force-cache',
      });
      if (!response.ok) throw new Error(`Map provider returned ${response.status}.`);
      return {
        data:
          request.type === 'json'
            ? await response.json()
            : request.type === 'string'
              ? await response.text()
              : await response.arrayBuffer(),
      };
    } finally {
      clearTimeout(timer);
    }
  });
}
export function MapAttribution() {
  return (
    <div className="site-attribution">
      <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
        OpenFreeMap
      </a>{' '}
      ©{' '}
      <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">
        OpenMapTiles
      </a>{' '}
      Data from{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        OpenStreetMap
      </a>
    </div>
  );
}
export default function SiteMap({
  points,
  closed,
  center,
  onChange,
}: {
  points: LonLat[];
  closed: boolean;
  center: LonLat;
  onChange: (p: LonLat[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    markers = useRef<Marker[]>([]),
    latest = useRef({ points, closed, onChange });
  latest.current = { points, closed, onChange };
  const [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  useEffect(() => {
    installProtocol();
    if (!host.current) return;
    let instance: Map;
    try {
      instance = new Map({
        container: host.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center,
        zoom: 17,
        attributionControl: false,
        transformRequest: (url) => ({
          url: url.startsWith('https://') ? url.replace(/^https:/, 'olbmap:') : url,
        }),
      });
    } catch {
      setError(
        'Map graphics are unavailable. Enter longitude/latitude corners or a survey traverse below.',
      );
      return;
    }
    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    instance.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    instance.on('load', () => {
      instance.addSource('site-outline', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: 'site-fill',
        type: 'fill',
        source: 'site-outline',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#127063', 'fill-opacity': 0.2 },
      });
      instance.addLayer({
        id: 'site-edge',
        type: 'line',
        source: 'site-outline',
        paint: { 'line-color': '#126b60', 'line-width': 3 },
      });
      setReady(true);
    });
    instance.on('error', () =>
      setError(
        'Some map data could not load. Your boundary is retained; use coordinate or survey entry if needed.',
      ),
    );
    instance.on('click', (e) => {
      if (!latest.current.closed && latest.current.points.length < 200)
        latest.current.onChange([...latest.current.points, [e.lngLat.lng, e.lngLat.lat]]);
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
    };
    // Map is created once; data/centre changes are handled independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    map.current?.flyTo({ center, zoom: 17, duration: 400 });
  }, [center]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const source = instance.getSource('site-outline') as GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features:
        points.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry:
                  closed && points.length >= 3
                    ? { type: 'Polygon', coordinates: [[...points, points[0]]] }
                    : { type: 'LineString', coordinates: points },
              },
            ]
          : [],
    });
    markers.current.forEach((m) => m.remove());
    markers.current = points.map((p, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'site-corner';
      el.textContent = String(i + 1);
      el.setAttribute('aria-label', `Corner ${i + 1}; drag to edit`);
      const marker = new Marker({ element: el, draggable: true }).setLngLat(p).addTo(instance);
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        latest.current.onChange(
          latest.current.points.map((q, j) => (j === i ? [pos.lng, pos.lat] : q)),
        );
      });
      return marker;
    });
  }, [points, closed, ready]);
  return (
    <div className="site-map-shell">
      <div
        ref={host}
        className="site-map"
        aria-label="Map. Tap corners to draw the plot; drag numbered corners to edit."
      />
      {error && (
        <p role="status" className="site-map-error">
          {error}
        </p>
      )}
      <MapAttribution />
    </div>
  );
}
