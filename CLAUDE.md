# Casino Web App — Project Context

## Overview
PWA casino game hosted on GitHub Pages, designed for iPhone.  
Repo: `lbwallace22-design/casino` on GitHub, branch `master`.  
Local path: `C:\Users\lbwal\OneDrive\Desktop\casino-web`

## Files
| File | Purpose |
|------|---------|
| `index.html` | Single-page shell: menu + slot lobby + game screens (blackjack, slots, roulette, mines, plinko, crash) |
| `style.css` | All styling including card, slot, slot lobby, roulette, ladder overlay, mines/plinko/crash, responsive |
| `blackjack.js` | Blackjack logic: multi-hand, insurance, split, double, card counting display. Also holds shared state (`balance`, `saveBalance`, `launchGame`, `backToMenu`, `checkAutoReset`) |
| `slot-themes.js` | Theme configs for the 5 slot machines: symbols, weights, payouts, display colors, per-theme Hold & Win / Ladder configs |
| `slots.js` | Theme-agnostic slot engine + lobby: 5×3 grid, 10 paylines, Hold & Win, Multiplier Ladder, buy features, autoplay, speed presets |
| `roulette.js` | Roulette: canvas wheel, ball physics animation, full bet board |
| `mines.js` | Mines: 5×5 grid, 1–24 mines, multiplier grows per safe pick, cash out anytime |
| `plinko.js` | Plinko: canvas peg board (12 rows), low/med/high risk tables, concurrent balls |
| `crash.js` | Crash: canvas multiplier curve, cash out before crash, auto cash-out, history chips |
| `sw.js` | Service worker for offline PWA caching (bump `CACHE_NAME` version on every change!) |
| `manifest.json` | PWA manifest |
| `icon-192.png` / `icon-512.png` | App icons |

## Shared State
- `balance` — global var (declared in `blackjack.js`), shared across all games
- `saveBalance()` — persists balance to localStorage (`casino-balance`); called from every game's `update*Balance()`. Loaded on startup in `blackjack.js`; values below $500 start fresh at $5,000.
- `checkAutoReset()` — resets balance to $5,000 when below $500 (in `blackjack.js`)
- `backToMenu()` — navigation helper (in `blackjack.js`)
- `launchGame(name)` — shows the right screen, calls init (in `blackjack.js`); `'slots'` opens the slot lobby
- Each game has its own `init*()` function called on launch

## Slot Machine Key Details
- **5 themed machines** share one engine (`slots.js`); all machine-specific config lives in `slot-themes.js` (`SLOT_THEMES` / `SLOT_THEME_ORDER`)
- **Lobby**: `initSlotLobby()` renders machine cards (thumb, tagline, risk dots, features, per-machine stats); `launchSlotMachine(id)` activates a theme; `backToSlotLobby()` returns (blocked mid-spin/bonus)
- **Machines**: Vegas Classic (medium, Hold&Win + Ladder — the original, payouts unchanged), Fruity Spins (low volatility, no bonuses, wild-heavy), Pirate's Treasure (medium, Hold&Win), Egyptian Gold (med-high, Hold&Win, richer coins), Space Odyssey (high volatility, 5x ALN = 2000x, Cosmic Ladder to 2500x)
- **Special symbol IDs**: `WLD` (wild), `BNS` (Hold & Win coin), `CRN` (ladder scatter) are engine-reserved; other IDs are theme-local. `wildTopSym` = payout for an all-wild line.
- **Hold & Win**: `trigger`+ BNS starts it. Coins lock, empty cells re-spin. New coin resets spins. Grand bonus (`grand`) for full grid. Per-theme coin pool/trigger/buy cost.
- **Multiplier Ladder**: 3+ CRN triggers. Pick 1-of-3 tiles to climb. Per-theme levels/scatter pays/buy cost. CRN only spawns on the theme's `ladder.reels` (cols 0, 2, 4).
- **Tease animations**: 2 crowns or trigger−1 coins → golden pulse + slow last reel + "So close!" msg (only for features the theme has)
- **Per-machine stats** persisted to localStorage (`casino-slot-stats`), keyed by theme id; shown on lobby cards
- **Paytable**: generated per theme by `buildPaytableHTML()`
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

## Style Notes — "Neon Vegas" design system (v17+)
- All theming is token-driven via CSS variables in `:root` of `style.css` — change tokens, retheme everything
- Background: cinematic dark gradient `#0a0a18 → #05050e` + fixed ambient neon glow blobs (`body::before`)
- Brand: primary `#7c3aed` (neon purple), accent `#f43f5e` (rose), gold `#ffc940` (money/balance/wins)
- Surfaces: glass `rgba(255,255,255,0.04)` with hairline borders; radius 16px; ease `cubic-bezier(0.16,1,0.3,1)`
- Fonts: Fredoka (display/buttons) + Nunito (body) via Google Fonts `@import`
- JS inline styles reference tokens: slot cells use `var(--cell-bg)`, `var(--cell-border)`, `var(--cell-border-landed)`
- `prefers-reduced-motion` respected (kills animations)
- User prefers modern, cartoony, bouncy animations
- Mobile-first: designed for iPhone, responsive at 480px breakpoint
- AVOID: infinite `filter` animations (wedges compositor/screenshots); pure `#000` backgrounds

## Preview Gotchas
- The service worker serves cache-first: after CSS/JS edits, unregister SW + clear caches in the preview
  (`navigator.serviceWorker.getRegistrations()` + `caches.keys()`) or the old files keep loading
- NEVER regex-replace this project's JS with PowerShell `Get-Content`/`Set-Content` — it corrupts the
  emoji/box-drawing UTF-8 chars. Use the Edit tool.
