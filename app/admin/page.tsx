'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { calcularTotais } from '../../lib/orcamento';
import { previsaoParaCidade, iconeTempo, horaMaisProxima, type PrevisaoDia } from '../../lib/weather';
import { Users, Briefcase, ArrowRight, Receipt, HardHat, FileText, AlertTriangle, Calendar, Inbox, Clock, CalendarDays } from 'lucide-react';

type ItemDia = {
  id: string;
  tipo: 'obra' | 'subempreitada' | 'evento';
  titulo: string;
  subtitulo: string;
  hora: string | null;
  cidade: string | null;
  link: string | null;
};

const TIPOS_EVENTO_LABEL: Record<string, string> = {
  reuniao: 'Reunião',
  visita: 'Visita de Levantamento',
  chamada: 'Chamada/Ligar',
  envio_orcamento: 'Enviar Orçamento',
  followup: 'Follow-up',
  outro: 'Outro',
};

function paraISO(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function WidgetProximosDias() {
  const [dias, setDias] = useState<{ data: Date; itens: ItemDia[] }[]>([]);
  const [previsoes, setPrevisoes] = useState<Record<string, PrevisaoDia | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const hoje = new Date(new Date().toDateString());
      const dataFinal = new Date(hoje);
      dataFinal.setDate(hoje.getDate() + 3);

      const [{ data: tarefasData }, { data: previsoesData }, { data: eventosData }] = await Promise.all([
        supabase.from('obra_tarefas').select('id, titulo, data_inicio, data_fim_prevista, estado, bloqueante, obra_id, obras(titulo, cidade)').eq('bloqueante', true).neq('estado', 'concluida'),
        supabase.from('subempreitada_previsoes').select('id, titulo, data_inicio, data_fim_prevista, hora_inicio, subempreitada_id, subempreitadas(descricao, cidade)'),
        supabase.from('eventos_calendario').select('id, titulo, tipo, data, hora').eq('concluido', false),
      ]);

      const porDia: Record<string, ItemDia[]> = {};
      function adicionar(dataISO: string, item: ItemDia) {
        (porDia[dataISO] ||= []).push(item);
      }

      for (let d = new Date(hoje); d <= dataFinal; d.setDate(d.getDate() + 1)) {
        const iso = paraISO(d);
        for (const t of (tarefasData as any) || []) {
          if (iso >= t.data_inicio && iso <= t.data_fim_prevista) {
            adicionar(iso, { id: `o-${t.id}-${iso}`, tipo: 'obra', titulo: t.titulo, subtitulo: t.obras?.titulo || '—', hora: null, cidade: t.obras?.cidade || null, link: `/admin/obras/${t.obra_id}` });
          }
        }
        for (const p of (previsoesData as any) || []) {
          if (iso >= p.data_inicio && iso <= p.data_fim_prevista) {
            adicionar(iso, { id: `s-${p.id}-${iso}`, tipo: 'subempreitada', titulo: p.titulo || p.subempreitadas?.descricao || 'Trabalho subcontratado', subtitulo: 'Para outro empreiteiro', hora: p.hora_inicio, cidade: p.subempreitadas?.cidade || null, link: `/admin/subempreitadas/${p.subempreitada_id}` });
          }
        }
      }
      for (const e of (eventosData as any) || []) {
        adicionar(e.data, { id: `e-${e.id}`, tipo: 'evento', titulo: `${TIPOS_EVENTO_LABEL[e.tipo] || 'Evento'}: ${e.titulo}`, subtitulo: 'Lembrete', hora: e.hora, cidade: null, link: null });
      }

      const listaDias: { data: Date; itens: ItemDia[] }[] = [];
      for (let d = new Date(hoje); d <= dataFinal; d.setDate(d.getDate() + 1)) {
        const iso = paraISO(d);
        listaDias.push({ data: new Date(d), itens: (porDia[iso] || []).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')) });
      }
      setDias(listaDias);
      setLoading(false);

      const cidades = Array.from(new Set(listaDias.flatMap((dd) => dd.itens.filter((it) => it.cidade).map((it) => `${it.cidade}|${paraISO(dd.data)}`))));
      Promise.all(cidades.map(async (chave) => {
        const [cidade, iso] = chave.split('|');
        return [chave, await previsaoParaCidade(cidade, iso)] as const;
      })).then((resultados) => {
        setPrevisoes(Object.fromEntries(resultados));
      });
    }
    carregar();
  }, []);

  if (loading) return <div className="card p-5 mb-6 text-ink-300 text-sm">A carregar próximos dias...</div>;

  const temAlgo = dias.some((d) => d.itens.length > 0);
  if (!temAlgo) return null;

  return (
    <div className="card p-5 mb-6">
      <span className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-4">
        <CalendarDays size={16} className="text-copper-500" /> Próximos Dias
      </span>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {dias.map((d) => {
          const isoData = paraISO(d.data);
          const hoje = mesmoDiaLocal(d.data, new Date());
          return (
            <div key={isoData}>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
                {hoje ? 'Hoje' : d.data.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              {d.itens.length === 0 ? (
                <p className="text-xs text-ink-300">Sem nada marcado.</p>
              ) : (
                <div className="space-y-1.5">
                  {d.itens.map((it) => {
                    const previsao = it.cidade ? previsoes[`${it.cidade}|${isoData}`] : null;
                    const horaAlvo = it.hora ? Number(it.hora.slice(0, 2)) : null;
                    const horaPrev = previsao ? horaMaisProxima(previsao, horaAlvo) : null;
                    const cor = it.tipo === 'evento' ? 'bg-teal-50 text-teal-700 border-teal-200' : it.tipo === 'subempreitada' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-red-50 text-red-700 border-red-200';
                    const conteudo = (
                      <div className={`text-xs p-2 rounded-lg border ${cor}`}>
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-medium truncate">{it.hora ? `${it.hora.slice(0, 5)} ` : ''}{it.titulo}</span>
                          {horaPrev && <span className="shrink-0">{iconeTempo(horaPrev.codigo)} {Math.round(horaPrev.temp)}°</span>}
                        </div>
                        <p className="opacity-80 truncate">{it.subtitulo}{it.cidade ? ` · ${it.cidade}` : ''}</p>
                      </div>
                    );
                    return it.link ? <Link key={it.id} href={it.link} className="block hover:opacity-80">{conteudo}</Link> : <div key={it.id}>{conteudo}</div>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mesmoDiaLocal(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Obra = {
  id: string;
  titulo: string;
  status: string;
  valor_total: number | null;
  clientes: { nome: string } | null;
};

type ObraEmRisco = { id: string; titulo: string; margem: number };
type TarefaAtrasada = { id: string; titulo: string; obraId: string; obraTitulo: string; dataFimPrevista: string };

type Segmento = { label: string; cor: string; count: number; valor: number };

const ESTADOS: Record<string, { label: string; color: string }> = {
  orcamento: { label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  em_curso: { label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

function WidgetFunil({ titulo, href, icone: Icone, segmentos }: { titulo: string; href: string; icone: any; segmentos: Segmento[] }) {
  const totalCount = segmentos.reduce((s, seg) => s + seg.count, 0);
  const totalValor = segmentos.reduce((s, seg) => s + seg.valor, 0);
  return (
    <Link href={href} className="card p-5 hover:border-brand-200 transition-colors flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-sm font-medium text-ink-700">
          <Icone size={16} className="text-copper-500" /> {titulo}
        </span>
        <ArrowRight size={14} className="text-ink-300" />
      </div>

      <p className="text-xl font-heading font-semibold text-ink-800 mb-3">{formatMoney(totalValor)}</p>

      {totalCount > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden gap-[2px] mb-3 bg-sand-100">
          {segmentos.filter((s) => s.count > 0).map((s) => (
            <div key={s.label} className={`${s.cor} h-full`} style={{ width: `${Math.max((s.count / totalCount) * 100, 4)}%` }} />
          ))}
        </div>
      )}

      <div className="space-y-1.5 mt-auto">
        {segmentos.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-500">
              <span className={`w-2 h-2 rounded-full ${s.cor} shrink-0`} />
              {s.label}
            </span>
            <span className="text-ink-600 whitespace-nowrap">{s.count} · {formatMoney(s.valor)}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [totalClientes, setTotalClientes] = useState(0);
  const [recentes, setRecentes] = useState<Obra[]>([]);
  const [obrasEmRisco, setObrasEmRisco] = useState<ObraEmRisco[]>([]);
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState<TarefaAtrasada[]>([]);
  const [despesasPorPagar, setDespesasPorPagar] = useState<{ count: number; total: number }>({ count: 0, total: 0 });

  const [segOrcamentos, setSegOrcamentos] = useState<Segmento[]>([]);
  const [segDespesas, setSegDespesas] = useState<Segmento[]>([]);
  const [segObras, setSegObras] = useState<Segmento[]>([]);
  const [segSubs, setSegSubs] = useState<Segmento[]>([]);
  const [funil, setFunil] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    async function carregar() {
      const [
        { count: clientesCount },
        { count: leadsCount },
        { data: obras },
        { data: orcamentos },
        { data: subs },
        { data: despesasObra },
        { data: trabsObra },
        { data: despesasTodas },
        { data: tarefasData },
        { data: despesasPendentesData },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('obras').select('id, titulo, status, valor_total, clientes(nome)').order('criado_em', { ascending: false }),
        supabase.from('orcamentos').select('id, status, taxa_horaria, margem_percentagem, iva_percentagem, orcamento_linhas(quantidade, rendimento_horas, custo_material)'),
        supabase.from('subempreitadas').select('id, estado, tipo_valor, valor_unitario, subempreitada_entradas(quantidade)'),
        supabase.from('despesas').select('obra_id, valor, tipo_imputacao').not('obra_id', 'is', null),
        supabase.from('obra_trabalhadores').select('obra_id, tipo_valor, valor_unitario, obra_trabalhador_entradas(quantidade)').not('obra_id', 'is', null),
        supabase.from('despesas').select('obra_id, subempreitada_id, valor, tipo_imputacao, categoria, estado_pagamento'),
        supabase.from('obra_tarefas').select('id, titulo, obra_id, data_fim_prevista, estado, obras(titulo)').neq('estado', 'concluida'),
        supabase.from('despesas').select('valor').eq('estado_pagamento', 'pendente'),
      ]);

      setTotalClientes(clientesCount || 0);
      const obrasList = (obras as any as Obra[]) || [];
      setRecentes(obrasList.slice(0, 5));

      // --- Orçamentos: funil por estado ---
      const orcamentosList = (orcamentos as any[]) || [];
      const gruposOrc: Record<string, { label: string; cor: string }> = {
        rascunho: { label: 'Rascunho', cor: 'bg-sand-300' },
        enviado: { label: 'Enviados', cor: 'bg-blue-400' },
        aprovado: { label: 'Aprovados', cor: 'bg-green-500' },
        rejeitado: { label: 'Rejeitados', cor: 'bg-red-400' },
        convertido: { label: 'Convertidos', cor: 'bg-purple-400' },
      };
      const segOrc: Segmento[] = Object.entries(gruposOrc).map(([status, info]) => {
        const doGrupo = orcamentosList.filter((o) => o.status === status);
        const valor = doGrupo.reduce((s, o) => s + calcularTotais(o.orcamento_linhas || [], o).total, 0);
        return { label: info.label, cor: info.cor, count: doGrupo.length, valor };
      });
      setSegOrcamentos(segOrc);

      // --- Despesas (todas: custo, a cobrar ao cliente e registo): pagas vs por pagar ---
      const despesasList = despesasTodas || [];
      const despPagas = despesasList.filter((d: any) => d.estado_pagamento === 'pago');
      const despPorPagar = despesasList.filter((d: any) => d.estado_pagamento !== 'pago');
      setSegDespesas([
        { label: 'Pagas', cor: 'bg-green-500', count: despPagas.length, valor: despPagas.reduce((s: number, d: any) => s + (d.valor || 0), 0) },
        { label: 'Por Pagar', cor: 'bg-amber-400', count: despPorPagar.length, valor: despPorPagar.reduce((s: number, d: any) => s + (d.valor || 0), 0) },
      ]);

      // --- Obras: por fase ---
      const gruposObra: Record<string, { label: string; cor: string }> = {
        orcamento: { label: 'Orçamento', cor: 'bg-sand-300' },
        em_curso: { label: 'Em Curso', cor: 'bg-blue-400' },
        pausada: { label: 'Pausada', cor: 'bg-amber-400' },
        concluida: { label: 'Concluída', cor: 'bg-green-500' },
      };
      setSegObras(Object.entries(gruposObra).map(([status, info]) => {
        const doGrupo = obrasList.filter((o) => o.status === status);
        return { label: info.label, cor: info.cor, count: doGrupo.length, valor: doGrupo.reduce((s, o) => s + (o.valor_total || 0), 0) };
      }));

      // --- Subempreitadas: pendente vs pago ---
      const subsList = (subs as any[]) || [];
      function valorSub(s: any) {
        const qtd = s.tipo_valor === 'fixo' ? 1 : s.subempreitada_entradas.reduce((a: number, e: any) => a + e.quantidade, 0);
        return s.tipo_valor === 'fixo' ? s.valor_unitario : qtd * s.valor_unitario;
      }
      const subsPendentes = subsList.filter((s) => s.estado !== 'pago');
      const subsPagas = subsList.filter((s) => s.estado === 'pago');
      setSegSubs([
        { label: 'Pendente', cor: 'bg-amber-400', count: subsPendentes.length, valor: subsPendentes.reduce((s, x) => s + valorSub(x), 0) },
        { label: 'Pago', cor: 'bg-green-500', count: subsPagas.length, valor: subsPagas.reduce((s, x) => s + valorSub(x), 0) },
      ]);

      // --- Funil geral ---
      setFunil([
        { label: 'Leads', count: leadsCount || 0 },
        { label: 'Orçamentos Enviados', count: orcamentosList.filter((o) => ['enviado', 'aprovado', 'rejeitado', 'convertido'].includes(o.status)).length },
        { label: 'Orçamentos Aprovados', count: orcamentosList.filter((o) => ['aprovado', 'convertido'].includes(o.status)).length },
        { label: 'Obras em Curso', count: obrasList.filter((o) => o.status === 'em_curso').length },
        { label: 'Obras Concluídas', count: obrasList.filter((o) => o.status === 'concluida').length },
      ]);

      // --- Obras em risco (margem negativa) ---
      const risco: ObraEmRisco[] = [];
      for (const o of obrasList) {
        if (o.status !== 'em_curso' && o.status !== 'pausada') continue;
        const despesasCusto = (despesasObra || []).filter((d: any) => d.obra_id === o.id && d.tipo_imputacao === 'custo').reduce((s: number, d: any) => s + (d.valor || 0), 0);
        const despesasCliente = (despesasObra || []).filter((d: any) => d.obra_id === o.id && d.tipo_imputacao === 'cliente').reduce((s: number, d: any) => s + (d.valor || 0), 0);
        const maoDeObra = (trabsObra || []).filter((t: any) => t.obra_id === o.id).reduce((s: number, t: any) => {
          const qtd = t.tipo_valor === 'fixo' ? 1 : t.obra_trabalhador_entradas.reduce((a: number, e: any) => a + e.quantidade, 0);
          return s + (t.tipo_valor === 'fixo' ? t.valor_unitario : qtd * t.valor_unitario);
        }, 0);
        const valorTotalComCliente = (o.valor_total || 0) + despesasCliente;
        const margem = valorTotalComCliente - despesasCusto - maoDeObra;
        if (margem < 0) risco.push({ id: o.id, titulo: o.titulo, margem });
      }
      setObrasEmRisco(risco);

      // --- Tarefas atrasadas ---
      const hoje = new Date(new Date().toDateString());
      const atrasadas = (tarefasData || [])
        .filter((t: any) => new Date(t.data_fim_prevista) < hoje)
        .map((t: any) => ({ id: t.id, titulo: t.titulo, obraId: t.obra_id, obraTitulo: t.obras?.titulo || '—', dataFimPrevista: t.data_fim_prevista }));
      setTarefasAtrasadas(atrasadas);

      // --- Despesas por pagar ---
      const pendentes = despesasPendentesData || [];
      setDespesasPorPagar({ count: pendentes.length, total: pendentes.reduce((s: number, d: any) => s + (d.valor || 0), 0) });

      setLoading(false);
    }
    carregar();
  }, []);

  const maxFunil = Math.max(...funil.map((f) => f.count), 1);

  return (
    <div className="p-4 md:p-8">
      <WidgetProximosDias />

      {obrasEmRisco.length > 0 && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-sm font-medium text-red-800 flex items-center gap-2 mb-2">
            <AlertTriangle size={16} /> {obrasEmRisco.length} obra{obrasEmRisco.length !== 1 ? 's' : ''} com margem negativa
          </p>
          <div className="space-y-1">
            {obrasEmRisco.map((o) => (
              <Link key={o.id} href={`/admin/obras/${o.id}`} className="flex items-center justify-between text-sm text-red-700 hover:underline">
                <span>{o.titulo}</span>
                <span className="font-medium">{formatMoney(o.margem)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tarefasAtrasadas.length > 0 && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-sm font-medium text-red-800 flex items-center gap-2 mb-2">
            <Calendar size={16} /> {tarefasAtrasadas.length} tarefa{tarefasAtrasadas.length !== 1 ? 's' : ''} atrasada{tarefasAtrasadas.length !== 1 ? 's' : ''} no cronograma
          </p>
          <div className="space-y-1">
            {tarefasAtrasadas.map((t) => (
              <Link key={t.id} href={`/admin/obras/${t.obraId}`} className="flex items-center justify-between text-sm text-red-700 hover:underline">
                <span>{t.titulo} <span className="text-red-500">· {t.obraTitulo}</span></span>
                <span className="font-medium">{new Date(t.dataFimPrevista).toLocaleDateString('pt-PT')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {despesasPorPagar.count > 0 && (
        <Link href="/admin/despesas" className="card p-4 mb-6 bg-amber-50 border-amber-200 flex items-center justify-between hover:border-amber-300 transition-colors">
          <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
            <Clock size={16} /> {despesasPorPagar.count} despesa{despesasPorPagar.count !== 1 ? 's' : ''} por pagar
          </p>
          <span className="text-sm font-semibold text-amber-800">{formatMoney(despesasPorPagar.total)}</span>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/admin/clientes" className="card p-5 hover:border-brand-200 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-ink-400 text-sm font-medium">Clientes</span>
            <Users size={18} className="text-copper-500" />
          </div>
          <p className="text-2xl font-heading font-semibold text-ink-800">{loading ? '—' : totalClientes}</p>
        </Link>

        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="card p-5 text-ink-300 text-sm">A carregar...</div>)
        ) : (
          <>
            <WidgetFunil titulo="Orçamentos" href="/admin/orcamentos" icone={FileText} segmentos={segOrcamentos} />
            <WidgetFunil titulo="Obras" href="/admin/obras" icone={Briefcase} segmentos={segObras} />
            <WidgetFunil titulo="Prestação de Serviços" href="/admin/subempreitadas" icone={HardHat} segmentos={segSubs} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1">
          {!loading && <WidgetFunil titulo="Despesas (todas)" href="/admin/despesas" icone={Receipt} segmentos={segDespesas} />}
        </div>

        <div className="lg:col-span-2 card p-5">
          <span className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-4">
            <Inbox size={16} className="text-copper-500" /> Funil Geral
          </span>
          <div className="space-y-2.5">
            {funil.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
                  <span>{f.label}</span>
                  <span className="text-ink-700 font-medium">{f.count}</span>
                </div>
                <div className="w-full bg-sand-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${Math.max((f.count / maxFunil) * 100, f.count > 0 ? 3 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-sand-100 flex items-center justify-between">
          <h2 className="font-semibold text-ink-700">Obras Recentes</h2>
          <Link href="/admin/obras" className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>
        ) : recentes.length === 0 ? (
          <div className="p-10 text-center text-ink-400 text-sm">
            Nenhuma obra registada.{' '}
            <Link href="/admin/obras" className="text-brand-600 hover:underline">Criar a primeira obra</Link>
          </div>
        ) : (
          <div className="divide-y divide-sand-100">
            {recentes.map((o) => {
              const info = ESTADOS[o.status] || ESTADOS.orcamento;
              return (
                <div key={o.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-800 truncate">{o.titulo}</p>
                    <p className="text-sm text-ink-400 truncate">{o.clientes?.nome || '—'}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm text-ink-500">
                      {o.valor_total ? formatMoney(o.valor_total) : '—'}
                    </span>
                    <span className={`badge ${info.color}`}>{info.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
