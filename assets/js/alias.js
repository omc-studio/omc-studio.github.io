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
