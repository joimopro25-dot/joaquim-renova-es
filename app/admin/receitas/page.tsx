'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, TrendingUp, Paperclip, Trash2, Pencil, Filter, CheckCircle2, Clock } from 'lucide-react';

type Obra = { id: string; titulo: string };
type AreaNegocio = { id: string; nome: string };
type Receita = {
  id: string;
  obra_id: string | null;
  area_negocio_id: string | null;
  descricao: string;
  categoria: string;
  valor: number;
  data_receita: string;
  cliente_nome: string | null;
  estado_recebimento: string;
  data_recebimento: string | null;
  comprovativo_url: string | null;
  obras: { titulo: string } | null;
  areas_negocio: { nome: string } | null;
};

const OPCAO_GERAL = 'geral';

const CATEGORIAS = [
  { value: 'obra', label: 'Pagamento de Obra' },
  { value: 'servico', label: 'Prestação de Serviço' },
  { value: 'outro', label: 'Outro' },
];

const PERIODOS = [
  { value: 'mes', label: 'Este Mês' },
  { value: 'mes_passado', label: 'Mês Passado' },
  { value: 'ano', label: 'Este Ano' },
  { value: 'tudo', label: 'Tudo' },
];

function calcularPeriodo(periodo: string) {
  const hoje = new Date();
  const y = hoje.getFullYear(), m = hoje.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (periodo === 'mes') return { inicio: toISO(new Date(y, m, 1)), fim: toISO(new Date(y, m + 1, 0)) };
  if (periodo === 'mes_passado') return { inicio: toISO(new Date(y, m - 1, 1)), fim: toISO(new Date(y, m, 0)) };
  if (periodo === 'ano') return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
  return { inicio: null, fim: null };
}

function parseDestino(destino: string): { obra_id: string | null } {
  if (destino === OPCAO_GERAL || !destino || destino.startsWith('area:')) return { obra_id: null };
  if (destino.startsWith('obra:')) return { obra_id: destino.split(':')[1] };
  return { obra_id: null };
}

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [areasNegocio, setAreasNegocio] = useState<AreaNegocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [destino, setDestino] = useState('');
  const [areaNegocioId, setAreaNegocioId] = useState('');
  const [novaAreaNegocioNome, setNovaAreaNegocioNome] = useState('');
  const [aCriarAreaNegocio, setACriarAreaNegocio] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('obra');
  const [valor, setValor] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [dataReceita, setDataReceita] = useState(() => new Date().toISOString().slice(0, 10));
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [estadoRecebimento, setEstadoRecebimento] = useState('recebido');
  const [dataRecebimento, setDataRecebimento] = useState(() => new Date().toISOString().slice(0, 10));

  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [filtroEstado, setFiltroEstado] = useState('');

  async function carregar() {
    setLoading(true);
    let query = supabase.from('receitas').select('*, obras(titulo), areas_negocio(nome)').order('data_receita', { ascending: false });
    const { inicio, fim } = calcularPeriodo(filtroPeriodo);
    if (inicio) query = query.gte('data_receita', inicio);
    if (fim) query = query.lte('data_receita', fim);
    if (filtroEstado) query = query.eq('estado_recebimento', filtroEstado);

    const [{ data: receitasData }, { data: obrasData }, { data: areasData }] = await Promise.all([
      query,
      supabase.from('obras').select('id, titulo').order('titulo'),
      supabase.from('areas_negocio').select('id, nome').order('nome'),
    ]);
    setReceitas((receitasData as any) || []);
    setObras(obrasData || []);
    setAreasNegocio(areasData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [filtroPeriodo, filtroEstado]);

  async function criarAreaNegocioRapido() {
    if (!novaAreaNegocioNome.trim()) return;
    setACriarAreaNegocio(true);
    const { data, error } = await supabase.from('areas_negocio').insert([{ nome: novaAreaNegocioNome.trim() }]).select().single();
    setACriarAreaNegocio(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setAreasNegocio((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setAreaNegocioId(data.id);
    setNovaAreaNegocioNome('');
  }

  function resetForm() {
    setDestino(''); setAreaNegocioId(''); setNovaAreaNegocioNome(''); setDescricao(''); setCategoria('obra');
    setValor(''); setClienteNome(''); setDataReceita(new Date().toISOString().slice(0, 10)); setFicheiro(null);
    setEstadoRecebimento('recebido'); setDataRecebimento(new Date().toISOString().slice(0, 10));
    setEditandoId(null); setShowForm(false);
  }

  function abrirEditar(r: Receita) {
    setEditandoId(r.id);
    setDestino(r.obra_id ? `obra:${r.obra_id}` : r.area_negocio_id ? `area:${r.area_negocio_id}` : OPCAO_GERAL);
    setAreaNegocioId(r.area_negocio_id || '');
    setDescricao(r.descricao);
    setCategoria(r.categoria);
    setValor(String(r.valor));
    setClienteNome(r.cliente_nome || '');
    setDataReceita(r.data_receita);
    setFicheiro(null);
    setEstadoRecebimento(r.estado_recebimento);
    setDataRecebimento(r.data_recebimento || new Date().toISOString().slice(0, 10));
    setShowForm(true);
  }

  async function enviarComprovativo(): Promise<string | null> {
    if (!ficheiro) return null;
    const path = `receitas/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('comprovativos').upload(path, ficheiro);
    if (uploadError) throw new Error(uploadError.message);
    return supabase.storage.from('comprovativos').getPublicUrl(path).data.publicUrl;
  }

  async function guardarReceita(e: React.FormEvent) {
    e.preventDefault();
    if (!destino) { alert('Escolhe uma obra, área de negócio ou "Geral".'); return; }
    setUploading(true);
    try {
      const payload: Record<string, any> = {
        ...parseDestino(destino),
        area_negocio_id: destino.startsWith('area:') ? destino.split(':')[1] : (destino === OPCAO_GERAL ? (areaNegocioId || null) : null),
        descricao,
        categoria,
        valor: parseFloat(valor) || 0,
        cliente_nome: clienteNome || null,
        data_receita: dataReceita,
        estado_recebimento: estadoRecebimento,
        data_recebimento: estadoRecebimento === 'recebido' ? dataRecebimento : null,
      };
      if (ficheiro) payload.comprovativo_url = await enviarComprovativo();

      if (editandoId) {
        const { error } = await supabase.from('receitas').update(payload).eq('id', editandoId);
        if (error) { alert('Erro: ' + error.message); setUploading(false); return; }
      } else {
        const { error } = await supabase.from('receitas').insert([payload]);
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

  async function removerReceita(id: string) {
    if (!confirm('Remover esta receita?')) return;
    await supabase.from('receitas').delete().eq('id', id);
    carregar();
  }

  async function alternarRecebimento(r: Receita) {
    const novoEstado = r.estado_recebimento === 'recebido' ? 'pendente' : 'recebido';
    await supabase.from('receitas').update({
      estado_recebimento: novoEstado,
      data_recebimento: novoEstado === 'recebido' ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', r.id);
    carregar();
  }

  function destinoLabel(r: Receita) {
    if (r.obra_id) return r.obras?.titulo || '—';
    if (r.area_negocio_id) return r.areas_negocio?.nome || '—';
    return 'Geral';
  }

  const totalGeral = receitas.reduce((s, r) => s + r.valor, 0);
  const totalPorReceber = receitas.filter((r) => r.estado_recebimento === 'pendente').reduce((s, r) => s + r.valor, 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">
          {receitas.length} receita{receitas.length !== 1 ? 's' : ''} · Total: {formatMoney(totalGeral)}
          {totalPorReceber > 0 && <span className="text-amber-600"> · Por receber: {formatMoney(totalPorReceber)}</span>}
        </p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Nova Receita
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-ink-700 mb-4">{editandoId ? 'Editar Receita' : 'Nova Receita'}</h2>
          <form onSubmit={guardarReceita} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" placeholder="Descrição (ex: 1ª prestação, pagamento final)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" required />
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="text" placeholder="Nome do cliente (opcional)" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} className="input" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={destino} onChange={(e) => setDestino(e.target.value)} className="input md:col-span-2" required>
                <option value="">Selecionar origem</option>
                <option value={OPCAO_GERAL}>— Geral (sem obra) —</option>
                {obras.length > 0 && (
                  <optgroup label="Obras">
                    {obras.map((o) => <option key={o.id} value={`obra:${o.id}`}>{o.titulo}</option>)}
                  </optgroup>
                )}
                {areasNegocio.length > 0 && (
                  <optgroup label="Áreas de Negócio">
                    {areasNegocio.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.nome}</option>)}
                  </optgroup>
                )}
              </select>
              <input type="number" step="0.01" placeholder="Valor (€)" value={valor} onChange={(e) => setValor(e.target.value)} className="input" required />

              {destino === OPCAO_GERAL && (
                <div className="md:col-span-3 flex items-center gap-2">
                  <select value={areaNegocioId} onChange={(e) => setAreaNegocioId(e.target.value)} className="input flex-1">
                    <option value="">Sem área de negócio definida</option>
                    {areasNegocio.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                  <input type="text" placeholder="Ou cria uma nova área (ex: Imobiliário)" value={novaAreaNegocioNome} onChange={(e) => setNovaAreaNegocioNome(e.target.value)} className="input flex-1 text-sm" />
                  <button type="button" onClick={criarAreaNegocioRapido} disabled={!novaAreaNegocioNome.trim() || aCriarAreaNegocio} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 text-sm py-1.5 disabled:opacity-50 shrink-0">
                    {aCriarAreaNegocio ? 'A criar...' : '+ Área'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-sand-100">
              <div>
                <label className="block text-sm text-ink-600 mb-1">Data</label>
                <input type="date" value={dataReceita} onChange={(e) => setDataReceita(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-ink-600 mb-1">Já foi recebido?</label>
                <div className="flex gap-2">
                  <select value={estadoRecebimento} onChange={(e) => setEstadoRecebimento(e.target.value)} className="input flex-1">
                    <option value="recebido">Recebido</option>
                    <option value="pendente">Por receber</option>
                  </select>
                  {estadoRecebimento === 'recebido' && (
                    <input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} className="input w-40" />
                  )}
                </div>
              </div>
              <label className="input flex items-center gap-2 cursor-pointer text-ink-500">
                <Paperclip size={16} className="shrink-0" />
                {ficheiro ? ficheiro.name : 'Anexar fatura/recibo (opcional)'}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFicheiro(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="flex gap-2">
              {editandoId && (
                <button type="button" onClick={resetForm} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              )}
              <button disabled={uploading} className="btn-primary justify-center flex-1 disabled:opacity-60">
                {uploading ? 'A guardar...' : editandoId ? 'Guardar Alterações' : 'Adicionar Receita'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-1.5 text-sm text-ink-500 mb-3">
          <Filter size={14} /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="input">
            {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input">
            <option value="">Recebidas e Por Receber</option>
            <option value="recebido">Só Recebidas</option>
            <option value="pendente">Só Por Receber</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">Origem</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : receitas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-ink-400 text-sm">
                    <TrendingUp size={28} className="mx-auto mb-2 text-ink-200" />
                    Nenhuma receita encontrada com estes filtros.
                  </td>
                </tr>
              ) : (
                receitas.map((r) => (
                  <tr key={r.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 text-ink-500 whitespace-nowrap">{new Date(r.data_receita).toLocaleDateString('pt-PT')}</td>
                    <td className="p-4 text-ink-800 font-medium">
                      {r.comprovativo_url ? (
                        <a href={r.comprovativo_url} target="_blank" rel="noreferrer" className="hover:text-brand-600 flex items-center gap-1.5">
                          <Paperclip size={13} className="text-ink-300" /> {r.descricao}
                        </a>
                      ) : r.descricao}
                    </td>
                    <td className="p-4 text-ink-500">{destinoLabel(r)}</td>
                    <td className="p-4 text-ink-500">{r.cliente_nome || '—'}</td>
                    <td className="p-4">
                      <button
                        onClick={() => alternarRecebimento(r)}
                        className={`badge flex items-center gap-1 w-fit ${r.estado_recebimento === 'recebido' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                        title="Clicar para alternar"
                      >
                        {r.estado_recebimento === 'recebido' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {r.estado_recebimento === 'recebido' ? 'Recebida' : 'Por Receber'}
                      </button>
                    </td>
                    <td className="p-4 text-right text-ink-800 font-medium">{formatMoney(r.valor)}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(r)} className="text-ink-300 hover:text-brand-600 mr-2" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => removerReceita(r.id)} className="text-ink-300 hover:text-red-600">
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
