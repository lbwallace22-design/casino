/* ═══════════════════════════════════════════════════════════════════
   Thunder Rush — 3×5 collect slot (UI). Game math lives in blitz-engine.js.
   No paylines: Orbs (middle column) collect every prize coin in view.
   Gold coins fill a whole prize column. Orb + prize on both sides starts
   the Thunder Rush bonus, where MULTI and DOUBLE coins can land.
   ═══════════════════════════════════════════════════════════════════ */

const BLZ_ID = 'thunder';
const BLZ_BETS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const BLZ_SPEEDS = { normal: 1, fast: 0.55, turbo: 0.25 };

let blzBetIdx = 3;             // $10 default
let blzBusy = false;           // spin or bonus in progress
let blzAuto = false;
let blzSpeed = 'normal';
let blzBonus = null;           // engine bonus state while the bonus runs
let blzBonusBet = 0;
let blzStats = null;

const blzSleep = ms => new Promise(res => setTimeout(res, ms * BLZ_SPEEDS[blzSpeed]));
const blz$ = id => document.getElementById(id);

function blzBet() { return BLZ_BETS[blzBetIdx]; }
function blzMoney(x) {
  const v = Math.round(x * blzBet() * 100) / 100;
  if (v >= 1e6) return `$${+(v / 1e6).toFixed(2)}M`;
  if (v >= 1e4) return `$${+(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

// ─── LAUNCH / LOBBY ────────────────────────────────────────────────
function launchThunderRush() {
  blzStats = slotStatsFor(BLZ_ID);
  showScreen('blitz-screen');
  blzBonus = null;
  blzRenderBoards([blzEmptyGrid()]);
  blzUpdateBetUI();
  blzUpdateBalance();
  blzUpdateStats();
  blzSetBonusBar(false);
  blzMsg('Orbs collect every coin in view. Spin it!');
  blzDetail('');
  blz$('blz-odds').innerHTML = blzOddsHTML();
}

function blzBackToLobby() {
  if (blzBusy) { blzMsg('Finish the round first!'); return; }
  blzAuto = false;
  blzToggleOdds(false);
  checkAutoReset();
  showScreen('slot-lobby-screen');
  initSlotLobby();
}

// ─── SMALL UI HELPERS ──────────────────────────────────────────────
function blzMsg(text, cls = '') {
  const el = blz$('blz-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' ' + cls : '');
}
function blzDetail(text) { blz$('blz-detail').textContent = text; }
function blzUpdateBalance() {
  blz$('blz-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  saveBalance();
}
function blzUpdateStats() {
  blz$('blz-stats').textContent =
    `Spins: ${blzStats.spins.toLocaleString()}  |  Wins: ${blzStats.wins.toLocaleString()}  |  Won: $${blzStats.totalWon.toLocaleString()}`;
  saveSlotStats();
}
function blzUpdateBetUI() {
  blz$('blz-bet').textContent = `$${blzBet().toLocaleString()}`;
  blz$('blz-buy').innerHTML = `BUY BONUS<small>$${(blzBet() * BLZ_BUY_MULT).toLocaleString()}</small>`;
  const jp = blz$('blz-jackpots');
  jp.innerHTML = Object.entries(BLZ_JACKPOTS).map(([k, j]) =>
    `<div class="blz-jp blz-jp-${k}"><span>${j.label}</span><strong>${blzMoney(j.x)}</strong></div>`).join('');
}
function blzChangeBet(dir) {
  if (blzBusy) return;
  blzBetIdx = Math.max(0, Math.min(BLZ_BETS.length - 1, blzBetIdx + dir));
  blzUpdateBetUI();
}
function blzSetButtons(enabled) {
  for (const id of ['blz-spin', 'blz-buy', 'blz-bet-down', 'blz-bet-up', 'blz-back']) blz$(id).disabled = !enabled;
  blz$('blz-spin').textContent = blzAuto ? 'STOP' : 'SPIN';
  if (blzAuto) blz$('blz-spin').disabled = false;
}
function blzCycleSpeed() {
  const order = Object.keys(BLZ_SPEEDS);
  blzSpeed = order[(order.indexOf(blzSpeed) + 1) % order.length];
  blz$('blz-speed').textContent = `⏩ ${blzSpeed.toUpperCase()}`;
}
function blzToggleAuto() {
  blzAuto = !blzAuto;
  blz$('blz-auto').classList.toggle('on', blzAuto);
  blz$('blz-auto').textContent = blzAuto ? '🔁 AUTO ON' : '🔁 AUTO';
  if (blzAuto && !blzBusy) blzSpin();
  else blzSetButtons(!blzBusy);
}
function blzToggleOdds(show) {
  blz$('blz-odds-overlay').classList.toggle('hidden', !show);
}

// ─── RENDERING ─────────────────────────────────────────────────────
function blzCellHTML(cell) {
  if (!cell) return '';
  if (cell.type === 'orb') return `<div class="blz-sym blz-orb${cell.locked ? ' locked' : ''}"><span>⚡</span></div>`;
  if (cell.type === 'multi') return `<div class="blz-sym blz-multi"><small>MULTI</small><strong>x${cell.value}</strong></div>`;
  if (cell.type === 'double') return `<div class="blz-sym blz-double"><small>DOUBLE</small><strong>2×</strong></div>`;
  // prize
  if (typeof cell.value === 'string') {
    return `<div class="blz-sym blz-coin blz-coin-${cell.value}${cell.gold ? ' gold' : ''}"><strong>${BLZ_JACKPOTS[cell.value].label}</strong></div>`;
  }
  return `<div class="blz-sym blz-coin${cell.gold ? ' gold' : ''}"><strong>${blzMoney(cell.value)}</strong></div>`;
}

function blzRenderBoards(grids, orbLocks) {
  const wrap = blz$('blz-boards');
  wrap.classList.toggle('two', grids.length > 1);
  wrap.style.paddingTop = grids.length > 1 ? '8px' : '';
  wrap.innerHTML = grids.map((g, bi) => `
    <div class="blz-board" data-board="${bi}" data-label="BOARD ${bi + 1}">
      ${[...Array(BLZ_ROWS).keys()].map(r => [...Array(BLZ_COLS).keys()].map(c => {
        const locked = orbLocks && c === BLZ_ORB_COL && orbLocks[bi] && orbLocks[bi][r];
        return `<div class="blz-cell${c === BLZ_ORB_COL ? ' orb-col' : ''}${locked ? ' locked' : ''}" data-c="${c}" data-r="${r}">${blzCellHTML(g[c][r])}</div>`;
      }).join('')).join('')}
    </div>`).join('');
}

function blzCellEl(bi, c, r) {
  return document.querySelector(`#blz-boards .blz-board[data-board="${bi}"] .blz-cell[data-c="${c}"][data-r="${r}"]`);
}

function blzRandomFace(c) {
  if (c === BLZ_ORB_COL) return Math.random() < 0.3 ? { type: 'orb' } : null;
  return Math.random() < 0.35 ? { type: 'prize', value: blzPick(BLZ_PRIZE_TABLE) } : null;
}

// Spin animation for the given cells, stopping column by column
async function blzAnimateSpin(bi, finalGrid, spinCells, opts = {}) {
  const cols = [...new Set(spinCells.map(([c]) => c))].sort();
  const stopAt = {};
  let t = opts.base || 420;
  for (const c of cols) { stopAt[c] = t; t += opts.step || 260; }
  if (opts.teaseCol !== undefined && stopAt[opts.teaseCol]) stopAt[opts.teaseCol] += 650;
  for (const [c, r] of spinCells) blzCellEl(bi, c, r)?.classList.add('spinning');
  if (opts.teaseCol !== undefined) {
    for (let r = 0; r < BLZ_ROWS; r++) blzCellEl(bi, opts.teaseCol, r)?.classList.add('tease');
  }
  const start = performance.now();
  const mult = BLZ_SPEEDS[blzSpeed];
  await new Promise(resolve => {
    const done = new Set();
    const tick = () => {
      const el = performance.now() - start;
      for (const [c, r] of spinCells) {
        const key = `${c},${r}`;
        if (done.has(key)) continue;
        const cell = blzCellEl(bi, c, r);
        if (!cell) { done.add(key); continue; }
        if (el >= stopAt[c] * mult) {
          cell.classList.remove('spinning', 'tease');
          cell.innerHTML = blzCellHTML(finalGrid[c][r]);
          if (finalGrid[c][r]) cell.classList.add('landed');
          done.add(key);
        } else {
          cell.innerHTML = blzCellHTML(blzRandomFace(c));
        }
      }
      if (done.size >= spinCells.length) resolve();
      else setTimeout(tick, 55);
    };
    tick();
  });
}

function blzSetBonusBar(on) {
  const bar = blz$('blz-bonus-bar');
  bar.classList.toggle('hidden', !on);
  if (!on || !blzBonus) return;
  const dots = [...Array(BLZ_RESPINS).keys()].map(i =>
    `<span class="blz-dot${i < blzBonus.respins ? ' on' : ''}"></span>`).join('');
  bar.innerHTML = `
    <span class="blz-bb-spins">RESPINS ${dots}</span>
    <span class="blz-bb-mult${blzBonus.mult > 1 ? ' on' : ''}" id="blz-mult-badge">x${blzBonus.mult}</span>
    <span class="blz-bb-total">${blzMoney(blzBonus.totalX)}</span>`;
}

function blzFloat(bi, c, r, text, cls = '') {
  const cell = blzCellEl(bi, c, r);
  if (!cell) return;
  const f = document.createElement('div');
  f.className = 'blz-float ' + cls;
  f.textContent = text;
  cell.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

// ─── BASE GAME ─────────────────────────────────────────────────────
function blzSpinClick() {
  if (blzAuto) { blzToggleAuto(); return; }   // SPIN doubles as STOP during autoplay
  blzSpin();
}

async function blzSpin() {
  if (blzBusy) return;
  const bet = blzBet();
  if (bet > balance) {
    blzMsg(`Not enough balance for a $${bet.toLocaleString()} spin`, 'lose');
    if (blzAuto) blzToggleAuto();
    return;
  }
  blzBusy = true;
  blzSetButtons(false);
  balance -= bet;
  blzUpdateBalance();
  blzStats.spins++;
  blzMsg('');
  blzDetail('');

  const { grid, surged, goldCols } = blzRollBase();
  // Gold columns flash as they land; tease the last prize column when the bonus is one coin away
  const orbs = blzCount(grid, BLZ_ORB_COL, 'orb');
  const teaseCol = orbs && blzCount(grid, 0, 'prize') ? 2 : undefined;
  blzRenderBoards([blzEmptyGrid()]);
  const all = [];
  for (let c = 0; c < BLZ_COLS; c++) for (let r = 0; r < BLZ_ROWS; r++) all.push([c, r]);
  if (surged) {
    blzMsg('⚡ SURGE! ⚡', 'win');
    blz$('blz-machine').classList.add('surge');
  }
  await blzAnimateSpin(0, grid, all, { teaseCol });
  blz$('blz-machine').classList.remove('surge');
  for (const c of goldCols) {
    for (let r = 0; r < BLZ_ROWS; r++) blzCellEl(0, c, r)?.classList.add('gold-fill');
  }
  if (goldCols.length) achUnlock('blz_gold');

  const payX = blzBasePayX(grid);
  let payout = 0;
  if (payX > 0) {
    payout = Math.round(payX * bet);
    await blzCollectBase(grid, orbs);
    balance += payout;
    blzUpdateBalance();
    blzStats.wins++;
    blzStats.totalWon += payout;
    blzMsg(`⚡ ${orbs > 1 ? `${orbs} ORBS COLLECT` : 'COLLECT'}: +$${payout.toLocaleString()}`, 'win');
    if (payX >= 10) blz$('blz-machine').classList.add('bigwin');
  } else if (blzPrizesInView(grid).length && !orbs) {
    blzMsg('No Orb — coins fizzle out');
  } else {
    blzMsg('No win');
  }
  achRound('slots', { wager: bet, payout });

  if (blzTriggers(grid)) {
    await blzSleep(700);
    await blzRunBonus(blzOrbRows(grid), bet, false);
  }
  blzUpdateStats();
  setTimeout(() => blz$('blz-machine').classList.remove('bigwin'), 900);
  blzBusy = false;
  blzSetButtons(true);
  checkAutoReset();
  blzUpdateBalance();
  if (blzAuto) {
    await blzSleep(payX > 0 ? 700 : 300);
    if (blzAuto && !blzBusy) blzSpin();
  }
}

async function blzCollectBase(grid, orbs) {
  for (let r = 0; r < BLZ_ROWS; r++) if (grid[BLZ_ORB_COL][r]) blzCellEl(0, BLZ_ORB_COL, r)?.classList.add('charging');
  for (const p of blzPrizesInView(grid)) {
    const el = blzCellEl(0, p.c, p.r);
    el?.classList.add('collected');
    blzFloat(0, p.c, p.r, `+${blzMoney(p.x * orbs)}`);
    await blzSleep(110);
  }
  await blzSleep(450);
}

// ─── BONUS ─────────────────────────────────────────────────────────
async function blzBuyBonus() {
  if (blzBusy) return;
  const bet = blzBet();
  const cost = bet * BLZ_BUY_MULT;
  if (cost > balance) { blzMsg(`Need $${cost.toLocaleString()} to buy the bonus`, 'lose'); return; }
  blzBusy = true;
  blzSetButtons(false);
  balance -= cost;
  blzUpdateBalance();
  achRound('slots', { wager: cost, countRound: false });
  await blzRunBonus(blzBuyOrbRows(), bet, true);
  blzUpdateStats();
  blzBusy = false;
  blzSetButtons(true);
  checkAutoReset();
  blzUpdateBalance();
}

async function blzRunBonus(orbRows, bet, bought) {
  blzBonus = blzNewBonus(orbRows);
  blzBonusBet = bet;
  achUnlock('blz_bonus');
  const banner = blz$('blz-banner');
  banner.innerHTML = `<strong>THUNDER RUSH</strong><span>${bought ? 'Bonus bought' : `${orbRows.length} Orb${orbRows.length > 1 ? 's' : ''} locked`} · 3 respins</span>`;
  banner.classList.add('show');
  blz$('blz-machine').classList.add('bonus');
  await blzSleep(1500);
  banner.classList.remove('show');
  blzRenderBonus();
  blzSetBonusBar(true);
  blzMsg('Every locked Orb collects every coin that lands');

  while (true) {
    const prevBoards = blzBonus.boards.length;
    const prevMult = blzBonus.mult;
    // Snapshot locks before the spin so the animation only spins open cells
    const locks = blzBonus.boards.map(b => [...b.orbs]);
    const res = blzBonusSpin(blzBonus);
    // Animate every board in parallel
    blzRenderBoards(locks.map(() => blzEmptyGrid()), locks);
    for (const [bi, l] of locks.entries()) {
      for (let r = 0; r < BLZ_ROWS; r++) if (l[r]) {
        const el = blzCellEl(bi, BLZ_ORB_COL, r);
        if (el) el.innerHTML = blzCellHTML({ type: 'orb', locked: true });
      }
    }
    await Promise.all(locks.map((l, bi) => {
      const open = [];
      for (let c = 0; c < BLZ_COLS; c++) for (let r = 0; r < BLZ_ROWS; r++) {
        if (!(c === BLZ_ORB_COL && l[r])) open.push([c, r]);
      }
      return blzAnimateSpin(bi, blzBonus.boards[bi].grid, open, { base: 260, step: 120 });
    }));

    // New Orbs lock with a zap
    for (const [bi, b] of blzBonus.boards.slice(0, locks.length).entries()) {
      for (let r = 0; r < BLZ_ROWS; r++) {
        if (b.orbs[r] && !locks[bi][r]) {
          const el = blzCellEl(bi, BLZ_ORB_COL, r);
          el?.classList.add('locked', 'zap');
          blzFloat(bi, BLZ_ORB_COL, r, 'LOCKED', 'orb');
        }
      }
      if (blzOrbCount(b) === BLZ_ROWS) achUnlock('blz_full');
    }
    // MULTI coins power up the multiplier
    for (const ev of res.events.filter(e => e.kind === 'multi')) {
      blzFloat(ev.board, ev.c, ev.r, `x${ev.value}`, 'multi');
      blzCellEl(ev.board, ev.c, ev.r)?.classList.add('collected');
    }
    if (blzBonus.mult !== prevMult) {
      blzSetBonusBar(true);
      blz$('blz-mult-badge')?.classList.add('pop');
      blzMsg(`⚡ MULTI! Cash coins now pay x${blzBonus.mult}`, 'win');
      if (blzBonus.mult >= BLZ_MULT_CAP) achUnlock('blz_mult_max');
      await blzSleep(650);
    }
    // Collect this spin's prizes
    for (const [bi, b] of blzBonus.boards.slice(0, locks.length).entries()) {
      for (let r = 0; r < BLZ_ROWS; r++) if (b.orbs[r]) blzCellEl(bi, BLZ_ORB_COL, r)?.classList.toggle('charging', b.lastCollect.length > 0);
      for (const p of b.lastCollect) {
        blzCellEl(bi, p.c, p.r)?.classList.add('collected');
        blzFloat(bi, p.c, p.r, `+${blzMoney(p.paidX)}`, typeof p.value === 'string' ? 'jackpot' : '');
        await blzSleep(90);
      }
    }
    if (res.spinX > 0) {
      const pay = Math.round(res.spinX * bet);
      balance += pay;                       // credit as we go, so a reload never loses collected wins
      blzStats.totalWon += pay;
      blzUpdateBalance();
    }
    // DOUBLE board opens
    if (blzBonus.boards.length > prevBoards) {
      blzMsg('⚡ DOUBLE BOARD! Your Orbs copy over', 'win');
      achUnlock('blz_double');
      await blzSleep(650);
      blzRenderBonus(true);
      await blzSleep(700);
    }
    blzSetBonusBar(true);
    if (res.done) break;
    await blzSleep(res.landed ? 520 : 380);
  }

  const totalPay = Math.round(blzBonus.totalX * bet);
  blzStats.wins++;
  const parts = [];
  if (blzBonus.boards.length > 1) parts.push('Double board');
  if (blzBonus.mult > 1) parts.push(`x${blzBonus.mult} multi`);
  if (blzBonus.jackpots.length) parts.push(blzBonus.jackpots.map(j => BLZ_JACKPOTS[j].label).join(', '));
  if (blzBonus.capped) parts.push(`max win ${BLZ_MAX_WIN_X.toLocaleString()}x`);
  blzMsg(`THUNDER RUSH WIN: $${totalPay.toLocaleString()}`, 'win');
  blzDetail(parts.join(' · '));
  achRound('slots', { payout: totalPay, countRound: false });
  if (blzBonus.jackpots.includes('grand')) achUnlock('blz_grand');
  blz$('blz-machine').classList.remove('bonus');
  if (blzBonus.totalX >= 50) blz$('blz-machine').classList.add('bigwin');
  blzSetBonusBar(false);
  blzBonus = null;
}

function blzRenderBonus(slideIn) {
  const grids = blzBonus.boards.map(b => {
    const g = blzEmptyGrid();
    for (let r = 0; r < BLZ_ROWS; r++) if (b.orbs[r]) g[BLZ_ORB_COL][r] = { type: 'orb', locked: true };
    return g;
  });
  blzRenderBoards(grids, blzBonus.boards.map(b => b.orbs));
  if (slideIn) document.querySelector('#blz-boards .blz-board[data-board="1"]')?.classList.add('slide-in');
}

// ─── ODDS / RULES ──────────────────────────────────────────────────
function blzOddsHTML() {
  const jp = Object.values(BLZ_JACKPOTS).map(j => `<li><strong>${j.label}</strong> ${j.x.toLocaleString()}× bet</li>`).join('');
  return `
    <p><strong>No paylines.</strong> Coins land on the outer columns, ⚡ Orbs land in the middle.
    Every Orb collects every coin in view, so 2 Orbs pay double.</p>
    <p><strong>Coins:</strong> 1×, 2×, 3×, 5×, 7×, 10× or 15× your bet, or a jackpot:</p>
    <ul>${jp}</ul>
    <p><strong>Gold coin:</strong> fills its whole column with 5 copies of itself.</p>
    <p><strong>Surge:</strong> can strike when any coin lands and guarantees the bonus.</p>
    <p><strong>Thunder Rush bonus:</strong> an Orb plus a coin on <em>both</em> sides. Orbs lock, you get 3 respins,
    and anything landing resets them to 3. Every locked Orb collects every coin that lands.</p>
    <p><strong>MULTI coin</strong> (bonus only): x2, x3 or x5. Multis add together (x2 + x3 = x5), up to x${BLZ_MULT_CAP}, and boost every cash coin for the rest of the bonus. Jackpots aren't multiplied.</p>
    <p><strong>DOUBLE coin</strong> (bonus only): opens a second board with your Orbs copied over. Both boards spin every respin.</p>
    <p><strong>Buy bonus:</strong> ${BLZ_BUY_MULT}× bet. Max win ${BLZ_MAX_WIN_X.toLocaleString()}× bet. Long-run return ≈ 93–95%.</p>`;
}
