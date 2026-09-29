// Presets pre-confezionati per le attività del Fanta Matrimonio

export const DEFAULT_PHOTO_CHALLENGES = [
  {
    title: 'Foto della festa',
    description: 'Condividi le foto del matrimonio nella galleria comune',
    points: 5,
    type: 'photo',
    active: true
  },
  {
    title: 'Foto ricordo',
    description: 'Foto libera senza assegnazione di punti',
    points: 0,
    type: 'photo',
    active: true
  }
];

export const PRESET_QUIZZES = [
  {
    id: 'pq_1',
    title: 'Dove si sono conosciuti gli sposi?',
    description: 'Metti alla prova gli invitati sulla vostra storia d\'amore.',
    points: 30,
    type: 'quiz',
    active: true,
    vote_options: [
      'A una festa di amici',
      'All\'università o al lavoro',
      'In vacanza al mare',
      'Sui social / app di incontri'
    ],
    correct_answer: 'A una festa di amici'
  },
  {
    id: 'pq_2',
    title: 'Chi ha fatto il primo passo?',
    description: 'Chi ha avuto il coraggio di rompere il ghiaccio?',
    points: 30,
    type: 'quiz',
    active: true,
    vote_options: [
      'Lo sposo',
      'La sposa',
      'È stato un colpo di fulmine reciproco',
      'Gli amici hanno combinato tutto'
    ],
    correct_answer: 'Lo sposo'
  },
  {
    id: 'pq_3',
    title: 'Chi ci mette più tempo a prepararsi per uscire?',
    description: 'La verità quotidiana che tutti vogliono sapere!',
    points: 30,
    type: 'quiz',
    active: true,
    vote_options: [
      'Lo sposo',
      'La sposa',
      'Pari merito, una sfida infinita',
      'Dipende dalla serata'
    ],
    correct_answer: 'La sposa'
  },
  {
    id: 'pq_4',
    title: 'Qual è la meta del loro viaggio di nozze?',
    description: 'Riconosci dove voleranno gli sposi per la luna di miele?',
    points: 30,
    type: 'quiz',
    active: true,
    vote_options: [
      'Giappone & Oriente',
      'Stati Uniti & Caraibi',
      'Safari in Africa & Mare',
      'Tour in Europa & Relax'
    ],
    correct_answer: 'Giappone & Oriente'
  },
  {
    id: 'pq_5',
    title: 'Chi è il più disordinato a casa?',
    description: 'Chi lascia sempre le calze o i vestiti in giro?',
    points: 30,
    type: 'quiz',
    active: true,
    vote_options: [
      'Lo sposo',
      'La sposa',
      'Entrambi disordinati cosmici',
      'Nessuno dei due, ordine assoluto'
    ],
    correct_answer: 'Lo sposo'
  },
  {
    id: 'pq_6',
    title: 'Chi cucina meglio tra i due?',
    description: 'Chi ha le mani d\'oro ai fornelli?',
    points: 30,
    type: 'quiz',
    active: true,
    vote_options: [
      'Lo sposo',
      'La sposa',
      'Meglio ordinare la pizza a domicilio!',
      'Ognuno ha i suoi piatti forti'
    ],
    correct_answer: 'La sposa'
  }
];

export const PRESET_HUNTS = [
  {
    id: 'ph_1',
    title: 'Selfie con la sposa',
    description: 'Cattura un sorriso splendente con la sposa!',
    points: 25,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_2',
    title: 'Selfie con lo sposo',
    description: 'Uno scatto memorabile insieme allo sposo!',
    points: 25,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_3',
    title: 'Brindisi caloroso al tavolo',
    description: 'Bicchieri in alto e grida di auguri con i compagni di tavolo!',
    points: 20,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_4',
    title: 'L\'outfit più originale della festa',
    description: 'Fotografa l\'invitato o l\'invitata con il look più stiloso o stravagante.',
    points: 25,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_5',
    title: 'Scatto rubato mentre ridono',
    description: 'Una risata spontanea e genuina colta all\'improvviso.',
    points: 20,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_6',
    title: 'Foto di gruppo buffa',
    description: 'Almeno 4 invitati in una posa simpatica o insolita.',
    points: 30,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_7',
    title: 'Dettaglio romantico o delle fedi',
    description: 'Un particolare della cerimonia, delle fedi o della torta.',
    points: 25,
    type: 'hunt',
    active: true
  },
  {
    id: 'ph_8',
    title: 'Il ballo più scatenato',
    description: 'Immola la pista da ballo nel clou dei festeggiamenti!',
    points: 30,
    type: 'hunt',
    active: true
  }
];

export const PRESET_MOMENTS = [
  {
    id: 'pm_1',
    title: 'Un augurio o dedica speciale dal cuore per gli sposi',
    description: 'Lascia un pensiero o un ricordo che gli sposi leggeranno con emozione.',
    points: 10,
    type: 'vote',
    active: true
  },
  {
    id: 'pm_2',
    title: 'Il momento più commovente o memorabile della giornata',
    description: 'Quale istante ti ha scaldato il cuore oggi?',
    points: 10,
    type: 'vote',
    active: true
  },
  {
    id: 'pm_3',
    title: 'Chi piangerà per primo durante la festa?',
    description: 'Fai la tua previsione: sposo, sposa, mamma, papà o testimone?',
    points: 10,
    type: 'vote',
    active: true
  },
  {
    id: 'pm_4',
    title: 'Il discorso o aneddoto più divertente della serata',
    description: 'Quale battuta o storia raccontata dagli invitati ti ha fatto più ridere?',
    points: 10,
    type: 'vote',
    active: true
  }
];
