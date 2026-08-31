'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import ConsultoriaChat from '../../../../components/ConsultoriaChat';
import { ArrowLeft, FileText, Stethoscope } from 'lucide-react';

type Consultoria = {
  id: string;
  titulo: string;
  cliente_id: string;
  criado_em: string;
  clientes: { nome: string } | null;
};

export default function ConsultoriaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consultoria, setConsultoria] = useState<Consultoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [aCriarOrcamento, setACriarOrcamento] = useState(false);
  const [orcamentoExistenteId, setOrcamentoExistenteId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const [{ data: consData }, { data: orcData }] = await Promise.all([
      supabase.from('consultorias').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('orcamentos').select('id').eq('consultoria_id', id).maybeSingle(),
    ]);
    setConsultoria(consData as any);
    setOrcamentoExistenteId(orcData?.id || null);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  async function criarOrcamentoAPartirDaConsultoria() {
    if (!consultoria) return;
    setACriarOrcamento(true);
    const { data, error } = await supabase.from('orcamentos').insert([{
      cliente_id: consultoria.cliente_id,
      titulo: consultoria.titulo,
      status: 'rascunho',
      consultoria_id: consultoria.id,
    }]).select().single();
    setACriarOrcamento(false);
    if (error) { alert('Erro ao criar orçamento: ' + error.message); return; }
    router.push(`/admin/orcamentos/${data.id}`);
  }

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!consultoria) return <div className="p-8 text-center text-ink-400 text-sm">Consultoria não encontrada.</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link href="/admin/consultorias" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={15} /> Consultorias
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-heading font-semibold text-ink-800 flex items-center gap-2">
            <Stethoscope size={20} className="text-brand-500" /> {consultoria.titulo}
          </h1>
          <p className="text-sm text-ink-400">{consultoria.clientes?.nome || '—'}</p>
        </div>
        {orcamentoExistenteId ? (
          <Link href={`/admin/orcamentos/${orcamentoExistenteId}`} className="btn-primary bg-purple-600 hover:bg-purple-700">
            <FileText size={16} /> Ver Orçamento
          </Link>
        ) : (
          <button onClick={criarOrcamentoAPartirDaConsultoria} disabled={aCriarOrcamento} className="btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
            <FileText size={16} /> {aCriarOrcamento ? 'A criar...' : 'Criar Orçamento a partir desta Consultoria'}
          </button>
        )}
      </div>

      <div className="card p-6">
        <ConsultoriaChat
          consultoriaId={consultoria.id}
          clienteId={consultoria.cliente_id}
          tituloDefault={consultoria.titulo}
          permitirOrcamento={false}
        />
      </div>
    </div>
  );
}
