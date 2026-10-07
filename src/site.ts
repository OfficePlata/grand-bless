// お客様向けサイト（grand-bless）
// 静的ファイルは assets から直接配信。ここに来るのは /api/* と管理画面関連のパスだけ。
import { Hono } from 'hono';
import { addInquiry, getSettings, parseInquiry, type Env } from './db';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/settings', async (c) => {
  const settings = await getSettings(c.env.DB);
  c.header('Cache-Control', 'no-store');
  return c.json({ settings, meta: { adminUrl: c.env.ADMIN_URL || null } });
});

app.post('/api/inquiries', async (c) => {
  const len = Number(c.req.header('content-length') || 0);
  if (len > 20_000) return c.json({ error: 'too large' }, 413);
  const body = await c.req.json().catch(() => null);
  // ボット対策（見えない入力欄に値があれば受け付けたふりをして捨てる）
  if (body && typeof body.website === 'string' && body.website) return c.json({ ok: true });
  const q = parseInquiry(body, { allowMeta: false });
  if (!q) return c.json({ error: 'お名前と連絡先は必須です' }, 400);
  await addInquiry(c.env.DB, q);
  return c.json({ ok: true });
});

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// 管理画面はこのサイトでは公開しない
app.all('*', (c) => c.text('Not Found', 404));

export default app;
