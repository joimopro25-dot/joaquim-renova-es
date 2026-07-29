'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { formatMoney } from '../../../../../lib/format';
import { Printer } from 'lucide-react';

type Entrada = {
  id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida: string | null;
  quantidade: number;
  nota: string | null;
};

type Subempreitada = {
  descricao: string;
  tipo_valor: string;
  valor_unitario: number;
  estado: string;
  metodo_pagamento: string | null;
  fatura_emitida: boolean;
  data_pagamento: string | null;
  clientes: { nome: string; nif: string | null } | null;
};

export default function RelatorioSubempreitada() {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<Subempreitada | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [{ data: subData }, { data: entradasData }] = await Promise.all([
        supabase.from('subempreitadas').select('*, clientes(nome, nif)').eq('id', id).single(),
        supabase.from('subempreitada_entradas').select('*').eq('subempreitada_id', id).order('data'),
      ]);
      setSub(subData as any);
      setEntradas(entradasData || []);
      setLoading(false);
    }
    carregar();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!sub) return <div className="p-8 text-center text-ink-400 text-sm">Registo não encontrado.</div>;

  const totalQuantidade = entradas.reduce((s, en) => s + en.quantidade, 0);
  const total = sub.tipo_valor === 'fixo' ? sub.valor_unitario : totalQuantidade * sub.valor_unitario;
  const unidade = sub.tipo_valor === 'dia' ? 'dia(s)' : 'horas';

  return (
    <div className="max-w-2xl mx-auto p-8 print:p-0 bg-white">
      <button onClick={() => window.print()} className="btn-primary mb-8 print:hidden">
        <Printer size={16} /> Imprimir / Guardar PDF
      </button>

      <div className="border-b-2 border-ink-800 pb-4 mb-6">
        <h1 className="text-2xl font-heading font-bold text-ink-800">Projetar Conforto</h1>
        <p className="text-sm text-ink-500">Relatório de trabalho para pagamento</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-ink-400 uppercase text-xs tracking-wide">A pagar por</p>
          <p className="text-ink-800 font-medium">{sub.clientes?.nome || '—'}</p>
          {sub.clientes?.nif && <p className="text-ink-500">NIF: {sub.clientes.nif}</p>}
        </div>
        <div>
          <p className="text-ink-400 uppercase text-xs tracking-wide">Data do relatório</p>
          <p className="text-ink-800">{new Date().toLocaleDateString('pt-PT')}</p>
        </div>
      </div>

      <h2 className="font-semibold text-ink-800 mb-2">{sub.descricao}</h2>

      {sub.tipo_valor !== 'fixo' && entradas.length > 0 && (
        <table className="w-full text-left text-sm mb-4 border border-sand-200">
          <thead className="bg-sand-50 text-ink-500">
            <tr>
              <th className="p-2 border-b border-sand-200">Data</th>
              {sub.tipo_valor === 'hora' && <th className="p-2 border-b border-sand-200">Entrada</th>}
              {sub.tipo_valor === 'hora' && <th className="p-2 border-b border-sand-200">Saída</th>}
              <th className="p-2 border-b border-sand-200 text-right">{sub.tipo_valor === 'hora' ? 'Horas' : 'Dias'}</th>
              <th className="p-2 border-b border-sand-200">Nota</th>
            </tr>
          </thead>
          <tbody>
            {entradas.map((en) => (
              <tr key={en.id} className="border-b border-sand-100">
                <td className="p-2">{new Date(en.data).toLocaleDateString('pt-PT')}</td>
                {sub.tipo_valor === 'hora' && <td className="p-2">{en.hora_entrada || '—'}</td>}
                {sub.tipo_valor === 'hora' && <td className="p-2">{en.hora_saida || '—'}</td>}
                <td className="p-2 text-right">{en.quantidade}</td>
                <td className="p-2 text-ink-500">{en.nota || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex justify-end mb-8">
        <div className="w-64 text-sm space-y-1">
          {sub.tipo_valor !== 'fixo' && (
            <div className="flex justify-between">
              <span className="text-ink-500">Total {unidade}</span>
              <span>{totalQuantidade} {sub.tipo_valor === 'hora' ? 'h' : ''}</span>
            </div>
          )}
          {sub.tipo_valor !== 'fixo' && (
            <div className="flex justify-between">
              <span className="text-ink-500">Valor por {sub.tipo_valor === 'hora' ? 'hora' : 'dia'}</span>
              <span>{formatMoney(sub.valor_unitario)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1 border-t border-ink-800">
            <span>Total a Pagar</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="border border-sand-200 rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium text-ink-700">Pagamento</p>
        {sub.estado === 'pago' ? (
          <>
            <p>Pago em {sub.data_pagamento ? new Date(sub.data_pagamento).toLocaleDateString('pt-PT') : '—'}, por {sub.metodo_pagamento}.</p>
            <p>{sub.fatura_emitida ? 'Fatura/recibo emitido.' : 'Sem fatura/recibo emitido.'}</p>
          </>
        ) : (
          <>
            <p>☐ Dinheiro &nbsp; ☐ Transferência &nbsp; ☐ MB WAY &nbsp; ☐ Cheque &nbsp; ☐ Outro</p>
            <p>☐ Com fatura/recibo &nbsp; ☐ Sem fatura/recibo</p>
            <p className="text-ink-400 mt-2">Data: _____ / _____ / _______ &nbsp;&nbsp; Assinatura: _______________________</p>
          </>
        )}
      </div>
    </div>
  );
}
