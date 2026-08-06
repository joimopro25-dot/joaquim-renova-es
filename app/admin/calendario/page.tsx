'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { previsaoParaCidade, iconeTempo, horaMaisProxima, type PrevisaoDia } from '../../../lib/weather';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X, Check, Trash2, Cloud } from 'lucide-react';

type ItemCalendario = {
  id: string;
  tipo: 'obra' | 'subempreitada' | 'evento';
  titulo: string;
  subtitulo: string;
  data_inicio: string;
  data_fim_prevista: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  cidade: string | null;
  concluida: boolean;
  bloqueante: boolean;
  link: string | null;
  eventoId?: string;
};

type Cliente = { id: string; nome: string };

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const TIPOS_EVENTO: Record<string, string> = {
  reuniao: 'Reunião',
  visita: 'Visita de Levantamento',
  chamada: 'Chamada/Ligar',
  envio_orcamento: 'Enviar Orçamento',
  followup: 'Follow-up',
  outro: 'Outro',
};

function inicioDoMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function gerarGrelha(mesAtual: Date): Date[] {
  const primeiro = inicioDoMes(mesAtual);
  const diaSemanaPrimeiro = (primeiro.getDay() + 6) % 7; // 0 = Segunda
  const inicioGrelha = new Date(primeiro);
  inicioGrelha.setDate(primeiro.getDate() - diaSemanaPrimeiro);
  const dias: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrelha);
    d.setDate(inicioGrelha.getDate() + i);
    dias.push(d);
  }
  return dias;
}

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dataDentro(dia: Date, inicio: string, fim: string) {
  const d = new Date(dia.toDateString()).getTime();
  const i = new Date(new Date(inicio).toDateString()).getTime();
  const f = new Date(new Date(fim).toDateString()).getTime();
  return d >= i && d <= f;
}

function paraISO(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CalendarioPage() {
  const [mesAtual, setMesAtual] = useState(() => inicioDoMes(new Date()));
  const [itens, setItens] = useState<ItemCalendario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);
  const [previsoesTempo, setPrevisoesTempo] = useState<Record<string, PrevisaoDia | null>>({});
  const [aCarregarTempo, setACarregarTempo] = useState(false);

  const [showEventoForm, setShowEventoForm] = useState(false);
  const [eTitulo, setETitulo] = useState('');
  const [eTipo, setETipo] = useState('reuniao');
  const [eData, setEData] = useState(() => new Date().toISOString().slice(0, 10));
  const [eHora, setEHora] = useState('');
  const [eClienteId, setEClienteId] = useState('');
  const [eNotas, setENotas] = useState('');
  const [aGuardarEvento, setAGuardarEvento] = useState(false);

  async function carregar() {
    setLoading(true);
    const [{ data: tarefasData }, { data: previsoesData }, { data: entradasData }, { data: eventosData }, { data: clientesData }] = await Promise.all([
      supabase.from('obra_tarefas').select('id, titulo, data_inicio, data_fim_prevista, estado, bloqueante, obra_id, obras(titulo, cidade)').order('data_inicio'),
      supabase.from('subempreitada_previsoes').select('id, titulo, data_inicio, data_fim_prevista, hora_inicio, hora_fim, notas, subempreitada_id, subempreitadas(descricao, cidade, clientes(nome))').order('data_inicio'),
      supabase.from('subempreitada_entradas').select('id, data, hora_entrada, hora_saida, quantidade, nota, subempreitada_id, subempreitadas(descricao, cidade, clientes(nome), tipo_valor)').order('data'),
      supabase.from('eventos_calendario').select('id, titulo, tipo, data, hora, notas, concluido, clientes(nome)').order('data'),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);

    const dasObras: ItemCalendario[] = ((tarefasData as any) || []).map((t: any) => ({
      id: `obra-${t.id}`,
      tipo: 'obra' as const,
      titulo: t.titulo,
      subtitulo: t.obras?.titulo || '—',
      data_inicio: t.data_inicio,
      data_fim_prevista: t.data_fim_prevista,
      hora_inicio: null,
      hora_fim: null,
      cidade: t.obras?.cidade || null,
      concluida: t.estado === 'concluida',
      bloqueante: t.bloqueante,
      link: `/admin/obras/${t.obra_id}`,
    }));

    const dasSubs: ItemCalendario[] = ((previsoesData as any) || []).map((p: any) => ({
      id: `sub-${p.id}`,
      tipo: 'subempreitada' as const,
      titulo: p.titulo || p.subempreitadas?.descricao || 'Trabalho subcontratado',
      subtitulo: p.subempreitadas?.clientes?.nome ? `Para: ${p.subempreitadas.clientes.nome}` : (p.notas || ''),
      data_inicio: p.data_inicio,
      data_fim_prevista: p.data_fim_prevista,
      hora_inicio: p.hora_inicio,
      hora_fim: p.hora_fim,
      cidade: p.subempreitadas?.cidade || null,
      concluida: false,
      bloqueante: true,
      link: `/admin/subempreitadas/${p.subempreitada_id}`,
    }));

    const dasEntradas: ItemCalendario[] = ((entradasData as any) || []).map((e: any) => ({
      id: `entrada-${e.id}`,
      tipo: 'subempreitada' as const,
      titulo: e.subempreitadas?.descricao || 'Trabalho subcontratado',
      subtitulo: `Já trabalhado${e.subempreitadas?.clientes?.nome ? ` · Para: ${e.subempreitadas.clientes.nome}` : ''}${e.nota ? ` · ${e.nota}` : ''}`,
      data_inicio: e.data,
      data_fim_prevista: e.data,
      hora_inicio: e.hora_entrada,
      hora_fim: e.hora_saida,
      cidade: e.subempreitadas?.cidade || null,
      concluida: true,
      bloqueante: true,
      link: `/admin/subempreitadas/${e.subempreitada_id}`,
    }));

    const dosEventos: ItemCalendario[] = ((eventosData as any) || []).map((e: any) => ({
      id: `evt-${e.id}`,
      tipo: 'evento' as const,
      titulo: `${TIPOS_EVENTO[e.tipo] || 'Evento'}: ${e.titulo}`,
      subtitulo: e.clientes?.nome || e.notas || '',
      data_inicio: e.data,
      data_fim_prevista: e.data,
      hora_inicio: e.hora,
      hora_fim: null,
      cidade: null,
      concluida: e.concluido,
      bloqueante: false,
      link: null,
      eventoId: e.id,
    }));

    setItens([...dasObras, ...dasSubs, ...dasEntradas, ...dosEventos]);
    setClientes(clientesData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const grelha = useMemo(() => gerarGrelha(mesAtual), [mesAtual]);
  const hoje = new Date();

  function itensDoDia(dia: Date) {
    return itens.filter((t) => dataDentro(dia, t.data_inicio, t.data_fim_prevista));
  }

  function corItem(t: ItemCalendario) {
    if (t.concluida) return 'bg-green-100 text-green-700 border-green-200';
    if (t.tipo === 'evento') return 'bg-teal-50 text-teal-700 border-teal-200';
    if (t.tipo === 'subempreitada') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (!t.bloqueante) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  }

  const itensSelecionado = diaSelecionado ? itensDoDia(diaSelecionado) : [];

  useEffect(() => {
    if (!diaSelecionado) return;
    const cidades = Array.from(new Set(itensSelecionado.filter((t) => t.cidade).map((t) => t.cidade as string)));
    if (cidades.length === 0) return;
    setACarregarTempo(true);
    const dataISO = paraISO(diaSelecionado);
    Promise.all(cidades.map(async (c) => [c, await previsaoParaCidade(c, dataISO)] as const)).then((resultados) => {
      setPrevisoesTempo((prev) => {
        const next = { ...prev };
        for (const [c, p] of resultados) next[`${c}|${dataISO}`] = p;
        return next;
      });
      setACarregarTempo(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaSelecionado]);

  function tempoDoItem(t: ItemCalendario): { icone: string; temp: number } | null {
    if (!t.cidade || !diaSelecionado) return null;
    const previsao = previsoesTempo[`${t.cidade}|${paraISO(diaSelecionado)}`];
    if (!previsao) return null;
    const horaAlvo = t.hora_inicio ? Number(t.hora_inicio.slice(0, 2)) : null;
    const hora = horaMaisProxima(previsao, horaAlvo);
    if (!hora) return null;
    return { icone: iconeTempo(hora.codigo), temp: Math.round(hora.temp) };
  }

  async function adicionarEvento(e: React.FormEvent) {
    e.preventDefault();
    if (!eTitulo.trim()) return;
    setAGuardarEvento(true);
    const { error } = await supabase.from('eventos_calendario').insert([{
      titulo: eTitulo.trim(),
      tipo: eTipo,
      data: eData,
      hora: eHora || null,
      cliente_id: eClienteId || null,
      notas: eNotas || null,
    }]);
    setAGuardarEvento(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setETitulo(''); setETipo('reuniao'); setEHora(''); setEClienteId(''); setENotas('');
    setShowEventoForm(false);
    carregar();
  }

  async function concluirEvento(eventoId: string) {
    await supabase.from('eventos_calendario').update({ concluido: true }).eq('id', eventoId);
    carregar();
  }

  async function removerEvento(eventoId: string) {
    if (!confirm('Remover este evento/lembrete?')) return;
    await supabase.from('eventos_calendario').delete().eq('id', eventoId);
    carregar();
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-heading font-semibold text-ink-800 flex items-center gap-2">
          <CalendarDays size={20} /> Calendário de Obras
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEData(new Date().toISOString().slice(0, 10)); setShowEventoForm(true); }} className="btn-primary bg-teal-600 hover:bg-teal-700 text-sm py-1.5">
            <Plus size={15} /> Evento/Lembrete
          </button>
          <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))} className="border border-sand-200 rounded-lg p-2 hover:bg-sand-50">
            <ChevronLeft size={16} />
          </button>
          <span className="font-medium text-ink-700 w-36 text-center capitalize">
            {mesAtual.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))} className="border border-sand-200 rounded-lg p-2 hover:bg-sand-50">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {showEventoForm && (
        <form onSubmit={adicionarEvento} className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-2">
          <select value={eTipo} onChange={(e) => setETipo(e.target.value)} className="input">
            {Object.entries(TIPOS_EVENTO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="text" placeholder="Título (ex: Cliente Pedro Gomes)" value={eTitulo} onChange={(e) => setETitulo(e.target.value)} className="input md:col-span-2" required />
          <div>
            <label className="text-xs text-ink-400">Data</label>
            <input type="date" value={eData} onChange={(e) => setEData(e.target.value)} className="input w-full mt-1" required />
          </div>
          <div>
            <label className="text-xs text-ink-400">Hora (opcional)</label>
            <input type="time" value={eHora} onChange={(e) => setEHora(e.target.value)} className="input w-full mt-1" />
          </div>
          <select value={eClienteId} onChange={(e) => setEClienteId(e.target.value)} className="input mt-1">
            <option value="">Cliente (opcional)</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input type="text" placeholder="Notas (opcional)" value={eNotas} onChange={(e) => setENotas(e.target.value)} className="input md:col-span-2" />
          <div className="flex gap-2">
            <button disabled={aGuardarEvento} className="btn-primary flex-1 justify-center disabled:opacity-60">
              {aGuardarEvento ? 'A guardar...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setShowEventoForm(false)} className="text-sm text-ink-400 hover:text-ink-700 px-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-4 text-xs text-ink-500 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> Presença necessária (obra própria)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> À espera (não bloqueia)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 inline-block" /> Trabalho para outro empreiteiro</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-50 border border-teal-200 inline-block" /> Evento/Lembrete</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Concluída / Já trabalhado</span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-300 text-sm">A carregar...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
            {DIAS_SEMANA.map((d) => <div key={d} className="p-2 text-center font-medium">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grelha.map((dia, i) => {
              const doMes = dia.getMonth() === mesAtual.getMonth();
              const eHoje = mesmoDia(dia, hoje);
              const itensDia = itensDoDia(dia);
              const visiveis = itensDia.slice(0, 3);
              const resto = itensDia.length - visiveis.length;
              return (
                <button
                  key={i}
                  onClick={() => setDiaSelecionado(dia)}
                  className={`border-t border-l border-sand-100 last:border-r p-1.5 min-h-[90px] text-left align-top hover:bg-sand-50/60 transition-colors ${!doMes ? 'bg-sand-50/40' : ''}`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-1 ${eHoje ? 'bg-brand-500 text-white font-semibold' : doMes ? 'text-ink-700' : 'text-ink-300'}`}>
                    {dia.getDate()}
                  </span>
                  <div className="space-y-1">
                    {visiveis.map((t) => (
                      <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${corItem(t)}`}>
                        {t.tipo === 'obra' && t.subtitulo ? `${t.subtitulo}: ` : ''}{t.titulo}
                      </div>
                    ))}
                    {resto > 0 && <div className="text-[10px] text-ink-400 px-1.5">+{resto} mais</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {diaSelecionado && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDiaSelecionado(null)}>
          <div className="card p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink-800">{diaSelecionado.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              <button onClick={() => setDiaSelecionado(null)} className="text-ink-300 hover:text-ink-600"><X size={18} /></button>
            </div>
            {aCarregarTempo && <p className="text-xs text-ink-400 mb-2 flex items-center gap-1.5"><Cloud size={13} className="animate-pulse" /> A obter previsão do tempo...</p>}
            {itensSelecionado.length === 0 ? (
              <p className="text-sm text-ink-400">Sem nada marcado neste dia.</p>
            ) : (
              <div className="space-y-2">
                {itensSelecionado.map((t) => {
                  const tempo = tempoDoItem(t);
                  const conteudo = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{t.titulo}</p>
                        {tempo && <span className="text-xs shrink-0 flex items-center gap-1">{tempo.icone} {tempo.temp}°C</span>}
                      </div>
                      <p className="text-xs opacity-80">{t.subtitulo}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {t.tipo === 'evento' ? 'Lembrete' : t.tipo === 'subempreitada' ? (t.concluida ? 'Já trabalhado (para outro empreiteiro)' : 'Previsão — trabalho para outro empreiteiro') : t.bloqueante ? 'Presença necessária' : 'À espera'}
                        {' · '}
                        {new Date(t.data_inicio).toLocaleDateString('pt-PT')}{t.data_inicio !== t.data_fim_prevista ? ` – ${new Date(t.data_fim_prevista).toLocaleDateString('pt-PT')}` : ''}
                        {(t.hora_inicio || t.hora_fim) && ` · ${t.hora_inicio?.slice(0, 5) || '?'}${t.hora_fim ? `–${t.hora_fim.slice(0, 5)}` : ''}`}
                        {t.cidade && ` · ${t.cidade}`}
                      </p>
                    </>
                  );
                  if (t.tipo === 'evento') {
                    return (
                      <div key={t.id} className={`p-3 rounded-lg border text-sm ${corItem(t)}`}>
                        {conteudo}
                        {!t.concluida && (
                          <div className="flex items-center gap-3 mt-2">
                            <button onClick={() => concluirEvento(t.eventoId!)} className="text-xs flex items-center gap-1 hover:underline"><Check size={12} /> Concluir</button>
                            <button onClick={() => removerEvento(t.eventoId!)} className="text-xs flex items-center gap-1 hover:underline text-red-600"><Trash2 size={12} /> Remover</button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <Link key={t.id} href={t.link || '#'} className={`block p-3 rounded-lg border text-sm hover:opacity-80 ${corItem(t)}`}>
                      {conteudo}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
