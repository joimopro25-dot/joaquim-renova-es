'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { calcularOrcamentoPintura, tabelaPrecosParaMapa, paredesPorDefeito, PrecoItem, ResultadoPintura, PinturaConfig, ParedePintura, QualidadeTinta } from '../lib/pintura';
import { SeletorVariante, aplicarVariantes, Variantes } from './SeletorVariantes';
import DiagramaCamadas, { Camada } from './DiagramaCamadas';
import { Loader2, Plus, X } from 'lucide-react';

export type PinturaConfigCompleta = {
  comprimento: number; largura: number; peDireito: number;
  config: PinturaConfig;
  variantes?: Variantes;
};

function gerarId() {
  return Math.random().toString(36).slice(2);
}

function configVazia(comprimento: number, largura: number, base?: ParedePintura[]): PinturaConfig {
  return { paredes: base && base.length > 0 ? base : paredesPorDefeito(comprimento, largura), pintarTeto: false, demaos: 2, qualidadeTinta: 'normal', areaAberturasM2: 0, precisaNivelamento: true };
}

const LABEL_LADO: Record<string, string> = { norte: 'Norte', sul: 'Sul', este: 'Este', oeste: 'Oeste' };
const LABEL_GAMA: Record<QualidadeTinta, string> = { normal: 'Média Baixa', normal_alta: 'Média Alta', extrema: 'Extrema' };

function camadasPintura(config: PinturaConfig): Camada[] {
  return [
    ...(config.precisaNivelamento ? [{ label: 'Massa fina / acabamento', descricao: 'Nivelamento da superfície', cor: '#e5e7eb' }] : []),
    { label: 'Primário', descricao: 'Fundo preparador', cor: '#fef3c7' },
    { label: `Tinta — gama ${LABEL_GAMA[config.qualidadeTinta]}`, descricao: `${config.demaos} demão${config.demaos > 1 ? 's' : ''}`, cor: '#93c5fd' },
  ];
}

export default function PinturaWizard({
  onFinalizar,
  aGuardar,
  espacoPartilhado,
  configInicial,
  paredesPladur,
  mostrarPrecos = true,
}: {
  onFinalizar: (resultado: ResultadoPintura, config: PinturaConfigCompleta) => void;
  aGuardar?: boolean;
  espacoPartilhado?: { comprimento?: number; largura?: number; peDireito?: number };
  configInicial?: PinturaConfigCompleta | null;
  // Paredes já configuradas no Planeador de Pladur da mesma divisão — se
  // existirem, servem de ponto de partida (mesmas larguras/lados) em vez de
  // 4 paredes genéricas, evitando repetir medidas já dadas.
  paredesPladur?: { larguraM: number; lado?: string }[];
  mostrarPrecos?: boolean;
}) {
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [aCarregarPrecos, setACarregarPrecos] = useState(true);

  const [comprimento, setComprimento] = useState(configInicial?.comprimento || espacoPartilhado?.comprimento || 4);
  const [largura, setLargura] = useState(configInicial?.largura || espacoPartilhado?.largura || 3);
  const [peDireito, setPeDireito] = useState(configInicial?.peDireito || espacoPartilhado?.peDireito || 2.6);
  const [config, setConfig] = useState<PinturaConfig>(() => {
    if (configInicial?.config) {
      // Configs guardadas antes deste campo existir assumem o comportamento
      // antigo (cobrava sempre), para não mudar o preço de orçamentos já feitos.
      return { ...configInicial.config, precisaNivelamento: configInicial.config.precisaNivelamento ?? true };
    }
    const base = paredesPladur && paredesPladur.length > 0
      ? paredesPladur.map((p, idx) => ({ id: p.lado || `pladur-${idx}`, larguraM: p.larguraM, pintar: true, lado: p.lado }))
      : undefined;
    return configVazia(comprimento, largura, base);
  });
  const [variantes, setVariantes] = useState<Variantes>(configInicial?.variantes || {});

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('pintura_precos').select('*').order('ordem');
      setPrecos(data || []);
      setACarregarPrecos(false);
    }
    carregar();
  }, []);

  const tabelaPrecos = useMemo(() => aplicarVariantes(tabelaPrecosParaMapa(precos), precos, variantes), [precos, variantes]);
  const resultado = useMemo(() => {
    if (precos.length === 0) return null;
    return calcularOrcamentoPintura(comprimento, largura, peDireito, config, tabelaPrecos);
  }, [comprimento, largura, peDireito, config, tabelaPrecos, precos.length]);

  function atualizarParede(id: string, campos: Partial<{ larguraM: number; pintar: boolean }>) {
    setConfig((prev) => ({ ...prev, paredes: prev.paredes.map((p) => (p.id === id ? { ...p, ...campos } : p)) }));
  }

  function adicionarParede() {
    setConfig((prev) => ({ ...prev, paredes: [...prev.paredes, { id: gerarId(), larguraM: 3, pintar: true }] }));
  }

  function removerParede(id: string) {
    setConfig((prev) => ({ ...prev, paredes: prev.paredes.filter((p) => p.id !== id) }));
  }

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

      <p className="text-xs text-ink-500 mb-2">
        Paredes a pintar {paredesPladur && paredesPladur.length > 0 ? '— já trazidas do Planeador de Pladur desta divisão, ajusta ou adiciona mais' : '— escolhe quais e ajusta a largura de cada uma se forem diferentes'}
      </p>
      <div className="border border-sand-200 rounded-lg divide-y divide-sand-100 mb-2">
        {config.paredes.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 p-2.5">
            <label className="flex items-center gap-1.5 text-sm text-ink-600 w-24 shrink-0">
              <input type="checkbox" checked={p.pintar} onChange={(e) => atualizarParede(p.id, { pintar: e.target.checked })} /> {p.lado ? LABEL_LADO[p.lado] || p.lado : `Parede ${i + 1}`}
            </label>
            <input
              type="number" step="0.01" value={p.larguraM}
              onChange={(e) => atualizarParede(p.id, { larguraM: parseFloat(e.target.value) || 0 })}
              className="input py-1 w-28 text-sm" disabled={!p.pintar}
            />
            <span className="text-xs text-ink-400 flex-1">m de largura</span>
            <button type="button" onClick={() => removerParede(p.id)} className="text-ink-300 hover:text-red-600"><X size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={adicionarParede} className="border border-sand-200 rounded-lg px-3 py-1.5 text-xs text-ink-600 hover:bg-sand-50 flex items-center gap-1.5 mb-4">
        <Plus size={13} /> Adicionar parede
      </button>

      <label className="flex items-center gap-1.5 text-sm text-ink-600 mb-2">
        <input type="checkbox" checked={config.pintarTeto} onChange={(e) => setConfig({ ...config, pintarTeto: e.target.checked })} /> Pintar teto
      </label>

      <label className="flex items-start gap-1.5 text-sm text-ink-600 mb-4">
        <input type="checkbox" checked={config.precisaNivelamento} onChange={(e) => setConfig({ ...config, precisaNivelamento: e.target.checked })} className="mt-0.5" />
        <span>
          Precisa de massa de nivelamento antes de pintar
          <span className="block text-xs text-ink-400">Pladur novo ou parede/teto degradado — desmarca se a superfície já está lisa e só precisa de repintar</span>
        </span>
      </label>

      {config.paredes.some((p) => p.pintar) && (
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
            <option value="normal">Média Baixa</option>
            <option value="normal_alta">Média Alta</option>
            <option value="extrema">Extrema (lavável)</option>
          </select>
        </div>
      </div>

      {(config.paredes.some((p) => p.pintar) || config.pintarTeto) && (
        <div className="mb-6 border border-sand-200 rounded-lg p-3">
          <DiagramaCamadas titulo="Acabamento em corte (atualiza com as escolhas acima)" camadas={camadasPintura(config)} />
        </div>
      )}

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
                              <td className="p-2 text-ink-700">
                                {l.descricao}
                                <SeletorVariante chave={l.chave} todos={precos} escolhas={variantes} onEscolher={(chave, id) => setVariantes((v) => ({ ...v, [chave]: id }))} />
                              </td>
                              <td className="p-2 text-right text-ink-400 align-top">{l.quantidade} {l.unidade}</td>
                              <td className="p-2 text-right text-ink-800 font-medium align-top">{formatMoney(l.valor)}</td>
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
                {resultado.materiais.length === 0 && resultado.maoDeObra.length === 0 && (
                  <p className="text-sm text-ink-400 text-center py-4">Marca pelo menos uma parede ou o teto para ver o cálculo.</p>
                )}
              </div>

              <div className="flex justify-end mb-4">
                <div className="w-full sm:w-72 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-ink-500">Subtotal Materiais</span><span>{formatMoney(resultado.totalMateriais)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500">Subtotal Mão de Obra</span><span>{formatMoney(resultado.totalMaoDeObra)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-500">IVA (23%)</span><span>{formatMoney(resultado.iva)}</span></div>
                  <div className="flex justify-between font-semibold text-lg pt-1 border-t border-ink-800"><span>TOTAL</span><span>{formatMoney(resultado.total)}</span></div>
                  {resultado.m2Total > 0 && (
                    <div className="flex justify-between text-xs text-ink-400 pt-1">
                      <span>≈ €/m² (com IVA)</span>
                      <span>{formatMoney(resultado.total / resultado.m2Total)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-500 bg-sand-50 border border-sand-200 rounded-lg p-3 mb-6">
              Configuração concluída. Vais receber o orçamento com os valores por email / na tua conta Projetar Conforto.
            </p>
          )}

          <button
            onClick={() => onFinalizar(resultado, { comprimento, largura, peDireito, config, variantes })}
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
