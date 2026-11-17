/* =========================================================
   SUL STUDIO — admin panel
   Edits content/site.json with a live preview, keeps a draft
   in this browser, and publishes to GitHub in one commit.
   ========================================================= */
(function () {
  'use strict';

  var ROOT = '../';
  var LS = { draft: 'sul.draft', gh: 'sul.gh', tab: 'sul.tab', lastPub: 'sul.lastPublish', page: 'sul.pageSel' };
  var FONTS = ['Fraunces', 'Space Grotesk', 'Poppins', 'Inter', 'Playfair Display', 'DM Serif Display', 'Abril Fatface', 'Alfa Slab One', 'Unbounded', 'Syne', 'Rubik Mono One', 'Bagel Fat One', 'Righteous', 'Chewy', 'Gloock', 'Monoton', 'Press Start 2P', 'Silkscreen', 'Pixelify Sans', 'VT323', 'System', 'Georgia', 'Courier'];
  var SOCIALS = ['instagram', 'youtube', 'tiktok', 'soundcloud', 'spotify', 'x', 'discord', 'twitch', 'beatstars', 'email', 'link'];

  var S = {
    cfg: null, published: '', assets: {}, open: {}, tab: 'start', pageSel: '',
    history: [], future: [], snap: '', ready: false, pvReady: false, pvPage: ''
  };

  /* ================= helpers ================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(p, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(p, x); });
    else p.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || 'id') + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
  function slug(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var toastT;
  function toast(msg, kind, ms) {
    var t = $('#toast'); t.textContent = msg; t.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = ''; }, ms || 2600);
  }
  function modal(build) {
    var m = $('#modal'); m.innerHTML = ''; var box = el('div', { class: 'modal-box' });
    var close = function () { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    build(box, close); m.appendChild(box); m.hidden = false;
    m.onclick = function (e) { if (e.target === m) close(); };
    document.addEventListener('keydown', onKey);
    var f = box.querySelector('input, button.primary, button'); if (f) setTimeout(function () { f.focus(); }, 30);
    return close;
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (res) {
      modal(function (b, close) {
        add(b, [el('h2', { text: title }), el('p', { text: text }),
          el('div', { class: 'acts' },
            el('button', { class: 'ab', text: 'Cancel', onclick: function () { close(); res(false); } }),
            el('button', { class: 'ab ' + (danger ? 'danger' : 'primary'), text: okLabel || 'OK', onclick: function () { close(); res(true); } }))]);
      });
    });
  }

  /* ---- base64 / files ---- */
  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str), bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(b64.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function dataUrlB64(d) { return String(d).split(',')[1] || ''; }
  function dataUrlBytes(d) {
    var bin = atob(dataUrlB64(d)), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function readDataUrl(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  function download(name, blob) {
    var a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---- IndexedDB for uploaded files waiting to be published ---- */
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res) {
      try {
        var r = indexedDB.open('sul-studio', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('files'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbP;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        var tx = d.transaction('files', mode), st = tx.objectStore('files'), out = fn(st);
        tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : null); };
        tx.onerror = function () { res(null); };
      });
    });
  }
  function idbPut(path, rec) { return idb('readwrite', function (s) { s.put(rec, path); }); }
  function idbDel(path) { return idb('readwrite', function (s) { s.delete(path); }); }
  function idbAll() {
    return db().then(function (d) {
      if (!d) return {};
      return new Promise(function (res) {
        var out = {}, tx = d.transaction('files', 'readonly'), req = tx.objectStore('files').openCursor();
        req.onsuccess = function () { var c = req.result; if (c) { out[c.key] = c.value; c.continue(); } };
        tx.oncomplete = function () { res(out); }; tx.onerror = function () { res(out); };
      });
    });
  }
  var pendingMeta = {}; // path -> {committed, t}

  /* ---- asset urls for thumbnails ---- */
  function assetUrl(p) {
    p = String(p || '').trim(); if (!p) return '';
    if (S.assets[p]) return S.assets[p];
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    if (/^(www\.)?[a-z0-9\-]+(\.[a-z0-9\-]+)+\//i.test(p) && !/^(uploads|assets|content)\//i.test(p)) return 'https://' + p;
    return ROOT + p.replace(/^\.?\//, '');
  }
  function ytId(u) { var m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : ''; }
  function isVid(u) { return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(u || '')) || /^data:video\//i.test(String(S.assets[u] || u || '')); }
  function thumbFor(src, thumb) {
    if (thumb) return { kind: 'img', url: assetUrl(thumb) };
    var y = ytId(src); if (y) return { kind: 'img', url: 'https://img.youtube.com/vi/' + y + '/hqdefault.jpg' };
    if (/vimeo\.com/i.test(src || '')) return { kind: 'none', url: '' };
    if (isVid(src)) return { kind: 'video', url: assetUrl(src) };
    return { kind: src ? 'img' : 'none', url: assetUrl(src) };
  }

  /* ================= upload processing ================= */
  var MAX_IMG = 2400;
  function processImage(file) {
    return new Promise(function (res) {
      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return res(file); // gif/svg/etc untouched
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w <= MAX_IMG && h <= MAX_IMG && file.size <= 1.5 * 1024 * 1024) return res(file);
        var k = Math.min(1, MAX_IMG / Math.max(w, h)), c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (b && b.type === 'image/webp' && b.size < file.size) return res(b);
          if (/jpe?g/i.test(file.type)) c.toBlob(function (j) { res(j && j.size < file.size ? j : file); }, 'image/jpeg', 0.9);
          else res(file);
        }, 'image/webp', 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }
  var EXT = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
  function uploadFile(file, allowVideo) {
    var isImage = /^image\//.test(file.type), isVideo = /^video\//.test(file.type);
    if (!isImage && !(allowVideo && isVideo)) { toast(allowVideo ? 'Pick an image or a video file' : 'Pick an image file (png, jpg, webp, gif)', 'bad'); return Promise.resolve(null); }
    if (isVideo && file.size > 45 * 1024 * 1024) { toast('That video is over 45 MB — upload it to YouTube and paste the link instead', 'bad', 5000); return Promise.resolve(null); }
    if (isImage && file.size > 25 * 1024 * 1024) { toast('That image is over 25 MB — please export a smaller one', 'bad', 4000); return Promise.resolve(null); }
    var name = slug(String(file.name || 'file').replace(/\.[^.]+$/, '')) || 'file';
    return (isImage ? processImage(file) : Promise.resolve(file)).then(function (blob) {
      var ext = EXT[blob.type] || (String(file.name).match(/\.[a-z0-9]+$/i) || ['.bin'])[0].toLowerCase();
      var path = 'uploads/' + name + '-' + Date.now().toString(36) + ext;
      return readDataUrl(blob).then(function (data) {
        S.assets[path] = data;
        pendingMeta[path] = { committed: false, t: Date.now() };
        return idbPut(path, { data: data, committed: false, t: Date.now() }).then(function () { return path; });
      });
    });
  }
  function pickFiles(accept, multiple) {
    return new Promise(function (res) {
      var i = el('input', { type: 'file', accept: accept }); if (multiple) i.multiple = true;
      i.style.display = 'none'; document.body.appendChild(i);
      i.onchange = function () { res(Array.prototype.slice.call(i.files || [])); i.remove(); };
      i.click();
    });
  }

  /* ================= state / history / sync ================= */
  function normalize(c) {
    c = c && typeof c === 'object' ? c : {};
    ['meta', 'brand', 'intro', 'theme', 'background', 'animations', 'header', 'footer'].forEach(function (k) { if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {}; });
    ['socials', 'pages', 'kits', 'galleryCategories', 'gallery'].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = []; });
    if (!c.pages.length) c.pages.push({ id: 'home', title: 'HOME', inNav: true, sections: [] });
    c.pages.forEach(function (p, i) { if (!p.id) p.id = 'page-' + (i + 1); if (!Array.isArray(p.sections)) p.sections = []; p.sections.forEach(function (s) { if (!s.id) s.id = uid('s'); }); });
    c.kits.forEach(function (k) { if (!k.id) k.id = uid('k'); });
    c.gallery.forEach(function (g) { if (!g.id) g.id = uid('g'); });
    c.galleryCategories.forEach(function (g) { if (!g.id) g.id = slug(g.label) || uid('c'); });
    return c;
  }
  var json = function (c) { return JSON.stringify(c); };
  var pushHistory = debounce(function () {
    var now = json(S.cfg);
    if (now !== S.snap) { S.history.push(S.snap); if (S.history.length > 80) S.history.shift(); S.snap = now; S.future = []; updateUndo(); }
  }, 450);
  var saveDraft = debounce(function () {
    var ok = lsSet(LS.draft, json(S.cfg));
    if (!ok && !saveDraft.warned) { saveDraft.warned = true; toast('Browser storage is full — publish soon so you don’t lose edits', 'bad', 5000); }
  }, 300);
  var syncPreview = debounce(function () { sendPreview(false); }, 110);
  function changed() {
    if (!S.ready) return;
    pushHistory(); saveDraft(); syncPreview(); updateStatus();
  }
  function flushHistory() { var now = json(S.cfg); if (now !== S.snap) { S.history.push(S.snap); S.snap = now; S.future = []; } }
  function undo() {
    flushHistory(); if (!S.history.length) return;
    S.future.push(json(S.cfg)); S.cfg = JSON.parse(S.history.pop()); S.snap = json(S.cfg);
    afterJump(); toast('Undone');
  }
  function redo() {
    if (!S.future.length) return;
    S.history.push(json(S.cfg)); S.cfg = JSON.parse(S.future.pop()); S.snap = json(S.cfg);
    afterJump(); toast('Redone');
  }
  function afterJump() { snapshotPageIds(); saveDraft(); sendPreview(false); renderTab(); updateStatus(); updateUndo(); }
  function updateUndo() { $('#btn-undo').disabled = !S.history.length && json(S.cfg) === S.snap; $('#btn-redo').disabled = !S.future.length; }
  function pendingPaths() {
    var txt = json(S.cfg);
    return Object.keys(pendingMeta).filter(function (p) { return !pendingMeta[p].committed && txt.indexOf(JSON.stringify(p).slice(1, -1)) >= 0; });
  }
  function dirty() { return json(S.cfg) !== S.published || pendingPaths().length > 0; }
  function updateStatus() {
    var st = $('#status'), gh = ghCfg();
    var d = dirty();
    st.innerHTML = '<span class="dot' + (d ? ' warn' : '') + '"></span>' + (d ? 'Unpublished changes (saved as draft)' : 'Everything is published') + (gh.ok ? '' : ' · GitHub not connected');
    updateUndo();
  }

  /* ---- preview ---- */
  var pv = null;
  function sendPreview(replay) {
    if (!pv || !S.pvReady || !pv.contentWindow) return;
    pv.contentWindow.postMessage({ type: 'sul:config', config: S.cfg, assets: S.assets, replay: !!replay }, location.origin);
  }
  function pvPost(msg) { if (pv && S.pvReady) pv.contentWindow.postMessage(msg, location.origin); }
  function pvGoto(pageId, sid) {
    if (!pageId) return;
    pvPost({ type: 'sul:goto', page: pageId });
    if (sid) setTimeout(function () { pvPost({ type: 'sul:scrollto', sid: sid }); }, 700);
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'sul:ready') { S.pvReady = true; if (S.cfg) sendPreview(true); }
    if (e.data.type === 'sul:route') { S.pvPage = e.data.page; var sel = $('#pv-page'); if (sel) sel.value = e.data.page; }
  });
  var pvWidth = 1440;
  function layoutPreview() {
    var stage = $('#pv-stage'), r = stage.getBoundingClientRect();
    if (!r.width) return;
    var k = Math.min(1, (r.width - 16) / pvWidth);
    pv.style.width = pvWidth + 'px';
    pv.style.height = Math.round((r.height - 8) / k) + 'px';
    pv.style.transform = 'translateX(-50%) scale(' + k + ')';
    pv.style.top = '4px';
  }
  function fillPageSelect() {
    var sel = $('#pv-page'); sel.innerHTML = '';
    S.cfg.pages.forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: 'Page: ' + (p.title || p.id) })); });
    if (S.pvPage) sel.value = S.pvPage;
  }

  /* ================= GitHub ================= */
  /* ---- password lock (PBKDF2 + AES-GCM, all in the browser) ---- */
  var ITER = 310000;
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function deriveKey(pw, salt, iter) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    });
  }
  function encObj(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)))
      .then(function (ct) { return { iv: b64(iv), ct: b64(new Uint8Array(ct)) }; });
  }
  function decObj(key, blob) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct))
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  function adminPath() { return location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/'); }
  function validLock(l) { return !!(l && l.salt && l.iv && l.ct && l.iter); }
  function makeLock(key, saltB64) {
    return encObj(key, { path: adminPath(), t: Date.now() }).then(function (blob) {
      return { v: 1, salt: saltB64, iter: ITER, iv: blob.iv, ct: blob.ct, t: Date.now() };
    });
  }
  function rememberSessionKey(key, salt) {
    return crypto.subtle.exportKey('raw', key).then(function (raw) {
      try { sessionStorage.setItem('sul.adminKey', JSON.stringify({ k: b64(new Uint8Array(raw)), salt: salt })); } catch (e) {}
    });
  }
  function sessionKeyFor(salt) {
    var d = null; try { d = JSON.parse(sessionStorage.getItem('sul.adminKey') || 'null'); } catch (e) {}
    if (!d || d.salt !== salt) return Promise.resolve(null);
    return crypto.subtle.importKey('raw', unb64(d.k), 'AES-GCM', true, ['encrypt', 'decrypt']).catch(function () { return null; });
  }

  /* GitHub settings: repo info in plain text, token encrypted with your password */
  function ghMeta() { var c = {}; try { c = JSON.parse(lsGet(LS.gh) || '{}') || {}; } catch (e) { c = {}; } return c; }
  function ghCfg() {
    var m = ghMeta();
    var c = { owner: m.owner || '', repo: m.repo || '', branch: m.branch || 'main', path: m.path || 'content/site.json', token: S.token || '' };
    c.ok = !!(c.owner && c.repo && c.token);
    return c;
  }
  function saveGh(c) {
    S.token = c.token || '';
    var meta = { owner: c.owner, repo: c.repo, branch: c.branch, path: c.path };
    var done = function () { lsSet(LS.gh, JSON.stringify(meta)); };
    if (!S.token || !S.key) { done(); return Promise.resolve(); }
    return encObj(S.key, { t: S.token }).then(function (tok) { meta.tok = tok; meta.salt = S.lockSalt; done(); });
  }
  function unlockToken() {
    var m = ghMeta();
    if (m.token) { // older plain-text token -> encrypt it now
      S.token = m.token; delete m.token;
      return saveGh({ owner: m.owner, repo: m.repo, branch: m.branch, path: m.path, token: S.token });
    }
    if (!m.tok || m.salt !== S.lockSalt) { S.token = ''; return Promise.resolve(); }
    return decObj(S.key, m.tok).then(function (d) { S.token = d.t || ''; }).catch(function () { S.token = ''; });
  }
  function gh(method, path, body, accept) {
    var c = ghCfg();
    return fetch('https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + path, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + c.token, 'Accept': accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var msg = t; try { msg = JSON.parse(t).message || t; } catch (e) {}
        var err = new Error(r.status + ': ' + msg); err.status = r.status; throw err;
      });
      return accept && accept.indexOf('raw') >= 0 ? r.text() : r.json();
    });
  }
  function ghErrorText(err) {
    var s = err && err.status;
    if (s === 401) return 'GitHub says the token is wrong or expired. Make a new token and paste it in Publish & Settings.';
    if (s === 403) return 'The token is not allowed to write to this repo. Give it “Contents: Read and write” access for this repository.';
    if (s === 404) return 'Repo or branch not found. Check the owner, repo name and branch (and that the token can see this repo).';
    if (s === 409 || s === 422) return 'GitHub rejected the update (' + err.message + '). Try Publish again.';
    if (err && /Failed to fetch|NetworkError/i.test(err.message)) return 'Could not reach GitHub — check your internet connection.';
    return (err && err.message) || 'Unknown error';
  }
  function ghLoadConfig() {
    var c = ghCfg();
    return gh('GET', '/contents/' + c.path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(c.branch), null, 'application/vnd.github.raw+json')
      .then(function (txt) { return JSON.parse(txt); });
  }
  function publishCommit(files, message, progress) {
    var c = ghCfg(), br = encodeURIComponent(c.branch), headSha;
    progress(5, 'Checking your repo…');
    return gh('GET', '/git/ref/heads/' + br).then(function (ref) {
      headSha = ref.object.sha;
      return gh('GET', '/git/commits/' + headSha);
    }).then(function (commit) {
      var done = 0, tree = [];
      var seq = Promise.resolve();
      files.forEach(function (f) {
        seq = seq.then(function () {
          return gh('POST', '/git/blobs', { content: f.b64, encoding: 'base64' }).then(function (b) {
            tree.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
            done++; progress(10 + Math.round(done / files.length * 70), 'Uploading ' + done + ' of ' + files.length + '…');
          });
        });
      });
      return seq.then(function () { return gh('POST', '/git/trees', { base_tree: commit.tree.sha, tree: tree }); });
    }).then(function (t) {
      progress(85, 'Saving…');
      return gh('POST', '/git/commits', { message: message, tree: t.sha, parents: [headSha] });
    }).then(function (nc) {
      progress(95, 'Going live…');
      return gh('PATCH', '/git/refs/heads/' + br, { sha: nc.sha, force: false }).then(function () { return nc; });
    });
  }

  /* ================= lint (catch mistakes before publishing) ================= */
  function lint() {
    var c = S.cfg, out = [], ids = {}, pageIds = {};
    c.pages.forEach(function (p) {
      if (pageIds[p.id]) out.push('Two pages share the address “' + p.id + '”. Give each page a different address.');
      pageIds[p.id] = 1;
    });
    function checkLink(l, where) {
      l = String(l || '').trim();
      if (/^#\//.test(l)) { var id = decodeURIComponent(l.slice(2)); if (id && !pageIds[id]) out.push(where + ' links to page “' + id + '” which doesn’t exist.'); }
      if (/^javascript:/i.test(l)) out.push(where + ' has a link that is not allowed.');
    }
    c.kits.forEach(function (k, i) {
      var n = 'Kit “' + (k.title || '#' + (i + 1)) + '”';
      if (k.visible !== false && !k.soldOut && !String(k.link || '').trim()) out.push(n + ' has no link — its button will be greyed out.');
      if (!k.image) out.push(n + ' has no picture.');
      checkLink(k.link, n);
    });
    c.gallery.forEach(function (g, i) { if (!g.src) out.push('Gallery item “' + (g.title || '#' + (i + 1)) + '” has no image/video.'); });
    var cats = {}; c.galleryCategories.forEach(function (g) { if (cats[g.id]) out.push('Two gallery categories have the same id “' + g.id + '”.'); cats[g.id] = 1; });
    c.gallery.forEach(function (g) { if (g.category && !cats[g.category]) out.push('“' + (g.title || 'A gallery item') + '” is in a category that was deleted — pick a new one.'); });
    c.pages.forEach(function (p) {
      p.sections.forEach(function (s) {
        var n = 'Section “' + (s.title || TYPES[s.type] && TYPES[s.type].label || s.type) + '” on ' + (p.title || p.id);
        if (ids[s.id]) out.push(n + ' has a duplicate id.'); ids[s.id] = 1;
        (s.buttons || []).concat(s.links || []).forEach(function (b) { checkLink(b.link, n); });
        if (s.moreLink) checkLink(s.moreLink, n);
        if (s.type === 'gallery' && s.category && s.category !== 'all' && !cats[s.category]) out.push(n + ' shows a category that no longer exists.');
      });
    });
    (c.socials || []).forEach(function (s) { checkLink(s.url, 'Social link'); });
    checkLink(c.header.ctaLink, 'Header button');
    return out;
  }

  /* ================= field builders ================= */
  function field(label, help, control) {
    return el('div', { class: 'field' }, label ? el('label', { text: label }) : null, control, help ? el('div', { class: 'help', html: help }) : null);
  }
  function set(obj, key, val, o) { obj[key] = val; if (o && o.after) o.after(val); changed(); }

  function fText(obj, key, label, o) {
    o = o || {};
    var inp = o.multi ? el('textarea', { rows: o.rows || 3, placeholder: o.ph || '' }) : el('input', { type: 'text', placeholder: o.ph || '', spellcheck: o.nospell ? 'false' : null });
    inp.value = obj[key] == null ? '' : obj[key];
    inp.addEventListener('input', function () { set(obj, key, o.transform ? o.transform(inp.value) : inp.value, o); });
    if (o.transform) inp.addEventListener('blur', function () { inp.value = obj[key]; });
    return field(label, o.help, inp);
  }
  function fNum(obj, key, label, o) {
    o = o || {};
    var inp = el('input', { type: 'number', min: o.min, max: o.max, step: o.step || 1 });
    inp.value = obj[key] == null ? (o.def != null ? o.def : '') : obj[key];
    inp.addEventListener('input', function () { var v = inp.value === '' ? (o.def || 0) : Number(inp.value); if (isFinite(v)) set(obj, key, v, o); });
    return field(label, o.help, inp);
  }
  function fRange(obj, key, label, o) {
    o = o || {};
    var v = obj[key] == null ? o.def : obj[key];
    var inp = el('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1 }); inp.value = v;
    var out = el('output', { text: fmt(v) });
    function fmt(x) { return (o.fmt ? o.fmt(Number(x)) : x) + (o.suffix || ''); }
    inp.addEventListener('input', function () { out.textContent = fmt(inp.value); set(obj, key, Number(inp.value), o); });
    return field(label, o.help, el('div', { class: 'range-in' }, inp, out));
  }
  function fColor(obj, key, label, o) {
    o = o || {};
    var v = /^#[0-9a-f]{6}$/i.test(obj[key] || '') ? obj[key] : (o.def || '#ff2bc2');
    var pick = el('input', { type: 'color' }); pick.value = v;
    var txt = el('input', { type: 'text', maxlength: 7, spellcheck: 'false' }); txt.value = obj[key] || v;
    pick.addEventListener('input', function () { txt.value = pick.value; txt.classList.remove('bad'); set(obj, key, pick.value, o); });
    txt.addEventListener('input', function () {
      var t = txt.value.trim(); if (t && t[0] !== '#') t = '#' + t;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) {
        if (t.length === 4) t = '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
        txt.classList.remove('bad'); pick.value = t.toLowerCase(); set(obj, key, t.toLowerCase(), o);
      } else txt.classList.add('bad');
    });
    return field(label, o.help, el('div', { class: 'color-in' }, pick, txt));
  }
  function fToggle(obj, key, label, o) {
    o = o || {};
    var on = o.defOn ? obj[key] !== false : !!obj[key];
    var inp = el('input', { type: 'checkbox' }); inp.checked = on;
    inp.addEventListener('change', function () { set(obj, key, inp.checked, o); });
    return el('div', { class: 'field' }, el('label', { class: 'toggle' }, inp, el('span', { class: 'sw' }), el('span', { text: label })), o.help ? el('div', { class: 'help', html: o.help }) : null);
  }
  function fSelect(obj, key, label, opts, o) {
    o = o || {};
    var sel = el('select');
    opts.forEach(function (op) { var v = Array.isArray(op) ? op[0] : op, t = Array.isArray(op) ? op[1] : op; sel.appendChild(el('option', { value: v, text: t })); });
    var cur = obj[key] == null ? o.def : obj[key];
    sel.value = cur == null ? '' : String(cur);
    if (sel.value !== String(cur) && cur != null && cur !== '') { sel.appendChild(el('option', { value: cur, text: cur })); sel.value = cur; }
    sel.addEventListener('change', function () { var v = sel.value; if (o.num) v = Number(v); set(obj, key, v, o); });
    return field(label, o.help, sel);
  }
  function linkPicker(inp, onPick) {
    var pick = el('select', { class: 'ab small', title: 'Link to one of your pages', style: 'max-width:110px;padding:8px 6px' });
    pick.appendChild(el('option', { value: '', text: '📄 Page…' }));
    S.cfg.pages.forEach(function (p, i) { pick.appendChild(el('option', { value: i === 0 ? '#/' : '#/' + p.id, text: p.title || p.id })); });
    pick.addEventListener('change', function () { if (pick.value) { inp.value = pick.value; onPick(pick.value); } pick.value = ''; });
    return pick;
  }
  function fLink(obj, key, label, o) {
    o = o || {};
    var inp = el('input', { type: 'text', placeholder: o.ph || 'https://… or pick a page', spellcheck: 'false' });
    inp.value = obj[key] || '';
    var commit = function (v) { set(obj, key, v.trim(), o); check(); };
    inp.addEventListener('input', function () { commit(inp.value); });
    var test = el('button', {
      class: 'ab small', type: 'button', title: 'Open this link', text: '↗', onclick: function () {
        var v = (obj[key] || '').trim(); if (!v) return toast('No link yet', 'bad');
        if (v[0] === '#') { var id = v.replace(/^#\/?/, '') || S.cfg.pages[0].id; pvGoto(id); toast('Showing that page in the preview'); return; }
        if (!/^[a-z]+:/i.test(v)) v = /@/.test(v) && !/\//.test(v) ? 'mailto:' + v : (/^(uploads|assets)\//.test(v) ? ROOT + v : 'https://' + v);
        window.open(v, '_blank', 'noopener');
      }
    });
    function check() { inp.classList.toggle('bad', /^\s*javascript:/i.test(inp.value)); }
    check();
    var help = o.help || 'Paste any link (Payhip, Gumroad, Stripe, BeatStars, Instagram…) or choose one of your pages.';
    return field(label, help, el('div', { class: 'inline' }, inp, linkPicker(inp, commit), test));
  }
  function fImage(obj, key, label, o) {
    o = o || {};
    var media = !!o.media;
    var thumb = el('div', { class: 'thumb' });
    var url = el('input', { type: 'text', placeholder: media ? 'Upload, or paste an image / video / YouTube link' : 'Upload, or paste an image link', spellcheck: 'false' });
    url.value = obj[key] || '';
    function paint() {
      thumb.innerHTML = '';
      var t = thumbFor(obj[key], null);
      if (t.kind === 'img') thumb.appendChild(el('img', { src: t.url, alt: '' }));
      else if (t.kind === 'video') thumb.appendChild(el('video', { src: t.url + '#t=0.1', muted: true, playsinline: true, preload: 'metadata' }));
      else thumb.textContent = obj[key] ? (ytId(obj[key]) ? 'YouTube' : 'link') : 'none';
    }
    url.addEventListener('input', function () { set(obj, key, url.value.trim(), o); paint(); });
    function doFiles(files) {
      if (!files.length) return;
      thumb.textContent = '…';
      uploadFile(files[0], media).then(function (p) {
        if (p) { url.value = p; set(obj, key, p, o); toast('Added ✦ (goes live when you Publish)', 'ok'); }
        paint();
      });
    }
    var up = el('button', { class: 'ab small', type: 'button', text: '⬆ Upload', onclick: function () { pickFiles(media ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*').then(doFiles); } });
    var clr = el('button', { class: 'ab small', type: 'button', text: 'Remove', onclick: function () { url.value = ''; set(obj, key, '', o); paint(); } });
    var wrap = el('div', { class: 'img-in' }, thumb, el('div', { class: 'col' }, el('div', { class: 'inline' }, up, clr), url));
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); wrap.classList.add('drop-hot'); });
    wrap.addEventListener('dragleave', function () { wrap.classList.remove('drop-hot'); });
    wrap.addEventListener('drop', function (e) { e.preventDefault(); wrap.classList.remove('drop-hot'); doFiles(Array.prototype.slice.call(e.dataTransfer.files || [])); });
    paint();
    return field(label, o.help || (media ? 'Drop a file here, upload, or paste a YouTube link.' : 'Drop an image here or click Upload.'), wrap);
  }
  function group(title, sub) { var c = el('div', { class: 'card' }, el('h3', null, title, sub ? el('small', { text: sub }) : null)); for (var i = 2; i < arguments.length; i++) add(c, arguments[i]); return c; }
  function row() { var r = el('div', { class: 'row' }); for (var i = 0; i < arguments.length; i++) add(r, arguments[i]); return r; }

  /* ---- generic sortable list ---- */
  function listEditor(arr, o) {
    var box = el('div', { class: 'list' });
    var dragFrom = -1;
    function render() {
      box.innerHTML = '';
      arr.forEach(function (item, idx) {
        if (o.filter && !o.filter(item)) return;
        var key = (o.key || 'l') + ':' + (item.id || idx);
        var it = el('div', { class: 'item' + (S.open[key] ? ' open' : '') });
        var tEl = el('b'), sEl = el('small'), mini = null;
        function head() {
          tEl.textContent = o.title(item) || 'Untitled';
          sEl.textContent = o.sub ? o.sub(item) || '' : '';
          it.classList.toggle('hidden-item', !!(o.hidden && o.hidden(item)));
          if (mini) {
            var t = o.thumb(item); mini.innerHTML = '';
            if (t && t.kind === 'img') mini.appendChild(el('img', { src: t.url, alt: '', style: 'width:100%;height:100%;object-fit:cover;border-radius:8px' }));
            else if (t && t.kind === 'video') mini.appendChild(el('video', { src: t.url + '#t=0.1', muted: true, preload: 'metadata', style: 'width:100%;height:100%;object-fit:cover;border-radius:8px' }));
          }
        }
        if (o.thumb) mini = el('div', { class: 'mini' });
        var tools = el('div', { class: 'tools' },
          el('button', { type: 'button', title: 'Move up', text: '▲', onclick: function (e) { e.stopPropagation(); move(idx, -1); } }),
          el('button', { type: 'button', title: 'Move down', text: '▼', onclick: function (e) { e.stopPropagation(); move(idx, 1); } }),
          o.noDup ? null : el('button', { type: 'button', title: 'Duplicate', text: '⧉', onclick: function (e) { e.stopPropagation(); dup(idx); } }),
          el('button', { type: 'button', class: 'del', title: 'Delete', text: '🗑', onclick: function (e) { e.stopPropagation(); del(idx); } }));
        var grip = el('span', { class: 'grip', title: 'Drag to reorder', text: '⠿' });
        var hd = el('div', { class: 'item-head', role: 'button', tabindex: '0', 'aria-expanded': String(!!S.open[key]) }, grip, mini, el('div', { class: 't' }, tEl, sEl), tools, el('span', { class: 'chev', text: '›' }));
        var body = el('div', { class: 'item-body' });
        var built = false;
        function build() { if (built) return; built = true; o.body(item, body, head, render); }
        function toggle() {
          var op = !it.classList.contains('open');
          it.classList.toggle('open', op); S.open[key] = op; hd.setAttribute('aria-expanded', String(op));
          if (op) { build(); if (o.onOpen) o.onOpen(item); }
        }
        hd.addEventListener('click', toggle);
        hd.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === hd) { e.preventDefault(); toggle(); } });
        // drag & drop (from the grip)
        grip.addEventListener('mousedown', function () { it.draggable = true; });
        grip.addEventListener('touchstart', function () { it.draggable = true; }, { passive: true });
        it.addEventListener('dragstart', function (e) { dragFrom = idx; it.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (x) {} });
        it.addEventListener('dragend', function () { it.draggable = false; it.classList.remove('dragging'); clearMarks(); });
        it.addEventListener('dragover', function (e) {
          if (dragFrom < 0) return; e.preventDefault();
          var r = it.getBoundingClientRect(), above = e.clientY < r.top + r.height / 2;
          clearMarks(); it.classList.add(above ? 'drop-above' : 'drop-below');
        });
        it.addEventListener('drop', function (e) {
          if (dragFrom < 0) return; e.preventDefault();
          var r = it.getBoundingClientRect(), above = e.clientY < r.top + r.height / 2;
          var to = above ? idx : idx + 1; if (dragFrom < to) to--;
          var from = dragFrom; dragFrom = -1; clearMarks();
          if (from !== to) { var x = arr.splice(from, 1)[0]; arr.splice(to, 0, x); changed(); render(); if (o.onReorder) o.onReorder(); }
        });
        add(it, [hd, body]); head();
        if (S.open[key]) build();
        box.appendChild(it);
      });
      if (!box.children.length) box.appendChild(el('div', { class: 'note', text: o.empty || 'Nothing here yet.' }));
    }
    function clearMarks() { box.querySelectorAll('.drop-above,.drop-below').forEach(function (x) { x.classList.remove('drop-above', 'drop-below'); }); }
    function move(i, d) {
      // skip over items hidden by a filter
      var j = i + d;
      while (o.filter && j >= 0 && j < arr.length && !o.filter(arr[j])) j += d;
      if (j < 0 || j >= arr.length) return;
      var x = arr[i]; arr[i] = arr[j]; arr[j] = x; changed(); render(); if (o.onReorder) o.onReorder();
    }
    function dup(i) {
      var c = clone(arr[i]); if ('id' in c || o.ids) c.id = o.newId ? o.newId(c) : uid(o.key || 'x');
      if (c.title) c.title = c.title + ' (copy)';
      arr.splice(i + 1, 0, c); S.open[(o.key || 'l') + ':' + c.id] = true; changed(); render();
    }
    function del(i) {
      if (o.canDelete && !o.canDelete(arr[i])) return;
      confirmBox('Delete this?', '“' + (o.title(arr[i]) || 'This item') + '” will be removed. You can undo with Ctrl+Z.', 'Delete', true).then(function (ok) {
        if (!ok) return; arr.splice(i, 1); changed(); render(); if (o.onReorder) o.onReorder();
      });
    }
    render();
    box.addItem = function (item, atTop) {
      if (atTop) arr.unshift(item); else arr.push(item);
      S.open[(o.key || 'l') + ':' + (item.id || (atTop ? 0 : arr.length - 1))] = true; changed(); render();
      var last = atTop ? box.firstElementChild : box.lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (o.onOpen) o.onOpen(item);
    };
    box.rerender = render;
    return box;
  }

  function buttonsEditor(owner, key, label, o) {
    o = o || {};
    if (!Array.isArray(owner[key])) owner[key] = [];
    var arr = owner[key];
    arr.forEach(function (b) { if (!b.id) b.id = uid('b'); });
    var list = listEditor(arr, {
      key: 'btn-' + (owner.id || key), noDup: false,
      title: function (b) { return b.text || '(no text)'; },
      sub: function (b) { return b.link || 'no link yet'; },
      body: function (b, c, head) {
        add(c, [row(fText(b, 'text', 'Button text', { after: head, help: 'Tip: ✦ shows up in your highlight colour.' }),
          fSelect(b, 'style', 'Look', [['primary', 'Main (gradient)'], ['ghost', 'Soft (white)'], ['accent', 'Accent (blue)'], ['holo', 'Holographic']], { def: 'primary' })),
          fLink(b, 'link', 'Goes to', { after: head }),
          fToggle(b, 'newTab', 'Open in a new tab', { help: 'Turn on for links to other websites.' })]);
      },
      empty: 'No buttons.'
    });
    return group(label || 'Buttons', o.sub, list, el('div', { class: 'add-row' }, el('button', {
      class: 'ab small', type: 'button', text: '+ Add button',
      onclick: function () { list.addItem({ id: uid('b'), text: 'NEW BUTTON', link: '', style: 'primary', newTab: false }); }
    })));
  }

  /* ================= section types ================= */
  var TYPES = {
    hero: { label: 'Hero (logo + intro text)', icon: '✦', desc: 'Big logo with your name, tagline and buttons.' },
    kits: { label: 'Drum kits grid', icon: '🥁', desc: 'Shows your drum kits with GO TO buttons.' },
    gallery: { label: 'Gallery (cover arts / edits)', icon: '🖼', desc: 'Grid of your work that opens big when clicked.' },
    text: { label: 'Title + text', icon: '¶', desc: 'A heading with a paragraph and optional buttons.' },
    cta: { label: 'Call to action box', icon: '📣', desc: 'Glassy box with a big title and buttons.' },
    marquee: { label: 'Scrolling text band', icon: '〰', desc: 'Moving ticker strip.' },
    video: { label: 'Video', icon: '▶', desc: 'YouTube / Vimeo link or a video file.' },
    image: { label: 'Image', icon: '🌄', desc: 'A single picture with optional link.' },
    links: { label: 'Link buttons list', icon: '🔗', desc: 'Stack of big buttons (link-in-bio style).' },
    spacer: { label: 'Empty space', icon: '↕', desc: 'Adds space between sections.' }
  };
  function newSection(type) {
    var s = { id: uid('s'), type: type, visible: true, align: type === 'hero' ? 'left' : 'center' };
    switch (type) {
      case 'hero': Object.assign(s, { layout: 'logo-left', logo: S.cfg.brand.logo || 'assets/img/logo.png', logoSize: 620, title: S.cfg.brand.name || 'TITLE', text: 'Your tagline here', smallText: '', smallLink: '', buttons: [{ id: uid('b'), text: '✦ BUTTON', link: '', style: 'primary', newTab: false }], fullHeight: true }); break;
      case 'kits': Object.assign(s, { title: 'DRUM KITS', subtitle: '', filter: 'all', limit: 0, columns: 3, showSearch: false, moreText: '', moreLink: '' }); break;
      case 'gallery': Object.assign(s, { title: 'GALLERY', subtitle: '', category: 'all', showTabs: true, showLabels: false, layout: 'grid', columns: 3, limit: 0, moreText: '', moreLink: '' }); break;
      case 'text': Object.assign(s, { title: 'TITLE', text: 'Write something here. **Bold**, *italic* and [links](https://instagram.com) work.', size: 'normal', buttons: [] }); break;
      case 'cta': Object.assign(s, { title: 'LET’S WORK', text: 'Short message here.', buttons: [{ id: uid('b'), text: 'CONTACT ME', link: '', style: 'primary', newTab: true }] }); break;
      case 'marquee': Object.assign(s, { text: 'NEW KITS ✦ COVER ARTS ✦ EDITS ✦', style: 'gradient', tilt: -2 }); break;
      case 'video': Object.assign(s, { title: '', subtitle: '', url: '', poster: '' }); break;
      case 'image': Object.assign(s, { title: '', image: '', caption: '', link: '', newTab: true, maxWidth: 900 }); break;
      case 'links': Object.assign(s, { title: 'LINKS', subtitle: '', links: [{ id: uid('b'), text: 'INSTAGRAM', link: 'https://instagram.com/', style: 'primary', newTab: true }] }); break;
      case 'spacer': Object.assign(s, { height: 60 }); break;
    }
    return s;
  }
  function sectionSummary(s) {
    var t = s.title || s.text || s.url || '';
    if (s.type === 'kits') t = (s.title || 'Kits') + ' · ' + (s.filter === 'featured' ? 'featured only' : 'all kits');
    if (s.type === 'gallery') t = (s.title || 'Gallery') + ' · ' + (s.category && s.category !== 'all' ? catLabel(s.category) : 'everything');
    if (s.type === 'spacer') t = (s.height || 60) + 'px';
    return String(t).replace(/\s+/g, ' ').slice(0, 60);
  }
  function catLabel(id) { var c = S.cfg.galleryCategories.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; }
  function sectionBody(s, c, head) {
    var h = function () { head(); };
    var F = [];
    if (s.type === 'hero') {
      F.push(group('Content', null,
        fText(s, 'title', 'Big title', { after: h }), fText(s, 'text', 'Tagline', { multi: true, rows: 2, after: h }),
        row(fText(s, 'smallText', 'Small line (e.g. your @)'), fLink(s, 'smallLink', 'Small line link', { help: ' ' }))));
      F.push(group('Logo & layout', null,
        fImage(s, 'logo', 'Logo / picture'),
        row(fSelect(s, 'layout', 'Layout', [['logo-left', 'Logo left, text right'], ['logo-right', 'Text left, logo right'], ['centered', 'Centered (stacked)'], ['text-only', 'Text only']]),
          fRange(s, 'logoSize', 'Logo size', { min: 200, max: 1100, step: 10, def: 620, suffix: 'px' })),
        fToggle(s, 'fullHeight', 'Fill the whole screen height', { defOn: true })));
      F.push(buttonsEditor(s, 'buttons', 'Buttons'));
    } else if (s.type === 'text') {
      F.push(group('Content', null, fText(s, 'title', 'Title', { after: h }),
        fText(s, 'text', 'Text', { multi: true, rows: 5, after: h, help: '<b>**bold**</b>, <i>*italic*</i>, [link text](https://…) and new lines work.' }),
        fSelect(s, 'size', 'Text size', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], { def: 'normal' })));
      F.push(buttonsEditor(s, 'buttons', 'Buttons (optional)'));
    } else if (s.type === 'kits') {
      F.push(group('Kits grid', null, fText(s, 'title', 'Title', { after: h }), fText(s, 'subtitle', 'Subtitle'),
        row(fSelect(s, 'filter', 'Which kits', [['all', 'All kits'], ['featured', 'Only ones marked “Featured”']], { after: h }),
          fNum(s, 'limit', 'Max to show (0 = all)', { min: 0, max: 100 })),
        row(fRange(s, 'columns', 'Columns', { min: 1, max: 5, def: 3 }), el('div', null, fToggle(s, 'showSearch', 'Show a search bar'))),
        el('div', { class: 'note', html: 'Edit the kits themselves in <b>🥁 Drum Kits</b>.' })));
      F.push(group('“See more” button', 'optional', row(fText(s, 'moreText', 'Button text'), fLink(s, 'moreLink', 'Goes to', { help: ' ' }))));
    } else if (s.type === 'gallery') {
      var cats = [['all', 'Everything']].concat(S.cfg.galleryCategories.map(function (g) { return [g.id, g.label]; }));
      F.push(group('Gallery', null, fText(s, 'title', 'Title', { after: h }), fText(s, 'subtitle', 'Subtitle'),
        row(fSelect(s, 'category', 'Show', cats, { after: h, def: 'all' }), fNum(s, 'limit', 'Max to show (0 = all)', { min: 0, max: 200 })),
        row(fSelect(s, 'layout', 'Layout', [['grid', 'Square grid'], ['masonry', 'Masonry (keeps image shapes)']], { def: 'grid' }), fRange(s, 'columns', 'Columns', { min: 1, max: 6, def: 3 })),
        fToggle(s, 'showTabs', 'Show category tabs (when showing Everything)'),
        fToggle(s, 'showLabels', 'Show category label on each picture'),
        fText(s, 'allLabel', '“All” tab text', { ph: 'ALL' }),
        el('div', { class: 'note', html: 'Add pictures & videos in <b>🖼 Cover Arts & Edits</b>.' })));
      F.push(group('“See more” button', 'optional', row(fText(s, 'moreText', 'Button text'), fLink(s, 'moreLink', 'Goes to', { help: ' ' }))));
    } else if (s.type === 'cta') {
      F.push(group('Content', null, fText(s, 'title', 'Title', { after: h }), fText(s, 'text', 'Text', { multi: true, rows: 3, after: h, help: '**bold**, *italic*, [link](https://…)' })));
      F.push(buttonsEditor(s, 'buttons', 'Buttons'));
    } else if (s.type === 'marquee') {
      F.push(group('Scrolling band', null, fText(s, 'text', 'Text', { after: h, help: 'Repeats forever. Use ✦ between words.' }),
        row(fSelect(s, 'style', 'Style', [['gradient', 'Pink → purple'], ['holo', 'Holographic'], ['glass', 'Glass'], ['dark', 'Dark']]),
          fRange(s, 'tilt', 'Tilt', { min: -8, max: 8, step: 0.5, def: -2, suffix: '°' })),
        el('div', { class: 'note', html: 'Scroll speed is in <b>🌀 Animations</b>.' })));
    } else if (s.type === 'video') {
      F.push(group('Video', null, fText(s, 'title', 'Title', { after: h }), fText(s, 'subtitle', 'Subtitle'),
        fImage(s, 'url', 'Video', { media: true, after: h, help: 'Paste a YouTube / Vimeo link (best), or upload an .mp4 under 45 MB.' }),
        fImage(s, 'poster', 'Cover picture (for uploaded videos)')));
    } else if (s.type === 'image') {
      F.push(group('Image', null, fText(s, 'title', 'Title (optional)', { after: h }), fImage(s, 'image', 'Image', { after: h }),
        fText(s, 'caption', 'Caption'), fLink(s, 'link', 'Clicking the image goes to (optional)'), fToggle(s, 'newTab', 'Open in a new tab'),
        fRange(s, 'maxWidth', 'Max width', { min: 200, max: 1600, step: 10, def: 900, suffix: 'px' })));
    } else if (s.type === 'links') {
      F.push(group('Header', null, fText(s, 'title', 'Title', { after: h }), fText(s, 'subtitle', 'Subtitle')));
      F.push(buttonsEditor(s, 'links', 'Link buttons'));
    } else if (s.type === 'spacer') {
      F.push(group('Space', null, fRange(s, 'height', 'Height', { min: 0, max: 400, step: 5, def: 60, suffix: 'px', after: h })));
    }
    if (s.type !== 'spacer') {
      var lay = [
        row(fSelect(s, 'width', 'Width', [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide'], ['full', 'Full screen']], { def: 'normal' }),
          fSelect(s, 'align', 'Align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], { def: s.type === 'hero' ? 'left' : 'center' }),
          fSelect(s, 'spacing', 'Space around', [['none', 'None'], ['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], { def: 'normal' }))
      ];
      if (s.type !== 'marquee' && s.type !== 'cta') lay.push(fToggle(s, 'panel', 'Put it in a glass box'));
      F.push(group('Section layout', null, lay));
    }
    F.unshift(fToggle(s, 'visible', 'Show this section', { defOn: true, after: h }));
    add(c, F);
  }

  /* ================= tabs ================= */
  var TABS = [
    ['start', '✦', 'Start'],
    ['pages', '▤', 'Pages & Layout'],
    ['kits', '🥁', 'Drum Kits'],
    ['gallery', '🖼', 'Cover Arts & Edits'],
    ['intro', '✨', 'Intro Page'],
    ['brand', '💗', 'Logo & Site Info'],
    ['header', '☰', 'Menu, Footer & Socials'],
    ['theme', '🎨', 'Colors & Fonts'],
    ['background', '☁', 'Background'],
    ['animations', '🌀', 'Animations'],
    '-',
    ['publish', '🚀', 'Publish & Settings']
  ];
  function renderSide() {
    var side = $('#side'); side.innerHTML = '';
    TABS.forEach(function (t) {
      if (t === '-') return side.appendChild(el('hr'));
      side.appendChild(el('button', { class: S.tab === t[0] ? 'on' : '', title: t[2], 'data-tab': t[0], onclick: function () { S.tab = t[0]; lsSet(LS.tab, t[0]); renderSide(); renderTab(); $('#editor').scrollTop = 0; } },
        el('span', { class: 'ico', text: t[1] }), el('span', { class: 'lbl', text: t[2] })));
    });
  }
  function head(title, lead) { return [el('h1', { text: title }), lead ? el('p', { class: 'lead', html: lead }) : null]; }

  var VIEWS = {};
  VIEWS.start = function (E) {
    var issues = lint(), gh = ghCfg(), pend = pendingPaths().length;
    add(E, head('Hey Sul ✦', 'Everything on your site is editable here. Changes show up in the preview right away and are saved as a draft in this browser. Nothing goes live until you press <b>🚀 Publish</b>.'));
    if (!gh.ok) add(E, el('div', { class: 'note warn', html: '<b>GitHub isn’t connected on this device yet.</b> You can still edit everything — connect it in <b>🚀 Publish & Settings</b> to put changes live.' }));
    add(E, group('Quick actions', null, el('div', { class: 'add-row' },
      el('button', { class: 'ab primary', text: '+ Add a drum kit', onclick: function () { S.tab = 'kits'; S._addKit = true; renderSide(); renderTab(); } }),
      el('button', { class: 'ab', text: '+ Add cover art / edit', onclick: function () { S.tab = 'gallery'; S._addGal = true; renderSide(); renderTab(); } }),
      el('button', { class: 'ab', text: '✎ Edit home page', onclick: function () { S.tab = 'pages'; S.pageSel = S.cfg.pages[0].id; renderSide(); renderTab(); } }),
      el('button', { class: 'ab', text: '🎨 Change colors', onclick: function () { S.tab = 'theme'; renderSide(); renderTab(); } }))));
    add(E, group('Status', null,
      el('div', { class: 'note ' + (dirty() ? 'warn' : 'ok'), html: dirty() ? '<b>You have unpublished changes.</b>' + (pend ? ' Including ' + pend + ' new file' + (pend > 1 ? 's' : '') + '.' : '') + ' Press 🚀 Publish when you’re happy.' : '<b>Your site matches what’s live.</b>' }),
      issues.length ? el('div', { class: 'note bad' }, el('b', { text: 'Things to check (' + issues.length + '):' }), el('ul', { class: 'steps' }, issues.slice(0, 12).map(function (x) { return el('li', { text: x }); }))) : el('div', { class: 'note ok', text: 'No problems found ✦' })));
    add(E, group('Tips', null, el('ul', { class: 'steps', html:
      '<li>Every list can be reordered by dragging the <b>⠿</b> handle or using ▲ ▼.</li>' +
      '<li><b>Ctrl+Z</b> undoes anything (Ctrl+Shift+Z redoes).</li>' +
      '<li>Text boxes understand <code>**bold**</code>, <code>*italic*</code> and <code>[text](https://link)</code>.</li>' +
      '<li>Big videos: put them on YouTube and paste the link — it loads faster for visitors.</li>' +
      '<li>Visitors with “reduce motion” turned on in their phone settings see a calm, still version of the background.</li>' +
      '<li>This admin page isn’t linked anywhere on your site. Only people with your GitHub token can publish.</li>' })));
  };

  VIEWS.pages = function (E) {
    add(E, head('Pages & Layout', 'Your pages appear in the menu in this order. The <b>first page is your homepage</b>. Open a section to edit it — the preview jumps to it.'));
    var pagesList = listEditor(S.cfg.pages, {
      key: 'page', noDup: false,
      title: function (p) { return p.title || p.id; },
      sub: function (p) { return (S.cfg.pages[0] === p ? 'Homepage · yoursite.com' : 'yoursite.com/#/' + p.id) + (p.inNav === false ? ' · hidden from menu' : ''); },
      newId: function (p) { return uniquePageId(p.id); },
      canDelete: function () { if (S.cfg.pages.length < 2) { toast('You need at least one page', 'bad'); return false; } return true; },
      onReorder: function () { fillPageSelect(); renderSectionsArea(); },
      body: function (p, c, h) {
        add(c, [row(fText(p, 'title', 'Name in menu', { after: function () { h(); fillPageSelect(); refreshPageSel(); } }),
          fText(p, 'id', 'Page address', {
            nospell: true, help: 'Letters, numbers and dashes. Changing it updates links that point to it.',
            transform: function (v) { return slug(v) || p.id; },
            after: function (v) { renamePage(p, v); h(); refreshPageSel(); }
          })),
          fToggle(p, 'inNav', 'Show in the menu', { defOn: true, after: h }),
          el('button', { class: 'ab small', type: 'button', text: '✎ Edit this page’s sections ↓', onclick: function () { S.pageSel = p.id; refreshPageSel(); renderSectionsArea(); pvGoto(p.id); secBox.scrollIntoView({ behavior: 'smooth' }); } })]);
      },
      onOpen: function (p) { pvGoto(p.id); }
    });
    add(E, group('Pages', null, pagesList, el('div', { class: 'add-row' }, el('button', {
      class: 'ab small', text: '+ Add page', onclick: function () {
        var id = uniquePageId('new-page');
        pagesList.addItem({ id: id, title: 'NEW PAGE', inNav: true, sections: [newSection('text')] });
        fillPageSelect(); refreshPageSel();
      }
    }))));

    var secBox = el('div');
    var pageSel = el('select');
    function refreshPageSel() {
      pageSel.innerHTML = '';
      S.cfg.pages.forEach(function (p) { pageSel.appendChild(el('option', { value: p.id, text: p.title || p.id })); });
      if (!S.cfg.pages.some(function (p) { return p.id === S.pageSel; })) S.pageSel = S.cfg.pages[0].id;
      pageSel.value = S.pageSel;
    }
    pageSel.addEventListener('change', function () { S.pageSel = pageSel.value; lsSet(LS.page, S.pageSel); renderSectionsArea(); pvGoto(S.pageSel); });
    function renderSectionsArea() {
      secBox.innerHTML = '';
      var page = S.cfg.pages.filter(function (p) { return p.id === S.pageSel; })[0] || S.cfg.pages[0];
      var list = listEditor(page.sections, {
        key: 'sec',
        title: function (s) { return (TYPES[s.type] ? TYPES[s.type].icon + ' ' + TYPES[s.type].label : s.type); },
        sub: function (s) { return (s.visible === false ? '[hidden] ' : '') + sectionSummary(s); },
        hidden: function (s) { return s.visible === false; },
        body: function (s, c, h) { sectionBody(s, c, h); },
        onOpen: function (s) { pvGoto(page.id, s.id); },
        empty: 'This page is empty — add a section below.'
      });
      add(secBox, group('Sections on “' + (page.title || page.id) + '”', 'top to bottom', list,
        el('div', { class: 'add-row' }, el('button', { class: 'ab primary small', text: '+ Add section', onclick: function () { pickType(function (t) { list.addItem(newSection(t)); }); } }))));
    }
    refreshPageSel();
    add(E, el('div', { class: 'card' }, el('div', { class: 'field' }, el('label', { text: 'Edit sections on page' }), pageSel)));
    add(E, secBox);
    renderSectionsArea();
  };
  function uniquePageId(base) {
    base = slug(base) || 'page'; var id = base, n = 2;
    while (S.cfg.pages.some(function (p) { return p.id === id; })) id = base + '-' + (n++);
    return id;
  }
  function renamePage(p, newId) {
    if (S.cfg.pages.some(function (x) { return x !== p && x.id === newId; })) {
      p.id = uniquePageId(newId);
      toast('That address is taken — using “' + p.id + '”');
    }
    var old = pageIdMap && pageIdMap.get(p);
    if (old && S.pageSel === old) { S.pageSel = p.id; lsSet(LS.page, p.id); }
    fixPageLinks();
    fillPageSelect();
  }
  // Keep "#/page" links working when a page address changes
  var pageIdMap = null;
  function snapshotPageIds() { pageIdMap = new Map(); S.cfg.pages.forEach(function (p) { pageIdMap.set(p, p.id); }); }
  function fixPageLinks() {
    if (!pageIdMap) return snapshotPageIds();
    var renames = {};
    S.cfg.pages.forEach(function (p) { var o = pageIdMap.get(p); if (o && o !== p.id) renames[o] = p.id; });
    if (Object.keys(renames).length) {
      var walk = function (v) {
        if (Array.isArray(v)) return v.forEach(walk);
        if (v && typeof v === 'object') Object.keys(v).forEach(function (k) {
          if (typeof v[k] === 'string' && /^#\//.test(v[k])) { var id = decodeURIComponent(v[k].slice(2)); if (renames[id]) v[k] = '#/' + renames[id]; }
          else walk(v[k]);
        });
      };
      walk(S.cfg);
    }
    snapshotPageIds();
  }
  function pickType(cb) {
    modal(function (b, close) {
      add(b, [el('h2', { text: 'Add a section' }), el('div', { class: 'type-grid' }, Object.keys(TYPES).map(function (t) {
        return el('button', { type: 'button', onclick: function () { close(); cb(t); } }, el('b', { text: TYPES[t].icon + ' ' + TYPES[t].label }), el('small', { text: TYPES[t].desc }));
      })), el('div', { class: 'acts' }, el('button', { class: 'ab', text: 'Cancel', onclick: close }))]);
    });
  }

  VIEWS.kits = function (E) {
    add(E, head('Drum Kits', 'Each kit gets a card with a <b>GO TO</b> button. Put any link on it — your Payhip, Gumroad, Stripe or BeatStars page, a Google Drive link, anything.'));
    var list = listEditor(S.cfg.kits, {
      key: 'kit',
      title: function (k) { return k.title; },
      sub: function (k) { return [k.price, k.featured ? '★ featured' : '', k.soldOut ? 'sold out' : '', k.visible === false ? 'hidden' : '', k.link ? '' : '⚠ no link'].filter(Boolean).join(' · '); },
      thumb: function (k) { return k.image ? { kind: 'img', url: assetUrl(k.image) } : null; },
      hidden: function (k) { return k.visible === false; },
      body: function (k, c, h) {
        add(c, [
          row(fText(k, 'title', 'Kit name', { after: h }), fText(k, 'badge', 'Badge (optional)', { ph: 'NEW, FREE, 50% OFF…' })),
          fImage(k, 'image', 'Cover picture', { after: h }),
          fText(k, 'description', 'Description', { multi: true, rows: 2 }),
          row(fText(k, 'price', 'Price', { ph: '$25 or FREE', after: h }), fText(k, 'oldPrice', 'Old price (crossed out)', { ph: 'optional' })),
          row(fText(k, 'buttonText', 'Button text', { ph: 'GO TO' }), fToggle(k, 'newTab', 'Open link in a new tab', { defOn: true })),
          fLink(k, 'link', 'GO TO link', { after: h, help: 'Where the button sends people — paste any link.' }),
          row(fToggle(k, 'featured', '★ Featured (shows on the homepage)', { after: h }), fToggle(k, 'soldOut', 'Sold out', { after: h })),
          fToggle(k, 'visible', 'Show on site', { defOn: true, after: h })
        ]);
      },
      onOpen: function () { var kp = S.cfg.pages.filter(function (p) { return p.sections.some(function (s) { return s.type === 'kits' && s.filter !== 'featured'; }); })[0]; if (kp) pvGoto(kp.id); },
      empty: 'No kits yet.'
    });
    var addBtn = el('button', { class: 'ab primary small', text: '+ Add drum kit', onclick: function () {
      list.addItem({ id: uid('k'), title: 'NEW KIT', image: '', price: '', oldPrice: '', badge: 'NEW', description: '', buttonText: 'GO TO', link: '', newTab: true, featured: false, soldOut: false, visible: true }, true);
    } });
    add(E, group('Your kits', 'top = first', el('div', { class: 'add-row', style: 'margin:0 0 10px' }, addBtn), list));
    if (S._addKit) { S._addKit = false; addBtn.click(); }
  };

  VIEWS.gallery = function (E) {
    add(E, head('Cover Arts & Edits', 'Your museum. Upload pictures, video files, or paste YouTube links. Clicking any item on the site opens it big.'));
    var catList = listEditor(S.cfg.galleryCategories, {
      key: 'cat', noDup: true,
      title: function (c) { return c.label; }, sub: function (c) { return S.cfg.gallery.filter(function (g) { return g.category === c.id; }).length + ' items'; },
      canDelete: function (c) {
        var n = S.cfg.gallery.filter(function (g) { return g.category === c.id; }).length;
        if (n) { toast('Move or delete the ' + n + ' item(s) in this category first', 'bad', 3500); return false; } return true;
      },
      body: function (c, box, h) { add(box, fText(c, 'label', 'Category name', { after: h })); }
    });
    add(E, group('Categories', 'become tabs on the site', catList, el('div', { class: 'add-row' }, el('button', {
      class: 'ab small', text: '+ Add category', onclick: function () {
        var id = slug('category'), n = 2; while (S.cfg.galleryCategories.some(function (x) { return x.id === id; })) id = 'category-' + (n++);
        catList.addItem({ id: id, label: 'NEW CATEGORY' });
      }
    }))));

    var filterCat = S._galFilter || 'all';
    var fsel = el('select');
    [['all', 'Show all']].concat(S.cfg.galleryCategories.map(function (c) { return [c.id, c.label]; })).forEach(function (o) { fsel.appendChild(el('option', { value: o[0], text: o[1] })); });
    fsel.value = filterCat;
    var items = listEditor(S.cfg.gallery, {
      key: 'gal',
      filter: function (g) { return filterCat === 'all' || g.category === filterCat; },
      title: function (g) { return g.title || '(untitled)'; },
      sub: function (g) { return catLabel(g.category) + (ytId(g.src) ? ' · YouTube' : isVid(g.src) ? ' · video' : '') + (g.visible === false ? ' · hidden' : ''); },
      thumb: function (g) { return thumbFor(g.src, g.thumb); },
      hidden: function (g) { return g.visible === false; },
      body: function (g, c, h) {
        add(c, [
          fImage(g, 'src', 'Picture / video / YouTube link', { media: true, after: h }),
          row(fText(g, 'title', 'Title', { after: h }), fSelect(g, 'category', 'Category', S.cfg.galleryCategories.map(function (x) { return [x.id, x.label]; }), { after: h })),
          fText(g, 'description', 'Description (optional)'),
          fImage(g, 'thumb', 'Thumbnail (optional)', { after: h, help: 'Leave empty to use the picture itself. YouTube thumbnails are automatic.' }),
          row(fLink(g, 'link', 'Extra button link (optional)', { help: 'e.g. Spotify or the full video.' }), fText(g, 'linkText', 'Button text', { ph: 'GO TO' })),
          fToggle(g, 'visible', 'Show on site', { defOn: true, after: h })
        ]);
      },
      onOpen: function () { var gp = S.cfg.pages.filter(function (p) { return p.sections.some(function (s) { return s.type === 'gallery' && s.showTabs; }); })[0]; if (gp) pvGoto(gp.id); },
      empty: 'Nothing in this category yet.'
    });
    fsel.addEventListener('change', function () { filterCat = S._galFilter = fsel.value; items.rerender(); });
    function defaultCat() { return filterCat !== 'all' ? filterCat : (S.cfg.galleryCategories[0] ? S.cfg.galleryCategories[0].id : ''); }
    var addOne = el('button', { class: 'ab primary small', text: '+ Add item', onclick: function () {
      items.addItem({ id: uid('g'), category: defaultCat(), type: 'image', src: '', thumb: '', title: '', description: '', link: '', visible: true }, true);
    } });
    var bulk = el('button', { class: 'ab small', text: '⬆ Upload many at once', onclick: function () {
      pickFiles('image/*,video/mp4,video/webm,video/quicktime', true).then(function (files) {
        if (!files.length) return;
        toast('Adding ' + files.length + ' file(s)…');
        var seq = Promise.resolve(), n = 0;
        files.forEach(function (f) {
          seq = seq.then(function () { return uploadFile(f, true).then(function (p) {
            if (!p) return;
            n++; S.cfg.gallery.unshift({ id: uid('g'), category: defaultCat(), type: 'image', src: p, thumb: '', title: String(f.name).replace(/\.[^.]+$/, ''), description: '', link: '', visible: true });
          }); });
        });
        seq.then(function () { changed(); items.rerender(); toast(n + ' added ✦', 'ok'); });
      });
    } });
    add(E, group('Items', 'top = first', el('div', { class: 'add-row', style: 'margin:0 0 10px' }, addOne, bulk, fsel), items));
    if (S._addGal) { S._addGal = false; addOne.click(); }
  };

  VIEWS.intro = function (E) {
    var it = S.cfg.intro;
    add(E, head('Intro Page', 'The splash screen people see first, with your logo and an enter button.'));
    add(E, el('div', { class: 'add-row', style: 'margin-bottom:14px' }, el('button', { class: 'ab primary', text: '▶ Play intro in preview', onclick: playIntro })));
    add(E, group('Intro', null,
      fToggle(it, 'enabled', 'Show the intro page', { help: 'Turn off to go straight to the homepage.' }),
      fImage(it, 'logo', 'Logo'),
      fRange(it, 'logoSize', 'Logo size', { min: 150, max: 1000, step: 10, def: 520, suffix: 'px' }),
      row(fText(it, 'title', 'Title (optional)'), fText(it, 'subtitle', 'Small text under the logo')),
      fText(it, 'buttonText', 'Enter button text', { ph: '✦ ENTER' })));
    add(E, group('Intro animations', null,
      row(fSelect(it, 'logoAnimation', 'Logo animation', [['float', 'Float'], ['pulse', 'Pulse'], ['bounce', 'Bounce'], ['spin', '3D spin'], ['glitch', 'Glitch'], ['holo', 'Rainbow shift'], ['none', 'None']]),
        fSelect(it, 'exitAnimation', 'When entering', [['zoom', 'Zoom through'], ['fade', 'Fade'], ['slide', 'Slide up'], ['blur', 'Blur away'], ['none', 'Instant']])),
      fToggle(it, 'showSparkleBurst', 'Sparkle explosion when you click enter', { defOn: true }),
      row(fToggle(it, 'oncePerSession', 'Only show once per visit', { help: 'Visitors won’t see it again when they come back to the homepage in the same visit.' }),
        fNum(it, 'autoEnterSeconds', 'Auto-enter after (seconds, 0 = never)', { min: 0, max: 60 }))));
  };

  VIEWS.brand = function (E) {
    var b = S.cfg.brand, m = S.cfg.meta;
    add(E, head('Logo & Site Info'));
    add(E, group('Logo', null, fText(b, 'name', 'Artist name'), fImage(b, 'logo', 'Main logo (top-left of the site & footer)', { help: 'A PNG with a transparent background looks best.' }),
      fRange(b, 'headerLogoSize', 'Logo size in the menu bar', { min: 30, max: 130, def: 72, suffix: 'px' })));
    add(E, group('Google & sharing', 'what shows in search results and link previews', fText(m, 'title', 'Browser tab title'), fText(m, 'description', 'Description', { multi: true, rows: 2 }),
      row(fImage(m, 'favicon', 'Tab icon (square)'), fImage(m, 'shareImage', 'Share image (1200×630)')),
      el('div', { class: 'note', html: 'Heads-up: link previews on Instagram/Discord use the tags in <code>index.html</code>. The tab title and description above update for visitors right away.' })));
  };

  VIEWS.header = function (E) {
    var h = S.cfg.header, f = S.cfg.footer;
    add(E, head('Menu, Footer & Socials', 'Menu items come from your pages — reorder them in <b>Pages & Layout</b>.'));
    add(E, group('Top menu bar', null,
      row(fSelect(h, 'style', 'Look', [['glass', 'Frosted glass'], ['solid', 'Solid'], ['transparent', 'Transparent']], { def: 'glass' }), el('div', null, fToggle(h, 'sticky', 'Stays at the top when scrolling', { defOn: true }), fToggle(h, 'showSocials', 'Show social icons', { defOn: true }))),
      row(fText(h, 'ctaText', 'Right-side button text (empty = no button)'), fLink(h, 'ctaLink', 'Button goes to', { help: ' ' }))));
    var socials = listEditor(S.cfg.socials, {
      key: 'soc',
      title: function (s) { return (s.platform || 'link').toUpperCase(); },
      sub: function (s) { return s.url || 'empty — hidden on the site'; },
      body: function (s, c, hd) {
        add(c, [row(fSelect(s, 'platform', 'Icon', SOCIALS, { after: hd }), fText(s, 'label', 'Label (optional)')),
          fLink(s, 'url', 'Link', { after: hd, help: 'For email just type your address.' })]);
      }
    });
    S.cfg.socials.forEach(function (s) { if (!s.id) s.id = uid('so'); });
    add(E, group('Social links', 'icons with no link are hidden', socials, el('div', { class: 'add-row' }, el('button', { class: 'ab small', text: '+ Add social', onclick: function () { socials.addItem({ id: uid('so'), platform: 'instagram', url: '' }); } }))));
    add(E, group('Footer', null, fText(f, 'text', 'Footer text'), fToggle(f, 'showLogo', 'Show logo', { defOn: true }), fToggle(f, 'showSocials', 'Show social icons', { defOn: true })));
  };

  var PRESETS = [
    { name: 'Cotton Candy', theme: { primary: '#ff2bc2', secondary: '#8a3cff', accent: '#38c8ff', highlight: '#fff27a', text: '#1c0b33', muted: '#7a5a9a', surface: '#ffffff', surfaceOpacity: 0.62 }, bg: { skyTop: '#fbe3f6', skyMid: '#e9ecff', skyBottom: '#ffe9f7' } },
    { name: 'Midnight Holo', theme: { primary: '#ff4fd8', secondary: '#9b5cff', accent: '#3de3ff', highlight: '#fff27a', text: '#f7ecff', muted: '#c9b3e8', surface: '#1d1035', surfaceOpacity: 0.6 }, bg: { skyTop: '#140a2b', skyMid: '#2a1557', skyBottom: '#3b1747' } },
    { name: 'Mint Dream', theme: { primary: '#14c39a', secondary: '#7a5cff', accent: '#ffb84d', highlight: '#fff27a', text: '#10243a', muted: '#5b7488', surface: '#ffffff', surfaceOpacity: 0.65 }, bg: { skyTop: '#e3fff4', skyMid: '#eef3ff', skyBottom: '#f3fff9' } },
    { name: 'Peach Pop', theme: { primary: '#ff5f7e', secondary: '#ff8a3d', accent: '#7b6cff', highlight: '#fff27a', text: '#2b1020', muted: '#8a6070', surface: '#ffffff', surfaceOpacity: 0.65 }, bg: { skyTop: '#fff0e6', skyMid: '#ffe8f1', skyBottom: '#fff6df' } },
    { name: 'Y2K Chrome', theme: { primary: '#4d7cff', secondary: '#b04dff', accent: '#00d9ff', highlight: '#e8ff5a', text: '#0e1240', muted: '#5d6390', surface: '#ffffff', surfaceOpacity: 0.55 }, bg: { skyTop: '#eef2ff', skyMid: '#f6eaff', skyBottom: '#e8fbff' } }
  ];
  VIEWS.theme = function (E) {
    var t = S.cfg.theme;
    add(E, head('Colors & Fonts'));
    add(E, group('Quick themes', 'one click, then fine-tune below', el('div', { class: 'preset-grid' }, PRESETS.map(function (p) {
      return el('button', { class: 'preset', type: 'button', onclick: function () { Object.assign(S.cfg.theme, p.theme); Object.assign(S.cfg.background, p.bg); changed(); renderTab(); toast('Applied ' + p.name); } },
        el('div', { class: 'sw4' }, [p.bg.skyTop, p.theme.primary, p.theme.secondary, p.theme.accent].map(function (c) { return el('span', { style: 'background:' + c }); })), el('b', { text: p.name }));
    }))));
    add(E, group('Colors', null, row(fColor(t, 'primary', 'Main (pink)'), fColor(t, 'secondary', 'Second (purple)'), fColor(t, 'accent', 'Accent (blue)')),
      row(fColor(t, 'highlight', 'Sparkle ✦ colour'), fColor(t, 'text', 'Text'), fColor(t, 'muted', 'Soft text')),
      row(fColor(t, 'surface', 'Cards / boxes'), fRange(t, 'surfaceOpacity', 'Card see-through', { min: 0, max: 1, step: 0.01, def: 0.62, fmt: function (v) { return Math.round((1 - v) * 100) + '%'; } }))));
    add(E, group('Fonts', 'from Google Fonts', row(fSelect(t, 'headingFont', 'Titles & menu', FONTS), fSelect(t, 'bodyFont', 'Normal text', FONTS), fSelect(t, 'uiFont', 'Small labels', FONTS)),
      row(fSelect(t, 'headingWeight', 'Title thickness', [[400, 'Regular'], [700, 'Bold'], [900, 'Extra bold']], { num: true, def: 900 }),
        el('div', null, fToggle(t, 'uppercaseHeadings', 'ALL CAPS titles', { defOn: true }), fToggle(t, 'headingItalic', 'Italic titles')))));
    add(E, group('Shapes', null, row(fSelect(t, 'buttonStyle', 'Buttons', [['chunky', 'Chunky 3D pill'], ['pill', 'Glowy pill'], ['square', 'Rounded square'], ['outline', 'Outline'], ['pixel', 'Pixel']]),
      fSelect(t, 'cardStyle', 'Cards', [['glass', 'Frosted glass'], ['holo', 'Holographic border'], ['solid', 'Solid'], ['outline', 'Outline']])),
      row(fRange(t, 'radius', 'Corner roundness', { min: 0, max: 40, def: 22, suffix: 'px' }), fRange(t, 'contentWidth', 'Page width', { min: 800, max: 1600, step: 10, def: 1180, suffix: 'px' }))));
  };

  VIEWS.background = function (E) {
    var b = S.cfg.background;
    add(E, head('Background', 'The animated pixel sky is drawn live in the browser — no big image to load.'));
    add(E, group('Type', null, fSelect(b, 'type', 'Background', [['pixel-sky', 'Animated pixel sky (clouds, rainbow…)'], ['gradient', 'Simple gradient'], ['image', 'Your own image']], { after: function () { renderTab(); } })));
    add(E, group('Sky colours', null, row(fColor(b, 'skyTop', 'Top'), fColor(b, 'skyMid', 'Middle'), fColor(b, 'skyBottom', 'Bottom'))));
    if (b.type === 'pixel-sky') add(E, group('Pixel sky', null,
      fRange(b, 'pixelSize', 'Pixel size', { min: 2, max: 8, def: 4, suffix: 'px', help: 'Bigger = chunkier retro pixels.' }),
      row(el('div', null, fToggle(b, 'clouds', 'Clouds', { defOn: true }), fToggle(b, 'rainbow', 'Rainbow', { defOn: true }), fToggle(b, 'sprouts', 'Little sprouts', { defOn: true })),
        el('div', null, fToggle(b, 'rays', 'Light rays', { defOn: true }), fToggle(b, 'sparkles', 'Twinkling sparkles', { defOn: true }), fToggle(b, 'bubbles', 'Bubbles & falling petals', { defOn: true })))));
    else add(E, group('Extras', null, fToggle(b, 'sparkles', 'Twinkling sparkles', { defOn: true }), fToggle(b, 'bubbles', 'Bubbles & falling petals', { defOn: true })));
    if (b.type === 'image') add(E, group('Your image', null, fImage(b, 'image', 'Background image'),
      fSelect(b, 'imageFit', 'Fit', [['cover', 'Fill the screen'], ['contain', 'Fit inside'], ['tile', 'Repeat (tile)']], { def: 'cover' })));
    add(E, group('Tint', 'softens busy backgrounds', row(fColor(b, 'overlayColor', 'Tint colour', { def: '#ffffff' }), fRange(b, 'overlayOpacity', 'Tint strength', { min: 0, max: 0.9, step: 0.01, def: 0, fmt: function (v) { return Math.round(v * 100) + '%'; } }))));
  };

  VIEWS.animations = function (E) {
    var a = S.cfg.animations;
    add(E, head('Animations', 'Tweak everything that moves. Use <b>✦ Replay</b> at the top to see entrance animations again.'));
    add(E, el('div', { class: 'add-row', style: 'margin-bottom:14px' }, el('button', { class: 'ab primary', text: '✦ Replay animations', onclick: replay }), el('button', { class: 'ab', text: '▶ Play intro', onclick: playIntro })));
    add(E, group('Master', null, fToggle(a, 'enabled', 'Animations on', { defOn: true, help: 'Turn off for a completely still site.' }),
      fRange(a, 'speed', 'Overall speed', { min: 0.3, max: 2.5, step: 0.05, def: 1, fmt: function (v) { return v.toFixed(2); }, suffix: '×' })));
    add(E, group('When things appear', 'as you scroll', row(fSelect(a, 'entrance', 'Entrance style', [['fade-up', 'Fade up'], ['fade', 'Fade'], ['zoom', 'Zoom in'], ['pop', 'Pop (bouncy)'], ['slide', 'Slide in'], ['flip', 'Flip'], ['blur', 'Blur in'], ['none', 'None']], { after: function () { setTimeout(replay, 150); } }),
      fRange(a, 'stagger', 'Delay between items', { min: 0, max: 300, step: 10, def: 90, suffix: 'ms' })),
      fSelect(a, 'pageTransition', 'Changing pages', [['fade', 'Fade'], ['slide', 'Slide'], ['zoom', 'Zoom'], ['none', 'None']])));
    add(E, group('Hover effects', null, row(fSelect(a, 'cardHover', 'Kit cards', [['tilt', '3D tilt'], ['lift', 'Lift up'], ['grow', 'Grow'], ['glow', 'Glow'], ['none', 'None']]),
      fSelect(a, 'buttonHover', 'Buttons', [['bounce', 'Bounce'], ['wiggle', 'Wiggle'], ['glow', 'Glow'], ['grow', 'Grow'], ['shine', 'Shine sweep'], ['none', 'None']]))));
    add(E, group('Logo', null, fToggle(a, 'logoFloat', 'Floating logo', { defOn: true }), fToggle(a, 'logoGlow', 'Glow around logo', { defOn: true })));
    add(E, group('Sparkles & sky', null, fToggle(a, 'cursorTrail', 'Sparkle trail following the mouse', { defOn: true }),
      fSelect(a, 'cursorTrailColor', 'Trail colour', [['rainbow', 'Rainbow'], ['theme', 'My theme colours'], ['#ffffff', 'White'], ['#ff2bc2', 'Pink'], ['#38c8ff', 'Blue'], ['#fff27a', 'Gold']]),
      row(fRange(a, 'cloudSpeed', 'Cloud speed', { min: 0, max: 4, step: 0.1, def: 1, suffix: '×' }), fRange(a, 'sparkleAmount', 'Amount of sparkles', { min: 0, max: 3, step: 0.1, def: 1, suffix: '×' })),
      fRange(a, 'marqueeSpeed', 'Scrolling text speed', { min: 0.2, max: 4, step: 0.1, def: 1, suffix: '×' })));
  };

  VIEWS.publish = function (E) {
    var c = ghCfg();
    add(E, head('Publish & Settings'));
    var owner = el('input', { type: 'text', placeholder: 'your GitHub username', spellcheck: 'false' }); owner.value = c.owner || '';
    var repo = el('input', { type: 'text', placeholder: 'repo name, e.g. sul-site', spellcheck: 'false' }); repo.value = c.repo || '';
    var branch = el('input', { type: 'text', spellcheck: 'false' }); branch.value = c.branch || 'main';
    var token = el('input', { type: 'password', placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false' }); token.value = c.token || '';
    var result = el('div');
    function readForm() {
      var ov = String(owner.value).trim().replace(/^https?:\/\/github\.com\//i, ''), rv = String(repo.value).trim();
      // allow pasting "owner/repo" or a full GitHub URL into either box
      var m = (ov + (rv ? '/' + rv : '')).match(/^([^\/\s]+)\/([^\/\s#?]+)/);
      if (m) { ov = m[1]; rv = m[2].replace(/\.git$/, ''); }
      return { owner: ov, repo: rv, branch: String(branch.value).trim() || 'main', token: String(token.value).trim(), path: c.path || 'content/site.json' };
    }
    var test = el('button', { class: 'ab primary', type: 'button', text: 'Save & test connection', onclick: function () {
      var f = readForm(); owner.value = f.owner; repo.value = f.repo;
      if (!f.owner || !f.repo || !f.token) { result.innerHTML = ''; add(result, el('div', { class: 'note bad', text: 'Fill in username, repo and token.' })); return; }
      result.innerHTML = ''; add(result, el('div', { class: 'note', text: 'Testing…' }));
      saveGh(f).then(function () { return gh('GET', ''); }).then(function (r) {
        if (!r.permissions || !r.permissions.push) throw Object.assign(new Error('no push'), { status: 403 });
        return gh('GET', '/git/ref/heads/' + encodeURIComponent(f.branch));
      }).then(function () {
        result.innerHTML = ''; add(result, el('div', { class: 'note ok', html: '<b>Connected ✦</b> You can publish from this device.' })); updateStatus();
      }).catch(function (e) { result.innerHTML = ''; add(result, el('div', { class: 'note bad', text: ghErrorText(e) })); updateStatus(); });
    } });
    add(E, group('GitHub connection', 'needed to publish', el('div', { class: 'note', html:
      '<b>One-time setup on each device:</b><ol class="steps">' +
      '<li>On GitHub go to <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.</li>' +
      '<li>Repository access: <b>Only select repositories</b> → pick your site repo.</li>' +
      '<li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Generate, then copy the token.</li>' +
      '<li>Paste it below with your username + repo name and press <b>Save & test</b>.</li></ol>' +
      'The token is saved only in this browser, locked with your admin password. Never share it.' }),
      row(field('GitHub username', null, owner), field('Repository', null, repo), field('Branch', 'usually main', branch)),
      field('Access token', null, token),
      el('div', { class: 'add-row' }, test, el('button', { class: 'ab danger', type: 'button', text: 'Forget token', onclick: function () { var m = ghMeta(); delete m.tok; delete m.token; lsSet(LS.gh, JSON.stringify(m)); S.token = ''; token.value = ''; updateStatus(); toast('Token removed from this device'); } })),
      result));

    add(E, accessCard());

    var last = lsGet(LS.lastPub);
    add(E, group('Publish', null,
      el('div', { class: 'note ' + (dirty() ? 'warn' : 'ok'), text: dirty() ? 'You have unpublished changes.' : 'Nothing new to publish.' + (last ? ' Last published ' + new Date(Number(last)).toLocaleString() + '.' : '') }),
      el('div', { class: 'add-row' }, el('button', { class: 'ab primary', text: '🚀 Publish now', onclick: publish }))));

    var imp = el('button', { class: 'ab', text: '⬇ Import backup', onclick: function () {
      pickFiles('.json,application/json').then(function (files) {
        if (!files.length) return;
        files[0].text().then(function (t) {
          var data; try { data = JSON.parse(t); } catch (e) { return toast('That file isn’t a valid backup', 'bad'); }
          if (!data || !Array.isArray(data.pages)) return toast('That file isn’t a site backup', 'bad');
          flushHistory(); S.history.push(json(S.cfg)); var lk = S.cfg.admin; S.cfg = normalize(data); if (lk) S.cfg.admin = lk; S.snap = json(S.cfg); snapshotPageIds();
          afterJump(); toast('Backup loaded — Publish to make it live', 'ok', 4000);
        });
      });
    } });
    add(E, group('Backups & offline', null,
      el('div', { class: 'add-row' },
        el('button', { class: 'ab', text: '⬆ Download backup (.json)', onclick: function () { download('sul-site-backup-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(S.cfg, null, 2)], { type: 'application/json' })); } }),
        imp,
        el('button', { class: 'ab', text: '📦 Download update as .zip', onclick: downloadZip })),
      el('div', { class: 'help', html: 'No GitHub token on this device? Download the .zip and upload its contents to your repo on github.com (<b>Add file → Upload files</b>, drag the <code>content</code> and <code>uploads</code> folders in).' })));
    add(E, group('Start over', null, el('div', { class: 'add-row' }, el('button', { class: 'ab danger', text: 'Discard draft & load the live version', onclick: function () {
      confirmBox('Discard all unpublished changes?', 'Your draft in this browser will be replaced with what’s currently live.', 'Discard', true).then(function (ok) {
        if (!ok) return; lsDel(LS.draft); var lk = S.cfg.admin; S.cfg = normalize(JSON.parse(S.published)); if (lk) S.cfg.admin = lk; S.history = []; S.future = []; S.snap = json(S.cfg); snapshotPageIds(); afterJump(); toast('Back to the live version');
      });
    } }))));
  };

  /* ================= password gate ================= */
  function failState() { try { return JSON.parse(localStorage.getItem('sul.fails') || '{"n":0,"until":0}'); } catch (e) { return { n: 0, until: 0 }; } }
  function setFails(f) { lsSet('sul.fails', JSON.stringify(f)); }
  function gate(lock) {
    return new Promise(function (resolve) {
      var g = $('#gate'), create = !validLock(lock);
      function finish(key, saltB64, newLock) {
        S.key = key; S.lockSalt = saltB64; S.newLock = newLock || null;
        setFails({ n: 0, until: 0 });
        rememberSessionKey(key, saltB64).then(function () {
          document.body.classList.remove('locked'); g.hidden = true; g.innerHTML = '';
          resolve();
        });
      }
      function tryKey(key) { return decObj(key, lock).then(function (d) { S.lockData = d; return true; }).catch(function () { return false; }); }
      function show() {
        g.innerHTML = ''; g.hidden = false;
        var pw = el('input', { type: 'password', id: 'gate-pw', autocomplete: create ? 'new-password' : 'current-password', placeholder: create ? 'New password' : 'Password' });
        var pw2 = create ? el('input', { type: 'password', id: 'gate-pw2', autocomplete: 'new-password', placeholder: 'Type it again' }) : null;
        var msg = el('div', { class: 'gate-msg' });
        var btn = el('button', { class: 'ab primary gate-btn', type: 'submit', text: create ? 'Create password & enter' : 'Unlock' });
        var form = el('form', { class: 'gate-box', autocomplete: 'on' },
          el('img', { src: ROOT + 'assets/img/logo.png', alt: '', class: 'gate-logo' }),
          el('h1', { text: create ? 'Set your admin password' : 'SUL STUDIO' }),
          el('p', { class: 'gate-sub', text: create ? 'Pick a strong password (at least 10 characters). You’ll need it every time you open the admin panel.' : 'Enter your password to edit your site.' }),
          el('input', { type: 'text', name: 'username', autocomplete: 'username', value: 'sul-admin', hidden: true }),
          pw, pw2, btn, msg);
        g.appendChild(form);
        setTimeout(function () { pw.focus(); }, 30);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var f = failState();
          if (f.until > Date.now()) { msg.textContent = 'Too many tries — wait ' + Math.ceil((f.until - Date.now()) / 1000) + 's.'; return; }
          var v = pw.value;
          if (create) {
            if (v.length < 10) { msg.textContent = 'Use at least 10 characters.'; return; }
            if (v !== pw2.value) { msg.textContent = 'The two passwords don’t match.'; return; }
          } else if (!v) return;
          btn.disabled = true; msg.textContent = create ? 'Setting up…' : 'Checking…';
          if (create) {
            var salt = crypto.getRandomValues(new Uint8Array(16)), sb = b64(salt);
            deriveKey(v, salt, ITER).then(function (key) { return makeLock(key, sb).then(function (l) { finish(key, sb, l); }); });
          } else {
            deriveKey(v, unb64(lock.salt), lock.iter).then(function (key) {
              return tryKey(key).then(function (ok) {
                if (ok) return finish(key, lock.salt);
                var f2 = failState(); f2.n++; if (f2.n >= 5) f2.until = Date.now() + Math.min(900, 30 * Math.pow(2, f2.n - 5)) * 1000; setFails(f2);
                btn.disabled = false; pw.value = ''; pw.focus();
                form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
                msg.textContent = 'Wrong password.';
              });
            });
          }
        });
      }
      document.body.classList.add('locked');
      if (create) return show();
      sessionKeyFor(lock.salt).then(function (key) {
        if (!key) return show();
        tryKey(key).then(function (ok) { if (ok) finish(key, lock.salt); else show(); });
      });
    });
  }
  function lockNow() { try { sessionStorage.removeItem('sul.adminKey'); } catch (e) {} S.key = null; S.token = ''; location.reload(); }

  function accessCard() {
    if (!S.cfg.adminEntry || typeof S.cfg.adminEntry !== 'object') S.cfg.adminEntry = { taps: 5, word: '' };
    var en = S.cfg.adminEntry;
    var url = location.origin + adminPath();
    var cur = el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Current password' });
    var nw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'New password (10+ characters)' });
    var nw2 = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'New password again' });
    var res = el('div');
    var change = el('button', { class: 'ab primary', type: 'button', text: 'Change password', onclick: function () {
      var lock = S.cfg.admin; res.innerHTML = '';
      var bad = function (t) { res.innerHTML = ''; add(res, el('div', { class: 'note bad', text: t })); change.disabled = false; };
      if (nw.value.length < 10) return bad('New password needs at least 10 characters.');
      if (nw.value !== nw2.value) return bad('The new passwords don’t match.');
      change.disabled = true;
      deriveKey(cur.value, unb64(lock.salt), lock.iter).then(function (k) { return decObj(k, lock); }).then(function () {
        var salt = crypto.getRandomValues(new Uint8Array(16)), sb = b64(salt);
        return deriveKey(nw.value, salt, ITER).then(function (key) {
          return makeLock(key, sb).then(function (l) {
            S.key = key; S.lockSalt = sb; S.cfg.admin = l; changed();
            return Promise.all([rememberSessionKey(key, sb), saveGh(Object.assign(ghCfg(), { token: S.token }))]);
          });
        });
      }).then(function () {
        cur.value = nw.value = nw2.value = ''; change.disabled = false;
        res.innerHTML = ''; add(res, el('div', { class: 'note ok', html: '<b>Password changed.</b> Press 🚀 Publish so it applies on every device.' }));
      }).catch(function () { bad('Current password is wrong.'); });
    } });
    return group('Admin access & password', null,
      el('div', { class: 'note', html: '<b>Your secret admin address:</b><br><code style="word-break:break-all">' + escHtml(url) + '</code><br>Bookmark it. Nothing on your site links here.' }),
      el('div', { class: 'add-row', style: 'margin:-4px 0 14px' },
        el('button', { class: 'ab small', type: 'button', text: '⧉ Copy address', onclick: function () { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Copied'); }, function () { toast(url); }); } }),
        el('button', { class: 'ab small', type: 'button', text: '🔒 Lock now', onclick: lockNow })),
      el('h3', { text: 'Secret way in from your site', style: 'font-size:14px;margin:6px 0 10px' }),
      row(fSelect(en, 'taps', 'Tap the logo this many times fast', [[0, 'Off'], [3, '3 taps'], [5, '5 taps'], [7, '7 taps'], [10, '10 taps']], { num: true, def: 5 }),
        fText(en, 'word', 'Or type this secret word on the site', { ph: 'e.g. sulstudio', nospell: true, transform: function (v) { return String(v).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24); } })),
      el('div', { class: 'help', html: 'On your site, tap/click the logo (top-left or in the footer) quickly, or type the word anywhere on a computer. A password box pops up and takes you here. Changes apply after you Publish.' }),
      el('h3', { text: 'Change password', style: 'font-size:14px;margin:18px 0 10px' }),
      field(null, null, cur), row(field(null, null, nw), field(null, null, nw2)),
      el('div', { class: 'add-row' }, change), res);
  }

  function renderTab() {
    var E = $('#editor'); var top = E.scrollTop; E.innerHTML = '';
    var dl = el('datalist', { id: 'dl-pages' }); E.appendChild(dl);
    (VIEWS[S.tab] || VIEWS.start)(E);
    E.scrollTop = top;
    fillPageSelect();
  }

  /* ================= actions ================= */
  function playIntro() { if (window.innerWidth <= 1180) document.body.classList.add('show-preview'); pvPost({ type: 'sul:intro' }); }
  function replay() { if (window.innerWidth <= 1180) document.body.classList.add('show-preview'); sendPreview(true); }

  function collectFiles() {
    var files = [{ path: ghCfg().path, b64: utf8ToB64(JSON.stringify(S.cfg, null, 2) + '\n') }];
    pendingPaths().forEach(function (p) { if (S.assets[p]) files.push({ path: p, b64: dataUrlB64(S.assets[p]) }); });
    return files;
  }
  function publish() {
    var c = ghCfg();
    if (!c.ok) {
      modal(function (b, close) {
        add(b, [el('h2', { text: 'Connect GitHub first' }), el('p', { html: 'To publish from this device, add your GitHub token in <b>🚀 Publish & Settings</b>. Or download the update as a .zip and upload it to your repo yourself.' }),
          el('div', { class: 'acts' }, el('button', { class: 'ab', text: '📦 Download .zip', onclick: function () { close(); downloadZip(); } }),
            el('button', { class: 'ab primary', text: 'Open settings', onclick: function () { close(); S.tab = 'publish'; renderSide(); renderTab(); } }))]);
      });
      return;
    }
    flushHistory();
    var issues = lint();
    modal(function (b, close) {
      var bar = el('div'), msg = el('p', { text: issues.length ? 'Quick check found a few things (you can still publish):' : 'Everything looks good ✦' });
      var go = el('button', { class: 'ab primary', text: '🚀 Publish', onclick: run });
      var cancel = el('button', { class: 'ab', text: 'Cancel', onclick: close });
      add(b, [el('h2', { text: 'Publish your site' }), msg,
        issues.length ? el('ul', { class: 'steps' }, issues.slice(0, 10).map(function (x) { return el('li', { text: x }); })) : null,
        el('div', { class: 'progress', hidden: true }, bar), el('div', { class: 'acts' }, cancel, go)]);
      function run() {
        go.disabled = true; cancel.disabled = true; bar.parentElement.hidden = false;
        var files = collectFiles(), paths = files.map(function (f) { return f.path; });
        var progress = function (p, t) { bar.style.width = p + '%'; msg.textContent = t; };
        var attempt = function (n) {
          return publishCommit(files, 'Update site from admin (' + new Date().toLocaleString() + ')', progress).catch(function (e) {
            if (n < 1 && (e.status === 409 || e.status === 422)) return attempt(n + 1);
            throw e;
          });
        };
        attempt(0).then(function () {
          progress(100, 'Done!');
          S.published = json(S.cfg);
          paths.forEach(function (p) { if (pendingMeta[p]) { pendingMeta[p].committed = true; idbPut(p, { data: S.assets[p], committed: true, t: Date.now() }); } });
          lsSet(LS.lastPub, String(Date.now()));
          updateStatus();
          b.innerHTML = '';
          add(b, [el('h2', { text: 'Published ✦' }), el('p', { html: 'Your host is rebuilding the site now — it’s usually live in <b>about a minute</b>. Refresh your site after that (new pictures may take a moment longer).' }),
            el('div', { class: 'acts' }, el('a', { class: 'ab', href: ROOT, target: '_blank', rel: 'noopener', text: '↗ Open site' }), el('button', { class: 'ab primary', text: 'Nice', onclick: function () { close(); if (S.tab === 'publish' || S.tab === 'start') renderTab(); } }))]);
        }).catch(function (e) {
          msg.textContent = ghErrorText(e); msg.style.color = 'var(--bad)';
          go.disabled = false; cancel.disabled = false; go.textContent = 'Try again'; bar.parentElement.hidden = true;
        });
      }
    });
  }

  /* minimal zip writer (store, no compression) */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    var parts = [], central = [], off = 0, enc = new TextEncoder();
    files.forEach(function (f) {
      var name = enc.encode(f.path), data = f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, 0, true); cd.setUint16(14, 0x21, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, off, true);
      central.push(new Uint8Array(cd.buffer), name);
      off += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  function downloadZip() {
    var files = [{ path: ghCfg().path, data: new TextEncoder().encode(JSON.stringify(S.cfg, null, 2) + '\n') }];
    var txt = json(S.cfg);
    Object.keys(S.assets).forEach(function (p) { if (txt.indexOf(JSON.stringify(p).slice(1, -1)) >= 0) files.push({ path: p, data: dataUrlBytes(S.assets[p]) }); });
    download('sul-site-update.zip', makeZip(files));
    toast('Downloaded — upload the folders inside to your repo', 'ok', 4000);
  }

  /* ================= boot ================= */
  function fetchSiteCopy() {
    return fetch(ROOT + 'content/site.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  var draft = null;
  function boot() {
    if (!window.crypto || !crypto.subtle) {
      document.body.innerHTML = '<p style="padding:30px;font-family:sans-serif">The admin panel needs a secure (https) connection.</p>';
      return;
    }
    pv = $('#pv');
    S.tab = lsGet(LS.tab) || 'start';
    S.pageSel = lsGet(LS.page) || '';
    idbAll().then(function (all) {
      var dayAgo = Date.now() - 36 * 3600 * 1000;
      Object.keys(all || {}).forEach(function (p) {
        var r = all[p]; if (!r || !r.data) return;
        if (r.committed && r.t < dayAgo) { idbDel(p); return; }
        S.assets[p] = r.data; pendingMeta[p] = { committed: !!r.committed, t: r.t };
      });
      return fetchSiteCopy();
    }).then(function (siteCopy) {
      var draftTxt = lsGet(LS.draft);
      try { draft = draftTxt ? JSON.parse(draftTxt) : null; } catch (e) { draft = null; }
      var a = draft && validLock(draft.admin) ? draft.admin : null, b = validLock(siteCopy.admin) ? siteCopy.admin : null;
      var lock = a && b ? ((a.t || 0) >= (b.t || 0) ? a : b) : (a || b);
      S.siteCopy = siteCopy;
      return gate(lock);
    }).then(function () {
      pv.src = pv.getAttribute('data-src'); // load the preview only after unlocking
      setTimeout(layoutPreview, 50);
      return unlockToken();
    }).then(function () {
      return ghCfg().ok ? ghLoadConfig().catch(function (e) { console.warn(e); toast(ghErrorText(e), 'bad', 5000); return S.siteCopy; }) : S.siteCopy;
    }).then(function (live) {
      live = normalize(live);
      S.published = json(live);
      S.cfg = draft && Array.isArray(draft.pages) ? normalize(draft) : clone(live);
      if (!S.cfg.adminEntry) S.cfg.adminEntry = { taps: 5, word: '' };
      var fixLock = Promise.resolve();
      if (S.newLock) S.cfg.admin = S.newLock;
      else {
        // keep the newest lock and make sure it points at this admin address
        var cur = validLock(S.cfg.admin) && S.cfg.admin.salt === S.lockSalt ? S.cfg.admin : (validLock(live.admin) && live.admin.salt === S.lockSalt ? live.admin : null);
        if (cur) S.cfg.admin = cur;
        if (!cur || !S.lockData || S.lockData.path !== adminPath()) fixLock = makeLock(S.key, S.lockSalt).then(function (l) { S.cfg.admin = l; });
      }
      return fixLock;
    }).then(function () {
      lsSet(LS.draft, json(S.cfg));
      S.snap = json(S.cfg);
      snapshotPageIds();
      S.ready = true;
      renderSide(); renderTab(); updateStatus(); fillPageSelect();
      if (S.newLock) toast('Password set ✦ Press Publish to switch the lock on everywhere', 'ok', 6000);
      else if (draft && json(S.cfg) !== S.published) toast('Restored your unpublished draft ✦', null, 3500);
      sendPreview(true);
    }).catch(function (e) {
      console.error(e);
      $('#editor').innerHTML = '';
      add($('#editor'), el('div', { class: 'note bad', html: '<b>Couldn’t load your site content.</b><br>' + escHtml(e.message) + '<br><br>Open this page through your website (e.g. <code>yoursite.com/your-secret-admin-folder/</code>), not by double-clicking the file.' }));
      $('#status').textContent = 'Error';
    });

    $('#btn-lock').onclick = lockNow;
    $('#btn-undo').onclick = undo; $('#btn-redo').onclick = redo;
    $('#btn-publish').onclick = publish;
    $('#btn-intro').onclick = playIntro; $('#btn-replay').onclick = replay;
    $('#btn-toggle-preview').onclick = function () { document.body.classList.toggle('show-preview'); setTimeout(layoutPreview, 30); };
    $('#device-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-w]'); if (!b) return;
      pvWidth = Number(b.getAttribute('data-w'));
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      layoutPreview();
    });
    $('#pv-page').addEventListener('change', function () { pvGoto(this.value); });
    $('#pv-open').addEventListener('click', function () { lsSet(LS.draft, json(S.cfg)); });
    window.addEventListener('resize', debounce(layoutPreview, 80));
    if (window.ResizeObserver) new ResizeObserver(debounce(layoutPreview, 50)).observe($('#pv-stage'));
    layoutPreview();
    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (!mod || !S.ready) return;
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { if (/^(input|textarea)$/i.test(document.activeElement.tagName) && S.history.length === 0) return; e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
      else if (k === 's') { e.preventDefault(); lsSet(LS.draft, json(S.cfg)); toast('Draft saved ✦ Press Publish to go live'); }
    });
  }
  boot();
})();
