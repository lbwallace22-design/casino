/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Blackjack
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────────
const NUM_DECKS = 6;
const STARTING_BALANCE = 5000;
const DEFAULT_BET = 25;
const DEFAULT_HANDS = 3;
const MAX_HANDS = 7;
const DEAL_DELAY = 280;
const DEALER_DELAY = 550;

const SUITS = ['S','H','D','C'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_SYM = { S:'♠', H:'♥', D:'♦', C:'♣' };
const SUIT_CLR = { S:'black-card', H:'red-card', D:'red-card', C:'black-card' };

// ─── STATE ─────────────────────────────────────────────────────────
let balance = STARTING_BALANCE;
let deck = [];
let dealerHand = [];
let hands = [];
let activeHand = 0;
let gameActive = false;
let baseBet = DEFAULT_BET;
let numPositions = DEFAULT_HANDS;
let insuranceTaken = false;
let insuranceCost = 0;
let showDoubleCard = true;
let betMode = 'per_hand';
let runningCount = 0;
let cardsSeen = 0;

let stats = { hands:0, wins:0, losses:0, pushes:0, bjs:0 };

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
function drawCard() {
  if (deck.length < 20) newShoe();
  const c = deck.pop();
  runningCount += hiloValue(c.rank);
  cardsSeen++;
  updateCountDisplay();
  return c;
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
function updateTotalLabel() {
  const betInput = parseInt($('bj-bet').value) || DEFAULT_BET;
  const label = $('bj-bet-label');
  const total = $('bj-total-label');
  if (betMode === 'per_hand') {
    label.textContent = 'Bet/Hand: $';
    total.textContent = `(Total: $${(betInput * numPositions).toLocaleString()})`;
  } else {
    label.textContent = 'Total Bet: $';
    const per = Math.floor(betInput / numPositions);
    total.textContent = `($${per.toLocaleString()}/hand)`;
  }
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
function renderDealer(hideFirst=false) {
  const el = $('dealer-cards');
  el.innerHTML = dealerHand.map((c, i) =>
    cardHTML(c, !(hideFirst && i === 0))
  ).join('');
  const valEl = $('dealer-value');
  if (hideFirst && dealerHand.length >= 2) {
    valEl.textContent = `Showing: ${handValue([dealerHand[1]])}`;
  } else if (dealerHand.length) {
    valEl.textContent = `Value: ${handValue(dealerHand)}`;
  } else {
    valEl.textContent = '';
  }
}

function renderHands() {
  const area = $('player-area');
  area.innerHTML = '';
  for (let pos = 0; pos < numPositions; pos++) {
    const posHands = hands.filter(h => h.position === pos);
    const box = document.createElement('div');
    box.className = 'player-hand-box';

    // Check if this position has the active hand
    if (gameActive && activeHand < hands.length && hands[activeHand].position === pos) {
      box.classList.add('active');
    }

    if (!posHands.length) {
      box.innerHTML = `<div class="hand-title">Hand ${pos+1}</div>
        <div class="hand-cards" style="min-height:76px"></div>
        <div class="hand-value"></div>`;
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
      box.innerHTML = `<div class="hand-title">Hand ${pos+1}</div>
        <div class="hand-cards">${cardsHTML}</div>
        <div class="hand-value">${valText}</div>`;
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
      box.innerHTML = `<div class="hand-title">Hand ${pos+1}${'ab'[sub]}</div>
        <div class="hand-cards">${cardsHTML}</div>
        <div class="hand-value">${valText}</div>`;
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
    setButtonsEnabled({deal: balance >= 5, hit:false, stand:false, double:false, split:false});
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
  $('bj-bet').disabled = locked;
  $('bj-hands').disabled = locked;
  $('bj-show-double').disabled = locked;
}

// ─── MENU ──────────────────────────────────────────────────────────
function launchGame(game) {
  if (game === 'blackjack') {
    showScreen('blackjack-screen');
    updateBalance();
    updateTotalLabel();
    updateCountDisplay();
    newShoe();
  } else if (game === 'slots') {
    showScreen('slots-screen');
    initSlots();
  } else if (game === 'roulette') {
    showScreen('roulette-screen');
    initRoulette();
  }
}
function backToMenu() {
  checkAutoReset();
  showScreen('menu-screen');
  updateBalance();
}

function checkAutoReset() {
  if (balance < 500) {
    balance = STARTING_BALANCE;
    updateBalance();
  }
}

// ─── DEAL ──────────────────────────────────────────────────────────
function bjDeal() {
  // Read hand count
  let n = parseInt($('bj-hands').value) || DEFAULT_HANDS;
  n = Math.max(1, Math.min(MAX_HANDS, n));
  $('bj-hands').value = n;
  numPositions = n;

  // Read bet
  const betInput = parseInt($('bj-bet').value) || DEFAULT_BET;
  if (betMode === 'total') {
    baseBet = Math.floor(betInput / numPositions);
  } else {
    baseBet = betInput;
  }
  const totalNeeded = baseBet * numPositions;

  if (baseBet < 5) { setMsg('Minimum $5 per hand!', 'lose'); return; }
  if (totalNeeded > balance) {
    setMsg(`Need $${totalNeeded.toLocaleString()} — only $${balance.toLocaleString()}!`, 'lose');
    return;
  }

  // Read options
  showDoubleCard = $('bj-show-double').checked;
  betMode = document.querySelector('input[name="betmode"]:checked').value;

  balance -= totalNeeded;
  updateBalance();
  insuranceTaken = false;
  insuranceCost = 0;

  // Init empty hands
  dealerHand = [];
  hands = [];
  for (let pos = 0; pos < numPositions; pos++) {
    hands.push({
      cards: [], bet: baseBet, done: false, result: null,
      position: pos, fromSplit: false, doubleHidden: false,
    });
  }
  activeHand = 0;
  gameActive = true;

  // Clear display
  renderDealer();
  renderHands();
  setDetail('');
  setMsg('Dealing...');
  lockInputs(true);
  setButtonsEnabled({deal:false, hit:false, stand:false, double:false, split:false});

  // Build deal queue: 2 rounds (card to each player, then dealer)
  const queue = [];
  for (let round = 0; round < 2; round++) {
    for (let pos = 0; pos < numPositions; pos++) queue.push({type:'player', pos});
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
    dealerHand.push(drawCard());
    renderDealer(true);
  }
  setTimeout(() => processDealQueue(queue), DEAL_DELAY);
}

function postDeal() {
  if (dealerHand[1].rank === 'A') {
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
  balance -= h.bet;
  h.bet *= 2;
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
  const pos = h.position;
  const [c1, c2] = h.cards;
  balance -= h.bet;
  updateBalance();
  const h1 = { cards:[c1, drawCard()], bet:baseBet, done:false, result:null,
                position:pos, fromSplit:true, doubleHidden:false };
  const h2 = { cards:[c2, drawCard()], bet:baseBet, done:false, result:null,
                position:pos, fromSplit:true, doubleHidden:false };
  hands.splice(activeHand, 1, h1, h2);
  if (handValue(h1.cards) === 21) h1.done = true;
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

  if (totalWon > 0) setMsg(`Net: +$${totalWon.toLocaleString()}`, 'win');
  else if (totalWon < 0) setMsg(`Net: -$${Math.abs(totalWon).toLocaleString()}`, 'lose');
  else setMsg('Break even');

  setDetail(details.join('  |  '));
  lockInputs(false);

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

  $('bj-bet').addEventListener('input', updateTotalLabel);
  $('bj-hands').addEventListener('change', () => {
    if (gameActive) {
      $('bj-hands').value = numPositions;
      return;
    }
    let n = parseInt($('bj-hands').value) || DEFAULT_HANDS;
    n = Math.max(1, Math.min(MAX_HANDS, n));
    $('bj-hands').value = n;
    numPositions = n;
    updateTotalLabel();
  });

  document.querySelectorAll('input[name="betmode"]').forEach(r => {
    r.addEventListener('change', () => {
      betMode = r.value;
      updateTotalLabel();
    });
  });
});
