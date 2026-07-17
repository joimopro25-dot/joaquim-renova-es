'use client';

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, X, Loader2, Check, Trash2, PackagePlus } from 'lucide-react';

type Obra = { id: string; titulo: string };

type Item = {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto_percentagem: number;
  iva_percentagem: number;
  adicionarStock: boolean;
  materialNome: string;
};

function subtotalItem(i: Item) {
  return i.quantidade * i.preco_unitario * (1 - i.desconto_percentagem / 100) * (1 + i.iva_percentagem / 100);
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

export default function ScanFatura({ obras, onSaved, onClose }: { obras: Obra[]; onSaved: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'loading' | 'review'>('upload');
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  const [obraId, setObraId] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [data, setData] = useState('');
  const [total, setTotal] = useState('');
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
      setTotal(json.total != null ? String(json.total) : '');
      setItens((json.itens || []).map((it: any) => ({
        descricao: it.descricao || '',
        quantidade: it.quantidade ?? 1,
        preco_unitario: it.preco_unitario ?? 0,
        desconto_percentagem: it.desconto_percentagem ?? 0,
        iva_percentagem: it.iva_percentagem ?? 23,
        adicionarStock: false,
        materialNome: it.descricao || '',
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

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  const somaItens = itens.reduce((s, it) => s + subtotalItem(it), 0);

  async function confirmarGravar() {
    if (!obraId) { setErro('Escolhe a obra a que esta despesa pertence.'); return; }
    setSaving(true);
    setErro('');

    let comprovativoUrl: string | null = null;
    if (ficheiro) {
      const path = `${obraId}/${Date.now()}-${ficheiro.name}`;
      const { error: uploadError } = await supabase.storage.from('comprovativos').upload(path, ficheiro);
      if (uploadError) { setErro('Erro ao enviar o comprovativo: ' + uploadError.message); setSaving(false); return; }
      comprovativoUrl = supabase.storage.from('comprovativos').getPublicUrl(path).data.publicUrl;
    }

    const valorFinal = total ? parseFloat(total) : somaItens;
    const { data: despesa, error: despesaError } = await supabase.from('despesas').insert([{
      obra_id: obraId,
      descricao: fornecedor || 'Fatura digitalizada',
      categoria: 'material',
      valor: valorFinal,
      fornecedor: fornecedor || null,
      data_despesa: data || new Date().toISOString().slice(0, 10),
      comprovativo_url: comprovativoUrl,
    }]).select().single();

    if (despesaError) { setErro('Erro ao gravar despesa: ' + despesaError.message); setSaving(false); return; }

    for (const item of itens) {
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

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-sand-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-ink-800 flex items-center gap-2"><Camera size={18} /> Digitalizar Fatura</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={20} /></button>
        </div>

        <div className="p-5">
          {step === 'upload' && (
            <div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sand-200 rounded-xl py-12 cursor-pointer hover:border-brand-300 transition-colors">
                <Camera size={32} className="text-ink-300" />
                <span className="text-sm text-ink-500">Tira uma foto ou escolhe um ficheiro da fatura/recibo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFicheiro(e.target.files?.[0] || null)} />
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
              {previewUrl && <img src={previewUrl} alt="Fatura" className="max-h-40 rounded-lg border border-sand-200 mx-auto" />}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="input" required>
                  <option value="">Selecionar Obra</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                </select>
                <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="input" />
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" />
              </div>

              <div className="border border-sand-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sand-50 text-ink-400 text-xs uppercase">
                    <tr>
                      <th className="p-2 font-medium">Artigo</th>
                      <th className="p-2 font-medium w-16">Qtd</th>
                      <th className="p-2 font-medium w-20">P. Unit.</th>
                      <th className="p-2 font-medium w-16">Desc %</th>
                      <th className="p-2 font-medium w-16">IVA %</th>
                      <th className="p-2 font-medium w-24">Stock?</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {itens.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input value={it.descricao} onChange={(e) => atualizarItem(idx, 'descricao', e.target.value)} className="input py-1 w-full" />
                        </td>
                        <td className="p-2"><input type="number" step="0.01" value={it.quantidade} onChange={(e) => atualizarItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.preco_unitario} onChange={(e) => atualizarItem(idx, 'preco_unitario', parseFloat(e.target.value) || 0)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.desconto_percentagem} onChange={(e) => atualizarItem(idx, 'desconto_percentagem', parseFloat(e.target.value) || 0)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.iva_percentagem} onChange={(e) => atualizarItem(idx, 'iva_percentagem', parseFloat(e.target.value) || 0)} className="input py-1 w-full" /></td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => atualizarItem(idx, 'adicionarStock', !it.adicionarStock)}
                            className={`p-1.5 rounded-md ${it.adicionarStock ? 'bg-brand-100 text-brand-700' : 'bg-sand-100 text-ink-300'}`}
                            title="Adicionar este artigo ao Stock"
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-400">Soma das linhas: {somaItens.toFixed(2)} €</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-500">Total a gravar (€)</span>
                  <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className="input py-1 w-28 text-right" />
                </div>
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
