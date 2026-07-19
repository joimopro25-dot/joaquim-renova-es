'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Trash2, BookMarked } from 'lucide-react';

type Item = {
  id: string;
  categoria: string;
  descricao: string;
  unidade: string;
  rendimento_horas: number;
  custo_material: number;
};

export default function PrecarioPage() {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [categoria, setCategoria] = useState('Geral');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('m²');
  const [rendimentoHoras, setRendimentoHoras] = useState('0');
  const [custoMaterial, setCustoMaterial] = useState('0');

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('tabela_precos').select('*').order('categoria').order('descricao');
    setItens(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const categoriasExistentes = useMemo(() => Array.from(new Set(itens.map((i) => i.categoria))), [itens]);
  const agrupado = useMemo(() => {
    const grupos: Record<string, Item[]> = {};
    for (const i of itens) (grupos[i.categoria] ||= []).push(i);
    return grupos;
  }, [itens]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('tabela_precos').insert([{
      categoria: categoria || 'Geral',
      descricao,
      unidade: unidade || 'un',
      rendimento_horas: parseFloat(rendimentoHoras) || 0,
      custo_material: parseFloat(custoMaterial) || 0,
    }]);
    setDescricao(''); setRendimentoHoras('0'); setCustoMaterial('0');
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover este item do preçário?')) return;
    await supabase.from('tabela_precos').delete().eq('id', id);
    carregar();
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{itens.length} item{itens.length !== 1 ? 's' : ''} de referência — usa-os ao criar linhas num Orçamento</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Item
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Item do Preçário</h2>
          <form onSubmit={adicionar} className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input type="text" list="categorias-existentes" placeholder="Categoria (ex: Pinturas)" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input md:col-span-2" />
            <datalist id="categorias-existentes">
              {categoriasExistentes.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input type="text" placeholder="Descrição (ex: Pintura de parede, 2 demãos)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-3" required />
            <input type="text" placeholder="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Rendimento (h/un)" value={rendimentoHoras} onChange={(e) => setRendimentoHoras(e.target.value)} className="input md:col-span-2" />
            <input type="number" step="0.01" placeholder="Custo Material (€/un)" value={custoMaterial} onChange={(e) => setCustoMaterial(e.target.value)} className="input md:col-span-2" />
            <button className="btn-primary justify-center">Adicionar</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-ink-300 text-sm">A carregar...</div>
      ) : itens.length === 0 ? (
        <div className="card p-10 text-center text-ink-400 text-sm">
          <BookMarked size={28} className="mx-auto mb-2 text-ink-200" />
          Ainda sem itens no preçário.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupado).map(([cat, lista]) => (
            <div key={cat} className="card overflow-hidden">
              <div className="bg-sand-50 px-4 py-2 font-medium text-sm text-ink-700">{cat}</div>
              <table className="w-full text-left text-sm">
                <thead className="text-ink-400 text-xs uppercase">
                  <tr>
                    <th className="p-3 font-medium">Descrição</th>
                    <th className="p-3 font-medium text-right">Un</th>
                    <th className="p-3 font-medium text-right">Rend. h/un</th>
                    <th className="p-3 font-medium text-right">Material €/un</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {lista.map((i) => (
                    <tr key={i.id}>
                      <td className="p-3 text-ink-800">{i.descricao}</td>
                      <td className="p-3 text-right text-ink-500">{i.unidade}</td>
                      <td className="p-3 text-right text-ink-500">{i.rendimento_horas}</td>
                      <td className="p-3 text-right text-ink-500">{formatMoney(i.custo_material)}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => remover(i.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
