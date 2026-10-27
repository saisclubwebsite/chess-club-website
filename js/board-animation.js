// Scroll-driven chess animation, drawn in code (no video frames).
//
// Scroll progress (0–1) through .scroll-animation is a pure function of the
// scene: the board swings into view, all 32 pieces drop into place, then
// Légal's mate plays out move by move and the camera settles overhead.
// Scrolling back rewinds everything exactly.
(function () {
  const section = document.querySelector('.scroll-animation');
  const canvas = document.getElementById('boardCanvas');
  if (!section || !canvas) return;
  const ctx = canvas.getContext('2d');
  const ticker = document.querySelector('.move-ticker');
  const cards = [...document.querySelectorAll('.annotation-card')];

  const COLORS = {
    light: '#ebd9b9', dark: '#b88a5c',
    frameTop: '#8b5e3c', frameSide: '#6e4a2f', frameLabel: 'rgba(246, 239, 227, 0.85)',
    whiteFill: '#fbf6ec', blackFill: '#2b3a4f', stroke: '#1f2d3d',
    lastMove: 'rgba(62, 110, 158, 0.38)', check: 'rgba(200, 105, 90, 0.55)',
    shadow: 'rgba(31, 45, 61, 0.22)',
  };
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const PIECE_FONT = '"Noto Sans Symbols 2", "Segoe UI Symbol", serif';

  // ---------- Timeline ----------
  const SETUP_START = 0.03, SETUP_END = 0.24;
  const GAME_START = 0.30, GAME_END = 0.80;
  const OVERHEAD_START = 0.80, OVERHEAD_END = 0.90;

  // Légal's mate: 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6 5.Nxe5 Bxd1 6.Bxf7+ Ke7 7.Nd5#
  const MOVES = [
    ['e2', 'e4', '1. e4'], ['e7', 'e5', '1… e5'],
    ['g1', 'f3', '2. Nf3'], ['d7', 'd6', '2… d6'],
    ['f1', 'c4', '3. Bc4'], ['c8', 'g4', '3… Bg4'],
    ['b1', 'c3', '4. Nc3'], ['g7', 'g6', '4… g6'],
    ['f3', 'e5', '5. Nxe5!'], ['g4', 'd1', '5… Bxd1'],
    ['c4', 'f7', '6. Bxf7+'], ['e8', 'e7', '6… Ke7'],
    ['c3', 'd5', '7. Nd5#'],
  ];
  const PLY = (GAME_END - GAME_START) / MOVES.length;

  const sq = (s) => [s.charCodeAt(0) - 97, +s[1] - 1];

  // Pieces in drop order: white back rank, white pawns, black pawns, black back rank
  const BACK = 'rnbqkbnr';
  const pieces = [];
  for (let f = 0; f < 8; f++) pieces.push({ type: BACK[f], white: true, start: [f, 0] });
  for (let f = 0; f < 8; f++) pieces.push({ type: 'p', white: true, start: [f, 1] });
  for (let f = 0; f < 8; f++) pieces.push({ type: 'p', white: false, start: [f, 6] });
  for (let f = 0; f < 8; f++) pieces.push({ type: BACK[f], white: false, start: [f, 7] });

  // snapshots[k] = position before ply k (array of [file, rank] or null if captured)
  const snapshots = [pieces.map((p) => p.start.slice())];
  const plyInfo = [];
  MOVES.forEach(([from, to]) => {
    const pos = snapshots[snapshots.length - 1].map((s) => (s ? s.slice() : null));
    const [ff, fr] = sq(from), [tf, tr] = sq(to);
    const mover = pos.findIndex((s) => s && s[0] === ff && s[1] === fr);
    const victim = pos.findIndex((s) => s && s[0] === tf && s[1] === tr);
    plyInfo.push({ mover, victim, from: [ff, fr], to: [tf, tr] });
    pos[mover] = [tf, tr];
    if (victim >= 0) pos[victim] = null;
    snapshots.push(pos);
  });
  const blackKing = pieces.findIndex((p) => p.type === 'k' && !p.white);

  // ---------- Easing helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (p, a, b) => clamp((p - a) / (b - a));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBounce = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };

  // ---------- Camera ----------
  let W = 0, H = 0, dpr = 1;
  const cam = { yaw: 0, tilt: 0, zoom: 1, cx: 0, cy: 0, unit: 1 };
  const DIST = 22;

  function camera(p) {
    const intro = easeOutCubic(span(p, 0, SETUP_END));
    const game = easeInOut(span(p, SETUP_END, GAME_START + 0.1));
    const over = easeInOut(span(p, OVERHEAD_START, OVERHEAD_END));
    cam.yaw = lerp(lerp(-0.75, -0.22, intro), 0, game);
    cam.tilt = lerp(lerp(1.12, 0.98, intro), 0.0, over);
    cam.tilt = lerp(cam.tilt, cam.tilt - 0.12 * (1 - over), game);
    const mobile = W < 768;
    cam.zoom = lerp(lerp(0.8, 1, intro), mobile ? 1.18 : 0.84, over);
    const fit = Math.min(W, H * (mobile ? 1 : 0.92));
    cam.unit = (fit / 10.4) * cam.zoom * (mobile ? 0.84 : 1);
    cam.cx = W / 2;
    // Leave room for the ticker on top and compact cards at the bottom on phones
    cam.cy = H / 2 + (mobile ? -H * 0.03 : H * 0.02);
  }

  // World: x = file - 3.5, z = rank - 3.5 (rank 1 nearest the viewer), y = height
  function project(x, y, z) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const xr = x * cy - z * sy;
    const zr = x * sy + z * cy;
    const ct = Math.cos(cam.tilt), st = Math.sin(cam.tilt);
    const up = zr * ct + y * st;
    const depth = DIST + zr * st - y * ct;
    const s = DIST / depth;
    return { x: cam.cx + xr * s * cam.unit, y: cam.cy - up * s * cam.unit, s, depth };
  }

  function poly(points, fill) {
    ctx.beginPath();
    points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function squareQuad(f, r, inset = 0) {
    const x0 = f - 4 + inset, x1 = f - 3 - inset, z0 = r - 4 + inset, z1 = r - 3 - inset;
    return [project(x0, 0, z0), project(x1, 0, z0), project(x1, 0, z1), project(x0, 0, z1)];
  }

  function drawBoard(highlights) {
    const E = 4.55, T = 0.38;
    const top = [[-E, -E], [E, -E], [E, E], [-E, E]];
    // Side faces first; the top face covers the far ones
    for (let i = 0; i < 4; i++) {
      const [ax, az] = top[i], [bx, bz] = top[(i + 1) % 4];
      poly([project(ax, 0, az), project(bx, 0, bz), project(bx, -T, bz), project(ax, -T, az)], COLORS.frameSide);
    }
    poly(top.map(([x, z]) => project(x, 0, z)), COLORS.frameTop);

    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        poly(squareQuad(f, r), (f + r) % 2 === 0 ? COLORS.dark : COLORS.light);
      }
    }
    highlights.forEach(([f, r, color]) => poly(squareQuad(f, r), color));

    // Coordinates on the frame
    ctx.fillStyle = COLORS.frameLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const a = project(i - 3.5, 0, -4.28);
      ctx.font = `600 ${Math.max(8, 0.24 * cam.unit * a.s)}px "JetBrains Mono", monospace`;
      ctx.fillText('abcdefgh'[i], a.x, a.y);
      const b = project(-4.28, 0, i - 3.5);
      ctx.font = `600 ${Math.max(8, 0.24 * cam.unit * b.s)}px "JetBrains Mono", monospace`;
      ctx.fillText(String(i + 1), b.x, b.y);
    }
  }

  function drawPiece(piece, x, y, z, alpha, scale) {
    if (alpha <= 0) return;
    const base = project(x, 0, z);
    const head = project(x, y + 0.42 * Math.sin(cam.tilt) * 1.2, z);
    const size = 0.92 * cam.unit * head.s * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Shadow shrinks as the piece rises
    const shadowScale = 1 / (1 + y * 0.6);
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, size * 0.32 * shadowScale, size * 0.32 * shadowScale * Math.max(0.35, Math.cos(cam.tilt)), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${size}px ${PIECE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gx = head.x, gy = head.y - size * 0.06;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.strokeStyle = COLORS.stroke;
    ctx.fillStyle = piece.white ? COLORS.whiteFill : COLORS.blackFill;
    ctx.strokeText(GLYPH[piece.type] + '︎', gx, gy);
    ctx.fillText(GLYPH[piece.type] + '︎', gx, gy);
    ctx.restore();
  }

  function render(p) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    camera(p);

    // Which ply are we in, and how far through it?
    const g = (p - GAME_START) / PLY;
    const plyIndex = clamp(Math.floor(g), 0, MOVES.length);
    const plyT = p < GAME_START ? 0 : p >= GAME_END ? 1 : easeInOut(clamp(g - Math.floor(g)));
    const done = p >= GAME_END ? MOVES.length : p < GAME_START ? 0 : plyIndex;
    const pos = snapshots[done];
    const active = p >= GAME_START && p < GAME_END ? plyInfo[plyIndex] : null;

    const highlights = [];
    const last = active && plyT > 0.5 ? active : done > 0 ? plyInfo[done - 1] : null;
    if (last) {
      highlights.push([...last.from, COLORS.lastMove], [...last.to, COLORS.lastMove]);
    }
    // Check on 6. Bxf7+ and mate on 7. Nd5#
    const checked = (done === 11) || (done >= 13) || (active && (plyIndex === 10 || plyIndex === 12) && plyT > 0.85);
    if (checked) {
      const k = (active && plyIndex === 11 ? snapshots[11] : pos)[blackKing];
      if (k) highlights.push([...k, COLORS.check]);
    }
    drawBoard(highlights);

    // Gather drawable pieces
    const list = [];
    pieces.forEach((piece, i) => {
      // Drop-in during setup
      const delay = SETUP_START + (i / pieces.length) * (SETUP_END - SETUP_START) * 0.7;
      const t = span(p, delay, delay + (SETUP_END - SETUP_START) * 0.3);
      if (t <= 0) return;
      let [f, r] = pos[i] || [];
      let y = (1 - easeOutBounce(t)) * 3.2;
      let alpha = clamp(t * 4);
      let scale = 1;

      if (active) {
        if (i === active.mover) {
          f = lerp(active.from[0], active.to[0], plyT);
          r = lerp(active.from[1], active.to[1], plyT);
          y += Math.sin(Math.PI * plyT) * (piece.type === 'n' ? 1.1 : 0.55);
        } else if (i === active.victim) {
          [f, r] = active.to;
          const k = span(plyT, 0.72, 1);
          alpha *= 1 - k;
          scale = 1 - 0.4 * k;
        }
      }
      if (f === undefined) return; // captured
      const x = f - 3.5, z = r - 3.5;
      list.push({ piece, x, y, z, alpha, scale, depth: project(x, 0, z).depth });
    });
    list.sort((a, b) => b.depth - a.depth);
    list.forEach((d) => drawPiece(d.piece, d.x, d.y, d.z, d.alpha, d.scale));

    // Ticker
    if (ticker) {
      const shown = active && plyT > 0.15 ? plyIndex + 1 : done;
      const visible = p >= GAME_START - 0.005 && shown > 0;
      ticker.classList.toggle('visible', visible);
      if (visible) ticker.textContent = MOVES[shown - 1][2];
    }
  }

  // ---------- Scroll mapping, cards, snap-stop ----------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOLD_DURATION = 650;
  const zones = cards.map((card) => ({
    show: parseFloat(card.dataset.show),
    hide: parseFloat(card.dataset.hide),
    snap: parseFloat(card.dataset.snap),
    armed: true,
  }));
  let holding = false;
  let lastProgress = null;

  function sectionProgress() {
    const rect = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    return clamp(-rect.top / scrollable);
  }
  function scrollToProgress(p) {
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + p * (section.offsetHeight - window.innerHeight));
  }

  const blockScroll = (e) => { if (holding) e.preventDefault(); };
  const blockKeys = (e) => {
    if (holding && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) e.preventDefault();
  };
  window.addEventListener('wheel', blockScroll, { passive: false });
  window.addEventListener('touchmove', blockScroll, { passive: false });
  window.addEventListener('keydown', blockKeys);

  function updateCards(p) {
    cards.forEach((card, i) => {
      const z = zones[i];
      card.classList.toggle('visible', p >= z.show && p <= z.hide);
      if (reduceMotion || holding || lastProgress === null) return;
      // Snap when the scroll crosses the snap point in either direction
      const crossed = (lastProgress < z.snap && p >= z.snap) || (lastProgress > z.snap && p <= z.snap);
      if (z.armed && crossed) {
        z.armed = false;
        holding = true;
        scrollToProgress(z.snap);
        setTimeout(() => { holding = false; }, HOLD_DURATION);
      }
      if (Math.abs(p - z.snap) > 0.04) z.armed = true;
    });
  }

  let frameProgress = -1;
  let ticking = false;
  function update() {
    ticking = false;
    const p = sectionProgress();
    updateCards(p);
    lastProgress = p;
    if (Math.abs(p - frameProgress) > 1e-5) {
      frameProgress = p;
      render(p);
    }
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    frameProgress = -1;
    update();
  }
  window.addEventListener('resize', resize);
  resize();

  // Redraw once the chess-piece font has loaded so glyphs are consistent
  if (document.fonts) {
    document.fonts.load(`48px ${PIECE_FONT}`, GLYPH.k).then(() => { frameProgress = -1; update(); });
    document.fonts.ready.then(() => { frameProgress = -1; update(); });
  }
})();
