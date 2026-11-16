import { useEffect, useState } from 'react';
import type { LinkPackage } from '../designer/link/exchange';
import { request } from './remote';
import { jobFromPackage } from './projectTradeJob';
type Choice = { id: string; name: string };
export default function BuildJobLink({ row }: { row: LinkPackage }) {
  const [active, open] = useState(false),
    [pilots, setPilots] = useState<{ slug: string; name: string }[]>([]),
    [pilot, choose] = useState(''),
    [context, set] = useState<{ revision: number; sites: Choice[]; steps: Choice[] }>(),
    [message, say] = useState('');
  useEffect(() => {
    if (!active) return;
    let current = true;
    request<{ owner: boolean; pilots: { slug: string; name: string }[] }>('')
      .then((d) => {
        if (current && d.owner) setPilots(d.pilots);
      })
      .catch((e) => {
        if (current) say(e.message);
      });
    return () => {
      current = false;
    };
  }, [active]);
  useEffect(() => {
    set(undefined);
    if (!pilot) return;
    let current = true;
    request<NonNullable<typeof context>>('/' + pilot + '/build-context')
      .then((d) => {
        if (current) set(d);
      })
      .catch((e) => {
        if (current) say(e.message);
      });
    return () => {
      current = false;
    };
  }, [pilot]);
  return (
    <details onToggle={(e) => open(e.currentTarget.open)}>
      <summary>Link to a pilot</summary>
      <form
        className="pilot-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!context) return;
          const f = new FormData(e.currentTarget);
          try {
            await request('/' + pilot + '/trade-jobs', 'POST', {
              revision: context.revision,
              job: await jobFromPackage(row, String(f.get('site')), String(f.get('step'))),
            });
            set(await request('/' + pilot + '/build-context'));
            say('The pilot now has this scope, quote status and progress.');
          } catch (err) {
            say(err instanceof Error ? err.message : 'Unable to link this package.');
          }
        }}
      >
        <label>
          Pilot
          <select required value={pilot} onChange={(e) => choose(e.target.value)}>
            <option value="">Choose a pilot</option>
            {pilots.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {context && (
          <>
            <label>
              Site
              <select required name="site">
                {context.sites.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Works-plan step
              <select required name="step">
                {context.steps.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <button>Save pilot link and progress</button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
