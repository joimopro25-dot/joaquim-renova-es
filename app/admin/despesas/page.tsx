'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Receipt, Paperclip, Trash2 } from 'lucide-react';

type Obra = { id: string; titulo: string };
type Despesa = {
  id: string;
  obra_id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_despesa: string;
  fornecedor: string | null;
  comprovativo_url: string | null;
  obras: { titulo: string } | null;
};

const CATEGORIAS = [
  { value: 'material', label: 'Material' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'subcontratacao', label: 'Subcontratação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'outro', label: 'Outro' },
];

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [obraId, setObraId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('material');
  const [valor, setValor] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(() => new Date().toISOString().slice(0, 10));
  const [ficheiro, setFicheiro] = useState<File | null>(null);

  async function carregar() {
    setLoading(true);
    const [{ data: despesasData }, { data: obrasData }] = await Promise.all([
      supabase.from('despesas').select('*, obras(titulo)').order('data_despesa', { ascending: false }),
      supabase.from('obras').select('id, titulo').order('titulo'),
    ]);
    setDespesas((despesasData as any) || []);
    setObras(obrasData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionarDespesa(e: React.FormEvent) {
    e.preventDefault();
    if (!obraId) { alert('Escolhe uma obra.'); return; }
    setUploading(true);

    let comprovativoUrl: string | null = null;
    if (ficheiro) {
      const path = `${obraId}/${Date.now()}-${ficheiro.name}`;
      const { error: uploadError } = await supabase.storage.from('comprovativos').upload(path, ficheiro);
      if (uploadError) {
        alert('Erro ao enviar o comprovativo: ' + uploadError.message);
        setUploading(false);
        return;
      }
      comprovativoUrl = supabase.storage.from('comprovativos').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from('despesas').insert([{
      obra_id: obraId,
      descricao,
      categoria,
      valor: parseFloat(valor) || 0,
      fornecedor: fornecedor || null,
      data_despesa: dataDespesa,
      comprovativo_url: comprovativoUrl,
    }]);
    setUploading(false);
    if (error) { alert('Erro: ' + error.message); return; }

    setObraId(''); setDescricao(''); setCategoria('material'); setValor(''); setFornecedor('');
    setDataDespesa(new Date().toISOString().slice(0, 10)); setFicheiro(null);
    setShowForm(false);
    carregar();
  }

  async function removerDespesa(id: string) {
    if (!confirm('Remover esta despesa?')) return;
    await supabase.from('despesas').delete().eq('id', id);
    carregar();
  }

  const totalGeral = despesas.reduce((s, d) => s + d.valor, 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">
          {despesas.length} despesa{despesas.length !== 1 ? 's' : ''} · Total: {formatMoney(totalGeral)}
        </p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Nova Despesa
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Nova Despesa</h2>
          {obras.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Ainda não tens obras registadas. Vai a "Obras" e cria uma primeiro.
            </p>
          ) : (
            <form onSubmit={adicionarDespesa} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="input" required>
                <option value="">Selecionar Obra</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
              <input type="text" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" required />
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Valor (€)" value={valor} onChange={(e) => setValor(e.target.value)} className="input" required />
              <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="input" />
              <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className="input" />
              <label className="input flex items-center gap-2 cursor-pointer md:col-span-3 text-ink-500">
                <Paperclip size={16} className="shrink-0" />
                {ficheiro ? ficheiro.name : 'Anexar foto/PDF da fatura (opcional)'}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFicheiro(e.target.files?.[0] || null)} />
              </label>
              <button disabled={uploading} className="btn-primary justify-center md:col-span-3 disabled:opacity-60">
                {uploading ? 'A guardar...' : 'Adicionar Despesa'}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">Obra</th>
                <th className="p-4 font-medium">Categoria</th>
                <th className="p-4 font-medium">Fornecedor</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : despesas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-ink-400 text-sm">
                    <Receipt size={28} className="mx-auto mb-2 text-ink-200" />
                    Nenhuma despesa registada.
                  </td>
                </tr>
              ) : (
                despesas.map((d) => (
                  <tr key={d.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 text-ink-500 whitespace-nowrap">{new Date(d.data_despesa).toLocaleDateString('pt-PT')}</td>
                    <td className="p-4 text-ink-800 font-medium">
                      {d.comprovativo_url ? (
                        <a href={d.comprovativo_url} target="_blank" rel="noreferrer" className="hover:text-brand-600 flex items-center gap-1.5">
                          <Paperclip size={13} className="text-ink-300" /> {d.descricao}
                        </a>
                      ) : d.descricao}
                    </td>
                    <td className="p-4 text-ink-500">{d.obras?.titulo || '—'}</td>
                    <td className="p-4"><span className="badge bg-sand-100 text-ink-600">{CATEGORIAS.find((c) => c.value === d.categoria)?.label || d.categoria}</span></td>
                    <td className="p-4 text-ink-500">{d.fornecedor || '—'}</td>
                    <td className="p-4 text-right text-ink-800 font-medium">{formatMoney(d.valor)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => removerDespesa(d.id)} className="text-ink-300 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
