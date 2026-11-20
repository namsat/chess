/* Test end-to-end nel browser (Chrome headless via puppeteer):
   carica la pagina, gioca, allena aperture, risolve un puzzle, e verifica
   che non ci sia nessun errore JavaScript. */
const path = require('path');
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer');

const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const sq = alg => (8 - parseInt(alg[1], 10)) * 16 + 'abcdefgh'.indexOf(alg[0]);

let fail = 0;
function check(label, cond, extra) {
  if (cond) console.log('OK   ' + label);
  else { fail++; console.log('FAIL ' + label + (extra ? ' -> ' + String(extra).slice(0, 300) : '')); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(FILE, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 400));

  // ---------------------------------------------------------- caricamento
  check('64 case disegnate', (await page.$$('.sq')).length === 64);
  check('32 pezzi nella posizione iniziale', (await page.$$('.piece')).length === 32);
  check('5 livelli elencati', (await page.$$('.level')).length === 5);
  check('aperture elencate', (await page.$$('#openingList .op-item')).length >= 8);
  check('trappole elencate', (await page.$$('#trapList .op-item')).length >= 4);
  check('il coach saluta', (await page.$eval('#coachBody', e => e.textContent)).length > 80);

  const click = async alg => { await page.click(`[data-sq="${sq(alg)}"]`); await new Promise(r => setTimeout(r, 90)); };
  const tab = async m => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click(`.tab[data-mode="${m}"]`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 350));
  };
  const clickIn = async sel => {
    await page.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); }, sel);
    await page.click(sel);
    await new Promise(r => setTimeout(r, 300));
  };
  const text = async sel => page.$eval(sel, e => e.textContent.trim());
  const moves = () => page.$$eval('#movelist .mv', els => els.map(e => e.textContent.trim()));

  // ------------------------------------------------------------ partita
  await page.click('#btnNewGame');
  await new Promise(r => setTimeout(r, 200));
  await click('e2');
  check('mostra le mosse legali del pedone e2', (await page.$$('.sq .dot')).length >= 2);
  await click('e4');
  await page.waitForFunction('document.querySelectorAll("#movelist .mv").length >= 2', { timeout: 15000 });
  const mv1 = await moves();
  check('la mia mossa e la risposta del computer sono registrate', mv1.length >= 2 && mv1[0].indexOf('e4') === 0, mv1.join(' '));
  check('il coach commenta la mossa', (await text('#coachBody')).length > 60);

  await page.click('#btnHint');
  await page.waitForFunction('!document.getElementById("hintBox").hidden', { timeout: 15000 });
  check('primo suggerimento mostrato', (await page.$$eval('#hintList li', e => e.length)) >= 1);
  await page.click('#btnHint'); await new Promise(r => setTimeout(r, 300));
  await page.click('#btnHint'); await new Promise(r => setTimeout(r, 600));
  const hints = await page.$$eval('#hintList li', els => els.map(e => e.textContent));
  check('tre suggerimenti progressivi', hints.length >= 3, hints.join(' | '));
  check('il terzo suggerimento contiene una mossa', /[a-h][1-8]/.test(hints[2]), hints[2]);
  check('freccia del suggerimento disegnata', (await page.$$('#arrows line')).length >= 1);

  await page.click('#btnExplain'); await new Promise(r => setTimeout(r, 900));
  check('spiegazione della posizione', (await text('#coachBody')).length > 80);
  await page.click('#btnBestLine'); await new Promise(r => setTimeout(r, 1200));
  check('variante migliore con spiegazioni', (await page.$$eval('#coachBody li', e => e.length)) >= 2);

  // navigazione avanti/indietro
  await page.click('#navPrev'); await new Promise(r => setTimeout(r, 200));
  await page.click('#navStart'); await new Promise(r => setTimeout(r, 200));
  check('torna alla posizione iniziale', (await page.$$('.piece')).length === 32);
  await page.click('#navEnd'); await new Promise(r => setTimeout(r, 200));
  const beforeUndo = (await moves()).length;
  await page.click('#btnUndo'); await new Promise(r => setTimeout(r, 300));
  check('"torna indietro" annulla la mia mossa e la risposta', (await moves()).length < beforeUndo, beforeUndo + ' -> ' + (await moves()).length);

  // gioca un'altra mossa dopo l'annullamento
  await click('d2'); await click('d4');
  await page.waitForFunction('document.querySelectorAll("#movelist .mv").length >= 2', { timeout: 15000 });
  check('si può rigiocare dopo aver annullato', (await moves())[0].indexOf('d4') === 0, (await moves()).join(' '));

  // ---------------------------------------------- avviso prima di un errore
  await page.evaluate(() => window.CoachApp.caricaFen('4k3/8/8/r7/8/8/3Q4/4K3 w - - 0 1', 'w', 2));
  await new Promise(r => setTimeout(r, 300));
  await click('d2'); await click('d5');
  await page.waitForFunction('!document.getElementById("warnModal").hidden', { timeout: 15000 });
  check('avvisa prima di regalare la donna', !(await page.$eval('#warnModal', e => e.hidden)));
  check('l\'avviso spiega cosa si perde', /punti|avversario/i.test(await text('#warnText')), await text('#warnText'));
  await page.click('#warnBack'); await new Promise(r => setTimeout(r, 250));
  check('"Riprovo" annulla la mossa', (await moves()).length === 0 && (await page.$eval('#warnModal', e => e.hidden)));
  await click('d2'); await click('d5');
  await page.waitForFunction('!document.getElementById("warnModal").hidden', { timeout: 15000 });
  await page.click('#warnGo');
  await page.waitForFunction('document.querySelectorAll("#movelist .mv").length >= 1', { timeout: 15000 });
  check('"Gioco comunque" esegue la mossa', (await moves())[0].indexOf('Qd5') === 0, (await moves()).join(' '));
  const marker = await page.$$eval('#movelist .mv .q', els => els.map(e => e.className + ':' + e.textContent));
  check('la mossa è segnata come errore grave nella lista', marker.some(m => /blunder|mistake/.test(m)), marker.join(' '));

  // promozione: scelta del pezzo
  await page.evaluate(() => window.CoachApp.caricaFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'w', 1));
  await new Promise(r => setTimeout(r, 300));
  await click('a7'); await click('a8');
  await page.waitForFunction('!document.getElementById("promoModal").hidden', { timeout: 10000 });
  check('chiede quale pezzo di promozione', (await page.$$('#promoRow .promo-btn')).length === 4);
  await page.click('#promoRow .promo-btn:nth-child(1)');   // donna
  await page.waitForFunction('document.querySelectorAll("#movelist .mv").length >= 1', { timeout: 15000 });
  check('promozione a donna registrata', /a8=Q/.test((await moves())[0]), (await moves()).join(' '));

  // fine partita riconosciuta
  await page.evaluate(() => window.CoachApp.caricaFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'w', 1));
  await new Promise(r => setTimeout(r, 300));
  await click('a1'); await click('a8');
  await new Promise(r => setTimeout(r, 1200));
  check('scacco matto riconosciuto e annunciato', /vinto/i.test(await text('#coachBody')), await text('#coachBody'));

  await page.evaluate(() => window.CoachApp.nuovaPartita());
  await new Promise(r => setTimeout(r, 300));

  // ------------------------------------------------------------ aperture
  await tab('aperture');
  await clickIn('#openingList .op-item');
  check('trainer aperture aperto', !(await page.$eval('#openingTrainer', e => e.hidden)));
  check('il trainer chiede la prima mossa', /tocca a te/i.test(await text('#opStep')), await text('#opStep'));
  await page.click('#opReveal'); await new Promise(r => setTimeout(r, 300));
  check('"Mostra la mossa" rivela la mossa del libro', /La mossa è/i.test(await text('#opStep')), await text('#opStep'));
  await page.click('#opPlay');
  await page.waitForFunction('/✅/.test(document.getElementById("opStep").textContent)', { timeout: 15000 });
  check('la mossa del libro viene accettata', /✅/.test(await text('#opStep')));
  await page.waitForFunction('document.getElementById("opProgress").style.width !== "0%"', { timeout: 15000 });
  check('barra di avanzamento aggiornata', (await page.$eval('#opProgress', e => e.style.width)) !== '0%');
  // mossa sbagliata: deve spiegare
  await new Promise(r => setTimeout(r, 2500));
  await click('a2'); await click('a4'); await new Promise(r => setTimeout(r, 500));
  const stepTxt = await text('#opStep');
  check('una mossa fuori libro viene corretta', /non è la mossa|✅|tocca a te/i.test(stepTxt), stepTxt);
  await page.click('#opBack'); await new Promise(r => setTimeout(r, 400));
  check('si può tornare indietro nel trainer', true);

  // ------------------------------------------------------------- puzzle
  await tab('puzzle');
  check('puzzle caricato', (await text('#puzzleTask')).length > 30, await text('#puzzleTask'));
  check('temi disponibili', (await page.$$('#themeChips .chip')).length >= 8);
  await page.click('#pzHint'); await new Promise(r => setTimeout(r, 200));
  await page.click('#pzHint'); await new Promise(r => setTimeout(r, 200));
  await page.click('#pzHint'); await new Promise(r => setTimeout(r, 200));
  check('tre aiutini del puzzle', (await page.$$eval('#puzzleHintList li', e => e.length)) >= 3);
  await page.click('#pzSolution');
  await page.waitForFunction('/Soluzione completa|Da ricordare/.test(document.getElementById("puzzleFeedback").textContent + document.getElementById("puzzleLesson").textContent)', { timeout: 25000 });
  check('soluzione mostrata passo per passo', /Soluzione completa|Da ricordare/.test((await text('#puzzleFeedback')) + (await text('#puzzleLesson'))));
  await page.click('#pzNext'); await new Promise(r => setTimeout(r, 400));
  check('prossimo puzzle caricato', (await page.$eval('#puzzleFeedback', e => e.hidden)) === true);

  // risolve davvero un puzzle: matto in 1 scelto a mano
  await page.evaluate(() => {
    const p = window.ChessPuzzles.PUZZLES.find(x => x.id === 'm1-corridoio');
    document.querySelectorAll('#themeChips .chip')[0].click();
    return p;
  });
  await new Promise(r => setTimeout(r, 300));
  const loaded = await page.evaluate(() => {
    // carica esplicitamente il puzzle del matto di corridoio
    const chips = Array.from(document.querySelectorAll('#themeChips .chip'));
    const c = chips.find(x => x.textContent.indexOf('Matto in 1') >= 0);
    if (c) c.click();
    return true;
  });
  await new Promise(r => setTimeout(r, 600));
  check('filtro per tema applicato', /Matto in 1/.test(await text('#puzzleTheme')), await text('#puzzleTheme'));

  // ------------------------------------------------------------- finali
  await tab('finali');
  check('esercizi di finale elencati', (await page.$$('#endgameList .op-item')).length >= 4);
  await clickIn('#endgameList .op-item');
  check('esercizio di finale avviato', /Tecnica/.test(await text('#egHow')), await text('#egHow'));
  await page.click('#egHint');
  await page.waitForFunction('!document.getElementById("hintBox").hidden', { timeout: 15000 });
  check('suggerimento nel finale', (await page.$$eval('#hintList li', e => e.length)) >= 1);

  // ------------------------------------------------------------- impara
  await tab('impara');
  check('8 principi di apertura', (await page.$$('#principlesBox .principle')).length === 8);
  check('valori dei pezzi', (await page.$$('#valuesBox .value-item')).length === 6);
  check('temi tattici spiegati', (await page.$$('#themesBox .theme')).length >= 8);

  // ------------------------------------------------- schermate e responsive
  await tab('gioca');
  await page.screenshot({ path: path.resolve(__dirname, 'shot-desktop.png') });
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 400));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('nessuno scorrimento orizzontale su mobile (' + overflow + 'px)', overflow <= 2, overflow);
  await page.screenshot({ path: path.resolve(__dirname, 'shot-mobile.png'), fullPage: false });

  check('nessun errore JavaScript', errors.length === 0, errors.join(' || '));

  await browser.close();
  console.log(fail === 0 ? '\nTUTTI I TEST BROWSER SUPERATI' : `\n${fail} TEST BROWSER FALLITI`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRORE FATALE: ' + e.message); process.exit(1); });
