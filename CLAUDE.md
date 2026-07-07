# Casino Web App — Project Context

## Overview
PWA casino game hosted on GitHub Pages, designed for iPhone.  
Repo: `lbwallace22-design/casino` on GitHub, branch `master`.  
Local path: `C:\Users\lbwal\OneDrive\Desktop\casino-web`

## Files
| File | Purpose |
|------|---------|
| `index.html` | Single-page shell: menu + 6 game screens (blackjack, slots, roulette, mines, plinko, crash) |
| `style.css` | All styling including card, slot, roulette, ladder overlay, mines/plinko/crash, responsive |
| `blackjack.js` | Blackjack logic: multi-hand, insurance, split, double, card counting display. Also holds shared state (`balance`, `launchGame`, `backToMenu`, `checkAutoReset`) |
| `slots.js` | Slot machine: 5×3 grid, 10 paylines, Hold & Win bonus, Multiplier Ladder bonus, buy features, autoplay, speed presets |
| `roulette.js` | Roulette: canvas wheel, ball physics animation, full bet board |
| `mines.js` | Mines: 5×5 grid, 1–24 mines, multiplier grows per safe pick, cash out anytime |
| `plinko.js` | Plinko: canvas peg board (12 rows), low/med/high risk tables, concurrent balls |
| `crash.js` | Crash: canvas multiplier curve, cash out before crash, auto cash-out, history chips |
| `sw.js` | Service worker for offline PWA caching (bump `CACHE_NAME` version on every change!) |
| `manifest.json` | PWA manifest |
| `icon-192.png` / `icon-512.png` | App icons |

## Shared State
- `balance` — global var (declared in `blackjack.js`), shared across all games
- `checkAutoReset()` — resets balance to $5,000 when below $500 (in `blackjack.js`)
- `backToMenu()` — navigation helper (in `blackjack.js`)
- `launchGame(name)` — shows the right screen, calls init (in `blackjack.js`)
- Each game has its own `init*()` function called on launch

## Slot Machine Key Details
- **Symbols**: 7, BAR, CHR, BEL, DIA, LEM, ORG, WLD (wild), BNS (coin), CRN (crown)
- **Hold & Win**: 6+ BNS triggers. Coins lock, empty cells re-spin. New coin resets spins to 3. Grand bonus for full grid.
- **Multiplier Ladder**: 3+ CRN triggers. Pick 1-of-3 tiles to climb (2x→1000x). Can collect early.
- **Buy features**: Hold & Win costs 100× total bet, Ladder costs 50× total bet.
- **Crown reels**: CRN only spawns on reels 1, 3, 5 (cols 0, 2, 4) via `CROWN_REELS` set
- **Tease animations**: 2 crowns or 5 coins trigger golden pulse on those cells + "So close!" msg
- **Animation**: Reels stop left-to-right with bounce/pop CSS. Big win (10x+) shakes machine.
- **Coin size**: Hold & Win coins use 2.4rem emoji, 0.75rem value text

## Roulette Key Details
- Canvas-drawn wheel with ball animation
- Integer rotations (4–6) to prevent ball teleport bug
- Ease-out deceleration: `1 - Math.pow(1 - t, 2.5)`

## Blackjack Key Details
- 1–7 simultaneous hands, per-hand or total bet mode
- Insurance prompt on dealer Ace
- Running count / true count display (hole card excluded until reveal via `holeCardCounted` flag)
- `drawCard(counted)` — pass `false` to draw without counting (used for dealer hole card)
- `countCard(card)` — count a previously uncounted card on reveal
- Show/hide double-down card option

## Mines Key Details
- 5×5 grid, `minesMultiplier(picks, mines)` = ∏ (25−i)/(25−M−i) × 0.97 house edge
- Auto cash-out when every safe tile is revealed

## Plinko Key Details
- 12 rows, 13 buckets, fair binomial path (bucket = # of rights)
- Multiplier tables per risk in `PLINKO_MULTS` (Stake-style values)
- Multiple concurrent balls; each ball locks its mult table at drop time

## Crash Key Details
- Crash point: `0.96/(1−U)` clamped to [1, 1000] → 4% instant crash, ~4% edge
- Multiplier: `e^(0.18t)` (doubles every ~3.9s); tick every 40ms
- Auto cash-out via "Auto @" input; last 10 crash points shown as chips

## Bet Input Safety
- All bet inputs are clamped (negative/zero → default). Never trust `parseInt` raw —
  a negative bet would ADD money via `balance -= bet`.

## Deployment
1. Make changes
2. Bump `CACHE_NAME` in `sw.js` (e.g., `casino-v5` → `casino-v6`)
3. Commit and push to `master`
4. GitHub Pages auto-deploys

## Style Notes
- Dark theme: `#1a1a2e` body, `#0f1a30` slot cells
- Gold accent: `#f0c040`
- User prefers modern, cartoony, bouncy animations
- Mobile-first: designed for iPhone, responsive at 480px breakpoint
