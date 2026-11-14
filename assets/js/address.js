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
    if (addr) addr.textContent = currentAddress || (revealed ? '待开通' : '未获取');
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
      set(data[field]);
      setVersion(data.version);
      return currentAddress;
    }, function () {
      setVersion('');
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
      var next = normalize(data.serverAddress);
      if (next !== currentAddress) {
        set(next);
        if (MCW.toast) MCW.toast(next ? '地址已更新' : '地址待开通', next ? 'ok' : 'err');
      }
      setVersion(data.version);
      return currentAddress;
    }, function () {
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
    current: function () { return currentAddress; },
    version: function () { return formatVersion(currentVersion); }
  };

  MCW.ready(init);
})();
