'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { Plus, Trash2, ArrowLeft, Send, Check, X, ArrowRightCircle } from 'lucide-react';

type Linha = {
  id: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  preco_unitario: number;
};

type Orcamento = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  margem_percentagem: number;
  iva_percentagem: number;
  cliente_id: string;
  clientes: { nome: string } | null;
};

const CATEGORIAS = [
  { value: 'mao_obra', label: 'Mão de obra' },
  { value: 'materiais', label: 'Materiais' },
  { value: 'deslocacao', label: 'Deslocação' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'subempreitada', label: 'Subempreitada' },
  { value: 'outro', label: 'Outro' },
];

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
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('materiais');
  const [quantidade, setQuantidade] = useState('1');
  const [precoUnitario, setPrecoUnitario] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: orc }, { data: linhasData }] = await Promise.all([
      supabase.from('orcamentos').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('orcamento_linhas').select('*').eq('orcamento_id', id).order('criado_em'),
    ]);
    setOrcamento(orc as any);
    setLinhas(linhasData || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarLinha(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('orcamento_linhas').insert([{
      orcamento_id: id,
      descricao,
      categoria,
      quantidade: parseFloat(quantidade) || 1,
      preco_unitario: parseFloat(precoUnitario) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setDescricao(''); setQuantidade('1'); setPrecoUnitario('');
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

  async function atualizarPercentagens(campo: 'margem_percentagem' | 'iva_percentagem', valor: number) {
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
      valor_total: totalFinal,
      status: 'orcamento',
      orcamento_id: orcamento.id,
    }]);
    if (obraError) { alert('Erro ao criar obra: ' + obraError.message); setConverting(false); return; }
    await supabase.from('orcamentos').update({ status: 'convertido' }).eq('id', id);
    setConverting(false);
    router.push('/admin/obras');
  }

  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.preco_unitario, 0);
  const comMargem = orcamento ? subtotal * (1 + (orcamento.margem_percentagem || 0) / 100) : subtotal;
  const totalFinal = orcamento ? comMargem * (1 + (orcamento.iva_percentagem || 0) / 100) : comMargem;

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!orcamento) return <div className="p-8 text-center text-ink-400 text-sm">Orçamento não encontrado.</div>;

  const info = ESTADOS[orcamento.status] || ESTADOS.rascunho;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
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
              <Send size={16} /> Marcar como Enviado
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
        <h3 className="font-semibold text-ink-700 mb-4">Linhas de Custo</h3>

        {linhas.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="pb-2 font-medium">Descrição</th>
                  <th className="pb-2 font-medium">Categoria</th>
                  <th className="pb-2 font-medium text-right">Qtd</th>
                  <th className="pb-2 font-medium text-right">Preço Unit.</th>
                  <th className="pb-2 font-medium text-right">Subtotal</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 text-ink-800">{l.descricao}</td>
                    <td className="py-2 text-ink-500">{CATEGORIAS.find((c) => c.value === l.categoria)?.label || l.categoria}</td>
                    <td className="py-2 text-right text-ink-500">{l.quantidade}</td>
                    <td className="py-2 text-right text-ink-500">{formatMoney(l.preco_unitario)}</td>
                    <td className="py-2 text-right text-ink-800 font-medium">{formatMoney(l.quantidade * l.preco_unitario)}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => removerLinha(l.id)} className="text-ink-300 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {orcamento.status === 'rascunho' && (
          <form onSubmit={adicionarLinha} className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input type="text" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-2" required />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="number" step="0.01" placeholder="Qtd" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Preço unit. (€)" value={precoUnitario} onChange={(e) => setPrecoUnitario(e.target.value)} className="input" required />
            <button className="btn-primary justify-center md:col-span-5">
              <Plus size={16} /> Adicionar Linha
            </button>
          </form>
        )}
      </div>

      <div className="card p-6">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Subtotal</span>
            <span className="text-ink-800">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">Margem (%)</span>
            {orcamento.status === 'rascunho' ? (
              <input
                type="number"
                step="0.1"
                defaultValue={orcamento.margem_percentagem}
                onBlur={(e) => atualizarPercentagens('margem_percentagem', parseFloat(e.target.value) || 0)}
                className="input w-24 text-right py-1"
              />
            ) : (
              <span className="text-ink-800">{orcamento.margem_percentagem}%</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">IVA (%)</span>
            {orcamento.status === 'rascunho' ? (
              <input
                type="number"
                step="0.1"
                defaultValue={orcamento.iva_percentagem}
                onBlur={(e) => atualizarPercentagens('iva_percentagem', parseFloat(e.target.value) || 0)}
                className="input w-24 text-right py-1"
              />
            ) : (
              <span className="text-ink-800">{orcamento.iva_percentagem}%</span>
            )}
          </div>
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Total</span>
            <span className="text-brand-600">{formatMoney(totalFinal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
