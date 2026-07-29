'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, HardHat } from 'lucide-react';

type Cliente = { id: string; nome: string };
type Subempreitada = {
  id: string;
  cliente_id: string;
  descricao: string;
  tipo_valor: string;
  valor_unitario: number;
  estado: string;
  clientes: { nome: string } | null;
  subempreitada_entradas: { quantidade: number }[];
};

const TIPOS = [
  { value: 'fixo', label: 'Valor Fixo' },
  { value: 'hora', label: 'Por Hora' },
  { value: 'dia', label: 'Por Dia' },
];

function calcularTotal(s: Subempreitada) {
  if (s.tipo_valor === 'fixo') return s.valor_unitario;
  const total = s.subempreitada_entradas.reduce((sum, e) => sum + e.quantidade, 0);
  return total * s.valor_unitario;
}

export default function SubempreitadasPage() {
  const [registos, setRegistos] = useState<Subempreitada[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [criandoCliente, setCriandoCliente] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [tipoValor, setTipoValor] = useState('fixo');
  const [valorUnitario, setValorUnitario] = useState('');

  async function carregar() {
    setLoading(true);
    const [{ data: regs }, { data: cls }] = await Promise.all([
      supabase.from('subempreitadas').select('*, clientes(nome), subempreitada_entradas(quantidade)').order('criado_em', { ascending: false }),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);
    setRegistos((regs as any) || []);
    setClientes(cls || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function criarClienteRapido() {
    if (!novoClienteNome.trim()) return;
    setCriandoCliente(true);
    const { data, error } = await supabase.from('clientes').insert([{ nome: novoClienteNome.trim() }]).select().single();
    setCriandoCliente(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setClientes((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setClienteId(data.id);
    setNovoClienteNome('');
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) { alert('Escolhe ou cria o empreiteiro/cliente.'); return; }
    setCreating(true);
    const { data, error } = await supabase.from('subempreitadas').insert([{
      cliente_id: clienteId,
      descricao,
      tipo_valor: tipoValor,
      valor_unitario: parseFloat(valorUnitario) || 0,
      estado: 'pendente',
    }]).select().single();
    setCreating(false);
    if (error) { alert('Erro: ' + error.message); return; }
    window.location.href = `/admin/subempreitadas/${data.id}`;
  }

  const totalRecebido = registos.filter((r) => r.estado === 'pago').reduce((s, r) => s + calcularTotal(r), 0);
  const totalPendente = registos.filter((r) => r.estado === 'pendente').reduce((s, r) => s + calcularTotal(r), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <p className="text-sm text-ink-400">
          Recebido: <span className="text-ink-800 font-medium">{formatMoney(totalRecebido)}</span>
          {totalPendente > 0 && <> · Pendente: <span className="text-amber-600 font-medium">{formatMoney(totalPendente)}</span></>}
        </p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Registo
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Trabalho (Subempreitada)</h2>
          <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3 flex gap-2">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input flex-1">
                <option value="">Selecionar Empreiteiro/Cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input type="text" placeholder="ou criar novo: nome" value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)} className="input flex-1" />
              <button type="button" onClick={criarClienteRapido} disabled={criandoCliente || !novoClienteNome.trim()} className="btn-primary disabled:opacity-40 whitespace-nowrap">
                Criar
              </button>
            </div>
            <input type="text" placeholder="Descrição do trabalho" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-3" required />
            <select value={tipoValor} onChange={(e) => setTipoValor(e.target.value)} className="input">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="number" step="0.01"
              placeholder={tipoValor === 'fixo' ? 'Valor total (€)' : `Valor por ${tipoValor} (€)`}
              value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} className="input md:col-span-2" required
            />
            <button disabled={creating} className="btn-primary justify-center md:col-span-3 disabled:opacity-60">
              <Plus size={16} /> {creating ? 'A criar...' : tipoValor === 'fixo' ? 'Criar' : 'Criar e adicionar horas'}
            </button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">Empreiteiro/Cliente</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : registos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-ink-400 text-sm">
                    <HardHat size={28} className="mx-auto mb-2 text-ink-200" />
                    Ainda sem registos.
                  </td>
                </tr>
              ) : (
                registos.map((r) => (
                  <tr key={r.id} className="hover:bg-sand-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/admin/subempreitadas/${r.id}`}>
                    <td className="p-4 text-ink-800 font-medium">
                      <Link href={`/admin/subempreitadas/${r.id}`} className="hover:text-brand-600">{r.descricao}</Link>
                    </td>
                    <td className="p-4 text-ink-500">{r.clientes?.nome || '—'}</td>
                    <td className="p-4 text-ink-500 text-sm">{TIPOS.find((t) => t.value === r.tipo_valor)?.label}</td>
                    <td className="p-4 text-right text-ink-800 font-medium">{formatMoney(calcularTotal(r))}</td>
                    <td className="p-4">
                      <span className={`badge ${r.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.estado === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
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
