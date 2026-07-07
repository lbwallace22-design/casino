/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Mines
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const MINES_TILES = 25;
const MINES_DEFAULT_BET = 25;
const MINES_DEFAULT_COUNT = 3;
const MINES_HOUSE_EDGE = 0.97;

// ─── STATE ─────────────────────────────────────────────────────────
let minesActive = false;
let minesField = [];      // true = mine
let minesRevealed = [];
let minesBet = 0;
let minesCount = MINES_DEFAULT_COUNT;
let minesPicks = 0;
let minesStats = { games: 0, wins: 0, won: 0 };

// ─── DOM HELPERS ───────────────────────────────────────────────────
function minesEl(id) { return document.getElementById(id); }

function updateMinesBalance() {
  minesEl('mines-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
}

function setMinesMsg(text, cls = '') {
  const el = minesEl('mines-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' ' + cls : '');
}

function setMinesDetail(text) { minesEl('mines-detail').textContent = text; }

function updateMinesStats() {
  minesEl('mines-stats').textContent =
    `Games: ${minesStats.games}  |  Wins: ${minesStats.wins}  |  Won: $${minesStats.won.toLocaleString()}`;
}

// Multiplier after `picks` safe reveals with `mines` mines on the field
function minesMultiplier(picks, mines) {
  let m = 1;
  for (let i = 0; i < picks; i++)
    m *= (MINES_TILES - i) / (MINES_TILES - mines - i);
  return m * MINES_HOUSE_EDGE;
}

function minesCashValue() {
  return Math.floor(minesBet * minesMultiplier(minesPicks, minesCount));
}

// ─── RENDER ────────────────────────────────────────────────────────
function renderMinesGrid(revealAll, hitIndex) {
  const grid = minesEl('mines-grid');
  grid.innerHTML = '';
  for (let i = 0; i < MINES_TILES; i++) {
    const tile = document.createElement('button');
    tile.className = 'mines-tile';
    if (minesRevealed[i]) {
      tile.classList.add(minesField[i] ? 'mines-hit' : 'mines-gem');
      if (i === hitIndex) tile.classList.add('mines-boom');
      tile.textContent = minesField[i] ? '💣' : '💎';
      tile.disabled = true;
    } else if (revealAll) {
      tile.classList.add('mines-shown');
      tile.textContent = minesField[i] ? '💣' : '💎';
      tile.disabled = true;
    } else if (minesActive) {
      tile.textContent = '';
      tile.onclick = () => minesPick(i);
    } else {
      tile.disabled = true;
    }
    grid.appendChild(tile);
  }
}

function setMinesButtons() {
  minesEl('btn-mines-start').disabled = minesActive;
  minesEl('btn-mines-cashout').disabled = !minesActive || minesPicks === 0;
  minesEl('mines-bet').disabled = minesActive;
  minesEl('mines-count').disabled = minesActive;
  const cbtn = minesEl('btn-mines-cashout');
  cbtn.textContent = (minesActive && minesPicks > 0)
    ? `CASH OUT $${minesCashValue().toLocaleString()}`
    : 'CASH OUT';
}

// ─── GAME FLOW ─────────────────────────────────────────────────────
function minesStart() {
  if (minesActive) return;
  let bet = parseInt(minesEl('mines-bet').value) || MINES_DEFAULT_BET;
  if (bet < 1) bet = MINES_DEFAULT_BET;
  let mines = parseInt(minesEl('mines-count').value) || MINES_DEFAULT_COUNT;
  mines = Math.max(1, Math.min(24, mines));
  minesEl('mines-count').value = mines;

  if (bet > balance) {
    checkAutoReset();
    updateMinesBalance();
    if (bet > balance) {
      setMinesMsg(`Need $${bet.toLocaleString()}!`, 'lose');
      return;
    }
  }
  balance -= bet;
  updateMinesBalance();

  minesBet = bet;
  minesCount = mines;
  minesPicks = 0;
  minesField = Array(MINES_TILES).fill(false);
  minesRevealed = Array(MINES_TILES).fill(false);
  minesStats.games++;

  // Place mines
  const idxs = Array.from({ length: MINES_TILES }, (_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  for (let k = 0; k < mines; k++) minesField[idxs[k]] = true;

  minesActive = true;
  renderMinesGrid();
  setMinesButtons();
  updateMinesStats();
  setMinesMsg(`${mines} mine${mines > 1 ? 's' : ''} hidden — pick a tile!`);
  setMinesDetail(`First tile: ${minesMultiplier(1, mines).toFixed(2)}x`);
}

function minesPick(i) {
  if (!minesActive || minesRevealed[i]) return;
  minesRevealed[i] = true;

  if (minesField[i]) {
    // BOOM
    minesActive = false;
    renderMinesGrid(true, i);
    setMinesButtons();
    setMinesMsg(`💥 BOOM! Lost $${minesBet.toLocaleString()}`, 'lose');
    setMinesDetail(`Made ${minesPicks} safe pick${minesPicks !== 1 ? 's' : ''} before the mine`);
    if (balance < 500) {
      checkAutoReset();
      updateMinesBalance();
    }
    return;
  }

  minesPicks++;
  const mult = minesMultiplier(minesPicks, minesCount);
  renderMinesGrid();

  // All safe tiles found — auto cash out
  if (minesPicks >= MINES_TILES - minesCount) {
    minesCashout(true);
    return;
  }

  const next = minesMultiplier(minesPicks + 1, minesCount);
  setMinesButtons();
  setMinesMsg(`${mult.toFixed(2)}x — $${minesCashValue().toLocaleString()} banked`, 'win');
  setMinesDetail(`Next tile: ${next.toFixed(2)}x`);
}

function minesCashout(cleared) {
  if (!minesActive || minesPicks === 0) return;
  const payout = minesCashValue();
  minesActive = false;
  balance += payout;
  minesStats.wins++;
  minesStats.won += payout;
  updateMinesBalance();
  updateMinesStats();
  renderMinesGrid(true);
  setMinesButtons();
  const profit = payout - minesBet;
  if (cleared) {
    setMinesMsg(`🏆 CLEARED THE FIELD! +$${payout.toLocaleString()}!`, 'win');
  } else {
    setMinesMsg(`💰 Cashed out $${payout.toLocaleString()} (${profit >= 0 ? '+' : ''}$${profit.toLocaleString()})`, 'win');
  }
  setMinesDetail('');
}

// ─── INIT ──────────────────────────────────────────────────────────
function initMines() {
  updateMinesBalance();
  updateMinesStats();
  if (!minesActive) {
    minesField = Array(MINES_TILES).fill(false);
    minesRevealed = Array(MINES_TILES).fill(false);
    renderMinesGrid();
    setMinesButtons();
    setMinesMsg('Set your bet and mines, then START!');
    setMinesDetail('');
  }
}
