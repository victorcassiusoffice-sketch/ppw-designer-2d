import { useRef, useState, type FormEvent } from 'react';
import { MEETING_URL } from './workflowModel';

export type PitchAudience = 'developers' | 'merchants' | 'construction';
type Purpose = 'project' | 'feedback' | 'physical-meeting';

export function PitchEnquiryForm({ audience }: { audience: PitchAudience }) {
  const form = useRef<HTMLFormElement>(null);
  const [purpose, setPurpose] = useState<Purpose>('project');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  function payload() {
    const values = new FormData(form.current!);
    const text = (key: string) => String(values.get(key) ?? '').trim();
    return { audience, purpose, name: text('name'), email: text('email'), company: text('company'), phone: text('phone'), message: text('message'), location: text('location'), availability: text('availability'), website: text('website'), consent: values.get('consent') === 'on' };
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !form.current?.reportValidity()) return;
    setBusy(true); setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/pitch-enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()), signal: controller.signal });
      const body = await response.json() as { receipt?: string; status?: string; error?: string };
      if (!response.ok || body.status !== 'received' || !/^PPW-\d+$/.test(body.receipt ?? '')) throw new Error(body.error || 'We could not confirm your request was saved.');
      setResult({ ok: true, text: `Request saved · ${body.receipt}. Victor’s team can review it. A meeting is only confirmed when a time and place have been agreed.` });
    } catch (error) {
      setResult({ ok: false, text: `${error instanceof Error && error.name !== 'AbortError' ? error.message : 'We could not confirm your request was saved.'} Your entries are still here. Download a copy or book online.` });
    } finally { window.clearTimeout(timeout); setBusy(false); }
  }
  function download() {
    const data = payload();
    const lines = ['PPW Studio — request draft (not submitted by this download)', `Audience: ${data.audience}`, `Purpose: ${data.purpose}`, `Name: ${data.name}`, `Email: ${data.email}`, `Company: ${data.company}`, `Phone: ${data.phone}`, ...(purpose === 'physical-meeting' ? [`Location: ${data.location}`, `Availability: ${data.availability}`] : []), '', data.message, '', 'A downloaded request does not make a booking or place an order.', MEETING_URL];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'PPW-Studio-request.txt'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <form ref={form} className="pitch-enquiry" onSubmit={submit} aria-label="Project enquiry and feedback">
    <div className="pitch-segment pitch-wrap" role="group" aria-label="Request type">
      {([['project', 'Discuss a project'], ['feedback', 'Give feedback'], ['physical-meeting', 'Meet in person']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={purpose === value} onClick={() => { setPurpose(value); setResult(null); }}>{label}</button>)}
    </div>
    <div className="pitch-enquiry-grid">
      <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={200} placeholder="Name" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={320} placeholder="you@company.mu" /></label>
      <label>Company · optional<input name="company" autoComplete="organization" maxLength={160} placeholder="Company or project" /></label>
      <label>Phone · optional<input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="+230" /></label>
      {purpose === 'physical-meeting' && <><label>Where in Mauritius?<input name="location" required maxLength={180} placeholder="Office, site or preferred area" /></label><label>Availability · optional<input name="availability" maxLength={180} placeholder="Days, times and timezone" /></label></>}
    </div>
    <label>{purpose === 'feedback' ? 'What worked, or what should improve?' : 'What would you like to make possible?'}<textarea name="message" required minLength={10} maxLength={2400} rows={3} placeholder={purpose === 'feedback' ? 'Tell us what you tried and what you expected…' : 'Your project, products, team and the workflow you want to improve…'} /></label>
    <label className="pitch-honeypot" aria-hidden="true">Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className="pitch-enquiry-consent"><input name="consent" type="checkbox" required /><span>I agree that PPW may store this request and contact me about it. Please do not include identity documents, payment details or passwords.</span></label>
    {result && <p className={`pitch-enquiry-result ${result.ok ? 'is-success' : 'is-error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</p>}
    <div className="pitch-enquiry-actions"><button className="pitch-primary" type="submit" disabled={busy || result?.ok}>{busy ? 'Saving request…' : result?.ok ? 'Request saved ✓' : purpose === 'physical-meeting' ? 'Request an in-person meeting ↗' : purpose === 'feedback' ? 'Send feedback ↗' : 'Send project enquiry ↗'}</button><button type="button" className="pitch-secondary" onClick={download}>Download a copy</button></div>
    <p className="pitch-fine">This form saves a private business request. It does not place orders or book a time. Prefer a video call? <a href={MEETING_URL} target="_blank" rel="noreferrer">Choose a 1-hour meeting ↗</a></p>
  </form>;
}
