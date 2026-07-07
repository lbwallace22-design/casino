/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Crash
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const CRASH_DEFAULT_BET = 25;
const CRASH_TICK_MS = 40;
const CRASH_GROWTH = 0.18;        // m(t) = e^(GROWTH * seconds)
const CRASH_MAX = 1000;
const CRASH_W = 340;
const CRASH_H = 220;
const CRASH_HISTORY_LEN = 10;

// ─── STATE ─────────────────────────────────────────────────────────
let crashRunning = false;
let crashPlayerIn = false;
let crashBet = 0;
let crashMult = 1;
let crashPoint = 1;
let crashStartTime = 0;
let crashTimer = null;
let crashCashedAt = 0;
let crashHistory = [];
let crashStats = { rounds: 0, wins: 0, won: 0 };

// ─── DOM HELPERS ───────────────────────────────────────────────────
function crashEl(id) { return document.getElementById(id); }

function updateCrashBalance() {
  crashEl('crash-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
}

function setCrashMsg(text, cls = '') {
  const el = crashEl('crash-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' ' + cls : '');
}

function updateCrashStats() {
  crashEl('crash-stats').textContent =
    `Rounds: ${crashStats.rounds}  |  Wins: ${crashStats.wins}  |  Won: $${crashStats.won.toLocaleString()}`;
}

function renderCrashHistory() {
  const el = crashEl('crash-history');
  el.innerHTML = crashHistory.map(p =>
    `<span class="crash-chip ${p >= 2 ? 'crash-chip-green' : 'crash-chip-red'}">${p.toFixed(2)}x</span>`
  ).join('');
}

function setCrashButtons() {
  crashEl('btn-crash-bet').disabled = crashRunning;
  crashEl('btn-crash-cashout').disabled = !(crashRunning && crashPlayerIn);
  crashEl('crash-bet').disabled = crashRunning;
  crashEl('crash-auto').disabled = crashRunning;
  const cbtn = crashEl('btn-crash-cashout');
  cbtn.textContent = (crashRunning && crashPlayerIn)
    ? `CASH OUT $${Math.floor(crashBet * crashMult).toLocaleString()}`
    : 'CASH OUT';
}

// ─── DRAW ──────────────────────────────────────────────────────────
function drawCrash(crashed) {
  const canvas = crashEl('crash-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = (CRASH_H / 5) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CRASH_W, y); ctx.stroke();
  }

  const elapsed = crashRunning || crashed ? (performance.now() - crashStartTime) / 1000 : 0;
  const maxT = Math.max(elapsed, 4);          // x-axis: at least 4s
  const maxM = Math.max(crashMult * 1.25, 2); // y-axis headroom

  const mToY = m => CRASH_H - 10 - ((m - 1) / (maxM - 1)) * (CRASH_H - 40);
  const tToX = t => 12 + (t / maxT) * (CRASH_W - 24);

  // Curve
  if (crashRunning || crashed) {
    ctx.beginPath();
    ctx.moveTo(tToX(0), mToY(1));
    const steps = 60;
    for (let i = 1; i <= steps; i++) {
      const t = (elapsed * i) / steps;
      const m = Math.min(Math.exp(CRASH_GROWTH * t), crashMult);
      ctx.lineTo(tToX(t), mToY(m));
    }
    ctx.strokeStyle = crashed ? '#e94560' : '#2ecc71';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Rocket / explosion at curve tip
    const tipX = tToX(elapsed);
    const tipY = mToY(crashMult);
    ctx.font = '16px Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(crashed ? '💥' : '🚀', tipX, tipY - 4);
  }

  // Multiplier text
  ctx.font = 'bold 34px Helvetica';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = crashed ? '#e94560' : (crashPlayerIn ? '#2ecc71' : '#f0c040');
  ctx.fillText(crashMult.toFixed(2) + 'x', CRASH_W / 2, 40);

  if (crashed) {
    ctx.font = 'bold 14px Helvetica';
    ctx.fillStyle = '#e94560';
    ctx.fillText('CRASHED', CRASH_W / 2, 66);
  } else if (crashCashedAt > 0) {
    ctx.font = 'bold 12px Helvetica';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(`Cashed out @ ${crashCashedAt.toFixed(2)}x`, CRASH_W / 2, 66);
  }

  ctx.restore();
}

// ─── ROUND ─────────────────────────────────────────────────────────
function sampleCrashPoint() {
  // P(crash < x) = 1 - 0.96/x → 4% instant crash, ~4% house edge
  const u = Math.random();
  return Math.min(Math.max(0.96 / (1 - u), 1), CRASH_MAX);
}

function crashLaunch() {
  if (crashRunning) return;
  let bet = parseInt(crashEl('crash-bet').value) || CRASH_DEFAULT_BET;
  if (bet < 1) bet = CRASH_DEFAULT_BET;
  if (bet > balance) {
    checkAutoReset();
    updateCrashBalance();
    if (bet > balance) {
      setCrashMsg(`Need $${bet.toLocaleString()}!`, 'lose');
      return;
    }
  }
  balance -= bet;
  updateCrashBalance();

  crashBet = bet;
  crashPlayerIn = true;
  crashRunning = true;
  crashMult = 1;
  crashCashedAt = 0;
  crashPoint = sampleCrashPoint();
  crashStartTime = performance.now();
  crashStats.rounds++;

  setCrashButtons();
  updateCrashStats();
  setCrashMsg('🚀 Climbing... cash out before it crashes!');

  crashTimer = setInterval(crashTick, CRASH_TICK_MS);
}

function crashTick() {
  const t = (performance.now() - crashStartTime) / 1000;
  crashMult = Math.min(Math.exp(CRASH_GROWTH * t), CRASH_MAX);

  // Auto cash-out
  const autoAt = parseFloat(crashEl('crash-auto').value) || 0;
  if (crashPlayerIn && autoAt >= 1.01 && crashMult >= autoAt && crashMult < crashPoint) {
    crashCashout(true);
  }

  if (crashMult >= crashPoint) {
    crashMult = crashPoint;
    endCrashRound();
    return;
  }

  setCrashButtons();
  drawCrash(false);
}

function crashCashout(auto) {
  if (!crashRunning || !crashPlayerIn) return;
  crashPlayerIn = false;
  crashCashedAt = crashMult;
  const payout = Math.floor(crashBet * crashMult);
  balance += payout;
  crashStats.wins++;
  crashStats.won += payout;
  updateCrashBalance();
  updateCrashStats();
  setCrashButtons();
  setCrashMsg(`💰 ${auto ? 'Auto-cashed' : 'Cashed out'} @ ${crashMult.toFixed(2)}x — +$${payout.toLocaleString()}!`, 'win');
}

function endCrashRound() {
  clearInterval(crashTimer);
  crashTimer = null;
  crashRunning = false;

  crashHistory.unshift(crashPoint);
  if (crashHistory.length > CRASH_HISTORY_LEN) crashHistory.pop();
  renderCrashHistory();

  drawCrash(true);

  if (crashPlayerIn) {
    crashPlayerIn = false;
    setCrashMsg(`💥 CRASHED @ ${crashPoint.toFixed(2)}x — lost $${crashBet.toLocaleString()}`, 'lose');
  } else if (crashCashedAt > 0) {
    setCrashMsg(`Crashed @ ${crashPoint.toFixed(2)}x — you got out at ${crashCashedAt.toFixed(2)}x!`, 'win');
  }

  if (balance < 500) {
    checkAutoReset();
    updateCrashBalance();
  }
  setCrashButtons();
}

// ─── INIT ──────────────────────────────────────────────────────────
function initCrash() {
  const canvas = crashEl('crash-canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = CRASH_W + 'px';
  canvas.style.height = CRASH_H + 'px';
  canvas.width = CRASH_W * dpr;
  canvas.height = CRASH_H * dpr;
  updateCrashBalance();
  updateCrashStats();
  renderCrashHistory();
  setCrashButtons();
  drawCrash(false);
  if (!crashRunning) setCrashMsg('Place a bet and LAUNCH!');
}
