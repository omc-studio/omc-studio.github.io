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
