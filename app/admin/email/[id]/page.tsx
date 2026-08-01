'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { ArrowLeft, Reply, Paperclip, X, Eye } from 'lucide-react';

type Email = {
  id: string;
  direcao: string;
  de: string;
  de_nome: string | null;
  para: string;
  cc: string | null;
  assunto: string;
  corpo_texto: string | null;
  corpo_html: string | null;
  data: string;
  obras: { titulo: string } | null;
};

type Anexo = { id: string; nome_ficheiro: string | null; url: string };
type AnexoNovo = { nome: string; url: string };

export default function EmailDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [email, setEmail] = useState<Email | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);

  const [showResponder, setShowResponder] = useState(false);
  const [para, setPara] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [anexosNovos, setAnexosNovos] = useState<AnexoNovo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aEnviarFicheiro, setAEnviarFicheiro] = useState(false);
  const [erro, setErro] = useState('');
  const [assinatura, setAssinatura] = useState('');
  const [assinaturaHtmlAvancado, setAssinaturaHtmlAvancado] = useState(false);
  const [mensagemPadrao, setMensagemPadrao] = useState('');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    supabase.from('email_assinatura').select('assinatura_html, mensagem_padrao').eq('id', 1).maybeSingle().then(({ data }) => {
      const html = data?.assinatura_html || '';
      setAssinatura(html);
      setAssinaturaHtmlAvancado(html.includes('<'));
      setMensagemPadrao(data?.mensagem_padrao || '');
    });
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: emailData }, { data: anexosData }] = await Promise.all([
      supabase.from('emails').select('*, obras(titulo)').eq('id', id).single(),
      supabase.from('email_anexos').select('*').eq('email_id', id),
    ]);
    setEmail(emailData as any);
    setAnexos(anexosData || []);
    setLoading(false);

    if (emailData && emailData.direcao === 'recebido' && !emailData.lida) {
      await supabase.from('emails').update({ lida: true }).eq('id', id);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirResponder() {
    if (!email) return;
    setPara(email.direcao === 'recebido' ? email.de : email.para);
    setAssunto(email.assunto?.toLowerCase().startsWith('re:') ? email.assunto : `Re: ${email.assunto}`);
    setCorpo(mensagemPadrao);
    setAnexosNovos([]);
    setErro('');
    setPreviewing(false);
    setShowResponder(true);
  }

  function gerarCorpoHtml(): string {
    let corpoHtml = `<p>${corpo.split('\n').map((l) => l || '&nbsp;').join('</p><p>')}</p>`;
    if (assinatura) {
      corpoHtml += assinaturaHtmlAvancado ? assinatura : `<p>${assinatura.split('\n').map((l) => l || '&nbsp;').join('</p><p>')}</p>`;
    }
    return corpoHtml;
  }

  async function anexarFicheiro(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setAEnviarFicheiro(true);
    const path = `${Date.now()}-${ficheiro.name}`;
    const { error } = await supabase.storage.from('emails').upload(path, ficheiro);
    if (error) { alert('Erro ao anexar: ' + error.message); setAEnviarFicheiro(false); return; }
    const url = supabase.storage.from('emails').getPublicUrl(path).data.publicUrl;
    setAnexosNovos((prev) => [...prev, { nome: ficheiro.name, url }]);
    setAEnviarFicheiro(false);
    e.target.value = '';
  }

  function removerAnexo(nome: string) {
    setAnexosNovos((prev) => prev.filter((a) => a.nome !== nome));
  }

  async function enviarResposta(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErro('Sessão expirada, atualiza a página.'); setEnviando(false); return; }

    const corpoHtml = gerarCorpoHtml();

    const resp = await fetch('/api/email/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ para, assunto, corpoHtml, anexos: anexosNovos, emRespostaAId: email?.id }),
    });
    const json = await resp.json();
    setEnviando(false);
    if (!resp.ok) { setErro(json.error || 'Erro ao enviar.'); return; }

    setShowResponder(false);
    router.push('/admin/email');
  }

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!email) return <div className="p-8 text-center text-ink-400 text-sm">Email não encontrado.</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <button onClick={() => router.push('/admin/email')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-heading font-semibold text-ink-800 mb-3">
          {email.assunto}
          {email.obras?.titulo && <span className="badge bg-sand-100 text-ink-600 ml-2 text-xs align-middle">{email.obras.titulo}</span>}
        </h2>
        <div className="text-sm text-ink-500 space-y-0.5 mb-4 pb-4 border-b border-sand-100">
          <p><span className="text-ink-400">De:</span> {email.de_nome ? `${email.de_nome} <${email.de}>` : email.de}</p>
          <p><span className="text-ink-400">Para:</span> {email.para}</p>
          {email.cc && <p><span className="text-ink-400">Cc:</span> {email.cc}</p>}
          <p><span className="text-ink-400">Data:</span> {new Date(email.data).toLocaleString('pt-PT')}</p>
        </div>

        {email.corpo_html ? (
          <div className="text-ink-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: email.corpo_html }} />
        ) : (
          <p className="text-ink-700 text-sm leading-relaxed whitespace-pre-wrap">{email.corpo_texto}</p>
        )}

        {anexos.length > 0 && (
          <div className="mt-5 pt-4 border-t border-sand-100 space-y-1.5">
            <p className="text-xs text-ink-400 uppercase tracking-wide mb-1">Anexos</p>
            {anexos.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
                <Paperclip size={13} /> {a.nome_ficheiro || 'ficheiro'}
              </a>
            ))}
          </div>
        )}

        {!showResponder && (
          <button onClick={abrirResponder} className="btn-primary mt-6">
            <Reply size={16} /> Responder
          </button>
        )}
      </div>

      {showResponder && (
        <div className="card p-6">
          <h3 className="font-semibold text-ink-700 mb-4">{previewing ? 'Pré-visualização' : 'Responder'}</h3>

          {previewing ? (
            <div className="space-y-3">
              <div className="text-sm text-ink-500 space-y-0.5 pb-3 border-b border-sand-100">
                <p><span className="text-ink-400">Para:</span> {para}</p>
                <p><span className="text-ink-400">Assunto:</span> {assunto}</p>
              </div>
              <div className="border border-sand-200 rounded-lg p-4 text-sm text-ink-800" dangerouslySetInnerHTML={{ __html: gerarCorpoHtml() }} />
              {anexosNovos.length > 0 && (
                <div className="space-y-1">
                  {anexosNovos.map((a) => (
                    <p key={a.nome} className="flex items-center gap-1.5 text-sm text-ink-600"><Paperclip size={13} className="text-ink-300" /> {a.nome}</p>
                  ))}
                </div>
              )}
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2 pt-2 border-t border-sand-100">
                <button type="button" onClick={() => setPreviewing(false)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">
                  <ArrowLeft size={15} /> Voltar a Editar
                </button>
                <button onClick={enviarResposta} disabled={enviando} className="btn-primary flex-1 justify-center disabled:opacity-60">
                  {enviando ? 'A enviar...' : 'Confirmar e Enviar'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setPreviewing(true); }} className="space-y-3">
              <input type="email" placeholder="Para" value={para} onChange={(e) => setPara(e.target.value)} className="input" required />
              <input type="text" placeholder="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} className="input" required />
              <textarea placeholder="Escreve a resposta..." value={corpo} onChange={(e) => setCorpo(e.target.value)} className="input min-h-[160px]" required />

              {anexosNovos.length > 0 && (
                <div className="space-y-1">
                  {anexosNovos.map((a) => (
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

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <div className="flex gap-2 pt-2 border-t border-sand-100">
                <button type="button" onClick={() => setShowResponder(false)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100 flex-1 justify-center">Cancelar</button>
                <button className="btn-primary flex-1 justify-center">
                  <Eye size={15} /> Pré-visualizar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
