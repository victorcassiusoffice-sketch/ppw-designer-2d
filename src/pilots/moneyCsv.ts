import {csvCell} from './money';
export function exportCsv(name: string, rows: string[][]) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
