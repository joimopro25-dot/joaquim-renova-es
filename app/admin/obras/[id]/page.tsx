'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { formatMoney } from '../../../../lib/format';
import Link from 'next/link';
import { ArrowLeft, Upload, Trash2, ImageOff, UserPlus, HardHat } from 'lucide-react';

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
  const [trabalhadoresDisponiveis, setTrabalhadoresDisponiveis] = useState<Trabalhador[]>([]);
  const [obraTrabalhadores, setObraTrabalhadores] = useState<ObraTrabalhador[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [legenda, setLegenda] = useState('');
  const [showTrabalhadorForm, setShowTrabalhadorForm] = useState(false);
  const [trabalhadorId, setTrabalhadorId] = useState('');
  const [tipoValorTrab, setTipoValorTrab] = useState('dia');
  const [valorUnitarioTrab, setValorUnitarioTrab] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: obraData }, { data: fotosData }, { data: despesasData }, { data: trabData }, { data: obraTrabData }] = await Promise.all([
      supabase.from('obras').select('*, clientes(nome)').eq('id', id).single(),
      supabase.from('fotos_obra').select('*').eq('obra_id', id).order('criado_em', { ascending: false }),
      supabase.from('despesas').select('valor').eq('obra_id', id),
      supabase.from('trabalhadores').select('id, nome, tipo_valor_padrao, valor_padrao').eq('ativo', true).order('nome'),
      supabase.from('obra_trabalhadores').select('*, trabalhadores(nome), obra_trabalhador_entradas(quantidade)').eq('obra_id', id),
    ]);
    setObra(obraData as any);
    setFotos(fotosData || []);
    setTotalDespesas((despesasData || []).reduce((s, d: any) => s + (d.valor || 0), 0));
    setTrabalhadoresDisponiveis(trabData || []);
    setObraTrabalhadores((obraTrabData as any) || []);
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

  if (loading) return <div className="p-8 text-center text-ink-300 text-sm">A carregar...</div>;
  if (!obra) return <div className="p-8 text-center text-ink-400 text-sm">Obra não encontrada.</div>;

  const totalMaoDeObra = obraTrabalhadores.reduce((s, ot) => s + calcularTotalTrabalhador(ot), 0);
  const margem = (obra.valor_total || 0) - totalDespesas - totalMaoDeObra;

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-ink-400 text-sm mb-1">Orçamentado</p>
          <p className="text-xl font-heading font-semibold text-ink-800">{formatMoney(obra.valor_total || 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-ink-400 text-sm mb-1">Despesas/Materiais</p>
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
    </div>
  );
}
