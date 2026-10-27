// Puzzle arcade. An attract screen spins through the board themes; Play
// opens the level map. Each level has its own theme and a harder puzzle,
// and solving a level unlocks the next (progress is kept in localStorage).
//
// A puzzle is a FEN position plus the solution as a list of moves; after
// each correct move the scripted reply (if any) plays automatically. Only
// the solution is checked, so no full move generator is needed.
(function () {
  const LEVELS = [
    {
      world: 'Classic Club',
      theme: { light: '#ebd9b9', dark: '#b88a5c', frame: '#8b5e3c', bg: '#f4ece0', accent: '#8b5e3c' },
      icon: '♟',
      difficulty: 'Beginner',
      title: 'Back-rank blues',
      flavor: 'The clubroom, where every player starts.',
      prompt: "Black's king is boxed in by its own pawns. Find the checkmate.",
      fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
      solution: ['d1d8'],
      done: 'Rd8#. The pawns that were meant to protect the king trap it instead.',
    },
    {
      world: 'Seaside',
      theme: { light: '#f3e7cf', dark: '#6fa3c7', frame: '#3e6e9e', bg: '#e6f0f7', accent: '#2f5f8e' },
      icon: '♝',
      difficulty: 'Easy',
      title: "Scholar's surf",
      flavor: 'Sand between the squares, and a weak spot on f7.',
      prompt: 'Black forgot about f7. Make them pay.',
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      solution: ['h5f7'],
      done: 'Qxf7#. The bishop on c4 guards the queen, so the king has nowhere to go.',
    },
    {
      world: 'Enchanted Forest',
      theme: { light: '#e4ecd6', dark: '#7f9f6a', frame: '#4f6b3f', bg: '#eaf1e3', accent: '#4a6a3a' },
      icon: '♞',
      difficulty: 'Medium',
      title: 'Fork in the woods',
      flavor: 'Knights leap where the paths split.',
      prompt: 'One knight move attacks two pieces at once. Find it, then collect.',
      fen: 'q3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
      solution: ['d5c7', 'e8d8', 'c7a8'],
      done: 'Nc7+ forks the king and queen, and Nxa8 wins the queen.',
    },
    {
      world: 'Ice Palace',
      theme: { light: '#f4f9fd', dark: '#a9c9e2', frame: '#7fa7c6', bg: '#eef5fb', accent: '#4f7fa6' },
      icon: '♛',
      difficulty: 'Tricky',
      title: "Légal's frozen trap",
      flavor: 'White gave up the queen. Was it a blunder, or bait?',
      prompt: "The game from our home page. White's queen is gone, but a knight can end it. Where?",
      fen: 'rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7',
      solution: ['c3d5'],
      done: 'Nd5#. Both knights and the bishop cover every escape square. Checkmate in seven!',
    },
    {
      world: 'Desert Dunes',
      theme: { light: '#f2dfc0', dark: '#cf8f5a', frame: '#9a5a33', bg: '#f6ebdc', accent: '#9a5a33' },
      icon: '♜',
      difficulty: 'Hard · Mate in 2',
      title: 'Smothered in sand',
      flavor: "The king's own army buries him.",
      prompt: 'Mate in 2. Sacrifice something big so a knight can finish the job.',
      fen: '5r1k/pp4pp/7N/3Q4/8/8/5PPP/6K1 w - - 0 1',
      solution: ['d5g8', 'f8g8', 'h6f7'],
      done: "Qg8+! Rxg8 and Nf7#. The king is smothered by its own pieces. That's Philidor's legacy.",
    },
    {
      world: 'Midnight Observatory',
      theme: { light: '#dfe2f3', dark: '#6b74a8', frame: '#2b3158', bg: '#e4e6f3', accent: '#3b4378' },
      icon: '♚',
      difficulty: 'Expert · Mate in 2',
      title: "Morphy's masterpiece",
      flavor: 'Paris, 1858. A night at the opera, written in the stars.',
      prompt: "Mate in 2, the finish of Morphy's famous Opera Game. It starts with a queen sacrifice.",
      fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16',
      solution: ['b3b8', 'd7b8', 'd1d8'],
      done: 'Qb8+!! Nxb8 and Rd8#. You just replayed one of the most famous finishes ever. Arcade complete!',
    },
  ];

  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const STORE_KEY = 'chessclub-arcade-solved';
  const LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

  const $ = (id) => document.getElementById(id);
  const arcade = $('arcade');
  if (!arcade) return;
  const attract = $('attract'), levelsView = $('levels'), gameView = $('game');
  const boardEl = $('board'), statusEl = $('puzzleStatus'), frameEl = $('gameFrame');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Progress ----------
  let solved = new Set();
  try { solved = new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')); } catch (e) { /* storage blocked */ }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...solved])); } catch (e) { /* storage blocked */ }
  }
  const isUnlocked = (i) => i === 0 || solved.has(i - 1);

  function applyTheme(t) {
    arcade.style.setProperty('--t-light', t.light);
    arcade.style.setProperty('--t-dark', t.dark);
    arcade.style.setProperty('--t-frame', t.frame);
    arcade.style.setProperty('--t-bg', t.bg);
    arcade.style.setProperty('--t-accent', t.accent);
  }

  // ---------- Board helpers ----------
  const sqName = (f, r) => 'abcdefgh'[f] + (r + 1);
  const parseSq = (s) => [s.charCodeAt(0) - 97, +s[1] - 1];

  function parseFen(fen) {
    const [placement, side] = fen.split(' ');
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    placement.split('/').forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += +ch;
        else { b[7 - i][f] = { type: ch.toLowerCase(), white: ch === ch.toUpperCase() }; f++; }
      }
    });
    return { b, side };
  }

  function drawBoard(el, b, opts = {}) {
    el.innerHTML = '';
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const cell = document.createElement(opts.interactive ? 'button' : 'div');
        if (opts.interactive) cell.type = 'button';
        cell.className = 'sq' + ((f + r) % 2 === 0 ? ' dark' : '');
        const name = sqName(f, r);
        const pc = b[r][f];
        if (opts.lastMove && opts.lastMove.includes(name)) cell.classList.add('last');
        if (opts.selected === name) cell.classList.add('sel');
        if (opts.wrong === name) cell.classList.add('wrong');
        if (pc) {
          const span = document.createElement('span');
          span.className = pc.white ? 'pc-w' : 'pc-b';
          span.textContent = GLYPH[pc.type];
          cell.appendChild(span);
        }
        if (opts.interactive) {
          if (r === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord f">${'abcdefgh'[f]}</span>`);
          if (f === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord r">${r + 1}</span>`);
          cell.setAttribute('aria-label', name + (pc ? ` ${pc.white ? 'white' : 'black'} ${NAME[pc.type]}` : ''));
          cell.addEventListener('click', () => opts.onClick(name));
        }
        el.appendChild(cell);
      }
    }
  }

  // ---------- Attract screen: spinning board cycling through the worlds ----------
  const spinBoard = $('spinBoard'), worldName = $('worldName');
  drawBoard($('spinGrid'), parseFen(START_FEN).b);
  let spinIndex = 0, spinTimer = null;

  function showWorld(i) {
    applyTheme(LEVELS[i].theme);
    worldName.textContent = `Level ${i + 1} · ${LEVELS[i].world}`;
  }
  function spinNext() {
    const next = (spinIndex + 1) % LEVELS.length;
    if (reduceMotion) { spinIndex = next; showWorld(next); return; }
    spinBoard.classList.remove('spin-in');
    spinBoard.style.transform = 'rotateY(90deg)';
    setTimeout(() => {
      spinIndex = next;
      showWorld(next);
      spinBoard.style.transition = 'none';
      spinBoard.style.transform = 'rotateY(-90deg)';
      void spinBoard.offsetWidth;
      spinBoard.style.transition = '';
      spinBoard.classList.add('spin-in');
      spinBoard.style.transform = 'rotateY(0deg)';
    }, 350);
  }
  function startSpin() { stopSpin(); showWorld(spinIndex); spinTimer = setInterval(spinNext, 2600); }
  function stopSpin() { clearInterval(spinTimer); spinTimer = null; }

  // ---------- Views ----------
  function show(view) {
    attract.hidden = view !== attract;
    levelsView.hidden = view !== levelsView;
    gameView.hidden = view !== gameView;
    if (view === attract) startSpin(); else stopSpin();
    const top = arcade.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo(0, top);
  }

  function renderLevels() {
    applyTheme(LEVELS[0].theme);
    const grid = $('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const unlocked = isUnlocked(i), done = solved.has(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-card' + (done ? ' solved' : '');
      btn.disabled = !unlocked;
      btn.style.animationDelay = `${i * 70}ms`;
      btn.style.setProperty('--c-light', lv.theme.light);
      btn.style.setProperty('--c-dark', lv.theme.dark);
      btn.style.setProperty('--c-frame', lv.theme.frame);
      const state = done ? '✓ Solved' : unlocked ? 'Ready' : `${LOCK_SVG} Locked`;
      const pips = LEVELS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
      btn.innerHTML = `
        <div class="mini-board" aria-hidden="true">${'<span></span>'.repeat(16)}<span class="mini-piece">${unlocked ? lv.icon : ''}</span></div>
        <div>
          <span class="level-num">Level ${i + 1} · ${lv.world}</span>
          <h3>${unlocked ? lv.title : '???'}</h3>
          <div class="pips" aria-label="Difficulty ${i + 1} of ${LEVELS.length}">${pips}<span class="level-state">${state}</span></div>
        </div>`;
      btn.setAttribute('aria-label', `Level ${i + 1}, ${lv.world}, ${lv.difficulty}. ${done ? 'Solved' : unlocked ? 'Unlocked' : 'Locked'}`);
      btn.addEventListener('click', () => startLevel(i));
      grid.appendChild(btn);
    });
    $('progressText').textContent = `${solved.size} of ${LEVELS.length} solved`;
  }

  // ---------- Game ----------
  let current = 0, board, toMove, step, selected, lastMove, locked;

  function setStatus(text, kind = '') {
    statusEl.textContent = text;
    statusEl.className = 'puzzle-status' + (kind ? ' ' + kind : '');
  }

  function startLevel(i) {
    current = i;
    const lv = LEVELS[i];
    applyTheme(lv.theme);
    const parsed = parseFen(lv.fen);
    board = parsed.b; toMove = parsed.side;
    step = 0; selected = null; lastMove = null; locked = false;
    $('puzzleLevel').textContent = `Level ${i + 1} · ${lv.world} · ${lv.difficulty}`;
    $('puzzleTitle').textContent = lv.title;
    $('puzzleFlavor').textContent = lv.flavor;
    $('puzzlePrompt').textContent = lv.prompt;
    $('btnNext').hidden = true;
    $('btnHint').hidden = false;
    setStatus(`${toMove === 'w' ? 'White' : 'Black'} to move.`);
    render();
    show(gameView);
  }

  function render(wrong) {
    drawBoard(boardEl, board, { interactive: true, lastMove, selected, wrong, onClick: onSquare });
  }

  function applyMove(uci) {
    const [ff, fr] = parseSq(uci.slice(0, 2)), [tf, tr] = parseSq(uci.slice(2, 4));
    board[tr][tf] = board[fr][ff];
    board[fr][ff] = null;
    lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
    toMove = toMove === 'w' ? 'b' : 'w';
  }

  function onSquare(name) {
    if (locked) return;
    const [f, r] = parseSq(name);
    const pc = board[r][f];
    const mine = pc && pc.white === (toMove === 'w');
    if (!selected || mine) {
      if (mine) { selected = name; render(); }
      return;
    }
    const attempt = selected + name;
    selected = null;
    const lv = LEVELS[current];
    if (attempt !== lv.solution[step]) {
      setStatus('Not quite. Try again!', 'bad');
      render(name);
      return;
    }
    applyMove(attempt);
    step++;
    if (step >= lv.solution.length) return finish();
    setStatus('Good move! Keep going…', 'ok');
    render();
    // Opponent's scripted reply
    locked = true;
    setTimeout(() => {
      const reply = lv.solution[step];
      const [rf, rr] = parseSq(reply.slice(0, 2));
      const type = board[rr][rf].type;
      applyMove(reply);
      step++;
      locked = false;
      setStatus(`Opponent played ${type === 'p' ? '' : type.toUpperCase()}${reply.slice(2)}. Your move.`);
      render();
    }, 600);
  }

  function finish() {
    locked = true;
    const firstTime = !solved.has(current);
    solved.add(current);
    saveProgress();
    const hasNext = current + 1 < LEVELS.length;
    const unlockNote = firstTime && hasNext ? ` Level ${current + 2}: ${LEVELS[current + 1].world} unlocked!` : '';
    setStatus(`Level complete! ${LEVELS[current].done}${unlockNote}`, 'ok');
    $('btnNext').hidden = !hasNext;
    $('btnHint').hidden = true;
    render();
    frameEl.classList.remove('win');
    void frameEl.offsetWidth;
    frameEl.classList.add('win');
  }

  $('btnPlay').addEventListener('click', () => { renderLevels(); show(levelsView); });
  $('btnBack').addEventListener('click', () => { renderLevels(); show(levelsView); });
  $('btnReset').addEventListener('click', () => startLevel(current));
  $('btnNext').addEventListener('click', () => startLevel(current + 1));
  $('btnHint').addEventListener('click', () => {
    if (locked) return;
    selected = LEVELS[current].solution[step].slice(0, 2);
    setStatus('Hint: the highlighted piece is the one to move.');
    render();
  });

  startSpin();
})();
