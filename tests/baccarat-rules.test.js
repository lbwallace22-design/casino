'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('../baccarat-rules.js');

const card = value => ({ rank: value === 0 ? 'K' : value === 1 ? 'A' : String(value), suit: 'S' });
const opening = value => [card(value), card(0)];

// Published Banker drawing table, indexed by Player's third-card value (0–9).
// Source: MGM National Harbor Baccarat Royal 9 rules, standard baccarat section.
const BANKER_DRAW_TABLE = [
  [true, true, true, true, true, true, true, true, true, true],
  [true, true, true, true, true, true, true, true, true, true],
  [true, true, true, true, true, true, true, true, true, true],
  [true, true, true, true, true, true, true, true, false, true],
  [false, false, true, true, true, true, true, true, false, false],
  [false, false, false, false, true, true, true, true, false, false],
  [false, false, false, false, false, false, true, true, false, false],
  [false, false, false, false, false, false, false, false, false, false],
  [false, false, false, false, false, false, false, false, false, false],
  [false, false, false, false, false, false, false, false, false, false],
];

test('baccarat values and totals use only the last digit', () => {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0];
  assert.deepEqual(ranks.map(rank => Rules.cardValue({ rank, suit: 'H' })), expected);
  assert.equal(Rules.total([{ rank: '9' }, { rank: '8' }, { rank: '7' }]), 4);
  assert.equal(Rules.total([{ rank: 'A' }, { rank: '9' }]), 0);
  assert.equal(Rules.total([]), 0);
});

test('every Banker/Player third-card combination matches the drawing table', () => {
  BANKER_DRAW_TABLE.forEach((row, bankerTotal) => {
    row.forEach((draws, playerThirdValue) => {
      assert.equal(Rules.bankerDraws(bankerTotal, playerThirdValue), draws,
        `Banker ${bankerTotal}, Player third card ${playerThirdValue}`);
    });
  });
});

test('when Player stands Banker draws on 0–5 and stands on 6–9', () => {
  [true, true, true, true, true, true, false, false, false, false].forEach((draws, bankerTotal) => {
    assert.equal(Rules.bankerDraws(bankerTotal, null), draws);
  });
  assert.equal(Rules.bankerDraws(3, 0), true, 'a face card is a third card with value 0');
  assert.equal(Rules.bankerDraws(6, 0), false);
});

test('a natural on either side ends the drawing sequence immediately', () => {
  for (let playerValue = 0; playerValue <= 9; playerValue++) {
    for (let bankerValue = 0; bankerValue <= 9; bankerValue++) {
      if (playerValue < 8 && bankerValue < 8) continue;
      const player = opening(playerValue);
      const banker = opening(bankerValue);
      const result = Rules.resolveOpening(player, banker, () => assert.fail('Cannot draw after a natural'));
      assert.equal(result.natural, true);
      assert.deepEqual(result.player, player);
      assert.deepEqual(result.banker, banker);
      assert.notEqual(result.player, player);
      assert.notEqual(result.banker, banker);
      assert.equal(result.winner, playerValue === bankerValue ? 'tie' : playerValue > bankerValue ? 'player' : 'banker');
    }
  }
});

test('Player drawing hands obey every Banker table entry without changing the opening hands', () => {
  for (let playerValue = 0; playerValue <= 5; playerValue++) {
    for (let bankerValue = 0; bankerValue <= 7; bankerValue++) {
      for (let thirdValue = 0; thirdValue <= 9; thirdValue++) {
        const player = Object.freeze(opening(playerValue));
        const banker = Object.freeze(opening(bankerValue));
        const nextCards = [card(thirdValue), card(7)];
        let draws = 0;
        const result = Rules.resolveOpening(player, banker, () => nextCards[draws++]);
        const bankerDrew = BANKER_DRAW_TABLE[bankerValue][thirdValue];
        const expectedPlayer = (playerValue + thirdValue) % 10;
        const expectedBanker = (bankerValue + (bankerDrew ? 7 : 0)) % 10;
        assert.equal(result.natural, false);
        assert.equal(draws, bankerDrew ? 2 : 1);
        assert.equal(result.player.length, 3);
        assert.equal(result.banker.length, bankerDrew ? 3 : 2);
        assert.equal(result.player[2], nextCards[0], 'Player draws first');
        if (bankerDrew) assert.equal(result.banker[2], nextCards[1]);
        assert.equal(result.winner, expectedPlayer === expectedBanker ? 'tie' : expectedPlayer > expectedBanker ? 'player' : 'banker');
        assert.deepEqual(player, opening(playerValue));
        assert.deepEqual(banker, opening(bankerValue));
      }
    }
  }
});

test('Player stands on 6 and 7; Banker draws only on 0–5', () => {
  for (const playerValue of [6, 7]) {
    for (let bankerValue = 0; bankerValue <= 7; bankerValue++) {
      let draws = 0;
      const result = Rules.resolveOpening(opening(playerValue), opening(bankerValue), () => {
        draws++;
        return card(4);
      });
      assert.equal(result.player.length, 2);
      assert.equal(result.banker.length, bankerValue <= 5 ? 3 : 2);
      assert.equal(draws, bankerValue <= 5 ? 1 : 0);
    }
  }
});

test('payouts include the stake and charge 5% commission only on Banker profit', () => {
  assert.equal(Rules.payout(500, 'player', 'player'), 1000);
  assert.equal(Rules.payout(500, 'banker', 'banker'), 975);
  assert.equal(Rules.payout(500, 'player', 'banker'), 0);
  assert.equal(Rules.payout(500, 'banker', 'player'), 0);
  assert.equal(Rules.payout(500, 'player', 'tie'), 500);
  assert.equal(Rules.payout(500, 'banker', 'tie'), 500);
  assert.equal(Rules.payout(501, 'banker', 'banker'), 976.95);
  assert.equal(Rules.payout(0, 'banker', 'banker'), 0);
});

test('Tie bets pay 8:1 profit plus the original stake and lose when either side wins', () => {
  assert.equal(Rules.payout(500, 'tie', 'tie'), 4500);
  assert.equal(Rules.payout(500, 'tie', 'player'), 0);
  assert.equal(Rules.payout(500, 'tie', 'banker'), 0);
  assert.equal(Rules.payout(500.25, 'tie', 'tie'), 4502.25);
  assert.equal(Rules.payout(0, 'tie', 'tie'), 0);
  for (const bet of [-500, NaN, Infinity, '500']) assert.throws(() => Rules.payout(bet, 'tie', 'tie'));
  assert.throws(() => Rules.payout(500, 'tie', 'dealer'));
});

test('shoes contain exactly the right count of distinct physical cards', () => {
  for (const deckCount of [1, 6, 8]) {
    const shoe = Rules.makeShoe(deckCount);
    assert.equal(shoe.length, 52 * deckCount);
    assert.equal(new Set(shoe).size, shoe.length, 'each physical card is a distinct object');
    const counts = new Map();
    for (const current of shoe) {
      assert.match(current.rank, /^(A|[2-9]|10|J|Q|K)$/);
      assert.match(current.suit, /^[SHDC]$/);
      const key = current.rank + current.suit;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    assert.equal(counts.size, 52);
    for (const count of counts.values()) assert.equal(count, deckCount);
  }
  assert.equal(Rules.makeShoe().length, 416);
});

test('invalid game inputs fail before producing misleading outcomes', () => {
  for (const bet of [-500, NaN, Infinity, '500']) assert.throws(() => Rules.payout(bet, 'player', 'player'));
  assert.throws(() => Rules.payout(500, 'dealer', 'player'));
  assert.throws(() => Rules.payout(500, 'player', 'dealer'));
  assert.throws(() => Rules.cardValue(null));
  assert.throws(() => Rules.cardValue({ rank: '11' }));
  assert.throws(() => Rules.resolveOpening([], opening(6), () => card(1)));
  assert.throws(() => Rules.resolveOpening(opening(0), opening(0), () => undefined));
  assert.throws(() => Rules.bankerDraws(3, undefined));
  assert.throws(() => Rules.bankerDraws(10, null));
  for (const decks of [0, -1, 1.5, 9]) assert.throws(() => Rules.makeShoe(decks));
});
