/* Plano de treino padrão e catálogo de exercícios (imagens e instruções). */

const PLANO_PADRAO = {
  perfil: {
    idade: 27,
    peso_kg: 108,
    altura_cm: 175,
    objetivos: [
      'Emagrecimento',
      'Ganho de força',
      'Hipertrofia muscular',
      'Melhora do condicionamento físico'
    ],
    tempo_maximo_treino_minutos: 60
  },
  treino_semanal: [
    {
      dia: 'segunda-feira',
      tipo: 'Cardio',
      duracao_estimada_minutos: 45,
      exercicios: [
        { nome: 'Esteira - caminhada leve', duracao_minutos: 5, intensidade: 'Leve' },
        { nome: 'Esteira - caminhada rápida', duracao_minutos: 20, intensidade: 'Moderada' },
        { nome: 'Bicicleta ergométrica', duracao_minutos: 15, intensidade: 'Moderada' },
        { nome: 'Caminhada para desacelerar', duracao_minutos: 5, intensidade: 'Leve' }
      ]
    },
    { dia: 'terça-feira', tipo: 'Descanso', duracao_estimada_minutos: 0, exercicios: [] },
    {
      dia: 'quarta-feira',
      tipo: 'Musculação',
      grupo_muscular: ['Braços', 'Peito', 'Ombros'],
      duracao_estimada_minutos: 55,
      aquecimento: { nome: 'Bicicleta ou esteira', duracao_minutos: 5, intensidade: 'Leve' },
      exercicios: [
        { nome: 'Supino máquina', series: 3, repeticoes: '10-12', descanso_segundos: 90 },
        { nome: 'Desenvolvimento de ombros', series: 3, repeticoes: '10-12', descanso_segundos: 90 },
        { nome: 'Elevação lateral', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Rosca direta', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Rosca martelo', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Tríceps na polia', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Tríceps com corda', series: 2, repeticoes: '12', descanso_segundos: 60 }
      ]
    },
    {
      dia: 'quinta-feira',
      tipo: 'Musculação',
      grupo_muscular: ['Pernas', 'Glúteos'],
      duracao_estimada_minutos: 55,
      aquecimento: { nome: 'Bicicleta ergométrica', duracao_minutos: 5, intensidade: 'Leve' },
      exercicios: [
        { nome: 'Leg press 45°', series: 3, repeticoes: '12', descanso_segundos: 90 },
        { nome: 'Cadeira extensora', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Mesa flexora', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Cadeira abdutora', series: 3, repeticoes: '15', descanso_segundos: 60 },
        { nome: 'Elevação pélvica máquina', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Panturrilha sentado', series: 3, repeticoes: '15', descanso_segundos: 60 }
      ]
    },
    {
      dia: 'sexta-feira',
      tipo: 'Musculação',
      grupo_muscular: ['Costas', 'Abdômen'],
      duracao_estimada_minutos: 55,
      aquecimento: { nome: 'Caminhada na esteira', duracao_minutos: 5, intensidade: 'Leve' },
      exercicios: [
        { nome: 'Puxada frontal', series: 3, repeticoes: '12', descanso_segundos: 90 },
        { nome: 'Remada baixa', series: 3, repeticoes: '12', descanso_segundos: 90 },
        { nome: 'Remada articulada', series: 3, repeticoes: '12', descanso_segundos: 90 },
        { nome: 'Pulldown na polia', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Crucifixo inverso', series: 3, repeticoes: '12', descanso_segundos: 60 },
        { nome: 'Prancha abdominal', series: 3, duracao_por_serie_segundos: 30, descanso_segundos: 60 }
      ]
    },
    {
      dia: 'sábado',
      tipo: 'Cardio',
      duracao_estimada_minutos: 50,
      exercicios: [
        { nome: 'Bicicleta - aquecimento', duracao_minutos: 5, intensidade: 'Leve' },
        { nome: 'Bicicleta ergométrica', duracao_minutos: 20, intensidade: 'Moderada' },
        { nome: 'Elíptico', duracao_minutos: 10, intensidade: 'Leve a moderada' },
        { nome: 'Esteira - caminhada rápida', duracao_minutos: 10, intensidade: 'Moderada' },
        { nome: 'Caminhada para desacelerar', duracao_minutos: 5, intensidade: 'Leve' }
      ]
    },
    { dia: 'domingo', tipo: 'Descanso', duracao_estimada_minutos: 0, exercicios: [] }
  ],
  progressao: [
    { semanas: '1-2', musculacao: '2 séries por exercício com cargas leves', cardio_minutos: '20-30', objetivo: 'Adaptação ao treinamento' },
    { semanas: '3-4', musculacao: 'Aumentar gradualmente para 3 séries', cardio_minutos: '30-40', objetivo: 'Melhorar resistência e técnica' },
    { semanas: '5-8', musculacao: 'Executar a ficha completa', cardio_minutos: '40-50', objetivo: 'Desenvolver força e condicionamento' },
    { semanas: '9-12', musculacao: 'Progressão gradual de cargas', cardio_minutos: '45-55', objetivo: 'Aumentar força e resistência' }
  ],
  recomendacoes: {
    intensidade_musculacao: 'Utilizar cargas que permitam executar todas as repetições com boa técnica, mantendo inicialmente 2 a 3 repetições de reserva.',
    progressao_carga: 'Aumentar gradualmente quando todas as séries forem concluídas com boa execução.',
    intensidade_cardio: 'Moderada, permitindo conversar durante o exercício.',
    hidratacao: 'Manter hidratação adequada antes, durante e após os treinos.',
    sono_horas: '7-9',
    descanso: 'Respeitar os dias de descanso para recuperação muscular.',
    observacoes: [
      'Evitar corrida de alto impacto inicialmente.',
      'Priorizar a execução correta dos exercícios.',
      'Não ultrapassar 60 minutos por sessão.',
      'Reduzir a intensidade caso apresente desconforto articular.',
      'Solicitar avaliação de um profissional de educação física para adequar cargas e movimentos.'
    ]
  }
};

/* Imagens: Free Exercise DB (domínio público). Cada exercício tem duas posições: -0 e -1. */
const CATALOGO = {
  'supino-maquina': {
    titulo: 'Supino máquina',
    musculos: ['Peitoral', 'Tríceps', 'Ombro (frente)'],
    passos: [
      'Ajuste o banco para que as pegadas fiquem na altura do meio do peito.',
      'Sente com as costas totalmente apoiadas no encosto e os pés firmes no chão.',
      'Segure as pegadas com os punhos alinhados aos antebraços e os ombros levemente para trás.',
      'Empurre as pegadas para a frente soltando o ar, até quase estender os cotovelos.',
      'Volte devagar (2 a 3 segundos) até sentir o peito alongar.'
    ],
    dicas: ['Cotovelos a cerca de 45–60° do tronco, não totalmente abertos.', 'Mantenha os ombros longe das orelhas.'],
    erros: ['Tirar as costas do encosto.', 'Travar os cotovelos no final.', 'Deixar o peso bater na volta.']
  },
  'desenvolvimento-ombros': {
    titulo: 'Desenvolvimento de ombros',
    musculos: ['Ombros', 'Tríceps'],
    passos: [
      'Ajuste o assento para que as pegadas fiquem na altura dos ombros.',
      'Costas apoiadas, abdômen firme e pés no chão.',
      'Empurre as pegadas para cima soltando o ar, até quase estender os braços.',
      'Desça controlando até os cotovelos ficarem um pouco abaixo da linha dos ombros.'
    ],
    dicas: ['Se sentir desconforto no ombro, reduza a amplitude e a carga.'],
    erros: ['Arquear a lombar para empurrar.', 'Usar impulso das pernas.', 'Descer rápido demais.']
  },
  'elevacao-lateral': {
    titulo: 'Elevação lateral',
    musculos: ['Ombros (lateral)'],
    passos: [
      'Em pé, pés na largura do quadril, um halter em cada mão ao lado do corpo.',
      'Cotovelos levemente flexionados e tronco firme.',
      'Eleve os braços pelas laterais até a altura dos ombros, soltando o ar.',
      'Desça devagar até a posição inicial.'
    ],
    dicas: ['Pense em levar os cotovelos para fora, e não as mãos para cima.', 'Use carga leve: é um exercício de isolamento.'],
    erros: ['Balançar o tronco.', 'Subir acima dos ombros encolhendo o pescoço.']
  },
  'rosca-direta': {
    titulo: 'Rosca direta',
    musculos: ['Bíceps', 'Antebraço'],
    passos: [
      'Em pé, segure a barra com as palmas para cima e as mãos na largura dos ombros.',
      'Mantenha os cotovelos colados ao lado do corpo.',
      'Flexione os cotovelos levando a barra até a altura do peito, soltando o ar.',
      'Desça controlando até quase estender os braços.'
    ],
    dicas: ['Só o antebraço se move; punhos firmes e retos.'],
    erros: ['Jogar o tronco para trás para subir a barra.', 'Afastar os cotovelos do corpo.', 'Soltar a barra na descida.']
  },
  'rosca-martelo': {
    titulo: 'Rosca martelo',
    musculos: ['Bíceps', 'Braquial', 'Antebraço'],
    passos: [
      'Em pé, um halter em cada mão com as palmas viradas para o corpo (pegada neutra).',
      'Cotovelos junto ao tronco.',
      'Flexione os cotovelos sem girar o punho, levando os halteres até perto dos ombros.',
      'Desça devagar até estender os braços.'
    ],
    dicas: ['Pode fazer alternado ou com os dois braços juntos.'],
    erros: ['Balançar o corpo.', 'Girar o punho durante o movimento.']
  },
  'triceps-polia': {
    titulo: 'Tríceps na polia',
    musculos: ['Tríceps'],
    passos: [
      'De frente para a polia alta, segure a barra com as palmas para baixo, mãos na largura dos ombros.',
      'Cotovelos junto ao corpo e tronco levemente inclinado à frente.',
      'Empurre a barra para baixo até estender os cotovelos, soltando o ar.',
      'Volte devagar até os antebraços passarem um pouco da linha paralela ao chão.'
    ],
    dicas: ['Cotovelos fixos: só o antebraço se move.'],
    erros: ['Abrir os cotovelos.', 'Usar o peso do corpo para empurrar.', 'Subir a barra até o rosto.']
  },
  'triceps-corda': {
    titulo: 'Tríceps com corda',
    musculos: ['Tríceps'],
    passos: [
      'Prenda a corda na polia alta e segure uma ponta em cada mão, palmas uma de frente para a outra.',
      'Cotovelos junto ao corpo.',
      'Estenda os cotovelos levando a corda para baixo e, no final, afaste levemente as mãos para os lados.',
      'Volte devagar até a posição inicial.'
    ],
    dicas: ['Abrir a corda no final aumenta a contração do tríceps.'],
    erros: ['Afastar os cotovelos do tronco.', 'Inclinar demais o corpo.']
  },
  'leg-press': {
    titulo: 'Leg press 45°',
    musculos: ['Quadríceps', 'Glúteos', 'Posterior de coxa'],
    passos: [
      'Sente com as costas e o quadril bem apoiados no encosto.',
      'Pés na plataforma na largura do quadril, pontas levemente para fora.',
      'Destrave e desça a plataforma flexionando os joelhos até cerca de 90°.',
      'Empurre com o calcanhar e o meio do pé, soltando o ar, sem travar os joelhos no final.'
    ],
    dicas: ['Os joelhos seguem a direção das pontas dos pés.', 'Deixe as travas de segurança sempre ao alcance.'],
    erros: ['Descer demais e tirar a lombar do encosto.', 'Joelhos indo para dentro.', 'Travar os joelhos estendidos.']
  },
  'cadeira-extensora': {
    titulo: 'Cadeira extensora',
    musculos: ['Quadríceps'],
    passos: [
      'Ajuste o encosto para que o joelho fique alinhado ao eixo da máquina.',
      'Posicione o rolo logo acima do tornozelo.',
      'Segure as alças laterais e estenda os joelhos, soltando o ar.',
      'Segure 1 segundo no alto e desça devagar.'
    ],
    dicas: ['Movimento controlado protege o joelho.'],
    erros: ['Chutar o peso para cima.', 'Tirar o quadril do banco.']
  },
  'mesa-flexora': {
    titulo: 'Mesa flexora',
    musculos: ['Posterior de coxa'],
    passos: [
      'Deite de bruços, com os joelhos logo após a borda do banco e o rolo acima dos calcanhares.',
      'Segure as alças e mantenha o quadril colado no banco.',
      'Flexione os joelhos levando os calcanhares em direção aos glúteos, soltando o ar.',
      'Desça devagar até quase estender as pernas.'
    ],
    dicas: ['Contraia o abdômen para não forçar a lombar.'],
    erros: ['Levantar o quadril do banco.', 'Fazer o movimento rápido demais.']
  },
  'cadeira-abdutora': {
    titulo: 'Cadeira abdutora',
    musculos: ['Glúteo médio', 'Glúteos'],
    passos: [
      'Sente com as costas apoiadas e as almofadas na parte de fora dos joelhos.',
      'Afaste as pernas o máximo que conseguir com controle, soltando o ar.',
      'Segure 1 segundo aberto e volte devagar, sem deixar o peso bater.'
    ],
    dicas: ['Inclinar o tronco levemente à frente aumenta o trabalho dos glúteos.'],
    erros: ['Usar impulso.', 'Voltar rápido batendo as placas.']
  },
  'elevacao-pelvica': {
    titulo: 'Elevação pélvica',
    musculos: ['Glúteos', 'Posterior de coxa'],
    passos: [
      'Apoie a parte alta das costas (abaixo das escápulas) no encosto e posicione o apoio ou cinto sobre o quadril.',
      'Pés firmes no chão, na largura do quadril.',
      'Empurre o quadril para cima contraindo os glúteos, soltando o ar, até alinhar tronco e coxas.',
      'Segure 1 segundo no alto e desça controlando.'
    ],
    dicas: ['No topo, os joelhos ficam em cerca de 90°.', 'A imagem mostra a versão com barra; na máquina o movimento é o mesmo.'],
    erros: ['Arquear a lombar no topo em vez de contrair os glúteos.', 'Empurrar com a ponta dos pés.']
  },
  'panturrilha-sentado': {
    titulo: 'Panturrilha sentado',
    musculos: ['Panturrilha'],
    passos: [
      'Sente com a ponta dos pés na plataforma e os calcanhares livres.',
      'Ajuste o apoio sobre as coxas, perto dos joelhos.',
      'Suba os calcanhares o máximo possível, soltando o ar.',
      'Desça devagar até alongar bem a panturrilha.'
    ],
    dicas: ['Amplitude completa vale mais do que carga alta.'],
    erros: ['Movimentos curtos e rápidos ("quicando").']
  },
  'puxada-frontal': {
    titulo: 'Puxada frontal',
    musculos: ['Costas (dorsal)', 'Bíceps'],
    passos: [
      'Ajuste o apoio das coxas para ficar firme no banco.',
      'Segure a barra com pegada aberta, um pouco além da largura dos ombros, palmas para a frente.',
      'Incline levemente o tronco para trás e puxe a barra até a parte alta do peito, levando os cotovelos para baixo, soltando o ar.',
      'Volte devagar até estender os braços.'
    ],
    dicas: ['Pense em "colocar os cotovelos no bolso".', 'Nunca puxe a barra atrás da nuca.'],
    erros: ['Balançar o tronco para puxar.', 'Puxar só com os braços, sem mexer as escápulas.']
  },
  'remada-baixa': {
    titulo: 'Remada baixa',
    musculos: ['Costas', 'Bíceps'],
    passos: [
      'Sente com os pés apoiados e os joelhos levemente flexionados.',
      'Segure o triângulo com o tronco ereto.',
      'Puxe a pegada em direção ao abdômen, levando os cotovelos para trás e juntando as escápulas, soltando o ar.',
      'Volte devagar estendendo os braços, sem curvar a coluna.'
    ],
    dicas: ['Peito aberto durante todo o movimento.'],
    erros: ['Balançar o tronco para a frente e para trás.', 'Arredondar as costas.']
  },
  'remada-articulada': {
    titulo: 'Remada articulada',
    musculos: ['Costas', 'Bíceps'],
    passos: [
      'Ajuste o assento para que as pegadas fiquem na altura do meio do peito e apoie o peito no apoio.',
      'Segure as pegadas com os braços estendidos.',
      'Puxe levando os cotovelos para trás e aproximando as escápulas, soltando o ar.',
      'Volte devagar até estender os braços.'
    ],
    dicas: ['Mantenha o peito no apoio durante todo o movimento.'],
    erros: ['Tirar o peito do apoio para ajudar.', 'Encolher os ombros.']
  },
  'pulldown-polia': {
    titulo: 'Pulldown na polia',
    musculos: ['Costas (dorsal)'],
    passos: [
      'De frente para a polia alta, segure a barra com os braços estendidos e dê um passo para trás.',
      'Incline levemente o tronco à frente, com os joelhos levemente flexionados.',
      'Com os cotovelos quase estendidos, leve a barra até as coxas em um arco, soltando o ar.',
      'Volte devagar até a barra ficar na altura da cabeça.'
    ],
    dicas: ['O movimento sai dos ombros, não dos cotovelos.'],
    erros: ['Dobrar os cotovelos e transformar em tríceps.', 'Balançar o tronco.']
  },
  'crucifixo-inverso': {
    titulo: 'Crucifixo inverso',
    musculos: ['Ombro (posterior)', 'Parte alta das costas'],
    passos: [
      'Sente de frente para o encosto, com o peito apoiado.',
      'Segure as pegadas com os braços estendidos na altura dos ombros.',
      'Abra os braços para trás em arco, juntando as escápulas, soltando o ar.',
      'Volte devagar até a posição inicial.'
    ],
    dicas: ['Cotovelos levemente flexionados e fixos.'],
    erros: ['Usar carga alta e perder o controle.', 'Encolher os ombros.']
  },
  'prancha': {
    titulo: 'Prancha abdominal',
    musculos: ['Abdômen', 'Core'],
    passos: [
      'Apoie os antebraços no chão com os cotovelos abaixo dos ombros.',
      'Estenda as pernas apoiando-se nas pontas dos pés.',
      'Contraia abdômen e glúteos, mantendo o corpo reto da cabeça aos calcanhares.',
      'Respire normalmente e mantenha a posição pelo tempo da série.'
    ],
    dicas: ['Se estiver difícil, comece com os joelhos apoiados no chão.'],
    erros: ['Quadril alto demais ou caído.', 'Prender a respiração.']
  },
  'esteira': {
    titulo: 'Esteira (caminhada)',
    musculos: ['Condicionamento', 'Pernas'],
    passos: [
      'Suba na esteira parada, prenda o clipe de segurança e segure nas laterais para ligar.',
      'Comece devagar e aumente a velocidade aos poucos até a intensidade indicada.',
      'Caminhe com a postura ereta, olhando para a frente, balançando os braços naturalmente.',
      'Para terminar, reduza a velocidade gradualmente antes de parar.'
    ],
    dicas: ['Leve: ritmo confortável. Moderada: respiração mais forte, mas ainda dá para conversar.', 'Uma leve inclinação (1–3%) aumenta o gasto sem aumentar o impacto.'],
    erros: ['Segurar nas barras o tempo todo.', 'Olhar para os pés.']
  },
  'bicicleta': {
    titulo: 'Bicicleta ergométrica',
    musculos: ['Condicionamento', 'Pernas'],
    passos: [
      'Ajuste o banco na altura do quadril: com o pedal embaixo, o joelho fica levemente flexionado.',
      'Sente com a coluna ereta e segure o guidão sem tensionar os ombros.',
      'Pedale em ritmo constante e ajuste a carga para a intensidade indicada.'
    ],
    dicas: ['60–80 pedaladas por minuto é um bom ritmo.', 'Leve: pedalada solta. Moderada: ainda dá para falar frases curtas.'],
    erros: ['Banco baixo demais (força o joelho).', 'Carga tão alta que o ritmo cai muito.']
  },
  'eliptico': {
    titulo: 'Elíptico',
    musculos: ['Condicionamento', 'Corpo inteiro'],
    passos: [
      'Suba segurando as alças fixas e apoie os pés inteiros nos pedais.',
      'Comece a pedalar e depois segure as alças móveis.',
      'Mantenha o tronco ereto e empurre e puxe as alças em sincronia com as pernas.'
    ],
    dicas: ['Baixo impacto nas articulações: ótima alternativa à corrida.'],
    erros: ['Apoiar o peso do corpo nas alças.', 'Ficar na ponta dos pés.']
  }
};

/* Regras de associação nome → catálogo. A ordem importa (a primeira que casar vence). */
const REGRAS_CATALOGO = [
  [/supino/, 'supino-maquina'],
  [/desenvolvimento/, 'desenvolvimento-ombros'],
  [/elevacao lateral/, 'elevacao-lateral'],
  [/rosca martelo/, 'rosca-martelo'],
  [/rosca/, 'rosca-direta'],
  [/triceps.*corda/, 'triceps-corda'],
  [/triceps/, 'triceps-polia'],
  [/leg press/, 'leg-press'],
  [/extensora/, 'cadeira-extensora'],
  [/flexora/, 'mesa-flexora'],
  [/abdutora/, 'cadeira-abdutora'],
  [/pelvica|hip thrust/, 'elevacao-pelvica'],
  [/panturrilha/, 'panturrilha-sentado'],
  [/puxada/, 'puxada-frontal'],
  [/remada baixa/, 'remada-baixa'],
  [/remada/, 'remada-articulada'],
  [/pulldown/, 'pulldown-polia'],
  [/crucifixo inverso/, 'crucifixo-inverso'],
  [/prancha/, 'prancha'],
  [/eliptico/, 'eliptico'],
  [/bicicleta|bike/, 'bicicleta'],
  [/esteira|caminhada/, 'esteira']
];

function normalizar(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function infoExercicio(nome) {
  const n = normalizar(nome);
  const regra = REGRAS_CATALOGO.find(([re]) => re.test(n));
  if (!regra) return null;
  const slug = regra[1];
  return {
    slug,
    ...CATALOGO[slug],
    imagens: [`img/exercicios/${slug}-0.jpg`, `img/exercicios/${slug}-1.jpg`]
  };
}
