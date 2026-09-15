'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ICONES, NOMES_ICONES } from '../../../lib/icons';
import { Save, Plus, Trash2, GripVertical, Pencil, X, Eye, EyeOff } from 'lucide-react';

type SiteSettings = { id: number; hero_titulo: string; hero_subtitulo: string; telefone: string | null; email: string | null };
type Servico = { id: string; titulo: string; descricao: string | null; icone: string; ordem: number; ativo: boolean };

export default function SitePage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoIcone, setNovoIcone] = useState('Hammer');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edTitulo, setEdTitulo] = useState('');
  const [edDescricao, setEdDescricao] = useState('');
  const [edIcone, setEdIcone] = useState('Hammer');
  const [aGuardarEdicao, setAGuardarEdicao] = useState(false);

  async function carregar() {
    setLoading(true);
    const [{ data: s }, { data: sv }] = await Promise.all([
      supabase.from('site_settings').select('*').eq('id', 1).single(),
      supabase.from('servicos_site').select('*').order('ordem'),
    ]);
    setSettings(s);
    setServicos(sv || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function guardarSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    await supabase.from('site_settings').update({
      hero_titulo: settings.hero_titulo,
      hero_subtitulo: settings.hero_subtitulo,
      telefone: settings.telefone,
      email: settings.email,
    }).eq('id', 1);
    setSaving(false);
  }

  async function adicionarServico(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('servicos_site').insert([{ titulo: novoTitulo, descricao: novaDescricao, icone: novoIcone, ordem: servicos.length }]);
    setNovoTitulo(''); setNovaDescricao(''); setNovoIcone('Hammer');
    carregar();
  }

  async function removerServico(id: string) {
    if (!confirm('Eliminar definitivamente este serviço? Se só queres deixar de o mostrar por agora, usa antes o botão de olho para pôr offline.')) return;
    await supabase.from('servicos_site').delete().eq('id', id);
    carregar();
  }

  async function alternarAtivo(s: Servico) {
    await supabase.from('servicos_site').update({ ativo: !s.ativo }).eq('id', s.id);
    carregar();
  }

  function iniciarEdicao(s: Servico) {
    setEditandoId(s.id);
    setEdTitulo(s.titulo);
    setEdDescricao(s.descricao || '');
    setEdIcone(s.icone);
  }

  async function guardarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoId) return;
    setAGuardarEdicao(true);
    await supabase.from('servicos_site').update({ titulo: edTitulo, descricao: edDescricao, icone: edIcone }).eq('id', editandoId);
    setAGuardarEdicao(false);
    setEditandoId(null);
    carregar();
  }

  async function moverServico(idx: number, direcao: -1 | 1) {
    const alvo = idx + direcao;
    if (alvo < 0 || alvo >= servicos.length) return;
    const a = servicos[idx];
    const b = servicos[alvo];
    await Promise.all([
      supabase.from('servicos_site').update({ ordem: b.ordem }).eq('id', a.id),
      supabase.from('servicos_site').update({ ordem: a.ordem }).eq('id', b.id),
    ]);
    carregar();
  }

  if (loading || !settings) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6">
      <form onSubmit={guardarSettings} className="card p-6 space-y-3">
        <h2 className="font-semibold text-ink-700 mb-1">Página Inicial</h2>
        <div>
          <label className="text-xs text-ink-400 uppercase tracking-wide">Título principal</label>
          <input type="text" value={settings.hero_titulo} onChange={(e) => setSettings({ ...settings, hero_titulo: e.target.value })} className="input w-full mt-1" />
        </div>
        <div>
          <label className="text-xs text-ink-400 uppercase tracking-wide">Subtítulo</label>
          <textarea value={settings.hero_subtitulo} onChange={(e) => setSettings({ ...settings, hero_subtitulo: e.target.value })} className="input w-full mt-1" rows={2} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-400 uppercase tracking-wide">Telefone</label>
            <input type="text" value={settings.telefone || ''} onChange={(e) => setSettings({ ...settings, telefone: e.target.value })} className="input w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-ink-400 uppercase tracking-wide">Email</label>
            <input type="email" value={settings.email || ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className="input w-full mt-1" />
          </div>
        </div>
        <button disabled={saving} className="btn-primary disabled:opacity-60">
          <Save size={16} /> {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="font-semibold text-ink-700 mb-4">Serviços</h2>
        <div className="space-y-2 mb-4">
          {servicos.map((s, idx) => {
            const Icon = ICONES[s.icone] || ICONES.Hammer;
            if (editandoId === s.id) {
              return (
                <form key={s.id} onSubmit={guardarEdicao} className="p-3 border border-brand-300 bg-brand-50/40 rounded-lg space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <select value={edIcone} onChange={(e) => setEdIcone(e.target.value)} className="input">
                      {NOMES_ICONES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input type="text" placeholder="Título" value={edTitulo} onChange={(e) => setEdTitulo(e.target.value)} className="input md:col-span-3" required />
                  </div>
                  <textarea placeholder="Descrição" value={edDescricao} onChange={(e) => setEdDescricao(e.target.value)} className="input w-full" rows={2} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={aGuardarEdicao} className="btn-primary text-sm py-1.5 disabled:opacity-60">
                      <Save size={14} /> {aGuardarEdicao ? 'A guardar...' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => setEditandoId(null)} className="border border-sand-200 rounded-lg px-3 py-1.5 text-sm text-ink-600 hover:bg-sand-50 flex items-center gap-1">
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                </form>
              );
            }
            return (
              <div key={s.id} className={`flex items-center gap-3 p-3 border rounded-lg ${s.ativo ? 'border-sand-200' : 'border-sand-200 bg-sand-50 opacity-60'}`}>
                <div className="flex flex-col text-ink-300">
                  <button type="button" onClick={() => moverServico(idx, -1)} disabled={idx === 0} className="disabled:opacity-30"><GripVertical size={14} className="rotate-90" /></button>
                </div>
                <Icon size={20} className="text-brand-500 shrink-0" />
                <button type="button" onClick={() => iniciarEdicao(s)} className="flex-1 min-w-0 text-left hover:opacity-70">
                  <p className="font-medium text-ink-800 text-sm flex items-center gap-1.5">
                    {s.titulo}
                    {!s.ativo && <span className="badge bg-sand-200 text-ink-500 text-[10px]">offline</span>}
                  </p>
                  <p className="text-xs text-ink-400 truncate">{s.descricao}</p>
                </button>
                <button onClick={() => alternarAtivo(s)} title={s.ativo ? 'Pôr offline (deixa de aparecer no site)' : 'Reativar no site'} className={s.ativo ? 'text-ink-300 hover:text-brand-600' : 'text-brand-500 hover:text-brand-700'}>
                  {s.ativo ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => iniciarEdicao(s)} className="text-ink-300 hover:text-brand-600"><Pencil size={15} /></button>
                <button onClick={() => removerServico(s.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            );
          })}
          {servicos.length === 0 && <p className="text-sm text-ink-400 text-center py-4">Ainda sem serviços listados.</p>}
        </div>

        <form onSubmit={adicionarServico} className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-3 border-t border-sand-100">
          <select value={novoIcone} onChange={(e) => setNovoIcone(e.target.value)} className="input">
            {NOMES_ICONES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="text" placeholder="Título (ex: Ripados)" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} className="input" required />
          <input type="text" placeholder="Descrição" value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} className="input md:col-span-1" />
          <button className="btn-primary justify-center"><Plus size={16} /> Adicionar</button>
        </form>
      </div>
    </div>
  );
}
