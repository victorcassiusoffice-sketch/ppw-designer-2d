import { ONE_LIVE_BUILD } from './brand';

/** The One Live Build lockup: house tile + wordmark ("reverse" = paper wordmark for dark grounds). */
export function OlbLockup({ reverse = false, height = 28, className = 'olb-lockup' }: { reverse?: boolean; height?: number; className?: string }) {
  const [src, ratio] = reverse ? ['/brand/olb/olb-lockup-reverse.svg', 2267 / 512] : ['/brand/olb/olb-lockup.svg', 2479 / 512];
  return <img className={className} src={src} alt={ONE_LIVE_BUILD} width={Math.round(height * ratio)} height={height} />;
}
