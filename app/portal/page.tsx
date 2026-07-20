'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { Briefcase, ArrowRight } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  status: string;
  progresso_percentagem: number;
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  orcamento: { label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  em_curso: { label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

export default function PortalHome() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [semAssociacao, setSemAssociacao] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: perfil } = await supabase.from('perfis').select('cliente_id').eq('id', user.id).single();
      if (!perfil?.cliente_id) {
        setSemAssociacao(true);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('obras')
        .select('id, titulo, status, progresso_percentagem')
        .eq('cliente_id', perfil.cliente_id)
        .order('criado_em', { ascending: false });

      setObras(data || []);
      setLoading(false);
    }
    carregar();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-heading font-semibold text-ink-800 mb-1">As Minhas Obras</h1>
      <p className="text-sm text-ink-400 mb-6">Acompanhe aqui o progresso das suas renovações.</p>

      {loading ? (
        <div className="text-center py-16 text-ink-300 text-sm">A carregar...</div>
      ) : semAssociacao ? (
        <div className="card p-8 text-center">
          <p className="text-ink-600 font-medium mb-1">A sua conta ainda não está associada a nenhuma obra.</p>
          <p className="text-sm text-ink-400">Contacte-nos para confirmarmos o email associado ao seu processo.</p>
        </div>
      ) : obras.length === 0 ? (
        <div className="card p-8 text-center text-ink-400 text-sm">
          Ainda não tem obras registadas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {obras.map((o) => {
            const info = ESTADOS[o.status] || ESTADOS.orcamento;
            return (
              <Link key={o.id} href={`/portal/obras/${o.id}`} className="card p-6 hover:border-brand-200 transition-colors block">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase size={18} className="text-copper-500" />
                    <span className="font-medium text-ink-800">{o.titulo}</span>
                  </div>
                  <span className={`badge ${info.color}`}>{info.label}</span>
                </div>
                <div className="w-full bg-sand-100 rounded-full h-2 overflow-hidden mb-1">
                  <div className="bg-brand-500 h-full transition-all" style={{ width: `${o.progresso_percentagem}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm text-ink-400">
                  <span>{o.progresso_percentagem}% concluído</span>
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
