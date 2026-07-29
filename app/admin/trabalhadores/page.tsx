'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Users, Trash2 } from 'lucide-react';

type Trabalhador = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  nif: string | null;
  regime: string;
  tipo_valor_padrao: string;
  valor_padrao: number;
  ativo: boolean;
};

const REGIMES = [
  { value: 'recibo_verde', label: 'Recibo Verde' },
  { value: 'efetivo', label: 'Efetivo' },
];
const TIPOS = [
  { value: 'hora', label: 'Por Hora' },
  { value: 'dia', label: 'Por Dia' },
  { value: 'fixo', label: 'Valor Fixo' },
];

export default function TrabalhadoresPage() {
  const [lista, setLista] = useState<Trabalhador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [nif, setNif] = useState('');
  const [regime, setRegime] = useState('recibo_verde');
  const [tipoValorPadrao, setTipoValorPadrao] = useState('dia');
  const [valorPadrao, setValorPadrao] = useState('');

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('trabalhadores').select('*').order('nome');
    setLista(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('trabalhadores').insert([{
      nome, telefone: telefone || null, email: email || null, nif: nif || null,
      regime, tipo_valor_padrao: tipoValorPadrao, valor_padrao: parseFloat(valorPadrao) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setNome(''); setTelefone(''); setEmail(''); setNif(''); setRegime('recibo_verde'); setTipoValorPadrao('dia'); setValorPadrao('');
    setShowForm(false);
    carregar();
  }

  async function toggleAtivo(t: Trabalhador) {
    await supabase.from('trabalhadores').update({ ativo: !t.ativo }).eq('id', t.id);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover este trabalhador?')) return;
    await supabase.from('trabalhadores').delete().eq('id', id);
    carregar();
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{lista.length} trabalhador{lista.length !== 1 ? 'es' : ''}</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Trabalhador
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Trabalhador</h2>
          <form onSubmit={adicionar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
            <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <input type="text" placeholder="NIF" value={nif} onChange={(e) => setNif(e.target.value)} className="input" />
            <select value={regime} onChange={(e) => setRegime(e.target.value)} className="input">
              {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <div />
            <select value={tipoValorPadrao} onChange={(e) => setTipoValorPadrao(e.target.value)} className="input">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="number" step="0.01" placeholder="Valor padrão (€)" value={valorPadrao} onChange={(e) => setValorPadrao(e.target.value)} className="input md:col-span-2" />
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
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Contacto</th>
                <th className="p-4 font-medium">Regime</th>
                <th className="p-4 font-medium text-right">Valor Padrão</th>
                <th className="p-4 font-medium"></th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-ink-400 text-sm">
                    <Users size={28} className="mx-auto mb-2 text-ink-200" />
                    Ainda sem trabalhadores registados.
                  </td>
                </tr>
              ) : (
                lista.map((t) => (
                  <tr key={t.id} className={`hover:bg-sand-50 transition-colors ${!t.ativo ? 'opacity-50' : ''}`}>
                    <td className="p-4 font-medium text-ink-800">{t.nome}</td>
                    <td className="p-4 text-ink-500 text-sm">{t.telefone || t.email || '—'}</td>
                    <td className="p-4">
                      <span className={`badge ${t.regime === 'efetivo' ? 'bg-blue-100 text-blue-700' : 'bg-sand-100 text-ink-600'}`}>
                        {REGIMES.find((r) => r.value === t.regime)?.label}
                      </span>
                    </td>
                    <td className="p-4 text-right text-ink-500">
                      {formatMoney(t.valor_padrao)}{t.tipo_valor_padrao !== 'fixo' ? `/${t.tipo_valor_padrao === 'hora' ? 'h' : 'dia'}` : ''}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => toggleAtivo(t)} className="text-xs text-ink-400 hover:text-ink-700 underline">
                        {t.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => remover(t.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
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
