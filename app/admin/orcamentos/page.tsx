'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, FileText } from 'lucide-react';

type Cliente = { id: string; nome: string };
type Orcamento = {
  id: string;
  titulo: string;
  status: string;
  clientes: { nome: string } | null;
  orcamento_linhas: { quantidade: number; preco_unitario: number }[];
  margem_percentagem: number;
  iva_percentagem: number;
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-sand-100 text-ink-600' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido em Obra', color: 'bg-purple-100 text-purple-700' },
};

function calcularTotal(o: Orcamento) {
  const subtotal = o.orcamento_linhas.reduce((s, l) => s + l.quantidade * l.preco_unitario, 0);
  const comMargem = subtotal * (1 + (o.margem_percentagem || 0) / 100);
  const comIva = comMargem * (1 + (o.iva_percentagem || 0) / 100);
  return comIva;
}

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [creating, setCreating] = useState(false);

  async function carregar() {
    setLoading(true);
    const [{ data: orcData }, { data: clientesData }] = await Promise.all([
      supabase
        .from('orcamentos')
        .select('*, clientes(nome), orcamento_linhas(quantidade, preco_unitario)')
        .order('criado_em', { ascending: false }),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);
    setOrcamentos((orcData as any) || []);
    setClientes(clientesData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function criarOrcamento(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) { alert('Escolhe um cliente.'); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from('orcamentos')
      .insert([{ cliente_id: clienteId, titulo, status: 'rascunho' }])
      .select()
      .single();
    setCreating(false);
    if (error) { alert('Erro: ' + error.message); return; }
    window.location.href = `/admin/orcamentos/${data.id}`;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Orçamento
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Orçamento</h2>
          {clientes.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Ainda não tens clientes registados. Vai a "Clientes" e cria um primeiro.
            </p>
          ) : (
            <form onSubmit={criarOrcamento} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input" required>
                <option value="">Selecionar Cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input type="text" placeholder="Título (ex: Renovação Casa de Banho)" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" required />
              <button disabled={creating} className="btn-primary justify-center disabled:opacity-60">
                {creating ? 'A criar...' : 'Criar e adicionar linhas'}
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
                <th className="p-4 font-medium">Orçamento</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : orcamentos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-ink-400 text-sm">
                    <FileText size={28} className="mx-auto mb-2 text-ink-200" />
                    Nenhum orçamento criado.
                  </td>
                </tr>
              ) : (
                orcamentos.map((o) => {
                  const info = ESTADOS[o.status] || ESTADOS.rascunho;
                  return (
                    <tr key={o.id} className="hover:bg-sand-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/admin/orcamentos/${o.id}`}>
                      <td className="p-4 font-medium text-ink-800">
                        <Link href={`/admin/orcamentos/${o.id}`} className="hover:text-brand-600">{o.titulo}</Link>
                      </td>
                      <td className="p-4 text-ink-500">{o.clientes?.nome || '—'}</td>
                      <td className="p-4"><span className={`badge ${info.color}`}>{info.label}</span></td>
                      <td className="p-4 text-ink-500">{formatMoney(calcularTotal(o))}</td>
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
