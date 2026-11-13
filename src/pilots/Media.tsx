import { lazy, Suspense, useEffect, useState } from 'react';
import { stream, today, uid, type Pilot, type Photo, type Site } from './contract';
import { addPhotos, update } from './store';
import { resizePhoto } from './resize';
import { Field, Picture } from './ui';
import { formValues, str, usePhoto } from './fields';
const Panorama = lazy(() => import('./Panorama'));
export function Wall({ p }: { p: Pilot }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [filter, setFilter] = useState('');
  const photos = p.photos
    .filter((x) => !x.hidden && (!filter || x.site === filter))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      {p.sites.length > 0 && (
        <details>
          <summary>Add photos</summary>
          <p>Choose wall or site pictures without faces. Photos stay on this device.</p>
          <form
            className="pilot-form"
            onSubmit={async (e) => {
              const form = e.currentTarget,
                f = formValues(e);
              setBusy(true);
              setMessage('Preparing photos…');
              try {
                const files = f
                  .getAll('files')
                  .filter((x): x is File => x instanceof File && x.size > 0);
                if (!files.length || files.length > 200)
                  throw Error('Choose between 1 and 200 photos.');
                const batch: Array<[Photo, Blob]> = [];
                for (const file of files)
                  batch.push([
                    {
                      id: uid(),
                      site: str(f, 'site'),
                      member: str(f, 'member'),
                      date: str(f, 'date'),
                      kind: f.get('kind') === 'photo' ? 'photo' : '360 panorama',
                      caption: str(f, 'caption'),
                      hidden: false,
                    },
                    await resizePhoto(file),
                  ]);
                await addPhotos(p.slug, batch);
                setMessage(batch.length + ' added to the wall.');
                form.reset();
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Could not save photos.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Site
              <select name="site">
                {p.sites.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <Field name="date" type="date" label="Taken on" value={today()} />
            <label>
              Kind
              <select name="kind">
                <option>photo</option>
                <option>360 panorama</option>
              </select>
            </label>
            <Field name="caption" label="Caption" maxLength={200} required={false} />
            <label>
              Added by
              <select name="member">
                {p.members
                  .filter((m) => m.state === 'active')
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name} · {m.organisation}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Pictures
              <input
                name="files"
                type="file"
                multiple
                required
                accept="image/*"
                capture="environment"
              />
            </label>
            <button disabled={busy}>Save photos</button>
          </form>
          <p role="status">{message}</p>
        </details>
      )}
      <label>
        Show site
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All sites</option>
          {p.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {!photos.length && <p>Add a site photo to start the wall.</p>}
      {[...new Set(photos.map((x) => x.date.slice(0, 7)))].map((month) => (
        <div key={month}>
          <h3>{month}</h3>
          <div className="pilot-cards">
            {photos
              .filter((x) => x.date.startsWith(month))
              .map((ph) => (
                <article key={ph.id}>
                  <Picture p={p} photo={ph} />
                  <small>
                    {ph.date} · {ph.kind}
                  </small>
                  <h4>{p.sites.find((s) => s.id === ph.site)?.name}</h4>
                  <p>{ph.caption}</p>
                  <small>
                    {p.members
                      .filter((m) => m.id === ph.member)
                      .map((m) => m.name + ' · ' + m.organisation)}
                  </small>
                  <button
                    onClick={() =>
                      update(p.slug, (q) => {
                        const x = q.photos.find((x) => x.id === ph.id);
                        if (x) x.hidden = true;
                      })
                    }
                  >
                    Hide photo
                  </button>
                </article>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
export function Camera({ p, s }: { p: Pilot; s: Site }) {
  const [tab, setTab] = useState('Live'),
    [embed, setEmbed] = useState(''),
    [error, setError] = useState(''),
    [playing, play] = useState(false),
    [index, setIndex] = useState(0);
  const photos = p.photos
      .filter((ph) => !ph.hidden && ph.site === s.id)
      .sort((a, b) => a.date.localeCompare(b.date)),
    frames = photos.filter((ph) => ph.kind === 'photo'),
    pan = photos.filter((ph) => ph.kind === '360 panorama').slice(-1)[0],
    url = usePhoto(p, tab === 'Look around' ? pan : undefined),
    address = p.cameras.find((c) => c.site === s.id)?.address;
  const frame = frames[Math.min(index, frames.length - 1)];
  useEffect(() => {
    if (!playing || tab !== 'Time-lapse' || frames.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % frames.length), 1400);
    return () => clearInterval(timer);
  }, [playing, tab, frames.length]);
  return (
    <article>
      <h3>{s.name}</h3>
      <div className="pilot-actions">
        {['Live', 'Look around', 'Time-lapse'].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              play(false);
              setEmbed('');
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Live' && (
        <>
          {address ? (
            embed === address ? (
              <iframe
                title={s.name + ' live stream'}
                src={address}
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <button className="pilot-poster" onClick={() => setEmbed(address)}>
                ▶ Play site stream
              </button>
            )
          ) : (
            <p>No camera at this site yet. Any live stream address the owner adds shows here.</p>
          )}
          <form
            className="pilot-form"
            onSubmit={(e) => {
              const f = formValues(e),
                value = str(f, 'stream');
              if (value && !stream.safeParse(value).success) {
                setError('Enter a supported HTTPS video embed address.');
                return;
              }
              setError('');
              setEmbed('');
              update(p.slug, (q) => {
                q.cameras = q.cameras.filter((c) => c.site !== s.id);
                if (value) q.cameras.push({ site: s.id, address: value });
              });
            }}
          >
            <Field
              name="stream"
              label="Stream address"
              type="url"
              value={address}
              required={false}
            />
            <button>Save address</button>
          </form>
          {error && <p role="alert">{error}</p>}
        </>
      )}
      {tab === 'Look around' &&
        (url ? (
          <Suspense fallback={<p>Opening panorama…</p>}>
            <Panorama url={url} />
          </Suspense>
        ) : (
          <p>{pan ? 'Preparing panorama…' : 'Add a 360 photo of the wall to look around.'}</p>
        ))}
      {tab === 'Time-lapse' &&
        (frame ? (
          <>
            <Picture p={p} photo={frame} />
            <output>{frame.date}</output>
            <label>
              Photo date
              <input
                type="range"
                min="0"
                max={frames.length - 1}
                value={Math.min(index, frames.length - 1)}
                onChange={(e) => {
                  play(false);
                  setIndex(Number(e.target.value));
                }}
              />
            </label>
            <button disabled={frames.length < 2} onClick={() => play(!playing)}>
              {playing ? 'Pause' : 'Play'}
            </button>
          </>
        ) : (
          <p>Add dated wall photos to start a time-lapse.</p>
        ))}
    </article>
  );
}
