/*!
 * puzzles.js — Puzzle tattici verificati dal motore (tests/puzzles.test.js).
 * Ogni puzzle ha: tema, difficoltà, posizione (fen o setup di mosse),
 * soluzione, 3 aiuti progressivi e la lezione da portare a casa.
 */
(function (global) {
  'use strict';

  var TEMI = {
    matto1: { nome: 'Matto in 1', desc: 'Dai scacco matto in una sola mossa. Cerca le case di fuga del re: se sono tutte coperte, basta un ultimo scacco.' },
    matto2: { nome: 'Matto in 2', desc: 'Una mossa forzante (scacco o sacrificio) e poi il matto. Chiediti: quale mossa toglie al re l\'ultima via di scampo?' },
    forchetta: { nome: 'Forchetta', desc: 'Un pezzo attacca due pezzi avversari contemporaneamente. Il cavallo è il re delle forchette, ma anche pedoni e donna le fanno.' },
    infilata: { nome: 'Infilata', desc: 'Dai scacco su una linea: il re si sposta e dietro di lui cade il pezzo. È l\'inchiodatura al contrario.' },
    inchiodatura: { nome: 'Inchiodatura', desc: 'Un pezzo non può muoversi perché dietro ha il re (o un pezzo di valore). Attaccalo di nuovo e lo vinci.' },
    scoperta: { nome: 'Attacco di scoperta', desc: 'Muovi un pezzo e ne scopri un altro dietro che dà scacco. Il pezzo che si muove può prendere quello che vuole.' },
    materiale: { nome: 'Vincere materiale', desc: 'Conta attaccanti e difensori: se un pezzo è attaccato più volte di quanto è difeso, si vince.' },
    difesa: { nome: 'Difenditi', desc: 'L\'avversario minaccia qualcosa di grave. Trova l\'unica mossa che tiene in piedi la posizione.' },
    trappola: { nome: 'Trappola di apertura', desc: 'Posizioni reali dalle prime mosse: riconoscerle vale centinaia di punti Elo.' }
  };

  var PUZZLES = [
    // ---------------------------------------------------------- matto in 1
    {
      id: 'm1-corridoio', tema: 'matto1', diff: 1,
      fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
      solution: ['Ra8#'],
      hints: ['Il re nero è chiuso dai suoi stessi pedoni: gli resta solo l\'ottava traversa.',
        'Muovi la torre.',
        'Porta la torre in a8: scacco sull\'ottava traversa e nessuna fuga.'],
      lesson: 'Il "matto del corridoio": il re arroccato che non ha mai mosso i pedoni f-g-h è vulnerabile a uno scacco sull\'ultima traversa. Ricordati di creare una casa di fuga (h3/h6) quando sei tu ad avere questa struttura.'
    },
    {
      id: 'm1-qf8', tema: 'matto1', diff: 1,
      fen: '7k/6pp/8/8/8/8/5QPP/6K1 w - - 0 1',
      solution: ['Qf8#'],
      hints: ['Il re nero in h8 ha solo g8 come casa libera.',
        'La donna può arrivare sull\'ottava traversa controllando sia h8 che g8.',
        'Qf8 dà matto: scacco da f8 e la casa g8 è coperta dalla donna stessa.'],
      lesson: 'La donna da sola dà matto sull\'ultima traversa quando il re è bloccato dai suoi pedoni. Un solo pezzo basta se il re non ha case.'
    },
    {
      id: 'm1-rh8', tema: 'matto1', diff: 1,
      fen: 'k7/7R/1K6/8/8/8/8/8 w - - 0 1',
      solution: ['Rh8#'],
      hints: ['Il tuo re copre già b7, a7 e b8... controlla quali case restano al re nero.',
        'Serve uno scacco sull\'ottava traversa.',
        'Rh8 è matto: la torre taglia l\'ottava traversa e il tuo re copre tutto il resto.'],
      lesson: 'Il matto fondamentale re+torre: il TUO re fa il lavoro sporco (toglie le case), la torre dà lo scacco finale. Senza il re, la torre da sola non dà mai matto.'
    },
    {
      id: 'm1-qd7', tema: 'matto1', diff: 1,
      fen: '3k4/8/3K4/8/Q7/8/8/8 w - - 0 1',
      solution: ['Qd7#'], accept: ['Qd7'],
      hints: ['I due re sono in colonna: il tuo re controlla c7, d7 ed e7.',
        'La donna può avvicinarsi senza essere catturata, perché il tuo re la difende.',
        'Qd7 dà matto: la donna è difesa dal re e copre c8, d8 ed e8.'],
      lesson: 'Il matto base re+donna: porta la donna accanto al re avversario DIFESA dal tuo re. Finché il tuo re non è vicino, usa la donna solo per restringere la gabbia (attento allo stallo!).'
    },
    {
      id: 'm1-barbiere', tema: 'matto1', diff: 1,
      setup: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'],
      solution: ['Qxf7#'],
      hints: ['Il nero ha appena giocato ...Nf6 credendo di difendersi. Guarda la casa f7.',
        'Donna e alfiere attaccano la stessa casa: f7 è difesa solo dal re.',
        'Qxf7 è matto: la donna cattura in f7 difesa dall\'alfiere c4.'],
      lesson: 'Il matto del barbiere. Dalla parte del nero la difesa è ...g6! (mai ...Nf6, che non difende f7). Dalla tua parte: non contarci troppo, ma punisci chi non lo conosce.'
    },
    {
      id: 'm1-soffocato-caro', tema: 'matto1', diff: 3,
      setup: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nd7', 'Qe2', 'Ngf6'],
      solution: ['Nd6#'],
      hints: ['Il nero ha appena giocato ...Ngf6 con naturalezza. Ma la tua donna in e2 inchioda qualcosa.',
        'Il pedone e7 è inchiodato: non può catturare. Quindi una tua mossa in d6 non si può prendere.',
        'Nd6 è matto: il pedone e7 è inchiodato dalla donna, la donna d8 è bloccata dal cavallo d7 e l\'alfiere f8 dal pedone e7.'],
      lesson: 'Il matto soffocato della Caro-Kann: l\'errore ...Ngf6 è fra i più comuni del mondo. Funziona solo grazie all\'inchiodatura della donna in e2: senza di essa, exd6 salverebbe il nero.'
    },

    // ---------------------------------------------------------- matto in 2
    {
      id: 'm2-soffocato', tema: 'matto2', diff: 3,
      fen: '5r1k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1',
      solution: ['Qg8+', 'Rxg8', 'Nf7#'],
      hints: ['Il re nero è completamente soffocato dai suoi pezzi: gli manca solo... niente.',
        'Il cavallo in h6 controlla g8 e f7. Cosa succede se metti la donna in g8?',
        'Qg8+!! La torre DEVE prendere (il re non può, g8 è difeso dal cavallo), e poi Nf7 è matto soffocato.'],
      lesson: 'Il matto soffocato: si sacrifica la donna per costringere un pezzo nero a occupare l\'ultima casa di fuga del proprio re. Pattern da riconoscere a occhi chiusi: cavallo + donna contro re in h8 con rook in f8 e pedoni g7/h7.'
    },
    {
      id: 'm2-legal', tema: 'matto2', diff: 3,
      setup: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'h6', 'Nxe5', 'Bxd1'],
      solution: ['Bxf7+', 'Ke7', 'Nd5#'],
      hints: ['Hai appena sacrificato la donna: ora serve il matto, non c\'è tempo per recuperarla.',
        'Comincia con uno scacco che il re non può evitare muovendosi in avanti.',
        'Bxf7+! Ke7 (unica) e poi Nd5 dà matto: tre pezzi minori valgono più della donna, qui.'],
      lesson: 'Il matto di Légal. Lezione pratica: quando inchiodi un cavallo con l\'alfiere (...Bg4), controlla SEMPRE che il pedone dietro (e5) sia difeso, altrimenti l\'inchiodatura è finta.'
    },

    // ----------------------------------------------------------- forchette
    {
      id: 'f-nc7', tema: 'forchetta', diff: 1,
      fen: 'r3k3/pp6/8/3N4/8/8/PP6/6K1 w - - 0 1',
      solution: ['Nc7+'],
      hints: ['Cerca una casa da cui il cavallo attacchi contemporaneamente re e torre.',
        'Il cavallo in c7 darebbe scacco... e cos\'altro attacca da lì?',
        'Nc7+ forchetta re e torre: il re deve muoversi e tu prendi la torre in a8.'],
      lesson: 'La forchetta di cavallo con scacco è imparabile: l\'avversario DEVE rispondere allo scacco, quindi l\'altro pezzo è perso. Cerca sempre case da cui il cavallo tocca re + pezzo.'
    },
    {
      id: 'f-nd6', tema: 'forchetta', diff: 2,
      fen: '2q1k3/pp3pp1/8/8/4N3/8/PP3PP1/3Q2K1 w - - 0 1',
      solution: ['Nd6+'],
      hints: ['Il cavallo in e4 può raggiungere una casa che attacca sia il re in e8 sia la donna in c8.',
        'Prova a immaginare il cavallo in d6: quali case controlla?',
        'Nd6+ attacca il re (e8) e la donna (c8): dopo la mossa del re, Nxc8 vince la donna.'],
      lesson: 'Donna e re sulla stessa "distanza di cavallo" sono una forchetta che aspetta. Quando vedi il re avversario, controlla sempre se i suoi pezzi migliori sono a portata di un salto di cavallo.'
    },
    {
      id: 'f-pedone', tema: 'forchetta', diff: 1,
      fen: '6k1/8/8/2n1n3/8/3P4/8/1K5R w - - 0 1',
      solution: ['d4'],
      hints: ['Anche i pedoni forchettano: attaccano due case in diagonale.',
        'Spingi il pedone in modo che attacchi entrambi i cavalli.',
        'd4! attacca c5 ed e5: i cavalli non possono catturare il pedone e uno dei due cade.'],
      lesson: 'La forchetta di pedone è la più redditizia: un pedone (1 punto) vince un pezzo (3 punti). Prima di spingere un pedone, guarda sempre le due case in diagonale davanti a lui.'
    },
    {
      id: 'f-donna', tema: 'forchetta', diff: 2,
      fen: '4k3/8/8/1n6/8/8/7Q/6K1 w - - 0 1',
      solution: ['Qe5+'],
      hints: ['La donna può dare scacco attaccando anche il cavallo.',
        'Guarda la quinta traversa: il cavallo è in b5.',
        'Qe5+ dà scacco sulla colonna e e attacca il cavallo in b5 sulla quinta traversa. Il cavallo non può catturare la donna.'],
      lesson: 'La donna forchetta bene SOLO contro pezzi che non possono catturarla (cavalli, pedoni, re). Contro una torre sulla stessa linea la "forchetta" è un regalo.'
    },

    // ------------------------------------------------------------ infilata
    {
      id: 'i-ra1', tema: 'infilata', diff: 2,
      fen: 'q7/8/8/k7/8/8/8/4R1K1 w - - 0 1',
      solution: ['Ra1+'],
      hints: ['Re e donna neri sono sulla stessa colonna: la a.',
        'Porta la torre su quella colonna dando scacco.',
        'Ra1+! Il re deve togliersi (o interporre la donna) e tu vinci la donna.'],
      lesson: 'Infilata: dai scacco al re su una linea dove dietro c\'è un pezzo più prezioso. Appena vedi re e donna (o re e torre) allineati, cerca il modo di arrivare su quella linea.'
    },

    // ----------------------------------------------------- attacco scoperto
    {
      id: 's-nxc4', tema: 'scoperta', diff: 2,
      fen: '4k3/5n2/8/4N3/2r5/8/8/4R1K1 w - - 0 1',
      solution: ['Nxc4+'],
      hints: ['La tua torre in e1 e il re nero in e8 sono sulla stessa colonna: in mezzo c\'è solo il tuo cavallo.',
        'Se il cavallo si sposta, la torre dà scacco da sola. E se si spostasse... mangiando?',
        'Nxc4+! Prendi la torre E scopri lo scacco: il nero deve rispondere allo scacco e non può mai riprendere il cavallo.'],
      lesson: 'Cattura + scacco di scoperta = pezzo gratis. Quando un tuo pezzo sta davanti a una tua torre/donna allineata col re nemico, cerca sempre una sua cattura: l\'avversario sarà costretto a parare lo scacco invece di recuperare il materiale.'
    },

    // ------------------------------------------------------ inchiodatura
    {
      id: 'p-d5', tema: 'inchiodatura', diff: 2,
      fen: '4k3/ppp2ppp/2n5/1B6/3P4/8/PPP2PPP/4K3 w - - 0 1',
      solution: ['d5'],
      hints: ['Il cavallo in c6 è inchiodato: se si muove, il re nero resta sotto scacco dell\'alfiere b5.',
        'Un pezzo inchiodato non può scappare: attaccalo ancora.',
        'd5! attacca il cavallo che non può muoversi né essere difeso a sufficienza: il prossimo colpo è dxc6.'],
      lesson: 'Regola d\'oro: attacca il pezzo inchiodato con il pezzo di minor valore, meglio ancora con un pedone. L\'inchiodatura non vince materiale da sola: va "sfruttata" con un attacco in più.'
    },

    // -------------------------------------------------- materiale e difesa
    {
      id: 'mat-exd5', tema: 'materiale', diff: 1,
      fen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
      solution: ['exd5'],
      hints: ['C\'è un pezzo avversario sotto attacco. Chi lo difende?',
        'La donna nera in d5 è attaccata dal tuo pedone e4 e non è difesa da nessuno.',
        'exd5: un pedone si mangia la donna. Controllare sempre i difensori prima di muovere un pezzo!'],
      lesson: 'Prima di ogni mossa fai la domanda delle "3 C": Scacchi? Catture? Minacce? Il 70% degli errori sotto i 1000 Elo è un pezzo lasciato indifeso.'
    },
    {
      id: 'mat-qxe5', tema: 'trappola', diff: 1,
      setup: ['e4', 'e5', 'Qh5', 'Nf6'],
      solution: ['Qxe5+'],
      hints: ['La donna bianca in h5 guarda una diagonale e una traversa: cosa è rimasto indifeso?',
        'Il pedone e5 è difeso da qualcuno dopo ...Nf6?',
        'Qxe5+ vince un pedone con scacco: il nero deve perdere un tempo per difendersi.'],
      lesson: 'Se l\'avversario tira fuori la donna presto non spaventarti, ma non lasciare pezzi indifesi: controlla ogni volta cosa "vede" quella donna.'
    },
    {
      id: 'dif-barbiere', tema: 'difesa', diff: 1,
      setup: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5'],
      solution: ['g6'],
      accept: ['g6', 'Qe7', 'Qf6'],
      hints: ['Il bianco minaccia matto in una mossa. Trovala per capire cosa difendere.',
        'La minaccia è Qxf7#: f7 è difeso solo dal re. Serve un difensore in più o cacciare la donna.',
        '...g6! caccia la donna e difende f7 col pedone. La mossa ...Nf6?? invece perde immediatamente.'],
      lesson: 'Quando l\'avversario minaccia matto, non cercare il tuo attacco: trova prima la difesa. ...g6 difende e guadagna tempo attaccando la donna.'
    },
    {
      id: 'dif-fegatello', tema: 'difesa', diff: 3,
      setup: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'],
      solution: ['d5'],
      accept: ['d5'],
      hints: ['Cavallo e alfiere attaccano f7: difendere direttamente non funziona.',
        'La miglior difesa è il contrattacco al centro: chiudi la diagonale dell\'alfiere.',
        '...d5! Il pedone blocca l\'alfiere c4 e apre la tua posizione. Nota: dopo exd5 NON prendere con il cavallo (Nxd5?? Nxf7!), gioca ...Na5.'],
      lesson: 'Contro l\'attacco Fegatello (4.Ng5) la risposta è sempre ...d5!, e poi ...Na5 attaccando l\'alfiere. Se non vuoi ricordarlo, gioca 3...Bc5 al posto di 3...Nf6.'
    },
    {
      id: 'dif-legal', tema: 'difesa', diff: 2,
      setup: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'h6', 'h3'],
      solution: ['Bxf3'],
      accept: ['Bxf3', 'Be6', 'Bd7', 'Bh5', 'Bc8'],
      hints: ['Il bianco ha giocato h3 attaccando il tuo alfiere in g4.',
        'Attenzione: la casa h5 sembra comoda ma c\'è un problema. Il pedone e5 è difeso?',
        'Bxf3 (o un ritiro sicuro come ...Be6): la mossa ...Bh5?? permette Nxe5! perché la tua inchiodatura era finta.'],
      lesson: 'Prima di mantenere un\'inchiodatura, controlla se il pezzo inchiodato può muoversi comunque catturando qualcosa. Qui Nxe5 funziona perché il pedone e5 non è difeso.'
    }
  ];

  global.ChessPuzzles = { TEMI: TEMI, PUZZLES: PUZZLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ChessPuzzles;
})(typeof window !== 'undefined' ? window : globalThis);
