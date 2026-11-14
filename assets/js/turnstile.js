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
