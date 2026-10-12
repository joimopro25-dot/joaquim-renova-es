'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Trash2, Pencil, Check, X, Wallet, RefreshCw } from 'lucide-react';

type Recorrente = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  periodicidade: string;
  proxima_data: string;
  area_negocio_id: string | null;
  ativa: boolean;
  areas_negocio: { nome: string } | null;
};

type AreaNegocio = { id: string; nome: string };
type IvaTrimestre = { ano: number; trimestre: number; valor: number | null; pago: boolean };

const CATEGORIAS = [
  { value: 'ordenado', label: 'Ordenado/Pagamento' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'seguranca_social', label: 'Segurança Social' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'licencas', label: 'Licenças/Alvará' },
  { value: 'subcontratacao', label: 'Subcontratação' },
  { value: 'outro', label: 'Outro' },
];

const PERIODICIDADES = [
  { value: 'mensal', label: 'Mensal', meses: 1 },
  { value: 'trimestral', label: 'Trimestral', meses: 3 },
  { value: 'semestral', label: 'Semestral', meses: 6 },
  { value: 'anual', label: 'Anual', meses: 12 },
];

function mesesDaPeriodicidade(p: string): number {
  return PERIODICIDADES.find((x) => x.value === p)?.meses ?? 1;
}

function ocorrenciasPorAno(p: string): number {
  return 12 / mesesDaPeriodicidade(p);
}

function somarMeses(dataIso: string, meses: number): string {
  const d = new Date(dataIso);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

function calcularOcorrencias(dataInicial: string, periodicidade: string, n: number): string[] {
  const datas: string[] = [];
  let data = dataInicial;
  for (let i = 0; i < n; i++) {
    datas.push(data);
    data = somarMeses(data, mesesDaPeriodicidade(periodicidade));
  }
  return datas;
}

function dataFimTrimestreIva(ano: number, trimestre: number): string {
  // Aproximação: ~20 do 2º mês após o fim do trimestre (data real varia, confirmar com a contabilista)
  const d = new Date(ano, trimestre * 3 + 1, 20);
  return d.toISOString().slice(0, 10);
}

const COR_LINHA = '#7c4324';

type PontoSaldo = { data: string; label: string; saldo: number; eventos: { descricao: string; valor: number }[] };

function GraficoSaldo({ pontos }: { pontos: PontoSaldo[] }) {
  const [hover, setHover] = useState<{ xPct: number; yPct: number; label: string; saldo: number } | null>(null);
  if (pontos.length === 0) return null;

  const W = 640;
  const H = 240;
  const margemEsq = 56;
  const margemDir = 16;
  const margemCima = 16;
  const margemBaixo = 28;
  const plotW = W - margemEsq - margemDir;
  const plotH = H - margemCima - margemBaixo;

  const valores = pontos.map((p) => p.saldo);
  const minValor = Math.min(0, ...valores);
  const maxValor = Math.max(...valores, 1);
  const amplitude = maxValor - minValor || 1;

  function x(i: number) {
    return margemEsq + (pontos.length === 1 ? plotW / 2 : (plotW / (pontos.length - 1)) * i);
  }
  function y(valor: number) {
    return margemCima + plotH - ((valor - minValor) / amplitude) * plotH;
  }

  const linhaZero = y(0);
  const pathD = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.saldo)}`).join(' ');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Previsão de saldo nos próximos meses">
        {minValor < 0 && (
          <line x1={margemEsq} x2={W - margemDir} y1={linhaZero} y2={linhaZero} stroke="#dc2626" strokeWidth={1} strokeDasharray="3,3" />
        )}
        <line x1={margemEsq} x2={W - margemDir} y1={margemCima + plotH} y2={margemCima + plotH} stroke="#e8e8ea" strokeWidth={1} />
        <path d={pathD} fill="none" stroke={COR_LINHA} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pontos.map((p, i) => (
          <g key={p.data}>
            <circle
              cx={x(i)} cy={y(p.saldo)} r={5} fill="#fff" stroke={COR_LINHA} strokeWidth={2}
              onMouseEnter={() => setHover({ xPct: (x(i) / W) * 100, yPct: (y(p.saldo) / H) * 100, label: p.label, saldo: p.saldo })}
              onMouseLeave={() => setHover(null)}
            />
            <text x={x(i)} y={y(p.saldo) - 10} textAnchor="middle" fontSize={9} fill={p.saldo < 0 ? '#dc2626' : '#71747b'}>
              {formatMoney(p.saldo)}
            </text>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#565962">{p.label}</text>
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className="absolute pointer-events-none bg-ink-800 text-white text-xs rounded-md px-2 py-1 shadow-lg whitespace-nowrap"
          style={{ left: `${hover.xPct}%`, top: `${hover.yPct}%`, transform: 'translate(-50%, -130%)' }}
        >
          {hover.label}: {formatMoney(hover.saldo)}
        </div>
      )}
    </div>
  );
}

export default function PlaneadorPage() {
  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([]);
  const [areasNegocio, setAreasNegocio] = useState<AreaNegocio[]>([]);
  const [ivaTrimestres, setIvaTrimestres] = useState<IvaTrimestre[]>([]);
  const [saldoAtual, setSaldoAtual] = useState<{ valor: number; data_registo: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('seguros');
  const [valor, setValor] = useState('');
  const [valorTotalAnual, setValorTotalAnual] = useState('');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [proximaData, setProximaData] = useState(() => new Date().toISOString().slice(0, 10));
  const [areaNegocioId, setAreaNegocioId] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  const [novoSaldo, setNovoSaldo] = useState('');
  const [aGuardarSaldo, setAGuardarSaldo] = useState(false);

  const [confirmando, setConfirmando] = useState<Recorrente | null>(null);
  const [valorConfirmar, setValorConfirmar] = useState('');
  const [dataConfirmar, setDataConfirmar] = useState('');
  const [aConfirmar, setAConfirmar] = useState(false);

  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [previsaoValores, setPrevisaoValores] = useState<Record<string, string>>({});

  function valorNaData(r: Recorrente, data: string): number {
    return overrides[r.id]?.[data] ?? r.valor;
  }

  async function carregar() {
    setLoading(true);
    const [{ data: recData }, { data: areasData }, { data: saldoData }, { data: ivaData }, { data: overridesData }] = await Promise.all([
      supabase.from('despesas_recorrentes').select('*, areas_negocio(nome)').order('proxima_data'),
      supabase.from('areas_negocio').select('id, nome').order('nome'),
      supabase.from('saldo_conta').select('valor, data_registo').order('data_registo', { ascending: false }).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('iva_trimestres').select('ano, trimestre, valor, pago').eq('pago', false),
      supabase.from('recorrente_valores').select('recorrente_id, data, valor'),
    ]);
    setRecorrentes((recData as any) || []);
    setAreasNegocio(areasData || []);
    setSaldoAtual(saldoData || null);
    setIvaTrimestres((ivaData as any) || []);
    const mapaOverrides: Record<string, Record<string, number>> = {};
    for (const o of (overridesData as any) || []) (mapaOverrides[o.recorrente_id] ||= {})[o.data] = o.valor;
    setOverrides(mapaOverrides);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!showForm) return;
    const datas = calcularOcorrencias(proximaData, periodicidade, 6);
    const mapa: Record<string, string> = {};
    for (const data of datas) {
      const override = editandoId ? overrides[editandoId]?.[data] : undefined;
      mapa[data] = String(override ?? (parseFloat(valor) || 0));
    }
    setPrevisaoValores(mapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, editandoId, proximaData, periodicidade]);

  function resetForm() {
    setDescricao(''); setCategoria('seguros'); setValor(''); setValorTotalAnual(''); setPeriodicidade('mensal');
    setProximaData(new Date().toISOString().slice(0, 10)); setAreaNegocioId('');
    setEditandoId(null); setShowForm(false);
  }

  function abrirEditar(r: Recorrente) {
    setEditandoId(r.id);
    setDescricao(r.descricao); setCategoria(r.categoria); setValor(String(r.valor)); setValorTotalAnual('');
    setPeriodicidade(r.periodicidade); setProximaData(r.proxima_data); setAreaNegocioId(r.area_negocio_id || '');
    setShowForm(true);
  }

  function atualizarValorTotalAnual(novoTotal: string) {
    setValorTotalAnual(novoTotal);
    const total = parseFloat(novoTotal);
    if (!isNaN(total)) setValor((total / ocorrenciasPorAno(periodicidade)).toFixed(2));
  }

  function atualizarPeriodicidade(novaPeriodicidade: string) {
    setPeriodicidade(novaPeriodicidade);
    const total = parseFloat(valorTotalAnual);
    if (!isNaN(total)) setValor((total / ocorrenciasPorAno(novaPeriodicidade)).toFixed(2));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setAGuardar(true);
    const valorBase = parseFloat(valor) || 0;
    const payload = {
      descricao, categoria, valor: valorBase, periodicidade,
      proxima_data: proximaData, area_negocio_id: areaNegocioId || null,
    };
    let recorrenteId = editandoId;
    if (editandoId) {
      const { error } = await supabase.from('despesas_recorrentes').update(payload).eq('id', editandoId);
      if (error) { setAGuardar(false); alert('Erro: ' + error.message); return; }
    } else {
      const { data, error } = await supabase.from('despesas_recorrentes').insert([{ ...payload, ativa: true }]).select().single();
      if (error) { setAGuardar(false); alert('Erro: ' + error.message); return; }
      recorrenteId = data.id;
    }

    for (const [data, valorStr] of Object.entries(previsaoValores)) {
      const valorPrevisao = parseFloat(valorStr);
      if (isNaN(valorPrevisao)) continue;
      if (Math.abs(valorPrevisao - valorBase) < 0.005) {
        await supabase.from('recorrente_valores').delete().eq('recorrente_id', recorrenteId).eq('data', data);
      } else {
        await supabase.from('recorrente_valores').upsert([{ recorrente_id: recorrenteId, data, valor: valorPrevisao }], { onConflict: 'recorrente_id,data' });
      }
    }

    setAGuardar(false);
    resetForm();
    carregar();
  }

  async function alternarAtiva(r: Recorrente) {
    await supabase.from('despesas_recorrentes').update({ ativa: !r.ativa }).eq('id', r.id);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover esta despesa recorrente?')) return;
    await supabase.from('despesas_recorrentes').delete().eq('id', id);
    carregar();
  }

  function abrirConfirmarPagamento(r: Recorrente) {
    setConfirmando(r);
    setValorConfirmar(String(valorNaData(r, r.proxima_data)));
    setDataConfirmar(r.proxima_data);
  }

  async function confirmarPagamento() {
    if (!confirmando) return;
    const r = confirmando;
    const valorPago = parseFloat(valorConfirmar) || 0;
    setAConfirmar(true);
    const { error: erroDespesa } = await supabase.from('despesas').insert([{
      descricao: r.descricao,
      categoria: r.categoria,
      valor: valorPago,
      data_despesa: dataConfirmar,
      area_negocio_id: r.area_negocio_id,
      estado_pagamento: 'pago',
      data_pagamento: dataConfirmar,
      tipo_imputacao: 'custo',
    }]);
    if (erroDespesa) { setAConfirmar(false); alert('Erro ao criar despesa: ' + erroDespesa.message); return; }
    const novaData = somarMeses(dataConfirmar, mesesDaPeriodicidade(r.periodicidade));
    await supabase.from('despesas_recorrentes').update({ proxima_data: novaData }).eq('id', r.id);
    setAConfirmar(false);
    setConfirmando(null);
    carregar();
  }

  async function guardarSaldo(e: React.FormEvent) {
    e.preventDefault();
    if (!novoSaldo) return;
    setAGuardarSaldo(true);
    const { error } = await supabase.from('saldo_conta').insert([{ valor: parseFloat(novoSaldo) || 0, data_registo: new Date().toISOString().slice(0, 10) }]);
    setAGuardarSaldo(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setNovoSaldo('');
    carregar();
  }

  // Previsão: próximos 6 meses, saldo atual menos despesas recorrentes previstas e IVA trimestral por pagar
  const hoje = new Date();
  const fimJanela = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0);
  const pontos: PontoSaldo[] = [];
  if (saldoAtual) {
    let saldoCorrente = saldoAtual.valor;
    const eventosPorMes: Record<string, { descricao: string; valor: number }[]> = {};

    for (const r of recorrentes.filter((r) => r.ativa)) {
      let data = r.proxima_data;
      let guard = 0;
      while (new Date(data) <= fimJanela && guard < 60) {
        const chave = data.slice(0, 7);
        (eventosPorMes[chave] ||= []).push({ descricao: r.descricao, valor: valorNaData(r, data) });
        data = somarMeses(data, mesesDaPeriodicidade(r.periodicidade));
        guard++;
      }
    }
    for (const iva of ivaTrimestres) {
      if (!iva.valor) continue;
      const dataVenc = dataFimTrimestreIva(iva.ano, iva.trimestre);
      if (new Date(dataVenc) <= fimJanela && new Date(dataVenc) >= hoje) {
        const chave = dataVenc.slice(0, 7);
        (eventosPorMes[chave] ||= []).push({ descricao: `IVA ${iva.trimestre}º Trim. ${iva.ano} (aprox.)`, valor: iva.valor });
      }
    }

    for (let i = 0; i <= 6; i++) {
      const dataMes = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const chave = dataMes.toISOString().slice(0, 7);
      const eventos = eventosPorMes[chave] || [];
      if (i > 0) saldoCorrente -= eventos.reduce((s, e) => s + e.valor, 0);
      const label = dataMes.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
      pontos.push({ data: chave, label: i === 0 ? 'Hoje' : label.charAt(0).toUpperCase() + label.slice(1), saldo: saldoCorrente, eventos: i === 0 ? [] : eventos });
    }
  }

  const proximosEventos = pontos.slice(1).filter((p) => p.eventos.length > 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-ink-700 mb-1 flex items-center gap-2"><Wallet size={18} /> Saldo da Conta</h2>
        {loading ? (
          <p className="text-sm text-ink-300">A carregar...</p>
        ) : saldoAtual ? (
          <p className="text-2xl font-semibold text-ink-800 mb-1">{formatMoney(saldoAtual.valor)}</p>
        ) : (
          <p className="text-sm text-ink-400 mb-1">Ainda sem saldo registado.</p>
        )}
        {saldoAtual && <p className="text-xs text-ink-400 mb-3">Atualizado em {new Date(saldoAtual.data_registo).toLocaleDateString('pt-PT')}</p>}
        <form onSubmit={guardarSaldo} className="flex items-center gap-2">
          <input type="number" step="0.01" placeholder="Novo saldo (€)" value={novoSaldo} onChange={(e) => setNovoSaldo(e.target.value)} className="input w-48" required />
          <button disabled={aGuardarSaldo} className="btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            <RefreshCw size={16} /> {aGuardarSaldo ? 'A guardar...' : 'Atualizar Saldo'}
          </button>
        </form>
      </div>

      {saldoAtual && pontos.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-ink-700 mb-1">Previsão de Saldo — Próximos 6 Meses</h2>
          <p className="text-xs text-ink-400 mb-4">Saldo atual menos despesas recorrentes previstas e IVA trimestral por pagar — não inclui receitas futuras (visão conservadora).</p>
          <GraficoSaldo pontos={pontos} />
          {proximosEventos.length > 0 && (
            <div className="mt-4 space-y-2">
              {proximosEventos.map((p) => (
                <div key={p.data} className="text-xs">
                  <p className="font-medium text-ink-600 mb-0.5">{p.label}</p>
                  <ul className="text-ink-500 space-y-0.5">
                    {p.eventos.map((ev, i) => (
                      <li key={i} className="flex justify-between"><span>{ev.descricao}</span><span>{formatMoney(ev.valor)}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink-700">Despesas Recorrentes</h2>
          <button onClick={() => { resetForm(); setShowForm((v) => !v); }} className="btn-primary text-sm py-1.5">
            <Plus size={16} /> Nova Recorrente
          </button>
        </div>

        {showForm && (
          <form onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pb-4 border-b border-sand-100">
            <input type="text" placeholder="Descrição (ex: Seguro RC)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-2" required />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={periodicidade} onChange={(e) => atualizarPeriodicidade(e.target.value)} className="input">
              {PERIODICIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div>
              <label className="text-xs text-ink-400">Valor total anual (€) — opcional, calcula o valor por período</label>
              <input type="number" step="0.01" placeholder="ex: 965,84 por ano" value={valorTotalAnual} onChange={(e) => atualizarValorTotalAnual(e.target.value)} className="input w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-ink-400">Valor por período (€)</label>
              <input type="number" step="0.01" placeholder="Valor (€)" value={valor} onChange={(e) => setValor(e.target.value)} className="input w-full mt-1" required />
            </div>
            <div>
              <label className="text-xs text-ink-400">Próxima data</label>
              <input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} className="input w-full mt-1" required />
            </div>
            <select value={areaNegocioId} onChange={(e) => setAreaNegocioId(e.target.value)} className="input md:col-span-3">
              <option value="">Sem área de negócio definida</option>
              {areasNegocio.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>

            <div className="md:col-span-3 pt-2 border-t border-sand-100">
              <label className="text-xs text-ink-400 block mb-2">
                Previsão das próximas prestações — o valor por período acima aplica-se por omissão; edita aqui as que forem diferentes (ex: 1ª prestação com valor distinto das seguintes).
              </label>
              <div className="space-y-1.5">
                {Object.keys(previsaoValores).map((data) => (
                  <div key={data} className="flex items-center gap-2">
                    <span className="text-xs text-ink-500 w-28 shrink-0">{new Date(data).toLocaleDateString('pt-PT')}</span>
                    <input
                      type="number" step="0.01"
                      value={previsaoValores[data]}
                      onChange={(e) => setPrevisaoValores((prev) => ({ ...prev, [data]: e.target.value }))}
                      className="input flex-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 md:col-span-3">
              <button type="button" onClick={resetForm} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              <button disabled={aGuardar} className="btn-primary flex-1 justify-center disabled:opacity-60">{aGuardar ? 'A guardar...' : editandoId ? 'Guardar Alterações' : 'Adicionar'}</button>
            </div>
          </form>
        )}

        {recorrentes.length === 0 ? (
          <p className="text-sm text-ink-400">Ainda sem despesas recorrentes registadas.</p>
        ) : (
          <div className="space-y-2">
            {recorrentes.map((r) => (
              <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg text-sm ${r.ativa ? 'bg-sand-50' : 'bg-sand-50/40 opacity-60'}`}>
                <div>
                  <p className="font-medium text-ink-800">{r.descricao} {!r.ativa && <span className="badge bg-sand-200 text-ink-500 text-[10px] ml-1">Inativa</span>}</p>
                  <p className="text-xs text-ink-400">
                    {CATEGORIAS.find((c) => c.value === r.categoria)?.label} · {PERIODICIDADES.find((p) => p.value === r.periodicidade)?.label} · Próxima: {new Date(r.proxima_data).toLocaleDateString('pt-PT')}
                    {r.areas_negocio?.nome && ` · ${r.areas_negocio.nome}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink-800">{formatMoney(valorNaData(r, r.proxima_data))}</span>
                  {r.ativa && (
                    <button onClick={() => abrirConfirmarPagamento(r)} className="text-green-600 hover:text-green-700 text-xs font-medium flex items-center gap-1">
                      <Check size={14} /> Confirmar Pagamento
                    </button>
                  )}
                  <button onClick={() => alternarAtiva(r)} title={r.ativa ? 'Desativar' : 'Ativar'} className="text-ink-300 hover:text-brand-600">
                    {r.ativa ? <X size={15} /> : <Check size={15} />}
                  </button>
                  <button onClick={() => abrirEditar(r)} className="text-ink-300 hover:text-brand-600"><Pencil size={14} /></button>
                  <button onClick={() => remover(r.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-ink-800 mb-1">Confirmar Pagamento</h3>
            <p className="text-sm text-ink-400 mb-4">{confirmando.descricao} — ajusta o valor e a data desta prestação, se for diferente do habitual.</p>
            <label className="block text-sm text-ink-600 mb-1">Valor pago (€)</label>
            <input type="number" step="0.01" value={valorConfirmar} onChange={(e) => setValorConfirmar(e.target.value)} className="input w-full mb-3" autoFocus />
            <label className="block text-sm text-ink-600 mb-1">Data</label>
            <input type="date" value={dataConfirmar} onChange={(e) => setDataConfirmar(e.target.value)} className="input w-full mb-4" />
            <p className="text-xs text-ink-400 mb-4">O valor-padrão desta recorrente ({formatMoney(confirmando.valor)}) mantém-se para as próximas prestações — isto só ajusta esta.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmando(null)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              <button onClick={confirmarPagamento} disabled={aConfirmar} className="btn-primary bg-green-600 hover:bg-green-700 flex-1 justify-center disabled:opacity-60">
                {aConfirmar ? 'A confirmar...' : 'Confirmar e Criar Despesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
