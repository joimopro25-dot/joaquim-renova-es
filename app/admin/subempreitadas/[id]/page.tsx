'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import { ArrowLeft, Plus, Trash2, CheckCircle2, RotateCcw, Printer } from 'lucide-react';

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

const METODOS = ['Dinheiro', 'Transferência', 'MB WAY', 'Cheque', 'Outro'];

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
  const [loading, setLoading] = useState(true);
  const [showPagamento, setShowPagamento] = useState(false);

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
    const [{ data: subData }, { data: entradasData }] = await Promise.all([
      supabase.from('subempreitadas').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('subempreitada_entradas').select('*').eq('subempreitada_id', id).order('data'),
    ]);
    setSub(subData as any);
    setEntradas(entradasData || []);
    setLoading(false);
  }, [id]);

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

  const totalQuantidade = entradas.reduce((s, en) => s + en.quantidade, 0);
  const total = sub.tipo_valor === 'fixo' ? sub.valor_unitario : totalQuantidade * sub.valor_unitario;
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

      {sub.tipo_valor !== 'fixo' && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-ink-700 mb-4">Registo de {sub.tipo_valor === 'hora' ? 'Horas' : 'Dias'}</h3>

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
            <div className="flex justify-between">
              <span className="text-ink-500">Total {unidade}</span>
              <span className="text-ink-800">{totalQuantidade} {unidade}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-sand-100 font-semibold text-base">
            <span className="text-ink-800">Total a Pagar</span>
            <span className="text-brand-600">{formatMoney(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
