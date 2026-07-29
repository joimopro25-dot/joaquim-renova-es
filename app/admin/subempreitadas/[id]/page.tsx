'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CheckCircle2, RotateCcw, Printer, Paperclip, Upload, UserPlus, HardHat } from 'lucide-react';

type Entrada = {
  id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida: string | null;
  quantidade: number;
  nota: string | null;
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

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: subData }, { data: entradasData }, { data: anexosData }, { data: trabData }, { data: subTrabData }] = await Promise.all([
      supabase.from('subempreitadas').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('subempreitada_entradas').select('*').eq('subempreitada_id', id).order('data'),
      supabase.from('subempreitada_anexos').select('*').eq('subempreitada_id', id).order('criado_em'),
      supabase.from('trabalhadores').select('id, nome, tipo_valor_padrao, valor_padrao').eq('ativo', true).order('nome'),
      supabase.from('obra_trabalhadores').select('*, trabalhadores(nome), obra_trabalhador_entradas(quantidade)').eq('subempreitada_id', id),
    ]);
    setSub(subData as any);
    setEntradas(entradasData || []);
    setAnexos(anexosData || []);
    setTrabalhadoresDisponiveis(trabData || []);
    setSubTrabalhadores((subTrabData as any) || []);
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

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <button onClick={() => router.push('/admin/subempreitadas')} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar a Subempreitadas
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-ink-800">{sub.descricao}</h2>
          <p className="text-sm text-ink-400">{sub.clientes?.nome || '—'} · {formatMoney(sub.valor_unitario)}{sub.tipo_valor !== 'fixo' ? `/${sub.tipo_valor === 'hora' ? 'h' : 'dia'}` : ''}</p>
        </div>
        <span className={`badge ${sub.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {sub.estado === 'pago' ? 'Pago' : 'Pendente'}
        </span>
      </div>

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
          <h3 className="font-semibold text-ink-700 mb-1">Registo de {sub.tipo_valor === 'hora' ? 'Horas' : 'Dias'} (geral)</h3>
          <p className="text-xs text-ink-400 mb-4">
            Usa isto para horas não atribuídas a um trabalhador específico. As horas de cada trabalhador (na secção acima) somam-se automaticamente a este total.
            {totalQuantidadeTrabalhadores > 0 && ` Trabalhadores já contribuem com ${totalQuantidadeTrabalhadores} ${unidade}.`}
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
          {totalTrabalhadores > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-500">Mão de Obra</span>
              <span className="text-ink-800">− {formatMoney(totalTrabalhadores)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Margem</span>
            <span className="text-brand-600">{formatMoney(total - totalTrabalhadores)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
