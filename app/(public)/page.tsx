'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { ICONES } from '../../lib/icons';
import { CheckCircle2 } from 'lucide-react';
import PedidoOrcamento from '../../components/PedidoOrcamento';

type SiteSettings = { hero_titulo: string; hero_subtitulo: string; telefone: string | null; email: string | null };
type Servico = { id: string; titulo: string; descricao: string | null; icone: string };
type Foto = { id: string; url: string; tipo: string };
type Projeto = { id: string; titulo: string; categoria: string; descricao: string | null; fotos: Foto[] };

const CATEGORIA_LABEL: Record<string, string> = {
  renovacao: 'Renovação',
  mobiliario_jardim: 'Mobiliário de Jardim',
  ripados: 'Ripados',
  projeto_raiz: 'Projeto de Raiz',
  outro: 'Outro',
};

export default function HomePage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);

  useEffect(() => {
    async function carregar() {
      const [{ data: s }, { data: sv }, { data: pj }] = await Promise.all([
        supabase.from('site_settings').select('*').eq('id', 1).single(),
        supabase.from('servicos_site').select('*').order('ordem'),
        supabase.from('projetos').select('*, projeto_fotos(id, url, tipo)').eq('destaque', true).order('ordem', { ascending: false }),
      ]);
      setSettings(s);
      setServicos(sv || []);
      setProjetos((pj || []).map((p: any) => ({ ...p, fotos: p.projeto_fotos || [] })));
    }
    carregar();
  }, []);

  return (
    <main className="min-h-screen bg-sand-50">
      <header className="flex items-center justify-between px-6 md:px-12 py-5">
        <span className="font-heading font-bold text-lg text-brand-600">Joaquim Renovações</span>
        <div className="flex gap-2 text-sm">
          <Link href="/admin" className="px-3 py-1.5 text-ink-400 hover:text-ink-700">Staff</Link>
          <Link href="/portal" className="px-3 py-1.5 border border-sand-200 rounded-lg text-ink-600 hover:bg-white">Área Cliente</Link>
        </div>
      </header>

      <section className="text-center px-6 py-16 md:py-24 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-heading font-semibold text-ink-800 mb-4">
          {settings?.hero_titulo || 'Renovações com transparência, do orçamento à entrega.'}
        </h1>
        <p className="text-lg text-ink-500 mb-8">
          {settings?.hero_subtitulo || 'Acompanhe o progresso da sua obra em tempo real.'}
        </p>
        <a href="#contacto" className="btn-primary inline-flex text-base px-6 py-3">
          Pedir Orçamento
        </a>
      </section>

      {servicos.length > 0 && (
        <section className="px-6 md:px-12 py-12 max-w-5xl mx-auto">
          <h2 className="text-2xl font-heading font-semibold text-ink-800 text-center mb-10">Serviços</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {servicos.map((s) => {
              const Icon = ICONES[s.icone] || ICONES.Hammer;
              return (
                <div key={s.id} className="card p-6">
                  <Icon size={24} className="text-brand-500 mb-3" />
                  <h3 className="font-semibold text-ink-800 mb-1">{s.titulo}</h3>
                  {s.descricao && <p className="text-sm text-ink-500">{s.descricao}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {projetos.length > 0 && (
        <section className="px-6 md:px-12 py-12 max-w-5xl mx-auto">
          <h2 className="text-2xl font-heading font-semibold text-ink-800 text-center mb-10">Projetos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projetos.map((p) => {
              const antes = p.fotos.find((f) => f.tipo === 'antes');
              const depois = p.fotos.find((f) => f.tipo === 'depois');
              const geral = p.fotos.find((f) => f.tipo === 'geral') || p.fotos[0];
              return (
                <div key={p.id} className="card overflow-hidden">
                  {antes && depois ? (
                    <div className="grid grid-cols-2">
                      <div className="relative">
                        <img src={antes.url} className="w-full aspect-square object-cover" />
                        <span className="absolute bottom-1 left-1 badge bg-white/90 text-ink-600 text-[10px]">Antes</span>
                      </div>
                      <div className="relative">
                        <img src={depois.url} className="w-full aspect-square object-cover" />
                        <span className="absolute bottom-1 left-1 badge bg-white/90 text-ink-600 text-[10px]">Depois</span>
                      </div>
                    </div>
                  ) : geral ? (
                    <img src={geral.url} className="w-full aspect-video object-cover" />
                  ) : null}
                  <div className="p-4">
                    <span className="badge bg-brand-50 text-brand-700 text-[10px] mb-2 inline-block">{CATEGORIA_LABEL[p.categoria] || p.categoria}</span>
                    <h3 className="font-semibold text-ink-800">{p.titulo}</h3>
                    {p.descricao && <p className="text-sm text-ink-500 mt-1">{p.descricao}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-6 md:px-12 py-12 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-center">
          {['Orçamento sem compromisso', 'Acompanhamento com fotos', 'Prazos e custos claros'].map((t) => (
            <div key={t} className="flex flex-col items-center gap-2">
              <CheckCircle2 size={22} className="text-brand-500" />
              <span className="text-sm text-ink-600">{t}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="contacto" className="px-6 md:px-12 py-12 max-w-xl mx-auto">
        <div className="card p-8">
          <h2 className="text-xl font-heading font-semibold text-ink-800 mb-1">Pedir Orçamento</h2>
          <p className="text-sm text-ink-400 mb-6">Diga-nos o que precisa, em poucos passos.</p>
          <PedidoOrcamento />
        </div>
      </section>

      <footer className="text-center text-xs text-ink-300 py-8">
        {settings?.telefone && <span>{settings.telefone} · </span>}
        {settings?.email && <span>{settings.email} · </span>}
        © {new Date().getFullYear()} Joaquim Renovações
      </footer>
    </main>
  );
}
