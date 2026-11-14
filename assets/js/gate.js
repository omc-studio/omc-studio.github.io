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
