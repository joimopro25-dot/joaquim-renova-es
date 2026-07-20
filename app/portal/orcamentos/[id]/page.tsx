'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { moPorUnidade, precoPorUnidade, totalLinha, calcularTotais } from '../../../../lib/orcamento';
import { ArrowLeft, Check, X } from 'lucide-react';

type Linha = {
  id: string;
  descricao: string;
  capitulo: string;
  unidade: string;
  quantidade: number;
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
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  enviado: { label: 'Aguarda a sua aprovação', color: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido em Obra', color: 'bg-purple-100 text-purple-700' },
};

export default function PortalOrcamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  async function carregar() {
    const [{ data: orc }, { data: linhasData }] = await Promise.all([
      supabase.from('orcamentos').select('*').eq('id', id).single(),
      supabase.from('orcamento_linhas').select('*').eq('orcamento_id', id).order('criado_em'),
    ]);
    setOrcamento(orc as any);
    setLinhas(linhasData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  async function responder(novoEstado: 'aprovado' | 'rejeitado') {
    setProcessando(true);
    const { error } = await supabase.from('orcamentos').update({ status: novoEstado }).eq('id', id);
    setProcessando(false);
    if (error) { alert('Não foi possível registar a sua resposta: ' + error.message); return; }
    carregar();
  }

  const linhasPorCapitulo = useMemo(() => {
    const grupos: Record<string, Linha[]> = {};
    for (const l of linhas) (grupos[l.capitulo] ||= []).push(l);
    return grupos;
  }, [linhas]);

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!orcamento) return <div className="p-8 text-center text-ink-400 text-sm">Não foi possível encontrar este orçamento, ou não tem acesso a ele.</div>;

  const totais = calcularTotais(linhas, orcamento);
  const taxaHoraria = orcamento.taxa_horaria;
  const info = ESTADOS[orcamento.status] || ESTADOS.enviado;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <button onClick={() => router.push('/portal/orcamentos')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar aos Orçamentos
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-ink-800">{orcamento.titulo}</h1>
          {orcamento.descricao && <p className="text-sm text-ink-400 mt-1">{orcamento.descricao}</p>}
        </div>
        <span className={`badge ${info.color}`}>{info.label}</span>
      </div>

      {orcamento.status === 'enviado' && (
        <div className="card p-5 mb-6 flex flex-wrap items-center justify-between gap-3 bg-blue-50 border-blue-100">
          <p className="text-sm text-ink-700">Reveja os detalhes abaixo e indique se aprova este orçamento.</p>
          <div className="flex gap-2">
            <button onClick={() => responder('aprovado')} disabled={processando} className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-60">
              <Check size={16} /> Aprovar
            </button>
            <button onClick={() => responder('rejeitado')} disabled={processando} className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-60">
              <X size={16} /> Rejeitar
            </button>
          </div>
        </div>
      )}

      <div className="card p-6 mb-6 space-y-6">
        {Object.entries(linhasPorCapitulo).map(([cap, itens]) => {
          const subtotalCap = itens.reduce((s, l) => s + totalLinha(l, taxaHoraria), 0);
          return (
            <div key={cap} className="overflow-x-auto">
              <div className="bg-ink-800 text-copper-200 text-sm font-semibold px-3 py-1.5 rounded-t-lg">{cap}</div>
              <table className="w-full text-left text-sm border border-t-0 border-sand-200 rounded-b-lg overflow-hidden">
                <thead className="text-ink-400 text-xs uppercase bg-sand-50">
                  <tr>
                    <th className="p-2 font-medium">Descrição</th>
                    <th className="p-2 font-medium text-right">Un</th>
                    <th className="p-2 font-medium text-right">Qtd</th>
                    <th className="p-2 font-medium text-right">Preço un.</th>
                    <th className="p-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {itens.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2 text-ink-800">{l.descricao}</td>
                      <td className="p-2 text-right text-ink-500">{l.unidade}</td>
                      <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                      <td className="p-2 text-right text-ink-500">{formatMoney(precoPorUnidade(l, taxaHoraria))}</td>
                      <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(totalLinha(l, taxaHoraria))}</td>
                    </tr>
                  ))}
                  <tr className="bg-sand-50 font-medium">
                    <td colSpan={4} className="p-2 text-right text-ink-600">Subtotal {cap}</td>
                    <td className="p-2 text-right text-ink-800">{formatMoney(subtotalCap)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <div className="card p-6">
        <div className="space-y-2 text-sm max-w-sm ml-auto">
          <div className="flex justify-between"><span className="text-ink-500">Total dos Trabalhos</span><span className="text-ink-800">{formatMoney(totais.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">Imprevistos ({orcamento.margem_percentagem}%)</span><span className="text-ink-800">{formatMoney(totais.imprevistos)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">Total sem IVA</span><span className="text-ink-800">{formatMoney(totais.semIva)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">IVA ({orcamento.iva_percentagem}%)</span><span className="text-ink-800">{formatMoney(totais.iva)}</span></div>
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Total com IVA</span>
            <span className="text-brand-600">{formatMoney(totais.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
