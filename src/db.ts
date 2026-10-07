// D1 まわり（お客様サイト・管理画面で共有）

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_URL?: string;
  SITE_URL?: string;
};

export type Inquiry = {
  id: string;
  createdAt: string;
  status: 'new' | 'doing' | 'done';
  name: string;
  contact: string;
  area: string;
  needs: string[];
  date: string;
  message: string;
  sim: string;
};

export const STATUSES = ['new', 'doing', 'done'] as const;

let schemaReady = false;

// 初回アクセス時にテーブルを用意する（マイグレーション作業を不要にするため）
export async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      area TEXT NOT NULL DEFAULT '',
      needs TEXT NOT NULL DEFAULT '[]',
      date TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      sim TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC)`),
  ]);
  schemaReady = true;
}

export async function getSettings(db: D1Database): Promise<unknown | null> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT json FROM settings WHERE id = 1').first<{ json: string }>();
  return row ? JSON.parse(row.json) : null;
}

export async function putSettings(db: D1Database, settings: unknown) {
  await ensureSchema(db);
  await db
    .prepare(`INSERT INTO settings (id, json, updated_at) VALUES (1, ?1, ?2)
              ON CONFLICT (id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`)
    .bind(JSON.stringify(settings), new Date().toISOString())
    .run();
}

export async function deleteSettings(db: D1Database) {
  await ensureSchema(db);
  await db.prepare('DELETE FROM settings WHERE id = 1').run();
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// フォーム入力の検証。不正なら null
export function parseInquiry(body: any, opts: { allowMeta: boolean }): Inquiry | null {
  if (!body || typeof body !== 'object') return null;
  const name = str(body.name, 100);
  const contact = str(body.contact, 200);
  if (!name || !contact) return null;
  const needs = Array.isArray(body.needs)
    ? body.needs.filter((n: unknown) => typeof n === 'string').slice(0, 20).map((n: string) => n.slice(0, 50))
    : [];
  const now = new Date().toISOString();
  let createdAt = now;
  let status: Inquiry['status'] = 'new';
  if (opts.allowMeta) {
    if (typeof body.createdAt === 'string' && !Number.isNaN(Date.parse(body.createdAt))) {
      createdAt = new Date(body.createdAt).toISOString();
    }
    if (STATUSES.includes(body.status)) status = body.status;
  }
  return {
    id: crypto.randomUUID(),
    createdAt,
    status,
    name,
    contact,
    area: str(body.area, 200),
    needs,
    date: str(body.date, 200),
    message: str(body.message, 4000),
    sim: str(body.sim, 1000),
  };
}

export async function addInquiry(db: D1Database, q: Inquiry) {
  await ensureSchema(db);
  await db
    .prepare(`INSERT INTO inquiries (id, created_at, status, name, contact, area, needs, date, message, sim)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
    .bind(q.id, q.createdAt, q.status, q.name, q.contact, q.area, JSON.stringify(q.needs), q.date, q.message, q.sim)
    .run();
}

export async function listInquiries(db: D1Database): Promise<Inquiry[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500')
    .all<Record<string, string>>();
  return results.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    status: r.status as Inquiry['status'],
    name: r.name,
    contact: r.contact,
    area: r.area,
    needs: JSON.parse(r.needs || '[]'),
    date: r.date,
    message: r.message,
    sim: r.sim,
  }));
}

export async function updateInquiryStatus(db: D1Database, id: string, status: string) {
  await ensureSchema(db);
  const r = await db.prepare('UPDATE inquiries SET status = ?1 WHERE id = ?2').bind(status, id).run();
  return r.meta.changes > 0;
}

export async function deleteInquiry(db: D1Database, id: string) {
  await ensureSchema(db);
  const r = await db.prepare('DELETE FROM inquiries WHERE id = ?1').bind(id).run();
  return r.meta.changes > 0;
}
