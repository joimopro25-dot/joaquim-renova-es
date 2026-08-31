'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Loader2, Camera, X, Send } from 'lucide-react';

type Foto = { id: string; url: string; legenda: string | null; mensagem_id: string | null };
type Mensagem = { id: string; role: 'user' | 'assistant'; conteudo: string; criado_em: string };
type FotoPendente = { url: string; legenda: string };
type LinhaProposta = {
  capitulo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  tipo_linha: 'material' | 'mao_obra';
  preco_unitario: number;
};

function extrairLinhasPropostas(texto: string): LinhaProposta[] | null {
  const match = texto.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const dados = JSON.parse(match[1].trim());
    return Array.isArray(dados) ? dados : null;
  } catch {
    return null;
  }
}

export function textoSemJson(texto: string): string {
  return texto.replace(/```json\s*[\s\S]*?```/i, '').trim();
}

export default function ConsultoriaChat({
  consultoriaId,
  clienteId,
  tituloDefault,
  permitirOrcamento,
  contexto,
  onConsultoriaCriada,
  onLinhasPropostas,
}: {
  consultoriaId: string | null;
  clienteId: string | null;
  tituloDefault: string;
  permitirOrcamento: boolean;
  contexto?: string;
  onConsultoriaCriada?: (id: string) => void;
  onLinhasPropostas?: (linhas: LinhaProposta[]) => void;
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [fotosPorMensagem, setFotosPorMensagem] = useState<Record<string, Foto[]>>({});
  const [loading, setLoading] = useState(false);
  const [inputTexto, setInputTexto] = useState('');
  const [fotosPendentes, setFotosPendentes] = useState<FotoPendente[]>([]);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aPensar, setAPensar] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef<HTMLDivElement>(null);

  async function carregar(id: string) {
    setLoading(true);
    const [{ data: msgs }, { data: fotos }] = await Promise.all([
      supabase.from('consultoria_mensagens').select('*').eq('consultoria_id', id).order('criado_em'),
      supabase.from('consultoria_fotos').select('*').eq('consultoria_id', id).order('criado_em'),
    ]);
    setMensagens(msgs || []);
    const agrupado: Record<string, Foto[]> = {};
    for (const f of fotos || []) {
      const chave = f.mensagem_id || '_sem_mensagem';
      (agrupado[chave] ||= []).push(f);
    }
    setFotosPorMensagem(agrupado);
    setLoading(false);
  }

  useEffect(() => {
    if (consultoriaId) carregar(consultoriaId);
  }, [consultoriaId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aPensar]);

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiros = e.target.files;
    if (!ficheiros || ficheiros.length === 0) return;
    setAEnviarFoto(true);
    for (const ficheiro of Array.from(ficheiros)) {
      const path = `${consultoriaId || 'temp'}/${Date.now()}-${ficheiro.name}`;
      const { error } = await supabase.storage.from('consultorias').upload(path, ficheiro);
      if (error) { alert('Erro ao enviar foto: ' + error.message); continue; }
      const url = supabase.storage.from('consultorias').getPublicUrl(path).data.publicUrl;
      setFotosPendentes((prev) => [...prev, { url, legenda: '' }]);
    }
    setAEnviarFoto(false);
    e.target.value = '';
  }

  function atualizarLegendaPendente(idx: number, legenda: string) {
    setFotosPendentes((prev) => prev.map((f, i) => (i === idx ? { ...f, legenda } : f)));
  }

  function removerFotoPendente(idx: number) {
    setFotosPendentes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function enviarMensagem(e: React.FormEvent) {
    e.preventDefault();
    if (!inputTexto.trim() && fotosPendentes.length === 0) return;
    setErro('');
    setAPensar(true);

    try {
      let idAtual = consultoriaId;
      if (!idAtual) {
        if (!clienteId) throw new Error('Sem cliente associado — não é possível iniciar a consultoria.');
        const { data: novaConsultoria, error: consError } = await supabase
          .from('consultorias')
          .insert([{ cliente_id: clienteId, titulo: tituloDefault }])
          .select()
          .single();
        if (consError) throw new Error(consError.message);
        idAtual = novaConsultoria.id;
        onConsultoriaCriada?.(idAtual!);
      }

      const { data: novaMensagem, error: msgError } = await supabase
        .from('consultoria_mensagens')
        .insert([{ consultoria_id: idAtual, role: 'user', conteudo: inputTexto || '(fotos anexadas)' }])
        .select()
        .single();
      if (msgError) throw new Error(msgError.message);

      if (fotosPendentes.length > 0) {
        await supabase.from('consultoria_fotos').insert(
          fotosPendentes.map((f) => ({ consultoria_id: idAtual, mensagem_id: novaMensagem.id, url: f.url, legenda: f.legenda || null }))
        );
      }

      const historicoCompleto = [...mensagens, novaMensagem as Mensagem];
      const fotosAtualizadas = { ...fotosPorMensagem, [novaMensagem.id]: fotosPendentes.map((f) => ({ id: '', url: f.url, legenda: f.legenda, mensagem_id: novaMensagem.id })) };
      setMensagens(historicoCompleto);
      setFotosPorMensagem(fotosAtualizadas);
      setInputTexto('');
      setFotosPendentes([]);

      const mensagensParaApi = historicoCompleto.map((m) => ({
        role: m.role,
        texto: m.conteudo,
        fotos: (fotosAtualizadas[m.id] || []).map((f) => ({ url: f.url, legenda: f.legenda })),
      }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada, atualiza a página.');

      const resp = await fetch('/api/consultorias/assistente', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mensagens: mensagensParaApi, contexto, permitirOrcamento }),
      });
      let json: any;
      try {
        json = await resp.json();
      } catch {
        throw new Error(`Resposta inesperada do servidor (${resp.status}). Pode ter demorado demasiado tempo — tenta uma descrição mais curta ou menos fotos.`);
      }
      if (!resp.ok) throw new Error(json.error || 'Erro ao falar com o assistente.');

      const { data: mensagemAssistente, error: assError } = await supabase
        .from('consultoria_mensagens')
        .insert([{ consultoria_id: idAtual, role: 'assistant', conteudo: json.resposta }])
        .select()
        .single();
      if (assError) throw new Error(assError.message);

      setMensagens((prev) => [...prev, mensagemAssistente as Mensagem]);

      if (permitirOrcamento) {
        const propostas = extrairLinhasPropostas(json.resposta);
        if (propostas && propostas.length > 0) onLinhasPropostas?.(propostas);
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao falar com o assistente.');
    } finally {
      setAPensar(false);
    }
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-6 text-ink-300 text-sm">A carregar...</div>
      ) : (
        <div className="space-y-3 mb-3 max-h-[480px] overflow-y-auto pr-1">
          {mensagens.length === 0 && (
            <p className="text-xs text-ink-400 text-center py-6">
              Descreve o trabalho e/ou envia fotos do local para começares.
            </p>
          )}
          {mensagens.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-sand-50 text-ink-800 border border-sand-200'}`}>
                {(fotosPorMensagem[m.id] || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {fotosPorMensagem[m.id].map((f, i) => (
                      <div key={f.id || i}>
                        <img src={f.url} className="w-24 h-24 object-cover rounded-md border border-white/30" />
                        {f.legenda && <p className="text-[10px] opacity-80 mt-0.5 max-w-24">{f.legenda}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' ? textoSemJson(m.conteudo) : m.conteudo}
              </div>
            </div>
          ))}
          {aPensar && (
            <div className="flex justify-start">
              <div className="bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm text-ink-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> A pensar...
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>
      )}

      {fotosPendentes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 border border-sand-200 rounded-lg p-2 bg-sand-50">
          {fotosPendentes.map((f, i) => (
            <div key={i} className="relative">
              <img src={f.url} className="w-16 h-16 object-cover rounded-md" />
              <button type="button" onClick={() => removerFotoPendente(i)} className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-sand-300 text-ink-500 hover:text-red-600"><X size={12} /></button>
              <input
                type="text"
                placeholder="Legenda"
                value={f.legenda}
                onChange={(e) => atualizarLegendaPendente(i, e.target.value)}
                className="input text-[10px] mt-1 w-16 p-1"
              />
            </div>
          ))}
        </div>
      )}

      {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}

      <form onSubmit={enviarMensagem} className="flex gap-2 items-end">
        <label className="border border-sand-200 rounded-lg p-2.5 cursor-pointer text-ink-500 hover:bg-sand-50 shrink-0" title="Anexar fotos">
          {aEnviarFoto ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          <input type="file" accept="image/*" multiple className="hidden" disabled={aEnviarFoto} onChange={enviarFoto} />
        </label>
        <textarea
          value={inputTexto}
          onChange={(e) => setInputTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(e); } }}
          placeholder="Descreve o trabalho..."
          className="input flex-1 resize-none"
          rows={1}
        />
        <button disabled={aPensar} className="btn-primary py-2.5 disabled:opacity-60 shrink-0">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
