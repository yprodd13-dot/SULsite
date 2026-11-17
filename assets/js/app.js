/* =========================================================
   SUL0557 — site renderer
   Reads content/site.json and builds the whole site from it.
   Edit content in the hidden admin panel, not here.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- defaults (used when a setting is missing) ---------- */
  var DEFAULTS = {
    meta: { title: 'SUL0557', description: '', favicon: 'assets/img/favicon.png', shareImage: '' },
    brand: { name: 'SUL0557', logo: 'assets/img/logo.png', headerLogoSize: 44 },
    intro: { enabled: true, logo: 'assets/img/logo.png', logoSize: 520, title: '', subtitle: '', buttonText: '✦ ENTER', logoAnimation: 'float', exitAnimation: 'zoom', oncePerSession: false, autoEnterSeconds: 0, showSparkleBurst: true },
    theme: { primary: '#ff2bc2', secondary: '#8a3cff', accent: '#38c8ff', highlight: '#fff27a', text: '#1c0b33', muted: '#7a5a9a', surface: '#ffffff', surfaceOpacity: 0.62, headingFont: 'Fraunces', bodyFont: 'Fraunces', uiFont: 'Space Grotesk', headingWeight: 900, headingItalic: false, uppercaseHeadings: true, radius: 22, buttonStyle: 'chunky', cardStyle: 'glass', contentWidth: 1180 },
    background: { type: 'pixel-sky', skyTop: '#fbe3f6', skyMid: '#e9ecff', skyBottom: '#ffe9f7', pixelSize: 4, clouds: true, rainbow: true, sprouts: true, bubbles: true, sparkles: true, rays: true, image: '', imageFit: 'cover', overlayColor: '#ffffff', overlayOpacity: 0 },
    animations: { enabled: true, speed: 1, entrance: 'fade-up', stagger: 90, pageTransition: 'fade', cardHover: 'tilt', buttonHover: 'bounce', logoFloat: true, logoGlow: true, cursorTrail: true, cursorTrailColor: 'rainbow', cloudSpeed: 1, sparkleAmount: 1, marqueeSpeed: 1 },
    header: { layout: 'pill', sticky: true, showSocials: true, ctaText: '', ctaLink: '', style: 'glass' },
    announcement: { enabled: false, text: '', linkText: '', link: '', countdownTo: '' },
    socials: [],
    footer: { tagline: '', text: '', showSocials: true, showLogo: true, columns: [], newsletterTitle: '', newsletterText: '', newsletterAction: '', copyright: '' },
    reviews: [],
    pages: [{ id: 'home', title: 'HOME', inNav: true, sections: [] }],
    kits: [],
    galleryCategories: [],
    gallery: [],
    adminEntry: { taps: 5, word: '' }
  };

  /* Google Fonts that the admin can pick from (weights each family really has) */
  // Fontshare fonts (free) — loaded from api.fontshare.com
  var FONTSHARE = { 'Clash Display': 'clash-display@400,500,600,700', 'Satoshi': 'satoshi@400,500,700,900', 'General Sans': 'general-sans@400,500,600,700', 'Cabinet Grotesk': 'cabinet-grotesk@400,500,700,800,900', 'Clash Grotesk': 'clash-grotesk@400,500,600,700' };
  var FONT_SPECS = {
    'Chivo': 'wght@400;500;700;900',
    'Fraunces': 'ital,wght@0,400;0,700;0,900;1,400;1,700;1,900',
    'Space Grotesk': 'wght@400;500;700',
    'Poppins': 'ital,wght@0,400;0,700;0,900;1,400;1,700;1,900',
    'Inter': 'wght@400;600;800',
    'Playfair Display': 'ital,wght@0,400;0,700;0,900;1,400;1,700;1,900',
    'DM Serif Display': 'ital@0;1',
    'Abril Fatface': '',
    'Alfa Slab One': '',
    'Unbounded': 'wght@400;700;900',
    'Syne': 'wght@400;700;800',
    'Rubik Mono One': '',
    'Bagel Fat One': '',
    'Righteous': '',
    'Chewy': '',
    'Gloock': '',
    'Monoton': '',
    'Press Start 2P': '',
    'Silkscreen': 'wght@400;700',
    'Pixelify Sans': 'wght@400;700',
    'VT323': ''
  };
  var SYSTEM_FONTS = { 'System': 'system-ui, -apple-system, "Segoe UI", sans-serif', 'Georgia': 'Georgia, serif', 'Courier': '"Courier New", monospace' };

  var ICONS = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8 8.5"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
    sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/>',
    youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>',
    soundcloud: '<path d="M8 17V10M5 17v-4M11 17V8.5"/><path d="M14 17h4.5a3 3 0 0 0 0-6 5 5 0 0 0-4.5-3.4V17z"/>',
    spotify: '<circle cx="12" cy="12" r="9.5"/><path d="M7 9.5c3.5-1 7.3-.7 10 .9M7.6 12.7c2.9-.8 5.8-.5 8 .8M8.3 15.6c2.2-.6 4.3-.4 6 .6"/>',
    twitter: '<path d="M4 4l16 16M20 4L4 20"/>',
    x: '<path d="M4 4l16 16M20 4L4 20"/>',
    discord: '<path d="M7 7.5c3.3-1.4 6.7-1.4 10 0 1.7 2.6 2.4 5.3 2.1 8.3-1.5 1.1-3 1.8-4.4 2.2l-.9-1.6M7 7.5C5.3 10.1 4.6 12.8 4.9 15.8c1.5 1.1 3 1.8 4.4 2.2l.9-1.6M8.2 15.2c2.5 1.1 5.1 1.1 7.6 0"/><circle cx="9.5" cy="12" r="1" fill="currentColor"/><circle cx="14.5" cy="12" r="1" fill="currentColor"/>',
    twitch: '<path d="M4.5 3.5h15v10l-4 4h-4l-3 3v-3h-4z"/><path d="M11 8v4M15 8v4"/>',
    beatstars: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    prev: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>'
  };
  function icon(name) {
    var p = ICONS[name] || ICONS.link;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}

  /* ---------- state ---------- */
  var cfg = null;
  var assetMap = {};            // admin preview: uploaded path -> data URL
  var params = new URLSearchParams(location.search);
  var IS_PREVIEW = params.get('preview') === '1' && window.parent !== window;
  var IS_DRAFT = params.get('draft') === '1';
  var firstRender = true;
  var introShowing = false;
  var revealObserver = null;
  var galleryState = {};        // sectionId -> { cat, items }
  var lbState = null;

  /* ---------- utils ---------- */
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function merge(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (!isObj(over)) return out;
    Object.keys(over).forEach(function (k) {
      if (isObj(base[k]) && isObj(over[k])) out[k] = merge(base[k], over[k]);
      else if (over[k] !== undefined && over[k] !== null) out[k] = over[k];
    });
    return out;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Make any link the admin typed safe + working.
  function normLink(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(#|\/|\.\/|\.\.\/|\?)/.test(u)) return u;
    var m = /^([a-z][a-z0-9+.\-]*):/i.exec(u);
    if (m) {
      var scheme = m[1].toLowerCase();
      return ['http', 'https', 'mailto', 'tel', 'sms'].indexOf(scheme) >= 0 ? u : '';
    }
    if (/^[^\s\/]+@[^\s\/]+\.[a-z]{2,}$/i.test(u)) return 'mailto:' + u;                 // bare email
    if (/^(www\.)?[a-z0-9\-]+(\.[a-z0-9\-]+)+(\/|$|\?|#)/i.test(u) && !/^(uploads|assets|content)\//i.test(u)) return 'https://' + u; // bare domain
    return u; // relative path (e.g. uploads/file.zip)
  }
  function asset(p) {
    p = String(p == null ? '' : p).trim();
    if (!p) return '';
    if (assetMap[p]) return assetMap[p];
    if (/^data:image\/|^data:video\/|^blob:/i.test(p)) return p;
    var m = /^([a-z][a-z0-9+.\-]*):/i.exec(p);
    if (m && !/^https?$/i.test(m[1])) return '';
    if (/^(www\.)?[a-z0-9\-]+(\.[a-z0-9\-]+)+\//i.test(p) && !/^(uploads|assets|content)\//i.test(p)) return 'https://' + p;
    return p;
  }
  function isExternal(href) { return /^https?:/i.test(href) && href.indexOf(location.origin) !== 0; }
  function linkAttrs(link, newTab) {
    var href = normLink(link);
    if (!href) return 'href="#" data-dead="1"';
    var nt = newTab === undefined ? isExternal(href) : !!newTab;
    if (href.charAt(0) === '#') nt = false;
    return 'href="' + esc(href) + '"' + (nt ? ' target="_blank" rel="noopener noreferrer"' : '');
  }
  // tiny safe formatter: **bold**, *italic*, [text](link), new lines
  function rich(text) {
    var s = esc(text);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (all, label, url) {
      var raw = url.replace(/&amp;/g, '&');
      var href = normLink(raw);
      if (!href) return label;
      var ext = isExternal(href);
      return '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }
  function sparkleText(t) {
    // wrap ✦ characters so they can be coloured
    return esc(t).replace(/✦/g, '<span class="sparkle">✦</span>');
  }
  function hexToRgbStr(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return '255, 255, 255';
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
  }
  function safeColor(c, d) { return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(c || '').trim()) ? String(c).trim() : d; }

  /* video helpers */
  function youtubeId(u) {
    u = String(u || '');
    var m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }
  function vimeoId(u) { var m = String(u || '').match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : ''; }
  function isVideoFile(u) { return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(u || '')) || /^data:video\//i.test(String(u || '')); }
  function mediaKind(u) {
    if (youtubeId(u)) return 'youtube';
    if (vimeoId(u)) return 'vimeo';
    if (isVideoFile(u)) return 'video';
    return 'image';
  }
  function embedUrl(u, autoplay) {
    var y = youtubeId(u); if (y) return 'https://www.youtube-nocookie.com/embed/' + y + '?rel=0' + (autoplay ? '&autoplay=1' : '');
    var v = vimeoId(u); if (v) return 'https://player.vimeo.com/video/' + v + (autoplay ? '?autoplay=1' : '');
    return '';
  }

  /* ---------- theme ---------- */
  function fontStack(name, fallback) {
    if (SYSTEM_FONTS[name]) return SYSTEM_FONTS[name];
    return '"' + String(name || '').replace(/["\\]/g, '') + '", ' + fallback;
  }
  function loadFont(name) {
    if (!name || SYSTEM_FONTS[name]) return;
    var id = 'gf-' + name.replace(/\s+/g, '-').toLowerCase();
    if (document.getElementById(id)) return;
    if (FONTSHARE[name]) {
      var fl = document.createElement('link'); fl.id = id; fl.rel = 'stylesheet';
      fl.href = 'https://api.fontshare.com/v2/css?f[]=' + FONTSHARE[name] + '&display=swap';
      document.head.appendChild(fl); return;
    }
    if (!(name in FONT_SPECS)) return;
    var spec = FONT_SPECS[name];
    var l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + (spec ? ':' + spec : '') + '&display=swap';
    document.head.appendChild(l);
  }
  function applyTheme() {
    var t = cfg.theme, a = cfg.animations, bg = cfg.background, r = document.documentElement.style, b = document.body;
    r.setProperty('--primary', safeColor(t.primary, '#ff2bc2'));
    r.setProperty('--secondary', safeColor(t.secondary, '#8a3cff'));
    r.setProperty('--accent', safeColor(t.accent, '#38c8ff'));
    r.setProperty('--highlight', safeColor(t.highlight, '#fff27a'));
    r.setProperty('--text', safeColor(t.text, '#1c0b33'));
    r.setProperty('--muted', safeColor(t.muted, '#7a5a9a'));
    r.setProperty('--surface-rgb', hexToRgbStr(safeColor(t.surface, '#ffffff')));
    r.setProperty('--surface-a', String(clamp(num(t.surfaceOpacity, 0.62), 0, 1)));
    r.setProperty('--radius', clamp(num(t.radius, 0), 0, 60) + 'px');
    r.setProperty('--b', clamp(Math.round(num(t.pixelBorder, 3)), 1, 6) + 'px');
    r.setProperty('--content-w', clamp(num(t.contentWidth, 1180), 700, 2000) + 'px');
    r.setProperty('--header-logo', clamp(num(cfg.brand.headerLogoSize, 72), 24, 140) + 'px');
    r.setProperty('--font-h', fontStack(t.headingFont, 'Georgia, serif'));
    r.setProperty('--font-b', fontStack(t.bodyFont, 'Georgia, serif'));
    r.setProperty('--font-ui', fontStack(t.uiFont, 'system-ui, sans-serif'));
    r.setProperty('--h-weight', String(clamp(num(t.headingWeight, 900), 100, 900)));
    r.setProperty('--h-style', t.headingItalic ? 'italic' : 'normal');
    r.setProperty('--h-transform', t.uppercaseHeadings === false ? 'none' : 'uppercase');
    r.setProperty('--speed', String(clamp(num(a.speed, 1), 0.2, 4)));
    r.setProperty('--marquee-speed', String(clamp(num(a.marqueeSpeed, 1), 0.1, 6)));
    [t.headingFont, t.bodyFont, t.uiFont].forEach(loadFont);

    b.setAttribute('data-btn', t.buttonStyle || 'pixel');
    b.setAttribute('data-card', t.cardStyle || 'pixel');
    b.setAttribute('data-btnhover', a.buttonHover || 'bounce');
    b.setAttribute('data-cardhover', a.cardHover || 'lift');
    b.setAttribute('data-entrance', (a.enabled === false) ? 'none' : (a.entrance || 'fade-up'));
    var motion = a.enabled !== false && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    b.classList.toggle('no-motion', a.enabled === false);
    b.classList.toggle('reduced-motion', !motion);

    // background
    var top = safeColor(bg.skyTop, '#fbe3f6'), mid = safeColor(bg.skyMid, '#e9ecff'), bot = safeColor(bg.skyBottom, '#ffe9f7');
    b.classList.toggle('bg-grid', bg.type === 'grid');
    b.style.background = (bg.type === 'grid' || bg.type === 'plain') ? top : 'linear-gradient(180deg,' + top + ',' + mid + ' 55%,' + bot + ')';
    b.style.backgroundAttachment = 'fixed';
    var bgi = document.getElementById('bg-image');
    var img = bg.type === 'image' ? asset(bg.image) : '';
    if (img) {
      bgi.style.display = 'block';
      bgi.style.backgroundImage = 'url("' + img.replace(/["\\\n\r]/g, '') + '")';
      bgi.style.backgroundSize = bg.imageFit === 'contain' ? 'contain' : (bg.imageFit === 'tile' ? 'auto' : 'cover');
      bgi.style.backgroundRepeat = bg.imageFit === 'tile' ? 'repeat' : 'no-repeat';
    } else { bgi.style.display = 'none'; bgi.style.backgroundImage = ''; }
    var ov = document.getElementById('bg-overlay');
    ov.style.background = safeColor(bg.overlayColor, '#ffffff');
    ov.style.opacity = String(clamp(num(bg.overlayOpacity, 0), 0, 1));

    if (window.SulFX) window.SulFX.configure(bg, a, t);

    // meta
    document.title = cfg.meta.title || cfg.brand.name || '';
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', cfg.meta.description || '');
    var fav = document.getElementById('favicon'); if (fav && cfg.meta.favicon) fav.href = asset(cfg.meta.favicon);
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', top);
  }

  /* ---------- header / footer ---------- */
  function headline(t) {
    // {words} in curly brackets get the holographic gradient
    return esc(t).replace(/\{([^}]*)\}/g, '<span class="holo">$1</span>').replace(/\n/g, '<br>');
  }
  function socialsHtml(cls) {
    return (cfg.socials || []).filter(function (s) { return s && normLink(s.url); }).map(function (s) {
      var name = String(s.platform || 'link').toLowerCase();
      return '<a class="' + (cls || 'icon-btn') + '" ' + linkAttrs(s.url, true) + ' aria-label="' + esc(s.label || name) + '" title="' + esc(s.label || name) + '">' + icon(name) + '</a>';
    }).join('');
  }
  function navPages() { return cfg.pages.filter(function (p) { return p.inNav !== false; }); }
  function pageHref(p) { return p === cfg.pages[0] ? '#/' : '#/' + encodeURIComponent(p.id); }

  var annTimer = 0;
  function renderAnnouncement() {
    var a = cfg.announcement || {}, el = document.getElementById('announce');
    clearInterval(annTimer);
    var dismissed = false; try { dismissed = sessionStorage.getItem('sul.annHidden') === String(a.text || ''); } catch (e) {}
    if (!a.enabled || !a.text || (dismissed && !IS_PREVIEW)) { el.hidden = true; el.innerHTML = ''; return; }
    var end = a.countdownTo ? new Date(a.countdownTo).getTime() : NaN;
    el.hidden = false;
    el.innerHTML = '<div class="ann-inner"><span>' + sparkleText(a.text) + '</span>' +
      (isFinite(end) ? '<span class="ann-count" data-count></span>' : '') +
      (a.linkText && normLink(a.link) ? '<a ' + linkAttrs(a.link) + '>' + esc(a.linkText) + '</a>' : '') +
      '</div><button class="ann-x" type="button" aria-label="Hide announcement">×</button>';
    el.querySelector('.ann-x').onclick = function () { el.hidden = true; try { sessionStorage.setItem('sul.annHidden', String(a.text || '')); } catch (e) {} };
    if (isFinite(end)) {
      var c = el.querySelector('[data-count]');
      var tick = function () {
        var ms = end - Date.now();
        if (ms <= 0) { c.textContent = 'Ended'; clearInterval(annTimer); return; }
        var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
        c.textContent = 'Ends in ' + d + 'd ' + h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
      };
      tick(); annTimer = setInterval(tick, 20000);
    }
  }

  function renderHeader() {
    var h = cfg.header, el = document.getElementById('site-header');
    el.className = (h.sticky !== false ? 'is-sticky ' : '') + 'style-' + (h.style || 'glass') + ' layout-' + (h.layout || 'pill');
    var logo = asset(cfg.brand.logo);
    var socials = h.showSocials !== false ? socialsHtml('icon-btn') : '';
    var cta = h.ctaText ? '<a class="btn btn-sm hd-cta" ' + linkAttrs(h.ctaLink) + '>' + sparkleText(h.ctaText) + '</a>' : '';
    el.innerHTML = '<div class="hd">' +
      '<div class="hd-pill hd-main">' +
        '<a class="brand" href="#/" aria-label="' + esc(cfg.brand.name) + ' home">' +
          (logo ? '<img src="' + esc(logo) + '" alt="' + esc(cfg.brand.name) + '">' : '<span class="brand-text">' + esc(cfg.brand.name) + '</span>') + '</a>' +
        '<nav class="nav" id="main-nav" aria-label="Main">' +
          navPages().map(function (p) { return '<a href="' + pageHref(p) + '" data-page="' + esc(p.id) + '">' + (p.icon && p.icon !== 'none' ? icon(p.icon) : '') + '<span>' + esc(p.title) + '</span></a>'; }).join('') +
          '<div class="nav-mobile-extra">' + socials + (cta ? cta.replace('hd-cta', '') : '') + '</div>' +
        '</nav>' +
        '<button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="main-nav"><span></span><span></span><span></span></button>' +
      '</div>' +
      ((socials || cta) ? '<div class="hd-pill hd-right"><div class="socials" style="display:flex;gap:6px">' + socials + '</div>' + cta + '</div>' : '') +
    '</div>';
    var burger = el.querySelector('.burger');
    burger.addEventListener('click', function () {
      var open = !el.classList.contains('nav-open');
      el.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    el.querySelectorAll('.nav a').forEach(function (a) { a.addEventListener('click', function () { el.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); }); });
  }
  function markActiveNav(pageId) {
    document.querySelectorAll('#site-header .nav a[data-page]').forEach(function (a) {
      var on = a.getAttribute('data-page') === pageId;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function renderFooter() {
    var f = cfg.footer, el = document.getElementById('site-footer');
    var logo = asset(cfg.brand.logo);
    var cols = (f.columns || []).filter(function (c) { return c && (c.title || (c.links || []).length); });
    var news = !!normLink(f.newsletterAction);
    var tmpl = '1.4fr' + (cols.length ? ' repeat(' + cols.length + ', minmax(0, .8fr))' : '') + (news ? ' 1.4fr' : '');
    el.innerHTML = '<div class="ft-wrap"><div class="ft"><div class="ft-cols" style="grid-template-columns:' + tmpl + '">' +
      '<div class="ft-brand">' +
        (f.showLogo !== false && logo ? '<img class="footer-logo" src="' + esc(logo) + '" alt="' + esc(cfg.brand.name) + '" loading="lazy">' : '') +
        (f.tagline ? '<p>' + rich(f.tagline) + '</p>' : '') +
        (f.showSocials !== false ? '<div class="ft-socials">' + socialsHtml('icon-btn') + '</div>' : '') +
      '</div>' +
      cols.map(function (c) {
        return '<div><h4>' + esc(c.title) + '</h4><ul>' + (c.links || []).filter(function (l) { return l && l.text; }).map(function (l) {
          return '<li><a ' + linkAttrs(l.link) + '>' + esc(l.text) + '</a></li>';
        }).join('') + '</ul></div>';
      }).join('') +
      (news ? '<div class="ft-news"><h4>' + esc(f.newsletterTitle || 'Newsletter') + '</h4>' + (f.newsletterText ? '<p>' + esc(f.newsletterText) + '</p>' : '') +
        '<form class="ft-form" method="post" target="_blank" action="' + esc(normLink(f.newsletterAction)) + '"><input type="email" name="email" required placeholder="you@email.com" aria-label="Email"><button type="submit" aria-label="Sign up">→</button></form></div>' : '') +
      '</div><div class="ft-bottom"><span>' + esc(f.copyright || ('© ' + new Date().getFullYear() + ' ' + cfg.brand.name)) + '</span>' + (f.text ? '<span>' + rich(f.text) + '</span>' : '') + '</div></div></div>';
  }

  /* ---------- sections ---------- */
  function moreLinks(s) {
    var out = [];
    if (s.moreText && normLink(s.moreLink)) out.push({ text: s.moreText, link: s.moreLink, style: 'primary' });
    if (s.more2Text && normLink(s.more2Link)) out.push({ text: s.more2Text, link: s.more2Link, style: 'ghost' });
    return out;
  }
  function secHead(s) {
    var top = s.moreStyle === 'top' ? moreLinks(s)[0] : null;
    if (!s.title && !s.subtitle && !top) return '';
    return '<div class="sec-head reveal"><div>' +
      (s.title ? '<h2 class="sec-title">' + headline(s.title) + '</h2>' : '') +
      (s.subtitle ? '<p class="sec-sub">' + rich(s.subtitle) + '</p>' : '') + '</div>' +
      (top ? '<a class="sec-link" ' + linkAttrs(top.link) + '>' + esc(top.text) + '</a>' : '') + '</div>';
  }
  function buttonsHtml(list) {
    list = (list || []).filter(function (b) { return b && b.text; });
    if (!list.length) return '';
    return '<div class="btn-row reveal">' + list.map(function (b) {
      var cls = 'btn' + (b.style && b.style !== 'primary' ? ' btn-' + esc(b.style) : '');
      return '<a class="' + cls + '" ' + linkAttrs(b.link, b.newTab) + '>' + sparkleText(b.text) + '</a>';
    }).join('') + '</div>';
  }
  function moreHtml(s) {
    if (s.moreStyle === 'top') return '';
    var l = moreLinks(s); if (!l.length) return '';
    return '<div class="more-row reveal">' + l.map(function (b) {
      return '<a class="btn' + (b.style === 'ghost' ? ' btn-ghost' : '') + '" ' + linkAttrs(b.link) + '>' + sparkleText(b.text) + '</a>';
    }).join('') + '</div>';
  }
  function colsStyle(n, def) { n = clamp(Math.round(num(n, def || 3)), 1, 6); return '--cols:' + n + ';--cols-md:' + Math.min(n, 2); }
  function hashQuery() { var m = /[?&]q=([^&]*)/.exec(location.hash); try { return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; } catch (e) { return ''; } }
  function reviewsStrip(big) {
    var list = (cfg.reviews || []).filter(function (r) { return r && r.text; });
    if (!list.length) return '';
    var one = list.map(function (r) {
      var av = asset(r.avatar), init = String(r.handle || '?').replace(/^@/, '').charAt(0).toUpperCase();
      return '<div class="rev"><div class="rev-who">' + (av ? '<img class="rev-av" src="' + esc(av) + '" alt="" loading="lazy">' : '<span class="rev-av">' + esc(init) + '</span>') +
        '<span>' + esc(r.handle) + '</span></div><p>' + esc(r.text) + '</p></div>';
    }).join('');
    return '<div class="rev-strip' + (big ? ' reviews-big' : '') + '"><div class="rev-track">' + one + one + '</div></div>';
  }

  var R = {};
  R.hero = function (s) {
    var a = cfg.animations, logo = asset(s.logo);
    var side = s.rightSide || 'art';
    var layout = s.layout || 'split';
    var art = '';
    if (side === 'art' && logo) {
      art = '<div class="win"><div class="win-bar"><span>' + esc(s.windowTitle || (String(cfg.brand.name || 'sul').toLowerCase() + '.exe')) + '</span><i></i><i></i><i></i></div>' +
        '<div class="art-card"><img class="' + (a.logoFloat !== false ? 'logo-float' : '') + '" src="' + esc(logo) + '" alt="' + esc(cfg.brand.name) + ' logo"></div>' +
        '<div class="win-foot"><span>' + esc(s.windowFooter || 'LV.99 PRODUCER') + '</span><b>♥ ♥ ♥</b></div></div>';
    } else if (side === 'logo' && logo) {
      art = '<img class="hero-logo-solo' + (a.logoFloat !== false ? ' logo-float' : '') + (a.logoGlow !== false ? ' logo-glow' : '') + '" src="' + esc(logo) + '" alt="' + esc(cfg.brand.name) + ' logo">';
    } else if (side === 'mosaic') {
      var imgs = (cfg.gallery || []).filter(function (g) { return g && g.visible !== false && g.src; }).map(function (g) {
        var t = asset(g.thumb) || (youtubeId(g.src) ? 'https://img.youtube.com/vi/' + youtubeId(g.src) + '/hqdefault.jpg' : (mediaKind(g.src) === 'image' ? asset(g.src) : ''));
        return t;
      }).filter(Boolean).concat((cfg.kits || []).filter(function (k) { return k && k.visible !== false && k.image; }).map(function (k) { return asset(k.image); }));
      if (imgs.length) {
        while (imgs.length < 9) imgs = imgs.concat(imgs);
        var cols = [[], [], []]; imgs.slice(0, 12).forEach(function (u, i) { cols[i % 3].push(u); });
        art = '<div class="mosaic">' + cols.map(function (c) {
          var h = c.map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy">'; }).join('');
          return '<div class="mosaic-col">' + h + h + '</div>';
        }).join('') + '</div><div class="mosaic-bar"><span>Recent work</span><button type="button" data-mosaic-pause>❚❚ Pause</button></div>';
      }
    }
    var revs = s.showReviews ? reviewsStrip(false) : '';
    var hasArt = !!(art || revs) && layout !== 'centered';
    var chips = String(s.chips || '').split(',').map(function (c) { return c.trim(); }).filter(Boolean);
    var search = s.showSearch ? '<form class="hero-search reveal" data-hero-search role="search">' + icon('search') +
      '<input type="search" placeholder="' + esc(s.searchPlaceholder || 'Search…') + '" aria-label="Search"><button class="btn btn-sm" type="submit">Search</button></form>' +
      (chips.length ? '<div class="chips reveal"><span>Try:</span>' + chips.map(function (c) { return '<button type="button" data-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') : '';
    var small = s.smallText ? (normLink(s.smallLink) ? '<a class="hero-small reveal" ' + linkAttrs(s.smallLink) + '>' + esc(s.smallText) + '</a>' : '<span class="hero-small reveal">' + esc(s.smallText) + '</span>') : '';
    return '<div class="hero layout-' + esc(layout) + (s.fullHeight ? ' fullh' : '') + (hasArt ? '' : ' no-art') + '">' +
      '<div class="hero-copy">' +
        (s.status ? '<div class="status reveal"><i></i>' + esc(s.status) + '</div>' : '') +
        (s.title ? '<h1 class="hero-title reveal">' + headline(s.title) + '</h1>' : '') +
        (s.text ? '<p class="hero-text reveal">' + rich(s.text) + '</p>' : '') + small +
        buttonsHtml(s.buttons) + search +
      '</div>' +
      (hasArt ? '<div class="hero-art-col reveal">' + art + revs + '</div>' : (layout === 'centered' && revs ? '<div style="width:100%;margin-top:30px">' + revs + '</div>' : '')) +
      '</div>';
  };
  R.marquee = function (s) {
    var txt = String(s.text || '✦').trim() + ' ';
    var rep = Math.max(4, Math.ceil(120 / Math.max(6, txt.length)));
    var chunk = new Array(rep + 1).join(txt);
    return '<div class="marquee st-' + esc(s.style || 'gradient') + '" style="--tilt:' + clamp(num(s.tilt, -2), -10, 10) + 'deg">' +
      '<div class="marquee-track" aria-hidden="true"><span>' + esc(chunk) + '</span><span>' + esc(chunk) + '</span></div>' +
      '<span class="sr-only">' + esc(s.text) + '</span></div>';
  };
  function kitCard(k) {
    var img = asset(k.image), sold = !!k.soldOut, href = normLink(k.link), live = href && !sold;
    var tags = String(k.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 5);
    var btnText = sold ? 'SOLD OUT' : (k.buttonText || 'GO TO');
    var inner =
      '<div class="card-media">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(k.title) + '" loading="lazy">' : '') + (sold ? '<div class="soldout-tag">SOLD OUT</div>' : '') + '</div>' +
      '<div class="card-body">' +
        '<div class="card-top"><h3 class="card-title">' + esc(k.title) + '</h3>' + (k.badge ? '<span class="badge">' + esc(k.badge) + '</span>' : '') + '</div>' +
        (tags.length ? '<div class="tags">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        (k.description ? '<p class="card-desc">' + rich(k.description).replace(/<a [^>]*>|<\/a>/g, '') + '</p>' : '') +
        '<div class="card-foot"><div class="price-row">' + (k.price ? '<span class="price">' + esc(k.price) + '</span>' : '') + (k.oldPrice ? '<span class="old-price">' + esc(k.oldPrice) + '</span>' : '') + '</div>' +
          '<span class="btn go-btn' + (live ? '' : ' is-disabled') + '">' + sparkleText(btnText) + ' ' + (live ? '→' : '') + '</span></div>' +
      '</div>';
    var search = esc((k.title + ' ' + (k.description || '') + ' ' + (k.badge || '') + ' ' + (k.tags || '')).toLowerCase());
    return live
      ? '<a class="card reveal" data-tilt data-search="' + search + '" ' + linkAttrs(k.link, k.newTab !== false) + '>' + inner + '</a>'
      : '<article class="card reveal" data-tilt data-search="' + search + '">' + inner + '</article>';
  }
  R.kits = function (s) {
    var list = (cfg.kits || []).filter(function (k) { return k && k.visible !== false && (s.filter !== 'featured' || k.featured); });
    var lim = Math.round(num(s.limit, 0)); if (lim > 0) list = list.slice(0, lim);
    var search = s.showSearch ? '<div class="search-box reveal">' + icon('search') + '<input type="search" placeholder="Search kits…" aria-label="Search kits" data-kit-search value="' + esc(hashQuery()) + '"></div>' : '';
    var grid = list.length ? '<div class="grid" style="' + colsStyle(s.columns) + '">' + list.map(kitCard).join('') + '</div>' : '<p class="empty">No kits yet — add some in the admin panel ✦</p>';
    var body = grid + '<p class="empty" data-kit-empty hidden>No kits match that search.</p>' + moreHtml(s);
    return secHead(s) + search + (s.style === 'plain' ? body : '<div class="kit-box reveal">' + body + '</div>');
  };
  function galleryItems(s, cat) {
    var q = hashQuery().toLowerCase();
    var cats = {}; (cfg.galleryCategories || []).forEach(function (c) { cats[c.id] = String(c.label || '').toLowerCase(); });
    return (cfg.gallery || []).filter(function (g) {
      if (!g || g.visible === false || !g.src) return false;
      var c = s.category && s.category !== 'all' ? s.category : cat;
      if (c && c !== 'all' && g.category !== c) return false;
      if (q && s.showTabs) return ((g.title || '') + ' ' + (g.description || '') + ' ' + (cats[g.category] || '')).toLowerCase().indexOf(q) >= 0;
      return true;
    });
  }
  function galleryGrid(s) {
    var st = galleryState[s.id];
    var items = galleryItems(s, st.cat);
    var lim = Math.round(num(s.limit, 0)); if (lim > 0) items = items.slice(0, lim);
    st.items = items;
    if (!items.length) return '<p class="empty">Nothing here yet ✦</p>';
    var cats = {}; (cfg.galleryCategories || []).forEach(function (c) { cats[c.id] = c.label; });
    var cls = s.layout === 'masonry' ? 'g-masonry' : (s.layout === 'bento' ? 'g-bento' : 'g-grid');
    return '<div class="' + cls + '" style="' + colsStyle(s.columns) + '">' + items.map(function (g, i) {
      var kind = mediaKind(g.src), thumb = asset(g.thumb), src = asset(g.src), media;
      if (!thumb && kind === 'youtube') thumb = 'https://img.youtube.com/vi/' + youtubeId(g.src) + '/hqdefault.jpg';
      if (thumb) media = '<img src="' + esc(thumb) + '" alt="' + esc(g.title || '') + '" loading="lazy">';
      else if (kind === 'video') media = '<video src="' + esc(src) + '#t=0.1" muted playsinline preload="metadata"></video>';
      else if (kind === 'image') media = '<img src="' + esc(src) + '" alt="' + esc(g.title || '') + '" loading="lazy">';
      else media = '<div style="aspect-ratio:16/9"></div>';
      return '<button type="button" class="g-item reveal" data-sec="' + esc(s.id) + '" data-idx="' + i + '" aria-label="Open ' + esc(g.title || 'item') + '">' + media +
        (kind !== 'image' ? '<span class="g-play">' + icon('play') + '</span>' : '') +
        (s.showLabels && cats[g.category] ? '<span class="g-tag">' + esc(cats[g.category]) + '</span>' : '') +
        ((g.title || g.description) ? '<span class="g-cap"><strong>' + esc(g.title) + '</strong>' + (g.description ? '<small>' + esc(g.description) + '</small>' : '') + '</span>' : '') +
        '</button>';
    }).join('') + '</div>';
  }
  R.gallery = function (s) {
    if (!galleryState[s.id]) galleryState[s.id] = { cat: 'all', items: [] };
    var st = galleryState[s.id], tabs = '';
    if (s.showTabs && (!s.category || s.category === 'all')) {
      var cats = [{ id: 'all', label: s.allLabel || 'All' }].concat(cfg.galleryCategories || []);
      tabs = '<div class="tabs reveal" role="tablist">' + cats.map(function (c) {
        return '<button type="button" role="tab" class="tab' + (st.cat === c.id ? ' is-active' : '') + '" aria-selected="' + (st.cat === c.id) + '" data-cat="' + esc(c.id) + '" data-sec="' + esc(s.id) + '">' + esc(c.label) + '</button>';
      }).join('') + '</div>';
    } else st.cat = 'all';
    return secHead(s) + tabs + '<div class="g-wrap" data-gwrap="' + esc(s.id) + '">' + galleryGrid(s) + '</div>' + moreHtml(s);
  };
  R.reviews = function (s) {
    var strip = reviewsStrip(true);
    return secHead(s) + (strip ? '<div class="reveal">' + strip + '</div>' : '<p class="empty">Add reviews in the admin panel ✦</p>');
  };
  R.compare = function (s) {
    var rows = (s.rows || []).filter(function (r) { return r && (r.label || r.you || r.them); });
    var side = function (cls, label, key, ic) {
      return '<div class="cmp-side ' + cls + ' reveal"><h3>' + esc(label) + '</h3><ul>' + rows.map(function (r) {
        return '<li><span class="cmp-ic">' + ic + '</span><span><small>' + esc(r.label) + '</small>' + esc(r[key]) + '</span></li>';
      }).join('') + '</ul></div>';
    };
    return secHead(s) + '<div class="vs">' + side('cmp-you', s.youLabel || 'US', 'you', '✓') +
      '<div class="vs-badge reveal" aria-hidden="true">VS</div>' + side('cmp-them', s.themLabel || 'OTHERS', 'them', '✕') + '</div>';
  };
  R.cards = function (s) {
    var items = (s.items || []).filter(function (c) { return c && (c.image || c.title); });
    return secHead(s) + (items.length ? '<div class="cards-grid" style="' + colsStyle(s.columns, 2) + '">' + items.map(function (c) {
      var href = normLink(c.link), img = asset(c.image);
      var inner = '<div class="xcard-media">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(c.title || '') + '" loading="lazy">' : '') +
        (href ? '<span class="xcard-go">' + icon('play') + '</span>' : '') + '</div>' +
        (c.title ? '<h3>' + esc(c.title) + '</h3>' : '') + (c.sub ? '<p>' + esc(c.sub) + '</p>' : '');
      return href ? '<a class="xcard reveal" ' + linkAttrs(c.link, c.newTab !== false) + '>' + inner + '</a>' : '<div class="xcard reveal">' + inner + '</div>';
    }).join('') + '</div>' : '<p class="empty">Add cards in the admin panel ✦</p>') + moreHtml(s);
  };
  R.text = function (s) {
    return '<div class="text-block size-' + esc(s.size || 'normal') + '">' +
      (s.title ? '<h2 class="sec-title reveal">' + headline(s.title) + '</h2>' : '') +
      (s.text ? '<div class="rich reveal">' + rich(s.text) + '</div>' : '') +
      buttonsHtml(s.buttons) + '</div>';
  };
  R.cta = function (s) {
    var face = asset(s.image || cfg.brand.logo);
    return '<div class="dialog reveal">' +
      (face ? '<div class="dlg-face"><img src="' + esc(face) + '" alt=""></div>' : '<div></div>') +
      '<div class="dlg-body">' + (s.title ? '<div class="dlg-name">' + esc(s.title) + '</div>' : '') +
      (s.text ? '<div class="rich">' + rich(s.text) + '</div>' : '') + buttonsHtml(s.buttons) + '</div>' +
      '<span class="dlg-next" aria-hidden="true">▼</span></div>';
  };
  R.video = function (s) {
    var u = String(s.url || '').trim(), kind = mediaKind(u), inner = '';
    if (!u) inner = '';
    else if (kind === 'youtube' || kind === 'vimeo') inner = '<iframe src="' + esc(embedUrl(u, false)) + '" title="' + esc(s.title || 'video') + '" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    else if (kind === 'video') inner = '<video src="' + esc(asset(u)) + '" controls playsinline preload="metadata"' + (s.poster ? ' poster="' + esc(asset(s.poster)) + '"' : '') + '></video>';
    return secHead(s) + (inner ? '<div class="media-frame reveal">' + inner + '</div>' : '<p class="empty">Add a YouTube link or video file in the admin.</p>');
  };
  R.image = function (s) {
    var img = asset(s.image);
    if (!img) return secHead(s) + '<p class="empty">Add an image in the admin.</p>';
    var mw = clamp(num(s.maxWidth, 900), 100, 3000);
    var inner = '<img src="' + esc(img) + '" alt="' + esc(s.alt || s.caption || '') + '" loading="lazy">';
    if (normLink(s.link)) inner = '<a ' + linkAttrs(s.link, s.newTab) + '>' + inner + '</a>';
    return secHead(s) + '<div class="img-block reveal"><figure style="max-width:' + mw + 'px">' + inner + (s.caption ? '<figcaption>' + rich(s.caption) + '</figcaption>' : '') + '</figure></div>';
  };
  R.links = function (s) {
    var list = (s.links || []).filter(function (b) { return b && b.text; });
    return secHead(s) + '<div class="links-list">' + list.map(function (b) {
      var cls = 'btn reveal' + (b.style && b.style !== 'primary' ? ' btn-' + esc(b.style) : '');
      return '<a class="' + cls + '" ' + linkAttrs(b.link, b.newTab) + '>' + sparkleText(b.text) + '</a>';
    }).join('') + '</div>';
  };
  R.spacer = function (s) { return '<div style="height:' + clamp(num(s.height, 60), 0, 600) + 'px"></div>'; };

  function renderSection(s) {
    var fn = R[s.type];
    if (!fn || s.visible === false) return '';
    var cls = 'section t-' + esc(s.type) + ' w-' + esc(s.width || 'normal') + ' a-' + esc(s.align || 'left') + ' sp-' + esc(s.spacing || 'normal');
    var inner;
    try { inner = fn(s); } catch (e) { console.error('Section failed', s, e); inner = ''; }
    if (s.type === 'marquee') return '<section class="' + cls + ' w-full" data-sid="' + esc(s.id) + '" style="overflow:hidden">' + inner + '</section>';
    var panel = s.panel && s.type !== 'cta' ? '<div class="panel">' + inner + '</div>' : inner;
    return '<section class="' + cls + '" data-sid="' + esc(s.id) + '"><div class="wrap">' + panel + '</div></section>';
  }

  /* ---------- reveal / interactions ---------- */
  function setupReveal(root, instant) {
    if (revealObserver) revealObserver.disconnect();
    var a = cfg.animations;
    var els = root.querySelectorAll('.reveal');
    if (introShowing && !instant) return; // wait until the intro is closed
    var noAnim = instant || a.enabled === false || a.entrance === 'none' || document.body.classList.contains('reduced-motion') || !('IntersectionObserver' in window);
    if (noAnim) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var stagger = clamp(num(a.stagger, 90), 0, 600) / clamp(num(a.speed, 1), 0.2, 4);
    // stagger siblings inside the same parent
    var groups = new Map();
    els.forEach(function (el) {
      var p = el.parentElement, n = groups.get(p) || 0;
      el.style.transitionDelay = Math.min(n * stagger, 1200) + 'ms';
      groups.set(p, n + 1);
    });
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          revealObserver.unobserve(en.target);
          var el = en.target;
          setTimeout(function () { el.style.transitionDelay = ''; }, 1800);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function (el) { revealObserver.observe(el); });
  }

  function bindApp(root) {
    root.onclick = function (e) {
      var dead = e.target.closest('a[data-dead]');
      if (dead) { e.preventDefault(); return; }
      var tab = e.target.closest('.tab[data-cat]');
      if (tab) {
        var sid = tab.getAttribute('data-sec'), s = findSection(sid);
        if (!s) return;
        galleryState[sid].cat = tab.getAttribute('data-cat');
        tab.parentElement.querySelectorAll('.tab').forEach(function (t) { var on = t === tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); });
        var wrap = root.querySelector('[data-gwrap="' + cssEsc(sid) + '"]');
        wrap.innerHTML = galleryGrid(s);
        wrap.querySelectorAll('.reveal').forEach(function (el, i) {
          el.style.transitionDelay = (i * 40) + 'ms';
          requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-in'); }); });
        });
        return;
      }
      var chip = e.target.closest('[data-chip]');
      if (chip) { var f = chip.closest('.hero-copy').querySelector('[data-hero-search] input'); if (f) { f.value = chip.getAttribute('data-chip'); goSearch(f.value); } return; }
      var mp = e.target.closest('[data-mosaic-pause]');
      if (mp) { var m = mp.parentElement.previousElementSibling; var paused = m.classList.toggle('paused'); mp.textContent = paused ? '▶ Play' : '❚❚ Pause'; return; }
      var gi = e.target.closest('.g-item');
      if (gi) { openLightbox(gi.getAttribute('data-sec'), num(gi.getAttribute('data-idx'), 0)); return; }
      var btn = e.target.closest('.btn');
      if (btn && window.SulFX && cfg.animations.enabled !== false) {
        var r = btn.getBoundingClientRect();
        window.SulFX.burst(r.left + r.width / 2, r.top + r.height / 2, 14);
      }
    };
    root.onsubmit = function (e) {
      var f = e.target.closest('[data-hero-search]');
      if (!f) return;
      e.preventDefault(); goSearch(f.querySelector('input').value);
    };
    var ks = root.querySelector('[data-kit-search]');
    if (ks && ks.value) setTimeout(function () { ks.dispatchEvent(new Event('input', { bubbles: true })); }, 0);
    root.oninput = function (e) {
      if (!e.target.matches('[data-kit-search]')) return;
      var q = e.target.value.trim().toLowerCase(), sec = e.target.closest('.section'), shown = 0;
      sec.querySelectorAll('.card').forEach(function (c) {
        var ok = !q || (c.getAttribute('data-search') || '').indexOf(q) >= 0;
        c.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      var em = sec.querySelector('[data-kit-empty]'); if (em) em.hidden = shown > 0;
    };
    // 3D tilt
    root.onpointermove = function (e) {
      if (cfg.animations.cardHover !== 'tilt' || cfg.animations.enabled === false || e.pointerType === 'touch') return;
      var c = e.target.closest('[data-tilt]'); if (!c) return;
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transition = 'transform .12s ease-out, box-shadow .3s';
      c.style.transform = 'perspective(800px) rotateY(' + (x * 10).toFixed(2) + 'deg) rotateX(' + (-y * 10).toFixed(2) + 'deg) translateY(-6px)';
    };
    root.onpointerout = function (e) {
      var c = e.target.closest('[data-tilt]');
      if (c && !c.contains(e.relatedTarget)) {
        c.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1), box-shadow .3s';
        c.style.transform = '';
        setTimeout(function () { if (!c.matches(':hover')) c.style.transition = ''; }, 520);
      }
    };
  }
  function goSearch(q) {
    q = String(q || '').trim();
    // send searches to the first page that has a searchable kits grid (or a gallery with tabs)
    var target = null;
    cfg.pages.forEach(function (p) { if (!target && (p.sections || []).some(function (s) { return s.visible !== false && s.type === 'kits' && s.showSearch; })) target = p; });
    if (!target) cfg.pages.forEach(function (p) { if (!target && (p.sections || []).some(function (s) { return s.visible !== false && s.type === 'gallery' && s.showTabs; })) target = p; });
    if (!target) return;
    location.hash = '#/' + encodeURIComponent(target.id) + (q ? '?q=' + encodeURIComponent(q) : '');
  }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
  function findSection(id) {
    for (var i = 0; i < cfg.pages.length; i++) {
      var secs = cfg.pages[i].sections || [];
      for (var j = 0; j < secs.length; j++) if (secs[j].id === id) return secs[j];
    }
    return null;
  }

  /* ---------- lightbox ---------- */
  var lb = document.getElementById('lightbox');
  var lastFocus = null;
  function openLightbox(sid, idx) {
    var st = galleryState[sid]; if (!st || !st.items.length) return;
    lbState = { items: st.items, i: clamp(idx, 0, st.items.length - 1) };
    lastFocus = document.activeElement;
    lb.hidden = false; document.body.classList.add('lock-scroll');
    drawLightbox();
    var c = lb.querySelector('.lb-close'); if (c) c.focus();
  }
  function drawLightbox() {
    var g = lbState.items[lbState.i], kind = mediaKind(g.src), src = asset(g.src), stage;
    if (kind === 'youtube' || kind === 'vimeo') stage = '<div class="lb-frame"><iframe src="' + esc(embedUrl(g.src, true)) + '" title="' + esc(g.title || 'video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>';
    else if (kind === 'video') stage = '<video src="' + esc(src) + '" controls autoplay playsinline></video>';
    else stage = '<img src="' + esc(src) + '" alt="' + esc(g.title || '') + '">';
    var multi = lbState.items.length > 1;
    var link = normLink(g.link);
    lb.innerHTML =
      '<button class="lb-btn lb-close" aria-label="Close">' + icon('close') + '</button>' +
      (multi ? '<button class="lb-btn lb-prev" aria-label="Previous">' + icon('prev') + '</button><button class="lb-btn lb-next" aria-label="Next">' + icon('next') + '</button>' : '') +
      '<div class="lb-stage">' + stage + '</div>' +
      ((g.title || g.description || link) ? '<div class="lb-info">' + (g.title ? '<h3>' + esc(g.title) + '</h3>' : '') + (g.description ? '<p>' + esc(g.description) + '</p>' : '') +
        (link ? '<a class="btn" ' + linkAttrs(g.link, true) + ' style="padding:12px 24px;font-size:15px">' + sparkleText(g.linkText || 'GO TO') + '</a>' : '') + '</div>' : '');
  }
  function closeLightbox() {
    if (lb.hidden) return;
    lb.hidden = true; lb.innerHTML = ''; lbState = null;
    document.body.classList.remove('lock-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function stepLightbox(d) {
    if (!lbState) return;
    var n = lbState.items.length;
    lbState.i = (lbState.i + d + n) % n; drawLightbox();
  }
  lb.addEventListener('click', function (e) {
    if (e.target.closest('.lb-close') || e.target === lb) closeLightbox();
    else if (e.target.closest('.lb-prev')) stepLightbox(-1);
    else if (e.target.closest('.lb-next')) stepLightbox(1);
  });
  var touchX = null;
  lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (touchX == null) return;
    var dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', function (e) {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') stepLightbox(1);
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'Tab') { // keep focus inside
        var f = lb.querySelectorAll('button, a, iframe, video'); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    } else if (e.key === 'Escape') {
      var h = document.getElementById('site-header'); if (h) h.classList.remove('nav-open');
    }
  });

  /* ---------- routing ---------- */
  function currentPage() {
    var id = decodeURIComponent((location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0]);
    var p = null;
    for (var i = 0; i < cfg.pages.length; i++) if (cfg.pages[i].id === id) p = cfg.pages[i];
    return p || cfg.pages[0];
  }
  var routing = false;
  function renderPage(opts) {
    opts = opts || {};
    var page = currentPage(), app = document.getElementById('app');
    var pt = cfg.animations.enabled === false ? 'none' : (cfg.animations.pageTransition || 'fade');
    var doRender = function () {
      galleryStateResetFor(page);
      app.innerHTML = '<div class="page" data-page="' + esc(page.id) + '">' + (page.sections || []).map(renderSection).join('') + '</div>';
      markActiveNav(page.id);
      bindApp(app);
      setupReveal(app, !!opts.instant);
      if (!opts.keepScroll) window.scrollTo(0, 0);
      if (opts.animate && pt !== 'none' && !document.body.classList.contains('reduced-motion')) {
        app.className = 'pt-' + pt + '-in';
        setTimeout(function () { app.className = ''; }, 700 / clamp(num(cfg.animations.speed, 1), 0.2, 4));
      }
      if (IS_PREVIEW) try { window.parent.postMessage({ type: 'sul:route', page: page.id }, location.origin); } catch (e) {}
    };
    if (opts.animate && pt !== 'none' && app.innerHTML && !document.body.classList.contains('reduced-motion')) {
      if (routing) return;
      routing = true;
      app.className = 'pt-' + pt + '-out';
      setTimeout(function () { routing = false; doRender(); }, 260 / clamp(num(cfg.animations.speed, 1), 0.2, 4));
    } else doRender();
  }
  function galleryStateResetFor(page) {
    // keep chosen tab while editing in the admin preview, reset when visitors switch page
    if (IS_PREVIEW) return;
    (page.sections || []).forEach(function (s) { if (s.type === 'gallery') galleryState[s.id] = { cat: 'all', items: [] }; });
  }
  window.addEventListener('hashchange', function () {
    closeLightbox();
    if (!cfg) return;
    renderPage({ animate: true });
  });

  /* ---------- intro ---------- */
  function introSeen() { try { return sessionStorage.getItem('sul.introSeen') === '1'; } catch (e) { return false; } }
  function setIntroSeen() { try { sessionStorage.setItem('sul.introSeen', '1'); } catch (e) {} }
  var introTimer = 0;
  function showIntro(force) {
    var it = cfg.intro, el = document.getElementById('intro');
    if (!force && (!it.enabled || (it.oncePerSession && introSeen()))) { hideIntroNow(); return; }
    introShowing = true;
    var logo = asset(it.logo);
    el.className = 'intro-in la-' + esc(it.logoAnimation || 'float');
    el.style.setProperty('--intro-logo', clamp(num(it.logoSize, 520), 120, 1400) + 'px');
    el.innerHTML =
      (logo ? '<button class="intro-logo-btn" type="button" aria-label="Enter site" data-enter><img class="intro-logo logo-glow" src="' + esc(logo) + '" alt="' + esc(cfg.brand.name) + '"></button>' : '') +
      (it.title ? '<h1 class="intro-title">' + esc(it.title) + '</h1>' : '') +
      (it.subtitle ? '<p class="intro-sub">' + esc(it.subtitle) + '</p>' : '') +
      '<button class="btn intro-enter" type="button" data-enter>' + sparkleText(it.buttonText || 'ENTER') + '</button>';
    el.hidden = false;
    document.body.classList.add('intro-active', 'lock-scroll');
    el.querySelectorAll('[data-enter]').forEach(function (b) { b.addEventListener('click', enterSite); });
    var btn = el.querySelector('.intro-enter'); if (btn) setTimeout(function () { try { btn.focus({ preventScroll: true }); } catch (e) {} }, 50);
    clearTimeout(introTimer);
    var auto = num(it.autoEnterSeconds, 0);
    if (auto > 0) introTimer = setTimeout(enterSite, auto * 1000);
  }
  function hideIntroNow() {
    var el = document.getElementById('intro');
    el.hidden = true; el.innerHTML = ''; el.className = '';
    introShowing = false;
    document.body.classList.remove('intro-active');
    if (lb.hidden) document.body.classList.remove('lock-scroll');
  }
  function enterSite(e) {
    if (!introShowing) return;
    clearTimeout(introTimer);
    var it = cfg.intro, el = document.getElementById('intro');
    setIntroSeen();
    if (it.showSparkleBurst !== false && window.SulFX) {
      var r = e && e.currentTarget && e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
      window.SulFX.burst(r.left + r.width / 2, r.top + r.height / 2, 60);
    }
    var exit = it.exitAnimation || 'zoom';
    var finish = function () {
      if (!introShowing) return;
      hideIntroNow();
      setupReveal(document.getElementById('app'), false);
    };
    if (exit === 'none' || cfg.animations.enabled === false || document.body.classList.contains('reduced-motion')) { finish(); return; }
    // reveal site underneath while the intro animates away
    document.body.classList.remove('intro-active');
    el.classList.add('exit-' + exit);
    el.addEventListener('animationend', function h(ev) { if (ev.target === el) { el.removeEventListener('animationend', h); finish(); } });
    setTimeout(finish, 1600 / clamp(num(cfg.animations.speed, 1), 0.2, 4));
  }

  /* ---------- secret admin entrance ---------- */
  // Tap the logo several times fast, or type the secret word -> password box.
  // The admin address is stored encrypted, so it can only be read with the right password.
  function validLock(l) { return !!(l && l.salt && l.iv && l.ct && l.iter); }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var taps = [], typed = '', gateEl = null;
  document.addEventListener('click', function (e) {
    if (IS_PREVIEW || !cfg || !validLock(cfg.admin)) return;
    var n = Math.round(num(cfg.adminEntry && cfg.adminEntry.taps, 5));
    if (!n || !e.target.closest('.brand, .footer-logo')) return;
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 3000; }); taps.push(now);
    if (taps.length >= n) { taps = []; e.preventDefault(); openGate(); }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (IS_PREVIEW || !cfg || !validLock(cfg.admin) || gateEl) return;
    var w = String((cfg.adminEntry && cfg.adminEntry.word) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!w || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    typed = (typed + e.key.toLowerCase()).slice(-30);
    if (typed.slice(-w.length) === w) { typed = ''; openGate(); }
  });
  function fails() { try { return JSON.parse(localStorage.getItem('sul.fails') || '{"n":0,"until":0}'); } catch (e) { return { n: 0, until: 0 }; } }
  function setFails(f) { try { localStorage.setItem('sul.fails', JSON.stringify(f)); } catch (e) {} }
  function closeGate() { if (gateEl) { gateEl.remove(); gateEl = null; if (lb.hidden && !introShowing) document.body.classList.remove('lock-scroll'); } }
  function openGate() {
    if (gateEl || !(window.crypto && crypto.subtle)) return;
    var lock = cfg.admin;
    gateEl = document.createElement('div');
    gateEl.id = 'admin-gate';
    gateEl.setAttribute('role', 'dialog'); gateEl.setAttribute('aria-modal', 'true'); gateEl.setAttribute('aria-label', 'Admin login');
    gateEl.innerHTML = '<form class="ag-box" autocomplete="on">' +
      '<div class="ag-lock">🔒</div><h2>Studio</h2>' +
      '<input type="text" name="username" autocomplete="username" value="sul-admin" hidden>' +
      '<input type="password" class="ag-pw" autocomplete="current-password" placeholder="Password" aria-label="Password">' +
      '<button class="btn" type="submit">Unlock</button><p class="ag-msg" aria-live="polite"></p></form>';
    document.body.appendChild(gateEl);
    document.body.classList.add('lock-scroll');
    var form = gateEl.querySelector('form'), pw = gateEl.querySelector('.ag-pw'), msg = gateEl.querySelector('.ag-msg'), btn = gateEl.querySelector('button');
    setTimeout(function () { pw.focus(); }, 30);
    gateEl.addEventListener('click', function (e) { if (e.target === gateEl) closeGate(); });
    gateEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeGate(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = fails();
      if (f.until > Date.now()) { msg.textContent = 'Too many tries — wait ' + Math.ceil((f.until - Date.now()) / 1000) + 's.'; return; }
      if (!pw.value) return;
      btn.disabled = true; msg.textContent = '…';
      var key;
      crypto.subtle.importKey('raw', new TextEncoder().encode(pw.value), 'PBKDF2', false, ['deriveKey']).then(function (base) {
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(lock.salt), iterations: lock.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      }).then(function (k) {
        key = k;
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(lock.iv) }, k, unb64(lock.ct));
      }).then(function (pt) {
        var data = JSON.parse(new TextDecoder().decode(pt));
        var path = String(data.path || '');
        if (!/^\/[A-Za-z0-9._~\-\/]*$/.test(path) || path.indexOf('//') >= 0) throw new Error('bad path');
        setFails({ n: 0, until: 0 });
        return crypto.subtle.exportKey('raw', key).then(function (raw) {
          try { sessionStorage.setItem('sul.adminKey', JSON.stringify({ k: b64(new Uint8Array(raw)), salt: lock.salt })); } catch (x) {}
          msg.textContent = '✦';
          location.href = path;
        });
      }).catch(function () {
        var f2 = fails(); f2.n++; if (f2.n >= 5) f2.until = Date.now() + Math.min(900, 30 * Math.pow(2, f2.n - 5)) * 1000; setFails(f2);
        btn.disabled = false; pw.value = ''; pw.focus(); msg.textContent = 'Wrong password.';
        form.classList.remove('ag-shake'); void form.offsetWidth; form.classList.add('ag-shake');
      });
    });
  }

  /* ---------- boot ---------- */
  function normalize(raw) {
    var c = merge(DEFAULTS, raw || {});
    ['socials', 'pages', 'kits', 'galleryCategories', 'gallery', 'reviews'].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = DEFAULTS[k]; });
    if (!c.pages.length) c.pages = DEFAULTS.pages;
    c.pages.forEach(function (p, i) {
      if (!p.id) p.id = 'page-' + (i + 1);
      if (!Array.isArray(p.sections)) p.sections = [];
      p.sections.forEach(function (s, j) { if (!s.id) s.id = p.id + '-s' + j; });
    });
    return c;
  }
  function renderAll(raw, opts) {
    opts = opts || {};
    cfg = normalize(raw);
    applyTheme();
    renderAnnouncement();
    renderHeader();
    renderFooter();
    renderPage({ instant: opts.instant, keepScroll: opts.keepScroll });
    document.body.classList.remove('is-loading');
  }
  function fail(msg) {
    document.body.classList.remove('is-loading');
    document.getElementById('app').innerHTML = '<div class="section"><div class="wrap panel a-center"><h2 class="sec-title">Oops</h2><p>' + esc(msg) + '</p></div></div>';
  }

  if (IS_PREVIEW) {
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
      var d = e.data;
      if (d.type === 'sul:config') {
        assetMap = d.assets || {};
        var wasFirst = firstRender; firstRender = false;
        renderAll(d.config, { instant: !wasFirst && !d.replay, keepScroll: !wasFirst });
        if (d.replay) { window.scrollTo(0, 0); setupReveal(document.getElementById('app'), false); }
      } else if (d.type === 'sul:intro') {
        if (cfg) showIntro(true);
      } else if (d.type === 'sul:goto') {
        if (cfg) location.hash = d.page === cfg.pages[0].id ? '#/' : '#/' + encodeURIComponent(d.page);
      } else if (d.type === 'sul:scrollto') {
        var el = document.querySelector('[data-sid="' + cssEsc(d.sid) + '"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    window.parent.postMessage({ type: 'sul:ready' }, location.origin);
    return;
  }

  function boot(raw) {
    var n = normalize(raw);
    introShowing = !!(n.intro.enabled && !(n.intro.oncePerSession && introSeen()));
    renderAll(raw, {});
    showIntro(false);
  }
  if (IS_DRAFT) {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem('sul.draft') || 'null'); } catch (e) { draft = null; }
    if (draft) { boot(draft); return; }
  }
  fetch('content/site.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(boot)
    .catch(function (err) {
      console.error(err);
      fail('Could not load content/site.json (' + err.message + '). If you opened index.html straight from your computer, run it through a web server or open the live site.');
    });
})();
