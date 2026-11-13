/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Blackjack
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const NUM_DECKS = 6;
const STARTING_BALANCE = 5000;
const CHIP_VALUES = [5, 25, 100, 500, 1000, 5000, 25000, 100000];
const CHIP_COLORS = { 5:'#d64545', 25:'#2f9e57', 100:'#2b2b38', 500:'#7c3aed',
                      1000:'#e0a526', 5000:'#e8618c', 25000:'#1f8fbf', 100000:'#c9a227' };
const MAX_HANDS = 5;
const DEAL_DELAY = 280;
const DEALER_DELAY = 550;

const SUITS = ['S','H','D','C'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_SYM = { S:'♠', H:'♥', D:'♦', C:'♣' };
const SUIT_CLR = { S:'black-card', H:'red-card', D:'red-card', C:'black-card' };

// ─── STATE ─────────────────────────────────────────────────────────
let balance = STARTING_BALANCE;
// Restore persisted balance (shared across every game) — values below
// the auto-reset floor start fresh at $5,000
try {
  const saved = parseInt(localStorage.getItem('casino-balance'));
  if (saved && saved >= 500) balance = saved;
} catch (e) {}

function saveBalance() {
  try { localStorage.setItem('casino-balance', String(balance)); } catch (e) {}
}
let deck = [];
let dealerHand = [];
let hands = [];
let activeHand = 0;
let gameActive = false;
let numPositions = 0;          // seats in play this round
let insuranceTaken = false;
let insuranceCost = 0;
let showDoubleCard = true;
// Chip betting: bets sit in each seat's circle until DEAL; they stay for the next round
let seatBets = Array(MAX_HANDS).fill(0);
// Side bets per seat: Perfect Pairs (your first two cards) and 21+3 (your two + dealer upcard)
let sideBets = { pp: Array(MAX_HANDS).fill(0), t3: Array(MAX_HANDS).fill(0) };
let sideResults = {};          // `${pos}-${kind}` → { win, label, payout }
let sideSummary = [];          // detail strings for the round
let roundSideTotal = 0;
const SIDE_NAMES = { pp: 'Perfect Pairs', t3: '21+3' };
const PP_PAYS = { perfect: 25, colored: 12, mixed: 6 };
const T3_PAYS = { suitedTrips: 100, straightFlush: 40, trips: 30, straight: 10, flush: 5 };
let betLog = [];               // [{pos, amt}] for UNDO
let bjChip = 25;
let lastChipDrop = -1;         // seat that just got a chip (for the drop animation)
let runningCount = 0;
let cardsSeen = 0;
let holeCardCounted = false;

let stats = { hands:0, wins:0, losses:0, pushes:0, bjs:0 };
let bjRoundStartBalance = 0;

// ─── DECK ──────────────────────────────────────────────────────────
function makeDeck(n) {
  const d = [];
  for (let i = 0; i < n; i++)
    for (const r of RANKS) for (const s of SUITS) d.push({rank:r, suit:s});
  return shuffle(d);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function drawCard(counted = true) {
  if (deck.length < 20) newShoe();
  const c = deck.pop();
  if (counted) {
    runningCount += hiloValue(c.rank);
    cardsSeen++;
    updateCountDisplay();
  }
  return c;
}
function countCard(card) {
  runningCount += hiloValue(card.rank);
  cardsSeen++;
  updateCountDisplay();
}
function newShoe() {
  deck = makeDeck(NUM_DECKS);
  runningCount = 0; cardsSeen = 0;
  updateCountDisplay();
}

function cardValue(rank) {
  if (rank === 'A') return 11;
  if ('JQK'.includes(rank)) return 10;
  return parseInt(rank);
}
function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { total += 11; aces++; }
    else if ('JQK'.includes(c.rank)) total += 10;
    else total += parseInt(c.rank);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
function canSplit(cards) {
  return cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank);
}
function hiloValue(rank) {
  if ('23456'.includes(rank)) return 1;
  if ('789'.includes(rank)) return 0;
  return -1;
}

// ─── DOM HELPERS ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function updateBalance() {
  $('bj-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  $('menu-balance').textContent = `Balance: $${balance.toLocaleString()}`;
  saveBalance();
}
function setMsg(text, cls='') {
  const el = $('bj-msg');
  el.textContent = text;
  el.className = 'msg' + (cls ? ' '+cls : '');
}
function setDetail(text) { $('bj-detail').textContent = text; }

function updateCountDisplay() {
  const remaining = NUM_DECKS * 52 - cardsSeen;
  const dl = Math.max(remaining / 52, 0.5);
  const tc = runningCount / dl;
  const el = $('bj-count');
  el.textContent = `RC:${runningCount >= 0 ? '+' : ''}${runningCount} TC:${tc >= 0 ? '+' : ''}${tc.toFixed(1)}`;
  el.style.color = tc >= 2 ? '#2ecc71' : tc <= -2 ? '#e94560' : '#8ecfff';
}
function updateStats() {
  const pct = stats.hands ? (stats.wins / stats.hands * 100).toFixed(0) : 0;
  $('bj-stats').textContent =
    `W:${stats.wins} L:${stats.losses} P:${stats.pushes} BJ:${stats.bjs} (${pct}%)`;
}
const sumArr = a => a.reduce((t, b) => t + b, 0);
function seatTotal() { return sumArr(seatBets) + sumArr(sideBets.pp) + sumArr(sideBets.t3); }
function fmtShort(v) {
  if (v >= 1e6) return `$${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${+(v / 1e3).toFixed(1)}K`;
  return `$${v}`;
}
function fmtChip(v) {
  return v >= 1000 ? `${v / 1000}K` : String(v);
}
function chipColorFor(amt) {
  let c = CHIP_VALUES[0];
  for (const v of CHIP_VALUES) if (amt >= v) c = v;
  return CHIP_COLORS[c];
}
function updateTotalLabel() {
  $('bj-total-label').textContent = `On table: $${seatTotal().toLocaleString()}`;
  renderChipRack();
  if (!gameActive) updateButtons();
}
function renderChipRack() {
  const rack = $('bj-chip-rack');
  if (!rack) return;
  rack.innerHTML = CHIP_VALUES.map(v => `<button class="bj-chip${v === bjChip ? ' selected' : ''}"
      style="--chip-color:${CHIP_COLORS[v]}" onclick="bjSelectChip(${v})"
      ${gameActive ? 'disabled' : ''} aria-label="$${v} chip"><span>${fmtChip(v)}</span></button>`).join('');
  const none = seatTotal() === 0;
  $('btn-bj-undo').disabled = gameActive || !betLog.length;
  $('btn-bj-clear').disabled = gameActive || none;
  $('btn-bj-2x').disabled = gameActive || none || seatTotal() * 2 > balance;
}

// ─── CHIP BETTING ──────────────────────────────────────────────────
function bjSelectChip(v) {
  if (gameActive) return;
  bjChip = v;
  if (hands.length) { clearFinishedRound(); renderHands(); }   // picking a chip resets the table for betting
  renderChipRack();
}
function clearFinishedRound() {
  // First chip after a finished round sweeps the old cards off the table
  if (!gameActive && hands.length) {
    hands = [];
    dealerHand = [];
    sideResults = {};
    renderDealer();
    setDetail('');
  }
}
function betArr(kind) { return kind === 'main' ? seatBets : sideBets[kind]; }
function bjPlaceChip(pos, kind = 'main') {
  if (gameActive) return;
  clearFinishedRound();
  if (kind !== 'main' && !seatBets[pos]) {
    setMsg('Put a main bet on this seat first', 'lose');
    return;
  }
  if (seatTotal() + bjChip > balance) {
    setMsg(`Not enough balance for a $${bjChip.toLocaleString()} chip`, 'lose');
    return;
  }
  const arr = betArr(kind);
  arr[pos] += bjChip;
  betLog.push({ pos, amt: bjChip, kind });
  lastChipDrop = `${pos}-${kind}`;
  const label = kind === 'main' ? `Seat ${pos + 1}` : `Seat ${pos + 1} ${SIDE_NAMES[kind]}`;
  setMsg(`${label}: $${arr[pos].toLocaleString()}`);
  renderHands();
  lastChipDrop = -1;
  updateTotalLabel();
}
function bjUndoBet() {
  if (gameActive || !betLog.length) return;
  clearFinishedRound();
  const { pos, amt, kind = 'main' } = betLog.pop();
  const arr = betArr(kind);
  arr[pos] = Math.max(0, arr[pos] - amt);
  // A seat with no main bet can't keep its side bets
  if (!seatBets[pos]) {
    for (const k of ['pp', 't3']) sideBets[k][pos] = 0;
    betLog = betLog.filter(e => !(e.pos === pos && e.kind && e.kind !== 'main'));
  }
  renderHands();
  updateTotalLabel();
}
function bjClearBets() {
  if (gameActive) return;
  clearFinishedRound();
  seatBets = Array(MAX_HANDS).fill(0);
  sideBets = { pp: Array(MAX_HANDS).fill(0), t3: Array(MAX_HANDS).fill(0) };
  betLog = [];
  setMsg('Pick a chip, tap a circle to bet, then DEAL');
  renderHands();
  updateTotalLabel();
}
function bjDoubleBets() {
  if (gameActive || !seatTotal()) return;
  if (seatTotal() * 2 > balance) { setMsg('Not enough balance to double the bets', 'lose'); return; }
  clearFinishedRound();
  for (const kind of ['main', 'pp', 't3']) {
    betArr(kind).forEach((b, pos) => { if (b) betLog.push({ pos, amt: b, kind }); });
  }
  seatBets = seatBets.map(b => b * 2);
  sideBets.pp = sideBets.pp.map(b => b * 2);
  sideBets.t3 = sideBets.t3.map(b => b * 2);
  renderHands();
  updateTotalLabel();
}

// ─── CARD HTML ─────────────────────────────────────────────────────
function cardHTML(card, faceUp=true, dealing=false) {
  const cls = dealing ? ' dealing' : '';
  if (!faceUp) return `<div class="card face-down${cls}"></div>`;
  const sym = SUIT_SYM[card.suit];
  const clr = SUIT_CLR[card.suit];
  const isFace = 'AJQK'.includes(card.rank);
  const center = isFace
    ? `<span class="center-rank">${card.rank}</span><span class="center-suit-sm">${sym}</span>`
    : `<span class="center-sym">${sym}</span>`;
  return `<div class="card face-up ${clr}${cls}">
    <span class="rank-top">${card.rank}</span>
    <span class="suit-top">${sym}</span>
    ${center}
  </div>`;
}

// ─── RENDER ────────────────────────────────────────────────────────
function renderDealer(hideHole=false) {
  const el = $('dealer-cards');
  // Card 0 = face up, Card 1 = hole card (face down when hideHole)
  el.innerHTML = dealerHand.map((c, i) =>
    cardHTML(c, !(hideHole && i === 1))
  ).join('');
  const valEl = $('dealer-value');
  if (hideHole && dealerHand.length >= 2) {
    valEl.textContent = `Showing: ${handValue([dealerHand[0]])}`;
  } else if (dealerHand.length) {
    valEl.textContent = `Value: ${handValue(dealerHand)}`;
  } else {
    valEl.textContent = '';
  }
}

function sideSpotHTML(pos, kind) {
  const amt = sideBets[kind][pos];
  const res = sideResults[`${pos}-${kind}`];
  const drop = `${pos}-${kind}` === lastChipDrop ? ' drop' : '';
  const cls = ['bj-side-spot', amt ? 'has-bet' : '', res ? (res.win ? 'won' : 'lost') : ''].join(' ');
  const inner = amt
    ? `<span class="bj-side-chip${drop}" style="--chip-color:${chipColorFor(amt)}"></span><span class="bj-side-amt">${fmtShort(amt)}</span>`
    : `<span class="bj-side-label">${kind === 'pp' ? 'PP' : '21+3'}</span>`;
  const tag = res && res.win ? `<span class="bj-side-tag">${res.label}</span>` : '';
  return `<button class="${cls}" onclick="bjPlaceChip(${pos}, '${kind}')" ${gameActive ? 'disabled' : ''}
    aria-label="${SIDE_NAMES[kind]} side bet on seat ${pos + 1}">${inner}${tag}</button>`;
}
function seatSpotsHTML(pos, amt) {
  return `${betSpotHTML(pos, amt)}<div class="bj-side-row">${sideSpotHTML(pos, 'pp')}${sideSpotHTML(pos, 't3')}</div>`;
}
function betSpotHTML(pos, amt) {
  const drop = `${pos}-main` === lastChipDrop ? ' drop' : '';
  const chip = amt > 0
    ? `<span class="bj-spot-chip${drop}" style="--chip-color:${chipColorFor(amt)}"></span>
       <span class="bj-spot-amt">$${amt.toLocaleString()}</span>`
    : `<span class="bj-spot-plus">+</span>`;
  return `<button class="bj-spot${amt > 0 ? ' has-bet' : ''}" onclick="bjPlaceChip(${pos})"
    ${gameActive ? 'disabled' : ''} aria-label="Bet on seat ${pos + 1}">${chip}</button>`;
}

function renderHands() {
  const area = $('player-area');
  area.innerHTML = '';
  const seatsInPlay = new Set(hands.map(h => h.position)).size;
  area.classList.toggle('crowded', seatsInPlay >= 4);
  for (let pos = 0; pos < MAX_HANDS; pos++) {
    const posHands = hands.filter(h => h.position === pos);
    if (hands.length && !posHands.length) continue;   // empty seats hide while cards are on the table
    const box = document.createElement('div');
    box.className = 'player-hand-box';
    const amt = posHands.length ? posHands.reduce((t, h) => t + h.bet, 0) : seatBets[pos];

    // Check if this position has the active hand
    if (gameActive && activeHand < hands.length && hands[activeHand].position === pos) {
      box.classList.add('active');
    }

    if (!posHands.length) {
      box.classList.add('empty-seat');
      box.innerHTML = `<div class="hand-title">Seat ${pos+1}</div>${seatSpotsHTML(pos, amt)}`;
    } else if (posHands.length === 1) {
      const h = posHands[0];
      const hideLast = h.doubleHidden;
      const cardsHTML = h.cards.map((c, i) =>
        cardHTML(c, !(hideLast && i === h.cards.length - 1))
      ).join('');
      let valText;
      if (h.doubleHidden) {
        valText = `${handValue(h.cards.slice(0, -1))}+?`;
      } else {
        valText = `${handValue(h.cards)}`;
      }
      if (h.result) valText += ` ${h.result.toUpperCase()}`;
      box.innerHTML = `<div class="hand-title">Seat ${pos+1}</div>
        <div class="hand-cards">${cardsHTML}</div>
        <div class="hand-value">${valText}</div>${seatSpotsHTML(pos, amt)}`;
    } else {
      // Split hands — show the active or last one
      let show = posHands.find(h => !h.done) || posHands[posHands.length - 1];
      const sub = posHands.indexOf(show);
      const hideLast = show.doubleHidden;
      const cardsHTML = show.cards.map((c, i) =>
        cardHTML(c, !(hideLast && i === show.cards.length - 1))
      ).join('');

      let valText;
      if (!gameActive) {
        valText = posHands.map((h, si) => {
          const v = h.doubleHidden ? `${handValue(h.cards.slice(0,-1))}+?` : `${handValue(h.cards)}`;
          const r = h.result ? ` ${h.result.toUpperCase()}` : '';
          return `${'ab'[si]}:${v}${r}`;
        }).join('  ');
      } else {
        if (show.doubleHidden) {
          valText = `${handValue(show.cards.slice(0,-1))}+?`;
        } else {
          valText = `${handValue(show.cards)}`;
        }
        if (show.result) valText += ` ${show.result.toUpperCase()}`;
      }
      box.innerHTML = `<div class="hand-title">Seat ${pos+1}${'ab'[sub]}</div>
        <div class="hand-cards">${cardsHTML}</div>
        <div class="hand-value">${valText}</div>${seatSpotsHTML(pos, amt)}`;
    }
    area.appendChild(box);
  }
}

function setButtonsEnabled(states) {
  $('btn-deal').disabled = !states.deal;
  $('btn-hit').disabled = !states.hit;
  $('btn-stand').disabled = !states.stand;
  $('btn-double').disabled = !states.double;
  $('btn-split').disabled = !states.split;
}

function updateButtons() {
  if (!gameActive) {
    const t = seatTotal();
    setButtonsEnabled({deal: t > 0, hit:false, stand:false, double:false, split:false});
    return;
  }
  const h = hands[activeHand];
  const cards = h.cards;
  setButtonsEnabled({
    deal: false,
    hit: true,
    stand: true,
    double: cards.length === 2 && balance >= h.bet,
    split: cards.length === 2 && !h.fromSplit && canSplit(cards) && balance >= h.bet,
  });
}

function showInsurance() {
  $('bj-buttons').classList.add('hidden');
  $('bj-insurance').classList.remove('hidden');
  $('ins-label').textContent = `Insurance? ($${insuranceCost.toLocaleString()})`;
}
function hideInsurance() {
  $('bj-insurance').classList.add('hidden');
  $('bj-buttons').classList.remove('hidden');
}

function lockInputs(locked) {
  $('bj-show-double').disabled = locked;
}

// ─── MENU ──────────────────────────────────────────────────────────
function launchGame(game) {
  if (typeof baccaratRoundActive === 'function' && baccaratRoundActive()) return;
  if (game === 'blackjack') {
    showScreen('blackjack-screen');
    updateBalance();
    updateCountDisplay();
    newShoe();
    renderHands();
    updateTotalLabel();
  } else if (game === 'baccarat') {
    showScreen('baccarat-screen');
    initBaccarat();
  } else if (game === 'slots') {
    showScreen('slot-lobby-screen');
    initSlotLobby();
  } else if (game === 'roulette') {
    showScreen('roulette-screen');
    initRoulette();
  } else if (game === 'mines') {
    showScreen('mines-screen');
    initMines();
  } else if (game === 'plinko') {
    showScreen('plinko-screen');
    initPlinko();
  } else if (game === 'crash') {
    showScreen('crash-screen');
    initCrash();
  } else if (game === 'achievements') {
    showScreen('achievements-screen');
    initAchievements();
    window.scrollTo(0, 0);
  } else if (game === 'dev') {
    showScreen('dev-screen');
    initDevOptions();
  }
}
function backToMenu() {
  if (typeof baccaratRoundActive === 'function' && baccaratRoundActive()) return;
  checkAutoReset();
  showScreen('menu-screen');
  updateBalance();
}

function checkAutoReset() {
  if (balance < 500) {
    balance = STARTING_BALANCE;
    updateBalance();
    if (typeof achUnlock === 'function') achUnlock('rock_bottom');
  }
}

// ─── DEAL ──────────────────────────────────────────────────────────
function bjDeal() {
  if (gameActive) return;
  const seats = [];
  for (let pos = 0; pos < MAX_HANDS; pos++) if (seatBets[pos] > 0) seats.push(pos);
  if (!seats.length) { setMsg('Tap a betting circle to place chips first', 'lose'); return; }
  for (let pos = 0; pos < MAX_HANDS; pos++) {
    if (!seatBets[pos] && (sideBets.pp[pos] || sideBets.t3[pos])) {
      setMsg(`Seat ${pos + 1} has side bets but no main bet`, 'lose');
      return;
    }
  }
  const totalNeeded = seatTotal();
  if (totalNeeded > balance) {
    setMsg(`Need $${totalNeeded.toLocaleString()} — only $${balance.toLocaleString()}! Undo or clear some chips.`, 'lose');
    return;
  }
  numPositions = seats.length;

  // Read options
  showDoubleCard = $('bj-show-double').checked;

  bjRoundStartBalance = balance;
  balance -= totalNeeded;
  updateBalance();
  insuranceTaken = false;
  insuranceCost = 0;
  holeCardCounted = false;
  sideResults = {};
  sideSummary = [];
  roundSideTotal = sumArr(sideBets.pp) + sumArr(sideBets.t3);

  // Init empty hands
  dealerHand = [];
  hands = [];
  for (const pos of seats) {
    hands.push({
      cards: [], bet: seatBets[pos], done: false, result: null,
      position: pos, fromSplit: false, doubleHidden: false,
    });
  }
  activeHand = 0;
  gameActive = true;

  // Clear display
  renderDealer();
  renderHands();
  renderChipRack();
  setDetail('');
  setMsg('Dealing...');
  lockInputs(true);
  setButtonsEnabled({deal:false, hit:false, stand:false, double:false, split:false});

  // Build deal queue: 2 rounds (card to each player, then dealer)
  const queue = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < hands.length; i++) queue.push({type:'player', pos: i});
    queue.push({type:'dealer'});
  }
  processDealQueue(queue);
}

function processDealQueue(queue) {
  if (!queue.length) { postDeal(); return; }
  const action = queue.shift();
  if (action.type === 'player') {
    hands[action.pos].cards.push(drawCard());
    renderHands();
  } else {
    // Dealer's second card is the hole card — don't count it yet
    const isHoleCard = dealerHand.length === 1;
    dealerHand.push(drawCard(!isHoleCard));
    renderDealer(true);
  }
  setTimeout(() => processDealQueue(queue), DEAL_DELAY);
}

// ─── SIDE BETS ─────────────────────────────────────────────────────
const RANK_ORDER = { A:1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, J:11, Q:12, K:13 };
const isRed = s => s === 'H' || s === 'D';
function evalPerfectPairs(c1, c2) {
  if (c1.rank !== c2.rank) return null;
  if (c1.suit === c2.suit) return { name: 'Perfect Pair', mult: PP_PAYS.perfect, key: 'perfect' };
  if (isRed(c1.suit) === isRed(c2.suit)) return { name: 'Colored Pair', mult: PP_PAYS.colored, key: 'colored' };
  return { name: 'Mixed Pair', mult: PP_PAYS.mixed, key: 'mixed' };
}
function evalTwentyOnePlus3(cards) {
  const flush = cards.every(c => c.suit === cards[0].suit);
  const ranks = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const trips = ranks[0] === ranks[2];
  const run = r => r[1] === r[0] + 1 && r[2] === r[1] + 1;
  const straight = !trips && (run(ranks) || (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13)); // Q-K-A
  if (trips && flush) return { name: 'Suited Trips', mult: T3_PAYS.suitedTrips, key: 'suitedTrips' };
  if (straight && flush) return { name: 'Straight Flush', mult: T3_PAYS.straightFlush, key: 'straightFlush' };
  if (trips) return { name: 'Three of a Kind', mult: T3_PAYS.trips, key: 'trips' };
  if (straight) return { name: 'Straight', mult: T3_PAYS.straight, key: 'straight' };
  if (flush) return { name: 'Flush', mult: T3_PAYS.flush, key: 'flush' };
  return null;
}
function resolveSideBets() {
  let paid = 0;
  for (const h of hands) {
    const pos = h.position;
    const [c1, c2] = h.cards;
    const checks = [['pp', () => evalPerfectPairs(c1, c2)], ['t3', () => evalTwentyOnePlus3([c1, c2, dealerHand[0]])]];
    for (const [kind, evalFn] of checks) {
      const amt = sideBets[kind][pos];
      if (!amt) continue;
      const hit = evalFn();
      if (hit) {
        const payout = amt * (hit.mult + 1);
        balance += payout;
        paid += payout - amt;
        sideResults[`${pos}-${kind}`] = { win: true, label: `${hit.mult}:1`, payout };
        sideSummary.push(`S${pos + 1} ${hit.name} +$${(payout - amt).toLocaleString()}`);
        if (kind === 'pp' && hit.key === 'perfect') achUnlock('bj_perfect_pair');
        if (kind === 't3') achUnlock('bj_213');
        if (kind === 't3' && hit.key === 'suitedTrips') achUnlock('bj_suited_trips');
      } else {
        sideResults[`${pos}-${kind}`] = { win: false };
      }
    }
  }
  if (Object.keys(sideResults).length) {
    updateBalance();
    renderHands();
    setDetail(sideSummary.length ? `Side bets: ${sideSummary.join('  |  ')}` : 'Side bets: no hits');
    if (paid > 0) setMsg(`Side bets pay +$${paid.toLocaleString()}!`, 'win');
  }
}

function postDeal() {
  resolveSideBets();
  if (dealerHand[0].rank === 'A') {
    offerInsurance();
    return;
  }
  startPlayerTurns();
}

// ─── INSURANCE ─────────────────────────────────────────────────────
function offerInsurance() {
  const totalBets = hands.reduce((s, h) => s + h.bet, 0);
  insuranceCost = Math.floor(totalBets / 2);
  if (balance >= insuranceCost) {
    setMsg(`Dealer shows Ace — Insurance costs $${insuranceCost.toLocaleString()}`, 'win');
    showInsurance();
  } else {
    setMsg("Dealer shows Ace (can't afford insurance)");
    showInsurance();
    // Disable the yes button
    $('bj-insurance').querySelectorAll('.teal')[0].disabled = true;
  }
}

function bjInsurance(take) {
  hideInsurance();
  if (take) {
    insuranceTaken = true;
    balance -= insuranceCost;
    updateBalance();
    setMsg(`Insurance taken ($${insuranceCost.toLocaleString()})`);
    setTimeout(checkDealerBJ, 600);
  } else {
    insuranceTaken = false;
    setMsg('Insurance declined');
    setTimeout(checkDealerBJ, 400);
  }
}

function checkDealerBJ() {
  const dv = handValue(dealerHand);
  if (dv === 21) {
    if (!holeCardCounted) { countCard(dealerHand[1]); holeCardCounted = true; }
    renderDealer(false);
    if (insuranceTaken) {
      const p = insuranceCost * 3;
      balance += p;
      updateBalance();
      setMsg(`Dealer BJ! Insurance pays $${p.toLocaleString()}`, 'win');
    } else {
      setMsg('Dealer Blackjack!', 'lose');
    }
    for (const h of hands) {
      const pv = handValue(h.cards);
      h.result = (pv === 21 && h.cards.length === 2) ? 'push' : 'lose';
      h.done = true;
    }
    finalize();
    return;
  }
  if (insuranceTaken) setMsg('No dealer BJ — insurance lost');
  setTimeout(startPlayerTurns, 400);
}

// ─── PLAYER TURNS ──────────────────────────────────────────────────
function startPlayerTurns() {
  for (const h of hands) {
    if (handValue(h.cards) === 21) h.done = true;
  }
  activeHand = 0;
  advanceOrDealer();
}

function bjHit() {
  if (!gameActive) return;
  const h = hands[activeHand];
  h.cards.push(drawCard());
  renderHands();
  const pv = handValue(h.cards);
  if (pv > 21) {
    h.done = true; h.result = 'bust';
    renderHands();
    setMsg(`Hand ${h.position+1} BUST!`, 'lose');
    setTimeout(advanceOrDealer, 500);
  } else if (pv === 21) {
    h.done = true;
    renderHands();
    setMsg('21!', 'win');
    setTimeout(advanceOrDealer, 400);
  } else {
    updateButtons();
  }
}

function bjStand() {
  if (!gameActive) return;
  hands[activeHand].done = true;
  advanceOrDealer();
}

function bjDouble() {
  if (!gameActive) return;
  const h = hands[activeHand];
  if (balance < h.bet) return;
  balance -= h.bet;
  h.bet *= 2;
  h.doubled = true;
  updateBalance();
  h.cards.push(drawCard());
  if (!showDoubleCard) h.doubleHidden = true;
  renderHands();
  h.done = true;
  if (showDoubleCard && handValue(h.cards) > 21) {
    h.result = 'bust';
    renderHands();
    setMsg('BUST on Double!', 'lose');
    setTimeout(advanceOrDealer, 500);
  } else {
    advanceOrDealer();
  }
}

function bjSplit() {
  if (!gameActive) return;
  const h = hands[activeHand];
  if (balance < h.bet) return;
  const pos = h.position;
  const [c1, c2] = h.cards;
  balance -= h.bet;
  updateBalance();
  const h1 = { cards:[c1, drawCard()], bet:h.bet, done:false, result:null,
                position:pos, fromSplit:true, doubleHidden:false };
  const h2 = { cards:[c2, drawCard()], bet:h.bet, done:false, result:null,
                position:pos, fromSplit:true, doubleHidden:false };
  hands.splice(activeHand, 1, h1, h2);
  if (handValue(h1.cards) === 21) h1.done = true;
  if (handValue(h2.cards) === 21) h2.done = true;
  renderHands();
  if (h1.done) {
    advanceOrDealer();
  } else {
    setMsg(`Playing Hand ${pos+1}a...`);
    updateButtons();
  }
}

// ─── ADVANCE / DEALER ──────────────────────────────────────────────
function advanceOrDealer() {
  for (let i = 0; i < hands.length; i++) {
    if (!hands[i].done) {
      activeHand = i;
      renderHands();
      const pos = hands[i].position;
      const ph = hands.filter(h => h.position === pos);
      if (ph.length > 1) {
        const sub = ph.indexOf(hands[i]);
        setMsg(`Playing Hand ${pos+1}${'ab'[sub]}...`);
      } else {
        setMsg(`Playing Hand ${pos+1}...`);
      }
      updateButtons();
      return;
    }
  }

  // All player hands done — reveal hidden double cards
  for (const h of hands) {
    if (h.doubleHidden) {
      h.doubleHidden = false;
      if (handValue(h.cards) > 21) h.result = 'bust';
    }
  }
  renderHands();

  // Count the hole card now that it's revealed
  if (!holeCardCounted) { countCard(dealerHand[1]); holeCardCounted = true; }

  if (hands.every(h => h.result === 'bust')) {
    renderDealer(false);
    finalize();
    return;
  }

  updateButtons();
  renderDealer(false);
  setMsg("Dealer's turn...");
  setTimeout(dealerPlay, DEALER_DELAY);
}

function dealerPlay() {
  const dv = handValue(dealerHand);
  if (dv < 17) {
    dealerHand.push(drawCard());
    renderDealer(false);
    setTimeout(dealerPlay, DEALER_DELAY);
  } else {
    compareAll();
  }
}

function compareAll() {
  const dv = handValue(dealerHand);
  const dbj = dv === 21 && dealerHand.length === 2;
  for (const h of hands) {
    if (h.result === 'bust') continue;
    const pv = handValue(h.cards);
    const pbj = pv === 21 && h.cards.length === 2 && !h.fromSplit;
    if (pbj && dbj) h.result = 'push';
    else if (pbj) h.result = 'blackjack';
    else if (dbj) h.result = 'lose';
    else if (dv > 21) h.result = 'win';
    else if (pv > dv) h.result = 'win';
    else if (pv < dv) h.result = 'lose';
    else h.result = 'push';
  }
  finalize();
}

// ─── FINALIZE ──────────────────────────────────────────────────────
function finalize() {
  gameActive = false;
  let totalWon = 0;
  const details = [];

  for (const h of hands) {
    const pos = h.position;
    const ph = hands.filter(hh => hh.position === pos);
    const label = ph.length > 1 ? `H${pos+1}${'ab'[ph.indexOf(h)]}` : `H${pos+1}`;
    const {bet, result} = h;
    stats.hands++;

    if (result === 'blackjack') {
      const payout = Math.floor(bet * 2.5);
      balance += payout;
      totalWon += payout - bet;
      details.push(`${label}:BJ+$${payout-bet}`);
      stats.wins++; stats.bjs++;
    } else if (result === 'win') {
      balance += bet * 2;
      totalWon += bet;
      details.push(`${label}:W+$${bet}`);
      stats.wins++;
    } else if (result === 'push') {
      balance += bet;
      details.push(`${label}:P`);
      stats.pushes++;
    } else {
      totalWon -= bet;
      details.push(`${label}:${result[0].toUpperCase()}`);
      stats.losses++;
    }
  }

  updateStats();
  renderHands();
  updateBalance();

  // Achievements
  const bjWager = hands.reduce((t, h) => t + h.bet, 0) + insuranceCost + roundSideTotal;
  achRound('blackjack', { wager: bjWager, payout: bjWager + (balance - bjRoundStartBalance) });
  const naturals = hands.filter(h => h.result === 'blackjack').length;
  if (naturals >= 1) achUnlock('bj_natural');
  if (naturals >= 3) achUnlock('bj_hattrick');
  if (hands.some(h => h.fromSplit && h.result === 'win')) achUnlock('bj_split');
  if (hands.some(h => h.doubled && h.result === 'win')) achUnlock('bj_double');
  if (numPositions >= MAX_HANDS) achUnlock('bj_table');

  totalWon += Object.values(sideResults).reduce((t, r) => t + (r.payout || 0), 0) - roundSideTotal;
  if (totalWon > 0) setMsg(`Net: +$${totalWon.toLocaleString()}`, 'win');
  else if (totalWon < 0) setMsg(`Net: -$${Math.abs(totalWon).toLocaleString()}`, 'lose');
  else setMsg('Break even');

  setDetail([...sideSummary, ...details].join('  |  '));
  lockInputs(false);
  renderChipRack();

  if (balance < 5) {
    checkAutoReset();
    setMsg('Balance reset! Press DEAL to play.', 'win');
    updateBalance();
    updateButtons();
  } else {
    updateButtons();
  }
}

// ─── EVENT LISTENERS ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateBalance();
  newShoe();

  renderHands();
  updateTotalLabel();
});
