'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

type TarefaCalendario = {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim_prevista: string;
  estado: string;
  bloqueante: boolean;
  obra_id: string;
  obras: { titulo: string } | null;
};

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

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

export default function CalendarioPage() {
  const [mesAtual, setMesAtual] = useState(() => inicioDoMes(new Date()));
  const [tarefas, setTarefas] = useState<TarefaCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('obra_tarefas')
      .select('id, titulo, data_inicio, data_fim_prevista, estado, bloqueante, obra_id, obras(titulo)')
      .order('data_inicio');
    setTarefas((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const grelha = useMemo(() => gerarGrelha(mesAtual), [mesAtual]);
  const hoje = new Date();

  function tarefasDoDia(dia: Date) {
    return tarefas.filter((t) => dataDentro(dia, t.data_inicio, t.data_fim_prevista));
  }

  function corTarefa(t: TarefaCalendario) {
    if (t.estado === 'concluida') return 'bg-green-100 text-green-700 border-green-200';
    if (!t.bloqueante) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  }

  const tarefasSelecionado = diaSelecionado ? tarefasDoDia(diaSelecionado) : [];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-ink-800 flex items-center gap-2">
          <CalendarDays size={20} /> Calendário de Obras
        </h2>
        <div className="flex items-center gap-2">
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

      <div className="flex items-center gap-4 text-xs text-ink-500 mb-4">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> Presença necessária</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> À espera (não bloqueia)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Concluída</span>
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
              const tarefasDia = tarefasDoDia(dia);
              const visiveis = tarefasDia.slice(0, 3);
              const resto = tarefasDia.length - visiveis.length;
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
                      <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${corTarefa(t)}`}>
                        {t.obras?.titulo ? `${t.obras.titulo}: ` : ''}{t.titulo}
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
            <h3 className="font-semibold text-ink-800 mb-4">{diaSelecionado.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {tarefasSelecionado.length === 0 ? (
              <p className="text-sm text-ink-400">Sem tarefas neste dia.</p>
            ) : (
              <div className="space-y-2">
                {tarefasSelecionado.map((t) => (
                  <Link key={t.id} href={`/admin/obras/${t.obra_id}`} className={`block p-3 rounded-lg border text-sm hover:opacity-80 ${corTarefa(t)}`}>
                    <p className="font-medium">{t.titulo}</p>
                    <p className="text-xs opacity-80">{t.obras?.titulo || '—'}</p>
                    <p className="text-xs opacity-70 mt-1">{t.bloqueante ? 'Presença necessária' : 'À espera'} · {new Date(t.data_inicio).toLocaleDateString('pt-PT')} – {new Date(t.data_fim_prevista).toLocaleDateString('pt-PT')}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
