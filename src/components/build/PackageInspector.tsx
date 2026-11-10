import { useEffect, useState } from 'react';
import { renderSVG } from '../../designer/link/qr';
import type { Property } from '../../store/propertyStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useLinkStore } from '../../store/linkStore';
import { packagesFromProperty } from '../../designer/link/packages';
import { projectFingerprint } from '../../designer/projectHub';
import { nextRevision, needsDecision, type LinkPackage } from '../../designer/link/exchange';
import {
  buildWorkPackage,
  type PlanView,
  type WorkPackageInput,
} from '../../designer/link/planView';
import { pinExists } from '../../designer/link/tradeWork';
import { useTradeFlow } from './tradeFlow';
import { packLink } from '../../designer/link/vendor/tradefolder/lib/jobPack/protocol';
import { DraftFields, Sheet } from './BuildControls';
import { PackageDecisions } from './PackageDecisions';
import {
  TRADE_FOLDER,
  downloadFile,
  opaqueId,
  resolveItem,
  roomPhoto,
  workFileName,
} from './transfer';

function PlanPicture({ view }: { view: PlanView }) {
  const [selected, setSelected] = useState(view.levels[0]?.id ?? '');
  const level = view.levels.find((l) => l.id === selected) ?? view.levels[0];
  const rooms = view.rooms.filter((r) => r.levelId === level?.id),
    walls = view.walls.filter((w) => w.levelId === level?.id),
    runs = view.runs.filter((r) => r.levelId === level?.id),
    items = view.items.filter((i) => i.levelId === level?.id);
  const points = [
    ...rooms.flatMap((r) => r.polygon),
    ...walls.flatMap((w) => [w.a, w.b]),
    ...runs.flatMap((r) => r.points),
    ...items.flatMap((i) => [
      [i.center[0] - i.sizeM[0] / 2, i.center[1] - i.sizeM[1] / 2],
      [i.center[0] + i.sizeM[0] / 2, i.center[1] + i.sizeM[1] / 2],
    ]),
  ];
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    width = Math.max(...xs) - minX,
    height = Math.max(...ys) - minY;
  const marked = (kind: string, id: string) => view.highlights.includes('olb:' + kind + ':' + id);
  return (
    <figure className="bd-plan">
      <figcaption>Measured plan · revision {view.plan.revision}</figcaption>
      {view.levels.length > 1 && (
        <label>
          Drawing level
          <select value={level?.id} onChange={(e) => setSelected(e.target.value)}>
            {view.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {points.length ? (
        <svg
          data-testid="build-plan-picture"
          role="img"
          aria-label={'Plan of ' + level?.label + '; x right, y down'}
          viewBox={[minX - 0.5, minY - 0.5, Math.max(1, width + 1), Math.max(1, height + 1)].join(
            ' ',
          )}
        >
          {rooms.map((r) => (
            <polygon
              key={r.id}
              points={r.polygon.map((p) => p.join(',')).join(' ')}
              fill={marked('room', r.id) ? '#cfdfce' : '#eeece4'}
              stroke="#7b8983"
              strokeWidth=".04"
            />
          ))}
          {walls.map((w) => (
            <line
              key={w.id}
              x1={w.a[0]}
              y1={w.a[1]}
              x2={w.b[0]}
              y2={w.b[1]}
              stroke={marked('wall', w.id) ? '#318577' : '#596b61'}
              strokeWidth={w.thicknessM}
            />
          ))}
          {view.openings.map((o) => {
            const w = walls.find((x) => x.id === o.wallId);
            if (!w) return null;
            const dx = w.b[0] - w.a[0],
              dy = w.b[1] - w.a[1],
              len = Math.hypot(dx, dy);
            if (!len) return null;
            return (
              <line
                key={o.id}
                x1={w.a[0] + (dx * o.offsetM) / len}
                y1={w.a[1] + (dy * o.offsetM) / len}
                x2={w.a[0] + (dx * (o.offsetM + o.widthM)) / len}
                y2={w.a[1] + (dy * (o.offsetM + o.widthM)) / len}
                stroke="#fff"
                strokeWidth={w.thicknessM + 0.01}
              />
            );
          })}
          {items.map((i) => (
            <rect
              key={i.id}
              x={i.center[0] - i.sizeM[0] / 2}
              y={i.center[1] - i.sizeM[1] / 2}
              width={i.sizeM[0]}
              height={i.sizeM[1]}
              transform={'rotate(' + i.rotationDeg + ' ' + i.center[0] + ' ' + i.center[1] + ')'}
              fill={marked('item', i.id) ? '#2e8278' : '#ad9e84'}
            />
          ))}
          {runs.map((r) => (
            <polyline
              key={r.id}
              points={r.points.map((p) => p[0] + ',' + p[1]).join(' ')}
              fill="none"
              stroke={marked('run', r.id) ? '#147879' : '#949e99'}
              strokeWidth=".09"
            />
          ))}
        </svg>
      ) : (
        <p>No drawing geometry on this level.</p>
      )}
      <small>Coordination only · check dimensions on site.</small>
    </figure>
  );
}
export function PackageInspector({
  row,
  property,
  fingerprint,
  hide,
  onClose,
}: {
  row: LinkPackage;
  property: Property;
  fingerprint?: string;
  hide: boolean;
  onClose: () => void;
}) {
  const tradeMode = useTradeFlow((s) => s.role !== 'owner');
  const named = !!(row.job || row.claim || tradeMode);
  const [draft, setDraft] = useState(() => structuredClone(row.draft)),
    [includePhoto, setPhoto] = useState(true),
    [operator, setOperator] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(''),
    [linkNote, setLinkNote] = useState(''),
    [qr, setQr] = useState(false);
  const latest = row.sends[row.sends.length - 1],
    changed = needsDecision(row, fingerprint).changed,
    active = draft.projectId === property.id;
  const [reviewedFp, setReviewed] = useState('');
  useEffect(() => {
    let alive = true;
    setLink('');
    setQr(false);
    setLinkNote('');
    if (latest)
      void packLink(latest.request, TRADE_FOLDER)
        .then((url) => {
          if (alive) {
            setLink(url ?? '');
            if (!url)
              setLinkNote('This request does not fit a short link. Share the work file instead.');
          }
        })
        .catch(() => {
          if (alive) setLinkNote('A checked link is unavailable. Use the work file instead.');
        });
    return () => {
      alive = false;
    };
  }, [latest?.request.sha256]); // eslint-disable-line react-hooks/exhaustive-deps
  function refresh() {
    if (row.job) {
      if (!pinExists(property, row.job.pin)) {
        setError(
          'The pinned part is no longer in this plan. Edit the job and choose a new location.',
        );
        return;
      }
      setReviewed(fingerprint ?? '');
      setMessage(
        'Location checked against this plan. Review the job scope and quantities before sharing.',
      );
      return;
    }
    let source;
    try {
      source = packagesFromProperty(property).find((p) => p.key === draft.sourceKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot refresh these estimates.');
      return;
    }
    if (source) {
      setDraft({ ...draft, quantities: source.quantities, levelIds: source.levelIds });
      setMessage('Quantities refreshed. Review them before sending.');
    } else {
      setDraft({ ...draft, quantities: [] });
      setMessage(
        'This measured group no longer exists. Review the scope and add only lines that still apply.',
      );
    }
    setReviewed(fingerprint ?? '');
  }
  async function submit(send: boolean) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (named && !operator.trim()) throw new Error('Enter your name to record this change.');
      if (draft.preferredDates[1] && draft.preferredDates[1] < draft.preferredDates[0])
        throw new Error('Preferred finish must be on or after the start.');
      if (
        draft.quantities.some(
          (q) =>
            !Number.isFinite(q.qty) || Math.abs(q.qty - Math.round(q.qty * 1000) / 1000) > 1e-9,
        )
      )
        throw new Error('Enter quantities with up to three decimal places.');
      if (!send) {
        await useLinkStore.getState().saveDraft(draft, undefined, operator.trim() || undefined);
        setMessage('Draft saved.');
        return;
      }
      if (!active) throw new Error('Open this package’s project to send its current plan.');
      if (!draft.quantities.length)
        throw new Error('Add at least one reviewed quantity before sending.');
      const fp = await projectFingerprint(property);
      if (changed && reviewedFp !== fp)
        throw new Error('Review the latest measured lines before sending an update.');
      if (row.job && !pinExists(property, row.job.pin))
        throw new Error(
          'The pinned part is no longer in this plan. Edit the job and pin it again.',
        );
      const photo = includePhoto
        ? (row.job?.photo ?? (await roomPhoto(property, draft.levelIds)))
        : undefined;
      const ledger = useLinkStore.getState();
      const input: WorkPackageInput = {
        property,
        requestId: opaqueId(),
        viewId: opaqueId(),
        now: new Date().toISOString(),
        project: { id: draft.projectId, label: draft.projectLabel },
        site: { id: draft.siteId, label: draft.siteLabel, kind: draft.siteKind },
        package: { id: draft.id, title: draft.title, trade: draft.trade },
        phase: draft.phase,
        companyName: draft.company,
        requesterType: draft.requester,
        description: draft.scope,
        currency: draft.currency,
        preferredDates: draft.preferredDates,
        quantities: draft.quantities,
        revision: nextRevision(ledger.packages, draft.projectId, fp),
        levelIds: draft.levelIds,
        resolveItem,
        photo,
        jobPin: row.job?.pin,
      };
      // The optional thumbnail must also fit alongside the request's lines.
      // Keep the complete plan extract if only the combined file is too large.
      let work;
      try {
        work = await buildWorkPackage(input);
      } catch (cause) {
        if (!photo || !(cause instanceof Error) || !/too large/i.test(cause.message)) throw cause;
        work = await buildWorkPackage({ ...input, photo: undefined });
      }
      if (property !== usePropertyStore.getState().property)
        throw new Error('The plan changed while preparing this file. Review it again.');
      await ledger.saveDraft(draft, undefined, operator.trim() || undefined);
      await ledger.send(work, undefined, operator.trim() || undefined);
      setMessage(
        'Work file ready. Download it and share it with your trade.' +
          (includePhoto && !work.request.photos?.length ? ' No picture fit the file.' : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this package.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title={row.draft.title} onClose={onClose} wide>
      <p className="bd-meta">
        {row.draft.projectLabel} / {row.draft.siteLabel} / {row.draft.phase}
      </p>
      {changed && (
        <div className="bd-notice">
          <strong>Plan changed</strong>
          <p>The last request stays in history. Refresh the measured lines and review any edits.</p>
          <button onClick={refresh}>Review latest measured lines</button>
        </div>
      )}
      <details open={!latest || undefined}>
        <summary>Review scope and quantities ({draft.quantities.length})</summary>
        <DraftFields draft={draft} onChange={setDraft} hide={hide} />
      </details>
      {named && (
        <label>
          Recorded by
          <input
            maxLength={120}
            autoComplete="off"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
          />
        </label>
      )}
      <label className="bd-check">
        <input
          type="checkbox"
          checked={includePhoto}
          onChange={(e) => setPhoto(e.target.checked)}
        />
        {row.job?.photo
          ? 'Include the job photo in this work file'
          : 'Include a room sketch if it fits the file'}
      </label>
      <div className="bd-actions">
        <button onClick={() => void submit(false)} disabled={busy}>
          Save draft
        </button>
        <button
          className="bd-primary"
          disabled={!active || busy || !fingerprint || !!(changed && reviewedFp !== fingerprint)}
          onClick={() => void submit(true)}
        >
          {latest ? 'Send update' : 'Build work file'}
        </button>
      </div>
      {!active && <p>Open the original project to send an updated design.</p>}
      {error && (
        <p role="alert" className="bd-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="bd-notice">
          {message}
        </p>
      )}
      {latest && (
        <section>
          <h3>Share with the trade</h3>
          <p>The file includes the design. A short link carries the request only.</p>
          <div className="bd-actions">
            <button
              onClick={() =>
                downloadFile(workFileName(latest.request.title), JSON.stringify(latest.work))
              }
            >
              Download work file
            </button>
            {link && (
              <>
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(link)
                      .then(() => setMessage('Request link copied.'))
                      .catch(() => setError('Could not copy. Download the work file instead.'))
                  }
                >
                  Copy link
                </button>
                <button aria-expanded={qr} onClick={() => setQr(!qr)}>
                  QR code
                </button>
              </>
            )}
            <a href={link || TRADE_FOLDER} rel="noopener noreferrer" target="_blank">
              Open Trade Folder ↗
            </a>
          </div>
          {linkNote && <p>{linkNote}</p>}
          {qr && link && (
            <img
              className="bd-qr"
              alt="Trade Folder request QR code"
              src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderSVG(link))}
            />
          )}
          {latest.work.planView && <PlanPicture view={latest.work.planView} />}
        </section>
      )}
      <PackageDecisions row={row} hide={hide} />
      <h3>Package history</h3>
      <ol className="bd-history">
        {row.history
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={i}>
              <strong>{e.label}</strong>
              <small>
                {new Date(e.at).toLocaleString()}
                {e.by ? ' · ' + e.by.name + ' (' + e.by.role + ')' : ''}
              </small>
            </li>
          ))}
      </ol>
    </Sheet>
  );
}
