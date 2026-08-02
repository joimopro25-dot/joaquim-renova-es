'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { ArrowLeft, ImageOff, ShieldCheck, CheckCircle2, Circle, Loader2 } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  progresso_percentagem: number;
};

type Foto = { id: string; url: string; legenda: string | null; tarefa_id: string | null };

type Tarefa = { id: string; titulo: string; data_inicio: string; data_fim_prevista: string; estado: string };

type Garantia = {
  id: string;
  equipamento: string;
  marca_modelo: string | null;
  fornecedor: string | null;
  data_compra: string | null;
  duracao_meses: number;
  anexo_url: string | null;
  anexo_nome: string | null;
};

function calcularFimGarantia(g: Garantia): Date | null {
  if (!g.data_compra) return null;
  const fim = new Date(g.data_compra);
  fim.setMonth(fim.getMonth() + (g.duracao_meses || 0));
  return fim;
}

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
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [{ data: obraData }, { data: fotosData }, { data: garantiasData }, { data: tarefasData }] = await Promise.all([
        supabase.from('obras').select('id, titulo, descricao, status, progresso_percentagem').eq('id', id).single(),
        supabase.from('fotos_obra').select('id, url, legenda, tarefa_id').eq('obra_id', id).order('criado_em', { ascending: false }),
        supabase.from('garantias').select('id, equipamento, marca_modelo, fornecedor, data_compra, duracao_meses, anexo_url, anexo_nome').eq('obra_id', id).order('criado_em', { ascending: false }),
        supabase.from('obra_tarefas').select('id, titulo, data_inicio, data_fim_prevista, estado').eq('obra_id', id).order('data_inicio'),
      ]);
      setObra(obraData as any);
      setFotos(fotosData || []);
      setGarantias(garantiasData || []);
      setTarefas(tarefasData || []);
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

      {tarefas.length > 0 && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-ink-700 mb-4">Cronograma</h3>
          <div className="space-y-4">
            {tarefas.map((t) => (
              <div key={t.id} className="flex items-start gap-3">
                {t.estado === 'concluida' ? (
                  <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                ) : t.estado === 'em_curso' ? (
                  <Loader2 size={18} className="text-blue-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle size={18} className="text-ink-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${t.estado === 'concluida' ? 'text-ink-500 line-through' : 'text-ink-800'}`}>{t.titulo}</p>
                  <p className="text-xs text-ink-400">{new Date(t.data_inicio).toLocaleDateString('pt-PT')} – {new Date(t.data_fim_prevista).toLocaleDateString('pt-PT')}</p>
                  {fotos.some((f) => f.tarefa_id === t.id) && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {fotos.filter((f) => f.tarefa_id === t.id).map((f) => (
                        <img key={f.id} src={f.url} alt={f.legenda || ''} className="w-12 h-12 object-cover rounded-md border border-sand-200" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {garantias.length > 0 && (
        <div className="card p-6 mt-6">
          <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><ShieldCheck size={16} /> Garantias</h3>
          <div className="space-y-2">
            {garantias.map((g) => {
              const fim = calcularFimGarantia(g);
              const valida = fim ? fim.getTime() >= Date.now() : null;
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 p-3 border border-sand-200 rounded-lg text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-800">
                      {g.equipamento}
                      {g.marca_modelo && <span className="text-ink-400 font-normal"> · {g.marca_modelo}</span>}
                    </p>
                    <p className="text-xs text-ink-400">
                      {fim ? (valida ? `Válida até ${fim.toLocaleDateString('pt-PT')}` : `Expirou em ${fim.toLocaleDateString('pt-PT')}`) : 'Sem data de compra definida'}
                      {g.anexo_url && <> · <a href={g.anexo_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{g.anexo_nome || 'documento'}</a></>}
                    </p>
                  </div>
                  {valida !== null && (
                    <span className={`badge shrink-0 ${valida ? 'bg-green-100 text-green-700' : 'bg-sand-100 text-ink-500'}`}>{valida ? 'Válida' : 'Expirada'}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
