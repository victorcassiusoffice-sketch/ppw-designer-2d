import { useEffect, useState } from 'react';
import { useAppPreferences } from '../i18n/AppPreferences';
export function CityNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 0.1,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => boolean | void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { t, tx } = useAppPreferences();
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);
  return (
    <label className="city-field">
      <span>{tx(label)}</span>
      <input
        aria-label={tx(label)}
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={value == null ? t("Unconfirmed") : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft.trim() && Number.isFinite(n) && n >= min && n <= max) {
            if (n !== value && onChange(n) === false) setDraft(value == null ? '' : String(value));
          } else setDraft(value == null ? '' : String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}