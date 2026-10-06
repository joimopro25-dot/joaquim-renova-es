'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Upload, Trash2, Paperclip, Send, FileSpreadsheet } from 'lucide-react';

type Extrato = { id: string; mes: string; nome_ficheiro: string; ficheiro_url: string };

function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function labelMes(chave: string) {
  const [y, m] = chave.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function ContabilidadePage() {
  const [mes, setMes] = useState(mesAtual());
  const [extratos, setExtratos] = useState<Extrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [aEnviarFicheiro, setAEnviarFicheiro] = useState(false);
  const [resumo, setResumo] = useState<{ totalDespesas: number; totalReceitas: number; numDespesas: number; numReceitas: number } | null>(null);
  const [aEnviarEmail, setAEnviarEmail] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function carregar() {
    setLoading(true);
    const inicio = `${mes}-01`;
    const [ano, mesNum] = mes.split('-').map(Number);
    const ultimoDia = new Date(ano, mesNum, 0).getDate();
    const fim = `${ano}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const [{ data: extratosData }, { data: despesasData }, { data: receitasData }] = await Promise.all([
      supabase.from('extratos_bancarios').select('*').eq('mes', inicio).order('criado_em', { ascending: false }),
      supabase.from('despesas').select('valor').gte('data_despesa', inicio).lte('data_despesa', fim),
      supabase.from('receitas').select('valor').gte('data_receita', inicio).lte('data_receita', fim),
    ]);
    setExtratos(extratosData || []);
    setResumo({
      totalDespesas: (despesasData || []).reduce((s, d) => s + d.valor, 0),
      totalReceitas: (receitasData || []).reduce((s, r) => s + r.valor, 0),
      numDespesas: (despesasData || []).length,
      numReceitas: (receitasData || []).length,
    });
    setLoading(false);
  }

  useEffect(() => { carregar(); setEnviado(false); }, [mes]);

  async function enviarExtrato(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setAEnviarFicheiro(true);
    const inicio = `${mes}-01`;
    const path = `extratos/${mes}/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('comprovativos').upload(path, ficheiro);
    if (uploadError) { alert('Erro ao enviar: ' + uploadError.message); setAEnviarFicheiro(false); return; }
    const url = supabase.storage.from('comprovativos').getPublicUrl(path).data.publicUrl;
    await supabase.from('extratos_bancarios').insert([{ mes: inicio, nome_ficheiro: ficheiro.name, ficheiro_url: url }]);
    setAEnviarFicheiro(false);
    e.target.value = '';
    carregar();
  }

  async function removerExtrato(id: string) {
    if (!confirm('Remover este extrato?')) return;
    await supabase.from('extratos_bancarios').delete().eq('id', id);
    carregar();
  }

  async function enviarAoContabilista() {
    if (!confirm(`Enviar o resumo de ${labelMes(mes)} (despesas, receitas e extratos anexados) para a contabilista?`)) return;
    setAEnviarEmail(true);
    const { data: sessao } = await supabase.auth.getSession();
    const resp = await fetch('/api/contabilidade/enviar-mensal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessao.session?.access_token}` },
      body: JSON.stringify({ mes }),
    });
    const json = await resp.json();
    setAEnviarEmail(false);
    if (!resp.ok) { alert('Erro ao enviar: ' + json.error); return; }
    setEnviado(true);
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm text-ink-600">Mês:</label>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="input w-48" />
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-ink-700 mb-4">Resumo de {labelMes(mes)}</h2>
        {loading || !resumo ? (
          <p className="text-sm text-ink-300">A carregar...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div className="p-3 bg-sand-50 rounded-lg">
              <p className="text-ink-400 text-xs uppercase">Despesas</p>
              <p className="text-lg font-semibold text-ink-800">{formatMoney(resumo.totalDespesas)}</p>
              <p className="text-ink-400 text-xs">{resumo.numDespesas} registo{resumo.numDespesas !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 bg-sand-50 rounded-lg">
              <p className="text-ink-400 text-xs uppercase">Receitas</p>
              <p className="text-lg font-semibold text-ink-800">{formatMoney(resumo.totalReceitas)}</p>
              <p className="text-ink-400 text-xs">{resumo.numReceitas} registo{resumo.numReceitas !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
        <button onClick={enviarAoContabilista} disabled={aEnviarEmail} className="btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
          <Send size={16} /> {aEnviarEmail ? 'A enviar...' : enviado ? 'Enviado — reenviar?' : 'Enviar ao Contabilista'}
        </button>
        {enviado && <p className="text-xs text-green-600 mt-2">Email enviado com sucesso para a contabilista (com cópia para ti).</p>}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-ink-700 mb-1">Extratos Bancários de {labelMes(mes)}</h2>
        <p className="text-xs text-ink-400 mb-4">Carrega aqui o(s) extrato(s) do banco deste mês — são anexados automaticamente ao email enviado à contabilista.</p>

        <label className="btn-primary bg-purple-600 hover:bg-purple-700 inline-flex cursor-pointer mb-4">
          <Upload size={16} /> {aEnviarFicheiro ? 'A enviar...' : 'Carregar Extrato'}
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={enviarExtrato} disabled={aEnviarFicheiro} />
        </label>

        {extratos.length === 0 ? (
          <p className="text-sm text-ink-400">Ainda sem extratos carregados para este mês.</p>
        ) : (
          <ul className="space-y-2">
            {extratos.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between p-3 bg-sand-50 rounded-lg text-sm">
                <a href={ex.ficheiro_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
                  <Paperclip size={14} /> {ex.nome_ficheiro}
                </a>
                <button onClick={() => removerExtrato(ex.id)} className="text-ink-300 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-400 mt-4 flex items-center gap-1.5">
        <FileSpreadsheet size={14} /> O email inclui um CSV de despesas e um CSV de receitas do mês, além dos extratos acima.
      </p>
    </div>
  );
}
