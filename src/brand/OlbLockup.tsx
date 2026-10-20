import { ONE_LIVE_BUILD } from './brand';
import { useAppPreferences } from '../i18n/AppPreferences';

/** The One Live Build lockup: house tile + wordmark ("reverse" = paper wordmark for dark grounds). */
export function OlbLockup({
  reverse,
  height = 28,
  className = 'olb-lockup',
}: {
  reverse?: boolean;
  height?: number;
  className?: string;
}) {
  const { theme } = useAppPreferences();
  const [src, ratio] =
    (reverse ?? theme !== 'ivory')
      ? ['/brand/olb/olb-lockup-reverse.svg', 2267 / 512]
      : ['/brand/olb/olb-lockup.svg', 2479 / 512];
  return (
    <img
      className={className}
      src={src}
      alt={ONE_LIVE_BUILD}
      width={Math.round(height * ratio)}
      height={height}
    />
  );
}
