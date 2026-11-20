/* Test del motore di gioco: tattica, matti, valutazione, velocita. */
const { Chess, WHITE, BLACK } = require('../js/chess-core.js');
const E = require('../js/engine.js');

let fail = 0;
function check(label, cond, extra) {
  if (cond) console.log('OK   ' + label);
  else { fail++; console.log('FAIL ' + label + (extra ? ' -> ' + extra : '')); }
}

function hasMateIn1(g) {
  return g.legalMoves().some(m => {
    g.makeMoveFast(m); const mate = g.isCheckmate(); g.undoMoveFast(); return mate;
  });
}

// --- matti in 1: il motore deve dare matto
const mates = [
  ['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'matto di corridoio con la torre'],
  ['7k/6pp/8/8/8/8/5QPP/6K1 w - - 0 1', 'matto con la donna in f8'],
  ['k7/7R/1K6/8/8/8/8/8 w - - 0 1', 'matto re+torre'],
  ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'matto del barbiere']
];
for (const [fen, name] of mates) {
  const g = new Chess(fen);
  check('esiste un matto in 1: ' + name, hasMateIn1(g));
  const res = E.analyze(g, { depth: 3, timeMs: 1500 });
  g.makeMoveFast(res.best);
  check('il motore trova il matto: ' + name, g.isCheckmate(), res.bestSan);
  g.undoMoveFast();
}

// --- coerenza del punteggio: torre in piu = netto vantaggio
{
  const g = new Chess('6k1/6pp/8/8/8/8/5PPP/4R1K1 w - - 0 1');
  const res = E.analyze(g, { depth: 4, timeMs: 2000 });
  check('una torre in piu vale almeno +4', res.score > 400, E.scoreToText(res.score));
}
// --- posizione davvero pari
{
  const g = new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 6 4');
  const res = E.analyze(g, { depth: 4, timeMs: 2000 });
  check('posizione simmetrica valutata quasi pari', Math.abs(res.score) < 120, E.scoreToText(res.score));
}

// --- tattica: cattura semplice del pezzo gratis
{
  const g = new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
  const res = E.analyze(g, { depth: 3, timeMs: 1000 });
  check('prende la donna gratis (exd5)', res.bestSan === 'exd5', res.bestSan);
}

// --- tattica: forchetta di cavallo che vince la torre
{
  const g = new Chess('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1');
  const res = E.analyze(g, { depth: 4, timeMs: 2500 });
  check('trova la forchetta Nc7+', res.bestSan === 'Nc7+', res.bestSan);
}

// --- tattica: non regalare la donna (deve salvarla)
{
  const g = new Chess('4k3/8/8/8/8/5n2/6Q1/4K3 w - - 0 1'); // Ng3 attacca? il cavallo f3 attacca g1,e1,d2,d4,e5,g5,h4,h2
  const res = E.analyze(g, { depth: 3, timeMs: 1000 });
  check('non lascia la donna in presa', res.score > -300, E.scoreToText(res.score));
}

// --- pezzi in presa
{
  const g = new Chess('4k3/8/8/3n4/4P3/8/8/4K3 b - - 0 1');
  const hang = E.hangingPieces(g, BLACK);
  check('rileva il cavallo in presa in d5', hang.length === 1 && hang[0].square === 'd5' && hang[0].loss >= 300,
    JSON.stringify(hang));
}
{
  const g = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  check('nessun pezzo in presa nella posizione iniziale',
    E.hangingPieces(g, WHITE).length === 0 && E.hangingPieces(g, BLACK).length === 0);
}
{
  // cavallo difeso attaccato da un pedone: comunque perdente materialmente
  const g = new Chess('4k3/8/2p5/3n4/4P3/8/8/4K3 b - - 0 1');
  const hang = E.hangingPieces(g, BLACK);
  check('cavallo difeso ma attaccato da pedone = perdita materiale', hang.some(h => h.square === 'd5'),
    JSON.stringify(hang));
}

// --- valutazione simmetrica
{
  const a = E.evaluate(new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  check('posizione iniziale ~ pari', Math.abs(a) < 20, String(a));
  const b = E.evaluate(new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1'));
  check('bianco senza torre e in svantaggio', b < -400, String(b));
}

// --- giudizio delle mosse
{
  const g = new Chess();
  const before = E.analyze(g, { depth: 3, timeMs: 600 });
  g.move('e4');
  const after = E.analyze(g, { depth: 3, timeMs: 600 });
  const loss = before.score - (-after.score);
  check('1.e4 giudicata buona o migliore', E.judgeLoss(Math.max(0, loss)).max <= 110,
    'perdita ' + loss + ' -> ' + E.judgeLoss(Math.max(0, loss)).label);
}
{
  const g = new Chess();
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'].forEach(s => g.move(s));
  const before = E.analyze(g, { depth: 3, timeMs: 800 });
  g.move('Qh4');    // regala la donna
  const after = E.analyze(g, { depth: 3, timeMs: 800 });
  const loss = before.score - (-after.score);
  check('regalare la donna = errore grave', E.judgeLoss(Math.max(0, loss)).key === 'blunder',
    'perdita ' + loss + ' -> ' + E.judgeLoss(Math.max(0, loss)).label);
}

// --- livelli e velocita
for (const lv of E.LEVELS) {
  const g = new Chess();
  const t0 = Date.now();
  let ok = true;
  for (let i = 0; i < 6 && !g.isGameOver(); i++) {
    const mv = E.chooseMove(g, lv.id);
    if (!mv || !g.move(mv.move)) { ok = false; break; }
  }
  const dt = Date.now() - t0;
  check(`livello ${lv.id} (${lv.name}) gioca 6 mosse in ${dt}ms`, ok && dt < 20000, g.historySan().join(' '));
}

// --- partita completa motore contro motore: nessun crash, finale coerente
{
  const g = new Chess();
  let moves = 0;
  while (!g.isGameOver() && moves < 160) {
    const mv = E.chooseMove(g, moves % 2 === 0 ? 4 : 3);
    if (!mv) break;
    if (!g.move(mv.move)) { break; }
    moves++;
  }
  const r = g.gameResult();
  check('partita motore vs motore completata (' + moves + ' mosse, ' + (r.reason || 'in corso') + ')', moves > 10);
}

// --- tempo di analisi per i suggerimenti
{
  const g = new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  const t0 = Date.now();
  const res = E.analyze(g, { depth: 4, timeMs: 1200 });
  const dt = Date.now() - t0;
  check('analisi profondita 4 entro 2s (' + dt + 'ms, prof. ' + res.depth + ', ' + res.nodes + ' nodi)',
    dt < 2500 && res.bestSan, res.bestSan + ' ' + E.scoreToText(res.score));
  check('variante principale di almeno 3 mosse', res.pvSan.length >= 3, res.pvSan.join(' '));
}

console.log(fail === 0 ? '\nTUTTI I TEST SUPERATI' : `\n${fail} TEST FALLITI`);
process.exit(fail ? 1 : 0);
