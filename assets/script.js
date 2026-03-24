(() => {
  const SEL = {
    wrap: '.banner .banner-wrap',
    canvas: '.banner .banner-canvas',
    map: '.banner .banner-map',
    logo: '.banner .banner-logo-p1',
  };

  // Guangzhou marker position on the map (tweak if needed)
  // Values are percentages of the banner area.
  const GZ = { x: 78.5, y: 42.0 };

  function ensureGuangzhouMarker(wrap) {
    if (!wrap) return;

    // Inject marker CSS once (scoped by class)
    if (!document.getElementById('gz-marker-style')) {
      const style = document.createElement('style');
      style.id = 'gz-marker-style';
      style.textContent = `
        .banner-marker{
          position:absolute;
          width:10px;
          height:10px;
          border-radius:999px;
          background: rgb(255, 60, 60);
          transform: translate(-50%, -50%);
          z-index: 5;
          pointer-events:none;
          box-shadow: 0 0 0 0 rgba(255,60,60,.55);
          animation: gzPulse 1.2s ease-in-out infinite;
        }
        @keyframes gzPulse{
          0%   { opacity: .35; box-shadow: 0 0 0 0 rgba(255,60,60,.55); }
          50%  { opacity: 1;   box-shadow: 0 0 0 10px rgba(255,60,60,0); }
          100% { opacity: .35; box-shadow: 0 0 0 0 rgba(255,60,60,0); }
        }
        @media (prefers-reduced-motion: reduce){
          .banner-marker{ animation:none; opacity:.9; }
        }
      `.trim();
      document.head.appendChild(style);
    }

    let marker = wrap.querySelector('.banner-marker');
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'banner-marker';
      marker.setAttribute('title', 'Guangzhou, Chine');
      marker.setAttribute('aria-label', 'Guangzhou, Chine (base)');
      wrap.appendChild(marker);
    }

    marker.style.left = GZ.x + '%';
    marker.style.top = GZ.y + '%';
  }

  function parsePercent(v, fallback) {
    if (!v) return fallback;
    const s = String(v).trim();
    if (s.endsWith('%')) {
      const n = parseFloat(s.slice(0, -1));
      return Number.isFinite(n) ? n / 100 : fallback;
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : fallback;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load: ' + src));
      img.src = src;
    });
  }

  // === Globe renderer (canvas, equirectangular texture) ===
  let _tex = null; // { w, h, data }
  let _mapImgCache = null;
  let _logoImgCache = null;

  function buildTexture(img) {
    const c = document.createElement('canvas');
    const w = img.width;
    const h = img.height;
    c.width = w;
    c.height = h;
    const cctx = c.getContext('2d', { willReadFrequently: true });
    if (!cctx) return null;
    cctx.drawImage(img, 0, 0);
    const id = cctx.getImageData(0, 0, w, h);
    return { w, h, data: id.data };
  }

  function sampleTex(u, v) {
    // u,v in [0,1)
    if (!_tex) return [0, 0, 0, 0];
    const w = _tex.w;
    const h = _tex.h;
    let x = Math.floor(((u % 1 + 1) % 1) * (w - 1));
    let y = Math.floor(Math.min(0.999999, Math.max(0, v)) * (h - 1));
    const i = (y * w + x) * 4;
    const d = _tex.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  function renderGlobeToCanvas(ctx, W, H, tSec) {
    // Render at reduced resolution then scale up for performance
    const d = Math.max(220, Math.min(420, Math.round(Math.min(W, H) * 0.55)));
    const globeC = document.createElement('canvas');
    globeC.width = d;
    globeC.height = d;
    const gctx = globeC.getContext('2d');
    if (!gctx) return;

    const img = gctx.createImageData(d, d);
    const out = img.data;

    const cx = d / 2;
    const cy = d / 2;
    const R = (d / 2) * 0.98;

    const rot = (tSec / 90) * Math.PI * 2; // one full rotation ~90s

    // Light direction for shading
    const lx = -0.4;
    const ly = 0.15;
    const lz = 0.9;

    for (let y = 0; y < d; y++) {
      const ny = (y - cy) / R;
      for (let x = 0; x < d; x++) {
        const nx = (x - cx) / R;
        const rr = nx * nx + ny * ny;
        const p = (y * d + x) * 4;

        if (rr > 1) {
          out[p + 3] = 0;
          continue;
        }

        const z = Math.sqrt(1 - rr);

        // Sphere coordinates (fix upside-down texture)
        const lat = Math.asin(ny);
        let lon = Math.atan2(nx, z);
        lon += rot;

        const u = (lon / (Math.PI * 2)) + 0.5;
        const v = 0.5 + (lat / Math.PI);

        const [r0, g0, b0, a0] = sampleTex(u, v);
        if (a0 === 0) {
          out[p + 3] = 0;
          continue;
        }

        // Hologram tint + shading
        const ndotl = Math.max(0, (nx * lx + ny * ly + z * lz));
        const shade = 0.35 + 0.65 * ndotl;
        const rim = Math.pow(1 - z, 2.2);

        // Cyan/blue hologram mix (subtle)
        const hr = (r0 * 0.25 + 40) * shade;
        const hg = (g0 * 0.55 + 140) * shade;
        const hb = (b0 * 0.85 + 210) * shade;

        out[p] = Math.min(255, hr + rim * 90);
        out[p + 1] = Math.min(255, hg + rim * 120);
        out[p + 2] = Math.min(255, hb + rim * 160);

        // Alpha for globe pixel
        out[p + 3] = 255;
      }
    }

    gctx.putImageData(img, 0, 0);

    // Scanlines (futuristic)
    gctx.save();
    gctx.globalAlpha = 0.18;
    gctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = 0; y < d; y += 3) {
      gctx.fillRect(0, y, d, 1);
    }
    gctx.restore();

    // Globe fitted to banner: NO overflow on any side.
    // We use a circle that fits within the banner bounds.
    const Rfit = Math.min(W, H) * 0.49; // ~98% of half of the limiting dimension

    const x0 = (W / 2) - Rfit;
    const y0 = (H / 2) - Rfit; // centered, no overflow

    ctx.save();
    ctx.globalAlpha = 0.3; // adjusted opacity for globe/map
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(globeC, x0, y0, Rfit * 2, Rfit * 2);

    // Soft edge fade (circular) so you DON'T see a clean border
    ctx.globalCompositeOperation = 'destination-in';
    const m = ctx.createRadialGradient(W / 2, H / 2, Rfit * 0.65, W / 2, H / 2, Rfit * 1.02);
    m.addColorStop(0, 'rgba(255,255,255,1)');
    m.addColorStop(0.80, 'rgba(255,255,255,1)');
    m.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();

    // Return projection info so we can place Guangzhou on the globe
    return { rot, centerX: W / 2, centerY: H / 2, R: Rfit };
  }

  function drawGuangzhouOnGlobe(ctx, globeInfo, tSec) {
    if (!globeInfo) return;

    // Guangzhou approx: lat 23.13N, lon 113.26E
    const lat = 23.13 * (Math.PI / 180);
    const lon = 113.26 * (Math.PI / 180) + globeInfo.rot;

    const x = Math.cos(lat) * Math.sin(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(lon);

    // If behind the globe, don't draw
    if (z < 0) return;

    const sx = globeInfo.centerX + x * globeInfo.R;
    const sy = globeInfo.centerY - y * globeInfo.R;

    const pulse = 0.35 + 0.65 * Math.pow(Math.sin((tSec * Math.PI * 2) / 1.2), 2);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Core dot
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgb(255, 60, 60)';
    ctx.beginPath();
    ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Expanding ring
    ctx.globalAlpha = 0.35 * pulse;
    ctx.strokeStyle = 'rgba(255,60,60,0.9)';
    ctx.lineWidth = 1;
    const ring = 6 + 8 * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, ring, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // Inside contour: contour = original - eroded(original)
  function computeInsideContourAlpha(origAlpha, w, h, radius, threshold) {
    const eroded = new Uint8ClampedArray(w * h);
    const r2 = radius * radius;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = origAlpha[i];
        if (a <= threshold) {
          eroded[i] = 0;
          continue;
        }

        let ok = true;
        for (let dy = -radius; dy <= radius && ok; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) { ok = false; break; }
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const xx = x + dx;
            if (xx < 0 || xx >= w) { ok = false; break; }
            const j = yy * w + xx;
            if (origAlpha[j] <= threshold) { ok = false; break; }
          }
        }
        eroded[i] = ok ? 255 : 0;
      }
    }

    const contour = new Uint8ClampedArray(w * h);
    for (let i = 0; i < w * h; i++) {
      const c = origAlpha[i] - eroded[i];
      contour[i] = c > 0 ? c : 0;
    }
    return contour;
  }

  async function render(tSec = 0) {
    const wrap = document.querySelector(SEL.wrap);
    const canvas = document.querySelector(SEL.canvas);
    const mapEl = document.querySelector(SEL.map);
    const logoEl = document.querySelector(SEL.logo);
    if (!wrap || !canvas || !mapEl || !logoEl) return;

    // Read variables from CSS
    const cs = getComputedStyle(wrap);
    const logoSize = parsePercent(cs.getPropertyValue('--logoSize'), 0.6);
    const offX = parsePercent(cs.getPropertyValue('--logoOffsetX'), 0.0);
    const offY = parsePercent(cs.getPropertyValue('--logoOffsetY'), 0.0);

    // Banner size (keeps correct aspect ratio from the fallback map element)
    const rect = mapEl.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width));
    const H = Math.max(1, Math.round(rect.height));

    // HiDPI
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Load bitmaps once
    if (!_mapImgCache || !_logoImgCache) {
      const [mapImg, logoImg] = await Promise.all([
        loadImage(mapEl.currentSrc || mapEl.src),
        loadImage(logoEl.currentSrc || logoEl.src),
      ]);
      _mapImgCache = mapImg;
      _logoImgCache = logoImg;
      _tex = buildTexture(_mapImgCache);
    }

    // 1) Draw rotating hologram globe (replaces flat map)
    const globeInfo = renderGlobeToCanvas(ctx, W, H, tSec);

    // 2) Punch the logo hole on top of the globe
    const logoW = W * logoSize;
    const scale = logoW / _logoImgCache.width;
    const logoH = _logoImgCache.height * scale;

    const cx = W * (0.5 + offX - 0.05);
    const cy = H * (0.5 + offY + 0.05);
    const x = cx - logoW / 2;
    const y = cy - logoH / 2;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(_logoImgCache, x, y, logoW, logoH);
    ctx.restore();

    // 3) Thinner inside contour (opacity 0.2)
    const lw = Math.max(1, Math.round(logoW));
    const lh = Math.max(1, Math.round(logoH));

    const offC = document.createElement('canvas');
    offC.width = lw;
    offC.height = lh;
    const octx = offC.getContext('2d');
    if (!octx) return;

    octx.clearRect(0, 0, lw, lh);
    octx.drawImage(_logoImgCache, 0, 0, lw, lh);

    const imgData = octx.getImageData(0, 0, lw, lh);
    const data = imgData.data;

    const alpha = new Uint8ClampedArray(lw * lh);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) alpha[p] = data[i + 3];

    const radius = Math.max(1, Math.round(Math.min(lw, lh) * 0.002));
    const threshold = 12;
    const contourAlpha = computeInsideContourAlpha(alpha, lw, lh, radius, threshold);

    const contour = octx.createImageData(lw, lh);
    const cd = contour.data;
    // Base contour color: match the hologram globe tint so it blends with the map (opacity still controlled by ctx.globalAlpha = 0.2)
    const rr = 60, gg = 200, bb = 255;

    for (let p = 0, i = 0; p < lw * lh; p++, i += 4) {
      const a = contourAlpha[p];
      if (!a) {
        cd[i + 3] = 0;
        continue;
      }
      cd[i] = rr;
      cd[i + 1] = gg;
      cd[i + 2] = bb;
      cd[i + 3] = Math.min(255, Math.round(a * 0.95));
    }

    octx.clearRect(0, 0, lw, lh);
    octx.putImageData(contour, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // --- Base contour (very subtle so it blends into the brighter map) ---
    ctx.globalAlpha = 0.18;
    ctx.filter = 'none';
    ctx.drawImage(offC, x, y, logoW, logoH);

    // --- Animated LED sweep over contour ---
    // Create temporary canvas same size as contour
    const sweepC = document.createElement('canvas');
    sweepC.width = lw;
    sweepC.height = lh;
    const sctx = sweepC.getContext('2d');
    if (sctx) {
      // Draw contour mask
      sctx.drawImage(offC, 0, 0);

      // Moving light position (slow sweep)
      const sweepPos = (tSec * 0.4) % 1; // speed factor (lower = slower)
      const gradX = sweepPos * lw;

      const grad = sctx.createLinearGradient(gradX - lw * 0.25, 0, gradX + lw * 0.25, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,1.0)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.0)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      // Clip gradient to contour shape
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, lw, lh);

      // Additive blend for LED effect
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.70;
      ctx.drawImage(sweepC, x, y, logoW, logoH);
    }

    ctx.restore();

    // 4) Guangzhou marker on the globe surface
    // drawGuangzhouOnGlobe(ctx, globeInfo, tSec);

    // Keep fallback map hidden
    mapEl.style.opacity = '0';
  }

  let raf = 0;
  let t0 = 0;

  function tick(ts) {
    if (!t0) t0 = ts;
    const tSec = (ts - t0) / 1000;

    render(tSec).catch(() => {
      // Fallback: show the plain map at 0.2 if canvas fails
      const mapEl = document.querySelector(SEL.map);
      if (mapEl) mapEl.style.opacity = '0.2';
    });

    raf = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(raf);
    t0 = 0;
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('load', start);
  window.addEventListener('resize', start);
})();

// === Premium scroll reveal animations ===
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  function mark(el, cls = 'reveal', delay = 0) {
    if (!el || el.classList.contains('reveal-bound')) return;
    el.classList.add('reveal-bound', 'reveal', cls);
    el.style.setProperty('--reveal-delay', `${delay}ms`);
  }

  function setupRevealTargets() {
    // Hero columns
    document.querySelectorAll('.hero-grid > *').forEach((el, i) => {
      mark(el, i === 0 ? 'reveal-left' : 'reveal-right', i * 120);
    });

    // Section headers and intro paragraphs
    document.querySelectorAll('.section').forEach((section) => {
      const title = section.querySelector('h2');
      const intro = section.querySelector('p');
      if (title) mark(title, 'reveal-up', 0);
      if (intro && intro !== title) mark(intro, 'reveal-up', 80);
    });

    // Dividers
    document.querySelectorAll('.neon-divider').forEach((el) => {
      mark(el, 'reveal-divider', 0);
    });

    // Cards and service items with stagger
    document.querySelectorAll('.grid').forEach((grid) => {
      const items = grid.querySelectorAll('.card, .service');
      items.forEach((item, i) => mark(item, 'reveal-up', 90 + i * 70));
    });

    // Split layout left/right alternation
    document.querySelectorAll('.split').forEach((split) => {
      const children = split.querySelectorAll(':scope > *');
      children.forEach((child, i) => {
        mark(child, i % 2 === 0 ? 'reveal-left' : 'reveal-right', i * 120);
      });
    });

    // Buttons / badges blocks
    document.querySelectorAll('.btns, .badges').forEach((el, i) => {
      mark(el, 'reveal-up', 140 + i * 40);
    });

    // Generic visual placeholders
    document.querySelectorAll('[style*="height:180px"], [style*="height:170px"], [style*="height:200px"], [style*="min-height:320px"]').forEach((el, i) => {
      mark(el, 'reveal-scale', 80 + (i % 3) * 60);
    });
  }

  function initReveal() {
    setupRevealTargets();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.14,
      rootMargin: '0px 0px -8% 0px'
    });

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal, { once: true });
  } else {
    initReveal();
  }
})();
// === Homepage services carousel ===
(() => {
  const carousel = document.querySelector('.services-carousel');
  if (!carousel) return;

  const track = carousel.querySelector('.services-carousel-track');
  const prevBtn = carousel.querySelector('.services-carousel-btn.prev');
  const nextBtn = carousel.querySelector('.services-carousel-btn.next');
  const originalCards = Array.from(track.querySelectorAll('.service'));
  if (!track || !prevBtn || !nextBtn || !originalCards.length) return;

  const visibleCount = () => (window.innerWidth <= 920 ? 1 : 3);

  function cloneForLoop() {
    track.querySelectorAll('.clone').forEach((el) => el.remove());

    const count = visibleCount();
    const headClones = originalCards.slice(0, count).map((card) => {
      const clone = card.cloneNode(true);
      clone.classList.add('clone');
      return clone;
    });

    const tailClones = originalCards.slice(-count).map((card) => {
      const clone = card.cloneNode(true);
      clone.classList.add('clone');
      return clone;
    });

    tailClones.forEach((clone) => track.insertBefore(clone, track.firstChild));
    headClones.forEach((clone) => track.appendChild(clone));
  }

  let index = 0;
  let cardStep = 0;
  let isAnimating = false;

  function measure() {
    const firstCard = track.querySelector('.service');
    if (!firstCard) return;
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.gap || styles.columnGap || '0');
    cardStep = firstCard.getBoundingClientRect().width + gap;
  }

  function jumpToIndex(withTransition = false) {
    track.style.transition = withTransition ? 'transform 0.45s ease' : 'none';
    const count = visibleCount();
    const offsetIndex = index + count;
    track.style.transform = `translateX(-${offsetIndex * cardStep}px)`;
  }

  function setup() {
    cloneForLoop();
    measure();
    index = 0;
    jumpToIndex(false);
  }

  function move(dir) {
    if (isAnimating) return;
    isAnimating = true;
    index += dir;
    jumpToIndex(true);
  }

  track.addEventListener('transitionend', () => {
    if (index >= originalCards.length) {
      index = 0;
      jumpToIndex(false);
    }

    if (index < 0) {
      index = originalCards.length - 1;
      jumpToIndex(false);
    }

    isAnimating = false;
  });

  prevBtn.addEventListener('click', () => move(-1));
  nextBtn.addEventListener('click', () => move(1));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setup();
    }, 120);
  });

  setup();
})();
// === Load Header and Footer ===
(() => {
  function bindHeaderMenu(root = document) {
    const headerRoot = root.querySelector ? (root.querySelector('header') ? root : root.querySelector('header')) : null;
    const scope = headerRoot || document;
    const menuToggle = scope.querySelector('.menu-toggle');
    const navlinks = scope.querySelector('.navlinks');
    const dropdownToggles = scope.querySelectorAll('.nav-dropdown-toggle');

    if (!menuToggle || !navlinks || menuToggle.dataset.bound === 'true') return;

    menuToggle.dataset.bound = 'true';

    menuToggle.addEventListener('click', () => {
      navlinks.classList.toggle('open');
      menuToggle.classList.toggle('open');
      const expanded = navlinks.classList.contains('open');
      menuToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });

    dropdownToggles.forEach((toggle) => {
      toggle.addEventListener('click', (event) => {
        if (window.innerWidth > 920) return;
        event.preventDefault();
        const parent = toggle.closest('.nav-dropdown');
        if (!parent) return;
        parent.classList.toggle('open');
      });
    });

    document.addEventListener('click', (event) => {
      const header = scope.querySelector('header') || document.querySelector('header');
      if (!header) return;
      if (header.contains(event.target)) return;

      navlinks.classList.remove('open');
      menuToggle.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      scope.querySelectorAll('.nav-dropdown.open').forEach((item) => item.classList.remove('open'));
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 920) {
        navlinks.classList.remove('open');
        menuToggle.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        scope.querySelectorAll('.nav-dropdown.open').forEach((item) => item.classList.remove('open'));
      }
    });
  }

  function loadComponent(url, placeholderId, onLoad) {
    fetch(url)
      .then((response) => response.text())
      .then((data) => {
        const placeholder = document.getElementById(placeholderId);
        if (!placeholder) return;
        placeholder.innerHTML = data;
        if (typeof onLoad === 'function') onLoad(placeholder);
      })
      .catch((error) => console.error(`Error loading ${url}:`, error));
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header.html', 'header-placeholder', bindHeaderMenu);
    loadComponent('footer.html', 'footer-placeholder');
  });
})();
// === Shared topbar/header behavior ===
(() => {
  const placeholder = document.getElementById('header-placeholder');
  if (!placeholder) return;

  function updateSharedHeaderState() {
    const header = placeholder.querySelector('header');
    if (!header) return;

    const topbar = placeholder.querySelector('.topbar');
    const topbarVisible = topbar && window.getComputedStyle(topbar).display !== 'none';
    const threshold = topbarVisible ? topbar.offsetHeight : 0;
    const shouldFix = window.scrollY > threshold;

    placeholder.classList.toggle('header-fixed', shouldFix);
  }

  function bindWhenReady() {
    const header = placeholder.querySelector('header');
    if (!header) return false;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        updateSharedHeaderState();
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateSharedHeaderState);
    window.addEventListener('load', updateSharedHeaderState);
    updateSharedHeaderState();
    return true;
  }

  if (bindWhenReady()) return;

  const observer = new MutationObserver(() => {
    if (!bindWhenReady()) return;
    observer.disconnect();
  });

  observer.observe(placeholder, { childList: true, subtree: true });
})();