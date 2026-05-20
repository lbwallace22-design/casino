/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Roulette
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const ROUL_DEFAULT_BET = 25;
const WHEEL_R = 130;
const ROUL_BALL_FRAMES = 90;
const ROUL_BALL_DELAY = 25;
const ROUL_BALL_R = 6;
const ROUL_BALL_TRACK_R = WHEEL_R - 14;

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);
const ALL_POCKETS = ["0","00",...Array.from({length:36},(_,i)=>String(i+1))];

const WHEEL_ORDER = [
  "0","28","9","26","30","11","7","20","32","17","5",
  "22","34","15","3","24","36","13","1","00","27","10",
  "25","29","12","8","19","31","18","6","21","33","16",
  "4","23","35","14","2"
];

// ─── STATE ─────────────────────────────────────────────────────────
let roulBets = [];
let roulResult = null;
let roulSpinning = false;
let roulStats = { spins:0, wins:0, losses:0 };
let roulBallStart = 0;
let roulBallTotal = 0;

// ─── DOM HELPERS ───────────────────────────────────────────────────
function roulEl(id) { return document.getElementById(id); }

function updateRoulBalance() {
  roulEl('roul-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  document.getElementById('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
}

function setRoulMsg(text, cls='') {
  const el = roulEl('roul-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' ' + cls : '');
}

function setRoulDetail(text) { roulEl('roul-detail').textContent = text; }

function updateRoulStats() {
  roulEl('roul-stats').textContent =
    `Spins: ${roulStats.spins}  |  W: ${roulStats.wins}  L: ${roulStats.losses}`;
}

function updateRoulBetsDisplay() {
  const el = roulEl('roul-bets-display');
  if (!roulBets.length) { el.textContent = 'No bets placed'; return; }
  const total = roulBets.reduce((s,b) => s + b[2], 0);
  const counts = {};
  for (const [bt, val, amt] of roulBets) {
    const key = bt === 'straight' ? val : val.toUpperCase();
    counts[key] = (counts[key] || 0) + amt;
  }
  const parts = Object.entries(counts).map(([k,v]) => `${k}: $${v}`);
  let display = parts.slice(0,8).join('  |  ');
  if (parts.length > 8) display += `  ... +${parts.length - 8} more`;
  el.textContent = `Total: $${total.toLocaleString()} — ${display}`;
}

// ─── WHEEL CANVAS ──────────────────────────────────────────────────
function pocketAngle(pocket) {
  // Returns angle in canvas convention (clockwise, 0=right, -90=top)
  const idx = WHEEL_ORDER.indexOf(pocket);
  const step = 360 / WHEEL_ORDER.length;
  return idx * step - 90 + step / 2;
}
function pocketAngleRad(pocket) {
  return pocketAngle(pocket) * Math.PI / 180;
}

function drawWheel(highlight, ballAngle) {
  const canvas = roulEl('roul-wheel');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.width / dpr;
  const cx = size / 2;
  const cy = size / 2;
  const n = WHEEL_ORDER.length;
  const angleStep = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Outer rim
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_R, 0, 2 * Math.PI);
  ctx.fillStyle = '#333';
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ball track ring
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_R - 4, 0, 2 * Math.PI);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pockets
  for (let i = 0; i < n; i++) {
    const pocket = WHEEL_ORDER[i];
    const startAngle = (i * angleStep) - Math.PI / 2;

    let color;
    if (pocket === '0' || pocket === '00') color = '#006600';
    else if (RED_NUMS.has(parseInt(pocket))) color = '#cc0000';
    else color = '#222222';

    if (highlight === pocket) color = '#f0c040';

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, WHEEL_R - 10, startAngle, startAngle + angleStep);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Number text
    const midAngle = startAngle + angleStep / 2;
    const tx = cx + (WHEEL_R - 32) * Math.cos(midAngle);
    const ty = cy + (WHEEL_R - 32) * Math.sin(midAngle);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 7px Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pocket, 0, 0);
    ctx.restore();
  }

  // Centre circle
  const innerR = WHEEL_R - 55;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = '#2a2a2a';
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Result in centre
  if (highlight) {
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 24px Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(highlight, cx, cy);
  }

  // Ball (canvas convention: clockwise, 0=right)
  if (ballAngle !== undefined && ballAngle !== null) {
    const rad = ballAngle * Math.PI / 180;
    const bx = cx + ROUL_BALL_TRACK_R * Math.cos(rad);
    const by = cy + ROUL_BALL_TRACK_R * Math.sin(rad);

    // Shadow
    ctx.beginPath();
    ctx.arc(bx + 1, by + 1, ROUL_BALL_R, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Ball
    ctx.beginPath();
    ctx.arc(bx, by, ROUL_BALL_R, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shine
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.restore();
}

function initWheelCanvas() {
  const canvas = roulEl('roul-wheel');
  const dpr = window.devicePixelRatio || 1;
  const size = 300;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  drawWheel();
}

// ─── BETS ──────────────────────────────────────────────────────────
function roulPlaceBet(betType, value) {
  if (roulSpinning) return;
  const amount = parseInt(roulEl('roul-bet').value) || ROUL_DEFAULT_BET;
  if (amount > balance) {
    setRoulMsg('Not enough balance!', 'lose');
    return;
  }
  balance -= amount;
  roulBets.push([betType, value, amount]);
  updateRoulBalance();
  updateRoulBetsDisplay();

  const label = betType === 'straight' ? value : value.toUpperCase();
  setRoulMsg(`$${amount} on ${label}`);
}

function roulClearBets() {
  if (roulSpinning) return;
  for (const [,,amt] of roulBets) balance += amt;
  roulBets = [];
  updateRoulBalance();
  updateRoulBetsDisplay();
  setRoulMsg('Bets cleared');
}

// ─── SPIN ──────────────────────────────────────────────────────────
function roulSpin() {
  if (roulSpinning) return;
  if (!roulBets.length) {
    setRoulMsg('Place a bet first!', 'lose');
    return;
  }

  roulSpinning = true;
  setRoulButtons(false);
  setRoulDetail('');
  setRoulMsg('No more bets!');

  roulResult = ALL_POCKETS[Math.floor(Math.random() * ALL_POCKETS.length)];
  roulStats.spins++;

  // Ball trajectory: spin clockwise (increasing angle in canvas convention)
  roulBallStart = Math.random() * 360;
  const target = pocketAngle(roulResult);
  // Distance clockwise from start to target
  const cwToTarget = ((target - roulBallStart) % 360 + 360) % 360;
  const rotations = 4 + Math.random() * 2;
  roulBallTotal = rotations * 360 + cwToTarget;

  animateBall(0);
}

function animateBall(frame) {
  if (frame <= ROUL_BALL_FRAMES) {
    const t = frame / ROUL_BALL_FRAMES;
    const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
    const currentAngle = roulBallStart + eased * roulBallTotal;

    drawWheel(null, currentAngle);

    if (t > 0.85) setRoulMsg('Almost there...', 'win');

    setTimeout(() => animateBall(frame + 1), ROUL_BALL_DELAY);
  } else {
    drawWheel(roulResult, pocketAngle(roulResult));
    setTimeout(roulResolve, 600);
  }
}

function setRoulButtons(enabled) {
  roulEl('btn-roul-spin').disabled = !enabled;
  roulEl('btn-roul-clear').disabled = !enabled;
  roulEl('roul-bet').disabled = !enabled;
  // Disable/enable all board buttons
  document.querySelectorAll('#roul-board button').forEach(b => b.disabled = !enabled);
}

// ─── RESOLVE ───────────────────────────────────────────────────────
function roulResolve() {
  const pocket = roulResult;
  const isZero = pocket === '0' || pocket === '00';
  const num = isZero ? 0 : parseInt(pocket);
  const isRed = RED_NUMS.has(num);
  const isBlack = BLACK_NUMS.has(num);

  let totalWin = 0;
  const details = [];

  for (const [betType, value, amount] of roulBets) {
    let win = false;
    let payoutMult = 0;

    if (betType === 'straight') {
      win = value === pocket; payoutMult = 35;
    } else if (betType === 'red') {
      win = isRed; payoutMult = 1;
    } else if (betType === 'black') {
      win = isBlack; payoutMult = 1;
    } else if (betType === 'odd') {
      win = !isZero && num % 2 === 1; payoutMult = 1;
    } else if (betType === 'even') {
      win = !isZero && num % 2 === 0; payoutMult = 1;
    } else if (betType === '1-18') {
      win = !isZero && num >= 1 && num <= 18; payoutMult = 1;
    } else if (betType === '19-36') {
      win = !isZero && num >= 19 && num <= 36; payoutMult = 1;
    } else if (betType === '1st12') {
      win = !isZero && num >= 1 && num <= 12; payoutMult = 2;
    } else if (betType === '2nd12') {
      win = !isZero && num >= 13 && num <= 24; payoutMult = 2;
    } else if (betType === '3rd12') {
      win = !isZero && num >= 25 && num <= 36; payoutMult = 2;
    } else if (betType === 'col1') {
      win = !isZero && num % 3 === 1; payoutMult = 2;
    } else if (betType === 'col2') {
      win = !isZero && num % 3 === 2; payoutMult = 2;
    } else if (betType === 'col3') {
      win = !isZero && num % 3 === 0; payoutMult = 2;
    }

    if (win) {
      const payout = amount + amount * payoutMult;
      totalWin += payout;
      details.push(`${value.toUpperCase()} +$${(amount * payoutMult).toLocaleString()}`);
    } else {
      details.push(`${value.toUpperCase()} -$${amount.toLocaleString()}`);
    }
  }

  balance += totalWin;
  updateRoulBalance();
  roulBets = [];
  updateRoulBetsDisplay();

  const colorStr = isZero ? 'GREEN' : (isRed ? 'RED' : 'BLACK');
  const resultText = `${pocket} ${colorStr}`;

  if (totalWin > 0) {
    setRoulMsg(`${resultText} — Won $${totalWin.toLocaleString()}!`, 'win');
    roulStats.wins++;
  } else {
    setRoulMsg(`${resultText} — No wins`, 'lose');
    roulStats.losses++;
  }

  setRoulDetail(details.slice(0,6).join('  |  ') + (details.length > 6 ? '...' : ''));
  updateRoulStats();

  roulSpinning = false;
  if (balance < 5) {
    checkAutoReset();
    setRoulMsg('Balance reset! Place your bets.', 'win');
    updateRoulBalance();
    setRoulButtons(true);
  } else {
    setRoulButtons(true);
  }
}

// ─── BUILD BOARD ───────────────────────────────────────────────────
function buildRouletteBoard() {
  const board = roulEl('roul-board');
  board.innerHTML = '';

  // Zero row
  const zeroRow = document.createElement('div');
  zeroRow.className = 'roul-row';
  for (const z of ['0','00']) {
    const btn = document.createElement('button');
    btn.className = 'roul-btn roul-green';
    btn.textContent = z;
    btn.onclick = () => roulPlaceBet('straight', z);
    zeroRow.appendChild(btn);
  }
  board.appendChild(zeroRow);

  // Number grid: 3 rows x 12 cols
  for (let rowOff = 0; rowOff < 3; rowOff++) {
    const row = document.createElement('div');
    row.className = 'roul-row';
    for (let col = 0; col < 12; col++) {
      const num = col * 3 + (3 - rowOff);
      const btn = document.createElement('button');
      btn.className = 'roul-btn ' + (RED_NUMS.has(num) ? 'roul-red' : 'roul-black');
      btn.textContent = num;
      btn.onclick = () => roulPlaceBet('straight', String(num));
      row.appendChild(btn);
    }
    board.appendChild(row);
  }

  // Dozens
  const dozenRow = document.createElement('div');
  dozenRow.className = 'roul-row';
  for (const [label, bt] of [['1st 12','1st12'],['2nd 12','2nd12'],['3rd 12','3rd12']]) {
    const btn = document.createElement('button');
    btn.className = 'roul-btn roul-gray roul-wide';
    btn.textContent = label;
    btn.onclick = () => roulPlaceBet(bt, bt);
    dozenRow.appendChild(btn);
  }
  board.appendChild(dozenRow);

  // Even money
  const evenRow = document.createElement('div');
  evenRow.className = 'roul-row';
  const evenBets = [
    ['1-18','1-18','roul-gray'],['EVEN','even','roul-gray'],
    ['RED','red','roul-red'],['BLACK','black','roul-black'],
    ['ODD','odd','roul-gray'],['19-36','19-36','roul-gray'],
  ];
  for (const [label, bt, cls] of evenBets) {
    const btn = document.createElement('button');
    btn.className = `roul-btn ${cls} roul-med`;
    btn.textContent = label;
    btn.onclick = () => roulPlaceBet(bt, bt);
    evenRow.appendChild(btn);
  }
  board.appendChild(evenRow);

  // Columns
  const colRow = document.createElement('div');
  colRow.className = 'roul-row';
  for (const [label, bt] of [['Col 1','col1'],['Col 2','col2'],['Col 3','col3']]) {
    const btn = document.createElement('button');
    btn.className = 'roul-btn roul-gray roul-wide';
    btn.textContent = label;
    btn.onclick = () => roulPlaceBet(bt, bt);
    colRow.appendChild(btn);
  }
  board.appendChild(colRow);
}

// ─── INIT ──────────────────────────────────────────────────────────
function initRoulette() {
  initWheelCanvas();
  buildRouletteBoard();
  updateRoulBalance();
  updateRoulBetsDisplay();
  updateRoulStats();
}
