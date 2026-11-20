/*!
 * ui.js — Interfaccia: scacchiera interattiva, coach, trainer di aperture,
 * puzzle tattici, finali, statistiche. Nessuna dipendenza esterna.
 */
(function () {
  'use strict';

  var C = window.ChessCore, E = window.ChessEngine, K = window.ChessCoach;
  var O = window.ChessOpenings, PZ = window.ChessPuzzles;
  var Chess = C.Chess;
  var START = C.START_FEN;

  var GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  var FILES = 'abcdefgh';

  function $(id) { return document.getElementById(id); }
  function elt(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function norm(san) { return String(san).replace(/[+#!?]/g, '').replace(/0/g, 'O'); }

  // ----------------------------------------------------------------- memoria
  var STORE_KEY = 'coachscacchi.v1';
  function loadStats() {
    var d = { partite: 0, vinte: 0, puzzleRisolti: [], puzzleTentati: 0, puzzleOk: 0, aperture: [], serie: 0,
      livello: 2, profilo: {}, revisioni: 0, storicoAcc: [], ultimaAcc: null, ultimoRating: null, accSomma: 0 };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var p = JSON.parse(raw); for (var k in d) if (p[k] !== undefined) d[k] = p[k]; }
    } catch (e) { /* niente storage: si gioca comunque */ }
    return d;
  }
  function saveStats() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S.stats)); } catch (e) {} }

  // ------------------------------------------------------------------- stato
  var S = {
    mode: 'gioca',
    game: new Chess(),
    startFen: START,
    line: [],            // [{san, fenAfter, desc, explain, judge, byHuman}]
    cursor: 0,
    orientation: 'w',
    human: 'w',
    level: 2,
    colorChoice: 'w',
    thinking: false,
    sel: -1,
    targets: [],
    arrows: [],
    opts: { blunder: true, legal: true, threats: true, evalbar: false },
    cache: {},
    trainer: null,
    puzzle: null,
    puzzleFilter: 'tutti',
    endgame: null,
    pendingPromo: null,
    gen: 0,                // cambia a ogni nuova posizione: invalida i calcoli in corso
    stats: loadStats()
  };
  S.level = S.stats.livello || 2;

  // ------------------------------------------------------- utilità posizione
  function fenAt(cursor) { return cursor === 0 ? S.startFen : S.line[cursor - 1].fenAfter; }
  function viewGame() {
    if (S.cursor === S.line.length) return S.game;
    if (!S._vg) S._vg = new Chess();
    S._vg.load(fenAt(S.cursor));
    return S._vg;
  }
  function isLive() { return S.cursor === S.line.length; }
  function humanTurn() {
    if (S.mode === 'puzzle') return !!(S.puzzle && !S.puzzle.solved);
    if (S.mode === 'aperture') return !!S.trainer && S.trainer.waiting;
    return S.game.turnColor() === S.human;
  }

  function analyzeCached(game, depth, timeMs) {
    var fen = game.fen();
    if (S.cache.fen === fen && S.cache.depth >= depth) return S.cache.res;
    var res = E.analyze(game, { depth: depth, timeMs: timeMs });
    S.cache = { fen: fen, depth: depth, res: res };
    return res;
  }

  function truncateTo(n) {
    while (S.line.length > n) { S.game.undo(); S.line.pop(); }
    S.cursor = S.line.length;
  }

  // ------------------------------------------------------------- scacchiera
  var boardEl = $('board'), arrowsEl = $('arrows');

  var cells = {};          // casa -> {el, piece, dot, marker, coordF, coordR, stato}
  var boardBuilt = false;

  function squareList() {
    var out = [];
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) out.push(r * 16 + f);
    return out;
  }

  /**
   * Costruisce le 64 case UNA VOLTA SOLA. Tutti gli aggiornamenti successivi
   * modificano solo gli attributi che cambiano: niente ricostruzione del DOM,
   * quindi niente sfarfallio e niente salti della pagina a ogni mossa.
   */
  function buildBoard() {
    clear(boardEl);
    cells = {};
    squareList().forEach(function (sq) {
      var el = elt('div', 'sq');
      el.dataset.sq = sq;
      var piece = elt('span', 'piece');
      var dot = elt('span', '');
      var marker = elt('span', '');
      var coordF = elt('span', 'coord f');
      var coordR = elt('span', 'coord r');
      el.appendChild(piece); el.appendChild(dot); el.appendChild(marker);
      el.appendChild(coordF); el.appendChild(coordR);
      boardEl.appendChild(el);
      cells[sq] = { el: el, piece: piece, dot: dot, marker: marker, coordF: coordF, coordR: coordR, stato: {} };
    });
    boardBuilt = true;
  }

  /** Riordina le case quando si gira la scacchiera (senza ricrearle). */
  function applyOrientation() {
    var list = squareList();
    var ordered = S.orientation === 'w' ? list : list.slice().reverse();
    ordered.forEach(function (sq, i) {
      var c = cells[sq];
      c.el.style.order = i;
      var f = C.fileOf(sq), r = C.rankOf(sq);
      var edgeBottom = S.orientation === 'w' ? r === 7 : r === 0;
      var edgeLeft = S.orientation === 'w' ? f === 0 : f === 7;
      c.coordF.textContent = edgeBottom ? FILES[f] : '';
      c.coordR.textContent = edgeLeft ? String(8 - r) : '';
    });
  }

  /** Animazione breve del pezzo che si sposta (niente "scatto"). */
  function animateMove(fromSq, toSq) {
    var a = cells[fromSq], b = cells[toSq];
    if (!a || !b || !b.piece.textContent) return;
    var ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
    var dx = ra.left - rb.left, dy = ra.top - rb.top;
    if (!dx && !dy) return;
    b.piece.style.transition = 'none';
    b.piece.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    b.piece.getBoundingClientRect();        // forza il ricalcolo
    b.piece.style.transition = 'transform .16s ease-out';
    b.piece.style.transform = '';
    setTimeout(function () { b.piece.style.transition = ''; }, 200);
  }

  function render() {
    var g = viewGame();
    var last = S.cursor > 0 ? S.line[S.cursor - 1] : null;
    var lastFrom = last ? C.squareOf(last.desc.from) : -1;
    var lastTo = last ? C.squareOf(last.desc.to) : -1;
    var checkSq = g.inCheck() ? g.kings[g.turn] : -1;
    var hanging = [];
    // nei puzzle non si segnalano i pezzi in presa: sarebbe un aiuto gratis
    if (S.opts.threats && isLive() && (S.mode === 'gioca' || S.mode === 'finali')) {
      var side = S.human === 'w' ? C.WHITE : C.BLACK;
      if (g.turn === side) {
        hanging = E.hangingPieces(g, side).map(function (h) { return h.sq; });
      }
    }

    if (!boardBuilt) { buildBoard(); S.lastOrientation = null; }
    if (S.lastOrientation !== S.orientation) { applyOrientation(); S.lastOrientation = S.orientation; }

    var list = squareList();
    for (var i = 0; i < list.length; i++) {
      var sq = list[i], f = C.fileOf(sq), r = C.rankOf(sq);
      var c = cells[sq], st = c.stato;

      var cls = 'sq ' + ((f + r) % 2 === 0 ? 'light' : 'dark');
      if (sq === lastFrom || sq === lastTo) cls += ' last';
      if (sq === S.sel) cls += ' sel';
      if (sq === checkSq) cls += ' check';
      if (hanging.indexOf(sq) >= 0) cls += ' hangs';
      if (st.cls !== cls) { c.el.className = cls; st.cls = cls; }

      var p = g.board[sq];
      var glyph = p ? GLYPH[C.CHAR_FROM_TYPE[C.typeOf(p)]] : '';
      var pcls = p ? 'piece ' + (C.colorOf(p) === C.WHITE ? 'w' : 'b') : 'piece empty';
      if (st.glyph !== glyph) { c.piece.textContent = glyph; st.glyph = glyph; }
      if (st.pcls !== pcls) { c.piece.className = pcls; st.pcls = pcls; }

      var dcls = (S.opts.legal && S.targets.indexOf(sq) >= 0) ? (p ? 'ring' : 'dot') : '';
      if (st.dcls !== dcls) { c.dot.className = dcls; st.dcls = dcls; }

      var mcls = '', micon = '';
      if (last && sq === lastTo && last.judge && last.byHuman) {
        mcls = 'marker ' + last.judge.judgement.cls;
        micon = last.judge.judgement.icon;
      }
      if (st.mcls !== mcls) { c.marker.className = mcls; st.mcls = mcls; }
      if (st.micon !== micon) { c.marker.textContent = micon; st.micon = micon; }
    }
    drawArrows();
    renderPlayers(g);
    renderMoves();
    updateEvalbar();
    if (S.anim) { animateMove(S.anim.from, S.anim.to); S.anim = null; }
  }

  function sqToXY(sq) {
    var f = C.fileOf(sq), r = C.rankOf(sq);
    var x = S.orientation === 'w' ? f : 7 - f;
    var y = S.orientation === 'w' ? r : 7 - r;
    return { x: x + 0.5, y: y + 0.5 };
  }

  function drawArrows() {
    clear(arrowsEl);
    if (!S.arrows.length) return;
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    arrowsEl.appendChild(defs);
    for (var i = 0; i < S.arrows.length; i++) {
      var a = S.arrows[i];
      var p1 = sqToXY(a.from), p2 = sqToXY(a.to);
      var dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var endX = p2.x - ux * 0.34, endY = p2.y - uy * 0.34;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x + ux * 0.22); line.setAttribute('y1', p1.y + uy * 0.22);
      line.setAttribute('x2', endX); line.setAttribute('y2', endY);
      line.setAttribute('stroke', a.color || '#f0b429');
      line.setAttribute('stroke-width', '0.14');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.9');
      arrowsEl.appendChild(line);
      var head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      var px = -uy, py = ux, s = 0.17;
      head.setAttribute('points',
        (endX + ux * s * 1.6) + ',' + (endY + uy * s * 1.6) + ' ' +
        (endX + px * s) + ',' + (endY + py * s) + ' ' +
        (endX - px * s) + ',' + (endY - py * s));
      head.setAttribute('fill', a.color || '#f0b429');
      head.setAttribute('opacity', '0.9');
      arrowsEl.appendChild(head);
    }
  }

  function renderPlayers(g) {
    var topIsHuman = S.orientation !== S.human;
    var humanName = 'Tu', cpuName = 'Computer';
    if (S.mode === 'puzzle') { humanName = 'Tocca a te'; cpuName = 'Avversario'; }
    var lv = E.LEVELS[S.level - 1];
    $('nameTop').textContent = topIsHuman ? humanName : cpuName + (S.mode === 'gioca' || S.mode === 'finali' ? ' · ' + lv.name : '');
    $('nameBottom').textContent = topIsHuman ? cpuName + (S.mode === 'gioca' || S.mode === 'finali' ? ' · ' + lv.name : '') : humanName;
    $('avatarTop').textContent = topIsHuman ? '🧑' : '🤖';
    $('avatarBottom').textContent = topIsHuman ? '🤖' : '🧑';

    var mat = g.materialCount();
    var diff = Math.round(mat.diff / 100);
    var topColor = S.orientation === 'w' ? 'b' : 'w';
    function badge(color) {
      var d = color === 'w' ? diff : -diff;
      return d > 0 ? '+' + d : '';
    }
    $('materialTop').textContent = badge(topColor);
    $('materialBottom').textContent = badge(topColor === 'w' ? 'b' : 'w');

    var capt = { w: [], b: [] };
    for (var i = 0; i < S.cursor; i++) {
      var d = S.line[i].desc;
      if (d.captured) capt[d.color === 'w' ? 'w' : 'b'].push(GLYPH[d.captured]);
    }
    $('capturedTop').textContent = (topColor === 'w' ? capt.b : capt.w).join('');
    $('capturedBottom').textContent = (topColor === 'w' ? capt.w : capt.b).join('');

    var turn = g.turnColor();
    $('playerTop').classList.toggle('turn', turn === topColor);
    $('playerBottom').classList.toggle('turn', turn !== topColor);
  }

  function renderMoves() {
    var box = $('movelist'), mini = $('opMoves');
    [box, mini].forEach(function (container) {
      if (!container) return;
      clear(container);
      var startsBlack = new Chess(S.startFen).turnColor() === 'b';
      var n = 0;
      if (startsBlack) {
        container.appendChild(elt('span', 'num', '1.'));
        container.appendChild(elt('span', 'mv', '…'));
        n = 1;
      }
      for (var i = 0; i < S.line.length; i++) {
        var idx = i + (startsBlack ? 1 : 0);
        if (idx % 2 === 0) container.appendChild(elt('span', 'num', (Math.floor(idx / 2) + 1) + '.'));
        var mv = elt('span', 'mv' + (S.cursor === i + 1 ? ' current' : ''));
        mv.appendChild(elt('span', '', S.line[i].san));
        if (S.line[i].judge && S.line[i].byHuman && S.line[i].judge.judgement.cls !== 'best' && S.line[i].judge.judgement.cls !== 'great') {
          mv.appendChild(elt('span', 'q ' + S.line[i].judge.judgement.cls, S.line[i].judge.judgement.icon));
        }
        mv.dataset.ply = i + 1;
        mv.addEventListener('click', function () { goTo(parseInt(this.dataset.ply, 10)); });
        container.appendChild(mv);
      }
    });
    var meta = $('movesMeta');
    if (meta) {
      var g = S.game, r = g.gameResult();
      meta.textContent = r.over ? 'Partita finita: ' + r.reason : (S.line.length ? Math.ceil(S.line.length / 2) + ' mosse' : '');
    }
  }

  function updateEvalbar() {
    var bar = $('evalbar');
    bar.classList.toggle('on', !!S.opts.evalbar);
    if (!S.opts.evalbar) return;
    var g = viewGame();
    var res = S.cache.fen === g.fen() ? S.cache.res : null;
    var score = res ? (g.turnColor() === 'w' ? res.score : -res.score) : (E.evaluate(g));
    var pct = 50 + 50 * Math.max(-1, Math.min(1, score / 800));
    $('evalbarFill').style.height = pct + '%';
    $('evalbarText').textContent = (score > 0 ? '+' : '') + (score / 100).toFixed(1);
  }

  // ------------------------------------------------------------- navigazione
  function goTo(cursor) {
    S.cursor = Math.max(0, Math.min(S.line.length, cursor));
    S.sel = -1; S.targets = []; S.arrows = [];
    render();
    if (S.mode === 'gioca' || S.mode === 'finali') showCoachForCursor();
  }
  $('navStart').addEventListener('click', function () { goTo(0); });
  $('navPrev').addEventListener('click', function () { goTo(S.cursor - 1); });
  $('navNext').addEventListener('click', function () { goTo(S.cursor + 1); });
  $('navEnd').addEventListener('click', function () { goTo(S.line.length); });
  $('btnFlip').addEventListener('click', function () {
    S.orientation = S.orientation === 'w' ? 'b' : 'w';
    render();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { goTo(S.cursor - 1); }
    else if (e.key === 'ArrowRight') { goTo(S.cursor + 1); }
    else if (e.key === 'h' || e.key === 'H') { if (S.mode === 'gioca' || S.mode === 'finali') showHint(); }
  });

  $('btnUndo').addEventListener('click', function () {
    if (S.thinking) return;
    if (S.mode === 'puzzle') { loadPuzzle(S.puzzle.p, true); return; }
    if (S.mode === 'aperture' && S.trainer) { trainerBack(); return; }
    // torna alla propria mossa precedente (annulla anche la risposta del computer)
    var n = S.line.length;
    if (!n) return;
    truncateTo(Math.max(0, S.line[n - 1].byHuman ? n - 1 : n - 2));
    S.cache = {};
    S.sel = -1; S.targets = []; S.arrows = [];
    render();
    coachSay('Mossa annullata', ['Rigioca da qui: prova una mossa diversa. Usa 💡 Suggerimento se vuoi un\'idea.'], []);
  });

  // ------------------------------------------------------- input scacchiera
  boardEl.addEventListener('click', function (ev) {
    var cell = ev.target.closest ? ev.target.closest('.sq') : null;
    if (!cell) return;
    onSquare(parseInt(cell.dataset.sq, 10));
  });

  function onSquare(sq) {
    if (S.thinking || S.pendingPromo) return;
    if (!isLive()) {
      // tornando indietro e muovendo si riparte da quel punto
      if (S.mode === 'gioca' || S.mode === 'finali') truncateTo(S.cursor);
      else { goTo(S.line.length); return; }
    }
    var g = S.game;
    if (g.isGameOver()) return;

    if (S.sel >= 0 && S.targets.indexOf(sq) >= 0) {
      tryUserMove(S.sel, sq);
      return;
    }
    var p = g.board[sq];
    if (p && C.colorOf(p) === g.turn && humanTurn()) {
      S.sel = sq;
      S.targets = g.legalMoves({ square: sq }).map(function (m) { return m.to; });
      S.arrows = [];
    } else {
      S.sel = -1; S.targets = [];
    }
    render();
  }

  function tryUserMove(from, to) {
    var g = S.game;
    var cand = g.legalMoves({ square: from }).filter(function (m) { return m.to === to; });
    if (!cand.length) { S.sel = -1; S.targets = []; render(); return; }
    if (cand[0].flags & C.FLAGS.PROMO) {
      askPromotion(function (type) { commitUserMove(from, to, type); });
      return;
    }
    commitUserMove(from, to, 0);
  }

  function askPromotion(cb) {
    var row = $('promoRow'), modal = $('promoModal');
    clear(row);
    modal.onclick = function (ev) {
      if (ev.target !== modal) return;           // solo il clic fuori dal riquadro
      modal.hidden = true;
      S.pendingPromo = null;
      S.sel = -1; S.targets = [];
      render();
    };
    ['q', 'r', 'b', 'n'].forEach(function (t) {
      var b = elt('button', 'promo-btn', GLYPH[t]);
      b.title = { q: 'Donna', r: 'Torre', b: 'Alfiere', n: 'Cavallo' }[t];
      b.addEventListener('click', function () {
        $('promoModal').hidden = true;
        S.pendingPromo = null;
        cb(t);
      });
      row.appendChild(b);
    });
    S.pendingPromo = true;
    $('promoModal').hidden = false;
  }

  function commitUserMove(from, to, promo) {
    if (S.mode === 'aperture') { trainerUserMove(from, to, promo); return; }
    if (S.mode === 'puzzle') { puzzleUserMove(from, to, promo); return; }
    playVsEngineUserMove(from, to, promo);
  }

  // ------------------------------------------- modalità gioca / finali
  function pushMove(desc, byHuman, judge) {
    S.anim = { from: desc.fromSq, to: desc.toSq };
    var explain = K.explainMove(S.game, desc);
    S.line.push({
      san: desc.san, fenAfter: S.game.fen(), desc: desc,
      explain: explain, judge: judge || null, byHuman: !!byHuman
    });
    S.cursor = S.line.length;
    return S.line[S.line.length - 1];
  }

  function playVsEngineUserMove(from, to, promo) {
    var g = S.game;
    var before = analyzeCached(g, 3, 400);
    var scoreBefore = before.score;

    // verifica preventiva degli errori gravi
    if (S.opts.blunder) {
      var probe = g.clone();
      var test = probe.move({ from: from, to: to, promotion: promo || 'q' });
      if (test) {
        var after = E.analyze(probe, { depth: 3, timeMs: 350 });
        var loss = scoreBefore - (-after.score);
        if (loss >= 300) {
          var why = [];
          var hang = E.hangingPieces(probe, g.turn);
          if (hang.length) {
            why.push('dopo ' + test.san + ' ' + K.ART[C.TYPE_FROM_CHAR[hang[0].type]] + ' in ' + hang[0].square +
              ' può essere catturato (circa ' + Math.round(hang[0].loss / 100) +
              (Math.round(hang[0].loss / 100) === 1 ? ' punto)' : ' punti)'));
          }
          if (after.bestSan) why.push('l\'avversario risponderebbe ' + after.bestSan);
          $('warnText').innerHTML = '<strong>' + test.san + '</strong> perde circa ' +
            (loss / 100).toFixed(1) + ' punti di valutazione' + (why.length ? ': ' + why.join(', ') : '') +
            '.<br><br>Vuoi ripensarci? (puoi disattivare questo avviso nelle opzioni)';
          var modal = $('warnModal');
          modal.hidden = false;
          S.pendingPromo = true;   // blocca l'input finché non si decide
          var go = $('warnGo'), back = $('warnBack');
          var cleanup = function () {
            modal.hidden = true; S.pendingPromo = null; modal.onclick = null;
            go.removeEventListener('click', onGo); back.removeEventListener('click', onBack);
          };
          var onGo = function () { cleanup(); doUserMove(from, to, promo, scoreBefore, before); };
          var onBack = function () { cleanup(); S.sel = -1; S.targets = []; render(); };
          go.addEventListener('click', onGo); back.addEventListener('click', onBack);
          modal.onclick = function (ev) { if (ev.target === modal) onBack(); };
          return;
        }
      }
    }
    doUserMove(from, to, promo, scoreBefore, before);
  }

  function doUserMove(from, to, promo, scoreBefore, before) {
    var desc = S.game.move({ from: from, to: to, promotion: promo || 'q' });
    if (!desc) return;
    S.sel = -1; S.targets = []; S.arrows = []; S.cache = {};
    var after = analyzeCached(S.game, 3, 400);
    var judge = K.judge(null, desc.san, scoreBefore, -after.score, before.bestSan, before.pvSan);
    var entry = pushMove(desc, true, judge);
    render();
    showCoachForCursor();

    if (checkGameEnd()) return;
    scheduleEngine(60);
  }

  /** Nuova posizione: annulla qualunque calcolo del motore ancora in coda. */
  function resetPosition(fen) {
    S.gen++;
    if (typeof stopReview === 'function') stopReview();
    S.thinking = false;
    S.pendingPromo = null;
    S.startFen = fen;
    S.game = new Chess(fen);
    S.line = []; S.cursor = 0; S.cache = {}; S.arrows = []; S.sel = -1; S.targets = [];
    hintFen = ''; hintLevel = 0;
    $('promoModal').hidden = true;
    $('warnModal').hidden = true;
  }

  /** Fa muovere il computer, ignorando la richiesta se la posizione è cambiata. */
  function scheduleEngine(delay) {
    var gen = S.gen;
    setThinking(true);
    setTimeout(function () {
      if (gen !== S.gen) return;
      engineMove();
    }, delay || 60);
  }

  function engineMove() {
    var pick = E.chooseMove(S.game, S.level);
    if (!pick) { setThinking(false); return; }
    var desc = S.game.move(pick.move);
    S.cache = {};
    pushMove(desc, false, null);
    setThinking(false);
    render();
    showCoachForCursor();
    checkGameEnd();
  }

  function setThinking(on) {
    S.thinking = on;
    var body = $('coachBody');
    if (on) {
      var p = elt('p', 'muted');
      p.innerHTML = 'Il computer sta pensando <span class="thinking"><i></i><i></i><i></i></span>';
      clear(body); body.appendChild(p);
    }
  }

  function checkGameEnd() {
    var r = S.game.gameResult();
    if (!r.over) return false;
    var mine = r.winner === S.human;
    if (S.mode === 'gioca') {
      S.stats.partite++;
      if (mine) S.stats.vinte++;
      saveStats(); renderStats();
    }
    var titolo = r.winner === null ? 'Patta: ' + r.reason : (mine ? 'Hai vinto! 🎉' : 'Hai perso: ' + r.reason);
    var punti = [];
    if (r.winner === null) punti.push('Nessuno dei due può più vincere: ' + r.reason + '.');
    else if (mine) punti.push('Complimenti. Riguarda la partita con le frecce ◀ ▶ e leggi i commenti: anche nelle vittorie ci sono mosse da migliorare.');
    else punti.push('Capita a tutti. Riguarda la partita con le frecce ◀ ▶ e cerca le mosse segnate con ? o ??: lì si è deciso tutto.');
    var errori = S.line.filter(function (l) { return l.byHuman && l.judge && (l.judge.judgement.key === 'blunder' || l.judge.judgement.key === 'mistake'); });
    if (errori.length) punti.push('Hai commesso ' + errori.length + (errori.length === 1 ? ' errore grave' : ' errori') + ': ' +
      errori.slice(0, 4).map(function (l) { return l.san; }).join(', ') + '.');
    coachSay(titolo, punti, []);
    var rev = elt('button', 'btn primary', '📊 Rivedi la partita con l\'analisi completa');
    rev.addEventListener('click', function () { setTab('revisione'); startReview(); });
    $('coachBody').appendChild(rev);
    return true;
  }

  // ------------------------------------------------------------------ coach
  function coachSay(titolo, punti, avvisi, judge) {
    var body = $('coachBody');
    clear(body);
    if (titolo) {
      var t = elt('div', 'coach-title', titolo);
      body.appendChild(t);
    }
    if (punti && punti.length) {
      var ul = elt('ul');
      punti.forEach(function (p) { ul.appendChild(elt('li', '', p)); });
      body.appendChild(ul);
    }
    if (avvisi && avvisi.length) {
      var ul2 = elt('ul');
      avvisi.forEach(function (p) { ul2.appendChild(elt('li', 'warn-li', '⚠️ ' + p)); });
      body.appendChild(ul2);
    }
    var badge = $('judgeBadge');
    if (judge) {
      badge.textContent = judge.judgement.icon + ' ' + judge.judgement.label;
      badge.className = 'badge ' + judge.judgement.cls;
    } else { badge.textContent = ''; badge.className = 'badge'; }
    $('hintBox').hidden = true;
  }

  function showCoachForCursor() {
    if (S.cursor === 0) {
      coachSay('Si parte', [K.phaseAdvice(S.game)], []);
      return;
    }
    var entry = S.line[S.cursor - 1];
    var chi = entry.byHuman ? 'La tua mossa' : 'Mossa del computer';
    var punti = entry.explain.punti.slice();
    var avvisi = entry.explain.avvisi.slice();

    if (entry.byHuman && entry.judge && entry.judge.judgement.key !== 'best' && entry.judge.judgement.key !== 'great') {
      punti.unshift(entry.judge.testo);
    }
    // cosa succede ora, solo se siamo in posizione viva e tocca all'umano
    if (isLive() && S.game.turnColor() === S.human && !S.game.isGameOver()) {
      var th = K.threats(S.game);
      th.slice(0, 2).forEach(function (t) { (t.grave ? avvisi : punti).push(t.testo); });
      punti.push(K.phaseAdvice(S.game));
    }
    coachSay(chi + ' — ' + entry.san + ': ' + entry.explain.titolo, punti, avvisi,
      entry.byHuman ? entry.judge : null);
  }

  var hintLevel = 0, hintFen = '';
  function showHint() {
    if (S.thinking) return;
    var g = viewGame();
    if (g.isGameOver()) return;
    if (hintFen !== g.fen()) { hintFen = g.fen(); hintLevel = 0; }
    var res = analyzeCached(g, 4, 700);
    var steps = K.hints(g, res);
    hintLevel = Math.min(steps.length, hintLevel + 1);
    var box = $('hintBox'), list = $('hintList');
    clear(list);
    for (var i = 0; i < hintLevel; i++) list.appendChild(elt('li', '', steps[i]));
    if (hintLevel < steps.length) {
      var more = elt('li', 'muted', 'Premi di nuovo 💡 per l\'aiuto successivo.');
      list.appendChild(more);
    } else if (res.best) {
      S.arrows = [{ from: res.best.from, to: res.best.to, color: '#4ec98a' }];
      drawArrows();
    }
    box.hidden = false;
  }
  $('btnHint').addEventListener('click', showHint);

  $('btnExplain').addEventListener('click', function () {
    if (S.thinking) return;
    var g = viewGame();
    var res = analyzeCached(g, 4, 700);
    var punti = [], avvisi = [];
    var score = g.turnColor() === 'w' ? res.score : -res.score;
    var chi = score > 0 ? 'il bianco' : 'il nero';
    var abs = Math.abs(score);
    var frase;
    if (abs < 50) frase = 'La posizione è in equilibrio.';
    else if (abs < 150) frase = 'Piccolo vantaggio per ' + chi + ' (' + E.scoreToText(Math.abs(score)) + ').';
    else if (abs < 400) frase = 'Vantaggio chiaro per ' + chi + ' (' + E.scoreToText(Math.abs(score)) + ').';
    else frase = 'Posizione decisa a favore di ' + chi + ' (' + E.scoreToText(Math.abs(score)) + ').';
    punti.push(frase);
    punti.push(K.phaseAdvice(g));
    K.threats(g).forEach(function (t) { (t.grave ? avvisi : punti).push(t.testo); });
    var ot = K.opponentThreat(g, 300);
    if (ot) punti.push('Se potesse muovere lui, giocherebbe ' + ot.san + ': tienilo d\'occhio.');
    var mat = g.materialCount();
    if (Math.abs(mat.diff) >= 100) {
      punti.push('Materiale: ' + (mat.diff > 0 ? 'bianco' : 'nero') + ' in vantaggio di ' + Math.abs(Math.round(mat.diff / 100)) + ' punti.');
    } else punti.push('Materiale pari.');
    coachSay('Lettura della posizione', punti, avvisi);
  });

  $('btnBestLine').addEventListener('click', function () {
    if (S.thinking) return;
    var g = viewGame();
    if (g.isGameOver()) return;
    var res = analyzeCached(g, 4, 900);
    if (!res.pvSan.length) return;
    var punti = [];
    var probe = new Chess(g.fen());
    for (var i = 0; i < Math.min(6, res.pvSan.length); i++) {
      var d = probe.move(res.pvSan[i]);
      if (!d) break;
      var ex = K.explainMove(probe, d);
      punti.push('<strong>' + (i + 1) + '. ' + res.pvSan[i] + '</strong> — ' + ex.punti[0]);
    }
    var body = $('coachBody');
    clear(body);
    body.appendChild(elt('div', 'coach-title', 'Variante migliore (valutazione ' + E.scoreToText(res.score) + ')'));
    var ul = elt('ul');
    punti.forEach(function (p) { var li = elt('li'); li.innerHTML = p; ul.appendChild(li); });
    body.appendChild(ul);
    if (res.best) { S.arrows = [{ from: res.best.from, to: res.best.to, color: '#5aa9f0' }]; drawArrows(); }
    $('judgeBadge').textContent = ''; $('judgeBadge').className = 'badge';
  });

  // ---------------------------------------------------------- nuova partita
  function renderLevels() {
    var grid = $('levelGrid');
    clear(grid);
    E.LEVELS.forEach(function (lv) {
      var b = elt('button', 'level' + (lv.id === S.level ? ' active' : ''));
      b.appendChild(elt('span', 'level-num', String(lv.id)));
      var txt = elt('div', 'level-txt');
      txt.appendChild(elt('strong', '', lv.name + ' · ' + lv.elo + ' Elo'));
      txt.appendChild(elt('span', '', lv.desc));
      b.appendChild(txt);
      b.addEventListener('click', function () {
        S.level = lv.id; S.stats.livello = lv.id; saveStats();
        renderLevels(); render();
      });
      grid.appendChild(b);
    });
  }

  $('colorSeg').addEventListener('click', function (e) {
    var b = e.target.closest('.seg-btn');
    if (!b) return;
    S.colorChoice = b.dataset.color;
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle('active', c === b); });
  });

  ['optBlunder', 'optLegal', 'optThreats', 'optEval'].forEach(function (id) {
    var key = { optBlunder: 'blunder', optLegal: 'legal', optThreats: 'threats', optEval: 'evalbar' }[id];
    $(id).checked = S.opts[key];
    $(id).addEventListener('change', function () { S.opts[key] = this.checked; render(); });
  });

  function mostraSetup(apri) {
    $('setupCard').hidden = !apri;
    $('setupMini').hidden = apri;
    if (!apri) {
      var lv = E.LEVELS[S.level - 1];
      $('setupSummary').innerHTML = (S.human === 'w' ? '♔ Giochi con il <strong>bianco</strong>' : '♚ Giochi con il <strong>nero</strong>') +
        ' · <strong>' + lv.name + '</strong> (' + lv.elo + ' Elo)';
    }
  }
  $('btnSetupOpen').addEventListener('click', function () {
    mostraSetup(true);
    $('setupCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  function newGame() {
    S.mode = 'gioca';
    S.human = S.colorChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : S.colorChoice;
    S.orientation = S.human;
    resetPosition(START);
    S.trainer = null; S.puzzle = null; S.endgame = null;
    mostraSetup(false);
    var pc = document.querySelector('.panel-column');
    if (pc) pc.scrollTop = 0;
    render();
    coachSay('Buona partita!', [
      'Giochi con ' + (S.human === 'w' ? 'il bianco: muovi tu per primo.' : 'il nero: muove il computer.'),
      K.phaseAdvice(S.game),
      'Dopo ogni mossa ti dico com\'è andata. Premi 💡 per un suggerimento in tre passi, o ↺ per tornare indietro e riprovare.'
    ], []);
    if (S.human === 'b') scheduleEngine(300);
  }
  $('btnNewGame').addEventListener('click', newGame);

  function renderStats() {
    var box = $('stats');
    clear(box);
    var st = S.stats;
    var items = [
      [st.partite, 'partite'],
      [st.vinte, 'vittorie'],
      [st.ultimaAcc ? Math.round(st.ultimaAcc) + '%' : '—', 'ultima accuratezza'],
      [st.ultimoRating || '—', 'livello stimato'],
      [st.puzzleRisolti.length, 'puzzle risolti'],
      [st.puzzleTentati ? Math.round(100 * st.puzzleOk / st.puzzleTentati) + '%' : '—', 'precisione puzzle'],
      [st.aperture.length, 'aperture studiate'],
      [st.revisioni || 0, 'partite analizzate']
    ];
    items.forEach(function (it) {
      var d = elt('div', 'stat');
      d.appendChild(elt('b', '', String(it[0])));
      d.appendChild(elt('span', '', it[1]));
      box.appendChild(d);
    });
  }
  $('btnResetStats').addEventListener('click', function () {
    S.stats = { partite: 0, vinte: 0, puzzleRisolti: [], puzzleTentati: 0, puzzleOk: 0, aperture: [],
      serie: 0, livello: S.level, profilo: {}, revisioni: 0, storicoAcc: [], ultimaAcc: null, ultimoRating: null };
    saveStats(); renderStats(); renderPuzzleCounter();
  });

  // ---------------------------------------------------------------- aperture
  function renderOpeningList(filter) {
    var list = $('openingList'), traps = $('trapList');
    clear(list); clear(traps);
    function card(entry, container) {
      if (filter && filter !== 'all' && entry.side !== filter) return;
      var b = elt('button', 'op-item');
      var left = elt('strong', '', entry.name);
      b.appendChild(left);
      var right = elt('span', 'op-side', entry.side === 'w' ? '♔' : '♚');
      right.title = entry.side === 'w' ? 'per il bianco' : 'per il nero';
      b.appendChild(right);
      var sub = elt('span', 'op-sub');
      sub.innerHTML = '<span class="stars">' + '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars) + '</span> ' +
        (S.stats.aperture.indexOf(entry.id) >= 0 ? '✓ studiata · ' : '') + entry.idea;
      b.appendChild(sub);
      b.addEventListener('click', function () { startOpening(entry); });
      container.appendChild(b);
    }
    O.OPENINGS.forEach(function (o) { card(o, list); });
    O.TRAPS.forEach(function (t) { card(t, traps); });
  }
  $('openingSideSeg').addEventListener('click', function (e) {
    var b = e.target.closest('.seg-btn');
    if (!b) return;
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle('active', c === b); });
    renderOpeningList(b.dataset.side === 'all' ? 'all' : b.dataset.side);
  });
  $('opClose').addEventListener('click', function () {
    $('openingTrainer').hidden = true; $('openingPicker').hidden = false; S.trainer = null;
  });

  function startOpening(entry) {
    S.mode = 'aperture';
    S.trainer = { entry: entry, idx: 0, waiting: false, revealed: false, errori: 0 };
    S.puzzle = null; S.endgame = null;
    resetPosition(START);
    S.human = entry.side; S.orientation = entry.side;
    $('openingPicker').hidden = true;
    $('openingTrainer').hidden = false;
    $('opDone').hidden = true;
    $('opTitle').textContent = entry.name;
    $('opIdea').textContent = entry.why;
    render();
    trainerStep();
  }

  function trainerStep() {
    var t = S.trainer;
    if (!t) return;
    var entry = t.entry;
    $('opProgress').style.width = Math.round(100 * t.idx / entry.moves.length) + '%';
    if (t.idx >= entry.moves.length) {
      t.waiting = false;
      $('opStep').innerHTML = '<strong>Apertura completata!</strong> Hai seguito tutta la linea principale.';
      var done = $('opDone');
      done.hidden = false;
      done.innerHTML = '<strong>Prossimo passo:</strong> ' + entry.next +
        '<br><br>Ora provala in partita: premi il pulsante qui sotto e gioca questa apertura contro il computer.';
      var btn = elt('button', 'btn primary', '♟ Gioca da questa posizione');
      btn.addEventListener('click', function () {
        var fen = S.game.fen();
        S.mode = 'gioca';
        S.trainer = null;
        resetPosition(fen);
        S.human = entry.side; S.orientation = entry.side;
        setTab('gioca');
        S.mode = 'gioca';
        render();
        coachSay('Ora tocca a te', ['Sei nella posizione tipica della ' + entry.name + '. Continua tu: ' + entry.next], []);
        if (S.game.turnColor() !== S.human) scheduleEngine(300);
      });
      done.appendChild(document.createElement('br'));
      done.appendChild(btn);
      if (S.stats.aperture.indexOf(entry.id) < 0) { S.stats.aperture.push(entry.id); saveStats(); renderStats(); }
      S.arrows = []; render();
      return;
    }
    var step = entry.moves[t.idx];
    var mine = (t.idx % 2 === 0) === (entry.side === 'w');
    t.waiting = mine;
    t.revealed = false;
    var num = Math.floor(t.idx / 2) + 1;
    var pre = (t.idx % 2 === 0 ? num + '. ' : num + '... ');
    if (mine) {
      $('opStep').className = 'step-box';
      $('opStep').innerHTML = '<strong>Mossa ' + pre + '— tocca a te.</strong><br>' +
        (step.danger ? '⚠️ Attenzione in questa posizione! ' : '') +
        'Prova a indovinare la mossa giusta e giocala sulla scacchiera. Se non ti viene, premi "Mostra la mossa".';
      S.arrows = [];
      render();
    } else {
      $('opStep').className = 'step-box';
      $('opStep').innerHTML = '<strong>Risposta dell\'avversario…</strong>';
      var genStep = S.gen;
      setTimeout(function () {
        if (!S.trainer || S.trainer !== t || genStep !== S.gen) return;
        var d = S.game.move(step.san);
        if (!d) { $('opStep').innerHTML = 'Errore nella linea (' + step.san + ').'; return; }
        pushMove(d, false, null);
        t.idx++;
        $('opStep').className = 'step-box';
        $('opStep').innerHTML = '<strong>' + pre + step.san + '</strong> — ' + step.text;
        S.arrows = [{ from: d.fromSq, to: d.toSq, color: '#5aa9f0' }];
        render();
        setTimeout(function () { if (S.trainer === t && genStep === S.gen) trainerStep(); }, 1400);
      }, 700);
    }
  }

  function trainerUserMove(from, to, promo) {
    var t = S.trainer;
    if (!t || !t.waiting) return;
    var entry = t.entry, step = entry.moves[t.idx];
    var probe = S.game.clone();
    var played = probe.move({ from: from, to: to, promotion: promo || 'q' });
    if (!played) return;
    if (norm(played.san) === norm(step.san)) {
      var d = S.game.move({ from: from, to: to, promotion: promo || 'q' });
      pushMove(d, true, null);
      t.idx++;
      t.waiting = false;
      S.sel = -1; S.targets = []; S.arrows = [{ from: d.fromSq, to: d.toSq, color: '#4ec98a' }];
      var num = Math.floor((t.idx - 1) / 2) + 1;
      $('opStep').className = 'step-box ok';
      $('opStep').innerHTML = '✅ <strong>' + d.san + '</strong> — ' + step.text;
      render();
      var genOk = S.gen;
      setTimeout(function () { if (S.trainer === t && genOk === S.gen) trainerStep(); }, 1500);
    } else {
      // errore: cerca una spiegazione specifica
      var specific = (entry.mistakes || []).filter(function (m) {
        return m.after === t.idx && norm(m.san) === norm(played.san);
      })[0];
      t.errori++;
      S.sel = -1; S.targets = [];
      $('opStep').className = 'step-box err';
      $('opStep').innerHTML = '❌ <strong>' + played.san + '</strong> non è la mossa di questa apertura.<br>' +
        (specific ? specific.text + '<br>' : '') +
        'La mossa giusta è <strong>' + step.san + '</strong>: ' + step.text;
      render();
    }
  }

  function trainerBack() {
    var t = S.trainer;
    if (!t || t.idx === 0) return;
    var steps = (t.idx % 2 === 0) ? 2 : 1;
    steps = Math.min(steps, S.line.length);
    truncateTo(S.line.length - steps);
    t.idx -= steps;
    if (t.idx < 0) t.idx = 0;
    S.arrows = [];
    $('opDone').hidden = true;
    render();
    trainerStep();
  }
  $('opBack').addEventListener('click', trainerBack);
  $('opReveal').addEventListener('click', function () {
    var t = S.trainer;
    if (!t || !t.waiting) return;
    var step = t.entry.moves[t.idx];
    var probe = S.game.clone();
    var m = probe.findMoveBySan(step.san);
    if (m) { S.arrows = [{ from: m.from, to: m.to, color: '#f0b429' }]; drawArrows(); }
    t.revealed = true;
    $('opStep').className = 'step-box';
    $('opStep').innerHTML = '👀 La mossa è <strong>' + step.san + '</strong> (freccia sulla scacchiera).<br>' + step.text +
      '<br><em>Ora giocala tu sulla scacchiera.</em>';
  });
  $('opPlay').addEventListener('click', function () {
    var t = S.trainer;
    if (!t || !t.waiting) return;
    var step = t.entry.moves[t.idx];
    var m = S.game.findMoveBySan(step.san);
    if (!m) return;
    trainerUserMove(m.from, m.to, m.promotion ? C.CHAR_FROM_TYPE[m.promotion] : 0);
  });

  // ------------------------------------------------------------------ puzzle
  function puzzleFen(p) {
    if (p.fen) return p.fen;
    var g = new Chess();
    p.setup.forEach(function (s) { g.move(s); });
    return g.fen();
  }

  function renderThemeChips() {
    var box = $('themeChips');
    clear(box);
    var temi = ['tutti'].concat(Object.keys(PZ.TEMI));
    temi.forEach(function (t) {
      var c = elt('button', 'chip' + (S.puzzleFilter === t ? ' active' : ''), t === 'tutti' ? 'Tutti' : PZ.TEMI[t].nome);
      c.addEventListener('click', function () {
        S.puzzleFilter = t;
        renderThemeChips();
        nextPuzzle(true);
      });
      box.appendChild(c);
    });
  }

  function puzzlePool() {
    return PZ.PUZZLES.filter(function (p) { return S.puzzleFilter === 'tutti' || p.tema === S.puzzleFilter; });
  }

  function renderPuzzleCounter() {
    var pool = puzzlePool();
    var done = pool.filter(function (p) { return S.stats.puzzleRisolti.indexOf(p.id) >= 0; }).length;
    $('puzzleCounter').textContent = done + '/' + pool.length + ' risolti';
  }

  function nextPuzzle(reset) {
    var pool = puzzlePool();
    if (!pool.length) return;
    var todo = pool.filter(function (p) { return S.stats.puzzleRisolti.indexOf(p.id) < 0; });
    var choice;
    if (todo.length) choice = todo[Math.floor(Math.random() * todo.length)];
    else choice = pool[Math.floor(Math.random() * pool.length)];
    loadPuzzle(choice);
  }

  function loadPuzzle(p, retry) {
    S.mode = 'puzzle';
    var fen = puzzleFen(p);
    S.trainer = null; S.endgame = null;
    resetPosition(fen);
    S.puzzle = { p: p, step: 0, hints: 0, solved: false, counted: !!retry };
    S.human = S.game.turnColor();
    S.orientation = S.human;
    var tema = PZ.TEMI[p.tema];
    $('puzzleTheme').textContent = tema.nome;
    $('puzzleDiff').textContent = '★'.repeat(p.diff) + '☆'.repeat(3 - p.diff);
    $('puzzleTask').innerHTML = 'Muove ' + (S.human === 'w' ? '<strong>il bianco</strong>' : '<strong>il nero</strong>') +
      '. ' + tema.desc;
    $('puzzleFeedback').hidden = true;
    $('puzzleHints').hidden = true;
    $('puzzleLesson').hidden = true;
    clear($('puzzleHintList'));
    renderPuzzleCounter();
    render();
  }

  function puzzleSolved() {
    var pz = S.puzzle, p = pz.p;
    pz.solved = true;
    if (S.stats.puzzleRisolti.indexOf(p.id) < 0) S.stats.puzzleRisolti.push(p.id);
    if (!pz.counted) { S.stats.puzzleTentati++; S.stats.puzzleOk++; pz.counted = true; }
    saveStats(); renderStats(); renderPuzzleCounter();
    var fb = $('puzzleFeedback');
    fb.className = 'step-box ok';
    fb.innerHTML = '✅ <strong>Risolto!</strong> La soluzione era <strong>' + p.solution.join(' ') + '</strong>.';
    fb.hidden = false;
    var les = $('puzzleLesson');
    les.innerHTML = '<strong>Da ricordare:</strong> ' + p.lesson;
    les.hidden = false;
  }

  function puzzleUserMove(from, to, promo) {
    var pz = S.puzzle;
    if (!pz || pz.solved) return;
    var p = pz.p;
    var probe = S.game.clone();
    var played = probe.move({ from: from, to: to, promotion: promo || 'q' });
    if (!played) return;
    var expected = p.solution[pz.step];
    var ok = norm(played.san) === norm(expected);
    if (!ok && pz.step === 0 && p.accept) {
      ok = p.accept.some(function (a) { return norm(a) === norm(played.san); });
    }

    if (!ok) {
      if (!pz.counted) { S.stats.puzzleTentati++; pz.counted = true; saveStats(); renderStats(); }
      var fb = $('puzzleFeedback');
      fb.className = 'step-box err';
      var why = [];
      var after = E.analyze(probe, { depth: 3, timeMs: 400 });
      var hang = E.hangingPieces(probe, S.game.turn);
      if (hang.length) why.push('dopo questa mossa ' + K.ART[C.TYPE_FROM_CHAR[hang[0].type]] + ' in ' + hang[0].square + ' resta in presa');
      if (after.bestSan) why.push('l\'avversario risponderebbe ' + after.bestSan);
      fb.innerHTML = '❌ <strong>' + played.san + '</strong> non è la mossa migliore' +
        (why.length ? ': ' + why.join(' e ') : '') + '. Riprova, oppure chiedi un aiutino.';
      fb.hidden = false;
      S.sel = -1; S.targets = []; render();
      return;
    }

    var d = S.game.move({ from: from, to: to, promotion: promo || 'q' });
    pushMove(d, true, null);
    pz.step++;
    S.sel = -1; S.targets = []; S.arrows = [];
    render();

    if (S.game.isCheckmate() || pz.step >= p.solution.length) { puzzleSolved(); return; }

    var fb2 = $('puzzleFeedback');
    fb2.className = 'step-box ok';
    fb2.innerHTML = '✅ <strong>' + d.san + '</strong> è giusta! Continua: trova anche la mossa successiva.';
    fb2.hidden = false;

    // risposta forzata dell'avversario
    var reply = p.solution[pz.step];
    var genReply = S.gen;
    setTimeout(function () {
      if (!S.puzzle || S.puzzle !== pz || genReply !== S.gen) return;
      var rd = S.game.move(reply);
      if (!rd) return;
      pushMove(rd, false, null);
      pz.step++;
      S.arrows = [{ from: rd.fromSq, to: rd.toSq, color: '#5aa9f0' }];
      render();
      if (pz.step >= p.solution.length) puzzleSolved();
    }, 700);
  }

  $('pzHint').addEventListener('click', function () {
    var pz = S.puzzle;
    if (!pz) { nextPuzzle(); return; }
    pz.hints = Math.min(3, pz.hints + 1);
    var list = $('puzzleHintList');
    clear(list);
    for (var i = 0; i < pz.hints; i++) list.appendChild(elt('li', '', pz.p.hints[i]));
    if (pz.hints < 3) list.appendChild(elt('li', 'muted', 'Premi di nuovo per l\'aiutino successivo.'));
    $('puzzleHints').hidden = false;
  });

  $('pzSolution').addEventListener('click', function () {
    var pz = S.puzzle;
    if (!pz) return;
    if (!pz.counted) { S.stats.puzzleTentati++; pz.counted = true; saveStats(); renderStats(); }
    // riparte dalla posizione iniziale e mostra la linea passo per passo
    loadPuzzle(pz.p, true);
    var p = pz.p, i = 0, genSol = S.gen;
    var step = function () {
      if (!S.puzzle || S.puzzle.p !== p || genSol !== S.gen) return;
      if (i >= p.solution.length) {
        var fb = $('puzzleFeedback');
        fb.className = 'step-box';
        fb.innerHTML = '<strong>Soluzione completa:</strong> ' + p.solution.join(' ') + '. Premi ↺ Riprova per rifarla da solo.';
        fb.hidden = false;
        var les = $('puzzleLesson');
        les.innerHTML = '<strong>Da ricordare:</strong> ' + p.lesson;
        les.hidden = false;
        S.puzzle.solved = true;
        return;
      }
      var d = S.game.move(p.solution[i]);
      if (!d) return;
      pushMove(d, i % 2 === 0, null);
      var ex = K.explainMove(S.game, d);
      var fb2 = $('puzzleFeedback');
      fb2.className = 'step-box';
      fb2.innerHTML = '<strong>' + d.san + '</strong> — ' + ex.punti.join(' ');
      fb2.hidden = false;
      S.arrows = [{ from: d.fromSq, to: d.toSq, color: i % 2 === 0 ? '#4ec98a' : '#5aa9f0' }];
      render();
      i++;
      setTimeout(step, 1500);
    };
    setTimeout(step, 400);
  });

  $('pzRetry').addEventListener('click', function () { if (S.puzzle) loadPuzzle(S.puzzle.p, true); });
  $('pzNext').addEventListener('click', function () { nextPuzzle(); });

  // ------------------------------------------------------------------ finali
  function renderEndgameList() {
    var box = $('endgameList');
    clear(box);
    O.ENDGAMES.forEach(function (eg) {
      var b = elt('button', 'op-item');
      b.appendChild(elt('strong', '', eg.name));
      b.appendChild(elt('span', 'op-side', eg.side === 'w' ? '♔' : '♚'));
      b.appendChild(elt('span', 'op-sub', eg.goal));
      b.addEventListener('click', function () { startEndgame(eg); });
      box.appendChild(b);
    });
  }

  function startEndgame(eg) {
    S.mode = 'finali';
    S.endgame = eg;
    S.trainer = null; S.puzzle = null;
    resetPosition(eg.fen);
    S.human = eg.side; S.orientation = eg.side;
    S.level = Math.max(S.level, 4);
    $('endgameInfo').hidden = false;
    $('egTitle').textContent = eg.name;
    $('egGoal').textContent = eg.goal;
    $('egHow').innerHTML = '<strong>Tecnica:</strong> ' + eg.how;
    render();
    coachSay('Esercizio di finale: ' + eg.name, [eg.goal, eg.how], []);
    if (S.game.turnColor() !== S.human) scheduleEngine(300);
  }
  $('egClose').addEventListener('click', function () { $('endgameInfo').hidden = true; });
  $('egRestart').addEventListener('click', function () { if (S.endgame) startEndgame(S.endgame); });
  $('egHint').addEventListener('click', showHint);

  // ------------------------------------------------------------------ impara
  function renderImpara() {
    var vb = $('valuesBox');
    clear(vb);
    [['p', 'Pedone', 1], ['n', 'Cavallo', 3], ['b', 'Alfiere', 3], ['r', 'Torre', 5], ['q', 'Donna', 9], ['k', 'Re', '∞']].forEach(function (v) {
      var d = elt('div', 'value-item');
      d.appendChild(elt('div', 'g', GLYPH[v[0]]));
      d.appendChild(elt('b', '', String(v[2])));
      d.appendChild(elt('span', '', v[1]));
      vb.appendChild(d);
    });
    var pb = $('principlesBox');
    clear(pb);
    O.PRINCIPI.forEach(function (p) {
      var d = elt('div', 'principle');
      d.appendChild(elt('strong', '', p.t));
      d.appendChild(elt('p', '', p.d));
      pb.appendChild(d);
    });
    var tb = $('themesBox');
    clear(tb);
    Object.keys(PZ.TEMI).forEach(function (k) {
      var t = PZ.TEMI[k];
      var d = elt('div', 'theme');
      d.appendChild(elt('strong', '', t.nome));
      d.appendChild(elt('p', '', t.desc));
      tb.appendChild(d);
    });
  }

  // -------------------------------------------------------------------- tab
  function setTab(mode) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) {
      p.classList.toggle('active', p.id === 'panel-' + mode);
    });
    if (mode === 'gioca' && S.mode !== 'gioca') {
      // tornando a "Gioca" da puzzle/aperture/finali si riparte da una partita nuova
      newGame();
      return;
    }
    if (mode === 'puzzle') {
      S.mode = 'puzzle';
      if (!S.puzzle) nextPuzzle();
      else render();
    }
    if (mode === 'aperture') {
      S.mode = 'aperture';
      if (!S.trainer) { $('openingTrainer').hidden = true; $('openingPicker').hidden = false; }
      render();
    }
    if (mode === 'finali') {
      S.mode = 'finali';
      render();
    }
    if (mode === 'revisione') { updateRevMeta(); render(); }
    if (mode === 'impara') render();
  }
  $('tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.tab');
    if (!t) return;
    setTab(t.dataset.mode);
    // su schermi stretti i pannelli stanno sotto la scacchiera: si torna in cima
    if (window.innerWidth <= 980) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // -------------------------------------------------------------- revisione
  var RV = window.ChessReview;
  var REV = { analysis: null, running: false, depth: 4, selected: -1 };

  $('revDepthSeg').addEventListener('click', function (e) {
    var b = e.target.closest('.seg-btn');
    if (!b) return;
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle('active', c === b); });
    REV.depth = parseInt(b.dataset.depth, 10);
  });

  function stopReview() {
    REV.running = false;
    REV.analysis = null;
    REV.selected = -1;
    $('revResults').hidden = true;
    $('revProgressWrap').hidden = true;
    $('revProgressText').hidden = true;
  }

  function updateRevMeta() {
    var n = S.line.length;
    $('revMeta').textContent = n ? Math.ceil(n / 2) + ' mosse da analizzare' : 'nessuna partita in corso';
    $('btnAnalyze').disabled = n < 2 || REV.running;
  }

  function startReview() {
    if (REV.running) return;
    var sans = S.line.map(function (l) { return l.san; });
    if (sans.length < 2) {
      $('revProgressText').hidden = false;
      $('revProgressText').textContent = 'Gioca almeno una mossa, poi torna qui.';
      return;
    }
    var tempo = REV.depth === 5 ? 500 : (REV.depth === 3 ? 120 : 220);
    REV.analysis = RV.createAnalysis({ startFen: S.startFen, sans: sans, depth: REV.depth, timeMs: tempo });
    REV.running = true;
    REV.selected = -1;
    $('revResults').hidden = true;
    $('revProgressWrap').hidden = false;
    $('revProgressText').hidden = false;
    $('btnAnalyze').disabled = true;
    var gen = S.gen;

    function tick() {
      if (!REV.running || gen !== S.gen) { REV.running = false; updateRevMeta(); return; }
      var t0 = Date.now(), fine = false;
      // si lavora a blocchi di ~70ms per non bloccare l'interfaccia
      while (!fine && Date.now() - t0 < 70) fine = REV.analysis.step();
      var pct = Math.round(REV.analysis.progress() * 100);
      $('revProgress').style.width = pct + '%';
      $('revProgressText').textContent = 'Analizzo la posizione ' + REV.analysis.index + ' di ' + REV.analysis.total + '…';
      if (fine) {
        REV.running = false;
        $('revProgressText').textContent = 'Analisi completata.';
        salvaProfilo(REV.analysis);
        renderReview();
        updateRevMeta();
      } else setTimeout(tick, 0);
    }
    setTimeout(tick, 30);
  }
  $('btnAnalyze').addEventListener('click', startReview);

  function salvaProfilo(an) {
    var mio = an.riepilogo[S.human];
    if (!mio || !mio.mosse) return;
    if (!S.stats.profilo) S.stats.profilo = {};
    Object.keys(mio.cause || {}).forEach(function (k) {
      S.stats.profilo[k] = (S.stats.profilo[k] || 0) + mio.cause[k];
    });
    S.stats.revisioni = (S.stats.revisioni || 0) + 1;
    S.stats.accSomma = (S.stats.accSomma || 0) + mio.accuratezza;
    S.stats.ultimaAcc = mio.accuratezza;
    S.stats.ultimoRating = mio.rating;
    if (!S.stats.storicoAcc) S.stats.storicoAcc = [];
    S.stats.storicoAcc.push(Math.round(mio.accuratezza));
    if (S.stats.storicoAcc.length > 20) S.stats.storicoAcc.shift();
    saveStats();
    renderStats();
  }

  function accColor(a) { return a >= 85 ? 'var(--good)' : (a >= 70 ? 'var(--accent)' : 'var(--bad)'); }

  function renderReview() {
    var an = REV.analysis;
    if (!an || !an.done) return;
    $('revResults').hidden = false;

    // --- accuratezza dei due giocatori
    var row = $('accRow');
    clear(row);
    [S.human, S.human === 'w' ? 'b' : 'w'].forEach(function (col) {
      var r = an.riepilogo[col];
      var card = elt('div', 'acc-card' + (col === S.human ? ' mine' : ''));
      card.appendChild(elt('div', 'acc-name', col === S.human ? 'Tu (' + (col === 'w' ? 'bianco' : 'nero') + ')' : 'Computer'));
      var val = elt('div', 'acc-val', r.accuratezza ? r.accuratezza.toFixed(1) + '%' : '—');
      val.style.color = accColor(r.accuratezza);
      card.appendChild(val);
      var bar = elt('div', 'acc-bar');
      var fill = elt('div', 'acc-fill');
      fill.style.width = Math.max(2, r.accuratezza) + '%';
      fill.style.background = accColor(r.accuratezza);
      bar.appendChild(fill);
      card.appendChild(bar);
      card.appendChild(elt('div', 'acc-sub', r.rating ? 'livello espresso ≈ ' + r.rating + ' Elo' : 'troppe poche mosse'));
      row.appendChild(card);
    });

    // --- conteggio delle classificazioni (lato umano)
    var cc = $('classCounts');
    clear(cc);
    var conteggi = an.riepilogo[S.human].conteggi;
    RV.ORDER.forEach(function (k) {
      var n = conteggi[k] || 0;
      if (!n) return;
      var info = RV.CLASSES[k];
      var chip = elt('div', 'cls-chip ' + info.cls);
      chip.appendChild(elt('span', 'cls-icon', info.icon));
      chip.appendChild(elt('span', 'cls-n', String(n)));
      chip.appendChild(elt('span', 'cls-lab', info.label));
      cc.appendChild(chip);
    });

    renderGraph(an);
    renderMoments(an);
    renderPlan(an);
    renderProfile();
    renderRevMoves(an);
  }

  function renderGraph(an) {
    var svg = $('evalGraph');
    clear(svg);
    var W = 320, H = 110, mid = H / 2;
    var n = an.moves.length;
    if (!n) return;
    var NS = 'http://www.w3.org/2000/svg';
    function x(i) { return n === 1 ? W / 2 : (i / (n - 1)) * W; }
    function y(score) {
      var v = Math.max(-1, Math.min(1, score / 600));
      return mid - v * (mid - 6);
    }
    // area bianca
    var d = 'M0,' + mid;
    an.moves.forEach(function (m, i) { d += ' L' + x(i).toFixed(1) + ',' + y(m.scoreBianco).toFixed(1); });
    d += ' L' + W + ',' + mid + ' Z';
    var area = document.createElementNS(NS, 'path');
    area.setAttribute('d', d);
    area.setAttribute('fill', 'rgba(248,245,239,.18)');
    svg.appendChild(area);

    var line = document.createElementNS(NS, 'polyline');
    line.setAttribute('points', an.moves.map(function (m, i) { return x(i).toFixed(1) + ',' + y(m.scoreBianco).toFixed(1); }).join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#e8ebf2');
    line.setAttribute('stroke-width', '1.6');
    svg.appendChild(line);

    var zero = document.createElementNS(NS, 'line');
    zero.setAttribute('x1', 0); zero.setAttribute('x2', W);
    zero.setAttribute('y1', mid); zero.setAttribute('y2', mid);
    zero.setAttribute('stroke', 'rgba(148,157,179,.5)');
    zero.setAttribute('stroke-dasharray', '3 3');
    svg.appendChild(zero);

    an.moves.forEach(function (m, i) {
      if (['imprecisa', 'errore', 'grave', 'mancata', 'brillante'].indexOf(m.classe) < 0) return;
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(m.scoreBianco));
      dot.setAttribute('r', m.classe === 'grave' ? 4 : 3);
      dot.setAttribute('fill', m.classe === 'grave' ? '#ef5f5f' : (m.classe === 'brillante' ? '#4ec98a' : '#f0b429'));
      dot.setAttribute('stroke', '#11141b');
      dot.setAttribute('stroke-width', '1');
      svg.appendChild(dot);
    });

    svg.onclick = function (ev) {
      var rect = svg.getBoundingClientRect();
      var rel = (ev.clientX - rect.left) / rect.width;
      var i = Math.round(rel * (n - 1));
      selectReviewMove(Math.max(0, Math.min(n - 1, i)));
    };
  }

  function renderMoments(an) {
    var box = $('moments');
    clear(box);
    var miei = an.momenti.filter(function (m) { return m.colore === S.human; });
    var suoi = an.momenti.filter(function (m) { return m.colore !== S.human; });
    if (!miei.length) {
      box.appendChild(elt('p', 'muted small', suoi.length
        ? 'Nessun errore grave da parte tua in questa partita. (Il computer ne ha commessi ' + suoi.length + ': li trovi nella lista delle mosse.)'
        : 'Nessun errore grave: partita pulita! Guarda comunque le mosse qui sotto.'));
      return;
    }
    miei.forEach(function (m) {
      var b = elt('button', 'moment ' + m.info.cls);
      b.appendChild(elt('span', 'moment-icon', m.info.icon));
      var txt = elt('div', 'moment-txt');
      txt.appendChild(elt('strong', '', (m.numero) + (m.colore === 'w' ? '. ' : '… ') + m.san + ' — ' + m.info.label));
      var sub = m.causa && RV.CAUSE_INFO[m.causa] ? RV.CAUSE_INFO[m.causa].spiega : 'Si poteva fare di meglio.';
      if (m.migliore && m.delta > 0.5) sub += ' Meglio ' + m.migliore + '.';
      txt.appendChild(elt('span', '', sub));
      b.appendChild(txt);
      b.addEventListener('click', function () { selectReviewMove(an.moves.indexOf(m)); });
      box.appendChild(b);
    });
  }

  function selectReviewMove(i) {
    var an = REV.analysis;
    if (!an || !an.moves[i]) return;
    REV.selected = i;
    var m = an.moves[i];
    goTo(m.ply + 1);
    // freccia rossa sulla mossa giocata, verde sulla migliore
    var arrows = [];
    var line = S.line[m.ply];
    if (line) arrows.push({ from: line.desc.fromSq, to: line.desc.toSq, color: m.info.cls === 'blunder' ? '#ef5f5f' : '#f0b429' });
    if (m.bestMove && (!line || m.bestMove.from !== line.desc.fromSq || m.bestMove.to !== line.desc.toSq)) {
      arrows.push({ from: m.bestMove.from, to: m.bestMove.to, color: '#4ec98a' });
    }
    S.arrows = arrows;
    drawArrows();

    var det = $('momentDetail');
    det.hidden = false;
    det.className = 'step-box ' + (m.info.peso === 'male' ? 'err' : 'ok');
    var html = '<strong>' + m.numero + (m.colore === 'w' ? '. ' : '… ') + m.san + '</strong> — ' +
      m.info.icon + ' ' + m.info.label + ' (' + (m.delta >= 0.1 ? '−' + m.delta.toFixed(1) + '% di probabilità di vittoria' : 'nessuna perdita') + ')';
    if (m.libro) html += '<br>📖 Teoria: ' + m.libro + '.';
    if (m.migliore && m.delta > 0.5) {
      html += '<br>✅ Meglio <strong>' + m.migliore + '</strong>' +
        (m.variante.length > 1 ? ' (seguito da ' + m.variante.slice(1).join(' ') + ')' : '') + '.';
    }
    if (m.causa && RV.CAUSE_INFO[m.causa]) {
      html += '<br>🔎 <em>' + RV.CAUSE_INFO[m.causa].spiega + '</em> ' + RV.CAUSE_INFO[m.causa].consiglio;
    }
    html += '<br><span class="muted small">Freccia gialla/rossa = la tua mossa, verde = la migliore.</span>';
    det.innerHTML = html;
    renderRevMoves(an);
  }

  function renderPlan(an) {
    var box = $('trainingPlan');
    clear(box);
    var cause = an.riepilogo[S.human].cause || {};
    var plan = RV.trainingPlan(cause, 3);
    if (!plan.length) {
      box.appendChild(elt('p', 'muted small', 'Nessun errore ricorrente in questa partita: alza il livello dell\'avversario per allenarti di più.'));
      return;
    }
    plan.forEach(function (p, i) {
      var card = elt('div', 'plan-item');
      var head = elt('div', 'plan-head');
      head.appendChild(elt('span', 'plan-num', String(i + 1)));
      head.appendChild(elt('strong', '', p.info.titolo + ' · ' + p.n + (p.n === 1 ? ' volta' : ' volte')));
      card.appendChild(head);
      card.appendChild(elt('p', '', p.info.consiglio));
      if (p.info.tema) {
        var b = elt('button', 'btn tiny accent', '🧩 Allena "' + PZ.TEMI[p.info.tema].nome + '"');
        b.addEventListener('click', function () {
          S.puzzleFilter = p.info.tema;
          renderThemeChips();
          setTab('puzzle');
          nextPuzzle(true);
        });
        card.appendChild(b);
      } else if (p.info.apertura) {
        var b2 = elt('button', 'btn tiny accent', '📖 Ripassa i principi di apertura');
        b2.addEventListener('click', function () { setTab('impara'); });
        card.appendChild(b2);
      }
      box.appendChild(card);
    });
  }

  function renderProfile() {
    var box = $('profileBox');
    clear(box);
    var prof = S.stats.profilo || {};
    var tot = Object.keys(prof).reduce(function (a, k) { return a + prof[k]; }, 0);
    $('profileMeta').textContent = (S.stats.revisioni || 0) + (S.stats.revisioni === 1 ? ' partita analizzata' : ' partite analizzate');
    if (!tot) {
      box.appendChild(elt('p', 'muted small', 'Analizza qualche partita e qui comparirà la classifica dei tuoi errori ricorrenti.'));
      return;
    }
    var items = RV.trainingPlan(prof, 5);
    items.forEach(function (p) {
      var r = elt('div', 'prof-row');
      r.appendChild(elt('span', 'prof-lab', p.info.titolo));
      var bar = elt('div', 'prof-bar');
      var fill = elt('div', 'prof-fill');
      fill.style.width = Math.round(100 * p.n / items[0].n) + '%';
      bar.appendChild(fill);
      r.appendChild(bar);
      r.appendChild(elt('span', 'prof-n', String(p.n)));
      box.appendChild(r);
    });
    if (S.stats.storicoAcc && S.stats.storicoAcc.length >= 2) {
      var h = S.stats.storicoAcc;
      var media = Math.round(h.reduce(function (a, b) { return a + b; }, 0) / h.length);
      var trend = h[h.length - 1] - h[0];
      box.appendChild(elt('p', 'muted small', 'Accuratezza media delle ultime ' + h.length + ' partite: ' + media + '%' +
        (Math.abs(trend) >= 2 ? (trend > 0 ? ' (in miglioramento, +' + trend + ')' : ' (in calo, ' + trend + ')') : '')));
    }
  }

  function renderRevMoves(an) {
    var box = $('revMoves');
    clear(box);
    an.moves.forEach(function (m, i) {
      var b = elt('button', 'rev-mv ' + m.info.cls + (REV.selected === i ? ' sel' : ''));
      b.appendChild(elt('span', 'rev-num', m.colore === 'w' ? m.numero + '.' : ''));
      b.appendChild(elt('span', 'rev-san', m.san));
      b.appendChild(elt('span', 'rev-ico', m.info.icon));
      b.title = m.info.label + (m.migliore && m.delta > 0.5 ? ' — meglio ' + m.migliore : '');
      b.addEventListener('click', function () { selectReviewMove(i); });
      box.appendChild(b);
    });
  }

  // --------------------------------------------- aggancio per test e debug
  window.CoachApp = {
    stato: S,
    nuovaPartita: newGame,
    vaiA: setTab,
    /** Carica una posizione qualsiasi in modalità "gioca" (usata dai test). */
    caricaFen: function (fen, umano, livello) {
      S.mode = 'gioca';
      S.trainer = null; S.puzzle = null; S.endgame = null;
      resetPosition(fen);
      S.human = umano || S.game.turnColor();
      S.orientation = S.human;
      if (livello) S.level = livello;
      setTab('gioca');
      S.mode = 'gioca';
      render();
      return S.game.fen();
    }
  };

  // ------------------------------------------------------------------- avvio
  renderLevels();
  renderOpeningList('all');
  renderThemeChips();
  renderEndgameList();
  renderImpara();
  renderStats();
  renderPuzzleCounter();
  S.human = 'w'; S.orientation = 'w';
  render();
  coachSay('Benvenuto!', [
    'Questo è un allenatore completo: gioca contro il computer con un coach che spiega ogni mossa, impara le aperture passo per passo, risolvi puzzle tattici e allena i finali.',
    'Per iniziare: scegli il livello (il 2 corrisponde a circa 600 Elo, il tuo) e premi <strong>Inizia a giocare</strong>.'.replace(/<[^>]+>/g, ''),
    'In qualunque momento puoi tornare indietro con ↺ o con le frecce ◀ ▶ e riprovare una mossa diversa.'
  ], []);
})();
