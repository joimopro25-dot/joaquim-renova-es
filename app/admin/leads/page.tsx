'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Inbox, UserPlus, Trash2 } from 'lucide-react';

type Lead = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo_obra: string | null;
  mensagem: string | null;
  estado: string;
  criado_em: string;
};

const ESTADOS = [
  { value: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { value: 'contactado', label: 'Contactado', color: 'bg-amber-100 text-amber-700' },
  { value: 'convertido', label: 'Convertido', color: 'bg-green-100 text-green-700' },
  { value: 'descartado', label: 'Descartado', color: 'bg-sand-100 text-ink-500' },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('criado_em', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function mudarEstado(id: string, estado: string) {
    await supabase.from('leads').update({ estado }).eq('id', id);
    carregar();
  }

  async function converterEmCliente(lead: Lead) {
    const { error } = await supabase.from('clientes').insert([{ nome: lead.nome, email: lead.email, telefone: lead.telefone }]);
    if (error) { alert('Erro: ' + error.message); return; }
    await supabase.from('leads').update({ estado: 'convertido' }).eq('id', lead.id);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover este lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    carregar();
  }

  return (
    <div className="p-4 md:p-8">
      <p className="text-sm text-ink-400 mb-6">{leads.length} pedido{leads.length !== 1 ? 's' : ''} de contacto vindo{leads.length !== 1 ? 's' : ''} do website</p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Contacto</th>
                <th className="p-4 font-medium">Tipo de Obra</th>
                <th className="p-4 font-medium">Mensagem</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-ink-400 text-sm">
                    <Inbox size={28} className="mx-auto mb-2 text-ink-200" />
                    Ainda sem pedidos de contacto.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="hover:bg-sand-50 transition-colors align-top">
                    <td className="p-4 font-medium text-ink-800 whitespace-nowrap">{l.nome}</td>
                    <td className="p-4 text-ink-500 whitespace-nowrap">
                      <div>{l.email || '—'}</div>
                      <div className="text-xs text-ink-400">{l.telefone || ''}</div>
                    </td>
                    <td className="p-4 text-ink-500">{l.tipo_obra || '—'}</td>
                    <td className="p-4 text-ink-500 max-w-xs">{l.mensagem || '—'}</td>
                    <td className="p-4">
                      <select
                        value={l.estado}
                        onChange={(e) => mudarEstado(l.id, e.target.value)}
                        className={`badge border-0 outline-none cursor-pointer ${ESTADOS.find((e) => e.value === l.estado)?.color}`}
                      >
                        {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {l.estado !== 'convertido' && (
                        <button onClick={() => converterEmCliente(l)} className="text-brand-600 hover:text-brand-700 mr-3" title="Converter em Cliente">
                          <UserPlus size={16} className="inline" />
                        </button>
                      )}
                      <button onClick={() => remover(l.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} className="inline" /></button>
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
