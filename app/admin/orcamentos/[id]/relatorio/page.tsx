'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { formatMoney } from '../../../../../lib/format';
import { calcularTotaisSeguro } from '../../../../../lib/orcamento';
import { Printer } from 'lucide-react';

type Linha = {
  id: string;
  descricao: string;
  capitulo: string;
  unidade: string;
  quantidade: number;
  tipo_linha: string;
  preco_unitario_final: number;
  preco_total: number;
};

type Foto = { id: string; url: string; legenda: string | null };

type Orcamento = {
  titulo: string;
  descricao: string | null;
  margem_percentagem: number;
  iva_material_percentagem: number;
  iva_mao_obra_percentagem: number;
  iva_subcontratado_percentagem: number;
  criado_em: string;
  clientes: { nome: string; nif: string | null; morada: string | null } | null;
};

const SECCOES: { tipo: string; label: string }[] = [
  { tipo: 'material', label: 'Material' },
  { tipo: 'mao_obra', label: 'Mão de Obra' },
  { tipo: 'subcontratada', label: 'Especialidades Subcontratadas' },
];

export default function RelatorioOrcamento() {
  const { id } = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [{ data: orc }, { data: linhasData }, { data: fotosData }] = await Promise.all([
        supabase.from('orcamentos').select('titulo, descricao, margem_percentagem, iva_material_percentagem, iva_mao_obra_percentagem, iva_subcontratado_percentagem, criado_em, clientes(nome, nif, morada)').eq('id', id).single(),
        supabase.from('orcamento_linhas_cliente').select('*').eq('orcamento_id', id).order('criado_em'),
        supabase.from('orcamento_fotos').select('id, url, legenda').eq('orcamento_id', id).order('criado_em', { ascending: false }),
      ]);
      setOrcamento(orc as any);
      setLinhas(linhasData || []);
      setFotos(fotosData || []);
      setLoading(false);
    }
    carregar();
  }, [id]);

  const linhasPorSeccao = useMemo(() => {
    const grupos: Record<string, Linha[]> = {};
    for (const l of linhas) (grupos[l.tipo_linha] ||= []).push(l);
    return grupos;
  }, [linhas]);

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!orcamento) return <div className="p-8 text-center text-ink-400 text-sm">Orçamento não encontrado.</div>;

  const totais = calcularTotaisSeguro(linhas, orcamento);

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-0 bg-white">
      <button onClick={() => window.print()} className="btn-primary mb-8 print:hidden">
        <Printer size={16} /> Imprimir / Guardar PDF
      </button>

      <div className="border-b-2 border-ink-800 pb-4 mb-6">
        <h1 className="text-2xl font-heading font-bold text-ink-800">Projetar Conforto</h1>
        <p className="text-sm text-ink-500">Orçamento de obra</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-ink-400 uppercase text-xs tracking-wide">Cliente</p>
          <p className="text-ink-800 font-medium">{orcamento.clientes?.nome || '—'}</p>
          {orcamento.clientes?.nif && <p className="text-ink-500">NIF: {orcamento.clientes.nif}</p>}
          {orcamento.clientes?.morada && <p className="text-ink-500">{orcamento.clientes.morada}</p>}
        </div>
        <div>
          <p className="text-ink-400 uppercase text-xs tracking-wide">Data</p>
          <p className="text-ink-800">{new Date(orcamento.criado_em).toLocaleDateString('pt-PT')}</p>
        </div>
      </div>

      <h2 className="font-semibold text-ink-800 mb-1">{orcamento.titulo}</h2>
      {orcamento.descricao && <p className="text-sm text-ink-500 mb-4">{orcamento.descricao}</p>}

      <div className="space-y-6 mb-6">
        {SECCOES.map(({ tipo, label }) => {
          const itens = linhasPorSeccao[tipo] || [];
          if (itens.length === 0) return null;
          const subtotalSec = itens.reduce((s, l) => s + l.preco_total, 0);
          return (
            <div key={tipo}>
              <div className="bg-ink-800 text-white text-sm font-semibold px-3 py-1.5 rounded-t-lg">{label}</div>
              <table className="w-full text-left text-sm border border-t-0 border-sand-200 rounded-b-lg overflow-hidden">
                <thead className="bg-sand-50 text-ink-500">
                  <tr>
                    <th className="p-2 border-b border-sand-200">Descrição</th>
                    <th className="p-2 border-b border-sand-200 text-right">Un</th>
                    <th className="p-2 border-b border-sand-200 text-right">Qtd</th>
                    <th className="p-2 border-b border-sand-200 text-right">Preço Un.</th>
                    <th className="p-2 border-b border-sand-200 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((l) => (
                    <tr key={l.id} className="border-b border-sand-100">
                      <td className="p-2">{l.descricao}</td>
                      <td className="p-2 text-right text-ink-500">{l.unidade}</td>
                      <td className="p-2 text-right text-ink-500">{l.quantidade}</td>
                      <td className="p-2 text-right text-ink-500">{formatMoney(l.preco_unitario_final)}</td>
                      <td className="p-2 text-right font-medium">{formatMoney(l.preco_total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-sand-50 font-medium">
                    <td colSpan={4} className="p-2 text-right text-ink-600">Subtotal {label}</td>
                    <td className="p-2 text-right">{formatMoney(subtotalSec)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-64 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-ink-500">Total dos Trabalhos</span><span>{formatMoney(totais.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">Imprevistos ({orcamento.margem_percentagem}%)</span><span>{formatMoney(totais.imprevistos)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">IVA</span><span>{formatMoney(totais.iva)}</span></div>
          <div className="flex justify-between font-semibold text-base pt-1 border-t border-ink-800">
            <span>Total com IVA</span>
            <span>{formatMoney(totais.total)}</span>
          </div>
        </div>
      </div>

      {fotos.length > 0 && (
        <div className="mb-8 break-inside-avoid">
          <h3 className="font-semibold text-ink-800 mb-3 text-sm uppercase tracking-wide">Fotos</h3>
          <div className="grid grid-cols-2 gap-3">
            {fotos.map((f) => (
              <div key={f.id} className="break-inside-avoid">
                <img src={f.url} alt={f.legenda || ''} className="w-full aspect-[4/3] object-cover rounded-lg border border-sand-200" />
                {f.legenda && <p className="text-xs text-ink-500 mt-1">{f.legenda}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-ink-400 border-t border-sand-200 pt-4">
        <p>Orçamento válido por 30 dias. Condições de pagamento a combinar.</p>
        <p className="mt-4">Assinatura do cliente: _______________________ &nbsp;&nbsp; Data: _____ / _____ / _______</p>
      </div>
    </div>
  );
}
