/*!
 * coach.js — Traduce la posizione e le mosse in spiegazioni in italiano:
 * perché una mossa è buona, cosa minaccia l'avversario, aiuti progressivi.
 */
(function (global) {
  'use strict';

  var C = global.ChessCore || (typeof require !== 'undefined' ? require('./chess-core.js') : null);
  var E = global.ChessEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  var PAWN = C.PAWN, KNIGHT = C.KNIGHT, BISHOP = C.BISHOP, ROOK = C.ROOK, QUEEN = C.QUEEN, KING = C.KING;
  var WHITE = C.WHITE, BLACK = C.BLACK, FLAGS = C.FLAGS, VALUE = C.VALUE;
  var typeOf = C.typeOf, colorOf = C.colorOf, onBoard = C.onBoard, algebraic = C.algebraic;
  var squareOf = C.squareOf, mk = C.mk, other = C.other, fileOf = C.fileOf, rankOf = C.rankOf;

  var ART = { 1: 'il pedone', 2: 'il cavallo', 3: 'l\'alfiere', 4: 'la torre', 5: 'la donna', 6: 'il re' };
  var NOME = { 1: 'pedone', 2: 'cavallo', 3: 'alfiere', 4: 'torre', 5: 'donna', 6: 're' };
  var PUNTI = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
  var CENTRO = ['d4', 'e4', 'd5', 'e5'];

  /** "1 punto" / "3 punti" */
  function nPunti(n) { n = Math.max(1, Math.round(n)); return n + (n === 1 ? ' punto' : ' punti'); }
  var CENTRO_ALLARGATO = ['c4', 'c5', 'd4', 'd5', 'e4', 'e5', 'f4', 'f5'];

  var KNIGHT_OFFS = [-33, -31, -18, -14, 14, 18, 31, 33];
  var BISHOP_OFFS = [-17, -15, 15, 17];
  var ROOK_OFFS = [-16, -1, 1, 16];
  var KING_OFFS = [-17, -16, -15, -1, 1, 15, 16, 17];

  /** Case attaccate dal pezzo che si trova in sq (indipendentemente dal turno). */
  function attacksFrom(game, sq) {
    var b = game.board, p = b[sq];
    if (!p) return [];
    var t = typeOf(p), c = colorOf(p), out = [], i, s, dirs;
    if (t === PAWN) {
      var caps = c === WHITE ? [-17, -15] : [15, 17];
      for (i = 0; i < 2; i++) { s = sq + caps[i]; if (onBoard(s)) out.push(s); }
      return out;
    }
    if (t === KNIGHT || t === KING) {
      dirs = t === KNIGHT ? KNIGHT_OFFS : KING_OFFS;
      for (i = 0; i < dirs.length; i++) { s = sq + dirs[i]; if (onBoard(s)) out.push(s); }
      return out;
    }
    dirs = t === BISHOP ? BISHOP_OFFS : (t === ROOK ? ROOK_OFFS : KING_OFFS);
    for (i = 0; i < dirs.length; i++) {
      s = sq + dirs[i];
      while (onBoard(s)) {
        out.push(s);
        if (b[s]) break;
        s += dirs[i];
      }
    }
    return out;
  }

  /** Pezzi nemici attaccati dal pezzo in sq, con indicazione se sono difesi. */
  function targetsFrom(game, sq) {
    var p = game.board[sq];
    if (!p) return [];
    var me = colorOf(p), them = other(me), res = [], seen = {};
    var atk = attacksFrom(game, sq);
    for (var i = 0; i < atk.length; i++) {
      var s = atk[i], q = game.board[s];
      if (!q || colorOf(q) === me || seen[s]) continue;
      seen[s] = 1;
      res.push({
        sq: s, square: algebraic(s), type: typeOf(q),
        defended: game.isAttacked(s, them),
        value: VALUE[typeOf(q)]
      });
    }
    return res;
  }

  /** Inchiodature o infilate create dal pezzo in sq. */
  function pinsFrom(game, sq) {
    var b = game.board, p = b[sq];
    if (!p) return [];
    var t = typeOf(p), me = colorOf(p), them = other(me), res = [];
    if (t !== BISHOP && t !== ROOK && t !== QUEEN) return res;
    var dirs = t === BISHOP ? BISHOP_OFFS : (t === ROOK ? ROOK_OFFS : KING_OFFS);
    for (var i = 0; i < dirs.length; i++) {
      var s = sq + dirs[i], first = -1;
      while (onBoard(s)) {
        if (b[s]) {
          if (colorOf(b[s]) === me) break;
          if (first < 0) { first = s; }
          else {
            if (typeOf(b[s]) === KING) res.push({ type: 'inchiodatura', pinned: first, behind: s });
            else if (VALUE[typeOf(b[s])] > VALUE[typeOf(b[first])]) res.push({ type: 'infilata', pinned: first, behind: s });
            break;
          }
        }
        s += dirs[i];
      }
    }
    return res;
  }

  function isBackRankStart(sq, color, type) {
    var r = rankOf(sq);
    if (type === PAWN) return color === WHITE ? r === 6 : r === 1;
    return color === WHITE ? r === 7 : r === 0;
  }

  /** Fase di gioco dedotta dalla posizione (funziona anche su FEN caricate). */
  function phaseOf(game) {
    var nonPawn = 0, undev = 0;
    for (var sq = 0; sq <= 119; sq++) {
      if (!onBoard(sq)) { sq += 7; continue; }
      var p = game.board[sq];
      if (!p) continue;
      var t = typeOf(p), c = colorOf(p);
      if (t !== PAWN && t !== KING) nonPawn += VALUE[t];
      if ((t === KNIGHT || t === BISHOP) && isBackRankStart(sq, c, t)) undev++;
    }
    if (nonPawn < 2200) return 'finale';
    if (undev >= 5) return 'apertura';
    return 'mediogioco';
  }

  /**
   * Spiega una mossa appena giocata.
   * @param {Chess} game posizione DOPO la mossa (con la mossa in history)
   * @param {object} mv oggetto descrittivo restituito da game.move()
   * @returns {{titolo:string, punti:string[], avvisi:string[]}}
   */
  function explainMove(game, mv) {
    var raw = mv._raw || mv;
    var me = raw ? colorOf(raw.piece) : other(game.turn);
    var them = other(me);
    var toSq = typeof mv.toSq === 'number' ? mv.toSq : squareOf(mv.to);
    var fromSq = typeof mv.fromSq === 'number' ? mv.fromSq : squareOf(mv.from);
    var type = C.TYPE_FROM_CHAR[mv.piece] || typeOf(raw.piece);
    var punti = [], avvisi = [], titolo;

    var isMate = game.isCheckmate();
    var isCheck = game.inCheck();
    var flags = raw ? raw.flags : 0;

    // titolo
    if (flags & FLAGS.KCASTLE) titolo = 'Arrocco corto';
    else if (flags & FLAGS.QCASTLE) titolo = 'Arrocco lungo';
    else if (mv.captured) titolo = ART[type].charAt(0).toUpperCase() + ART[type].slice(1) + ' cattura ' + ART[C.TYPE_FROM_CHAR[mv.captured]] + ' in ' + mv.to;
    else titolo = ART[type].charAt(0).toUpperCase() + ART[type].slice(1) + ' va in ' + mv.to;

    if (isMate) punti.push('Scacco matto: la partita finisce qui.');
    else if (isCheck) punti.push('Dai scacco: l\'avversario è obbligato a rispondere allo scacco, non può fare altro.');

    // materiale
    if (mv.captured) {
      var vCapt = PUNTI[C.TYPE_FROM_CHAR[mv.captured]];
      var recapture = game.isAttacked(toSq, them);
      if (!recapture) punti.push('Guadagni ' + vCapt + (vCapt === 1 ? ' punto' : ' punti') + ' di materiale: il pezzo non era difeso.');
      else {
        var vMine = PUNTI[type];
        if (vCapt > vMine) punti.push('Scambio favorevole: prendi ' + vCapt + ' punti rischiando ' + vMine + '.');
        else if (vCapt === vMine) punti.push('Scambio pari: utile se vuoi semplificare o se sei in vantaggio di materiale.');
        else avvisi.push('Attenzione: il pezzo in ' + mv.to + ' è difeso, quindi stai dando ' + vMine + ' punti per ' + vCapt + '.');
      }
    }
    if (flags & FLAGS.PROMO) punti.push('Promozione: il pedone diventa ' + NOME[C.TYPE_FROM_CHAR[mv.promotion]] + '.');
    if (flags & FLAGS.EP) punti.push('Presa en passant: si può fare solo subito dopo il doppio passo del pedone avversario.');
    if (flags & (FLAGS.KCASTLE | FLAGS.QCASTLE)) {
      punti.push('Metti il re al sicuro e attivi la torre verso il centro: una delle mosse più utili dell\'apertura.');
    }

    // sviluppo e centro
    var apertura = phaseOf(game) === 'apertura';
    if (!(flags & (FLAGS.KCASTLE | FLAGS.QCASTLE)) && apertura) {
      if (type !== PAWN && type !== KING && isBackRankStart(fromSq, me, type)) {
        punti.push('Sviluppi ' + ART[type] + ': nell\'apertura ogni mossa dovrebbe portare in gioco un pezzo nuovo.');
      }
      if (type === PAWN && CENTRO.indexOf(mv.to) >= 0) {
        punti.push('Occupi il centro: un pedone in ' + mv.to + ' toglie spazio all\'avversario e apre le linee ai tuoi pezzi.');
      } else if (type !== PAWN && CENTRO_ALLARGATO.indexOf(mv.to) < 0) {
        var atkCenter = attacksFrom(game, toSq).filter(function (s) { return CENTRO.indexOf(algebraic(s)) >= 0; });
        if (atkCenter.length >= 2) punti.push('Da ' + mv.to + ' controlli ' + atkCenter.length + ' case centrali: controllare il centro conta più che occuparlo.');
      }
    }

    // minacce create
    var targets = targetsFrom(game, toSq).filter(function (t) {
      return t.type !== KING && (!t.defended || t.value > VALUE[type]);
    });
    if (targets.length >= 2) {
      punti.push('Doppio attacco! Da ' + mv.to + ' minacci ' + targets.map(function (t) { return NOME[t.type] + ' in ' + t.square; }).join(' e ') + ': l\'avversario non può salvare entrambi.');
    } else if (targets.length === 1) {
      punti.push('Ora minacci ' + ART[targets[0].type] + ' in ' + targets[0].square + (targets[0].defended ? ' (difeso, ma vale più del tuo pezzo).' : ' che non è difeso.'));
    }
    if (isCheck && targetsFrom(game, toSq).some(function (t) { return t.type !== KING && t.value >= 300; })) {
      punti.push('Forchetta con scacco: l\'avversario deve parare lo scacco e il secondo pezzo è perso.');
    }

    // inchiodature
    var pins = pinsFrom(game, toSq);
    for (var i = 0; i < pins.length; i++) {
      var pinnedType = typeOf(game.board[pins[i].pinned]);
      if (pins[i].type === 'inchiodatura') {
        punti.push('Inchiodi ' + ART[pinnedType] + ' in ' + algebraic(pins[i].pinned) + ': non può muoversi perché dietro c\'è il re.');
      } else {
        punti.push('Infilata: dietro ' + ART[pinnedType] + ' in ' + algebraic(pins[i].pinned) + ' c\'è un pezzo più prezioso.');
      }
    }

    // pezzi lasciati in presa dopo la mossa
    var hang = E.hangingPieces(game, me);
    if (hang.length) {
      var h = hang[0];
      avvisi.push('Dopo questa mossa ' + ART[C.TYPE_FROM_CHAR[h.type]] + ' in ' + h.square +
        ' può essere catturato: perderesti circa ' + nPunti(h.loss / 100) + '.');
    }

    // sicurezza del re
    if (type === PAWN && game.history.length > 6) {
      var kingSq = game.kings[me];
      if (kingSq >= 0 && Math.abs(fileOf(kingSq) - fileOf(toSq)) <= 1 && fileOf(toSq) >= 5) {
        avvisi.push('Hai mosso un pedone davanti al tuo re: ogni pedone spostato è una porta aperta verso il tuo re.');
      }
    }
    if (type === QUEEN && apertura && game.history.length <= 12 && !mv.captured) {
      avvisi.push('Donna fuori presto: rischia di essere attaccata dai pezzi minori e di farti perdere tempi.');
    }
    if (type !== PAWN && apertura && game.history.length <= 20) {
      // stesso pezzo mosso due volte di recente
      var hist = game.history, moved = 0;
      for (var k = Math.max(0, hist.length - 7); k < hist.length - 1; k++) {
        var hm = hist[k].move;
        if (colorOf(hm.piece) === me && hm.to === fromSq) moved++;
      }
      if (moved > 0 && !mv.captured && !isCheck) {
        avvisi.push('Stai muovendo lo stesso pezzo due volte nell\'apertura: se puoi, sviluppa un pezzo nuovo.');
      }
    }

    if (!punti.length) punti.push('Mossa tranquilla: migliora la posizione senza forzare nulla.');
    return { titolo: titolo, punti: punti, avvisi: avvisi };
  }

  /** Cosa minaccia l'avversario adesso (per chi deve muovere). */
  function threats(game, analysis) {
    var me = game.turn, them = other(me), out = [];
    if (game.inCheck()) out.push({ grave: true, testo: 'Sei sotto scacco: devi muovere il re, catturare il pezzo che dà scacco o interporre un pezzo.' });

    var hang = E.hangingPieces(game, me);
    for (var i = 0; i < Math.min(2, hang.length); i++) {
      out.push({
        grave: hang[i].loss >= 300,
        testo: ART[C.TYPE_FROM_CHAR[hang[i].type]] + ' in ' + hang[i].square + ' è attaccato e perderesti ' +
          nPunti(hang[i].loss / 100) + ': difendilo, spostalo o crea una minaccia più grande.'
      });
    }

    // la miglior risposta dell'avversario, vista con un mezzo turno
    if (analysis && analysis.oppBest) {
      out.push({ grave: analysis.oppGrave, testo: 'Se tocca a lui, la sua idea migliore è ' + analysis.oppBest + '.' });
    }
    return out;
  }

  /** Minaccia principale dell'avversario nella posizione attuale. */
  function opponentThreat(game, timeMs) {
    // si valuta la posizione "passando il turno" solo se non si è sotto scacco
    if (game.inCheck()) return null;
    var fen = game.fen().split(' ');
    fen[1] = game.turn === WHITE ? 'b' : 'w';
    fen[3] = '-';
    var probe = new C.Chess();
    if (!probe.load(fen.join(' '))) return null;
    if (probe.inCheck()) return null;      // posizione non valida per il "passo"
    var res = E.analyze(probe, { depth: 2, timeMs: timeMs || 200 });
    if (!res.bestSan) return null;
    return { san: res.bestSan, score: res.score };
  }

  /** Aiuti progressivi su cosa fare adesso. */
  function hints(game, analysis) {
    var res = analysis, out = [];
    if (!res || !res.best) return ['Nessuna mossa disponibile.'];
    var raw = res.best;
    var type = typeOf(raw.piece);
    var isCapture = !!raw.captured;
    var from = algebraic(raw.from), to = algebraic(raw.to);

    // 1. dove guardare
    var probe = game.clone();
    var legal = probe.legalMoves();
    var match = null;
    for (var i = 0; i < legal.length; i++) if (legal[i].from === raw.from && legal[i].to === raw.to && legal[i].promotion === raw.promotion) match = legal[i];
    var san = match ? probe.moveToSan(match, legal) : (res.bestSan || '');
    var gives = { check: san.indexOf('+') >= 0, mate: san.indexOf('#') >= 0 };

    if (gives.mate) out.push('C\'è un matto! Cerca uno scacco a cui il re non possa sfuggire.');
    else if (game.inCheck()) out.push('Sei sotto scacco: hai solo tre possibilità (muovere il re, catturare, interporre). Valutale tutte e tre.');
    else if (isCapture) out.push('C\'è una cattura che conviene: conta attaccanti e difensori su ogni pezzo avversario.');
    else if (gives.check) out.push('Uno scacco forte migliora la tua posizione: guarda le linee verso il re avversario.');
    else {
      var hang = E.hangingPieces(game, game.turn);
      if (hang.length) out.push('Prima di attaccare, sistema ' + ART[C.TYPE_FROM_CHAR[hang[0].type]] + ' in ' + hang[0].square + ': è in presa.');
      else if (game.history.length < 16) out.push('Siamo in apertura: la mossa migliore sviluppa un pezzo, controlla il centro o porta il re al sicuro.');
      else out.push('Posizione tranquilla: migliora il pezzo peggio piazzato o porta una torre su una colonna aperta.');
    }

    // 2. quale pezzo
    out.push('Muovi ' + ART[type] + ' che si trova in ' + from + '.');

    // 3. la mossa
    out.push('La mossa è ' + san + ' (' + ART[type] + ' da ' + from + ' a ' + to + ').');
    return out;
  }

  /** Giudizio della mossa dell'utente + mossa migliore alternativa. */
  function judge(before, moveSan, scoreBefore, scoreAfterForMover, bestSan, pvSan) {
    var loss = Math.max(0, scoreBefore - scoreAfterForMover);
    var j = E.judgeLoss(loss);
    var testo;
    if (j.key === 'best') testo = 'Perfetto: era la mossa migliore.';
    else if (j.key === 'great') testo = 'Ottima scelta, praticamente come la migliore.';
    else if (j.key === 'good') testo = 'Mossa buona: non cambia la valutazione della posizione.';
    else if (j.key === 'inaccuracy') testo = 'Imprecisione: c\'era qualcosa di meglio.';
    else if (j.key === 'mistake') testo = 'Errore: questa mossa peggiora la tua posizione.';
    else testo = 'Errore grave: qui si perde materiale o la partita.';
    if (j.key !== 'best' && bestSan) {
      testo += ' La migliore era ' + bestSan + (pvSan && pvSan.length > 1 ? ' (seguito da ' + pvSan.slice(1, 4).join(' ') + ')' : '') + '.';
    }
    return { judgement: j, loss: loss, testo: testo };
  }

  /** Consiglio generale sulla fase di gioco. */
  function phaseAdvice(game) {
    var me = game.turn, fase = phaseOf(game);
    if (fase === 'apertura') {
      var squares = game.pieceSquares(me), undeveloped = 0, castled = true;
      for (var i = 0; i < squares.length; i++) {
        var p = game.board[squares[i]], t = typeOf(p);
        if ((t === KNIGHT || t === BISHOP) && isBackRankStart(squares[i], me, t)) undeveloped++;
      }
      var kSq = game.kings[me];
      castled = kSq >= 0 && (fileOf(kSq) >= 6 || fileOf(kSq) <= 2);
      if (undeveloped > 0) return 'Hai ancora ' + undeveloped + ' pezzi minori a casa: portali in gioco prima di attaccare.';
      if (!castled) return 'Tutti i pezzi minori sono sviluppati: adesso arrocca.';
      return 'Apertura completata: collega le torri e scegli un piano (colonna aperta, attacco al re, spinta centrale).';
    }
    if (fase === 'finale') {
      return 'Siamo nel finale: attiva il re (è un pezzo forte!), spingi i pedoni passati e metti le torri dietro di essi.';
    }
    return 'Mediogioco: cerca il pezzo avversario non difeso, le colonne aperte per le torri e le case debole intorno al re nemico.';
  }

  global.ChessCoach = {
    explainMove: explainMove,
    threats: threats,
    opponentThreat: opponentThreat,
    hints: hints,
    judge: judge,
    phaseAdvice: phaseAdvice,
    attacksFrom: attacksFrom,
    targetsFrom: targetsFrom,
    pinsFrom: pinsFrom,
    phaseOf: phaseOf,
    ART: ART, NOME: NOME, PUNTI: PUNTI
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ChessCoach;
})(typeof window !== 'undefined' ? window : globalThis);
