// Motor de cálculo do Planeador de Pladur.
// Fórmulas conforme especificação técnica (materiais + mão de obra por m²).

export type TipoTeto = 'nenhum' | 'simples' | 'sanca_simples' | 'sanca_led' | 'rebaixo_central';
export type TipoSanca = 'simples' | 'goteira' | 'invertida';
export type Cobertura = 'toda' | 'uma' | 'duas';
export type TipoTrabalhoParede = 'revestimento' | 'tabique' | 'divisoria';
export type TipoPlaca = 'normal' | 'hidrofuga' | 'cortafogo';
export type TipoPintura = 'nao' | '1demao' | '2demaos';
export type TipoLed = 'nao' | 'fita' | 'spots';

export type EspacoConfig = {
  nome: string;
  comprimento: number;
  largura: number;
  peDireito: number;
};

export type TetoConfig = {
  tipo: TipoTeto;
  tipoSanca?: TipoSanca;
  larguraSancaCm?: number;
  alturaSancaCm?: number;
  cobertura?: Cobertura;
};

export type ParedeConfig = {
  id: string;
  larguraM: number;
  tipoTrabalho: TipoTrabalhoParede;
  tipoPlaca: TipoPlaca;
  isolamentoAcustico: boolean;
};

export type AcabamentosConfig = {
  pintura: TipoPintura;
  led: TipoLed;
  metrosLed?: number;
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

    if (teto.tipo === 'sanca_simples' || teto.tipo === 'sanca_led') {
      const perimetro = perimetroSanca(espaco, teto.cobertura);
      const alturaSancaM = (teto.alturaSancaCm || 20) / 100;
      const placasSanca = (perimetro * alturaSancaM * 1.15) / 3.0;
      const perfisSanca = perimetro * 2.5;
      addLinha(materiaisMapa, precos, 'placa_normal', Math.ceil(placasSanca));
      addLinha(materiaisMapa, precos, 'perfil_primario', Math.ceil(perfisSanca / 3));
    }

    if (teto.tipo === 'sanca_led' && acabamentos.metrosLed) {
      addLinha(materiaisMapa, precos, 'fita_led', acabamentos.metrosLed);
    }

    const chaveMaoObraTeto = teto.tipo === 'sanca_led' ? 'teto_sanca_led' : teto.tipo === 'sanca_simples' ? 'teto_sanca_simples' : 'teto_simples';
    const precoMaoObra = precos[chaveMaoObraTeto];
    if (precoMaoObra) {
      maoDeObraLinhas.push({
        chave: chaveMaoObraTeto,
        descricao: precoMaoObra.descricao,
        unidade: 'm²',
        quantidade: m2Teto,
        precoUnitario: precoMaoObra.preco,
        valor: arred(m2Teto * precoMaoObra.preco, 2),
      });
    }
  }

  let m2Paredes = 0;
  let m2ComIsolamento = 0;
  for (const parede of paredes) {
    const m2 = arred(parede.larguraM * espaco.peDireito, 2);
    m2Paredes += m2;
    const placas = (m2 * 1.10) / 3.0;
    const montantes = parede.larguraM / 0.60;
    const calhas = (parede.larguraM * 2) + (espaco.peDireito * 2);

    const chavePlaca = parede.tipoPlaca === 'hidrofuga' ? 'placa_hidrofuga' : parede.tipoPlaca === 'cortafogo' ? 'placa_cortafogo' : 'placa_normal';
    addLinha(materiaisMapa, precos, chavePlaca, Math.ceil(placas));
    addLinha(materiaisMapa, precos, 'montante', Math.ceil(montantes / 3));
    addLinha(materiaisMapa, precos, 'calha_guia', Math.ceil(calhas / 3));

    if (parede.isolamentoAcustico) {
      addLinha(materiaisMapa, precos, 'la_rocha', m2);
      m2ComIsolamento += m2;
    }

    const chaveMaoObraParede = parede.tipoTrabalho === 'revestimento' ? 'revestimento_parede' : 'tabique_divisoria';
    const precoParede = precos[chaveMaoObraParede];
    if (precoParede) {
      maoDeObraLinhas.push({
        chave: `${chaveMaoObraParede}_${parede.id}`,
        descricao: `${precoParede.descricao} (${parede.larguraM}m)`,
        unidade: 'm²',
        quantidade: m2,
        precoUnitario: precoParede.preco,
        valor: arred(m2 * precoParede.preco, 2),
      });
    }
  }

  if (m2ComIsolamento > 0) {
    const precoIsolamento = precos['isolamento_acustico'];
    if (precoIsolamento) {
      maoDeObraLinhas.push({
        chave: 'isolamento_acustico',
        descricao: precoIsolamento.descricao,
        unidade: 'm²',
        quantidade: arred(m2ComIsolamento, 2),
        precoUnitario: precoIsolamento.preco,
        valor: arred(m2ComIsolamento * precoIsolamento.preco, 2),
      });
    }
  }

  const m2Total = m2Teto + m2Paredes;
  if (acabamentos.pintura !== 'nao' && m2Total > 0) {
    const chavePintura = acabamentos.pintura === '2demaos' ? 'pintura_2demaos' : 'pintura_1demao';
    const precoPintura = precos[chavePintura];
    if (precoPintura) {
      maoDeObraLinhas.push({
        chave: chavePintura,
        descricao: precoPintura.descricao,
        unidade: 'm²',
        quantidade: arred(m2Total, 2),
        precoUnitario: precoPintura.preco,
        valor: arred(m2Total * precoPintura.preco, 2),
      });
    }
  }

  if (acabamentos.led === 'fita' && acabamentos.metrosLed && teto.tipo !== 'sanca_led') {
    addLinha(materiaisMapa, precos, 'fita_led', acabamentos.metrosLed);
  }

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
