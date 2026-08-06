'use client';

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, X, Loader2, Check, Trash2, PackagePlus, FileText } from 'lucide-react';

type Obra = { id: string; titulo: string };
type Subempreitada = { id: string; descricao: string };

type Item = {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto_percentagem: number;
  iva_percentagem: number;
  adicionarStock: boolean;
  materialNome: string;
  incluir: boolean;
  destino: string;
};

const OPCAO_GERAL = 'geral';

function subtotalItem(i: Item) {
  return i.quantidade * i.preco_unitario * (1 - i.desconto_percentagem / 100) * (1 + i.iva_percentagem / 100);
}

function parseDestino(destino: string): { obra_id: string | null; subempreitada_id: string | null } {
  if (destino === OPCAO_GERAL || !destino) return { obra_id: null, subempreitada_id: null };
  const [tipo, valorId] = destino.split(':');
  if (tipo === 'obra') return { obra_id: valorId, subempreitada_id: null };
  if (tipo === 'sub') return { obra_id: null, subempreitada_id: valorId };
  return { obra_id: null, subempreitada_id: null };
}

function fileParaBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScanFatura({ obras, subs, onSaved, onClose }: { obras: Obra[]; subs: Subempreitada[]; onSaved: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'loading' | 'review'>('upload');
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  const [fornecedor, setFornecedor] = useState('');
  const [data, setData] = useState('');
  const [itens, setItens] = useState<Item[]>([]);

  async function handleFicheiro(f: File | null) {
    if (!f) return;
    setFicheiro(f);
    setPreviewUrl(URL.createObjectURL(f));
    setErro('');
    setStep('loading');
    try {
      const { base64, mediaType } = await fileParaBase64(f);
      const resp = await fetch('/api/scan-fatura', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Erro ao ler a fatura.');

      setFornecedor(json.fornecedor || '');
      setData(json.data || new Date().toISOString().slice(0, 10));
      setItens((json.itens || []).map((it: any) => ({
        descricao: it.descricao || '',
        quantidade: it.quantidade ?? 1,
        preco_unitario: it.preco_unitario ?? 0,
        desconto_percentagem: it.desconto_percentagem ?? 0,
        iva_percentagem: it.iva_percentagem ?? 23,
        adicionarStock: false,
        materialNome: it.descricao || '',
        incluir: true,
        destino: '',
      })));
      setStep('review');
    } catch (e: any) {
      setErro(e.message || 'Erro ao processar a imagem.');
      setStep('upload');
    }
  }

  function atualizarItem(idx: number, campo: keyof Item, valor: any) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function aplicarDestinoATodos(destino: string) {
    setItens((prev) => prev.map((it) => ({ ...it, destino })));
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  const itensIncluidos = itens.filter((it) => it.incluir);
  const somaTotal = itensIncluidos.reduce((s, it) => s + subtotalItem(it), 0);
  const destinosUsados = Array.from(new Set(itensIncluidos.map((it) => it.destino)));

  function labelDestino(destino: string) {
    if (destino === OPCAO_GERAL) return 'Stock / Despesa Geral';
    if (!destino) return '';
    const [tipo, valorId] = destino.split(':');
    if (tipo === 'obra') return obras.find((o) => o.id === valorId)?.titulo || 'Obra';
    if (tipo === 'sub') return subs.find((s) => s.id === valorId)?.descricao || 'Prestação de Serviços';
    return '';
  }

  async function confirmarGravar() {
    if (itensIncluidos.length === 0) { setErro('Nenhum artigo selecionado para gravar.'); return; }
    if (itensIncluidos.some((it) => !it.destino)) { setErro('Escolhe o destino (obra, prestação de serviços ou geral) de cada artigo incluído.'); return; }
    setSaving(true);
    setErro('');

    let comprovativoUrl: string | null = null;
    if (ficheiro) {
      const path = `faturas/${Date.now()}-${ficheiro.name}`;
      const { error: uploadError } = await supabase.storage.from('comprovativos').upload(path, ficheiro);
      if (uploadError) { setErro('Erro ao enviar o comprovativo: ' + uploadError.message); setSaving(false); return; }
      comprovativoUrl = supabase.storage.from('comprovativos').getPublicUrl(path).data.publicUrl;
    }

    const grupos = destinosUsados.map((destino) => ({
      destino,
      itens: itensIncluidos.filter((it) => it.destino === destino),
    }));

    for (const grupo of grupos) {
      const valorGrupo = grupo.itens.reduce((s, it) => s + subtotalItem(it), 0);
      const descricaoBase = fornecedor || 'Fatura digitalizada';
      const { data: despesa, error: despesaError } = await supabase.from('despesas').insert([{
        ...parseDestino(grupo.destino),
        descricao: grupos.length > 1 ? `${descricaoBase} (${labelDestino(grupo.destino)})` : descricaoBase,
        categoria: 'material',
        valor: valorGrupo,
        fornecedor: fornecedor || null,
        data_despesa: data || new Date().toISOString().slice(0, 10),
        comprovativo_url: comprovativoUrl,
      }]).select().single();

      if (despesaError) { setErro('Erro ao gravar despesa: ' + despesaError.message); setSaving(false); return; }

      for (const item of grupo.itens) {
        let materialId: string | null = null;

        if (item.adicionarStock && item.materialNome.trim()) {
          const { data: existente } = await supabase.from('materiais').select('id, stock_atual').ilike('nome', item.materialNome.trim()).maybeSingle();
          if (existente) {
            materialId = existente.id;
            await supabase.from('materiais').update({ stock_atual: existente.stock_atual + item.quantidade }).eq('id', existente.id);
          } else {
            const { data: novoMaterial } = await supabase.from('materiais').insert([{
              nome: item.materialNome.trim(),
              unidade: 'un',
              stock_atual: item.quantidade,
              stock_minimo: 0,
              fornecedor_habitual: fornecedor || null,
              custo_medio: item.preco_unitario,
            }]).select().single();
            materialId = novoMaterial?.id || null;
          }
          if (materialId) {
            await supabase.from('movimentos_stock').insert([{
              material_id: materialId,
              obra_id: null,
              tipo: 'entrada',
              quantidade: item.quantidade,
              notas: `Da fatura de ${fornecedor || 'fornecedor desconhecido'}`,
            }]);
          }
        }

        await supabase.from('despesa_itens').insert([{
          despesa_id: despesa.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          desconto_percentagem: item.desconto_percentagem,
          iva_percentagem: item.iva_percentagem,
          material_id: materialId,
        }]);
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-sand-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-ink-800 flex items-center gap-2"><Camera size={18} /> Digitalizar Fatura</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={20} /></button>
        </div>

        <div className="p-5">
          {step === 'upload' && (
            <div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sand-200 rounded-xl py-12 cursor-pointer hover:border-brand-300 transition-colors">
                <Camera size={32} className="text-ink-300" />
                <span className="text-sm text-ink-500">Tira uma foto, ou escolhe uma imagem/PDF da fatura</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFicheiro(e.target.files?.[0] || null)} />
              </label>
              {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={32} className="text-brand-500 animate-spin" />
              <p className="text-sm text-ink-500">A ler a fatura...</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {previewUrl && (
                ficheiro?.type === 'application/pdf' ? (
                  <div className="flex items-center gap-2 justify-center text-ink-500 text-sm border border-sand-200 rounded-lg py-4">
                    <FileText size={20} /> {ficheiro.name}
                  </div>
                ) : (
                  <img src={previewUrl} alt="Fatura" className="max-h-40 rounded-lg border border-sand-200 mx-auto" />
                )
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="input" />
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" />
              </div>

              <div className="bg-sand-50 border border-sand-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-500">Podes comprar para várias obras na mesma fatura — escolhe o destino de cada artigo abaixo. Atalho: aplicar a todos:</span>
                <select onChange={(e) => { if (e.target.value) { aplicarDestinoATodos(e.target.value); e.target.value = ''; } }} defaultValue="" className="input text-xs py-1 w-auto">
                  <option value="" disabled>Escolher destino para todos...</option>
                  <option value={OPCAO_GERAL}>Stock / Despesa Geral</option>
                  {obras.map((o) => <option key={o.id} value={`obra:${o.id}`}>{o.titulo}</option>)}
                  {subs.map((s) => <option key={s.id} value={`sub:${s.id}`}>{s.descricao}</option>)}
                </select>
              </div>

              <div className="border border-sand-200 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sand-50 text-ink-400 text-xs uppercase">
                    <tr>
                      <th className="p-2 font-medium w-10">Incl.</th>
                      <th className="p-2 font-medium">Artigo</th>
                      <th className="p-2 font-medium w-16">Qtd</th>
                      <th className="p-2 font-medium w-20">P. Unit.</th>
                      <th className="p-2 font-medium w-16">Desc %</th>
                      <th className="p-2 font-medium w-16">IVA %</th>
                      <th className="p-2 font-medium w-40">Destino</th>
                      <th className="p-2 font-medium w-24">Stock?</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {itens.map((it, idx) => (
                      <tr key={idx} className={!it.incluir ? 'opacity-40' : ''}>
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={it.incluir} onChange={(e) => atualizarItem(idx, 'incluir', e.target.checked)} title="Incluir este artigo" />
                        </td>
                        <td className="p-2">
                          <input value={it.descricao} onChange={(e) => atualizarItem(idx, 'descricao', e.target.value)} className="input py-1 w-full" disabled={!it.incluir} />
                        </td>
                        <td className="p-2"><input type="number" step="0.01" value={it.quantidade} onChange={(e) => atualizarItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} className="input py-1 w-full" disabled={!it.incluir} /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.preco_unitario} onChange={(e) => atualizarItem(idx, 'preco_unitario', parseFloat(e.target.value) || 0)} className="input py-1 w-full" disabled={!it.incluir} /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.desconto_percentagem} onChange={(e) => atualizarItem(idx, 'desconto_percentagem', parseFloat(e.target.value) || 0)} className="input py-1 w-full" disabled={!it.incluir} /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.iva_percentagem} onChange={(e) => atualizarItem(idx, 'iva_percentagem', parseFloat(e.target.value) || 0)} className="input py-1 w-full" disabled={!it.incluir} /></td>
                        <td className="p-2">
                          <select value={it.destino} onChange={(e) => atualizarItem(idx, 'destino', e.target.value)} className="input py-1 w-full text-xs" disabled={!it.incluir}>
                            <option value="">Escolher...</option>
                            <option value={OPCAO_GERAL}>Stock / Geral</option>
                            {obras.map((o) => <option key={o.id} value={`obra:${o.id}`}>{o.titulo}</option>)}
                            {subs.map((s) => <option key={s.id} value={`sub:${s.id}`}>{s.descricao}</option>)}
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => atualizarItem(idx, 'adicionarStock', !it.adicionarStock)}
                            className={`p-1.5 rounded-md ${it.adicionarStock ? 'bg-brand-100 text-brand-700' : 'bg-sand-100 text-ink-300'}`}
                            title="Adicionar este artigo ao Stock"
                            disabled={!it.incluir}
                          >
                            <PackagePlus size={15} />
                          </button>
                        </td>
                        <td className="p-2">
                          <button onClick={() => removerItem(idx)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {destinosUsados.length > 1 && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800">
                  Esta fatura vai ser dividida em {destinosUsados.length} despesas separadas (uma por destino): {destinosUsados.map((d) => labelDestino(d)).join(', ')}.
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-400">{itensIncluidos.length} artigo{itensIncluidos.length !== 1 ? 's' : ''} incluído{itensIncluidos.length !== 1 ? 's' : ''} de {itens.length}</span>
                <span className="text-sm font-medium text-ink-700">Total a gravar: {somaTotal.toFixed(2)} €</span>
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <button onClick={confirmarGravar} disabled={saving} className="btn-primary w-full justify-center disabled:opacity-60">
                <Check size={16} /> {saving ? 'A gravar...' : 'Confirmar e Gravar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
