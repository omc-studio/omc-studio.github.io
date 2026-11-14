/* AMC bundle-play.js — 手工顺序拼接，勿手改；顺序：gate.js → util.js → from.js → api.js → address.js → live.js → chart.js → nav.js → account.js → prewarm.js → play.js */
(function () {
  'use strict';
  if (window.__MCW_BUNDLE_STARTED__) return;
  window.__MCW_BUNDLE_STARTED__ = true;
  var errors = window.__MCW_BUNDLE_ERRORS__ = [];
  function seg(name, fn) {
    try { fn(); } catch (e) {
      errors.push(name + ': ' + (e && e.message ? e.message : String(e)));
      if (window.console && console.error) console.error('[bundle] ' + name, e);
    }
  }
  function warn() {
    try {
      if (document.getElementById('mcw-boot-warn')) return;
      var d = document.createElement('div');
      d.id = 'mcw-boot-warn';
      d.textContent = '部分功能未加载，请刷新';
      d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#3a1d1d;color:#ffd7d7;border:1px solid #7a2b2b;padding:8px 12px;font:13px/1.5 system-ui;';
      (document.body || document.documentElement).appendChild(d);
    } catch (e) {}
  }
  window.__MCW_BUNDLE_WARN__ = warn;
  /* ===== assets/js/gate.js ===== */
  seg("gate.js", function () {
/* AMC 访问门（按需）：默认不拦截浏览，只在敏感动作前要求人机验证。
 * 安全边界在服务端：Worker 对 register/login/2fa/pass/trade 等 POST 一律校验 Turnstile，
 * 缺 token 回 403 turnstile_required，前端据此跳 verify.html 再重试。
 * 这样首屏不付 Turnstile 的 RTT（实测 800ms+），也不会因为挑战跑不完把整站锁死（本机实测错误码 600010）。
 * 如需恢复全站强制门：config.js 里 gateMode: "all"。
 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var CACHE_KEY = 'omc_ts_token';
  var TTL = 5 * 60 * 1000;
  var DEFAULT_NEXT = '/';
  var MODE = String(CFG.gateMode || 'on-demand').toLowerCase();
  var hosts = [];

  (CFG.internalHosts || []).forEach(function (h) {
    var s = String(h || '').trim().toLowerCase();
    if (s && hosts.indexOf(s) === -1) hosts.push(s);
  });

  function readToken() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return '';
      var o = JSON.parse(raw);
      var t = String((o && o.token) || '').trim();
      var exp = Number((o && o.exp) || 0);
      var now = Date.now();
      if (!t || !isFinite(exp) || exp <= now || exp > now + TTL) {
        localStorage.removeItem(CACHE_KEY);
        return '';
      }
      return t;
    } catch (e) { return ''; }
  }

  function tokenValid() { return !!readToken(); }

  function parseUrl(raw) {
    try { return new URL(String(raw || ''), location.href); } catch (e) { return null; }
  }

  function hostIsInternal(host) {
    return hosts.indexOf(String(host || '').toLowerCase()) !== -1;
  }

  function urlIsInternal(raw) {
    if (!raw || !String(raw).trim()) return false;
    var u = parseUrl(raw);
    if (!u) return false;
    return u.origin === location.origin || hostIsInternal(u.hostname);
  }

  function isVerifyPage() {
    return /(^|\/)verify(\.html)?$/i.test(location.pathname);
  }

  function nextPath() {
    var s = String(location.pathname || '') + String(location.search || '') + String(location.hash || '');
    if (!s || s.charAt(0) !== '/' || s.slice(0, 2) === '//') return DEFAULT_NEXT;
    return s;
  }

  /* 只有全站模式才在首屏判断；按需模式下 shouldRedirect 恒为 false */
  function shouldRedirect() {
    if (MODE !== 'all') return false;
    if (isVerifyPage()) return false;
    if (tokenValid()) return false;
    if (urlIsInternal(document.referrer)) return false;
    var q = null;
    try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
    if (q && q.has('from') && urlIsInternal(q.get('from'))) return false;
    return true;
  }

  function goVerify(next) {
    var n = next || nextPath();
    location.replace('/verify.html?next=' + encodeURIComponent(n));
  }

  /* 敏感动作前调用：有 token 返回 true 让调用方继续；没有就跳验证页并返回 false */
  function require(next) {
    if (tokenValid()) return true;
    goVerify(next);
    return false;
  }

  function run() {
    if (!shouldRedirect()) return false;
    goVerify(nextPath());
    return true;
  }

  MCW.gate = {
    mode: MODE,
    cacheKey: CACHE_KEY,
    ttl: TTL,
    internalHosts: hosts,
    hostIsInternal: hostIsInternal,
    urlIsInternal: urlIsInternal,
    tokenValid: tokenValid,
    nextPath: nextPath,
    shouldRedirect: shouldRedirect,
    require: require,
    goVerify: goVerify,
    run: run
  };

  if (!window.__MCW_GATE_NO_AUTO__) run();
})();

  });
  /* ===== assets/js/util.js ===== */
  seg("util.js", function () {
/* AMC 通用工具（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  MCW.esc = function (v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  MCW.num = function (n, digits) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    var d = typeof digits === 'number' ? digits : 0;
    try {
      return v.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
    } catch (e) {
      return d ? v.toFixed(d) : String(Math.round(v));
    }
  };

  MCW.fmtInt = function (n) { return MCW.num(n, 0); };

  MCW.price = function (n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    if (v >= 1000) return MCW.num(v, 0);
    if (v >= 1) return MCW.num(v, 2);
    return MCW.num(v, 4);
  };

  MCW.pct = function (n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  };

  MCW.dirClass = function (n) {
    var v = Number(n);
    if (!isFinite(v) || v === 0) return 'flat';
    return v > 0 ? 'up' : 'down';
  };

  MCW.clock = function (ts) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return '—';
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };

  MCW.timeAgo = function (ts) {
    var t = typeof ts === 'number' ? ts : new Date(ts).getTime();
    if (!isFinite(t)) return '—';
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return '刚刚';
    if (s < 60) return s + ' 秒前';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    return Math.floor(s / 3600) + ' 小时前';
  };

  MCW.qs = function (sel, root) { return (root || document).querySelector(sel); };
  MCW.qsa = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  MCW.ready = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  MCW.toast = function (msg, kind) {
    var host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = String(msg);
    host.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 2600);
  };

  MCW.copy = function (text) {
    var value = String(text === null || text === undefined ? '' : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () { return true; }).catch(function () { return fallback(value); });
    }
    return Promise.resolve(fallback(value));

    function fallback(v) {
      try {
        var ta = document.createElement('textarea');
        ta.value = v;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
  };

  MCW.initCopy = function () {
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-copy]') : null;
      if (!el) return;
      ev.preventDefault();
      var text = el.getAttribute('data-copy');
      MCW.copy(text).then(function (ok) {
        MCW.toast(ok ? '已复制：' + text : '复制失败，请手动选择', ok ? 'ok' : 'err');
      });
    });
  };

  MCW.params = function () {
    var out = {};
    var q = String(window.location.search || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
      out[k] = v;
    });
    return out;
  };
})();

  });
  /* ===== assets/js/from.js ===== */
  seg("from.js", function () {
/* AMC 隐形来源参数 from：采集、站内链接补参、表单补字段（是否豁免由 Worker 判定） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var KEY = 'omc_from';
  var value = '';
  var ready = false;

  function loc() { return window.location || {}; }
  function href() { return String(loc().href || ''); }
  function origin() { return String(loc().origin || ''); }

  function stripFrom(raw) {
    try {
      var u = new URL(String(raw || ''), href());
      u.searchParams.delete('from');
      u.hash = '';
      return u.href;
    } catch (e) { return String(raw || ''); }
  }

  function sameOrigin(raw) {
    try {
      var u = new URL(String(raw || ''), href());
      return !!origin() && u.origin === origin();
    } catch (e) { return false; }
  }

  function cleanSameOrigin(raw) {
    if (!raw) return '';
    try {
      var u = new URL(String(raw), href());
      if (!origin() || u.origin !== origin()) return '';
      u.searchParams.delete('from');
      u.hash = '';
      return u.href;
    } catch (e) { return ''; }
  }

  function initial() {
    var p = MCW.params ? MCW.params() : {};
    if (p.from) return String(p.from);
    var ref = cleanSameOrigin(document.referrer || '');
    if (ref) return ref;
    return stripFrom(href());
  }

  function set(v) {
    value = String(v || '');
    try { sessionStorage.setItem(KEY, value); } catch (e) {}
  }

  function addToUrl(raw) {
    if (!raw) return raw;
    var s = String(raw);
    if (s.charAt(0) === '#' || /^(javascript|mailto|tel|data|blob):/i.test(s)) return raw;
    try {
      var u = new URL(s, href());
      if (!origin() || u.origin !== origin()) return raw;
      u.searchParams.set('from', value);
      return u.pathname + u.search + u.hash;
    } catch (e) { return raw; }
  }

  function decorateAnchor(a) {
    if (!a || !a.getAttribute) return;
    if (a.hasAttribute && a.hasAttribute('data-no-from')) return;
    var h = a.getAttribute('href');
    if (!h || h.charAt(0) === '#' || /^(javascript|mailto|tel|data|blob):/i.test(h)) return;
    if (a.hasAttribute && a.hasAttribute('download')) return;
    var next = addToUrl(h);
    if (next && next !== h) a.setAttribute('href', next);
  }

  function decorateForm(f) {
    if (!f || !f.getAttribute || !f.appendChild) return;
    var action = f.getAttribute('action') || href();
    if (!sameOrigin(action)) return;
    var input = f.querySelector ? f.querySelector('input[name="from"]') : null;
    if (!input) {
      input = document.createElement('input');
      input.setAttribute('type', 'hidden');
      input.setAttribute('name', 'from');
      f.appendChild(input);
    }
    input.value = value;
  }

  function all() {
    if (!document.querySelectorAll) return;
    Array.prototype.slice.call(document.querySelectorAll('a[href]')).forEach(decorateAnchor);
    Array.prototype.slice.call(document.querySelectorAll('form')).forEach(decorateForm);
  }

  function verifyLinks() {
    if (!document.querySelectorAll) return;
    var next = String(loc().pathname || '') + String(loc().search || '') + String(loc().hash || '');
    Array.prototype.slice.call(document.querySelectorAll('[data-verify-link]')).forEach(function (a) {
      a.setAttribute('href', addToUrl('./verify.html?next=' + encodeURIComponent(next)));
    });
  }

  function withFrom() {
    try {
      var u = new URL(href());
      u.searchParams.set('from', value);
      return u.pathname + u.search + u.hash;
    } catch (e) { return ''; }
  }

  function init() {
    if (!value) set(initial());
    var target = withFrom();
    var now = String(loc().pathname || '') + String(loc().search || '') + String(loc().hash || '');
    if (target && target !== now) {
      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', target);
        }
      } catch (e) {}
    }
    verifyLinks();
    all();
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      var a = t && t.closest ? t.closest('a[href]') : null;
      if (a) decorateAnchor(a);
    }, true);
    document.addEventListener('submit', function (ev) { decorateForm(ev.target); }, true);
    if (window.MutationObserver && document.documentElement) {
      try {
        new window.MutationObserver(function () { verifyLinks(); all(); })
          .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
      } catch (e) {}
    }
    ready = true;
  }

  set(initial());
  MCW.from = {
    KEY: KEY,
    value: function () { return value; },
    set: set,
    decorate: addToUrl,
    decorateAnchor: decorateAnchor,
    decorateForm: decorateForm,
    refresh: all,
    ready: function () { return ready; }
  };
  MCW.ready(init);
})();

  });
  /* ===== assets/js/api.js ===== */
  seg("api.js", function () {
/* AMC 数据接口（零依赖，只读公开接口 + 交易） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var API_KEY = 'omc_api';
  var TIMEOUT = 8000;

  function normalizeBase(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s.replace(/\/+$/, '');
  }

  function base() {
    var q = MCW.params ? MCW.params().api : '';
    if (q) {
      try { sessionStorage.setItem(API_KEY, q); } catch (e) {}
    }
    var stored = '';
    try { stored = sessionStorage.getItem(API_KEY) || ''; } catch (e) {}
    return normalizeBase(stored || CFG.api || '');
  }

  function fromValue() {
    if (MCW.from && typeof MCW.from.value === 'function') return String(MCW.from.value() || '');
    return '';
  }

  function withFrom(path) {
    var f = fromValue();
    if (!f) return path;
    return path + (path.indexOf('?') === -1 ? '?' : '&') + 'from=' + encodeURIComponent(f);
  }

  function request(path, opts) {
    opts = opts || {};
    var b = base();
    if (!b) {
      var e0 = new Error('服务端未连接（可重试）');
      e0.code = 'NOT_CONNECTED';
      return Promise.reject(e0);
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    var headers = { Accept: 'application/json' };
    var from = fromValue();
    if (from) headers['X-From'] = from;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    var init = { method: opts.method || 'GET', headers: headers, cache: 'no-store', credentials: 'include' };
    if (ctrl) init.signal = ctrl.signal;
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

    return fetch(b + withFrom(path), init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var info = (data && (data.error || data)) || {};
          var err = new Error(info.message || info.error || ('请求失败（HTTP ' + res.status + '）'));
          err.code = info.code || ('HTTP_' + res.status);
          err.status = res.status;
          throw err;
        }
        if (data && data.ok === false) {
          var info2 = data.error || {};
          var err2 = new Error(info2.message || info2.error || '请求失败');
          err2.code = info2.code || 'API_ERROR';
          throw err2;
        }
        return data;
      });
    }).then(function (data) {
      if (timer) clearTimeout(timer);
      return data;
    }, function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === 'AbortError') {
        var e = new Error('请求超时');
        e.code = 'TIMEOUT';
        throw e;
      }
      if (!err.code) err.code = 'NETWORK';
      throw err;
    });
  }

  function get(path) { return request(path); }
  function post(path, body) { return request(path, { method: 'POST', body: body || {} }); }

  MCW.api = {
    base: base,
    request: request,
    get: get,
    post: post,
    connected: function () { return !!base(); },
    accountUrl: function () { return String(CFG.accountUrl || ''); },
    health: function () { return get('/api/health'); },
    status: function () { return get('/api/status'); },
    market: function () { return get('/api/market'); },
    stocks: function () { return get('/api/stocks'); },
    stock: function (symbol) { return get('/api/stocks/' + encodeURIComponent(symbol)); },
    trade: function (body) { return post('/api/stocks/trade', body); },
    plots: function () { return get('/api/plots'); },
    contract: [
      'GET /api/health',
      'GET /api/status',
      'GET /api/market',
      'GET /api/stocks',
      'GET /api/stocks/<symbol>',
      'POST /api/stocks/trade',
      'GET /api/plots'
    ]
  };
})();

  });
  /* ===== assets/js/address.js ===== */
  seg("address.js", function () {
/* 公网连接地址按需获取 + 20s 跟随更新（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var currentAddress = '';
  var currentVersion = '';
  var baseVersion = String(CFG.version || '1.21.11').split('~')[0].trim() || '1.21.11';
  var bound = false;
  var revealed = false;
  var following = false;
  var followTimer = null;
  var followBusy = false;
  var FOLLOW_MS = 20000;
  var STATUS_TTL = 60 * 1000;
  var currentOnline = null;
  var currentMax = null;
  var statusAt = 0;
  var lastOkAt = 0;
  var failed = false;

  function el(id) { return document.getElementById(id); }

  function isHidden() { return !!(document && document.hidden); }

  function normalize(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s) return '';
    if (/example|your-|待开通|未开通/i.test(s)) return '';
    return s;
  }

  function addressButton() {
    return el('get-addr') || el('copy-addr');
  }

  function followButton() {
    return el('addr-follow');
  }

  function showNode(node, on) {
    if (!node) return;
    if (node.classList && typeof node.classList.toggle === 'function') {
      node.classList.toggle('hidden', !on);
    } else {
      node.style.display = on ? '' : 'none';
    }
  }

  function paintAddress() {
    var addr = el('addr');
    var btn = addressButton();
    var fbtn = followButton();
    var note = el('addr-follow-note');
    if (addr) addr.textContent = currentAddress || (failed ? '未获取（可重试）' : (revealed ? '待开通' : '未获取'));
    if (btn) {
      btn.textContent = currentAddress ? '复制连接地址' : '获取连接地址';
      btn.disabled = false;
      if (typeof btn.removeAttribute === 'function') btn.removeAttribute('data-copy');
    }
    if (fbtn) {
      fbtn.textContent = following ? '停止自动更新' : '开启自动更新';
      showNode(fbtn, revealed);
    }
    if (note) {
      if (following) note.textContent = isHidden() ? '页面隐藏，自动更新暂停' : '自动更新中 · 每 20 秒';
      else note.textContent = revealed ? '自动更新已关闭' : '';
    }
  }

  function formatVersion(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s) return '—';
    if (s.indexOf('~') !== -1) return s;
    if (s === baseVersion) return s;
    return baseVersion + ' ~ ' + s;
  }

  function paintVersion() {
    var txt = formatVersion(currentVersion);
    ['addr-version', 'ver'].forEach(function (id) {
      var n = el(id);
      if (n) n.textContent = txt;
    });
  }

  function numText(v) {
    if (v === null || v === undefined || v === '') return '—';
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return MCW.fmtInt ? MCW.fmtInt(n) : String(n);
  }

  function paintStatus() {
    var fresh = statusAt && (Date.now() - statusAt) <= STATUS_TTL;
    var online = fresh && currentOnline !== null ? currentOnline : null;
    var max = fresh && currentMax !== null ? currentMax : null;
    ['play-online', 'addr-online'].forEach(function (id) {
      var n = el(id);
      if (n) n.textContent = numText(online);
    });
    ['play-max', 'addr-max'].forEach(function (id) {
      var n = el(id);
      if (n) n.textContent = numText(max);
    });
  }

  function applyStatus(data) {
    data = data || {};
    currentOnline = (data.online !== undefined && data.online !== null && isFinite(Number(data.online))) ? Number(data.online) : null;
    currentMax = (data.max !== undefined && data.max !== null && isFinite(Number(data.max))) ? Number(data.max) : null;
    statusAt = (currentOnline !== null || currentMax !== null) ? Date.now() : 0;
    paintStatus();
  }

  function markOk() {
    lastOkAt = Date.now();
    failed = false;
  }

  /* 失败后最多保留 60 秒旧值；超时统一回落为 —，绝不补 0 */
  function expireIfStale() {
    if (lastOkAt && (Date.now() - lastOkAt) <= STATUS_TTL) return false;
    currentAddress = '';
    currentVersion = '';
    currentOnline = null;
    currentMax = null;
    statusAt = 0;
    paintAddress();
    paintVersion();
    paintStatus();
    return true;
  }

  function set(raw) {
    currentAddress = normalize(raw);
    paintAddress();
    return currentAddress;
  }

  function setVersion(raw) {
    currentVersion = String(raw === null || raw === undefined ? '' : raw).trim();
    paintVersion();
  }

  /* 只请求并写入 DOM，不自动复制；点击按钮由 reveal() 调用 */
  function refresh(path, field) {
    path = path || '/api/status';
    field = field || 'serverAddress';
    if (!MCW.api || typeof MCW.api.get !== 'function' ||
        (typeof MCW.api.connected === 'function' && !MCW.api.connected())) {
      set('');
      setVersion('');
      return Promise.resolve('');
    }
    return MCW.api.get(path).then(function (data) {
      data = data || {};
      markOk();
      set(data[field]);
      setVersion(data.version);
      applyStatus(data);
      return currentAddress;
    }, function () {
      failed = true;
      expireIfStale();
      paintAddress();
      paintVersion();
      paintStatus();
      return currentAddress;
    });
  }

  function copyAddress() {
    if (!currentAddress) return Promise.resolve(false);
    if (!MCW.copy) return Promise.resolve(false);
    return MCW.copy(currentAddress).then(function (ok) {
      if (MCW.toast) MCW.toast(ok ? '连接地址已复制' : '已获取地址，请手动复制', ok ? 'ok' : 'err');
      return !!ok;
    });
  }

  function stopTimer() {
    if (followTimer) {
      clearInterval(followTimer);
      followTimer = null;
    }
  }

  function startTimer() {
    if (followTimer || !following || isHidden()) return;
    followTimer = setInterval(followTick, FOLLOW_MS);
  }

  /* 静默拉 /api/status：地址变化才提示，失败保留旧地址 */
  function followTick() {
    if (!following || isHidden()) return Promise.resolve(currentAddress);
    if (followBusy) return Promise.resolve(currentAddress);
    if (!MCW.api || typeof MCW.api.get !== 'function' ||
        (typeof MCW.api.connected === 'function' && !MCW.api.connected())) {
      return Promise.resolve(currentAddress);
    }
    followBusy = true;
    return MCW.api.get('/api/status').then(function (data) {
      data = data || {};
      markOk();
      applyStatus(data);
      var next = normalize(data.serverAddress);
      if (next !== currentAddress) {
        set(next);
        if (MCW.toast) MCW.toast(next ? '地址已更新' : '地址待开通', next ? 'ok' : 'err');
      }
      setVersion(data.version);
      return currentAddress;
    }, function () {
      failed = true;
      expireIfStale();
      paintAddress();
      paintVersion();
      paintStatus();
      return currentAddress;
    }).then(function (addr) {
      followBusy = false;
      return addr;
    }, function (err) {
      followBusy = false;
      throw err;
    });
  }

  function startFollow() {
    revealed = true;
    following = true;
    startTimer();
    paintAddress();
  }

  function stopFollow() {
    following = false;
    stopTimer();
    paintAddress();
  }

  function toggleFollow() {
    if (following) {
      stopFollow();
      return Promise.resolve(currentAddress);
    }
    startFollow();
    return followTick();
  }

  function onVisibility() {
    if (!following) return;
    if (isHidden()) stopTimer();
    else {
      startTimer();
      followTick();
    }
    paintAddress();
  }

  function reveal() {
    if (currentAddress) return copyAddress();
    var btn = addressButton();
    revealed = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '获取中…';
    }
    return refresh('/api/status', 'serverAddress').then(function (addr) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = addr ? '复制连接地址' : '获取连接地址';
      }
      startFollow();
      if (!addr) {
        if (MCW.toast) MCW.toast('地址待开通，已开启自动更新', 'err');
        return '';
      }
      return copyAddress().then(function () { return addr; });
    });
  }

  function bind() {
    if (bound) return;
    var btn = addressButton();
    var fbtn = followButton();
    if (!btn && !fbtn) return;
    bound = true;
    if (btn) {
      btn.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        reveal();
      });
    }
    if (fbtn) {
      fbtn.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        toggleFollow();
      });
    }
    if (document.addEventListener) document.addEventListener('visibilitychange', onVisibility);
  }

  function start() { bind(); }

  function init() {
    paintAddress();
    paintVersion();
    paintStatus();
    bind();
  }

  MCW.address = {
    refresh: refresh,
    set: set,
    normalize: normalize,
    bind: bind,
    start: start,
    reveal: reveal,
    follow: startFollow,
    stopFollow: stopFollow,
    toggleFollow: toggleFollow,
    followTick: followTick,
    following: function () { return following; },
    revealed: function () { return revealed; },
    FOLLOW_MS: FOLLOW_MS,
    STATUS_TTL: STATUS_TTL,
    online: function () { return currentOnline; },
    max: function () { return currentMax; },
    current: function () { return currentAddress; },
    version: function () { return formatVersion(currentVersion); }
  };

  MCW.ready(init);
})();

  });
  /* ===== assets/js/live.js ===== */
  seg("live.js", function () {
/* AMC 轮询与连接状态机（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var FRESH_MS = 60 * 1000;

  function Poller(path, opts) {
    opts = opts || {};
    this.path = path;
    this.interval = Math.max(2000, Number(opts.interval || CFG.pollMs || 5000));
    this.data = null;
    this.state = 'connecting';
    this.lastOk = 0;
    this.downSince = 0;
    this.error = '';
    this.busy = false;
    this.timer = null;
    this.listeners = [];
    this.expired = false;
  }

  Poller.prototype.on = function (fn) {
    this.listeners.push(fn);
    return this;
  };

  Poller.prototype.emit = function () {
    var self = this;
    this.listeners.forEach(function (fn) { try { fn(self); } catch (e) {} });
  };

  Poller.prototype.start = function () {
    var self = this;
    this.tick();
    this.timer = setInterval(function () { self.tick(); }, this.interval);
    return this;
  };

  Poller.prototype.stop = function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  };

  Poller.prototype.tick = function () {
    var self = this;
    if (this.busy) return Promise.resolve(this);
    this.busy = true;
    return MCW.api.get(this.path).then(function (data) {
      self.busy = false;
      if (data && data.ok === false) {
        self.fail((data.error && data.error.message) || '接口返回失败');
      } else {
        self.data = data || {};
        self.state = 'live';
        self.lastOk = Date.now();
        self.downSince = 0;
        self.error = '';
        self.expired = false;
      }
      self.emit();
      return self;
    }, function (err) {
      self.busy = false;
      self.fail((err && err.message) || '网络错误');
      self.emit();
      return self;
    });
  };

  Poller.prototype.fail = function (msg) {
    var age = this.lastOk ? (Date.now() - this.lastOk) : Infinity;
    this.expired = age > FRESH_MS;
    if (this.expired) {
      this.data = null;
      this.state = 'down';
    } else {
      this.state = this.data ? 'stale' : 'down';
    }
    if (!this.downSince) this.downSince = Date.now();
    this.error = msg || '';
  };

  Poller.prototype.fresh = function () {
    return !!this.lastOk && (Date.now() - this.lastOk) <= FRESH_MS;
  };

  function label(state) {
    if (state === 'live') return '实时';
    if (state === 'stale') return '连接中断';
    if (state === 'connecting') return '连接中';
    return '服务端未连接（可重试）';
  }

  function hint(state) {
    if (state === 'live') return '';
    if (state === 'stale') return '显示的是最后一次成功数据（最多 60 秒）';
    if (state === 'connecting') return '正在请求数据';
    return '服务端未连接（可重试）';
  }

  MCW.live = {
    make: function (path, opts) { return new Poller(path, opts); },
    FRESH_MS: FRESH_MS,
    label: label,
    hint: hint,
    stateClass: function (state) {
      return state === 'live' ? 'ok' : (state === 'stale' ? 'warn' : 'off');
    }
  };
})();

  });
  /* ===== assets/js/chart.js ===== */
  seg("chart.js", function () {
/* AMC 纯 SVG 图表：折线 / 柱状 / 迷你线（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var COLOR = { line: '#f2c14e', grid: '#1e232b', axis: '#2b313a', text: '#7d8590', up: '#4ade80', down: '#f85149' };

  function seriesOf(points) {
    var arr = [];
    (points || []).forEach(function (pt) {
      if (pt === null || pt === undefined) return;
      var t = pt.t !== undefined ? pt.t : (pt.ts !== undefined ? pt.ts : pt.time);
      var p = pt.p !== undefined ? pt.p : pt.price;
      var ts = typeof t === 'number' ? (t < 1e12 ? t * 1000 : t) : Date.parse(t);
      var pv = Number(p);
      if (!isFinite(ts) || !isFinite(pv)) return;
      var vol = pt.v !== undefined ? pt.v : pt.volume;
      var vv = Number(vol);
      arr.push({ t: ts, p: pv, v: isFinite(vv) && vv > 0 ? vv : 0 });
    });
    return arr;
  }

  function fmtAxis(v, opts) {
    if (opts && typeof opts.fmt === 'function') return opts.fmt(v);
    var a = Math.abs(v);
    if (a >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
    if (a >= 100) return String(Math.round(v));
    if (a >= 1) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 1000) / 1000);
  }

  function pad2(x) { return (x < 10 ? '0' : '') + x; }

  function hm(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function dayKey(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* 跨本地日期或跨度超过 24 小时时，x 轴需要带日期，避免 19:23 / 17:49 混排 */
  function hasDateSpan(series) {
    if (!series || series.length < 2) return false;
    var a = series[0].t, b = series[series.length - 1].t;
    if (!isFinite(a) || !isFinite(b)) return false;
    if (Math.abs(b - a) > 86400000) return true;
    return dayKey(a) !== dayKey(b);
  }

  function mdhm(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm(ts);
  }

  function fullTime(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm(ts);
  }

  function esc(v) { return MCW.esc ? MCW.esc(v) : String(v); }

  /* 成交量柱高：按窗口内最大成交量归一；0 / 非数 / 无最大值一律不画 */
  function volumeHeight(v, max, h) {
    var vv = Number(v), mm = Number(max), hh = Number(h);
    if (!isFinite(vv) || !isFinite(mm) || !isFinite(hh) || vv <= 0 || mm <= 0 || hh <= 0) return 0;
    return Math.max(1, Math.round((vv / mm) * hh));
  }

  /* 统一 y 轴范围：全等序列固定 0..max(1,max)，非负数据不出现负刻度 */
  function rangeOf(series) {
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < series.length; i++) {
      if (series[i].p < min) min = series[i].p;
      if (series[i].p > max) max = series[i].p;
    }
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1, equal: true };
    var equal = min === max;
    if (equal) {
      min = 0;
      max = Math.max(1, max);
    } else {
      var pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
      if (min < 0) min = 0;
    }
    if (max <= min) max = min + 1;
    return { min: min, max: max, equal: equal };
  }

  /* 全等序列用整数刻度；其余保持 5 条网格线 */
  function axisTicks(L) {
    if (L.equal) {
      var n = Math.round(L.max);
      if (n >= 1 && n <= 5) {
        var ints = [];
        for (var k = 0; k <= n; k++) ints.push(k);
        return ints;
      }
    }
    var ticks = [];
    for (var j = 0; j <= 4; j++) ticks.push(L.max - ((L.max - L.min) / 4) * j);
    return ticks;
  }

  /* 价格区 + 底部成交量区的共用布局；v 全为 0 时不画柱子，保持原折线布局 */
  function layoutOf(w, h, opts, series, allowVolume) {
    var padL = 54, padR = 16, padT = 16, padB = 26;
    var iw = w - padL - padR;
    var innerH = h - padT - padB;
    var wantVol = !!(opts && opts.volume && allowVolume);
    var maxV = 0;
    if (wantVol) {
      series.forEach(function (s) { if (s.v > maxV) maxV = s.v; });
    }
    /* 请求成交量区时即使 v 全为 0 也预留基线区，用文案说明暂无成交，绝不画假柱 */
    var hasVol = wantVol;
    var gap = hasVol ? 10 : 0;
    var volH = hasVol ? Math.min(64, Math.max(24, Math.round(innerH * 0.28))) : 0;
    if (hasVol && volH + gap > innerH - 20) volH = Math.max(16, innerH - gap - 20);
    var ih = innerH - volH - gap;
    return { padL: padL, padR: padR, padT: padT, padB: padB, iw: iw, ih: ih,
      volTop: padT + ih + gap, volH: volH, hasVol: hasVol, maxV: maxV };
  }

  function lineSVG(points, opts) {
    opts = opts || {};
    var series = seriesOf(points);
    if (!series.length) return '<div class="chart-empty">暂无数据</div>';
    var rawLen = series.length;
    if (series.length === 1) series = [{ t: series[0].t - 60000, p: series[0].p, v: 0 }, series[0]];

    var w = Math.max(240, Number(opts.width) || 720);
    var h = Math.max(120, Number(opts.height) || 260);
    var L = layoutOf(w, h, opts, series, rawLen >= 2);
    var padL = L.padL, padR = L.padR, padT = L.padT;
    var iw = L.iw, ih = L.ih;
    var R = rangeOf(series);
    var min = R.min, max = R.max, i;

    function x(i2) { return padL + (series.length === 1 ? iw / 2 : (i2 / (series.length - 1)) * iw); }
    function y(v) { return padT + ih - ((v - min) / (max - min)) * ih; }

    var color = opts.color || COLOR.line;
    var out = [];
    out.push('<svg class="chart-svg" width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(opts.label || '趋势图') + '">');

    var ticks = axisTicks(R);
    for (i = 0; i < ticks.length; i++) {
      var gv = ticks[i];
      var gy = y(gv);
      out.push('<line class="grid" x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) + '" stroke="' + COLOR.grid + '" stroke-width="1"/>');
      out.push('<text class="axis-y" x="' + (padL - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="' + COLOR.text + '" font-size="10">' + esc(fmtAxis(gv, opts)) + '</text>');
    }

    var labels = [0, Math.floor((series.length - 1) / 2), series.length - 1];
    var showDate = hasDateSpan(series);
    labels.forEach(function (idx, k) {
      if (k === 1 && series.length < 3) return;
      var lx = x(idx);
      var anchor = k === 0 ? 'start' : (k === 2 ? 'end' : 'middle');
      var label = showDate && (k === 0 || k === 2) ? mdhm(series[idx].t) : hm(series[idx].t);
      out.push('<text class="axis-x" x="' + lx.toFixed(1) + '" y="' + (h - 6) + '" text-anchor="' + anchor + '" fill="' + COLOR.text + '" font-size="10">' + esc(label) + '</text>');
    });

    var d = '';
    for (i = 0; i < series.length; i++) d += (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(series[i].p).toFixed(1) + ' ';
    if (opts.fill !== false) {
      out.push('<path class="area" d="' + d + 'L' + x(series.length - 1).toFixed(1) + ' ' + (padT + ih) + ' L' + x(0).toFixed(1) + ' ' + (padT + ih) + ' Z" fill="' + color + '" fill-opacity="0.07"/>');
    }
    out.push('<path class="line-path" d="' + d.trim() + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>');

    var last = series.length - 1;
    out.push('<circle class="last-dot" cx="' + x(last).toFixed(1) + '" cy="' + y(series[last].p).toFixed(1) + '" r="2.6" fill="' + color + '"/>');

    if (L.hasVol) {
      var bw = Math.max(1, Math.min(18, (iw / Math.max(1, series.length - 1)) * 0.5));
      out.push('<line class="vol-base" x1="' + padL + '" y1="' + (L.volTop + L.volH) + '" x2="' + (w - padR) + '" y2="' + (L.volTop + L.volH) + '" stroke="' + COLOR.axis + '" stroke-width="1"/>');
      out.push('<text class="vol-label" x="' + (padL - 8) + '" y="' + (L.volTop + 9) + '" text-anchor="end" fill="' + COLOR.text + '" font-size="9">成交量</text>');
      out.push('<g class="vol-bars">');
      for (i = 0; i < series.length; i++) {
        var vh = volumeHeight(series[i].v, L.maxV, L.volH);
        if (!vh) continue;
        var bx = Math.min(w - padR - bw, Math.max(padL, x(i) - bw / 2));
        var by = L.volTop + L.volH - vh;
        var up = i === 0 ? true : series[i].p >= series[i - 1].p;
        out.push('<rect class="vol-bar" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + vh + '" fill="' + (up ? COLOR.up : COLOR.down) + '" fill-opacity="0.5" data-v="' + esc(series[i].v) + '"><title>成交量 ' + esc(String(Math.round(series[i].v))) + '</title></rect>');
      }
      out.push('</g>');
      if (L.maxV <= 0) {
        out.push('<text class="vol-empty" x="' + (padL + iw / 2).toFixed(1) + '" y="' + (L.volTop + L.volH / 2 + 3).toFixed(1) + '" text-anchor="middle" fill="' + COLOR.text + '" font-size="10">暂无成交</text>');
      }
    }

    out.push('<g class="chart-hover" opacity="0" pointer-events="none">');
    out.push('<line class="hover-line" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + ih) + '" stroke="' + COLOR.axis + '" stroke-width="1" stroke-dasharray="3 3"/>');
    out.push('<circle class="hover-dot" cx="0" cy="0" r="3.4" fill="' + color + '"/>');
    out.push('<text class="hover-text" x="0" y="0" fill="' + COLOR.text + '" font-size="11"></text>');
    out.push('</g>');

    out.push('<rect class="chart-hit" x="' + padL + '" y="' + padT + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>');
    out.push('</svg>');
    return out.join('');
  }

  function attachHover(el, points, opts) {
    var svg = el.querySelector ? el.querySelector('svg') : null;
    if (!svg) return;
    var series = seriesOf(points);
    if (series.length < 2) return;
    var w = Number(svg.getAttribute('viewBox').split(' ')[2]);
    var h = Number(svg.getAttribute('viewBox').split(' ')[3]);
    var L = layoutOf(w, h, opts, series, series.length >= 2);
    var padL = L.padL, padT = L.padT, iw = L.iw, ih = L.ih;
    var R = rangeOf(series);
    var min = R.min, max = R.max;

    var group = svg.querySelector('.chart-hover');
    var line = svg.querySelector('.hover-line');
    var dot = svg.querySelector('.hover-dot');
    var text = svg.querySelector('.hover-text');
    var hit = svg.querySelector('.chart-hit');
    if (!group || !line || !dot || !text || !hit) return;

    function move(ev) {
      var rect = svg.getBoundingClientRect();
      var px = (ev.clientX - rect.left) * (w / rect.width);
      var ratio = Math.max(0, Math.min(1, (px - padL) / iw));
      var idx = Math.round(ratio * (series.length - 1));
      var sx = padL + (idx / (series.length - 1)) * iw;
      var sy = padT + ih - ((series[idx].p - min) / (max - min)) * ih;
      line.setAttribute('x1', sx.toFixed(1));
      line.setAttribute('x2', sx.toFixed(1));
      dot.setAttribute('cx', sx.toFixed(1));
      dot.setAttribute('cy', sy.toFixed(1));
      text.textContent = fullTime(series[idx].t) + '  ' + (opts && typeof opts.fmt === 'function' ? opts.fmt(series[idx].p) : fmtAxis(series[idx].p, opts));
      var flip = sx > w * 0.72;
      text.setAttribute('x', (sx + (flip ? -8 : 8)).toFixed(1));
      text.setAttribute('y', Math.max(12, sy - 8).toFixed(1));
      text.setAttribute('text-anchor', flip ? 'end' : 'start');
      group.setAttribute('opacity', '1');
    }

    function leave() { group.setAttribute('opacity', '0'); }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchmove', function (ev) {
      if (ev.touches && ev.touches[0]) move(ev.touches[0]);
    }, { passive: true });
  }

  function render(el, points, opts) {
    opts = opts || {};
    if (!el) return;
    var width = Math.max(260, el.clientWidth || opts.width || 720);
    var merged = {};
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) merged[k] = opts[k];
    merged.width = width;
    el.innerHTML = lineSVG(points, merged);
    attachHover(el, points, merged);

    if (typeof ResizeObserver !== 'undefined') {
      if (el._chartRO) el._chartRO.disconnect();
      var lastW = width;
      el._chartRO = new ResizeObserver(function () {
        var nw = Math.max(260, el.clientWidth || width);
        if (Math.abs(nw - lastW) < 8) return;
        lastW = nw;
        merged.width = nw;
        el.innerHTML = lineSVG(points, merged);
        attachHover(el, points, merged);
      });
      el._chartRO.observe(el);
    }
  }

  function spark(points, opts) {
    opts = opts || {};
    var series = seriesOf(points);
    if (series.length < 2) return '<span class="spark-empty">—</span>';
    var w = Number(opts.width) || 96, h = Number(opts.height) || 26;
    var min = Infinity, max = -Infinity;
    series.forEach(function (s) { if (s.p < min) min = s.p; if (s.p > max) max = s.p; });
    if (min === max) { min -= 1; max += 1; }
    var color = opts.color || (series[series.length - 1].p >= series[0].p ? COLOR.up : COLOR.down);
    var d = '';
    series.forEach(function (s, i) {
      var x = (i / (series.length - 1)) * (w - 2) + 1;
      var y = h - 2 - ((s.p - min) / (max - min)) * (h - 4);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + d.trim() + '" fill="none" stroke="' + color + '" stroke-width="1.3"/></svg>';
  }

  function bars(el, items, opts) {
    opts = opts || {};
    if (!el) return;
    items = items || [];
    if (!items.length) { el.innerHTML = '<div class="chart-empty">暂无数据</div>'; return; }
    var w = Math.max(240, el.clientWidth || 720), h = Number(opts.height) || 160;
    var padL = 46, padB = 22, padT = 10, padR = 8;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = 0;
    items.forEach(function (it) { if (Number(it.value) > max) max = Number(it.value); });
    if (!max) max = 1;
    var bw = Math.max(2, Math.min(28, iw / items.length * 0.6));
    var out = ['<svg class="chart-svg" width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'];
    out.push('<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (w - padR) + '" y2="' + (padT + ih) + '" stroke="' + COLOR.axis + '"/>');
    items.forEach(function (it, i) {
      var x = padL + (i + 0.5) * (iw / items.length) - bw / 2;
      var bh = (Number(it.value) / max) * ih;
      out.push('<rect class="bar" x="' + x.toFixed(1) + '" y="' + (padT + ih - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, bh).toFixed(1) + '" fill="' + (opts.color || COLOR.line) + '"><title>' + esc(it.label) + ': ' + esc(fmtAxis(it.value, opts)) + '</title></rect>');
    });
    out.push('</svg>');
    el.innerHTML = out.join('');
  }

  MCW.chart = { line: render, lineSVG: lineSVG, spark: spark, bars: bars, series: seriesOf, volumeHeight: volumeHeight,
    hm: hm, mdhm: mdhm, fullTime: fullTime, hasDateSpan: hasDateSpan };
})();

  });
  /* ===== assets/js/nav.js ===== */
  seg("nav.js", function () {
/* AMC 导航、页脚与账号入口（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  function paintNav() {
    var path = String(window.location.pathname || '');
    var file = path.split('/').pop() || 'index.html';
    MCW.qsa('.nav a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').replace(/^\.\//, '');
      if (href === file || (file === '' && href === 'index.html')) a.classList.add('active');
    });
  }

  /* 账号功能在 play.html 内；accountUrl 配置后优先跳外部账号站 */
  function paintAccount() {
    var els = MCW.qsa('[data-account-link]');
    if (!els.length) return;
    var external = MCW.api.accountUrl();
    var url = external || './play.html';
    els.forEach(function (el) {
      el.classList.remove('is-off');
      el.removeAttribute('aria-disabled');
      el.setAttribute('href', url);
      if (external) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      } else {
        el.removeAttribute('target');
        el.removeAttribute('rel');
      }
      var note = el.querySelector('[data-account-note]');
      if (note) note.textContent = '';
    });
  }

  MCW.ready(function () {
    MCW.initCopy();
    paintNav();
    paintAccount();
    var years = MCW.qsa('[data-year]');
    for (var i = 0; i < years.length; i++) years[i].textContent = String(new Date().getFullYear());
  });
})();

  });
  /* ===== assets/js/account.js ===== */
  seg("account.js", function () {
/* AMC 账号、绑定与订单（零依赖，同源 cookie 会话） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CODE_RE = /^\d{6}$/;
  var LINK_TTL = 10 * 60 * 1000;

  var REMEMBER_KEY = 'omc_remember';
  var state = {
    connected: false,
    user: null,
    code: '',
    expireAt: 0,
    tickTimer: null,
    watchTimer: null,
    remember: false,
    verifyAfter: null,
    tfa: {
      phase: 'idle',
      challengeId: '',
      secret: '',
      otpauthUrl: '',
      codes: [],
      rendered: false
    }
  };

  function el(id) { return document.getElementById(id); }
  function text(id, v) { var n = el(id); if (n) n.textContent = v; }
  function toggle(id, show) { var n = el(id); if (n) n.classList[show ? 'remove' : 'add']('hidden'); }
  function disabled(id, v) { var n = el(id); if (n) n.disabled = !!v; }
  function msg(id, s, kind) {
    var n = el(id);
    if (!n) return;
    n.textContent = s || '';
    n.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function tsToken() {
    if (MCW.turnstile && typeof MCW.turnstile.token === 'function') {
      var t = String(MCW.turnstile.token() || '');
      if (t) return t;
    }
    try {
      var raw = localStorage.getItem('omc_ts_token');
      if (raw) {
        var o = JSON.parse(raw);
        var c = String(o && o.token || '').trim();
        var exp = Number(o && o.exp || 0);
        if (c && isFinite(exp) && exp > Date.now()) return c;
      }
    } catch (e) {}
    var n = el('ts-token');
    return String(window.__TS_TOKEN__ || (n && n.value) || '');
  }

  function tsReset() {
    if (MCW.turnstile && typeof MCW.turnstile.clearToken === 'function') {
      MCW.turnstile.clearToken();
    }
    try { localStorage.removeItem('omc_ts_token'); } catch (e) {}
    window.__TS_TOKEN__ = '';
    var n = el('ts-token');
    if (n) n.value = '';
    if (MCW.turnstile && typeof MCW.turnstile.reset === 'function') {
      MCW.turnstile.reset();
    }
  }

  function rememberChecked() {
    var c = el('login-remember');
    return !!(c && c.checked);
  }

  function remembered() {
    try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch (e) { return false; }
  }

  function paintRemember() {
    var n = el('acc-remember');
    if (n) n.textContent = remembered() ? '已开启 30 天自动登录' : '未开启 30 天自动登录';
  }

  function setRemembered(on) {
    try {
      if (on) localStorage.setItem(REMEMBER_KEY, '1');
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
    paintRemember();
  }

  function openVerify(after, auto) {
    var next = location.pathname + location.search + location.hash;
    var url = './verify.html?next=' + encodeURIComponent(next);
    if (MCW.from && typeof MCW.from.addToUrl === 'function') url = MCW.from.addToUrl(url);
    if (typeof after === 'function') state.verifyAfter = after;
    var w = null;
    if (typeof window.open === 'function') {
      try { w = window.open(url, 'omc_verify', 'width=480,height=680'); } catch (e) { w = null; }
    }
    if (!w) {
      state.verifyAfter = null;
      msg('acc-msg', '弹窗被拦截，请点击「去人机验证」打开验证页。', 'err');
      return false;
    }
    if (auto) msg('acc-msg', '请先完成人机验证，验证后会自动继续。', 'ok');
    var timer = setInterval(function () {
      if (!w.closed) return;
      clearInterval(timer);
      setTimeout(function () {
        var fn = state.verifyAfter;
        state.verifyAfter = null;
        paintGate();
        if (fn && tsToken()) fn();
      }, 250);
    }, 400);
    return true;
  }

  function turnstileRequired() {
    var e = new Error('请先完成人机验证');
    e.code = 'turnstile_required';
    return e;
  }

  function bool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
      var s = v.toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled';
    }
    return false;
  }

  function validCode(code) {
    return CODE_RE.test(String(code === null || code === undefined ? '' : code).trim());
  }

  function emailOk(v) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (s.length < 3 || s.length > 254) return false;
    if (/[\u0000-\u001f\u007f\s]/.test(s)) return false;
    var at = s.lastIndexOf('@');
    if (at <= 0 || at !== s.indexOf('@')) return false;
    var local = s.slice(0, at);
    var domain = s.slice(at + 1);
    if (local.length > 64) return false;
    if (local.charAt(0) === '.' || local.charAt(local.length - 1) === '.' || local.indexOf('..') !== -1) return false;
    if (/[<>()\[\]\\,;:"]/.test(local)) return false;
    if (domain.charAt(0) === '.' || domain.indexOf('..') !== -1) return false;
    var d = domain;
    if (d.charAt(d.length - 1) === '.') d = d.slice(0, -1);
    if (!d) return false;
    if (!/^[\p{L}\p{N}._-]+$/u.test(d)) return false;
    if (d.charAt(0) === '-' || d.charAt(d.length - 1) === '-') return false;
    return true;
  }

  function userLabel(u) {
    if (!u) return '—';
    return String(u.email || u.login || '—');
  }

  function userKey(u) {
    if (!u) return '';
    return String(u.id || u.email || u.login || '');
  }

  function bindCommand(code) {
    return '/account link ' + String(code === null || code === undefined ? '' : code).trim();
  }

  function viewState(o) {
    o = o || {};
    if (!o.connected) return 'offline';
    return o.user ? 'user' : 'guest';
  }

  function canLink(s) { return s === 'user'; }

  function direction(side) {
    if (side === 'sell') return '卖出';
    if (side === 'buy') return '买入';
    return '—';
  }

  var STATUS = {
    pending: '挂单中', filled: '已成交', partial: '部分成交',
    cancelled: '已取消', canceled: '已取消', rejected: '已拒绝', expired: '已过期'
  };

  function orderStatus(s) {
    var raw = String(s === null || s === undefined ? '' : s).trim();
    var k = raw.toLowerCase();
    return STATUS[k] || raw || '—';
  }

  function mcLabel(mc) {
    if (!mc) return '未绑定';
    var name = String(mc.name || '').trim();
    var uuid = String(mc.uuid || '').trim();
    if (name && uuid) return name + '（' + uuid + '）';
    return name || uuid || '未绑定';
  }

  function parseExpire(v) {
    var t = typeof v === 'number' ? v : Date.parse(String(v || ''));
    if (!isFinite(t)) return Date.now() + LINK_TTL;
    if (t < 1e12) t *= 1000;
    return t;
  }

  function mmss(sec) {
    var s = Math.max(0, Math.round(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function stopTick() {
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.tickTimer = null;
  }

  function stopWatch() {
    if (state.watchTimer) clearInterval(state.watchTimer);
    state.watchTimer = null;
  }

  function stopTimers() { stopTick(); stopWatch(); }

  function tick() {
    if (!state.expireAt) return;
    var left = state.expireAt - Date.now();
    if (left <= 0) {
      text('link-expire', '已过期');
      text('link-status', '绑定码已过期，请重新生成。');
      disabled('link-copy', true);
      state.code = '';
      stopTimers();
      return;
    }
    text('link-expire', '剩余 ' + mmss(left / 1000));
  }

  function startTick() {
    stopTick();
    tick();
    state.tickTimer = setInterval(tick, 1000);
  }

  function startWatch() {
    stopWatch();
    state.watchTimer = setInterval(function () {
      if (!state.user) return;
      MCW.api.get('/api/me').then(function (d) {
        var u = normalizeMe(d);
        if (!u) return;
        state.user = u;
        paintPass();
        if (!u.mc || (!u.mc.uuid && !u.mc.name)) return;
        state.code = '';
        state.expireAt = 0;
        stopTimers();
        toggle('link-box', false);
        toggle('link-cmd-row', false);
        text('link-expire', '');
        text('link-status', '已绑定：' + mcLabel(u.mc));
        text('link-start', '重新生成绑定码');
        text('acc-mc', mcLabel(u.mc));
        paintTfa();
        MCW.toast('Minecraft 已绑定', 'ok');
      }).catch(function () {});
    }, 5000);
  }

  function showLink(d) {
    d = d || {};
    /* 地址改为「获取连接地址」按钮按需拉取，绑定码流程不再自动暴露 */
    state.code = String(d.code || '').trim();
    state.expireAt = parseExpire(d.expireAt);
    toggle('link-box', true);
    toggle('link-cmd-row', true);
    text('link-code', state.code || '------');
    text('link-cmd', bindCommand(state.code));
    var cp = el('link-copy');
    if (cp) {
      cp.setAttribute('data-copy', state.code);
      cp.disabled = !validCode(state.code);
    }
    text('link-status', '进入服务器后输入下面的命令完成绑定。');
    msg('link-msg', '', '');
    startTick();
    startWatch();
  }

  function twoFactorOn(u) {
    if (!u) return false;
    if (u.twoFactor !== undefined) return bool(u.twoFactor);
    if (u.two_factor !== undefined) return bool(u.two_factor);
    if (u.twofa && u.twofa.enabled !== undefined) return bool(u.twofa.enabled);
    return false;
  }

  function normalizeMe(d) {
    var u = d && d.user ? Object.assign({}, d.user) : null;
    if (!u) return null;
    if (d && d.pass && !u.pass) u.pass = d.pass;
    if (d && d.twoFactor !== undefined) u.twoFactor = bool(d.twoFactor);
    else if (u.twoFactor === undefined && u.twofa && u.twofa.enabled !== undefined) u.twoFactor = bool(u.twofa.enabled);
    else if (u.twoFactor === undefined && u.two_factor !== undefined) u.twoFactor = bool(u.two_factor);
    return u;
  }

  function passOf(u) {
    if (!u) return null;
    var p = u.pass;
    if (!p && u.user && u.user.pass) p = u.user.pass;
    if (!p || typeof p !== 'object') return null;
    var id = String(p.passId || p.pass_id || '').trim();
    var name = String(p.playerName || p.player_name || '').trim();
    var exists = p.exists;
    if (exists === undefined || exists === null || exists === '') exists = !!id;
    if (!bool(exists) && !id) return { exists: false, passId: '', playerName: name };
    return { exists: true, passId: id, playerName: name };
  }

  function passLabel(p) {
    if (!p || !p.exists) return '尚未创建';
    return '通行证：' + (p.passId || '—');
  }

  function passPlayerLabel(p) {
    if (!p || !p.exists) return '玩家名：—';
    return '玩家名：' + (p.playerName || '未同步');
  }

  function isTwoFactorRequired(d) {
    return !!(d && (bool(d.twoFactorRequired) || bool(d.two_factor_required) ||
      bool(d.need2fa) || bool(d.requires2fa) || bool(d.challengeRequired)));
  }

  function challengeIdOf(d) {
    if (!d) return '';
    return String(d.challengeId || d.challenge_id || d.challenge || '').trim();
  }

  function recoveryCodesOf(d) {
    var list = d && (d.recoveryCodes || d.recovery_codes || d.codes);
    if (!Array.isArray(list)) return [];
    return list.map(function (c) { return String(c === null || c === undefined ? '' : c).trim(); })
      .filter(function (c) { return !!c; });
  }

  function recoveryLeft(u) {
    var n = u && u.recoveryCodesLeft;
    if (typeof n === 'string' && n.trim() !== '') n = Number(n);
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  function tfaErrorMessage(err) {
    var c = err && err.code;
    var s = err && err.status;
    if (s === 401 || c === 'invalid_code' || c === 'invalid_2fa' || c === 'invalid_credentials') {
      return '验证码或密码不正确';
    }
    if (s === 400 || c === 'bad_request' || c === 'invalid_request') {
      return '验证码格式不正确，请输入 6 位验证码或恢复码';
    }
    if (c === 'turnstile_failed') return '人机验证未通过，请重试';
    if (c === 'turnstile_required') return '请先完成人机验证';
    if (c === 'already_enabled') return '两步验证已开启，请先关闭';
    if (c === 'not_enabled') return '两步验证当前未开启';
    if (s === 429 || c === 'rate_limited') return '尝试太频繁，请稍后再试';
    if (c === 'challenge_missing' || c === 'challenge_expired') return '验证会话已失效，请重新登录';
    if (c === 'NOT_CONNECTED') return '服务端未连接';
    return (err && err.message) || '验证失败，请重试';
  }

  function loginRequest(email, password) {
    var token = tsToken();
    if (!token) return Promise.reject(turnstileRequired());
    var body = { email: email, password: password, turnstileToken: token, remember: !!state.remember };
    return MCW.api.post('/api/auth/login', body).catch(function (err) {
      if (err && err.status === 404) {
        return MCW.api.post('/api/login', body);
      }
      throw err;
    });
  }

  function verifyRequest(challengeId, code) {
    var token = tsToken();
    if (!token) return Promise.reject(turnstileRequired());
    var body = { challengeId: challengeId, code: code, turnstileToken: token, remember: !!state.remember };
    return MCW.api.post('/api/login/2fa', body).catch(function (err) {
      if (err && err.status === 404) {
        return MCW.api.post('/api/auth/2fa/verify', body);
      }
      throw err;
    });
  }

  function resetTfaState(clearMsg) {
    state.tfa.phase = 'idle';
    state.tfa.secret = '';
    state.tfa.otpauthUrl = '';
    state.tfa.codes = [];
    state.tfa.rendered = false;
    var box = el('tfa-code-list');
    if (box) box.innerHTML = '';
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; }
    var sc = el('tfa-copy-secret');
    if (sc) { sc.setAttribute('data-copy', ''); sc.disabled = true; }
    var su = el('tfa-copy-uri');
    if (su) { su.setAttribute('data-copy', ''); su.disabled = true; }
    text('tfa-secret', '—');
    text('tfa-otpauth', '—');
    var ec = el('tfa-enable-code');
    if (ec) ec.value = '';
    var di = el('tfa-disable-input');
    if (di) di.value = '';
    var chk = el('tfa-codes-saved-check');
    if (chk) { chk.checked = false; chk.disabled = false; }
    disabled('tfa-download-codes', true);
    if (clearMsg !== false) msg('tfa-msg', '', '');
    paintTfa();
  }

  function paintLoginMode() {
    var challenge = state.tfa.phase === 'login';
    toggle('auth-tabs', !challenge);
    toggle('login-2fa-form', challenge);
    if (challenge) {
      toggle('login-form', false);
      toggle('register-form', false);
    }
    disabled('login-2fa-code', !state.connected);
    disabled('login-2fa-btn', !state.connected || !tsToken());
  }

  function paintGate() {
    var has = !!tsToken();
    disabled('login-btn', !state.connected || !has);
    disabled('register-btn', !state.connected || !has);
    disabled('login-2fa-btn', !state.connected || !has);
    var note = el('ts-note');
    if (note) note.textContent = has ? '人机验证已通过（5 分钟内有效）' : '需要验证时打开独立验证页，结果在本机保留 5 分钟。';
  }

  function onTurnstile(t) {
    paintGate();
    if (t && state.tfa.phase === 'login') {
      msg('acc-msg', '人机验证已通过，请输入 6 位验证码或恢复码。', 'ok');
    }
  }

  function showLoginChallenge(d) {
    state.tfa.phase = 'login';
    state.tfa.challengeId = challengeIdOf(d);
    var c = el('login-2fa-code');
    if (c) c.value = '';
    paintLoginMode();
    msg('acc-msg', state.tfa.challengeId
      ? '该账号已开启两步验证，请先完成人机验证，再输入 6 位验证码或恢复码。'
      : '服务端未返回验证会话，请重新登录。', state.tfa.challengeId ? 'ok' : 'err');
    if (c && c.focus && state.tfa.challengeId) {
      try { c.focus(); } catch (e) {}
    }
  }

  function resetLoginChallenge(clearMsg) {
    state.tfa.phase = 'idle';
    state.tfa.challengeId = '';
    toggle('login-2fa-form', false);
    toggle('auth-tabs', true);
    toggle('login-form', true);
    toggle('register-form', false);
    var c = el('login-2fa-code');
    if (c) c.value = '';
    if (clearMsg !== false) msg('acc-msg', '', '');
  }

  function paintTfa() {
    if (!el('tfa-box')) return;
    var st = viewState(state);
    var on = twoFactorOn(state.user);
    toggle('tfa-box', st === 'user');
    if (st !== 'user') {
      toggle('tfa-enable-row', false);
      toggle('tfa-disable-row', false);
      toggle('tfa-setup', false);
      toggle('tfa-codes', false);
      toggle('tfa-disable-form', false);
      return;
    }
    var left = recoveryLeft(state.user);
    text('tfa-status', on ? ('已开启' + (left === null ? '' : '（剩余恢复码 ' + left + ' 枚）')) : '未开启');
    var phase = state.tfa.phase;
    var busy = phase === 'setup' || phase === 'codes' || phase === 'disable';
    toggle('tfa-enable-row', !on && !busy);
    toggle('tfa-disable-row', on && !busy);
    toggle('tfa-setup', phase === 'setup');
    toggle('tfa-codes', phase === 'codes');
    toggle('tfa-disable-form', phase === 'disable');
    disabled('tfa-enable', !state.connected);
    disabled('tfa-disable-open', !state.connected);
    disabled('tfa-enable-btn', !state.connected);
    disabled('tfa-disable-btn', !state.connected);
    disabled('tfa-disable-input', !state.connected);
    syncRecoveryDownload();
  }

  function paintPass() {
    if (!el('pass-box')) return;
    var st = viewState(state);
    var p = passOf(state.user);
    var has = !!(p && p.exists);
    toggle('pass-box', st === 'user');
    toggle('pass-empty', st === 'user' && !has);
    toggle('pass-exists', st === 'user' && has);
    toggle('link-pass-note', st === 'user' && !has);
    text('pass-id', passLabel(p));
    text('pass-player', passPlayerLabel(p));
    var cp = el('pass-copy');
    if (cp) {
      cp.setAttribute('data-copy', has ? p.passId : '');
      cp.disabled = !has || !p.passId;
    }
  }

  function paint() {
    if (!el('account-panel')) return;
    var st = viewState(state);
    toggle('acc-offline', st === 'offline');
    toggle('acc-guest', st === 'guest');
    toggle('acc-user', st === 'user');
    text('acc-state', st === 'user' ? '已登录' : (st === 'offline' ? '未连接' : '未登录'));
    ['login-email', 'login-password', 'register-email', 'register-password',
      'register-password2', 'login-btn', 'register-btn', 'login-2fa-code',
      'login-2fa-btn'].forEach(function (id) {
      disabled(id, st === 'offline');
    });
    if (state.user) {
      text('acc-name', userLabel(state.user));
      text('acc-mc', mcLabel(state.user.mc));
    }
    paintLoginMode();
    paintTfa();
    paintPass();
    paintGate();
    paintRemember();
    var linkable = canLink(st);
    disabled('link-start', !linkable);
    if (!linkable) {
      toggle('link-box', false);
      toggle('link-cmd-row', false);
      text('link-expire', '');
      text('link-status', st === 'offline' ? '服务端未连接，绑定功能暂不可用。' : '登录后可生成绑定码。');
      stopTimers();
    }
    disabled('link-copy', !state.code || Date.now() >= state.expireAt);
    disabled('orders-refresh', st === 'offline');
    if (!state.user) {
      var b = el('orders-body');
      if (b) b.innerHTML = '<tr><td colspan="4" class="muted">' +
        (st === 'offline' ? '服务端未连接' : '登录后查看') + '</td></tr>';
    }
  }

  function reopenOnTurnstile(err, retry) {
    if (!err || err.code !== 'turnstile_failed') return false;
    tsReset();
    openVerify(retry, true);
    return true;
  }

  function authError(err) {
    var c = err && err.code;
    var s = err && err.status;
    if (s === 401 || c === 'unauthorized' || c === 'invalid_credentials') return '邮箱或密码不正确';
    if (s === 409 || c === 'user_exists') return '该邮箱已注册';
    if (s === 400 || c === 'bad_request') return '邮箱格式不对或密码少于 8 位';
    if (s === 429 || c === 'rate_limited') return '操作太频繁，请稍后再试';
    if (c === 'turnstile_failed') return '人机验证未通过，请重试';
    if (c === 'turnstile_required') return '请先完成人机验证';
    if (c === 'NOT_CONNECTED') return '服务端未连接';
    return (err && err.message) || '请求失败';
  }

  function setBusy(on, id, label) {
    var b = el(id);
    if (!b) return;
    if (on) {
      b.setAttribute('data-label', b.textContent);
      b.textContent = label;
      b.disabled = true;
    } else {
      b.textContent = b.getAttribute('data-label') || b.textContent;
      b.disabled = false;
    }
  }

  function clearPasswords() {
    ['login-password', 'register-password', 'register-password2', 'login-2fa-code',
      'tfa-enable-code', 'tfa-disable-input'].forEach(function (id) {
      var n = el(id);
      if (n) n.value = '';
    });
  }

  function switchTab(name) {
    if (state.tfa.phase === 'login') resetLoginChallenge(false);
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-auth-tab') === name ? 'true' : 'false');
    });
    toggle('auth-tabs', true);
    toggle('login-form', name === 'login');
    toggle('register-form', name === 'register');
    toggle('login-2fa-form', false);
    msg('acc-msg', '', '');
  }

  function renderOrders(items) {
    var b = el('orders-body');
    if (!b) return;
    if (!items || !items.length) {
      b.innerHTML = '<tr><td colspan="4" class="muted">暂无订单</td></tr>';
      return;
    }
    b.innerHTML = items.map(function (it) {
      var qty = it && it.qty !== null && it.qty !== undefined ? it.qty : '—';
      return '<tr><td class="sym">' + MCW.esc(it && it.symbol || '—') + '</td>' +
        '<td>' + MCW.esc(direction(it && it.side)) + '</td>' +
        '<td class="num">' + MCW.esc(String(qty)) + '</td>' +
        '<td>' + MCW.esc(orderStatus(it && it.status)) + '</td></tr>';
    }).join('');
  }

  function loadOrders() {
    if (!el('orders-body')) return;
    if (!state.connected) { renderOrders([]); var b0 = el('orders-body'); if (b0) b0.innerHTML = '<tr><td colspan="4" class="muted">服务端未连接</td></tr>'; return; }
    if (!state.user) { renderOrders([]); return; }
    MCW.api.get('/api/orders/mine').then(function (d) {
      renderOrders((d && d.items) || []);
    }, function (err) {
      if (err && (err.status === 401 || err.status === 404)) renderOrders([]);
      else {
        var b = el('orders-body');
        if (b) b.innerHTML = '<tr><td colspan="4" class="muted">' + MCW.esc((err && err.message) || '加载失败') + '</td></tr>';
      }
    });
  }

  function applyMe(d) {
    state.connected = true;
    var prev = userKey(state.user);
    var u = normalizeMe(d);
    state.user = u;
    if (userKey(u) !== prev) resetTfaState(false);
    paint();
    loadOrders();
    return u;
  }

  function refreshMe() {
    return MCW.api.get('/api/me').then(function (d) {
      return applyMe(d);
    }, function (err) {
      if (err && (err.status === 401 || err.code === 'unauthorized')) {
        state.connected = true;
        state.user = null;
      } else {
        state.connected = false;
        state.user = null;
      }
      resetTfaState(false);
      resetLoginChallenge(false);
      paint();
      loadOrders();
      return null;
    });
  }

  function logout() {
    MCW.api.post('/api/logout', {}).then(function () {
      state.user = null;
      state.code = '';
      state.expireAt = 0;
      stopTimers();
      resetTfaState(false);
      resetLoginChallenge(false);
      setRemembered(false);
      paint();
      loadOrders();
      msg('acc-msg', '已退出登录', 'ok');
    }, function (err) {
      msg('acc-msg', (err && err.message) || '退出失败', 'err');
    });
  }

  function login(email, password) {
    state.remember = rememberChecked();
    return loginRequest(email, password).then(function (d) {
      tsReset();
      if (isTwoFactorRequired(d)) {
        showLoginChallenge(d);
        return { challenge: true, challengeId: state.tfa.challengeId };
      }
      return MCW.api.get('/api/me').then(function (me) {
        var u = applyMe(me);
        setRemembered(state.remember);
        return { user: u };
      }, function (err) {
        if (err && err.status === 401) return { user: null };
        throw err;
      });
    }, function (err) {
      tsReset();
      throw err;
    });
  }

  function verifyChallenge(code) {
    if (!state.tfa.challengeId) {
      var e = new Error('验证会话已失效，请重新登录');
      e.code = 'challenge_missing';
      return Promise.reject(e);
    }
    return verifyRequest(state.tfa.challengeId, code).then(function (d) {
      tsReset();
      if (isTwoFactorRequired(d)) {
        showLoginChallenge(d);
        return { challenge: true };
      }
      resetLoginChallenge(false);
      return MCW.api.get('/api/me').then(function (me) {
        var u = applyMe(me);
        setRemembered(state.remember);
        return { user: u };
      }, function (err) {
        if (err && err.status === 401) {
          var e2 = new Error('登录状态异常，请重试');
          e2.code = 'session_missing';
          throw e2;
        }
        throw err;
      });
    }, function (err) {
      tsReset();
      throw err;
    });
  }

  function submitChallenge() {
    var c = el('login-2fa-code');
    var code = c ? c.value.trim() : '';
    if (!code) { msg('acc-msg', '请输入 6 位验证码或恢复码', 'err'); return; }
    if (!state.connected) { msg('acc-msg', '服务端未连接', 'err'); return; }
    if (!tsToken()) {
      paintGate();
      openVerify(function () { submitChallenge(); }, true);
      return;
    }
    setBusy(true, 'login-2fa-btn', '验证中…');
    verifyChallenge(code).then(function (res) {
      if (res && res.challenge) { msg('acc-msg', '请继续输入验证码', 'ok'); return; }
      if (!res || !res.user) { msg('acc-msg', '登录状态异常，请重试', 'err'); return; }
      msg('acc-msg', '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      reopenOnTurnstile(err, function () { submitChallenge(); });
      msg('acc-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'login-2fa-btn');
      paintGate();
    });
  }

  function postAuth(kind) {
    var isReg = kind === 'register';
    var uEl = el(isReg ? 'register-email' : 'login-email');
    var pEl = el(isReg ? 'register-password' : 'login-password');
    var u = uEl ? uEl.value.trim() : '';
    var p = pEl ? pEl.value : '';
    if (!state.connected) { msg('acc-msg', '服务端未连接', 'err'); return; }
    if (!u) { msg('acc-msg', '请输入邮箱', 'err'); return; }
    if (!emailOk(u)) { msg('acc-msg', '邮箱格式不正确', 'err'); return; }
    if (!p) { msg('acc-msg', '请输入密码', 'err'); return; }
    if (isReg) {
      if (p.length < 8) { msg('acc-msg', '密码至少 8 位', 'err'); return; }
      var p2El = el('register-password2');
      if ((p2El ? p2El.value : '') !== p) { msg('acc-msg', '两次输入的密码不一致', 'err'); return; }
    }
    state.remember = isReg ? false : rememberChecked();
    if (!tsToken()) {
      paintGate();
      openVerify(function () { postAuth(kind); }, true);
      return;
    }
    var btnId = isReg ? 'register-btn' : 'login-btn';
    setBusy(true, btnId, isReg ? '注册中…' : '登录中…');
    if (isReg) {
      var regToken = tsToken();
      MCW.api.post('/api/auth/register', {
        email: u, password: p, turnstileToken: regToken
      }).then(function () {
        tsReset();
        switchTab('login');
        clearPasswords();
        msg('acc-msg', '注册成功，请完成人机验证后登录', 'ok');
      }).catch(function (err) {
        tsReset();
        msg('acc-msg', authError(err), 'err');
      }).then(function () {
        setBusy(false, btnId);
        paintGate();
      });
      return;
    }
    login(u, p).then(function (res) {
      if (res && res.challenge) {
        clearPasswords();
        msg('acc-msg', '该账号已开启两步验证，请先完成人机验证，再输入 6 位验证码或恢复码。', 'ok');
        return;
      }
      if (!res || !res.user) {
        msg('acc-msg', '登录状态异常，请重试', 'err');
        return;
      }
      msg('acc-msg', state.remember ? '登录成功，已开启 30 天自动登录' : '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      reopenOnTurnstile(err, function () { postAuth(kind); });
      msg('acc-msg', authError(err), 'err');
    }).then(function () {
      setBusy(false, btnId);
      paintGate();
    });
  }

  function startTfaSetup() {
    if (!state.user) { msg('tfa-msg', '请先登录', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-enable', '生成中…');
    MCW.api.post('/api/2fa/setup', {}).then(function (d) {
      d = d || {};
      state.tfa.phase = 'setup';
      state.tfa.secret = String(d.secret || '').trim();
      state.tfa.otpauthUrl = String(d.otpauthUrl || d.otpauth_url || d.uri || '').trim();
      state.tfa.rendered = false;
      text('tfa-secret', state.tfa.secret || '—');
      text('tfa-otpauth', state.tfa.otpauthUrl || '—');
      var sc = el('tfa-copy-secret');
      if (sc) { sc.setAttribute('data-copy', state.tfa.secret); sc.disabled = !state.tfa.secret; }
      var su = el('tfa-copy-uri');
      if (su) { su.setAttribute('data-copy', state.tfa.otpauthUrl); su.disabled = !state.tfa.otpauthUrl; }
      var code = el('tfa-enable-code');
      if (code) code.value = '';
      paintTfa();
      msg('tfa-msg', '密钥已生成，请用验证器 App 添加后输入 6 位验证码。', 'ok');
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-enable');
    });
  }

  function recoveryFileText(email, codes, iso) {
    var list = (codes || []).map(function (c) {
      return String(c === null || c === undefined ? '' : c).trim();
    }).filter(function (c) { return !!c; });
    var lines = [
      'AMC 两步验证恢复码',
      '账号: ' + String(email || '—'),
      '生成时间: ' + String(iso || new Date().toISOString()),
      '说明: 每码仅可使用一次，请离线保存。',
      ''
    ];
    return lines.concat(list).join('\n') + '\n';
  }

  function syncRecoveryDownload() {
    var chk = el('tfa-codes-saved-check');
    var ready = !!(chk && chk.checked) && state.tfa.codes.length > 0;
    disabled('tfa-download-codes', !ready);
  }

  function downloadRecoveryCodes() {
    var codes = state.tfa.codes.slice();
    if (!codes.length) { msg('tfa-msg', '没有可下载的恢复码', 'err'); return false; }
    var email = state.user ? String(state.user.email || state.user.login || '') : '';
    var txt = recoveryFileText(email, codes, new Date().toISOString());
    try {
      var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'omc-recovery-codes.txt';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
      msg('tfa-msg', '恢复码已下载，请离线保存。', 'ok');
      return true;
    } catch (e) {
      msg('tfa-msg', '下载失败，请复制恢复码手动保存', 'err');
      return false;
    }
  }

  function renderRecoveryCodes(codes) {
    if (state.tfa.rendered) return false;
    var list = (codes || []).map(function (c) {
      return String(c === null || c === undefined ? '' : c).trim();
    }).filter(function (c) { return !!c; });
    if (!list.length) return false;
    var box = el('tfa-code-list');
    if (!box) return false;
    box.innerHTML = list.map(function (c) {
      return '<span class="mono">' + MCW.esc(c) + '</span>';
    }).join('');
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', list.join('\n')); cp.disabled = false; }
    var chk = el('tfa-codes-saved-check');
    if (chk) { chk.checked = false; chk.disabled = false; }
    disabled('tfa-download-codes', true);
    state.tfa.codes = list;
    state.tfa.rendered = true;
    return true;
  }

  function submitTfaEnable() {
    var c = el('tfa-enable-code');
    var code = c ? c.value.trim() : '';
    if (!/^\d{6}$/.test(code)) { msg('tfa-msg', '请输入 6 位数字验证码', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-enable-btn', '验证中…');
    MCW.api.post('/api/2fa/enable', { code: code }).then(function (d) {
      var codes = recoveryCodesOf(d);
      if (state.user) {
        state.user.twoFactor = true;
        state.user.recoveryCodesLeft = codes.length;
      }
      state.tfa.rendered = false;
      if (codes.length) {
        state.tfa.phase = 'codes';
        renderRecoveryCodes(codes);
        paintTfa();
        msg('tfa-msg', '两步验证已开启，请保存恢复码。', 'ok');
      } else {
        state.tfa.phase = 'idle';
        paintTfa();
        msg('tfa-msg', '两步验证已开启，但服务端未返回恢复码，请联系管理员。', 'err');
      }
      var ec = el('tfa-enable-code');
      if (ec) ec.value = '';
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-enable-btn');
    });
  }

  function closeRecoveryCodes() {
    state.tfa.phase = 'idle';
    state.tfa.codes = [];
    state.tfa.rendered = false;
    var box = el('tfa-code-list');
    if (box) box.innerHTML = '';
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; }
    var chk = el('tfa-codes-saved-check');
    if (chk) { chk.checked = false; chk.disabled = false; }
    disabled('tfa-download-codes', true);
    paintTfa();
    msg('tfa-msg', '恢复码已关闭。', 'ok');
  }

  function syncDisableInput() {
    var sel = el('tfa-disable-method');
    var input = el('tfa-disable-input');
    if (!input) return;
    var isCode = !sel || sel.value !== 'password';
    input.setAttribute('type', isCode ? 'text' : 'password');
    input.setAttribute('inputmode', isCode ? 'numeric' : 'text');
    input.setAttribute('placeholder', isCode ? '123456 或恢复码' : '当前账号密码');
    input.setAttribute('autocomplete', isCode ? 'one-time-code' : 'current-password');
  }

  function openTfaDisable() {
    if (!state.user) { msg('tfa-msg', '请先登录', 'err'); return; }
    state.tfa.phase = 'disable';
    var sel = el('tfa-disable-method');
    if (sel) sel.value = 'code';
    var input = el('tfa-disable-input');
    if (input) input.value = '';
    syncDisableInput();
    paintTfa();
    msg('tfa-msg', '', '');
  }

  function submitTfaDisable() {
    var sel = el('tfa-disable-method');
    var input = el('tfa-disable-input');
    var method = sel && sel.value === 'password' ? 'password' : 'code';
    var val = input ? input.value : '';
    if (!val) { msg('tfa-msg', method === 'password' ? '请输入账号密码' : '请输入验证码或恢复码', 'err'); return; }
    if (method === 'code' && val.length < 6) { msg('tfa-msg', '请输入 6 位验证码或恢复码', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-disable-btn', '关闭中…');
    var body = method === 'password' ? { password: val } : { code: val };
    MCW.api.post('/api/2fa/disable', body).then(function () {
      if (state.user) {
        state.user.twoFactor = false;
        state.user.recoveryCodesLeft = 0;
      }
      state.tfa.phase = 'idle';
      state.tfa.secret = '';
      state.tfa.otpauthUrl = '';
      state.tfa.codes = [];
      state.tfa.rendered = false;
      var di = el('tfa-disable-input');
      if (di) di.value = '';
      paintTfa();
      msg('tfa-msg', '两步验证已关闭。', 'ok');
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-disable-btn');
    });
  }

  function startLink() {
    if (!state.user) { msg('link-msg', '请先登录', 'err'); return; }
    var btn = el('link-start');
    if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
    MCW.api.post('/api/link/start', {}).then(function (d) {
      showLink(d || {});
      if (btn) btn.textContent = '重新生成';
    }).catch(function (err) {
      if (err && err.status === 401) { state.user = null; paint(); }
      msg('link-msg', authError(err), 'err');
    }).then(function () {
      if (btn) btn.disabled = !state.user;
    });
  }

  function tfaSnapshot() {
    return {
      phase: state.tfa.phase,
      challengeId: state.tfa.challengeId,
      secret: state.tfa.secret,
      otpauthUrl: state.tfa.otpauthUrl,
      codes: state.tfa.codes.slice(),
      rendered: state.tfa.rendered
    };
  }

  function mount() {
    if (!el('account-panel')) return;
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-auth-tab')); });
    });
    var to = el('ts-open');
    if (to) to.addEventListener('click', function () { openVerify(null, false); });
    var chk = el('tfa-codes-saved-check');
    if (chk) chk.addEventListener('change', syncRecoveryDownload);
    var dl = el('tfa-download-codes');
    if (dl) dl.addEventListener('click', downloadRecoveryCodes);
    if (window.addEventListener) {
      window.addEventListener('message', function (e) {
        if (e.origin !== location.origin) return;
        var d = e.data;
        if (!d || d.type !== 'omc-turnstile' || !d.token) return;
        paintGate();
        var fn = state.verifyAfter;
        state.verifyAfter = null;
        if (fn) fn();
      });
      window.addEventListener('focus', function () { paintGate(); paintRemember(); });
      window.addEventListener('storage', function (e) {
        if (e.key === 'omc_ts_token') paintGate();
        if (e.key === REMEMBER_KEY) paintRemember();
      });
    }
    var lf = el('login-form');
    if (lf) lf.addEventListener('submit', function (e) { e.preventDefault(); postAuth('login'); });
    var rf = el('register-form');
    if (rf) rf.addEventListener('submit', function (e) { e.preventDefault(); postAuth('register'); });
    var l2f = el('login-2fa-form');
    if (l2f) l2f.addEventListener('submit', function (e) { e.preventDefault(); submitChallenge(); });
    var l2b = el('login-2fa-back');
    if (l2b) l2b.addEventListener('click', function () { resetLoginChallenge(true); });
    var te = el('tfa-enable');
    if (te) te.addEventListener('click', startTfaSetup);
    var tsc = el('tfa-setup-cancel');
    if (tsc) tsc.addEventListener('click', function () { resetTfaState(true); });
    var tef = el('tfa-enable-form');
    if (tef) tef.addEventListener('submit', function (e) { e.preventDefault(); submitTfaEnable(); });
    var tcs = el('tfa-codes-saved');
    if (tcs) tcs.addEventListener('click', closeRecoveryCodes);
    var tdo = el('tfa-disable-open');
    if (tdo) tdo.addEventListener('click', openTfaDisable);
    var tdm = el('tfa-disable-method');
    if (tdm) tdm.addEventListener('change', syncDisableInput);
    var tdb = el('tfa-disable-btn');
    if (tdb) tdb.addEventListener('click', submitTfaDisable);
    var tdc = el('tfa-disable-cancel');
    if (tdc) tdc.addEventListener('click', function () { resetTfaState(true); });
    var tdi = el('tfa-disable-input');
    if (tdi) tdi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitTfaDisable(); }
    });
    var lo = el('acc-logout');
    if (lo) lo.addEventListener('click', logout);
    var ls = el('link-start');
    if (ls) ls.addEventListener('click', startLink);
    var or = el('orders-refresh');
    if (or) or.addEventListener('click', function () { loadOrders(); });
    var retry = el('acc-retry');
    if (retry) retry.addEventListener('click', function () {
      state.connected = MCW.api.connected();
      paint();
      if (state.connected) refreshMe();
    });
    state.connected = MCW.api.connected();
    paint();
    loadOrders();
    if (state.connected) refreshMe();
  }

  MCW.account = {
    validCode: validCode,
    emailOk: emailOk,
    userLabel: userLabel,
    bindCommand: bindCommand,
    viewState: viewState,
    canLink: canLink,
    direction: direction,
    orderStatus: orderStatus,
    mcLabel: mcLabel,
    twoFactorOn: twoFactorOn,
    normalizeMe: normalizeMe,
    passOf: passOf,
    passLabel: passLabel,
    passPlayerLabel: passPlayerLabel,
    paintPass: paintPass,
    isTwoFactorRequired: isTwoFactorRequired,
    challengeIdOf: challengeIdOf,
    recoveryCodesOf: recoveryCodesOf,
    turnstileToken: tsToken,
    onTurnstile: onTurnstile,
    openVerify: openVerify,
    remembered: remembered,
    setRemembered: setRemembered,
    recoveryFileText: recoveryFileText,
    downloadRecoveryCodes: downloadRecoveryCodes,
    syncRecoveryDownload: syncRecoveryDownload,
    paintGate: paintGate,
    authError: authError,
    tfaErrorMessage: tfaErrorMessage,
    showLoginChallenge: showLoginChallenge,
    resetLoginChallenge: resetLoginChallenge,
    login: login,
    verifyChallenge: verifyChallenge,
    renderRecoveryCodes: renderRecoveryCodes,
    tfaSnapshot: tfaSnapshot,
    mount: mount,
    refresh: refreshMe
  };

  MCW.ready(mount);
})();

  });
  /* ===== assets/js/prewarm.js ===== */
  seg("prewarm.js", function () {
/* 账号区可见时预热 Turnstile：首屏不加载 api.js，不阻塞渲染；失败静默放弃，回落到 403 turnstile_required -> verify.html。 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var CDN = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var CACHE_KEY = 'omc_ts_token';
  var TTL = 5 * 60 * 1000;
  var started = false, done = false, timer = null, tries = 0, watching = false, queued = false;

  function freshToken() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return '';
      var o = JSON.parse(raw);
      var t = String(o && o.token || '').trim();
      var exp = Number(o && o.exp || 0);
      if (t && isFinite(exp) && exp > Date.now()) return t;
    } catch (e) {}
    return '';
  }

  function saveToken(t) {
    var v = String(t || '').trim();
    if (!v) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ token: v, exp: Date.now() + TTL })); } catch (e) {}
    window.__TS_TOKEN__ = v;
    if (MCW.account && typeof MCW.account.onTurnstile === 'function') {
      try { MCW.account.onTurnstile(v); } catch (e) {}
    }
  }

  function giveUp() {
    done = true;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function idleLoad() {
    if (started || done || queued) return;
    queued = true;
    if ('requestIdleCallback' in window) {
      try {
        requestIdleCallback(function () { queued = false; load(); }, { timeout: 3000 });
        return;
      } catch (e) { queued = false; }
    }
    setTimeout(function () { queued = false; load(); }, 2500);
  }

  function render() {
    if (done) return;
    var box = document.getElementById('ts-prewarm');
    if (!box) { giveUp(); return; }
    if (!window.turnstile || typeof window.turnstile.render !== 'function') {
      if (tries >= 80) { giveUp(); return; }
      tries += 1;
      timer = setTimeout(render, 100);
      return;
    }
    try {
      window.turnstile.render(box, {
        sitekey: String(CFG.turnstileSiteKey || ''),
        theme: 'auto',
        language: 'zh-cn',
        callback: function (t) { done = true; saveToken(t); },
        'error-callback': function () { giveUp(); },
        'timeout-callback': function () { giveUp(); }
      });
    } catch (e) { giveUp(); }
  }

  function load() {
    if (started) return;
    started = true;
    if (freshToken()) { done = true; return; }
    if (window.turnstile) { render(); return; }
    var s = document.createElement('script');
    s.src = CDN;
    s.async = true;
    s.defer = true;
    s.onload = function () { render(); };
    s.onerror = function () { giveUp(); };
    try { (document.head || document.documentElement).appendChild(s); } catch (e) { giveUp(); }
  }

  function start() {
    if (started || done || watching) return;
    if (!String(CFG.turnstileSiteKey || '').trim()) return;
    var panel = document.getElementById('account-panel');
    if (!panel) return;
    watching = true;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { io.disconnect(); load(); return; }
        }
      }, { rootMargin: '200px 0px', threshold: 0.01 });
      io.observe(panel);
    }
    if (document.readyState === 'complete') idleLoad();
    else window.addEventListener('load', idleLoad, { once: true });
  }

  MCW.prewarm = { start: start, load: load };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

  });
  /* ===== assets/js/play.js ===== */
  seg("play.js", function () {
/* 进服页：地址与版本（零依赖）——地址统一由 address.js 自愈，登录后 /api/link/start 可直接覆盖 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});

  function refreshServerAddress() {
    return MCW.address.refresh('/api/status', 'serverAddress');
  }

  function setServerAddress(raw) {
    return MCW.address.set(raw);
  }

  MCW.play = {
    refreshServerAddress: refreshServerAddress,
    setServerAddress: setServerAddress,
    normalizeAddress: MCW.address.normalize,
    address: function () { return MCW.address.current(); }
  };

  MCW.ready(function () {
    MCW.address.bind();
    /* 首屏自动取一次地址；不碰 Turnstile，失败保留“未获取（可重试）” */
    function auto() {
      try { MCW.address.refresh('/api/status', 'serverAddress'); } catch (e) {}
    }
    try {
      if ('requestIdleCallback' in window) requestIdleCallback(auto, { timeout: 1500 });
      else setTimeout(auto, 0);
    } catch (e) {
      setTimeout(auto, 0);
    }
  });
})();

  });
  if (errors.length) warn();
})();
