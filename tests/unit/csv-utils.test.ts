import { toCsv, makeCsvFilename } from '@/utils/csv';

describe('csv utils (8.5)', () => {
  it('generates CSV with BOM, headers and escaped values', () => {
    const rows = [
      { a: 'x', b: 1, c: 'hello' },
      { a: 'needs,quote', b: 2, c: 'he said "hi"' },
    ];
    const csv = toCsv(rows, ['a', 'b', 'c']);
    // BOM
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\n');
    expect(lines[0]).toBe('a,b,c');
    // escape comma
    expect(lines[2]).toContain('"needs,quote"');
    // escape quotes
    expect(lines[2]).toContain('"he said ""hi"""');
  });

  it('generates filename with timestamp and tz', () => {
    const now = new Date('2025-01-15T10:11:12Z');
    jest.useFakeTimers().setSystemTime(now);
    const name = makeCsvFilename('dashboard_test', 'UTC');
    expect(name.startsWith('dashboard_test_20250115_101112_UTC')).toBe(true);
    jest.useRealTimers();
  });
});


