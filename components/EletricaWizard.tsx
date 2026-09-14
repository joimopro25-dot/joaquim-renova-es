'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { calcularOrcamentoEletrica, tabelaPrecosParaMapa, PrecoItem, ResultadoEletrica, EletricaConfig } from '../lib/eletrica';
import { Loader2 } from 'lucide-react';

const CONFIG_VAZIA: EletricaConfig = { pontosLuz: 0, pontosComando: 0, pontosTomada: 0, intervencaoQuadro: false, detetoresIncendio: 0, notasAdicionais: '' };

export default function EletricaWizard({
  onFinalizar,
  aGuardar,
  configInicial,
}: {
  onFinalizar: (resultado: ResultadoEletrica, config: EletricaConfig) => void;
  aGuardar?: boolean;
  configInicial?: EletricaConfig | null;
}) {
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [aCarregarPrecos, setACarregarPrecos] = useState(true);
  const [config, setConfig] = useState<EletricaConfig>(configInicial || CONFIG_VAZIA);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('eletrica_precos').select('*').order('ordem');
      setPrecos(data || []);
      setACarregarPrecos(false);
    }
    carregar();
  }, []);

  const tabelaPrecos = useMemo(() => tabelaPrecosParaMapa(precos), [precos]);
  const resultado = useMemo(() => {
    if (precos.length === 0) return null;
    return calcularOrcamentoEletrica(config, tabelaPrecos);
  }, [config, tabelaPrecos, precos.length]);

  if (aCarregarPrecos) {
    return <div className="text-center py-10 text-ink-300 text-sm flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> A carregar preços...</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-ink-500 block mb-1">Pontos de luz</label>
          <input type="number" onFocus={(e) => e.target.select()} step="1" min="0" value={config.pontosLuz} onChange={(e) => setConfig({ ...config, pontosLuz: parseInt(e.target.value) || 0 })} className="input w-full" />
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Comandos/Interruptores</label>
          <input type="number" onFocus={(e) => e.target.select()} step="1" min="0" value={config.pontosComando} onChange={(e) => setConfig({ ...config, pontosComando: parseInt(e.target.value) || 0 })} className="input w-full" />
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Tomadas</label>
          <input type="number" onFocus={(e) => e.target.select()} step="1" min="0" value={config.pontosTomada} onChange={(e) => setConfig({ ...config, pontosTomada: parseInt(e.target.value) || 0 })} className="input w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <label className="flex items-center gap-1.5 text-sm text-ink-600">
          <input type="checkbox" checked={config.intervencaoQuadro} onChange={(e) => setConfig({ ...config, intervencaoQuadro: e.target.checked })} /> Intervenção no quadro elétrico
        </label>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Detetores de fumo/incêndio</label>
          <input type="number" onFocus={(e) => e.target.select()} step="1" min="0" value={config.detetoresIncendio} onChange={(e) => setConfig({ ...config, detetoresIncendio: parseInt(e.target.value) || 0 })} className="input w-32" />
        </div>
      </div>

      <div className="mb-6">
        <label className="text-xs text-ink-500 block mb-1">Outras necessidades (sensores de presença, domótica, etc.) — descreve para orçamentarmos depois</label>
        <textarea
          value={config.notasAdicionais}
          onChange={(e) => setConfig({ ...config, notasAdicionais: e.target.value })}
          className="input w-full"
          rows={2}
          placeholder="Ex: sensor de presença no corredor, comando por telemóvel na sala..."
        />
      </div>

      {resultado && (
        <div>
          {resultado.maoDeObra.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-ink-500 uppercase mb-1.5">Trabalho</p>
              <div className="border border-sand-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-sand-100">
                    {resultado.maoDeObra.map((l) => (
                      <tr key={l.chave}>
                        <td className="p-2 text-ink-700">{l.descricao}</td>
                        <td className="p-2 text-right text-ink-400">{l.quantidade} {l.unidade}</td>
                        <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <div className="w-full sm:w-72 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{formatMoney(resultado.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">IVA (23%)</span><span>{formatMoney(resultado.iva)}</span></div>
              <div className="flex justify-between font-semibold text-lg pt-1 border-t border-ink-800"><span>TOTAL</span><span>{formatMoney(resultado.total)}</span></div>
            </div>
          </div>

          <button
            onClick={() => onFinalizar(resultado, config)}
            disabled={aGuardar}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {aGuardar ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}
