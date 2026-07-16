'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Users } from 'lucide-react';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nif, setNif] = useState('');

  async function carregarClientes() {
    setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').order('criado_em', { ascending: false });
    if (!error) setClientes(data || []);
    setLoading(false);
  }

  useEffect(() => { carregarClientes(); }, []);

  async function adicionarCliente(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('clientes').insert([{ nome, email: email || null, nif: nif || null }]);
    if (!error) {
      setNome(''); setEmail(''); setNif('');
      setShowForm(false);
      carregarClientes();
    } else alert('Erro: ' + error.message);
  }

  const filtrados = clientes.filter((c) =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" size={16} />
          <input
            type="text"
            placeholder="Pesquisar clientes..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Cliente</h2>
          <form onSubmit={adicionarCliente} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <input type="text" placeholder="NIF" value={nif} onChange={(e) => setNif(e.target.value)} className="input" />
            <button className="btn-primary justify-center">
              <Plus size={18} /> Adicionar
            </button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">NIF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={3} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-ink-400 text-sm">
                    <Users size={28} className="mx-auto mb-2 text-ink-200" />
                    {clientes.length === 0 ? 'Nenhum cliente registado ainda.' : 'Nenhum resultado para essa pesquisa.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 font-medium text-ink-800">{c.nome}</td>
                    <td className="p-4 text-ink-500">{c.email || '—'}</td>
                    <td className="p-4 font-mono text-ink-500 text-sm">{c.nif || '—'}</td>
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
