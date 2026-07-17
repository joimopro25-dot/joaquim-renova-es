'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ICONES, NOMES_ICONES } from '../../../lib/icons';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';

type SiteSettings = { id: number; hero_titulo: string; hero_subtitulo: string; telefone: string | null; email: string | null };
type Servico = { id: string; titulo: string; descricao: string | null; icone: string; ordem: number };

export default function SitePage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoIcone, setNovoIcone] = useState('Hammer');

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
    await supabase.from('servicos_site').delete().eq('id', id);
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
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 border border-sand-200 rounded-lg">
                <div className="flex flex-col text-ink-300">
                  <button type="button" onClick={() => moverServico(idx, -1)} disabled={idx === 0} className="disabled:opacity-30"><GripVertical size={14} className="rotate-90" /></button>
                </div>
                <Icon size={20} className="text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-800 text-sm">{s.titulo}</p>
                  <p className="text-xs text-ink-400 truncate">{s.descricao}</p>
                </div>
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
