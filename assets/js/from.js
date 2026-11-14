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
