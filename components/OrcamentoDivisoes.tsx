'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { LayoutPanelTop, PaintBucket, SquareStack, Zap, Plus, Trash2, X } from 'lucide-react';
import PladurWizard, { PladurConfigCompleta } from './PladurWizard';
import PinturaWizard, { PinturaConfigCompleta } from './PinturaWizard';
import PavimentoWizard, { PavimentoConfigCompleta } from './PavimentoWizard';
import EletricaWizard from './EletricaWizard';
import { EletricaConfig } from '../lib/eletrica';

type TipoPlaneador = 'pladur' | 'pintura' | 'pavimento' | 'eletrica';

type OrcamentoDivisao = {
  id: string;
  orcamento_id: string;
  label: string;
  comprimento: number | null;
  largura: number | null;
  pe_direito: number | null;
  pladur_config: PladurConfigCompleta | null;
  pintura_config: PinturaConfigCompleta | null;
  pavimento_config: PavimentoConfigCompleta | null;
  eletrica_config: EletricaConfig | null;
};

const CONFIG_ELETRICA_VAZIA: EletricaConfig = { pontosLuz: 0, pontosComando: 0, pontosTomada: 0, intervencaoQuadro: false, detetoresIncendio: 0, notasAdicionais: '' };

const PLANEADORES: { tipo: TipoPlaneador; label: string; icon: any; configKey: 'pladur_config' | 'pintura_config' | 'pavimento_config' | 'eletrica_config' }[] = [
  { tipo: 'pladur', label: 'Pladur', icon: LayoutPanelTop, configKey: 'pladur_config' },
  { tipo: 'pintura', label: 'Pintura', icon: PaintBucket, configKey: 'pintura_config' },
  { tipo: 'pavimento', label: 'Pavimento', icon: SquareStack, configKey: 'pavimento_config' },
  { tipo: 'eletrica', label: 'Elétrica', icon: Zap, configKey: 'eletrica_config' },
];

export default function OrcamentoDivisoes({ orcamentoId, editavel }: { orcamentoId: string; editavel: boolean }) {
  const [divisoes, setDivisoes] = useState<OrcamentoDivisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState<{ tipo: TipoPlaneador; divisaoId: string } | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [novoLabel, setNovoLabel] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('orcamento_divisoes').select('*').eq('orcamento_id', orcamentoId).order('criado_em');
    setDivisoes((data as any) || []);
    setLoading(false);
  }, [orcamentoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarDivisao() {
    const label = novoLabel.trim() || `Divisão ${divisoes.length + 1}`;
    const { error } = await supabase.from('orcamento_divisoes').insert([{ orcamento_id: orcamentoId, label, comprimento: 4, largura: 3, pe_direito: 2.6 }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setNovoLabel('');
    carregar();
  }

  async function removerDivisao(divisaoId: string, label: string) {
    if (!confirm(`Remover a divisão "${label}"? As linhas de orçamento já geradas para ela mantêm-se, mas deixam de poder ser reeditadas por aqui.`)) return;
    await supabase.from('orcamento_divisoes').delete().eq('id', divisaoId);
    carregar();
  }

  async function atualizarLabel(divisaoId: string, label: string) {
    await supabase.from('orcamento_divisoes').update({ label }).eq('id', divisaoId);
    carregar();
  }

  async function atualizarMedida(divisaoId: string, campo: 'comprimento' | 'largura' | 'pe_direito', valor: number) {
    setDivisoes((prev) => prev.map((d) => (d.id === divisaoId ? { ...d, [campo]: valor } : d)));
    await supabase.from('orcamento_divisoes').update({ [campo]: valor }).eq('id', divisaoId);
  }

  async function guardarPlaneador(divisao: OrcamentoDivisao, tipo: TipoPlaneador, resultado: any, config: any) {
    setAGuardar(true);
    const infoPlaneador = PLANEADORES.find((p) => p.tipo === tipo)!;
    const capitulo = `${divisao.label} · ${infoPlaneador.label}`;

    await supabase.from('orcamento_linhas').delete().eq('orcamento_id', orcamentoId).eq('capitulo', capitulo);

    const linhasMateriais = (resultado.materiais || []).map((l: any) => ({
      orcamento_id: orcamentoId, capitulo, descricao: l.descricao, unidade: l.unidade, quantidade: l.quantidade, tipo_linha: 'material', preco_unitario: l.precoUnitario,
    }));
    const linhasMaoObra = (resultado.maoDeObra || []).map((l: any) => ({
      orcamento_id: orcamentoId, capitulo, descricao: l.descricao, unidade: l.unidade, quantidade: l.quantidade, tipo_linha: 'mao_obra', preco_unitario: l.precoUnitario,
    }));
    const todasLinhas = [...linhasMateriais, ...linhasMaoObra];
    if (todasLinhas.length > 0) {
      const { error } = await supabase.from('orcamento_linhas').insert(todasLinhas);
      if (error) { setAGuardar(false); alert('Erro: ' + error.message); return; }
    }

    const patch: Record<string, any> = { [infoPlaneador.configKey]: config };

    // Focos LED embutidos / fita LED no teto de Pladur implicam ligação
    // elétrica — sincroniza os pontos de luz com o Planeador de Elétrica
    // desta mesma divisão (só a configuração; as linhas só mudam quando o
    // Elétrica for aberto e guardado).
    if (tipo === 'pladur') {
      const pontosLuzLed = config.teto.focosLedPosicoes.length + (config.acabamentos.led !== 'nao' ? 1 : 0);
      if (pontosLuzLed > 0) {
        patch.eletrica_config = { ...(divisao.eletrica_config || CONFIG_ELETRICA_VAZIA), pontosLuzLed };
      }
    }

    await supabase.from('orcamento_divisoes').update(patch).eq('id', divisao.id);
    setAGuardar(false);
    setModalAberto(null);
    carregar();
  }

  if (!editavel && divisoes.length === 0 && !loading) return null;

  const divisaoModal = modalAberto ? divisoes.find((d) => d.id === modalAberto.divisaoId) : null;

  return (
    <div className="card p-6 mb-6">
      <h3 className="font-semibold text-ink-700 mb-1">Divisões</h3>
      <p className="text-xs text-ink-400 mb-4">Organiza o orçamento por divisão — cada uma com as suas medidas e os seus planeadores.</p>

      {loading ? (
        <p className="text-sm text-ink-300">A carregar...</p>
      ) : (
        <div className="space-y-4">
          {divisoes.map((d) => (
            <div key={d.id} className="border border-sand-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <input
                  type="text"
                  defaultValue={d.label}
                  disabled={!editavel}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== d.label) atualizarLabel(d.id, v); else e.target.value = d.label; }}
                  className="input font-medium flex-1"
                />
                {editavel && (
                  <button onClick={() => removerDivisao(d.id, d.label)} className="text-ink-300 hover:text-red-600 shrink-0"><Trash2 size={16} /></button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-ink-400 block">Comprimento (m)</label>
                  <input type="number" step="0.01" disabled={!editavel} defaultValue={d.comprimento ?? ''} onBlur={(e) => atualizarMedida(d.id, 'comprimento', parseFloat(e.target.value) || 0)} className="input w-full text-sm py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-400 block">Largura (m)</label>
                  <input type="number" step="0.01" disabled={!editavel} defaultValue={d.largura ?? ''} onBlur={(e) => atualizarMedida(d.id, 'largura', parseFloat(e.target.value) || 0)} className="input w-full text-sm py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-400 block">Pé-direito (m)</label>
                  <input type="number" step="0.01" disabled={!editavel} defaultValue={d.pe_direito ?? ''} onBlur={(e) => atualizarMedida(d.id, 'pe_direito', parseFloat(e.target.value) || 0)} className="input w-full text-sm py-1" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {PLANEADORES.map((p) => {
                  const Icon = p.icon;
                  const configurado = !!d[p.configKey];
                  return (
                    <button
                      key={p.tipo}
                      type="button"
                      disabled={!editavel}
                      onClick={() => setModalAberto({ tipo: p.tipo, divisaoId: d.id })}
                      className="text-xs border border-brand-300 text-brand-700 bg-brand-50 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-brand-100 disabled:opacity-50"
                    >
                      <Icon size={13} /> {configurado ? `${p.label} configurado — editar` : `Configurar ${p.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {divisoes.length === 0 && <p className="text-sm text-ink-400">Ainda sem divisões — adiciona a primeira abaixo.</p>}
        </div>
      )}

      {editavel && (
        <div className="flex gap-2 mt-4">
          <input type="text" placeholder="Nome da divisão (ex: Sala)" value={novoLabel} onChange={(e) => setNovoLabel(e.target.value)} className="input flex-1" />
          <button onClick={adicionarDivisao} className="btn-primary bg-brand-500 hover:bg-brand-600"><Plus size={16} /> Adicionar Divisão</button>
        </div>
      )}

      {modalAberto && divisaoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalAberto(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink-800">
                Planeador de {PLANEADORES.find((p) => p.tipo === modalAberto.tipo)?.label} — {divisaoModal.label}
              </h3>
              <button onClick={() => setModalAberto(null)} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>

            {modalAberto.tipo === 'pladur' && (
              <PladurWizard
                aGuardar={aGuardar}
                configInicial={divisaoModal.pladur_config}
                espacoPartilhado={{
                  nome: divisaoModal.label,
                  comprimento: divisaoModal.comprimento || undefined,
                  largura: divisaoModal.largura || undefined,
                  peDireito: divisaoModal.pe_direito || undefined,
                }}
                onFinalizar={(resultado, config) => guardarPlaneador(divisaoModal, 'pladur', resultado, config)}
              />
            )}
            {modalAberto.tipo === 'pintura' && (
              <PinturaWizard
                aGuardar={aGuardar}
                configInicial={divisaoModal.pintura_config}
                espacoPartilhado={{
                  comprimento: divisaoModal.comprimento || undefined,
                  largura: divisaoModal.largura || undefined,
                  peDireito: divisaoModal.pe_direito || undefined,
                }}
                paredesPladur={divisaoModal.pladur_config?.paredes.map((p) => ({ larguraM: p.larguraM, lado: p.lado }))}
                onFinalizar={(resultado, config) => guardarPlaneador(divisaoModal, 'pintura', resultado, config)}
              />
            )}
            {modalAberto.tipo === 'pavimento' && (
              <PavimentoWizard
                aGuardar={aGuardar}
                configInicial={divisaoModal.pavimento_config}
                espacoPartilhado={{
                  comprimento: divisaoModal.comprimento || undefined,
                  largura: divisaoModal.largura || undefined,
                }}
                onFinalizar={(resultado, config) => guardarPlaneador(divisaoModal, 'pavimento', resultado, config)}
              />
            )}
            {modalAberto.tipo === 'eletrica' && (
              <EletricaWizard
                aGuardar={aGuardar}
                configInicial={divisaoModal.eletrica_config}
                onFinalizar={(resultado, config) => guardarPlaneador(divisaoModal, 'eletrica', resultado, config)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
