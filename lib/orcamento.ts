export type LinhaCalculo = {
  quantidade: number;
  rendimento_horas: number;
  custo_material: number;
};

export type OrcamentoCalculo = {
  taxa_horaria: number;
  margem_percentagem: number; // usado como "Imprevistos (%)"
  iva_percentagem: number;
};

export function moPorUnidade(linha: LinhaCalculo, taxaHoraria: number): number {
  return linha.rendimento_horas * taxaHoraria;
}

export function precoPorUnidade(linha: LinhaCalculo, taxaHoraria: number): number {
  return moPorUnidade(linha, taxaHoraria) + linha.custo_material;
}

export function totalLinha(linha: LinhaCalculo, taxaHoraria: number): number {
  return linha.quantidade * precoPorUnidade(linha, taxaHoraria);
}

export function calcularTotais(linhas: LinhaCalculo[], orcamento: OrcamentoCalculo) {
  const subtotal = linhas.reduce((s, l) => s + totalLinha(l, orcamento.taxa_horaria), 0);
  const imprevistos = subtotal * ((orcamento.margem_percentagem || 0) / 100);
  const semIva = subtotal + imprevistos;
  const iva = semIva * ((orcamento.iva_percentagem || 0) / 100);
  const total = semIva + iva;
  return { subtotal, imprevistos, semIva, iva, total };
}
