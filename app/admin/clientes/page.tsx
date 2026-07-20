'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search, Users, Mail, Loader2 } from 'lucide-react';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nif, setNif] = useState('');
  const [morada, setMorada] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [convidando, setConvidando] = useState<string | null>(null);

  async function carregarClientes() {
    setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').order('criado_em', { ascending: false });
    if (!error) setClientes(data || []);
    setLoading(false);
  }

  useEffect(() => { carregarClientes(); }, []);

  async function adicionarCliente(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('clientes').insert([{
      nome,
      email: email || null,
      telefone: telefone || null,
      nif: nif || null,
      morada: morada || null,
      data_nascimento: dataNascimento || null,
    }]);
    if (!error) {
      setNome(''); setEmail(''); setTelefone(''); setNif(''); setMorada(''); setDataNascimento('');
      setShowForm(false);
      carregarClientes();
    } else alert('Erro: ' + error.message);
  }

  async function enviarAcesso(cliente: any) {
    if (!cliente.email) { alert('Este cliente não tem email registado.'); return; }
    if (!confirm(`Enviar convite de acesso ao portal para ${cliente.email}?`)) return;
    setConvidando(cliente.id);
    const { data: sessao } = await supabase.auth.getSession();
    const resp = await fetch('/api/convidar-cliente', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessao.session?.access_token}` },
      body: JSON.stringify({ clienteId: cliente.id, email: cliente.email }),
    });
    const json = await resp.json();
    setConvidando(null);
    if (!resp.ok) { alert('Erro ao enviar convite: ' + json.error); return; }
    alert('Convite enviado com sucesso!');
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
          <form onSubmit={adicionarCliente} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input" />
            <input type="text" placeholder="NIF" value={nif} onChange={(e) => setNif(e.target.value)} className="input" />
            <input type="text" placeholder="Morada" value={morada} onChange={(e) => setMorada(e.target.value)} className="input md:col-span-2" />
            <div>
              <label className="text-xs text-ink-400 uppercase tracking-wide">Data de nascimento</label>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="input w-full mt-1" />
            </div>
            <button className="btn-primary justify-center md:col-span-2 self-end">
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
                <th className="p-4 font-medium">Telefone</th>
                <th className="p-4 font-medium">NIF</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-ink-400 text-sm">
                    <Users size={28} className="mx-auto mb-2 text-ink-200" />
                    {clientes.length === 0 ? 'Nenhum cliente registado ainda.' : 'Nenhum resultado para essa pesquisa.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 font-medium text-ink-800">{c.nome}</td>
                    <td className="p-4 text-ink-500">{c.email || '—'}</td>
                    <td className="p-4 text-ink-500">{c.telefone || '—'}</td>
                    <td className="p-4 font-mono text-ink-500 text-sm">{c.nif || '—'}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => enviarAcesso(c)}
                        disabled={convidando === c.id || !c.email}
                        className="text-brand-600 hover:text-brand-700 text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                        title={c.email ? 'Enviar acesso ao portal por email' : 'Sem email registado'}
                      >
                        {convidando === c.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        Enviar Acesso
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
