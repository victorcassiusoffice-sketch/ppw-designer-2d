import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from './ui';
import { formValues, str } from './fields';
import { blankPilot } from './example';
import { uid, roles, type Pilot } from './contract';
import { inviteMember, request, useRemote } from './remote';
export function SharedList({ memberOnly = false }: { memberOnly?: boolean }) {
  const [list, setList] = useState<{
      owner: boolean;
      pilots: Pick<Pilot, 'slug' | 'name' | 'lane' | 'state'>[];
    }>(),
    [message, setMessage] = useState('Opening shared pilots…'),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    request<NonNullable<typeof list>>('')
      .then((x) => {
        if (live) {
          setList(x);
          setMessage('');
        }
      })
      .catch(() => {
        if (live)
          setMessage(
            memberOnly
              ? 'Ask the owner for your link.'
              : 'Shared storage is unavailable. You can still use the pilots saved on this device.',
          );
      });
    return () => {
      live = false;
    };
  }, [memberOnly]);
  return (
    <section>
      <h2>Shared pilots</h2>
      <p role="status">{message}</p>
      {list?.owner && (
        <details>
          <summary>New shared pilot</summary>
          <form
            className="pilot-form"
            onSubmit={async (e) => {
              const f = formValues(e);
              const p = blankPilot('shared-' + uid(), str(f, 'name'), str(f, 'lane'));
              setBusy(true);
              try {
                await request('', 'POST', {
                  slug: p.slug,
                  name: p.name,
                  lane: p.lane,
                  state: p.state,
                  summary: '',
                  lead: { name: str(f, 'lead'), organisation: str(f, 'organisation') },
                  steps: p.steps,
                });
                navigate('/pilots/' + p.slug);
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Could not create pilot.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field name="name" label="Shared pilot name" />
            <Field name="lane" label="Pilot lane" />
            <Field name="lead" label="Lead first name" />
            <Field name="organisation" label="Lead organisation" />
            <button disabled={busy}>Create shared pilot</button>
          </form>
        </details>
      )}
      {list?.pilots.map((p) => (
        <Link className="pilot-list-card" to={'/pilots/' + p.slug} key={p.slug}>
          <small>
            {p.lane} · {p.state}
          </small>
          <h3>{p.name}</h3>
        </Link>
      ))}
      {list && !list.pilots.length && <p>No shared pilots yet.</p>}
    </section>
  );
}
export function Invites({ slug }: { slug: string }) {
  const [url, setUrl] = useState(''),
    busy = useRemote((s) => s.busy);
  return (
    <>
      <details>
        <summary>Invite a member</summary>
        <form
          className="pilot-form"
          onSubmit={async (e) => {
            const form = e.currentTarget,
              f = formValues(e);
            setUrl('');
            try {
              const r = await inviteMember(slug, {
                name: str(f, 'name'),
                organisation: str(f, 'organisation'),
                role: str(f, 'role'),
              });
              setUrl(new URL(r.join, location.origin).href);
              form.reset();
            } catch {
              /* visible status in shared header */
            }
          }}
        >
          <Field name="name" label="First name" />
          <Field name="organisation" label="Organisation" />
          <label>
            Role
            <select aria-label="Role" name="role" defaultValue="tester">
              {roles.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button disabled={busy}>Make join link</button>
        </form>
        {url && (
          <div>
            <label>
              Send it by hand
              <input
                aria-label="Join address"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <p>This address is shown once and can be used once within seven days.</p>
            <button onClick={() => setUrl('')}>Dismiss address</button>
          </div>
        )}
      </details>
      <label>
        <input type="checkbox" disabled /> Public summary · private
      </label>
    </>
  );
}
