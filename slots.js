/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Slot Machine Engine
   Theme-agnostic: all symbols, weights, payouts and bonus features
   come from the active theme config (see slot-themes.js). One engine,
   five machines. The slot lobby picks which theme is live.
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG (shared by every machine) ─────────────────────────────
const SLOT_DEFAULT_BET = 10;
const NUM_LINES = 10;
const GRID_COLS = 5;
const GRID_ROWS = 3;
const SLOT_SPIN_FRAMES = 20;
const SLOT_SPIN_DELAY = 60;
const SLOT_REEL_STOP_DELAY = 350;
const SLOT_TEASE_EXTRA_FRAMES = 8;
const SLOT_TEASE_DELAY = 180;
const HOLD_WIN_ANIM_FRAMES = 12;

// Speed presets: multiplier on all delays (lower = faster)
const SPEED_PRESETS = { slow: 1.5, normal: 1, fast: 0.5, turbo: 0.2 };
let slotSpeed = 'normal';
let autoplayActive = false;
let autoplayCount = 0; // 0 = infinite

// 10 paylines (row, col) left→right — shared by every machine
const PAYLINES = [
  [[1,0],[1,1],[1,2],[1,3],[1,4]],  // L1 middle
  [[0,0],[0,1],[0,2],[0,3],[0,4]],  // L2 top
  [[2,0],[2,1],[2,2],[2,3],[2,4]],  // L3 bottom
  [[0,0],[1,1],[2,2],[1,3],[0,4]],  // L4 V
  [[2,0],[1,1],[0,2],[1,3],[2,4]],  // L5 ^
  [[0,0],[0,1],[1,2],[2,3],[2,4]],  // L6 top→down
  [[2,0],[2,1],[1,2],[0,3],[0,4]],  // L7 bottom→up
  [[1,0],[0,1],[0,2],[0,3],[1,4]],  // L8 bump up
  [[1,0],[2,1],[2,2],[2,3],[1,4]],  // L9 bump down
  [[0,0],[1,1],[1,2],[1,3],[0,4]],  // L10 soft V
];

// ─── ACTIVE THEME ──────────────────────────────────────────────────
let slotTheme = SLOT_THEMES[SLOT_THEME_ORDER[0]];
let slotPool = [];
let slotLadderReels = new Set();

function buildPool(weights) {
  const pool = [];
  for (const [sym, w] of Object.entries(weights))
    for (let i = 0; i < w; i++) pool.push(sym);
  return pool;
}

// ─── STATE ─────────────────────────────────────────────────────────
let slotGrid = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(""));
let slotFinalGrid = null;
let slotSpinning = false;

// Hold & Win state
let holdWinActive = false;
let holdWinSpinsLeft = 0;
let holdWinBet = 0;
let holdWinCoins = null;

// Multiplier Ladder state
let ladderActive = false;
let ladderLevel = 0;
let ladderBet = 0;
let ladderBasePay = 0;

// Per-machine stats, persisted to localStorage
let slotStatsAll = {};
try {
  slotStatsAll = JSON.parse(localStorage.getItem('casino-slot-stats')) || {};
} catch (e) { slotStatsAll = {}; }

function slotStatsFor(id) {
  if (!slotStatsAll[id]) slotStatsAll[id] = { spins:0, wins:0, totalWon:0 };
  return slotStatsAll[id];
}
let slotStats = slotStatsFor(slotTheme.id);

function saveSlotStats() {
  try { localStorage.setItem('casino-slot-stats', JSON.stringify(slotStatsAll)); } catch (e) {}
}

// ─── DOM HELPERS ───────────────────────────────────────────────────
function slotEl(id) { return document.getElementById(id); }

function updateSlotBalance() {
  slotEl('slot-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  saveBalance();
}

function setSlotMsg(text, cls='') {
  const el = slotEl('slot-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' ' + cls : '');
}

function setSlotDetail(text) {
  slotEl('slot-detail').textContent = text;
}

function updateSlotStats() {
  slotEl('slot-stats').textContent =
    `Spins: ${slotStats.spins}  |  Wins: ${slotStats.wins}  |  Won: $${slotStats.totalWon.toLocaleString()}`;
  saveSlotStats();
}

// Clamped bet read — negative/zero/garbage input falls back to default
function getSlotBet() {
  const raw = parseInt(slotEl('slot-bet').value);
  if (!raw || raw < 1) return SLOT_DEFAULT_BET;
  return Math.min(raw, 100000);
}

function updateSlotTotalLabel() {
  const bet = getSlotBet();
  const total = bet * NUM_LINES;
  slotEl('slot-total-label').textContent = `(Total: $${total.toLocaleString()})`;
  const costs = [];
  if (slotTheme.holdWin)
    costs.push(`Buy ${slotTheme.holdWin.title}: $${(total * slotTheme.holdWin.buyMult).toLocaleString()}`);
  if (slotTheme.ladder)
    costs.push(`Buy ${slotTheme.ladder.title}: $${(total * slotTheme.ladder.buyMult).toLocaleString()}`);
  slotEl('slot-buy-cost').textContent = costs.join('  |  ');
}

function randomSymbol(col) {
  let sym;
  do {
    sym = slotPool[Math.floor(Math.random() * slotPool.length)];
  } while (sym === 'CRN' && col !== undefined && !slotLadderReels.has(col));
  return sym;
}

function randomCoinValue() {
  const pool = slotTheme.holdWin.coinPool;
  const totalWeight = pool.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c.value;
  }
  return 1;
}

// ─── SLOT LOBBY ────────────────────────────────────────────────────
function initSlotLobby() {
  document.getElementById('lobby-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  const wrap = document.getElementById('slot-lobby-cards');
  wrap.innerHTML = '';
  for (const id of SLOT_THEME_ORDER) {
    const t = SLOT_THEMES[id];
    const st = slotStatsFor(id);
    const feats = [];
    if (t.holdWin) feats.push(`${t.holdWin.emoji} ${t.holdWin.title}`);
    if (t.ladder) feats.push(`${t.ladder.emoji} ${t.ladder.title}`);
    if (!feats.length) feats.push('✨ PURE REELS');
    let dots = '';
    for (let i = 1; i <= 4; i++)
      dots += `<span class="vol-dot${i <= t.volatility ? ' on' : ''}"></span>`;
    const card = document.createElement('button');
    card.className = 'slot-machine-card';
    card.style.setProperty('--mb-accent', t.accent);
    card.onclick = () => launchSlotMachine(id);
    card.innerHTML = `
      <span class="smc-thumb">${t.thumb}</span>
      <span class="smc-info">
        <span class="smc-name">${t.name}</span>
        <span class="smc-tagline">${t.tagline}</span>
        <span class="smc-meta">
          <span class="smc-risk">RISK ${dots}</span>
          <span class="smc-feats">${feats.join(' · ')}</span>
        </span>
        <span class="smc-stats">Spins: ${st.spins.toLocaleString()} · Won: $${st.totalWon.toLocaleString()}</span>
      </span>`;
    wrap.appendChild(card);
  }
}

function launchSlotMachine(id) {
  slotTheme = SLOT_THEMES[id];
  slotPool = buildPool(slotTheme.weights);
  slotLadderReels = new Set(slotTheme.ladder ? slotTheme.ladder.reels : []);
  slotStats = slotStatsFor(id);
  slotGrid = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(""));
  applySlotTheme();
  showScreen('slots-screen');
  initSlots();
}

function backToSlotLobby() {
  if (slotSpinning || holdWinActive || ladderActive) {
    setSlotMsg('Finish the round first!');
    return;
  }
  autoplayActive = false;
  toggleSlotPaytable(false);
  checkAutoReset();
  showScreen('slot-lobby-screen');
  initSlotLobby();
}

function toggleSlotPaytable(show) {
  document.getElementById('paytable-overlay').classList.toggle('hidden', !show);
}

function applySlotTheme() {
  const screen = document.getElementById('slots-screen');
  screen.style.setProperty('--slot-accent', slotTheme.accent);
  const nameEl = slotEl('slot-machine-name');
  nameEl.textContent = `${slotTheme.thumb} ${slotTheme.name}`;
  slotEl('btn-buy-holdwin').style.display = slotTheme.holdWin ? '' : 'none';
  slotEl('btn-buy-ladder').style.display = slotTheme.ladder ? '' : 'none';
  slotEl('btn-buy-holdwin').textContent = slotTheme.holdWin ? `BUY ${slotTheme.holdWin.title}` : '';
  slotEl('btn-buy-ladder').textContent = slotTheme.ladder ? `BUY ${slotTheme.ladder.title}` : '';
  slotEl('slot-buy-cost').style.display = (slotTheme.holdWin || slotTheme.ladder) ? '' : 'none';
  slotEl('paytable-title').textContent = `${slotTheme.thumb} ${slotTheme.name} — ODDS & PAYS`;
  slotEl('slot-paytable').innerHTML = buildPaytableHTML();
  toggleSlotPaytable(false);
}

function buildPaytableHTML() {
  const t = slotTheme;
  // Symbols sorted by 5-of-a-kind payout, best first
  const syms = Object.keys(t.payouts).sort((a, b) => t.payouts[b][5] - t.payouts[a][5]);
  const parts = syms.map(s => {
    const d = t.display[s];
    const icon = d.emoji || d.label;
    const p = t.payouts[s];
    return `${icon} ${p[5]}x/${p[4]}x/${p[3]}x`;
  });
  const lines = [];
  for (let i = 0; i < parts.length; i += 3)
    lines.push(parts.slice(i, i + 3).join('  |  '));
  let html = `<b>5/4/3 of a kind pays:</b><br>${lines.join('<br>')}<br>`;
  const wd = t.display['WLD'];
  html += `${wd.emoji} WILD subs all symbols`;
  if (t.holdWin) html += `  |  ${t.holdWin.emoji}×${t.holdWin.trigger}+ = ${t.holdWin.title}`;
  if (t.ladder) html += `  |  ${t.ladder.emoji}×3+ = ${t.ladder.title} (up to ${t.ladder.levels[t.ladder.levels.length-1].mult}x!)`;
  html += `  |  ${NUM_LINES} lines`;
  return html;
}

// ─── RENDER GRID ───────────────────────────────────────────────────
function renderSlotGrid(highlightCells) {
  const container = slotEl('slot-grid');
  container.innerHTML = '';
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const sym = slotGrid[row][col];
      const cell = document.createElement('div');
      cell.className = 'slot-cell';

      const isHL = highlightCells && highlightCells.has(`${row},${col}`);

      if (sym && slotTheme.display[sym]) {
        const d = slotTheme.display[sym];
        cell.style.background = isHL ? d.bg : 'var(--cell-bg)';
        cell.style.borderColor = isHL ? d.border : 'var(--cell-border)';
        cell.style.borderWidth = isHL ? '2px' : '1px';

        const sizeCls = d.big ? ' slot-emoji-big' : d.mid ? ' slot-emoji-mid' : '';
        if (d.emoji && !d.label) {
          cell.innerHTML = `<span class="slot-emoji${sizeCls}">${d.emoji}</span>`;
        } else if (d.emoji && d.label) {
          cell.innerHTML = `<span class="slot-emoji${sizeCls}">${d.emoji}</span><span class="slot-label" style="color:${d.color}">${d.label}</span>`;
        } else {
          cell.innerHTML = `<span class="slot-text" style="color:${d.color}">${d.label}</span>`;
        }
      } else {
        cell.style.background = 'var(--cell-bg)';
        cell.style.borderColor = 'var(--cell-border)';
      }
      container.appendChild(cell);
    }
  }
}

function renderHoldWinGrid(animating) {
  const container = slotEl('slot-grid');
  const hw = slotTheme.holdWin;
  container.innerHTML = '';
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';

      const coinVal = holdWinCoins[row][col];

      if (coinVal !== null) {
        cell.style.background = hw.coinBg;
        cell.style.borderColor = hw.coinBorder;
        cell.style.borderWidth = '2px';
        cell.classList.add('hw-coin');
        cell.innerHTML = `<span class="slot-emoji">${hw.emoji}</span><span class="coin-value">${coinVal}x</span>`;
      } else if (animating) {
        const sym = slotGrid[row][col];
        if (sym && slotTheme.display[sym]) {
          const d = slotTheme.display[sym];
          cell.style.background = 'var(--cell-bg)';
          cell.style.borderColor = 'var(--cell-border-landed)';
          if (d.emoji) {
            cell.innerHTML = `<span class="slot-emoji">${d.emoji}</span>`;
          } else {
            cell.innerHTML = `<span class="slot-text" style="color:${d.color}">${d.label}</span>`;
          }
        }
      } else {
        cell.style.background = 'var(--bg-deep)';
        cell.style.borderColor = 'var(--cell-border)';
      }
      container.appendChild(cell);
    }
  }
}

// ─── BUTTONS ───────────────────────────────────────────────────────
function setSlotButtons(enabled) {
  slotEl('btn-spin').disabled = !enabled;
  slotEl('btn-max-bet').disabled = !enabled;
  slotEl('btn-buy-holdwin').disabled = !enabled;
  slotEl('btn-buy-ladder').disabled = !enabled;
  slotEl('slot-bet').disabled = !enabled;
  // Autoplay button always enabled so user can stop
  const apBtn = slotEl('btn-autoplay');
  if (apBtn) {
    apBtn.textContent = autoplayActive ? 'STOP AUTO' : 'AUTO';
    apBtn.className = autoplayActive ? 'btn red' : 'btn blue';
  }
}

function getSpeedMult() {
  return SPEED_PRESETS[slotSpeed] || 1;
}

// ─── AUTOPLAY ─────────────────────────────────────────────────────
function toggleAutoplay() {
  if (autoplayActive) {
    autoplayActive = false;
    setSlotButtons(true);
    setSlotMsg('Autoplay stopped');
    return;
  }
  const countEl = slotEl('slot-auto-count');
  autoplayCount = countEl ? (parseInt(countEl.value) || 0) : 0;
  autoplayActive = true;
  setSlotButtons(false);
  slotEl('btn-spin').disabled = true;
  const apBtn = slotEl('btn-autoplay');
  if (apBtn) { apBtn.textContent = 'STOP AUTO'; apBtn.className = 'btn red'; }
  slotSpin();
}

function autoplayNext() {
  if (!autoplayActive) return;
  if (autoplayCount > 0) {
    autoplayCount--;
    if (autoplayCount <= 0) {
      autoplayActive = false;
      setSlotButtons(true);
      setSlotMsg('Autoplay finished');
      return;
    }
  }
  const delay = Math.max(400, 800 * getSpeedMult());
  setTimeout(() => {
    if (!autoplayActive) return;
    slotSpin();
  }, delay);
}

function setSlotSpeed(speed) {
  slotSpeed = speed;
  document.querySelectorAll('.speed-btn[data-speed]').forEach(b => {
    b.classList.toggle('speed-active', b.dataset.speed === speed);
  });
}

// ─── PAYLINE EVALUATION ────────────────────────────────────────────
function evalPayline(syms) {
  let base = null;
  for (const s of syms) {
    if (s === 'WLD') continue;
    if (s === 'BNS' || s === 'CRN') return [0, null, 0];
    base = s;
    break;
  }
  if (base === null) {
    // Full line of wilds pays as the theme's top symbol
    const top = slotTheme.wildTopSym;
    return [5, top, slotTheme.payouts[top][5]];
  }
  let count = 0;
  for (const s of syms) {
    if (s === base || s === 'WLD') count++;
    else break;
  }
  if (count >= 3) {
    const mult = (slotTheme.payouts[base] || {})[count] || 0;
    return [count, base, mult];
  }
  return [0, null, 0];
}

// ─── SPIN ──────────────────────────────────────────────────────────
function slotSpin() {
  if (slotSpinning || holdWinActive || ladderActive) return;

  const betPerLine = getSlotBet();
  const totalBet = betPerLine * NUM_LINES;
  if (totalBet > balance) {
    checkAutoReset(); // house rule: reset to $5,000 when below $500
    updateSlotBalance();
    if (totalBet > balance) {
      if (autoplayActive) autoplayActive = false;
      setSlotButtons(true);
      setSlotMsg(`Need $${totalBet.toLocaleString()}!`, 'lose');
      return;
    }
  }
  balance -= totalBet;
  updateSlotBalance();

  slotSpinning = true;
  setSlotButtons(false);
  setSlotDetail('');
  slotStats.spins++;
  setSlotMsg('Spinning...');

  slotFinalGrid = Array.from({length: GRID_ROWS}, () =>
    Array.from({length: GRID_COLS}, (_, col) => randomSymbol(col))
  );

  animateSlotSpin(0, betPerLine);
}

function slotMaxSpin() {
  if (holdWinActive || ladderActive) return;
  const cap = Math.min(100000, Math.floor(balance / NUM_LINES));
  if (cap < 1) {
    setSlotMsg('Not enough balance!', 'lose');
    return;
  }
  slotEl('slot-bet').value = cap;
  updateSlotTotalLabel();
  slotSpin();
}

// ─── BUY FEATURES ──────────────────────────────────────────────────
function slotBuyHoldWin() {
  if (slotSpinning || holdWinActive || ladderActive || !slotTheme.holdWin) return;
  const hw = slotTheme.holdWin;
  const betPerLine = getSlotBet();
  const cost = betPerLine * NUM_LINES * hw.buyMult;
  if (cost > balance) {
    setSlotMsg(`Need $${cost.toLocaleString()} to buy!`, 'lose');
    return;
  }
  balance -= cost;
  updateSlotBalance();

  // Place trigger-count random coins on the grid
  const positions = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      positions.push([r, c]);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const coinPositions = positions.slice(0, hw.trigger);

  // Fill grid with BNS at coin positions; keep stray BNS out of the filler
  // so the display matches the coins that actually get locked
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++) {
      let sym;
      do { sym = randomSymbol(c); } while (sym === 'BNS');
      slotGrid[r][c] = sym;
    }
  for (const [r, c] of coinPositions)
    slotGrid[r][c] = 'BNS';

  renderSlotGrid();
  setTimeout(() => startHoldWin(coinPositions, betPerLine), 800);
}

function slotBuyLadder() {
  if (slotSpinning || holdWinActive || ladderActive || !slotTheme.ladder) return;
  const betPerLine = getSlotBet();
  const cost = betPerLine * NUM_LINES * slotTheme.ladder.buyMult;
  if (cost > balance) {
    setSlotMsg(`Need $${cost.toLocaleString()} to buy!`, 'lose');
    return;
  }
  balance -= cost;
  updateSlotBalance();
  startLadder(betPerLine);
}

// ─── ANIMATION ─────────────────────────────────────────────────────
// Helper: set a single cell's content without recreating it
function setCellSymbol(cell, sym) {
  if (sym && slotTheme.display[sym]) {
    const d = slotTheme.display[sym];
    const sizeCls = d.big ? ' slot-emoji-big' : d.mid ? ' slot-emoji-mid' : '';
    if (d.emoji && !d.label) {
      cell.innerHTML = `<span class="slot-emoji${sizeCls}">${d.emoji}</span>`;
    } else if (d.emoji && d.label) {
      cell.innerHTML = `<span class="slot-emoji${sizeCls}">${d.emoji}</span><span class="slot-label" style="color:${d.color}">${d.label}</span>`;
    } else {
      cell.innerHTML = `<span class="slot-text" style="color:${d.color}">${d.label}</span>`;
    }
  }
}

let _lastLocked = 0;
let _teaseDetected = false;
let _teaseExtraUsed = 0;

function countTeaseSymbols(lockedCols) {
  // Only check columns the player can already see — no peeking at
  // reels that are still spinning
  let crowns = 0, coins = 0;
  for (let col = 0; col < lockedCols; col++)
    for (let row = 0; row < GRID_ROWS; row++) {
      if (slotFinalGrid[row][col] === 'CRN') crowns++;
      if (slotFinalGrid[row][col] === 'BNS') coins++;
    }
  return { crowns, coins };
}

function checkTeaseCondition(lockedCols) {
  const { crowns, coins } = countTeaseSymbols(lockedCols);
  return (slotTheme.ladder && crowns >= 2) ||
         (slotTheme.holdWin && coins >= slotTheme.holdWin.trigger - 1);
}

function animateSlotSpin(frame, betPerLine) {
  const sm = getSpeedMult();
  const container = slotEl('slot-grid');

  // Calculate how many columns should be locked at this frame
  let locked, inTeaseZone = false;

  if (frame <= SLOT_SPIN_FRAMES) {
    locked = 0;
  } else {
    const reelFrame = frame - SLOT_SPIN_FRAMES;
    // If tease detected and we're on the last reel, add extra frames
    if (_teaseDetected && reelFrame >= GRID_COLS - 1) {
      locked = GRID_COLS - 1; // hold last reel open
      _teaseExtraUsed++;
      inTeaseZone = true;
      if (_teaseExtraUsed > SLOT_TEASE_EXTRA_FRAMES) {
        locked = GRID_COLS; // finally lock last reel
      }
    } else {
      locked = Math.min(reelFrame, GRID_COLS);
    }
  }

  const isDone = locked >= GRID_COLS;

  if (!isDone) {
    // First frame: build grid from scratch
    if (frame === 0) {
      _lastLocked = 0;
      _teaseDetected = false;
      _teaseExtraUsed = 0;
      container.innerHTML = '';
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const sym = randomSymbol(col);
          slotGrid[row][col] = sym;
          const cell = document.createElement('div');
          cell.className = 'slot-cell spinning';
          cell.style.background = 'var(--cell-bg)';
          cell.style.borderColor = 'var(--cell-border)';
          setCellSymbol(cell, sym);
          container.appendChild(cell);
        }
      }
    }

    // Update spinning cells
    const cells = container.children;
    for (let col = locked; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        const sym = randomSymbol(col);
        slotGrid[row][col] = sym;
        setCellSymbol(cells[row * GRID_COLS + col], sym);
      }
    }

    // Lock newly decided columns (once per column)
    if (locked > _lastLocked) {
      for (let col = _lastLocked; col < locked; col++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          slotGrid[row][col] = slotFinalGrid[row][col];
          const cell = cells[row * GRID_COLS + col];
          setCellSymbol(cell, slotFinalGrid[row][col]);
          cell.className = 'slot-cell landed';
          cell.style.background = 'var(--cell-bg)';
          cell.style.borderColor = 'var(--cell-border-landed)';
        }
      }
      _lastLocked = locked;

      // Check for tease after locking (but before last reel)
      if (locked >= GRID_COLS - 1 && !_teaseDetected && locked < GRID_COLS) {
        if (checkTeaseCondition(locked)) {
          _teaseDetected = true;
          setSlotMsg('...', 'win');
        }
      }
    }

    // Apply tease glow to spinning cells
    if (locked > 0 && locked < GRID_COLS && checkTeaseCondition(locked)) {
      for (let col = locked; col < GRID_COLS; col++)
        for (let row = 0; row < GRID_ROWS; row++)
          cells[row * GRID_COLS + col].classList.add('tease');
    }

    // Calculate delay
    let delay;
    if (frame < SLOT_SPIN_FRAMES) {
      const progress = frame / SLOT_SPIN_FRAMES;
      delay = Math.floor((SLOT_SPIN_DELAY + progress * progress * 120) * sm);
    } else if (inTeaseZone) {
      // Slow-mo tease: gets progressively slower
      const teaseProgress = _teaseExtraUsed / SLOT_TEASE_EXTRA_FRAMES;
      delay = Math.floor(SLOT_TEASE_DELAY * (1 + teaseProgress * 1.5) * sm);
    } else {
      delay = Math.floor(SLOT_REEL_STOP_DELAY * sm);
    }
    setTimeout(() => animateSlotSpin(frame + 1, betPerLine), delay);
  } else {
    // All reels locked — resolve
    // Lock final column if not yet
    const cells = container.children;
    if (_lastLocked < GRID_COLS) {
      for (let col = _lastLocked; col < GRID_COLS; col++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          slotGrid[row][col] = slotFinalGrid[row][col];
          const cell = cells[row * GRID_COLS + col];
          setCellSymbol(cell, slotFinalGrid[row][col]);
          cell.className = 'slot-cell landed';
          cell.style.background = 'var(--cell-bg)';
          cell.style.borderColor = 'var(--cell-border-landed)';
        }
      }
      _lastLocked = GRID_COLS;
    }
    for (let row = 0; row < GRID_ROWS; row++)
      for (let col = 0; col < GRID_COLS; col++)
        slotGrid[row][col] = slotFinalGrid[row][col];
    resolveSlot(betPerLine);
  }
}

// ─── RESOLVE ───────────────────────────────────────────────────────
function resolveSlot(betPerLine) {
  let totalWin = 0;
  const details = [];
  const winningCells = new Set();
  const hw = slotTheme.holdWin;
  const ld = slotTheme.ladder;

  // Payline wins
  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li];
    const syms = line.map(([r,c]) => slotGrid[r][c]);
    const [cnt, sym, mult] = evalPayline(syms);
    if (mult > 0) {
      const payout = mult * betPerLine;
      totalWin += payout;
      details.push(`L${li+1}:${cnt}x${sym}+$${payout.toLocaleString()}`);
      for (let idx = 0; idx < cnt; idx++) {
        winningCells.add(`${line[idx][0]},${line[idx][1]}`);
      }
    }
  }

  // BNS (coin) scatter count — only meaningful when the theme has Hold & Win
  const bnsCells = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (slotGrid[r][c] === 'BNS') bnsCells.push([r,c]);
  const bnsCount = bnsCells.length;

  // Small scatter pay for 3..trigger-1 BNS (consolation, no bonus trigger)
  if (hw && bnsCount >= 3 && bnsCount < hw.trigger) {
    const scMult = hw.scatterPays[Math.min(bnsCount, 5)] || hw.scatterPays[5];
    const scatterPay = scMult * betPerLine * NUM_LINES;
    totalWin += scatterPay;
    details.push(`SCATTER ${bnsCount}x +$${scatterPay.toLocaleString()}`);
    for (const [r,c] of bnsCells) winningCells.add(`${r},${c}`);
  }

  // Crown (ladder scatter) count — only when the theme has a ladder
  const crownCells = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (slotGrid[r][c] === 'CRN') crownCells.push([r,c]);
  const crownCount = crownCells.length;

  if (ld && crownCount >= 3) {
    const cMult = ld.scatterPays[Math.min(crownCount, 5)] || ld.scatterPays[5];
    const crownPay = cMult * betPerLine * NUM_LINES;
    totalWin += crownPay;
    details.push(`${ld.emoji} ${crownCount}x +$${crownPay.toLocaleString()}`);
    for (const [r,c] of crownCells) winningCells.add(`${r},${c}`);
  }

  renderSlotGrid(winningCells.size > 0 ? winningCells : null);

  // Apply winning animation classes to highlighted cells
  if (winningCells.size > 0) {
    const cells = slotEl('slot-grid').children;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = cells[row * GRID_COLS + col];
        if (winningCells.has(`${row},${col}`)) {
          cell.classList.add('winning');
        }
      }
    }
  }

  balance += totalWin;
  updateSlotBalance();

  if (totalWin > 0) {
    slotStats.wins++;
    slotStats.totalWon += totalWin;
    setSlotMsg(`WIN! +$${totalWin.toLocaleString()}`, 'win');
    // Shake machine on big wins (10x+ bet)
    const totalBet = getSlotBet() * NUM_LINES;
    if (totalWin >= totalBet * 10) {
      const felt = document.querySelector('.slot-machine-felt');
      felt.classList.add('big-win');
      setTimeout(() => felt.classList.remove('big-win'), 1200);
    }
  } else if ((ld && crownCount === 2) || (hw && bnsCount === hw.trigger - 1)) {
    setSlotMsg('So close! Spin again!', 'win');
  } else {
    setSlotMsg('No win — try again!');
  }

  setSlotDetail(details.slice(0, 5).join('  |  '));
  updateSlotStats();
  slotSpinning = false;

  // ── Bonus triggers ──
  let pendingLadder = null;
  if (ld && crownCount >= 3) {
    pendingLadder = { betPerLine };
  }

  if (hw && bnsCount >= hw.trigger) {
    for (const [r,c] of bnsCells) winningCells.add(`${r},${c}`);
    renderSlotGrid(winningCells);
    if (pendingLadder) window._pendingLadder = pendingLadder;
    setTimeout(() => startHoldWin(bnsCells, betPerLine), 1500);
    return;
  }

  if (pendingLadder) {
    setTimeout(() => startLadder(betPerLine), 1500);
    return;
  }

  // Normal game — re-enable
  if (balance < NUM_LINES) {
    checkAutoReset();
    setSlotMsg('Balance reset! Press SPIN to play.', 'win');
    updateSlotBalance();
  }
  setSlotButtons(true);
  if (autoplayActive) autoplayNext();
}

// ─── HOLD & WIN BONUS ──────────────────────────────────────────────
function startHoldWin(coinPositions, betPerLine) {
  const hw = slotTheme.holdWin;
  holdWinActive = true;
  holdWinSpinsLeft = hw.spins;
  holdWinBet = betPerLine;
  holdWinCoins = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(null));

  for (const [r, c] of coinPositions) {
    holdWinCoins[r][c] = randomCoinValue();
  }

  setSlotButtons(false);
  const bar = slotEl('slot-bonus-bar');
  bar.classList.remove('hidden');
  updateHoldWinBar();

  renderHoldWinGrid(false);
  setSlotMsg(`${hw.emoji} ${hw.title}! ${coinPositions.length} coins locked!`, 'win');

  setTimeout(runHoldWinSpin, 2000);
}

function updateHoldWinBar() {
  const totalVal = sumHoldWinCoins();
  const totalPay = totalVal * holdWinBet * NUM_LINES;
  slotEl('slot-bonus-bar').textContent =
    `${slotTheme.holdWin.title} — ${holdWinSpinsLeft} spin${holdWinSpinsLeft !== 1 ? 's' : ''} left  |  Total: $${totalPay.toLocaleString()}`;
}

function sumHoldWinCoins() {
  let total = 0;
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (holdWinCoins[r][c] !== null) total += holdWinCoins[r][c];
  return total;
}

function countHoldWinCoins() {
  let count = 0;
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (holdWinCoins[r][c] !== null) count++;
  return count;
}

function runHoldWinSpin() {
  if (holdWinSpinsLeft <= 0) { endHoldWin(); return; }
  holdWinSpinsLeft--;
  setSlotMsg(`Spinning... ${holdWinSpinsLeft + 1} → ${holdWinSpinsLeft} spins left`);
  animateHoldWinSpin(0);
}

function animateHoldWinSpin(frame) {
  if (frame < HOLD_WIN_ANIM_FRAMES) {
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < GRID_COLS; c++)
        if (holdWinCoins[r][c] === null)
          slotGrid[r][c] = randomSymbol(c);
    renderHoldWinGrid(true);
    const delay = 50 + frame * 15;
    setTimeout(() => animateHoldWinSpin(frame + 1), delay);
  } else {
    resolveHoldWinSpin();
  }
}

function resolveHoldWinSpin() {
  const hw = slotTheme.holdWin;
  let newCoins = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (holdWinCoins[r][c] === null) {
        if (Math.random() < hw.coinChance) {
          holdWinCoins[r][c] = randomCoinValue();
          newCoins++;
        }
      }
    }
  }

  renderHoldWinGrid(false);

  if (newCoins > 0) {
    holdWinSpinsLeft = hw.spins;
    setSlotMsg(`+${newCoins} new coin${newCoins > 1 ? 's' : ''}! Spins reset to ${hw.spins}!`, 'win');
  } else {
    if (holdWinSpinsLeft > 0) {
      setSlotMsg(`No new coins — ${holdWinSpinsLeft} spin${holdWinSpinsLeft !== 1 ? 's' : ''} left`);
    } else {
      setSlotMsg('No new coins — collecting!');
    }
  }

  updateHoldWinBar();

  // Check if grid is full → GRAND BONUS
  if (countHoldWinCoins() >= GRID_ROWS * GRID_COLS) {
    setSlotMsg('🏆 FULL GRID! GRAND BONUS!', 'win');
    setTimeout(endHoldWin, 2500);
    return;
  }

  if (holdWinSpinsLeft > 0) {
    setTimeout(runHoldWinSpin, 1200);
  } else {
    setTimeout(endHoldWin, 1500);
  }
}

function endHoldWin() {
  const hw = slotTheme.holdWin;
  holdWinActive = false;
  slotEl('slot-bonus-bar').classList.add('hidden');

  let totalMult = sumHoldWinCoins();
  const isFull = countHoldWinCoins() >= GRID_ROWS * GRID_COLS;
  if (isFull) totalMult += hw.grand;

  const payout = totalMult * holdWinBet * NUM_LINES;

  balance += payout;
  slotStats.wins++;
  slotStats.totalWon += payout;
  updateSlotBalance();
  updateSlotStats();

  const grandText = isFull ? ' + GRAND BONUS!' : '';
  setSlotMsg(`${hw.emoji} ${hw.title}: +$${payout.toLocaleString()}${grandText}`, 'win');

  // Restore normal grid display
  renderSlotGrid();

  // Check for pending ladder
  if (window._pendingLadder) {
    const { betPerLine } = window._pendingLadder;
    window._pendingLadder = null;
    setTimeout(() => startLadder(betPerLine), 2000);
    return;
  }

  if (balance < NUM_LINES) {
    checkAutoReset();
    setSlotMsg('Balance reset! Press SPIN to play.', 'win');
    updateSlotBalance();
  }
  setSlotButtons(true);
  if (autoplayActive) autoplayNext();
}

// ─── MULTIPLIER LADDER BONUS ───────────────────────────────────────
function startLadder(betPerLine) {
  ladderActive = true;
  ladderLevel = 0;
  ladderBet = betPerLine;
  ladderBasePay = betPerLine * NUM_LINES;

  setSlotButtons(false);
  showLadderOverlay();
  const ld = slotTheme.ladder;
  setSlotMsg(`${ld.emoji} ${ld.title}! Pick a tile to climb!`, 'win');
}

function showLadderOverlay() {
  let overlay = document.getElementById('ladder-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ladder-overlay';
    document.getElementById('slots-screen').appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  renderLadder();
}

function renderLadder() {
  const overlay = document.getElementById('ladder-overlay');
  const ld = slotTheme.ladder;
  const levels = ld.levels;
  const level = levels[ladderLevel];

  let html = '<div class="ladder-container">';
  html += `<div class="ladder-title">${ld.emoji} ${ld.title} ${ld.emoji}</div>`;

  html += '<div class="ladder-rungs">';
  for (let i = levels.length - 1; i >= 0; i--) {
    const lvl = levels[i];
    const isCurrent = i === ladderLevel;
    const isPast = i < ladderLevel;
    const cls = isCurrent ? 'ladder-rung current' : isPast ? 'ladder-rung past' : 'ladder-rung';
    const pay = (lvl.mult * ladderBasePay);
    html += `<div class="${cls}">
      <span class="rung-mult">${lvl.mult}x</span>
      <span class="rung-pay">$${pay.toLocaleString()}</span>
      ${isCurrent ? '<span class="rung-arrow">◄</span>' : ''}
    </div>`;
  }
  html += '</div>';

  if (ladderLevel > 0) {
    const prevMult = levels[ladderLevel - 1].mult;
    const collectPay = prevMult * ladderBasePay;
    html += `<div class="ladder-collect-info">Collect if wrong: $${collectPay.toLocaleString()} (${prevMult}x)</div>`;
  }

  if (ladderLevel >= levels.length - 1) {
    const topPay = levels[levels.length - 1].mult * ladderBasePay;
    html += `<div class="ladder-msg gold">🏆 MAX LEVEL! Collecting $${topPay.toLocaleString()}!</div>`;
    html += '</div>';
    overlay.innerHTML = html;
    setTimeout(endLadder, 2500);
    return;
  }

  html += `<div class="ladder-msg">Pick a tile to try for ${level.mult}x!</div>`;
  html += '<div class="ladder-tiles">';

  const safeCount = level.safe;
  const tiles = [];
  for (let i = 0; i < 3; i++) tiles.push(i < safeCount ? 'UP' : 'COLLECT');
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  window._ladderTiles = tiles;

  for (let i = 0; i < 3; i++) {
    html += `<button class="ladder-tile" onclick="pickLadderTile(${i})">
      <span class="tile-question">?</span>
    </button>`;
  }
  html += '</div>';

  if (ladderLevel > 0) {
    const collectPay = levels[ladderLevel - 1].mult * ladderBasePay;
    html += `<button class="btn green ladder-collect-btn" onclick="collectLadder()">
      COLLECT $${collectPay.toLocaleString()}
    </button>`;
  }

  html += '</div>';
  overlay.innerHTML = html;
}

function pickLadderTile(index) {
  const tiles = window._ladderTiles;
  if (!tiles || !ladderActive) return;

  const levels = slotTheme.ladder.levels;
  const result = tiles[index];
  const tileButtons = document.querySelectorAll('.ladder-tile');

  for (let i = 0; i < 3; i++) {
    const btn = tileButtons[i];
    btn.onclick = null;
    btn.style.cursor = 'default';
    if (tiles[i] === 'UP') {
      btn.innerHTML = '<span class="tile-revealed up">⬆️</span>';
      btn.classList.add('tile-safe');
    } else {
      btn.innerHTML = '<span class="tile-revealed down">💀</span>';
      btn.classList.add('tile-danger');
    }
    if (i === index) btn.classList.add('tile-picked');
  }

  const collectBtn = document.querySelector('.ladder-collect-btn');
  if (collectBtn) collectBtn.disabled = true;

  if (result === 'UP') {
    ladderLevel++;
    const newMult = levels[ladderLevel].mult;
    const newPay = newMult * ladderBasePay;
    setSlotMsg(`⬆️ CLIMBED to ${newMult}x — $${newPay.toLocaleString()}!`, 'win');
    setTimeout(renderLadder, 1500);
  } else {
    if (ladderLevel > 0) {
      const prevMult = levels[ladderLevel - 1].mult;
      const pay = prevMult * ladderBasePay;
      setSlotMsg(`💀 Stopped! Collecting ${prevMult}x — $${pay.toLocaleString()}`, 'lose');
      ladderLevel = ladderLevel - 1;
    } else {
      setSlotMsg(`💀 Stopped at the bottom! No bonus.`, 'lose');
      ladderLevel = -1;
    }
    setTimeout(endLadder, 2000);
  }
}

function collectLadder() {
  if (!ladderActive || ladderLevel <= 0) return;
  ladderLevel = ladderLevel - 1;
  const mult = slotTheme.ladder.levels[ladderLevel].mult;
  const pay = mult * ladderBasePay;
  setSlotMsg(`Collected ${mult}x — $${pay.toLocaleString()}!`, 'win');
  setTimeout(endLadder, 1500);
}

function endLadder() {
  ladderActive = false;
  const overlay = document.getElementById('ladder-overlay');
  if (overlay) overlay.classList.add('hidden');

  const ld = slotTheme.ladder;
  let payout = 0;
  if (ladderLevel >= 0 && ladderLevel < ld.levels.length) {
    payout = ld.levels[ladderLevel].mult * ladderBasePay;
  }

  if (payout > 0) {
    balance += payout;
    slotStats.wins++;
    slotStats.totalWon += payout;
    updateSlotBalance();
    updateSlotStats();
    setSlotMsg(`${ld.emoji} LADDER BONUS: +$${payout.toLocaleString()}!`, 'win');
  }

  if (balance < NUM_LINES) {
    checkAutoReset();
    setSlotMsg('Balance reset! Press SPIN to play.', 'win');
    updateSlotBalance();
    setSlotButtons(true);
  } else {
    setSlotButtons(true);
  }
  if (autoplayActive) autoplayNext();
}

// ─── INIT ──────────────────────────────────────────────────────────
let _slotsListenersBound = false;
function initSlots() {
  updateSlotBalance();
  updateSlotTotalLabel();
  updateSlotStats();
  setSlotMsg('Press SPIN to play!');
  setSlotDetail('');
  renderSlotGrid();
  setSlotButtons(true);

  if (!_slotsListenersBound) {
    slotEl('slot-bet').addEventListener('input', updateSlotTotalLabel);
    _slotsListenersBound = true;
  }
}
