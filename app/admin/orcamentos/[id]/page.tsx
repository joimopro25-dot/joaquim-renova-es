'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { moPorUnidade, precoPorUnidade, totalLinha, calcularTotais } from '../../../../lib/orcamento';
import { Plus, Trash2, ArrowLeft, Send, Check, X, ArrowRightCircle, Sparkles, Loader2, Upload, Printer, ImageOff, HardHat, ChevronDown, ChevronUp } from 'lucide-react';
import ImportarOrcamento from '../ImportarOrcamento';

type Linha = {
  id: string;
  descricao: string;
  capitulo: string;
  unidade: string;
  quantidade: number;
  rendimento_horas: number;
  custo_material: number;
  tipo_linha: string;
  fornecedor_id: string | null;
  valor_subcontratado: number;
  margem_subcontratacao_percentagem: number;
  fornecedores: { nome: string } | null;
};

type Fornecedor = { id: string; nome: string };

type Candidato = {
  id: string;
  orcamento_linha_id: string;
  fornecedor_id: string | null;
  fornecedor_nome_livre: string | null;
  valor: number;
  notas: string | null;
  fornecedores: { nome: string } | null;
};

type MensagemChat = { role: 'user' | 'assistant'; content: string };
type LinhaProposta = {
  capitulo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  rendimento_horas: number;
  custo_material: number;
};

type Foto = { id: string; url: string; legenda: string | null };

type ItemPrecario = {
  id: string;
  categoria: string;
  descricao: string;
  unidade: string;
  rendimento_horas: number;
  custo_material: number;
};

type Orcamento = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  taxa_horaria: number;
  margem_percentagem: number;
  iva_percentagem: number;
  cliente_id: string;
  clientes: { nome: string } | null;
};

const ESTADOS: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-sand-100 text-ink-600' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido em Obra', color: 'bg-purple-100 text-purple-700' },
};

export default function OrcamentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [precario, setPrecario] = useState<ItemPrecario[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const [capitulo, setCapitulo] = useState('Geral');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [quantidade, setQuantidade] = useState('1');
  const [rendimentoHoras, setRendimentoHoras] = useState('0');
  const [custoMaterial, setCustoMaterial] = useState('0');

  const [tipoLinha, setTipoLinha] = useState<'propria' | 'subcontratada'>('propria');
  const [fornecedorId, setFornecedorId] = useState('');
  const [valorSubcontratado, setValorSubcontratado] = useState('0');
  const [margemSubcontratacao, setMargemSubcontratacao] = useState('0');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');
  const [aCriarFornecedor, setACriarFornecedor] = useState(false);

  const [candidatos, setCandidatos] = useState<Record<string, Candidato[]>>({});
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null);
  const [candFornecedorId, setCandFornecedorId] = useState('');
  const [candNomeLivre, setCandNomeLivre] = useState('');
  const [candValor, setCandValor] = useState('');
  const [candNotas, setCandNotas] = useState('');

  const [showImportar, setShowImportar] = useState(false);
  const [showAssistente, setShowAssistente] = useState(false);
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([]);
  const [inputChat, setInputChat] = useState('');
  const [aPensar, setAPensar] = useState(false);
  const [erroChat, setErroChat] = useState('');
  const [linhasPropostas, setLinhasPropostas] = useState<LinhaProposta[] | null>(null);
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<Set<number>>(new Set());
  const [aAdicionarPropostas, setAAdicionarPropostas] = useState(false);

  const [fotos, setFotos] = useState<Foto[]>([]);
  const [legendaFoto, setLegendaFoto] = useState('');
  const [aEnviarFoto, setAEnviarFoto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: orc }, { data: linhasData }, { data: precarioData }, { data: fotosData }, { data: fornecedoresData }] = await Promise.all([
      supabase.from('orcamentos').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('orcamento_linhas').select('*, fornecedores(nome)').eq('orcamento_id', id).order('criado_em'),
      supabase.from('tabela_precos').select('*').order('categoria').order('descricao'),
      supabase.from('orcamento_fotos').select('*').eq('orcamento_id', id).order('criado_em', { ascending: false }),
      supabase.from('fornecedores').select('id, nome').order('nome'),
    ]);
    setOrcamento(orc as any);
    const listaLinhas = (linhasData as any) || [];
    setLinhas(listaLinhas);
    setPrecario(precarioData || []);
    setFotos(fotosData || []);
    setFornecedores(fornecedoresData || []);

    const idsSubcontratadas = listaLinhas.filter((l: Linha) => l.tipo_linha === 'subcontratada').map((l: Linha) => l.id);
    if (idsSubcontratadas.length > 0) {
      const { data: candData } = await supabase
        .from('orcamento_linha_candidatos')
        .select('*, fornecedores(nome)')
        .in('orcamento_linha_id', idsSubcontratadas)
        .order('criado_em', { ascending: false });
      const agrupado: Record<string, Candidato[]> = {};
      for (const c of (candData as any) || []) (agrupado[c.orcamento_linha_id] ||= []).push(c);
      setCandidatos(agrupado);
    } else {
      setCandidatos({});
    }
    setLoading(false);
  }, [id]);

  async function criarFornecedorRapido() {
    if (!novoFornecedorNome.trim()) return;
    setACriarFornecedor(true);
    const { data, error } = await supabase.from('fornecedores').insert([{ nome: novoFornecedorNome.trim() }]).select().single();
    setACriarFornecedor(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setFornecedores((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setFornecedorId(data.id);
    setNovoFornecedorNome('');
  }

  async function adicionarCandidato(linhaId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!candValor) { alert('Indica o valor do orçamento recebido.'); return; }
    const { error } = await supabase.from('orcamento_linha_candidatos').insert([{
      orcamento_linha_id: linhaId,
      fornecedor_id: candFornecedorId || null,
      fornecedor_nome_livre: candFornecedorId ? null : (candNomeLivre || null),
      valor: parseFloat(candValor) || 0,
      notas: candNotas || null,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setCandFornecedorId(''); setCandNomeLivre(''); setCandValor(''); setCandNotas('');
    carregar();
  }

  async function removerCandidato(candidatoId: string) {
    await supabase.from('orcamento_linha_candidatos').delete().eq('id', candidatoId);
    carregar();
  }

  async function usarCandidato(linhaId: string, cand: Candidato) {
    await supabase.from('orcamento_linhas').update({
      fornecedor_id: cand.fornecedor_id,
      valor_subcontratado: cand.valor,
    }).eq('id', linhaId);
    carregar();
  }

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setAEnviarFoto(true);
    const path = `${id}/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('orcamentos').upload(path, ficheiro);
    if (uploadError) { alert('Erro ao enviar foto: ' + uploadError.message); setAEnviarFoto(false); return; }
    const url = supabase.storage.from('orcamentos').getPublicUrl(path).data.publicUrl;
    await supabase.from('orcamento_fotos').insert([{ orcamento_id: id, url, legenda: legendaFoto || null }]);
    setLegendaFoto('');
    setAEnviarFoto(false);
    e.target.value = '';
    carregar();
  }

  async function removerFoto(fotoId: string) {
    if (!confirm('Remover esta foto?')) return;
    await supabase.from('orcamento_fotos').delete().eq('id', fotoId);
    carregar();
  }

  async function atualizarLegendaFoto(fotoId: string, legenda: string) {
    setFotos((prev) => prev.map((f) => (f.id === fotoId ? { ...f, legenda } : f)));
    await supabase.from('orcamento_fotos').update({ legenda: legenda || null }).eq('id', fotoId);
  }

  useEffect(() => { carregar(); }, [carregar]);

  const capitulosExistentes = useMemo(() => Array.from(new Set(linhas.map((l) => l.capitulo))), [linhas]);

  function carregarDoPrecario(itemId: string) {
    const item = precario.find((p) => p.id === itemId);
    if (!item) return;
    setDescricao(item.descricao);
    setUnidade(item.unidade);
    setRendimentoHoras(String(item.rendimento_horas));
    setCustoMaterial(String(item.custo_material));
  }

  async function adicionarLinha(e: React.FormEvent) {
    e.preventDefault();
    if (tipoLinha === 'subcontratada' && !fornecedorId) { alert('Escolhe ou cria o subempreiteiro.'); return; }
    const { error } = await supabase.from('orcamento_linhas').insert([{
      orcamento_id: id,
      capitulo: capitulo || 'Geral',
      descricao,
      unidade: unidade || 'un',
      quantidade: parseFloat(quantidade) || 1,
      rendimento_horas: tipoLinha === 'propria' ? (parseFloat(rendimentoHoras) || 0) : 0,
      custo_material: tipoLinha === 'propria' ? (parseFloat(custoMaterial) || 0) : 0,
      tipo_linha: tipoLinha,
      fornecedor_id: tipoLinha === 'subcontratada' ? fornecedorId : null,
      valor_subcontratado: tipoLinha === 'subcontratada' ? (parseFloat(valorSubcontratado) || 0) : 0,
      margem_subcontratacao_percentagem: tipoLinha === 'subcontratada' ? (parseFloat(margemSubcontratacao) || 0) : 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setDescricao(''); setQuantidade('1'); setRendimentoHoras('0'); setCustoMaterial('0');
    setFornecedorId(''); setValorSubcontratado('0'); setMargemSubcontratacao('0');
    carregar();
  }

  function extrairLinhasPropostas(texto: string): LinhaProposta[] | null {
    const match = texto.match(/```json\s*([\s\S]*?)```/i);
    if (!match) return null;
    try {
      const dados = JSON.parse(match[1].trim());
      if (Array.isArray(dados)) return dados;
      return null;
    } catch {
      return null;
    }
  }

  function textoSemJson(texto: string): string {
    return texto.replace(/```json\s*[\s\S]*?```/i, '').trim();
  }

  async function enviarMensagemChat(e: React.FormEvent) {
    e.preventDefault();
    if (!inputChat.trim() || !orcamento) return;
    setErroChat('');
    const novasMensagens: MensagemChat[] = [...mensagensChat, { role: 'user', content: inputChat }];
    setMensagensChat(novasMensagens);
    setInputChat('');
    setAPensar(true);
    setLinhasPropostas(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErroChat('Sessão expirada, atualiza a página.'); setAPensar(false); return; }

    const contexto = `Orçamento "${orcamento.titulo}" para o cliente ${orcamento.clientes?.nome || '—'}. Taxa horária de mão-de-obra definida: ${orcamento.taxa_horaria} €/h. Capítulos já usados neste orçamento: ${capitulosExistentes.join(', ') || 'nenhum ainda'}.`;

    const resp = await fetch('/api/orcamentos/assistente', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ mensagens: novasMensagens, contexto }),
    });
    const json = await resp.json();
    setAPensar(false);
    if (!resp.ok) { setErroChat(json.error || 'Erro ao falar com o assistente.'); return; }

    setMensagensChat((prev) => [...prev, { role: 'assistant', content: json.resposta }]);
    const propostas = extrairLinhasPropostas(json.resposta);
    if (propostas && propostas.length > 0) {
      setLinhasPropostas(propostas);
      setLinhasSelecionadas(new Set(propostas.map((_, i) => i)));
    }
  }

  function alternarSelecao(idx: number) {
    setLinhasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function adicionarLinhasPropostas() {
    if (!linhasPropostas) return;
    setAAdicionarPropostas(true);
    const selecionadas = linhasPropostas.filter((_, i) => linhasSelecionadas.has(i));
    const { error } = await supabase.from('orcamento_linhas').insert(
      selecionadas.map((l) => ({
        orcamento_id: id,
        capitulo: l.capitulo || 'Geral',
        descricao: l.descricao,
        unidade: l.unidade || 'un',
        quantidade: l.quantidade || 1,
        rendimento_horas: l.rendimento_horas || 0,
        custo_material: l.custo_material || 0,
      }))
    );
    setAAdicionarPropostas(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setLinhasPropostas(null);
    carregar();
  }

  async function removerLinha(linhaId: string) {
    await supabase.from('orcamento_linhas').delete().eq('id', linhaId);
    carregar();
  }

  async function mudarEstado(novoEstado: string) {
    await supabase.from('orcamentos').update({ status: novoEstado }).eq('id', id);
    carregar();
  }

  async function atualizarCampo(campo: 'margem_percentagem' | 'iva_percentagem' | 'taxa_horaria', valor: number) {
    await supabase.from('orcamentos').update({ [campo]: valor }).eq('id', id);
    carregar();
  }

  async function converterEmObra() {
    if (!orcamento) return;
    setConverting(true);
    const { data: novaObra, error: obraError } = await supabase.from('obras').insert([{
      cliente_id: orcamento.cliente_id,
      titulo: orcamento.titulo,
      descricao: orcamento.descricao,
      valor_total: totais.total,
      status: 'orcamento',
      orcamento_id: orcamento.id,
    }]).select().single();
    if (obraError) { alert('Erro ao criar obra: ' + obraError.message); setConverting(false); return; }

    const linhasSubcontratadas = linhas.filter((l) => l.tipo_linha === 'subcontratada' && l.fornecedor_id);
    if (linhasSubcontratadas.length > 0) {
      await supabase.from('despesas').insert(linhasSubcontratadas.map((l) => ({
        obra_id: novaObra.id,
        descricao: `Subcontratação: ${l.descricao}`,
        categoria: 'Subcontratação',
        valor: l.quantidade * l.valor_subcontratado,
        fornecedor_id: l.fornecedor_id,
        data_despesa: new Date().toISOString().slice(0, 10),
        tipo_imputacao: 'custo',
        estado_pagamento: 'pendente',
      })));
    }

    await supabase.from('orcamentos').update({ status: 'convertido' }).eq('id', id);
    setConverting(false);
    router.push('/admin/obras');
  }

  const totais = orcamento
    ? calcularTotais(linhas, orcamento)
    : { subtotal: 0, imprevistos: 0, semIva: 0, iva: 0, total: 0 };

  const taxaHoraria = orcamento?.taxa_horaria || 0;

  const linhasPorCapitulo = useMemo(() => {
    const grupos: Record<string, Linha[]> = {};
    for (const l of linhas) {
      (grupos[l.capitulo] ||= []).push(l);
    }
    return grupos;
  }, [linhas]);

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!orcamento) return <div className="p-8 text-center text-ink-400 text-sm">Orçamento não encontrado.</div>;

  const info = ESTADOS[orcamento.status] || ESTADOS.rascunho;
  const editavel = orcamento.status === 'rascunho';

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <button onClick={() => router.push('/admin/orcamentos')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar a Orçamentos
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-ink-800">{orcamento.titulo}</h2>
          <p className="text-sm text-ink-400">{orcamento.clientes?.nome || '—'}</p>
        </div>
        <span className={`badge ${info.color}`}>{info.label}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <a href={`/admin/orcamentos/${id}/relatorio`} target="_blank" rel="noreferrer" className="btn-primary bg-ink-700 hover:bg-ink-800">
          <Printer size={16} /> Pré-visualizar / Imprimir
        </a>
      </div>

      {orcamento.status !== 'convertido' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {orcamento.status === 'rascunho' && (
            <button onClick={() => mudarEstado('enviado')} className="btn-primary bg-blue-600 hover:bg-blue-700">
              <Send size={16} /> Marcar como Enviado (fica visível no portal do cliente)
            </button>
          )}
          {orcamento.status === 'enviado' && (
            <>
              <button onClick={() => mudarEstado('aprovado')} className="btn-primary bg-green-600 hover:bg-green-700">
                <Check size={16} /> Aprovar
              </button>
              <button onClick={() => mudarEstado('rejeitado')} className="btn-primary bg-red-600 hover:bg-red-700">
                <X size={16} /> Rejeitar
              </button>
              <span className="text-sm text-ink-400 self-center">Também pode ser aprovado pelo próprio cliente no portal.</span>
            </>
          )}
          {orcamento.status === 'aprovado' && (
            <button onClick={converterEmObra} disabled={converting} className="btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
              <ArrowRightCircle size={16} /> {converting ? 'A converter...' : 'Converter em Obra'}
            </button>
          )}
        </div>
      )}

      {editavel && (
        <div className="card p-6 mb-6">
          <button onClick={() => setShowAssistente((v) => !v)} className="flex items-center gap-2 font-semibold text-ink-700 w-full">
            <Sparkles size={16} className="text-brand-500" /> Assistente de Orçamentação
            <span className="text-xs font-normal text-ink-400 ml-auto">{showAssistente ? 'fechar' : 'abrir'}</span>
          </button>

          {showAssistente && (
            <div className="mt-4">
              <p className="text-xs text-ink-400 mb-3">
                Descreve o trabalho (ex: "reparar fachada com 9m², descolamento de reboco") e conversa com o assistente sobre técnica, materiais e preços. Quando houver informação suficiente, ele propõe linhas para adicionares ao orçamento.
              </p>

              {mensagensChat.length > 0 && (
                <div className="space-y-3 mb-3 max-h-[420px] overflow-y-auto pr-1">
                  {mensagensChat.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-sand-50 text-ink-800 border border-sand-200'}`}>
                        {m.role === 'assistant' ? textoSemJson(m.content) : m.content}
                      </div>
                    </div>
                  ))}
                  {aPensar && (
                    <div className="flex justify-start">
                      <div className="bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm text-ink-400 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> A pensar...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {linhasPropostas && linhasPropostas.length > 0 && (
                <div className="border border-brand-200 bg-brand-50/40 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-brand-700 mb-2">Linhas propostas — escolhe as que queres adicionar:</p>
                  <div className="space-y-1.5 mb-3">
                    {linhasPropostas.map((l, i) => (
                      <label key={i} className="flex items-start gap-2 text-sm bg-white rounded-md p-2 border border-sand-200 cursor-pointer">
                        <input type="checkbox" checked={linhasSelecionadas.has(i)} onChange={() => alternarSelecao(i)} className="mt-1" />
                        <span className="flex-1">
                          <span className="text-ink-800 font-medium">{l.descricao}</span>
                          <span className="text-ink-400"> · {l.capitulo} · {l.quantidade} {l.unidade} · {l.rendimento_horas}h/un · {formatMoney(l.custo_material)}/un mat.</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button onClick={adicionarLinhasPropostas} disabled={aAdicionarPropostas || linhasSelecionadas.size === 0} className="btn-primary text-sm py-1.5 disabled:opacity-60">
                    {aAdicionarPropostas ? 'A adicionar...' : `Adicionar ${linhasSelecionadas.size} Linha(s) ao Orçamento`}
                  </button>
                </div>
              )}

              {erroChat && <p className="text-sm text-red-600 mb-2">{erroChat}</p>}

              <form onSubmit={enviarMensagemChat} className="flex gap-2">
                <textarea
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagemChat(e); } }}
                  placeholder="Escreve aqui..."
                  className="input flex-1 min-h-[44px]"
                  disabled={aPensar}
                />
                <button disabled={aPensar || !inputChat.trim()} className="btn-primary disabled:opacity-60">
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-3">Definições de Cálculo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-ink-500">Taxa horária de mão-de-obra (€/h)</span>
            {editavel ? (
              <input type="number" step="0.01" defaultValue={orcamento.taxa_horaria} onBlur={(e) => atualizarCampo('taxa_horaria', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{formatMoney(orcamento.taxa_horaria)}</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">Imprevistos (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.margem_percentagem} onBlur={(e) => atualizarCampo('margem_percentagem', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.margem_percentagem}%</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">IVA (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.iva_percentagem} onBlur={(e) => atualizarCampo('iva_percentagem', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.iva_percentagem}%</span>}
          </div>
        </div>
      </div>

      {editavel && showImportar && (
        <ImportarOrcamento
          clientes={[]}
          orcamentoExistenteId={orcamento.id}
          orcamentoExistenteTitulo={orcamento.titulo}
          onClose={() => setShowImportar(false)}
          onSaved={() => { setShowImportar(false); carregar(); }}
        />
      )}

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700">Mapa de Quantidades e Custos</h3>
          {editavel && (
            <button onClick={() => setShowImportar(true)} className="btn-primary bg-purple-600 hover:bg-purple-700 text-sm py-1.5">
              <Upload size={15} /> Importar Documento
            </button>
          )}
        </div>

        {Object.keys(linhasPorCapitulo).length > 0 && (
          <div className="overflow-x-auto mb-4 space-y-6">
            {Object.entries(linhasPorCapitulo).map(([cap, itens]) => {
              const subtotalCap = itens.reduce((s, l) => s + totalLinha(l, taxaHoraria), 0);
              return (
                <div key={cap}>
                  <div className="bg-ink-800 text-copper-200 text-sm font-semibold px-3 py-1.5 rounded-t-lg">{cap}</div>
                  <table className="w-full text-left text-sm border border-t-0 border-sand-200 rounded-b-lg overflow-hidden">
                    <thead className="text-ink-400 text-xs uppercase bg-sand-50">
                      <tr>
                        <th className="p-2 font-medium">Descrição</th>
                        <th className="p-2 font-medium text-right">Un</th>
                        <th className="p-2 font-medium text-right">Qtd</th>
                        <th className="p-2 font-medium text-right">Rend. h/un</th>
                        <th className="p-2 font-medium text-right">MO €/un</th>
                        <th className="p-2 font-medium text-right">Material €/un</th>
                        <th className="p-2 font-medium text-right">Preço un.</th>
                        <th className="p-2 font-medium text-right">Total</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100">
                      {itens.map((l) => {
                        const sub = l.tipo_linha === 'subcontratada';
                        const expandida = linhaExpandida === l.id;
                        const cands = candidatos[l.id] || [];
                        return (
                          <React.Fragment key={l.id}>
                            <tr>
                              <td className="p-2 text-ink-800">
                                {l.descricao}
                                {sub && (
                                  <button
                                    onClick={() => setLinhaExpandida(expandida ? null : l.id)}
                                    className="ml-2 inline-flex items-center gap-1 badge bg-purple-100 text-purple-700 text-[10px] hover:bg-purple-200"
                                  >
                                    <HardHat size={10} /> {l.fornecedores?.nome || 'sem subempreiteiro'} {expandida ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                  </button>
                                )}
                              </td>
                              <td className="p-2 text-right text-ink-500">{l.unidade}</td>
                              <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                              <td className="p-2 text-right text-ink-500">{sub ? '—' : l.rendimento_horas}</td>
                              <td className="p-2 text-right text-ink-500">{sub ? '—' : formatMoney(moPorUnidade(l, taxaHoraria))}</td>
                              <td className="p-2 text-right text-ink-500">{sub ? formatMoney(l.valor_subcontratado) + ' (custo)' : formatMoney(l.custo_material)}</td>
                              <td className="p-2 text-right text-ink-500">{formatMoney(precoPorUnidade(l, taxaHoraria))}</td>
                              <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(totalLinha(l, taxaHoraria))}</td>
                              <td className="p-2 text-right">
                                {editavel && (
                                  <button onClick={() => removerLinha(l.id)} className="text-ink-300 hover:text-red-600">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                            {sub && expandida && (
                              <tr>
                                <td colSpan={9} className="p-3 bg-purple-50/40">
                                  <p className="text-xs font-medium text-purple-800 mb-2">
                                    Margem aplicada: {l.margem_subcontratacao_percentagem}% sobre {formatMoney(l.valor_subcontratado)} = {formatMoney(precoPorUnidade(l, taxaHoraria))}/un
                                  </p>
                                  <p className="text-xs font-medium text-ink-600 mb-1.5">Orçamentos recebidos:</p>
                                  {cands.length === 0 ? (
                                    <p className="text-xs text-ink-400 mb-2">Ainda sem orçamentos registados.</p>
                                  ) : (
                                    <div className="space-y-1 mb-2">
                                      {cands.map((c) => (
                                        <div key={c.id} className="flex items-center justify-between gap-2 text-xs bg-white rounded-md p-2 border border-sand-200">
                                          <span className="flex-1">
                                            <span className="font-medium text-ink-800">{c.fornecedores?.nome || c.fornecedor_nome_livre || '—'}</span>
                                            <span className="text-ink-500"> · {formatMoney(c.valor)}</span>
                                            {c.notas && <span className="text-ink-400"> · {c.notas}</span>}
                                          </span>
                                          {editavel && (
                                            <div className="flex items-center gap-2 shrink-0">
                                              <button type="button" onClick={() => usarCandidato(l.id, c)} className="text-brand-600 hover:underline">Usar este</button>
                                              <button type="button" onClick={() => removerCandidato(c.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={12} /></button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {editavel && (
                                    <form onSubmit={(e) => adicionarCandidato(l.id, e)} className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
                                      <select value={candFornecedorId} onChange={(e) => setCandFornecedorId(e.target.value)} className="input text-xs py-1">
                                        <option value="">Sem fornecedor / nome livre</option>
                                        {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                      </select>
                                      {!candFornecedorId && (
                                        <input type="text" placeholder="Nome (se não estiver na lista)" value={candNomeLivre} onChange={(e) => setCandNomeLivre(e.target.value)} className="input text-xs py-1" />
                                      )}
                                      <input type="number" step="0.01" placeholder="Valor (€)" value={candValor} onChange={(e) => setCandValor(e.target.value)} className="input text-xs py-1" required />
                                      <input type="text" placeholder="Notas (opcional)" value={candNotas} onChange={(e) => setCandNotas(e.target.value)} className="input text-xs py-1" />
                                      <button className="btn-primary text-xs py-1 justify-center md:col-span-4">
                                        <Plus size={12} /> Adicionar Orçamento Recebido
                                      </button>
                                    </form>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <tr className="bg-sand-50 font-medium">
                        <td colSpan={7} className="p-2 text-right text-ink-600">Subtotal {cap}</td>
                        <td className="p-2 text-right text-ink-800">{formatMoney(subtotalCap)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {editavel && (
          <form onSubmit={adicionarLinha} className="pt-2 border-t border-sand-100">
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setTipoLinha('propria')} className={`text-xs px-3 py-1.5 rounded-lg border ${tipoLinha === 'propria' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-sand-200 text-ink-500'}`}>
                Mão de Obra Própria
              </button>
              <button type="button" onClick={() => setTipoLinha('subcontratada')} className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 ${tipoLinha === 'subcontratada' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-sand-200 text-ink-500'}`}>
                <HardHat size={12} /> Subcontratada
              </button>
            </div>

            {tipoLinha === 'propria' && precario.length > 0 && (
              <div className="mb-2">
                <select onChange={(e) => { carregarDoPrecario(e.target.value); e.target.value = ''; }} defaultValue="" className="input w-full text-ink-500">
                  <option value="" disabled>Carregar do preçário (opcional)...</option>
                  {precario.map((p) => <option key={p.id} value={p.id}>{p.categoria} — {p.descricao}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input type="text" list="capitulos-existentes" placeholder="Capítulo (ex: Demolições)" value={capitulo} onChange={(e) => setCapitulo(e.target.value)} className="input md:col-span-2" />
            <datalist id="capitulos-existentes">
              {capitulosExistentes.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input type="text" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input md:col-span-2" required />
            <input type="text" placeholder="Un (m², ml, un...)" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Qtd" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="input" />

            {tipoLinha === 'propria' ? (
              <>
                <input type="number" step="0.01" placeholder="Rendimento (h/un)" value={rendimentoHoras} onChange={(e) => setRendimentoHoras(e.target.value)} className="input md:col-span-2" />
                <input type="number" step="0.01" placeholder="Custo Material (€/un)" value={custoMaterial} onChange={(e) => setCustoMaterial(e.target.value)} className="input md:col-span-2" />
              </>
            ) : (
              <>
                <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="input md:col-span-2">
                  <option value="">Escolher subempreiteiro...</option>
                  {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
                <div className="flex gap-1 md:col-span-2">
                  <input type="text" placeholder="Novo subempreiteiro" value={novoFornecedorNome} onChange={(e) => setNovoFornecedorNome(e.target.value)} className="input flex-1" />
                  <button type="button" onClick={criarFornecedorRapido} disabled={aCriarFornecedor} className="btn-primary px-2.5 disabled:opacity-60"><Plus size={14} /></button>
                </div>
                <input type="number" step="0.01" placeholder="Valor do subempreiteiro (€/un)" value={valorSubcontratado} onChange={(e) => setValorSubcontratado(e.target.value)} className="input md:col-span-3" required />
                <input type="number" step="0.1" placeholder="A tua margem (%)" value={margemSubcontratacao} onChange={(e) => setMargemSubcontratacao(e.target.value)} className="input md:col-span-3" />
              </>
            )}

            <button className="btn-primary justify-center md:col-span-2">
              <Plus size={16} /> Adicionar Linha
            </button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4">Fotos (visíveis ao cliente)</h3>
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <input type="text" placeholder="Legenda (opcional)" value={legendaFoto} onChange={(e) => setLegendaFoto(e.target.value)} className="input flex-1" />
          <label className="btn-primary justify-center cursor-pointer">
            <Upload size={16} /> {aEnviarFoto ? 'A enviar...' : 'Enviar Foto'}
            <input type="file" accept="image/*" className="hidden" onChange={enviarFoto} disabled={aEnviarFoto} />
          </label>
        </div>
        {fotos.length === 0 ? (
          <div className="text-center py-8 text-ink-400 text-sm">
            <ImageOff size={24} className="mx-auto mb-2 text-ink-200" />
            Ainda sem fotos.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {fotos.map((f) => (
              <div key={f.id} className="relative group">
                <img src={f.url} alt={f.legenda || ''} className="w-full aspect-square object-cover rounded-lg border border-sand-200" />
                <input
                  type="text"
                  placeholder="Legenda (ex: Estado atual, Como vai ficar...)"
                  defaultValue={f.legenda || ''}
                  onBlur={(e) => { if (e.target.value !== (f.legenda || '')) atualizarLegendaFoto(f.id, e.target.value); }}
                  className="input w-full mt-1 text-xs py-1 px-1.5"
                />
                <button
                  onClick={() => removerFoto(f.id)}
                  className="absolute top-1.5 right-1.5 bg-white/90 rounded-md p-1 text-ink-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="space-y-2 text-sm max-w-sm ml-auto">
          <div className="flex justify-between">
            <span className="text-ink-500">Total dos Trabalhos</span>
            <span className="text-ink-800">{formatMoney(totais.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Imprevistos ({orcamento.margem_percentagem}%)</span>
            <span className="text-ink-800">{formatMoney(totais.imprevistos)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Total sem IVA</span>
            <span className="text-ink-800">{formatMoney(totais.semIva)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">IVA ({orcamento.iva_percentagem}%)</span>
            <span className="text-ink-800">{formatMoney(totais.iva)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Total com IVA</span>
            <span className="text-brand-600">{formatMoney(totais.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
