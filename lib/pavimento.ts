// Motor de cálculo do Planeador de Pavimento.

export type TipoPavimento = 'laminado_flutuante' | 'vinilico';

export type PavimentoConfig = {
  tipo: TipoPavimento;
  removerAntigo: boolean;
  incluirRodape: boolean;
};

export type PrecoItem = { chave: string; descricao: string; unidade: string; preco: number };
export type TabelaPrecos = Record<string, PrecoItem>;

export type LinhaCalculada = { chave: string; descricao: string; unidade: string; quantidade: number; precoUnitario: number; valor: number };

export type ResultadoPavimento = {
  materiais: LinhaCalculada[];
  maoDeObra: LinhaCalculada[];
  totalMateriais: number;
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

export function calcularOrcamentoPavimento(
  comprimento: number,
  largura: number,
  config: PavimentoConfig,
  precos: TabelaPrecos
): ResultadoPavimento {
  const materiais: LinhaCalculada[] = [];
  const maoDeObra: LinhaCalculada[] = [];

  const m2 = arred(comprimento * largura, 2);
  const perimetro = (comprimento + largura) * 2;

  const chaveMaterial = config.tipo === 'vinilico' ? 'vinilico' : 'laminado_flutuante';
  addLinha(materiais, precos, chaveMaterial, arred(m2 * 1.08, 2)); // 8% desperdício/cortes
  addLinha(materiais, precos, 'manta_subpiso', m2);
  addLinha(materiais, precos, 'perfil_remate', 1);

  addLinha(maoDeObra, precos, 'aplicacao_flutuante', m2);
  if (config.removerAntigo) addLinha(maoDeObra, precos, 'remocao_pavimento_antigo', m2);

  if (config.incluirRodape) {
    addLinha(materiais, precos, 'rodape', arred(perimetro, 2));
    addLinha(maoDeObra, precos, 'aplicacao_rodape', arred(perimetro, 2));
  }

  const totalMateriais = arred(materiais.reduce((s, m) => s + m.valor, 0));
  const totalMaoDeObra = arred(maoDeObra.reduce((s, m) => s + m.valor, 0));
  const subtotal = arred(totalMateriais + totalMaoDeObra);
  const iva = arred(subtotal * IVA_PERCENTAGEM);
  const total = arred(subtotal + iva);

  return { materiais, maoDeObra, totalMateriais, totalMaoDeObra, subtotal, iva, total };
}

export function tabelaPrecosParaMapa(itens: PrecoItem[]): TabelaPrecos {
  const mapa: TabelaPrecos = {};
  for (const item of itens) mapa[item.chave] = item;
  return mapa;
}
