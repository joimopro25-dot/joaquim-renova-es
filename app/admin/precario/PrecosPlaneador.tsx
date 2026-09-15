'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { ImageOff, ExternalLink, Pencil, Loader2, X, Star, Trash2, Plus } from 'lucide-react';

type Item = { id: string; tipo: string; chave: string; descricao: string; unidade: string; preco: number; ordem: number; fonte: string | null; imagem_url: string | null; predefinido: boolean };

// Chaves que o motor de cálculo de cada planeador realmente usa. Uma linha
// com uma chave fora desta lista não tem efeito nenhum orçamento — fica só
// guardada como referência (ex: um produto de outra empresa ainda por
// decidir onde entra).
const CHAVES_CONHECIDAS: Record<string, string[]> = {
  pladur_precos: [
    'placa_normal', 'placa_hidrofuga', 'placa_cortafogo', 'perfil_primario', 'perfil_secundario', 'perfil_omega',
    'montante', 'calha_guia', 'banda_acustica', 'massa_juntas', 'fita_papel', 'parafusos', 'varao_roscado',
    'perfil_angular', 'perfil_sombra', 'la_rocha', 'la_mineral', 'isolamento_bolha', 'foco_led', 'fita_led',
    'transformador_led', 'modulo_zigbee', 'reforco_tv', 'perfil_canto_aluminio',
    'teto_simples', 'teto_sanca_simples', 'teto_sanca_led', 'foco_led_instalacao', 'revestimento_parede',
    'tabique_divisoria', 'isolamento_acustico', 'reforco_tv_instalacao',
  ],
  pintura_precos: ['tinta_normal', 'tinta_normal_alta', 'tinta_extrema', 'acabamento_placa', 'primario', 'pintura_1demao', 'pintura_2demaos'],
  pavimento_precos: ['laminado_flutuante', 'vinilico', 'manta_subpiso', 'perfil_remate', 'rodape', 'aplicacao_flutuante', 'remocao_pavimento_antigo', 'aplicacao_rodape'],
  eletrica_precos: ['ponto_luz', 'ponto_comando', 'ponto_tomada', 'quadro_eletrico', 'deteccao_incendio', 'notas_adicionais'],
};

// A "fonte" é texto livre (ex: "Maxmat - Placa Gesso ... - maxmat.pt/pt/...").
// Extrai o pedaço que parece um URL/domínio para se poder abrir num clique.
function extrairUrl(fonte: string | null): string | null {
  if (!fonte) return null;
  const match = fonte.match(/(https?:\/\/[^\s]+)|([a-z0-9-]+\.(?:pt|com)[^\s]*)/i);
  if (!match) return null;
  const encontrado = match[0].replace(/[),.]+$/, '');
  return encontrado.startsWith('http') ? encontrado : `https://${encontrado}`;
}

function Miniatura({ chave, url, onChange }: { chave: string; url: string | null; onChange: (url: string) => void }) {
  const [erro, setErro] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [ampliar, setAmpliar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviarFicheiro(ficheiro: File) {
    setAEnviar(true);
    const extensao = ficheiro.name.split('.').pop() || 'jpg';
    const path = `${chave}-${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from('precario').upload(path, ficheiro, { upsert: true });
    if (error) { alert('Erro ao enviar imagem: ' + error.message); setAEnviar(false); return; }
    const novoUrl = supabase.storage.from('precario').getPublicUrl(path).data.publicUrl;
    onChange(novoUrl);
    setErro(false);
    setAEnviar(false);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFicheiro(f); e.target.value = ''; }}
      />
      <div className="relative w-10 h-10 group">
        <button
          type="button"
          onClick={() => (url && !erro ? setAmpliar(true) : inputRef.current?.click())}
          title={url && !erro ? 'Clica para ampliar' : 'Clica para carregar uma foto'}
          className="block w-10 h-10 rounded-md border border-sand-200 bg-white overflow-hidden flex items-center justify-center hover:border-brand-300"
        >
          {aEnviar ? (
            <Loader2 size={16} className="text-ink-300 animate-spin" />
          ) : url && !erro ? (
            <img src={url} alt="" className="w-full h-full object-contain" onError={() => setErro(true)} />
          ) : (
            <ImageOff size={16} className="text-ink-200" />
          )}
        </button>
        {url && !erro && !aEnviar && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="Substituir foto"
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ink-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil size={9} />
          </button>
        )}
      </div>

      {ampliar && url && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setAmpliar(false)}>
          <button onClick={() => setAmpliar(false)} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={22} /></button>
          <img src={url} alt="" className="max-w-full max-h-full rounded-lg bg-white object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

function novoItemVazio(tipo: 'material' | 'mao_obra') {
  return { chave: '', descricao: '', unidade: tipo === 'material' ? 'unid' : 'm²', preco: '0' };
}

export default function PrecosPlaneador({ tabela, descricaoIntro }: { tabela: string; descricaoIntro: string }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoMaterial, setNovoMaterial] = useState(novoItemVazio('material'));
  const [novaMaoObra, setNovaMaoObra] = useState(novoItemVazio('mao_obra'));
  const chavesConhecidas = CHAVES_CONHECIDAS[tabela] || [];

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from(tabela).select('*').order('chave').order('ordem');
    setItens(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [tabela]);

  const chavesExistentes = useMemo(() => Array.from(new Set(itens.map((i) => i.chave))), [itens]);

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

  async function marcarPredefinido(item: Item) {
    // Só uma variante por chave pode ficar marcada como a usada no cálculo.
    await Promise.all(
      itens.filter((i) => i.chave === item.chave).map((i) => supabase.from(tabela).update({ predefinido: i.id === item.id }).eq('id', i.id))
    );
    carregar();
  }

  async function removerItem(item: Item) {
    const restantesDaChave = itens.filter((i) => i.chave === item.chave).length;
    if (item.predefinido && restantesDaChave > 1) {
      alert('Este é o produto predefinido desta chave — marca outra variante como predefinida antes de o remover.');
      return;
    }
    if (!confirm(`Remover "${item.descricao}"?${item.predefinido ? ' É a única variante desta chave — deixa de aparecer nos orçamentos.' : ''}`)) return;
    await supabase.from(tabela).delete().eq('id', item.id);
    carregar();
  }

  async function adicionarItem(tipo: 'material' | 'mao_obra', e: React.FormEvent) {
    e.preventDefault();
    const form = tipo === 'material' ? novoMaterial : novaMaoObra;
    if (!form.chave.trim() || !form.descricao.trim()) { alert('Preenche pelo menos a chave e a descrição.'); return; }
    const chave = form.chave.trim();
    const jaExisteChave = itens.some((i) => i.chave === chave);
    const ordemMax = Math.max(0, ...itens.filter((i) => i.chave === chave).map((i) => i.ordem));
    const { error } = await supabase.from(tabela).insert([{
      tipo,
      chave,
      descricao: form.descricao.trim(),
      unidade: form.unidade || (tipo === 'material' ? 'unid' : 'm²'),
      preco: parseFloat(form.preco) || 0,
      ordem: ordemMax + 1,
      // Se é a primeira linha desta chave, tem de ficar predefinida (senão
      // não entra em cálculo nenhum); se já existem variantes, entra como
      // alternativa até o Joaquim a marcar como predefinida.
      predefinido: !jaExisteChave,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    if (tipo === 'material') setNovoMaterial(novoItemVazio('material')); else setNovaMaoObra(novoItemVazio('mao_obra'));
    carregar();
  }

  if (loading) return <div className="text-center py-10 text-ink-300 text-sm">A carregar...</div>;

  const materiais = itens.filter((i) => i.tipo === 'material');
  const maoDeObra = itens.filter((i) => i.tipo === 'mao_obra');

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-400">{descricaoIntro}</p>

      <div className="card overflow-hidden">
          <div className="bg-sand-50 px-4 py-2 font-medium text-sm text-ink-700">Materiais</div>
          {materiais.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="text-ink-400 text-xs uppercase">
              <tr>
                <th className="p-3 font-medium"></th>
                <th className="p-3 font-medium"></th>
                <th className="p-3 font-medium">Descrição</th>
                <th className="p-3 font-medium">Un</th>
                <th className="p-3 font-medium text-right">Preço (PVP)</th>
                <th className="p-3 font-medium">Fonte</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {materiais.map((i) => {
                const temVariantes = itens.filter((x) => x.chave === i.chave).length > 1;
                const chaveDesconhecida = chavesConhecidas.length > 0 && !chavesConhecidas.includes(i.chave);
                return (
                <tr key={i.id} className={!i.predefinido ? 'bg-sand-50/60' : ''}>
                  <td className="p-2 pl-3">
                    <button
                      type="button"
                      onClick={() => marcarPredefinido(i)}
                      disabled={!temVariantes}
                      title={i.predefinido ? 'Produto usado no cálculo' : 'Marcar como o produto a usar no cálculo'}
                      className={i.predefinido ? 'text-amber-500' : temVariantes ? 'text-ink-200 hover:text-amber-400' : 'text-transparent'}
                    >
                      <Star size={15} fill={i.predefinido ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="p-2 w-16">
                    <Miniatura chave={i.chave} url={i.imagem_url} onChange={(url) => atualizarImagem(i.id, url)} />
                  </td>
                  <td className="p-3 text-ink-800">
                    {i.descricao}
                    <span className="block text-[10px] text-ink-300">
                      {i.chave}{chaveDesconhecida && ' — não usado por nenhum planeador'}
                    </span>
                  </td>
                  <td className="p-3 text-ink-500">{i.unidade}</td>
                  <td className="p-3 text-right">
                    <input type="number" step="0.01" defaultValue={i.preco} onBlur={(e) => atualizarPreco(i.id, parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="loja / produto / link" defaultValue={i.fonte || ''} onBlur={(e) => atualizarFonte(i.id, e.target.value)} className="input w-56 text-xs py-1" />
                      {extrairUrl(i.fonte) && (
                        <a href={extrairUrl(i.fonte)!} target="_blank" rel="noreferrer" title="Abrir página do produto" className="text-ink-300 hover:text-brand-600 shrink-0">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <button onClick={() => removerItem(i)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          )}
          <form onSubmit={(e) => adicionarItem('material', e)} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border-t border-sand-100">
            <input type="text" list={`chaves-${tabela}`} placeholder="Chave (ex: foco_led)" value={novoMaterial.chave} onChange={(e) => setNovoMaterial({ ...novoMaterial, chave: e.target.value })} className="input text-sm" />
            <datalist id={`chaves-${tabela}`}>
              {chavesConhecidas.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input type="text" placeholder="Descrição do produto" value={novoMaterial.descricao} onChange={(e) => setNovoMaterial({ ...novoMaterial, descricao: e.target.value })} className="input text-sm md:col-span-2" />
            <input type="text" placeholder="Un" value={novoMaterial.unidade} onChange={(e) => setNovoMaterial({ ...novoMaterial, unidade: e.target.value })} className="input text-sm" />
            <input type="number" step="0.01" placeholder="Preço" value={novoMaterial.preco} onChange={(e) => setNovoMaterial({ ...novoMaterial, preco: e.target.value })} className="input text-sm" />
            <button className="btn-primary text-sm py-1.5 justify-center md:col-span-5"><Plus size={14} /> Adicionar material</button>
          </form>
        </div>

      <div className="card overflow-hidden">
          <div className="bg-sand-50 px-4 py-2 font-medium text-sm text-ink-700">Mão de Obra</div>
          {maoDeObra.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="text-ink-400 text-xs uppercase">
              <tr>
                <th className="p-3 font-medium"></th>
                <th className="p-3 font-medium">Trabalho</th>
                <th className="p-3 font-medium">Un</th>
                <th className="p-3 font-medium text-right">Preço</th>
                <th className="p-3 font-medium">Nota</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {maoDeObra.map((i) => {
                const temVariantes = itens.filter((x) => x.chave === i.chave).length > 1;
                const chaveDesconhecida = chavesConhecidas.length > 0 && !chavesConhecidas.includes(i.chave);
                return (
                <tr key={i.id} className={!i.predefinido ? 'bg-sand-50/60' : ''}>
                  <td className="p-2 pl-3">
                    <button
                      type="button"
                      onClick={() => marcarPredefinido(i)}
                      disabled={!temVariantes}
                      title={i.predefinido ? 'Usado no cálculo' : 'Marcar como o usado no cálculo'}
                      className={i.predefinido ? 'text-amber-500' : temVariantes ? 'text-ink-200 hover:text-amber-400' : 'text-transparent'}
                    >
                      <Star size={15} fill={i.predefinido ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="p-3 text-ink-800">
                    {i.descricao}
                    <span className="block text-[10px] text-ink-300">
                      {i.chave}{chaveDesconhecida && ' — não usado por nenhum planeador'}
                    </span>
                  </td>
                  <td className="p-3 text-ink-500">{i.unidade}</td>
                  <td className="p-3 text-right">
                    <input type="number" step="0.5" defaultValue={i.preco} onBlur={(e) => atualizarPreco(i.id, parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="opcional" defaultValue={i.fonte || ''} onBlur={(e) => atualizarFonte(i.id, e.target.value)} className="input w-56 text-xs py-1" />
                      {extrairUrl(i.fonte) && (
                        <a href={extrairUrl(i.fonte)!} target="_blank" rel="noreferrer" title="Abrir link" className="text-ink-300 hover:text-brand-600 shrink-0">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <button onClick={() => removerItem(i)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          )}
          <form onSubmit={(e) => adicionarItem('mao_obra', e)} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border-t border-sand-100">
            <input type="text" list={`chaves-${tabela}`} placeholder="Chave (ex: teto_simples)" value={novaMaoObra.chave} onChange={(e) => setNovaMaoObra({ ...novaMaoObra, chave: e.target.value })} className="input text-sm" />
            <input type="text" placeholder="Descrição do trabalho" value={novaMaoObra.descricao} onChange={(e) => setNovaMaoObra({ ...novaMaoObra, descricao: e.target.value })} className="input text-sm md:col-span-2" />
            <input type="text" placeholder="Un" value={novaMaoObra.unidade} onChange={(e) => setNovaMaoObra({ ...novaMaoObra, unidade: e.target.value })} className="input text-sm" />
            <input type="number" step="0.5" placeholder="Preço" value={novaMaoObra.preco} onChange={(e) => setNovaMaoObra({ ...novaMaoObra, preco: e.target.value })} className="input text-sm" />
            <button className="btn-primary text-sm py-1.5 justify-center md:col-span-5"><Plus size={14} /> Adicionar mão de obra</button>
          </form>
        </div>
    </div>
  );
}
