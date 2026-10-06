'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Upload, Trash2, Paperclip, Send, FileSpreadsheet, Check } from 'lucide-react';

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

function trimestreDoMes(mesNum: number) {
  return Math.ceil(mesNum / 3);
}

function intervaloTrimestre(ano: number, trimestre: number) {
  const primeiroMes = (trimestre - 1) * 3 + 1;
  const ultimoMes = primeiroMes + 2;
  const inicio = `${ano}-${String(primeiroMes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, ultimoMes, 0).getDate();
  const fim = `${ano}-${String(ultimoMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { inicio, fim };
}

function arredondarEixo(valor: number) {
  if (valor <= 0) return 100;
  const grandeza = Math.pow(10, Math.floor(Math.log10(valor)));
  const normalizado = valor / grandeza;
  let passo: number;
  if (normalizado <= 1) passo = 1;
  else if (normalizado <= 2) passo = 2;
  else if (normalizado <= 5) passo = 5;
  else passo = 10;
  return passo * grandeza;
}

const COR_DESPESAS = '#b06d3e';
const COR_RECEITAS = '#2563eb';

type DadosTrimestre = { trimestre: number; despesas: number; receitas: number };

function GraficoTrimestres({ dados, ano }: { dados: DadosTrimestre[]; ano: number }) {
  const [hover, setHover] = useState<{ xPct: number; yPct: number; label: string; valor: number; cor: string } | null>(null);

  const W = 560;
  const H = 220;
  const margemEsq = 48;
  const margemBaixo = 28;
  const margemCima = 12;
  const plotW = W - margemEsq - 16;
  const plotH = H - margemBaixo - margemCima;

  const maiorValor = Math.max(1, ...dados.flatMap((d) => [d.despesas, d.receitas]));
  const eixoMax = arredondarEixo(maiorValor * 1.1);
  const passosEixo = 4;

  const grupoW = plotW / 4;
  const barraW = 22;
  const gap = 2;

  function y(valor: number) {
    return margemCima + plotH - (valor / eixoMax) * plotH;
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-2 text-xs">
        <span className="flex items-center gap-1.5 text-ink-600"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_DESPESAS }} /> Despesas</span>
        <span className="flex items-center gap-1.5 text-ink-600"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_RECEITAS }} /> Receitas</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Despesas e receitas por trimestre de ${ano}`}>
        {Array.from({ length: passosEixo + 1 }).map((_, i) => {
          const valor = (eixoMax / passosEixo) * i;
          const yPos = y(valor);
          return (
            <g key={i}>
              <line x1={margemEsq} x2={W - 16} y1={yPos} y2={yPos} stroke="#e8e8ea" strokeWidth={1} />
              <text x={margemEsq - 8} y={yPos + 3} textAnchor="end" fontSize={10} fill="#a2a4a9">
                {valor >= 1000 ? `${(valor / 1000).toFixed(valor % 1000 === 0 ? 0 : 1)}k` : Math.round(valor)}
              </text>
            </g>
          );
        })}

        {dados.map((d, i) => {
          const cxGrupo = margemEsq + grupoW * i + grupoW / 2;
          const xDespesas = cxGrupo - gap / 2 - barraW;
          const xReceitas = cxGrupo + gap / 2;
          const baseline = margemCima + plotH;

          return (
            <g key={d.trimestre}>
              <rect
                x={xDespesas} y={y(d.despesas)} width={barraW} height={Math.max(0, baseline - y(d.despesas))}
                rx={4} ry={4} fill={COR_DESPESAS}
                onMouseEnter={() => setHover({ xPct: (xDespesas + barraW / 2) / W * 100, yPct: y(d.despesas) / H * 100, label: `${d.trimestre}º Trim. — Despesas`, valor: d.despesas, cor: COR_DESPESAS })}
                onMouseLeave={() => setHover(null)}
              />
              {d.despesas > 0 && (
                <text x={xDespesas + barraW / 2} y={y(d.despesas) - 5} textAnchor="middle" fontSize={9} fill="#71747b">
                  {formatMoney(d.despesas)}
                </text>
              )}
              <rect
                x={xReceitas} y={y(d.receitas)} width={barraW} height={Math.max(0, baseline - y(d.receitas))}
                rx={4} ry={4} fill={COR_RECEITAS}
                onMouseEnter={() => setHover({ xPct: (xReceitas + barraW / 2) / W * 100, yPct: y(d.receitas) / H * 100, label: `${d.trimestre}º Trim. — Receitas`, valor: d.receitas, cor: COR_RECEITAS })}
                onMouseLeave={() => setHover(null)}
              />
              {d.receitas > 0 && (
                <text x={xReceitas + barraW / 2} y={y(d.receitas) - 5} textAnchor="middle" fontSize={9} fill="#71747b">
                  {formatMoney(d.receitas)}
                </text>
              )}
              <text x={cxGrupo} y={H - 8} textAnchor="middle" fontSize={11} fill="#565962">{d.trimestre}º Trim.</text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="absolute pointer-events-none bg-ink-800 text-white text-xs rounded-md px-2 py-1 shadow-lg whitespace-nowrap"
          style={{ left: `${hover.xPct}%`, top: `${hover.yPct}%`, transform: 'translate(-50%, -130%)' }}
        >
          <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: hover.cor }} />
          {hover.label}: {formatMoney(hover.valor)}
        </div>
      )}
    </div>
  );
}

export default function ContabilidadePage() {
  const [mes, setMes] = useState(mesAtual());
  const [extratos, setExtratos] = useState<Extrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [aEnviarFicheiro, setAEnviarFicheiro] = useState(false);
  const [resumo, setResumo] = useState<{ totalDespesas: number; totalReceitas: number; numDespesas: number; numReceitas: number } | null>(null);
  const [aEnviarEmail, setAEnviarEmail] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const [resumoTrimestre, setResumoTrimestre] = useState<{ totalDespesas: number; totalReceitas: number } | null>(null);
  const [resumoAno, setResumoAno] = useState<DadosTrimestre[] | null>(null);
  const [ivaValor, setIvaValor] = useState('');
  const [ivaPago, setIvaPago] = useState(false);
  const [ivaDataPagamento, setIvaDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [aGuardarIva, setAGuardarIva] = useState(false);

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

    const trimestre = trimestreDoMes(mesNum);
    const { inicio: inicioTri, fim: fimTri } = intervaloTrimestre(ano, trimestre);
    const [{ data: despesasTri }, { data: receitasTri }, { data: ivaExistente }] = await Promise.all([
      supabase.from('despesas').select('valor').gte('data_despesa', inicioTri).lte('data_despesa', fimTri),
      supabase.from('receitas').select('valor').gte('data_receita', inicioTri).lte('data_receita', fimTri),
      supabase.from('iva_trimestres').select('*').eq('ano', ano).eq('trimestre', trimestre).maybeSingle(),
    ]);
    const totalDespesasTri = (despesasTri || []).reduce((s, d) => s + d.valor, 0);
    const totalReceitasTri = (receitasTri || []).reduce((s, r) => s + r.valor, 0);
    setResumoTrimestre({ totalDespesas: totalDespesasTri, totalReceitas: totalReceitasTri });

    if (ivaExistente) {
      setIvaValor(String(ivaExistente.valor ?? ''));
      setIvaPago(ivaExistente.pago);
      setIvaDataPagamento(ivaExistente.data_pagamento || new Date().toISOString().slice(0, 10));
    } else {
      const estimativa = (totalReceitasTri - totalDespesasTri) * (23 / 123);
      setIvaValor(estimativa > 0 ? estimativa.toFixed(2) : '0.00');
      setIvaPago(false);
      setIvaDataPagamento(new Date().toISOString().slice(0, 10));
    }

    const [{ data: despesasAno }, { data: receitasAno }] = await Promise.all([
      supabase.from('despesas').select('valor, data_despesa').gte('data_despesa', `${ano}-01-01`).lte('data_despesa', `${ano}-12-31`),
      supabase.from('receitas').select('valor, data_receita').gte('data_receita', `${ano}-01-01`).lte('data_receita', `${ano}-12-31`),
    ]);
    const anoBuckets: DadosTrimestre[] = [1, 2, 3, 4].map((t) => ({ trimestre: t, despesas: 0, receitas: 0 }));
    for (const d of despesasAno || []) {
      const m = Number(d.data_despesa.slice(5, 7));
      anoBuckets[trimestreDoMes(m) - 1].despesas += d.valor;
    }
    for (const r of receitasAno || []) {
      const m = Number(r.data_receita.slice(5, 7));
      anoBuckets[trimestreDoMes(m) - 1].receitas += r.valor;
    }
    setResumoAno(anoBuckets);

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

  async function guardarIva() {
    const [ano, mesNum] = mes.split('-').map(Number);
    const trimestre = trimestreDoMes(mesNum);
    setAGuardarIva(true);
    const { error } = await supabase.from('iva_trimestres').upsert(
      [{ ano, trimestre, valor: parseFloat(ivaValor) || 0, pago: ivaPago, data_pagamento: ivaPago ? ivaDataPagamento : null }],
      { onConflict: 'ano,trimestre' }
    );
    setAGuardarIva(false);
    if (error) alert('Erro ao guardar: ' + error.message);
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
    <div className="p-4 md:p-8 max-w-4xl">
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

      {resumoTrimestre && (() => {
        const [ano, mesNum] = mes.split('-').map(Number);
        const trimestre = trimestreDoMes(mesNum);
        const estimativa = (resumoTrimestre.totalReceitas - resumoTrimestre.totalDespesas) * (23 / 123);
        return (
          <div className="card p-6 mb-6">
            <h2 className="font-semibold text-ink-700 mb-1">IVA — {trimestre}º Trimestre de {ano}</h2>
            <p className="text-xs text-ink-400 mb-4">
              Despesas do trimestre: {formatMoney(resumoTrimestre.totalDespesas)} · Receitas do trimestre: {formatMoney(resumoTrimestre.totalReceitas)} ·
              Estimativa a 23% (ajusta com o valor real da contabilista): {formatMoney(estimativa > 0 ? estimativa : 0)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm text-ink-600 mb-1">Valor de IVA a pagar (€)</label>
                <input type="number" step="0.01" value={ivaValor} onChange={(e) => setIvaValor(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-ink-600 mb-1">Já paguei</label>
                <div className="flex gap-2">
                  <label className="input flex items-center gap-2 flex-1 cursor-pointer">
                    <input type="checkbox" checked={ivaPago} onChange={(e) => setIvaPago(e.target.checked)} />
                    {ivaPago ? 'Pago' : 'Por pagar'}
                  </label>
                  {ivaPago && (
                    <input type="date" value={ivaDataPagamento} onChange={(e) => setIvaDataPagamento(e.target.value)} className="input w-40" />
                  )}
                </div>
              </div>
              <button onClick={guardarIva} disabled={aGuardarIva} className="btn-primary justify-center disabled:opacity-60">
                <Check size={16} /> {aGuardarIva ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        );
      })()}

      {resumoAno && (() => {
        const [ano] = mes.split('-').map(Number);
        return (
          <div className="card p-6 mb-6">
            <h2 className="font-semibold text-ink-700 mb-4">Despesas e Receitas por Trimestre — {ano}</h2>
            <GraficoTrimestres dados={resumoAno} ano={ano} />
          </div>
        );
      })()}

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
