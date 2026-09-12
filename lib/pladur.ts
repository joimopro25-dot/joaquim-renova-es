// Motor de cálculo do Planeador de Pladur.
// Fórmulas conforme especificação técnica + práticas confirmadas nos manuais
// técnicos Pladur/Gyptec (espaçamento de perfis, suspensão de teto, etc.).

export type TipoTeto = 'nenhum' | 'simples' | 'sanca_simples' | 'sanca_led' | 'rebaixo_central';
export type TipoSanca = 'simples' | 'goteira' | 'invertida';
export type Cobertura = 'toda' | 'uma' | 'duas';
export type RemateTeto = 'justificado' | 'sombra';
export type TipoTrabalhoParede = 'revestimento' | 'tabique' | 'divisoria';
export type TipoPlaca = 'normal' | 'hidrofuga' | 'cortafogo';
export type SistemaFixacao = 'montante' | 'omega';
export type TipoIsolamento = 'nenhum' | 'la_rocha' | 'la_mineral' | 'bolha';
export type EstruturaParede = 'simples' | 'dupla';
export type TipoPintura = 'nao' | '1demao' | '2demaos';
export type QualidadeTinta = 'normal' | 'normal_alta' | 'extrema';
export type TipoLed = 'nao' | 'fita' | 'fita_zigbee';

export type EspacoConfig = {
  nome: string;
  comprimento: number;
  largura: number;
  peDireito: number;
};

export type TetoConfig = {
  tipo: TipoTeto;
  remate?: RemateTeto;
  tipoSanca?: TipoSanca;
  larguraSancaCm?: number;
  alturaSancaCm?: number;
  cobertura?: Cobertura;
  focosLed?: number;
};

export type ParedeConfig = {
  id: string;
  larguraM: number;
  tipoTrabalho: TipoTrabalhoParede;
  tipoPlaca: TipoPlaca;
  sistemaFixacao: SistemaFixacao;
  estrutura: EstruturaParede;
  tipoIsolamento: TipoIsolamento;
  temTv: boolean;
};

export type AcabamentosConfig = {
  pintura: TipoPintura;
  qualidadeTinta: QualidadeTinta;
  led: TipoLed;
  metrosLed?: number;
  rodape: boolean;
  pontosLuz: number;
  interruptores: number;
  tomadas: number;
};

export type PrecoItem = { chave: string; descricao: string; unidade: string; preco: number };
export type TabelaPrecos = Record<string, PrecoItem>;

export type LinhaCalculada = {
  chave: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  valor: number;
};

export type ResultadoPladur = {
  materiais: LinhaCalculada[];
  maoDeObra: LinhaCalculada[];
  totalMateriais: number;
  totalMaoDeObra: number;
  subtotal: number;
  iva: number;
  total: number;
  m2Teto: number;
  m2Paredes: number;
};

const IVA_PERCENTAGEM = 0.23;
// Um suspensor (varão roscado + peça niveladora) por cada ~1.2 m² de teto —
// aproximação razoável para uma modulação de 600mm nos dois sentidos.
const M2_POR_SUSPENSOR = 1.2;

function arred(n: number, casas = 2) {
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

function perimetroSanca(espaco: EspacoConfig, cobertura: Cobertura | undefined): number {
  const perimetroTotal = (espaco.comprimento + espaco.largura) * 2;
  if (cobertura === 'uma') return espaco.comprimento;
  if (cobertura === 'duas') return espaco.comprimento + espaco.largura;
  return perimetroTotal;
}

function addLinha(mapa: Map<string, LinhaCalculada>, precos: TabelaPrecos, chave: string, quantidade: number) {
  if (quantidade <= 0) return;
  const p = precos[chave];
  if (!p) return;
  const existente = mapa.get(chave);
  const qtdTotal = (existente?.quantidade || 0) + quantidade;
  mapa.set(chave, {
    chave,
    descricao: p.descricao,
    unidade: p.unidade,
    quantidade: arred(qtdTotal, 2),
    precoUnitario: p.preco,
    valor: arred(qtdTotal * p.preco, 2),
  });
}

function addMaoDeObra(linhas: LinhaCalculada[], precos: TabelaPrecos, chave: string, quantidade: number, sufixo = '') {
  if (quantidade <= 0) return;
  const p = precos[chave];
  if (!p) return;
  linhas.push({
    chave: chave + sufixo,
    descricao: p.descricao,
    unidade: p.unidade,
    quantidade: arred(quantidade, 2),
    precoUnitario: p.preco,
    valor: arred(quantidade * p.preco, 2),
  });
}

export function calcularOrcamentoPladur(
  espaco: EspacoConfig,
  teto: TetoConfig,
  paredes: ParedeConfig[],
  acabamentos: AcabamentosConfig,
  precos: TabelaPrecos
): ResultadoPladur {
  const materiaisMapa = new Map<string, LinhaCalculada>();
  const maoDeObraLinhas: LinhaCalculada[] = [];

  const m2Teto = teto.tipo !== 'nenhum' ? arred(espaco.comprimento * espaco.largura, 2) : 0;
  const perimetroSala = (espaco.comprimento + espaco.largura) * 2;

  if (teto.tipo !== 'nenhum') {
    // Modulação da estrutura: 600mm em condições normais (400mm em zonas
    // húmidas/reforçadas — cf. manuais técnicos Pladur/Gyptec), aplicada
    // igualmente aos perfis primários e secundários.
    const placas = (m2Teto * 1.10) / 3.0;
    const perfisPrimarios = (espaco.largura / 0.60) * espaco.comprimento;
    const perfisSecundarios = (espaco.comprimento / 0.60) * espaco.largura;
    const parafusos = placas * 30;
    const massaJuntas = m2Teto * 0.4;
    const fitaPapel = m2Teto * 1.2;

    addLinha(materiaisMapa, precos, 'placa_normal', Math.ceil(placas));
    addLinha(materiaisMapa, precos, 'perfil_primario', Math.ceil(perfisPrimarios / 3));
    addLinha(materiaisMapa, precos, 'perfil_secundario', Math.ceil(perfisSecundarios / 3));
    addLinha(materiaisMapa, precos, 'parafusos', Math.ceil(parafusos / 500));
    addLinha(materiaisMapa, precos, 'massa_juntas', Math.ceil(massaJuntas / 25));
    addLinha(materiaisMapa, precos, 'fita_papel', Math.ceil(fitaPapel / 75));

    // Suspensão do teto: varão roscado + suspensor nivelador — sempre
    // necessário num teto contínuo (não é opcional).
    const suspensores = Math.ceil(m2Teto / M2_POR_SUSPENSOR);
    addLinha(materiaisMapa, precos, 'varao_roscado', suspensores);

    // Remate perimetral: justificado (perfil angular normal) ou com junta
    // de sombra (Perfil Pladur Sombra).
    const chaveRemate = teto.remate === 'sombra' ? 'perfil_sombra' : 'perfil_angular';
    addLinha(materiaisMapa, precos, chaveRemate, Math.ceil(perimetroSala / 3));

    if (teto.tipo === 'sanca_simples' || teto.tipo === 'sanca_led') {
      const perimetro = perimetroSanca(espaco, teto.cobertura);
      const alturaSancaM = (teto.alturaSancaCm || 20) / 100;
      const placasSanca = (perimetro * alturaSancaM * 1.15) / 3.0;
      const perfisSanca = perimetro * 2.5;
      addLinha(materiaisMapa, precos, 'placa_normal', Math.ceil(placasSanca));
      addLinha(materiaisMapa, precos, 'perfil_primario', Math.ceil(perfisSanca / 3));
    }

    // Focos LED embutidos no teto (contam à parte da fita LED).
    if (teto.focosLed && teto.focosLed > 0) {
      addLinha(materiaisMapa, precos, 'foco_led', teto.focosLed);
      addMaoDeObra(maoDeObraLinhas, precos, 'foco_led_instalacao', teto.focosLed);
    }

    if (teto.tipo === 'sanca_led' && acabamentos.metrosLed) {
      addLinha(materiaisMapa, precos, 'fita_led', acabamentos.metrosLed);
      addLinha(materiaisMapa, precos, 'transformador_led', 1);
      if (acabamentos.led === 'fita_zigbee') addLinha(materiaisMapa, precos, 'modulo_zigbee', 1);
    }

    const chaveMaoObraTeto = teto.tipo === 'sanca_led' ? 'teto_sanca_led' : teto.tipo === 'sanca_simples' ? 'teto_sanca_simples' : 'teto_simples';
    addMaoDeObra(maoDeObraLinhas, precos, chaveMaoObraTeto, m2Teto);
  }

  let m2Paredes = 0;
  let m2ComIsolamento = 0;
  for (const parede of paredes) {
    const m2 = arred(parede.larguraM * espaco.peDireito, 2);
    m2Paredes += m2;
    const fatorPlacas = parede.estrutura === 'dupla' ? 2 : 1;
    const placas = ((m2 * 1.10) / 3.0) * fatorPlacas;

    const chavePlaca = parede.tipoPlaca === 'hidrofuga' ? 'placa_hidrofuga' : parede.tipoPlaca === 'cortafogo' ? 'placa_cortafogo' : 'placa_normal';
    addLinha(materiaisMapa, precos, chavePlaca, Math.ceil(placas));

    // Sistema de fixação: perfil ómega (fixado direto à parede existente,
    // só aplicável em revestimento direto) ou estrutura guia+montante
    // (autoportante, obrigatória em tabiques/divisórias novas).
    if (parede.sistemaFixacao === 'omega' && parede.tipoTrabalho === 'revestimento') {
      const perfisOmega = Math.ceil(parede.larguraM / 0.60) * espaco.peDireito;
      addLinha(materiaisMapa, precos, 'perfil_omega', Math.ceil(perfisOmega / 3));
    } else {
      const montantes = parede.larguraM / 0.60;
      const calhas = (parede.larguraM * 2) + (espaco.peDireito * 2);
      addLinha(materiaisMapa, precos, 'montante', Math.ceil(montantes / 3));
      addLinha(materiaisMapa, precos, 'calha_guia', Math.ceil(calhas / 3));
      // Banda acústica sob as calhas guia, para desacoplar a estrutura do
      // pavimento/teto (boa prática em qualquer tabique/divisória nova).
      addLinha(materiaisMapa, precos, 'banda_acustica', Math.ceil(calhas));
    }

    if (parede.tipoIsolamento !== 'nenhum') {
      const chaveIsolamento = parede.tipoIsolamento === 'la_mineral' ? 'la_mineral' : parede.tipoIsolamento === 'bolha' ? 'isolamento_bolha' : 'la_rocha';
      addLinha(materiaisMapa, precos, chaveIsolamento, m2);
      m2ComIsolamento += m2;
    }

    if (parede.temTv) {
      addLinha(materiaisMapa, precos, 'reforco_tv', 1);
      addMaoDeObra(maoDeObraLinhas, precos, 'reforco_tv_instalacao', 1, `_${parede.id}`);
    }

    const chaveMaoObraParede = parede.tipoTrabalho === 'revestimento' ? 'revestimento_parede' : 'tabique_divisoria';
    const sufixoEstrutura = parede.estrutura === 'dupla' ? ' (estrutura dupla)' : '';
    const precoParede = precos[chaveMaoObraParede];
    if (precoParede) {
      maoDeObraLinhas.push({
        chave: `${chaveMaoObraParede}_${parede.id}`,
        descricao: `${precoParede.descricao} (${parede.larguraM}m)${sufixoEstrutura}`,
        unidade: 'm²',
        quantidade: m2,
        precoUnitario: precoParede.preco,
        valor: arred(m2 * precoParede.preco, 2),
      });
    }
  }

  if (m2ComIsolamento > 0) {
    addMaoDeObra(maoDeObraLinhas, precos, 'isolamento_acustico', m2ComIsolamento);
  }

  const m2Total = m2Teto + m2Paredes;
  if (acabamentos.pintura !== 'nao' && m2Total > 0) {
    const numDemaos = acabamentos.pintura === '2demaos' ? 2 : 1;
    // Antes da pintura: acabamento de placa (massa + lixagem) e primário —
    // trabalho obrigatório, não incluído no preço da própria pintura.
    addMaoDeObra(maoDeObraLinhas, precos, 'acabamento_placa', m2Total);
    addMaoDeObra(maoDeObraLinhas, precos, 'primario', m2Total);

    const chavePintura = numDemaos === 2 ? 'pintura_2demaos' : 'pintura_1demao';
    addMaoDeObra(maoDeObraLinhas, precos, chavePintura, m2Total);

    const chaveTinta = acabamentos.qualidadeTinta === 'extrema' ? 'tinta_extrema' : acabamentos.qualidadeTinta === 'normal_alta' ? 'tinta_normal_alta' : 'tinta_normal';
    addLinha(materiaisMapa, precos, chaveTinta, arred(m2Total * numDemaos, 2));
  }

  if (acabamentos.led !== 'nao' && acabamentos.metrosLed && teto.tipo !== 'sanca_led') {
    addLinha(materiaisMapa, precos, 'fita_led', acabamentos.metrosLed);
    addLinha(materiaisMapa, precos, 'transformador_led', 1);
    if (acabamentos.led === 'fita_zigbee') addLinha(materiaisMapa, precos, 'modulo_zigbee', 1);
  }

  if (acabamentos.rodape) {
    addLinha(materiaisMapa, precos, 'rodape', arred(perimetroSala, 2));
  }

  const totalPontosEletricos = (acabamentos.pontosLuz || 0) + (acabamentos.interruptores || 0) + (acabamentos.tomadas || 0);
  addMaoDeObra(maoDeObraLinhas, precos, 'ponto_eletrico', totalPontosEletricos);

  const materiais = Array.from(materiaisMapa.values());
  const totalMateriais = arred(materiais.reduce((s, m) => s + m.valor, 0));
  const totalMaoDeObra = arred(maoDeObraLinhas.reduce((s, m) => s + m.valor, 0));
  const subtotal = arred(totalMateriais + totalMaoDeObra);
  const iva = arred(subtotal * IVA_PERCENTAGEM);
  const total = arred(subtotal + iva);

  return { materiais, maoDeObra: maoDeObraLinhas, totalMateriais, totalMaoDeObra, subtotal, iva, total, m2Teto, m2Paredes: arred(m2Paredes, 2) };
}

export function tabelaPrecosParaMapa(itens: PrecoItem[]): TabelaPrecos {
  const mapa: TabelaPrecos = {};
  for (const item of itens) mapa[item.chave] = item;
  return mapa;
}
