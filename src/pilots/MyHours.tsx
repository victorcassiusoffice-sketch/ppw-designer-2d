import { useState } from 'react';
import { request } from './remote';
import { fileCap, type Evidence } from './evidence';
import { uid } from './contract';
type Month = {
  id?: string;
  month?: string;
  hours?: string;
  totalHours?: string;
  step?: string;
  approved?: boolean;
  timeSheet?: string;
};
export default function MyHours({
  url,
  months,
  steps,
  seat,
  revision,
  enabled,
  refresh,
}: {
  url: string;
  months: Month[];
  steps: { id: string; title: string }[];
  seat: string;
  revision: number;
  enabled: boolean;
  refresh: () => void;
}) {
  const [edit, set] = useState<Month | null>(null),
    [message, say] = useState(''),
    [busy, wait] = useState(false);
  return (
    <section>
      <h3>My hours</h3>
      {months.map((m) => (
        <article key={m.id}>
          <b>{m.month}</b>
          <p>
            {m.hours} of {m.totalHours} hours · {steps.find((s) => s.id === m.step)?.title} ·{' '}
            {m.approved ? 'Approved' : 'Entered'}
          </p>
          {!m.approved && <button onClick={() => set(m)}>Edit hours</button>}
        </article>
      ))}
      <button onClick={() => set({ id: uid() })}>Record a month</button>
      {edit && (
        <form
          key={edit.id}
          className="pilot-form"
          onSubmit={async (e) => {
            e.preventDefault();
            wait(true);
            say('');
            const form = new FormData(e.currentTarget);
            try {
              let timeSheet = edit.timeSheet,
                rev = revision;
              const file = form.get('file');
              if (file instanceof File && file.size) {
                if (file.size > fileCap) throw Error('Choose a time sheet of 1 MB or less.');
                const data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
                const r = await request<{ file: Evidence }>(url + '/files', 'POST', {
                  revision: rev,
                  file: {
                    title: 'Time sheet ' + form.get('month'),
                    kind: 'time sheet',
                    source: 'money',
                  },
                  data,
                });
                timeSheet = r.file.id;
                rev = (await request<{ revision: number }>(url + '/my-finance')).revision;
              }
              await request(url + '/my-finance', 'POST', {
                revision: rev,
                row: {
                  version: 2,
                  type: 'staff_month',
                  id: edit.id,
                  memberId: seat,
                  month: form.get('month'),
                  hours: form.get('hours'),
                  totalHours: form.get('total'),
                  step: form.get('step'),
                  timeSheet,
                  approved: false,
                },
              });
              set(null);
              refresh();
              say('Month saved.');
            } catch (err) {
              say(err instanceof Error ? err.message : 'Could not save the month.');
            } finally {
              wait(false);
            }
          }}
        >
          <label>
            Month <input required type="month" name="month" defaultValue={edit.month} />
          </label>
          <label>
            Hours on this pilot{' '}
            <input required inputMode="decimal" name="hours" defaultValue={edit.hours} />
          </label>
          <label>
            Total hours worked{' '}
            <input required inputMode="decimal" name="total" defaultValue={edit.totalHours} />
          </label>
          <label>
            Works-plan step{' '}
            <select required name="step" defaultValue={edit.step ?? ''}>
              <option value="">Choose a step</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {enabled && (
            <label>
              Time sheet{' '}
              <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" />
            </label>
          )}
          <button disabled={busy}>Save hours</button>
          <button type="button" onClick={() => set(null)}>
            Cancel
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
