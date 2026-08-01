'use client';

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Upload, X, Loader2, Check, Trash2, FileText } from 'lucide-react';

type Cliente = { id: string; nome: string };

type Linha = {
  capitulo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  custo_material: number;
};

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

type Props = {
  clientes: Cliente[];
  onSaved: (id: string) => void;
  onClose: () => void;
  orcamentoExistenteId?: string;
  orcamentoExistenteTitulo?: string;
};

export default function ImportarOrcamento({ clientes, onSaved, onClose, orcamentoExistenteId, orcamentoExistenteTitulo }: Props) {
  const [step, setStep] = useState<'upload' | 'loading' | 'review'>('upload');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);

  async function handleFicheiro(f: File | null) {
    if (!f) return;
    setErro('');
    setStep('loading');
    try {
      const { base64, mediaType } = await fileParaBase64(f);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/orcamentos/importar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fileBase64: base64, mediaType }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Erro ao processar o documento.');

      setTitulo(json.titulo || '');
      setDescricao(json.descricao || '');
      setLinhas((json.linhas || []).map((l: any) => ({
        capitulo: l.capitulo || 'Geral',
        descricao: l.descricao || '',
        unidade: l.unidade || 'un',
        quantidade: l.quantidade ?? 1,
        custo_material: l.custo_material ?? 0,
      })));
      setStep('review');
    } catch (e: any) {
      setErro(e.message || 'Erro ao processar o documento.');
      setStep('upload');
    }
  }

  function atualizarLinha(idx: number, campo: keyof Linha, valor: any) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  }

  function adicionarLinhaVazia() {
    setLinhas((prev) => [...prev, { capitulo: 'Geral', descricao: '', unidade: 'un', quantidade: 1, custo_material: 0 }]);
  }

  async function confirmarCriar() {
    if (!orcamentoExistenteId) {
      if (!clienteId) { setErro('Escolhe o cliente deste orçamento.'); return; }
      if (!titulo.trim()) { setErro('O orçamento precisa de um título.'); return; }
    }
    setSaving(true);
    setErro('');

    let orcamentoId = orcamentoExistenteId;

    if (!orcamentoId) {
      const { data: orcamento, error: orcError } = await supabase.from('orcamentos').insert([{
        cliente_id: clienteId,
        titulo,
        descricao: descricao || null,
        status: 'rascunho',
      }]).select().single();
      if (orcError) { setErro('Erro ao criar orçamento: ' + orcError.message); setSaving(false); return; }
      orcamentoId = orcamento.id;
    }

    if (linhas.length > 0) {
      const { error: linhasError } = await supabase.from('orcamento_linhas').insert(
        linhas.map((l) => ({
          orcamento_id: orcamentoId,
          capitulo: l.capitulo || 'Geral',
          descricao: l.descricao,
          unidade: l.unidade || 'un',
          quantidade: l.quantidade || 1,
          rendimento_horas: 0,
          custo_material: l.custo_material || 0,
        }))
      );
      if (linhasError) { setErro((orcamentoExistenteId ? '' : 'Orçamento criado, mas ') + 'falhou ao adicionar linhas: ' + linhasError.message); setSaving(false); return; }
    }

    setSaving(false);
    onSaved(orcamentoId!);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-sand-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-ink-800 flex items-center gap-2">
            <FileText size={18} /> {orcamentoExistenteId ? `Importar Linhas para "${orcamentoExistenteTitulo}"` : 'Importar Orçamento'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={20} /></button>
        </div>

        <div className="p-5">
          {step === 'upload' && (
            <div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sand-200 rounded-xl py-12 cursor-pointer hover:border-brand-300 transition-colors">
                <Upload size={32} className="text-ink-300" />
                <span className="text-sm text-ink-500">Escolhe um PDF ou documento Word (.docx) do orçamento</span>
                <input type="file" accept="application/pdf,.docx" className="hidden" onChange={(e) => handleFicheiro(e.target.files?.[0] || null)} />
              </label>
              {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={32} className="text-brand-500 animate-spin" />
              <p className="text-sm text-ink-500">A ler o documento...</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {orcamentoExistenteId ? (
                <p className="text-sm text-ink-500 bg-sand-50 border border-sand-200 rounded-lg p-3">
                  As linhas abaixo vão ser adicionadas ao orçamento <strong>{orcamentoExistenteTitulo}</strong>, juntando-se às que já lá estão.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input" required>
                      <option value="">Selecionar Cliente</option>
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <input type="text" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" required />
                  </div>
                  <textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input w-full" rows={2} />
                </>
              )}

              <div className="border border-sand-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sand-50 text-ink-400 text-xs uppercase">
                    <tr>
                      <th className="p-2 font-medium">Capítulo</th>
                      <th className="p-2 font-medium">Descrição</th>
                      <th className="p-2 font-medium w-16">Un</th>
                      <th className="p-2 font-medium w-20">Qtd</th>
                      <th className="p-2 font-medium w-24">Valor/un</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {linhas.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2"><input value={l.capitulo} onChange={(e) => atualizarLinha(idx, 'capitulo', e.target.value)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input value={l.descricao} onChange={(e) => atualizarLinha(idx, 'descricao', e.target.value)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input value={l.unidade} onChange={(e) => atualizarLinha(idx, 'unidade', e.target.value)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={l.quantidade} onChange={(e) => atualizarLinha(idx, 'quantidade', parseFloat(e.target.value) || 0)} className="input py-1 w-full" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={l.custo_material} onChange={(e) => atualizarLinha(idx, 'custo_material', parseFloat(e.target.value) || 0)} className="input py-1 w-full" /></td>
                        <td className="p-2">
                          <button onClick={() => removerLinha(idx)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={adicionarLinhaVazia} className="text-sm text-brand-600 hover:text-brand-700">+ Adicionar linha</button>

              <p className="text-xs text-ink-400">
                As linhas importadas ficam apenas com o valor de material (sem separar mão-de-obra), para preservar os montantes do documento original. Podes editar tudo depois, incluindo dividir por horas de mão-de-obra.
              </p>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <button onClick={confirmarCriar} disabled={saving} className="btn-primary w-full justify-center disabled:opacity-60">
                <Check size={16} /> {saving ? 'A guardar...' : orcamentoExistenteId ? 'Adicionar Linhas ao Orçamento' : 'Criar Orçamento'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
