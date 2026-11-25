'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { ArrowLeft, Briefcase, HardHat, FileText, Mail as MailIcon, Tag, Home, Plus, Trash2, KeyRound } from 'lucide-react';

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
type Orcamento = { id: string; titulo: string; status: string; imovel_id: string | null };
type Imovel = { id: string; nome: string; morada: string | null; tipo: string | null };
type Email = { id: string; direcao: string; assunto: string; data: string; lida: boolean; obra_id: string | null };
type ContactoAcesso = { id: string; nome: string | null; email: string };

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
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [showFormImovel, setShowFormImovel] = useState(false);
  const [nomeImovel, setNomeImovel] = useState('');
  const [moradaImovel, setMoradaImovel] = useState('');
  const [tipoImovel, setTipoImovel] = useState('');
  const [aCriarImovel, setACriarImovel] = useState(false);

  const [contactosAcesso, setContactosAcesso] = useState<ContactoAcesso[]>([]);
  const [showFormAcesso, setShowFormAcesso] = useState(false);
  const [nomeAcesso, setNomeAcesso] = useState('');
  const [emailAcesso, setEmailAcesso] = useState('');
  const [aConvidarAcesso, setAConvidarAcesso] = useState(false);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
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

    const [{ data: obrasData }, { data: subsData }, { data: orcData }, { data: imoveisData }, { data: contactosData }] = await Promise.all([
      supabase.from('obras').select('id, titulo, status, valor_total').eq('cliente_id', id).order('criado_em', { ascending: false }),
      supabase.from('subempreitadas').select('id, descricao, estado, tipo_valor, valor_unitario').eq('cliente_id', id).order('criado_em', { ascending: false }),
      supabase.from('orcamentos').select('id, titulo, status, imovel_id').eq('cliente_id', id).order('criado_em', { ascending: false }),
      supabase.from('imoveis').select('id, nome, morada, tipo').eq('cliente_id', id).order('criado_em'),
      supabase.from('cliente_contactos').select('id, nome, email').eq('cliente_id', id).order('criado_em'),
    ]);
    setObras(obrasData || []);
    setSubempreitadas(subsData || []);
    setOrcamentos(orcData || []);
    setImoveis(imoveisData || []);
    setContactosAcesso(contactosData || []);

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

  async function criarImovel(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeImovel.trim()) return;
    setACriarImovel(true);
    const { error } = await supabase.from('imoveis').insert([{ cliente_id: id, nome: nomeImovel, morada: moradaImovel || null, tipo: tipoImovel || null }]);
    setACriarImovel(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setNomeImovel(''); setMoradaImovel(''); setTipoImovel(''); setShowFormImovel(false);
    carregar();
  }

  async function removerImovel(imovelId: string) {
    if (!confirm('Remover este imóvel? Os orçamentos ligados a ele deixam de estar associados a nenhum imóvel.')) return;
    await supabase.from('imoveis').delete().eq('id', imovelId);
    carregar();
  }

  async function convidarAcesso(e: React.FormEvent) {
    e.preventDefault();
    if (!emailAcesso.trim()) return;
    setAConvidarAcesso(true);
    const emailLimpo = emailAcesso.trim();
    const { data: sessao } = await supabase.auth.getSession();
    const resp = await fetch('/api/convidar-cliente', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessao.session?.access_token}` },
      body: JSON.stringify({ clienteId: id, email: emailLimpo }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      setAConvidarAcesso(false);
      alert('Erro ao enviar convite: ' + json.error);
      return;
    }
    await supabase.from('cliente_contactos').insert([{ cliente_id: id, nome: nomeAcesso.trim() || null, email: emailLimpo }]);
    setNomeAcesso(''); setEmailAcesso(''); setShowFormAcesso(false);
    setAConvidarAcesso(false);
    alert(json.reenviado ? 'Já tinha conta — foi enviado um link para repor a password.' : 'Convite enviado com sucesso!');
    carregar();
  }

  async function reenviarAcesso(contacto: ContactoAcesso) {
    if (!confirm(`Reenviar acesso ao portal para ${contacto.email}?`)) return;
    setReenviandoId(contacto.id);
    const { data: sessao } = await supabase.auth.getSession();
    const resp = await fetch('/api/convidar-cliente', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessao.session?.access_token}` },
      body: JSON.stringify({ clienteId: id, email: contacto.email }),
    });
    const json = await resp.json();
    setReenviandoId(null);
    if (!resp.ok) { alert('Erro ao reenviar: ' + json.error); return; }
    alert(json.reenviado ? 'Link de reposição de password enviado.' : 'Convite enviado com sucesso!');
  }

  async function removerAcesso(contactoId: string) {
    if (!confirm('Remover este acesso da lista? (não apaga a conta já criada, só a referência aqui)')) return;
    await supabase.from('cliente_contactos').delete().eq('id', contactoId);
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><Home size={16} /> Imóveis</h3>
          <button onClick={() => setShowFormImovel((v) => !v)} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"><Plus size={14} /> Novo Imóvel</button>
        </div>
        {showFormImovel && (
          <form onSubmit={criarImovel} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 p-3 bg-sand-50 rounded-lg">
            <input type="text" placeholder="Nome (ex: Casa de Famalicão)" value={nomeImovel} onChange={(e) => setNomeImovel(e.target.value)} className="input md:col-span-2" required />
            <input type="text" placeholder="Morada (opcional)" value={moradaImovel} onChange={(e) => setMoradaImovel(e.target.value)} className="input" />
            <input type="text" placeholder="Tipo (ex: Moradia)" value={tipoImovel} onChange={(e) => setTipoImovel(e.target.value)} className="input" />
            <button disabled={aCriarImovel} className="btn-primary justify-center md:col-span-4 disabled:opacity-60">{aCriarImovel ? 'A criar...' : 'Criar Imóvel'}</button>
          </form>
        )}
        {imoveis.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem imóveis registados para este cliente.</p>
        ) : (
          <div className="space-y-2">
            {imoveis.map((im) => (
              <div key={im.id} className="flex items-center justify-between p-3 border border-sand-200 rounded-lg text-sm">
                <div>
                  <p className="font-medium text-ink-800">{im.nome}{im.tipo && <span className="text-ink-400 font-normal"> · {im.tipo}</span>}</p>
                  {im.morada && <p className="text-xs text-ink-400">{im.morada}</p>}
                </div>
                <button onClick={() => removerImovel(im.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><KeyRound size={16} /> Acessos ao Portal</h3>
          <button onClick={() => setShowFormAcesso((v) => !v)} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"><Plus size={14} /> Dar Acesso</button>
        </div>
        <p className="text-xs text-ink-400 mb-4">Dá acesso ao portal a quem precisar de ver as obras deste cliente (ex: o próprio e o cônjuge), cada um com o seu email.</p>
        {showFormAcesso && (
          <form onSubmit={convidarAcesso} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 p-3 bg-sand-50 rounded-lg">
            <input type="text" placeholder="Nome (ex: Esposa do Fábio)" value={nomeAcesso} onChange={(e) => setNomeAcesso(e.target.value)} className="input" />
            <input type="email" placeholder="Email" value={emailAcesso} onChange={(e) => setEmailAcesso(e.target.value)} className="input" required />
            <button disabled={aConvidarAcesso} className="btn-primary justify-center disabled:opacity-60">{aConvidarAcesso ? 'A enviar...' : 'Enviar Convite'}</button>
          </form>
        )}
        {contactosAcesso.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem acessos dados a este cliente.</p>
        ) : (
          <div className="space-y-2">
            {contactosAcesso.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 border border-sand-200 rounded-lg text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink-800">{c.nome || c.email}</p>
                  {c.nome && <p className="text-xs text-ink-400">{c.email}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => reenviarAcesso(c)} disabled={reenviandoId === c.id} className="text-xs text-brand-600 hover:underline disabled:opacity-60">
                    {reenviandoId === c.id ? 'A enviar...' : 'Reenviar'}
                  </button>
                  <button onClick={() => removerAcesso(c.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                  <span>
                    <span className="font-medium text-ink-800">{o.titulo}</span>
                    {o.imovel_id && <span className="text-ink-400"> · {imoveis.find((im) => im.id === o.imovel_id)?.nome || 'imóvel'}</span>}
                  </span>
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
