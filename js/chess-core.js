/*!
 * chess-core.js — Motore di regole degli scacchi, vanilla JS, zero dipendenze.
 * Rappresentazione 0x88. API ispirata a chess.js ma scritta da zero.
 */
(function (global) {
  'use strict';

  var WHITE = 0, BLACK = 1;
  var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

  var FLAGS = { NORMAL: 1, CAPTURE: 2, BIG_PAWN: 4, EP: 8, PROMO: 16, KCASTLE: 32, QCASTLE: 64 };
  var CR = { WK: 1, WQ: 2, BK: 4, BQ: 8 };

  var SYMBOL = { 1: '', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  var CHAR_FROM_TYPE = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };
  var TYPE_FROM_CHAR = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
  var NAME_IT = { 1: 'pedone', 2: 'cavallo', 3: 'alfiere', 4: 'torre', 5: 'donna', 6: 're' };
  var VALUE = { 1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 20000 };

  var KNIGHT_OFFS = [-33, -31, -18, -14, 14, 18, 31, 33];
  var BISHOP_OFFS = [-17, -15, 15, 17];
  var ROOK_OFFS = [-16, -1, 1, 16];
  var KING_OFFS = [-17, -16, -15, -1, 1, 15, 16, 17];
  var PROMO_TYPES = [QUEEN, ROOK, BISHOP, KNIGHT];

  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  function onBoard(sq) { return (sq & 0x88) === 0; }
  function fileOf(sq) { return sq & 7; }
  function rankOf(sq) { return sq >> 4; }            // 0 = ottava traversa
  function algebraic(sq) { return 'abcdefgh'[sq & 7] + (8 - (sq >> 4)); }
  function squareOf(alg) {
    if (typeof alg !== 'string' || alg.length < 2) return -1;
    var f = 'abcdefgh'.indexOf(alg[0].toLowerCase());
    var r = 8 - parseInt(alg[1], 10);
    if (f < 0 || isNaN(r) || r < 0 || r > 7) return -1;
    return r * 16 + f;
  }
  function colorOf(p) { return p >> 3; }
  function typeOf(p) { return p & 7; }
  function mk(type, color) { return type | (color << 3); }
  function other(c) { return c === WHITE ? BLACK : WHITE; }

  // ---------------------------------------------------------------- Chess
  function Chess(fen) {
    this.board = new Int32Array(128);
    this.kings = [-1, -1];
    this.turn = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfMoves = 0;
    this.moveNumber = 1;
    this.history = [];
    this.posCount = Object.create(null);
    this.load(fen || START_FEN);
  }

  Chess.prototype.clear = function () {
    this.board = new Int32Array(128);
    this.kings = [-1, -1];
    this.turn = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfMoves = 0;
    this.moveNumber = 1;
    this.history = [];
    this.posCount = Object.create(null);
  };

  Chess.prototype.load = function (fen) {
    var parts = String(fen).trim().split(/\s+/);
    if (parts.length < 2) return false;
    this.clear();
    var rows = parts[0].split('/');
    if (rows.length !== 8) return false;
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if (/[1-8]/.test(ch)) { f += parseInt(ch, 10); continue; }
        var low = ch.toLowerCase();
        if (!TYPE_FROM_CHAR[low]) return false;
        var color = ch === low ? BLACK : WHITE;
        var piece = mk(TYPE_FROM_CHAR[low], color);
        var sq = r * 16 + f;
        if (!onBoard(sq)) return false;
        this.board[sq] = piece;
        if (typeOf(piece) === KING) this.kings[color] = sq;
        f++;
      }
    }
    this.turn = parts[1] === 'b' ? BLACK : WHITE;
    var cs = parts[2] || '-';
    if (cs.indexOf('K') >= 0) this.castling |= CR.WK;
    if (cs.indexOf('Q') >= 0) this.castling |= CR.WQ;
    if (cs.indexOf('k') >= 0) this.castling |= CR.BK;
    if (cs.indexOf('q') >= 0) this.castling |= CR.BQ;
    this.ep = (parts[3] && parts[3] !== '-') ? squareOf(parts[3]) : -1;
    this.halfMoves = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
    this.moveNumber = parts[5] ? parseInt(parts[5], 10) || 1 : 1;
    this.posCount[this.positionKey()] = 1;
    return true;
  };

  Chess.prototype.reset = function () { this.load(START_FEN); };

  Chess.prototype.fen = function () {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = this.board[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        var ch = CHAR_FROM_TYPE[typeOf(p)];
        out += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    var cs = '';
    if (this.castling & CR.WK) cs += 'K';
    if (this.castling & CR.WQ) cs += 'Q';
    if (this.castling & CR.BK) cs += 'k';
    if (this.castling & CR.BQ) cs += 'q';
    return out + ' ' + (this.turn === WHITE ? 'w' : 'b') + ' ' + (cs || '-') + ' ' +
      (this.ep >= 0 ? algebraic(this.ep) : '-') + ' ' + this.halfMoves + ' ' + this.moveNumber;
  };

  Chess.prototype.positionKey = function () {
    var f = this.fen().split(' ');
    return f[0] + ' ' + f[1] + ' ' + f[2] + ' ' + f[3];
  };

  Chess.prototype.get = function (alg) {
    var sq = squareOf(alg);
    if (sq < 0) return null;
    var p = this.board[sq];
    if (!p) return null;
    return { type: CHAR_FROM_TYPE[typeOf(p)], color: colorOf(p) === WHITE ? 'w' : 'b' };
  };

  Chess.prototype.turnColor = function () { return this.turn === WHITE ? 'w' : 'b'; };

  // -------------------------------------------------------------- attacchi
  Chess.prototype.isAttacked = function (sq, byColor) {
    var b = this.board, i, t, s, p;
    // pedoni
    if (byColor === WHITE) {
      if (onBoard(sq + 15) && b[sq + 15] === mk(PAWN, WHITE)) return true;
      if (onBoard(sq + 17) && b[sq + 17] === mk(PAWN, WHITE)) return true;
    } else {
      if (onBoard(sq - 15) && b[sq - 15] === mk(PAWN, BLACK)) return true;
      if (onBoard(sq - 17) && b[sq - 17] === mk(PAWN, BLACK)) return true;
    }
    // cavalli
    for (i = 0; i < 8; i++) {
      s = sq + KNIGHT_OFFS[i];
      if (onBoard(s) && b[s] === mk(KNIGHT, byColor)) return true;
    }
    // re
    for (i = 0; i < 8; i++) {
      s = sq + KING_OFFS[i];
      if (onBoard(s) && b[s] === mk(KING, byColor)) return true;
    }
    // diagonali (alfiere / donna)
    for (i = 0; i < 4; i++) {
      s = sq + BISHOP_OFFS[i];
      while (onBoard(s)) {
        p = b[s];
        if (p) {
          if (colorOf(p) === byColor) { t = typeOf(p); if (t === BISHOP || t === QUEEN) return true; }
          break;
        }
        s += BISHOP_OFFS[i];
      }
    }
    // linee (torre / donna)
    for (i = 0; i < 4; i++) {
      s = sq + ROOK_OFFS[i];
      while (onBoard(s)) {
        p = b[s];
        if (p) {
          if (colorOf(p) === byColor) { t = typeOf(p); if (t === ROOK || t === QUEEN) return true; }
          break;
        }
        s += ROOK_OFFS[i];
      }
    }
    return false;
  };

  /** Elenco delle case da cui `byColor` attacca `sq` (utile al coach). */
  Chess.prototype.attackersOf = function (sq, byColor) {
    var b = this.board, res = [], i, s, p, t;
    if (byColor === WHITE) {
      if (onBoard(sq + 15) && b[sq + 15] === mk(PAWN, WHITE)) res.push(sq + 15);
      if (onBoard(sq + 17) && b[sq + 17] === mk(PAWN, WHITE)) res.push(sq + 17);
    } else {
      if (onBoard(sq - 15) && b[sq - 15] === mk(PAWN, BLACK)) res.push(sq - 15);
      if (onBoard(sq - 17) && b[sq - 17] === mk(PAWN, BLACK)) res.push(sq - 17);
    }
    for (i = 0; i < 8; i++) {
      s = sq + KNIGHT_OFFS[i];
      if (onBoard(s) && b[s] === mk(KNIGHT, byColor)) res.push(s);
    }
    for (i = 0; i < 8; i++) {
      s = sq + KING_OFFS[i];
      if (onBoard(s) && b[s] === mk(KING, byColor)) res.push(s);
    }
    for (i = 0; i < 4; i++) {
      s = sq + BISHOP_OFFS[i];
      while (onBoard(s)) {
        p = b[s];
        if (p) {
          if (colorOf(p) === byColor) { t = typeOf(p); if (t === BISHOP || t === QUEEN) res.push(s); }
          break;
        }
        s += BISHOP_OFFS[i];
      }
    }
    for (i = 0; i < 4; i++) {
      s = sq + ROOK_OFFS[i];
      while (onBoard(s)) {
        p = b[s];
        if (p) {
          if (colorOf(p) === byColor) { t = typeOf(p); if (t === ROOK || t === QUEEN) res.push(s); }
          break;
        }
        s += ROOK_OFFS[i];
      }
    }
    return res;
  };

  Chess.prototype.inCheck = function (color) {
    var c = color === undefined ? this.turn : color;
    if (this.kings[c] < 0) return false;
    return this.isAttacked(this.kings[c], other(c));
  };

  // ------------------------------------------------------ generazione mosse
  function addMove(list, board, from, to, flags) {
    var piece = board[from];
    if (typeOf(piece) === PAWN && (rankOf(to) === 0 || rankOf(to) === 7)) {
      for (var i = 0; i < 4; i++) {
        list.push({ from: from, to: to, piece: piece, captured: board[to] || 0,
          promotion: PROMO_TYPES[i], flags: flags | FLAGS.PROMO });
      }
    } else {
      list.push({ from: from, to: to, piece: piece,
        captured: (flags & FLAGS.EP) ? mk(PAWN, other(colorOf(piece))) : (board[to] || 0),
        promotion: 0, flags: flags });
    }
  }

  /** Mosse pseudo-legali. opts: {square, capturesOnly} */
  Chess.prototype.generatePseudo = function (opts) {
    opts = opts || {};
    var b = this.board, us = this.turn, them = other(us), moves = [];
    var first = 0, last = 119;
    if (opts.square !== undefined && opts.square >= 0) { first = last = opts.square; }
    for (var from = first; from <= last; from++) {
      if (!onBoard(from)) { from += 7; continue; }
      var p = b[from];
      if (!p || colorOf(p) !== us) continue;
      var t = typeOf(p), i, s, to;

      if (t === PAWN) {
        var push = us === WHITE ? -16 : 16;
        var startRank = us === WHITE ? 6 : 1;
        if (!opts.capturesOnly) {
          to = from + push;
          if (onBoard(to) && !b[to]) {
            addMove(moves, b, from, to, FLAGS.NORMAL);
            var to2 = from + 2 * push;
            if (rankOf(from) === startRank && onBoard(to2) && !b[to2]) {
              addMove(moves, b, from, to2, FLAGS.BIG_PAWN);
            }
          }
        }
        var caps = us === WHITE ? [-17, -15] : [15, 17];
        for (i = 0; i < 2; i++) {
          to = from + caps[i];
          if (!onBoard(to)) continue;
          if (b[to] && colorOf(b[to]) === them) addMove(moves, b, from, to, FLAGS.CAPTURE);
          else if (to === this.ep) addMove(moves, b, from, to, FLAGS.EP | FLAGS.CAPTURE);
        }
        continue;
      }

      if (t === KNIGHT || t === KING) {
        var offs = t === KNIGHT ? KNIGHT_OFFS : KING_OFFS;
        for (i = 0; i < 8; i++) {
          to = from + offs[i];
          if (!onBoard(to)) continue;
          if (!b[to]) { if (!opts.capturesOnly) addMove(moves, b, from, to, FLAGS.NORMAL); }
          else if (colorOf(b[to]) === them) addMove(moves, b, from, to, FLAGS.CAPTURE);
        }
      } else {
        var dirs = t === BISHOP ? BISHOP_OFFS : (t === ROOK ? ROOK_OFFS : KING_OFFS);
        for (i = 0; i < dirs.length; i++) {
          s = from + dirs[i];
          while (onBoard(s)) {
            if (!b[s]) {
              if (!opts.capturesOnly) addMove(moves, b, from, s, FLAGS.NORMAL);
            } else {
              if (colorOf(b[s]) === them) addMove(moves, b, from, s, FLAGS.CAPTURE);
              break;
            }
            s += dirs[i];
          }
        }
      }
    }

    // arrocco
    if (!opts.capturesOnly && (opts.square === undefined || opts.square === this.kings[us])) {
      var kSq = this.kings[us];
      if (kSq >= 0 && !this.isAttacked(kSq, them)) {
        var kRight = us === WHITE ? CR.WK : CR.BK;
        var qRight = us === WHITE ? CR.WQ : CR.BQ;
        if ((this.castling & kRight) && !b[kSq + 1] && !b[kSq + 2] &&
            b[kSq + 3] === mk(ROOK, us) &&
            !this.isAttacked(kSq + 1, them) && !this.isAttacked(kSq + 2, them)) {
          moves.push({ from: kSq, to: kSq + 2, piece: b[kSq], captured: 0, promotion: 0, flags: FLAGS.KCASTLE });
        }
        if ((this.castling & qRight) && !b[kSq - 1] && !b[kSq - 2] && !b[kSq - 3] &&
            b[kSq - 4] === mk(ROOK, us) &&
            !this.isAttacked(kSq - 1, them) && !this.isAttacked(kSq - 2, them)) {
          moves.push({ from: kSq, to: kSq - 2, piece: b[kSq], captured: 0, promotion: 0, flags: FLAGS.QCASTLE });
        }
      }
    }
    return moves;
  };

  /** Mosse legali (oggetti interni). */
  Chess.prototype.legalMoves = function (opts) {
    var pseudo = this.generatePseudo(opts), legal = [], us = this.turn, them = other(us);
    for (var i = 0; i < pseudo.length; i++) {
      this.makeMoveFast(pseudo[i]);
      if (!this.isAttacked(this.kings[us], them)) legal.push(pseudo[i]);
      this.undoMoveFast();
    }
    return legal;
  };

  /** API pubblica: array di SAN, oppure oggetti dettagliati con {verbose:true}. */
  Chess.prototype.moves = function (opts) {
    opts = opts || {};
    var sqOpt = opts.square ? squareOf(opts.square) : undefined;
    var legal = this.legalMoves(sqOpt !== undefined ? { square: sqOpt } : undefined);
    var all = sqOpt !== undefined ? this.legalMoves() : legal;
    var out = [];
    for (var i = 0; i < legal.length; i++) {
      var san = this.moveToSan(legal[i], all);
      if (opts.verbose) {
        out.push(this.describe(legal[i], san));
      } else out.push(san);
    }
    return out;
  };

  Chess.prototype.describe = function (m, san) {
    return {
      from: algebraic(m.from), to: algebraic(m.to),
      fromSq: m.from, toSq: m.to,
      piece: CHAR_FROM_TYPE[typeOf(m.piece)],
      color: colorOf(m.piece) === WHITE ? 'w' : 'b',
      captured: m.captured ? CHAR_FROM_TYPE[typeOf(m.captured)] : undefined,
      promotion: m.promotion ? CHAR_FROM_TYPE[m.promotion] : undefined,
      flags: m.flags,
      san: san || this.moveToSan(m, this.legalMoves()),
      _raw: m
    };
  };

  // ------------------------------------------------------------- make/undo
  Chess.prototype.makeMoveFast = function (m) {
    var b = this.board, us = colorOf(m.piece);
    this.history.push({
      move: m, turn: this.turn, castling: this.castling, ep: this.ep,
      halfMoves: this.halfMoves, moveNumber: this.moveNumber,
      kingW: this.kings[0], kingB: this.kings[1]
    });

    b[m.to] = b[m.from];
    b[m.from] = 0;

    if (m.flags & FLAGS.EP) {
      b[m.to + (us === WHITE ? 16 : -16)] = 0;
    }
    if (m.flags & FLAGS.PROMO) {
      b[m.to] = mk(m.promotion, us);
    }
    if (typeOf(m.piece) === KING) {
      this.kings[us] = m.to;
      if (m.flags & FLAGS.KCASTLE) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
      if (m.flags & FLAGS.QCASTLE) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
      this.castling &= us === WHITE ? ~(CR.WK | CR.WQ) : ~(CR.BK | CR.BQ);
    }
    // diritti di arrocco persi muovendo/catturando una torre d'angolo
    if (m.from === 119 || m.to === 119) this.castling &= ~CR.WK;
    if (m.from === 112 || m.to === 112) this.castling &= ~CR.WQ;
    if (m.from === 7 || m.to === 7) this.castling &= ~CR.BK;
    if (m.from === 0 || m.to === 0) this.castling &= ~CR.BQ;

    this.ep = (m.flags & FLAGS.BIG_PAWN) ? (m.from + m.to) / 2 : -1;

    if (typeOf(m.piece) === PAWN || m.captured) this.halfMoves = 0;
    else this.halfMoves++;
    if (this.turn === BLACK) this.moveNumber++;
    this.turn = other(this.turn);
  };

  Chess.prototype.undoMoveFast = function () {
    var h = this.history.pop();
    if (!h) return null;
    var m = h.move, b = this.board, us = colorOf(m.piece);
    this.turn = h.turn; this.castling = h.castling; this.ep = h.ep;
    this.halfMoves = h.halfMoves; this.moveNumber = h.moveNumber;
    this.kings[0] = h.kingW; this.kings[1] = h.kingB;

    b[m.from] = m.piece;
    b[m.to] = 0;
    if (m.flags & FLAGS.EP) {
      b[m.to + (us === WHITE ? 16 : -16)] = mk(PAWN, other(us));
    } else if (m.captured) {
      b[m.to] = m.captured;
    }
    if (m.flags & FLAGS.KCASTLE) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
    if (m.flags & FLAGS.QCASTLE) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
    return m;
  };

  // -------------------------------------------------------------------- SAN
  Chess.prototype.moveToSan = function (m, allMoves) {
    var out;
    if (m.flags & FLAGS.KCASTLE) out = 'O-O';
    else if (m.flags & FLAGS.QCASTLE) out = 'O-O-O';
    else {
      var t = typeOf(m.piece);
      out = '';
      if (t !== PAWN) {
        out += SYMBOL[t];
        // disambiguazione
        var sameFile = false, sameRank = false, ambiguous = false;
        var list = allMoves || this.legalMoves();
        for (var i = 0; i < list.length; i++) {
          var o = list[i];
          if (o.from === m.from || o.to !== m.to) continue;
          if (typeOf(o.piece) !== t) continue;
          ambiguous = true;
          if (fileOf(o.from) === fileOf(m.from)) sameFile = true;
          if (rankOf(o.from) === rankOf(m.from)) sameRank = true;
        }
        if (ambiguous) {
          if (!sameFile) out += 'abcdefgh'[fileOf(m.from)];
          else if (!sameRank) out += String(8 - rankOf(m.from));
          else out += algebraic(m.from);
        }
      }
      if (m.flags & (FLAGS.CAPTURE | FLAGS.EP)) {
        if (t === PAWN) out += 'abcdefgh'[fileOf(m.from)];
        out += 'x';
      }
      out += algebraic(m.to);
      if (m.flags & FLAGS.PROMO) out += '=' + SYMBOL[m.promotion];
    }
    this.makeMoveFast(m);
    if (this.isCheckmate()) out += '#';
    else if (this.inCheck()) out += '+';
    this.undoMoveFast();
    return out;
  };

  function normalizeSan(s) {
    return String(s).replace(/[+#]?[!?]*$/, '').replace(/0/g, 'O').replace(/\s/g, '');
  }

  /** Trova la mossa legale corrispondente a una SAN (tollerante). */
  Chess.prototype.findMoveBySan = function (san) {
    var want = normalizeSan(san);
    var list = this.legalMoves();
    for (var i = 0; i < list.length; i++) {
      if (normalizeSan(this.moveToSan(list[i], list)) === want) return list[i];
    }
    // tentativo: SAN senza disambiguazione o con casa di partenza esplicita (e2e4)
    var m2 = /^([a-h][1-8])[-x]?([a-h][1-8])([qrbn])?$/i.exec(want);
    if (m2) {
      var f = squareOf(m2[1]), t = squareOf(m2[2]);
      for (var j = 0; j < list.length; j++) {
        if (list[j].from === f && list[j].to === t) {
          if (m2[3] && list[j].promotion !== TYPE_FROM_CHAR[m2[3].toLowerCase()]) continue;
          return list[j];
        }
      }
    }
    return null;
  };

  /**
   * Esegue una mossa.
   * Accetta: 'Nf3' | {from:'e2', to:'e4', promotion:'q'} | oggetto interno.
   * Ritorna l'oggetto descrittivo o null.
   */
  Chess.prototype.move = function (arg) {
    var all = this.legalMoves(), found = null, i;
    if (typeof arg === 'string') {
      found = this.findMoveBySan(arg);
    } else if (arg && arg.from !== undefined) {
      var f = typeof arg.from === 'number' ? arg.from : squareOf(arg.from);
      var t = typeof arg.to === 'number' ? arg.to : squareOf(arg.to);
      var promo = arg.promotion ? (typeof arg.promotion === 'number' ? arg.promotion : TYPE_FROM_CHAR[String(arg.promotion).toLowerCase()]) : 0;
      for (i = 0; i < all.length; i++) {
        if (all[i].from === f && all[i].to === t) {
          if (all[i].flags & FLAGS.PROMO) {
            if (all[i].promotion !== (promo || QUEEN)) continue;
          }
          found = all[i];
          break;
        }
      }
    }
    if (!found) return null;
    var san = this.moveToSan(found, all);
    var desc = this.describe(found, san);
    desc.before = this.fen();
    this.makeMoveFast(found);
    desc.after = this.fen();
    var key = this.positionKey();
    this.posCount[key] = (this.posCount[key] || 0) + 1;
    this.history[this.history.length - 1].san = san;
    this.history[this.history.length - 1].posKey = key;
    return desc;
  };

  Chess.prototype.undo = function () {
    if (!this.history.length) return null;
    var key = this.history[this.history.length - 1].posKey;
    if (key && this.posCount[key]) this.posCount[key]--;
    var m = this.undoMoveFast();
    return m ? this.describe(m) : null;
  };

  Chess.prototype.historySan = function () {
    return this.history.map(function (h) { return h.san; });
  };

  // ------------------------------------------------------------- fine gioco
  Chess.prototype.isCheckmate = function () {
    return this.inCheck() && this.legalMoves().length === 0;
  };
  Chess.prototype.isStalemate = function () {
    return !this.inCheck() && this.legalMoves().length === 0;
  };
  Chess.prototype.isInsufficientMaterial = function () {
    var counts = {}, total = 0, bishops = [];
    for (var sq = 0; sq <= 119; sq++) {
      if (!onBoard(sq)) { sq += 7; continue; }
      var p = this.board[sq];
      if (!p) continue;
      var t = typeOf(p);
      counts[t] = (counts[t] || 0) + 1;
      if (t === BISHOP) bishops.push((fileOf(sq) + rankOf(sq)) % 2);
      if (t !== KING) total++;
    }
    if (total === 0) return true;
    if (total === 1 && (counts[KNIGHT] === 1 || counts[BISHOP] === 1)) return true;
    if (total === 2 && counts[BISHOP] === 2 && bishops[0] === bishops[1]) return true;
    return false;
  };
  Chess.prototype.isThreefold = function () {
    return (this.posCount[this.positionKey()] || 0) >= 3;
  };
  Chess.prototype.isDraw = function () {
    return this.isStalemate() || this.isInsufficientMaterial() ||
      this.halfMoves >= 100 || this.isThreefold();
  };
  Chess.prototype.isGameOver = function () {
    return this.isCheckmate() || this.isDraw();
  };
  Chess.prototype.gameResult = function () {
    if (this.isCheckmate()) {
      return { over: true, winner: this.turn === WHITE ? 'b' : 'w', reason: 'scacco matto' };
    }
    if (this.isStalemate()) return { over: true, winner: null, reason: 'stallo (patta)' };
    if (this.isInsufficientMaterial()) return { over: true, winner: null, reason: 'materiale insufficiente (patta)' };
    if (this.isThreefold()) return { over: true, winner: null, reason: 'tripla ripetizione (patta)' };
    if (this.halfMoves >= 100) return { over: true, winner: null, reason: 'regola delle 50 mosse (patta)' };
    return { over: false };
  };

  // -------------------------------------------------------------- utilities
  Chess.prototype.clone = function () {
    var c = new Chess(this.fen());
    return c;
  };

  /** Matrice 8x8 dall'alto (a8) in oggetti {type,color,square} o null. */
  Chess.prototype.boardArray = function () {
    var out = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var f = 0; f < 8; f++) {
        var sq = r * 16 + f, p = this.board[sq];
        row.push(p ? { type: CHAR_FROM_TYPE[typeOf(p)], color: colorOf(p) === WHITE ? 'w' : 'b', square: algebraic(sq) } : null);
      }
      out.push(row);
    }
    return out;
  };

  Chess.prototype.pieceSquares = function (color) {
    var c = color === 'w' ? WHITE : (color === 'b' ? BLACK : color), out = [];
    for (var sq = 0; sq <= 119; sq++) {
      if (!onBoard(sq)) { sq += 7; continue; }
      var p = this.board[sq];
      if (p && colorOf(p) === c) out.push(sq);
    }
    return out;
  };

  Chess.prototype.materialCount = function () {
    var m = [0, 0];
    for (var sq = 0; sq <= 119; sq++) {
      if (!onBoard(sq)) { sq += 7; continue; }
      var p = this.board[sq];
      if (p && typeOf(p) !== KING) m[colorOf(p)] += VALUE[typeOf(p)];
    }
    return { w: m[0], b: m[1], diff: m[0] - m[1] };
  };

  var api = {
    Chess: Chess,
    WHITE: WHITE, BLACK: BLACK,
    PAWN: PAWN, KNIGHT: KNIGHT, BISHOP: BISHOP, ROOK: ROOK, QUEEN: QUEEN, KING: KING,
    FLAGS: FLAGS, CR: CR, VALUE: VALUE, NAME_IT: NAME_IT, SYMBOL: SYMBOL,
    CHAR_FROM_TYPE: CHAR_FROM_TYPE, TYPE_FROM_CHAR: TYPE_FROM_CHAR,
    START_FEN: START_FEN,
    onBoard: onBoard, fileOf: fileOf, rankOf: rankOf, algebraic: algebraic,
    squareOf: squareOf, colorOf: colorOf, typeOf: typeOf, mk: mk, other: other
  };

  global.ChessCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
