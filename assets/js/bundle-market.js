/* AMC bundle-market.js — 手工顺序拼接，勿手改；顺序：gate.js → util.js → from.js → api.js → live.js → chart.js → nav.js → items-zh.js → market.js */
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
  /* ===== assets/js/items-zh.js ===== */
  seg("items-zh.js", function () {
/* AMC 物品中文名映射（零依赖，纯查表） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  MCW.itemsZh = {
    amethyst_shard: '紫水晶碎片',
    apple: '苹果',
    blaze_rod: '烈焰棒',
    bread: '面包',
    carrot: '胡萝卜',
    charcoal: '木炭',
    coal: '煤炭',
    cobblestone: '圆石',
    cooked_beef: '牛排',
    copper_ingot: '铜锭',
    diamond: '钻石',
    dirt: '泥土',
    emerald: '绿宝石',
    ender_pearl: '末影珍珠',
    glowstone_dust: '荧石粉',
    gold_ingot: '金锭',
    gunpowder: '火药',
    iron_ingot: '铁锭',
    lapis_lazuli: '青金石',
    leather: '皮革',
    netherite_ingot: '下界合金锭',
    oak_log: '橡木原木',
    obsidian: '黑曜石',
    potato: '土豆',
    quartz: '下界石英',
    redstone: '红石',
    sand: '沙子',
    slime_ball: '粘液球',
    string: '线',
    wheat: '小麦'
  };
})();

  });
  /* ===== assets/js/market.js ===== */
  seg("market.js", function () {
/* 物品行情（零依赖） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var state = { items: [], selected: '', detail: null, conn: 'connecting' };
  var poller = null;

  function text(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  function displayName(id) {
    var raw = String(id === null || id === undefined ? '' : id);
    var key = raw.indexOf('minecraft:') === 0 ? raw.slice(10) : raw;
    var zh = MCW.itemsZh && Object.prototype.hasOwnProperty.call(MCW.itemsZh, key) ? MCW.itemsZh[key] : '';
    if (zh) return zh;
    return key.replace(/_/g, ' ');
  }

  function normalizeItem(it) {
    if (!it || typeof it !== 'object') return it;
    var out = {};
    for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) out[k] = it[k];
    if (out.change24h === undefined || out.change24h === null) {
      var n = Number(out.changePct);
      if (isFinite(n)) out.change24h = n;
    }
    return out;
  }

  function normalizeMarket(input) {
    if (Array.isArray(input)) return input.map(normalizeItem);
    if (input && typeof input === 'object') {
      if (Array.isArray(input.items)) return input.items.map(normalizeItem);
      return normalizeItem(input);
    }
    return [];
  }

  function paintSource(p) {
    var dot = document.getElementById('src-dot');
    if (dot) dot.className = 'dot ' + MCW.live.stateClass(p.state);
    text('src-text', p.state === 'live' ? '数据源已连接' : MCW.live.label(p.state));
    text('src-time', p.lastOk ? '更新 ' + MCW.clock(p.lastOk) : '');
    var note = document.getElementById('offline-note');
    if (note) note.classList.toggle('hidden', p.state === 'live');
    var det = document.getElementById('offline-detail');
    if (det) {
      det.textContent = p.expired
        ? '已超过 60 秒未连接，数字已置空；服务端未连接（可重试），每 5 秒重试。'
        : (p.state === 'stale'
          ? '连接中断于 ' + MCW.clock(p.downSince) + '，显示最后一次成功数据（最多 60 秒），每 5 秒重试。'
          : '服务端未连接（可重试），等待恢复，每 5 秒重试。');
    }
  }

  function renderList() {
    var body = document.getElementById('market-body');
    if (!body) return;
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted">' + (state.conn === 'live' ? '暂无物品' : '暂无数据') + '</td></tr>';
      text('mkt-count', '—');
      return;
    }
    text('mkt-count', String(state.items.length));
    body.innerHTML = state.items.map(function (it) {
      var dir = MCW.dirClass(it.change24h);
      return '<tr data-id="' + MCW.esc(it.id) + '"' + (it.id === state.selected ? ' class="sel"' : '') + '>' +
        '<td class="name">' + MCW.esc(displayName(it.id || it.name)) + '</td>' +
        '<td class="num">' + MCW.price(it.price) + '</td>' +
        '<td class="num ' + dir + '">' + MCW.pct(it.change24h) + '</td>' +
        '<td class="num">' + MCW.fmtInt(it.volume) + '</td>' +
        '<td>' + MCW.chart.spark(it.history) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderDetail() {
    var d = state.detail;
    var chart = document.getElementById('i-chart');
    if (!d) {
      text('i-name', '—'); text('i-price', '—'); text('i-chg', '—');
      text('i-vol', '—'); text('i-buyers', '—'); text('i-sellers', '—'); text('i-id', '—');
      if (chart) chart.innerHTML = '<div class="chart-empty">暂无数据</div>';
      return;
    }
    text('i-name', displayName(d.id || d.name) || '—');
    text('i-price', MCW.price(d.price));
    var chg = document.getElementById('i-chg');
    if (chg) {
      chg.textContent = MCW.pct(d.change24h);
      chg.className = 'chg ' + MCW.dirClass(d.change24h);
    }
    text('i-vol', MCW.fmtInt(d.volume));
    text('i-buyers', MCW.fmtInt(d.buyers));
    text('i-sellers', MCW.fmtInt(d.sellers));
    text('i-id', d.id || '—');
    text('i-updated', d.ts ? '更新 ' + MCW.clock(d.ts) : '');
    if (chart && Array.isArray(d.history) && d.history.length > 1) {
      MCW.chart.line(chart, d.history, { height: 220, label: displayName(d.id || d.name) + ' 价格', fmt: function (v) { return MCW.price(v); } });
    } else if (chart) {
      chart.innerHTML = '<div class="chart-empty">暂无数据</div>';
    }
  }

  function pick(id) {
    state.selected = id;
    state.detail = null;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) { state.detail = state.items[i]; break; }
    }
    renderList();
    renderDetail();
  }

  MCW.market = { normalizeMarket: normalizeMarket, displayName: displayName };

  MCW.ready(function () {
    var body = document.getElementById('market-body');
    if (!body) return;
    body.addEventListener('click', function (ev) {
      var tr = ev.target.closest ? ev.target.closest('tr[data-id]') : null;
      if (tr) pick(tr.getAttribute('data-id'));
    });

    if (!MCW.api.connected()) {
      state.conn = 'down';
      renderList();
      renderDetail();
      paintSource({ state: 'down', lastOk: 0, downSince: Date.now() });
      return;
    }

    poller = MCW.live.make('/api/market', { interval: CFG.pollMs || 5000 });
    poller.on(function (p) {
      state.conn = p.state;
      if (p.data && Array.isArray(p.data.items)) {
        state.items = normalizeMarket(p.data.items);
        if (!state.selected && state.items.length) pick(state.items[0].id);
        else if (state.selected) {
          for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].id === state.selected) { state.detail = state.items[i]; break; }
          }
        }
      } else if (p.expired) {
        state.items = [];
        state.detail = null;
        state.selected = '';
      }
      renderList();
      renderDetail();
      paintSource(p);
    });
    poller.start();
  });
})();

  });
  if (errors.length) warn();
})();
