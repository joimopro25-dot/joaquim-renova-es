// Motor de cálculo do Planeador de Pintura.

export type QualidadeTinta = 'normal' | 'normal_alta' | 'extrema';

export type ParedePintura = {
  id: string;
  larguraM: number;
  pintar: boolean;
};

export type PinturaConfig = {
  paredes: ParedePintura[];
  pintarTeto: boolean;
  demaos: 1 | 2;
  qualidadeTinta: QualidadeTinta;
  areaAberturasM2: number; // descontado da área total de paredes (portas/janelas), opcional
};

export type PrecoItem = { id: string; chave: string; descricao: string; unidade: string; preco: number; predefinido?: boolean };
export type TabelaPrecos = Record<string, PrecoItem>;

export type LinhaCalculada = { chave: string; descricao: string; unidade: string; quantidade: number; precoUnitario: number; valor: number };

export type ResultadoPintura = {
  materiais: LinhaCalculada[];
  maoDeObra: LinhaCalculada[];
  totalMateriais: number;
  totalMaoDeObra: number;
  subtotal: number;
  iva: number;
  total: number;
  m2Total: number;
  m2Paredes: number;
  m2Teto: number;
};

const IVA_PERCENTAGEM = 0.23;

function arred(n: number, casas = 2) {
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

function addLinha(linhas: LinhaCalculada[], precos: TabelaPrecos, chave: string, quantidade: number) {
  if (quantidade <= 0) return;
  const p = precos[chave];
  if (!p) return;
  linhas.push({ chave, descricao: p.descricao, unidade: p.unidade, quantidade: arred(quantidade, 2), precoUnitario: p.preco, valor: arred(quantidade * p.preco, 2) });
}

export function calcularOrcamentoPintura(
  comprimento: number,
  largura: number,
  peDireito: number,
  config: PinturaConfig,
  precos: TabelaPrecos
): ResultadoPintura {
  const materiais: LinhaCalculada[] = [];
  const maoDeObra: LinhaCalculada[] = [];

  let m2Paredes = 0;
  const paredesAPintar = config.paredes.filter((p) => p.pintar);
  if (paredesAPintar.length > 0) {
    const m2ParedesBruto = paredesAPintar.reduce((s, p) => s + p.larguraM * peDireito, 0);
    m2Paredes = Math.max(0, arred(m2ParedesBruto - (config.areaAberturasM2 || 0), 2));
  }
  const m2Teto = config.pintarTeto ? arred(comprimento * largura, 2) : 0;
  const m2Total = arred(m2Paredes + m2Teto, 2);

  if (m2Total > 0) {
    addLinha(maoDeObra, precos, 'acabamento_placa', m2Total);
    addLinha(maoDeObra, precos, 'primario', m2Total);
    addLinha(materiais, precos, 'primario_material', m2Total);
    addLinha(maoDeObra, precos, config.demaos === 2 ? 'pintura_2demaos' : 'pintura_1demao', m2Total);

    // Parede e teto usam produtos diferentes mesmo dentro da mesma gama de
    // qualidade (ex: tinta lisa na parede, tinta específica de teto), por
    // isso têm chaves de material próprias.
    const sufixo = config.qualidadeTinta === 'extrema' ? 'extrema' : config.qualidadeTinta === 'normal_alta' ? 'normal_alta' : 'normal';
    if (m2Paredes > 0) addLinha(materiais, precos, `tinta_parede_${sufixo}`, arred(m2Paredes * config.demaos, 2));
    if (m2Teto > 0) addLinha(materiais, precos, `tinta_teto_${sufixo}`, arred(m2Teto * config.demaos, 2));
  }

  const totalMateriais = arred(materiais.reduce((s, m) => s + m.valor, 0));
  const totalMaoDeObra = arred(maoDeObra.reduce((s, m) => s + m.valor, 0));
  const subtotal = arred(totalMateriais + totalMaoDeObra);
  const iva = arred(subtotal * IVA_PERCENTAGEM);
  const total = arred(subtotal + iva);

  return { materiais, maoDeObra, totalMateriais, totalMaoDeObra, subtotal, iva, total, m2Total, m2Paredes, m2Teto };
}

export function tabelaPrecosParaMapa(itens: PrecoItem[]): TabelaPrecos {
  const mapa: TabelaPrecos = {};
  for (const item of itens) {
    if (!mapa[item.chave] || item.predefinido) mapa[item.chave] = item;
  }
  return mapa;
}

export function paredesPorDefeito(comprimento: number, largura: number): ParedePintura[] {
  return [
    { id: 'norte', larguraM: comprimento, pintar: true },
    { id: 'sul', larguraM: comprimento, pintar: true },
    { id: 'este', larguraM: largura, pintar: true },
    { id: 'oeste', larguraM: largura, pintar: true },
  ];
}
