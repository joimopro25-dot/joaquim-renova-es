'use client';

import React from 'react';
import { formatMoney } from '../lib/format';

// Escolhas do utilizador dentro de um orçamento: por família/chave (ex:
// "placa_normal", "fita_led"), qual o artigo comercial concreto a usar.
export type Variantes = Record<string, string>;

type ArtigoBase = { id: string; chave: string; descricao: string; preco: number };

// Substitui, na tabela de preços já reduzida a "um por chave" (a usada no
// cálculo), os artigos que o utilizador escolheu explicitamente nesta
// simulação — as restantes chaves mantêm o artigo predefinido.
export function aplicarVariantes<T extends ArtigoBase>(base: Record<string, T>, todos: T[], escolhas: Variantes): Record<string, T> {
  const resultado = { ...base };
  for (const [chave, id] of Object.entries(escolhas)) {
    const item = todos.find((p) => p.chave === chave && p.id === id);
    if (item) resultado[chave] = item;
  }
  return resultado;
}

export function SeletorVariante({
  chave,
  todos,
  escolhas,
  onEscolher,
}: {
  chave: string;
  todos: ArtigoBase[];
  escolhas: Variantes;
  onEscolher: (chave: string, id: string) => void;
}) {
  const opcoes = todos.filter((p) => p.chave === chave);
  if (opcoes.length <= 1) return null;
  const atual = escolhas[chave] || opcoes[0].id;
  return (
    <select
      value={atual}
      onChange={(e) => onEscolher(chave, e.target.value)}
      className="mt-1 w-full max-w-xs bg-transparent border-0 border-b border-dashed border-ink-200 text-[11px] text-ink-400 py-0.5 focus:outline-none focus:border-brand-400 cursor-pointer"
      title="Trocar o artigo/loja usado nesta linha"
    >
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>{o.descricao} — {formatMoney(o.preco)}</option>
      ))}
    </select>
  );
}
