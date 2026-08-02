'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Send, X } from 'lucide-react';

export default function PedidoProjetoIgual({ tituloProjeto, onClose }: { tituloProjeto: string; onClose: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [medidas, setMedidas] = useState('');
  const [extras, setExtras] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!aceitouPrivacidade) { setErro('Tem de aceitar a Política de Privacidade para enviar o pedido.'); return; }
    setEnviando(true);
    setErro('');

    const partesMensagem = [
      `Pedido de orçamento para um projeto semelhante a: "${tituloProjeto}"`,
      medidas ? `Medidas pretendidas: ${medidas}` : null,
      extras ? `Extras/personalizações: ${extras}` : null,
      mensagem ? `Notas adicionais: ${mensagem}` : null,
    ].filter(Boolean);

    const { error } = await supabase.from('leads').insert([{
      nome, email, telefone,
      tipo_obra: `Projeto igual a "${tituloProjeto}"`,
      mensagem: partesMensagem.join('\n\n'),
    }]);
    setEnviando(false);
    if (error) { setErro('Não foi possível enviar. Tente novamente ou contacte-nos diretamente.'); return; }
    setEnviado(true);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-ink-800">Pedir orçamento para um projeto igual</h3>
            <p className="text-xs text-ink-400 mt-0.5">Baseado em: {tituloProjeto}</p>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-600 shrink-0"><X size={18} /></button>
        </div>

        {enviado ? (
          <div className="text-center py-8">
            <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
            <p className="font-medium text-ink-800">Pedido enviado com sucesso!</p>
            <p className="text-sm text-ink-400 mt-1">Entraremos em contacto brevemente.</p>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input w-full" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" required />
              <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input w-full" />
            </div>
            <textarea placeholder="Medidas pretendidas (ex: 2m largura x 0,80m profundidade)" value={medidas} onChange={(e) => setMedidas(e.target.value)} className="input w-full" rows={2} />
            <textarea placeholder="Extras ou personalizações (ex: cor diferente, luz LED, mais um lugar)" value={extras} onChange={(e) => setExtras(e.target.value)} className="input w-full" rows={2} />
            <textarea placeholder="Algo mais que queira acrescentar? (opcional)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="input w-full" rows={2} />
            <label className="flex items-start gap-2 text-xs text-ink-500">
              <input type="checkbox" checked={aceitouPrivacidade} onChange={(e) => setAceitouPrivacidade(e.target.checked)} className="mt-0.5" required />
              <span>
                Li e aceito a{' '}
                <Link href="/politica-privacidade" target="_blank" className="text-brand-600 hover:underline">Política de Privacidade</Link>
                {' '}quanto ao tratamento dos meus dados para resposta a este pedido.
              </span>
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button type="submit" disabled={enviando} className="btn-primary w-full justify-center disabled:opacity-60">
              <Send size={16} /> {enviando ? 'A enviar...' : 'Enviar Pedido'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
