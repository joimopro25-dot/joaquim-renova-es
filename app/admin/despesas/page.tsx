'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Receipt, Paperclip, Trash2, Camera, Rows3, X, Copy, Pencil } from 'lucide-react';
import ScanFatura from './ScanFatura';

type Obra = { id: string; titulo: string };
type Subempreitada = { id: string; descricao: string };
type Despesa = {
  id: string;
  obra_id: string | null;
  subempreitada_id: string | null;
  tipo_imputacao: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_despesa: string;
  fornecedor: string | null;
  comprovativo_url: string | null;
  obras: { titulo: string } | null;
  subempreitadas: { descricao: string } | null;
};

type LinhaSplit = { destino: string; valor: string };

const TIPOS_IMPUTACAO = [
  { value: 'custo', label: 'Custo da empresa (desconta a margem)' },
  { value: 'cliente', label: 'A cobrar ao cliente (soma ao valor total, não desconta)' },
  { value: 'registo', label: 'Só registo (não afeta nenhum cálculo)' },
];

const CATEGORIAS = [
  { value: 'material', label: 'Material' },
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'portagens', label: 'Portagens' },
  { value: 'deslocacao', label: 'Deslocação' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'subcontratacao', label: 'Subcontratação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'ordenado', label: 'Ordenado/Pagamento' },
  { value: 'outro', label: 'Outro' },
];

const OPCAO_GERAL = 'geral';

function parseDestino(destino: string): { obra_id: string | null; subempreitada_id: string | null } {
  if (destino === OPCAO_GERAL || !destino) return { obra_id: null, subempreitada_id: null };
  const [tipo, valorId] = destino.split(':');
  if (tipo === 'obra') return { obra_id: valorId, subempreitada_id: null };
  if (tipo === 'sub') return { obra_id: null, subempreitada_id: valorId };
  return { obra_id: null, subempreitada_id: null };
}

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [subs, setSubs] = useState<Subempreitada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dividir, setDividir] = useState(false);

  const [destino, setDestino] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('material');
  const [valor, setValor] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(() => new Date().toISOString().slice(0, 10));
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [tipoImputacao, setTipoImputacao] = useState('custo');

  const [linhas, setLinhas] = useState<LinhaSplit[]>([{ destino: '', valor: '' }, { destino: OPCAO_GERAL, valor: '' }]);

  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [duplicando, setDuplicando] = useState<Despesa | null>(null);
  const [dataDuplicar, setDataDuplicar] = useState(() => new Date().toISOString().slice(0, 10));
  const [aDuplicar, setADuplicar] = useState(false);

  async function carregar() {
    setLoading(true);
    const [{ data: despesasData }, { data: obrasData }, { data: subsData }] = await Promise.all([
      supabase.from('despesas').select('*, obras(titulo), subempreitadas(descricao)').order('data_despesa', { ascending: false }),
      supabase.from('obras').select('id, titulo').order('titulo'),
      supabase.from('subempreitadas').select('id, descricao').order('descricao'),
    ]);
    setDespesas((despesasData as any) || []);
    setObras(obrasData || []);
    setSubs(subsData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function resetForm() {
    setDestino(''); setDescricao(''); setCategoria('material'); setValor(''); setFornecedor('');
    setDataDespesa(new Date().toISOString().slice(0, 10)); setFicheiro(null); setTipoImputacao('custo');
    setLinhas([{ destino: '', valor: '' }, { destino: OPCAO_GERAL, valor: '' }]);
    setDividir(false);
    setEditandoId(null);
    setShowForm(false);
  }

  function abrirEditar(d: Despesa) {
    setEditandoId(d.id);
    setDestino(d.subempreitada_id ? `sub:${d.subempreitada_id}` : d.obra_id ? `obra:${d.obra_id}` : OPCAO_GERAL);
    setDescricao(d.descricao);
    setCategoria(d.categoria);
    setValor(String(d.valor));
    setFornecedor(d.fornecedor || '');
    setDataDespesa(d.data_despesa);
    setFicheiro(null);
    setTipoImputacao(d.tipo_imputacao);
    setDividir(false);
    setShowForm(true);
  }

  function atualizarLinha(idx: number, campo: keyof LinhaSplit, val: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: val } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, { destino: '', valor: '' }]);
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
      if (editandoId) {
        if (!destino) { alert('Escolhe uma obra, subempreitada ou "Despesa Geral".'); setUploading(false); return; }
        const update: Record<string, any> = {
          ...parseDestino(destino),
          descricao,
          categoria,
          valor: parseFloat(valor) || 0,
          fornecedor: fornecedor || null,
          data_despesa: dataDespesa,
          tipo_imputacao: tipoImputacao,
        };
        if (ficheiro) {
          update.comprovativo_url = await enviarComprovativo(destino === OPCAO_GERAL ? 'geral' : destino.split(':')[1]);
        }
        const { error } = await supabase.from('despesas').update(update).eq('id', editandoId);
        if (error) { alert('Erro: ' + error.message); setUploading(false); return; }
      } else if (dividir) {
        const validas = linhas.filter((l) => l.destino && parseFloat(l.valor) > 0);
        if (validas.length === 0) { alert('Adiciona pelo menos uma linha com destino e valor.'); setUploading(false); return; }

        const comprovativoUrl = await enviarComprovativo('geral');

        const { error } = await supabase.from('despesas').insert(
          validas.map((l) => ({
            ...parseDestino(l.destino),
            descricao,
            categoria,
            valor: parseFloat(l.valor) || 0,
            fornecedor: fornecedor || null,
            data_despesa: dataDespesa,
            comprovativo_url: comprovativoUrl,
            tipo_imputacao: tipoImputacao,
          }))
        );
        if (error) { alert('Erro: ' + error.message); setUploading(false); return; }
      } else {
        if (!destino) { alert('Escolhe uma obra, subempreitada ou "Despesa Geral".'); setUploading(false); return; }
        const comprovativoUrl = await enviarComprovativo(destino === OPCAO_GERAL ? 'geral' : destino.split(':')[1]);

        const { error } = await supabase.from('despesas').insert([{
          ...parseDestino(destino),
          descricao,
          categoria,
          valor: parseFloat(valor) || 0,
          fornecedor: fornecedor || null,
          data_despesa: dataDespesa,
          comprovativo_url: comprovativoUrl,
          tipo_imputacao: tipoImputacao,
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

  function abrirDuplicar(d: Despesa) {
    setDuplicando(d);
    setDataDuplicar(new Date().toISOString().slice(0, 10));
  }

  async function confirmarDuplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicando) return;
    setADuplicar(true);
    const { error } = await supabase.from('despesas').insert([{
      obra_id: duplicando.obra_id,
      subempreitada_id: duplicando.subempreitada_id,
      descricao: duplicando.descricao,
      categoria: duplicando.categoria,
      valor: duplicando.valor,
      fornecedor: duplicando.fornecedor,
      data_despesa: dataDuplicar,
      comprovativo_url: null,
      tipo_imputacao: duplicando.tipo_imputacao,
    }]);
    setADuplicar(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setDuplicando(null);
    carregar();
  }

  const totalGeral = despesas.reduce((s, d) => s + d.valor, 0);
  const somaLinhas = linhas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);

  function destinoLabel(d: Despesa) {
    if (d.subempreitada_id) return d.subempreitadas?.descricao || '—';
    if (d.obra_id) return d.obras?.titulo || '—';
    return 'Geral';
  }

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
            <h2 className="font-semibold text-ink-700">{editandoId ? 'Editar Despesa' : 'Nova Despesa'}</h2>
            {!editandoId && (
              <button
                type="button"
                onClick={() => setDividir((v) => !v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${dividir ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-sand-200 text-ink-500 hover:bg-sand-50'}`}
              >
                <Rows3 size={15} /> Dividir por várias obras
              </button>
            )}
          </div>

          <form onSubmit={adicionarDespesa} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" placeholder="Descrição (ex: Fatura Leroy Merlin, Portagens A1)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" required />
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="input" />
              <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className="input" />
              <label className="input flex items-center gap-2 cursor-pointer md:col-span-2 text-ink-500">
                <Paperclip size={16} className="shrink-0" />
                {ficheiro
                  ? ficheiro.name
                  : editandoId && despesas.find((d) => d.id === editandoId)?.comprovativo_url
                    ? 'Já tem comprovativo — escolhe um ficheiro para substituir (opcional)'
                    : 'Anexar foto/PDF do comprovativo (opcional)'}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFicheiro(e.target.files?.[0] || null)} />
              </label>
            </div>

            {dividir ? (
              <div className="space-y-2 pt-2 border-t border-sand-100">
                <p className="text-xs text-ink-400">Divide o valor total desta fatura/pagamento por várias obras, subempreitadas e/ou "Stock/Geral".</p>
                {linhas.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={l.destino} onChange={(e) => atualizarLinha(idx, 'destino', e.target.value)} className="input flex-1">
                      <option value="">Selecionar destino</option>
                      <option value={OPCAO_GERAL}>— Stock / Despesa Geral (sem obra) —</option>
                      {obras.length > 0 && (
                        <optgroup label="Obras">
                          {obras.map((o) => <option key={o.id} value={`obra:${o.id}`}>{o.titulo}</option>)}
                        </optgroup>
                      )}
                      {subs.length > 0 && (
                        <optgroup label="Subempreitadas">
                          {subs.map((s) => <option key={s.id} value={`sub:${s.id}`}>{s.descricao}</option>)}
                        </optgroup>
                      )}
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
                <select value={destino} onChange={(e) => setDestino(e.target.value)} className="input md:col-span-2" required>
                  <option value="">Selecionar destino</option>
                  <option value={OPCAO_GERAL}>— Despesa Geral (sem obra, ex: ordenado) —</option>
                  {obras.length > 0 && (
                    <optgroup label="Obras">
                      {obras.map((o) => <option key={o.id} value={`obra:${o.id}`}>{o.titulo}</option>)}
                    </optgroup>
                  )}
                  {subs.length > 0 && (
                    <optgroup label="Subempreitadas">
                      {subs.map((s) => <option key={s.id} value={`sub:${s.id}`}>{s.descricao}</option>)}
                    </optgroup>
                  )}
                </select>
                <input type="number" step="0.01" placeholder="Valor (€)" value={valor} onChange={(e) => setValor(e.target.value)} className="input" required />
              </div>
            )}

            <div className="pt-1">
              <label className="block text-sm text-ink-600 mb-1">Quem paga esta despesa?</label>
              <select value={tipoImputacao} onChange={(e) => setTipoImputacao(e.target.value)} className="input w-full">
                {TIPOS_IMPUTACAO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              {editandoId && (
                <button type="button" onClick={resetForm} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              )}
              <button disabled={uploading} className="btn-primary justify-center flex-1 disabled:opacity-60">
                {uploading ? 'A guardar...' : editandoId ? 'Guardar Alterações' : 'Adicionar Despesa'}
              </button>
            </div>
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
                <th className="p-4 font-medium">Obra/Subempreitada</th>
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
                      {d.tipo_imputacao === 'cliente' && <span className="badge bg-blue-100 text-blue-700 ml-2 text-[10px]">a cobrar ao cliente</span>}
                      {d.tipo_imputacao === 'registo' && <span className="badge bg-sand-100 text-ink-400 ml-2 text-[10px]">só registo</span>}
                    </td>
                    <td className="p-4 text-ink-500">{destinoLabel(d)}</td>
                    <td className="p-4"><span className="badge bg-sand-100 text-ink-600">{CATEGORIAS.find((c) => c.value === d.categoria)?.label || d.categoria}</span></td>
                    <td className="p-4 text-ink-500">{d.fornecedor || '—'}</td>
                    <td className="p-4 text-right text-ink-800 font-medium">{formatMoney(d.valor)}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(d)} className="text-ink-300 hover:text-brand-600 mr-2" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => abrirDuplicar(d)} className="text-ink-300 hover:text-brand-600 mr-2" title="Duplicar (ex: mesma viagem noutro dia)">
                        <Copy size={15} />
                      </button>
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

      {duplicando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={confirmarDuplicar} className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-ink-800 mb-1">Duplicar Despesa</h3>
            <p className="text-sm text-ink-400 mb-4">
              "{duplicando.descricao}" · {formatMoney(duplicando.valor)} · {destinoLabel(duplicando)}
            </p>
            <label className="block text-sm text-ink-600 mb-1">Data da nova despesa</label>
            <input type="date" value={dataDuplicar} onChange={(e) => setDataDuplicar(e.target.value)} className="input w-full mb-4" required />
            <div className="flex gap-2">
              <button type="button" onClick={() => setDuplicando(null)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              <button disabled={aDuplicar} className="btn-primary flex-1 justify-center disabled:opacity-60">{aDuplicar ? 'A duplicar...' : 'Duplicar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
