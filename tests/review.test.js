/* Test della revisione: accuratezza, classificazione, rating, diagnosi cause. */
const { Chess } = require('../js/chess-core.js');
const E = require('../js/engine.js');
require('../js/coach.js');
require('../js/openings.js');
const R = require('../js/review.js');

let fail = 0;
function check(label, cond, extra) {
  if (cond) console.log('OK   ' + label);
  else { fail++; console.log('FAIL ' + label + (extra ? ' -> ' + String(extra).slice(0, 220) : '')); }
}

// ---------------------------------------------------------------- win% e accuratezza
check('win% pari a 0 centipedoni = 50%', Math.abs(R.winPercent(0) - 50) < 0.01);
check('win% cresce col vantaggio', R.winPercent(300) > R.winPercent(100) && R.winPercent(100) > 50);
check('win% simmetrica', Math.abs(R.winPercent(250) + R.winPercent(-250) - 100) < 0.01);
check('win% matto = 100%', R.winPercent(E.MATE - 5) === 100 && R.winPercent(-E.MATE + 5) === 0);
check('mossa perfetta ~100% di accuratezza', R.moveAccuracy(0) >= 99, R.moveAccuracy(0));
check('errore grave = accuratezza bassa', R.moveAccuracy(40) < 25, R.moveAccuracy(40));
check('accuratezza di partita fra 0 e 100', (() => {
  const a = R.gameAccuracy([100, 90, 80, 20]);
  return a > 20 && a < 100;
})(), R.gameAccuracy([100, 90, 80, 20]));
check('partita perfetta ~100%', R.gameAccuracy([100, 100, 100]) >= 99);
check('la media armonica punisce il singolo disastro',
  R.gameAccuracy([100, 100, 100, 0.5]) < R.gameAccuracy([80, 80, 80, 80]),
  R.gameAccuracy([100, 100, 100, 0.5]) + ' vs ' + R.gameAccuracy([80, 80, 80, 80]));

// ------------------------------------------------------------------ rating stimato
const r50 = R.estimateRating(50, {}, 30);
const r70 = R.estimateRating(70, {}, 30);
const r90 = R.estimateRating(90, {}, 30);
check('rating cresce con l\'accuratezza', r50 < r70 && r70 < r90, `${r50} ${r70} ${r90}`);
check('rating in un intervallo plausibile', r50 >= 300 && r50 <= 700 && r90 >= 1500 && r90 <= 2000, `${r50} / ${r90}`);
check('gli errori gravi abbassano il rating',
  R.estimateRating(70, { grave: 4 }, 30) < R.estimateRating(70, {}, 30));

// --------------------------------------------------------------- libro teorico
check('riconosce la teoria dopo 1.e4 e5 2.Nf3 Nc6 3.Bc4',
  /Italiana|Due Cavalli/.test(R.bookNameFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 4) || ''),
  R.bookNameFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 4));
check('riconosce la Caro-Kann', R.bookNameFor(['e4', 'c6', 'd4', 'd5'], 3) === 'Difesa Caro-Kann',
  R.bookNameFor(['e4', 'c6', 'd4', 'd5'], 3));
check('fuori libro non è teoria', R.bookNameFor(['e4', 'e5', 'Nf3', 'Nc6', 'Ba6'], 4) === null);

// --------------------------------------------------- analisi di una partita vera
{
  // il nero cade nel matto del barbiere: 4...Nf6?? permette 5.Qxf7#
  const sans = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
  const t0 = Date.now();
  const an = R.createAnalysis({ startFen: undefined, sans, depth: 4, timeMs: 250 }).runAll();
  const dt = Date.now() - t0;
  check(`analisi di 7 semimosse completata in ${dt}ms`, an.done && an.moves.length === 7, an.moves.length);
  check('ogni mossa ha classe e accuratezza', an.moves.every(m => m.info && typeof m.accuracy === 'number'));
  const blunder = an.moves.find(m => m.san === 'Nf6');
  check('4...Nf6?? classificata come errore grave', blunder.classe === 'grave',
    blunder.classe + ' delta=' + blunder.delta.toFixed(1));
  check('la mossa migliore e la perdita sono coerenti',
    an.moves.every(m => (m.migliore && R.CLASSES[m.classe]) && (m.delta === 0 || m.migliore !== m.san) ),
    an.moves.map(m => m.san + ':' + m.delta.toFixed(1)).join(' '));
  check('le prime mosse sono riconosciute come teoria', !!an.moves[0].libro && an.moves[4].classe === 'libro',
    an.moves[0].libro + ' / ' + an.moves[4].classe);
  check('riepilogo per entrambi i colori', an.riepilogo.w.accuratezza > 0 && an.riepilogo.b.accuratezza > 0,
    JSON.stringify({ w: an.riepilogo.w.accuratezza, b: an.riepilogo.b.accuratezza }));
  check('il bianco ha accuratezza maggiore del nero', an.riepilogo.w.accuratezza > an.riepilogo.b.accuratezza,
    an.riepilogo.w.accuratezza + ' vs ' + an.riepilogo.b.accuratezza);
  check('i momenti chiave includono l\'errore', an.momenti.some(m => m.san === 'Nf6'),
    an.momenti.map(m => m.san).join(' '));
  check('valutazione lato bianco coerente', an.moves[an.moves.length - 1].scoreBianco > 0,
    an.moves[an.moves.length - 1].scoreBianco);
  check('la mossa migliore alternativa è indicata', an.moves.every(m => m.migliore === null || typeof m.migliore === 'string'));
  const causa = blunder.causa;
  check('diagnosi della causa presente', !!causa, causa);
}

// ------------------------------------------------------- diagnosi: pezzo in presa
{
  // la torre si muove proprio dove il pedone nero la cattura
  const fen = '4k3/8/8/1p6/8/8/8/R3K3 w - - 0 1';
  const g = new Chess(fen);
  const after = (() => { const p = new Chess(fen); p.move('Ra4'); return E.analyze(p, { depth: 3, timeMs: 300 }); })();
  const before = E.analyze(g, { depth: 3, timeMs: 300 });
  check('riconosce il pezzo mosso in presa', R.diagnose(fen, 'Ra4', after, before, 10) === 'pezzo-indifeso',
    R.diagnose(fen, 'Ra4', after, before, 10));
}
{
  // un pezzo era gia minacciato e il bianco gioca altrove
  const fen = '3rk3/8/8/8/3N4/8/8/4K2R w - - 0 1';   // la torre nera minaccia gia il cavallo d4
  const g = new Chess(fen);
  const after = (() => { const p = new Chess(fen); p.move('Rh5'); return E.analyze(p, { depth: 3, timeMs: 300 }); })();
  const before = E.analyze(g, { depth: 3, timeMs: 300 });
  check('riconosce la minaccia ignorata', R.diagnose(fen, 'Rh5', after, before, 10) === 'minaccia-ignorata',
    R.diagnose(fen, 'Rh5', after, before, 10));
}

// ------------------------------------------------------ diagnosi: cattura perdente
{
  // il bianco cattura un pedone difeso due volte
  const fen = '4k3/1p6/p1p5/8/8/8/8/Q3K3 w - - 0 1';
  const g = new Chess(fen);
  const before = E.analyze(g, { depth: 3, timeMs: 300 });
  const p = new Chess(fen); p.move('Qxa6');
  const after = E.analyze(p, { depth: 3, timeMs: 300 });
  const causa = R.diagnose(fen, 'Qxa6', after, before, 10);
  check('riconosce la cattura che perde materiale', causa === 'cattura-sbagliata', causa);
}

// --------------------------------------------------- abitudini: arrocco rimandato
{
  const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'd6', 'Nc3', 'Nf6', 'Bg5', 'h6',
    'Bh4', 'g5', 'Bg3', 'Qe7', 'a3', 'a6', 'h3', 'Bd7'];
  const h = R.openingHabits(undefined, sans, 0);
  check('rileva l\'arrocco rimandato', h.indexOf('arrocco-tardi') >= 0, JSON.stringify(h));
}
{
  const sans = ['e4', 'e5', 'Qh5', 'Nc6', 'Qf3', 'Nf6', 'Bc4', 'd5', 'Bxd5', 'Nxd5', 'exd5', 'Nd4'];
  const h = R.openingHabits(undefined, sans, 0);
  check('rileva la donna fuori troppo presto', h.indexOf('donna-presto') >= 0, JSON.stringify(h));
}

// ------------------------------------------------------ piano di allenamento
{
  const plan = R.trainingPlan({ 'pezzo-indifeso': 5, 'forchetta-subita': 2, 'calcolo': 9, 'arrocco-tardi': 1 }, 3);
  check('il piano ordina per frequenza', plan[0].causa === 'calcolo' && plan[1].causa === 'pezzo-indifeso',
    plan.map(p => p.causa).join(' '));
  check('ogni voce del piano ha titolo e consiglio', plan.every(p => p.info.titolo && p.info.consiglio));
}

// -------------------------------------------- analisi a blocchi (come in pagina)
{
  const an = R.createAnalysis({ sans: ['e4', 'e5', 'Nf3', 'Nc6'], depth: 2, timeMs: 100 });
  let giri = 0;
  while (!an.step()) { giri++; if (giri > 50) break; }
  check('l\'analisi a blocchi termina e produce risultati', an.done && an.moves.length === 4 && an.progress() === 1,
    `giri=${giri} mosse=${an.moves.length}`);
}

console.log(fail === 0 ? '\nTUTTI I TEST SUPERATI' : `\n${fail} TEST FALLITI`);
process.exit(fail ? 1 : 0);
