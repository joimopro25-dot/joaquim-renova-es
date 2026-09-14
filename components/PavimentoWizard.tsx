'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { calcularOrcamentoPavimento, tabelaPrecosParaMapa, PrecoItem, ResultadoPavimento, PavimentoConfig } from '../lib/pavimento';
import { Loader2 } from 'lucide-react';

export type PavimentoConfigCompleta = { comprimento: number; largura: number; config: PavimentoConfig };

const CONFIG_VAZIA: PavimentoConfig = { tipo: 'laminado_flutuante', removerAntigo: false, incluirRodape: true };

export default function PavimentoWizard({
  onFinalizar,
  aGuardar,
  espacoPartilhado,
  configInicial,
  mostrarPrecos = true,
}: {
  onFinalizar: (resultado: ResultadoPavimento, config: PavimentoConfigCompleta) => void;
  aGuardar?: boolean;
  espacoPartilhado?: { comprimento?: number; largura?: number };
  configInicial?: PavimentoConfigCompleta | null;
  mostrarPrecos?: boolean;
}) {
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [aCarregarPrecos, setACarregarPrecos] = useState(true);

  const [comprimento, setComprimento] = useState(configInicial?.comprimento || espacoPartilhado?.comprimento || 4);
  const [largura, setLargura] = useState(configInicial?.largura || espacoPartilhado?.largura || 3);
  const [config, setConfig] = useState<PavimentoConfig>(configInicial?.config || CONFIG_VAZIA);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('pavimento_precos').select('*').order('ordem');
      setPrecos(data || []);
      setACarregarPrecos(false);
    }
    carregar();
  }, []);

  const tabelaPrecos = useMemo(() => tabelaPrecosParaMapa(precos), [precos]);
  const resultado = useMemo(() => {
    if (precos.length === 0) return null;
    return calcularOrcamentoPavimento(comprimento, largura, config, tabelaPrecos);
  }, [comprimento, largura, config, tabelaPrecos, precos.length]);

  if (aCarregarPrecos) {
    return <div className="text-center py-10 text-ink-300 text-sm flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> A carregar preços...</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="text-xs text-ink-500 block mb-1">Comprimento (m)</label>
          <input type="number" step="0.01" value={comprimento} onChange={(e) => setComprimento(parseFloat(e.target.value) || 0)} className="input w-full" />
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Largura (m)</label>
          <input type="number" step="0.01" value={largura} onChange={(e) => setLargura(parseFloat(e.target.value) || 0)} className="input w-full" />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-ink-500 block mb-1">Tipo de pavimento</label>
        <select value={config.tipo} onChange={(e) => setConfig({ ...config, tipo: e.target.value as any })} className="input w-full sm:w-64">
          <option value="laminado_flutuante">Laminado Flutuante</option>
          <option value="vinilico">Vinílico (LVT)</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <label className="flex items-center gap-1.5 text-sm text-ink-600">
          <input type="checkbox" checked={config.removerAntigo} onChange={(e) => setConfig({ ...config, removerAntigo: e.target.checked })} /> Remover pavimento antigo
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink-600">
          <input type="checkbox" checked={config.incluirRodape} onChange={(e) => setConfig({ ...config, incluirRodape: e.target.checked })} /> Incluir rodapé novo
        </label>
      </div>

      {resultado && (
        <div>
          {mostrarPrecos ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-ink-500 bg-sand-50 border border-sand-200 rounded-lg p-3 mb-6">
              Configuração concluída. Vais receber o orçamento com os valores por email / na tua conta Projetar Conforto.
            </p>
          )}

          <button
            onClick={() => onFinalizar(resultado, { comprimento, largura, config })}
            disabled={aGuardar}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {aGuardar ? 'A guardar...' : mostrarPrecos ? 'Guardar' : 'Validar Plano'}
          </button>
        </div>
      )}
    </div>
  );
}
