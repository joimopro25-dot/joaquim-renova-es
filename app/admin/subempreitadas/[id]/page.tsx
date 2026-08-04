'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CheckCircle2, RotateCcw, Printer, Paperclip, Upload, UserPlus, HardHat, Pencil, ShieldCheck, CalendarDays } from 'lucide-react';
import { previsaoParaCidade, resumoDia, type PrevisaoDia } from '../../../../lib/weather';

type Entrada = {
  id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida: string | null;
  quantidade: number;
  nota: string | null;
};

type Previsao = {
  id: string;
  titulo: string | null;
  data_inicio: string;
  data_fim_prevista: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  notas: string | null;
};

type Subempreitada = {
  id: string;
  descricao: string;
  tipo_valor: string;
  valor_unitario: number;
  estado: string;
  metodo_pagamento: string | null;
  fatura_emitida: boolean;
  data_pagamento: string | null;
  retencao_percentagem: number;
  retencao_liberada: boolean;
  data_liberacao_retencao: string | null;
  cidade: string | null;
  clientes: { nome: string } | null;
};

type Anexo = { id: string; tipo: string; nome_ficheiro: string | null; url: string };

type Trabalhador = { id: string; nome: string; tipo_valor_padrao: string; valor_padrao: number };
type SubTrabalhador = {
  id: string;
  tipo_valor: string;
  valor_unitario: number;
  estado: string;
  trabalhadores: { nome: string } | null;
  obra_trabalhador_entradas: { quantidade: number }[];
};

function calcularTotalTrabalhador(ot: SubTrabalhador) {
  if (ot.tipo_valor === 'fixo') return ot.valor_unitario;
  const total = ot.obra_trabalhador_entradas.reduce((s, e) => s + e.quantidade, 0);
  return total * ot.valor_unitario;
}

const METODOS = ['Dinheiro', 'Transferência', 'MB WAY', 'Cheque', 'Outro'];
const TIPOS_ANEXO = [
  { value: 'fatura', label: 'Fatura' },
  { value: 'recibo', label: 'Recibo' },
  { value: 'comprovativo', label: 'Comprovativo de Pagamento' },
  { value: 'outro', label: 'Outro' },
];

function calcularHoras(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = saida.split(':').map(Number);
  let minutos = (sh * 60 + sm) - (eh * 60 + em);
  if (minutos < 0) minutos += 24 * 60;
  return Math.round((minutos / 60) * 100) / 100;
}

export default function SubempreitadaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sub, setSub] = useState<Subempreitada | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPagamento, setShowPagamento] = useState(false);
  const [tipoAnexo, setTipoAnexo] = useState('fatura');
  const [uploading, setUploading] = useState(false);
  const [trabalhadoresDisponiveis, setTrabalhadoresDisponiveis] = useState<Trabalhador[]>([]);
  const [subTrabalhadores, setSubTrabalhadores] = useState<SubTrabalhador[]>([]);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [totalDespesasCliente, setTotalDespesasCliente] = useState(0);
  const [showTrabalhadorForm, setShowTrabalhadorForm] = useState(false);
  const [trabalhadorId, setTrabalhadorId] = useState('');
  const [tipoValorTrab, setTipoValorTrab] = useState('dia');
  const [valorUnitarioTrab, setValorUnitarioTrab] = useState('');

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSaida, setHoraSaida] = useState('');
  const [quantidadeManual, setQuantidadeManual] = useState('');
  const [nota, setNota] = useState('');

  const [metodoPagamento, setMetodoPagamento] = useState('Dinheiro');
  const [faturaEmitida, setFaturaEmitida] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));

  const [showEditarValor, setShowEditarValor] = useState(false);
  const [editTipoValor, setEditTipoValor] = useState('hora');
  const [editValorUnitario, setEditValorUnitario] = useState('');
  const [editRetencao, setEditRetencao] = useState('0');

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [editDescricao, setEditDescricao] = useState('');

  const [previsoes, setPrevisoes] = useState<Previsao[]>([]);
  const [showPrevisaoForm, setShowPrevisaoForm] = useState(false);
  const [pTitulo, setPTitulo] = useState('');
  const [pDataInicio, setPDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [pDataFim, setPDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [pHoraInicio, setPHoraInicio] = useState('');
  const [pHoraFim, setPHoraFim] = useState('');
  const [pNotas, setPNotas] = useState('');
  const [aGuardarPrevisao, setAGuardarPrevisao] = useState(false);
  const [previsaoEditandoId, setPrevisaoEditandoId] = useState<string | null>(null);
  const [tempoPorData, setTempoPorData] = useState<Record<string, PrevisaoDia | null>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: subData }, { data: entradasData }, { data: anexosData }, { data: trabData }, { data: subTrabData }, { data: despesasData }, { data: previsoesData }] = await Promise.all([
      supabase.from('subempreitadas').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('subempreitada_entradas').select('*').eq('subempreitada_id', id).order('data'),
      supabase.from('subempreitada_anexos').select('*').eq('subempreitada_id', id).order('criado_em'),
      supabase.from('trabalhadores').select('id, nome, tipo_valor_padrao, valor_padrao').eq('ativo', true).order('nome'),
      supabase.from('obra_trabalhadores').select('*, trabalhadores(nome), obra_trabalhador_entradas(quantidade)').eq('subempreitada_id', id),
      supabase.from('despesas').select('valor, tipo_imputacao').eq('subempreitada_id', id),
      supabase.from('subempreitada_previsoes').select('*').eq('subempreitada_id', id).order('data_inicio'),
    ]);
    setSub(subData as any);
    setEntradas(entradasData || []);
    setAnexos(anexosData || []);
    setPrevisoes(previsoesData || []);
    setTrabalhadoresDisponiveis(trabData || []);
    setSubTrabalhadores((subTrabData as any) || []);
    setTotalDespesas((despesasData || []).filter((d: any) => d.tipo_imputacao === 'custo').reduce((s, d: any) => s + (d.valor || 0), 0));
    setTotalDespesasCliente((despesasData || []).filter((d: any) => d.tipo_imputacao === 'cliente').reduce((s, d: any) => s + (d.valor || 0), 0));
    setLoading(false);
  }, [id]);

  function selecionarTrabalhador(tid: string) {
    setTrabalhadorId(tid);
    const t = trabalhadoresDisponiveis.find((x) => x.id === tid);
    if (t) {
      setTipoValorTrab(t.tipo_valor_padrao);
      setValorUnitarioTrab(String(t.valor_padrao));
    }
  }

  async function atribuirTrabalhador(e: React.FormEvent) {
    e.preventDefault();
    if (!trabalhadorId) { alert('Escolhe um trabalhador.'); return; }
    const { error } = await supabase.from('obra_trabalhadores').insert([{
      subempreitada_id: id,
      trabalhador_id: trabalhadorId,
      tipo_valor: tipoValorTrab,
      valor_unitario: parseFloat(valorUnitarioTrab) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setTrabalhadorId(''); setTipoValorTrab('dia'); setValorUnitarioTrab('');
    setShowTrabalhadorForm(false);
    carregar();
  }

  async function removerTrabalhador(e: React.MouseEvent, otId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Retirar este trabalhador deste trabalho? Todos os registos de horas, despesas/descontos e anexos associados serão apagados.')) return;
    await supabase.from('obra_trabalhadores').delete().eq('id', otId);
    carregar();
  }

  async function enviarAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('subempreitadas').upload(path, ficheiro);
    if (uploadError) { alert('Erro ao enviar: ' + uploadError.message); setUploading(false); return; }
    const url = supabase.storage.from('subempreitadas').getPublicUrl(path).data.publicUrl;
    await supabase.from('subempreitada_anexos').insert([{ subempreitada_id: id, tipo: tipoAnexo, nome_ficheiro: ficheiro.name, url }]);
    setUploading(false);
    e.target.value = '';
    carregar();
  }

  async function removerAnexo(anexoId: string) {
    if (!confirm('Remover este anexo?')) return;
    await supabase.from('subempreitada_anexos').delete().eq('id', anexoId);
    carregar();
  }

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!sub?.cidade || previsoes.length === 0) return;
    const datas = Array.from(new Set(previsoes.map((p) => p.data_inicio)));
    const emFalta = datas.filter((d) => !(d in tempoPorData));
    if (emFalta.length === 0) return;
    Promise.all(emFalta.map(async (d) => [d, await previsaoParaCidade(sub.cidade as string, d)] as const)).then((resultados) => {
      setTempoPorData((prev) => {
        const next = { ...prev };
        for (const [d, p] of resultados) next[d] = p;
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.cidade, previsoes]);

  async function adicionarEntrada(e: React.FormEvent) {
    e.preventDefault();
    const quantidade = sub?.tipo_valor === 'hora'
      ? (horaEntrada && horaSaida ? calcularHoras(horaEntrada, horaSaida) : parseFloat(quantidadeManual) || 0)
      : (parseFloat(quantidadeManual) || 1);

    const { error } = await supabase.from('subempreitada_entradas').insert([{
      subempreitada_id: id,
      data,
      hora_entrada: horaEntrada || null,
      hora_saida: horaSaida || null,
      quantidade,
      nota: nota || null,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setHoraEntrada(''); setHoraSaida(''); setQuantidadeManual(''); setNota('');
    carregar();
  }

  async function removerEntrada(entradaId: string) {
    await supabase.from('subempreitada_entradas').delete().eq('id', entradaId);
    carregar();
  }

  function limparFormPrevisao() {
    setPTitulo(''); setPDataInicio(new Date().toISOString().slice(0, 10)); setPDataFim(new Date().toISOString().slice(0, 10)); setPHoraInicio(''); setPHoraFim(''); setPNotas('');
    setPrevisaoEditandoId(null);
    setShowPrevisaoForm(false);
  }

  function abrirEditarPrevisao(p: Previsao) {
    setPTitulo(p.titulo || '');
    setPDataInicio(p.data_inicio);
    setPDataFim(p.data_fim_prevista);
    setPHoraInicio(p.hora_inicio ? p.hora_inicio.slice(0, 5) : '');
    setPHoraFim(p.hora_fim ? p.hora_fim.slice(0, 5) : '');
    setPNotas(p.notas || '');
    setPrevisaoEditandoId(p.id);
    setShowPrevisaoForm(true);
  }

  async function adicionarPrevisao(e: React.FormEvent) {
    e.preventDefault();
    if (pDataFim < pDataInicio) { alert('A data de fim não pode ser antes da data de início.'); return; }
    setAGuardarPrevisao(true);

    const { data: conflitos } = await supabase
      .from('obra_tarefas')
      .select('titulo, obras(titulo)')
      .eq('bloqueante', true)
      .neq('estado', 'concluida')
      .lte('data_inicio', pDataFim)
      .gte('data_fim_prevista', pDataInicio);
    if (conflitos && conflitos.length > 0) {
      const lista = conflitos.map((c: any) => `"${c.titulo}" (${c.obras?.titulo || 'obra'})`).join(', ');
      if (!confirm(`Atenção: já tens presença marcada nesse período numa obra tua: ${lista}. Queres marcar mesmo assim?`)) {
        setAGuardarPrevisao(false);
        return;
      }
    }

    const dados = {
      titulo: pTitulo || null,
      data_inicio: pDataInicio,
      data_fim_prevista: pDataFim,
      hora_inicio: pHoraInicio || null,
      hora_fim: pHoraFim || null,
      notas: pNotas || null,
    };
    const { error } = previsaoEditandoId
      ? await supabase.from('subempreitada_previsoes').update(dados).eq('id', previsaoEditandoId)
      : await supabase.from('subempreitada_previsoes').insert([{ subempreitada_id: id, ...dados }]);
    setAGuardarPrevisao(false);
    if (error) { alert('Erro: ' + error.message); return; }
    limparFormPrevisao();
    carregar();
  }

  async function removerPrevisao(previsaoId: string) {
    await supabase.from('subempreitada_previsoes').delete().eq('id', previsaoId);
    carregar();
  }

  async function marcarComoPago(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('subempreitadas').update({
      estado: 'pago',
      metodo_pagamento: metodoPagamento,
      fatura_emitida: faturaEmitida,
      data_pagamento: dataPagamento,
    }).eq('id', id);
    setShowPagamento(false);
    carregar();
  }

  async function reabrir() {
    if (!confirm('Marcar novamente como pendente?')) return;
    await supabase.from('subempreitadas').update({ estado: 'pendente' }).eq('id', id);
    carregar();
  }

  function abrirEditarValor() {
    if (sub) {
      setEditTipoValor(sub.tipo_valor);
      setEditValorUnitario(String(sub.valor_unitario));
      setEditRetencao(String(sub.retencao_percentagem || 0));
    }
    setShowEditarValor(true);
  }

  async function guardarValor(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('subempreitadas').update({
      tipo_valor: editTipoValor,
      valor_unitario: parseFloat(editValorUnitario) || 0,
      retencao_percentagem: parseFloat(editRetencao) || 0,
    }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    setShowEditarValor(false);
    carregar();
  }

  async function atualizarCidade(cidade: string) {
    await supabase.from('subempreitadas').update({ cidade: cidade || null }).eq('id', id);
    carregar();
  }

  function abrirEditarTitulo() {
    setEditDescricao(sub?.descricao || '');
    setEditandoTitulo(true);
  }

  async function guardarTitulo(e: React.FormEvent) {
    e.preventDefault();
    if (!editDescricao.trim()) return;
    const { error } = await supabase.from('subempreitadas').update({ descricao: editDescricao.trim() }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    setEditandoTitulo(false);
    carregar();
  }

  async function libertarRetencao() {
    if (!confirm('Marcar a retenção de garantia como recebida/libertada?')) return;
    await supabase.from('subempreitadas').update({
      retencao_liberada: true,
      data_liberacao_retencao: new Date().toISOString().slice(0, 10),
    }).eq('id', id);
    carregar();
  }

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!sub) return <div className="p-8 text-center text-ink-400 text-sm">Registo não encontrado.</div>;

  const totalQuantidadeManual = entradas.reduce((s, en) => s + en.quantidade, 0);
  const totalQuantidadeTrabalhadores = subTrabalhadores
    .filter((ot) => ot.tipo_valor === sub.tipo_valor)
    .reduce((s, ot) => s + ot.obra_trabalhador_entradas.reduce((a, e) => a + e.quantidade, 0), 0);
  const totalQuantidade = totalQuantidadeManual + totalQuantidadeTrabalhadores;
  const total = sub.tipo_valor === 'fixo' ? sub.valor_unitario : totalQuantidade * sub.valor_unitario;
  const totalTrabalhadores = subTrabalhadores.reduce((s, ot) => s + calcularTotalTrabalhador(ot), 0);
  const unidade = sub.tipo_valor === 'dia' ? 'dia(s)' : 'h';
  const valorRetido = (total + totalDespesasCliente) * ((sub.retencao_percentagem || 0) / 100);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <button onClick={() => router.push('/admin/subempreitadas')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar a Prestação de Serviços
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          {editandoTitulo ? (
            <form onSubmit={guardarTitulo} className="flex items-center gap-2">
              <input
                type="text"
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                className="input text-xl font-heading font-semibold py-1"
                autoFocus
                required
              />
              <button className="btn-primary text-sm py-1.5">Guardar</button>
              <button type="button" onClick={() => setEditandoTitulo(false)} className="text-sm text-ink-400 hover:text-ink-700">Cancelar</button>
            </form>
          ) : (
            <h2 className="text-xl font-heading font-semibold text-ink-800 flex items-center gap-2">
              {sub.descricao}
              <button onClick={abrirEditarTitulo} className="text-ink-300 hover:text-brand-600" title="Editar título">
                <Pencil size={14} />
              </button>
            </h2>
          )}
          <p className="text-sm text-ink-400 flex items-center gap-1.5">
            {sub.clientes?.nome || '—'} · {formatMoney(sub.valor_unitario)}{sub.tipo_valor !== 'fixo' ? `/${sub.tipo_valor === 'hora' ? 'h' : 'dia'}` : ''}
            <button onClick={abrirEditarValor} className="text-ink-300 hover:text-brand-600" title="Editar valor cobrado ao empreiteiro/cliente">
              <Pencil size={13} />
            </button>
          </p>
          <input
            type="text"
            placeholder="Cidade/zona do trabalho (ex: Braga) — para o tempo no Dashboard"
            defaultValue={sub.cidade || ''}
            onBlur={(e) => { if (e.target.value !== (sub.cidade || '')) atualizarCidade(e.target.value); }}
            className="input text-xs py-1 mt-1.5 w-64"
          />
        </div>
        <span className={`badge ${sub.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {sub.estado === 'pago' ? 'Pago' : 'Pendente'}
        </span>
      </div>

      {showEditarValor && (
        <form onSubmit={guardarValor} className="card p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <p className="text-xs text-ink-400 md:col-span-3 -mt-1 mb-1">
            Valor que o empreiteiro/cliente paga à empresa por este trabalho (pode ser diferente do que pagas a cada trabalhador).
          </p>
          <select value={editTipoValor} onChange={(e) => setEditTipoValor(e.target.value)} className="input">
            <option value="hora">Por Hora</option>
            <option value="dia">Por Dia</option>
            <option value="fixo">Valor Fixo</option>
          </select>
          <input type="number" step="0.01" placeholder="Valor (€)" value={editValorUnitario} onChange={(e) => setEditValorUnitario(e.target.value)} className="input" required />
          <div>
            <label className="text-xs text-ink-400">Retenção de Garantia (%)</label>
            <input type="number" step="0.1" min="0" max="100" value={editRetencao} onChange={(e) => setEditRetencao(e.target.value)} className="input w-full mt-1" />
          </div>
          <div className="flex gap-2 md:col-span-3">
            <button className="btn-primary justify-center flex-1">Guardar</button>
            <button type="button" onClick={() => setShowEditarValor(false)} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100">Cancelar</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <a href={`/admin/subempreitadas/${id}/relatorio`} target="_blank" rel="noreferrer" className="btn-primary bg-ink-700 hover:bg-ink-800">
          <Printer size={16} /> Ver Relatório
        </a>
        {sub.estado === 'pendente' ? (
          <button onClick={() => setShowPagamento((v) => !v)} className="btn-primary bg-green-600 hover:bg-green-700">
            <CheckCircle2 size={16} /> Marcar como Pago
          </button>
        ) : (
          <button onClick={reabrir} className="btn-primary bg-sand-200 text-ink-700 hover:bg-sand-100">
            <RotateCcw size={16} /> Reabrir
          </button>
        )}
      </div>

      {showPagamento && (
        <form onSubmit={marcarComoPago} className="card p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} className="input">
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="input" />
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={faturaEmitida} onChange={(e) => setFaturaEmitida(e.target.checked)} /> Fatura/recibo emitido
          </label>
          <button className="btn-primary bg-green-600 hover:bg-green-700 justify-center md:col-span-3">Confirmar Pagamento</button>
        </form>
      )}

      {sub.estado === 'pago' && (
        <div className="card p-4 mb-6 bg-green-50 border-green-100 text-sm text-green-800">
          Pago em {sub.data_pagamento ? new Date(sub.data_pagamento).toLocaleDateString('pt-PT') : '—'} · {sub.metodo_pagamento} · {sub.fatura_emitida ? 'Com fatura/recibo' : 'Sem fatura/recibo'}
        </div>
      )}

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><CalendarDays size={16} /> Previsão de Trabalho (calendário)</h3>
          <button onClick={() => { if (showPrevisaoForm) { limparFormPrevisao(); } else { setPrevisaoEditandoId(null); setShowPrevisaoForm(true); } }} className="btn-primary text-sm py-1.5">
            <Plus size={15} /> Marcar
          </button>
        </div>
        <p className="text-xs text-ink-400 mb-4">Marca aqui os dias em que vais/vais trabalhar para este empreiteiro — entra logo no Calendário e avisa-te se colidir com uma das tuas obras. É planeamento, não o registo de horas já feitas (isso é mais abaixo).</p>

        {showPrevisaoForm && (
          <form onSubmit={adicionarPrevisao} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 p-3 bg-sand-50 rounded-lg">
            <input type="text" placeholder="Título (opcional, ex: Pintura sala)" value={pTitulo} onChange={(e) => setPTitulo(e.target.value)} className="input md:col-span-2" />
            <div>
              <label className="text-xs text-ink-400">Início</label>
              <input type="date" value={pDataInicio} onChange={(e) => setPDataInicio(e.target.value)} className="input w-full mt-1" required />
            </div>
            <div>
              <label className="text-xs text-ink-400">Fim previsto</label>
              <input type="date" value={pDataFim} onChange={(e) => setPDataFim(e.target.value)} className="input w-full mt-1" required />
            </div>
            <div>
              <label className="text-xs text-ink-400">Hora início (opcional)</label>
              <input type="time" value={pHoraInicio} onChange={(e) => setPHoraInicio(e.target.value)} className="input w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-ink-400">Hora fim (opcional)</label>
              <input type="time" value={pHoraFim} onChange={(e) => setPHoraFim(e.target.value)} className="input w-full mt-1" />
            </div>
            <input type="text" placeholder="Notas (opcional)" value={pNotas} onChange={(e) => setPNotas(e.target.value)} className="input md:col-span-2" />
            <div className="flex gap-2">
              <button disabled={aGuardarPrevisao} className="btn-primary flex-1 justify-center disabled:opacity-60">
                {aGuardarPrevisao ? 'A guardar...' : previsaoEditandoId ? 'Guardar Alterações' : 'Guardar'}
              </button>
              <button type="button" onClick={limparFormPrevisao} className="text-sm text-ink-400 hover:text-ink-700 px-2">Cancelar</button>
            </div>
          </form>
        )}

        {previsoes.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem dias marcados.</p>
        ) : (
          <div className="space-y-2">
            {previsoes.map((p) => {
              const tempo = tempoPorData[p.data_inicio];
              const horaAlvo = p.hora_inicio ? Number(p.hora_inicio.slice(0, 2)) : null;
              return (
              <div key={p.id} className="flex items-center justify-between gap-2 p-3 border border-sand-200 rounded-lg text-sm">
                <div>
                  <span className="font-medium text-ink-800">{p.titulo || sub.descricao}</span>
                  <span className="text-ink-400 ml-2">
                    {new Date(p.data_inicio).toLocaleDateString('pt-PT')}{p.data_inicio !== p.data_fim_prevista ? ` – ${new Date(p.data_fim_prevista).toLocaleDateString('pt-PT')}` : ''}
                    {(p.hora_inicio || p.hora_fim) && ` · ${p.hora_inicio?.slice(0, 5) || '?'}–${p.hora_fim?.slice(0, 5) || '?'}`}
                  </span>
                  {p.notas && <p className="text-xs text-ink-400 mt-0.5">{p.notas}</p>}
                  {sub.cidade && (
                    <p className="text-xs text-ink-500 mt-0.5">
                      {tempo ? resumoDia(tempo, horaAlvo) : 'A obter previsão do tempo...'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => abrirEditarPrevisao(p)} className="text-ink-300 hover:text-brand-600"><Pencil size={14} /></button>
                  <button onClick={() => removerPrevisao(p.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><HardHat size={16} /> Trabalhadores neste Trabalho</h3>
          <button onClick={() => setShowTrabalhadorForm((v) => !v)} className="btn-primary text-sm py-1.5">
            <UserPlus size={15} /> Atribuir
          </button>
        </div>

        {showTrabalhadorForm && (
          <form onSubmit={atribuirTrabalhador} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 p-3 bg-sand-50 rounded-lg">
            <select value={trabalhadorId} onChange={(e) => selecionarTrabalhador(e.target.value)} className="input">
              <option value="">Selecionar trabalhador</option>
              {trabalhadoresDisponiveis.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select value={tipoValorTrab} onChange={(e) => setTipoValorTrab(e.target.value)} className="input">
              <option value="hora">Por Hora</option>
              <option value="dia">Por Dia</option>
              <option value="fixo">Valor Fixo</option>
            </select>
            <input type="number" step="0.01" placeholder="Valor (€)" value={valorUnitarioTrab} onChange={(e) => setValorUnitarioTrab(e.target.value)} className="input" required />
            <button className="btn-primary justify-center">Confirmar</button>
          </form>
        )}

        {subTrabalhadores.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem trabalhadores atribuídos.</p>
        ) : (
          <div className="space-y-2">
            {subTrabalhadores.map((ot) => (
              <Link key={ot.id} href={`/admin/subempreitadas/${id}/trabalhadores/${ot.id}`} className="flex items-center justify-between p-3 border border-sand-200 rounded-lg hover:bg-sand-50 transition-colors text-sm">
                <div>
                  <span className="font-medium text-ink-800">{ot.trabalhadores?.nome}</span>
                  <span className="text-ink-400 ml-2">{formatMoney(ot.valor_unitario)}{ot.tipo_valor !== 'fixo' ? `/${ot.tipo_valor === 'hora' ? 'h' : 'dia'}` : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink-800">{formatMoney(calcularTotalTrabalhador(ot))}</span>
                  <span className={`badge ${ot.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ot.estado === 'pago' ? 'Pago' : 'Pendente'}
                  </span>
                  <button onClick={(e) => removerTrabalhador(e, ot.id)} className="text-ink-300 hover:text-red-600 shrink-0"><Trash2 size={15} /></button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-ink-700 mb-4 flex items-center gap-2"><Paperclip size={16} /> Anexos</h3>

        {anexos.length > 0 && (
          <div className="space-y-2 mb-4">
            {TIPOS_ANEXO.map((t) => {
              const doTipo = anexos.filter((a) => a.tipo === t.value);
              if (doTipo.length === 0) return null;
              return (
                <div key={t.value}>
                  <p className="text-xs text-ink-400 uppercase tracking-wide mb-1">{t.label}</p>
                  <div className="space-y-1">
                    {doTipo.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 p-2 bg-sand-50 rounded-lg text-sm">
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline truncate">{a.nome_ficheiro || 'ficheiro'}</a>
                        <button onClick={() => removerAnexo(a.id)} className="text-ink-300 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-sand-100">
          <select value={tipoAnexo} onChange={(e) => setTipoAnexo(e.target.value)} className="input">
            {TIPOS_ANEXO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="btn-primary cursor-pointer justify-center">
            <Upload size={16} /> {uploading ? 'A enviar...' : 'Anexar Ficheiro'}
            <input type="file" className="hidden" disabled={uploading} onChange={enviarAnexo} />
          </label>
        </div>
      </div>

      {sub.tipo_valor !== 'fixo' && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-ink-700 mb-1">Registo de {sub.tipo_valor === 'hora' ? 'Horas' : 'Dias'} Já Trabalhados (geral)</h3>
          <p className="text-xs text-ink-400 mb-4">
            Isto é para faturação — regista aqui as horas/dias já feitos. Usa isto para horas não atribuídas a um trabalhador específico; as horas de cada trabalhador (na secção acima) somam-se automaticamente a este total.
            {totalQuantidadeTrabalhadores > 0 && ` Trabalhadores já contribuem com ${totalQuantidadeTrabalhadores} ${unidade}.`}
            {' '}Para planear um dia futuro, usa a "Previsão de Trabalho" no topo da página.
          </p>

          {entradas.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-400 text-xs uppercase">
                  <tr>
                    <th className="pb-2 font-medium">Data</th>
                    {sub.tipo_valor === 'hora' && <th className="pb-2 font-medium">Entrada</th>}
                    {sub.tipo_valor === 'hora' && <th className="pb-2 font-medium">Saída</th>}
                    <th className="pb-2 font-medium text-right">{unidade}</th>
                    <th className="pb-2 font-medium">Nota</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {entradas.map((en) => (
                    <tr key={en.id}>
                      <td className="py-2 text-ink-800">{new Date(en.data).toLocaleDateString('pt-PT')}</td>
                      {sub.tipo_valor === 'hora' && <td className="py-2 text-ink-500">{en.hora_entrada || '—'}</td>}
                      {sub.tipo_valor === 'hora' && <td className="py-2 text-ink-500">{en.hora_saida || '—'}</td>}
                      <td className="py-2 text-right text-ink-800">{en.quantidade}</td>
                      <td className="py-2 text-ink-500">{en.nota || '—'}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => removerEntrada(en.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={adicionarEntrada} className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-3 border-t border-sand-100">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" />
            {sub.tipo_valor === 'hora' ? (
              <>
                <input type="time" placeholder="Entrada" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} className="input" />
                <input type="time" placeholder="Saída" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} className="input" />
                <input type="number" step="0.25" placeholder="ou horas direto" value={quantidadeManual} onChange={(e) => setQuantidadeManual(e.target.value)} className="input" disabled={!!(horaEntrada && horaSaida)} />
              </>
            ) : (
              <input type="number" step="0.5" placeholder="Nº de dias" value={quantidadeManual} onChange={(e) => setQuantidadeManual(e.target.value)} className="input md:col-span-2" />
            )}
            <input type="text" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} className="input md:col-span-2" />
            <button className="btn-primary justify-center md:col-span-5">
              <Plus size={16} /> Adicionar
            </button>
          </form>
        </div>
      )}

      <div className="card p-6">
        <div className="space-y-2 text-sm max-w-sm ml-auto">
          {sub.tipo_valor !== 'fixo' && (
            <>
              {totalQuantidadeTrabalhadores > 0 && (
                <>
                  <div className="flex justify-between text-ink-400">
                    <span>Horas gerais</span>
                    <span>{totalQuantidadeManual} {unidade}</span>
                  </div>
                  <div className="flex justify-between text-ink-400">
                    <span>Horas dos trabalhadores</span>
                    <span>{totalQuantidadeTrabalhadores} {unidade}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-ink-500">Total {unidade}</span>
                <span className="text-ink-800">{totalQuantidade} {unidade}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-ink-500">A Receber</span>
            <span className="text-ink-800">{formatMoney(total)}</span>
          </div>
          {totalDespesasCliente > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-500">+ Despesas a Cobrar</span>
              <span className="text-ink-800">+ {formatMoney(totalDespesasCliente)}</span>
            </div>
          )}
          {totalDespesas > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-500">Despesas (custo)</span>
              <span className="text-ink-800">− {formatMoney(totalDespesas)}</span>
            </div>
          )}
          {totalTrabalhadores > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-500">Mão de Obra</span>
              <span className="text-ink-800">− {formatMoney(totalTrabalhadores)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Margem</span>
            <span className="text-brand-600">{formatMoney(total + totalDespesasCliente - totalDespesas - totalTrabalhadores)}</span>
          </div>
          {sub.retencao_percentagem > 0 && (
            <div className="flex justify-between text-ink-400 pt-1">
              <span>Retenção de Garantia ({sub.retencao_percentagem}%)</span>
              <span>− {formatMoney(valorRetido)}</span>
            </div>
          )}
        </div>
      </div>

      {sub.retencao_percentagem > 0 && (
        <div className={`card p-4 mt-6 flex flex-wrap items-center justify-between gap-3 ${sub.retencao_liberada ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
          <p className="text-sm flex items-center gap-2">
            <ShieldCheck size={16} className={sub.retencao_liberada ? 'text-green-600' : 'text-amber-600'} />
            {sub.retencao_liberada
              ? <>Retenção de {formatMoney(valorRetido)} já libertada em {sub.data_liberacao_retencao ? new Date(sub.data_liberacao_retencao).toLocaleDateString('pt-PT') : '—'}.</>
              : <>Retenção de garantia pendente: {formatMoney(valorRetido)}.</>}
          </p>
          {!sub.retencao_liberada && (
            <button onClick={libertarRetencao} className="btn-primary bg-amber-600 hover:bg-amber-700 text-sm py-1.5">Marcar como Recebida</button>
          )}
        </div>
      )}
    </div>
  );
}
