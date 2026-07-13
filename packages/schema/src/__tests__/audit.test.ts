import { eq } from 'drizzle-orm';

import { logAccess, logChange } from '../audit';
import { accessLog, changeLog } from '../schema';
import { openMigratedDb } from './support/testDb';

describe('audit helpers', () => {
  const { sqlite, db } = openMigratedDb();

  afterAll(() => sqlite.close());

  test('logChange appends a row and returns its id', async () => {
    const id = await logChange(db, {
      at: '2026-07-12T09:00:00.000Z',
      entity: 'medication',
      entityId: 'med-1',
      patientId: 'pat-1',
      action: 'update',
      detail: { sig: { from: 'once daily', to: 'twice daily' } },
    });

    const [row] = await db.select().from(changeLog).where(eq(changeLog.id, id));
    expect(row).toBeDefined();
    expect(row!.at).toBe('2026-07-12T09:00:00.000Z');
    expect(row!.actor).toBe('owner');
    expect(row!.entity).toBe('medication');
    expect(row!.entityId).toBe('med-1');
    expect(row!.patientId).toBe('pat-1');
    expect(row!.action).toBe('update');
    expect(row!.detail).toEqual({ sig: { from: 'once daily', to: 'twice daily' } });
  });

  test('logChange generates id and at when omitted', async () => {
    const id = await logChange(db, {
      entity: 'patient',
      entityId: 'pat-2',
      action: 'archive',
    });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const [row] = await db.select().from(changeLog).where(eq(changeLog.id, id));
    expect(row).toBeDefined();
    expect(Number.isNaN(Date.parse(row!.at))).toBe(false);
    expect(row!.patientId).toBeNull();
    expect(row!.detail).toBeNull();
  });

  test('logAccess appends a sensitive-read row', async () => {
    const id = await logAccess(db, {
      at: '2026-07-12T10:15:00.000Z',
      what: 'er_sheet.print',
      patientId: 'pat-1',
    });

    const [row] = await db.select().from(accessLog).where(eq(accessLog.id, id));
    expect(row).toBeDefined();
    expect(row!.actor).toBe('owner');
    expect(row!.what).toBe('er_sheet.print');
    expect(row!.patientId).toBe('pat-1');
  });

  test('repeated calls append, never overwrite', async () => {
    const before = (await db.select().from(accessLog)).length;
    await logAccess(db, { what: 'backup.export' });
    await logAccess(db, { what: 'backup.export' });
    const after = await db.select().from(accessLog);
    expect(after.length).toBe(before + 2);
  });
});
