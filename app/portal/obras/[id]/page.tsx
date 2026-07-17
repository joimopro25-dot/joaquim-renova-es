'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { ArrowLeft, ImageOff } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  progresso_percentagem: number;
};

type Foto = { id: string; url: string; legenda: string | null };

const ESTADOS: Record<string, { label: string; color: string }> = {
  orcamento: { label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  em_curso: { label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

export default function PortalObraDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obra, setObra] = useState<Obra | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [{ data: obraData }, { data: fotosData }] = await Promise.all([
        supabase.from('obras').select('id, titulo, descricao, status, progresso_percentagem').eq('id', id).single(),
        supabase.from('fotos_obra').select('id, url, legenda').eq('obra_id', id).order('criado_em', { ascending: false }),
      ]);
      setObra(obraData as any);
      setFotos(fotosData || []);
      setLoading(false);
    }
    carregar();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!obra) return <div className="p-8 text-center text-ink-400 text-sm">Não foi possível encontrar esta obra, ou não tem acesso a ela.</div>;

  const info = ESTADOS[obra.status] || ESTADOS.orcamento;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <button onClick={() => router.push('/portal')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar às Minhas Obras
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-ink-800">{obra.titulo}</h1>
          {obra.descricao && <p className="text-sm text-ink-400 mt-1">{obra.descricao}</p>}
        </div>
        <span className={`badge ${info.color}`}>{info.label}</span>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink-700">Progresso</h3>
          <span className="text-sm font-medium text-brand-600">{obra.progresso_percentagem}%</span>
        </div>
        <div className="w-full bg-sand-100 rounded-full h-3 overflow-hidden">
          <div className="bg-brand-500 h-full transition-all" style={{ width: `${obra.progresso_percentagem}%` }} />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink-700 mb-4">Fotos</h3>
        {fotos.length === 0 ? (
          <div className="text-center py-10 text-ink-400 text-sm">
            <ImageOff size={28} className="mx-auto mb-2 text-ink-200" />
            Ainda sem fotos desta obra.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {fotos.map((f) => (
              <div key={f.id}>
                <img src={f.url} alt={f.legenda || ''} className="w-full aspect-square object-cover rounded-lg border border-sand-200" />
                {f.legenda && <p className="text-xs text-ink-500 mt-1">{f.legenda}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
