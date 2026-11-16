/* ═══════════════════════════════════════════════════════════════════
   Thunder Rush — pure game engine (no DOM). Loaded by the page and by
   the node RTP simulator in tests/blitz-sim.js.

   3 columns × 5 rows. No paylines.
   - Columns 0 and 2 hold Prize coins (bet multiples or jackpots).
   - Column 1 holds Orbs. Every Orb collects every prize in view.
   - Gold Boost: a gold coin fills a whole prize column with copies of itself.
   - Hold & Win: Orb + a prize in BOTH prize columns. Orbs lock, 3 respins
     that reset on any landing; each locked Orb collects every new prize.
     Inside the bonus, MULTI coins add to a bonus multiplier and a DOUBLE
     coin opens a second board.
   ═══════════════════════════════════════════════════════════════════ */

const BLZ_ROWS = 5;
const BLZ_COLS = 3;
const BLZ_ORB_COL = 1;
const BLZ_PRIZE_COLS = [0, 2];
const BLZ_RESPINS = 3;
const BLZ_MAX_WIN_X = 10000;     // win cap, in multiples of the total bet
const BLZ_BUY_MULT = 52;         // bonus buy price, in multiples of the total bet
const BLZ_MULT_CAP = 10;
const BLZ_DOUBLE_DAMP = 0.6;     // with two boards, each board lands coins this much as often         // bonus multiplier can't stack past this

const BLZ_JACKPOTS = {
  mini:  { label: 'MINI',  x: 25 },
  minor: { label: 'MINOR', x: 50 },
  major: { label: 'MAJOR', x: 150 },
  grand: { label: 'GRAND', x: 1000 },
};

// Prize values that can land: [value or jackpot key, weight]
const BLZ_PRIZE_TABLE = [
  [1, 400], [2, 250], [3, 150], [5, 90], [7, 50], [10, 30], [15, 15],
  ['mini', 6], ['minor', 2.5], ['major', 1], ['grand', 0.3],
];
// Inside the bonus: same values, rarer jackpots (they're collected by every Orb)
const BLZ_BONUS_PRIZE_TABLE = [
  [1, 300], [2, 220], [3, 160], [5, 120], [7, 80], [10, 60], [15, 40],
  ['mini', 6], ['minor', 2.5], ['major', 0.8], ['grand', 0.12],
];
// The gold coin never carries the Grand (a full column of Grands would be 5,000x)
const BLZ_GOLD_TABLE = BLZ_PRIZE_TABLE.filter(([v]) => v !== 'grand' && v !== 'major');
const BLZ_MULTI_TABLE = [[2, 70], [3, 25], [5, 5]];

const BLZ_ODDS = {
  base: {
    orb: 0.10,         // per middle cell
    prize: 0.024,      // per prize cell
    gold: 0.0045,      // per prize column
    surge: 0.004,      // per spin with at least one coin in view
  },
  bonus: {
    orb: 0.012,
    prize: 0.046,
    gold: 0.0012,
    multi: 0.002,      // per prize cell
    double: 0.0015,    // per prize cell, only while there is one board
  },
};

// ─── RNG helpers ───────────────────────────────────────────────────
let blzRand = Math.random;
function blzSetRng(fn) { blzRand = fn; }
function blzPick(table) {
  const total = table.reduce((t, [, w]) => t + w, 0);
  let r = blzRand() * total;
  for (const [v, w] of table) { if ((r -= w) < 0) return v; }
  return table[table.length - 1][0];
}
function blzPrizeX(v) { return typeof v === 'number' ? v : BLZ_JACKPOTS[v].x; }

// A cell is null (blank) or one of:
//   { type:'orb' }
//   { type:'prize', value, gold? }
//   { type:'multi', value }
//   { type:'double' }
function blzEmptyGrid() {
  return Array.from({ length: BLZ_COLS }, () => Array(BLZ_ROWS).fill(null));
}

function blzFillGold(grid, col) {
  const value = blzPick(BLZ_GOLD_TABLE);
  for (let r = 0; r < BLZ_ROWS; r++) grid[col][r] = { type: 'prize', value, gold: true };
}

/** Roll a base-game grid. Returns { grid, surged, goldCols } */
function blzRollBase() {
  const o = BLZ_ODDS.base;
  const grid = blzEmptyGrid();
  const goldCols = [];
  for (let r = 0; r < BLZ_ROWS; r++) if (blzRand() < o.orb) grid[BLZ_ORB_COL][r] = { type: 'orb' };
  for (const c of BLZ_PRIZE_COLS) {
    if (blzRand() < o.gold) { blzFillGold(grid, c); goldCols.push(c); continue; }
    for (let r = 0; r < BLZ_ROWS; r++) {
      if (blzRand() < o.prize) grid[c][r] = { type: 'prize', value: blzPick(BLZ_PRIZE_TABLE) };
    }
  }
  // Surge: when any coin is in view, it may flood the grid to guarantee the bonus
  let surged = false;
  const anyCoin = grid.some(col => col.some(Boolean));
  if (anyCoin && !blzTriggers(grid) && blzRand() < o.surge) {
    surged = true;
    blzSurge(grid);
  }
  return { grid, surged, goldCols };
}

function blzSurge(grid) {
  const emptyRows = col => [...Array(BLZ_ROWS).keys()].filter(r => !grid[col][r]);
  const addOne = (col, cell) => {
    const rows = emptyRows(col);
    if (rows.length) grid[col][rows[Math.floor(blzRand() * rows.length)]] = cell;
  };
  const extraOrbs = 1 + (blzRand() < 0.35 ? 1 : 0);
  for (let i = 0; i < extraOrbs; i++) if (blzCount(grid, BLZ_ORB_COL, 'orb') < BLZ_ROWS) addOne(BLZ_ORB_COL, { type: 'orb' });
  for (const c of BLZ_PRIZE_COLS) {
    if (!blzCount(grid, c, 'prize')) addOne(c, { type: 'prize', value: blzPick(BLZ_PRIZE_TABLE) });
  }
}

function blzCount(grid, col, type) {
  return grid[col].filter(cell => cell && cell.type === type).length;
}

function blzTriggers(grid) {
  return blzCount(grid, BLZ_ORB_COL, 'orb') > 0 &&
         BLZ_PRIZE_COLS.every(c => blzCount(grid, c, 'prize') > 0);
}

/** Value of every prize in view, in bet multiples, and the list of prizes. */
function blzPrizesInView(grid) {
  const prizes = [];
  for (const c of BLZ_PRIZE_COLS) {
    for (let r = 0; r < BLZ_ROWS; r++) {
      const cell = grid[c][r];
      if (cell && cell.type === 'prize') prizes.push({ c, r, value: cell.value, x: blzPrizeX(cell.value) });
    }
  }
  return prizes;
}

/** Base-game payout in bet multiples: each Orb collects every prize. */
function blzBasePayX(grid) {
  const orbs = blzCount(grid, BLZ_ORB_COL, 'orb');
  if (!orbs) return 0;
  return orbs * blzPrizesInView(grid).reduce((t, p) => t + p.x, 0);
}

// ─── HOLD & WIN ────────────────────────────────────────────────────
/** Start the bonus. `orbRows` are the locked Orb rows on board 1. */
function blzNewBonus(orbRows) {
  return {
    boards: [blzNewBoard(orbRows)],
    mult: 1,              // bonus multiplier (MULTI coins add to it; 1 = none)
    multiHits: [],        // values of MULTI coins that landed
    respins: BLZ_RESPINS,
    totalX: 0,            // collected so far, in bet multiples (after multiplier)
    jackpots: [],         // jackpot keys collected
    spins: 0,
    capped: false,
  };
}
function blzNewBoard(orbRows) {
  const orbs = Array(BLZ_ROWS).fill(false);
  for (const r of orbRows) orbs[r] = true;
  return { orbs, grid: blzEmptyGrid(), lastCollect: [] };
}
function blzOrbCount(board) { return board.orbs.filter(Boolean).length; }

/** Roll one respin for every board and resolve it. Returns a summary. */
function blzBonusSpin(bonus) {
  const o = BLZ_ODDS.bonus;
  bonus.spins++;
  let landed = false;
  const events = [];
  let spinX = 0;
  let newDouble = false;

  const damp = bonus.boards.length > 1 ? BLZ_DOUBLE_DAMP : 1;
  for (const [bi, board] of bonus.boards.entries()) {
    const grid = blzEmptyGrid();
    board.lastCollect = [];
    // New Orbs on empty middle spots
    for (let r = 0; r < BLZ_ROWS; r++) {
      if (board.orbs[r]) { grid[BLZ_ORB_COL][r] = { type: 'orb', locked: true }; continue; }
      if (blzRand() < o.orb * damp) { grid[BLZ_ORB_COL][r] = { type: 'orb', fresh: true }; landed = true; }
    }
    // Prize columns
    for (const c of BLZ_PRIZE_COLS) {
      if (blzRand() < o.gold * damp) { blzFillGold(grid, c); landed = true; events.push({ board: bi, kind: 'gold', col: c }); continue; }
      for (let r = 0; r < BLZ_ROWS; r++) {
        const roll = blzRand() / damp;
        if (roll < o.prize) {
          grid[c][r] = { type: 'prize', value: blzPick(BLZ_BONUS_PRIZE_TABLE) };
          landed = true;
        } else if (roll < o.prize + o.multi) {
          grid[c][r] = { type: 'multi', value: blzPick(BLZ_MULTI_TABLE) };
          landed = true;
        } else if (roll < o.prize + o.multi + o.double && bonus.boards.length === 1 && !newDouble) {
          grid[c][r] = { type: 'double' };
          newDouble = true;
          landed = true;
        }
      }
    }
    board.grid = grid;

    // Lock new Orbs first so they collect this spin's prizes too
    for (let r = 0; r < BLZ_ROWS; r++) if (grid[BLZ_ORB_COL][r]) board.orbs[r] = true;

    // MULTI coins add to the bonus multiplier before anything is collected
    for (const c of BLZ_PRIZE_COLS) for (let r = 0; r < BLZ_ROWS; r++) {
      const cell = grid[c][r];
      if (cell && cell.type === 'multi') {
        bonus.mult = Math.min(BLZ_MULT_CAP, bonus.multiHits.length ? bonus.mult + cell.value : cell.value);
        bonus.multiHits.push(cell.value);
        events.push({ board: bi, kind: 'multi', value: cell.value, c, r });
      }
    }
  }

  // Collect: every locked Orb on a board collects every prize on that board
  for (const [bi, board] of bonus.boards.entries()) {
    const orbs = blzOrbCount(board);
    for (const p of blzPrizesInView(board.grid)) {
      // MULTI boosts cash prizes; jackpots pay their fixed value per Orb
      const x = p.x * orbs * (typeof p.value === 'number' ? bonus.mult : 1);
      spinX += x;
      board.lastCollect.push({ ...p, paidX: x });
      if (typeof p.value === 'string') bonus.jackpots.push(p.value);
    }
  }

  // DOUBLE coin: open a second board with the same locked Orbs
  if (newDouble) {
    const src = bonus.boards[0];
    const rows = src.orbs.map((v, r) => v ? r : -1).filter(r => r >= 0);
    bonus.boards.push(blzNewBoard(rows));
    events.push({ board: 0, kind: 'double' });
  }

  // Win cap
  if (bonus.totalX + spinX >= BLZ_MAX_WIN_X) {
    spinX = BLZ_MAX_WIN_X - bonus.totalX;
    bonus.capped = true;
  }
  bonus.totalX += spinX;
  bonus.respins = landed ? BLZ_RESPINS : bonus.respins - 1;
  const allFull = bonus.boards.every(b => blzOrbCount(b) === BLZ_ROWS);
  return { spinX, landed, events, done: bonus.respins <= 0 || bonus.capped, allFull };
}

/** Orb rows locked when a bonus starts from a base-game grid. */
function blzOrbRows(grid) {
  return [...Array(BLZ_ROWS).keys()].filter(r => grid[BLZ_ORB_COL][r] && grid[BLZ_ORB_COL][r].type === 'orb');
}

/** Starting Orbs for a bought bonus: 1 Orb, sometimes 2. */
function blzBuyOrbRows() {
  const rows = [Math.floor(blzRand() * BLZ_ROWS)];
  if (blzRand() < 0.3) {
    let r2; do { r2 = Math.floor(blzRand() * BLZ_ROWS); } while (r2 === rows[0]);
    rows.push(r2);
  }
  return rows;
}

if (typeof module !== 'undefined') {
  module.exports = {
    BLZ_MULT_CAP, BLZ_ROWS, BLZ_COLS, BLZ_ORB_COL, BLZ_PRIZE_COLS, BLZ_RESPINS, BLZ_MAX_WIN_X, BLZ_BUY_MULT,
    BLZ_JACKPOTS, BLZ_PRIZE_TABLE, BLZ_BONUS_PRIZE_TABLE, BLZ_GOLD_TABLE, BLZ_MULTI_TABLE, BLZ_ODDS,
    blzSetRng, blzRollBase, blzTriggers, blzBasePayX, blzPrizesInView, blzCount,
    blzNewBonus, blzBonusSpin, blzOrbRows, blzBuyOrbRows, blzOrbCount, blzPrizeX,
  };
}
