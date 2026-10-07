# グランブレス「心と暮らしのサポート」デモサイト

鹿児島県内で始める「心理×家事手伝い業」の、ご利用者様向けデモサイトと管理画面です。

| 用途 | Worker | 中身 |
|---|---|---|
| お客様向けサイト | `grand-bless` | サービス紹介・活用イメージ・料金シミュレーション・お問い合わせ |
| 管理画面（有川さん用） | `grand-bless-admin` | 料金・プラン・お知らせ・FAQ の編集、お問い合わせ管理（Basic 認証） |

正規URLは [docs/urls.md](docs/urls.md) を参照してください。

## 構成

```
public/            静的ファイル（両 Worker で共有）
  index.html       お客様向けページ
  admin.html       管理画面
  assets/data.js   料金・メニューなどの初期値（管理画面で保存した内容が優先）
src/site.ts        お客様向け Worker（/api/settings 取得・/api/inquiries 送信のみ）
src/admin.ts       管理画面 Worker（全ページ認証・設定と問い合わせの読み書き）
src/db.ts          D1（grand-bless-db）。テーブルは初回アクセス時に自動作成
```

- 設定と問い合わせは D1 `grand-bless-db` に保存し、2つの Worker で共有します。
- お客様向けサイトでは `/admin` などの管理画面のパスは 404 になります。
- `public/index.html` をファイルとして直接開くと、ブラウザ保存のデモモードで動きます。

## デプロイ

GitHub の `main` へ push すると、Cloudflare Workers Builds が2つの Worker をそれぞれデプロイします。

| Worker | Deploy command |
|---|---|
| grand-bless | `npx wrangler deploy` |
| grand-bless-admin | `npx wrangler deploy -c wrangler.admin.jsonc` |

Cloudflare アカウントは OFFICE PLATA（`d945eddc1446103b3696aa537e581563`）に固定しています。

### 管理画面のパスワード

```
npx wrangler secret put ADMIN_PASSWORD -c wrangler.admin.jsonc
```

ユーザー名は `wrangler.admin.jsonc` の `ADMIN_USER` です。パスワードが未設定のあいだ、管理画面には誰も入れません。

## ローカル開発

```
npm install
printf 'ADMIN_PASSWORD=localtest\n' > .dev.vars
npx wrangler dev --port 8787 --inspector-port 9331 --persist-to .wrangler/state
npx wrangler dev -c wrangler.admin.jsonc --port 8788 --persist-to .wrangler/state
```

## 料金の出典

- サポーターのランク料金（A 5,500／B 5,000／C 4,500／D 4,000円・1時間）: ⑦改訂版2「心理×家事手伝い業」登録心理カウンセラー募集のご案内
- 定期プラン・単発メニュー: ⑤グランブレスオススメメニュー
- 交通費・傾聴タイム・カウンセリング料金: 仮の値（管理画面で変更可）
