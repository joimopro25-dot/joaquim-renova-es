'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { DIVISOES, NOMES_DIVISOES } from '../lib/divisoes';
import { CheckCircle2, Send, ArrowRight, ArrowLeft } from 'lucide-react';

type ZonaDetalhe = { area: string; intervencoes: string[]; notas: string };

export default function PedidoOrcamento() {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [zonasEscolhidas, setZonasEscolhidas] = useState<string[]>([]);
  const [detalhes, setDetalhes] = useState<Record<string, ZonaDetalhe>>({});

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  function toggleZona(nomeZona: string) {
    setZonasEscolhidas((prev) => {
      if (prev.includes(nomeZona)) {
        const novo = prev.filter((z) => z !== nomeZona);
        return novo;
      }
      return [...prev, nomeZona];
    });
    setDetalhes((prev) => {
      if (prev[nomeZona]) return prev;
      return { ...prev, [nomeZona]: { area: '', intervencoes: [], notas: '' } };
    });
  }

  function toggleIntervencao(nomeZona: string, intervencao: string) {
    setDetalhes((prev) => {
      const atual = prev[nomeZona] || { area: '', intervencoes: [], notas: '' };
      const jaTem = atual.intervencoes.includes(intervencao);
      return {
        ...prev,
        [nomeZona]: {
          ...atual,
          intervencoes: jaTem ? atual.intervencoes.filter((i) => i !== intervencao) : [...atual.intervencoes, intervencao],
        },
      };
    });
  }

  function atualizarZona(nomeZona: string, campo: 'area' | 'notas', valor: string) {
    setDetalhes((prev) => ({ ...prev, [nomeZona]: { ...(prev[nomeZona] || { area: '', intervencoes: [], notas: '' }), [campo]: valor } }));
  }

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    const zonas = zonasEscolhidas.map((z) => ({
      zona: z,
      label: DIVISOES[z].label,
      area: detalhes[z]?.area || null,
      intervencoes: detalhes[z]?.intervencoes || [],
      notas: detalhes[z]?.notas || null,
    }));

    const tipoObra = zonasEscolhidas.map((z) => DIVISOES[z].label).join(', ');

    const { error } = await supabase.from('leads').insert([{ nome, email, telefone, tipo_obra: tipoObra, mensagem, zonas }]);
    setEnviando(false);
    if (error) { setErro('Não foi possível enviar. Tente novamente ou contacte-nos diretamente.'); return; }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
        <p className="font-medium text-ink-800">Pedido enviado com sucesso!</p>
        <p className="text-sm text-ink-400 mt-1">Entraremos em contacto brevemente.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-xs text-ink-400">
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-medium ${passo >= n ? 'bg-brand-500 text-white' : 'bg-sand-100 text-ink-400'}`}>{n}</span>
            {n < 3 && <span className={`flex-1 h-px ${passo > n ? 'bg-brand-500' : 'bg-sand-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {passo === 1 && (
        <div>
          <h3 className="font-semibold text-ink-800 mb-1">Que divisões quer renovar?</h3>
          <p className="text-sm text-ink-400 mb-4">Pode escolher mais do que uma, dentro ou fora de casa.</p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {NOMES_DIVISOES.map((z) => (
              <label key={z} className={`flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer transition-colors ${zonasEscolhidas.includes(z) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-sand-200 text-ink-600 hover:bg-sand-50'}`}>
                <input type="checkbox" checked={zonasEscolhidas.includes(z)} onChange={() => toggleZona(z)} className="accent-brand-500" />
                {DIVISOES[z].label}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={zonasEscolhidas.length === 0}
            onClick={() => setPasso(2)}
            className="btn-primary w-full justify-center disabled:opacity-40"
          >
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      )}

      {passo === 2 && (
        <div>
          <h3 className="font-semibold text-ink-800 mb-4">Conte-nos um pouco mais sobre cada espaço</h3>
          <div className="space-y-4 mb-6">
            {zonasEscolhidas.map((z) => (
              <div key={z} className="border border-sand-200 rounded-lg p-4">
                <p className="font-medium text-ink-800 mb-2">{DIVISOES[z].label}</p>
                <input
                  type="number"
                  placeholder="Área aproximada (m²) — opcional"
                  value={detalhes[z]?.area || ''}
                  onChange={(e) => atualizarZona(z, 'area', e.target.value)}
                  className="input w-full mb-2"
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {DIVISOES[z].opcoes.map((op) => (
                    <label key={op} className={`text-xs px-2.5 py-1.5 rounded-full border cursor-pointer transition-colors ${detalhes[z]?.intervencoes.includes(op) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-sand-200 text-ink-500 hover:bg-sand-50'}`}>
                      <input type="checkbox" className="hidden" checked={detalhes[z]?.intervencoes.includes(op) || false} onChange={() => toggleIntervencao(z, op)} />
                      {op}
                    </label>
                  ))}
                </div>
                <textarea
                  placeholder="Notas específicas para este espaço (opcional)"
                  value={detalhes[z]?.notas || ''}
                  onChange={(e) => atualizarZona(z, 'notas', e.target.value)}
                  className="input w-full"
                  rows={2}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso(1)} className="border border-sand-200 rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-sand-50 flex items-center gap-1.5">
              <ArrowLeft size={16} /> Voltar
            </button>
            <button type="button" onClick={() => setPasso(3)} className="btn-primary flex-1 justify-center">
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <form onSubmit={enviarPedido}>
          <h3 className="font-semibold text-ink-800 mb-4">Os seus dados</h3>
          <div className="space-y-3 mb-4">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input w-full" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" required />
              <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input w-full" />
            </div>
            <textarea placeholder="Algo mais que queira acrescentar? (opcional)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="input w-full" rows={3} />
          </div>
          {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso(2)} className="border border-sand-200 rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-sand-50 flex items-center gap-1.5">
              <ArrowLeft size={16} /> Voltar
            </button>
            <button type="submit" disabled={enviando} className="btn-primary flex-1 justify-center disabled:opacity-60">
              <Send size={16} /> {enviando ? 'A enviar...' : 'Enviar Pedido'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
