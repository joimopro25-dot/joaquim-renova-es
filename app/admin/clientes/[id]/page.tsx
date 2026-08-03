'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { ArrowLeft, Briefcase, HardHat, FileText, Mail as MailIcon, Tag } from 'lucide-react';

type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  morada: string | null;
  data_nascimento: string | null;
};

type Obra = { id: string; titulo: string; status: string; valor_total: number | null };
type Subempreitada = { id: string; descricao: string; estado: string; tipo_valor: string; valor_unitario: number };
type Orcamento = { id: string; titulo: string; status: string };
type Email = { id: string; direcao: string; assunto: string; data: string; lida: boolean; obra_id: string | null };

const ESTADOS_OBRA: Record<string, { label: string; color: string }> = {
  orcamento: { label: 'Orçamento', color: 'bg-sand-100 text-ink-600' },
  em_curso: { label: 'Em Curso', color: 'bg-blue-100 text-blue-700' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

const ESTADOS_ORCAMENTO: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-sand-100 text-ink-600' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido em Obra', color: 'bg-purple-100 text-purple-700' },
};

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [subempreitadas, setSubempreitadas] = useState<Subempreitada[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nif, setNif] = useState('');
  const [morada, setMorada] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: clienteData } = await supabase.from('clientes').select('*').eq('id', id).single();
    setCliente(clienteData as any);
    if (clienteData) {
      setNome(clienteData.nome || '');
      setEmail(clienteData.email || '');
      setTelefone(clienteData.telefone || '');
      setNif(clienteData.nif || '');
      setMorada(clienteData.morada || '');
      setDataNascimento(clienteData.data_nascimento || '');
    }

    const [{ data: obrasData }, { data: subsData }, { data: orcData }] = await Promise.all([
      supabase.from('obras').select('id, titulo, status, valor_total').eq('cliente_id', id).order('criado_em', { ascending: false }),
      supabase.from('subempreitadas').select('id, descricao, estado, tipo_valor, valor_unitario').eq('cliente_id', id).order('criado_em', { ascending: false }),
      supabase.from('orcamentos').select('id, titulo, status').eq('cliente_id', id).order('criado_em', { ascending: false }),
    ]);
    setObras(obrasData || []);
    setSubempreitadas(subsData || []);
    setOrcamentos(orcData || []);

    if (clienteData?.email) {
      const { data: emailsData } = await supabase
        .from('emails')
        .select('id, direcao, assunto, data, lida, obra_id')
        .or(`de.eq.${clienteData.email},para.eq.${clienteData.email}`)
        .order('data', { ascending: false });
      setEmails(emailsData || []);
    } else {
      setEmails([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from('clientes').update({
      nome, email: email || null, telefone: telefone || null, nif: nif || null,
      morada: morada || null, data_nascimento: dataNascimento || null,
    }).eq('id', id);
    setGuardando(false);
    if (error) { alert('Erro: ' + error.message); return; }
    carregar();
  }

  async function etiquetarEmail(emailId: string, obraId: string) {
    await supabase.from('emails').update({ obra_id: obraId || null }).eq('id', emailId);
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, obra_id: obraId || null } : e)));
  }

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!cliente) return <div className="p-8 text-center text-ink-400 text-sm">Cliente não encontrado.</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <button onClick={() => router.push('/admin/clientes')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar a Clientes
      </button>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-heading font-semibold text-ink-800 mb-4">{cliente.nome}</h2>
        <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input" />
          <input type="text" placeholder="NIF" value={nif} onChange={(e) => setNif(e.target.value)} className="input" />
          <input type="text" placeholder="Morada" value={morada} onChange={(e) => setMorada(e.target.value)} className="input md:col-span-2" />
          <div>
            <label className="text-xs text-ink-400 uppercase tracking-wide">Data de nascimento</label>
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="input w-full mt-1" />
          </div>
          <button disabled={guardando} className="btn-primary justify-center md:col-span-2 self-end disabled:opacity-60">
            {guardando ? 'A guardar...' : 'Guardar Alterações'}
          </button>
        </form>
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><Briefcase size={16} /> Obras</h3>
        {obras.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Sem obras associadas.</p>
        ) : (
          <div className="space-y-2">
            {obras.map((o) => {
              const info = ESTADOS_OBRA[o.status] || ESTADOS_OBRA.orcamento;
              return (
                <Link key={o.id} href={`/admin/obras/${o.id}`} className="flex items-center justify-between p-3 border border-sand-200 rounded-lg hover:bg-sand-50 transition-colors text-sm">
                  <span className="font-medium text-ink-800">{o.titulo}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-500">{o.valor_total ? formatMoney(o.valor_total) : '—'}</span>
                    <span className={`badge ${info.color}`}>{info.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><HardHat size={16} /> Prestação de Serviços</h3>
        {subempreitadas.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Sem subempreitadas associadas.</p>
        ) : (
          <div className="space-y-2">
            {subempreitadas.map((s) => (
              <Link key={s.id} href={`/admin/subempreitadas/${s.id}`} className="flex items-center justify-between p-3 border border-sand-200 rounded-lg hover:bg-sand-50 transition-colors text-sm">
                <span className="font-medium text-ink-800">{s.descricao}</span>
                <div className="flex items-center gap-3">
                  <span className="text-ink-500">{formatMoney(s.valor_unitario)}{s.tipo_valor !== 'fixo' ? `/${s.tipo_valor === 'hora' ? 'h' : 'dia'}` : ''}</span>
                  <span className={`badge ${s.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.estado === 'pago' ? 'Pago' : 'Pendente'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><FileText size={16} /> Orçamentos</h3>
        {orcamentos.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Sem orçamentos associados.</p>
        ) : (
          <div className="space-y-2">
            {orcamentos.map((o) => {
              const info = ESTADOS_ORCAMENTO[o.status] || ESTADOS_ORCAMENTO.rascunho;
              return (
                <Link key={o.id} href={`/admin/orcamentos/${o.id}`} className="flex items-center justify-between p-3 border border-sand-200 rounded-lg hover:bg-sand-50 transition-colors text-sm">
                  <span className="font-medium text-ink-800">{o.titulo}</span>
                  <span className={`badge ${info.color}`}>{info.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><MailIcon size={16} /> Emails Trocados</h3>
        {!cliente.email ? (
          <p className="text-sm text-ink-400 text-center py-4">Este cliente não tem email registado.</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem emails trocados com este cliente.</p>
        ) : (
          <div className="space-y-2">
            {emails.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 p-3 border border-sand-200 rounded-lg text-sm">
                <Link href={`/admin/email/${e.id}`} className="min-w-0 flex-1 hover:text-brand-600">
                  <p className={`truncate ${!e.lida && e.direcao === 'recebido' ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>{e.assunto}</p>
                  <p className="text-xs text-ink-400">{e.direcao === 'recebido' ? 'Recebido' : 'Enviado'} · {new Date(e.data).toLocaleDateString('pt-PT')}</p>
                </Link>
                {obras.length > 1 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Tag size={13} className="text-ink-300" />
                    <select
                      value={e.obra_id || ''}
                      onChange={(ev) => etiquetarEmail(e.id, ev.target.value)}
                      className="input py-1 text-xs w-36"
                    >
                      <option value="">Sem etiqueta</option>
                      {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
