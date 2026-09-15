// Motor de cálculo do Planeador de Elétrica.

export type EletricaConfig = {
  pontosLuz: number;
  pontosComando: number;
  pontosTomada: number;
  intervencaoQuadro: boolean;
  detetoresIncendio: number;
  // Sincronizado automaticamente a partir do Planeador de Pladur da mesma
  // divisão (focos LED embutidos + fita LED) — não é um campo editável
  // diretamente aqui, mas soma-se aos pontos de luz para o cálculo.
  pontosLuzLed?: number;
  // Texto livre para pedidos que não se encaixam nos campos acima (sensores
  // de presença, domótica, etc.) — fica registado como linha a orçamentar
  // manualmente depois, em vez de tentarmos adivinhar um preço.
  notasAdicionais: string;
};

export type PrecoItem = { id: string; chave: string; descricao: string; unidade: string; preco: number; predefinido?: boolean };
export type TabelaPrecos = Record<string, PrecoItem>;

export type LinhaCalculada = { chave: string; descricao: string; unidade: string; quantidade: number; precoUnitario: number; valor: number };

export type ResultadoEletrica = {
  maoDeObra: LinhaCalculada[];
  totalMaoDeObra: number;
  subtotal: number;
  iva: number;
  total: number;
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

export function calcularOrcamentoEletrica(config: EletricaConfig, precos: TabelaPrecos): ResultadoEletrica {
  const maoDeObra: LinhaCalculada[] = [];

  addLinha(maoDeObra, precos, 'ponto_luz', config.pontosLuz + (config.pontosLuzLed || 0));
  addLinha(maoDeObra, precos, 'ponto_comando', config.pontosComando);
  addLinha(maoDeObra, precos, 'ponto_tomada', config.pontosTomada);
  if (config.intervencaoQuadro) addLinha(maoDeObra, precos, 'quadro_eletrico', 1);
  addLinha(maoDeObra, precos, 'deteccao_incendio', config.detetoresIncendio);

  if (config.notasAdicionais && config.notasAdicionais.trim()) {
    maoDeObra.push({
      chave: 'notas_adicionais',
      descricao: `A orçamentar: ${config.notasAdicionais.trim()}`,
      unidade: 'vg',
      quantidade: 1,
      precoUnitario: 0,
      valor: 0,
    });
  }

  const totalMaoDeObra = arred(maoDeObra.reduce((s, m) => s + m.valor, 0));
  const subtotal = totalMaoDeObra;
  const iva = arred(subtotal * IVA_PERCENTAGEM);
  const total = arred(subtotal + iva);

  return { maoDeObra, totalMaoDeObra, subtotal, iva, total };
}

export function tabelaPrecosParaMapa(itens: PrecoItem[]): TabelaPrecos {
  const mapa: TabelaPrecos = {};
  for (const item of itens) {
    if (!mapa[item.chave] || item.predefinido) mapa[item.chave] = item;
  }
  return mapa;
}
