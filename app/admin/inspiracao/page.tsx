'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2, Upload, Sparkles } from 'lucide-react';

type Inspiracao = { id: string; titulo: string; categoria: string; url: string; ordem: number };

const CATEGORIAS = [
  { value: 'casa_banho', label: 'Casa de Banho' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'sala', label: 'Sala' },
  { value: 'exterior_jardim', label: 'Exterior/Jardim' },
  { value: 'ripados', label: 'Ripados' },
  { value: 'outro', label: 'Outro' },
];

export default function InspiracaoPage() {
  const [itens, setItens] = useState<Inspiracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('outro');

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('inspiracoes').select('*').order('ordem', { ascending: false });
    setItens(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function enviarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    if (!titulo.trim()) { alert('Escreve um título antes de carregar a imagem.'); e.target.value = ''; return; }
    setUploading(true);
    const path = `${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('inspiracao').upload(path, ficheiro);
    if (uploadError) { alert('Erro ao enviar: ' + uploadError.message); setUploading(false); return; }
    const url = supabase.storage.from('inspiracao').getPublicUrl(path).data.publicUrl;
    await supabase.from('inspiracoes').insert([{ titulo, categoria, url, ordem: itens.length }]);
    setTitulo('');
    setUploading(false);
    e.target.value = '';
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover esta imagem da galeria de inspiração?')) return;
    await supabase.from('inspiracoes').delete().eq('id', id);
    carregar();
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="card p-4 mb-6 flex items-start gap-2.5 text-sm bg-blue-50 border-blue-100 text-blue-800">
        <Sparkles size={18} className="shrink-0 mt-0.5" />
        <p>
          Esta galeria é para <strong>inspiração dos visitantes</strong> do site (ex: imagens geradas por IA, sem direitos de autor).
          É mostrada separada do Portfólio e identificada no site como imagens ilustrativas — não trabalho realizado pela empresa.
        </p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-ink-700 mb-4">Adicionar Imagem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="text" placeholder="Título (ex: Casa de banho moderna cinza)" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input md:col-span-2" />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <label className="btn-primary justify-center cursor-pointer mt-3 w-full md:w-auto">
          <Upload size={16} /> {uploading ? 'A enviar...' : 'Carregar Imagem'}
          <input type="file" accept="image/*" className="hidden" onChange={enviarImagem} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="text-center py-16 text-ink-300 text-sm">A carregar...</div>
      ) : itens.length === 0 ? (
        <div className="card p-10 text-center text-ink-400 text-sm">
          <Sparkles size={28} className="mx-auto mb-2 text-ink-200" />
          Ainda sem imagens de inspiração.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {itens.map((it) => (
            <div key={it.id} className="relative group card overflow-hidden p-0">
              <img src={it.url} className="w-full aspect-square object-cover" />
              <div className="p-2">
                <p className="text-xs font-medium text-ink-800 truncate">{it.titulo}</p>
                <p className="text-[10px] text-ink-400">{CATEGORIAS.find((c) => c.value === it.categoria)?.label}</p>
              </div>
              <button onClick={() => remover(it.id)} className="absolute top-1.5 right-1.5 bg-white/90 rounded-md p-1 text-ink-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
