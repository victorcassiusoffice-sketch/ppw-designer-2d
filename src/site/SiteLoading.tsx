import { useRef } from 'react';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';

/** Owns focus both while the entry chunk downloads and while access is checked. */
export default function SiteLoading({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useWorkspaceFocus(host, onClose, { fallbackFocusSelector: '[aria-label="Site from the map"]' });
  return (
    <div
      ref={host}
      className="site-loading"
      // The entry's stylesheet may still be downloading with its JavaScript.
      style={{
        position: 'fixed',
        inset: '20%',
        zIndex: 10050,
        background: 'white',
        padding: 24,
        borderRadius: 12,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Opening Site"
    >
      <span role="status">{message}</span>{' '}
      <button style={{ minHeight: 44, padding: '8px 12px' }} onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
