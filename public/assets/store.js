/*
 * 設定と問い合わせの保存
 * - Cloudflare Workers 上では API（/api/...）経由で D1 に保存（mode = 'api'）
 * - ファイルを直接開いた場合などは、このブラウザの localStorage に保存（mode = 'local'）
 */
(function () {
  var KEY_SETTINGS = 'gb-kaji-demo:settings';
  var KEY_INQUIRIES = 'gb-kaji-demo:inquiries';
  var settings = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function read(key) {
    try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  // 保存済みの設定を初期データと整合させる
  function normalize(saved) {
    var base = clone(window.GB_DEFAULTS);
    if (!saved || saved.version !== base.version) return base;
    saved.personas = base.personas; // 活用イメージは data.js 側が正
    return saved;
  }
  function api(method, path, body) {
    return fetch('api/' + path, {
      method: method,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  var Store = {
    mode: 'local',
    meta: {},

    init: function () {
      if (location.protocol === 'file:') {
        settings = normalize(read(KEY_SETTINGS));
        return Promise.resolve();
      }
      return api('GET', 'settings').then(function (d) {
        Store.mode = 'api';
        Store.meta = d.meta || {};
        settings = normalize(d.settings);
      }).catch(function () {
        Store.mode = 'local';
        settings = normalize(read(KEY_SETTINGS));
      });
    },

    getSettings: function () { return clone(settings); },
    defaults: function () { return clone(window.GB_DEFAULTS); },

    saveSettings: function (s) {
      var data = clone(s); delete data.personas;
      if (Store.mode === 'api') {
        return api('PUT', 'settings', data).then(function () { settings = normalize(clone(s)); return true; })
          .catch(function () { return false; });
      }
      var ok = write(KEY_SETTINGS, data);
      if (ok) settings = normalize(clone(s));
      return Promise.resolve(ok);
    },
    resetSettings: function () {
      settings = normalize(null);
      if (Store.mode === 'api') return api('DELETE', 'settings').then(function () { return true; }).catch(function () { return false; });
      try { localStorage.removeItem(KEY_SETTINGS); } catch (e) {}
      return Promise.resolve(true);
    },

    getInquiries: function () {
      if (Store.mode === 'api') return api('GET', 'inquiries').then(function (d) { return d.inquiries; });
      return Promise.resolve(read(KEY_INQUIRIES) || []);
    },
    addInquiry: function (item) {
      if (Store.mode === 'api') return api('POST', 'inquiries', item).then(function () { return true; }).catch(function () { return false; });
      var list = read(KEY_INQUIRIES) || [];
      item.id = item.id || 'q' + Date.now() + Math.random().toString(36).slice(2, 6);
      item.createdAt = item.createdAt || new Date().toISOString();
      item.status = item.status || 'new';
      list.unshift(item);
      list.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      return Promise.resolve(write(KEY_INQUIRIES, list));
    },
    updateInquiry: function (id, status) {
      if (Store.mode === 'api') return api('PATCH', 'inquiries/' + encodeURIComponent(id), { status: status });
      var list = read(KEY_INQUIRIES) || [];
      list.forEach(function (q) { if (q.id === id) q.status = status; });
      return Promise.resolve(write(KEY_INQUIRIES, list));
    },
    deleteInquiry: function (id) {
      if (Store.mode === 'api') return api('DELETE', 'inquiries/' + encodeURIComponent(id));
      var list = (read(KEY_INQUIRIES) || []).filter(function (q) { return q.id !== id; });
      return Promise.resolve(write(KEY_INQUIRIES, list));
    },

    yen: function (n) { return n == null ? '要相談' : n.toLocaleString('ja-JP') + '円'; },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    nl2br: function (s) { return Store.esc(s).replace(/\n/g, '<br>'); }
  };
  window.GBStore = Store;
})();
