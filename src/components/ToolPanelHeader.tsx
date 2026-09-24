import type { ReactNode } from 'react';

/** Kept outside the panel's scroll body so Close is always reachable. */
export function ToolPanelHeader({ title, detail, onClose, testId }: {
  title: string; detail?: ReactNode; onClose: () => void; testId: string;
}) {
  return <div className="house-tool-panel-header flex shrink-0 items-center justify-between gap-2 border-b border-ppw-rim px-3 py-2">
    <div className="min-w-0">
      <h2 className="text-[14px] font-semibold text-[#37362f]">{title}</h2>
      {detail && <div className="truncate text-[11px] text-ppw-charcoal">{detail}</div>}
    </div>
    <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()} panel`} data-testid={testId}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ppw-rim px-2.5 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal">
      <span aria-hidden="true" className="text-lg leading-none">×</span> Close
    </button>
  </div>;
}
