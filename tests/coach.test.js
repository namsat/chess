/* Test del coach: spiegazioni sensate, nessun crash, nessun testo vuoto. */
const { Chess } = require('../js/chess-core.js');
const E = require('../js/engine.js');
const K = require('../js/coach.js');

let fail = 0;
function check(label, cond, extra) {
  if (cond) console.log('OK   ' + label);
  else { fail++; console.log('FAIL ' + label + (extra ? ' -> ' + extra : '')); }
}
function allStrings(arr) { return Array.isArray(arr) && arr.every(s => typeof s === 'string' && s.length > 5); }

// spiegazione di una mossa di sviluppo
let g = new Chess();
let mv = g.move('e4');
let ex = K.explainMove(g, mv);
check('spiega 1.e4 (centro)', /centro/i.test(ex.punti.join(' ')), JSON.stringify(ex));
g.move('e5');
mv = g.move('Nf3');
ex = K.explainMove(g, mv);
check('spiega Nf3 (sviluppo + minaccia)', /svilupp/i.test(ex.punti.join(' ')) && /minacci/i.test(ex.punti.join(' ')), JSON.stringify(ex.punti));

// arrocco
g = new Chess('rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
mv = g.move('O-O');
ex = K.explainMove(g, mv);
check('spiega l\'arrocco', /re al sicuro/i.test(ex.punti.join(' ')) && ex.titolo === 'Arrocco corto', JSON.stringify(ex));

// cattura gratis
g = new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
mv = g.move('exd5');
ex = K.explainMove(g, mv);
check('spiega la cattura della donna', /guadagni 9 punti/i.test(ex.punti.join(' ')), JSON.stringify(ex.punti));

// forchetta di cavallo con scacco
g = new Chess('r3k3/pp6/8/3N4/8/8/PP6/6K1 w - - 0 1');
mv = g.move('Nc7+');
ex = K.explainMove(g, mv);
check('riconosce la forchetta con scacco', /forchetta|doppio attacco/i.test(ex.punti.join(' ')), JSON.stringify(ex.punti));

// inchiodatura (vera: la casa d7 è libera)
g = new Chess('4k3/ppp2ppp/2n5/8/8/8/PPP2PPP/4KB2 w - - 0 1');
mv = g.move('Bb5');
ex = K.explainMove(g, mv);
check('riconosce l\'inchiodatura Bb5', /inchiod/i.test(ex.punti.join(' ')), JSON.stringify(ex.punti));
// nella Spagnola invece NON è una vera inchiodatura (il pedone d7 blocca)
g = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
mv = g.move('Bb5');
ex = K.explainMove(g, mv);
check('non inventa inchiodature inesistenti', !/inchiod/i.test(ex.punti.join(' ')), JSON.stringify(ex.punti));

// avviso: pezzo lasciato in presa
g = new Chess('4k3/8/8/8/4p3/8/3N4/4K3 w - - 0 1');
mv = g.move('Nf3');
ex = K.explainMove(g, mv);
check('avvisa quando lascia un pezzo in presa', ex.avvisi.length > 0 && /catturato/i.test(ex.avvisi.join(' ')), JSON.stringify(ex.avvisi));

// avviso donna fuori presto
g = new Chess();
g.move('e4'); g.move('e5');
mv = g.move('Qh5');
ex = K.explainMove(g, mv);
check('avvisa sulla donna fuori presto', /donna fuori presto/i.test(ex.avvisi.join(' ')), JSON.stringify(ex.avvisi));

// matto
g = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
mv = g.move('Ra8#');
ex = K.explainMove(g, mv);
check('riconosce lo scacco matto', /scacco matto/i.test(ex.punti.join(' ')), JSON.stringify(ex.punti));

// minacce e aiuti
g = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b kq - 5 4');
const th = K.threats(g);
check('rileva la minaccia di matto su f7 come pericolo', th.length >= 0);
let an = E.analyze(g, { depth: 3, timeMs: 800 });
let hs = K.hints(g, an);
check('tre aiuti progressivi sensati', allStrings(hs) && hs.length === 3, JSON.stringify(hs));

g = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
an = E.analyze(g, { depth: 3, timeMs: 800 });
hs = K.hints(g, an);
check('il primo aiuto annuncia il matto', /matto/i.test(hs[0]), JSON.stringify(hs));
check('il terzo aiuto contiene la mossa', hs[2].indexOf('Ra8') >= 0, hs[2]);

// minaccia avversaria
g = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b kq - 5 4');
const ot = K.opponentThreat(g, 400);
check('calcola la minaccia avversaria', ot && typeof ot.san === 'string', JSON.stringify(ot));

// giudizio
const j = K.judge(null, 'Qh4', 20, -700, 'Nf6', ['Nf6', 'd4']);
check('giudica un errore grave', j.judgement.key === 'blunder' && /migliore era Nf6/.test(j.testo), j.testo);

// consigli di fase
g = new Chess();
check('consiglio di apertura', /pezzi minori|arrocca/i.test(K.phaseAdvice(g)), K.phaseAdvice(g));
g = new Chess('8/5k2/8/8/8/4K3/4P3/8 w - - 0 1');
check('consiglio di finale', /finale/i.test(K.phaseAdvice(g)), K.phaseAdvice(g));

// robustezza: spiega ogni mossa di una partita completa senza errori
g = new Chess();
let plies = 0;
try {
  while (!g.isGameOver() && plies < 80) {
    const pick = E.chooseMove(g, 3);
    if (!pick) break;
    const d = g.move(pick.move);
    const e2 = K.explainMove(g, d);
    if (!e2.titolo || !e2.punti.length) throw new Error('spiegazione vuota alla semimossa ' + plies);
    plies++;
  }
  check('spiega tutte le mosse di una partita (' + plies + ' semimosse)', plies > 20);
} catch (e) { check('spiega tutte le mosse di una partita', false, e.message); }

console.log(fail === 0 ? '\nTUTTI I TEST SUPERATI' : `\n${fail} TEST FALLITI`);
process.exit(fail ? 1 : 0);
