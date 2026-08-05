'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { precoUnitarioFinal, totalLinha, calcularTotais } from '../../../../lib/orcamento';
import { Plus, Trash2, ArrowLeft, Send, Check, X, ArrowRightCircle, Sparkles, Loader2, Upload, Printer, ImageOff, HardHat, ChevronDown, ChevronUp, Package, Wrench } from 'lucide-react';
import ImportarOrcamento from '../ImportarOrcamento';

type Linha = {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  tipo_linha: string; // 'material' | 'mao_obra' | 'subcontratada'
  preco_unitario: number;
  desconto1_percentagem: number;
  desconto2_percentagem: number;
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

type Orcamento = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  taxa_horaria: number;
  margem_percentagem: number;
  iva_material_percentagem: number;
  iva_mao_obra_percentagem: number;
  iva_subcontratado_percentagem: number;
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

function novaLinhaVazia() {
  return { descricao: '', unidade: 'un', quantidade: '1', precoUnitario: '', desconto1: '0', desconto2: '0' };
}

export default function OrcamentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const [formMaterial, setFormMaterial] = useState(novaLinhaVazia());
  const [formMaoObra, setFormMaoObra] = useState(novaLinhaVazia());

  const [fornecedorId, setFornecedorId] = useState('');
  const [descSub, setDescSub] = useState('');
  const [unidadeSub, setUnidadeSub] = useState('un');
  const [qtdSub, setQtdSub] = useState('1');
  const [valorSubcontratado, setValorSubcontratado] = useState('');
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
    const [{ data: orc }, { data: linhasData }, { data: fotosData }, { data: fornecedoresData }] = await Promise.all([
      supabase.from('orcamentos').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('orcamento_linhas').select('*, fornecedores(nome)').eq('orcamento_id', id).order('criado_em'),
      supabase.from('orcamento_fotos').select('*').eq('orcamento_id', id).order('criado_em', { ascending: false }),
      supabase.from('fornecedores').select('id, nome').order('nome'),
    ]);
    setOrcamento(orc as any);
    const listaLinhas = (linhasData as any) || [];
    setLinhas(listaLinhas);
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

  useEffect(() => { carregar(); }, [carregar]);

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

  async function adicionarLinhaSimples(tipo: 'material' | 'mao_obra', e: React.FormEvent) {
    e.preventDefault();
    const form = tipo === 'material' ? formMaterial : formMaoObra;
    if (!form.descricao.trim() || !form.precoUnitario) { alert('Preenche a descrição e o preço unitário.'); return; }
    const { error } = await supabase.from('orcamento_linhas').insert([{
      orcamento_id: id,
      capitulo: 'Geral',
      descricao: form.descricao,
      unidade: form.unidade || 'un',
      quantidade: parseFloat(form.quantidade) || 1,
      tipo_linha: tipo,
      preco_unitario: parseFloat(form.precoUnitario) || 0,
      desconto1_percentagem: parseFloat(form.desconto1) || 0,
      desconto2_percentagem: parseFloat(form.desconto2) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    if (tipo === 'material') setFormMaterial(novaLinhaVazia()); else setFormMaoObra(novaLinhaVazia());
    carregar();
  }

  async function adicionarLinhaSubcontratada(e: React.FormEvent) {
    e.preventDefault();
    if (!fornecedorId) { alert('Escolhe ou cria o subempreiteiro.'); return; }
    if (!descSub.trim() || !valorSubcontratado) { alert('Preenche a descrição e o valor do subempreiteiro.'); return; }
    const { error } = await supabase.from('orcamento_linhas').insert([{
      orcamento_id: id,
      capitulo: 'Geral',
      descricao: descSub,
      unidade: unidadeSub || 'un',
      quantidade: parseFloat(qtdSub) || 1,
      tipo_linha: 'subcontratada',
      fornecedor_id: fornecedorId,
      valor_subcontratado: parseFloat(valorSubcontratado) || 0,
      margem_subcontratacao_percentagem: parseFloat(margemSubcontratacao) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setDescSub(''); setUnidadeSub('un'); setQtdSub('1'); setFornecedorId(''); setValorSubcontratado(''); setMargemSubcontratacao('0');
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

    const contexto = `Orçamento "${orcamento.titulo}" para o cliente ${orcamento.clientes?.nome || '—'}. Taxa horária de mão-de-obra de referência: ${orcamento.taxa_horaria} €/h.`;

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
    if (!linhasPropostas || !orcamento) return;
    setAAdicionarPropostas(true);
    const selecionadas = linhasPropostas.filter((_, i) => linhasSelecionadas.has(i));
    const { error } = await supabase.from('orcamento_linhas').insert(
      selecionadas.map((l) => {
        const precoUnitario = (l.rendimento_horas || 0) * orcamento.taxa_horaria + (l.custo_material || 0);
        return {
          orcamento_id: id,
          capitulo: l.capitulo || 'Geral',
          descricao: l.descricao,
          unidade: l.unidade || 'un',
          quantidade: l.quantidade || 1,
          tipo_linha: (l.rendimento_horas || 0) > 0 ? 'mao_obra' : 'material',
          preco_unitario: precoUnitario,
        };
      })
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

  async function atualizarCampo(campo: string, valor: number) {
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
    ? calcularTotais(linhas as any, orcamento)
    : { subtotal: 0, imprevistos: 0, iva: 0, total: 0, material: { subtotal: 0, imprevistos: 0, iva: 0, total: 0 }, maoObra: { subtotal: 0, imprevistos: 0, iva: 0, total: 0 }, subcontratado: { subtotal: 0, imprevistos: 0, iva: 0, total: 0 } };

  const linhasMaterial = linhas.filter((l) => l.tipo_linha === 'material');
  const linhasMaoObra = linhas.filter((l) => l.tipo_linha === 'mao_obra');
  const linhasSubcontratadas = linhas.filter((l) => l.tipo_linha === 'subcontratada');

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
                          <span className="text-ink-400"> · {l.quantidade} {l.unidade} · {l.rendimento_horas}h/un · {formatMoney(l.custo_material)}/un mat.</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
          <div className="flex justify-between items-center">
            <span className="text-ink-500">Imprevistos (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.margem_percentagem} onBlur={(e) => atualizarCampo('margem_percentagem', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.margem_percentagem}%</span>}
          </div>
        </div>
        <p className="text-xs text-ink-400 mb-2">IVA por secção (podem ter taxas diferentes — confirma com a tua contabilista):</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-ink-500">IVA Material (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.iva_material_percentagem} onBlur={(e) => atualizarCampo('iva_material_percentagem', parseFloat(e.target.value) || 0)} className="input w-20 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.iva_material_percentagem}%</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">IVA Mão de Obra (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.iva_mao_obra_percentagem} onBlur={(e) => atualizarCampo('iva_mao_obra_percentagem', parseFloat(e.target.value) || 0)} className="input w-20 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.iva_mao_obra_percentagem}%</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500">IVA Subcontratado (%)</span>
            {editavel ? (
              <input type="number" step="0.1" defaultValue={orcamento.iva_subcontratado_percentagem} onBlur={(e) => atualizarCampo('iva_subcontratado_percentagem', parseFloat(e.target.value) || 0)} className="input w-20 text-right py-1" />
            ) : <span className="text-ink-800 font-medium">{orcamento.iva_subcontratado_percentagem}%</span>}
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

      {editavel && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowImportar(true)} className="btn-primary bg-purple-600 hover:bg-purple-700 text-sm py-1.5">
            <Upload size={15} /> Importar Documento
          </button>
        </div>
      )}

      {/* SECÇÃO MATERIAL */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><Package size={16} /> Material</h3>
        {linhasMaterial.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-sm border border-sand-200 rounded-lg overflow-hidden">
              <thead className="text-ink-400 text-xs uppercase bg-sand-50">
                <tr>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium text-right">Preço Un.</th>
                  <th className="p-2 font-medium text-right">Qtd</th>
                  <th className="p-2 font-medium text-right">Desc.1</th>
                  <th className="p-2 font-medium text-right">Desc.2</th>
                  <th className="p-2 font-medium text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {linhasMaterial.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 text-ink-800">{l.descricao} <span className="text-ink-400">({l.unidade})</span></td>
                    <td className="p-2 text-right text-ink-500">{formatMoney(l.preco_unitario)}</td>
                    <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                    <td className="p-2 text-right text-ink-500">{l.desconto1_percentagem}%</td>
                    <td className="p-2 text-right text-ink-500">{l.desconto2_percentagem}%</td>
                    <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(totalLinha(l as any))}</td>
                    <td className="p-2 text-right">
                      {editavel && <button onClick={() => removerLinha(l.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
                <tr className="bg-sand-50 font-medium">
                  <td colSpan={5} className="p-2 text-right text-ink-600">Subtotal Material</td>
                  <td className="p-2 text-right text-ink-800">{formatMoney(totais.material.subtotal)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {editavel && (
          <form onSubmit={(e) => adicionarLinhaSimples('material', e)} className="grid grid-cols-1 md:grid-cols-6 gap-2 pt-2 border-t border-sand-100">
            <input type="text" placeholder="Descrição" value={formMaterial.descricao} onChange={(e) => setFormMaterial({ ...formMaterial, descricao: e.target.value })} className="input md:col-span-2" required />
            <input type="text" placeholder="Un" value={formMaterial.unidade} onChange={(e) => setFormMaterial({ ...formMaterial, unidade: e.target.value })} className="input" />
            <input type="number" step="0.01" placeholder="Preço Unitário (€)" value={formMaterial.precoUnitario} onChange={(e) => setFormMaterial({ ...formMaterial, precoUnitario: e.target.value })} className="input" required />
            <input type="number" step="0.01" placeholder="Qtd" value={formMaterial.quantidade} onChange={(e) => setFormMaterial({ ...formMaterial, quantidade: e.target.value })} className="input" />
            <input type="number" step="0.1" placeholder="Desc.1 %" value={formMaterial.desconto1} onChange={(e) => setFormMaterial({ ...formMaterial, desconto1: e.target.value })} className="input" />
            <input type="number" step="0.1" placeholder="Desc.2 %" value={formMaterial.desconto2} onChange={(e) => setFormMaterial({ ...formMaterial, desconto2: e.target.value })} className="input md:col-span-2" />
            <button className="btn-primary justify-center md:col-span-4">
              <Plus size={16} /> Adicionar Material
            </button>
          </form>
        )}
      </div>

      {/* SECÇÃO MÃO DE OBRA */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><Wrench size={16} /> Mão de Obra</h3>
        {linhasMaoObra.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-sm border border-sand-200 rounded-lg overflow-hidden">
              <thead className="text-ink-400 text-xs uppercase bg-sand-50">
                <tr>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium text-right">Preço Un.</th>
                  <th className="p-2 font-medium text-right">Qtd</th>
                  <th className="p-2 font-medium text-right">Desc.1</th>
                  <th className="p-2 font-medium text-right">Desc.2</th>
                  <th className="p-2 font-medium text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {linhasMaoObra.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 text-ink-800">{l.descricao} <span className="text-ink-400">({l.unidade})</span></td>
                    <td className="p-2 text-right text-ink-500">{formatMoney(l.preco_unitario)}</td>
                    <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                    <td className="p-2 text-right text-ink-500">{l.desconto1_percentagem}%</td>
                    <td className="p-2 text-right text-ink-500">{l.desconto2_percentagem}%</td>
                    <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(totalLinha(l as any))}</td>
                    <td className="p-2 text-right">
                      {editavel && <button onClick={() => removerLinha(l.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
                <tr className="bg-sand-50 font-medium">
                  <td colSpan={5} className="p-2 text-right text-ink-600">Subtotal Mão de Obra</td>
                  <td className="p-2 text-right text-ink-800">{formatMoney(totais.maoObra.subtotal)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {editavel && (
          <form onSubmit={(e) => adicionarLinhaSimples('mao_obra', e)} className="grid grid-cols-1 md:grid-cols-6 gap-2 pt-2 border-t border-sand-100">
            <input type="text" placeholder="Descrição (ex: Assentar tijoleira)" value={formMaoObra.descricao} onChange={(e) => setFormMaoObra({ ...formMaoObra, descricao: e.target.value })} className="input md:col-span-2" required />
            <input type="text" placeholder="Un (h, vg, m²...)" value={formMaoObra.unidade} onChange={(e) => setFormMaoObra({ ...formMaoObra, unidade: e.target.value })} className="input" />
            <input type="number" step="0.01" placeholder="Preço Unitário (€)" value={formMaoObra.precoUnitario} onChange={(e) => setFormMaoObra({ ...formMaoObra, precoUnitario: e.target.value })} className="input" required />
            <input type="number" step="0.01" placeholder="Qtd" value={formMaoObra.quantidade} onChange={(e) => setFormMaoObra({ ...formMaoObra, quantidade: e.target.value })} className="input" />
            <input type="number" step="0.1" placeholder="Desc.1 %" value={formMaoObra.desconto1} onChange={(e) => setFormMaoObra({ ...formMaoObra, desconto1: e.target.value })} className="input" />
            <input type="number" step="0.1" placeholder="Desc.2 %" value={formMaoObra.desconto2} onChange={(e) => setFormMaoObra({ ...formMaoObra, desconto2: e.target.value })} className="input md:col-span-2" />
            <button className="btn-primary justify-center md:col-span-4">
              <Plus size={16} /> Adicionar Mão de Obra
            </button>
          </form>
        )}
      </div>

      {/* SECÇÃO SUBCONTRATADO */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><HardHat size={16} /> Especialidades Subcontratadas</h3>
        {linhasSubcontratadas.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-sm border border-sand-200 rounded-lg overflow-hidden">
              <thead className="text-ink-400 text-xs uppercase bg-sand-50">
                <tr>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium text-right">Qtd</th>
                  <th className="p-2 font-medium text-right">Preço Un. (c/ margem)</th>
                  <th className="p-2 font-medium text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {linhasSubcontratadas.map((l) => {
                  const expandida = linhaExpandida === l.id;
                  const cands = candidatos[l.id] || [];
                  return (
                    <React.Fragment key={l.id}>
                      <tr>
                        <td className="p-2 text-ink-800">
                          {l.descricao}
                          <button
                            onClick={() => setLinhaExpandida(expandida ? null : l.id)}
                            className="ml-2 inline-flex items-center gap-1 badge bg-purple-100 text-purple-700 text-[10px] hover:bg-purple-200"
                          >
                            <HardHat size={10} /> {l.fornecedores?.nome || 'sem subempreiteiro'} {expandida ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                        </td>
                        <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                        <td className="p-2 text-right text-ink-500">{formatMoney(precoUnitarioFinal(l as any))}</td>
                        <td className="p-2 text-right text-ink-800 font-medium">{formatMoney(totalLinha(l as any))}</td>
                        <td className="p-2 text-right">
                          {editavel && <button onClick={() => removerLinha(l.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>}
                        </td>
                      </tr>
                      {expandida && (
                        <tr>
                          <td colSpan={5} className="p-3 bg-purple-50/40">
                            <p className="text-xs font-medium text-purple-800 mb-2">
                              Margem aplicada: {l.margem_subcontratacao_percentagem}% sobre {formatMoney(l.valor_subcontratado)} = {formatMoney(precoUnitarioFinal(l as any))}/un
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
                  <td colSpan={3} className="p-2 text-right text-ink-600">Subtotal Subcontratado</td>
                  <td className="p-2 text-right text-ink-800">{formatMoney(totais.subcontratado.subtotal)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {editavel && (
          <form onSubmit={adicionarLinhaSubcontratada} className="grid grid-cols-1 md:grid-cols-6 gap-2 pt-2 border-t border-sand-100">
            <input type="text" placeholder="Descrição (ex: Pladur sala)" value={descSub} onChange={(e) => setDescSub(e.target.value)} className="input md:col-span-2" required />
            <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="input md:col-span-2">
              <option value="">Escolher subempreiteiro...</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <div className="flex gap-1 md:col-span-2">
              <input type="text" placeholder="Novo subempreiteiro" value={novoFornecedorNome} onChange={(e) => setNovoFornecedorNome(e.target.value)} className="input flex-1" />
              <button type="button" onClick={criarFornecedorRapido} disabled={aCriarFornecedor} className="btn-primary px-2.5 disabled:opacity-60"><Plus size={14} /></button>
            </div>
            <input type="text" placeholder="Un" value={unidadeSub} onChange={(e) => setUnidadeSub(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Qtd" value={qtdSub} onChange={(e) => setQtdSub(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Valor do subempreiteiro (€/un)" value={valorSubcontratado} onChange={(e) => setValorSubcontratado(e.target.value)} className="input md:col-span-2" required />
            <input type="number" step="0.1" placeholder="A tua margem (%)" value={margemSubcontratacao} onChange={(e) => setMargemSubcontratacao(e.target.value)} className="input md:col-span-2" />
            <button className="btn-primary justify-center md:col-span-2">
              <Plus size={16} /> Adicionar
            </button>
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
            <span className="text-ink-500">IVA (Material {orcamento.iva_material_percentagem}% · MO {orcamento.iva_mao_obra_percentagem}% · Subcontratado {orcamento.iva_subcontratado_percentagem}%)</span>
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
