'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import Link from 'next/link';
import { ArrowLeft, Upload, Trash2, ImageOff, UserPlus, HardHat, AlertTriangle, ShieldCheck, Plus, Calendar, Check } from 'lucide-react';

type Obra = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  valor_total: number | null;
  progresso_percentagem: number;
  clientes: { nome: string } | null;
};

type Foto = { id: string; url: string; legenda: string | null; criado_em: string };

type Garantia = {
  id: string;
  equipamento: string;
  marca_modelo: string | null;
  numero_serie: string | null;
  fornecedor: string | null;
  data_compra: string | null;
  duracao_meses: number;
  notas: string | null;
  anexo_url: string | null;
  anexo_nome: string | null;
};

function calcularFimGarantia(g: Garantia): Date | null {
  if (!g.data_compra) return null;
  const fim = new Date(g.data_compra);
  fim.setMonth(fim.getMonth() + (g.duracao_meses || 0));
  return fim;
}

type Tarefa = {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim_prevista: string;
  estado: string;
  data_fim_real: string | null;
  notas: string | null;
};

function estaAtrasada(t: Tarefa): boolean {
  return t.estado !== 'concluida' && new Date(t.data_fim_prevista) < new Date(new Date().toDateString());
}

const ESTADOS_TAREFA: Record<string, { label: string; cor: string }> = {
  pendente: { label: 'Pendente', cor: 'bg-sand-300' },
  em_curso: { label: 'Em Curso', cor: 'bg-blue-400' },
  concluida: { label: 'Concluída', cor: 'bg-green-500' },
};

type Trabalhador = { id: string; nome: string; tipo_valor_padrao: string; valor_padrao: number };
type ObraTrabalhador = {
  id: string;
  trabalhador_id: string;
  tipo_valor: string;
  valor_unitario: number;
  estado: string;
  trabalhadores: { nome: string } | null;
  obra_trabalhador_entradas: { quantidade: number }[];
};

const ESTADOS = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'em_curso', label: 'Em Curso' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'concluida', label: 'Concluída' },
];

function calcularTotalTrabalhador(ot: ObraTrabalhador) {
  if (ot.tipo_valor === 'fixo') return ot.valor_unitario;
  const total = ot.obra_trabalhador_entradas.reduce((s, e) => s + e.quantidade, 0);
  return total * ot.valor_unitario;
}

export default function ObraDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obra, setObra] = useState<Obra | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [totalDespesasCliente, setTotalDespesasCliente] = useState(0);
  const [trabalhadoresDisponiveis, setTrabalhadoresDisponiveis] = useState<Trabalhador[]>([]);
  const [obraTrabalhadores, setObraTrabalhadores] = useState<ObraTrabalhador[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [legenda, setLegenda] = useState('');
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [showGarantiaForm, setShowGarantiaForm] = useState(false);
  const [gEquipamento, setGEquipamento] = useState('');
  const [gMarcaModelo, setGMarcaModelo] = useState('');
  const [gNumeroSerie, setGNumeroSerie] = useState('');
  const [gFornecedor, setGFornecedor] = useState('');
  const [gDataCompra, setGDataCompra] = useState(() => new Date().toISOString().slice(0, 10));
  const [gDuracaoMeses, setGDuracaoMeses] = useState('24');
  const [gNotas, setGNotas] = useState('');
  const [gFicheiro, setGFicheiro] = useState<File | null>(null);
  const [aGuardarGarantia, setAGuardarGarantia] = useState(false);
  const [showTrabalhadorForm, setShowTrabalhadorForm] = useState(false);
  const [trabalhadorId, setTrabalhadorId] = useState('');
  const [tipoValorTrab, setTipoValorTrab] = useState('dia');
  const [valorUnitarioTrab, setValorUnitarioTrab] = useState('');

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [showTarefaForm, setShowTarefaForm] = useState(false);
  const [tTitulo, setTTitulo] = useState('');
  const [tDataInicio, setTDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [tDataFim, setTDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [tNotas, setTNotas] = useState('');
  const [aGuardarTarefa, setAGuardarTarefa] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: obraData }, { data: fotosData }, { data: despesasData }, { data: trabData }, { data: obraTrabData }, { data: garantiasData }, { data: tarefasData }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('fotos_obra').select('*').eq('obra_id', id).order('criado_em', { ascending: false }),
      supabase.from('despesas').select('valor, tipo_imputacao').eq('obra_id', id),
      supabase.from('trabalhadores').select('id, nome, tipo_valor_padrao, valor_padrao').eq('ativo', true).order('nome'),
      supabase.from('obra_trabalhadores').select('*, trabalhadores(nome), obra_trabalhador_entradas(quantidade)').eq('obra_id', id),
      supabase.from('garantias').select('*').eq('obra_id', id).order('criado_em', { ascending: false }),
      supabase.from('obra_tarefas').select('*').eq('obra_id', id).order('data_inicio'),
    ]);
    setObra(obraData as any);
    setFotos(fotosData || []);
    setTotalDespesas((despesasData || []).filter((d: any) => d.tipo_imputacao === 'custo').reduce((s, d: any) => s + (d.valor || 0), 0));
    setTotalDespesasCliente((despesasData || []).filter((d: any) => d.tipo_imputacao === 'cliente').reduce((s, d: any) => s + (d.valor || 0), 0));
    setTrabalhadoresDisponiveis(trabData || []);
    setObraTrabalhadores((obraTrabData as any) || []);
    setGarantias(garantiasData || []);
    setTarefas(tarefasData || []);
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
      obra_id: id,
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
    if (!confirm('Retirar este trabalhador desta obra? Todos os registos de horas, despesas/descontos e anexos associados serão apagados.')) return;
    await supabase.from('obra_trabalhadores').delete().eq('id', otId);
    carregar();
  }

  useEffect(() => { carregar(); }, [carregar]);

  async function atualizarCampo(campo: string, valor: any) {
    await supabase.from('obras').update({ [campo]: valor }).eq('id', id);
    carregar();
  }

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('fotos-obras').upload(path, ficheiro);
    if (uploadError) {
      alert('Erro ao enviar foto: ' + uploadError.message);
      setUploading(false);
      return;
    }
    const url = supabase.storage.from('fotos-obras').getPublicUrl(path).data.publicUrl;
    await supabase.from('fotos_obra').insert([{ obra_id: id, url, legenda: legenda || null }]);
    setLegenda('');
    setUploading(false);
    e.target.value = '';
    carregar();
  }

  async function removerFoto(fotoId: string) {
    if (!confirm('Remover esta foto?')) return;
    await supabase.from('fotos_obra').delete().eq('id', fotoId);
    carregar();
  }

  async function adicionarGarantia(e: React.FormEvent) {
    e.preventDefault();
    setAGuardarGarantia(true);
    let anexoUrl: string | null = null;
    let anexoNome: string | null = null;
    if (gFicheiro) {
      const path = `${id}/${Date.now()}-${gFicheiro.name}`;
      const { error: uploadError } = await supabase.storage.from('garantias').upload(path, gFicheiro);
      if (uploadError) { alert('Erro ao anexar: ' + uploadError.message); setAGuardarGarantia(false); return; }
      anexoUrl = supabase.storage.from('garantias').getPublicUrl(path).data.publicUrl;
      anexoNome = gFicheiro.name;
    }
    const { error } = await supabase.from('garantias').insert([{
      obra_id: id,
      equipamento: gEquipamento,
      marca_modelo: gMarcaModelo || null,
      numero_serie: gNumeroSerie || null,
      fornecedor: gFornecedor || null,
      data_compra: gDataCompra || null,
      duracao_meses: parseInt(gDuracaoMeses) || 0,
      notas: gNotas || null,
      anexo_url: anexoUrl,
      anexo_nome: anexoNome,
    }]);
    setAGuardarGarantia(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setGEquipamento(''); setGMarcaModelo(''); setGNumeroSerie(''); setGFornecedor('');
    setGDataCompra(new Date().toISOString().slice(0, 10)); setGDuracaoMeses('24'); setGNotas(''); setGFicheiro(null);
    setShowGarantiaForm(false);
    carregar();
  }

  async function removerGarantia(garantiaId: string) {
    if (!confirm('Remover esta garantia?')) return;
    await supabase.from('garantias').delete().eq('id', garantiaId);
    carregar();
  }

  async function adicionarTarefa(e: React.FormEvent) {
    e.preventDefault();
    setAGuardarTarefa(true);
    const { error } = await supabase.from('obra_tarefas').insert([{
      obra_id: id,
      titulo: tTitulo,
      data_inicio: tDataInicio,
      data_fim_prevista: tDataFim,
      notas: tNotas || null,
      ordem: tarefas.length,
    }]);
    setAGuardarTarefa(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setTTitulo(''); setTDataInicio(new Date().toISOString().slice(0, 10)); setTDataFim(new Date().toISOString().slice(0, 10)); setTNotas('');
    setShowTarefaForm(false);
    carregar();
  }

  async function mudarEstadoTarefa(tarefaId: string, novoEstado: string) {
    await supabase.from('obra_tarefas').update({
      estado: novoEstado,
      data_fim_real: novoEstado === 'concluida' ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', tarefaId);
    carregar();
  }

  async function removerTarefa(tarefaId: string) {
    if (!confirm('Remover esta tarefa?')) return;
    await supabase.from('obra_tarefas').delete().eq('id', tarefaId);
    carregar();
  }

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!obra) return <div className="p-8 text-center text-ink-400 text-sm">Obra não encontrada.</div>;

  const totalMaoDeObra = obraTrabalhadores.reduce((s, ot) => s + calcularTotalTrabalhador(ot), 0);
  const valorTotalComCliente = (obra.valor_total || 0) + totalDespesasCliente;
  const margem = valorTotalComCliente - totalDespesas - totalMaoDeObra;
  const margemPercentagem = valorTotalComCliente > 0 ? (margem / valorTotalComCliente) * 100 : 0;
  const risco = margem < 0 ? 'critico' : margemPercentagem < 10 ? 'atencao' : null;

  const tarefasAtrasadas = tarefas.filter(estaAtrasada);
  const datasInicio = tarefas.map((t) => new Date(t.data_inicio).getTime());
  const datasFim = tarefas.map((t) => new Date(t.data_fim_prevista).getTime());
  const cronogramaMin = datasInicio.length ? Math.min(...datasInicio) : 0;
  const cronogramaMax = datasFim.length ? Math.max(...datasFim) : 0;
  const cronogramaSpan = Math.max(cronogramaMax - cronogramaMin, 1);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <button onClick={() => router.push('/admin/obras')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar a Obras
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-ink-800">{obra.titulo}</h2>
          <p className="text-sm text-ink-400">{obra.clientes?.nome || '—'}</p>
        </div>
        <select value={obra.status} onChange={(e) => atualizarCampo('status', e.target.value)} className="input">
          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      {risco && (
        <div className={`card p-4 mb-6 flex items-center gap-2.5 text-sm ${risco === 'critico' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <AlertTriangle size={18} className="shrink-0" />
          {risco === 'critico'
            ? <>Atenção: as despesas e mão de obra já ultrapassam o valor orçamentado nesta obra (margem de {formatMoney(margem)}).</>
            : <>Margem baixa nesta obra ({margemPercentagem.toFixed(1)}% do orçamentado) — vale a pena rever custos antes de continuar.</>}
        </div>
      )}

      {tarefasAtrasadas.length > 0 && (
        <div className="card p-4 mb-6 flex items-center gap-2.5 text-sm bg-red-50 border-red-200 text-red-800">
          <Calendar size={18} className="shrink-0" />
          {tarefasAtrasadas.length} tarefa{tarefasAtrasadas.length !== 1 ? 's' : ''} atrasada{tarefasAtrasadas.length !== 1 ? 's' : ''} no cronograma: {tarefasAtrasadas.map((t) => t.titulo).join(', ')}.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-ink-400 text-sm mb-1">Orçamentado</p>
          <p className="text-xl font-heading font-semibold text-ink-800">{formatMoney(valorTotalComCliente)}</p>
          {totalDespesasCliente > 0 && (
            <p className="text-xs text-ink-400 mt-1">{formatMoney(obra.valor_total || 0)} + {formatMoney(totalDespesasCliente)} a cobrar</p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-ink-400 text-sm mb-1">Despesas (custo)</p>
          <p className="text-xl font-heading font-semibold text-ink-800">{formatMoney(totalDespesas)}</p>
        </div>
        <div className="card p-5">
          <p className="text-ink-400 text-sm mb-1">Mão de Obra</p>
          <p className="text-xl font-heading font-semibold text-ink-800">{formatMoney(totalMaoDeObra)}</p>
        </div>
        <div className="card p-5">
          <p className="text-ink-400 text-sm mb-1">Margem</p>
          <p className={`text-xl font-heading font-semibold ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(margem)}</p>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><HardHat size={16} /> Trabalhadores nesta Obra</h3>
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

        {obraTrabalhadores.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem trabalhadores atribuídos.</p>
        ) : (
          <div className="space-y-2">
            {obraTrabalhadores.map((ot) => (
              <Link key={ot.id} href={`/admin/obras/${id}/trabalhadores/${ot.id}`} className="flex items-center justify-between p-3 border border-sand-200 rounded-lg hover:bg-sand-50 transition-colors text-sm">
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><Calendar size={16} /> Cronograma (visível ao cliente)</h3>
          <button onClick={() => setShowTarefaForm((v) => !v)} className="btn-primary text-sm py-1.5">
            <Plus size={15} /> Adicionar Tarefa
          </button>
        </div>

        {showTarefaForm && (
          <form onSubmit={adicionarTarefa} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 p-3 bg-sand-50 rounded-lg">
            <input type="text" placeholder="Tarefa (ex: Demolição)" value={tTitulo} onChange={(e) => setTTitulo(e.target.value)} className="input md:col-span-2" required />
            <div>
              <label className="text-xs text-ink-400">Início</label>
              <input type="date" value={tDataInicio} onChange={(e) => setTDataInicio(e.target.value)} className="input w-full mt-1" required />
            </div>
            <div>
              <label className="text-xs text-ink-400">Fim previsto</label>
              <input type="date" value={tDataFim} onChange={(e) => setTDataFim(e.target.value)} className="input w-full mt-1" required />
            </div>
            <input type="text" placeholder="Notas (opcional)" value={tNotas} onChange={(e) => setTNotas(e.target.value)} className="input md:col-span-3" />
            <button disabled={aGuardarTarefa} className="btn-primary justify-center disabled:opacity-60">
              {aGuardarTarefa ? 'A guardar...' : 'Guardar'}
            </button>
          </form>
        )}

        {tarefas.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem tarefas no cronograma.</p>
        ) : (
          <div className="space-y-3">
            {tarefas.map((t) => {
              const atrasada = estaAtrasada(t);
              const info = ESTADOS_TAREFA[t.estado] || ESTADOS_TAREFA.pendente;
              const inicio = new Date(t.data_inicio).getTime();
              const fim = new Date(t.data_fim_prevista).getTime();
              const left = ((inicio - cronogramaMin) / cronogramaSpan) * 100;
              const width = Math.max(((fim - inicio) / cronogramaSpan) * 100, 2);
              return (
                <div key={t.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-ink-800">{t.titulo}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-ink-400">{new Date(t.data_inicio).toLocaleDateString('pt-PT')} – {new Date(t.data_fim_prevista).toLocaleDateString('pt-PT')}</span>
                      <span className={`badge ${atrasada ? 'bg-red-100 text-red-700' : t.estado === 'concluida' ? 'bg-green-100 text-green-700' : t.estado === 'em_curso' ? 'bg-blue-100 text-blue-700' : 'bg-sand-100 text-ink-600'}`}>
                        {atrasada ? 'Atrasada' : info.label}
                      </span>
                      {t.estado !== 'concluida' && (
                        <button onClick={() => mudarEstadoTarefa(t.id, t.estado === 'pendente' ? 'em_curso' : 'concluida')} className="text-ink-300 hover:text-green-600" title={t.estado === 'pendente' ? 'Marcar como Em Curso' : 'Marcar como Concluída'}>
                          <Check size={15} />
                        </button>
                      )}
                      <button onClick={() => removerTarefa(t.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="w-full bg-sand-100 rounded-full h-2.5 relative overflow-hidden">
                    <div
                      className={`absolute h-full rounded-full ${atrasada ? 'bg-red-500' : info.cor}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                  {t.notas && <p className="text-xs text-ink-400 mt-1">{t.notas}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink-700">Progresso (visível ao cliente)</h3>
          <span className="text-sm font-medium text-brand-600">{obra.progresso_percentagem}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={obra.progresso_percentagem}
          onChange={(e) => setObra({ ...obra, progresso_percentagem: parseInt(e.target.value) })}
          onMouseUp={(e) => atualizarCampo('progresso_percentagem', parseInt((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => atualizarCampo('progresso_percentagem', parseInt((e.target as HTMLInputElement).value))}
          className="w-full accent-brand-500"
        />
        <div className="w-full bg-sand-100 rounded-full h-2 mt-3 overflow-hidden">
          <div className="bg-brand-500 h-full transition-all" style={{ width: `${obra.progresso_percentagem}%` }} />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink-700 mb-4">Fotos da Obra (visíveis ao cliente)</h3>
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <input type="text" placeholder="Legenda (opcional)" value={legenda} onChange={(e) => setLegenda(e.target.value)} className="input flex-1" />
          <label className="btn-primary justify-center cursor-pointer">
            <Upload size={16} /> {uploading ? 'A enviar...' : 'Enviar Foto'}
            <input type="file" accept="image/*" className="hidden" onChange={enviarFoto} disabled={uploading} />
          </label>
        </div>

        {fotos.length === 0 ? (
          <div className="text-center py-10 text-ink-400 text-sm">
            <ImageOff size={28} className="mx-auto mb-2 text-ink-200" />
            Ainda sem fotos.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {fotos.map((f) => (
              <div key={f.id} className="relative group">
                <img src={f.url} alt={f.legenda || ''} className="w-full aspect-square object-cover rounded-lg border border-sand-200" />
                {f.legenda && <p className="text-xs text-ink-500 mt-1 truncate">{f.legenda}</p>}
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

      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-700 flex items-center gap-2"><ShieldCheck size={16} /> Garantias de Equipamentos (visível ao cliente)</h3>
          <button onClick={() => setShowGarantiaForm((v) => !v)} className="btn-primary text-sm py-1.5">
            <Plus size={15} /> Adicionar
          </button>
        </div>

        {showGarantiaForm && (
          <form onSubmit={adicionarGarantia} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 p-3 bg-sand-50 rounded-lg">
            <input type="text" placeholder="Equipamento (ex: Caldeira)" value={gEquipamento} onChange={(e) => setGEquipamento(e.target.value)} className="input" required />
            <input type="text" placeholder="Marca/Modelo" value={gMarcaModelo} onChange={(e) => setGMarcaModelo(e.target.value)} className="input" />
            <input type="text" placeholder="Nº de Série" value={gNumeroSerie} onChange={(e) => setGNumeroSerie(e.target.value)} className="input" />
            <input type="text" placeholder="Fornecedor" value={gFornecedor} onChange={(e) => setGFornecedor(e.target.value)} className="input" />
            <div>
              <label className="text-xs text-ink-400">Data de compra</label>
              <input type="date" value={gDataCompra} onChange={(e) => setGDataCompra(e.target.value)} className="input w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-ink-400">Garantia (meses)</label>
              <input type="number" value={gDuracaoMeses} onChange={(e) => setGDuracaoMeses(e.target.value)} className="input w-full mt-1" />
            </div>
            <input type="text" placeholder="Notas (opcional)" value={gNotas} onChange={(e) => setGNotas(e.target.value)} className="input md:col-span-3" />
            <label className="input flex items-center gap-2 cursor-pointer text-ink-500 md:col-span-2">
              <Upload size={15} className="shrink-0" />
              {gFicheiro ? gFicheiro.name : 'Anexar fatura/certificado (opcional)'}
              <input type="file" className="hidden" onChange={(e) => setGFicheiro(e.target.files?.[0] || null)} />
            </label>
            <button disabled={aGuardarGarantia} className="btn-primary justify-center disabled:opacity-60">
              {aGuardarGarantia ? 'A guardar...' : 'Guardar Garantia'}
            </button>
          </form>
        )}

        {garantias.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Ainda sem garantias registadas.</p>
        ) : (
          <div className="space-y-2">
            {garantias.map((g) => {
              const fim = calcularFimGarantia(g);
              const valida = fim ? fim.getTime() >= Date.now() : null;
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 p-3 border border-sand-200 rounded-lg text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-800">
                      {g.equipamento}
                      {g.marca_modelo && <span className="text-ink-400 font-normal"> · {g.marca_modelo}</span>}
                    </p>
                    <p className="text-xs text-ink-400">
                      {fim ? (valida ? `Válida até ${fim.toLocaleDateString('pt-PT')}` : `Expirou em ${fim.toLocaleDateString('pt-PT')}`) : 'Sem data de compra definida'}
                      {g.anexo_url && <> · <a href={g.anexo_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{g.anexo_nome || 'documento'}</a></>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {valida !== null && (
                      <span className={`badge ${valida ? 'bg-green-100 text-green-700' : 'bg-sand-100 text-ink-500'}`}>{valida ? 'Válida' : 'Expirada'}</span>
                    )}
                    <button onClick={() => removerGarantia(g.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
