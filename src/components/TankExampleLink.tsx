import { useState } from 'react';
import {
  TANK_EXAMPLE_ID,
  tankExamples,
  tankExampleUrl,
  type TankExampleId,
} from '../designer/tankExample';

export default function TankExampleLink() {
  const [id, setId] = useState<TankExampleId>(TANK_EXAMPLE_ID);
  return (
    <div className="tank-example-launch">
      <select
        aria-label="Example installation"
        value={id}
        onChange={(e) => setId(e.target.value as TankExampleId)}
      >
        {Object.entries(tankExamples).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <a href={tankExampleUrl(id)} target="_blank" rel="noopener">
        Open example ↗
      </a>
    </div>
  );
}
