import { useState } from 'react';
import type { Property, Room } from '../store/propertyStore';
import type { EnergyReport } from '../designer/energy';
import { polygonArea } from '../lib/geometry';
import { months } from './water';
import './ecoVisual.css';

type Card = 'Water' | 'Energy' | 'Materials';
type Props = {
  card: Card;
  property: Property;
  rain: readonly number[];
  quantities: { rooms: Room[]; roof: number };
  energy: EnergyReport;
};
const pictures = {
  Water: '/decks/mep/assets/cover.jpg',
  Energy: '/decks/developers/assets/cover.jpg',
  Materials: '/decks/materials/assets/cover.jpg',
};
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

function RainChart({ rain }: { rain: readonly number[] }) {
  const [month, setMonth] = useState(0);
  const maximum = Math.max(...rain, 1);
  return (
    <div className="eco-graphic">
      <div className="eco-graphic-heading">
        <h3>Monthly rainfall</h3>
        <output aria-live="polite">
          {months[month]} · {format(rain[month])} mm
        </output>
      </div>
      <div className="eco-rain-bars" role="group" aria-label="Choose a rainfall month">
        {rain.map((amount, index) => (
          <button
            type="button"
            key={months[index]}
            aria-label={months[index] + ', ' + amount + ' millimetres'}
            aria-pressed={month === index}
            onClick={() => setMonth(index)}
          >
            <i style={{ height: (amount / maximum) * 100 + '%' }} />
            <span aria-hidden="true">{months[index][0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadChart({ energy }: { energy: EnergyReport }) {
  const active = energy.consumers
    .filter((item) => item.whDay > 0)
    .sort((a, b) => b.whDay - a.whDay)
    .slice(0, 3);
  return (
    <div className="eco-graphic">
      <div className="eco-graphic-heading">
        <h3>Largest daily loads</h3>
      </div>
      {active.length ? (
        <ul className="eco-loads">
          {active.map((item) => (
            <li key={item.instanceId}>
              <span>{item.name}</span>
              <b>{format(item.whDay / 1000)} kWh</b>
              <meter
                aria-label={item.name + ' share of daily use'}
                value={item.whDay}
                min={0}
                max={energy.loadWhDay}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>Place a powered item and set its daily hours to compare loads.</p>
      )}
    </div>
  );
}

function PlanFigure({ rooms }: { rooms: Room[] }) {
  const [selectedId, select] = useState('');
  const selected = rooms.find((r) => r.id === selectedId) ?? rooms[0];
  if (!selected)
    return (
      <div className="eco-graphic">
        <h3>Room footprint</h3>
        <p>Draw a room and its measured footprint will appear here.</p>
      </div>
    );
  const level = selected.levelId ?? 'ground';
  const onLevel = rooms.filter((room) => (room.levelId ?? 'ground') === level);
  const vertices = onLevel.flatMap((r) => r.polygon);
  const xs = vertices.map((v) => v.x),
    ys = vertices.map((v) => v.y);
  const left = Math.min(...xs),
    top = Math.min(...ys),
    width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  const pad = Math.max(width, height, 1) * 0.08;
  return (
    <div className="eco-graphic">
      <div className="eco-graphic-heading">
        <h3>Room footprint</h3>
        <output>{format(polygonArea(selected.polygon))} m²</output>
      </div>
      <svg
        role="img"
        aria-label={'Measured outline of ' + selected.name}
        className="eco-footprint"
        viewBox={[left - pad, top - pad, width + 2 * pad, height + 2 * pad].join(' ')}
      >
        {onLevel.map((r) => (
          <polygon
            key={r.id}
            className={r.id === selected.id ? 'is-chosen' : ''}
            points={r.polygon.map((v) => v.x + ',' + v.y).join(' ')}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <select
        aria-label="Room to inspect"
        value={selected.id}
        onChange={(e) => select(e.target.value)}
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EcoVisual({ card, property, rain, quantities, energy }: Props) {
  const roof = card === 'Water';
  const materials = card === 'Materials';
  const metric = roof
    ? format(quantities.roof) + ' m²'
    : materials
      ? String(quantities.rooms.length)
      : format(energy.totalWp / 1000) + ' kWp';
  const label = roof ? 'Roof catchment' : materials ? 'Measured rooms' : 'Installed solar';
  return (
    <div className="eco-visual">
      <figure className="eco-cover">
        <img src={pictures[card]} alt="" decoding="async" />
        <figcaption>
          <small>{label}</small>
          <strong>{metric}</strong>
          <span>{property.name}</span>
        </figcaption>
      </figure>
      {roof ? (
        <RainChart rain={rain} />
      ) : materials ? (
        <PlanFigure rooms={quantities.rooms} />
      ) : (
        <LoadChart energy={energy} />
      )}
    </div>
  );
}
