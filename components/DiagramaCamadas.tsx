'use client';

import React from 'react';

export type Camada = { label: string; descricao?: string; cor: string };

// Diagrama esquemático em corte — mostra as camadas de uma parede/pintura
// da esquerda (existente) para a direita (acabamento final), como um
// desenho técnico simplificado (não fotorrealista).
export default function DiagramaCamadas({ camadas, titulo }: { camadas: Camada[]; titulo?: string }) {
  if (camadas.length === 0) return null;

  const larguraCamada = 34;
  const alturaBloco = 70;
  const pad = 8;
  const largura = camadas.length * larguraCamada + pad * 2;
  const altura = alturaBloco + 34;

  return (
    <div>
      {titulo && <p className="text-[11px] font-medium text-ink-500 uppercase mb-1.5">{titulo}</p>}
      <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" style={{ maxWidth: largura * 2.2 }}>
        {camadas.map((c, i) => {
          const x = pad + i * larguraCamada;
          return (
            <g key={i}>
              <rect x={x} y={4} width={larguraCamada - 3} height={alturaBloco} fill={c.cor} stroke="#00000018" strokeWidth={1} />
              <circle cx={x + (larguraCamada - 3) / 2} cy={alturaBloco + 18} r={9} fill="#34363c" />
              <text x={x + (larguraCamada - 3) / 2} y={alturaBloco + 21.5} textAnchor="middle" fontSize={9.5} fill="#fff" fontWeight={600}>{i + 1}</text>
            </g>
          );
        })}
      </svg>
      <ol className="text-[11px] text-ink-600 mt-1.5 space-y-0.5">
        {camadas.map((c, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-ink-700 text-white text-[8.5px] font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
            <span><span className="font-medium text-ink-800">{c.label}</span>{c.descricao && <span className="text-ink-400"> — {c.descricao}</span>}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
