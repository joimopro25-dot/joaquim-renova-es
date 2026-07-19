'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { moPorUnidade, precoPorUnidade, totalLinha, calcularTotais } from '../../../../lib/orcamento';
import { Plus, Trash2, ArrowLeft, Send, Check, X, ArrowRightCircle } from 'lucide-react';

type Linha = {
  id: string;
  descricao: string;
  capitulo: string;
  unidade: string;
  quantidade: number;
  rendimento_horas: number;
  custo_material: number;
};

type ItemPrecario = {
  id: string;
  categoria: string;
  descricao: string;
  unidade: string;
  rendimento_horas: number;
  custo_material: number;
};

type Orcamento = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  taxa_horaria: number;
  margem_percentagem: number;
  iva_percentagem: number;
  cliente_id: string;
  clientes: { nome: string } | null;
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-sand-100 text-ink-600' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido em Obra', color: 'bg-purple-100 text-purple-700' },
};

export default function OrcamentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [precario, setPrecario] = useState<ItemPrecario[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const [capitulo, setCapitulo] = useState('Geral');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [quantidade, setQuantidade] = useState('1');
  const [rendimentoHoras, setRendimentoHoras] = useState('0');
  const [custoMaterial, setCustoMaterial] = useState('0');

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: orc }, { data: linhasData }, { data: precarioData }] = await Promise.all([
      supabase.from('orcamentos').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('orcamento_linhas').select('*').eq('orcamento_id', id).order('criado_em'),
      supabase.from('tabela_precos').select('*').order('categoria').order('descricao'),
    ]);
    setOrcamento(orc as any);
    setLinhas(linhasData || []);
    setPrecario(precarioData || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const capitulosExistentes = useMemo(() => Array.from(new Set(linhas.map((l) => l.capitulo))), [linhas]);

  function carregarDoPrecario(itemId: string) {
    const item = precario.find((p) => p.id === itemId);
    if (!item) return;
    setDescricao(item.descricao);
    setUnidade(item.unidade);
    setRendimentoHoras(String(item.rendimento_horas));
    setCustoMaterial(String(item.custo_material));
  }

  async function adicionarLinha(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('orcamento_linhas').insert([{
      orcamento_id: id,
      capitulo: capitulo || 'Geral',
      descricao,
      unidade: unidade || 'un',
      quantidade: parseFloat(quantidade) || 1,
      rendimento_horas: parseFloat(rendimentoHoras) || 0,
      custo_material: parseFloat(custoMaterial) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setDescricao(''); setQuantidade('1'); setRendimentoHoras('0'); setCustoMaterial('0');
    carregar();
  }

  async function removerLinha(linhaId: string) {
    await supabase.from('orcamento_linhas').delete().eq('id', linhaId);
    carregar();
  }

  async function mudarEstado(novoEstado: string) {
    await supabase.from('orcamentos').update({ status: novoEstado }).eq('id', id);
    carregar();
  }

  async function atualizarCampo(campo: 'margem_percentagem' | 'iva_percentagem' | 'taxa_horaria', valor: number) {
    await supabase.from('orcamentos').update({ [campo]: valor }).eq('id', id);
    carregar();
  }

  async function converterEmObra() {
    if (!orcamento) return;
    setConverting(true);
    const { error: obraError } = await supabase.from('obras').insert([{
      cliente_id: orcamento.cliente_id,
      titulo: orcamento.titulo,
      descricao: orcamento.descricao,
      valor_total: totais.total,
      status: 'orcamento',
      orcamento_id: orcamento.id,
    }]);
    if (obraError) { alert('Erro ao criar obra: ' + obraError.message); setConverting(false); return; }
    await supabase.from('orcamentos').update({ status: 'convertido' }).eq('id', id);
    setConverting(false);
    router.push('/admin/obras');
  }

  const totais = orcamento
    ? calcularTotais(linhas, orcamento)
    : { subtotal: 0, imprevistos: 0, semIva: 0, iva: 0, total: 0 };

  const taxaHoraria = orcamento?.taxa_horaria || 0;

  const linhasPorCapitulo = useMemo(() => {
    const grupos: Record<string, Linha[]> = {};
    for (const l of linhas) {
      (grupos[l.capitulo] ||= []).push(l);
    }
    return grupos;
  }, [linhas]);

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!orcamento) return <div className="p-8 text-center text-ink-400 text-sm">Orçamento não encontrado.</div>;

  const info = ESTADOS[orcamento.status] || ESTADOS.rascunho;
  const editavel = orcamento.status === 'rascunho';

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <button onClick={() => router.push('/admin/orcamentos')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar a Orçamentos
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-ink-800">{orcamento.titulo}</h2>
          <p className="text-sm text-ink-400">{orcamento.clientes?.nome || '—'}</p>
        </div>
        <span className={`badge ${info.color}`}>{info.label}</span>
      </div>

      {orcamento.status !== 'convertido' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {orcamento.status === 'rascunho' && (
            <button onClick={() => mudarEstado('enviado')} className="btn-primary bg-blue-600 hover:bg-blue-700">
              <Send size={16} /> Marcar como Enviado (fica visível no portal do cliente)
            </button>
          )}
          {orcamento.status === 'enviado' && (
            <>
              <button onClick={() => mudarEstado('aprovado')} className="btn-primary bg-green-600 hover:bg-green-700">
                <Check size={16} /> Aprovar
              </button>
              <button onClick={() => mudarEstado('rejeitado')} className="btn-primary bg-red-600 hover:bg-red-700">
                <X size={16} /> Rejeitar
              </button>
              <span className="text-sm text-ink-400 self-center">Também pode ser aprovado pelo próprio cliente no portal.</span>
            </>
          )}
          {orcamento.status === 'aprovado' && (
            <button onClick={converterEmObra} disabled={converting} className="btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
              <ArrowRightCircle size={16} /> {converting ? 'A converter...' : 'Converter em Obra'}
            </button>
          )}
        </div>
      )}

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-3">Definições de Cálculo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-ink-500">Taxa horária de mão-de-obra (€/h)</span>
            {editavel ? (
              <input type="number" step="0.01" defaultValue={orcamento.taxa_horaria} onBlur={(e) => atualizarCampo('taxa_horaria', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{formatMoney(orcamento.taxa_horaria)}</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">Imprevistos (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.margem_percentagem} onBlur={(e) => atualizarCampo('margem_percentagem', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.margem_percentagem}%</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">IVA (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.iva_percentagem} onBlur={(e) => atualizarCampo('iva_percentagem', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.iva_percentagem}%</span>}
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4">Mapa de Quantidades e Custos</h3>

        {Object.keys(linhasPorCapitulo).length > 0 && (
          <div className="overflow-x-auto mb-4 space-y-6">
            {Object.entries(linhasPorCapitulo).map(([cap, itens]) => {
              const subtotalCap = itens.reduce((s, l) => s + totalLinha(l, taxaHoraria), 0);
              return (
                <div key={cap}>
                  <div className="bg-brand-500 text-white text-sm font-semibold px-3 py-1.5 rounded-t-lg">{cap}</div>
                  <table className="w-full text-left text-sm border border-t-0 border-sand-200 rounded-b-lg overflow-hidden">
                    <thead className="text-ink-400 text-xs uppercase bg-sand-50">
                      <tr>
                        <th className="p-2 font-medium">Descrição</th>
                        <th className="p-2 font-medium text-right">Un</th>
                        <th className="p-2 font-medium text-right">Qtd</th>
                        <th className="p-2 font-medium text-right">Rend. h/un</th>
                        <th className="p-2 font-medium text-right">MO €/un</th>
                        <th className="p-2 font-medium text-right">Material €/un</th>
                        <th className="p-2 font-medium text-right">Preço un.</th>
                        <th className="p-2 font-medium text-right">Total</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100">
                      {itens.map((l) => (
                        <tr key={l.id}>
                          <td className="p-2 text-ink-800">{l.descricao}</td>
                          <td className="p-2 text-right text-ink-500">{l.unidade}</td>
                          <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                          <td className="p-2 text-right text-ink-500">{l.rendimento_horas}</td>
                          <td className="p-2 text-right text-ink-500">{formatMoney(moPorUnidade(l, taxaHoraria))}</td>
                          <td className="p-2 text-right text-ink-500">{formatMoney(l.custo_material)}</td>
                          <td className="p-2 text-right text-ink-500">{formatMoney(precoPorUnidade(l, taxaHoraria))}</td>
                          <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(totalLinha(l, taxaHoraria))}</td>
                          <td className="p-2 text-right">
                            {editavel && (
                              <button onClick={() => removerLinha(l.id)} className="text-ink-300 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-sand-50 font-medium">
                        <td colSpan={7} className="p-2 text-right text-ink-600">Subtotal {cap}</td>
                        <td className="p-2 text-right text-ink-800">{formatMoney(subtotalCap)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {editavel && (
          <form onSubmit={adicionarLinha} className="pt-2 border-t border-sand-100">
            {precario.length > 0 && (
              <div className="mb-2">
                <select onChange={(e) => { carregarDoPrecario(e.target.value); e.target.value = ''; }} defaultValue="" className="input w-full text-ink-500">
                  <option value="" disabled>Carregar do preçário (opcional)...</option>
                  {precario.map((p) => <option key={p.id} value={p.id}>{p.categoria} — {p.descricao}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input type="text" list="capitulos-existentes" placeholder="Capítulo (ex: Demolições)" value={capitulo} onChange={(e) => setCapitulo(e.target.value)} className="input md:col-span-2" />
            <datalist id="capitulos-existentes">
              {capitulosExistentes.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input type="text" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-2" required />
            <input type="text" placeholder="Un (m², ml, un...)" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Qtd" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Rendimento (h/un)" value={rendimentoHoras} onChange={(e) => setRendimentoHoras(e.target.value)} className="input md:col-span-2" />
            <input type="number" step="0.01" placeholder="Custo Material (€/un)" value={custoMaterial} onChange={(e) => setCustoMaterial(e.target.value)} className="input md:col-span-2" />
            <button className="btn-primary justify-center md:col-span-2">
              <Plus size={16} /> Adicionar Linha
            </button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-6">
        <div className="space-y-2 text-sm max-w-sm ml-auto">
          <div className="flex justify-between">
            <span className="text-ink-500">Total dos Trabalhos</span>
            <span className="text-ink-800">{formatMoney(totais.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Imprevistos ({orcamento.margem_percentagem}%)</span>
            <span className="text-ink-800">{formatMoney(totais.imprevistos)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Total sem IVA</span>
            <span className="text-ink-800">{formatMoney(totais.semIva)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">IVA ({orcamento.iva_percentagem}%)</span>
            <span className="text-ink-800">{formatMoney(totais.iva)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Total com IVA</span>
            <span className="text-brand-600">{formatMoney(totais.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
