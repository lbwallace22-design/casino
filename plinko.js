/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Plinko
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const PLINKO_ROWS = 12;
const PLINKO_DEFAULT_BET = 10;
const PLINKO_W = 340;
const PLINKO_H = 400;
const PLINKO_TOP = 30;
const PLINKO_BUCKET_H = 26;
const PLINKO_STEP_MS = 160;   // time per row

const PLINKO_MULTS = {
  low:    [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
  medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
  high:   [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
};

// ─── STATE ─────────────────────────────────────────────────────────
let plinkoRisk = 'medium';
let plinkoBalls = [];         // active falling balls
let plinkoAnimating = false;
let plinkoStats = { drops: 0, won: 0 };
let plinkoBucketFlash = {};   // bucketIndex -> flash end timestamp

// ─── DOM HELPERS ───────────────────────────────────────────────────
function plinkoEl(id) { return document.getElementById(id); }

function updatePlinkoBalance() {
  plinkoEl('plinko-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
}

function setPlinkoMsg(text, cls = '') {
  const el = plinkoEl('plinko-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' ' + cls : '');
}

function updatePlinkoStats() {
  plinkoEl('plinko-stats').textContent =
    `Drops: ${plinkoStats.drops}  |  Won: $${plinkoStats.won.toLocaleString()}`;
}

function setPlinkoRisk(risk) {
  plinkoRisk = risk;
  document.querySelectorAll('.plinko-risk-btn').forEach(b => {
    b.classList.toggle('speed-active', b.dataset.risk === risk);
  });
  drawPlinko();
}

// ─── GEOMETRY ──────────────────────────────────────────────────────
// Peg row r (0..ROWS-1) has r+3 pegs. A ball makes ROWS left/right
// choices; bucket index = number of rights (0..ROWS).
function plinkoSpacing() { return PLINKO_W / (PLINKO_ROWS + 2); }
function plinkoRowY(r) {
  const usable = PLINKO_H - PLINKO_TOP - PLINKO_BUCKET_H - 14;
  return PLINKO_TOP + ((r + 1) / (PLINKO_ROWS + 1)) * usable;
}
function plinkoPegX(r, i) {
  // pegs in row r are centered; count = r + 3
  const s = plinkoSpacing();
  return PLINKO_W / 2 + (i - (r + 2) / 2) * s;
}

function bucketColor(mult) {
  if (mult >= 10) return '#e94560';
  if (mult >= 2) return '#e67e22';
  if (mult >= 1) return '#f0c040';
  return '#2980b9';
}

// ─── DRAW ──────────────────────────────────────────────────────────
function drawPlinko() {
  const canvas = plinkoEl('plinko-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Pegs
  ctx.fillStyle = '#8ecfff';
  for (let r = 0; r < PLINKO_ROWS; r++) {
    const y = plinkoRowY(r);
    for (let i = 0; i < r + 3; i++) {
      ctx.beginPath();
      ctx.arc(plinkoPegX(r, i), y, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Buckets
  const mults = PLINKO_MULTS[plinkoRisk];
  const s = plinkoSpacing();
  const by = PLINKO_H - PLINKO_BUCKET_H - 6;
  const now = performance.now();
  for (let b = 0; b < mults.length; b++) {
    const x = PLINKO_W / 2 + (b - PLINKO_ROWS / 2) * s;
    const flashing = plinkoBucketFlash[b] && plinkoBucketFlash[b] > now;
    ctx.fillStyle = flashing ? '#fff' : bucketColor(mults[b]);
    const bw = s - 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - bw / 2, by, bw, PLINKO_BUCKET_H, 4);
    else ctx.rect(x - bw / 2, by, bw, PLINKO_BUCKET_H);
    ctx.fill();
    ctx.fillStyle = flashing ? '#000' : '#fff';
    ctx.font = 'bold 8px Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = mults[b] >= 10 ? String(Math.round(mults[b])) : String(mults[b]);
    ctx.fillText(label + 'x', x, by + PLINKO_BUCKET_H / 2);
  }

  // Balls
  for (const ball of plinkoBalls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#f0c040';
    ctx.fill();
    ctx.strokeStyle = '#b08820';
    ctx.lineWidth = 1;
    ctx.stroke();
    // shine
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, 1.8, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff8dd';
    ctx.fill();
  }

  ctx.restore();
}

// ─── DROP ──────────────────────────────────────────────────────────
function plinkoDrop() {
  let bet = parseInt(plinkoEl('plinko-bet').value) || PLINKO_DEFAULT_BET;
  if (bet < 1) bet = PLINKO_DEFAULT_BET;
  if (bet > balance) {
    checkAutoReset();
    updatePlinkoBalance();
    if (bet > balance) {
      setPlinkoMsg(`Need $${bet.toLocaleString()}!`, 'lose');
      return;
    }
  }
  balance -= bet;
  updatePlinkoBalance();
  plinkoStats.drops++;

  // Precompute path: waypoint per row, then bucket
  const path = [];
  let pos = 0; // number of rights so far
  const s = plinkoSpacing();
  for (let r = 0; r < PLINKO_ROWS; r++) {
    pos += Math.random() < 0.5 ? 0 : 1;
    // x offset after r+1 decisions: pos rights out of r+1
    const x = PLINKO_W / 2 + (pos - (r + 1) / 2) * s;
    path.push({ x, y: plinkoRowY(r) });
  }
  const bucket = pos;
  const bucketX = PLINKO_W / 2 + (bucket - PLINKO_ROWS / 2) * s;
  path.push({ x: bucketX, y: PLINKO_H - PLINKO_BUCKET_H - 6 });

  // Waypoints: start position, then one point per peg row, then bucket
  const waypoints = [{ x: PLINKO_W / 2, y: 8 }, ...path];

  plinkoBalls.push({
    bet, bucket, waypoints,
    mults: PLINKO_MULTS[plinkoRisk], // locked at drop time
    seg: 0,                        // segment: waypoints[seg] → waypoints[seg+1]
    segStart: performance.now(),
    x: waypoints[0].x, y: waypoints[0].y,
  });

  setPlinkoMsg('Dropping...');

  if (!plinkoAnimating) {
    plinkoAnimating = true;
    requestAnimationFrame(plinkoTick);
  }
}

function plinkoTick(now) {
  const done = [];
  for (const ball of plinkoBalls) {
    let t = (now - ball.segStart) / PLINKO_STEP_MS;
    while (t >= 1 && ball.seg < ball.waypoints.length - 1) {
      ball.seg++;
      ball.segStart += PLINKO_STEP_MS;
      t = (now - ball.segStart) / PLINKO_STEP_MS;
    }
    if (ball.seg >= ball.waypoints.length - 1) {
      const last = ball.waypoints[ball.waypoints.length - 1];
      ball.x = last.x; ball.y = last.y;
      done.push(ball);
      continue;
    }

    const from = ball.waypoints[ball.seg];
    const to = ball.waypoints[ball.seg + 1];
    const tt = Math.min(Math.max(t, 0), 1);
    // ease x side-to-side, accelerate y down with a small hop off each peg
    const ex = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
    const hop = ball.seg > 0 ? Math.sin(tt * Math.PI) * -4 : 0;
    ball.x = from.x + (to.x - from.x) * ex;
    ball.y = from.y + (to.y - from.y) * (tt * tt) + hop;
  }

  // Resolve finished balls
  for (const ball of done) {
    plinkoBalls.splice(plinkoBalls.indexOf(ball), 1);
    const mult = ball.mults[Math.min(ball.bucket, ball.mults.length - 1)];
    const payout = Math.floor(ball.bet * mult);
    balance += payout;
    plinkoStats.won += payout;
    plinkoBucketFlash[ball.bucket] = performance.now() + 500;
    updatePlinkoBalance();
    updatePlinkoStats();
    if (mult >= 1) {
      setPlinkoMsg(`${mult}x — +$${payout.toLocaleString()}!`, 'win');
    } else {
      setPlinkoMsg(`${mult}x — $${payout.toLocaleString()} back`, 'lose');
    }
  }

  drawPlinko();

  if (plinkoBalls.length > 0) {
    requestAnimationFrame(plinkoTick);
  } else {
    plinkoAnimating = false;
    if (balance < 500) {
      checkAutoReset();
      updatePlinkoBalance();
    }
    // final redraw after flashes fade
    setTimeout(drawPlinko, 550);
  }
}

// ─── INIT ──────────────────────────────────────────────────────────
function initPlinko() {
  const canvas = plinkoEl('plinko-canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = PLINKO_W + 'px';
  canvas.style.height = PLINKO_H + 'px';
  canvas.width = PLINKO_W * dpr;
  canvas.height = PLINKO_H * dpr;
  updatePlinkoBalance();
  updatePlinkoStats();
  drawPlinko();
  if (!plinkoBalls.length) setPlinkoMsg('Pick a risk level and DROP!');
}
