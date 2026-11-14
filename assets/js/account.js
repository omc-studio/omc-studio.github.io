/* AMC 账号、绑定与订单（零依赖，同源 cookie 会话） */
(function () {
  'use strict';
  var MCW = window.MCW || (window.MCW = {});
  var CODE_RE = /^\d{6}$/;
  var LINK_TTL = 10 * 60 * 1000;

  var REMEMBER_KEY = 'omc_remember';
  var state = {
    connected: false,
    user: null,
    code: '',
    expireAt: 0,
    tickTimer: null,
    watchTimer: null,
    remember: false,
    verifyAfter: null,
    tfa: {
      phase: 'idle',
      challengeId: '',
      secret: '',
      otpauthUrl: '',
      codes: [],
      rendered: false
    }
  };

  function el(id) { return document.getElementById(id); }
  function text(id, v) { var n = el(id); if (n) n.textContent = v; }
  function toggle(id, show) { var n = el(id); if (n) n.classList[show ? 'remove' : 'add']('hidden'); }
  function disabled(id, v) { var n = el(id); if (n) n.disabled = !!v; }
  function msg(id, s, kind) {
    var n = el(id);
    if (!n) return;
    n.textContent = s || '';
    n.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function tsToken() {
    if (MCW.turnstile && typeof MCW.turnstile.token === 'function') {
      var t = String(MCW.turnstile.token() || '');
      if (t) return t;
    }
    try {
      var raw = localStorage.getItem('omc_ts_token');
      if (raw) {
        var o = JSON.parse(raw);
        var c = String(o && o.token || '').trim();
        var exp = Number(o && o.exp || 0);
        if (c && isFinite(exp) && exp > Date.now()) return c;
      }
    } catch (e) {}
    var n = el('ts-token');
    return String(window.__TS_TOKEN__ || (n && n.value) || '');
  }

  function tsReset() {
    if (MCW.turnstile && typeof MCW.turnstile.clearToken === 'function') {
      MCW.turnstile.clearToken();
    }
    try { localStorage.removeItem('omc_ts_token'); } catch (e) {}
    window.__TS_TOKEN__ = '';
    var n = el('ts-token');
    if (n) n.value = '';
    if (MCW.turnstile && typeof MCW.turnstile.reset === 'function') {
      MCW.turnstile.reset();
    }
  }

  function rememberChecked() {
    var c = el('login-remember');
    return !!(c && c.checked);
  }

  function remembered() {
    try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch (e) { return false; }
  }

  function paintRemember() {
    var n = el('acc-remember');
    if (n) n.textContent = remembered() ? '已开启 30 天自动登录' : '未开启 30 天自动登录';
  }

  function setRemembered(on) {
    try {
      if (on) localStorage.setItem(REMEMBER_KEY, '1');
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
    paintRemember();
  }

  function openVerify(after, auto) {
    var next = location.pathname + location.search + location.hash;
    var url = './verify.html?next=' + encodeURIComponent(next);
    if (MCW.from && typeof MCW.from.addToUrl === 'function') url = MCW.from.addToUrl(url);
    if (typeof after === 'function') state.verifyAfter = after;
    var w = null;
    if (typeof window.open === 'function') {
      try { w = window.open(url, 'omc_verify', 'width=480,height=680'); } catch (e) { w = null; }
    }
    if (!w) {
      state.verifyAfter = null;
      msg('acc-msg', '弹窗被拦截，请点击「去人机验证」打开验证页。', 'err');
      return false;
    }
    if (auto) msg('acc-msg', '请先完成人机验证，验证后会自动继续。', 'ok');
    var timer = setInterval(function () {
      if (!w.closed) return;
      clearInterval(timer);
      setTimeout(function () {
        var fn = state.verifyAfter;
        state.verifyAfter = null;
        paintGate();
        if (fn && tsToken()) fn();
      }, 250);
    }, 400);
    return true;
  }

  function turnstileRequired() {
    var e = new Error('请先完成人机验证');
    e.code = 'turnstile_required';
    return e;
  }

  function bool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
      var s = v.toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled';
    }
    return false;
  }

  function validCode(code) {
    return CODE_RE.test(String(code === null || code === undefined ? '' : code).trim());
  }

  function emailOk(v) {
    var s = String(v === null || v === undefined ? '' : v).trim();
    if (s.length < 3 || s.length > 254) return false;
    if (/[\u0000-\u001f\u007f\s]/.test(s)) return false;
    var at = s.lastIndexOf('@');
    if (at <= 0 || at !== s.indexOf('@')) return false;
    var local = s.slice(0, at);
    var domain = s.slice(at + 1);
    if (local.length > 64) return false;
    if (local.charAt(0) === '.' || local.charAt(local.length - 1) === '.' || local.indexOf('..') !== -1) return false;
    if (/[<>()\[\]\\,;:"]/.test(local)) return false;
    if (domain.charAt(0) === '.' || domain.indexOf('..') !== -1) return false;
    var d = domain;
    if (d.charAt(d.length - 1) === '.') d = d.slice(0, -1);
    if (!d) return false;
    if (!/^[\p{L}\p{N}._-]+$/u.test(d)) return false;
    if (d.charAt(0) === '-' || d.charAt(d.length - 1) === '-') return false;
    return true;
  }

  function userLabel(u) {
    if (!u) return '—';
    return String(u.email || u.login || '—');
  }

  function userKey(u) {
    if (!u) return '';
    return String(u.id || u.email || u.login || '');
  }

  function bindCommand(code) {
    return '/account link ' + String(code === null || code === undefined ? '' : code).trim();
  }

  function viewState(o) {
    o = o || {};
    if (!o.connected) return 'offline';
    return o.user ? 'user' : 'guest';
  }

  function canLink(s) { return s === 'user'; }

  function direction(side) {
    if (side === 'sell') return '卖出';
    if (side === 'buy') return '买入';
    return '—';
  }

  var STATUS = {
    pending: '挂单中', filled: '已成交', partial: '部分成交',
    cancelled: '已取消', canceled: '已取消', rejected: '已拒绝', expired: '已过期'
  };

  function orderStatus(s) {
    var raw = String(s === null || s === undefined ? '' : s).trim();
    var k = raw.toLowerCase();
    return STATUS[k] || raw || '—';
  }

  function mcLabel(mc) {
    if (!mc) return '未绑定';
    var name = String(mc.name || '').trim();
    var uuid = String(mc.uuid || '').trim();
    if (name && uuid) return name + '（' + uuid + '）';
    return name || uuid || '未绑定';
  }

  function parseExpire(v) {
    var t = typeof v === 'number' ? v : Date.parse(String(v || ''));
    if (!isFinite(t)) return Date.now() + LINK_TTL;
    if (t < 1e12) t *= 1000;
    return t;
  }

  function mmss(sec) {
    var s = Math.max(0, Math.round(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function stopTick() {
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.tickTimer = null;
  }

  function stopWatch() {
    if (state.watchTimer) clearInterval(state.watchTimer);
    state.watchTimer = null;
  }

  function stopTimers() { stopTick(); stopWatch(); }

  function tick() {
    if (!state.expireAt) return;
    var left = state.expireAt - Date.now();
    if (left <= 0) {
      text('link-expire', '已过期');
      text('link-status', '绑定码已过期，请重新生成。');
      disabled('link-copy', true);
      state.code = '';
      stopTimers();
      return;
    }
    text('link-expire', '剩余 ' + mmss(left / 1000));
  }

  function startTick() {
    stopTick();
    tick();
    state.tickTimer = setInterval(tick, 1000);
  }

  function startWatch() {
    stopWatch();
    state.watchTimer = setInterval(function () {
      if (!state.user) return;
      MCW.api.get('/api/me').then(function (d) {
        var u = normalizeMe(d);
        if (!u) return;
        state.user = u;
        paintPass();
        if (!u.mc || (!u.mc.uuid && !u.mc.name)) return;
        state.code = '';
        state.expireAt = 0;
        stopTimers();
        toggle('link-box', false);
        toggle('link-cmd-row', false);
        text('link-expire', '');
        text('link-status', '已绑定：' + mcLabel(u.mc));
        text('link-start', '重新生成绑定码');
        text('acc-mc', mcLabel(u.mc));
        paintTfa();
        MCW.toast('Minecraft 已绑定', 'ok');
      }).catch(function () {});
    }, 5000);
  }

  function showLink(d) {
    d = d || {};
    /* 地址改为「获取连接地址」按钮按需拉取，绑定码流程不再自动暴露 */
    state.code = String(d.code || '').trim();
    state.expireAt = parseExpire(d.expireAt);
    toggle('link-box', true);
    toggle('link-cmd-row', true);
    text('link-code', state.code || '------');
    text('link-cmd', bindCommand(state.code));
    var cp = el('link-copy');
    if (cp) {
      cp.setAttribute('data-copy', state.code);
      cp.disabled = !validCode(state.code);
    }
    text('link-status', '进入服务器后输入下面的命令完成绑定。');
    msg('link-msg', '', '');
    startTick();
    startWatch();
  }

  function twoFactorOn(u) {
    if (!u) return false;
    if (u.twoFactor !== undefined) return bool(u.twoFactor);
    if (u.two_factor !== undefined) return bool(u.two_factor);
    if (u.twofa && u.twofa.enabled !== undefined) return bool(u.twofa.enabled);
    return false;
  }

  function normalizeMe(d) {
    var u = d && d.user ? Object.assign({}, d.user) : null;
    if (!u) return null;
    if (d && d.pass && !u.pass) u.pass = d.pass;
    if (d && d.twoFactor !== undefined) u.twoFactor = bool(d.twoFactor);
    else if (u.twoFactor === undefined && u.twofa && u.twofa.enabled !== undefined) u.twoFactor = bool(u.twofa.enabled);
    else if (u.twoFactor === undefined && u.two_factor !== undefined) u.twoFactor = bool(u.two_factor);
    return u;
  }

  function passOf(u) {
    if (!u) return null;
    var p = u.pass;
    if (!p && u.user && u.user.pass) p = u.user.pass;
    if (!p || typeof p !== 'object') return null;
    var id = String(p.passId || p.pass_id || '').trim();
    var name = String(p.playerName || p.player_name || '').trim();
    var exists = p.exists;
    if (exists === undefined || exists === null || exists === '') exists = !!id;
    if (!bool(exists) && !id) return { exists: false, passId: '', playerName: name };
    return { exists: true, passId: id, playerName: name };
  }

  function passLabel(p) {
    if (!p || !p.exists) return '尚未创建';
    return '通行证：' + (p.passId || '—');
  }

  function passPlayerLabel(p) {
    if (!p || !p.exists) return '玩家名：—';
    return '玩家名：' + (p.playerName || '未同步');
  }

  function isTwoFactorRequired(d) {
    return !!(d && (bool(d.twoFactorRequired) || bool(d.two_factor_required) ||
      bool(d.need2fa) || bool(d.requires2fa) || bool(d.challengeRequired)));
  }

  function challengeIdOf(d) {
    if (!d) return '';
    return String(d.challengeId || d.challenge_id || d.challenge || '').trim();
  }

  function recoveryCodesOf(d) {
    var list = d && (d.recoveryCodes || d.recovery_codes || d.codes);
    if (!Array.isArray(list)) return [];
    return list.map(function (c) { return String(c === null || c === undefined ? '' : c).trim(); })
      .filter(function (c) { return !!c; });
  }

  function recoveryLeft(u) {
    var n = u && u.recoveryCodesLeft;
    if (typeof n === 'string' && n.trim() !== '') n = Number(n);
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  function tfaErrorMessage(err) {
    var c = err && err.code;
    var s = err && err.status;
    if (s === 401 || c === 'invalid_code' || c === 'invalid_2fa' || c === 'invalid_credentials') {
      return '验证码或密码不正确';
    }
    if (s === 400 || c === 'bad_request' || c === 'invalid_request') {
      return '验证码格式不正确，请输入 6 位验证码或恢复码';
    }
    if (c === 'turnstile_failed') return '人机验证未通过，请重试';
    if (c === 'turnstile_required') return '请先完成人机验证';
    if (c === 'already_enabled') return '两步验证已开启，请先关闭';
    if (c === 'not_enabled') return '两步验证当前未开启';
    if (s === 429 || c === 'rate_limited') return '尝试太频繁，请稍后再试';
    if (c === 'challenge_missing' || c === 'challenge_expired') return '验证会话已失效，请重新登录';
    if (c === 'NOT_CONNECTED') return '服务端未连接';
    return (err && err.message) || '验证失败，请重试';
  }

  function loginRequest(email, password) {
    var token = tsToken();
    if (!token) return Promise.reject(turnstileRequired());
    var body = { email: email, password: password, turnstileToken: token, remember: !!state.remember };
    return MCW.api.post('/api/auth/login', body).catch(function (err) {
      if (err && err.status === 404) {
        return MCW.api.post('/api/login', body);
      }
      throw err;
    });
  }

  function verifyRequest(challengeId, code) {
    var token = tsToken();
    if (!token) return Promise.reject(turnstileRequired());
    var body = { challengeId: challengeId, code: code, turnstileToken: token, remember: !!state.remember };
    return MCW.api.post('/api/login/2fa', body).catch(function (err) {
      if (err && err.status === 404) {
        return MCW.api.post('/api/auth/2fa/verify', body);
      }
      throw err;
    });
  }

  function resetTfaState(clearMsg) {
    state.tfa.phase = 'idle';
    state.tfa.secret = '';
    state.tfa.otpauthUrl = '';
    state.tfa.codes = [];
    state.tfa.rendered = false;
    var box = el('tfa-code-list');
    if (box) box.innerHTML = '';
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; }
    var sc = el('tfa-copy-secret');
    if (sc) { sc.setAttribute('data-copy', ''); sc.disabled = true; }
    var su = el('tfa-copy-uri');
    if (su) { su.setAttribute('data-copy', ''); su.disabled = true; }
    text('tfa-secret', '—');
    text('tfa-otpauth', '—');
    var ec = el('tfa-enable-code');
    if (ec) ec.value = '';
    var di = el('tfa-disable-input');
    if (di) di.value = '';
    var chk = el('tfa-codes-saved-check');
    if (chk) { chk.checked = false; chk.disabled = false; }
    disabled('tfa-download-codes', true);
    if (clearMsg !== false) msg('tfa-msg', '', '');
    paintTfa();
  }

  function paintLoginMode() {
    var challenge = state.tfa.phase === 'login';
    toggle('auth-tabs', !challenge);
    toggle('login-2fa-form', challenge);
    if (challenge) {
      toggle('login-form', false);
      toggle('register-form', false);
    }
    disabled('login-2fa-code', !state.connected);
    disabled('login-2fa-btn', !state.connected || !tsToken());
  }

  function paintGate() {
    var has = !!tsToken();
    disabled('login-btn', !state.connected || !has);
    disabled('register-btn', !state.connected || !has);
    disabled('login-2fa-btn', !state.connected || !has);
    var note = el('ts-note');
    if (note) note.textContent = has ? '人机验证已通过（5 分钟内有效）' : '需要验证时打开独立验证页，结果在本机保留 5 分钟。';
  }

  function onTurnstile(t) {
    paintGate();
    if (t && state.tfa.phase === 'login') {
      msg('acc-msg', '人机验证已通过，请输入 6 位验证码或恢复码。', 'ok');
    }
  }

  function showLoginChallenge(d) {
    state.tfa.phase = 'login';
    state.tfa.challengeId = challengeIdOf(d);
    var c = el('login-2fa-code');
    if (c) c.value = '';
    paintLoginMode();
    msg('acc-msg', state.tfa.challengeId
      ? '该账号已开启两步验证，请先完成人机验证，再输入 6 位验证码或恢复码。'
      : '服务端未返回验证会话，请重新登录。', state.tfa.challengeId ? 'ok' : 'err');
    if (c && c.focus && state.tfa.challengeId) {
      try { c.focus(); } catch (e) {}
    }
  }

  function resetLoginChallenge(clearMsg) {
    state.tfa.phase = 'idle';
    state.tfa.challengeId = '';
    toggle('login-2fa-form', false);
    toggle('auth-tabs', true);
    toggle('login-form', true);
    toggle('register-form', false);
    var c = el('login-2fa-code');
    if (c) c.value = '';
    if (clearMsg !== false) msg('acc-msg', '', '');
  }

  function paintTfa() {
    if (!el('tfa-box')) return;
    var st = viewState(state);
    var on = twoFactorOn(state.user);
    toggle('tfa-box', st === 'user');
    if (st !== 'user') {
      toggle('tfa-enable-row', false);
      toggle('tfa-disable-row', false);
      toggle('tfa-setup', false);
      toggle('tfa-codes', false);
      toggle('tfa-disable-form', false);
      return;
    }
    var left = recoveryLeft(state.user);
    text('tfa-status', on ? ('已开启' + (left === null ? '' : '（剩余恢复码 ' + left + ' 枚）')) : '未开启');
    var phase = state.tfa.phase;
    var busy = phase === 'setup' || phase === 'codes' || phase === 'disable';
    toggle('tfa-enable-row', !on && !busy);
    toggle('tfa-disable-row', on && !busy);
    toggle('tfa-setup', phase === 'setup');
    toggle('tfa-codes', phase === 'codes');
    toggle('tfa-disable-form', phase === 'disable');
    disabled('tfa-enable', !state.connected);
    disabled('tfa-disable-open', !state.connected);
    disabled('tfa-enable-btn', !state.connected);
    disabled('tfa-disable-btn', !state.connected);
    disabled('tfa-disable-input', !state.connected);
    syncRecoveryDownload();
  }

  function paintPass() {
    if (!el('pass-box')) return;
    var st = viewState(state);
    var p = passOf(state.user);
    var has = !!(p && p.exists);
    toggle('pass-box', st === 'user');
    toggle('pass-empty', st === 'user' && !has);
    toggle('pass-exists', st === 'user' && has);
    toggle('link-pass-note', st === 'user' && !has);
    text('pass-id', passLabel(p));
    text('pass-player', passPlayerLabel(p));
    var cp = el('pass-copy');
    if (cp) {
      cp.setAttribute('data-copy', has ? p.passId : '');
      cp.disabled = !has || !p.passId;
    }
  }

  function paint() {
    if (!el('account-panel')) return;
    var st = viewState(state);
    toggle('acc-offline', st === 'offline');
    toggle('acc-guest', st === 'guest');
    toggle('acc-user', st === 'user');
    text('acc-state', st === 'user' ? '已登录' : (st === 'offline' ? '未连接' : '未登录'));
    ['login-email', 'login-password', 'register-email', 'register-password',
      'register-password2', 'login-btn', 'register-btn', 'login-2fa-code',
      'login-2fa-btn'].forEach(function (id) {
      disabled(id, st === 'offline');
    });
    if (state.user) {
      text('acc-name', userLabel(state.user));
      text('acc-mc', mcLabel(state.user.mc));
    }
    paintLoginMode();
    paintTfa();
    paintPass();
    paintGate();
    paintRemember();
    var linkable = canLink(st);
    disabled('link-start', !linkable);
    if (!linkable) {
      toggle('link-box', false);
      toggle('link-cmd-row', false);
      text('link-expire', '');
      text('link-status', st === 'offline' ? '服务端未连接，绑定功能暂不可用。' : '登录后可生成绑定码。');
      stopTimers();
    }
    disabled('link-copy', !state.code || Date.now() >= state.expireAt);
    disabled('orders-refresh', st === 'offline');
    if (!state.user) {
      var b = el('orders-body');
      if (b) b.innerHTML = '<tr><td colspan="4" class="muted">' +
        (st === 'offline' ? '服务端未连接' : '登录后查看') + '</td></tr>';
    }
  }

  function reopenOnTurnstile(err, retry) {
    if (!err || err.code !== 'turnstile_failed') return false;
    tsReset();
    openVerify(retry, true);
    return true;
  }

  function authError(err) {
    var c = err && err.code;
    var s = err && err.status;
    if (s === 401 || c === 'unauthorized' || c === 'invalid_credentials') return '邮箱或密码不正确';
    if (s === 409 || c === 'user_exists') return '该邮箱已注册';
    if (s === 400 || c === 'bad_request') return '邮箱格式不对或密码少于 8 位';
    if (s === 429 || c === 'rate_limited') return '操作太频繁，请稍后再试';
    if (c === 'turnstile_failed') return '人机验证未通过，请重试';
    if (c === 'turnstile_required') return '请先完成人机验证';
    if (c === 'NOT_CONNECTED') return '服务端未连接';
    return (err && err.message) || '请求失败';
  }

  function setBusy(on, id, label) {
    var b = el(id);
    if (!b) return;
    if (on) {
      b.setAttribute('data-label', b.textContent);
      b.textContent = label;
      b.disabled = true;
    } else {
      b.textContent = b.getAttribute('data-label') || b.textContent;
      b.disabled = false;
    }
  }

  function clearPasswords() {
    ['login-password', 'register-password', 'register-password2', 'login-2fa-code',
      'tfa-enable-code', 'tfa-disable-input'].forEach(function (id) {
      var n = el(id);
      if (n) n.value = '';
    });
  }

  function switchTab(name) {
    if (state.tfa.phase === 'login') resetLoginChallenge(false);
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-auth-tab') === name ? 'true' : 'false');
    });
    toggle('auth-tabs', true);
    toggle('login-form', name === 'login');
    toggle('register-form', name === 'register');
    toggle('login-2fa-form', false);
    msg('acc-msg', '', '');
  }

  function renderOrders(items) {
    var b = el('orders-body');
    if (!b) return;
    if (!items || !items.length) {
      b.innerHTML = '<tr><td colspan="4" class="muted">暂无订单</td></tr>';
      return;
    }
    b.innerHTML = items.map(function (it) {
      var qty = it && it.qty !== null && it.qty !== undefined ? it.qty : '—';
      return '<tr><td class="sym">' + MCW.esc(it && it.symbol || '—') + '</td>' +
        '<td>' + MCW.esc(direction(it && it.side)) + '</td>' +
        '<td class="num">' + MCW.esc(String(qty)) + '</td>' +
        '<td>' + MCW.esc(orderStatus(it && it.status)) + '</td></tr>';
    }).join('');
  }

  function loadOrders() {
    if (!el('orders-body')) return;
    if (!state.connected) { renderOrders([]); var b0 = el('orders-body'); if (b0) b0.innerHTML = '<tr><td colspan="4" class="muted">服务端未连接</td></tr>'; return; }
    if (!state.user) { renderOrders([]); return; }
    MCW.api.get('/api/orders/mine').then(function (d) {
      renderOrders((d && d.items) || []);
    }, function (err) {
      if (err && (err.status === 401 || err.status === 404)) renderOrders([]);
      else {
        var b = el('orders-body');
        if (b) b.innerHTML = '<tr><td colspan="4" class="muted">' + MCW.esc((err && err.message) || '加载失败') + '</td></tr>';
      }
    });
  }

  function applyMe(d) {
    state.connected = true;
    var prev = userKey(state.user);
    var u = normalizeMe(d);
    state.user = u;
    if (userKey(u) !== prev) resetTfaState(false);
    paint();
    loadOrders();
    return u;
  }

  function refreshMe() {
    return MCW.api.get('/api/me').then(function (d) {
      return applyMe(d);
    }, function (err) {
      if (err && (err.status === 401 || err.code === 'unauthorized')) {
        state.connected = true;
        state.user = null;
      } else {
        state.connected = false;
        state.user = null;
      }
      resetTfaState(false);
      resetLoginChallenge(false);
      paint();
      loadOrders();
      return null;
    });
  }

  function logout() {
    MCW.api.post('/api/logout', {}).then(function () {
      state.user = null;
      state.code = '';
      state.expireAt = 0;
      stopTimers();
      resetTfaState(false);
      resetLoginChallenge(false);
      setRemembered(false);
      paint();
      loadOrders();
      msg('acc-msg', '已退出登录', 'ok');
    }, function (err) {
      msg('acc-msg', (err && err.message) || '退出失败', 'err');
    });
  }

  function login(email, password) {
    state.remember = rememberChecked();
    return loginRequest(email, password).then(function (d) {
      tsReset();
      if (isTwoFactorRequired(d)) {
        showLoginChallenge(d);
        return { challenge: true, challengeId: state.tfa.challengeId };
      }
      return MCW.api.get('/api/me').then(function (me) {
        var u = applyMe(me);
        setRemembered(state.remember);
        return { user: u };
      }, function (err) {
        if (err && err.status === 401) return { user: null };
        throw err;
      });
    }, function (err) {
      tsReset();
      throw err;
    });
  }

  function verifyChallenge(code) {
    if (!state.tfa.challengeId) {
      var e = new Error('验证会话已失效，请重新登录');
      e.code = 'challenge_missing';
      return Promise.reject(e);
    }
    return verifyRequest(state.tfa.challengeId, code).then(function (d) {
      tsReset();
      if (isTwoFactorRequired(d)) {
        showLoginChallenge(d);
        return { challenge: true };
      }
      resetLoginChallenge(false);
      return MCW.api.get('/api/me').then(function (me) {
        var u = applyMe(me);
        setRemembered(state.remember);
        return { user: u };
      }, function (err) {
        if (err && err.status === 401) {
          var e2 = new Error('登录状态异常，请重试');
          e2.code = 'session_missing';
          throw e2;
        }
        throw err;
      });
    }, function (err) {
      tsReset();
      throw err;
    });
  }

  function submitChallenge() {
    var c = el('login-2fa-code');
    var code = c ? c.value.trim() : '';
    if (!code) { msg('acc-msg', '请输入 6 位验证码或恢复码', 'err'); return; }
    if (!state.connected) { msg('acc-msg', '服务端未连接', 'err'); return; }
    if (!tsToken()) {
      paintGate();
      openVerify(function () { submitChallenge(); }, true);
      return;
    }
    setBusy(true, 'login-2fa-btn', '验证中…');
    verifyChallenge(code).then(function (res) {
      if (res && res.challenge) { msg('acc-msg', '请继续输入验证码', 'ok'); return; }
      if (!res || !res.user) { msg('acc-msg', '登录状态异常，请重试', 'err'); return; }
      msg('acc-msg', '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      reopenOnTurnstile(err, function () { submitChallenge(); });
      msg('acc-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'login-2fa-btn');
      paintGate();
    });
  }

  function postAuth(kind) {
    var isReg = kind === 'register';
    var uEl = el(isReg ? 'register-email' : 'login-email');
    var pEl = el(isReg ? 'register-password' : 'login-password');
    var u = uEl ? uEl.value.trim() : '';
    var p = pEl ? pEl.value : '';
    if (!state.connected) { msg('acc-msg', '服务端未连接', 'err'); return; }
    if (!u) { msg('acc-msg', '请输入邮箱', 'err'); return; }
    if (!emailOk(u)) { msg('acc-msg', '邮箱格式不正确', 'err'); return; }
    if (!p) { msg('acc-msg', '请输入密码', 'err'); return; }
    if (isReg) {
      if (p.length < 8) { msg('acc-msg', '密码至少 8 位', 'err'); return; }
      var p2El = el('register-password2');
      if ((p2El ? p2El.value : '') !== p) { msg('acc-msg', '两次输入的密码不一致', 'err'); return; }
    }
    state.remember = isReg ? false : rememberChecked();
    if (!tsToken()) {
      paintGate();
      openVerify(function () { postAuth(kind); }, true);
      return;
    }
    var btnId = isReg ? 'register-btn' : 'login-btn';
    setBusy(true, btnId, isReg ? '注册中…' : '登录中…');
    if (isReg) {
      var regToken = tsToken();
      MCW.api.post('/api/auth/register', {
        email: u, password: p, turnstileToken: regToken
      }).then(function () {
        tsReset();
        switchTab('login');
        clearPasswords();
        msg('acc-msg', '注册成功，请完成人机验证后登录', 'ok');
      }).catch(function (err) {
        tsReset();
        msg('acc-msg', authError(err), 'err');
      }).then(function () {
        setBusy(false, btnId);
        paintGate();
      });
      return;
    }
    login(u, p).then(function (res) {
      if (res && res.challenge) {
        clearPasswords();
        msg('acc-msg', '该账号已开启两步验证，请先完成人机验证，再输入 6 位验证码或恢复码。', 'ok');
        return;
      }
      if (!res || !res.user) {
        msg('acc-msg', '登录状态异常，请重试', 'err');
        return;
      }
      msg('acc-msg', state.remember ? '登录成功，已开启 30 天自动登录' : '登录成功', 'ok');
      clearPasswords();
    }).catch(function (err) {
      reopenOnTurnstile(err, function () { postAuth(kind); });
      msg('acc-msg', authError(err), 'err');
    }).then(function () {
      setBusy(false, btnId);
      paintGate();
    });
  }

  function startTfaSetup() {
    if (!state.user) { msg('tfa-msg', '请先登录', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-enable', '生成中…');
    MCW.api.post('/api/2fa/setup', {}).then(function (d) {
      d = d || {};
      state.tfa.phase = 'setup';
      state.tfa.secret = String(d.secret || '').trim();
      state.tfa.otpauthUrl = String(d.otpauthUrl || d.otpauth_url || d.uri || '').trim();
      state.tfa.rendered = false;
      text('tfa-secret', state.tfa.secret || '—');
      text('tfa-otpauth', state.tfa.otpauthUrl || '—');
      var sc = el('tfa-copy-secret');
      if (sc) { sc.setAttribute('data-copy', state.tfa.secret); sc.disabled = !state.tfa.secret; }
      var su = el('tfa-copy-uri');
      if (su) { su.setAttribute('data-copy', state.tfa.otpauthUrl); su.disabled = !state.tfa.otpauthUrl; }
      var code = el('tfa-enable-code');
      if (code) code.value = '';
      paintTfa();
      msg('tfa-msg', '密钥已生成，请用验证器 App 添加后输入 6 位验证码。', 'ok');
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-enable');
    });
  }

  function recoveryFileText(email, codes, iso) {
    var list = (codes || []).map(function (c) {
      return String(c === null || c === undefined ? '' : c).trim();
    }).filter(function (c) { return !!c; });
    var lines = [
      'AMC 两步验证恢复码',
      '账号: ' + String(email || '—'),
      '生成时间: ' + String(iso || new Date().toISOString()),
      '说明: 每码仅可使用一次，请离线保存。',
      ''
    ];
    return lines.concat(list).join('\n') + '\n';
  }

  function syncRecoveryDownload() {
    var chk = el('tfa-codes-saved-check');
    var ready = !!(chk && chk.checked) && state.tfa.codes.length > 0;
    disabled('tfa-download-codes', !ready);
  }

  function downloadRecoveryCodes() {
    var codes = state.tfa.codes.slice();
    if (!codes.length) { msg('tfa-msg', '没有可下载的恢复码', 'err'); return false; }
    var email = state.user ? String(state.user.email || state.user.login || '') : '';
    var txt = recoveryFileText(email, codes, new Date().toISOString());
    try {
      var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'omc-recovery-codes.txt';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
      msg('tfa-msg', '恢复码已下载，请离线保存。', 'ok');
      return true;
    } catch (e) {
      msg('tfa-msg', '下载失败，请复制恢复码手动保存', 'err');
      return false;
    }
  }

  function renderRecoveryCodes(codes) {
    if (state.tfa.rendered) return false;
    var list = (codes || []).map(function (c) {
      return String(c === null || c === undefined ? '' : c).trim();
    }).filter(function (c) { return !!c; });
    if (!list.length) return false;
    var box = el('tfa-code-list');
    if (!box) return false;
    box.innerHTML = list.map(function (c) {
      return '<span class="mono">' + MCW.esc(c) + '</span>';
    }).join('');
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', list.join('\n')); cp.disabled = false; }
    var chk = el('tfa-codes-saved-check');
    if (chk) { chk.checked = false; chk.disabled = false; }
    disabled('tfa-download-codes', true);
    state.tfa.codes = list;
    state.tfa.rendered = true;
    return true;
  }

  function submitTfaEnable() {
    var c = el('tfa-enable-code');
    var code = c ? c.value.trim() : '';
    if (!/^\d{6}$/.test(code)) { msg('tfa-msg', '请输入 6 位数字验证码', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-enable-btn', '验证中…');
    MCW.api.post('/api/2fa/enable', { code: code }).then(function (d) {
      var codes = recoveryCodesOf(d);
      if (state.user) {
        state.user.twoFactor = true;
        state.user.recoveryCodesLeft = codes.length;
      }
      state.tfa.rendered = false;
      if (codes.length) {
        state.tfa.phase = 'codes';
        renderRecoveryCodes(codes);
        paintTfa();
        msg('tfa-msg', '两步验证已开启，请保存恢复码。', 'ok');
      } else {
        state.tfa.phase = 'idle';
        paintTfa();
        msg('tfa-msg', '两步验证已开启，但服务端未返回恢复码，请联系管理员。', 'err');
      }
      var ec = el('tfa-enable-code');
      if (ec) ec.value = '';
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-enable-btn');
    });
  }

  function closeRecoveryCodes() {
    state.tfa.phase = 'idle';
    state.tfa.codes = [];
    state.tfa.rendered = false;
    var box = el('tfa-code-list');
    if (box) box.innerHTML = '';
    var cp = el('tfa-copy-codes');
    if (cp) { cp.setAttribute('data-copy', ''); cp.disabled = true; }
    var chk = el('tfa-codes-saved-check');
    if (chk) { chk.checked = false; chk.disabled = false; }
    disabled('tfa-download-codes', true);
    paintTfa();
    msg('tfa-msg', '恢复码已关闭。', 'ok');
  }

  function syncDisableInput() {
    var sel = el('tfa-disable-method');
    var input = el('tfa-disable-input');
    if (!input) return;
    var isCode = !sel || sel.value !== 'password';
    input.setAttribute('type', isCode ? 'text' : 'password');
    input.setAttribute('inputmode', isCode ? 'numeric' : 'text');
    input.setAttribute('placeholder', isCode ? '123456 或恢复码' : '当前账号密码');
    input.setAttribute('autocomplete', isCode ? 'one-time-code' : 'current-password');
  }

  function openTfaDisable() {
    if (!state.user) { msg('tfa-msg', '请先登录', 'err'); return; }
    state.tfa.phase = 'disable';
    var sel = el('tfa-disable-method');
    if (sel) sel.value = 'code';
    var input = el('tfa-disable-input');
    if (input) input.value = '';
    syncDisableInput();
    paintTfa();
    msg('tfa-msg', '', '');
  }

  function submitTfaDisable() {
    var sel = el('tfa-disable-method');
    var input = el('tfa-disable-input');
    var method = sel && sel.value === 'password' ? 'password' : 'code';
    var val = input ? input.value : '';
    if (!val) { msg('tfa-msg', method === 'password' ? '请输入账号密码' : '请输入验证码或恢复码', 'err'); return; }
    if (method === 'code' && val.length < 6) { msg('tfa-msg', '请输入 6 位验证码或恢复码', 'err'); return; }
    if (!state.connected) { msg('tfa-msg', '服务端未连接', 'err'); return; }
    setBusy(true, 'tfa-disable-btn', '关闭中…');
    var body = method === 'password' ? { password: val } : { code: val };
    MCW.api.post('/api/2fa/disable', body).then(function () {
      if (state.user) {
        state.user.twoFactor = false;
        state.user.recoveryCodesLeft = 0;
      }
      state.tfa.phase = 'idle';
      state.tfa.secret = '';
      state.tfa.otpauthUrl = '';
      state.tfa.codes = [];
      state.tfa.rendered = false;
      var di = el('tfa-disable-input');
      if (di) di.value = '';
      paintTfa();
      msg('tfa-msg', '两步验证已关闭。', 'ok');
    }).catch(function (err) {
      msg('tfa-msg', tfaErrorMessage(err), 'err');
    }).then(function () {
      setBusy(false, 'tfa-disable-btn');
    });
  }

  function startLink() {
    if (!state.user) { msg('link-msg', '请先登录', 'err'); return; }
    var btn = el('link-start');
    if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
    MCW.api.post('/api/link/start', {}).then(function (d) {
      showLink(d || {});
      if (btn) btn.textContent = '重新生成';
    }).catch(function (err) {
      if (err && err.status === 401) { state.user = null; paint(); }
      msg('link-msg', authError(err), 'err');
    }).then(function () {
      if (btn) btn.disabled = !state.user;
    });
  }

  function tfaSnapshot() {
    return {
      phase: state.tfa.phase,
      challengeId: state.tfa.challengeId,
      secret: state.tfa.secret,
      otpauthUrl: state.tfa.otpauthUrl,
      codes: state.tfa.codes.slice(),
      rendered: state.tfa.rendered
    };
  }

  function mount() {
    if (!el('account-panel')) return;
    MCW.qsa('[data-auth-tab]').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-auth-tab')); });
    });
    var to = el('ts-open');
    if (to) to.addEventListener('click', function () { openVerify(null, false); });
    var chk = el('tfa-codes-saved-check');
    if (chk) chk.addEventListener('change', syncRecoveryDownload);
    var dl = el('tfa-download-codes');
    if (dl) dl.addEventListener('click', downloadRecoveryCodes);
    if (window.addEventListener) {
      window.addEventListener('message', function (e) {
        if (e.origin !== location.origin) return;
        var d = e.data;
        if (!d || d.type !== 'omc-turnstile' || !d.token) return;
        paintGate();
        var fn = state.verifyAfter;
        state.verifyAfter = null;
        if (fn) fn();
      });
      window.addEventListener('focus', function () { paintGate(); paintRemember(); });
      window.addEventListener('storage', function (e) {
        if (e.key === 'omc_ts_token') paintGate();
        if (e.key === REMEMBER_KEY) paintRemember();
      });
    }
    var lf = el('login-form');
    if (lf) lf.addEventListener('submit', function (e) { e.preventDefault(); postAuth('login'); });
    var rf = el('register-form');
    if (rf) rf.addEventListener('submit', function (e) { e.preventDefault(); postAuth('register'); });
    var l2f = el('login-2fa-form');
    if (l2f) l2f.addEventListener('submit', function (e) { e.preventDefault(); submitChallenge(); });
    var l2b = el('login-2fa-back');
    if (l2b) l2b.addEventListener('click', function () { resetLoginChallenge(true); });
    var te = el('tfa-enable');
    if (te) te.addEventListener('click', startTfaSetup);
    var tsc = el('tfa-setup-cancel');
    if (tsc) tsc.addEventListener('click', function () { resetTfaState(true); });
    var tef = el('tfa-enable-form');
    if (tef) tef.addEventListener('submit', function (e) { e.preventDefault(); submitTfaEnable(); });
    var tcs = el('tfa-codes-saved');
    if (tcs) tcs.addEventListener('click', closeRecoveryCodes);
    var tdo = el('tfa-disable-open');
    if (tdo) tdo.addEventListener('click', openTfaDisable);
    var tdm = el('tfa-disable-method');
    if (tdm) tdm.addEventListener('change', syncDisableInput);
    var tdb = el('tfa-disable-btn');
    if (tdb) tdb.addEventListener('click', submitTfaDisable);
    var tdc = el('tfa-disable-cancel');
    if (tdc) tdc.addEventListener('click', function () { resetTfaState(true); });
    var tdi = el('tfa-disable-input');
    if (tdi) tdi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitTfaDisable(); }
    });
    var lo = el('acc-logout');
    if (lo) lo.addEventListener('click', logout);
    var ls = el('link-start');
    if (ls) ls.addEventListener('click', startLink);
    var or = el('orders-refresh');
    if (or) or.addEventListener('click', function () { loadOrders(); });
    var retry = el('acc-retry');
    if (retry) retry.addEventListener('click', function () {
      state.connected = MCW.api.connected();
      paint();
      if (state.connected) refreshMe();
    });
    state.connected = MCW.api.connected();
    paint();
    loadOrders();
    if (state.connected) refreshMe();
  }

  MCW.account = {
    validCode: validCode,
    emailOk: emailOk,
    userLabel: userLabel,
    bindCommand: bindCommand,
    viewState: viewState,
    canLink: canLink,
    direction: direction,
    orderStatus: orderStatus,
    mcLabel: mcLabel,
    twoFactorOn: twoFactorOn,
    normalizeMe: normalizeMe,
    passOf: passOf,
    passLabel: passLabel,
    passPlayerLabel: passPlayerLabel,
    paintPass: paintPass,
    isTwoFactorRequired: isTwoFactorRequired,
    challengeIdOf: challengeIdOf,
    recoveryCodesOf: recoveryCodesOf,
    turnstileToken: tsToken,
    onTurnstile: onTurnstile,
    openVerify: openVerify,
    remembered: remembered,
    setRemembered: setRemembered,
    recoveryFileText: recoveryFileText,
    downloadRecoveryCodes: downloadRecoveryCodes,
    syncRecoveryDownload: syncRecoveryDownload,
    paintGate: paintGate,
    authError: authError,
    tfaErrorMessage: tfaErrorMessage,
    showLoginChallenge: showLoginChallenge,
    resetLoginChallenge: resetLoginChallenge,
    login: login,
    verifyChallenge: verifyChallenge,
    renderRecoveryCodes: renderRecoveryCodes,
    tfaSnapshot: tfaSnapshot,
    mount: mount,
    refresh: refreshMe
  };

  MCW.ready(mount);
})();
