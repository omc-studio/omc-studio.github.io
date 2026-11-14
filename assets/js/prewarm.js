/* 账号区可见时预热 Turnstile：首屏不加载 api.js，不阻塞渲染；失败静默放弃，回落到 403 turnstile_required -> verify.html。 */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CFG = window.MCW_CONFIG || {};
  var CDN = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var CACHE_KEY = 'omc_ts_token';
  var TTL = 5 * 60 * 1000;
  var started = false, done = false, timer = null, tries = 0;

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
    (document.head || document.documentElement).appendChild(s);
  }

  function start() {
    if (started || done) return;
    if (!String(CFG.turnstileSiteKey || '').trim()) return;
    var panel = document.getElementById('account-panel');
    if (!panel) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { io.disconnect(); load(); return; }
        }
      }, { rootMargin: '200px 0px', threshold: 0.01 });
      io.observe(panel);
    } else if ('requestIdleCallback' in window) {
      requestIdleCallback(load, { timeout: 3000 });
    } else {
      setTimeout(load, 2000);
    }
  }

  MCW.prewarm = { start: start, load: load };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
