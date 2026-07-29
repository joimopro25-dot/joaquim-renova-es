'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Receipt, Paperclip, Trash2, Camera, Rows3, X } from 'lucide-react';
import ScanFatura from './ScanFatura';

type Obra = { id: string; titulo: string };
type Despesa = {
  id: string;
  obra_id: string | null;
  descricao: string;
  categoria: string;
  valor: number;
  data_despesa: string;
  fornecedor: string | null;
  comprovativo_url: string | null;
  obras: { titulo: string } | null;
};

type LinhaSplit = { obraId: string; valor: string };

const CATEGORIAS = [
  { value: 'material', label: 'Material' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'subcontratacao', label: 'Subcontratação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'ordenado', label: 'Ordenado/Pagamento' },
  { value: 'outro', label: 'Outro' },
];

const OPCAO_GERAL = 'geral';

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dividir, setDividir] = useState(false);

  const [obraId, setObraId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('material');
  const [valor, setValor] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(() => new Date().toISOString().slice(0, 10));
  const [ficheiro, setFicheiro] = useState<File | null>(null);

  const [linhas, setLinhas] = useState<LinhaSplit[]>([{ obraId: '', valor: '' }, { obraId: OPCAO_GERAL, valor: '' }]);

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

  function resetForm() {
    setObraId(''); setDescricao(''); setCategoria('material'); setValor(''); setFornecedor('');
    setDataDespesa(new Date().toISOString().slice(0, 10)); setFicheiro(null);
    setLinhas([{ obraId: '', valor: '' }, { obraId: OPCAO_GERAL, valor: '' }]);
    setDividir(false);
    setShowForm(false);
  }

  function atualizarLinha(idx: number, campo: keyof LinhaSplit, val: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: val } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, { obraId: '', valor: '' }]);
  }

  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviarComprovativo(pasta: string): Promise<string | null> {
    if (!ficheiro) return null;
    const path = `${pasta}/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('comprovativos').upload(path, ficheiro);
    if (uploadError) throw new Error(uploadError.message);
    return supabase.storage.from('comprovativos').getPublicUrl(path).data.publicUrl;
  }

  async function adicionarDespesa(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);

    try {
      if (dividir) {
        const validas = linhas.filter((l) => l.obraId && parseFloat(l.valor) > 0);
        if (validas.length === 0) { alert('Adiciona pelo menos uma linha com obra e valor.'); setUploading(false); return; }

        const comprovativoUrl = await enviarComprovativo('geral');

        const { error } = await supabase.from('despesas').insert(
          validas.map((l) => ({
            obra_id: l.obraId === OPCAO_GERAL ? null : l.obraId,
            descricao,
            categoria,
            valor: parseFloat(l.valor) || 0,
            fornecedor: fornecedor || null,
            data_despesa: dataDespesa,
            comprovativo_url: comprovativoUrl,
          }))
        );
        if (error) { alert('Erro: ' + error.message); setUploading(false); return; }
      } else {
        if (!obraId) { alert('Escolhe uma obra ou "Despesa Geral".'); setUploading(false); return; }
        const comprovativoUrl = await enviarComprovativo(obraId === OPCAO_GERAL ? 'geral' : obraId);

        const { error } = await supabase.from('despesas').insert([{
          obra_id: obraId === OPCAO_GERAL ? null : obraId,
          descricao,
          categoria,
          valor: parseFloat(valor) || 0,
          fornecedor: fornecedor || null,
          data_despesa: dataDespesa,
          comprovativo_url: comprovativoUrl,
        }]);
        if (error) { alert('Erro: ' + error.message); setUploading(false); return; }
      }
    } catch (err: any) {
      alert('Erro ao enviar o comprovativo: ' + err.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    resetForm();
    carregar();
  }

  async function removerDespesa(id: string) {
    if (!confirm('Remover esta despesa?')) return;
    await supabase.from('despesas').delete().eq('id', id);
    carregar();
  }

  const totalGeral = despesas.reduce((s, d) => s + d.valor, 0);
  const somaLinhas = linhas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">
          {despesas.length} despesa{despesas.length !== 1 ? 's' : ''} · Total: {formatMoney(totalGeral)}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowScan(true)} className="btn-primary bg-purple-600 hover:bg-purple-700">
            <Camera size={18} /> Digitalizar Fatura
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            <Plus size={18} /> Nova Despesa
          </button>
        </div>
      </div>

      {showScan && (
        <ScanFatura
          obras={obras}
          onClose={() => setShowScan(false)}
          onSaved={() => { setShowScan(false); carregar(); }}
        />
      )}

      {showForm && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-700">Nova Despesa</h2>
            <button
              type="button"
              onClick={() => setDividir((v) => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${dividir ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-sand-200 text-ink-500 hover:bg-sand-50'}`}
            >
              <Rows3 size={15} /> Dividir por várias obras
            </button>
          </div>

          <form onSubmit={adicionarDespesa} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" placeholder="Descrição (ex: Fatura Leroy Merlin)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" required />
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="input" />
              <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className="input" />
              <label className="input flex items-center gap-2 cursor-pointer md:col-span-2 text-ink-500">
                <Paperclip size={16} className="shrink-0" />
                {ficheiro ? ficheiro.name : 'Anexar foto/PDF da fatura (opcional)'}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFicheiro(e.target.files?.[0] || null)} />
              </label>
            </div>

            {dividir ? (
              <div className="space-y-2 pt-2 border-t border-sand-100">
                <p className="text-xs text-ink-400">Divide o valor total desta fatura/pagamento por várias obras (ou "Stock/Geral" para material sem obra associada).</p>
                {linhas.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={l.obraId} onChange={(e) => atualizarLinha(idx, 'obraId', e.target.value)} className="input flex-1">
                      <option value="">Selecionar Obra</option>
                      <option value={OPCAO_GERAL}>— Stock / Despesa Geral (sem obra) —</option>
                      {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                    </select>
                    <input type="number" step="0.01" placeholder="Valor (€)" value={l.valor} onChange={(e) => atualizarLinha(idx, 'valor', e.target.value)} className="input w-32" />
                    <button type="button" onClick={() => removerLinha(idx)} className="text-ink-300 hover:text-red-600 shrink-0"><X size={16} /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={adicionarLinha} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
                    <Plus size={14} /> Adicionar linha
                  </button>
                  <span className="text-sm text-ink-500">Soma: {formatMoney(somaLinhas)}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-sand-100">
                <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="input" required>
                  <option value="">Selecionar Obra</option>
                  <option value={OPCAO_GERAL}>— Despesa Geral (sem obra, ex: ordenado) —</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                </select>
                <input type="number" step="0.01" placeholder="Valor (€)" value={valor} onChange={(e) => setValor(e.target.value)} className="input md:col-span-2" required />
              </div>
            )}

            <button disabled={uploading} className="btn-primary justify-center w-full disabled:opacity-60">
              {uploading ? 'A guardar...' : 'Adicionar Despesa'}
            </button>
          </form>
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
                    <td className="p-4 text-ink-500">{d.obra_id ? (d.obras?.titulo || '—') : 'Geral'}</td>
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
