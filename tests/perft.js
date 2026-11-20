/* Test di correttezza del motore di regole: perft + prove su SAN e finali. */
const { Chess, algebraic } = require('../js/chess-core.js');

function perft(game, depth) {
  if (depth === 0) return 1;
  const moves = game.legalMoves();
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    game.makeMoveFast(m);
    n += perft(game, depth - 1);
    game.undoMoveFast();
  }
  return n;
}

const cases = [
  { name: 'posizione iniziale', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expect: [20, 400, 8902, 197281] },
  { name: 'kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expect: [48, 2039, 97862] },
  { name: 'posizione 3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expect: [14, 191, 2812, 43238] },
  { name: 'posizione 4', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expect: [6, 264, 9467] },
  { name: 'posizione 5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expect: [44, 1486, 62379] },
  { name: 'posizione 6', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    expect: [46, 2079, 89890] }
];

let failures = 0;
for (const c of cases) {
  const g = new Chess(c.fen);
  c.expect.forEach((want, i) => {
    const d = i + 1;
    const t0 = Date.now();
    const got = perft(g, d);
    const ok = got === want;
    if (!ok) failures++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name} perft(${d}) = ${got} (atteso ${want}) ${Date.now() - t0}ms`);
  });
}

// --- prove su SAN / regole specifiche
function check(label, cond) {
  if (!cond) { failures++; console.log('FAIL ' + label); }
  else console.log('OK   ' + label);
}

let g = new Chess();
check('SAN apertura e4 e5 Nf3 Nc6 Bb5', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'].every(s => g.move(s)));
check('FEN dopo Spagnola', g.fen() === 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
check('undo riporta la posizione', (() => { const f = g.fen(); g.move('a6'); g.undo(); return g.fen() === f; })());

g = new Chess();
['f3', 'e5', 'g4', 'Qh4'].forEach(s => g.move(s));
check('matto del matto riconosciuto', g.isCheckmate());
check('risultato: vince il nero', g.gameResult().winner === 'b');

g = new Chess('rnbqkbnr/pppp1ppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3');
check('nessun en passant illegale', g.moves().indexOf('exd5') === -1);

g = new Chess('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
check('en passant legale exd6', g.moves().indexOf('exd6') >= 0);
g.move('exd6');
check('en passant rimuove il pedone', g.get('d5') === null && g.get('d6') !== null);

g = new Chess('4k3/8/8/8/8/8/4P3/R3K2R w KQ - 0 1');
check('arrocchi disponibili', g.moves().indexOf('O-O') >= 0 && g.moves().indexOf('O-O-O') >= 0);
g.move('O-O-O');
check('arrocco lungo posiziona re e torre', g.get('c1').type === 'k' && g.get('d1').type === 'r');
g.undo();
g.move('O-O');
check('arrocco corto posiziona re e torre', g.get('g1').type === 'k' && g.get('f1').type === 'r');

g = new Chess('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
g.load('r3k3/8/8/8/8/8/8/4K2R w Kq - 0 1');
check('arrocco impedito se la torre e stata catturata', g.moves().indexOf('O-O-O') === -1);

g = new Chess('8/P7/8/8/8/8/8/K1k5 w - - 0 1');
check('promozioni generate', ['a8=Q', 'a8=R', 'a8=B', 'a8=N'].every(s => g.moves().indexOf(s) >= 0));
g.move('a8=N');
check('promozione a cavallo', g.get('a8').type === 'n');

g = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
check('stallo riconosciuto', g.isStalemate() && g.isDraw());

g = new Chess('8/8/8/8/8/5k2/8/5K2 w - - 0 1');
check('materiale insufficiente', g.isInsufficientMaterial());

g = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
check('matto del barbiere disponibile', g.moves().indexOf('Qxf7#') >= 0);

g = new Chess();
['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'].forEach(s => g.move(s));
check('tripla ripetizione', g.isThreefold());

g = new Chess('8/8/8/8/8/8/6k1/4R1K1 b - - 0 1');
check('il re non puo muovere in casa attaccata', g.moves().indexOf('Kf2') === -1 && g.moves().indexOf('Kf3') >= 0);

g = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
check('mossa illegale rifiutata', g.move('e5') === null);

// disambiguazione SAN
g = new Chess('8/8/8/3N1N2/8/8/8/K5k1 w - - 0 1');
check('disambiguazione per colonna', g.moves().indexOf('Nde7') >= 0 && g.moves().indexOf('Nfe7') >= 0);
g = new Chess('8/8/8/3N4/8/3N4/8/K5k1 w - - 0 1');
check('disambiguazione per traversa', g.moves().indexOf('N5f4') >= 0 || g.moves().indexOf('N3f4') >= 0);

console.log(failures === 0 ? '\nTUTTI I TEST SUPERATI' : `\n${failures} TEST FALLITI`);
process.exit(failures === 0 ? 0 : 1);
