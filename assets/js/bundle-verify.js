/* AMC bundle-verify.js — 手工顺序拼接，勿手改；顺序：util.js → from.js → turnstile.js → verify.js */
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
  /* ===== assets/js/turnstile.js ===== */
  seg("turnstile.js", function () {
/* Cloudflare Turnstile（explicit 渲染，零依赖）：token 缓存 5 分钟，统一写入 window.__TS_TOKEN__ */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var SITEKEY = String(CFG.turnstileSiteKey || '').trim();
  var CACHE_KEY = 'omc_ts_token';
  var TTL = 5 * 60 * 1000;
  var widgetId = null;
  var token = '';
  var apiTimer = null;
  var apiTries = 0;
  var handlers = [];

  window.__TS_TOKEN__ = window.__TS_TOKEN__ || '';

  function el(id) { return document.getElementById(id); }

  function setState(s) {
    var n = el('ts-state');
    if (n) n.textContent = s;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return '';
      var o = JSON.parse(raw);
      var t = String(o && o.token || '').trim();
      var exp = Number(o && o.exp || 0);
      if (!t || !isFinite(exp) || exp <= Date.now()) {
        localStorage.removeItem(CACHE_KEY);
        return '';
      }
      return t;
    } catch (e) { return ''; }
  }

  function notify() {
    var t = getToken();
    handlers.slice().forEach(function (fn) {
      try { fn(t); } catch (e) {}
    });
    if (MCW.account && typeof MCW.account.onTurnstile === 'function') {
      try { MCW.account.onTurnstile(t); } catch (e) {}
    }
  }

  function saveToken(v) {
    token = String(v === null || v === undefined ? '' : v).trim();
    window.__TS_TOKEN__ = token;
    var exp = 0;
    try {
      if (token) {
        exp = Date.now() + TTL;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ token: token, exp: exp }));
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (e) { exp = token ? Date.now() + TTL : 0; }
    var input = el('ts-token');
    if (input) input.value = token;
    setState(token ? '已验证' : '未验证');
    notify();
    return exp;
  }

  function clearToken() {
    return saveToken('');
  }

  function getToken() {
    if (token) return token;
    var cached = readCache();
    if (cached) {
      token = cached;
      window.__TS_TOKEN__ = cached;
      return cached;
    }
    token = String(window.__TS_TOKEN__ || '').trim();
    return token;
  }

  function onChange(fn) {
    if (typeof fn === 'function') handlers.push(fn);
  }

  function render() {
    var box = el('ts-widget');
    if (!box) return false;
    if (!SITEKEY) { setState('未配置'); return false; }
    if (widgetId !== null) return true;
    if (!window.turnstile || typeof window.turnstile.render !== 'function') return false;
    try {
      widgetId = window.turnstile.render(box, {
        sitekey: SITEKEY,
        theme: 'auto',
        language: 'zh-cn',
        callback: function (t) { saveToken(t); },
        'expired-callback': function () { clearToken(); setState('验证已过期，请重新验证'); },
        'timeout-callback': function () { clearToken(); setState('验证超时，请重试'); },
        'error-callback': function (code) {
          clearToken();
          var c = (code === undefined || code === null) ? '' : String(code);
          if (window.console && console.warn) console.warn('[turnstile] error code=' + c);
          setState(c ? ('验证组件异常（错误码 ' + c + '），请刷新') : '验证组件异常，请刷新');
        }
      });
      setState('请完成验证');
      return true;
    } catch (e) {
      setState('验证组件加载失败');
      return false;
    }
  }

  function waitApi() {
    if (render()) return;
    if (apiTries >= 200) {
      setState('验证组件加载失败，请刷新');
      return;
    }
    apiTries += 1;
    apiTimer = setTimeout(waitApi, 100);
  }

  function reset() {
    clearToken();
    setState('请完成验证');
    if (window.turnstile && widgetId !== null) {
      try { window.turnstile.reset(widgetId); } catch (e) {}
    }
    if (!render()) waitApi();
  }

  function init() {
    var box = el('ts-widget');
    if (!box) {
      setState(getToken() ? '已验证' : '未验证');
      return;
    }
    waitApi();
  }

  MCW.turnstile = {
    sitekey: SITEKEY,
    cacheKey: CACHE_KEY,
    ttl: TTL,
    token: getToken,
    saveToken: saveToken,
    clearToken: clearToken,
    reset: reset,
    render: render,
    onChange: onChange,
    state: function () {
      var n = el('ts-state');
      return n ? n.textContent : '';
    }
  };

  MCW.ready(init);
})();

  });
  /* ===== assets/js/verify.js ===== */
  seg("verify.js", function () {
/* AMC 独立人机验证页：通过后写 5 分钟缓存并回传 opener/父窗口 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var DEFAULT_NEXT = './play.html';
  var done = false;

  function el(id) { return document.getElementById(id); }
  function text(id, v) { var n = el(id); if (n) n.textContent = v; }
  function msg(s, kind) {
    var n = el('verify-msg');
    if (!n) return;
    n.textContent = s || '';
    n.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function safeNext(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!s) return DEFAULT_NEXT;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return DEFAULT_NEXT;
    if (s.slice(0, 2) === '//' || s.indexOf('\\') !== -1) return DEFAULT_NEXT;
    if (/[\u0000-\u001f\u007f]/.test(s)) return DEFAULT_NEXT;
    try {
      var u = new URL(s, location.href);
      if (u.origin !== location.origin) return DEFAULT_NEXT;
      if (u.pathname === location.pathname) return DEFAULT_NEXT;
      return u.pathname + u.search + u.hash;
    } catch (e) { return DEFAULT_NEXT; }
  }

  function nextValue() {
    var p = MCW.params ? MCW.params() : {};
    return safeNext(p.next);
  }

  function post(token, exp) {
    var payload = { type: 'omc-turnstile', token: token, exp: exp };
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, location.origin);
      }
    } catch (e) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, location.origin);
      }
    } catch (e) {}
  }

  function finish(token) {
    if (done) return;
    var t = String(token || '').trim();
    if (!t) return;
    done = true;
    var exp = 0;
    if (MCW.turnstile && typeof MCW.turnstile.saveToken === 'function') exp = MCW.turnstile.saveToken(t);
    post(t, exp);
    var next = nextValue();
    var back = el('verify-next');
    if (back) back.setAttribute('href', next);
    text('ts-state', '已验证');
    msg('验证完成，正在返回…', 'ok');
    var hasOpener = false;
    try { hasOpener = !!(window.opener && !window.opener.closed); } catch (e) { hasOpener = false; }
    setTimeout(function () {
      if (hasOpener) {
        try { window.close(); } catch (e) {}
        msg('验证完成，可以关闭此页。', 'ok');
      } else {
        try { location.replace(next); } catch (e) { location.href = next; }
      }
    }, hasOpener ? 500 : 700);
  }

  function init() {
    if (MCW.turnstile && typeof MCW.turnstile.clearToken === 'function') MCW.turnstile.clearToken();
    var next = nextValue();
    var back = el('verify-next');
    if (back) back.setAttribute('href', next);
    text('ts-note', '完成验证后会自动返回；若未返回，请点击下方按钮。');
    if (MCW.turnstile && typeof MCW.turnstile.onChange === 'function') {
      MCW.turnstile.onChange(function (t) { finish(t); });
    }
    if (MCW.turnstile && typeof MCW.turnstile.reset === 'function') MCW.turnstile.reset();
    var retry = el('verify-retry');
    if (retry) retry.addEventListener('click', function () {
      done = false;
      msg('', '');
      if (MCW.turnstile && typeof MCW.turnstile.reset === 'function') MCW.turnstile.reset();
    });
  }

  MCW.verify = { safeNext: safeNext, next: nextValue, finish: finish };
  MCW.ready(init);
})();

  });
  if (errors.length) warn();
})();
