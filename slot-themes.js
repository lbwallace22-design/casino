/* ═══════════════════════════════════════════════════════════════════
   Casino Web App — Slot Machine Themes
   Each theme is a pure config object consumed by the engine in
   slots.js. Symbol IDs 'WLD' (wild), 'BNS' (Hold & Win coin) and
   'CRN' (ladder scatter) have special meaning to the engine; every
   other ID is theme-local and only needs weights/payouts/display.
   ═══════════════════════════════════════════════════════════════════ */

const SLOT_THEME_ORDER = ['vegas', 'fruity', 'pirate', 'egypt', 'space'];

const SLOT_THEMES = {

  // ── VEGAS CLASSIC — the original machine, preserved exactly ──────
  vegas: {
    id: 'vegas',
    name: 'VEGAS CLASSIC',
    tagline: 'Hold & Win coins + the Multiplier Ladder',
    thumb: '🎰',
    accent: '#a78bfa',
    volatility: 2,
    volLabel: 'MEDIUM',
    weights: { "7":2, "BAR":4, "CHR":6, "BEL":6, "DIA":5, "LEM":7, "ORG":7, "WLD":2, "BNS":6, "CRN":2 },
    payouts: {
      "7":   {3:10, 4:50, 5:500},
      "BAR": {3:5,  4:20, 5:100},
      "DIA": {3:4,  4:15, 5:75},
      "BEL": {3:3,  4:10, 5:50},
      "CHR": {3:2,  4:8,  5:40},
      "LEM": {3:1,  4:4,  5:20},
      "ORG": {3:1,  4:4,  5:20},
    },
    wildTopSym: '7',
    display: {
      "7":   { emoji:"7️⃣",  label:"",      bg:"#3a1515", border:"#ff4444", color:"#ff4444" },
      "BAR": { emoji:"",     label:"BAR",   bg:"#2a2a2a", border:"#888",    color:"#ccc" },
      "CHR": { emoji:"🍒",  label:"",      bg:"#2a1520", border:"#cc0000", color:"#cc0000" },
      "BEL": { emoji:"🔔",  label:"",      bg:"#2a2515", border:"#f0c040", color:"#f0c040" },
      "DIA": { emoji:"💎",  label:"",      bg:"#152535", border:"#44bbff", color:"#44bbff" },
      "LEM": { emoji:"🍋",  label:"",      bg:"#2a2a15", border:"#ddee22", color:"#ddee22" },
      "ORG": { emoji:"🍊",  label:"",      bg:"#2a2015", border:"#ff8833", color:"#ff8833" },
      "WLD": { emoji:"⭐",  label:"WILD",  bg:"#2a1a00", border:"#ff6600", color:"#ff6600", mid:true },
      "BNS": { emoji:"💰",  label:"",      bg:"#2a2200", border:"#f0c040", color:"#f0c040", big:true },
      "CRN": { emoji:"👑",  label:"",      bg:"#2a1a2a", border:"#ff44ff", color:"#ff44ff", big:true },
    },
    holdWin: {
      trigger: 6, spins: 3, coinChance: 0.22, grand: 500, buyMult: 100,
      emoji: '💰', title: 'HOLD & WIN',
      scatterPays: {3:2, 4:5, 5:15},
      coinBg: '#2a2200', coinBorder: '#f0c040',
      coinPool: [
        {value:1, weight:25}, {value:2, weight:20}, {value:3, weight:15},
        {value:5, weight:12}, {value:10, weight:8}, {value:25, weight:5},
        {value:50, weight:3}, {value:100, weight:2}, {value:250, weight:1},
      ],
    },
    ladder: {
      buyMult: 50, emoji: '👑', title: 'MULTIPLIER LADDER',
      reels: [0, 2, 4],
      scatterPays: {3:3, 4:10, 5:50},
      levels: [
        { mult:2, safe:3 }, { mult:5, safe:2 }, { mult:10, safe:2 },
        { mult:25, safe:2 }, { mult:50, safe:1 }, { mult:100, safe:1 },
        { mult:250, safe:1 }, { mult:500, safe:1 }, { mult:1000, safe:0 },
      ],
    },
  },

  // ── FRUITY SPINS — low volatility, frequent small wins ───────────
  fruity: {
    id: 'fruity',
    name: 'FRUITY SPINS',
    tagline: 'Juicy little wins, over and over',
    thumb: '🍒',
    accent: '#34d399',
    volatility: 1,
    volLabel: 'LOW',
    weights: { "SEV":2, "BEL":5, "WML":6, "GRP":7, "CHR":8, "LEM":9, "ORG":9, "WLD":4 },
    payouts: {
      "SEV": {3:8, 4:25, 5:100},
      "BEL": {3:4, 4:10, 5:40},
      "WML": {3:3, 4:8,  5:25},
      "GRP": {3:2, 4:6,  5:20},
      "CHR": {3:2, 4:5,  5:15},
      "LEM": {3:1, 4:3,  5:10},
      "ORG": {3:1, 4:3,  5:10},
    },
    wildTopSym: 'SEV',
    display: {
      "SEV": { emoji:"7️⃣",  label:"",     bg:"#3a1515", border:"#ff4444", color:"#ff4444" },
      "BEL": { emoji:"🔔",  label:"",     bg:"#2a2515", border:"#f0c040", color:"#f0c040" },
      "WML": { emoji:"🍉",  label:"",     bg:"#22151a", border:"#fb7185", color:"#fb7185" },
      "GRP": { emoji:"🍇",  label:"",     bg:"#221a2e", border:"#a78bfa", color:"#a78bfa" },
      "CHR": { emoji:"🍒",  label:"",     bg:"#2a1520", border:"#cc0000", color:"#cc0000" },
      "LEM": { emoji:"🍋",  label:"",     bg:"#2a2a15", border:"#ddee22", color:"#ddee22" },
      "ORG": { emoji:"🍊",  label:"",     bg:"#2a2015", border:"#ff8833", color:"#ff8833" },
      "WLD": { emoji:"⭐",  label:"WILD", bg:"#2a1a00", border:"#ff6600", color:"#ff6600", mid:true },
    },
    holdWin: null,
    ladder: null,
  },

  // ── PIRATE'S TREASURE — medium volatility, doubloon Hold & Win ───
  pirate: {
    id: 'pirate',
    name: "PIRATE'S TREASURE",
    tagline: 'Lock doubloons for the chest of gold',
    thumb: '🏴‍☠️',
    accent: '#2dd4bf',
    volatility: 2,
    volLabel: 'MEDIUM',
    weights: { "FLG":2, "SHP":3, "KEY":5, "ANC":6, "PAR":7, "RUM":8, "WLD":2, "BNS":6 },
    payouts: {
      "FLG": {3:12, 4:60, 5:600},
      "SHP": {3:5,  4:20, 5:120},
      "KEY": {3:4,  4:12, 5:60},
      "ANC": {3:3,  4:9,  5:45},
      "PAR": {3:2,  4:6,  5:30},
      "RUM": {3:1,  4:4,  5:18},
    },
    wildTopSym: 'FLG',
    display: {
      "FLG": { emoji:"🏴‍☠️", label:"",     bg:"#1a1a22", border:"#e2e8f0", color:"#e2e8f0" },
      "SHP": { emoji:"⛵",   label:"",     bg:"#152535", border:"#44bbff", color:"#44bbff" },
      "KEY": { emoji:"🗝️",  label:"",     bg:"#2a2515", border:"#f0c040", color:"#f0c040" },
      "ANC": { emoji:"⚓",   label:"",     bg:"#1a2230", border:"#94a3b8", color:"#94a3b8" },
      "PAR": { emoji:"🦜",   label:"",     bg:"#22151a", border:"#f43f5e", color:"#f43f5e" },
      "RUM": { emoji:"🍾",   label:"",     bg:"#14261a", border:"#34d399", color:"#34d399" },
      "WLD": { emoji:"🗺️",  label:"WILD", bg:"#2a2200", border:"#ffc940", color:"#ffc940", mid:true },
      "BNS": { emoji:"🪙",   label:"",     bg:"#2a2200", border:"#f0c040", color:"#f0c040", big:true },
    },
    holdWin: {
      trigger: 6, spins: 3, coinChance: 0.22, grand: 600, buyMult: 100,
      emoji: '🪙', title: 'TREASURE HOLD',
      scatterPays: {3:2, 4:5, 5:15},
      coinBg: '#2a2200', coinBorder: '#f0c040',
      coinPool: [
        {value:1, weight:24}, {value:2, weight:20}, {value:3, weight:15},
        {value:5, weight:12}, {value:10, weight:9}, {value:25, weight:5},
        {value:50, weight:3}, {value:150, weight:2}, {value:300, weight:1},
      ],
    },
    ladder: null,
  },

  // ── EGYPTIAN GOLD — medium-high volatility, scarab Hold & Win ────
  egypt: {
    id: 'egypt',
    name: 'EGYPTIAN GOLD',
    tagline: 'Scarabs of the pharaohs pay in gold',
    thumb: '🏺',
    accent: '#ffc940',
    volatility: 3,
    volLabel: 'MED-HIGH',
    weights: { "EYE":1, "ANU":3, "COB":4, "SCR":6, "CAM":7, "PLM":8, "WLD":2, "BNS":5 },
    payouts: {
      "EYE": {3:15, 4:75, 5:750},
      "ANU": {3:6,  4:25, 5:150},
      "COB": {3:4,  4:15, 5:75},
      "SCR": {3:2,  4:8,  5:40},
      "CAM": {3:1,  4:5,  5:25},
      "PLM": {3:1,  4:3,  5:15},
    },
    wildTopSym: 'EYE',
    display: {
      "EYE": { emoji:"👁️", label:"",     bg:"#2a2410", border:"#ffc940", color:"#ffc940" },
      "ANU": { emoji:"🐺",  label:"",     bg:"#221a2e", border:"#a78bfa", color:"#a78bfa" },
      "COB": { emoji:"🐍",  label:"",     bg:"#14261a", border:"#34d399", color:"#34d399" },
      "SCR": { emoji:"🦂",  label:"",     bg:"#2a1a15", border:"#ff8833", color:"#ff8833" },
      "CAM": { emoji:"🐫",  label:"",     bg:"#262015", border:"#d4a95c", color:"#d4a95c" },
      "PLM": { emoji:"🌴",  label:"",     bg:"#16241c", border:"#4ade80", color:"#4ade80" },
      "WLD": { emoji:"🏺",  label:"WILD", bg:"#2a2200", border:"#ffc940", color:"#ffc940", mid:true },
      "BNS": { emoji:"🪲",  label:"",     bg:"#1a2612", border:"#a3e635", color:"#a3e635", big:true },
    },
    holdWin: {
      trigger: 6, spins: 3, coinChance: 0.20, grand: 750, buyMult: 120,
      emoji: '🪲', title: 'SCARAB HOLD',
      scatterPays: {3:2, 4:6, 5:20},
      coinBg: '#1a2612', coinBorder: '#a3e635',
      coinPool: [
        {value:1, weight:22}, {value:2, weight:18}, {value:3, weight:14},
        {value:5, weight:12}, {value:10, weight:9}, {value:25, weight:6},
        {value:75, weight:3}, {value:200, weight:2}, {value:500, weight:1},
      ],
    },
    ladder: null,
  },

  // ── SPACE ODYSSEY — high volatility, Cosmic Ladder to 2500x ──────
  space: {
    id: 'space',
    name: 'SPACE ODYSSEY',
    tagline: 'Long dry stretches. Alien-sized jackpots.',
    thumb: '🚀',
    accent: '#4f9cf9',
    volatility: 4,
    volLabel: 'HIGH',
    weights: { "ALN":1, "RKT":3, "PLT":5, "SAT":6, "MET":8, "MON":9, "WLD":1, "CRN":2 },
    payouts: {
      "ALN": {3:25, 4:200, 5:2000},
      "RKT": {3:8,  4:40,  5:250},
      "PLT": {3:4,  4:15,  5:80},
      "SAT": {3:2,  4:8,   5:40},
      "MET": {3:1,  4:3,   5:15},
      "MON": {3:1,  4:2,   5:10},
    },
    wildTopSym: 'ALN',
    display: {
      "ALN": { emoji:"👽",  label:"",     bg:"#14261a", border:"#4ade80", color:"#4ade80" },
      "RKT": { emoji:"🚀",  label:"",     bg:"#22151a", border:"#f43f5e", color:"#f43f5e" },
      "PLT": { emoji:"🪐",  label:"",     bg:"#2a2015", border:"#fb923c", color:"#fb923c" },
      "SAT": { emoji:"🛰️", label:"",     bg:"#1a2230", border:"#94a3b8", color:"#94a3b8" },
      "MET": { emoji:"☄️",  label:"",     bg:"#2a1a15", border:"#ff8833", color:"#ff8833" },
      "MON": { emoji:"🌙",  label:"",     bg:"#2a2515", border:"#fde047", color:"#fde047" },
      "WLD": { emoji:"🌟",  label:"WILD", bg:"#2a1a00", border:"#ffc940", color:"#ffc940", mid:true },
      "CRN": { emoji:"🛸",  label:"",     bg:"#152535", border:"#22d3ee", color:"#22d3ee", big:true },
    },
    holdWin: null,
    ladder: {
      buyMult: 60, emoji: '🛸', title: 'COSMIC LADDER',
      reels: [0, 2, 4],
      scatterPays: {3:4, 4:15, 5:75},
      levels: [
        { mult:3, safe:3 }, { mult:8, safe:2 }, { mult:15, safe:2 },
        { mult:40, safe:2 }, { mult:100, safe:1 }, { mult:250, safe:1 },
        { mult:600, safe:1 }, { mult:1200, safe:1 }, { mult:2500, safe:0 },
      ],
    },
  },
};
