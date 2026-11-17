/* =========================================================
   SUL0557 — FX engine
   - Animated pixel-art sky (clouds, rainbow, sprouts, bubbles,
     sparkles, light rays) drawn on a low-res canvas
   - Sparkle cursor trail + sparkle bursts
   All settings come from site.json -> background / animations.
   ========================================================= */
(function () {
  'use strict';

  var bgCanvas, bgCtx, fxCanvas, fxCtx;
  var cfgBg = {}, cfgAnim = {}, theme = {};
  var W = 0, H = 0, ps = 4;
  var scene = null;
  var rafBg = 0, lastBg = 0, tBg = 0;
  var reduced = false;
  var motionOn = true;

  /* ---------- helpers ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 255, g: 255, b: 255 };
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function mix(a, b, t) {
    return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
  }
  function css(c, a) { return a == null ? 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')' : 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  var WHITE = { r: 255, g: 255, b: 255 };

  /* ---------- sprite builders ---------- */
  // Pixel cloud made of puffs. Shaded light on top, tinted underneath, soft outline.
  function cloudPuffs(w, h, R) {
    // bell-shaped: big puff in the middle, smaller ones toward the ends
    var puffs = [], n = 3 + Math.floor(R() * 3);
    for (var i = 0; i < n; i++) {
      var u = (i + 0.5) / n, bell = Math.sin(u * Math.PI);
      var r = h * (0.26 + 0.34 * bell + R() * 0.08);
      var x = h * 0.3 + u * (w - h * 0.6);
      puffs.push({ x: x, y: h - r - h * 0.04, r: r });
    }
    return puffs;
  }
  function renderCloud(w, h, puffs, base, shade, outline, wrap) {
    var c = mk(w, h), g = c.getContext('2d', { willReadFrequently: true }), img = g.createImageData(c.width, c.height), d = img.data;
    var inside = new Uint8Array(c.width * c.height);
    for (var y = 0; y < c.height; y++) {
      for (var x = 0; x < c.width; x++) {
        var px = x + 0.5, py = y + 0.5, hit = false;
        if (wrap ? py > h * 0.78 : (py > h * 0.72 && py < h * 0.97 && px > puffs[0].x && px < puffs[puffs.length - 1].x)) hit = true;
        for (var i = 0; i < puffs.length && !hit; i++) {
          var p = puffs[i];
          var dx = px - p.x;
          if (wrap) { if (dx > w / 2) dx -= w; if (dx < -w / 2) dx += w; }
          var dy = py - p.y;
          if (dx * dx + dy * dy <= p.r * p.r) hit = true;
        }
        if (hit) inside[y * c.width + x] = 1;
      }
    }
    for (y = 0; y < c.height; y++) {
      for (x = 0; x < c.width; x++) {
        var k = y * c.width + x;
        if (!inside[k]) continue;
        var xl = wrap ? (x - 1 + c.width) % c.width : x - 1, xr = wrap ? (x + 1) % c.width : x + 1;
        var edge = (y === 0 || !inside[k - c.width]) ||
          (xl < 0 || !inside[y * c.width + xl]) || (xr >= c.width || !inside[y * c.width + xr]);
        var t = y / c.height;
        // banded shading (pixel-art look): 3 tones
        var col = t < 0.45 ? base : (t < 0.75 ? mix(base, shade, 0.45) : shade);
        if (edge) col = outline;
        // inner highlight just under top edge
        if (!edge && y > 0 && (y < 2 || !inside[k - 2 * c.width]) && t < 0.5) col = WHITE;
        var o = k * 4;
        d[o] = col.r; d[o + 1] = col.g; d[o + 2] = col.b; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function renderRing(r, col, hi) {
    var s = r * 2 + 3, c = mk(s, s), g = c.getContext('2d'), img = g.createImageData(s, s), d = img.data;
    var cx = s / 2, cy = s / 2;
    for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
      var dist = Math.sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
      var o = (y * s + x) * 4;
      if (Math.abs(dist - r) < 0.6) { d[o] = col.r; d[o + 1] = col.g; d[o + 2] = col.b; d[o + 3] = 230; }
      else if (dist < r - 0.6) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = 40; }
    }
    // highlight pixels
    var hx = Math.round(cx - r * 0.45), hy = Math.round(cy - r * 0.45);
    [[0, 0], [1, 0], [0, 1]].forEach(function (p) {
      var o = ((hy + p[1]) * s + hx + p[0]) * 4;
      if (o >= 0 && o < d.length) { d[o] = hi.r; d[o + 1] = hi.g; d[o + 2] = hi.b; d[o + 3] = 255; }
    });
    g.putImageData(img, 0, 0);
    return c;
  }
  function renderRainbow(radius, band) {
    var cols = ['#ffb3c7', '#ffd5a8', '#fff3a8', '#c6f5b5', '#b3e2ff', '#d4b8ff'];
    var outer = radius, w = outer * 2 + 2, h = outer + 2, c = mk(w, h), g = c.getContext('2d');
    var img = g.createImageData(w, h), d = img.data, cx = w / 2, cy = h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dist = Math.sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
      var idx = Math.floor((outer - dist) / band);
      if (idx >= 0 && idx < cols.length) {
        var col = hexToRgb(cols[idx]), o = (y * w + x) * 4;
        d[o] = col.r; d[o + 1] = col.g; d[o + 2] = col.b; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function renderSprout(R) {
    var c = mk(9, 12), g = c.getContext('2d');
    var stem = '#b8cf73', leaf = '#e4ef9a', dark = '#9db55c';
    g.fillStyle = stem; g.fillRect(4, 4, 1, 8);
    g.fillStyle = leaf;
    g.fillRect(0, 1, 3, 2); g.fillRect(1, 3, 3, 1); g.fillRect(5, 0, 3, 2); g.fillRect(5, 2, 4, 1); g.fillRect(5, 3, 2, 1);
    g.fillStyle = dark; g.fillRect(3, 3, 1, 1); g.fillRect(5, 3, 1, 1);
    if (R() > 0.5) { g.fillStyle = '#ffc2e2'; g.fillRect(7, 6, 2, 2); g.fillStyle = '#ffffff'; g.fillRect(7, 6, 1, 1); }
    return c;
  }

  /* ---------- scene ---------- */
  function buildScene() {
    var R = rng(5577);
    var top = hexToRgb(cfgBg.skyTop || '#fbe3f6');
    var midC = hexToRgb(cfgBg.skyMid || '#e9ecff');
    var bot = hexToRgb(cfgBg.skyBottom || '#ffe9f7');
    var lum = (0.299 * midC.r + 0.587 * midC.g + 0.114 * midC.b) / 255;
    var dark = lum < 0.45;
    // light skies get white fluffy clouds, dark skies get dusky purple ones
    var cloudBase = dark ? mix(midC, WHITE, 0.32) : mix(WHITE, bot, 0.15);
    var cloudShade = dark ? mix(bot, midC, 0.4) : mix(mix(top, midC, 0.5), { r: 230, g: 190, b: 235 }, 0.35);
    var cloudLine = dark ? mix(cloudBase, { r: 255, g: 140, b: 230 }, 0.35) : mix(cloudShade, { r: 240, g: 170, b: 225 }, 0.3);
    var s = { top: top, mid: midC, bot: bot, clouds: [], far: null, near: null, sparkles: [], bubbles: [], petals: [], ringSprites: [], rainbow: null };
    var full = cfgBg.type === 'pixel-sky';

    if (full) {
      // floating clouds
      var nClouds = Math.max(4, Math.round(W / 70));
      for (var i = 0; i < nClouds; i++) {
        var cw = Math.round(30 + R() * 60), ch = Math.round(cw * (0.38 + R() * 0.12));
        var pf = cloudPuffs(cw, ch, R);
        s.clouds.push({
          spr: renderCloud(cw, ch, pf, cloudBase, cloudShade, cloudLine, false),
          x: R() * (W + cw) - cw, y: H * (0.06 + R() * 0.55), v: 0.6 + R() * 1.4, a: 0.55 + R() * 0.4
        });
      }
      // far + near cloud banks (seamless horizontal strips)
      var stripW = Math.max(W, 360);
      function bank(h, density, base, shade, line, seed) {
        var RR = rng(seed), puffs = [], x = 0;
        while (x < stripW) { var r = h * (0.25 + RR() * 0.35); puffs.push({ x: x, y: h * (0.45 + RR() * 0.3), r: r }); x += r * (0.9 + RR() * density); }
        return renderCloud(stripW, h, puffs, base, shade, line, true);
      }
      var farH = Math.round(H * 0.42);
      s.far = { spr: bank(farH, 0.6, mix(cloudBase, midC, 0.35), mix(cloudShade, midC, 0.3), mix(cloudLine, midC, 0.4), 11), y: H - farH - Math.round(H * 0.14), x: 0, v: 0.6 };
      var nearH = Math.round(H * 0.32);
      var near = bank(nearH, 0.5, cloudBase, cloudShade, cloudLine, 22);
      // sprouts sitting on the near bank
      if (cfgBg.sprouts !== false) {
        var ng = near.getContext('2d'), nSp = Math.round(stripW / 22);
        for (var k = 0; k < nSp; k++) {
          var sx = Math.floor(R() * (stripW - 10));
          // find top of the cloud at sx
          var data = ng.getImageData(sx + 4, 0, 1, nearH).data, ty = nearH;
          for (var yy = 0; yy < nearH; yy++) if (data[yy * 4 + 3] > 0) { ty = yy; break; }
          var depth = Math.floor(R() * nearH * 0.55);
          ng.drawImage(renderSprout(R), sx, Math.min(nearH - 12, ty + depth - 9));
        }
      }
      s.near = { spr: near, y: H - nearH + Math.round(H * 0.04), x: 0, v: 1.3 };
      if (cfgBg.rainbow !== false) {
        var rr = Math.round(Math.min(W, H) * 0.32);
        s.rainbow = { spr: renderRainbow(rr, Math.max(2, Math.round(rr / 22))), x: Math.round(W * 0.45 - rr), y: Math.round(H * 0.86 - rr) };
      }
    }
    // sparkles
    var amt = Math.max(0, Number(cfgAnim.sparkleAmount == null ? 1 : cfgAnim.sparkleAmount));
    if (cfgBg.sparkles !== false) {
      var nS = Math.round((W * H) / 2600 * amt);
      for (i = 0; i < nS; i++) s.sparkles.push({ x: Math.floor(R() * W), y: Math.floor(R() * H * 0.85), ph: R() * 6.28, sp: 0.6 + R() * 1.6, big: R() > 0.75, pink: R() > 0.6 });
    }
    if (cfgBg.bubbles !== false) {
      var ringCol = mix(hexToRgb(theme.accent || '#38c8ff'), WHITE, 0.55);
      for (i = 3; i <= 8; i++) s.ringSprites.push(renderRing(i, ringCol, WHITE));
      var nB = Math.round(W / 45 * Math.max(0.3, amt));
      for (i = 0; i < nB; i++) s.bubbles.push({ x: R() * W, y: R() * H, r: Math.floor(R() * 6), v: 2 + R() * 4, ph: R() * 6.28 });
      var nP = Math.round(W / 30 * Math.max(0.3, amt));
      for (i = 0; i < nP; i++) s.petals.push({ x: R() * W, y: R() * H, v: 3 + R() * 5, ph: R() * 6.28, pink: R() > 0.4 });
    }
    return s;
  }

  function drawStar(g, x, y, big, col) {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
    g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1);
    if (big) { g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); g.fillRect(x, y - 2, 1, 1); g.fillRect(x, y + 2, 1, 1); }
  }

  function drawBg(t) {
    if (!scene || !bgCtx) return;
    var g = bgCtx, s = scene, sp = Number(cfgAnim.cloudSpeed == null ? 1 : cfgAnim.cloudSpeed) * Number(cfgAnim.speed || 1);
    var full = cfgBg.type === 'pixel-sky';
    g.clearRect(0, 0, W, H);
    if (full) {
      var grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, css(s.top)); grd.addColorStop(0.55, css(s.mid)); grd.addColorStop(1, css(s.bot));
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      // light rays
      if (cfgBg.rays !== false) {
        g.save();
        for (var r = 0; r < 5; r++) {
          var a = 0.10 + 0.06 * Math.sin(t * 0.5 + r * 1.7);
          g.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
          var x0 = W * (-0.1 + r * 0.16), wdt = W * (0.05 + (r % 2) * 0.04);
          g.beginPath(); g.moveTo(x0, -2); g.lineTo(x0 + wdt, -2); g.lineTo(x0 + wdt + W * 0.55, H); g.lineTo(x0 + W * 0.55, H); g.closePath(); g.fill();
        }
        g.restore();
      }
      if (s.far) {
        g.globalAlpha = 0.7;
        var fx = -((t * s.far.v * sp) % s.far.spr.width);
        g.drawImage(s.far.spr, Math.round(fx), s.far.y); g.drawImage(s.far.spr, Math.round(fx + s.far.spr.width), s.far.y);
        g.globalAlpha = 1;
      }
      if (s.rainbow) { g.globalAlpha = 0.5; g.drawImage(s.rainbow.spr, s.rainbow.x, s.rainbow.y); g.globalAlpha = 1; }
      for (var i = 0; i < s.clouds.length; i++) {
        var c = s.clouds[i], span = W + c.spr.width * 2;
        var cx = ((c.x + t * c.v * sp * 3) % span + span) % span - c.spr.width;
        g.globalAlpha = c.a; g.drawImage(c.spr, Math.round(cx), Math.round(c.y + Math.sin(t * 0.4 + i) * 1.5));
      }
      g.globalAlpha = 1;
    }
    // bubbles
    for (i = 0; i < s.bubbles.length; i++) {
      var b = s.bubbles[i], spr = s.ringSprites[b.r];
      if (!spr) continue;
      var by = ((b.y - t * b.v * sp) % (H + 20) + H + 20) % (H + 20) - 10;
      var bx = b.x + Math.sin(t * 0.8 + b.ph) * 4;
      g.globalAlpha = 0.75; g.drawImage(spr, Math.round(bx), Math.round(by));
    }
    g.globalAlpha = 1;
    // falling petals / pixel dots
    for (i = 0; i < s.petals.length; i++) {
      var p = s.petals[i];
      var py = ((p.y + t * p.v * sp) % (H + 10) + H + 10) % (H + 10) - 5;
      var px = ((p.x + t * p.v * sp * 0.6 + Math.sin(t + p.ph) * 3) % (W + 10) + W + 10) % (W + 10) - 5;
      g.fillStyle = p.pink ? 'rgba(255,170,220,.8)' : 'rgba(255,255,255,.85)';
      g.fillRect(Math.round(px), Math.round(py), p.pink ? 2 : 1, p.pink ? 1 : 1);
    }
    // twinkling sparkles
    for (i = 0; i < s.sparkles.length; i++) {
      var st = s.sparkles[i], al = 0.5 + 0.5 * Math.sin(t * st.sp * 2 + st.ph);
      if (al < 0.15) continue;
      g.globalAlpha = al;
      drawStar(g, st.x, st.y, st.big && al > 0.6, st.pink ? '#ffc7ec' : '#ffffff');
    }
    g.globalAlpha = 1;
    if (full && s.near) {
      var nx = -((t * s.near.v * sp) % s.near.spr.width);
      g.drawImage(s.near.spr, Math.round(nx), s.near.y); g.drawImage(s.near.spr, Math.round(nx + s.near.spr.width), s.near.y);
    }
  }

  function loopBg(now) {
    rafBg = requestAnimationFrame(loopBg);
    if (document.hidden) { lastBg = now; return; }
    if (now - lastBg < 33) return; // ~30fps is plenty for pixel art
    var dt = lastBg ? Math.min(0.1, (now - lastBg) / 1000) : 0.033;
    lastBg = now; tBg += dt;
    drawBg(tBg);
  }

  function resizeBg() {
    if (!bgCanvas) return;
    ps = Math.max(2, Math.min(10, Math.round(Number(cfgBg.pixelSize) || 4)));
    W = Math.ceil(window.innerWidth / ps); H = Math.ceil(window.innerHeight / ps);
    bgCanvas.width = W; bgCanvas.height = H;
    bgCtx = bgCanvas.getContext('2d');
    bgCtx.imageSmoothingEnabled = false;
    scene = buildScene();
    drawBg(tBg);
  }

  function startBg() {
    cancelAnimationFrame(rafBg); rafBg = 0;
    var showCanvas = cfgBg.type === 'pixel-sky' || cfgBg.sparkles !== false || cfgBg.bubbles !== false;
    bgCanvas.style.display = showCanvas ? 'block' : 'none';
    if (!showCanvas) return;
    resizeBg();
    if (motionOn) { lastBg = 0; rafBg = requestAnimationFrame(loopBg); }
  }

  /* ---------- cursor trail + bursts ---------- */
  var parts = [], rafFx = 0, lastFx = 0, dpr = 1, hue = 300, lastMove = { x: -99, y: -99, t: 0 };
  function sizeFx() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    fxCanvas.width = Math.round(window.innerWidth * dpr); fxCanvas.height = Math.round(window.innerHeight * dpr);
    fxCtx = fxCanvas.getContext('2d'); fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function trailColor() {
    var mode = cfgAnim.cursorTrailColor || 'rainbow';
    if (mode === 'rainbow') { hue = (hue + 9) % 360; return 'hsl(' + hue + ',100%,72%)'; }
    if (mode === 'theme') { var arr = [theme.primary, theme.secondary, theme.accent, theme.highlight].filter(Boolean); return arr[Math.floor(Math.random() * arr.length)] || '#ff2bc2'; }
    return /^#[0-9a-f]{3,8}$/i.test(mode) ? mode : '#ff2bc2';
  }
  function spawn(x, y, vx, vy, size, life, col) {
    parts.push({ x: x, y: y, vx: vx, vy: vy, s: size, life: life, max: life, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6, c: col || trailColor() });
    if (parts.length > 260) parts.splice(0, parts.length - 260);
    if (!rafFx) { lastFx = 0; rafFx = requestAnimationFrame(loopFx); }
  }
  function star4(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, r = i % 2 === 0 ? s : s * 0.28; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.restore();
  }
  function loopFx(now) {
    var dt = lastFx ? Math.min(0.05, (now - lastFx) / 1000) : 0.016; lastFx = now;
    var g = fxCtx; g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      var k = p.life / p.max;
      g.globalAlpha = Math.min(1, k * 1.4); g.fillStyle = p.c;
      g.shadowColor = p.c; g.shadowBlur = 8;
      star4(g, p.x, p.y, p.s * (0.4 + 0.6 * k), p.rot);
    }
    g.globalAlpha = 1; g.shadowBlur = 0;
    if (parts.length) rafFx = requestAnimationFrame(loopFx); else { rafFx = 0; g.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }
  function onMove(e) {
    if (!motionOn || cfgAnim.cursorTrail === false || e.pointerType === 'touch') return;
    var now = performance.now(), dx = e.clientX - lastMove.x, dy = e.clientY - lastMove.y;
    if (dx * dx + dy * dy < 90 || now - lastMove.t < 18) return;
    lastMove = { x: e.clientX, y: e.clientY, t: now };
    spawn(e.clientX, e.clientY, (Math.random() - 0.5) * 60, -20 - Math.random() * 40, 5 + Math.random() * 6, 0.7 + Math.random() * 0.4);
  }
  function burst(x, y, n, colors) {
    if (!motionOn) return;
    n = n || 24;
    var list = colors && colors.length ? colors : null;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, v = 140 + Math.random() * 360;
      spawn(x, y, Math.cos(a) * v, Math.sin(a) * v - 120, 6 + Math.random() * 10, 0.9 + Math.random() * 0.7, list ? list[i % list.length] : null);
    }
  }

  /* ---------- public ---------- */
  var inited = false, resizeTimer = 0;
  function init() {
    if (inited) return; inited = true;
    bgCanvas = document.getElementById('bg-canvas');
    fxCanvas = document.getElementById('fx-canvas');
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }
    sizeFx();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { sizeFx(); if (bgCanvas.style.display !== 'none') resizeBg(); }, 150);
    });
  }
  var lastKey = '';
  function configure(bg, anim, th) {
    init();
    var key = JSON.stringify([bg, anim, th && th.accent, th && th.primary, th && th.secondary, th && th.highlight]);
    cfgBg = bg || {}; cfgAnim = anim || {}; theme = th || {};
    motionOn = cfgAnim.enabled !== false && !reduced;
    if (key === lastKey) return; // nothing changed -> keep the running scene
    lastKey = key;
    startBg();
  }

  window.SulFX = { configure: configure, burst: burst, isMotionOn: function () { return motionOn; } };
})();
