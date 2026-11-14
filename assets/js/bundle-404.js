/* AMC bundle-404.js — 手工顺序拼接，勿手改；顺序：gate.js → alias.js → util.js → from.js → api.js → nav.js */
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
  /* ===== assets/js/alias.js ===== */
  seg("alias.js", function () {
/* 已知旧地址别名：GitHub Pages 无 clean URL，404.html 在首屏按表 replace 到真实页面。
 * 保留 query/hash；目标自带 hash（如 #account）时目标 hash 优先。零依赖、无 DOM 依赖。
 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var MAP = {
    '/stocks': '/stocks.html',
    '/market': '/market.html',
    '/play': '/play.html',
    '/rules': '/rules.html',
    '/verify': '/verify.html',
    '/account': '/play.html#account',
    '/account.html': '/play.html#account',
    '/map': '/2d/',
    '/map/': '/2d/',
    '/servers': '/play.html',
    '/connect': '/play.html',
    '/shop': '/play.html'
  };

  function normalize(pathname) {
    var p = String(pathname || '');
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    return p;
  }

  function targetFor(pathname) {
    return MAP[normalize(pathname)] || '';
  }

  function build(target) {
    var q = String(location.search || '');
    var h = String(location.hash || '');
    var i = String(target).indexOf('#');
    if (i !== -1) return target.slice(0, i) + q + target.slice(i);
    return target + q + h;
  }

  function current() {
    return String(location.pathname || '') + String(location.search || '') + String(location.hash || '');
  }

  MCW.aliases = { map: MAP, normalize: normalize, targetFor: targetFor, build: build };

  if (!window.__MCW_ALIAS_NO_AUTO__) {
    var t = targetFor(location.pathname);
    if (t) {
      var dest = build(t);
      if (dest !== current()) location.replace(dest);
    }
  }
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
  if (errors.length) warn();
})();
