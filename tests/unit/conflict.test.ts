import { resolveConflict } from '@/lib/conflict';

describe('resolveConflict', () => {
  it('server wins when updatedAt newer', () => {
    const local = { id: 't1', title: 'A', modifiedAt: '2025-01-01T10:00:00Z' };
    const server = { id: 't1', title: 'B', updatedAt: '2025-01-01T11:00:00Z', updatedBy: 'admin' };
    const res = resolveConflict(local, server, { localModifiedAtKey: 'modifiedAt', serverUpdatedAtKey: 'updatedAt', serverUpdatedByKey: 'updatedBy' });
    expect(res.source).toBe('server');
    expect(res.merged.title).toBe('B');
    expect(res.conflict).toBe(true);
    expect(res.ribbon?.updatedBy).toBe('admin');
  });

  it('local wins when modifiedAt newer', () => {
    const local = { id: 't1', title: 'A*', modifiedAt: '2025-01-01T12:00:00Z' };
    const server = { id: 't1', title: 'B', updatedAt: '2025-01-01T11:00:00Z', updatedBy: 'admin' };
    const res = resolveConflict(local, server, { localModifiedAtKey: 'modifiedAt', serverUpdatedAtKey: 'updatedAt', serverUpdatedByKey: 'updatedBy' });
    expect(res.source).toBe('local');
    expect(res.merged.title).toBe('A*');
    expect(res.conflict).toBe(true);
    expect(res.ribbon).toBeUndefined();
  });

  it('ties prefer server', () => {
    const local = { id: 't1', val: 1, modifiedAt: 1700000000000 };
    const server = { id: 't1', val: 2, updatedAt: 1700000000000, updatedBy: 'sys' };
    const res = resolveConflict(local, server, { localModifiedAtKey: 'modifiedAt', serverUpdatedAtKey: 'updatedAt', serverUpdatedByKey: 'updatedBy' });
    expect(res.source).toBe('server');
    expect(res.merged.val).toBe(2);
    expect(res.conflict).toBe(false);
  });
});


