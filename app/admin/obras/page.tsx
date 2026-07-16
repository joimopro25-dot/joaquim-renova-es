'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Briefcase } from 'lucide-react';

type Cliente = { id: string; nome: string };
type Obra = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  valor_total: number | null;
  progresso_percentagem: number;
  cliente_id: string;
  clientes: { nome: string } | null;
};

const ESTADOS = [
  { value: 'orcamento', label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  { value: 'em_curso', label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  { value: 'pausada', label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  { value: 'concluida', label: 'Concluída', color: 'bg-green-100 text-green-700' },
];

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [status, setStatus] = useState('orcamento');

  async function carregarDados() {
    setLoading(true);
    const [{ data: obrasData, error: obrasError }, { data: clientesData }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome)').order('criado_em', { ascending: false }),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);
    if (!obrasError) setObras((obrasData as any) || []);
    setClientes(clientesData || []);
    setLoading(false);
  }

  useEffect(() => { carregarDados(); }, []);

  async function criarObra(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) { alert('Escolhe um cliente.'); return; }
    const { error } = await supabase.from('obras').insert([{
      cliente_id: clienteId,
      titulo,
      descricao: descricao || null,
      valor_total: valorTotal ? parseFloat(valorTotal) : null,
      status,
    }]);
    if (!error) {
      setClienteId(''); setTitulo(''); setDescricao(''); setValorTotal(''); setStatus('orcamento');
      setShowForm(false);
      carregarDados();
    } else alert('Erro: ' + error.message);
  }

  function estadoInfo(value: string) {
    return ESTADOS.find((e) => e.value === value) || ESTADOS[0];
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{obras.length} obra{obras.length !== 1 ? 's' : ''} registada{obras.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Nova Obra
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Nova Obra</h2>
          {clientes.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Ainda não tens clientes registados. Vai a "Clientes" e cria um primeiro.
            </p>
          ) : (
            <form onSubmit={criarObra} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input" required>
                <option value="">Selecionar Cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input type="text" placeholder="Título da Obra (ex: Renovação Cozinha)" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" required />
              <input type="number" step="0.01" placeholder="Valor Orçamentado (€)" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className="input" />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <textarea placeholder="Descrição / notas" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-2" rows={2} />
              <button className="btn-primary justify-center md:col-span-2">Criar Obra</button>
            </form>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Obra</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : obras.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-ink-400 text-sm">
                    <Briefcase size={28} className="mx-auto mb-2 text-ink-200" />
                    Nenhuma obra registada.
                  </td>
                </tr>
              ) : (
                obras.map((o) => {
                  const info = estadoInfo(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-sand-50 transition-colors">
                      <td className="p-4 font-medium text-ink-800">{o.titulo}</td>
                      <td className="p-4 text-ink-500">{o.clientes?.nome || '—'}</td>
                      <td className="p-4"><span className={`badge ${info.color}`}>{info.label}</span></td>
                      <td className="p-4 text-ink-500">{o.valor_total ? formatMoney(o.valor_total) : '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
