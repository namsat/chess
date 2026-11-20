/*!
 * review.js — Revisione completa della partita in stile chess.com:
 * accuratezza, classificazione di ogni mossa, rating stimato, diagnosi
 * delle cause degli errori e piano di allenamento personalizzato.
 */
(function (global) {
  'use strict';

  var C = global.ChessCore || (typeof require !== 'undefined' ? require('./chess-core.js') : null);
  var E = global.ChessEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  var K = global.ChessCoach || (typeof require !== 'undefined' ? require('./coach.js') : null);
  var O = global.ChessOpenings || (typeof require !== 'undefined' ? require('./openings.js') : null);
  var Chess = C.Chess;
  var typeOf = C.typeOf, colorOf = C.colorOf, VALUE = C.VALUE, algebraic = C.algebraic;

  // ------------------------------------------------------- win% e accuratezza
  /** Probabilità di vittoria (0-100) da una valutazione in centipedoni. */
  function winPercent(cp) {
    if (cp > E.MATE - 1000) return 100;
    if (cp < -E.MATE + 1000) return 0;
    var c = Math.max(-1500, Math.min(1500, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
  }

  /** Accuratezza di una singola mossa (0-100) data la perdita in win%. */
  function moveAccuracy(deltaWin) {
    var d = Math.max(0, deltaWin);
    return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * d) - 3.1669));
  }

  /** Accuratezza di partita: media fra media aritmetica e media armonica. */
  function gameAccuracy(values) {
    if (!values.length) return 0;
    var sum = 0, hsum = 0;
    for (var i = 0; i < values.length; i++) {
      var v = Math.max(1, values[i]);
      sum += v; hsum += 1 / v;
    }
    var arith = sum / values.length;
    var harm = values.length / hsum;
    return Math.round(((arith + harm) / 2) * 10) / 10;
  }

  // --------------------------------------------------- classificazione mosse
  var CLASSES = {
    brillante:  { key: 'brillante',  label: 'Brillante',          icon: '!!', cls: 'brilliant', peso: 'ok' },
    decisiva:   { key: 'decisiva',   label: 'Mossa decisiva',     icon: '!',  cls: 'great',     peso: 'ok' },
    libro:      { key: 'libro',      label: 'Teoria',             icon: '📖', cls: 'book',      peso: 'ok' },
    migliore:   { key: 'migliore',   label: 'Migliore',           icon: '★',  cls: 'best',      peso: 'ok' },
    eccellente: { key: 'eccellente', label: 'Eccellente',         icon: '✓',  cls: 'great',     peso: 'ok' },
    buona:      { key: 'buona',      label: 'Buona',              icon: '✓',  cls: 'good',      peso: 'ok' },
    imprecisa:  { key: 'imprecisa',  label: 'Imprecisione',       icon: '?!', cls: 'inacc',     peso: 'male' },
    mancata:    { key: 'mancata',    label: 'Occasione mancata',  icon: '✗',  cls: 'miss',      peso: 'male' },
    errore:     { key: 'errore',     label: 'Errore',             icon: '?',  cls: 'mistake',   peso: 'male' },
    grave:      { key: 'grave',      label: 'Errore grave',       icon: '??', cls: 'blunder',   peso: 'male' }
  };
  var ORDER = ['brillante', 'decisiva', 'migliore', 'libro', 'eccellente', 'buona', 'imprecisa', 'mancata', 'errore', 'grave'];

  // ------------------------------------------------------------- libro teorico
  var BOOK_LINES = null;
  function bookLines() {
    if (BOOK_LINES) return BOOK_LINES;
    BOOK_LINES = [];
    if (O) {
      (O.OPENINGS || []).concat(O.TRAPS || []).forEach(function (o) {
        BOOK_LINES.push({ nome: o.name, mosse: o.moves.map(function (m) { return norm(m.san); }) });
      });
    }
    return BOOK_LINES;
  }
  function norm(san) { return String(san).replace(/[+#!?]/g, '').replace(/0/g, 'O'); }

  /** Se la sequenza giocata finora coincide con una linea di repertorio. */
  function bookNameFor(sans, ply) {
    var lines = bookLines(), best = null;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (ply >= L.mosse.length) continue;
      var ok = true;
      for (var j = 0; j <= ply; j++) {
        if (norm(sans[j]) !== L.mosse[j]) { ok = false; break; }
      }
      if (ok) { best = L.nome; break; }
    }
    return best;
  }

  // ----------------------------------------------- diagnosi causa dell'errore
  var CAUSE_INFO = {
    'pezzo-indifeso': {
      titolo: 'Pezzi lasciati indifesi',
      spiega: 'Hai mosso lasciando un pezzo dove l\'avversario poteva prenderlo gratis.',
      consiglio: 'Prima di ogni mossa fai la checklist delle 3 C e chiediti: "dopo questa mossa, cosa può catturare?". Allena il tema "Vincere materiale".',
      tema: 'materiale'
    },
    'forchetta-subita': {
      titolo: 'Forchette subite',
      spiega: 'L\'avversario ha attaccato due tuoi pezzi con una sola mossa.',
      consiglio: 'Controlla sempre le case da cui un cavallo nemico toccherebbe due tuoi pezzi, e non tenere re e donna sulla stessa diagonale o distanza di cavallo. Allena il tema "Forchetta".',
      tema: 'forchetta'
    },
    'cattura-sbagliata': {
      titolo: 'Catture che perdono materiale',
      spiega: 'Hai catturato un pezzo difeso più volte di quanto tu lo attaccassi.',
      consiglio: 'Conta attaccanti e difensori PRIMA di catturare: se i difensori sono di più, la cattura perde materiale.',
      tema: 'materiale'
    },
    'minaccia-ignorata': {
      titolo: 'Minacce ignorate',
      spiega: 'L\'avversario minacciava già un tuo pezzo e tu hai giocato altrove.',
      consiglio: 'Dopo OGNI mossa avversaria chiediti "cosa minaccia?" prima di pensare al tuo piano: è il terzo punto delle 3 C.',
      tema: 'materiale'
    },
    'difensore-rimosso': {
      titolo: 'Difensori spostati',
      spiega: 'Hai mosso un pezzo che stava difendendo qualcos\'altro, e quel qualcosa è caduto.',
      consiglio: 'Prima di muovere un pezzo chiediti: "cosa sta difendendo in questo momento?".',
      tema: 'materiale'
    },
    're-esposto': {
      titolo: 'Re troppo esposto',
      spiega: 'Le tue mosse hanno lasciato il re sotto attacco diretto.',
      consiglio: 'Arrocca entro la mossa 10 e non muovere i pedoni davanti al re senza motivo. Allena il tema "Difenditi".',
      tema: 'difesa'
    },
    'arrocco-tardi': {
      titolo: 'Arrocco rimandato',
      spiega: 'Sei rimasto col re al centro oltre la decima mossa.',
      consiglio: 'Sviluppa i pezzi minori e arrocca subito: è la causa numero uno delle sconfitte sotto i 1000 Elo.',
      tema: null, apertura: true
    },
    'donna-presto': {
      titolo: 'Donna fuori troppo presto',
      spiega: 'Hai portato la donna in gioco nelle primissime mosse e sei stato costretto a muoverla di nuovo.',
      consiglio: 'Sviluppa prima cavalli e alfieri: la donna esce quando il centro è chiaro.',
      tema: null, apertura: true
    },
    'tempi-persi': {
      titolo: 'Tempi persi in apertura',
      spiega: 'Hai mosso più volte lo stesso pezzo mentre altri erano ancora a casa.',
      consiglio: 'Una mossa, un pezzo nuovo: nelle prime 8 mosse porta in gioco tutto.',
      tema: null, apertura: true
    },
    'matto-mancato': {
      titolo: 'Matti non visti',
      spiega: 'Avevi un matto forzato a disposizione e non l\'hai giocato.',
      consiglio: 'Quando il re avversario ha poche case di fuga, cerca tutti gli scacchi prima di qualsiasi altra mossa. Allena i temi "Matto in 1" e "Matto in 2".',
      tema: 'matto1'
    },
    'materiale-mancato': {
      titolo: 'Occasioni di guadagno mancate',
      spiega: 'Potevi vincere materiale e hai giocato altro.',
      consiglio: 'Guarda sempre tutte le catture possibili prima di decidere: è il secondo punto delle 3 C.',
      tema: 'materiale'
    },
    'calcolo': {
      titolo: 'Errori di calcolo',
      spiega: 'La mossa peggiora la posizione per motivi non immediati (la risposta avversaria era forte).',
      consiglio: 'Dopo aver scelto una mossa, immagina la risposta più aggressiva dell\'avversario prima di giocarla.',
      tema: null
    }
  };

  /** Capisce PERCHÉ una mossa è stata un errore. */
  function diagnose(fenBefore, moveSan, afterAnalysis, beforeAnalysis, ply) {
    var g = new Chess(fenBefore);
    var mover = g.turn;
    var played = g.move(moveSan);
    if (!played) return 'calcolo';

    // 1. occasione mancata
    if (beforeAnalysis && beforeAnalysis.score > E.MATE - 1000) return 'matto-mancato';

    // 2. la mossa era una cattura perdente?
    if (played.captured) {
      var see = E.threatOnSquare(g, played.toSq, C.other(mover));
      if (see >= 200) return 'cattura-sbagliata';
    }

    // 3. qualcosa resta in presa dopo la mossa
    var hang = E.hangingPieces(g, mover);
    if (hang.length && hang[0].loss >= 200) {
      var inPresa = hang[0];
      // il pezzo appena mosso è finito sotto attacco
      if (inPresa.sq === played.toSq) return 'pezzo-indifeso';
      var gb = new Chess(fenBefore);
      var hangBefore = E.hangingPieces(gb, mover);
      var eraGia = hangBefore.some(function (h) { return h.square === inPresa.square; });
      // era già minacciato e non l'hai difeso, oppure hai tolto il suo difensore
      return eraGia ? 'minaccia-ignorata' : 'difensore-rimosso';
    }

    // 4. la risposta avversaria è una forchetta o un matto?
    if (afterAnalysis && afterAnalysis.best) {
      if (afterAnalysis.score > E.MATE - 1000) return 're-esposto';
      var probe = new Chess(g.fen());
      var legal = probe.legalMoves(), match = null;
      for (var i = 0; i < legal.length; i++) {
        if (legal[i].from === afterAnalysis.best.from && legal[i].to === afterAnalysis.best.to) { match = legal[i]; break; }
      }
      if (match) {
        probe.makeMoveFast(match);
        var targets = K.targetsFrom(probe, match.to).filter(function (t) {
          return t.type !== C.KING && (!t.defended || t.value > VALUE[typeOf(match.piece)]);
        });
        var daScacco = probe.inCheck();
        probe.undoMoveFast();
        if (targets.length >= 2 || (daScacco && targets.length >= 1)) return 'forchetta-subita';
      }
    }
    return 'calcolo';
  }

  /** Abitudini di apertura riconosciute sull'intera partita. */
  function openingHabits(startFen, sans, color) {
    var out = [];
    var g = new Chess(startFen);
    var kingMovedTo = null, castled = false, queenOut = -1, queenMoves = 0;
    var movedPieces = {}, repeats = 0;
    for (var i = 0; i < sans.length && i < 24; i++) {
      var mover = g.turn;
      var d = g.move(sans[i]);
      if (!d) break;
      if (mover !== color) continue;
      if (d.flags & (C.FLAGS.KCASTLE | C.FLAGS.QCASTLE)) castled = true;
      if (d.piece === 'q') { queenMoves++; if (queenOut < 0) queenOut = i; }
      if (d.piece !== 'p') {
        if (movedPieces[d.from] === undefined) {
          // il pezzo arriva da una casa dove era già stato mosso?
        }
        if (movedPieces[d.fromSq] !== undefined) repeats++;
        movedPieces[d.toSq] = true;
        delete movedPieces[d.fromSq];
      }
    }
    if (!castled && sans.length >= 20) out.push('arrocco-tardi');
    if (queenOut >= 0 && queenOut < 6 && queenMoves >= 2) out.push('donna-presto');
    if (repeats >= 3) out.push('tempi-persi');
    return out;
  }

  // ------------------------------------------------------------ rating stimato
  /** Stima (indicativa) del livello espresso nella partita. */
  function estimateRating(accuracy, counts, plies) {
    var bande = [[40, 250], [50, 450], [60, 700], [70, 1000], [78, 1250], [85, 1500], [91, 1800], [95, 2100], [100, 2500]];
    var elo = 250;
    for (var i = 0; i < bande.length; i++) {
      if (accuracy <= bande[i][0]) {
        var lo = i === 0 ? [0, 100] : bande[i - 1];
        var t = (accuracy - lo[0]) / Math.max(1, bande[i][0] - lo[0]);
        elo = Math.round(lo[1] + t * (bande[i][1] - lo[1]));
        break;
      }
      elo = bande[i][1];
    }
    // penalità per errori gravi frequenti
    var mosse = Math.max(1, Math.round(plies));
    var graviPer10 = ((counts.grave || 0) + 0.5 * (counts.errore || 0)) / mosse * 10;
    elo -= Math.round(graviPer10 * 120);
    return Math.max(150, Math.min(2600, elo));
  }

  // --------------------------------------------------------------- analisi
  /**
   * Analizza una partita mossa per mossa.
   * opts: {startFen, sans:[...], depth, timeMs}
   * Ritorna un oggetto con i dati di ogni mossa e i riepiloghi per colore.
   * `step()` processa una posizione per volta: in pagina si richiama a blocchi
   * per non bloccare l'interfaccia; nei test si usa runAll().
   */
  function createAnalysis(opts) {
    var startFen = opts.startFen || C.START_FEN;
    var sans = opts.sans || [];
    var depth = opts.depth || 4;
    var timeMs = opts.timeMs || 220;

    var game = new Chess(startFen);
    var positions = [startFen];
    var legalSans = [];
    for (var i = 0; i < sans.length; i++) {
      var d = game.move(sans[i]);
      if (!d) break;
      legalSans.push(d.san);
      positions.push(game.fen());
    }

    var state = {
      startFen: startFen,
      sans: legalSans,
      positions: positions,
      evals: new Array(positions.length),
      moves: [],
      index: 0,
      total: positions.length,
      done: false
    };

    state.step = function () {
      if (state.index >= positions.length) { finish(state, depth, timeMs); return true; }
      var g = new Chess(positions[state.index]);
      state.evals[state.index] = g.isGameOver()
        ? { score: g.inCheck() ? -E.MATE : 0, best: null, bestSan: null, pvSan: [], moves: [] }
        : E.analyze(g, { depth: depth, timeMs: timeMs });
      state.index++;
      if (state.index >= positions.length) { finish(state, depth, timeMs); return true; }
      return false;
    };

    state.runAll = function () {
      while (!state.step()) { /* avanti */ }
      return state;
    };

    state.progress = function () { return state.index / state.total; };
    return state;
  }

  function finish(state, depth, timeMs) {
    if (state.done) return;
    var sans = state.sans, positions = state.positions, evals = state.evals;
    var perColor = { w: [], b: [] };
    var counts = { w: {}, b: {} };
    var causes = { w: {}, b: {} };

    for (var i = 0; i < sans.length; i++) {
      var before = evals[i], after = evals[i + 1];
      if (!before || !after) continue;
      var g = new Chess(positions[i]);
      var mover = g.turnColor();

      // Perdita calcolata DENTRO la stessa analisi: il punteggio della mossa
      // giocata e quello della migliore vengono dalla stessa ricerca, alla
      // stessa profondità. Confrontare due analisi diverse (prima/dopo)
      // introdurrebbe un errore sistematico dovuto all'orizzonte.
      var scoreBefore = before.score;                 // punto di vista di chi muove
      var giocata = null;
      for (var k = 0; k < before.moves.length; k++) {
        if (norm(before.moves[k].san) === norm(sans[i])) { giocata = before.moves[k]; break; }
      }
      var scoreAfter = giocata ? giocata.score : -after.score;
      var winBefore = winPercent(scoreBefore);
      var winAfter = winPercent(scoreAfter);
      var delta = Math.max(0, winBefore - winAfter);
      var acc = moveAccuracy(delta);
      var isBest = before.bestSan && norm(before.bestSan) === norm(sans[i]);
      var libro = bookNameFor(sans, i);

      // classificazione
      var cls;
      if (isBest && isSacrifice(positions[i], sans[i]) && scoreAfter > -50) cls = 'brillante';
      else if (isBest && onlyMove(before)) cls = 'decisiva';
      else if (libro) cls = 'libro';
      else if (isBest) cls = 'migliore';
      else if (delta <= 2) cls = 'eccellente';
      else if (delta <= 5) cls = 'buona';
      else if (delta <= 10) cls = 'imprecisa';
      else if (delta <= 20) cls = 'errore';
      else cls = 'grave';

      // occasione mancata: avevi matto o un grosso guadagno e l'hai perso
      var mancata = false;
      if (delta > 8 && (scoreBefore > E.MATE - 1000 || (scoreBefore >= 200 && scoreAfter < scoreBefore - 180))) {
        mancata = true;
        if (cls === 'imprecisa' || cls === 'errore') cls = 'mancata';
      }

      var causa = null;
      if (cls === 'imprecisa' || cls === 'errore' || cls === 'grave' || cls === 'mancata') {
        if (mancata) causa = scoreBefore > E.MATE - 1000 ? 'matto-mancato' : 'materiale-mancato';
        else causa = diagnose(positions[i], sans[i], after, before, i);
        causes[mover][causa] = (causes[mover][causa] || 0) + 1;
      }

      perColor[mover].push(acc);
      counts[mover][cls] = (counts[mover][cls] || 0) + 1;

      state.moves.push({
        ply: i,
        numero: Math.floor(i / 2) + 1,
        san: sans[i],
        colore: mover,
        fenBefore: positions[i],
        fenAfter: positions[i + 1],
        scoreBefore: scoreBefore,
        scoreAfter: scoreAfter,
        // valutazione della posizione raggiunta, sempre dal lato del bianco
        scoreBianco: mover === 'w' ? -after.score : after.score,
        winBefore: winBefore,
        winAfter: winAfter,
        delta: delta,
        accuracy: acc,
        classe: cls,
        info: CLASSES[cls],
        migliore: before.bestSan,
        variante: before.pvSan ? before.pvSan.slice(0, 4) : [],
        bestMove: before.best,
        libro: libro,
        causa: causa
      });
    }

    // abitudini di apertura
    ['w', 'b'].forEach(function (col) {
      openingHabits(state.startFen, sans, col === 'w' ? C.WHITE : C.BLACK).forEach(function (h) {
        causes[col][h] = (causes[col][h] || 0) + 1;
      });
    });

    state.riepilogo = {};
    ['w', 'b'].forEach(function (col) {
      var acc = gameAccuracy(perColor[col]);
      var n = perColor[col].length;
      state.riepilogo[col] = {
        accuratezza: acc,
        mosse: n,
        conteggi: counts[col],
        cause: causes[col],
        rating: n >= 5 ? estimateRating(acc, counts[col], n) : null
      };
    });

    state.momenti = state.moves
      .filter(function (m) { return m.classe === 'grave' || m.classe === 'errore' || m.classe === 'mancata' || m.classe === 'brillante'; })
      .sort(function (a, b) { return b.delta - a.delta; })
      .slice(0, 6)
      .sort(function (a, b) { return a.ply - b.ply; });

    state.done = true;
  }

  /** La mossa migliore è l'unica che tiene la posizione? */
  function onlyMove(analysis) {
    if (!analysis || !analysis.moves || analysis.moves.length < 2) return false;
    var a = winPercent(analysis.moves[0].score), b = winPercent(analysis.moves[1].score);
    return (a - b) >= 12;
  }

  /** La mossa offre materiale (sacrificio) restando buona? */
  function isSacrifice(fen, san) {
    var g = new Chess(fen);
    var mover = g.turn;
    var d = g.move(san);
    if (!d) return false;
    var hang = E.hangingPieces(g, mover);
    if (!hang.length) return false;
    var valoreCatturato = d.captured ? VALUE[C.TYPE_FROM_CHAR[d.captured]] : 0;
    return hang[0].loss - valoreCatturato >= 250;
  }

  /** Piano di allenamento personalizzato dalle cause ricorrenti. */
  function trainingPlan(causeCounts, limite) {
    var items = Object.keys(causeCounts || {}).map(function (k) {
      return { causa: k, n: causeCounts[k], info: CAUSE_INFO[k] };
    }).filter(function (x) { return !!x.info; });
    items.sort(function (a, b) { return b.n - a.n; });
    return items.slice(0, limite || 3);
  }

  global.ChessReview = {
    winPercent: winPercent,
    moveAccuracy: moveAccuracy,
    gameAccuracy: gameAccuracy,
    estimateRating: estimateRating,
    createAnalysis: createAnalysis,
    trainingPlan: trainingPlan,
    diagnose: diagnose,
    openingHabits: openingHabits,
    bookNameFor: bookNameFor,
    CLASSES: CLASSES,
    ORDER: ORDER,
    CAUSE_INFO: CAUSE_INFO
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ChessReview;
})(typeof window !== 'undefined' ? window : globalThis);
