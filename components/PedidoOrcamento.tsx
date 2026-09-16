'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DIVISOES, NOMES_DIVISOES } from '../lib/divisoes';
import Link from 'next/link';
import { CheckCircle2, Send, ArrowRight, ArrowLeft, Plus, X, LayoutPanelTop, PaintBucket, SquareStack, Zap, Phone, Mail, MessageCircle, Sliders } from 'lucide-react';
import PladurWizard, { PladurConfigCompleta } from './PladurWizard';
import PinturaWizard, { PinturaConfigCompleta } from './PinturaWizard';
import PavimentoWizard, { PavimentoConfigCompleta } from './PavimentoWizard';
import EletricaWizard from './EletricaWizard';
import { ResultadoPladur } from '../lib/pladur';
import { ResultadoPintura } from '../lib/pintura';
import { ResultadoPavimento } from '../lib/pavimento';
import { ResultadoEletrica, EletricaConfig } from '../lib/eletrica';

type TipoPlaneador = 'pladur' | 'pintura' | 'pavimento' | 'eletrica';

type Instancia = {
  id: string; tipo: string; label: string; area: string; intervencoes: string[]; notas: string;
  comprimento: string; largura: string; peDireito: string;
  pladurConfig?: PladurConfigCompleta; pladurTotal?: number;
  pinturaConfig?: PinturaConfigCompleta; pinturaTotal?: number;
  pavimentoConfig?: PavimentoConfigCompleta; pavimentoTotal?: number;
  eletricaConfig?: EletricaConfig; eletricaTotal?: number;
};

// Intervenções que ativam cada planeador.
const INTERVENCOES_PLADUR = ['Teto falso', 'Revestimentos', 'Abertura de parede / open space', 'Parede em Pladur (divisória/isolamento)'];
const INTERVENCOES_PINTURA = ['Pintura', 'Pintura exterior'];
const INTERVENCOES_PAVIMENTO = ['Pavimento novo', 'Pavimento', 'Pavimento exterior'];
const INTERVENCOES_ELETRICA = ['Eletricidade'];

const PLANEADORES: { tipo: TipoPlaneador; intervencoes: string[]; label: string; icon: any }[] = [
  { tipo: 'pladur', intervencoes: INTERVENCOES_PLADUR, label: 'Pladur', icon: LayoutPanelTop },
  { tipo: 'pintura', intervencoes: INTERVENCOES_PINTURA, label: 'Pintura', icon: PaintBucket },
  { tipo: 'pavimento', intervencoes: INTERVENCOES_PAVIMENTO, label: 'Pavimento', icon: SquareStack },
  { tipo: 'eletrica', intervencoes: INTERVENCOES_ELETRICA, label: 'Elétrica', icon: Zap },
];

function gerarId() {
  return Math.random().toString(36).slice(2);
}

export default function PedidoOrcamento() {
  const [passo, setPasso] = useState<0 | 1 | 2 | 3>(0);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [contactoTelefone, setContactoTelefone] = useState<string | null>(null);
  const [contactoEmail, setContactoEmail] = useState<string | null>(null);

  useEffect(() => {
    async function carregarContacto() {
      const { data } = await supabase.from('site_settings').select('telefone, email').eq('id', 1).single();
      setContactoTelefone(data?.telefone || null);
      setContactoEmail(data?.email || null);
    }
    carregarContacto();
  }, []);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [localidade, setLocalidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState<{ tipo: TipoPlaneador; instanciaId: string } | null>(null);
  const [rascunho, setRascunho] = useState<any>(null);

  // Guarda automaticamente o que o cliente vai preenchendo, para não se
  // perder nada se sair da página sem querer (fecha o separador, recarrega,
  // etc.) — só no browser, e só depois de decidir sobre um rascunho antigo.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pc_pedido_rascunho');
      if (raw) setRascunho(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (rascunho) return;
    if (passo === 0 && instancias.length === 0 && !nome && !email && !telefone) return;
    try {
      localStorage.setItem('pc_pedido_rascunho', JSON.stringify({ passo, instancias, nome, email, telefone, localidade, mensagem }));
    } catch {}
  }, [passo, instancias, nome, email, telefone, localidade, mensagem, rascunho]);

  function retomarRascunho() {
    if (!rascunho) return;
    setPasso(rascunho.passo ?? 1);
    setInstancias(rascunho.instancias || []);
    setNome(rascunho.nome || '');
    setEmail(rascunho.email || '');
    setTelefone(rascunho.telefone || '');
    setLocalidade(rascunho.localidade || '');
    setMensagem(rascunho.mensagem || '');
    setRascunho(null);
  }

  function descartarRascunho() {
    try { localStorage.removeItem('pc_pedido_rascunho'); } catch {}
    setRascunho(null);
  }

  function adicionarInstancia(tipo: string) {
    setInstancias((prev) => {
      const existentes = prev.filter((i) => i.tipo === tipo).length;
      const label = existentes === 0 ? DIVISOES[tipo].label : `${DIVISOES[tipo].label} ${existentes + 1}`;
      return [...prev, { id: gerarId(), tipo, label, area: '', intervencoes: [], notas: '', comprimento: '', largura: '', peDireito: '2.6' }];
    });
  }

  function removerInstancia(id: string) {
    setInstancias((prev) => prev.filter((i) => i.id !== id));
  }

  function atualizarInstancia(id: string, campo: 'label' | 'area' | 'notas' | 'comprimento' | 'largura' | 'peDireito', valor: string) {
    setInstancias((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }

  function toggleIntervencao(id: string, intervencao: string) {
    setInstancias((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const jaTem = i.intervencoes.includes(intervencao);
      return { ...i, intervencoes: jaTem ? i.intervencoes.filter((x) => x !== intervencao) : [...i.intervencoes, intervencao] };
    }));
  }

  function guardarPladur(id: string, resultado: ResultadoPladur, config: PladurConfigCompleta) {
    // Focos LED embutidos e fita LED no teto de Pladur implicam ligação
    // elétrica — sincroniza esse número de pontos automaticamente para o
    // Planeador de Elétrica da mesma divisão, em vez de obrigar a repetir a
    // contagem manualmente lá.
    const pontosLuzLed = config.teto.focosLedPosicoes.length + (config.acabamentos.led !== 'nao' ? 1 : 0);
    setInstancias((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const intervencoes = pontosLuzLed > 0 && !i.intervencoes.includes('Eletricidade')
        ? [...i.intervencoes, 'Eletricidade']
        : i.intervencoes;
      const eletricaConfig = pontosLuzLed > 0
        ? { ...(i.eletricaConfig || { pontosLuz: 0, pontosComando: 0, pontosTomada: 0, intervencaoQuadro: false, detetoresIncendio: 0, notasAdicionais: '' }), pontosLuzLed }
        : i.eletricaConfig;
      return { ...i, pladurConfig: config, pladurTotal: resultado.total, intervencoes, eletricaConfig };
    }));
    setModalAberto(null);
  }

  function guardarPintura(id: string, resultado: ResultadoPintura, config: PinturaConfigCompleta) {
    setInstancias((prev) => prev.map((i) => (i.id === id ? { ...i, pinturaConfig: config, pinturaTotal: resultado.total } : i)));
    setModalAberto(null);
  }

  function guardarPavimento(id: string, resultado: ResultadoPavimento, config: PavimentoConfigCompleta) {
    setInstancias((prev) => prev.map((i) => (i.id === id ? { ...i, pavimentoConfig: config, pavimentoTotal: resultado.total } : i)));
    setModalAberto(null);
  }

  function guardarEletrica(id: string, resultado: ResultadoEletrica, config: EletricaConfig) {
    setInstancias((prev) => prev.map((i) => (i.id === id ? { ...i, eletricaConfig: config, eletricaTotal: resultado.total } : i)));
    setModalAberto(null);
  }

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    if (!aceitouPrivacidade) { setErro('Tem de aceitar a Política de Privacidade para enviar o pedido.'); return; }
    setEnviando(true);
    setErro('');

    const zonas = instancias.map((i) => ({
      zona: i.tipo,
      label: i.label,
      area: i.area || null,
      comprimento: i.comprimento || null,
      largura: i.largura || null,
      pe_direito: i.peDireito || null,
      intervencoes: i.intervencoes,
      notas: i.notas || null,
      pladur_config: i.pladurConfig || null,
      pintura_config: i.pinturaConfig || null,
      pavimento_config: i.pavimentoConfig || null,
      eletrica_config: i.eletricaConfig || null,
    }));

    const tipoObra = instancias.map((i) => i.label).join(', ');

    // Gera o id no browser (em vez de pedir de volta com .select()) — o
    // anon não tem permissão para "ver" leads (só para criar), e pedir a
    // linha de volta faria a inserção inteira falhar por causa disso.
    const leadId = crypto.randomUUID();
    const { error } = await supabase.from('leads').insert([{ id: leadId, nome, email, telefone, localidade, tipo_obra: tipoObra, mensagem, zonas }]);
    setEnviando(false);
    if (error) { setErro('Não foi possível enviar. Tente novamente ou contacte-nos diretamente.'); return; }
    try { localStorage.removeItem('pc_pedido_rascunho'); } catch {}
    // Avisa o Joaquim por email — falha aqui não deve impedir a confirmação
    // ao cliente, o pedido já está guardado de qualquer forma.
    fetch('/api/leads/notificar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leadId }) }).catch(() => {});
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

  const instanciaModal = modalAberto ? instancias.find((i) => i.id === modalAberto.instanciaId) : null;

  const telefoneDigitos = (contactoTelefone || '').replace(/\D/g, '');
  const whatsappHref = telefoneDigitos ? `https://wa.me/351${telefoneDigitos.replace(/^351/, '')}` : null;

  return (
    <div>
      {rascunho && (
        <div className="border border-brand-300 bg-brand-50 rounded-lg p-3 mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-brand-700">Tem um pedido a meio por terminar. Quer continuar de onde ficou?</p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={descartarRascunho} className="text-xs text-ink-500 hover:text-ink-700 px-2 py-1.5">Começar de novo</button>
            <button type="button" onClick={retomarRascunho} className="btn-primary text-xs py-1.5">Continuar</button>
          </div>
        </div>
      )}

      {passo > 0 && (
        <div className="flex items-center gap-2 mb-6 text-xs text-ink-400">
          {[1, 2, 3].map((n) => (
            <React.Fragment key={n}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-medium ${passo >= n ? 'bg-brand-500 text-white' : 'bg-sand-100 text-ink-400'}`}>{n}</span>
              {n < 3 && <span className={`flex-1 h-px ${passo > n ? 'bg-brand-500' : 'bg-sand-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {passo === 0 && (
        <div>
          <h3 className="font-semibold text-ink-800 mb-1">Como prefere pedir o orçamento?</h3>
          <p className="text-sm text-ink-400 mb-5">Escolha o que for mais rápido para si — as duas opções chegam até nós.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-sand-200 rounded-lg p-4">
              <p className="font-medium text-ink-800 mb-1 flex items-center gap-2"><Phone size={16} className="text-brand-500" /> Contacto direto</p>
              <p className="text-xs text-ink-400 mb-3">Prefere falar ou escrever diretamente? Estamos aqui.</p>
              <div className="space-y-2">
                {contactoTelefone && (
                  <a href={`tel:${telefoneDigitos}`} className="btn-primary w-full justify-center text-sm bg-ink-700 hover:bg-ink-800">
                    <Phone size={15} /> Ligar — {contactoTelefone}
                  </a>
                )}
                {whatsappHref && (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center text-sm bg-green-600 hover:bg-green-700">
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                )}
                {contactoEmail && (
                  <a href={`mailto:${contactoEmail}`} className="btn-primary w-full justify-center text-sm bg-sand-500 hover:bg-sand-600">
                    <Mail size={15} /> {contactoEmail}
                  </a>
                )}
              </div>
            </div>

            <button type="button" onClick={() => setPasso(1)} className="border border-brand-300 bg-brand-50 rounded-lg p-4 text-left hover:bg-brand-100 transition-colors flex flex-col">
              <p className="font-medium text-brand-700 mb-1 flex items-center gap-2"><Sliders size={16} /> Simulador online</p>
              <p className="text-xs text-ink-500 mb-3">Configure cada divisão ao detalhe (medidas, materiais, plano do espaço) em poucos passos.</p>
              <span className="mt-auto btn-primary w-full justify-center text-sm">Começar <ArrowRight size={15} /></span>
            </button>
          </div>
        </div>
      )}

      {passo === 1 && (
        <div>
          <button type="button" onClick={() => setPasso(0)} className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700 mb-3"><ArrowLeft size={13} /> Voltar</button>
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
                <p className="text-xs text-ink-400 mb-1.5">Medidas aproximadas (opcional, mas ajuda a calcular melhor)</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input type="number" step="0.1" placeholder="Comprimento (m)" value={i.comprimento} onChange={(e) => atualizarInstancia(i.id, 'comprimento', e.target.value)} className="input w-full" />
                  <input type="number" step="0.1" placeholder="Largura (m)" value={i.largura} onChange={(e) => atualizarInstancia(i.id, 'largura', e.target.value)} className="input w-full" />
                  <input type="number" step="0.1" placeholder="Pé-direito (m)" value={i.peDireito} onChange={(e) => atualizarInstancia(i.id, 'peDireito', e.target.value)} className="input w-full" />
                </div>
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
                  className="input w-full mb-2"
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  {PLANEADORES.filter((p) => i.intervencoes.some((op) => p.intervencoes.includes(op))).map((p) => {
                    const Icon = p.icon;
                    const configKey = `${p.tipo}Config` as const;
                    const temConfig = !!(i as any)[configKey];
                    return (
                      <button
                        key={p.tipo}
                        type="button"
                        onClick={() => setModalAberto({ tipo: p.tipo, instanciaId: i.id })}
                        className="text-xs border border-brand-300 text-brand-700 bg-brand-50 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-brand-100"
                      >
                        <Icon size={13} />
                        {temConfig ? `${p.label} configurado — editar` : `Configurar ${p.label}`}
                      </button>
                    );
                  })}
                </div>
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

      {modalAberto && instanciaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalAberto(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink-800">
                Planeador de {PLANEADORES.find((p) => p.tipo === modalAberto.tipo)?.label} — {instanciaModal.label}
              </h3>
              <button onClick={() => setModalAberto(null)} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>
            <p className="text-xs text-ink-400 mb-4">
              Personaliza tudo ao detalhe — os valores não aparecem aqui, vais recebê-los por email / na tua conta Projetar Conforto depois de revistos.
            </p>

            {modalAberto.tipo === 'pladur' && (
              <PladurWizard
                configInicial={instanciaModal.pladurConfig || null}
                espacoPartilhado={{
                  nome: instanciaModal.label,
                  comprimento: parseFloat(instanciaModal.comprimento || '') || undefined,
                  largura: parseFloat(instanciaModal.largura || '') || undefined,
                  peDireito: parseFloat(instanciaModal.peDireito || '') || undefined,
                }}
                onFinalizar={(resultado, config) => guardarPladur(instanciaModal.id, resultado, config)}
                mostrarPrecos={false}
              />
            )}
            {modalAberto.tipo === 'pintura' && (
              <PinturaWizard
                configInicial={instanciaModal.pinturaConfig || null}
                espacoPartilhado={{
                  comprimento: parseFloat(instanciaModal.comprimento || '') || undefined,
                  largura: parseFloat(instanciaModal.largura || '') || undefined,
                  peDireito: parseFloat(instanciaModal.peDireito || '') || undefined,
                }}
                paredesPladur={instanciaModal.pladurConfig?.paredes.map((p) => ({ larguraM: p.larguraM, lado: p.lado }))}
                onFinalizar={(resultado, config) => guardarPintura(instanciaModal.id, resultado, config)}
                mostrarPrecos={false}
              />
            )}
            {modalAberto.tipo === 'pavimento' && (
              <PavimentoWizard
                configInicial={instanciaModal.pavimentoConfig || null}
                espacoPartilhado={{
                  comprimento: parseFloat(instanciaModal.comprimento || '') || undefined,
                  largura: parseFloat(instanciaModal.largura || '') || undefined,
                }}
                onFinalizar={(resultado, config) => guardarPavimento(instanciaModal.id, resultado, config)}
                mostrarPrecos={false}
              />
            )}
            {modalAberto.tipo === 'eletrica' && (
              <EletricaWizard
                configInicial={instanciaModal.eletricaConfig || null}
                onFinalizar={(resultado, config) => guardarEletrica(instanciaModal.id, resultado, config)}
                mostrarPrecos={false}
              />
            )}
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
            <input type="text" placeholder="Localidade / Concelho (ex: Vila Nova de Famalicão)" value={localidade} onChange={(e) => setLocalidade(e.target.value)} className="input w-full" required />
            <textarea placeholder="Algo mais que queira acrescentar? (opcional)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="input w-full" rows={3} />
            <label className="flex items-start gap-2 text-xs text-ink-500">
              <input type="checkbox" checked={aceitouPrivacidade} onChange={(e) => setAceitouPrivacidade(e.target.checked)} className="mt-0.5" required />
              <span>
                Li e aceito a{' '}
                <Link href="/politica-privacidade" target="_blank" className="text-brand-600 hover:underline">Política de Privacidade</Link>
                {' '}quanto ao tratamento dos meus dados para resposta a este pedido.
              </span>
            </label>
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
