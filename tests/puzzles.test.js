/* Verifica ogni puzzle: posizione valida, soluzione legale, e il motore
   conferma che la prima mossa della soluzione è la migliore. */
const { Chess } = require('../js/chess-core.js');
const E = require('../js/engine.js');
const P = require('../js/puzzles.js');

let fail = 0;

function buildGame(p) {
  const g = new Chess();
  if (p.fen) {
    if (!g.load(p.fen)) throw new Error('FEN non valida');
  } else if (p.setup) {
    for (const san of p.setup) {
      if (!g.move(san)) throw new Error(`setup: mossa "${san}" illegale (${g.fen()})`);
    }
  } else throw new Error('ne fen ne setup');
  return g;
}

for (const p of P.PUZZLES) {
  const problems = [];
  let g;
  try { g = buildGame(p); } catch (e) { console.log(`FAIL ${p.id}: ${e.message}`); fail++; continue; }

  if (!P.TEMI[p.tema]) problems.push('tema sconosciuto: ' + p.tema);
  if (!p.hints || p.hints.length !== 3) problems.push('servono 3 aiuti');
  if (!p.lesson) problems.push('manca la lezione');

  // la soluzione deve essere interamente legale
  const probe = new Chess(g.fen());
  for (const san of p.solution) {
    if (!probe.move(san)) { problems.push(`soluzione: "${san}" illegale (${probe.fen()})`); break; }
  }

  // i matti devono finire in matto
  if (p.tema === 'matto1' || p.tema === 'matto2') {
    if (!probe.isCheckmate()) problems.push('la soluzione non finisce in scacco matto');
    const plies = p.tema === 'matto1' ? 1 : 3;
    if (p.solution.length !== plies) problems.push(`un ${p.tema} deve avere ${plies} semimosse di soluzione`);
  }

  // il motore deve essere d'accordo sulla prima mossa
  const res = E.analyze(g, { depth: 5, timeMs: 4000 });
  const accept = p.accept || [p.solution[0]];
  const norm = s => s.replace(/[+#]/g, '');
  const engineOk = accept.some(a => norm(a) === norm(res.bestSan));
  if (!engineOk) {
    // tollera una mossa alternativa equivalente entro 20 centipedoni
    const sol = res.moves.find(m => norm(m.san) === norm(p.solution[0]));
    const gap = sol ? res.moves[0].score - sol.score : Infinity;
    if (gap > 20) problems.push(`il motore preferisce ${res.bestSan} (${E.scoreToText(res.score)}) alla soluzione ${p.solution[0]}` +
      (sol ? ` [differenza ${gap}cp]` : ' [soluzione non trovata fra le mosse]'));
  }

  // il lato che risolve deve guadagnare qualcosa di concreto
  // (nelle difese si accetta anche di restare peggio: conta trovare la mossa giusta)
  const minScore = p.tema === 'difesa' ? -Infinity : (p.tema === 'trappola' ? 20 : 150);
  if (res.score < minScore) {
    problems.push(`vantaggio insufficiente dopo la soluzione: ${E.scoreToText(res.score)}`);
  }

  if (problems.length) { fail++; console.log(`FAIL ${p.id} (${p.tema}): ` + problems.join(' | ')); }
  else console.log(`OK   ${p.id.padEnd(18)} ${p.tema.padEnd(13)} ${p.solution.join(' ').padEnd(22)} motore: ${res.bestSan} ${E.scoreToText(res.score)}`);
}

console.log(`\n${P.PUZZLES.length} puzzle, ` + (fail === 0 ? 'TUTTI VALIDI' : `${fail} DA CORREGGERE`));
process.exit(fail ? 1 : 0);
