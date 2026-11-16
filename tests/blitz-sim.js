// RTP simulator for Thunder Rush. Usage: node tests/blitz-sim.js [spins] [buys]
const E = require('../blitz-engine.js');
const N = +process.argv[2] || 2e6, NB = +process.argv[3] || 2e5;

function playBonus(orbRows) {
  const b = E.blzNewBonus(orbRows);
  while (true) { const r = E.blzBonusSpin(b); if (r.done) break; }
  return b;
}
let baseX = 0, bonusX = 0, trig = 0, surges = 0, golds = 0, hits = 0, maxX = 0;
for (let i = 0; i < N; i++) {
  const { grid, surged, goldCols } = E.blzRollBase();
  const p = E.blzBasePayX(grid);
  baseX += p; if (p > 0) hits++;
  if (surged) surges++; if (goldCols.length) golds++;
  let tot = p;
  if (E.blzTriggers(grid)) { trig++; const b = playBonus(E.blzOrbRows(grid)); bonusX += b.totalX; tot += b.totalX; }
  if (tot > maxX) maxX = tot;
}
let buyX = 0, doubles = 0, multis = 0, big = 0; const buys = [];
for (let i = 0; i < NB; i++) {
  const b = playBonus(E.blzBuyOrbRows());
  buyX += b.totalX; buys.push(b.totalX);
  if (b.boards.length > 1) doubles++; if (b.multiHits.length) multis++; if (b.totalX >= 100) big++;
}
buys.sort((a, b) => a - b);
const pct = q => buys[Math.floor(q * buys.length)].toFixed(1);
console.log(`spins ${N}: RTP ${((baseX + bonusX) / N * 100).toFixed(2)}%  (base ${(baseX / N * 100).toFixed(2)}%, bonus ${(bonusX / N * 100).toFixed(2)}%)`);
console.log(`hit rate ${(hits / N * 100).toFixed(2)}%  bonus 1 in ${(N / trig).toFixed(0)}  avg natural bonus ${(bonusX / trig).toFixed(1)}x  surge 1 in ${(N / surges).toFixed(0)}  gold 1 in ${(N / golds).toFixed(0)}  max ${maxX.toFixed(0)}x`);
console.log(`buy ${E.BLZ_BUY_MULT}x: avg ${(buyX / NB).toFixed(1)}x  RTP ${(buyX / NB / E.BLZ_BUY_MULT * 100).toFixed(1)}%  median ${pct(.5)}x  p90 ${pct(.9)}x  p99 ${pct(.99)}x  double ${(doubles / NB * 100).toFixed(1)}%  multi ${(multis / NB * 100).toFixed(1)}%  100x+ ${(big / NB * 100).toFixed(1)}%`);
