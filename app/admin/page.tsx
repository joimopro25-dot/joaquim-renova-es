'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/format';
import { Users, Briefcase, Euro, ArrowRight, Receipt } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  status: string;
  valor_total: number | null;
  clientes: { nome: string } | null;
};

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
  const [recentes, setRecentes] = useState<Obra[]>([]);

  useEffect(() => {
    async function carregar() {
      const [{ count: clientesCount }, { data: obras }, { data: despesas }] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase
          .from('obras')
          .select('id, titulo, status, valor_total, clientes(nome)')
          .order('criado_em', { ascending: false }),
        supabase.from('despesas').select('valor'),
      ]);

      setTotalClientes(clientesCount || 0);
      const obrasList = (obras as any as Obra[]) || [];
      setObrasEmCurso(obrasList.filter((o) => o.status === 'em_curso').length);
      setValorOrcamentado(obrasList.reduce((sum, o) => sum + (o.valor_total || 0), 0));
      setTotalDespesas((despesas || []).reduce((sum, d: any) => sum + (d.valor || 0), 0));
      setRecentes(obrasList.slice(0, 5));
      setLoading(false);
    }
    carregar();
  }, []);

  const stats = [
    { label: 'Clientes', value: totalClientes, icon: Users, href: '/admin/clientes' },
    { label: 'Obras em Curso', value: obrasEmCurso, icon: Briefcase, href: '/admin/obras' },
    { label: 'Valor Orçamentado (total)', value: formatMoney(valorOrcamentado), icon: Euro, href: '/admin/obras' },
    { label: 'Despesas Registadas', value: formatMoney(totalDespesas), icon: Receipt, href: '/admin/despesas' },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
