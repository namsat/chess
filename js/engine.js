/*!
 * engine.js — Valutazione + ricerca (negamax con alpha-beta, quiescenza,
 * approfondimento iterativo con budget di tempo). Livelli calibrati per
 * giocatori da 400 a 1600 Elo.
 */
(function (global) {
  'use strict';

  var C = global.ChessCore || (typeof require !== 'undefined' ? require('./chess-core.js') : null);
  var PAWN = C.PAWN, KNIGHT = C.KNIGHT, BISHOP = C.BISHOP, ROOK = C.ROOK, QUEEN = C.QUEEN, KING = C.KING;
  var WHITE = C.WHITE, BLACK = C.BLACK, FLAGS = C.FLAGS, VALUE = C.VALUE;
  var typeOf = C.typeOf, colorOf = C.colorOf, onBoard = C.onBoard, fileOf = C.fileOf, rankOf = C.rankOf;
  var mk = C.mk, other = C.other;

  var MATE = 1000000;
  var INF = 9000000;

  // Tabelle posizionali (prospettiva bianco, da a8 a h1)
  var PST = {};
  PST[PAWN] = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0];
  PST[KNIGHT] = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50];
  PST[BISHOP] = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20];
  PST[ROOK] = [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0];
  PST[QUEEN] = [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20];
  var KING_MG = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20];
  var KING_EG = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50];

  var PASSED_BONUS = [0, 10, 18, 30, 55, 90, 140, 0]; // per traverse avanzate

  function idx64(sq, color) {
    var r = rankOf(sq), f = fileOf(sq);
    return color === WHITE ? r * 8 + f : (7 - r) * 8 + f;
  }

  // ------------------------------------------------------------ valutazione
  function evaluate(game) {
    var b = game.board, sq, p, t, c, i;
    var mat = [0, 0], pos = [0, 0], nonPawn = [0, 0];
    var pawnFiles = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]];
    var pawnSquares = [[], []];
    var bishops = [0, 0], kingSq = [game.kings[0], game.kings[1]];
    var pieces = [[], []];

    for (sq = 0; sq <= 119; sq++) {
      if (!onBoard(sq)) { sq += 7; continue; }
      p = b[sq];
      if (!p) continue;
      t = typeOf(p); c = colorOf(p);
      pieces[c].push(sq);
      if (t !== KING) {
        mat[c] += VALUE[t];
        if (t !== PAWN) nonPawn[c] += VALUE[t];
      }
      if (t === PAWN) { pawnFiles[c][fileOf(sq)]++; pawnSquares[c].push(sq); }
      if (t === BISHOP) bishops[c]++;
      if (t !== KING) pos[c] += PST[t][idx64(sq, c)];
    }

    // fase di gioco: 1 = apertura/mediogioco, 0 = finale
    var phase = Math.min(1, (nonPawn[0] + nonPawn[1]) / 6400);
    for (c = 0; c < 2; c++) {
      if (kingSq[c] >= 0) {
        var k = idx64(kingSq[c], c);
        pos[c] += Math.round(KING_MG[k] * phase + KING_EG[k] * (1 - phase));
      }
    }

    // struttura di pedoni
    for (c = 0; c < 2; c++) {
      for (var f = 0; f < 8; f++) {
        var n = pawnFiles[c][f];
        if (n > 1) pos[c] -= 16 * (n - 1);                       // doppiati
        if (n > 0) {
          var left = f > 0 ? pawnFiles[c][f - 1] : 0;
          var right = f < 7 ? pawnFiles[c][f + 1] : 0;
          if (!left && !right) pos[c] -= 14 * n;                 // isolati
        }
      }
      // pedoni passati
      for (i = 0; i < pawnSquares[c].length; i++) {
        sq = pawnSquares[c][i];
        var pf = fileOf(sq), pr = rankOf(sq), blocked = false;
        for (var df = -1; df <= 1; df++) {
          var ff = pf + df;
          if (ff < 0 || ff > 7) continue;
          for (var j = 0; j < pawnSquares[1 - c].length; j++) {
            var osq = pawnSquares[1 - c][j];
            if (fileOf(osq) !== ff) continue;
            if (c === WHITE ? rankOf(osq) < pr : rankOf(osq) > pr) { blocked = true; break; }
          }
          if (blocked) break;
        }
        if (!blocked) {
          var adv = c === WHITE ? (6 - pr) : (pr - 1);
          pos[c] += PASSED_BONUS[Math.max(0, Math.min(7, adv + 1))];
        }
      }
      if (bishops[c] >= 2) pos[c] += 32;                          // coppia di alfieri
    }

    // torri su colonne aperte / semiaperte
    for (c = 0; c < 2; c++) {
      for (i = 0; i < pieces[c].length; i++) {
        sq = pieces[c][i];
        if (typeOf(b[sq]) !== ROOK) continue;
        var file = fileOf(sq);
        if (!pawnFiles[c][file]) pos[c] += pawnFiles[1 - c][file] ? 12 : 22;
      }
    }

    // scudo di pedoni davanti al re (solo nel mediogioco)
    if (phase > 0.5) {
      for (c = 0; c < 2; c++) {
        var ks = kingSq[c];
        if (ks < 0) continue;
        var shield = 0, dir = c === WHITE ? -16 : 16;
        for (var d = -1; d <= 1; d++) {
          var s1 = ks + dir + d;
          if (onBoard(s1) && b[s1] === mk(PAWN, c)) shield++;
        }
        pos[c] += Math.round((shield * 12 - 12) * phase);
      }
    }

    var score = (mat[0] + pos[0]) - (mat[1] + pos[1]);
    return score;
  }

  function evalForSideToMove(game) {
    var e = evaluate(game);
    return game.turn === WHITE ? e : -e;
  }

  // -------------------------------------------------------------- ordinamento
  function scoreMove(m, pvMove, killers, ply, history) {
    if (pvMove && m.from === pvMove.from && m.to === pvMove.to && m.promotion === pvMove.promotion) return 1e7;
    var s = 0;
    if (m.captured) s += 100000 + 10 * VALUE[typeOf(m.captured)] - VALUE[typeOf(m.piece)];
    if (m.flags & FLAGS.PROMO) s += 90000 + VALUE[m.promotion];
    if (!m.captured) {
      var k = killers[ply];
      if (k && ((k[0] && k[0].from === m.from && k[0].to === m.to) || (k[1] && k[1].from === m.from && k[1].to === m.to))) s += 80000;
      s += history[m.from * 128 + m.to] || 0;
    }
    if (m.flags & (FLAGS.KCASTLE | FLAGS.QCASTLE)) s += 5000;
    return s;
  }

  function sortMoves(moves, pvMove, killers, ply, history) {
    for (var i = 0; i < moves.length; i++) moves[i]._s = scoreMove(moves[i], pvMove, killers, ply, history);
    moves.sort(function (a, b) { return b._s - a._s; });
    return moves;
  }

  // ------------------------------------------------------------------ ricerca
  function Searcher() {
    this.nodes = 0;
    this.killers = [];
    this.history = new Int32Array(128 * 128);
    this.deadline = Infinity;
    this.aborted = false;
    this.pvTable = [];
  }

  Searcher.prototype.timeUp = function () {
    if (this.aborted) return true;
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) this.aborted = true;
    return this.aborted;
  };

  Searcher.prototype.quiesce = function (game, alpha, beta, ply) {
    this.nodes++;
    if (this.timeUp()) return 0;
    var i, sc, inCheck = game.inCheck();

    if (inCheck) {
      // sotto scacco si esaminano tutte le uscite, niente stand-pat
      if (ply > 30) return evalForSideToMove(game);
      var evas = game.legalMoves();
      if (!evas.length) return -MATE + ply;
      sortMoves(evas, null, this.killers, ply, this.history);
      for (i = 0; i < evas.length; i++) {
        game.makeMoveFast(evas[i]);
        sc = -this.quiesce(game, -beta, -alpha, ply + 1);
        game.undoMoveFast();
        if (this.aborted) return 0;
        if (sc >= beta) return beta;
        if (sc > alpha) alpha = sc;
      }
      return alpha;
    }

    var stand = evalForSideToMove(game);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ply > 24) return stand;

    var caps = game.legalMoves({ capturesOnly: true });
    sortMoves(caps, null, this.killers, ply, this.history);
    for (i = 0; i < caps.length; i++) {
      // potatura dei cambi chiaramente perdenti
      var gain = VALUE[typeOf(caps[i].captured)] - VALUE[typeOf(caps[i].piece)];
      if (gain < -250 && !(caps[i].flags & FLAGS.PROMO)) continue;
      game.makeMoveFast(caps[i]);
      sc = -this.quiesce(game, -beta, -alpha, ply + 1);
      game.undoMoveFast();
      if (this.aborted) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  Searcher.prototype.negamax = function (game, depth, alpha, beta, ply, pvLine) {
    this.nodes++;
    if (this.timeUp()) return 0;
    if (pvLine) pvLine.length = 0;

    var inCheck = game.inCheck();
    if (inCheck && ply < 24) depth++;           // estensione sugli scacchi

    if (depth <= 0) return this.quiesce(game, alpha, beta, ply);

    if (game.halfMoves >= 100 || game.isInsufficientMaterial()) return 0;

    var moves = game.legalMoves();
    if (!moves.length) return inCheck ? -MATE + ply : 0;

    if (!this.killers[ply]) this.killers[ply] = [null, null];
    sortMoves(moves, this.pvTable[ply] || null, this.killers, ply, this.history);

    var best = -INF, childLine = [], bestMove = null;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      game.makeMoveFast(m);
      var sc;
      if (i === 0) {
        sc = -this.negamax(game, depth - 1, -beta, -alpha, ply + 1, childLine);
      } else {
        // riduzione sulle mosse tardive tranquille
        var red = (depth >= 3 && i >= 4 && !m.captured && !(m.flags & FLAGS.PROMO) && !inCheck) ? 1 : 0;
        sc = -this.negamax(game, depth - 1 - red, -alpha - 1, -alpha, ply + 1, childLine);
        if (sc > alpha && sc < beta) {
          sc = -this.negamax(game, depth - 1, -beta, -alpha, ply + 1, childLine);
        }
      }
      game.undoMoveFast();
      if (this.aborted) return 0;

      if (sc > best) {
        best = sc; bestMove = m;
        if (pvLine) {
          pvLine.length = 0;
          pvLine.push(m);
          for (var k = 0; k < childLine.length; k++) pvLine.push(childLine[k]);
        }
      }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!m.captured) {
          var ks = this.killers[ply];
          if (!ks[0] || ks[0].from !== m.from || ks[0].to !== m.to) { ks[1] = ks[0]; ks[0] = m; }
          this.history[m.from * 128 + m.to] += depth * depth;
        }
        break;
      }
    }
    return best;
  };

  /**
   * Analizza la posizione. Ritorna {score, best, pv, moves:[{move,san,score}]}
   * score in centipedoni dal punto di vista di chi muove.
   */
  function analyze(game, opts) {
    opts = opts || {};
    var maxDepth = opts.depth || 4;
    var budget = opts.timeMs || 1000;
    var s = new Searcher();
    s.deadline = Date.now() + budget;

    var root = game.legalMoves();
    if (!root.length) {
      return { score: game.inCheck() ? -MATE : 0, best: null, pv: [], moves: [], depth: 0, gameOver: true };
    }
    var all = root.slice();
    var sanOf = {};
    for (var i = 0; i < all.length; i++) sanOf[all[i].from + '-' + all[i].to + '-' + all[i].promotion] = game.moveToSan(all[i], all);

    sortMoves(root, null, s.killers, 0, s.history);
    var scored = root.map(function (m) { return { move: m, score: -INF, pv: [m] }; });
    var bestResult = null;

    for (var depth = 1; depth <= maxDepth; depth++) {
      var iterBest = null, iterScored = [];
      for (var j = 0; j < scored.length; j++) {
        var m = scored[j].move;
        game.makeMoveFast(m);
        var childLine = [];
        // finestra piena su ogni mossa alla radice: i punteggi restano esatti,
        // cosi i livelli "umani" e il pannello di analisi possono confrontarli.
        var sc = -s.negamax(game, depth - 1, -INF, INF, 1, childLine);
        game.undoMoveFast();
        if (s.aborted) break;
        var pv = [m].concat(childLine);
        iterScored.push({ move: m, score: sc, pv: pv });
        if (!iterBest || sc > iterBest.score) iterBest = { move: m, score: sc, pv: pv };
      }

      if (!s.aborted && iterBest) {
        iterScored.sort(function (a, b) { return b.score - a.score; });
        scored = iterScored;
        s.pvTable = iterBest.pv.slice();
        bestResult = { depth: depth, best: iterBest.move, score: iterBest.score, pv: iterBest.pv, moves: iterScored };
      }
      if (s.aborted) break;
      if (Math.abs(bestResult.score) > MATE - 1000) break;      // matto trovato
      if (Date.now() > s.deadline) break;
    }

    if (!bestResult) {
      bestResult = { depth: 1, best: root[0], score: 0, pv: [root[0]], moves: scored };
    }

    // SAN della variante principale
    var pvSan = [], tmp = 0;
    for (var p = 0; p < bestResult.pv.length && p < 10; p++) {
      var mm = bestResult.pv[p];
      var legal = game.legalMoves();
      var match = null;
      for (var q = 0; q < legal.length; q++) {
        if (legal[q].from === mm.from && legal[q].to === mm.to && legal[q].promotion === mm.promotion) { match = legal[q]; break; }
      }
      if (!match) break;
      pvSan.push(game.moveToSan(match, legal));
      game.makeMoveFast(match);
      tmp++;
    }
    while (tmp-- > 0) game.undoMoveFast();

    return {
      score: bestResult.score,
      best: bestResult.best,
      bestSan: pvSan[0] || null,
      pv: bestResult.pv,
      pvSan: pvSan,
      depth: bestResult.depth,
      nodes: s.nodes,
      moves: bestResult.moves.map(function (x) {
        return { move: x.move, score: x.score, san: sanOf[x.move.from + '-' + x.move.to + '-' + x.move.promotion] };
      })
    };
  }

  // -------------------------------------------------------------- livelli
  var LEVELS = [
    { id: 1, name: 'Principiante', elo: '~400', depth: 1, timeMs: 120, window: 400, blunder: 0.30,
      desc: 'Muove quasi a caso, prende i pezzi solo se è ovvio. Perfetto per prendere confidenza.' },
    { id: 2, name: 'Facile', elo: '~600', depth: 2, timeMs: 250, window: 220, blunder: 0.16,
      desc: 'Vede le catture immediate e qualche minaccia. Il tuo livello attuale su chess.com.' },
    { id: 3, name: 'Medio', elo: '~850', depth: 3, timeMs: 450, window: 100, blunder: 0.07,
      desc: 'Vede forchette e minacce a 2 mosse. Sfida giusta per salire di livello.' },
    { id: 4, name: 'Avanzato', elo: '~1150', depth: 4, timeMs: 800, window: 35, blunder: 0.02,
      desc: 'Punisce quasi ogni svista. Usalo quando vuoi allenarti sul serio.' },
    { id: 5, name: 'Forte', elo: '~1500', depth: 5, timeMs: 1600, window: 0, blunder: 0,
      desc: 'Gioca sempre la mossa migliore che trova. Per misurarti davvero.' }
  ];

  /** Sceglie la mossa del computer secondo il livello. */
  function chooseMove(game, levelId) {
    var lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (levelId || 2) - 1))];
    var legal = game.legalMoves();
    if (!legal.length) return null;

    if (lv.blunder > 0 && Math.random() < lv.blunder) {
      // mossa "umana sbagliata": evita però di regalare la donna gratis a caso
      var pool = legal.filter(function (m) {
        return !(m.captured && VALUE[typeOf(m.captured)] >= 500) || Math.random() < 0.5;
      });
      if (!pool.length) pool = legal;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      return { move: pick, san: game.moveToSan(pick, legal), score: null, sloppy: true, level: lv };
    }

    var res = analyze(game, { depth: lv.depth, timeMs: lv.timeMs });
    var bestScore = res.moves[0].score;
    var pool2 = res.moves.filter(function (x) { return bestScore - x.score <= lv.window; });
    if (!pool2.length) pool2 = [res.moves[0]];
    var chosen = pool2[Math.floor(Math.random() * pool2.length)];
    return { move: chosen.move, san: chosen.san, score: chosen.score, analysis: res, level: lv };
  }

  // --------------------------------------------- valutazione statica scambi
  /** Guadagno materiale per chi muove catturando sulla casa sq (SEE ricorsivo). */
  function seeOnSquare(game, sq) {
    var caps = game.legalMoves({ capturesOnly: true }).filter(function (m) { return m.to === sq; });
    if (!caps.length) return 0;
    caps.sort(function (a, b) { return VALUE[typeOf(a.piece)] - VALUE[typeOf(b.piece)]; });
    var m = caps[0];
    var victim = VALUE[typeOf(m.captured)];
    game.makeMoveFast(m);
    var reply = seeOnSquare(game, sq);
    game.undoMoveFast();
    return Math.max(0, victim - reply);
  }

  /** Quanto materiale perde `color` se l'avversario attacca sq adesso. */
  function threatOnSquare(game, sq, byColor) {
    var savedTurn = game.turn, savedEp = game.ep;
    game.turn = byColor; game.ep = -1;
    var v = 0;
    try { v = seeOnSquare(game, sq); } catch (e) { v = 0; }
    game.turn = savedTurn; game.ep = savedEp;
    return v;
  }

  /** Elenco dei pezzi di `color` che l'avversario può vincere materialmente. */
  function hangingPieces(game, color) {
    if (color === 'w') color = WHITE;
    else if (color === 'b') color = BLACK;
    var out = [], squares = game.pieceSquares(color), them = other(color);
    for (var i = 0; i < squares.length; i++) {
      var sq = squares[i], p = game.board[sq];
      if (typeOf(p) === KING) continue;
      if (!game.isAttacked(sq, them)) continue;
      var loss = threatOnSquare(game, sq, them);
      if (loss > 0) out.push({ square: C.algebraic(sq), sq: sq, type: C.CHAR_FROM_TYPE[typeOf(p)], loss: loss });
    }
    out.sort(function (a, b) { return b.loss - a.loss; });
    return out;
  }

  var JUDGEMENTS = [
    { max: 15, key: 'best', label: 'Mossa migliore', icon: '★', cls: 'best' },
    { max: 50, key: 'great', label: 'Ottima mossa', icon: '✓', cls: 'great' },
    { max: 110, key: 'good', label: 'Buona mossa', icon: '✓', cls: 'good' },
    { max: 220, key: 'inaccuracy', label: 'Imprecisione', icon: '?!', cls: 'inacc' },
    { max: 500, key: 'mistake', label: 'Errore', icon: '?', cls: 'mistake' },
    { max: Infinity, key: 'blunder', label: 'Errore grave', icon: '??', cls: 'blunder' }
  ];

  function judgeLoss(loss) {
    for (var i = 0; i < JUDGEMENTS.length; i++) if (loss <= JUDGEMENTS[i].max) return JUDGEMENTS[i];
    return JUDGEMENTS[JUDGEMENTS.length - 1];
  }

  function scoreToText(score) {
    if (score > MATE - 1000) return 'matto in ' + Math.ceil((MATE - score) / 2);
    if (score < -MATE + 1000) return 'matto subito in ' + Math.ceil((MATE + score) / 2);
    var v = (score / 100).toFixed(1);
    return (score > 0 ? '+' : '') + v;
  }

  global.ChessEngine = {
    evaluate: evaluate,
    analyze: analyze,
    chooseMove: chooseMove,
    LEVELS: LEVELS,
    MATE: MATE,
    seeOnSquare: seeOnSquare,
    threatOnSquare: threatOnSquare,
    hangingPieces: hangingPieces,
    judgeLoss: judgeLoss,
    JUDGEMENTS: JUDGEMENTS,
    scoreToText: scoreToText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ChessEngine;
})(typeof window !== 'undefined' ? window : globalThis);
