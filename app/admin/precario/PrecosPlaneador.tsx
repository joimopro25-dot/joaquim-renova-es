'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ImageOff } from 'lucide-react';

type Item = { id: string; tipo: string; chave: string; descricao: string; unidade: string; preco: number; ordem: number; fonte: string | null; imagem_url: string | null };

function Miniatura({ url, onChange }: { url: string | null; onChange: (url: string) => void }) {
  const [aEditar, setAEditar] = useState(false);
  const [erro, setErro] = useState(false);

  if (aEditar) {
    return (
      <input
        type="text"
        autoFocus
        placeholder="URL da imagem"
        defaultValue={url || ''}
        onBlur={(e) => { onChange(e.target.value); setAEditar(false); setErro(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="input w-32 text-[10px] py-1"
      />
    );
  }

  return (
    <button type="button" onClick={() => setAEditar(true)} title="Clica para editar a URL da imagem" className="block w-10 h-10 rounded-md border border-sand-200 bg-white overflow-hidden flex items-center justify-center hover:border-brand-300">
      {url && !erro ? (
        <img src={url} alt="" className="w-full h-full object-contain" onError={() => setErro(true)} />
      ) : (
        <ImageOff size={16} className="text-ink-200" />
      )}
    </button>
  );
}

export default function PrecosPlaneador({ tabela, descricaoIntro }: { tabela: string; descricaoIntro: string }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from(tabela).select('*').order('tipo').order('ordem');
    setItens(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [tabela]);

  async function atualizarPreco(id: string, preco: number) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, preco } : i)));
    await supabase.from(tabela).update({ preco }).eq('id', id);
  }

  async function atualizarFonte(id: string, fonte: string) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, fonte: fonte || null } : i)));
    await supabase.from(tabela).update({ fonte: fonte || null }).eq('id', id);
  }

  async function atualizarImagem(id: string, imagem_url: string) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, imagem_url: imagem_url || null } : i)));
    await supabase.from(tabela).update({ imagem_url: imagem_url || null }).eq('id', id);
  }

  if (loading) return <div className="text-center py-10 text-ink-300 text-sm">A carregar...</div>;

  const materiais = itens.filter((i) => i.tipo === 'material');
  const maoDeObra = itens.filter((i) => i.tipo === 'mao_obra');

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-400">{descricaoIntro}</p>

      {materiais.length > 0 && (
        <div className="card overflow-hidden">
          <div className="bg-sand-50 px-4 py-2 font-medium text-sm text-ink-700">Materiais</div>
          <table className="w-full text-left text-sm">
            <thead className="text-ink-400 text-xs uppercase">
              <tr>
                <th className="p-3 font-medium"></th>
                <th className="p-3 font-medium">Descrição</th>
                <th className="p-3 font-medium">Un</th>
                <th className="p-3 font-medium text-right">Preço (PVP)</th>
                <th className="p-3 font-medium">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {materiais.map((i) => (
                <tr key={i.id}>
                  <td className="p-2 w-16">
                    <Miniatura url={i.imagem_url} onChange={(url) => atualizarImagem(i.id, url)} />
                  </td>
                  <td className="p-3 text-ink-800">{i.descricao}</td>
                  <td className="p-3 text-ink-500">{i.unidade}</td>
                  <td className="p-3 text-right">
                    <input type="number" step="0.01" defaultValue={i.preco} onBlur={(e) => atualizarPreco(i.id, parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
                  </td>
                  <td className="p-3">
                    <input type="text" placeholder="loja / produto / link" defaultValue={i.fonte || ''} onBlur={(e) => atualizarFonte(i.id, e.target.value)} className="input w-56 text-xs py-1" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {maoDeObra.length > 0 && (
        <div className="card overflow-hidden">
          <div className="bg-sand-50 px-4 py-2 font-medium text-sm text-ink-700">Mão de Obra</div>
          <table className="w-full text-left text-sm">
            <thead className="text-ink-400 text-xs uppercase">
              <tr>
                <th className="p-3 font-medium">Trabalho</th>
                <th className="p-3 font-medium">Un</th>
                <th className="p-3 font-medium text-right">Preço</th>
                <th className="p-3 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {maoDeObra.map((i) => (
                <tr key={i.id}>
                  <td className="p-3 text-ink-800">{i.descricao}</td>
                  <td className="p-3 text-ink-500">{i.unidade}</td>
                  <td className="p-3 text-right">
                    <input type="number" step="0.5" defaultValue={i.preco} onBlur={(e) => atualizarPreco(i.id, parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
                  </td>
                  <td className="p-3">
                    <input type="text" placeholder="opcional" defaultValue={i.fonte || ''} onBlur={(e) => atualizarFonte(i.id, e.target.value)} className="input w-56 text-xs py-1" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
