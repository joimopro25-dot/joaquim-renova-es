'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Briefcase, FileText, Pencil } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  valor_total: number | null;
  progresso_percentagem: number;
  cliente_id: string;
  clientes: { nome: string } | null;
};

const ESTADOS = [
  { value: 'orcamento', label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  { value: 'em_curso', label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  { value: 'pausada', label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  { value: 'concluida', label: 'Concluída', color: 'bg-green-100 text-green-700' },
];

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregarDados() {
    setLoading(true);
    const { data: obrasData, error: obrasError } = await supabase
      .from('obras')
      .select('*, clientes(nome)')
      .order('criado_em', { ascending: false });
    if (!obrasError) setObras((obrasData as any) || []);
    setLoading(false);
  }

  useEffect(() => { carregarDados(); }, []);

  function estadoInfo(value: string) {
    return ESTADOS.find((e) => e.value === value) || ESTADOS[0];
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{obras.length} obra{obras.length !== 1 ? 's' : ''} registada{obras.length !== 1 ? 's' : ''}</p>
        <Link href="/admin/orcamentos" className="btn-primary bg-purple-600 hover:bg-purple-700">
          <FileText size={18} /> Criar via Orçamento
        </Link>
      </div>

      <p className="text-xs text-ink-400 mb-6 -mt-3">
        As obras nascem sempre de um orçamento aprovado (mesmo que seja um orçamento rápido, de uma linha só) — assim toda a obra fica com o detalhe de custos, margens e eventuais subcontratações já estruturado.
      </p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Obra</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium">Valor</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : obras.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-ink-400 text-sm">
                    <Briefcase size={28} className="mx-auto mb-2 text-ink-200" />
                    Nenhuma obra registada. Cria um orçamento e converte-o em obra depois de aprovado.
                  </td>
                </tr>
              ) : (
                obras.map((o) => {
                  const info = estadoInfo(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-sand-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/admin/obras/${o.id}`}>
                      <td className="p-4 font-medium text-ink-800">{o.titulo}</td>
                      <td className="p-4 text-ink-500">{o.clientes?.nome || '—'}</td>
                      <td className="p-4"><span className={`badge ${info.color}`}>{info.label}</span></td>
                      <td className="p-4 text-ink-500">{o.valor_total ? formatMoney(o.valor_total) : '—'}</td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center gap-1 text-brand-600 text-sm">
                          <Pencil size={14} /> Editar
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
