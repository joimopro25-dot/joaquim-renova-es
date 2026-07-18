'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Inbox, UserPlus, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

type ZonaLead = { zona: string; label: string; area: string | null; intervencoes: string[]; notas: string | null };
type Lead = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo_obra: string | null;
  mensagem: string | null;
  estado: string;
  zonas: ZonaLead[] | null;
  criado_em: string;
};

const ESTADOS = [
  { value: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { value: 'contactado', label: 'Contactado', color: 'bg-amber-100 text-amber-700' },
  { value: 'convertido', label: 'Convertido', color: 'bg-green-100 text-green-700' },
  { value: 'descartado', label: 'Descartado', color: 'bg-sand-100 text-ink-500' },
];

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('criado_em', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function mudarEstado(id: string, estado: string) {
    await supabase.from('leads').update({ estado }).eq('id', id);
    carregar();
  }

  async function obterOuCriarCliente(lead: Lead): Promise<string | null> {
    if (lead.email) {
      const { data: existente } = await supabase.from('clientes').select('id').ilike('email', lead.email).maybeSingle();
      if (existente) return existente.id;
    }
    const { data: novo, error } = await supabase.from('clientes').insert([{ nome: lead.nome, email: lead.email, telefone: lead.telefone }]).select().single();
    if (error) { alert('Erro ao criar cliente: ' + error.message); return null; }
    return novo.id;
  }

  async function converterEmCliente(lead: Lead) {
    const clienteId = await obterOuCriarCliente(lead);
    if (!clienteId) return;
    await supabase.from('leads').update({ estado: 'convertido' }).eq('id', lead.id);
    carregar();
  }

  async function gerarEsbocoOrcamento(lead: Lead) {
    setGerando(lead.id);
    const clienteId = await obterOuCriarCliente(lead);
    if (!clienteId) { setGerando(null); return; }

    const { data: orcamento, error: orcError } = await supabase.from('orcamentos').insert([{
      cliente_id: clienteId,
      titulo: `Pedido de ${lead.nome}`,
      status: 'rascunho',
    }]).select().single();
    if (orcError) { alert('Erro ao criar orçamento: ' + orcError.message); setGerando(null); return; }

    const zonas = lead.zonas || [];
    for (const z of zonas) {
      const intervencoes = z.intervencoes.length > 0 ? z.intervencoes : ['A definir'];
      for (const intervencao of intervencoes) {
        await supabase.from('orcamento_linhas').insert([{
          orcamento_id: orcamento.id,
          capitulo: z.label,
          descricao: intervencao,
          unidade: 'un',
          quantidade: z.area ? parseFloat(z.area) : 1,
          rendimento_horas: 0,
          custo_material: 0,
        }]);
      }
    }

    await supabase.from('leads').update({ estado: 'convertido' }).eq('id', lead.id);
    setGerando(null);
    router.push(`/admin/orcamentos/${orcamento.id}`);
  }

  async function remover(id: string) {
    if (!confirm('Remover este lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    carregar();
  }

  return (
    <div className="p-4 md:p-8">
      <p className="text-sm text-ink-400 mb-6">{leads.length} pedido{leads.length !== 1 ? 's' : ''} de contacto vindo{leads.length !== 1 ? 's' : ''} do website</p>

      <div className="space-y-3">
        {loading ? (
          <div className="card p-10 text-center text-ink-300 text-sm">A carregar...</div>
        ) : leads.length === 0 ? (
          <div className="card p-10 text-center text-ink-400 text-sm">
            <Inbox size={28} className="mx-auto mb-2 text-ink-200" />
            Ainda sem pedidos de contacto.
          </div>
        ) : (
          leads.map((l) => {
            const temZonas = l.zonas && l.zonas.length > 0;
            const expandido = aberto === l.id;
            return (
              <div key={l.id} className="card overflow-hidden">
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink-800">{l.nome}</p>
                      <select
                        value={l.estado}
                        onChange={(e) => mudarEstado(l.id, e.target.value)}
                        className={`badge border-0 outline-none cursor-pointer text-[11px] ${ESTADOS.find((e) => e.value === l.estado)?.color}`}
                      >
                        {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </div>
                    <p className="text-sm text-ink-400">{l.email || '—'} {l.telefone && `· ${l.telefone}`}</p>
                    {l.tipo_obra && <p className="text-xs text-ink-400 mt-0.5">{l.tipo_obra}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {temZonas && (
                      <button onClick={() => setAberto(expandido ? null : l.id)} className="text-sm text-ink-500 hover:text-ink-800 flex items-center gap-1">
                        Detalhe {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    {l.estado !== 'convertido' && (
                      <>
                        {temZonas && (
                          <button onClick={() => gerarEsbocoOrcamento(l)} disabled={gerando === l.id} className="text-brand-600 hover:text-brand-700 text-sm flex items-center gap-1 disabled:opacity-50">
                            <FileText size={15} /> {gerando === l.id ? 'A gerar...' : 'Gerar Esboço de Orçamento'}
                          </button>
                        )}
                        <button onClick={() => converterEmCliente(l)} className="text-ink-500 hover:text-brand-700" title="Converter em Cliente">
                          <UserPlus size={16} />
                        </button>
                      </>
                    )}
                    <button onClick={() => remover(l.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </div>

                {expandido && temZonas && (
                  <div className="border-t border-sand-100 bg-sand-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {l.zonas!.map((z, idx) => (
                      <div key={idx} className="bg-white rounded-lg border border-sand-200 p-3 text-sm">
                        <p className="font-medium text-ink-800">{z.label} {z.area && <span className="text-ink-400 font-normal">· {z.area} m²</span>}</p>
                        {z.intervencoes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {z.intervencoes.map((i) => <span key={i} className="badge bg-sand-100 text-ink-600 text-[10px]">{i}</span>)}
                          </div>
                        )}
                        {z.notas && <p className="text-xs text-ink-400 mt-1.5">{z.notas}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {l.mensagem && (
                  <div className="border-t border-sand-100 px-4 py-2 text-xs text-ink-400">{l.mensagem}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
