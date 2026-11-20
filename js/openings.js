/*!
 * openings.js — Repertorio di aperture spiegate mossa per mossa,
 * pensato per giocatori da 500 a 1000 Elo.
 */
(function (global) {
  'use strict';

  var PRINCIPI = [
    { t: 'Occupa il centro', d: 'Le prime mosse migliori sono 1.e4, 1.d4 (o come nero ...e5, ...d5, ...c5): un pedone al centro apre le linee ai tuoi pezzi e toglie spazio all\'avversario.' },
    { t: 'Sviluppa cavalli e alfieri', d: 'Porta fuori un pezzo nuovo a ogni mossa. Nelle prime 6-8 mosse dovresti avere entrambi i cavalli e almeno un alfiere in gioco.' },
    { t: 'Non muovere due volte lo stesso pezzo', d: 'Ogni mossa "ripetuta" nell\'apertura è un tempo regalato, a meno che non guadagni materiale o eviti una perdita.' },
    { t: 'Arrocca presto', d: 'Entro la mossa 10, quasi sempre. Il re al centro è il motivo numero uno delle sconfitte sotto i 1000 Elo.' },
    { t: 'Non tirare fuori la donna troppo presto', d: 'La donna esposta viene attaccata dai pezzi minori e tu perdi tempi scappando. L\'eccezione: quando c\'è un guadagno concreto.' },
    { t: 'Non prendere pedoni "gratis" ai lati', d: 'Nell\'apertura il materiale conta meno dello sviluppo. Il pedone b2/g2 "avvelenato" costa spesso un pezzo.' },
    { t: 'Collega le torri', d: 'Dopo l\'arrocco, sposta la donna da d1/d8 e porta le torri sulle colonne aperte o semiaperte: è il ponte verso il mediogioco.' },
    { t: 'Dopo ogni mossa dell\'avversario chiediti: cosa minaccia?', d: 'Controlla scacchi, catture e minacce (la regola delle "3 C"). Con questa abitudine guadagni 200 punti Elo da solo.' }
  ];

  var OPENINGS = [
    // ------------------------------------------------------------- BIANCO
    {
      id: 'italiana',
      name: 'Apertura Italiana',
      side: 'w',
      family: 'Aperture di pedone e (1.e4)',
      stars: 1,
      idea: 'La migliore prima apertura in assoluto: sviluppo naturale, centro solido, nessuna variante da memorizzare.',
      why: 'Porti subito fuori cavallo e alfiere puntando il punto debole f7, poi arrocchi. Ti insegna tutti i principi dell\'apertura mentre li usi.',
      moves: [
        { san: 'e4', text: 'Occupa il centro e apre la strada ad alfiere e donna. La mossa più giocata al mondo.' },
        { san: 'e5', text: 'Il nero risponde simmetricamente: anche lui vuole la sua fetta di centro.' },
        { san: 'Nf3', text: 'Sviluppo + minaccia: attacchi il pedone e5. Un cavallo in f3 è sempre ben piazzato.' },
        { san: 'Nc6', text: 'Il nero difende e5 sviluppando. Nota che difende con un pezzo, non con un pedone.' },
        { san: 'Bc4', text: 'L\'alfiere punta su f7, la casa più debole del nero (difesa solo dal re).', key: true },
        { san: 'Bc5', text: 'Il nero copia l\'idea puntando f2. Posizione simmetrica: chi sviluppa meglio avrà il vantaggio.' },
        { san: 'c3', text: 'Prepara d4 per costruire un centro di pedoni grande e dare aria all\'alfiere.' },
        { san: 'Nf6', text: 'Ultimo pezzo minore del nero in gioco, con pressione su e4.' },
        { san: 'd3', text: 'Il "Giuoco Pianissimo": solidissimo. Difende e4 e tiene chiusa la posizione finché non sei arroccato.' },
        { san: 'd6', text: 'Il nero fa lo stesso: niente debolezze, partita di manovra.' },
        { san: 'O-O', text: 'Re al sicuro, torre verso il centro. Ora puoi pensare a Bg5, Nbd2, Re1 e al piano d4.', key: true },
        { san: 'O-O', text: 'Entrambi arroccati: apertura finita. Hai raggiunto il mediogioco senza debolezze.' }
      ],
      mistakes: [
        { after: 4, san: 'Ng5', text: 'Troppo presto: il cavallo in g5 viene cacciato e tu perdi tempo. Prima sviluppa tutto.' },
        { after: 4, san: 'Nxe5', text: 'Cattura avventata: dopo 3.Nxe5?? Nxe5 hai dato un cavallo per un pedone. Conta sempre i difensori: e5 è difeso dal cavallo c6.' }
      ],
      next: 'Dopo l\'arrocco il piano tipico è: Re1, Nbd2, Nf1-g3 oppure h3 e d4 al momento giusto.'
    },
    {
      id: 'spagnola',
      name: 'Spagnola (Ruy Lopez)',
      side: 'w',
      family: 'Aperture di pedone e (1.e4)',
      stars: 2,
      idea: 'L\'apertura classica per eccellenza: attacchi il difensore del centro (il cavallo c6) invece del pedone.',
      why: 'Più ambiziosa dell\'Italiana. Ti insegna il concetto di pressione a lungo termine e di piccolo vantaggio accumulato.',
      moves: [
        { san: 'e4', text: 'Centro.' },
        { san: 'e5', text: 'Simmetria.' },
        { san: 'Nf3', text: 'Attacchi e5 e sviluppi.' },
        { san: 'Nc6', text: 'Difende il pedone.' },
        { san: 'Bb5', text: 'Idea chiave: attacco il pezzo che difende e5. Se un giorno riesco a prendere in c6, il pedone e5 cade.', key: true },
        { san: 'a6', text: 'La difesa Morphy, la più popolare: caccia l\'alfiere prima che possa pensare a Bxc6.' },
        { san: 'Ba4', text: 'L\'alfiere resta sulla diagonale buona, pronto a ritirarsi in b3 verso f7.' },
        { san: 'Nf6', text: 'Il nero sviluppa attaccando e4.' },
        { san: 'O-O', text: 'Re al sicuro e, soprattutto, ora e4 è difeso indirettamente: se 5...Nxe4 6.Re1 recupera il pezzo o il pedone.', key: true },
        { san: 'Be7', text: 'Sviluppo modesto ma solido: il nero si prepara ad arroccare.' },
        { san: 'Re1', text: 'Difende e4 "per davvero" e mette la torre sulla colonna che si aprirà.' },
        { san: 'b5', text: 'Il nero guadagna spazio e caccia l\'alfiere.' },
        { san: 'Bb3', text: 'L\'alfiere torna a guardare f7: la diagonale a2-g8 è la sua autostrada.' },
        { san: 'd6', text: 'Il nero consolida il pedone e5.' },
        { san: 'c3', text: 'Prepara d4 e dà una casa di fuga all\'alfiere in c2.' },
        { san: 'O-O', text: 'Posizione classica della Spagnola chiusa: manovre lente, piano bianco Nbd2-f1-g3 e d4.' }
      ],
      mistakes: [
        { after: 6, san: 'Bxc6', text: 'Lo "scambio" è giocabile ma regala la coppia di alfieri: a questo livello conviene tenere l\'alfiere e giocare Ba4.' },
        { after: 12, san: 'Bxb5', text: 'Non funziona: dopo axb5 hai dato un alfiere per un pedone. Controlla sempre i difensori prima di catturare.' }
      ],
      next: 'Se il nero gioca 3...Nf6 invece di 3...a6 entri nella Berlinese: 4.O-O Nxe4 5.d4 è la linea classica.'
    },
    {
      id: 'scozzese',
      name: 'Partita Scozzese',
      side: 'w',
      family: 'Aperture di pedone e (1.e4)',
      stars: 1,
      idea: 'Apri il centro subito con 3.d4: pochissima teoria, posizioni chiare, i pezzi respirano.',
      why: 'Ottima se non vuoi studiare: il centro si libera presto e vince chi muove meglio i pezzi, non chi ricorda più mosse.',
      moves: [
        { san: 'e4', text: 'Centro.' },
        { san: 'e5', text: 'Simmetria.' },
        { san: 'Nf3', text: 'Attacco e sviluppo.' },
        { san: 'Nc6', text: 'Difesa del pedone.' },
        { san: 'd4', text: 'Il cuore della Scozzese: apro immediatamente il centro mentre il nero non è ancora sviluppato.', key: true },
        { san: 'exd4', text: 'Quasi forzato: se il nero non prende, il bianco prende lui e domina il centro.' },
        { san: 'Nxd4', text: 'Recupero il pedone con un pezzo attivo al centro.' },
        { san: 'Nf6', text: 'Sviluppo con attacco a e4 (la mossa più naturale).' },
        { san: 'Nxc6', text: 'Semplifica e rovina la struttura di pedoni avversaria.' },
        { san: 'bxc6', text: 'Il nero prende col pedone, aprendo la colonna b ma restando con pedoni doppi.' },
        { san: 'Nc3', text: 'Difendo e4 sviluppando: ora posso arroccare in sicurezza.' },
        { san: 'd5', text: 'Il nero contrattacca al centro per liberare i suoi pezzi.' },
        { san: 'exd5', text: 'Prendo: la colonna e si apre.' },
        { san: 'cxd5', text: 'Posizione equilibrata ma dalle idee semplici: il nero ha il centro, il bianco un pedone sano in più sull\'ala.' },
        { san: 'Bd3', text: 'Sviluppo puntando h7 e preparo l\'arrocco.' },
        { san: 'Be7', text: 'Il nero si prepara ad arroccare.' },
        { san: 'O-O', text: 'Re al sicuro. Apertura completata: colonne e aperte, piano Re1 e pressione su e7/d5.', key: true }
      ],
      mistakes: [
        { after: 6, san: 'Qxd4', text: 'Possibile ma la donna al centro viene attaccata: dopo ...Nc6 o ...Nf6 perdi tempi. Con il cavallo è più naturale.' }
      ],
      next: 'Se il nero gioca 4...Bc5 attaccando il cavallo, rispondi 5.Nxc6 oppure 5.Be3 difendendo con sviluppo.'
    },
    {
      id: 'londra',
      name: 'Sistema Londra',
      side: 'w',
      family: 'Aperture di pedone d (1.d4)',
      stars: 1,
      idea: 'Un "sistema": giochi quasi sempre le stesse 6 mosse qualunque cosa faccia il nero.',
      why: 'Zero memorizzazione, struttura solidissima, piano d\'attacco chiaro sull\'ala di re. Fortissimo contro avversari che non la conoscono.',
      moves: [
        { san: 'd4', text: 'Centro con l\'altro pedone: posizioni più chiuse e tranquille rispetto a 1.e4.' },
        { san: 'd5', text: 'Risposta simmetrica.' },
        { san: 'Nf3', text: 'Sviluppo, controlla e5.' },
        { san: 'Nf6', text: 'Il nero fa lo stesso.' },
        { san: 'Bf4', text: 'La mossa che dà il nome al sistema: l\'alfiere esce PRIMA di chiudere con e3. Ricordalo: Bf4 prima di e3!', key: true },
        { san: 'e6', text: 'Il nero sviluppa il suo alfiere di casa chiara.' },
        { san: 'e3', text: 'Ora sì: il pedone sostiene d4 e apre la strada all\'alfiere f1.' },
        { san: 'c5', text: 'Il nero attacca il centro: è la reazione più logica.' },
        { san: 'c3', text: 'Mantengo il pedone d4 solido. La struttura "piramide" c3-d4-e3 è il marchio della Londra.' },
        { san: 'Nc6', text: 'Sviluppo e pressione su d4.' },
        { san: 'Nbd2', text: 'Sviluppo flessibile: il cavallo va verso f3-e5 o b3/c4 e lascio libera la colonna c.' },
        { san: 'Bd6', text: 'Il nero propone lo scambio degli alfieri.' },
        { san: 'Bg3', text: 'Evito lo scambio e tengo l\'alfiere attivo: può diventare pericolosissimo dopo h4-h5.' },
        { san: 'O-O', text: 'Il nero si mette al sicuro.' },
        { san: 'Bd3', text: 'Il secondo alfiere punta h7: la coppia Bd3+Bg3 è l\'inizio dell\'attacco.' },
        { san: 'b6', text: 'Il nero sviluppa sul lato di donna.' },
        { san: 'O-O', text: 'Arrocco. Piano tipico: Ne5, Qf3/Qe2, f4-f5 oppure h4-h5 con attacco al re.', key: true }
      ],
      mistakes: [
        { after: 4, san: 'e3', text: 'Se giochi e3 prima di Bf4 l\'alfiere resta chiuso dietro i suoi pedoni: è l\'errore classico di chi impara la Londra.' }
      ],
      next: 'Contro ...g6 (impostazione indiana) gioca semplicemente Bf4, e3, c3, Nbd2, Bd3, h3 e poi e4.'
    },
    {
      id: 'gambetto-donna',
      name: 'Gambetto di Donna',
      side: 'w',
      family: 'Aperture di pedone d (1.d4)',
      stars: 2,
      idea: 'Offri un pedone laterale (c4) per ottenere in cambio il centro: in realtà il pedone lo recuperi quasi sempre.',
      why: 'L\'apertura più solida per il bianco. Ti insegna il valore del centro contro il materiale e strutture che si ripetono in migliaia di partite.',
      moves: [
        { san: 'd4', text: 'Centro.' },
        { san: 'd5', text: 'Simmetria.' },
        { san: 'c4', text: 'Il gambetto: attacco d5 dal lato. Non è un vero sacrificio, perché dopo dxc4 recupero con e3/Bxc4 o a4.', key: true },
        { san: 'e6', text: 'Difesa ortodossa: il nero rinforza d5 e apre all\'alfiere f8. (Se prende con 2...dxc4 è il "Gambetto accettato".)' },
        { san: 'Nc3', text: 'Aumento la pressione su d5 sviluppando.' },
        { san: 'Nf6', text: 'Sviluppo e difesa di d5.' },
        { san: 'Bg5', text: 'Inchiodo il cavallo f6: ora non può muoversi senza esporre la donna d8.', key: true },
        { san: 'Be7', text: 'Il nero rompe l\'inchiodatura difendendo il cavallo con l\'alfiere.' },
        { san: 'e3', text: 'Modesta ma utilissima: libera l\'alfiere f1 e consolida d4.' },
        { san: 'O-O', text: 'Il nero si mette al sicuro.' },
        { san: 'Nf3', text: 'Ultimo pezzo minore in gioco: tutti sviluppati.' },
        { san: 'h6', text: 'Il nero chiede conto all\'alfiere.' },
        { san: 'Bh4', text: 'L\'alfiere resta sulla diagonale: mantiene la pressione sul cavallo f6.' },
        { san: 'b6', text: 'Il nero prepara lo sviluppo dell\'alfiere c8 (il suo pezzo problematico).' },
        { san: 'Bd3', text: 'Sviluppo verso h7 e preparo l\'arrocco. Posizione tipica: bianco con più spazio.', key: true }
      ],
      mistakes: [
        { after: 2, san: 'e4', text: 'Dopo 1.d4 d5 la mossa 2.e4?! regala un pedone senza compenso: dxe4 e il nero sta meglio.' },
        { after: 6, san: 'Bf4', text: 'Giocabile, ma Bg5 è più incisivo perché inchioda subito il cavallo.' }
      ],
      next: 'Se il nero accetta (2...dxc4) gioca 3.e3! Nf6 4.Bxc4 e6 5.Nf3 c5: recuperi il pedone con bel gioco.'
    },

    // --------------------------------------------------------------- NERO
    {
      id: 'siciliana',
      name: 'Difesa Siciliana',
      side: 'b',
      family: 'Risposte a 1.e4',
      stars: 2,
      idea: 'Non copiare il bianco: rispondi 1...c5, attacchi il centro di lato e giochi per vincere, non per pareggiare.',
      why: 'La difesa più vincente per il nero. Dà posizioni asimmetriche dove chi conosce i piani vince: ti insegna il controgioco sulla colonna c.',
      moves: [
        { san: 'e4', text: 'Il bianco occupa il centro.' },
        { san: 'c5', text: 'La Siciliana: attacco d4 senza impegnare il pedone e. La colonna c diventerà la mia autostrada.', key: true },
        { san: 'Nf3', text: 'Sviluppo naturale del bianco, prepara d4.' },
        { san: 'd6', text: 'Controllo e5 e apro la strada all\'alfiere c8. Flessibile: va bene contro quasi tutto.' },
        { san: 'd4', text: 'Il bianco apre il centro.' },
        { san: 'cxd4', text: 'Prendo: così elimino un pedone centrale bianco e apro la mia colonna c.' },
        { san: 'Nxd4', text: 'Il bianco recupera con il cavallo.' },
        { san: 'Nf6', text: 'Sviluppo attaccando e4: guadagno un tempo.' },
        { san: 'Nc3', text: 'Il bianco difende e4.' },
        { san: 'g6', text: 'Variante del Drago: preparo l\'alfiere in g7, il pezzo più forte della posizione sulla diagonale lunga.', key: true },
        { san: 'Be3', text: 'Sviluppo del bianco, protegge il cavallo d4.' },
        { san: 'Bg7', text: 'L\'alfiere "drago": punta d4-c3-b2, cioè il cuore della posizione bianca.' },
        { san: 'f3', text: 'Il bianco blinda e4 e prepara Qd2 e l\'arrocco lungo.' },
        { san: 'O-O', text: 'Re al sicuro. Il mio piano è chiaro: ...Nc6, ...Bd7, ...Rc8 e pressione sulla colonna c.', key: true }
      ],
      mistakes: [
        { after: 5, san: 'Nf6', text: 'Il momento giusto per prendere è adesso, con ...cxd4. Rimandare permette 4.dxc5! dxc5 5.Qxd8+ Kxd8: resti senza arrocco in un finale scomodo.' },
        { after: 9, san: 'Ng4', text: 'Muovere due volte lo stesso cavallo in apertura regala tempi: sviluppa invece un pezzo nuovo.' }
      ],
      next: 'Piano di mediogioco: ...Nc6, ...Bd7, ...Rc8, ...Qa5 o ...b5; gioca sempre sull\'ala di donna mentre il bianco attacca a destra.'
    },
    {
      id: 'caro-kann',
      name: 'Difesa Caro-Kann',
      side: 'b',
      family: 'Risposte a 1.e4',
      stars: 1,
      idea: 'Prepari ...d5 con 1...c6: contesti il centro senza creare debolezze e senza chiudere il tuo alfiere.',
      why: 'La difesa più solida e facile da imparare contro 1.e4: pochissime trappole, struttura sana, finali spesso favorevoli.',
      moves: [
        { san: 'e4', text: 'Il bianco al centro.' },
        { san: 'c6', text: 'Modesta ma profonda: preparo ...d5 sostenuto da un pedone, non dalla donna.', key: true },
        { san: 'd4', text: 'Il bianco costruisce il centro ideale.' },
        { san: 'd5', text: 'Ecco il colpo: attacco e4 con un pedone difeso. Il bianco deve decidere subito cosa fare.', key: true },
        { san: 'Nc3', text: 'Il bianco difende e4 con un pezzo (variante del cambio di cavalli).' },
        { san: 'dxe4', text: 'Prendo: così resto senza debolezze e con un pedone centrale in meno da difendere.' },
        { san: 'Nxe4', text: 'Il bianco recupera con il cavallo, ben piazzato al centro.' },
        { san: 'Bf5', text: 'Sviluppo l\'alfiere FUORI dalla catena di pedoni, attaccando il cavallo. Questo è il grande vantaggio della Caro-Kann.', key: true },
        { san: 'Ng3', text: 'Il bianco caccia l\'alfiere.' },
        { san: 'Bg6', text: 'L\'alfiere resta attivo e al sicuro sulla diagonale b1-h7.' },
        { san: 'h4', text: 'Il bianco guadagna spazio minacciando h5.' },
        { san: 'h6', text: 'Mossa necessaria: creo una casa di fuga in h7 ed evito che h5 intrappoli l\'alfiere.', key: true },
        { san: 'Nf3', text: 'Sviluppo del bianco.' },
        { san: 'Nd7', text: 'Sviluppo flessibile: il cavallo andrà in f6 (dopo che il bianco non può più cacciarlo) o in b6.' },
        { san: 'Bd3', text: 'Il bianco propone lo scambio degli alfieri.' },
        { san: 'Bxd3', text: 'Accetto: ogni scambio mi avvicina a un finale comodo, dove la mia struttura sana conta.' },
        { san: 'Qxd3', text: 'Posizione classica: il bianco ha un po\' più spazio, il nero nessuna debolezza. Ora ...e6, ...Ngf6, ...Be7, ...O-O.' }
      ],
      mistakes: [
        { after: 11, san: 'Nf6', text: 'Attenzione: con il pedone bianco in h4 la mossa ...Nf6 permette h5! che caccia l\'alfiere g6 e lo intrappola. Prima ...h6!' }
      ],
      next: 'Completa con ...e6, ...Ngf6, ...Be7, ...O-O, ...c5 e gioca per il finale: la tua struttura è più sana.'
    },
    {
      id: 'francese',
      name: 'Difesa Francese',
      side: 'b',
      family: 'Risposte a 1.e4',
      stars: 2,
      idea: '1...e6 prepara ...d5: centro solido, posizioni chiuse e un piano chiarissimo (attaccare d4 con ...c5).',
      why: 'Perfetta se ti piacciono le posizioni strategiche e non vuoi partite tattiche selvagge. Il difetto da conoscere: l\'alfiere c8 resta chiuso.',
      moves: [
        { san: 'e4', text: 'Il bianco al centro.' },
        { san: 'e6', text: 'La Francese: preparo ...d5 in un colpo solo. Lo svantaggio è che chiudo l\'alfiere c8, il "pezzo problematico".', key: true },
        { san: 'd4', text: 'Il bianco costruisce il centro.' },
        { san: 'd5', text: 'Contesto il centro. Il bianco deve scegliere: difendere e4, spingere e5 o cambiare.' },
        { san: 'Nc3', text: 'Il bianco difende e4 sviluppando.' },
        { san: 'Nf6', text: 'Aumento la pressione su e4: il bianco di solito spinge.' },
        { san: 'e5', text: 'Il bianco guadagna spazio e caccia il cavallo: la posizione si chiude.' },
        { san: 'Nfd7', text: 'Il cavallo si ritira ma tiene d\'occhio e5 e c5. Nota la notazione "fd7": chiarisce quale cavallo si muove.', key: true },
        { san: 'f4', text: 'Il bianco difende e5 e si prepara ad attaccare sull\'ala di re.' },
        { san: 'c5', text: 'La mossa chiave di tutta la Francese: attacco la base della catena di pedoni bianca (d4).', key: true },
        { san: 'Nf3', text: 'Il bianco difende d4 sviluppando.' },
        { san: 'Nc6', text: 'Secondo attaccante su d4. Il piano è semplice: tutti contro d4.' },
        { san: 'Be3', text: 'Terzo difensore di d4.' },
        { san: 'Qb6', text: 'Quarto attaccante e pressione su b2. Ecco la Francese: lotta di pezzi intorno a una casa.' }
      ],
      mistakes: [
        { after: 7, san: 'Ne4', text: 'Il cavallo in e4 viene catturato dal cavallo c3 o cacciato: in questa struttura il posto giusto è d7.' },
        { after: 9, san: 'f6', text: 'Attaccare la punta della catena invece della base è meno efficace e indebolisce il tuo re: gioca ...c5.' }
      ],
      next: 'Ricorda i due piani del nero: ...c5 contro d4 e, nei finali, portare l\'alfiere c8 fuori con ...b6 e ...Ba6.'
    },
    {
      id: 'scandinava',
      name: 'Difesa Scandinava',
      side: 'b',
      family: 'Risposte a 1.e4',
      stars: 1,
      idea: '1...d5 subito: elimini il pedone e4 alla seconda mossa e ti ritrovi in posizioni semplici e chiare.',
      why: 'La difesa più facile da imparare per chi parte da 600 Elo: poche varianti, nessun centro soffocato, l\'alfiere c8 respira sempre.',
      moves: [
        { san: 'e4', text: 'Il bianco al centro.' },
        { san: 'd5', text: 'Scandinava: attacco immediatamente e4. Il bianco quasi sempre prende.', key: true },
        { san: 'exd5', text: 'Il bianco accetta lo scambio.' },
        { san: 'Qxd5', text: 'Recupero con la donna. Sì, la donna esce presto: è l\'unica eccezione accettata alla regola, perché non ci sono pezzi che la cacciano con guadagno... per ora.', key: true },
        { san: 'Nc3', text: 'Il bianco sviluppa guadagnando un tempo sulla mia donna.' },
        { san: 'Qa5', text: 'La casa migliore: la donna resta attiva, sulla diagonale verso e1, e non sarà più attaccata facilmente.', key: true },
        { san: 'd4', text: 'Il bianco costruisce il centro.' },
        { san: 'Nf6', text: 'Sviluppo naturale, controllo d5 ed e4.' },
        { san: 'Nf3', text: 'Il bianco sviluppa il secondo cavallo.' },
        { san: 'c6', text: 'Mossa utilissima: dà una casa alla donna, prepara ...Bf5 e toglie b5 ai pezzi bianchi.' },
        { san: 'Bc4', text: 'L\'alfiere bianco punta f7.' },
        { san: 'Bf5', text: 'Sviluppo attivo fuori dalla catena: l\'alfiere controlla la diagonale b1-h7.' },
        { san: 'Bd2', text: 'Il bianco sviluppa e prepara di scacciare la donna con Nb5 o Qe2.' },
        { san: 'e6', text: 'Apro all\'alfiere f8 e consolido d5/f5. Poi ...Bb4 oppure ...Be7, ...Nbd7 e ...O-O.', key: true }
      ],
      mistakes: [
        { after: 5, san: 'Qd8', text: 'Ritirarsi in d8 è passivo: hai perso due tempi per nulla. In a5 la donna è attiva e sicura.' },
        { after: 5, san: 'Qe5', text: 'La donna in e5 finisce davanti ai pezzi: dopo Nf3 o d4 viene attaccata di nuovo.' },
        { after: 3, san: 'Nf6', text: 'La variante del "gambetto islandese/moderno" (2...Nf6) è giocabile ma più teorica: per ora prendi con la donna.' }
      ],
      next: 'Schema completo da ricordare: ...Qa5, ...Nf6, ...c6, ...Bf5, ...e6, ...Nbd7, ...O-O-O oppure ...Be7 e ...O-O.'
    },
    {
      id: 'slava',
      name: 'Difesa Slava',
      side: 'b',
      family: 'Risposte a 1.d4',
      stars: 1,
      idea: 'Contro 1.d4 d5 2.c4 difendi il centro con 2...c6 tenendo libero l\'alfiere c8.',
      why: 'La risposta più sana al Gambetto di Donna: struttura solida, nessun pezzo chiuso, piani semplici.',
      moves: [
        { san: 'd4', text: 'Il bianco al centro.' },
        { san: 'd5', text: 'Risposta simmetrica, la più solida.' },
        { san: 'c4', text: 'Gambetto di Donna: il bianco attacca d5.' },
        { san: 'c6', text: 'Slava: difendo d5 con un pedone e, a differenza della Francese, NON chiudo il mio alfiere c8.', key: true },
        { san: 'Nf3', text: 'Sviluppo del bianco.' },
        { san: 'Nf6', text: 'Sviluppo simmetrico.' },
        { san: 'Nc3', text: 'Il bianco aumenta la pressione su d5.' },
        { san: 'dxc4', text: 'Prendo al momento giusto: ora il bianco deve spendere un tempo per recuperare il pedone.', key: true },
        { san: 'a4', text: 'Il bianco impedisce ...b5 (che difenderebbe il pedone c4).' },
        { san: 'Bf5', text: 'Ecco il senso della Slava: l\'alfiere esce libero prima di giocare ...e6.', key: true },
        { san: 'e3', text: 'Il bianco prepara Bxc4.' },
        { san: 'e6', text: 'Ora sì: l\'alfiere è già fuori, posso chiudere la diagonale senza rimpianti.' },
        { san: 'Bxc4', text: 'Il bianco recupera il pedone.' },
        { san: 'Bb4', text: 'Sviluppo con inchiodatura sul cavallo c3: pronto ad arroccare. Posizione sana e giocabilissima.', key: true }
      ],
      mistakes: [
        { after: 7, san: 'e6', text: 'Giocabile (diventa la Semi-Slava) ma chiude l\'alfiere c8: il senso della Slava è ...Bf5 prima di ...e6.' },
        { after: 7, san: 'b5', text: 'Tenere il pedone con ...b5 indebolisce il lato di donna: dopo a4 il bianco apre linee contro di te.' }
      ],
      next: 'Dopo ...O-O il piano è ...Nbd7, ...Qe7, ...e5 oppure ...c5 per liberare il centro.'
    }
  ];

  // ----------------------------------------------- trappole e matti veloci
  var TRAPS = [
    {
      id: 'barbiere',
      name: 'Matto del barbiere (e come evitarlo)',
      side: 'b',
      stars: 1,
      idea: 'Il trucco più usato sotto i 900 Elo: donna e alfiere puntano f7. Si neutralizza in una mossa.',
      why: 'Se sai difenderti, chi ci prova resta con la donna fuori posto e la partita praticamente persa.',
      moves: [
        { san: 'e4', text: 'Il bianco apre.' },
        { san: 'e5', text: 'Rispondo al centro.' },
        { san: 'Bc4', text: 'L\'alfiere punta f7.' },
        { san: 'Nc6', text: 'Sviluppo normale.' },
        { san: 'Qh5', text: 'Ecco la trappola: donna e alfiere minacciano Qxf7#, perché f7 è difeso solo dal re.', key: true, danger: true },
        { san: 'g6', text: 'LA mossa da ricordare: caccio la donna e difendo f7 con un pedone. Mai ...Nf6?? che perde subito.', key: true },
        { san: 'Qf3', text: 'La donna si ritira ma insiste su f7.' },
        { san: 'Nf6', text: 'Adesso sì: sviluppo e la minaccia su f7 è finita (il pedone g6 e il cavallo coprono tutto).', key: true },
        { san: 'Qb3', text: 'Il bianco insiste ancora su f7.' },
        { san: 'Nd4', text: 'Attacco la donna e guadagno un tempo: ormai il bianco ha mosso solo la donna e io ho tre pezzi in gioco.', key: true }
      ],
      mistakes: [
        { after: 5, san: 'Nf6', text: 'ERRORE FATALE: 3...Nf6?? permette Qxf7#. Il cavallo non difende f7!' },
        { after: 5, san: 'Qe7', text: 'Difende, ma blocca l\'alfiere f8 e la tua donna: ...g6 è molto meglio.' }
      ],
      next: 'Regola generale: contro un attacco precoce su f7 difendi con ...g6 o ...Qe7/...Qf6 e poi caccia la donna sviluppando.'
    },
    {
      id: 'fegatello',
      name: 'Difesa dei Due Cavalli e il Fegatello',
      side: 'b',
      stars: 3,
      idea: 'Dopo 4.Ng5 il bianco minaccia Nxf7. La risposta corretta non è naturale: va imparata a memoria.',
      why: 'È la trappola più frequente nelle partite sotto i 1200: chi sa la mossa giusta vince un pezzo, chi non la sa perde il re.',
      moves: [
        { san: 'e4', text: 'Apertura di re.' },
        { san: 'e5', text: 'Simmetria.' },
        { san: 'Nf3', text: 'Attacco e5.' },
        { san: 'Nc6', text: 'Difendo.' },
        { san: 'Bc4', text: 'Italiana.' },
        { san: 'Nf6', text: 'Difesa dei Due Cavalli: sviluppo attaccando e4 invece di giocare ...Bc5.' },
        { san: 'Ng5', text: 'Doppio attacco su f7 (cavallo + alfiere). Molti qui si spaventano.', key: true, danger: true },
        { san: 'd5', text: 'LA risposta: blocco l\'alfiere e apro la mia posizione. Non difendere f7, contrattacca!', key: true },
        { san: 'exd5', text: 'Il bianco prende.' },
        { san: 'Na5', text: 'Mossa da ricordare: attacco l\'alfiere c4 invece di riprendere in d5. Se invece giochi ...Nxd5?? arriva Nxf7! (il "Fegatello") e il tuo re è spacciato.', key: true },
        { san: 'Bb5', text: 'Il bianco dà scacco per salvare l\'alfiere.' },
        { san: 'c6', text: 'Interpongo e attacco di nuovo l\'alfiere.' },
        { san: 'dxc6', text: 'Il bianco prende.' },
        { san: 'bxc6', text: 'Riprendo: ho un pedone in meno ma pezzi attivissimi e il bianco deve ancora sviluppare. Compenso pieno.', key: true }
      ],
      mistakes: [
        { after: 9, san: 'Nxd5', text: 'IL grande errore: 5...Nxd5?? 6.Nxf7! Kxf7 7.Qf3+ e il re nero è sotto attacco mortale. Gioca ...Na5!' },
        { after: 7, san: 'Nxe4', text: 'Perde: 4...Nxe4?? 5.Nxf7! Kxf7 6.Qh5+ e il bianco recupera tutto con attacco.' },
        { after: 7, san: 'Bc5', text: 'Perde un pezzo o il pedone f7: dopo 5.Nxf7! Bxf2+ 6.Kf1 il bianco sta meglio.' }
      ],
      next: 'Se non ti piace memorizzare, gioca 3...Bc5 (Italiana classica) ed eviti tutto il Fegatello.'
    },
    {
      id: 'legal',
      name: 'Trappola di Légal (il matto del cavallo)',
      side: 'w',
      stars: 2,
      idea: 'Se il nero inchioda il tuo cavallo con ...Bg4 e poi lo lascia indifeso, puoi sacrificare la donna e dare matto.',
      why: 'Ti insegna due cose insieme: come punire un\'inchiodatura sbagliata e come si costruisce un matto con pezzi minori.',
      moves: [
        { san: 'e4', text: 'Apertura di re.' },
        { san: 'e5', text: 'Simmetria.' },
        { san: 'Nf3', text: 'Sviluppo.' },
        { san: 'd6', text: 'Difesa Philidor: solida ma passiva.' },
        { san: 'Bc4', text: 'Sviluppo puntando f7.' },
        { san: 'Bg4', text: 'Il nero inchioda il cavallo f3 contro la donna d1. Attenzione: è un\'inchiodatura solo apparente!', key: true },
        { san: 'Nc3', text: 'Sviluppo tranquillo, senza h3. Preparo la trappola.' },
        { san: 'h6', text: 'Il nero perde tempo: ora la trappola scatta.', danger: true },
        { san: 'Nxe5', text: 'Il colpo! Se il nero prende la donna con ...Bxd1 arriva un matto in due: 6...Bxd1 7.Bxf7+ Ke7 8.Nd5#.', key: true },
        { san: 'Bxd1', text: 'Il nero cade nella trappola e prende la donna.', danger: true },
        { san: 'Bxf7', text: 'Scacco! Il re nero non ha case buone.', key: true },
        { san: 'Ke7', text: 'Unica mossa.' },
        { san: 'Nd5', text: 'Matto! Tre pezzi minori battono la donna. Questo è il matto di Légal.', key: true }
      ],
      mistakes: [
        { after: 9, san: 'dxe5', text: 'Se il nero gioca ...dxe5 invece di prendere la donna, tu rispondi Qxg4 e hai vinto un pedone con posizione migliore. La trappola "funziona" comunque.' }
      ],
      next: 'Morale al contrario: quando inchiodi un cavallo con l\'alfiere, assicurati che il pedone e5 sia difeso prima di lasciarlo.'
    },
    {
      id: 'matto-matto',
      name: 'Il matto più veloce (e come non subirlo)',
      side: 'b',
      stars: 1,
      idea: 'Due mosse: 1.f3 e5 2.g4 Qh4#. Mostra perché non si indeboliscono le case intorno al re.',
      why: 'Capire questo matto in 2 ti fa capire per sempre perché f3/f6 e g4/g5 nell\'apertura sono mosse rischiose.',
      moves: [
        { san: 'f3', text: 'Mossa debole: apre la diagonale e1-h4 verso il proprio re e non sviluppa niente.', danger: true },
        { san: 'e5', text: 'Occupo il centro e apro la strada alla mia donna.', key: true },
        { san: 'g4', text: 'Errore fatale: ora la casa h4 non è più controllata da nessuno.', danger: true },
        { san: 'Qh4', text: 'Matto! La donna arriva in h4 e il re bianco non ha difese né case di fuga.', key: true }
      ],
      mistakes: [],
      next: 'Lezione: i pedoni f e g davanti al re vanno mossi con criterio. Prima sviluppa, poi arrocca, poi eventualmente spingi.'
    }
  ];

  // ------------------------------------------------------ finali da provare
  var ENDGAMES = [
    { id: 'kq', name: 'Re e donna contro re', fen: '8/8/4k3/8/8/8/3QK3/8 w - - 0 1', side: 'w',
      goal: 'Dai matto in meno di 15 mosse.',
      how: 'Usa la donna per restringere il re avversario come in una gabbia che si stringe (mossa del cavallo: resta sempre a distanza di cavallo dal re nemico), poi porta il tuo re e dai matto sul bordo. Attento allo stallo: lascia sempre una casa libera finché non arriva il tuo re.' },
    { id: 'kr', name: 'Re e torre contro re', fen: '8/8/4k3/8/8/8/4K2R/8 w - - 0 1', side: 'w',
      goal: 'Dai matto con la tecnica della "scala".',
      how: 'Taglia il re nemico con la torre, avvicina il tuo re fino a stare di fronte (re contro re con una casa in mezzo), poi dai scacco con la torre: il re nemico retrocede di una traversa. Ripeti fino al bordo.' },
    { id: 'promo', name: 'Re e pedone: la regola del quadrato', fen: '8/8/8/3k4/8/8/4P3/4K3 w - - 0 1', side: 'w',
      goal: 'Porta il pedone a promozione.',
      how: 'Il re davanti al pedone, non dietro! Conquista le case chiave (davanti al pedone, sulla sesta traversa) e usa il tempo di riserva del pedone. Se il re nemico arriva davanti e tu non hai il re avanti, è patta.' },
    { id: 'due-torri', name: 'Due torri: il matto della scala', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', side: 'w',
      goal: 'Matto in pochissime mosse usando le due torri alternate.',
      how: 'Metti una torre sulla traversa del re nemico dando scacco, lui sale, l\'altra torre lo segue: la "scala". Non servono né il re né calcoli.' },
    { id: 'tecnica-pedoni', name: 'Finale di pedoni: crea il passato', fen: '8/5ppp/8/8/8/8/PPP5/8 w - - 0 1', side: 'w',
      goal: 'Crea un pedone passato e promuovi (gioca senza i re: concentrati solo sulla tecnica).',
      how: 'Con tre pedoni contro tre, spingi per primo il pedone NON difeso dal pedone avversario corrispondente. È la tecnica del "pedone candidato".' }
  ];

  global.ChessOpenings = { PRINCIPI: PRINCIPI, OPENINGS: OPENINGS, TRAPS: TRAPS, ENDGAMES: ENDGAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ChessOpenings;
})(typeof window !== 'undefined' ? window : globalThis);
