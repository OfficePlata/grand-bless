/* 管理画面 */
GBStore.init().then(function () {
  var S = GBStore.getSettings();
  var INQ = [];
  var yen = GBStore.yen, esc = GBStore.esc;
  var $ = function (id) { return document.getElementById(id); };
  var dirty = false;

  // ---------- 保存バー ----------
  function setMsg(text, cls) { var m = $('saveMsg'); m.textContent = text; m.className = 'msg ' + (cls || ''); }
  function markDirty() { dirty = true; setMsg('保存されていない変更があります', 'dirty'); }
  $('saveBtn').addEventListener('click', function () {
    setMsg('保存しています…');
    GBStore.saveSettings(S).then(function (ok) {
      if (ok) { dirty = false; setMsg('保存しました。サイトに反映されています', 'ok'); renderHome(); }
      else setMsg('保存できませんでした。通信状況を確認して、もう一度お試しください', 'dirty');
    });
  });
  $('revertBtn').addEventListener('click', function () {
    S = GBStore.getSettings(); dirty = false; renderAll(); setMsg('変更を取り消しました');
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- タブ ----------
  function showTab() {
    var id = (location.hash || '#home').slice(1);
    if (!$('p-' + id)) id = 'home';
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'p-' + id); });
    document.querySelectorAll('#tabs a').forEach(function (a) { a.classList.toggle('active', a.dataset.tab === id); });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', showTab);

  // ---------- 単一項目（data-k） ----------
  function getPath(path) { return path.split('.').reduce(function (o, k) { return o[k]; }, S); }
  function setPath(path, v) {
    var ks = path.split('.'), o = S;
    for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = v;
  }
  function renderFields() {
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var v = getPath(el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
    });
  }
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.k) return;
    var v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.hasAttribute('data-num')) v = el.value === '' ? 0 : Number(el.value);
    setPath(el.dataset.k, v);
    markDirty();
  });

  // ---------- 受付状況 ----------
  var STATUS = [['open', '受付中', '新しいご予約を受け付けています'], ['few', '残りわずか', '空きが少なくなっています'], ['full', '満枠', 'キャンセル待ちのみ受け付けます']];
  function renderStatus() {
    $('statusPick').innerHTML = STATUS.map(function (s) {
      return '<label class="choice"><input type="radio" name="status" value="' + s[0] + '"' + (S.availability.status === s[0] ? ' checked' : '') + '>' +
        '<span class="box"><b><span class="dot ' + s[0] + '"></span> ' + s[1] + '</b><small>' + s[2] + '</small></span></label>';
    }).join('');
  }
  $('statusPick').addEventListener('change', function (e) { S.availability.status = e.target.value; markDirty(); });

  // ---------- 一覧の編集 ----------
  var EDITORS = {
    ranks: { add: false, move: false, title: function (r) { return 'ランク' + r.id + '　' + r.name; },
      fields: [['name', 'サポーター名称', 'text'], ['price', '1時間の料金', 'yen'], ['who', '対象（資格など）', 'text'], ['desc', '紹介文', 'textarea']] },
    options: { add: true, move: true, title: function (o) { return o.name || '新しいオプション'; },
      blank: { name: '', price: 0, desc: '' },
      fields: [['name', '名称', 'text'], ['price', '料金（1回）', 'yen'], ['desc', '説明', 'text']] },
    transport: { add: true, move: true, title: function (t) { return t.name || '新しい地域'; },
      blank: { name: '', price: 0 },
      fields: [['name', '地域', 'text'], ['price', '交通費（空欄＝要相談）', 'yenNull']] },
    plans: { add: true, move: true, title: function (p) { return (p.featured ? '★ ' : '') + (p.name || '新しいプラン'); },
      blank: { name: '', badge: '', spec: '月2回 × 2時間', visits: 2, hours: 2, price: 0, priceFrom: false, featured: false, items: [] },
      fields: [['name', 'プラン名', 'text'], ['badge', 'ラベル（例：子育て家庭）', 'text'], ['spec', '回数・時間の表示', 'text'],
        ['price', '月額', 'yen'], ['visits', '月の回数', 'num'], ['hours', '1回の時間', 'num'],
        ['priceFrom', '「〜」を付ける', 'check'], ['featured', 'おすすめとして目立たせる', 'check'], ['items', '内容（1行に1つ）', 'lines']] },
    spots: { add: true, move: true, title: function (s) { return s.name || '新しいメニュー'; },
      blank: { name: '', price: 0, unit: '時間', desc: '' },
      fields: [['name', 'メニュー名', 'text'], ['price', '料金', 'yen'], ['unit', '単位（時間／回〜 など）', 'text'], ['desc', '説明', 'text']] },
    faqs: { add: true, move: true, title: function (f, i) { return 'Q' + (i + 1); },
      blank: { q: '', a: '' },
      fields: [['q', '質問', 'text'], ['a', '回答', 'textarea']] }
  };

  function fieldHtml(f, item) {
    var k = f[0], label = f[1], type = f[2], v = item[k];
    if (type === 'check') return '<label class="switch"><input type="checkbox" data-f="' + k + '" data-t="check"' + (v ? ' checked' : '') + '>' + esc(label) + '</label>';
    var input;
    if (type === 'textarea') input = '<textarea class="input" rows="3" data-f="' + k + '" data-t="text">' + esc(v) + '</textarea>';
    else if (type === 'lines') input = '<textarea class="input" rows="4" data-f="' + k + '" data-t="lines">' + esc((v || []).join('\n')) + '</textarea>';
    else if (type === 'yen' || type === 'yenNull') input = '<span class="yen-input"><input class="input" type="number" step="100" min="0" data-f="' + k + '" data-t="' + type + '" value="' + (v == null ? '' : v) + '"></span>';
    else if (type === 'num') input = '<input class="input" type="number" step="0.5" min="0" data-f="' + k + '" data-t="num" value="' + (v == null ? '' : v) + '">';
    else input = '<input class="input" data-f="' + k + '" data-t="text" value="' + esc(v) + '">';
    var wide = type === 'textarea' || type === 'lines' ? ' style="grid-column:1/-1"' : '';
    return '<label class="field"' + wide + '><span>' + esc(label) + '</span>' + input + '</label>';
  }

  function renderEditor(key) {
    var cfg = EDITORS[key], list = S[key], el = $('ed-' + key);
    el.innerHTML = list.map(function (item, i) {
      var tools = '';
      if (cfg.move) tools += '<button class="icon-btn" data-act="up" title="上へ">↑</button><button class="icon-btn" data-act="down" title="下へ">↓</button>';
      if (cfg.add) tools += '<button class="icon-btn danger" data-act="del">削除</button>';
      return '<div class="row-edit" data-i="' + i + '"><div class="head"><span>' + esc(cfg.title(item, i)) + '</span><span class="tools">' + tools + '</span></div>' +
        '<div class="grid">' + cfg.fields.map(function (f) { return fieldHtml(f, item); }).join('') + '</div></div>';
    }).join('') + (cfg.add ? '<button class="btn small ghost" data-act="add">＋ 追加する</button>' : '');
  }

  Object.keys(EDITORS).forEach(function (key) {
    var el = $('ed-' + key), cfg = EDITORS[key];
    el.addEventListener('input', function (e) {
      var t = e.target; if (!t.dataset.f) return;
      var i = +t.closest('[data-i]').dataset.i, type = t.dataset.t, v;
      if (type === 'check') v = t.checked;
      else if (type === 'lines') v = t.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else if (type === 'yen' || type === 'num') v = t.value === '' ? 0 : Number(t.value);
      else if (type === 'yenNull') v = t.value === '' ? null : Number(t.value);
      else v = t.value;
      S[key][i][t.dataset.f] = v;
      var head = t.closest('.row-edit').querySelector('.head > span');
      head.textContent = cfg.title(S[key][i], i);
      markDirty();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act, row = b.closest('[data-i]'), i = row ? +row.dataset.i : -1, list = S[key];
      if (act === 'add') {
        var item = JSON.parse(JSON.stringify(cfg.blank)); item.id = key + Date.now();
        list.push(item);
      } else if (act === 'up' && i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); }
      else if (act === 'down' && i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); }
      else if (act === 'del') {
        if (list.length <= 1) { setMsg('最後の1件は削除できません', 'dirty'); return; }
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'もう一度押すと削除'; return; }
        list.splice(i, 1);
      } else return;
      renderEditor(key); markDirty();
    });
  });

  // ---------- お問い合わせ ----------
  var INQ_STATUS = { new: '新着', doing: '対応中', done: '完了' };
  function renderInquiries() {
    return GBStore.getInquiries().then(function (list) { INQ = list; drawInquiries(list); })
      .catch(function () { $('inqList').innerHTML = '<div class="box empty">お問い合わせを読み込めませんでした。</div>'; });
  }
  function drawInquiries(list) {
    var n = list.filter(function (q) { return q.status === 'new'; }).length;
    $('newCount').textContent = n; $('newCount').hidden = n === 0;
    $('kNew').innerHTML = n + '<small>件</small>';
    if (!list.length) {
      $('inqList').innerHTML = '<div class="box empty">まだお問い合わせはありません。<br>サイトのフォームから送信するか、「サンプルを3件入れる」でお試しください。</div>';
      return;
    }
    $('inqList').innerHTML = list.map(function (q) {
      var d = new Date(q.createdAt);
      var when = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
      return '<div class="inq ' + q.status + '" data-id="' + esc(q.id) + '"><div class="top"><div>' +
        '<div class="name">' + esc(q.name) + ' 様</div><div class="meta">' + esc(when) + '｜' + esc(q.contact) + (q.area ? '｜' + esc(q.area) : '') + (q.date ? '｜希望：' + esc(q.date) : '') + '</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center"><select class="input" data-act="status">' +
        Object.keys(INQ_STATUS).map(function (k) { return '<option value="' + k + '"' + (q.status === k ? ' selected' : '') + '>' + INQ_STATUS[k] + '</option>'; }).join('') +
        '</select><button class="icon-btn danger" data-act="del">削除</button></div></div>' +
        (q.needs && q.needs.length ? '<div class="tags">' + q.needs.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        (q.message ? '<div class="body">' + esc(q.message) + '</div>' : '') +
        (q.sim ? '<div class="sim">試算：' + esc(q.sim) + '</div>' : '') + '</div>';
    }).join('');
  }
  $('inqList').addEventListener('change', function (e) {
    if (e.target.dataset.act !== 'status') return;
    var id = e.target.closest('[data-id]').dataset.id;
    GBStore.updateInquiry(id, e.target.value).then(renderInquiries, renderInquiries);
  });
  $('inqList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act=del]'); if (!b) return;
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'もう一度押すと削除'; return; }
    var id = b.closest('[data-id]').dataset.id;
    GBStore.deleteInquiry(id).then(renderInquiries, renderInquiries);
  });
  $('inqSample').addEventListener('click', function () {
    var now = Date.now(), samples = [
      { name: 'サンプル 花子', contact: '090-0000-0001', area: '鹿児島市 紫原', needs: ['掃除・洗濯', '料理・つくりおき', 'お話を聴いてほしい'], date: '平日の夕方', message: '共働きで小学生が2人います。週末にまとめて家事をするのが限界で、相談したいです。', sim: 'ライフサポーター／2時間／月2回（定期）／傾聴タイム（30分）／鹿児島市内　→ 月額 24,000円', status: 'new' },
      { name: 'サンプル 一郎', contact: 'sample@example.com', area: '日置市（実家）', needs: ['見守り・話し相手', '買い物'], date: '10月中旬から', message: '福岡在住です。日置市でひとり暮らしの母（82歳）の様子を見てもらいたいです。', sim: '', status: 'doing' },
      { name: 'サンプル 商事', contact: '099-000-0002', area: '鹿児島市', needs: ['法人での導入'], date: '', message: '社員30名の会社です。福利厚生として導入を検討しています。説明に来ていただけますか。', sim: '', status: 'done' }
    ];
    samples.forEach(function (s, i) { s.createdAt = new Date(now - i * 86400000).toISOString(); });
    Promise.all(samples.map(function (s) { return GBStore.addInquiry(s); })).then(renderInquiries);
  });
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  $('inqCsv').addEventListener('click', function () {
    var rows = [['受信日時', '状況', 'お名前', '連絡先', '地域', '希望サポート', '希望日時', '相談内容', '試算']];
    INQ.forEach(function (q) {
      rows.push([new Date(q.createdAt).toLocaleString('ja-JP'), INQ_STATUS[q.status], q.name, q.contact, q.area, (q.needs || []).join('・'), q.date, q.message, q.sim]);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    download('お問い合わせ一覧.csv', '﻿' + csv, 'text/csv');
  });

  // ---------- ホーム ----------
  var ST_LABEL = { open: '受付中', few: '残りわずか', full: '満枠' };
  function renderHome() {
    $('kStatus').innerHTML = '<span class="dot ' + esc(S.availability.status) + '"></span> ' + ST_LABEL[S.availability.status];
    var f = S.plans.filter(function (p) { return p.featured; })[0] || S.plans[0];
    $('kPlan').innerHTML = f ? esc(f.name) + '<br><small>月額' + yen(f.price) + '</small>' : '—';
    calcRevenue();
  }
  function calcRevenue() {
    var h = +$('rvHouse').value, avg = +$('rvAvg').value, sp = +$('rvSpot').value, spp = +$('rvSpotP').value;
    $('rvHouseV').textContent = h + '世帯';
    $('rvAvgV').textContent = yen(avg);
    $('rvSpotV').textContent = sp + '件';
    $('rvSpotPV').textContent = yen(spp);
    var sales = h * avg + sp * spp;
    var man = function (n) { return (Math.round(n / 1000) / 10).toLocaleString('ja-JP') + '万円'; };
    $('rvSales').textContent = man(sales);
    $('rvPay').textContent = man(sales * 0.7);
    $('rvGross').textContent = man(sales * 0.3);
  }
  ['rvHouse', 'rvAvg', 'rvSpot', 'rvSpotP'].forEach(function (id) { $(id).addEventListener('input', calcRevenue); });

  // ---------- データ管理 ----------
  $('exportBtn').addEventListener('click', function () {
    var d = new Date(), stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    download('グランブレス設定_' + stamp + '.json', JSON.stringify(S, null, 2), 'application/json');
  });
  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var obj = JSON.parse(r.result);
        if (!obj || !obj.ranks || !obj.plans) throw new Error('形式が違います');
        obj.version = GBStore.defaults().version;
        obj.personas = GBStore.defaults().personas;
        S = obj; renderAll(); markDirty();
        setMsg('読み込みました。内容を確認して「変更を保存」を押してください', 'dirty');
      } catch (err) { setMsg('読み込めませんでした：' + err.message, 'dirty'); }
      e.target.value = '';
    };
    r.readAsText(file);
  });
  $('resetBtn').addEventListener('click', function () {
    var b = $('resetBtn');
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; $('resetConfirm').hidden = false; return; }
    GBStore.resetSettings().then(function (ok) {
      S = GBStore.getSettings(); dirty = false; renderAll();
      b.dataset.armed = ''; $('resetConfirm').hidden = true;
      setMsg(ok ? '初期状態に戻しました' : '戻せませんでした。もう一度お試しください', ok ? 'ok' : 'dirty');
    });
  });

  // ---------- 初期表示 ----------
  $('demoBar').textContent = GBStore.mode === 'api'
    ? 'DEMO｜管理画面のデモです。保存した内容はすぐにサイトへ反映されます。'
    : 'DEMO｜管理画面のデモです（ローカル表示）。変更はこのブラウザにだけ保存されます。';
  if (GBStore.meta.siteUrl) document.querySelectorAll('a[href="index.html"]').forEach(function (a) { a.href = GBStore.meta.siteUrl; });

  function renderAll() {
    renderFields(); renderStatus();
    Object.keys(EDITORS).forEach(renderEditor);
    renderInquiries(); renderHome();
  }
  renderAll();
  showTab();
});
