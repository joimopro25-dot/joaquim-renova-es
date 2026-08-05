export type LinhaCalculo = {
  quantidade: number;
  tipo_linha: string; // 'material' | 'mao_obra' | 'subcontratada'
  preco_unitario?: number;
  desconto1_percentagem?: number;
  desconto2_percentagem?: number;
  valor_subcontratado?: number;
  margem_subcontratacao_percentagem?: number;
};

export type OrcamentoCalculo = {
  margem_percentagem: number; // usado como "Imprevistos (%)"
  iva_material_percentagem?: number;
  iva_mao_obra_percentagem?: number;
  iva_subcontratado_percentagem?: number;
};

export function precoUnitarioFinal(linha: LinhaCalculo): number {
  if (linha.tipo_linha === 'subcontratada') {
    return (linha.valor_subcontratado || 0) * (1 + (linha.margem_subcontratacao_percentagem || 0) / 100);
  }
  const desc1 = (linha.desconto1_percentagem || 0) / 100;
  const desc2 = (linha.desconto2_percentagem || 0) / 100;
  return (linha.preco_unitario || 0) * (1 - desc1) * (1 - desc2);
}

export function totalLinha(linha: LinhaCalculo): number {
  return linha.quantidade * precoUnitarioFinal(linha);
}

export type TotaisCategoria = { subtotal: number; imprevistos: number; iva: number; total: number };
export type TotaisOrcamento = {
  material: TotaisCategoria;
  maoObra: TotaisCategoria;
  subcontratado: TotaisCategoria;
  subtotal: number;
  imprevistos: number;
  iva: number;
  total: number;
};

function calcularCategoria(linhas: LinhaCalculo[], margemPercentagem: number, ivaPercentagem: number): TotaisCategoria {
  const subtotal = linhas.reduce((s, l) => s + totalLinha(l), 0);
  const imprevistos = subtotal * (margemPercentagem / 100);
  const semIva = subtotal + imprevistos;
  const iva = semIva * (ivaPercentagem / 100);
  return { subtotal, imprevistos, iva, total: semIva + iva };
}

export function calcularTotais(linhas: LinhaCalculo[], orcamento: OrcamentoCalculo): TotaisOrcamento {
  const margem = orcamento.margem_percentagem || 0;
  const material = calcularCategoria(linhas.filter((l) => l.tipo_linha === 'material'), margem, orcamento.iva_material_percentagem ?? 23);
  const maoObra = calcularCategoria(linhas.filter((l) => l.tipo_linha === 'mao_obra'), margem, orcamento.iva_mao_obra_percentagem ?? 23);
  const subcontratado = calcularCategoria(linhas.filter((l) => l.tipo_linha === 'subcontratada'), margem, orcamento.iva_subcontratado_percentagem ?? 23);
  return {
    material,
    maoObra,
    subcontratado,
    subtotal: material.subtotal + maoObra.subtotal + subcontratado.subtotal,
    imprevistos: material.imprevistos + maoObra.imprevistos + subcontratado.imprevistos,
    iva: material.iva + maoObra.iva + subcontratado.iva,
    total: material.total + maoObra.total + subcontratado.total,
  };
}

// Variante para dados ja calculados do lado do servidor (vista orcamento_linhas_cliente),
// que nunca expoe preco_unitario/descontos/valor_subcontratado ao portal do cliente.
export type LinhaSegura = { tipo_linha: string; preco_total: number };

function calcularCategoriaSegura(linhas: LinhaSegura[], margemPercentagem: number, ivaPercentagem: number): TotaisCategoria {
  const subtotal = linhas.reduce((s, l) => s + l.preco_total, 0);
  const imprevistos = subtotal * (margemPercentagem / 100);
  const semIva = subtotal + imprevistos;
  const iva = semIva * (ivaPercentagem / 100);
  return { subtotal, imprevistos, iva, total: semIva + iva };
}

export function calcularTotaisSeguro(linhas: LinhaSegura[], orcamento: OrcamentoCalculo): TotaisOrcamento {
  const margem = orcamento.margem_percentagem || 0;
  const material = calcularCategoriaSegura(linhas.filter((l) => l.tipo_linha === 'material'), margem, orcamento.iva_material_percentagem ?? 23);
  const maoObra = calcularCategoriaSegura(linhas.filter((l) => l.tipo_linha === 'mao_obra'), margem, orcamento.iva_mao_obra_percentagem ?? 23);
  const subcontratado = calcularCategoriaSegura(linhas.filter((l) => l.tipo_linha === 'subcontratada'), margem, orcamento.iva_subcontratado_percentagem ?? 23);
  return {
    material,
    maoObra,
    subcontratado,
    subtotal: material.subtotal + maoObra.subtotal + subcontratado.subtotal,
    imprevistos: material.imprevistos + maoObra.imprevistos + subcontratado.imprevistos,
    iva: material.iva + maoObra.iva + subcontratado.iva,
    total: material.total + maoObra.total + subcontratado.total,
  };
}
