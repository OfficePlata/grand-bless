/* お客様向けページの描画と料金シミュレーション */
GBStore.init().then(function () {
  var S = GBStore.getSettings();
  var yen = GBStore.yen, esc = GBStore.esc, nl2br = GBStore.nl2br;
  var $ = function (id) { return document.getElementById(id); };

  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, S);
  }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function hoursLabel(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return hh + '時間' + (mm ? mm + '分' : '');
  }

  // ---------- 文言の差し込み ----------
  document.querySelectorAll('[data-bind]').forEach(function (el) {
    var v = get(el.getAttribute('data-bind'));
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-bind-html]').forEach(function (el) {
    var v = get(el.getAttribute('data-bind-html'));
    if (v != null) el.innerHTML = nl2br(v);
  });

  if (S.notice.show && S.notice.text) {
    $('notice').textContent = S.notice.text;
    $('notice').hidden = false;
  }

  var STATUS = { open: '受付中', few: '残りわずか', full: '現在満枠（キャンセル待ち受付中）' };
  $('heroStatus').innerHTML = '<span class="dot ' + esc(S.availability.status) + '"></span>今月のご予約：<b>' +
    esc(STATUS[S.availability.status] || '') + '</b>' +
    (S.availability.note ? '<span class="note">｜' + esc(S.availability.note) + '</span>' : '');

  // ---------- メニュー（スマホ） ----------
  var nav = $('nav'), menuBtn = $('menuBtn');
  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); }
  });

  // ---------- 料金シミュレーション ----------
  var R = S.rules;
  var sim = { rank: S.ranks[1] ? S.ranks[1].id : S.ranks[0].id, hours: R.minHours, freq: 'm2',
              options: {}, counseling: false, corporate: false, area: S.transport[0].id };

  $('simRanks').innerHTML = S.ranks.map(function (r) {
    return '<label class="choice"><input type="radio" name="rank" value="' + esc(r.id) + '">' +
      '<span class="box"><b><span class="rank-letter">' + esc(r.id) + '</span>' + esc(r.name) + '</b>' +
      '<span class="p">' + yen(r.price) + '</span><span class="note">／1時間</span>' +
      '<small>' + esc(r.who) + '</small></span></label>';
  }).join('');

  $('simFreq').innerHTML = S.frequencies.map(function (f) {
    return '<label class="choice"><input type="radio" name="freq" value="' + esc(f.id) + '">' +
      '<span class="box"><b>' + esc(f.name) + '</b><small>' + esc(f.sub) + '</small></span></label>';
  }).join('');

  var optHtml = S.options.map(function (o) {
    return '<label class="check"><input type="checkbox" name="opt" value="' + esc(o.id) + '">' +
      '<span><b>' + esc(o.name) + '</b><small>' + esc(o.desc) + '</small></span>' +
      '<span class="p">' + (o.price ? '+' + yen(o.price) + '/回' : '無料') + '</span></label>';
  }).join('');
  optHtml += '<label class="check"><input type="checkbox" id="optCounsel">' +
    '<span><b>' + esc(S.counseling.name) + '</b><small>心理的な課題を専門的にご相談いただけます（月1回として計算）。</small></span>' +
    '<span class="p">+' + yen(S.counseling.price) + '</span></label>';
  optHtml += '<label class="check"><input type="checkbox" id="optCorp">' +
    '<span><b>勤務先の福利厚生補助を使う</b><small>導入企業の社員の方は、会社が利用料の一部を補助します（例）。</small></span>' +
    '<span class="p">−' + yen(S.corporate.subsidy) + '</span></label>';
  $('simOpts').innerHTML = optHtml;

  $('simArea').innerHTML = S.transport.map(function (t) {
    return '<option value="' + esc(t.id) + '">' + esc(t.name) + '（交通費 ' + (t.price == null ? '要相談' : yen(t.price) + '/回') + '）</option>';
  }).join('');

  function calc() {
    var rank = byId(S.ranks, sim.rank), freq = byId(S.frequencies, sim.freq), area = byId(S.transport, sim.area);
    var lines = [];
    var base = rank.price * sim.hours;
    var perVisit = base;
    lines.push([rank.name + '（' + yen(rank.price) + ' × ' + hoursLabel(sim.hours) + '）', base]);
    S.options.forEach(function (o) {
      if (sim.options[o.id]) { perVisit += o.price; lines.push([o.name, o.price]); }
    });
    var tp = area.price;
    if (tp != null) { perVisit += tp; lines.push(['交通費（' + area.name + '）', tp]); }
    else lines.push(['交通費（' + area.name + '）', null]);

    var total = perVisit * freq.visits;
    var out = [];
    lines.forEach(function (l) {
      out.push('<li><span>' + esc(l[0]) + '</span><span>' + (l[1] == null ? '要相談' : yen(l[1])) + '</span></li>');
    });
    if (freq.visits > 1) out.push('<li><span>1回あたり × 月' + freq.visits + '回</span><span>' + yen(total) + '</span></li>');
    if (sim.counseling) {
      total += S.counseling.price;
      out.push('<li class="extra"><span>' + esc(S.counseling.name) + '</span><span>+' + yen(S.counseling.price) + '</span></li>');
    }
    if (sim.corporate) {
      var sub = Math.min(S.corporate.subsidy, total);
      total -= sub;
      out.push('<li class="minus"><span>福利厚生補助（会社負担）</span><span>−' + yen(sub) + '</span></li>');
    }

    $('rLabel').textContent = freq.visits > 1 ? '月額の目安' : '1回あたりの目安';
    $('rTotal').innerHTML = total.toLocaleString('ja-JP') + '<small>円' + (tp == null ? '＋交通費' : '') + '</small>';
    $('rPer').textContent = freq.visits > 1
      ? '1回あたり ' + yen(perVisit) + '・' + hoursLabel(sim.hours) + ' × 月' + freq.visits + '回'
      : hoursLabel(sim.hours) + '・' + rank.name;
    $('rBreak').innerHTML = out.join('');

    // 同じ回数・時間の定期プランがあれば案内
    var match = S.plans.filter(function (p) { return p.visits === freq.visits && p.hours === sim.hours; })
      .sort(function (a, b) { return a.price - b.price; })[0];
    var hint = $('rHint');
    if (match && freq.visits > 1) {
      hint.innerHTML = '月' + match.visits + '回 × ' + hoursLabel(match.hours) + 'なら、定期プラン<b>「' + esc(match.name) + '」月額' +
        yen(match.price) + (match.priceFrom ? '〜' : '') + '</b>もお選びいただけます。<a href="#plans">プランを見る</a>';
      hint.hidden = false;
    } else if (freq.visits === 1) {
      hint.innerHTML = '定期でご利用いただくと、毎回同じ担当者がうかがいます。';
      hint.hidden = false;
    } else hint.hidden = true;

    $('hOut').textContent = hoursLabel(sim.hours);
    $('hMinus').disabled = sim.hours <= R.minHours;
    $('hPlus').disabled = sim.hours >= R.maxHours;
    $('hNote').textContent = '最低' + hoursLabel(R.minHours) + 'から、' + (R.hourStep * 60) + '分単位でご利用いただけます。';
    return { rank: rank, freq: freq, area: area, total: total, perVisit: perVisit, transportUnknown: tp == null };
  }

  function syncForm() {
    document.querySelectorAll('input[name=rank]').forEach(function (i) { i.checked = i.value === sim.rank; });
    document.querySelectorAll('input[name=freq]').forEach(function (i) { i.checked = i.value === sim.freq; });
    document.querySelectorAll('input[name=opt]').forEach(function (i) { i.checked = !!sim.options[i.value]; });
    $('optCounsel').checked = sim.counseling;
    $('optCorp').checked = sim.corporate;
    $('simArea').value = sim.area;
    calc();
  }

  $('simForm').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'rank') sim.rank = t.value;
    else if (t.name === 'freq') sim.freq = t.value;
    else if (t.name === 'opt') sim.options[t.value] = t.checked;
    else if (t.id === 'optCounsel') sim.counseling = t.checked;
    else if (t.id === 'optCorp') sim.corporate = t.checked;
    else if (t.id === 'simArea') sim.area = t.value;
    calc();
  });
  $('hMinus').addEventListener('click', function () { sim.hours = Math.max(R.minHours, sim.hours - R.hourStep); calc(); });
  $('hPlus').addEventListener('click', function () { sim.hours = Math.min(R.maxHours, sim.hours + R.hourStep); calc(); });

  function simSummary() {
    var c = calc();
    var opts = S.options.filter(function (o) { return sim.options[o.id]; }).map(function (o) { return o.name; });
    if (sim.counseling) opts.push(S.counseling.name);
    if (sim.corporate) opts.push('福利厚生補助');
    return c.rank.name + '／' + hoursLabel(sim.hours) + '／' + c.freq.name + '（' + c.freq.sub + '）' +
      (opts.length ? '／' + opts.join('・') : '') + '／' + c.area.name +
      '　→ ' + (c.freq.visits > 1 ? '月額' : '1回') + ' ' + yen(c.total) + (c.transportUnknown ? '＋交通費' : '');
  }

  $('rConsult').addEventListener('click', function () {
    var f = $('contactForm');
    if (!f) return;
    var s = simSummary();
    f.sim.value = s;
    if (!f.message.value) f.message.value = '料金シミュレーションの内容で相談したいです。\n' + s;
    location.hash = '#contact';
  });

  // ---------- 活用イメージ ----------
  function renderPersona(id) {
    var p = byId(S.personas, id);
    document.querySelectorAll('#personaTabs button').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.id === id);
    });
    var plan = p.plan ? byId(S.plans, p.plan) : null;
    var spot = p.spot ? byId(S.spots, p.spot) : null;
    var rec = plan ? '<b>' + esc(plan.name) + '</b>　月額' + yen(plan.price) + (plan.priceFrom ? '〜' : '') + '（' + esc(plan.spec) + '）'
      : spot ? '<b>' + esc(spot.name) + '</b>　' + yen(spot.price) + '／' + esc(spot.unit)
      : '<b>法人向けプラン</b>　内容・補助額はご相談のうえ設計します';
    var isSteps = /^STEP/.test(p.timeline[0][0]);
    $('personaBody').innerHTML =
      '<div class="persona" role="tabpanel">' +
        '<div class="card"><h3>' + esc(p.title) + '</h3>' +
          '<p class="timeline-title">こんなお悩みはありませんか？</p>' +
          '<ul class="worries">' + p.worries.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' +
          '<div class="voice">「' + esc(p.voice) + '」<small>' + esc(p.voiceBy) + '（ご利用イメージ）</small></div>' +
        '</div>' +
        '<div class="card"><p class="timeline-title">' + (isSteps ? 'ご導入の流れ' : 'たとえば、ある日の訪問') + '</p>' +
          '<ol class="timeline">' + p.timeline.map(function (t) {
            return '<li><span class="t">' + esc(t[0]) + '</span><span class="d">' + esc(t[1]) + '</span></li>';
          }).join('') + '</ol>' +
          '<div class="persona-foot"><div class="rec">おすすめ：' + rec + '</div>' +
          '<button type="button" class="btn small" id="personaSim">この例で料金を試算する</button></div>' +
        '</div>' +
      '</div>';
    $('personaSim').addEventListener('click', function () {
      var ps = p.sim, opts = {};
      (ps.options || []).forEach(function (o) { opts[o] = true; });
      sim = { rank: ps.rank, hours: ps.hours, freq: ps.freq, options: opts, counseling: false,
              corporate: !!ps.corporate, area: ps.area || S.transport[0].id };
      syncForm();
      location.hash = '#simulator';
    });
  }
  $('personaTabs').innerHTML = S.personas.map(function (p) {
    return '<button type="button" role="tab" data-id="' + esc(p.id) + '">' + esc(p.label) + '</button>';
  }).join('');
  $('personaTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) renderPersona(b.dataset.id);
  });

  // ---------- プラン・メニュー・サポーター・FAQ ----------
  $('plansGrid').innerHTML = S.plans.map(function (p) {
    return '<div class="plan' + (p.featured ? ' featured' : '') + '">' +
      (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '<span class="badge" style="visibility:hidden">-</span>') +
      '<h3>' + esc(p.name) + '</h3><div class="spec">' + esc(p.spec) + '</div>' +
      '<div class="price">' + p.price.toLocaleString('ja-JP') + '<small>円' + (p.priceFrom ? '〜' : '') + '／月</small></div>' +
      '<ul>' + p.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      '<a class="btn ' + (p.featured ? '' : 'ghost') + ' small" href="#contact" data-plan="' + esc(p.name) + '">このプランで相談</a></div>';
  }).join('');

  $('spotsGrid').innerHTML = S.spots.map(function (s) {
    return '<div class="spot"><div class="row"><b>' + esc(s.name) + '</b><span class="p">' + yen(s.price) +
      '<span class="note">／' + esc(s.unit) + '</span></span></div><p>' + esc(s.desc) + '</p></div>';
  }).join('');

  $('ranksGrid').innerHTML = S.ranks.map(function (r) {
    return '<div class="rank"><div class="avatar">' + esc(r.id) + '</div><h3>' + esc(r.name) + '</h3>' +
      '<div class="who">' + esc(r.who) + '</div><p>' + esc(r.desc) + '</p>' +
      '<div class="p">' + yen(r.price) + '<span class="note">／1時間</span></div></div>';
  }).join('');

  $('faqList').innerHTML = S.faqs.map(function (f) {
    return '<details><summary>' + esc(f.q) + '</summary><div class="a">' + nl2br(f.a) + '</div></details>';
  }).join('');

  // ---------- お問い合わせ ----------
  var NEEDS = ['掃除・洗濯', '料理・つくりおき', '買い物', '整理・片付け', '墓掃除', '庭・DIY', '見守り・話し相手', 'お話を聴いてほしい', '法人での導入'];
  $('needChips').innerHTML = NEEDS.map(function (n) {
    return '<label><input type="checkbox" name="needs" value="' + esc(n) + '">' + esc(n) + '</label>';
  }).join('');

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-plan]');
    if (!a) return;
    var f = $('contactForm');
    if (f && !f.message.value) f.message.value = '「' + a.dataset.plan + '」について相談したいです。';
  });

  if (GBStore.meta.adminUrl) document.querySelectorAll('a[href="admin.html"]').forEach(function (a) { a.href = GBStore.meta.adminUrl; });

  $('contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('button[type=submit]');
    if (btn.disabled) return;
    var needs = Array.prototype.map.call(f.querySelectorAll('input[name=needs]:checked'), function (i) { return i.value; });
    btn.disabled = true; btn.textContent = '送信しています…';
    GBStore.addInquiry({
      name: f.elements.namedItem('name').value.trim(), contact: f.contact.value.trim(), area: f.area.value.trim(),
      needs: needs, date: f.date.value.trim(), message: f.message.value.trim(), sim: f.sim.value,
      website: f.website.value
    }).then(function (ok) {
      if (!ok) {
        btn.disabled = false; btn.textContent = 'この内容で送信する';
        alertBox('送信できませんでした。時間をおいてもう一度お試しいただくか、お電話でご連絡ください。');
        return;
      }
      $('formCard').innerHTML = '<div class="thanks"><h3>ご相談ありがとうございます</h3>' +
        '<p>担当者より、2営業日以内にご連絡いたします。</p>' +
        '<p class="note" style="margin-top:16px">※デモサイトです。送信内容は管理画面の「お問い合わせ」に届きます。</p></div>';
    });
  });
  function alertBox(msg) {
    var p = document.getElementById('formErr');
    if (!p) { p = document.createElement('p'); p.id = 'formErr'; p.className = 'note'; p.style.color = 'var(--ng)'; $('contactForm').appendChild(p); }
    p.textContent = msg;
  }

  // ---------- 初期表示 ----------
  renderPersona(S.personas[0].id);
  syncForm();
});
