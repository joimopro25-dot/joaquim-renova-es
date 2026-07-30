'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Inbox, Send, Plus, Paperclip, X, Mail as MailIcon, PenLine } from 'lucide-react';

type Email = {
  id: string;
  direcao: string;
  de: string;
  de_nome: string | null;
  para: string;
  cc: string | null;
  assunto: string;
  corpo_texto: string | null;
  lida: boolean;
  data: string;
};

type Cliente = { id: string; nome: string; email: string | null };
type AnexoNovo = { nome: string; url: string };

export default function EmailPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'recebido' | 'enviado'>('recebido');
  const [emails, setEmails] = useState<Email[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompor, setShowCompor] = useState(false);
  const [showAssinatura, setShowAssinatura] = useState(false);

  const [para, setPara] = useState('');
  const [cc, setCc] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [anexos, setAnexos] = useState<AnexoNovo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aEnviarFicheiro, setAEnviarFicheiro] = useState(false);
  const [erro, setErro] = useState('');

  const [assinatura, setAssinatura] = useState('');
  const [assinaturaHtmlAvancado, setAssinaturaHtmlAvancado] = useState(false);
  const [assinaturaGuardando, setAssinaturaGuardando] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('emails')
      .select('id, direcao, de, de_nome, para, cc, assunto, corpo_texto, lida, data')
      .eq('direcao', tab)
      .order('data', { ascending: false });
    setEmails(data || []);
    setLoading(false);
  }

  async function carregarClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, email').not('email', 'is', null).order('nome');
    setClientes(data || []);
  }

  async function carregarAssinatura() {
    const { data } = await supabase.from('email_assinatura').select('assinatura_html').eq('id', 1).maybeSingle();
    const html = data?.assinatura_html || '';
    setAssinatura(html);
    setAssinaturaHtmlAvancado(html.includes('<'));
  }

  useEffect(() => { carregar(); }, [tab]);
  useEffect(() => { carregarClientes(); carregarAssinatura(); }, []);

  function resetCompor() {
    setPara(''); setCc(''); setAssunto(''); setCorpo(''); setAnexos([]); setErro('');
    setShowCompor(false);
  }

  async function anexarFicheiro(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setAEnviarFicheiro(true);
    const path = `${Date.now()}-${ficheiro.name}`;
    const { error } = await supabase.storage.from('emails').upload(path, ficheiro);
    if (error) { alert('Erro ao anexar: ' + error.message); setAEnviarFicheiro(false); return; }
    const url = supabase.storage.from('emails').getPublicUrl(path).data.publicUrl;
    setAnexos((prev) => [...prev, { nome: ficheiro.name, url }]);
    setAEnviarFicheiro(false);
    e.target.value = '';
  }

  function removerAnexo(nome: string) {
    setAnexos((prev) => prev.filter((a) => a.nome !== nome));
  }

  async function guardarAssinatura(e: React.FormEvent) {
    e.preventDefault();
    setAssinaturaGuardando(true);
    await supabase.from('email_assinatura').upsert([{ id: 1, assinatura_html: assinatura || null }]);
    setAssinaturaGuardando(false);
    setShowAssinatura(false);
  }

  async function enviarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErro('Sessão expirada, atualiza a página.'); setEnviando(false); return; }

    let corpoHtml = `<p>${corpo.split('\n').map((l) => l || '&nbsp;').join('</p><p>')}</p>`;
    if (assinatura) {
      corpoHtml += assinaturaHtmlAvancado ? assinatura : `<p>${assinatura.split('\n').map((l) => l || '&nbsp;').join('</p><p>')}</p>`;
    }

    const resp = await fetch('/api/email/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ para, cc: cc || null, assunto, corpoHtml, anexos }),
    });
    const json = await resp.json();
    setEnviando(false);
    if (!resp.ok) { setErro(json.error || 'Erro ao enviar.'); return; }

    resetCompor();
    if (tab === 'enviado') carregar();
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2 border-b border-sand-200">
          <button
            onClick={() => setTab('recebido')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'recebido' ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-400 hover:text-ink-700'}`}
          >
            <Inbox size={16} /> Caixa de Entrada
          </button>
          <button
            onClick={() => setTab('enviado')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'enviado' ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-400 hover:text-ink-700'}`}
          >
            <Send size={16} /> Enviados
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAssinatura((v) => !v)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100">
            <PenLine size={16} /> Assinatura
          </button>
          <button onClick={() => setShowCompor((v) => !v)} className="btn-primary">
            <Plus size={18} /> Novo Email
          </button>
        </div>
      </div>

      {showAssinatura && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-ink-700 mb-1">Assinatura</h2>
          <p className="text-xs text-ink-400 mb-4">Adicionada automaticamente ao fim de todos os emails enviados e respostas.</p>
          <form onSubmit={guardarAssinatura} className="space-y-3">
            <textarea
              placeholder={'Ex:\nJoaquim Oliveira\nProjetar Conforto\n+351 9XX XXX XXX'}
              value={assinatura}
              onChange={(e) => setAssinatura(e.target.value)}
              className="input min-h-[140px] font-mono text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" checked={assinaturaHtmlAvancado} onChange={(e) => setAssinaturaHtmlAvancado(e.target.checked)} />
              É código HTML (colaste uma assinatura já formatada, ex: do Gmail) — não converter quebras de linha automaticamente
            </label>
            <div className="flex gap-2 pt-2 border-t border-sand-100">
              <button type="button" onClick={() => setShowAssinatura(false)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              <button disabled={assinaturaGuardando} className="btn-primary flex-1 justify-center disabled:opacity-60">{assinaturaGuardando ? 'A guardar...' : 'Guardar Assinatura'}</button>
            </div>
          </form>
        </div>
      )}

      {showCompor && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-ink-700 mb-4">Novo Email</h2>
          <form onSubmit={enviarEmail} className="space-y-3">
            <input type="email" list="clientes-email" placeholder="Para (escreve ou escolhe um cliente)" value={para} onChange={(e) => setPara(e.target.value)} className="input" required />
            <datalist id="clientes-email">
              {clientes.map((c) => <option key={c.id} value={c.email || ''}>{c.nome}</option>)}
            </datalist>
            <input type="email" placeholder="Cc (opcional)" value={cc} onChange={(e) => setCc(e.target.value)} className="input" />
            <input type="text" placeholder="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} className="input" required />
            <textarea placeholder="Escreve a mensagem..." value={corpo} onChange={(e) => setCorpo(e.target.value)} className="input min-h-[160px]" required />

            {anexos.length > 0 && (
              <div className="space-y-1">
                {anexos.map((a) => (
                  <div key={a.nome} className="flex items-center justify-between gap-2 p-2 bg-sand-50 rounded-lg text-sm">
                    <span className="flex items-center gap-1.5 text-ink-700 truncate"><Paperclip size={13} className="text-ink-300 shrink-0" /> {a.nome}</span>
                    <button type="button" onClick={() => removerAnexo(a.nome)} className="text-ink-300 hover:text-red-600 shrink-0"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <label className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 cursor-pointer inline-flex w-fit">
              <Paperclip size={15} /> {aEnviarFicheiro ? 'A anexar...' : 'Anexar Ficheiro'}
              <input type="file" className="hidden" disabled={aEnviarFicheiro} onChange={anexarFicheiro} />
            </label>

            {assinatura && <p className="text-xs text-ink-400">A tua assinatura será adicionada automaticamente ao enviar.</p>}

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex gap-2 pt-2 border-t border-sand-100">
              <button type="button" onClick={resetCompor} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
              <button disabled={enviando} className="btn-primary flex-1 justify-center disabled:opacity-60">{enviando ? 'A enviar...' : 'Enviar'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ink-300 text-sm">A carregar...</div>
        ) : emails.length === 0 ? (
          <div className="p-10 text-center text-ink-400 text-sm">
            <MailIcon size={28} className="mx-auto mb-2 text-ink-200" />
            {tab === 'recebido' ? 'Nenhum email recebido.' : 'Nenhum email enviado.'}
          </div>
        ) : (
          <div className="divide-y divide-sand-100">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => router.push(`/admin/email/${email.id}`)}
                className={`w-full flex items-center gap-4 p-4 text-left hover:bg-sand-50 transition-colors ${!email.lida && tab === 'recebido' ? 'bg-brand-50/40' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${!email.lida && tab === 'recebido' ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                    {tab === 'recebido' ? (email.de_nome || email.de) : email.para}
                  </p>
                  <p className={`text-sm truncate ${!email.lida && tab === 'recebido' ? 'font-medium text-ink-800' : 'text-ink-500'}`}>{email.assunto}</p>
                  <p className="text-xs text-ink-400 truncate">{email.corpo_texto?.slice(0, 100)}</p>
                </div>
                <span className="text-xs text-ink-400 shrink-0 whitespace-nowrap">
                  {new Date(email.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
