(function (root) {
  'use strict';

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];

  function cardValue(card) {
    const rank = card && String(card.rank);
    if (rank === 'A') return 1;
    if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
    if (/^[2-9]$/.test(rank)) return Number(rank);
    throw new TypeError('Invalid baccarat card rank.');
  }

  function total(cards) {
    return cards.reduce((sum, card) => sum + cardValue(card), 0) % 10;
  }

  // A null third-card value means Player stood. A ten/face card has value 0.
  function bankerDraws(bankerTotal, playerThirdValueOrNull) {
    if (!Number.isInteger(bankerTotal) || bankerTotal < 0 || bankerTotal > 9) {
      throw new RangeError('Banker total must be an integer from 0 to 9.');
    }
    if (playerThirdValueOrNull === null) return bankerTotal <= 5;
    if (!Number.isInteger(playerThirdValueOrNull) || playerThirdValueOrNull < 0 || playerThirdValueOrNull > 9) {
      throw new RangeError('Player third-card value must be null or an integer from 0 to 9.');
    }
    if (bankerTotal <= 2) return true;
    if (bankerTotal === 3) return playerThirdValueOrNull !== 8;
    if (bankerTotal === 4) return playerThirdValueOrNull >= 2 && playerThirdValueOrNull <= 7;
    if (bankerTotal === 5) return playerThirdValueOrNull >= 4 && playerThirdValueOrNull <= 7;
    if (bankerTotal === 6) return playerThirdValueOrNull === 6 || playerThirdValueOrNull === 7;
    return false;
  }

  function resolveOpening(player2, banker2, drawFn) {
    if (!Array.isArray(player2) || !Array.isArray(banker2) || player2.length !== 2 || banker2.length !== 2) {
      throw new TypeError('Each opening hand must contain exactly two cards.');
    }
    const player = player2.slice();
    const banker = banker2.slice();
    const playerOpeningTotal = total(player);
    const bankerOpeningTotal = total(banker);
    const natural = playerOpeningTotal >= 8 || bankerOpeningTotal >= 8;

    function draw() {
      if (typeof drawFn !== 'function') throw new TypeError('A draw function is required.');
      const card = drawFn();
      cardValue(card);
      return card;
    }

    if (!natural) {
      let playerThirdValue = null;
      if (playerOpeningTotal <= 5) {
        const third = draw();
        player.push(third);
        playerThirdValue = cardValue(third);
      }
      if (bankerDraws(bankerOpeningTotal, playerThirdValue)) banker.push(draw());
    }

    const playerTotal = total(player);
    const bankerTotal = total(banker);
    const winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
    return { player, banker, natural, winner };
  }

  // Returns the complete credit, including the original stake when applicable.
  function payout(bet, side, winner) {
    if (!Number.isFinite(bet) || bet < 0) throw new RangeError('Bet must be a finite, nonnegative number.');
    if (side !== 'player' && side !== 'banker' && side !== 'tie') throw new TypeError('Bet side must be Player, Banker, or Tie.');
    if (winner !== 'player' && winner !== 'banker' && winner !== 'tie') throw new TypeError('Invalid baccarat winner.');
    if (side === 'tie') return winner === 'tie' ? Math.round(bet * 9 * 100) / 100 : 0;
    if (winner === 'tie') return bet;
    if (winner !== side) return 0;
    return Math.round(bet * (side === 'banker' ? 1.95 : 2) * 100) / 100;
  }

  function randomIndex(upperExclusive) {
    if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
      const sample = new Uint32Array(1);
      const limit = Math.floor(0x100000000 / upperExclusive) * upperExclusive;
      do { root.crypto.getRandomValues(sample); } while (sample[0] >= limit);
      return sample[0] % upperExclusive;
    }
    return Math.floor(Math.random() * upperExclusive);
  }

  function makeShoe(deckCount = 8) {
    if (!Number.isInteger(deckCount) || deckCount < 1 || deckCount > 8) {
      throw new RangeError('A baccarat shoe must contain between 1 and 8 decks.');
    }
    const shoe = [];
    for (let deck = 0; deck < deckCount; deck++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) shoe.push({ rank, suit });
      }
    }
    for (let index = shoe.length - 1; index > 0; index--) {
      const other = randomIndex(index + 1);
      [shoe[index], shoe[other]] = [shoe[other], shoe[index]];
    }
    return shoe;
  }

  const api = Object.freeze({ cardValue, total, bankerDraws, resolveOpening, payout, makeShoe });
  root.BaccaratRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
