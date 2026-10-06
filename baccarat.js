/* Baccarat table: the rules and canvas card renderer are independent of the wallet. */
(function () {
  'use strict';
  const rules = window.BaccaratRules;
  const MIN_BET = 500;
  const STORAGE_KEY = 'casino-baccarat-round';
  const $bac = id => document.getElementById(id);
  const money = amount => amount.toLocaleString();
  const title = side => ({ player: 'Player', banker: 'Banker', tie: 'Tie' }[side]);
  const otherSide = () => side === 'player' ? 'banker' : 'player';
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let side = 'player';
  let betSide = 'player';
  let chips = [MIN_BET];
  let phase = 'betting';
  let shoe = [];
  let round = null;
  let shown = { player: 2, banker: 2 };
  let revealed = { player: [], banker: [] };
  let extraQueue = [];
  let autoReveal = false;
  let history = [];
  let advancing = false;

  const active = () => phase === 'dealing' || phase === 'peeling' || phase === 'drawing';
  const wager = () => chips.reduce((sum, chip) => sum + chip, 0);
  const delay = (callback, ms = 450) => window.setTimeout(callback, reducedMotion() ? 20 : ms);

  function message(headline, detail, outcome = '') {
    $bac('bac-status').textContent = headline;
    $bac('bac-detail').textContent = detail;
    $bac('bac-status').dataset.outcome = outcome;
  }

  function storePending(status = 'pending', finalBalance) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, status, side, betSide, bet: round.bet, result: round.result,
        debitedBalance: round.debitedBalance, finalBalance
      }));
    } catch (_) { /* The table still works when browser storage is unavailable. */ }
  }

  function updateWallet() {
    $bac('bac-balance').textContent = money(balance);
    updateBalance();
  }

  function updateControls() {
    const locked = active();
    const amount = wager();
    $bac('bac-bet-value').textContent = money(amount);
    $bac('bac-menu').disabled = locked;
    $bac('bac-deal').disabled = locked || amount < MIN_BET || amount > balance;
    $bac('bac-deal').querySelector('span').textContent = locked ? 'HAND IN PLAY' : phase === 'settled' ? 'DEAL AGAIN' : 'DEAL HAND';
    $bac('bac-deal').querySelector('small').textContent = locked ? 'Enjoy the squeeze' : `${money(amount)} on ${title(betSide)}`;
    $bac('bac-undo').disabled = locked || chips.length === 0;
    $bac('bac-clear').disabled = locked || amount === 0;
    $bac('bac-quick-reveal').hidden = phase !== 'peeling';
    $bac('bac-peel-choice').hidden = betSide !== 'tie';
    document.querySelectorAll('[data-bac-peel]').forEach(button => {
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(button.dataset.bacPeel === side));
    });
    document.querySelectorAll('[data-bac-chip]').forEach(button => {
      button.disabled = locked || amount + Number(button.dataset.bacChip) > balance;
    });
    document.querySelectorAll('[data-bac-side]').forEach(button => {
      const selected = button.dataset.bacSide === betSide;
      button.disabled = locked;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('.bac-spot-stake').textContent = selected && amount ? money(amount) : 'SELECT HAND';
    });
  }

  function drawCardButton(card, handSide, index, faceUp) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bac-card' + (faceUp ? '' : ' is-hidden');
    button.disabled = faceUp || handSide !== side || phase !== 'peeling';
    button.setAttribute('aria-label', faceUp
      ? `${title(handSide)} card ${index + 1}: ${card.rank} of ${{S:'spades',H:'hearts',D:'diamonds',C:'clubs'}[card.suit]}`
      : `Your face-down card ${index + 1}. Drag upward to peel, or press Enter to reveal.`);
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 700;
    canvas.setAttribute('aria-hidden', 'true');
    button.appendChild(canvas);
    window.BaccaratCards.paint(canvas, card, { faceUp });
    if (faceUp) return button;

    const cue = document.createElement('span');
    cue.className = 'bac-card-cue';
    cue.textContent = 'PEEL ↑';
    button.appendChild(cue);
    let pointer = null, startY = 0, progress = 0, height = 1, frame = 0;
    const paint = () => {
      frame = 0;
      window.BaccaratCards.paint(canvas, card, { peel: progress });
    };
    const schedulePaint = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const release = () => {
      const from = progress;
      const start = performance.now();
      const reset = now => {
        if (pointer !== null) return;
        const fraction = reducedMotion() ? 1 : Math.min(1, (now - start) / 180);
        progress = from * Math.pow(1 - fraction, 3);
        paint();
        if (fraction < 1 && button.isConnected) requestAnimationFrame(reset);
      };
      requestAnimationFrame(reset);
    };
    button.addEventListener('pointerdown', event => {
      if (phase !== 'peeling' || (event.pointerType === 'mouse' && event.button !== 0) || pointer !== null) return;
      event.preventDefault();
      button.focus({ preventScroll: true });
      pointer = event.pointerId;
      startY = event.clientY;
      height = button.getBoundingClientRect().height;
      progress = 0;
      button.setPointerCapture(pointer);
      button.classList.add('is-peeling');
    });
    button.addEventListener('pointermove', event => {
      if (pointer !== event.pointerId) return;
      progress = Math.max(0, Math.min(0.94, (startY - event.clientY) / (height * 0.85)));
      schedulePaint();
    });
    const end = (event, cancelled = false) => {
      if (pointer !== event.pointerId) return;
      const id = pointer;
      pointer = null;
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
      button.classList.remove('is-peeling');
      if (!cancelled && progress >= 0.72) revealOne(index);
      else release();
    };
    button.addEventListener('pointerup', event => end(event));
    button.addEventListener('pointercancel', event => end(event, true));
    button.addEventListener('lostpointercapture', event => end(event, true));
    // Pointer taps keep the tactile squeeze; keyboard users get a direct reveal.
    button.addEventListener('click', event => { if (event.detail === 0) revealOne(index); });
    return button;
  }

  function renderHands() {
    $bac('bac-opponent-name').textContent = `${title(otherSide()).toUpperCase()} · OPPOSITE HAND`;
    $bac('bac-own-name').textContent = `${title(side).toUpperCase()} · YOUR HAND`;
    for (const [position, handSide] of [['opponent', otherSide()], ['own', side]]) {
      const container = $bac(`bac-${position}-cards`);
      container.replaceChildren();
      if (!round) {
        for (let index = 0; index < 2; index++) {
          const empty = document.createElement('div');
          empty.className = 'bac-empty-card';
          empty.setAttribute('aria-hidden', 'true');
          container.appendChild(empty);
        }
        $bac(`bac-${position}-score`).textContent = '—';
      } else {
        const cards = round.result[handSide].slice(0, shown[handSide]);
        const allVisible = handSide !== side || cards.every((_, index) => revealed[handSide][index]);
        $bac(`bac-${position}-score`).textContent = allVisible ? rules.total(cards) : '?';
        cards.forEach((card, index) => container.appendChild(drawCardButton(card, handSide, index, handSide !== side || !!revealed[handSide][index])));
      }
      container.closest('.bac-hand').classList.toggle('is-winning', phase === 'settled' && round.result.winner === handSide);
    }
  }

  function revealOne(index) {
    if (phase !== 'peeling' || revealed[side][index] || index >= shown[side]) return;
    revealed[side][index] = true;
    renderHands();
    const nextCard = $bac('bac-own-cards').querySelector('button:not(:disabled)');
    if (nextCard) nextCard.focus({ preventScroll: true });
    advance();
  }

  function advance() {
    if (advancing || phase !== 'peeling') return;
    if (!round.result[side].slice(0, shown[side]).every((_, index) => revealed[side][index])) return;
    advancing = true;
    phase = 'drawing';
    updateControls();
    delay(() => {
      advancing = false;
      if (!extraQueue.length) { settle(); return; }
      const drawingSide = extraQueue.shift();
      shown[drawingSide] = 3;
      phase = 'peeling';
      if (drawingSide !== side || autoReveal) revealed[drawingSide][2] = true;
      message(`${title(drawingSide)} draws a third card.`, drawingSide === side && !autoReveal
        ? 'One more squeeze. Peel your third card upward.'
        : 'The table draws automatically under baccarat rules.');
      renderHands();
      updateControls();
      if (drawingSide !== side || autoReveal) advance();
    });
  }

  function beginRoundView(resumed = false) {
    shown = { player: 2, banker: 2 };
    revealed = { player: [], banker: [] };
    extraQueue = ['player', 'banker'].filter(hand => round.result[hand].length === 3);
    autoReveal = false;
    advancing = false;
    phase = 'dealing';
    message(resumed ? 'Your hand is waiting.' : 'No more bets.', `${title(otherSide())} is showing. Your ${title(side)} cards are yours to squeeze.`);
    updateWallet();
    renderHands();
    updateControls();
    delay(() => {
      phase = 'peeling';
      message('The reveal is in your hands.', 'Drag upward on each face-down card. Let go early to put it back.');
      renderHands();
      updateControls();
    }, 350);
  }

  function deal() {
    if (active()) return;
    const bet = wager();
    if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet % MIN_BET !== 0 || bet > balance) {
      message('Minimum bet: 500 coins.', 'Add chips up to your available balance, then deal.');
      return;
    }
    if (shoe.length < 24) shoe = rules.makeShoe(8);
    const draw = () => shoe.pop();
    // The physical dealing order is Player, Banker, Player, Banker.
    const player = [draw()], banker = [draw()];
    player.push(draw()); banker.push(draw());
    round = { bet, result: rules.resolveOpening(player, banker, draw), debitedBalance: balance - bet };
    storePending();
    balance = round.debitedBalance;
    beginRoundView();
  }

  function settle() {
    if (!active() || !round) return;
    phase = 'settled';
    const credit = rules.payout(round.bet, betSide, round.result.winner);
    const net = credit - round.bet;
    const finalBalance = round.debitedBalance + credit;
    // A small settlement journal makes reloading between writes idempotent.
    storePending('settled', finalBalance);
    balance = finalBalance;
    saveBalance();
    const refill = balance < MIN_BET;
    checkAutoReset();
    updateWallet();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    const result = round.result;
    const score = `Player ${rules.total(result.player)} · Banker ${rules.total(result.banker)}`;
    const headline = net > 0 ? `${title(betSide)} wins. +${money(net)} coins.` : result.winner === 'tie' ? 'Tie. Your stake returns.' : `${title(result.winner)} wins. −${money(round.bet)} coins.`;
    const notes = [score];
    if (result.natural) notes.push('Natural — no third cards.');
    if (betSide === 'banker' && net > 0) notes.push(`${money(round.bet * 0.05)} commission paid.`);
    if (betSide === 'tie' && net > 0) notes.push('Tie pays 8:1.');
    if (refill) notes.push('Balance refilled to 5,000.');
    message(headline, notes.join(' · '), net > 0 ? 'win' : net < 0 ? 'loss' : 'tie');
    history.unshift(result.winner);
    history = history.slice(0, 16);
    $bac('bac-history').replaceChildren(...history.map(winner => {
      const dot = document.createElement('span');
      dot.className = `bac-result-dot ${winner}`;
      dot.textContent = winner[0].toUpperCase();
      dot.setAttribute('aria-label', winner === 'tie' ? 'Tie' : `${title(winner)} won`);
      return dot;
    }));
    // Keep the last stake when affordable, otherwise select the table minimum.
    if (wager() > balance) chips = [MIN_BET];
    renderHands();
    updateControls();
  }

  window.baccaratRoundActive = active;
  window.initBaccarat = function () {
    if (!active()) checkAutoReset();
    if (wager() > balance) chips = [MIN_BET];
    updateWallet();
    renderHands();
    updateControls();
  };

  document.addEventListener('DOMContentLoaded', () => {
    $bac('bac-menu').addEventListener('click', () => { if (!active()) backToMenu(); });
    $bac('bac-deal').addEventListener('click', deal);
    document.querySelectorAll('[data-bac-side]').forEach(button => button.addEventListener('click', () => {
      if (active()) return;
      betSide = button.dataset.bacSide;
      if (betSide !== 'tie') side = betSide;
      round = null;
      phase = 'betting';
      message(`You're backing ${title(betSide)}.`, betSide === 'tie' ? 'Tie pays 8:1. Choose which hand you want to peel below.' : `You'll see ${title(otherSide())} first, then peel your own cards.`);
      renderHands();
      updateControls();
    }));
    document.querySelectorAll('[data-bac-peel]').forEach(button => button.addEventListener('click', () => {
      if (active() || betSide !== 'tie') return;
      side = button.dataset.bacPeel;
      round = null;
      phase = 'betting';
      message('You’re backing a Tie.', `You'll see ${title(otherSide())} first and peel ${title(side)}. Tie pays 8:1.`);
      renderHands();
      updateControls();
    }));
    document.querySelectorAll('[data-bac-chip]').forEach(button => button.addEventListener('click', () => {
      const chip = Number(button.dataset.bacChip);
      if (active() || wager() + chip > balance) return;
      chips.push(chip);
      updateControls();
    }));
    $bac('bac-clear').addEventListener('click', () => {
      if (active()) return;
      chips = [];
      message('Build your bet.', 'Tap a chip to add it. The table minimum is 500 coins.');
      updateControls();
    });
    $bac('bac-undo').addEventListener('click', () => { if (!active()) { chips.pop(); updateControls(); } });
    $bac('bac-quick-reveal').addEventListener('click', () => {
      if (phase !== 'peeling') return;
      autoReveal = true;
      for (let i = 0; i < shown[side]; i++) revealed[side][i] = true;
      renderHands();
      advance();
    });

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === 1 && ['player', 'banker'].includes(saved.side)
          && Number.isSafeInteger(saved.bet) && saved.bet >= MIN_BET && saved.bet % MIN_BET === 0
          && Number.isSafeInteger(saved.debitedBalance) && saved.debitedBalance >= 0
          && [saved.result.player, saved.result.banker].every(cards => Array.isArray(cards) && cards.length >= 2 && cards.length <= 3)) {
        const p = rules.total(saved.result.player), b = rules.total(saved.result.banker);
        saved.result.winner = p > b ? 'player' : b > p ? 'banker' : 'tie';
        side = saved.side;
        betSide = ['player', 'banker', 'tie'].includes(saved.betSide) ? saved.betSide : side;
        chips = [saved.bet];
        round = { bet: saved.bet, debitedBalance: saved.debitedBalance, result: saved.result };
        if (saved.status === 'settled') {
          balance = saved.debitedBalance + rules.payout(saved.bet, betSide, saved.result.winner);
          checkAutoReset();
          updateWallet();
          localStorage.removeItem(STORAGE_KEY);
          round = null;
        } else {
          balance = saved.debitedBalance;
          showScreen('baccarat-screen');
          beginRoundView(true);
        }
      }
    } catch (_) { /* Ignore malformed or unavailable local storage. */ }
  });
})();
