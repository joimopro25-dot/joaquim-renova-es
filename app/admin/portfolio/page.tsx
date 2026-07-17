'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2, Upload, Images, X } from 'lucide-react';

type Projeto = { id: string; titulo: string; categoria: string; descricao: string | null; destaque: boolean };
type Foto = { id: string; projeto_id: string; url: string; tipo: string };

const CATEGORIAS = [
  { value: 'renovacao', label: 'Renovação' },
  { value: 'mobiliario_jardim', label: 'Mobiliário de Jardim' },
  { value: 'ripados', label: 'Ripados' },
  { value: 'projeto_raiz', label: 'Projeto de Raiz' },
  { value: 'outro', label: 'Outro' },
];

export default function PortfolioPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [fotos, setFotos] = useState<Record<string, Foto[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('renovacao');
  const [descricao, setDescricao] = useState('');

  async function carregar() {
    setLoading(true);
    const { data: projetosData } = await supabase.from('projetos').select('*').order('ordem', { ascending: false });
    const lista = projetosData || [];
    setProjetos(lista);
    if (lista.length > 0) {
      const { data: fotosData } = await supabase.from('projeto_fotos').select('*').in('projeto_id', lista.map((p) => p.id));
      const agrupado: Record<string, Foto[]> = {};
      for (const f of fotosData || []) (agrupado[f.projeto_id] ||= []).push(f);
      setFotos(agrupado);
    } else {
      setFotos({});
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function criarProjeto(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('projetos').insert([{ titulo, categoria, descricao: descricao || null }]);
    setTitulo(''); setCategoria('renovacao'); setDescricao('');
    setShowForm(false);
    carregar();
  }

  async function removerProjeto(id: string) {
    if (!confirm('Remover este projeto e todas as suas fotos?')) return;
    await supabase.from('projetos').delete().eq('id', id);
    carregar();
  }

  async function toggleDestaque(p: Projeto) {
    await supabase.from('projetos').update({ destaque: !p.destaque }).eq('id', p.id);
    carregar();
  }

  async function enviarFoto(projetoId: string, tipo: string, ficheiro: File | null) {
    if (!ficheiro) return;
    setUploading(true);
    const path = `${projetoId}/${Date.now()}-${ficheiro.name}`;
    const { error } = await supabase.storage.from('portfolio').upload(path, ficheiro);
    if (error) { alert('Erro: ' + error.message); setUploading(false); return; }
    const url = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
    await supabase.from('projeto_fotos').insert([{ projeto_id: projetoId, url, tipo }]);
    setUploading(false);
    carregar();
  }

  async function removerFoto(id: string) {
    await supabase.from('projeto_fotos').delete().eq('id', id);
    carregar();
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{projetos.length} projeto{projetos.length !== 1 ? 's' : ''} no portfólio</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Projeto
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Projeto</h2>
          <form onSubmit={criarProjeto} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" required />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="text" placeholder="Descrição breve" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" />
            <button className="btn-primary justify-center md:col-span-3">Criar Projeto</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-ink-300 text-sm">A carregar...</div>
      ) : projetos.length === 0 ? (
        <div className="card p-10 text-center text-ink-400 text-sm">
          <Images size={28} className="mx-auto mb-2 text-ink-200" />
          Ainda sem projetos no portfólio.
        </div>
      ) : (
        <div className="space-y-4">
          {projetos.map((p) => {
            const fotosProjeto = fotos[p.id] || [];
            const aExpandido = aberto === p.id;
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-3 cursor-pointer" onClick={() => setAberto(aExpandido ? null : p.id)}>
                  <div>
                    <p className="font-medium text-ink-800">{p.titulo}</p>
                    <p className="text-xs text-ink-400">{CATEGORIAS.find((c) => c.value === p.categoria)?.label} · {fotosProjeto.length} foto{fotosProjeto.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={p.destaque} onChange={() => toggleDestaque(p)} /> Destacar no site
                    </label>
                    <button onClick={(e) => { e.stopPropagation(); removerProjeto(p.id); }} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </div>

                {aExpandido && (
                  <div className="p-4 border-t border-sand-100 bg-sand-50">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['antes', 'depois', 'geral'].map((tipo) => (
                        <label key={tipo} className="btn-primary text-xs px-3 py-1.5 cursor-pointer">
                          <Upload size={13} /> {uploading ? 'A enviar...' : `+ Foto (${tipo})`}
                          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => enviarFoto(p.id, tipo, e.target.files?.[0] || null)} />
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {fotosProjeto.map((f) => (
                        <div key={f.id} className="relative group">
                          <img src={f.url} className="w-full aspect-square object-cover rounded-lg border border-sand-200" />
                          <span className="badge bg-white/90 text-ink-600 absolute bottom-1 left-1 text-[10px]">{f.tipo}</span>
                          <button onClick={() => removerFoto(f.id)} className="absolute top-1 right-1 bg-white/90 rounded-md p-1 text-ink-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
