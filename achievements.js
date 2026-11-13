/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Achievements + Developer Options
   Games report results through achRound() / achUnlock() / achCount().
   Progress lives in localStorage under `casino-achievements`.
   Dev-set balances never feed achievement stats (only real rounds do).
   ═══════════════════════════════════════════════════════════════════ */

const ACH_KEY = 'casino-achievements';
const DEV_KEY = 'casino-dev-unlocked';
const ACH_GAMES = ['blackjack', 'baccarat', 'slots', 'roulette', 'mines', 'plinko', 'crash'];
const DEV_TAPS_NEEDED = 5;

// ─── DEFINITIONS ───────────────────────────────────────────────────
// progress(s) → [current, target] for a progress bar on locked cards.
const ACHIEVEMENTS = [
  // General
  { id:'first_win',   cat:'General', icon:'🍀', name:"Beginner's Luck", desc:'Win your first round in any game' },
  { id:'streak5',     cat:'General', icon:'🔥', name:'Hot Streak',      desc:'Win 5 rounds in a row',
    progress: s => [s.bestStreak, 5] },
  { id:'streak10',    cat:'General', icon:'☄️', name:'On Fire',         desc:'Win 10 rounds in a row',
    progress: s => [s.bestStreak, 10] },
  { id:'high_roller', cat:'General', icon:'💎', name:'High Roller',     desc:'Wager $10,000+ in a single round' },
  { id:'big_win',     cat:'General', icon:'💰', name:'Big Score',       desc:'Profit $50,000+ in a single round' },
  { id:'monster_win', cat:'General', icon:'🤑', name:'Life Changing',   desc:'Profit $1,000,000+ in a single round' },
  { id:'cash_flow',   cat:'General', icon:'🏦', name:'Cash Flow',       desc:'Win $1,000,000 total across all games',
    progress: s => [s.won, 1000000] },
  { id:'tourist',     cat:'General', icon:'🗺️', name:'Casino Tourist',  desc:'Play a round of every game',
    progress: s => [ACH_GAMES.filter(g => s.rounds[g] > 0).length, ACH_GAMES.length] },
  { id:'grinder',     cat:'General', icon:'⏳', name:'The Grind',       desc:'Play 1,000 rounds total',
    progress: s => [s.totalRounds, 1000] },
  { id:'rock_bottom', cat:'General', icon:'🪦', name:'Rock Bottom',     desc:'Go broke and get bailed out' },

  // Blackjack
  { id:'bj_natural',  cat:'Blackjack', icon:'🂡', name:'Natural',        desc:'Get a blackjack' },
  { id:'bj_hattrick', cat:'Blackjack', icon:'🎩', name:'Hat Trick',      desc:'Get 3+ blackjacks in a single deal' },
  { id:'bj_split',    cat:'Blackjack', icon:'✂️', name:'Splitting Image', desc:'Win a hand after splitting' },
  { id:'bj_double',   cat:'Blackjack', icon:'✌️', name:'Double Trouble', desc:'Win a doubled-down hand' },
  { id:'bj_table',    cat:'Blackjack', icon:'🪑', name:'Full Table',     desc:'Play all 5 seats at once' },
  { id:'bj_213',      cat:'Blackjack', icon:'🃏', name:'Three Card Trick', desc:'Win a 21+3 side bet' },
  { id:'bj_perfect_pair', cat:'Blackjack', icon:'👯', name:'Perfect Pair', desc:'Hit a Perfect Pair (same rank and suit) side bet' },
  { id:'bj_suited_trips', cat:'Blackjack', icon:'💯', name:'Suited Trips', desc:'Hit Suited Trips on 21+3 (pays 100:1)' },

  // Baccarat
  { id:'bac_natural', cat:'Baccarat', icon:'9️⃣', name:'Au Naturel',      desc:'Win a hand decided by a natural 8 or 9' },
  { id:'bac_tie',     cat:'Baccarat', icon:'🤝', name:'Dead Even',       desc:'Win a Tie bet' },
  { id:'bac_banker',  cat:'Baccarat', icon:'🏛️', name:"Banker's Friend", desc:'Win 10 Banker bets',
    progress: s => [s.counts.bac_banker || 0, 10] },

  // Slots
  { id:'slot_spin10x',  cat:'Slots', icon:'💥', name:'Big Win',          desc:'Win 10x+ your bet on a single spin' },
  { id:'slot_five',     cat:'Slots', icon:'🖐️', name:'Five of a Kind',   desc:'Land 5 of a kind on a payline' },
  { id:'slot_holdwin',  cat:'Slots', icon:'🪙', name:'Hold Tight',       desc:'Trigger Hold & Win' },
  { id:'slot_grand',    cat:'Slots', icon:'👑', name:'GRAND',            desc:'Fill the whole grid in Hold & Win' },
  { id:'slot_ladder',   cat:'Slots', icon:'🪜', name:'Top of the Ladder', desc:'Climb to the top of a Multiplier Ladder' },
  { id:'slot_machines', cat:'Slots', icon:'🎰', name:'Machine Hopper',   desc:'Spin every slot machine',
    progress: s => [(s.machines || []).length, (typeof SLOT_THEME_ORDER !== 'undefined' ? SLOT_THEME_ORDER.length : 5)] },

  // Roulette
  { id:'roul_straight', cat:'Roulette', icon:'🎯', name:'Straight Up',   desc:'Hit a single-number bet' },
  { id:'roul_green',    cat:'Roulette', icon:'🟢', name:'Going Green',   desc:'Win on 0 or 00' },
  { id:'roul_spread',   cat:'Roulette', icon:'🧮', name:'Spread Thin',   desc:'Place 10+ bets on one spin' },

  // Mines
  { id:'mines_cash',  cat:'Mines', icon:'💎', name:'Gem Collector',     desc:'Cash out a Mines round' },
  { id:'mines_clear', cat:'Mines', icon:'🧹', name:'Minesweeper',       desc:'Reveal every safe tile' },
  { id:'mines_24',    cat:'Mines', icon:'☢️', name:'Death Wish',        desc:'Cash out with 24 mines on the board' },

  // Plinko
  { id:'plinko_edge', cat:'Plinko', icon:'🎳', name:'Edge Lord',        desc:'Hit the 170x bucket on HIGH risk' },
  { id:'plinko_rain', cat:'Plinko', icon:'🌧️', name:'Make It Rain',     desc:'Have 10 balls in the air at once' },

  // Crash
  { id:'crash_10',    cat:'Crash', icon:'🚀', name:'Liftoff',           desc:'Cash out at 10x or higher' },
  { id:'crash_100',   cat:'Crash', icon:'🌕', name:'To the Moon',       desc:'Cash out at 100x or higher' },
  { id:'crash_close', cat:'Crash', icon:'😰', name:'Close Call',        desc:'Cash out within 5% of the crash point (2x+ rounds)' },

  // Meta
  { id:'completionist', cat:'Meta', icon:'🏆', name:'Completionist',    desc:'Unlock every other achievement' },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// ─── STATE ─────────────────────────────────────────────────────────
function achFreshState() {
  return {
    unlocked: {},                       // id → timestamp
    stats: { rounds:{}, totalRounds:0, wagered:0, won:0, streak:0, bestStreak:0, machines:[] },
    counts: {},
  };
}
let achState = achFreshState();
try {
  const saved = JSON.parse(localStorage.getItem(ACH_KEY));
  if (saved && saved.unlocked && saved.stats) {
    achState = Object.assign(achFreshState(), saved);
    achState.stats = Object.assign(achFreshState().stats, saved.stats);
  }
} catch (e) {}

function achSave() {
  try { localStorage.setItem(ACH_KEY, JSON.stringify(achState)); } catch (e) {}
}
function achStatsView() {
  return Object.assign({}, achState.stats, { counts: achState.counts });
}

// ─── PUBLIC API (called by the games) ──────────────────────────────
function achUnlock(id) {
  if (!ACH_BY_ID[id] || achState.unlocked[id]) return;
  achState.unlocked[id] = Date.now();
  achSave();
  achToast(ACH_BY_ID[id]);
  achCheckCompletionist();
  achUpdateMenuBadge();
}

function achCount(key, n = 1) {
  achState.counts[key] = (achState.counts[key] || 0) + n;
  achSave();
  return achState.counts[key];
}

/** Record a finished round.
 *  wager  — total staked this round
 *  payout — total returned (stake included); 0 on a loss
 *  countRound=false for bonus payouts / feature buys (no round, no streak) */
function achRound(game, { wager = 0, payout = 0, countRound = true } = {}) {
  const s = achState.stats;
  const profit = payout - wager;
  s.wagered += wager;
  s.won += payout;

  if (countRound) {
    s.rounds[game] = (s.rounds[game] || 0) + 1;
    s.totalRounds++;
    if (profit > 0) {
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else if (profit < 0) {
      s.streak = 0;
    }
  }
  achSave();

  if (profit > 0) achUnlock('first_win');
  if (wager >= 10000) achUnlock('high_roller');
  if (profit >= 50000) achUnlock('big_win');
  if (profit >= 1000000) achUnlock('monster_win');
  if (s.bestStreak >= 5) achUnlock('streak5');
  if (s.bestStreak >= 10) achUnlock('streak10');
  if (s.won >= 1000000) achUnlock('cash_flow');
  if (ACH_GAMES.every(g => s.rounds[g] > 0)) achUnlock('tourist');
  if (s.totalRounds >= 1000) achUnlock('grinder');
}

function achSlotMachineSpun(id) {
  const m = achState.stats.machines;
  if (!m.includes(id)) { m.push(id); achSave(); }
  const total = typeof SLOT_THEME_ORDER !== 'undefined' ? SLOT_THEME_ORDER.length : 5;
  if (m.length >= total) achUnlock('slot_machines');
}

function achCheckCompletionist() {
  const others = ACHIEVEMENTS.filter(a => a.id !== 'completionist');
  if (others.every(a => achState.unlocked[a.id])) achUnlock('completionist');
}

// ─── TOAST ─────────────────────────────────────────────────────────
const achToastQueue = [];
let achToastShowing = false;
function achToast(a) {
  achToastQueue.push(a);
  if (!achToastShowing) achNextToast();
}
function achNextToast() {
  const a = achToastQueue.shift();
  const el = document.getElementById('ach-toast');
  if (!a || !el) { achToastShowing = false; return; }
  achToastShowing = true;
  el.innerHTML = `<span class="ach-toast-icon">${a.icon}</span>
    <span class="ach-toast-text"><small>${a.label || 'ACHIEVEMENT UNLOCKED'}</small><strong>${a.name}</strong></span>`;
  el.classList.remove('show');
  void el.offsetWidth; // restart animation
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(achNextToast, 350); }, 2800);
}

// ─── ACHIEVEMENTS SCREEN ───────────────────────────────────────────
function achUnlockedCount() {
  return ACHIEVEMENTS.filter(a => achState.unlocked[a.id]).length;
}
function achUpdateMenuBadge() {
  const el = document.getElementById('menu-ach-count');
  if (el) el.textContent = `${achUnlockedCount()}/${ACHIEVEMENTS.length}`;
}

function initAchievements() {
  const done = achUnlockedCount();
  const total = ACHIEVEMENTS.length;
  const pct = Math.round(done / total * 100);
  document.getElementById('ach-summary').innerHTML =
    `<div class="ach-summary-top"><strong>${done} / ${total}</strong><span>${pct}% complete</span></div>
     <div class="ach-bar"><i style="width:${pct}%"></i></div>`;

  const sv = achStatsView();
  const cats = [...new Set(ACHIEVEMENTS.map(a => a.cat))];
  const html = cats.map(cat => {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat);
    const got = items.filter(a => achState.unlocked[a.id]).length;
    const cards = items.map(a => {
      const on = !!achState.unlocked[a.id];
      let prog = '';
      if (!on && a.progress) {
        const [cur, tgt] = a.progress(sv);
        const p = Math.min(100, Math.floor(cur / tgt * 100));
        prog = `<div class="ach-prog"><div class="ach-bar sm"><i style="width:${p}%"></i></div>
                <span>${Math.min(cur, tgt).toLocaleString()} / ${tgt.toLocaleString()}</span></div>`;
      }
      const when = on ? `<span class="ach-date">${new Date(achState.unlocked[a.id]).toLocaleDateString()}</span>` : '';
      return `<div class="ach-card ${on ? 'unlocked' : 'locked'}">
        <div class="ach-icon">${on ? a.icon : '🔒'}</div>
        <div class="ach-info"><strong>${a.name}</strong><span>${a.desc}</span>${prog}</div>${when}
      </div>`;
    }).join('');
    return `<section class="ach-cat"><h3>${cat} <span>${got}/${items.length}</span></h3>${cards}</section>`;
  }).join('');
  document.getElementById('ach-list').innerHTML = html;
}

// ─── DEVELOPER OPTIONS ─────────────────────────────────────────────
// Hidden by default.
let devTaps = 0, devTapTimer = null;
function devIsUnlocked() {
  try { return localStorage.getItem(DEV_KEY) === '1'; } catch (e) { return false; }
}
function devTitleTap() {
  if (devIsUnlocked()) return;
  devTaps++;
  clearTimeout(devTapTimer);
  devTapTimer = setTimeout(() => { devTaps = 0; }, 1500);
  if (devTaps >= DEV_TAPS_NEEDED) {
    devTaps = 0;
    try { localStorage.setItem(DEV_KEY, '1'); } catch (e) {}
    devRefreshMenuButton();
    achToast({ icon:'🛠️', name:'Developer options enabled', label:'YOU ARE NOW A DEVELOPER' });
  }
}
function devRefreshMenuButton() {
  const btn = document.getElementById('menu-dev-btn');
  if (btn) btn.classList.toggle('hidden', !devIsUnlocked());
}

function devRefreshBalance() {
  const t = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('dev-balance').textContent = t;
  document.getElementById('menu-balance').textContent = t;
  saveBalance();
}
function devMsg(text) { document.getElementById('dev-msg').textContent = text; }

function devParseAmount() {
  const raw = String(document.getElementById('dev-amount').value).replace(/[$,\s]/g, '');
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, Number.MAX_SAFE_INTEGER);
}
function devSetBalance(amount) {
  const n = amount ?? devParseAmount();
  if (n === null) { devMsg('Enter a whole number ≥ 0'); return; }
  balance = n;
  devRefreshBalance();
  devMsg(`Balance set to $${n.toLocaleString()}`);
}
function devAddBalance() {
  const n = devParseAmount();
  if (n === null) { devMsg('Enter a whole number ≥ 0'); return; }
  balance = Math.min(balance + n, Number.MAX_SAFE_INTEGER);
  devRefreshBalance();
  devMsg(`Added $${n.toLocaleString()}`);
}
function devResetAchievements() {
  if (!confirmDevAction('dev-reset-ach')) return;
  achState = achFreshState();
  achSave();
  achUpdateMenuBadge();
  devMsg('Achievements reset');
}
function devHide() {
  try { localStorage.removeItem(DEV_KEY); } catch (e) {}
  devRefreshMenuButton();
  backToMenu();
}
// Two-tap confirm instead of confirm() (dialogs are clunky in the PWA)
const devArmed = {};
function confirmDevAction(btnId) {
  const btn = document.getElementById(btnId);
  if (devArmed[btnId]) { devArmed[btnId] = false; btn.textContent = btn.dataset.label; return true; }
  devArmed[btnId] = true;
  btn.dataset.label = btn.dataset.label || btn.textContent;
  btn.textContent = 'TAP AGAIN TO CONFIRM';
  setTimeout(() => { if (devArmed[btnId]) { devArmed[btnId] = false; btn.textContent = btn.dataset.label; } }, 3000);
  return false;
}
function initDevOptions() {
  devRefreshBalance();
  devMsg('');
}

document.addEventListener('DOMContentLoaded', () => {
  achUpdateMenuBadge();
  devRefreshMenuButton();
});
