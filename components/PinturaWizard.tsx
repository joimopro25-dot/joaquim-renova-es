'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { calcularOrcamentoPintura, tabelaPrecosParaMapa, PrecoItem, ResultadoPintura, PinturaConfig } from '../lib/pintura';
import { Loader2 } from 'lucide-react';

export type PinturaConfigCompleta = {
  comprimento: number; largura: number; peDireito: number;
  config: PinturaConfig;
};

const CONFIG_VAZIA: PinturaConfig = { pintarParedes: true, pintarTeto: false, demaos: 2, qualidadeTinta: 'normal', areaAberturasM2: 0 };

export default function PinturaWizard({
  onFinalizar,
  aGuardar,
  espacoPartilhado,
  configInicial,
}: {
  onFinalizar: (resultado: ResultadoPintura, config: PinturaConfigCompleta) => void;
  aGuardar?: boolean;
  espacoPartilhado?: { comprimento?: number; largura?: number; peDireito?: number };
  configInicial?: PinturaConfigCompleta | null;
}) {
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [aCarregarPrecos, setACarregarPrecos] = useState(true);

  const [comprimento, setComprimento] = useState(configInicial?.comprimento || espacoPartilhado?.comprimento || 4);
  const [largura, setLargura] = useState(configInicial?.largura || espacoPartilhado?.largura || 3);
  const [peDireito, setPeDireito] = useState(configInicial?.peDireito || espacoPartilhado?.peDireito || 2.6);
  const [config, setConfig] = useState<PinturaConfig>(configInicial?.config || CONFIG_VAZIA);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('pintura_precos').select('*').order('ordem');
      setPrecos(data || []);
      setACarregarPrecos(false);
    }
    carregar();
  }, []);

  const tabelaPrecos = useMemo(() => tabelaPrecosParaMapa(precos), [precos]);
  const resultado = useMemo(() => {
    if (precos.length === 0) return null;
    return calcularOrcamentoPintura(comprimento, largura, peDireito, config, tabelaPrecos);
  }, [comprimento, largura, peDireito, config, tabelaPrecos, precos.length]);

  if (aCarregarPrecos) {
    return <div className="text-center py-10 text-ink-300 text-sm flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> A carregar preços...</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <label className="text-xs text-ink-500 block mb-1">Comprimento (m)</label>
          <input type="number" step="0.01" value={comprimento} onChange={(e) => setComprimento(parseFloat(e.target.value) || 0)} className="input w-full" />
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Largura (m)</label>
          <input type="number" step="0.01" value={largura} onChange={(e) => setLargura(parseFloat(e.target.value) || 0)} className="input w-full" />
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Pé-direito (m)</label>
          <input type="number" step="0.01" value={peDireito} onChange={(e) => setPeDireito(parseFloat(e.target.value) || 0)} className="input w-full" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <label className="flex items-center gap-1.5 text-sm text-ink-600">
          <input type="checkbox" checked={config.pintarParedes} onChange={(e) => setConfig({ ...config, pintarParedes: e.target.checked })} /> Pintar paredes
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink-600">
          <input type="checkbox" checked={config.pintarTeto} onChange={(e) => setConfig({ ...config, pintarTeto: e.target.checked })} /> Pintar teto
        </label>
      </div>

      {config.pintarParedes && (
        <div className="mb-4">
          <label className="text-xs text-ink-500 block mb-1">Área de portas/janelas a descontar (m²) — opcional</label>
          <input type="number" step="0.1" min="0" value={config.areaAberturasM2} onChange={(e) => setConfig({ ...config, areaAberturasM2: parseFloat(e.target.value) || 0 })} className="input w-40" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div>
          <label className="text-xs text-ink-500 block mb-1">Demãos</label>
          <select value={config.demaos} onChange={(e) => setConfig({ ...config, demaos: parseInt(e.target.value) as 1 | 2 })} className="input w-full">
            <option value={1}>1 demão</option>
            <option value={2}>2 demãos</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Qualidade da tinta</label>
          <select value={config.qualidadeTinta} onChange={(e) => setConfig({ ...config, qualidadeTinta: e.target.value as any })} className="input w-full">
            <option value="normal">Normal</option>
            <option value="normal_alta">Normal Alta</option>
            <option value="extrema">Extrema (lavável)</option>
          </select>
        </div>
      </div>

      {resultado && (
        <div>
          <div className="space-y-4 mb-6">
            {resultado.materiais.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-500 uppercase mb-1.5">Materiais</p>
                <div className="border border-sand-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-sand-100">
                      {resultado.materiais.map((l) => (
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
            {resultado.maoDeObra.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-500 uppercase mb-1.5">Mão de Obra</p>
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
          </div>

          <div className="flex justify-end mb-4">
            <div className="w-full sm:w-72 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-ink-500">Subtotal Materiais</span><span>{formatMoney(resultado.totalMateriais)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Subtotal Mão de Obra</span><span>{formatMoney(resultado.totalMaoDeObra)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">IVA (23%)</span><span>{formatMoney(resultado.iva)}</span></div>
              <div className="flex justify-between font-semibold text-lg pt-1 border-t border-ink-800"><span>TOTAL</span><span>{formatMoney(resultado.total)}</span></div>
            </div>
          </div>

          <button
            onClick={() => onFinalizar(resultado, { comprimento, largura, peDireito, config })}
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
