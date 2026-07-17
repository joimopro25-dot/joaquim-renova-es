'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { calcularTotais } from '../../../lib/orcamento';
import { FileText, ArrowRight } from 'lucide-react';

type Orcamento = {
  id: string;
  titulo: string;
  status: string;
  taxa_horaria: number;
  margem_percentagem: number;
  iva_percentagem: number;
  orcamento_linhas: { quantidade: number; rendimento_horas: number; custo_material: number }[];
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  enviado: { label: 'Aguarda a sua aprovação', color: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido em Obra', color: 'bg-purple-100 text-purple-700' },
};

export default function PortalOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: perfil } = await supabase.from('perfis').select('cliente_id').eq('id', user.id).single();
      if (!perfil?.cliente_id) { setLoading(false); return; }

      const { data } = await supabase
        .from('orcamentos')
        .select('*, orcamento_linhas(quantidade, rendimento_horas, custo_material)')
        .eq('cliente_id', perfil.cliente_id)
        .order('criado_em', { ascending: false });
      setOrcamentos((data as any) || []);
      setLoading(false);
    }
    carregar();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-heading font-semibold text-ink-800 mb-1">Os Meus Orçamentos</h1>
      <p className="text-sm text-ink-400 mb-6">Reveja e aprove os orçamentos propostos.</p>

      {loading ? (
        <div className="text-center py-16 text-ink-300 text-sm">A carregar...</div>
      ) : orcamentos.length === 0 ? (
        <div className="card p-8 text-center text-ink-400 text-sm">Ainda não tem orçamentos disponíveis.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orcamentos.map((o) => {
            const info = ESTADOS[o.status] || ESTADOS.enviado;
            const totais = calcularTotais(o.orcamento_linhas, o);
            return (
              <Link key={o.id} href={`/portal/orcamentos/${o.id}`} className="card p-6 hover:border-brand-200 transition-colors block">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-brand-400" />
                    <span className="font-medium text-ink-800">{o.titulo}</span>
                  </div>
                </div>
                <span className={`badge ${info.color} mb-3 inline-block`}>{info.label}</span>
                <div className="flex items-center justify-between text-sm text-ink-400">
                  <span className="text-ink-800 font-medium">{totais.total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                  <span className="flex items-center gap-1 text-brand-600">Ver detalhe <ArrowRight size={13} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
