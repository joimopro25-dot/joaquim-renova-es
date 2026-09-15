'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import {
  EspacoConfig, TetoConfig, ParedeConfig, AcabamentosConfig, TipoTeto, TipoTrabalhoParede, TipoPlaca, AberturaConfig, TipoAbertura, LadoParede,
  calcularOrcamentoPladur, tabelaPrecosParaMapa, PrecoItem, ResultadoPladur,
} from '../lib/pladur';
import PlantaPladur from './PlantaPladur';
import { SeletorVariante, aplicarVariantes, Variantes } from './SeletorVariantes';
import { ArrowLeft, ArrowRight, Plus, X, Loader2 } from 'lucide-react';

function gerarId() {
  return Math.random().toString(36).slice(2);
}

const PASSOS = ['Espaço', 'Teto', 'Paredes', 'Acabamentos', 'Resultado'] as const;

const TETO_OPCOES: { value: TipoTeto; label: string }[] = [
  { value: 'nenhum', label: 'Sem teto falso' },
  { value: 'simples', label: 'Teto falso contínuo simples' },
  { value: 'sanca_simples', label: 'Teto falso com sanca perimetral' },
  { value: 'sanca_led', label: 'Teto falso com sanca + iluminação LED' },
];

export type PladurConfigCompleta = { espaco: EspacoConfig; teto: TetoConfig; paredes: ParedeConfig[]; acabamentos: AcabamentosConfig; variantes?: Variantes };

const ESPACO_VAZIO: EspacoConfig = { nome: 'Divisão', comprimento: 4, largura: 3, peDireito: 2.6, comprimentoPlaca: 2.5 };
const TETO_VAZIO: TetoConfig = { tipo: 'nenhum', remate: 'justificado', tipoSanca: 'simples', larguraSancaCm: 20, alturaSancaCm: 20, cobertura: 'toda', focosLedPosicoes: [] };
const ACABAMENTOS_VAZIO: AcabamentosConfig = { led: 'nao', metrosLed: 0 };

export default function PladurWizard({
  onFinalizar,
  aGuardar,
  configInicial,
  espacoPartilhado,
  mostrarPrecos = true,
}: {
  onFinalizar: (resultado: ResultadoPladur, config: PladurConfigCompleta) => void;
  aGuardar?: boolean;
  configInicial?: PladurConfigCompleta | null;
  // Medidas já recolhidas fora deste wizard (ex: pela divisão no "Pedir
  // Orçamento") — pré-preenchem o passo Espaço para não se repetir a
  // pergunta quando várias calculadoras (Pladur, Pintura, ...) partilham a
  // mesma divisão.
  espacoPartilhado?: Partial<EspacoConfig>;
  // Falso no site público: o cliente configura tudo mas não vê preços — os
  // valores são calculados e guardados na mesma, só ficam visíveis quando o
  // admin liberta o orçamento.
  mostrarPrecos?: boolean;
}) {
  const [passo, setPasso] = useState(0);
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [aCarregarPrecos, setACarregarPrecos] = useState(true);

  const [espaco, setEspaco] = useState<EspacoConfig>({ ...ESPACO_VAZIO, ...espacoPartilhado, ...(configInicial?.espaco || {}) });
  const [teto, setTeto] = useState<TetoConfig>(configInicial?.teto || TETO_VAZIO);
  const [paredes, setParedes] = useState<ParedeConfig[]>(configInicial?.paredes || []);
  const [acabamentos, setAcabamentos] = useState<AcabamentosConfig>(configInicial?.acabamentos || ACABAMENTOS_VAZIO);
  const [variantes, setVariantes] = useState<Variantes>(configInicial?.variantes || {});

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('pladur_precos').select('*').order('ordem');
      setPrecos(data || []);
      setACarregarPrecos(false);
    }
    carregar();
  }, []);

  const tabelaPrecos = useMemo(() => aplicarVariantes(tabelaPrecosParaMapa(precos), precos, variantes), [precos, variantes]);

  const resultado = useMemo(() => {
    if (precos.length === 0) return null;
    return calcularOrcamentoPladur(espaco, teto, paredes, acabamentos, tabelaPrecos);
  }, [espaco, teto, paredes, acabamentos, tabelaPrecos, precos.length]);

  function adicionarParede() {
    setParedes((prev) => [...prev, { id: gerarId(), larguraM: 3, tipoTrabalho: 'revestimento', tipoPlaca: 'normal', sistemaFixacao: 'omega', estrutura: 'simples', tipoIsolamento: 'nenhum', temTv: false, aberturas: [] }]);
  }

  function atualizarParede(id: string, campos: Partial<ParedeConfig>) {
    setParedes((prev) => prev.map((p) => (p.id === id ? { ...p, ...campos } : p)));
  }

  function removerParede(id: string) {
    setParedes((prev) => prev.filter((p) => p.id !== id));
  }

  function adicionarAbertura(paredeId: string, tipo: TipoAbertura) {
    const nova: AberturaConfig = { id: gerarId(), tipo, larguraM: tipo === 'porta' ? 0.8 : 1.2, alturaM: tipo === 'porta' ? 2.1 : 1.2, posicaoM: 0 };
    setParedes((prev) => prev.map((p) => (p.id === paredeId ? { ...p, aberturas: [...p.aberturas, nova] } : p)));
  }

  function atualizarAbertura(paredeId: string, aberturaId: string, campos: Partial<AberturaConfig>) {
    setParedes((prev) => prev.map((p) => (p.id === paredeId ? { ...p, aberturas: p.aberturas.map((a) => (a.id === aberturaId ? { ...a, ...campos } : a)) } : p)));
  }

  function removerAbertura(paredeId: string, aberturaId: string) {
    setParedes((prev) => prev.map((p) => (p.id === paredeId ? { ...p, aberturas: p.aberturas.filter((a) => a.id !== aberturaId) } : p)));
  }

  const escalaOk = espaco.comprimento > 0 && espaco.largura > 0;

  if (aCarregarPrecos) {
    return <div className="text-center py-10 text-ink-300 text-sm flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> A carregar preços...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-xs text-ink-400">
        {PASSOS.map((label, i) => (
          <React.Fragment key={label}>
            <button
              type="button"
              onClick={() => setPasso(i)}
              className={`w-6 h-6 rounded-full flex items-center justify-center font-medium shrink-0 cursor-pointer hover:opacity-80 ${passo >= i ? 'bg-brand-500 text-white' : 'bg-sand-100 text-ink-400'}`}
            >
              {i + 1}
            </button>
            <button type="button" onClick={() => setPasso(i)} className={`hidden sm:inline hover:text-ink-700 ${passo === i ? 'text-ink-700 font-medium' : ''}`}>{label}</button>
            {i < PASSOS.length - 1 && <span className={`flex-1 h-px ${passo > i ? 'bg-brand-500' : 'bg-sand-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {passo === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-ink-500 block mb-1">Nome do espaço</label>
              <input type="text" value={espaco.nome} onChange={(e) => setEspaco({ ...espaco, nome: e.target.value })} className="input w-full" placeholder="Ex: Quarto principal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-500 block mb-1">Comprimento (m)</label>
                <input type="number" onFocus={(e) => e.target.select()} step="0.01" min="1" value={espaco.comprimento} onChange={(e) => setEspaco({ ...espaco, comprimento: parseFloat(e.target.value) || 0 })} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Largura (m)</label>
                <input type="number" onFocus={(e) => e.target.select()} step="0.01" min="1" value={espaco.largura} onChange={(e) => setEspaco({ ...espaco, largura: parseFloat(e.target.value) || 0 })} className="input w-full" />
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-500 block mb-1">Pé-direito (m)</label>
              <select value={espaco.peDireito} onChange={(e) => setEspaco({ ...espaco, peDireito: parseFloat(e.target.value) })} className="input w-full">
                {[2.40, 2.60, 2.70, 2.80].map((v) => <option key={v} value={v}>{v.toFixed(2)} m</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-500 block mb-1">Comprimento das placas a usar</label>
              <select value={espaco.comprimentoPlaca} onChange={(e) => setEspaco({ ...espaco, comprimentoPlaca: parseFloat(e.target.value) as any })} className="input w-full">
                <option value="2.5">2,5 m (mais comum)</option>
                <option value="2.6">2,6 m</option>
                <option value="3">3,0 m (menos desperdício em vãos maiores)</option>
              </select>
            </div>
            <p className="text-xs text-ink-400">Área da divisão: {(espaco.comprimento * espaco.largura).toFixed(2)} m²</p>
          </div>
          <div className="flex items-center justify-center bg-sand-50 rounded-lg border border-sand-200 p-4">
            <PlantaPladur espaco={espaco} paredes={paredes} teto={teto} />
          </div>
        </div>
      )}

      {passo === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TETO_OPCOES.map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setTeto({ ...teto, tipo: op.value })}
                className={`p-3 rounded-lg border text-sm text-left transition-colors ${teto.tipo === op.value ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-sand-200 text-ink-600 hover:bg-sand-50'}`}
              >
                {op.label}
              </button>
            ))}
          </div>

          {teto.tipo !== 'nenhum' && (
            <div className="border border-sand-200 rounded-lg p-4">
              <label className="text-xs text-ink-500 block mb-1">Remate perimetral (encontro com a parede)</label>
              <select value={teto.remate} onChange={(e) => setTeto({ ...teto, remate: e.target.value as any })} className="input w-full sm:w-72 mb-4">
                <option value="justificado">Justificado à parede (perfil angular)</option>
                <option value="sombra">Junta de sombra (Perfil Pladur Sombra)</option>
              </select>

              <p className="text-xs text-ink-500 mb-2">Focos LED embutidos ({teto.focosLedPosicoes.length}) — coloca-os na planta abaixo</p>
              <PlantaPladur espaco={espaco} paredes={paredes} teto={teto} editarFocos onTetoChange={setTeto} />
            </div>
          )}

          {(teto.tipo === 'sanca_simples' || teto.tipo === 'sanca_led') && (
            <div className="border border-sand-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-ink-500 block mb-1">Largura da sanca (cm)</label>
                <select value={teto.larguraSancaCm} onChange={(e) => setTeto({ ...teto, larguraSancaCm: parseInt(e.target.value) })} className="input w-full">
                  {[15, 20, 25, 30].map((v) => <option key={v} value={v}>{v} cm</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Altura da sanca (cm)</label>
                <select value={teto.alturaSancaCm} onChange={(e) => setTeto({ ...teto, alturaSancaCm: parseInt(e.target.value) })} className="input w-full">
                  {[15, 20, 25].map((v) => <option key={v} value={v}>{v} cm</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Cobertura</label>
                <select value={teto.cobertura} onChange={(e) => setTeto({ ...teto, cobertura: e.target.value as any })} className="input w-full">
                  <option value="toda">Toda a divisão</option>
                  <option value="uma">Só uma parede</option>
                  <option value="duas">Duas paredes</option>
                </select>
              </div>
            </div>
          )}

          {teto.tipo === 'sanca_led' && (
            <div>
              <label className="text-xs text-ink-500 block mb-1">Metros de fita LED</label>
              <input type="number" onFocus={(e) => e.target.select()} step="0.5" value={acabamentos.metrosLed} onChange={(e) => setAcabamentos({ ...acabamentos, metrosLed: parseFloat(e.target.value) || 0 })} className="input w-40" />
            </div>
          )}
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-3">
          {paredes.some((p) => p.lado) && (
            <div className="border border-sand-200 rounded-lg p-3 bg-sand-50 flex justify-center">
              <PlantaPladur espaco={espaco} paredes={paredes} teto={teto} />
            </div>
          )}
          {paredes.length === 0 && <p className="text-sm text-ink-400">Nenhuma parede a revestir. Adiciona se houver trabalho de pladur nas paredes.</p>}
          {paredes.map((p) => (
            <div key={p.id} className="border border-sand-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-ink-500 block mb-1">Largura (m)</label>
                <input type="number" onFocus={(e) => e.target.select()} step="0.01" value={p.larguraM} onChange={(e) => atualizarParede(p.id, { larguraM: parseFloat(e.target.value) || 0 })} className="input w-full" />
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Lado do espaço (para a planta)</label>
                <select value={p.lado || ''} onChange={(e) => atualizarParede(p.id, { lado: (e.target.value || undefined) as LadoParede | undefined })} className="input w-full">
                  <option value="">— não definido —</option>
                  <option value="norte">Norte</option>
                  <option value="sul">Sul</option>
                  <option value="este">Este</option>
                  <option value="oeste">Oeste</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Tipo de trabalho</label>
                <select
                  value={p.tipoTrabalho}
                  onChange={(e) => {
                    const tipoTrabalho = e.target.value as TipoTrabalhoParede;
                    atualizarParede(p.id, { tipoTrabalho, sistemaFixacao: tipoTrabalho === 'revestimento' ? p.sistemaFixacao : 'montante' });
                  }}
                  className="input w-full"
                >
                  <option value="revestimento">Revestimento direto</option>
                  <option value="tabique">Tabique novo</option>
                  <option value="divisoria">Divisória</option>
                </select>
              </div>
              {p.tipoTrabalho === 'revestimento' ? (
                <div>
                  <label className="text-xs text-ink-500 block mb-1">Sistema</label>
                  <select value={p.sistemaFixacao} onChange={(e) => atualizarParede(p.id, { sistemaFixacao: e.target.value as any })} className="input w-full">
                    <option value="omega">Perfil ómega (direto à parede)</option>
                    <option value="montante">Guia + Montante (autoportante)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-ink-500 block mb-1">Estrutura</label>
                  <select value={p.estrutura} onChange={(e) => atualizarParede(p.id, { estrutura: e.target.value as any })} className="input w-full">
                    <option value="simples">Simples (1 placa/lado)</option>
                    <option value="dupla">Dupla (2 placas/lado)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-ink-500 block mb-1">Tipo de placa</label>
                <select value={p.tipoPlaca} onChange={(e) => atualizarParede(p.id, { tipoPlaca: e.target.value as TipoPlaca })} className="input w-full">
                  <option value="normal">Normal</option>
                  <option value="hidrofuga">Hidrófuga (WC/cozinha)</option>
                  <option value="cortafogo">Corta-fogo</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Isolamento</label>
                <select value={p.tipoIsolamento} onChange={(e) => atualizarParede(p.id, { tipoIsolamento: e.target.value as any })} className="input w-full">
                  <option value="nenhum">Nenhum</option>
                  <option value="la_rocha">Lã de rocha</option>
                  <option value="la_mineral">Lã mineral</option>
                  <option value="bolha">Plástico bolha</option>
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-ink-600">
                <input type="checkbox" checked={p.temTv} onChange={(e) => atualizarParede(p.id, { temTv: e.target.checked })} /> Reforço + ponto para TV
              </label>
              <button type="button" onClick={() => removerParede(p.id)} className="text-ink-300 hover:text-red-600 justify-self-end self-end">
                <X size={16} /> Remover parede
              </button>

              <div className="sm:col-span-4 border-t border-sand-100 pt-2 mt-1">
                <p className="text-xs text-ink-500 mb-1.5">Portas / janelas nesta parede (desconta área e conta reforços automaticamente)</p>
                {p.aberturas.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-end gap-2 mb-1.5">
                    <select value={a.tipo} onChange={(e) => atualizarAbertura(p.id, a.id, { tipo: e.target.value as TipoAbertura })} className="input text-xs py-1 w-28">
                      <option value="porta">Porta</option>
                      <option value="janela">Janela</option>
                    </select>
                    <div>
                      <label className="text-[10px] text-ink-400 block">Largura (m)</label>
                      <input type="number" onFocus={(e) => e.target.select()} step="0.01" value={a.larguraM} onChange={(e) => atualizarAbertura(p.id, a.id, { larguraM: parseFloat(e.target.value) || 0 })} className="input text-xs py-1 w-20" />
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-400 block">Altura (m)</label>
                      <input type="number" onFocus={(e) => e.target.select()} step="0.01" value={a.alturaM} onChange={(e) => atualizarAbertura(p.id, a.id, { alturaM: parseFloat(e.target.value) || 0 })} className="input text-xs py-1 w-20" />
                    </div>
                    {p.lado && (
                      <div>
                        <label className="text-[10px] text-ink-400 block">Posição desde o início da parede (m)</label>
                        <input type="number" onFocus={(e) => e.target.select()} step="0.01" min="0" value={a.posicaoM} onChange={(e) => atualizarAbertura(p.id, a.id, { posicaoM: parseFloat(e.target.value) || 0 })} className="input text-xs py-1 w-24" />
                      </div>
                    )}
                    <button type="button" onClick={() => removerAbertura(p.id, a.id)} className="text-ink-300 hover:text-red-600"><X size={14} /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button type="button" onClick={() => adicionarAbertura(p.id, 'porta')} className="text-xs border border-sand-200 rounded-md px-2 py-1 text-ink-600 hover:bg-sand-50 flex items-center gap-1"><Plus size={12} /> Porta</button>
                  <button type="button" onClick={() => adicionarAbertura(p.id, 'janela')} className="text-xs border border-sand-200 rounded-md px-2 py-1 text-ink-600 hover:bg-sand-50 flex items-center gap-1"><Plus size={12} /> Janela</button>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={adicionarParede} className="border border-sand-200 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-sand-50 flex items-center gap-1.5">
            <Plus size={15} /> Adicionar Parede
          </button>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-5">
          <div>
            <label className="text-xs text-ink-500 block mb-1">Iluminação LED (embutida na estrutura de teto/sanca)</label>
            <select value={acabamentos.led} onChange={(e) => setAcabamentos({ ...acabamentos, led: e.target.value as any })} className="input w-full sm:w-72">
              <option value="nao">Não</option>
              <option value="fita">Fita LED</option>
              <option value="fita_zigbee">Fita LED + controlo Zigbee/app</option>
            </select>
            {acabamentos.led !== 'nao' && (
              <input type="number" onFocus={(e) => e.target.select()} step="0.5" placeholder="Metros de fita" value={acabamentos.metrosLed} onChange={(e) => setAcabamentos({ ...acabamentos, metrosLed: parseFloat(e.target.value) || 0 })} className="input w-40 mt-2" />
            )}
          </div>
          <p className="text-xs text-ink-400">
            Pintura, rodapé e pontos elétricos passam a ser simulados nos planeadores próprios (Pintura / Elétrica), para poderes usá-los mesmo em divisões sem pladur.
          </p>
        </div>
      )}

      {passo === 4 && resultado && (
        <div>
          <div className="flex justify-center mb-6">
            <PlantaPladur espaco={espaco} paredes={paredes} teto={teto} />
          </div>

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

          <div className="flex gap-2">
            <button type="button" onClick={() => setPasso((p) => p - 1)} className="border border-sand-200 rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-sand-50 flex items-center gap-1.5">
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              onClick={() => onFinalizar(resultado, { espaco, teto, paredes, acabamentos, variantes })}
              disabled={aGuardar}
              className="btn-primary flex-1 justify-center disabled:opacity-60"
            >
              {aGuardar ? 'A guardar...' : mostrarPrecos ? 'Guardar Orçamento' : 'Validar Plano'}
            </button>
          </div>
        </div>
      )}

      {passo < 4 && (
        <div className="flex gap-2 mt-6">
          {passo > 0 && (
            <button type="button" onClick={() => setPasso((p) => p - 1)} className="border border-sand-200 rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-sand-50 flex items-center gap-1.5">
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          <button type="button" onClick={() => setPasso((p) => p + 1)} disabled={!escalaOk} className="btn-primary flex-1 justify-center disabled:opacity-40">
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
