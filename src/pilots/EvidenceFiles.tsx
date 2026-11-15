import { useEffect, useState } from 'react';
import { type Pilot } from './contract';
import { recordKinds, proofKinds, fileCap, type Evidence } from './evidence';
import { hideFile, permissions, request, saveFile, useRemote } from './remote';
import { managesMoney } from './money';

export function EvidenceFiles({ p }: { p: Pilot }) {
  const doc = useRemote((s) => s.doc),
    [list, setList] = useState<{ enabled: boolean; files: Evidence[] }>(),
    [message, setMessage] = useState('');
  const access = permissions(p, 'papers'),
    finance = managesMoney(!!doc?.owner, doc?.role ?? null);
  useEffect(() => {
    let live = true;
    setList(undefined);
    request<{ enabled: boolean; files: Evidence[] }>('/' + p.slug + '/files')
      .then((reply) => {
        if (live) setList(reply);
      })
      .catch(() => {
        if (live) setMessage('Could not load the files.');
      });
    return () => {
      live = false;
    };
  }, [p.slug, doc?.revision]);
  return (
    <details>
      <summary>Files</summary>
      {list && !list.enabled && <p>File storage is off. Add an outside link to the paper.</p>}
      {list?.enabled && access.write && (
        <form
          className="pilot-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              v = new FormData(form),
              file = v.get('file');
            if (!(file instanceof File)) return;
            if (file.size > fileCap) {
              setMessage('Choose a file of 1 MB or less.');
              return;
            }
            try {
              const data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              await saveFile(
                p.slug,
                {
                  title: v.get('title'),
                  kind: v.get('kind'),
                  linkedId: v.get('linkedId') || undefined,
                },
                data,
              );
              form.reset();
              setMessage('File saved.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Could not save the file.');
            }
          }}
        >
          <label>
            File title
            <input name="title" required maxLength={160} />
          </label>
          <label>
            Kind
            <select name="kind">
              {[...recordKinds, ...(finance ? proofKinds : [])].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Attach to
            <select name="linkedId">
              <option value="">Standalone file</option>
              {p.papers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
              {p.logs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.date} · {x.type}
                </option>
              ))}
            </select>
          </label>
          <label>
            PDF, JPEG or PNG
            <input required type="file" name="file" accept="application/pdf,image/jpeg,image/png" />
          </label>
          <button>Save file</button>
        </form>
      )}
      {list?.files.map((f) => (
        <article key={f.id}>
          <h3>{f.title}</h3>
          <p>
            {f.kind} · {f.size} bytes · {f.addedAt.slice(0, 10)}
          </p>
          <a href={'/api/pilots/' + p.slug + '/files/' + f.id} download>
            Download
          </a>
          {(access.owner || (access.write && f.addedBy === access.by)) && (
            <button onClick={() => void hideFile(p.slug, f.id).catch((e) => setMessage(e.message))}>
              Hide file
            </button>
          )}
        </article>
      ))}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
