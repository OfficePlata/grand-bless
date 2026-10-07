// 管理画面（grand-bless-admin）— 全ページ Basic 認証
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import {
  addInquiry,
  deleteInquiry,
  deleteSettings,
  getSettings,
  listInquiries,
  parseInquiry,
  putSettings,
  STATUSES,
  updateInquiryStatus,
  type Env,
} from './db';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  // パスワード未設定なら誰も入れない
  if (!c.env.ADMIN_PASSWORD) return c.text('管理画面のパスワードが設定されていません', 503);
  const auth = basicAuth({
    username: c.env.ADMIN_USER || 'admin',
    password: c.env.ADMIN_PASSWORD,
    realm: 'Grand Bress Admin',
  });
  return auth(c, next);
});

app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

// ---- 設定 ----
app.get('/api/settings', async (c) =>
  c.json({ settings: await getSettings(c.env.DB), meta: { siteUrl: c.env.SITE_URL || null } }),
);

app.put('/api/settings', async (c) => {
  const len = Number(c.req.header('content-length') || 0);
  if (len > 300_000) return c.json({ error: 'too large' }, 413);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || !Array.isArray(body.ranks) || !Array.isArray(body.plans)) {
    return c.json({ error: '設定の形式が正しくありません' }, 400);
  }
  delete body.personas;
  await putSettings(c.env.DB, body);
  return c.json({ ok: true });
});

app.delete('/api/settings', async (c) => {
  await deleteSettings(c.env.DB);
  return c.json({ ok: true });
});

// ---- お問い合わせ ----
app.get('/api/inquiries', async (c) => c.json({ inquiries: await listInquiries(c.env.DB) }));

app.post('/api/inquiries', async (c) => {
  const q = parseInquiry(await c.req.json().catch(() => null), { allowMeta: true });
  if (!q) return c.json({ error: 'お名前と連絡先は必須です' }, 400);
  await addInquiry(c.env.DB, q);
  return c.json({ ok: true, id: q.id });
});

app.patch('/api/inquiries/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !STATUSES.includes(body.status)) return c.json({ error: 'status が不正です' }, 400);
  const ok = await updateInquiryStatus(c.env.DB, c.req.param('id'), body.status);
  return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/inquiries/:id', async (c) => {
  const ok = await deleteInquiry(c.env.DB, c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// ---- 画面 ----
// トップは管理画面。それ以外（お客様ページのプレビュー・CSS/JS）は静的ファイル
app.get('/', (c) => c.env.ASSETS.fetch(new Request(new URL('/admin', c.req.url), c.req.raw)));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
