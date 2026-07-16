'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus } from 'lucide-react';

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
  { value: 'orcamento', label: 'Orçamento', color: 'bg-slate-100 text-slate-700' },
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
      supabase
        .from('obras')
        .select('*, clientes(nome)')
        .order('criado_em', { ascending: false }),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);
    if (!obrasError) setObras((obrasData as any) || []);
    setClientes(clientesData || []);
    setLoading(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function criarObra(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) {
      alert('Escolhe um cliente.');
      return;
    }
    const { error } = await supabase.from('obras').insert([
      {
        cliente_id: clienteId,
        titulo,
        descricao: descricao || null,
        valor_total: valorTotal ? parseFloat(valorTotal) : null,
        status,
      },
    ]);
    if (!error) {
      setClienteId('');
      setTitulo('');
      setDescricao('');
      setValorTotal('');
      setStatus('orcamento');
      setShowForm(false);
      carregarDados();
    } else {
      alert('Erro: ' + error.message);
    }
  }

  function estadoInfo(value: string) {
    return ESTADOS.find((e) => e.value === value) || ESTADOS[0];
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Gestão de Obras</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-medium transition-colors"
        >
          <Plus size={18} /> Nova Obra
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border mb-8">
          <h2 className="font-semibold mb-4 text-gray-700">Nova Obra</h2>
          {clientes.length === 0 ? (
            <p className="text-sm text-amber-600">
              Ainda não tens clientes registados. Vai a "Clientes" e cria um primeiro.
            </p>
          ) : (
            <form onSubmit={criarObra} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecionar Cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Título da Obra (ex: Renovação Cozinha)"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Valor Orçamentado (€)"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Descrição / notas"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
                rows={2}
              />
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors md:col-span-2">
                Criar Obra
              </button>
            </form>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-sm">
            <tr>
              <th className="p-4">OBRA</th>
              <th className="p-4">CLIENTE</th>
              <th className="p-4">ESTADO</th>
              <th className="p-4">VALOR</th>
            </tr>
          </thead>
          <tbody className="divide-y border-t">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400">
                  A carregar...
                </td>
              </tr>
            ) : obras.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                  Nenhuma obra registada.
                </td>
              </tr>
            ) : (
              obras.map((o) => {
                const info = estadoInfo(o.status);
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{o.titulo}</td>
                    <td className="p-4 text-gray-600">{o.clientes?.nome || '—'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>
                        {info.label}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">
                      {o.valor_total ? `${o.valor_total.toFixed(2)} €` : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
