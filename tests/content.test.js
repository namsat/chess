/* Verifica che ogni linea di apertura, trappola, errore comune e finale sia legale. */
const { Chess } = require('../js/chess-core.js');
const O = require('../js/openings.js');

let fail = 0;
function bad(msg) { fail++; console.log('FAIL ' + msg); }

function checkLine(entry, kind) {
  const g = new Chess();
  entry.moves.forEach((m, i) => {
    const res = g.move(m.san);
    if (!res) {
      bad(`${kind} "${entry.name}": mossa ${i + 1} "${m.san}" illegale. Posizione: ${g.fen()} | legali: ${g.moves().slice(0, 14).join(' ')}`);
      throw new Error('stop');
    }
    const expectedSide = i % 2 === 0 ? 'w' : 'b';
    if (res.color !== expectedSide) bad(`${kind} "${entry.name}": alternanza dei colori sbagliata alla mossa ${i + 1}`);
  });
  // ogni mossa "mia" deve appartenere al lato dichiarato
  const myParity = entry.side === 'w' ? 0 : 1;
  entry.moves.forEach((m, i) => {
    if (m.key && i % 2 !== myParity && kind === 'Apertura') {
      // nota: una mossa chiave può essere anche dell'avversario, non è un errore
    }
  });
  return true;
}

function checkMistakes(entry, kind) {
  (entry.mistakes || []).forEach(ms => {
    const g = new Chess();
    for (let i = 0; i < ms.after; i++) {
      if (!g.move(entry.moves[i].san)) { bad(`${kind} "${entry.name}": prefisso non giocabile per l'errore ${ms.san}`); return; }
    }
    if (!g.move(ms.san)) {
      bad(`${kind} "${entry.name}": errore comune "${ms.san}" non legale dopo ${ms.after} semimosse (${g.fen()}) | legali: ${g.moves().slice(0, 16).join(' ')}`);
    }
  });
}

console.log('--- Aperture');
for (const op of O.OPENINGS) {
  try {
    checkLine(op, 'Apertura');
    checkMistakes(op, 'Apertura');
    console.log(`OK   ${op.name} (${op.moves.length} semimosse, lato ${op.side})`);
  } catch (e) { if (e.message !== 'stop') throw e; }
}

console.log('--- Trappole');
for (const tr of O.TRAPS) {
  try {
    checkLine(tr, 'Trappola');
    checkMistakes(tr, 'Trappola');
    console.log(`OK   ${tr.name} (${tr.moves.length} semimosse)`);
  } catch (e) { if (e.message !== 'stop') throw e; }
}

console.log('--- Finali');
for (const eg of O.ENDGAMES) {
  const g = new Chess();
  if (!g.load(eg.fen)) { bad(`Finale "${eg.name}": FEN non valida`); continue; }
  if (g.legalMoves().length === 0) { bad(`Finale "${eg.name}": nessuna mossa legale`); continue; }
  if (g.turnColor() !== eg.side) bad(`Finale "${eg.name}": tocca a ${g.turnColor()} ma side=${eg.side}`);
  console.log(`OK   ${eg.name} (${g.legalMoves().length} mosse legali)`);
}

// l'ultima mossa della trappola di Legal e del matto in 2 deve essere matto
for (const id of ['legal', 'matto-matto']) {
  const tr = O.TRAPS.find(t => t.id === id);
  const g = new Chess();
  tr.moves.forEach(m => g.move(m.san));
  if (!g.isCheckmate()) bad(`Trappola "${tr.name}": la linea non finisce in scacco matto (${g.fen()})`);
  else console.log(`OK   "${tr.name}" finisce con scacco matto`);
}

console.log(fail === 0 ? '\nTUTTI I CONTENUTI VALIDI' : `\n${fail} PROBLEMI DI CONTENUTO`);
process.exit(fail ? 1 : 0);
