/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Slot Machine
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const SLOT_DEFAULT_BET = 10;
const NUM_LINES = 10;
const GRID_COLS = 5;
const GRID_ROWS = 3;
const SLOT_SPIN_FRAMES = 20;
const SLOT_SPIN_DELAY = 60;
const SLOT_REEL_STOP_DELAY = 350;
const SLOT_TEASE_EXTRA_FRAMES = 8;
const SLOT_TEASE_DELAY = 180;
const BUY_HW_MULTIPLIER = 100;
const BUY_LADDER_MULTIPLIER = 50;

// Speed presets: multiplier on all delays (lower = faster)
const SPEED_PRESETS = { slow: 1.5, normal: 1, fast: 0.5, turbo: 0.2 };
let slotSpeed = 'normal';
let autoplayActive = false;
let autoplayCount = 0; // 0 = infinite

const SYMBOLS = ["7","BAR","CHR","BEL","DIA","LEM","ORG","WLD","BNS","CRN"];

// Weighted symbol pools
const REEL_WEIGHTS = {
  "7":2,"BAR":4,"CHR":6,"BEL":6,"DIA":5,"LEM":7,"ORG":7,"WLD":2,"BNS":6,"CRN":2
};

function buildPool(weights) {
  const pool = [];
  for (const [sym, w] of Object.entries(weights))
    for (let i = 0; i < w; i++) pool.push(sym);
  return pool;
}
const REEL_POOL = buildPool(REEL_WEIGHTS);

// Payouts: symbol → {matchCount: multiplier on bet-per-line}
const PAYOUTS = {
  "7":   {3:10, 4:50, 5:500},
  "BAR": {3:5,  4:20, 5:100},
  "DIA": {3:4,  4:15, 5:75},
  "BEL": {3:3,  4:10, 5:50},
  "CHR": {3:2,  4:8,  5:40},
  "LEM": {3:1,  4:4,  5:20},
  "ORG": {3:1,  4:4,  5:20},
};

// Scatter pays for <6 BNS (consolation)
const SCATTER_PAYS = {3:2, 4:5, 5:15};

// 10 paylines (row, col) left→right
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

const PAYLINE_COLORS = [
  "#f0c040","#44bbff","#ee2222","#44ee44","#dd66ff",
  "#ff8833","#33ffcc","#ff66aa","#88ccff","#ccff44",
];

// Symbol display config
const SYM_DISPLAY = {
  "7":   { emoji:"7️⃣",  label:"7",     bg:"#3a1515", border:"#ff4444", color:"#ff4444" },
  "BAR": { emoji:"",     label:"BAR",   bg:"#2a2a2a", border:"#888",    color:"#ccc" },
  "CHR": { emoji:"🍒",  label:"",      bg:"#2a1520", border:"#cc0000", color:"#cc0000" },
  "BEL": { emoji:"🔔",  label:"",      bg:"#2a2515", border:"#f0c040", color:"#f0c040" },
  "DIA": { emoji:"💎",  label:"",      bg:"#152535", border:"#44bbff", color:"#44bbff" },
  "LEM": { emoji:"🍋",  label:"",      bg:"#2a2a15", border:"#ddee22", color:"#ddee22" },
  "ORG": { emoji:"🍊",  label:"",      bg:"#2a2015", border:"#ff8833", color:"#ff8833" },
  "WLD": { emoji:"⭐",  label:"",      bg:"#2a1a00", border:"#ff6600", color:"#ff6600", big:true },
  "BNS": { emoji:"💰",  label:"",      bg:"#2a2200", border:"#f0c040", color:"#f0c040", big:true },
  "CRN": { emoji:"👑",  label:"",      bg:"#2a1a2a", border:"#ff44ff", color:"#ff44ff", big:true },
};

// ─── HOLD & WIN CONFIG ────────────────────────────────────────────
const HOLD_WIN_TRIGGER = 6;
const HOLD_WIN_SPINS = 3;
const HOLD_WIN_COIN_CHANCE = 0.22;
const HOLD_WIN_ANIM_FRAMES = 12;
const HOLD_WIN_GRAND_BONUS = 500;

const COIN_VALUE_POOL = [
  {value: 1, weight: 25},
  {value: 2, weight: 20},
  {value: 3, weight: 15},
  {value: 5, weight: 12},
  {value: 10, weight: 8},
  {value: 25, weight: 5},
  {value: 50, weight: 3},
  {value: 100, weight: 2},
  {value: 250, weight: 1},
];
const COIN_VALUE_TOTAL_WEIGHT = COIN_VALUE_POOL.reduce((s, c) => s + c.weight, 0);

function randomCoinValue() {
  let r = Math.random() * COIN_VALUE_TOTAL_WEIGHT;
  for (const c of COIN_VALUE_POOL) {
    r -= c.weight;
    if (r <= 0) return c.value;
  }
  return 1;
}

// ─── MULTIPLIER LADDER CONFIG ─────────────────────────────────────
const LADDER_LEVELS = [
  { mult: 2,    safe: 3 },
  { mult: 5,    safe: 2 },
  { mult: 10,   safe: 2 },
  { mult: 25,   safe: 2 },
  { mult: 50,   safe: 1 },
  { mult: 100,  safe: 1 },
  { mult: 250,  safe: 1 },
  { mult: 500,  safe: 1 },
  { mult: 1000, safe: 0 },
];
const CROWN_SCATTER_PAYS = {3:3, 4:10, 5:50};

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

let slotStats = { spins:0, wins:0, totalWon:0 };

// ─── DOM HELPERS ───────────────────────────────────────────────────
function slotEl(id) { return document.getElementById(id); }

function updateSlotBalance() {
  slotEl('slot-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
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
}

function updateSlotTotalLabel() {
  const bet = parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET;
  const total = bet * NUM_LINES;
  slotEl('slot-total-label').textContent = `(Total: $${total.toLocaleString()})`;
  slotEl('slot-buy-cost').textContent =
    `Buy Hold&Win: $${(total * BUY_HW_MULTIPLIER).toLocaleString()}  |  Buy Ladder: $${(total * BUY_LADDER_MULTIPLIER).toLocaleString()}`;
}

// CRN only appears on reels 1, 3, 5 (cols 0, 2, 4)
const CROWN_REELS = new Set([0, 2, 4]);

function randomSymbol(col) {
  let sym;
  do {
    sym = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
  } while (sym === 'CRN' && col !== undefined && !CROWN_REELS.has(col));
  return sym;
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

      if (sym && SYM_DISPLAY[sym]) {
        const d = SYM_DISPLAY[sym];
        cell.style.background = isHL ? d.bg : '#0f1a30';
        cell.style.borderColor = isHL ? d.border : '#333';
        cell.style.borderWidth = isHL ? '2px' : '1px';

        const bigCls = d.big ? ' slot-emoji-big' : '';
        if (d.emoji && !d.label) {
          cell.innerHTML = `<span class="slot-emoji${bigCls}">${d.emoji}</span>`;
        } else if (d.emoji && d.label) {
          cell.innerHTML = `<span class="slot-emoji${bigCls}">${d.emoji}</span><span class="slot-label" style="color:${d.color}">${d.label}</span>`;
        } else {
          cell.innerHTML = `<span class="slot-text" style="color:${d.color}">${d.label}</span>`;
        }
      } else {
        cell.style.background = '#0f1a30';
        cell.style.borderColor = '#333';
      }
      container.appendChild(cell);
    }
  }
}

function renderHoldWinGrid(animating) {
  const container = slotEl('slot-grid');
  container.innerHTML = '';
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';

      const coinVal = holdWinCoins[row][col];

      if (coinVal !== null) {
        cell.style.background = '#2a2200';
        cell.style.borderColor = '#f0c040';
        cell.style.borderWidth = '2px';
        cell.classList.add('hw-coin');
        cell.innerHTML = `<span class="slot-emoji">💰</span><span class="coin-value">${coinVal}x</span>`;
      } else if (animating) {
        const sym = slotGrid[row][col];
        if (sym && SYM_DISPLAY[sym]) {
          const d = SYM_DISPLAY[sym];
          cell.style.background = '#0f1a30';
          cell.style.borderColor = '#555';
          if (d.emoji && !d.label) {
            cell.innerHTML = `<span class="slot-emoji">${d.emoji}</span>`;
          } else if (d.emoji) {
            cell.innerHTML = `<span class="slot-emoji">${d.emoji}</span>`;
          } else {
            cell.innerHTML = `<span class="slot-text" style="color:${d.color}">${d.label}</span>`;
          }
        }
      } else {
        cell.style.background = '#080815';
        cell.style.borderColor = '#222';
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
  document.querySelectorAll('.speed-btn').forEach(b => {
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
    return [5, '7', PAYOUTS['7'][5]];
  }
  let count = 0;
  for (const s of syms) {
    if (s === base || s === 'WLD') count++;
    else break;
  }
  if (count >= 3) {
    const mult = (PAYOUTS[base] || {})[count] || 0;
    return [count, base, mult];
  }
  return [0, null, 0];
}

// ─── SPIN ──────────────────────────────────────────────────────────
function slotSpin() {
  if (slotSpinning || holdWinActive || ladderActive) return;

  const betPerLine = parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET;
  const totalBet = betPerLine * NUM_LINES;
  if (totalBet > balance) {
    setSlotMsg(`Need $${totalBet.toLocaleString()}!`, 'lose');
    return;
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
  if (slotSpinning || holdWinActive || ladderActive) return;
  const betPerLine = parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET;
  const cost = betPerLine * NUM_LINES * BUY_HW_MULTIPLIER;
  if (cost > balance) {
    setSlotMsg(`Need $${cost.toLocaleString()} to buy!`, 'lose');
    return;
  }
  balance -= cost;
  updateSlotBalance();

  // Place 6 random coins on the grid
  const positions = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      positions.push([r, c]);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const coinPositions = positions.slice(0, HOLD_WIN_TRIGGER);

  // Fill grid with BNS at coin positions, random elsewhere
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      slotGrid[r][c] = randomSymbol(c);
  for (const [r, c] of coinPositions)
    slotGrid[r][c] = 'BNS';

  renderSlotGrid();
  setTimeout(() => startHoldWin(coinPositions, betPerLine), 800);
}

function slotBuyLadder() {
  if (slotSpinning || holdWinActive || ladderActive) return;
  const betPerLine = parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET;
  const cost = betPerLine * NUM_LINES * BUY_LADDER_MULTIPLIER;
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
  if (sym && SYM_DISPLAY[sym]) {
    const d = SYM_DISPLAY[sym];
    const bigCls = d.big ? ' slot-emoji-big' : '';
    if (d.emoji && !d.label) {
      cell.innerHTML = `<span class="slot-emoji${bigCls}">${d.emoji}</span>`;
    } else if (d.emoji && d.label) {
      cell.innerHTML = `<span class="slot-emoji${bigCls}">${d.emoji}</span><span class="slot-label" style="color:${d.color}">${d.label}</span>`;
    } else {
      cell.innerHTML = `<span class="slot-text" style="color:${d.color}">${d.label}</span>`;
    }
  }
}

let _lastLocked = 0;
let _teaseDetected = false;
let _teaseExtraUsed = 0;

function checkTeaseCondition() {
  // Check ALL locked columns so far for near-triggers
  let crowns = 0, coins = 0;
  for (let col = 0; col < GRID_COLS; col++)
    for (let row = 0; row < GRID_ROWS; row++) {
      if (slotFinalGrid[row][col] === 'CRN') crowns++;
      if (slotFinalGrid[row][col] === 'BNS') coins++;
    }
  return (crowns >= 2) || (coins >= HOLD_WIN_TRIGGER - 1);
}

function animateSlotSpin(frame, betPerLine) {
  const sm = getSpeedMult();
  const totalBase = SLOT_SPIN_FRAMES + GRID_COLS;
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

  const totalAnim = totalBase + (_teaseDetected ? SLOT_TEASE_EXTRA_FRAMES : 0);
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
          cell.style.background = '#0f1a30';
          cell.style.borderColor = '#333';
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
          cell.style.background = '#0f1a30';
          cell.style.borderColor = '#4a5580';
        }
      }
      _lastLocked = locked;

      // Check for tease after locking (but before last reel)
      if (locked >= GRID_COLS - 1 && !_teaseDetected && locked < GRID_COLS) {
        if (checkTeaseCondition()) {
          _teaseDetected = true;
          setSlotMsg('...', 'win');
        }
      }
    }

    // Apply tease glow to spinning cells
    if (locked > 0 && locked < GRID_COLS) {
      let lockedCrowns = 0, lockedCoins = 0;
      for (let col = 0; col < locked; col++)
        for (let row = 0; row < GRID_ROWS; row++) {
          if (slotFinalGrid[row][col] === 'CRN') lockedCrowns++;
          if (slotFinalGrid[row][col] === 'BNS') lockedCoins++;
        }
      if (lockedCrowns >= 2 || lockedCoins >= HOLD_WIN_TRIGGER - 1) {
        for (let col = locked; col < GRID_COLS; col++)
          for (let row = 0; row < GRID_ROWS; row++)
            cells[row * GRID_COLS + col].classList.add('tease');
      }
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
          cell.style.background = '#0f1a30';
          cell.style.borderColor = '#4a5580';
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

  // BNS (coin) scatter count
  const bnsCells = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (slotGrid[r][c] === 'BNS') bnsCells.push([r,c]);
  const bnsCount = bnsCells.length;

  // Small scatter pay for 3-5 BNS (consolation, no bonus trigger)
  if (bnsCount >= 3 && bnsCount < HOLD_WIN_TRIGGER) {
    const scMult = SCATTER_PAYS[Math.min(bnsCount, 5)] || SCATTER_PAYS[5];
    const scatterPay = scMult * betPerLine * NUM_LINES;
    totalWin += scatterPay;
    details.push(`SCATTER ${bnsCount}x +$${scatterPay.toLocaleString()}`);
    for (const [r,c] of bnsCells) winningCells.add(`${r},${c}`);
  }

  // Crown scatter count
  const crownCells = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (slotGrid[r][c] === 'CRN') crownCells.push([r,c]);
  const crownCount = crownCells.length;

  if (crownCount >= 3) {
    const cMult = CROWN_SCATTER_PAYS[Math.min(crownCount, 5)] || CROWN_SCATTER_PAYS[5];
    const crownPay = cMult * betPerLine * NUM_LINES;
    totalWin += crownPay;
    details.push(`👑 CROWN ${crownCount}x +$${crownPay.toLocaleString()}`);
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
    const totalBet = (parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET) * NUM_LINES;
    if (totalWin >= totalBet * 10) {
      const felt = document.querySelector('.slot-machine-felt');
      felt.classList.add('big-win');
      setTimeout(() => felt.classList.remove('big-win'), 1200);
    }
  } else if (crownCount === 2 || bnsCount === HOLD_WIN_TRIGGER - 1) {
    setSlotMsg('So close! Spin again!', 'win');
  } else {
    setSlotMsg('No win — try again!');
  }

  setSlotDetail(details.slice(0, 5).join('  |  '));
  updateSlotStats();
  slotSpinning = false;

  // ── Bonus triggers ──
  let pendingLadder = null;
  if (crownCount >= 3) {
    pendingLadder = { betPerLine };
  }

  if (bnsCount >= HOLD_WIN_TRIGGER) {
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
  holdWinActive = true;
  holdWinSpinsLeft = HOLD_WIN_SPINS;
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
  setSlotMsg(`💰 HOLD & WIN! ${coinPositions.length} coins locked!`, 'win');

  setTimeout(runHoldWinSpin, 2000);
}

function updateHoldWinBar() {
  const totalVal = sumHoldWinCoins();
  const totalPay = totalVal * holdWinBet * NUM_LINES;
  slotEl('slot-bonus-bar').textContent =
    `HOLD & WIN — ${holdWinSpinsLeft} spin${holdWinSpinsLeft !== 1 ? 's' : ''} left  |  Total: $${totalPay.toLocaleString()}`;
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
  let newCoins = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (holdWinCoins[r][c] === null) {
        if (Math.random() < HOLD_WIN_COIN_CHANCE) {
          holdWinCoins[r][c] = randomCoinValue();
          newCoins++;
        }
      }
    }
  }

  renderHoldWinGrid(false);

  if (newCoins > 0) {
    holdWinSpinsLeft = HOLD_WIN_SPINS;
    setSlotMsg(`+${newCoins} new coin${newCoins > 1 ? 's' : ''}! Spins reset to ${HOLD_WIN_SPINS}!`, 'win');
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
  holdWinActive = false;
  slotEl('slot-bonus-bar').classList.add('hidden');

  let totalMult = sumHoldWinCoins();
  const isFull = countHoldWinCoins() >= GRID_ROWS * GRID_COLS;
  if (isFull) totalMult += HOLD_WIN_GRAND_BONUS;

  const payout = totalMult * holdWinBet * NUM_LINES;

  balance += payout;
  slotStats.wins++;
  slotStats.totalWon += payout;
  updateSlotBalance();
  updateSlotStats();

  const grandText = isFull ? ' + GRAND BONUS!' : '';
  setSlotMsg(`💰 HOLD & WIN: +$${payout.toLocaleString()}${grandText}`, 'win');

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
  setSlotMsg('👑 MULTIPLIER LADDER! Pick a tile to climb!', 'win');
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
  const level = LADDER_LEVELS[ladderLevel];

  let html = '<div class="ladder-container">';
  html += '<div class="ladder-title">👑 MULTIPLIER LADDER 👑</div>';

  html += '<div class="ladder-rungs">';
  for (let i = LADDER_LEVELS.length - 1; i >= 0; i--) {
    const lvl = LADDER_LEVELS[i];
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
    const prevMult = LADDER_LEVELS[ladderLevel - 1].mult;
    const collectPay = prevMult * ladderBasePay;
    html += `<div class="ladder-collect-info">Collect if wrong: $${collectPay.toLocaleString()} (${prevMult}x)</div>`;
  }

  if (ladderLevel >= LADDER_LEVELS.length - 1) {
    const topPay = LADDER_LEVELS[LADDER_LEVELS.length - 1].mult * ladderBasePay;
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
    const collectPay = LADDER_LEVELS[ladderLevel - 1].mult * ladderBasePay;
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
    const newMult = LADDER_LEVELS[ladderLevel].mult;
    const newPay = newMult * ladderBasePay;
    setSlotMsg(`⬆️ CLIMBED to ${newMult}x — $${newPay.toLocaleString()}!`, 'win');
    setTimeout(renderLadder, 1500);
  } else {
    if (ladderLevel > 0) {
      const prevMult = LADDER_LEVELS[ladderLevel - 1].mult;
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
  const mult = LADDER_LEVELS[ladderLevel].mult;
  const pay = mult * ladderBasePay;
  setSlotMsg(`Collected ${mult}x — $${pay.toLocaleString()}!`, 'win');
  setTimeout(endLadder, 1500);
}

function endLadder() {
  ladderActive = false;
  const overlay = document.getElementById('ladder-overlay');
  if (overlay) overlay.classList.add('hidden');

  let payout = 0;
  if (ladderLevel >= 0 && ladderLevel < LADDER_LEVELS.length) {
    payout = LADDER_LEVELS[ladderLevel].mult * ladderBasePay;
  }

  if (payout > 0) {
    balance += payout;
    slotStats.wins++;
    slotStats.totalWon += payout;
    updateSlotBalance();
    updateSlotStats();
    setSlotMsg(`👑 LADDER BONUS: +$${payout.toLocaleString()}!`, 'win');
  }

  // Check for pending hold & win (shouldn't happen but just in case)
  if (window._pendingFreeSpins) {
    window._pendingFreeSpins = null;
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
function initSlots() {
  updateSlotBalance();
  updateSlotTotalLabel();
  updateSlotStats();
  renderSlotGrid();

  slotEl('slot-bet').addEventListener('input', updateSlotTotalLabel);
}
