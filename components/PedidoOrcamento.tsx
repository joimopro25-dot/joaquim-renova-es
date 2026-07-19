'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { DIVISOES, NOMES_DIVISOES } from '../lib/divisoes';
import { CheckCircle2, Send, ArrowRight, ArrowLeft, Plus, X } from 'lucide-react';

type Instancia = { id: string; tipo: string; label: string; area: string; intervencoes: string[]; notas: string };

function gerarId() {
  return Math.random().toString(36).slice(2);
}

export default function PedidoOrcamento() {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [instancias, setInstancias] = useState<Instancia[]>([]);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  function adicionarInstancia(tipo: string) {
    setInstancias((prev) => {
      const existentes = prev.filter((i) => i.tipo === tipo).length;
      const label = existentes === 0 ? DIVISOES[tipo].label : `${DIVISOES[tipo].label} ${existentes + 1}`;
      return [...prev, { id: gerarId(), tipo, label, area: '', intervencoes: [], notas: '' }];
    });
  }

  function removerInstancia(id: string) {
    setInstancias((prev) => prev.filter((i) => i.id !== id));
  }

  function atualizarInstancia(id: string, campo: 'label' | 'area' | 'notas', valor: string) {
    setInstancias((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }

  function toggleIntervencao(id: string, intervencao: string) {
    setInstancias((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const jaTem = i.intervencoes.includes(intervencao);
      return { ...i, intervencoes: jaTem ? i.intervencoes.filter((x) => x !== intervencao) : [...i.intervencoes, intervencao] };
    }));
  }

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    const zonas = instancias.map((i) => ({
      zona: i.tipo,
      label: i.label,
      area: i.area || null,
      intervencoes: i.intervencoes,
      notas: i.notas || null,
    }));

    const tipoObra = instancias.map((i) => i.label).join(', ');

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
          <p className="text-sm text-ink-400 mb-4">Clique tantas vezes quantas as divisões desse tipo (ex: 3 vezes em "Quarto" para 3 quartos).</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {NOMES_DIVISOES.map((tipo) => {
              const count = instancias.filter((i) => i.tipo === tipo).length;
              return (
                <button
                  type="button"
                  key={tipo}
                  onClick={() => adicionarInstancia(tipo)}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border text-sm text-left transition-colors ${count > 0 ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-sand-200 text-ink-600 hover:bg-sand-50'}`}
                >
                  <span className="flex items-center gap-1.5"><Plus size={14} /> {DIVISOES[tipo].label}</span>
                  {count > 0 && <span className="badge bg-brand-500 text-white text-[10px]">{count}</span>}
                </button>
              );
            })}
          </div>

          {instancias.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {instancias.map((i) => (
                <span key={i.id} className="badge bg-sand-100 text-ink-700 flex items-center gap-1.5">
                  {i.label}
                  <button type="button" onClick={() => removerInstancia(i.id)}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={instancias.length === 0}
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
            {instancias.map((i) => (
              <div key={i.id} className="border border-sand-200 rounded-lg p-4">
                <input
                  type="text"
                  value={i.label}
                  onChange={(e) => atualizarInstancia(i.id, 'label', e.target.value)}
                  className="font-medium text-ink-800 mb-2 w-full bg-transparent border-b border-transparent hover:border-sand-200 focus:border-brand-400 outline-none"
                />
                <input
                  type="number"
                  placeholder="Área aproximada (m²) — opcional"
                  value={i.area}
                  onChange={(e) => atualizarInstancia(i.id, 'area', e.target.value)}
                  className="input w-full mb-2"
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {DIVISOES[i.tipo].opcoes.map((op) => (
                    <label key={op} className={`text-xs px-2.5 py-1.5 rounded-full border cursor-pointer transition-colors ${i.intervencoes.includes(op) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-sand-200 text-ink-500 hover:bg-sand-50'}`}>
                      <input type="checkbox" className="hidden" checked={i.intervencoes.includes(op)} onChange={() => toggleIntervencao(i.id, op)} />
                      {op}
                    </label>
                  ))}
                </div>
                <textarea
                  placeholder="Notas específicas para este espaço (opcional)"
                  value={i.notas}
                  onChange={(e) => atualizarInstancia(i.id, 'notas', e.target.value)}
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
