'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import PladurWizard from '../../../components/PladurWizard';
import { formatMoney } from '../../../lib/format';
import { ResultadoPladur, EspacoConfig, TetoConfig, ParedeConfig, AcabamentosConfig } from '../../../lib/pladur';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

type ConfigCompleta = { espaco: EspacoConfig; teto: TetoConfig; paredes: ParedeConfig[]; acabamentos: AcabamentosConfig };

export default function PlaneadorPladurPage() {
  const [resultadoFinal, setResultadoFinal] = useState<{ resultado: ResultadoPladur; config: ConfigCompleta } | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [localidade, setLocalidade] = useState('');
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    if (!aceitouPrivacidade || !resultadoFinal) { setErro('Tem de aceitar a Política de Privacidade para enviar o pedido.'); return; }
    setEnviando(true);
    setErro('');

    const { resultado, config } = resultadoFinal;
    const mensagem = `Simulação do Planeador de Pladur — ${config.espaco.nome}: ${config.espaco.comprimento}m × ${config.espaco.largura}m, pé-direito ${config.espaco.peDireito}m. Estimativa: ${formatMoney(resultado.total)} (IVA incluído).`;

    const { error } = await supabase.from('leads').insert([{
      nome, email, telefone, localidade,
      tipo_obra: 'Pladur / Gesso Cartonado',
      mensagem,
      pladur_config: { ...config, resultado },
    }]);
    setEnviando(false);
    if (error) { setErro('Não foi possível enviar. Tente novamente ou contacte-nos diretamente.'); return; }
    setEnviado(true);
  }

  return (
    <main className="min-h-screen bg-sand-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
          <ArrowLeft size={15} /> Voltar ao site
        </Link>

        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-heading font-semibold text-ink-800 mb-1">Planeador de Pladur</h1>
          <p className="text-sm text-ink-400 mb-6">Configura a tua divisão e obtém uma estimativa de orçamento na hora.</p>

          {!resultadoFinal ? (
            <PladurWizard onFinalizar={(resultado, config) => setResultadoFinal({ resultado, config })} />
          ) : enviado ? (
            <div className="text-center py-8">
              <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
              <p className="font-medium text-ink-800">Pedido enviado com sucesso!</p>
              <p className="text-sm text-ink-400 mt-1">Entraremos em contacto brevemente para confirmar os detalhes.</p>
            </div>
          ) : (
            <form onSubmit={enviarPedido}>
              <div className="border border-brand-200 bg-brand-50/40 rounded-lg p-4 mb-6 text-center">
                <p className="text-sm text-ink-500">Estimativa para {resultadoFinal.config.espaco.nome}</p>
                <p className="text-3xl font-heading font-semibold text-ink-800">{formatMoney(resultadoFinal.resultado.total)}</p>
                <p className="text-xs text-ink-400">IVA incluído · valores sujeitos a confirmação no local</p>
              </div>

              <h3 className="font-semibold text-ink-800 mb-3">Os seus dados</h3>
              <div className="space-y-3 mb-4">
                <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input w-full" required />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" required />
                  <input type="tel" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input w-full" />
                </div>
                <input type="text" placeholder="Localidade / Concelho" value={localidade} onChange={(e) => setLocalidade(e.target.value)} className="input w-full" required />
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
                <button type="button" onClick={() => setResultadoFinal(null)} className="border border-sand-200 rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-sand-50">
                  Voltar a editar
                </button>
                <button type="submit" disabled={enviando} className="btn-primary flex-1 justify-center disabled:opacity-60">
                  {enviando ? 'A enviar...' : 'Pedir Orçamento'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
