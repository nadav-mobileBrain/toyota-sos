export type CsvRow = Record<string, any> | any[];

function escapeCsvValue(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: CsvRow[], headers?: string[]): string {
  if (!rows || rows.length === 0) {
    const hdr = headers ? headers.join(',') : '';
    // UTF-8 BOM
    return '\uFEFF' + hdr + '\n';
  }
  let cols: string[] = [];
  if (headers && headers.length > 0) {
    cols = headers;
  } else if (!Array.isArray(rows[0])) {
    cols = Object.keys(rows[0] as Record<string, any>);
  }
  const lines: string[] = [];
  if (cols.length > 0) lines.push(cols.join(','));
  for (const row of rows) {
    if (Array.isArray(row)) {
      lines.push(row.map(escapeCsvValue).join(','));
    } else {
      lines.push(cols.map((c) => escapeCsvValue((row as Record<string, any>)[c])).join(','));
    }
  }
  return '\uFEFF' + lines.join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function makeCsvFilename(base: string, tz: string | undefined) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_${pad(now.getUTCHours())}${pad(
    now.getUTCMinutes()
  )}${pad(now.getUTCSeconds())}`;
  const tzSuffix = tz ? `_${tz}` : '';
  return `${base}_${stamp}${tzSuffix}.csv`;
}


