'use client';

import React, { useRef, useState } from 'react';
import { EspacoConfig, ParedeConfig, TetoConfig, FocoLedPosicao, LadoParede } from '../lib/pladur';
import { Lightbulb } from 'lucide-react';

function gerarId() {
  return Math.random().toString(36).slice(2);
}

const LABEL_LADO: Record<LadoParede, string> = { norte: 'Norte', sul: 'Sul', este: 'Este', oeste: 'Oeste' };

const CANVAS_W = 340;
const CANVAS_H = 260;
const PAD = 30;

export default function PlantaPladur({
  espaco,
  paredes,
  teto,
  editarFocos = false,
  onTetoChange,
}: {
  espaco: EspacoConfig;
  paredes: ParedeConfig[];
  teto: TetoConfig;
  editarFocos?: boolean;
  onTetoChange?: (teto: TetoConfig) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [aArrastar, setAArrastar] = useState<string | null>(null);
  const moveuRef = useRef(false);

  if (espaco.comprimento <= 0 || espaco.largura <= 0) {
    return <p className="text-xs text-ink-400">Preenche as medidas do espaço para veres a planta.</p>;
  }

  const larguraDisp = CANVAS_W - PAD * 2;
  const alturaDisp = CANVAS_H - PAD * 2;
  const escala = Math.min(larguraDisp / espaco.comprimento, alturaDisp / espaco.largura);
  const retLargura = espaco.comprimento * escala;
  const retAltura = espaco.largura * escala;
  const offsetX = PAD + (larguraDisp - retLargura) / 2;
  const offsetY = PAD + (alturaDisp - retAltura) / 2;

  function pxParaM(px: number, py: number): { x: number; y: number } {
    return {
      x: Math.min(Math.max((px - offsetX) / escala, 0), espaco.comprimento),
      y: Math.min(Math.max((py - offsetY) / escala, 0), espaco.largura),
    };
  }

  function coordsDoEvento(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const py = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { px, py };
  }

  function handlePointerDownFundo(e: React.PointerEvent<SVGSVGElement>) {
    if (!editarFocos || !onTetoChange) return;
    moveuRef.current = false;
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!aArrastar || !onTetoChange) return;
    moveuRef.current = true;
    const { px, py } = coordsDoEvento(e);
    const { x, y } = pxParaM(px, py);
    onTetoChange({
      ...teto,
      focosLedPosicoes: teto.focosLedPosicoes.map((f) => (f.id === aArrastar ? { ...f, x, y } : f)),
    });
  }

  function handlePointerUpFoco(id: string) {
    if (!moveuRef.current) {
      // clique sem arrastar num foco existente = remover
      onTetoChange?.({ ...teto, focosLedPosicoes: teto.focosLedPosicoes.filter((f) => f.id !== id) });
    }
    setAArrastar(null);
  }

  function handleClickFundo(e: React.PointerEvent<SVGSVGElement>) {
    if (!editarFocos || !onTetoChange || moveuRef.current) return;
    const { px, py } = coordsDoEvento(e);
    if (px < offsetX || px > offsetX + retLargura || py < offsetY || py > offsetY + retAltura) return;
    const { x, y } = pxParaM(px, py);
    onTetoChange({ ...teto, focosLedPosicoes: [...teto.focosLedPosicoes, { id: gerarId(), x, y }] });
  }

  // Desenha uma parede perimetral com as suas aberturas.
  function desenharParede(lado: LadoParede) {
    const p = paredes.find((pw) => pw.lado === lado);
    const comprimentoLado = lado === 'norte' || lado === 'sul' ? espaco.comprimento : espaco.largura;
    const elementos: React.ReactNode[] = [];

    let x1: number, y1: number, x2: number, y2: number;
    if (lado === 'norte') { x1 = offsetX; y1 = offsetY; x2 = offsetX + retLargura; y2 = offsetY; }
    else if (lado === 'sul') { x1 = offsetX; y1 = offsetY + retAltura; x2 = offsetX + retLargura; y2 = offsetY + retAltura; }
    else if (lado === 'oeste') { x1 = offsetX; y1 = offsetY; x2 = offsetX; y2 = offsetY + retAltura; }
    else { x1 = offsetX + retLargura; y1 = offsetY; x2 = offsetX + retLargura; y2 = offsetY + retAltura; }

    const corParede = p ? '#b45309' : '#c2a878';
    const espessura = p ? 4 : 2;

    if (!p || p.aberturas.length === 0) {
      elementos.push(<line key={`${lado}-full`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={corParede} strokeWidth={espessura} />);
    } else {
      const horizontal = lado === 'norte' || lado === 'sul';
      let cursor = 0;
      const aberturasOrdenadas = [...p.aberturas].sort((a, b) => a.posicaoM - b.posicaoM);
      for (const ab of aberturasOrdenadas) {
        const inicio = Math.max(0, Math.min(ab.posicaoM, comprimentoLado));
        const fim = Math.max(inicio, Math.min(ab.posicaoM + ab.larguraM, comprimentoLado));
        if (inicio > cursor) {
          const a = cursor / comprimentoLado, b = inicio / comprimentoLado;
          elementos.push(<line key={`${lado}-seg-${cursor}`}
            x1={horizontal ? x1 + (x2 - x1) * a : x1} y1={horizontal ? y1 : y1 + (y2 - y1) * a}
            x2={horizontal ? x1 + (x2 - x1) * b : x1} y2={horizontal ? y1 : y1 + (y2 - y1) * b}
            stroke={corParede} strokeWidth={espessura} />);
        }
        const a = inicio / comprimentoLado, b = fim / comprimentoLado;
        elementos.push(<line key={`${lado}-ab-${ab.id}`}
          x1={horizontal ? x1 + (x2 - x1) * a : x1} y1={horizontal ? y1 : y1 + (y2 - y1) * a}
          x2={horizontal ? x1 + (x2 - x1) * b : x1} y2={horizontal ? y1 : y1 + (y2 - y1) * b}
          stroke={ab.tipo === 'porta' ? '#7c3aed' : '#0ea5e9'} strokeWidth={espessura + 2} strokeLinecap="round" />);
        cursor = fim;
      }
      if (cursor < comprimentoLado) {
        const a = cursor / comprimentoLado;
        elementos.push(<line key={`${lado}-seg-end`}
          x1={horizontal ? x1 + (x2 - x1) * a : x1} y1={horizontal ? y1 : y1 + (y2 - y1) * a}
          x2={x2} y2={y2} stroke={corParede} strokeWidth={espessura} />);
      }
    }
    return elementos;
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width="100%"
        style={{ maxWidth: CANVAS_W, touchAction: 'none' }}
        onPointerDown={handlePointerDownFundo}
        onPointerMove={handlePointerMove}
        onPointerUp={handleClickFundo}
        className={editarFocos ? 'cursor-crosshair' : ''}
      >
        <rect x={offsetX} y={offsetY} width={retLargura} height={retAltura} fill="#fff" />
        {(['norte', 'sul', 'este', 'oeste'] as LadoParede[]).map((lado) => desenharParede(lado))}

        <text x={offsetX + retLargura / 2} y={offsetY - 8} textAnchor="middle" fontSize={10} className="fill-ink-500">{espaco.comprimento.toFixed(2)} m</text>
        <text x={offsetX - 8} y={offsetY + retAltura / 2} textAnchor="middle" fontSize={10} className="fill-ink-500" transform={`rotate(-90, ${offsetX - 8}, ${offsetY + retAltura / 2})`}>{espaco.largura.toFixed(2)} m</text>

        {teto.focosLedPosicoes.map((f) => {
          const cx = offsetX + f.x * escala;
          const cy = offsetY + f.y * escala;
          return (
            <g key={f.id}
              onPointerDown={(e) => { e.stopPropagation(); moveuRef.current = false; setAArrastar(f.id); }}
              onPointerUp={(e) => { e.stopPropagation(); handlePointerUpFoco(f.id); }}
              style={{ cursor: editarFocos ? 'grab' : 'default' }}
            >
              <circle cx={cx} cy={cy} r={7} fill="#fbbf24" stroke="#b45309" strokeWidth={1} />
            </g>
          );
        })}
      </svg>

      {editarFocos && (
        <p className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-1">
          <Lightbulb size={12} /> Clica na planta para colocar um foco LED; clica num foco para o remover; arrasta para o mover.
        </p>
      )}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-ink-400">
        <span className="flex items-center gap-1"><span className="w-3 h-1 bg-[#b45309] inline-block" /> Parede definida</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 bg-[#7c3aed] inline-block" /> Porta</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 bg-[#0ea5e9] inline-block" /> Janela</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] border border-[#b45309] inline-block" /> Foco LED</span>
      </div>
    </div>
  );
}
