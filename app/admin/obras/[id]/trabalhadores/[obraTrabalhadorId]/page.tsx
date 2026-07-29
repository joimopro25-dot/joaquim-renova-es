'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../../lib/supabase';
import { formatMoney } from '../../../../../../lib/format';
import { ArrowLeft, Plus, Trash2, CheckCircle2, RotateCcw, Paperclip, Upload } from 'lucide-react';

type Entrada = {
  id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida: string | null;
  quantidade: number;
  nota: string | null;
};

type Anexo = { id: string; tipo: string; nome_ficheiro: string | null; url: string };

type ObraTrabalhador = {
  id: string;
  obra_id: string;
  tipo_valor: string;
  valor_unitario: number;
  estado: string;
  metodo_pagamento: string | null;
  recibo_emitido: boolean;
  data_pagamento: string | null;
  trabalhadores: { nome: string; regime: string } | null;
  obras: { titulo: string } | null;
};

const METODOS = ['Dinheiro', 'Transferência', 'MB WAY', 'Cheque', 'Outro'];
const TIPOS_ANEXO = [
  { value: 'recibo', label: 'Recibo Verde' },
  { value: 'comprovativo', label: 'Comprovativo de Pagamento' },
  { value: 'seguranca_social', label: 'Segurança Social' },
  { value: 'seguro', label: 'Seguro de Acidentes de Trabalho' },
  { value: 'outro', label: 'Outro' },
];

function calcularHoras(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = saida.split(':').map(Number);
  let minutos = (sh * 60 + sm) - (eh * 60 + em);
  if (minutos < 0) minutos += 24 * 60;
  return Math.round((minutos / 60) * 100) / 100;
}

export default function ObraTrabalhadorDetalhe() {
  const { id, obraTrabalhadorId } = useParams<{ id: string; obraTrabalhadorId: string }>();
  const router = useRouter();
  const [ot, setOt] = useState<ObraTrabalhador | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPagamento, setShowPagamento] = useState(false);
  const [tipoAnexo, setTipoAnexo] = useState('recibo');
  const [uploading, setUploading] = useState(false);

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSaida, setHoraSaida] = useState('');
  const [quantidadeManual, setQuantidadeManual] = useState('');
  const [nota, setNota] = useState('');

  const [metodoPagamento, setMetodoPagamento] = useState('Dinheiro');
  const [reciboEmitido, setReciboEmitido] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: otData }, { data: entradasData }, { data: anexosData }] = await Promise.all([
      supabase.from('obra_trabalhadores').select('*, trabalhadores(nome, regime), obras(titulo)').eq('id', obraTrabalhadorId).single(),
      supabase.from('obra_trabalhador_entradas').select('*').eq('obra_trabalhador_id', obraTrabalhadorId).order('data'),
      supabase.from('obra_trabalhador_anexos').select('*').eq('obra_trabalhador_id', obraTrabalhadorId).order('criado_em'),
    ]);
    setOt(otData as any);
    setEntradas(entradasData || []);
    setAnexos(anexosData || []);
    setLoading(false);
  }, [obraTrabalhadorId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarEntrada(e: React.FormEvent) {
    e.preventDefault();
    const quantidade = ot?.tipo_valor === 'hora'
      ? (horaEntrada && horaSaida ? calcularHoras(horaEntrada, horaSaida) : parseFloat(quantidadeManual) || 0)
      : (parseFloat(quantidadeManual) || 1);

    const { error } = await supabase.from('obra_trabalhador_entradas').insert([{
      obra_trabalhador_id: obraTrabalhadorId,
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
    await supabase.from('obra_trabalhador_entradas').delete().eq('id', entradaId);
    carregar();
  }

  async function marcarComoPago(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('obra_trabalhadores').update({
      estado: 'pago',
      metodo_pagamento: metodoPagamento,
      recibo_emitido: reciboEmitido,
      data_pagamento: dataPagamento,
    }).eq('id', obraTrabalhadorId);
    setShowPagamento(false);
    carregar();
  }

  async function reabrir() {
    if (!confirm('Marcar novamente como pendente?')) return;
    await supabase.from('obra_trabalhadores').update({ estado: 'pendente' }).eq('id', obraTrabalhadorId);
    carregar();
  }

  async function enviarAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setUploading(true);
    const path = `${obraTrabalhadorId}/${Date.now()}-${ficheiro.name}`;
    const { error: uploadError } = await supabase.storage.from('trabalhadores').upload(path, ficheiro);
    if (uploadError) { alert('Erro ao enviar: ' + uploadError.message); setUploading(false); return; }
    const url = supabase.storage.from('trabalhadores').getPublicUrl(path).data.publicUrl;
    await supabase.from('obra_trabalhador_anexos').insert([{ obra_trabalhador_id: obraTrabalhadorId, tipo: tipoAnexo, nome_ficheiro: ficheiro.name, url }]);
    setUploading(false);
    e.target.value = '';
    carregar();
  }

  async function removerAnexo(anexoId: string) {
    if (!confirm('Remover este anexo?')) return;
    await supabase.from('obra_trabalhador_anexos').delete().eq('id', anexoId);
    carregar();
  }

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!ot) return <div className="p-8 text-center text-ink-400 text-sm">Registo não encontrado.</div>;

  const totalQuantidade = entradas.reduce((s, en) => s + en.quantidade, 0);
  const total = ot.tipo_valor === 'fixo' ? ot.valor_unitario : totalQuantidade * ot.valor_unitario;
  const unidade = ot.tipo_valor === 'dia' ? 'dia(s)' : 'h';

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <button onClick={() => router.push(`/admin/obras/${id}`)} className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 mb-4">
        <ArrowLeft size={16} /> Voltar à Obra
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-ink-800">{ot.trabalhadores?.nome}</h2>
          <p className="text-sm text-ink-400">
            {ot.obras?.titulo} · {formatMoney(ot.valor_unitario)}{ot.tipo_valor !== 'fixo' ? `/${ot.tipo_valor === 'hora' ? 'h' : 'dia'}` : ''}
            {' · '}
            <span className={ot.trabalhadores?.regime === 'efetivo' ? 'text-blue-600' : ''}>
              {ot.trabalhadores?.regime === 'efetivo' ? 'Efetivo' : 'Recibo Verde'}
            </span>
          </p>
        </div>
        <span className={`badge ${ot.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {ot.estado === 'pago' ? 'Pago' : 'Pendente'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {ot.estado === 'pendente' ? (
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
            <input type="checkbox" checked={reciboEmitido} onChange={(e) => setReciboEmitido(e.target.checked)} /> Recibo emitido
          </label>
          <button className="btn-primary bg-green-600 hover:bg-green-700 justify-center md:col-span-3">Confirmar Pagamento</button>
        </form>
      )}

      {ot.estado === 'pago' && (
        <div className="card p-4 mb-6 bg-green-50 border-green-100 text-sm text-green-800">
          Pago em {ot.data_pagamento ? new Date(ot.data_pagamento).toLocaleDateString('pt-PT') : '—'} · {ot.metodo_pagamento} · {ot.recibo_emitido ? 'Com recibo' : 'Sem recibo'}
        </div>
      )}

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

      {ot.tipo_valor !== 'fixo' && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-ink-700 mb-4">Registo de {ot.tipo_valor === 'hora' ? 'Horas' : 'Dias'}</h3>

          {entradas.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-400 text-xs uppercase">
                  <tr>
                    <th className="pb-2 font-medium">Data</th>
                    {ot.tipo_valor === 'hora' && <th className="pb-2 font-medium">Entrada</th>}
                    {ot.tipo_valor === 'hora' && <th className="pb-2 font-medium">Saída</th>}
                    <th className="pb-2 font-medium text-right">{unidade}</th>
                    <th className="pb-2 font-medium">Nota</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {entradas.map((en) => (
                    <tr key={en.id}>
                      <td className="py-2 text-ink-800">{new Date(en.data).toLocaleDateString('pt-PT')}</td>
                      {ot.tipo_valor === 'hora' && <td className="py-2 text-ink-500">{en.hora_entrada || '—'}</td>}
                      {ot.tipo_valor === 'hora' && <td className="py-2 text-ink-500">{en.hora_saida || '—'}</td>}
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
            {ot.tipo_valor === 'hora' ? (
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
          {ot.tipo_valor !== 'fixo' && (
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
