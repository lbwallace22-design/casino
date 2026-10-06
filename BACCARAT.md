# Baccarat squeeze table

Open **Baccarat · Squeeze Table** from the casino menu. The game shares the existing local coin balance.

## Playing

- Start with a 500-coin wager. Add chips of 500, 1,000, 2,500 or 5,000; Undo removes the last chip and Clear empties the wager.
- Back Player, Banker or Tie. Player and Banker bets let you peel that hand. With a Tie bet, choose which hand to peel.
- Deal locks the wager, side and navigation. The opposite opening hand appears face up; your cards stay hidden, including their total.
- Drag upward on a card to bend its lower edge. Release early to put it back or drag through the threshold to reveal it. Enter/Space and **Reveal my cards** offer alternatives.
- Player and Banker draw third cards automatically in order. Any third card in your chosen hand can also be peeled.
- Reloading during a hand resumes the same cards and wager without another debit. The settlement journal prevents a second credit if reloading interrupts wallet writes.

## Rules and returns

Eight shuffled decks are used. Aces count as 1, tens and face cards as 0, and hand totals use the last digit. An opening 8 or 9 on either side ends drawing. Otherwise Player draws on 0–5; Banker follows the standard third-card table.

| Wager | Profit on a win | Total returned for a 500 wager |
|---|---:|---:|
| Player | 1:1 | 1,000 |
| Banker | 0.95:1 after 5% commission | 975 |
| Tie | 8:1 | 4,500 |

Player and Banker wagers return their stake on a tie. Tie wagers lose when either side wins. After settlement, a balance below 500 receives the casino's existing refill to 5,000; a balance of exactly 500 is retained.

The drawing table follows the [MGM National Harbor baccarat guide](https://static.mgmresorts.com/content/dam/MGM/mgm-national-harbor/casino/table-games/gaming-guides/mgm-national-harbor-casino-table-games-baccarat-royal-9.pdf). Standard Banker commission is described in [MGM's guide to baccarat](https://www.mgmresorts.com/en/gamesense/guide-to-baccarat.html).

## Validation

Run `node --test tests/baccarat-rules.test.js` with Node.js. Tests cover every Banker third-card table entry, naturals, Player stand/draw sequences, shoe composition and all three wager types.

Browser validation additionally covered minimum/maximum wagers, chip controls, both peel sides, pointer/keyboard reveal, early release, third cards, duplicate clicks, wallet and fallback timing, pending/settled reloads, Tie wager recovery, responsive layouts, and offline play beneath `/casino/`.

All game assets are local. The service worker and manifest use relative paths so GitHub Pages subdirectory hosting can cache the table correctly. No build step is required.
