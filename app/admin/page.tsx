'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { calcularTotais } from '../../lib/orcamento';
import { Users, Briefcase, ArrowRight, Receipt, HardHat, FileText, AlertTriangle, Calendar, Inbox } from 'lucide-react';

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
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('obras').select('id, titulo, status, valor_total, clientes(nome)').order('criado_em', { ascending: false }),
        supabase.from('orcamentos').select('id, status, taxa_horaria, margem_percentagem, iva_percentagem, orcamento_linhas(quantidade, rendimento_horas, custo_material)'),
        supabase.from('subempreitadas').select('id, estado, tipo_valor, valor_unitario, subempreitada_entradas(quantidade)'),
        supabase.from('despesas').select('obra_id, valor, tipo_imputacao').not('obra_id', 'is', null),
        supabase.from('obra_trabalhadores').select('obra_id, tipo_valor, valor_unitario, obra_trabalhador_entradas(quantidade)').not('obra_id', 'is', null),
        supabase.from('despesas').select('obra_id, subempreitada_id, valor, tipo_imputacao').eq('tipo_imputacao', 'custo'),
        supabase.from('obra_tarefas').select('id, titulo, obra_id, data_fim_prevista, estado, obras(titulo)').neq('estado', 'concluida'),
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

      // --- Despesas: por destino ---
      const despesasList = despesasTodas || [];
      const despObra = despesasList.filter((d: any) => d.obra_id);
      const despSub = despesasList.filter((d: any) => d.subempreitada_id);
      const despGeral = despesasList.filter((d: any) => !d.obra_id && !d.subempreitada_id);
      setSegDespesas([
        { label: 'Obras', cor: 'bg-blue-400', count: despObra.length, valor: despObra.reduce((s: number, d: any) => s + (d.valor || 0), 0) },
        { label: 'Subempreitadas', cor: 'bg-purple-400', count: despSub.length, valor: despSub.reduce((s: number, d: any) => s + (d.valor || 0), 0) },
        { label: 'Geral / Stock', cor: 'bg-sand-300', count: despGeral.length, valor: despGeral.reduce((s: number, d: any) => s + (d.valor || 0), 0) },
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

      setLoading(false);
    }
    carregar();
  }, []);

  const maxFunil = Math.max(...funil.map((f) => f.count), 1);

  return (
    <div className="p-4 md:p-8">
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
            <WidgetFunil titulo="Subempreitadas" href="/admin/subempreitadas" icone={HardHat} segmentos={segSubs} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1">
          {!loading && <WidgetFunil titulo="Despesas (custo)" href="/admin/despesas" icone={Receipt} segmentos={segDespesas} />}
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
