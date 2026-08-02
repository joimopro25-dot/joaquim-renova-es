'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Truck } from 'lucide-react';

type Fornecedor = {
  id: string;
  nome: string;
  nif: string | null;
  morada: string | null;
  email: string | null;
  telefone: string | null;
  notas: string | null;
};

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');

  const [nome, setNome] = useState('');
  const [nif, setNif] = useState('');
  const [morada, setMorada] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [notas, setNotas] = useState('');

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').order('nome');
    setFornecedores(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionarFornecedor(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('fornecedores').insert([{
      nome, nif: nif || null, morada: morada || null, email: email || null, telefone: telefone || null, notas: notas || null,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setNome(''); setNif(''); setMorada(''); setEmail(''); setTelefone(''); setNotas('');
    setShowForm(false);
    carregar();
  }

  async function removerFornecedor(id: string) {
    if (!confirm('Remover este fornecedor? As despesas já associadas mantêm-se, só deixam de estar ligadas a ele.')) return;
    await supabase.from('fornecedores').delete().eq('id', id);
    carregar();
  }

  const filtrados = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) || f.nif?.includes(busca)
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" size={16} />
          <input type="text" placeholder="Pesquisar fornecedores..." value={busca} onChange={(e) => setBusca(e.target.value)} className="input pl-9 w-full" />
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Fornecedor
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Fornecedor</h2>
          <form onSubmit={adicionarFornecedor} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
            <input type="text" placeholder="NIF" value={nif} onChange={(e) => setNif(e.target.value)} className="input" />
            <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <input type="text" placeholder="Morada" value={morada} onChange={(e) => setMorada(e.target.value)} className="input md:col-span-2" />
            <input type="text" placeholder="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} className="input md:col-span-3" />
            <button className="btn-primary justify-center md:col-span-3">
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
                <th className="p-4 font-medium">NIF</th>
                <th className="p-4 font-medium">Telefone</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-ink-400 text-sm">
                    <Truck size={28} className="mx-auto mb-2 text-ink-200" />
                    {fornecedores.length === 0 ? 'Nenhum fornecedor registado ainda.' : 'Nenhum resultado para essa pesquisa.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((f) => (
                  <tr key={f.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 font-medium text-ink-800">{f.nome}</td>
                    <td className="p-4 font-mono text-ink-500 text-sm">{f.nif || '—'}</td>
                    <td className="p-4 text-ink-500">{f.telefone || '—'}</td>
                    <td className="p-4 text-ink-500">{f.email || '—'}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => removerFornecedor(f.id)} className="text-sm text-ink-300 hover:text-red-600">Remover</button>
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
