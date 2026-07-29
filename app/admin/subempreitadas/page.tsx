'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, HardHat, Trash2 } from 'lucide-react';

type Cliente = { id: string; nome: string };
type Subempreitada = {
  id: string;
  cliente_id: string;
  descricao: string;
  tipo_valor: string;
  quantidade: number;
  valor_unitario: number;
  data_trabalho: string;
  estado: string;
  clientes: { nome: string } | null;
};

const TIPOS = [
  { value: 'fixo', label: 'Valor Fixo' },
  { value: 'hora', label: 'Por Hora' },
  { value: 'dia', label: 'Por Dia' },
];

function calcularTotal(s: { tipo_valor: string; quantidade: number; valor_unitario: number }) {
  return s.tipo_valor === 'fixo' ? s.valor_unitario : s.quantidade * s.valor_unitario;
}

export default function SubempreitadasPage() {
  const [registos, setRegistos] = useState<Subempreitada[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [criandoCliente, setCriandoCliente] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [tipoValor, setTipoValor] = useState('fixo');
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('');
  const [dataTrabalho, setDataTrabalho] = useState(() => new Date().toISOString().slice(0, 10));
  const [estado, setEstado] = useState('pago');

  async function carregar() {
    setLoading(true);
    const [{ data: regs }, { data: cls }] = await Promise.all([
      supabase.from('subempreitadas').select('*, clientes(nome)').order('data_trabalho', { ascending: false }),
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

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) { alert('Escolhe ou cria o empreiteiro/cliente.'); return; }
    const { error } = await supabase.from('subempreitadas').insert([{
      cliente_id: clienteId,
      descricao,
      tipo_valor: tipoValor,
      quantidade: tipoValor === 'fixo' ? 1 : parseFloat(quantidade) || 1,
      valor_unitario: parseFloat(valorUnitario) || 0,
      data_trabalho: dataTrabalho,
      estado,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setDescricao(''); setQuantidade('1'); setValorUnitario(''); setEstado('pago');
    setDataTrabalho(new Date().toISOString().slice(0, 10));
    setShowForm(false);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover este registo?')) return;
    await supabase.from('subempreitadas').delete().eq('id', id);
    carregar();
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
          <form onSubmit={adicionar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            {tipoValor !== 'fixo' && (
              <input type="number" step="0.5" placeholder={tipoValor === 'hora' ? 'Nº de horas' : 'Nº de dias'} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="input" />
            )}
            <input type="number" step="0.01" placeholder={tipoValor === 'fixo' ? 'Valor total (€)' : `Valor por ${tipoValor} (€)`} value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} className="input" required />
            <input type="date" value={dataTrabalho} onChange={(e) => setDataTrabalho(e.target.value)} className="input" />
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
            {valorUnitario && (
              <p className="text-sm text-ink-500 md:col-span-3">
                Total: <span className="font-medium text-ink-800">{formatMoney(calcularTotal({ tipo_valor: tipoValor, quantidade: parseFloat(quantidade) || 1, valor_unitario: parseFloat(valorUnitario) || 0 }))}</span>
              </p>
            )}
            <button className="btn-primary justify-center md:col-span-3">
              <Plus size={16} /> Adicionar
            </button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">Empreiteiro/Cliente</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : registos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-ink-400 text-sm">
                    <HardHat size={28} className="mx-auto mb-2 text-ink-200" />
                    Ainda sem registos.
                  </td>
                </tr>
              ) : (
                registos.map((r) => (
                  <tr key={r.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 text-ink-500 whitespace-nowrap">{new Date(r.data_trabalho).toLocaleDateString('pt-PT')}</td>
                    <td className="p-4 text-ink-800 font-medium">{r.descricao}</td>
                    <td className="p-4 text-ink-500">{r.clientes?.nome || '—'}</td>
                    <td className="p-4 text-ink-500 text-sm">
                      {TIPOS.find((t) => t.value === r.tipo_valor)?.label}
                      {r.tipo_valor !== 'fixo' && ` (${r.quantidade}× ${formatMoney(r.valor_unitario)})`}
                    </td>
                    <td className="p-4 text-right text-ink-800 font-medium">{formatMoney(calcularTotal(r))}</td>
                    <td className="p-4">
                      <span className={`badge ${r.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.estado === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => remover(r.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
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
