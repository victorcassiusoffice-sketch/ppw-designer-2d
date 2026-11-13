import { useState, useRef } from 'react';
import { parseProgramme, replacePins, usePins } from './programme';
export default function ProgrammePanel({ planId }: { planId: string }) {
  const pins = usePins(planId),
    [message, setMessage] = useState(''),
    version = useRef(0);
  const xs = pins.map((p) => p.lon),
    ys = pins.map((p) => p.lat),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const lonScale = Math.max(0.001, Math.cos((((minY + maxY) / 2) * Math.PI) / 180)),
    scale = Math.min(
      268 / Math.max(0.01, (maxX - minX) * lonScale),
      128 / Math.max(0.01, maxY - minY),
    );
  return (
    <div className="eco-programme">
      <h3>Private programme</h3>
      <p>Load a JSON file from your device. Pins stay in this tab and clear on refresh.</p>
      <label className="eco-file">
        Load programme file
        <input
          aria-label="Load programme file"
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (!file) return;
            const task = ++version.current;
            try {
              if (file.size > 512000) throw Error('Choose a JSON file under 500 KB.');
              const next = parseProgramme(await file.text());
              if (version.current !== task) return;
              replacePins(planId, next);
              setMessage(next.length + ' places loaded.');
            } catch (err) {
              if (version.current === task)
                setMessage(err instanceof Error ? err.message : 'Could not read this file.');
            }
          }}
        />
      </label>
      {pins.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => {
              version.current++;
              replacePins(planId, []);
              setMessage('Programme cleared.');
            }}
          >
            Clear programme
          </button>
          <svg
            viewBox="0 0 320 180"
            role="img"
            aria-label="Private programme coordinate map, north up"
          >
            <rect width="320" height="180" fill="#e8f0e8" />
            <path d="M16 90H304M160 12V162" stroke="#9db7aa" strokeDasharray="3 4" />
            <text x="8" y="16" fontSize="11">
              N ↑
            </text>
            {pins.map((p, i) => (
              <g
                key={p.id}
                transform={
                  'translate(' +
                  (160 + (p.lon - (maxX + minX) / 2) * lonScale * scale) +
                  ' ' +
                  (90 - (p.lat - (minY + maxY) / 2) * scale) +
                  ')'
                }
              >
                <title>{p.name}</title>
                <circle r="7" fill="#275640" />
                <text x="9" y="4" fontSize="12">
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
          <ol>
            {pins.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> · {p.kind} · {p.lanes.join(', ')} · {p.state}
              </li>
            ))}
          </ol>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
