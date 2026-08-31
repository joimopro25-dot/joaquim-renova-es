'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { Plus, Stethoscope } from 'lucide-react';

type Cliente = { id: string; nome: string };
type Consultoria = {
  id: string;
  titulo: string;
  criado_em: string;
  clientes: { nome: string } | null;
};

export default function ConsultoriasPage() {
  const [consultorias, setConsultorias] = useState<Consultoria[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [creating, setCreating] = useState(false);

  async function carregar() {
    setLoading(true);
    const [{ data: consData }, { data: clientesData }] = await Promise.all([
      supabase.from('consultorias').select('*, clientes(nome)').order('criado_em', { ascending: false }),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);
    setConsultorias((consData as any) || []);
    setClientes(clientesData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function criarConsultoria(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) { alert('Escolhe um cliente.'); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from('consultorias')
      .insert([{ cliente_id: clienteId, titulo }])
      .select()
      .single();
    setCreating(false);
    if (error) { alert('Erro: ' + error.message); return; }
    window.location.href = `/admin/consultorias/${data.id}`;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{consultorias.length} consultoria{consultorias.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Nova Consultoria
        </button>
      </div>

      <p className="text-sm text-ink-400 mb-6">
        Usa isto para pedires conselho técnico à IA sobre um trabalho antes de fechares o orçamento — descreve o que precisa de ser feito, envia fotos do local, e conversa sobre a melhor forma de o executar. Podes depois criar um orçamento diretamente a partir desta conversa, que continua disponível dentro dele.
      </p>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Nova Consultoria</h2>
          {clientes.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Ainda não tens clientes registados. Vai a "Clientes" e cria um primeiro.
            </p>
          ) : (
            <form onSubmit={criarConsultoria} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input" required>
                <option value="">Selecionar Cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input type="text" placeholder="Título (ex: Reparação de fachada)" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" required />
              <button disabled={creating} className="btn-primary justify-center disabled:opacity-60">
                {creating ? 'A criar...' : 'Criar e conversar'}
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
                <th className="p-4 font-medium">Consultoria</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={3} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : consultorias.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-ink-400 text-sm">
                    <Stethoscope size={28} className="mx-auto mb-2 text-ink-200" />
                    Nenhuma consultoria criada.
                  </td>
                </tr>
              ) : (
                consultorias.map((c) => (
                  <tr key={c.id} className="hover:bg-sand-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/admin/consultorias/${c.id}`}>
                    <td className="p-4 font-medium text-ink-800">
                      <Link href={`/admin/consultorias/${c.id}`} className="hover:text-brand-600">{c.titulo}</Link>
                    </td>
                    <td className="p-4 text-ink-500">{c.clientes?.nome || '—'}</td>
                    <td className="p-4 text-ink-500">{new Date(c.criado_em).toLocaleDateString('pt-PT')}</td>
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
