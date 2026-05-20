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
const BUY_MULTIPLIER = 100;

const SYMBOLS = ["7","BAR","CHR","BEL","DIA","LEM","ORG","WLD","BNS"];

// Weighted symbol pools
const REEL_WEIGHTS = {
  "7":2,"BAR":4,"CHR":6,"BEL":6,"DIA":5,"LEM":8,"ORG":8,"WLD":2,"BNS":3
};
const BONUS_REEL_WEIGHTS = {
  "7":3,"BAR":5,"CHR":6,"BEL":6,"DIA":5,"LEM":7,"ORG":7,"WLD":5,"BNS":1
};

function buildPool(weights) {
  const pool = [];
  for (const [sym, w] of Object.entries(weights))
    for (let i = 0; i < w; i++) pool.push(sym);
  return pool;
}
const REEL_POOL = buildPool(REEL_WEIGHTS);
const BONUS_REEL_POOL = buildPool(BONUS_REEL_WEIGHTS);

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

// Scatter pays — multiplier on TOTAL bet
const SCATTER_PAYS = {3:5, 4:20, 5:100};

// Free-spin tiers: bonus_count → [num_spins, multiplier]
const FREE_SPIN_TIERS = {3:[12,3], 4:[15,5], 5:[20,10]};

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
  "WLD": { emoji:"⭐",  label:"WILD",  bg:"#2a1a00", border:"#ff6600", color:"#ff6600" },
  "BNS": { emoji:"💰",  label:"BONUS", bg:"#2a2200", border:"#f0c040", color:"#f0c040" },
};

// ─── STATE ─────────────────────────────────────────────────────────
let slotGrid = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(""));
let slotFinalGrid = null;
let slotSpinning = false;

// Bonus state
let bonusActive = false;
let bonusSpinsLeft = 0;
let bonusTotalSpins = 0;
let bonusMultiplier = 1;
let bonusWinnings = 0;
let bonusBet = 0;

let slotStats = { spins:0, wins:0, totalWon:0 };

// ─── DOM HELPERS ───────────────────────────────────────────────────
function slotEl(id) { return document.getElementById(id); }

function updateSlotBalance() {
  slotEl('slot-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  // Also update menu balance
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
  slotEl('slot-total-label').textContent = `(Total: $${(bet * NUM_LINES).toLocaleString()})`;
  slotEl('slot-buy-cost').textContent =
    `Buy Feature cost: $${(bet * NUM_LINES * BUY_MULTIPLIER).toLocaleString()}`;
}

function randomSymbol(useBonus) {
  const pool = useBonus ? BONUS_REEL_POOL : REEL_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
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

        if (d.emoji && !d.label) {
          cell.innerHTML = `<span class="slot-emoji">${d.emoji}</span>`;
        } else if (d.emoji && d.label) {
          cell.innerHTML = `<span class="slot-emoji">${d.emoji}</span><span class="slot-label" style="color:${d.color}">${d.label}</span>`;
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

// ─── BUTTONS ───────────────────────────────────────────────────────
function setSlotButtons(enabled) {
  slotEl('btn-spin').disabled = !enabled;
  slotEl('btn-max-bet').disabled = !enabled;
  slotEl('btn-buy-bonus').disabled = !enabled;
  slotEl('slot-bet').disabled = !enabled;
}

// ─── PAYLINE EVALUATION ────────────────────────────────────────────
function evalPayline(syms) {
  let base = null;
  for (const s of syms) {
    if (s === 'WLD') continue;
    if (s === 'BNS') return [0, null, 0];
    base = s;
    break;
  }
  if (base === null) {
    // All WILDs → pay as sevens
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
function slotSpin(isBonusSpin = false) {
  if (slotSpinning) return;

  let betPerLine;
  if (isBonusSpin) {
    betPerLine = bonusBet;
  } else {
    betPerLine = parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET;
    const totalBet = betPerLine * NUM_LINES;
    if (totalBet > balance) {
      setSlotMsg(`Need $${totalBet.toLocaleString()}!`, 'lose');
      return;
    }
    balance -= totalBet;
    updateSlotBalance();
  }

  slotSpinning = true;
  setSlotButtons(false);
  setSlotDetail('');

  if (!isBonusSpin) {
    slotStats.spins++;
    setSlotMsg('Spinning...');
  } else {
    const num = bonusTotalSpins - bonusSpinsLeft;
    setSlotMsg(`FREE SPIN ${num}/${bonusTotalSpins} (x${bonusMultiplier})`, 'win');
  }

  // Pre-generate final grid
  slotFinalGrid = Array.from({length: GRID_ROWS}, () =>
    Array.from({length: GRID_COLS}, () => randomSymbol(bonusActive))
  );

  animateSlotSpin(0, betPerLine, isBonusSpin);
}

function slotMaxSpin() {
  const cap = Math.min(100000, Math.floor(balance / NUM_LINES));
  if (cap < 1) {
    setSlotMsg('Not enough balance!', 'lose');
    return;
  }
  slotEl('slot-bet').value = cap;
  updateSlotTotalLabel();
  slotSpin();
}

function slotBuyFeature() {
  if (slotSpinning || bonusActive) return;
  const betPerLine = parseInt(slotEl('slot-bet').value) || SLOT_DEFAULT_BET;
  const cost = betPerLine * NUM_LINES * BUY_MULTIPLIER;
  if (cost > balance) {
    setSlotMsg(`Need $${cost.toLocaleString()} to buy!`, 'lose');
    return;
  }
  balance -= cost;
  updateSlotBalance();
  const [spins, mult] = FREE_SPIN_TIERS[3];
  startBonus(spins, mult, betPerLine);
}

// ─── ANIMATION ─────────────────────────────────────────────────────
function animateSlotSpin(frame, betPerLine, isBonusSpin) {
  const totalAnim = SLOT_SPIN_FRAMES + GRID_COLS;

  if (frame < totalAnim) {
    const locked = Math.max(0, frame - SLOT_SPIN_FRAMES + 1);
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (col < locked) {
          slotGrid[row][col] = slotFinalGrid[row][col];
        } else {
          slotGrid[row][col] = randomSymbol(bonusActive);
        }
      }
    }
    renderSlotGrid();

    let delay;
    if (frame < SLOT_SPIN_FRAMES) {
      const progress = frame / SLOT_SPIN_FRAMES;
      delay = Math.floor(SLOT_SPIN_DELAY + progress * progress * 120);
    } else {
      delay = SLOT_REEL_STOP_DELAY;
    }
    setTimeout(() => animateSlotSpin(frame + 1, betPerLine, isBonusSpin), delay);
  } else {
    // Final grid
    for (let row = 0; row < GRID_ROWS; row++)
      for (let col = 0; col < GRID_COLS; col++)
        slotGrid[row][col] = slotFinalGrid[row][col];
    resolveSlot(betPerLine, isBonusSpin);
  }
}

// ─── RESOLVE ───────────────────────────────────────────────────────
function resolveSlot(betPerLine, isBonusSpin) {
  let totalWin = 0;
  const details = [];
  const winningCells = new Set();

  // Payline wins
  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li];
    const syms = line.map(([r,c]) => slotGrid[r][c]);
    const [cnt, sym, mult] = evalPayline(syms);
    if (mult > 0) {
      let payout = mult * betPerLine;
      if (isBonusSpin) payout *= bonusMultiplier;
      totalWin += payout;
      const tag = isBonusSpin ? ` x${bonusMultiplier}` : '';
      details.push(`L${li+1}:${cnt}x${sym}+$${payout.toLocaleString()}${tag}`);
      for (let idx = 0; idx < cnt; idx++) {
        winningCells.add(`${line[idx][0]},${line[idx][1]}`);
      }
    }
  }

  // Scatter (BONUS) count
  const bonusCells = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (slotGrid[r][c] === 'BNS') bonusCells.push([r,c]);
  const bonusCount = bonusCells.length;

  if (bonusCount >= 3) {
    const scMult = SCATTER_PAYS[Math.min(bonusCount, 5)] || SCATTER_PAYS[5];
    let scatterPay = scMult * betPerLine * NUM_LINES;
    if (isBonusSpin) scatterPay *= bonusMultiplier;
    totalWin += scatterPay;
    details.push(`SCATTER ${bonusCount}x +$${scatterPay.toLocaleString()}`);
    for (const [r,c] of bonusCells) winningCells.add(`${r},${c}`);
  }

  renderSlotGrid(winningCells.size > 0 ? winningCells : null);

  if (isBonusSpin) {
    bonusWinnings += totalWin;
    slotEl('slot-bonus-bar').textContent =
      `FREE SPINS — ${bonusSpinsLeft} left  |  x${bonusMultiplier}  |  Won: $${bonusWinnings.toLocaleString()}`;
  } else {
    balance += totalWin;
    updateSlotBalance();
  }

  if (totalWin > 0) {
    slotStats.wins++;
    slotStats.totalWon += totalWin;
    setSlotMsg(`WIN! +$${totalWin.toLocaleString()}`, 'win');
  } else {
    const extra = isBonusSpin ? ` — ${bonusSpinsLeft} left` : ' — try again!';
    setSlotMsg(`No win${extra}`);
  }

  setSlotDetail(details.slice(0, 5).join('  |  '));
  updateSlotStats();
  slotSpinning = false;

  // Bonus trigger / retrigger
  if (bonusCount >= 3 && !isBonusSpin) {
    const tier = Math.min(bonusCount, 5);
    const [spins, mult] = FREE_SPIN_TIERS[tier];
    setTimeout(() => startBonus(spins, mult, betPerLine), 1500);
    return;
  }

  if (bonusCount >= 3 && isBonusSpin) {
    const retriggerSpins = {3:6, 4:8, 5:10};
    const extraSpins = retriggerSpins[Math.min(bonusCount, 5)] || 6;
    bonusSpinsLeft += extraSpins;
    bonusTotalSpins += extraSpins;
    setSlotMsg(`RETRIGGER! +${extraSpins} free spins!`, 'win');
  }

  // Continue or end bonus
  if (isBonusSpin) {
    if (bonusSpinsLeft > 0) {
      setTimeout(runBonusSpin, 1200);
    } else {
      setTimeout(endBonus, 1500);
    }
    return;
  }

  // Normal game — re-enable
  if (balance < NUM_LINES) {
    checkAutoReset();
    setSlotMsg('Balance reset! Press SPIN to play.', 'win');
    updateSlotBalance();
    setSlotButtons(true);
  } else {
    setSlotButtons(true);
  }
}

// ─── BONUS ROUND ───────────────────────────────────────────────────
function startBonus(numSpins, multiplier, betPerLine) {
  bonusActive = true;
  bonusSpinsLeft = numSpins;
  bonusTotalSpins = numSpins;
  bonusMultiplier = multiplier;
  bonusWinnings = 0;
  bonusBet = betPerLine;

  const bar = slotEl('slot-bonus-bar');
  bar.textContent = `FREE SPINS — ${numSpins} spins  |  x${multiplier}  |  Won: $0`;
  bar.classList.remove('hidden');

  setSlotMsg(`BONUS! ${numSpins} FREE SPINS at x${multiplier}!`, 'win');
  setTimeout(runBonusSpin, 2000);
}

function runBonusSpin() {
  if (bonusSpinsLeft <= 0) { endBonus(); return; }
  bonusSpinsLeft--;
  slotSpin(true);
}

function endBonus() {
  bonusActive = false;
  slotEl('slot-bonus-bar').classList.add('hidden');

  balance += bonusWinnings;
  updateSlotBalance();

  setSlotMsg(`BONUS COMPLETE! Won $${bonusWinnings.toLocaleString()}!`, 'win');
  slotSpinning = false;
  if (balance < NUM_LINES) {
    checkAutoReset();
    setSlotMsg('Balance reset! Press SPIN to play.', 'win');
    updateSlotBalance();
    setSlotButtons(true);
  } else {
    setSlotButtons(true);
  }
}

// ─── INIT ──────────────────────────────────────────────────────────
function initSlots() {
  updateSlotBalance();
  updateSlotTotalLabel();
  updateSlotStats();
  renderSlotGrid();

  slotEl('slot-bet').addEventListener('input', updateSlotTotalLabel);
}
