'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { Users, Briefcase, Euro, ArrowRight, Receipt, HardHat, UsersRound, AlertTriangle, Calendar } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  status: string;
  valor_total: number | null;
  clientes: { nome: string } | null;
};

type ObraEmRisco = { id: string; titulo: string; margem: number };
type TarefaAtrasada = { id: string; titulo: string; obraId: string; obraTitulo: string; dataFimPrevista: string };

const ESTADOS: Record<string, { label: string; color: string }> = {
  orcamento: { label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  em_curso: { label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [totalClientes, setTotalClientes] = useState(0);
  const [obrasEmCurso, setObrasEmCurso] = useState(0);
  const [valorOrcamentado, setValorOrcamentado] = useState(0);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [totalSubempreitadas, setTotalSubempreitadas] = useState(0);
  const [totalMaoDeObra, setTotalMaoDeObra] = useState(0);
  const [recentes, setRecentes] = useState<Obra[]>([]);
  const [obrasEmRisco, setObrasEmRisco] = useState<ObraEmRisco[]>([]);
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState<TarefaAtrasada[]>([]);

  useEffect(() => {
    async function carregar() {
      const [{ count: clientesCount }, { data: obras }, { data: despesas }, { data: subs }, { data: trabs }, { data: despesasObra }, { data: trabsObra }, { data: tarefasData }] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase
          .from('obras')
          .select('id, titulo, status, valor_total, clientes(nome)')
          .order('criado_em', { ascending: false }),
        supabase.from('despesas').select('valor'),
        supabase.from('subempreitadas').select('tipo_valor, valor_unitario, subempreitada_entradas(quantidade)').eq('estado', 'pago'),
        supabase.from('obra_trabalhadores').select('tipo_valor, valor_unitario, obra_trabalhador_entradas(quantidade)').eq('estado', 'pago'),
        supabase.from('despesas').select('obra_id, valor, tipo_imputacao').not('obra_id', 'is', null),
        supabase.from('obra_trabalhadores').select('obra_id, tipo_valor, valor_unitario, obra_trabalhador_entradas(quantidade)').not('obra_id', 'is', null),
        supabase.from('obra_tarefas').select('id, titulo, obra_id, data_fim_prevista, estado, obras(titulo)').neq('estado', 'concluida'),
      ]);

      setTotalClientes(clientesCount || 0);
      const obrasList = (obras as any as Obra[]) || [];
      setObrasEmCurso(obrasList.filter((o) => o.status === 'em_curso').length);
      setValorOrcamentado(obrasList.reduce((sum, o) => sum + (o.valor_total || 0), 0));
      setTotalDespesas((despesas || []).reduce((sum, d: any) => sum + (d.valor || 0), 0));
      setTotalSubempreitadas((subs || []).reduce((sum: number, s: any) => {
        const qtd = s.tipo_valor === 'fixo' ? 1 : s.subempreitada_entradas.reduce((a: number, e: any) => a + e.quantidade, 0);
        return sum + (s.tipo_valor === 'fixo' ? s.valor_unitario : qtd * s.valor_unitario);
      }, 0));
      setTotalMaoDeObra((trabs || []).reduce((sum: number, t: any) => {
        const qtd = t.tipo_valor === 'fixo' ? 1 : t.obra_trabalhador_entradas.reduce((a: number, e: any) => a + e.quantidade, 0);
        return sum + (t.tipo_valor === 'fixo' ? t.valor_unitario : qtd * t.valor_unitario);
      }, 0));
      setRecentes(obrasList.slice(0, 5));

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

      const hoje = new Date(new Date().toDateString());
      const atrasadas = (tarefasData || [])
        .filter((t: any) => new Date(t.data_fim_prevista) < hoje)
        .map((t: any) => ({ id: t.id, titulo: t.titulo, obraId: t.obra_id, obraTitulo: t.obras?.titulo || '—', dataFimPrevista: t.data_fim_prevista }));
      setTarefasAtrasadas(atrasadas);

      setLoading(false);
    }
    carregar();
  }, []);

  const stats = [
    { label: 'Clientes', value: totalClientes, icon: Users, href: '/admin/clientes' },
    { label: 'Obras em Curso', value: obrasEmCurso, icon: Briefcase, href: '/admin/obras' },
    { label: 'Valor Orçamentado (total)', value: formatMoney(valorOrcamentado), icon: Euro, href: '/admin/obras' },
    { label: 'Despesas Registadas', value: formatMoney(totalDespesas), icon: Receipt, href: '/admin/despesas' },
    { label: 'Mão de Obra Paga', value: formatMoney(totalMaoDeObra), icon: UsersRound, href: '/admin/trabalhadores' },
    { label: 'Subempreitadas Recebidas', value: formatMoney(totalSubempreitadas), icon: HardHat, href: '/admin/subempreitadas' },
  ];

  return (
    <div className="p-4 md:p-8">
      {obrasEmRisco.length > 0 && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-sm font-medium text-red-800 flex items-center gap-2 mb-2">
            <AlertTriangle size={16} /> {obrasEmRisco.length} obra{obrasEmRisco.length !== 1 ? 's' : ''} com margem negativa — despesas e mão de obra já ultrapassam o orçamentado
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:border-brand-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-400 text-sm font-medium">{s.label}</span>
              <s.icon size={18} className="text-copper-500" />
            </div>
            <p className="text-2xl font-heading font-semibold text-ink-800">
              {loading ? '—' : s.value}
            </p>
          </Link>
        ))}
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
