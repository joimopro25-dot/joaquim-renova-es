'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Search } from 'lucide-react';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    const { error } = await supabase.from('clientes').insert([{ nome, email, nif }]);
    if (!error) {
      setNome(''); setEmail(''); setNif('');
      carregarClientes();
    } else alert('Erro: ' + error.message);
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Gestão de Clientes</h1>
      </div>

      <div className="bg-white p-6 rounded-xl border mb-8">
        <h2 className="font-semibold mb-4 text-gray-700">Novo Cliente</h2>
        <form onSubmit={adicionarCliente} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="text" placeholder="Nome" value={nome} onChange={(e)=>setNome(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="NIF" value={nif} onChange={(e)=>setNif(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 font-medium transition-colors">
            <Plus size={18} /> Adicionar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-sm">
            <tr>
              <th className="p-4">NOME</th>
              <th className="p-4">EMAIL</th>
              <th className="p-4">NIF</th>
            </tr>
          </thead>
          <tbody className="divide-y border-t">
            {loading ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-400 font-sans">A carregar...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-400 font-sans">Nenhum cliente registado.</td></tr>
            ) : (
              clientes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{c.nome}</td>
                  <td className="p-4 text-gray-600">{c.email}</td>
                  <td className="p-4 font-mono text-gray-600">{c.nif}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}