import { request } from './remote';
import { ledgerCsv } from './ledger';
import { periodPack, type ReportPack, type ReportsView } from './reports';
import type { Pilot } from './contract';
import type { funderSet } from './funder';
import { major, minorDigits, type BookCurrency } from './ledger';

export function saveDownload(name: string, data: Blob) {
  const url = URL.createObjectURL(data),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function pdfStart(title: string) {
  const [{ jsPDF }, { default: table }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title });
  let y = 18;
  const heading = (s: string) => {
    if (y > 255) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(pdf.splitTextToSize(s, 174), 16, y);
    y += 8;
  };
  function text(s: string) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    for (const line of pdf.splitTextToSize(s || '—', 174)) {
      if (y > 276) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(String(line), 16, y);
      y += 5;
    }
    y += 2;
  }
  function rows(head: string[], body: (string | number | null | undefined)[][]) {
    table(pdf, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map((c) => (c == null ? '' : String(c)))),
      margin: { left: 16, right: 16, top: 16, bottom: 18 },
      styles: { fontSize: 9, overflow: 'linebreak' },
      headStyles: { fillColor: [42, 80, 75] },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  }
  function bars(data: { label: string; value: number }[]) {
    const max = Math.max(1, ...data.map((i) => Math.abs(i.value)));
    for (const d of data.slice(-20)) {
      if (y > 270) {
        pdf.addPage();
        y = 18;
      }
      pdf.setFontSize(8);
      pdf.text(d.label.slice(0, 23), 16, y);
      pdf.setFillColor(36, 108, 92);
      pdf.rect(61, y - 3, Math.max(0.3, (Math.abs(d.value) / max) * 92), 3, 'F');
      pdf.text(String(d.value), 155, y);
      y += 6;
    }
    y += 3;
  }
  heading(title);
  return { pdf, heading, text, rows, bars };
}
export async function recordPdf(p: Pilot, view: ReportsView, pack: ReportPack) {
  const d = periodPack(p, view, pack),
    { pdf, heading, text, rows, bars } = await pdfStart(p.name + ' · ' + pack.kind + ' report');
  text('Period ' + d.period.number + ' · ' + d.period.start + ' to ' + d.period.end);
  heading('Indicators');
  text(pack.text.indicators ?? '');
  rows(
    ['Indicator', 'Unit', 'Baseline', 'Target', 'Value'],
    d.indicators.map((i) => [i.name, i.unit, i.baseline, i.target, i.value]),
  );
  heading('Works plan');
  text(pack.text.steps ?? '');
  rows(
    ['Step', 'State', 'Tasks'],
    d.steps.map((s) => [s.name, s.status, s.tasks.map((t) => t.name + ' · ' + t.state).join(', ')]),
  );
  heading('Readings');
  text(pack.text.readings ?? '');
  rows(
    ['Date', 'Reading', 'Values'],
    d.samples.map((s) => [
      s.date,
      p.readingTypes?.find((t) => t.id === s.typeId)?.name,
      Object.entries(s.values)
        .map(
          ([id, v]) =>
            (p.readingTypes?.find((t) => t.id === s.typeId)?.fields.find((f) => f.id === id)
              ?.name ?? id) +
            ' ' +
            v,
        )
        .join(', '),
    ]),
  );
  bars(d.readings.map((r) => ({ label: r.month, value: r.cover })));
  heading('Logs against baseline');
  text(pack.text.logs ?? '');
  rows(
    ['Stream', 'Total', 'Baseline'],
    d.streams.map((l) => [l.stream, l.total, l.baseline]),
  );
  bars(d.streams.map((s) => ({ label: s.stream, value: s.total })));
  heading('Events and attendance');
  text(pack.text.events ?? '');
  rows(
    ['Date', 'Event', 'Women', 'Men', 'Not stated', 'Total'],
    d.events.map((e) => [
      e.date,
      e.title,
      e.women,
      e.men,
      e.notStated,
      e.women + e.men + e.notStated,
    ]),
  );
  heading('Papers');
  text(pack.text.papers ?? '');
  rows(
    ['Paper', 'State'],
    d.papers.map((s) => [s.title, s.state]),
  );
  if (d.photos.length) {
    for (const photo of d.photos) {
      const res = await fetch('/api/pilots/' + p.slug + '/photos/' + photo.id, {
        cache: 'no-store',
      });
      if (!res.ok) throw Error('A selected photo is unavailable.');
      const bytes = new Uint8Array(await res.arrayBuffer());
      pdf.addPage();
      pdf.setFontSize(12);
      pdf.text(pdf.splitTextToSize(photo.caption || photo.date, 175), 16, 18);
      const dims = pdf.getImageProperties(bytes),
        scale = Math.min(174 / dims.width, 214 / dims.height);
      pdf.addImage(bytes, 'JPEG', 16, 38, dims.width * scale, dims.height * scale);
    }
  }
  return pdf.output('blob');
}
type MoneySet = ReturnType<typeof funderSet>;
export async function moneyPdf(p: Pilot, pack: ReportPack, unit: BookCurrency, set: MoneySet) {
  const { pdf, heading, text, rows } = await pdfStart(p.name + ' · Private money pages');
  const fmt = (v: number | null | undefined) =>
    v == null ? '—' : major(v, minorDigits[unit]) + ' ' + unit;
  text(pack.kind + ' report · ' + pack.period);
  heading('Plan and spending');
  rows(
    ['Line', 'Signed', 'Changes', 'Current', 'This period', 'Before', 'Remaining'],
    set.lines.map((l) => [
      l.label,
      fmt(l.signed),
      fmt(l.authorised),
      fmt(l.planned),
      fmt(l.thisPeriod),
      fmt(l.before),
      fmt(l.remaining),
    ]),
  );
  heading('Forecasts');
  rows(
    ['Line', 'Forecast', 'Spent', 'Gap'],
    set.lines.map((l) => [l.label, fmt(l.forecast), fmt(l.thisPeriod), fmt(l.forecastGap)]),
  );
  heading('Funding');
  rows(
    ['Source', 'Kind', 'Promised', 'Received'],
    set.sourceTable.map((r) => [r.name, r.kind, fmt(r.promised), fmt(r.received)]),
  );
  text(
    'Minimum share ' +
      (set.minimumShare ?? '—') +
      '% · Promised ' +
      (set.promised ?? '—') +
      '% · Reached ' +
      (set.reached ?? '—') +
      '%',
  );
  rows(
    ['Item', 'Amount'],
    [
      ['Received', fmt(set.received)],
      ['Flat rate', fmt(set.flat)],
      ['Final grant' + (set.projected ? ' · projected' : ''), fmt(set.grant)],
      [set.balanceLabel, fmt(set.balance)],
    ],
  );
  if (pack.kind === 'final') {
    heading('Pending costs');
    rows(
      ['Provider', 'Object', 'Due date', 'Amount'],
      set.pending.map((r) => [r.provider, r.object, r.due, fmt(r.amount)]),
    );
    heading('Assets');
    rows(
      ['Item', 'Receiver', 'Handover'],
      set.assets.map((a) => [a.item, a.asset?.receiver, a.asset?.actual]),
    );
    heading('Final account');
    rows(
      ['Item', 'Amount'],
      [
        ['Receipts', fmt(set.receipts)],
        ['Eligible costs', fmt(set.eligible)],
        ...set.wrongSums.map((r) => [
          r.what,
          'Used ' + fmt(r.amount) + ' · recovered ' + fmt(r.recovered),
        ]),
      ],
    );
  }
  return pdf.output('blob');
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export async function exportArchive(slug: string, hidden: boolean, status: (s: string) => void) {
  const { zipSync, strToU8 } = await import('fflate'),
    base = '/' + slug,
    head = await request<{ revision: number; pilot: { name: string } }>(base + '/export');
  const entries: Record<string, Uint8Array> = {},
    items: { id: string; kind: string; hidden: boolean; payload: Record<string, unknown> }[] = [];
  for (let page: number | null = 0; page !== null; ) {
    const part: { rows: typeof items; next: number | null } = await request(
      base + '/export/' + (hidden ? 'all' : 'visible') + '-' + head.revision + '-' + page,
    );
    items.push(...part.rows);
    page = part.next;
  }
  entries['pilot.json'] = strToU8(JSON.stringify(head.pilot, null, 2));
  const links: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const r = items[i],
      path = 'records/' + encodeURIComponent(r.kind) + '/' + encodeURIComponent(r.id);
    entries[path + '.json'] = strToU8(JSON.stringify(r, null, 2));
    entries[path + '.csv'] = strToU8(
      ledgerCsv([
        ['field', 'value'],
        ['hidden', String(r.hidden)],
        ...Object.entries(r.payload).map(([k, v]) => [
          k,
          typeof v === 'string' ? v : JSON.stringify(v),
        ]),
      ]),
    );
    links.push(
      '<li>' +
        escape(r.kind) +
        ' · <a href="' +
        path +
        '.json">' +
        escape(r.id) +
        '</a>' +
        (r.hidden ? ' (hidden)' : '') +
        ' · <a href="' +
        path +
        '.csv">CSV</a>',
    );
    if (r.kind === 'photo' || r.kind === 'file') {
      const file = await fetch('/api/pilots' + base + '/export-file/' + encodeURIComponent(r.id), {
        cache: 'no-store',
      });
      if (!file.ok) throw Error('Cannot read an archived file.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (r.payload.sha256 && (await digest(bytes)) !== r.payload.sha256)
        throw Error('A stored checksum does not match.');
      const ext =
          r.kind === 'photo' || r.payload.mime === 'image/jpeg'
            ? 'jpg'
            : r.payload.mime === 'image/png'
              ? 'png'
              : 'pdf',
        name = 'files/' + encodeURIComponent(r.id) + '.' + ext;
      entries[name] = bytes;
      links.push(' · <a href="' + name + '">Open file</a>');
    }
    links.push('</li>');
    status('Preparing ' + (i + 1) + ' of ' + items.length);
  }
  const end = await request<{ revision: number }>(base + '/export');
  if (head.revision !== end.revision) throw Error('The pilot changed. Start the export again.');
  entries['index.html'] = strToU8(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pilot archive</title><h1>' +
      escape(head.pilot.name) +
      '</h1><a href="pilot.json">Pilot details</a><ul>' +
      links.join('') +
      '</ul>',
  );
  const checks: string[] = [];
  for (const [name, bytes] of Object.entries(entries))
    checks.push((await digest(bytes)) + '  ' + name);
  entries['SHA256SUMS.txt'] = strToU8(checks.join('\n') + '\n');
  const zip = zipSync(entries, { level: 0 });
  saveDownload('pilot-record.zip', new Blob([new Uint8Array(zip)], { type: 'application/zip' }));
}
async function digest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
