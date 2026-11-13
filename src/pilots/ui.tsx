import type { Photo, Pilot } from './contract';
import { usePhoto } from './fields';
export function Picture({ p, photo }: { p: Pilot; photo?: Photo }) {
  const url = usePhoto(p, photo);
  return url ? (
    <img src={url} alt={photo?.caption || 'Site observation'} loading="lazy" />
  ) : (
    <div className="pilot-placeholder">{photo ? 'Preparing image…' : 'Add a site photo'}</div>
  );
}
export function Field({
  name,
  label,
  type = 'text',
  maxLength = 160,
  required = true,
  value,
}: {
  name: string;
  label: string;
  type?: string;
  maxLength?: number;
  required?: boolean;
  value?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        maxLength={maxLength}
        required={required}
        defaultValue={value}
      />
    </label>
  );
}
