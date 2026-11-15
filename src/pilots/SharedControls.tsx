import { sections, levels, labels, levelFor, type Role, type Rules } from './access';
import { saveRules, changeMember } from './remote';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from './ui';
import { formValues, str } from './fields';
import { blankPilot } from './example';
import PilotMap from './PilotMap';
import { usePilots } from './store';
import { uid, roles, type Site, type Pilot } from './contract';
import { inviteMember, renewMember, request, useRemote } from './remote';
export function SharedList({ memberOnly = false }: { memberOnly?: boolean }) {
  const [list, setList] = useState<{
      owner: boolean;
      sites?: { slug: string; name: string; payload: Site }[];
      pilots: Pick<Pilot, 'slug' | 'name' | 'lane' | 'state'>[];
    }>(),
    [message, setMessage] = useState('Opening shared pilots…'),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const local = usePilots((s) => s.pilots);
  const pins = [
    ...local.flatMap((p) => p.sites.map((payload) => ({ slug: p.slug, name: p.name, payload }))),
    ...(list?.sites ?? []),
  ].map(({ slug, name, payload }) => ({
    ...payload,
    id: slug + '/' + payload.id,
    place: name + ' · ' + payload.place,
  }));
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
      {!memberOnly && (
        <>
          <h2>Programme map</h2>
          <PilotMap
            sites={pins}
            onPick={(key) => {
              const [slug, site] = key.split('/');
              navigate('/pilots/' + slug + '#site-' + site);
            }}
          />
        </>
      )}
      <h2>{memberOnly && !list?.owner ? 'My pilots' : 'Shared pilots'}</h2>
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
        <Link
          className="pilot-list-card"
          to={'/pilots/' + p.slug + (memberOnly && !list?.owner ? '/me' : '')}
          key={p.slug}
        >
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
    busy = useRemote((s) => s.busy),
    [role, setRole] = useState<Role>('tester');
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
                ...(role === 'checker' ? { endDate: str(f, 'endDate') } : {}),
              });
              setUrl(new URL(r.join, location.origin).href);
              form.reset();
              setRole('tester');
            } catch {
              /* visible status in shared header */
            }
          }}
        >
          <Field name="name" label="First name" />
          <Field name="organisation" label="Organisation" />
          <label>
            Role
            <select
              aria-label="Role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {roles.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <RoleWarning role={role} />
          {role === 'checker' && (
            <label>
              End date
              <input required type="date" name="endDate" />
            </label>
          )}
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
      <RoleTable slug={slug} />
      <label>
        <input type="checkbox" disabled /> Public summary · private
      </label>
    </>
  );
}

function RoleWarning({ role }: { role: Role }) {
  if (role === 'lead' || role === 'coordinator')
    return (
      <p>
        This role opens all of Money, pay and hours included. Give it only to the lead's own people,
        never to the owner's company.
      </p>
    );
  if (role === 'checker')
    return (
      <p>
        A checker reads all of Money, pay and hours included, until its end date. Each read is
        logged.
      </p>
    );
  return null;
}
export function MemberLink({ slug, member }: { slug: string; member: Pilot['members'][number] }) {
  const [url, setUrl] = useState(''),
    [role, setRole] = useState(member.role);
  const busy = useRemote((s) => s.busy);
  async function show(action: () => Promise<{ join: string }>) {
    setUrl('');
    try {
      setUrl(new URL((await action()).join, location.origin).href);
    } catch {
      /* shared save status */
    }
  }
  return (
    <div>
      <button disabled={busy} onClick={() => void show(() => renewMember(slug, member.id))}>
        New link
      </button>
      <details>
        <summary>Change role</summary>
        <form
          className="pilot-form"
          onSubmit={(e) => {
            const f = formValues(e);
            void show(() =>
              changeMember(
                slug,
                member.id,
                role,
                role === 'checker' ? str(f, 'endDate') : undefined,
              ),
            );
          }}
        >
          <label>
            New role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <RoleWarning role={role} />
          {role === 'checker' && (
            <label>
              End date
              <input required name="endDate" type="date" />
            </label>
          )}
          <button disabled={busy || role === member.role}>Save role and issue link</button>
        </form>
      </details>
      {url && (
        <label>
          Send it by hand
          <input
            aria-label="Replacement address"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={() => setUrl('')}>Dismiss address</button>
        </label>
      )}
    </div>
  );
}
function RoleTable({ slug }: { slug: string }) {
  const rules = useRemote((s) => s.doc?.rules) ?? {},
    busy = useRemote((s) => s.busy),
    [role, setRole] = useState<Role>('tester');
  return (
    <details>
      <summary>Section access</summary>
      <div className="pilot-form">
        <label>
          Member role
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {sections.map((k) => (
          <label key={k}>
            {labels[k]}
            <select
              aria-label={labels[k]}
              disabled={busy}
              value={levelFor(rules, false, role, k)}
              onChange={(e) => {
                const next: Rules = { ...rules, [role]: { ...rules[role], [k]: e.target.value } };
                void saveRules(slug, next).catch(() => {});
              }}
            >
              {levels
                .filter(
                  (l) => l !== 'add' || (role !== 'viewer' && role !== 'checker' && k !== 'team'),
                )
                .map((l) => (
                  <option key={l}>{l}</option>
                ))}
            </select>
          </label>
        ))}
      </div>
    </details>
  );
}
