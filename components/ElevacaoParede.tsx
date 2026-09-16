'use client';

import React from 'react';
import { EspacoConfig, ParedeConfig, LadoParede } from '../lib/pladur';
import { Tv } from 'lucide-react';

const LABEL_LADO: Record<LadoParede, string> = { norte: 'Norte', sul: 'Sul', este: 'Este', oeste: 'Oeste' };

const CANVAS_W = 260;
const CANVAS_H = 160;
const PAD_X = 20;
const PAD_Y = 24;

// Vista de frente (elevação) de uma única parede — mostra a largura real,
// o pé-direito, e cada porta/janela na posição e altura corretas (as
// janelas usam o peitoril; as portas partem sempre do chão).
export default function ElevacaoParede({ espaco, parede }: { espaco: EspacoConfig; parede: ParedeConfig }) {
  if (parede.larguraM <= 0 || espaco.peDireito <= 0) return null;

  const larguraDisp = CANVAS_W - PAD_X * 2;
  const alturaDisp = CANVAS_H - PAD_Y * 2;
  const escala = Math.min(larguraDisp / parede.larguraM, alturaDisp / espaco.peDireito);
  const retLargura = parede.larguraM * escala;
  const retAltura = espaco.peDireito * escala;
  const offsetX = PAD_X + (larguraDisp - retLargura) / 2;
  const offsetY = PAD_Y + (alturaDisp - retAltura) / 2;
  const chaoY = offsetY + retAltura;

  // A posição das aberturas é guardada "desde o início da parede" tal como
  // aparece na planta de cima — mas ao ver a parede de frente (de dentro do
  // espaço), o lado esquerdo/direito inverte-se para Sul e Oeste (é o
  // mesmo efeito de olhar para trás vs. olhar em frente no mapa).
  const inverter = parede.lado === 'sul' || parede.lado === 'oeste';

  return (
    <div>
      <p className="text-[11px] text-ink-500 mb-1 text-center">
        {parede.lado ? LABEL_LADO[parede.lado] : 'Parede'} — {parede.larguraM.toFixed(2)} × {espaco.peDireito.toFixed(2)} m
      </p>
      <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} width="100%" style={{ maxWidth: CANVAS_W }}>
        <rect x={offsetX} y={offsetY} width={retLargura} height={retAltura} fill="#fdfaf5" stroke="#b45309" strokeWidth={2} />

        {parede.aberturas.map((a) => {
          const alturaChao = a.tipo === 'porta' ? 0 : (a.alturaPeitoril ?? 1);
          const larguraPx = Math.min(a.larguraM, parede.larguraM) * escala;
          const alturaPx = Math.min(a.alturaM, espaco.peDireito - alturaChao) * escala;
          const posicaoBase = Math.max(0, Math.min(a.posicaoM, parede.larguraM - a.larguraM));
          const posicaoVista = inverter ? parede.larguraM - posicaoBase - a.larguraM : posicaoBase;
          const x = offsetX + posicaoVista * escala;
          const y = chaoY - alturaChao * escala - alturaPx;
          const cor = a.tipo === 'porta' ? '#7c3aed' : '#0ea5e9';
          return (
            <rect key={a.id} x={x} y={y} width={larguraPx} height={alturaPx} fill={cor} fillOpacity={0.18} stroke={cor} strokeWidth={1.5} />
          );
        })}

        {parede.temTv && (
          <g transform={`translate(${offsetX + retLargura / 2 - 8}, ${offsetY + retAltura * 0.32})`}>
            <rect x={0} y={0} width={16} height={11} rx={1.5} fill="#43454d" />
          </g>
        )}

        <line x1={offsetX} y1={chaoY + 4} x2={offsetX + retLargura} y2={chaoY + 4} stroke="#c9cacd" strokeWidth={1} />
        <text x={offsetX + retLargura / 2} y={chaoY + 14} textAnchor="middle" fontSize={9} className="fill-ink-400">chão</text>
      </svg>
      {parede.temTv && (
        <p className="text-[10px] text-ink-400 mt-1 flex items-center justify-center gap-1"><Tv size={11} /> Reforço + ponto TV</p>
      )}
    </div>
  );
}
