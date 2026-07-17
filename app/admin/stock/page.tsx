'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/format';
import { Plus, Wrench, Package, Trash2, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from 'lucide-react';

type Ferramenta = {
  id: string;
  nome: string;
  codigo_interno: string | null;
  marca_modelo: string | null;
  estado: string;
  localizacao: string | null;
  atribuida_a: string | null;
};

type Material = {
  id: string;
  nome: string;
  unidade: string;
  stock_atual: number;
  stock_minimo: number;
  fornecedor_habitual: string | null;
  custo_medio: number;
};

type Obra = { id: string; titulo: string };

const ESTADOS_FERRAMENTA = [
  { value: 'disponivel', label: 'Disponível', color: 'bg-green-100 text-green-700' },
  { value: 'em_uso', label: 'Em Uso', color: 'bg-blue-100 text-blue-700' },
  { value: 'manutencao', label: 'Manutenção', color: 'bg-amber-100 text-amber-700' },
  { value: 'avariada', label: 'Avariada', color: 'bg-red-100 text-red-700' },
];

export default function StockPage() {
  const [tab, setTab] = useState<'ferramentas' | 'materiais'>('ferramentas');

  return (
    <div className="p-4 md:p-8">
      <div className="flex gap-2 mb-6 border-b border-sand-200">
        <button
          onClick={() => setTab('ferramentas')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'ferramentas' ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-400 hover:text-ink-700'}`}
        >
          <Wrench size={16} /> Ferramentas
        </button>
        <button
          onClick={() => setTab('materiais')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'materiais' ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-400 hover:text-ink-700'}`}
        >
          <Package size={16} /> Materiais
        </button>
      </div>

      {tab === 'ferramentas' ? <FerramentasTab /> : <MateriaisTab />}
    </div>
  );
}

function FerramentasTab() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [nome, setNome] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [atribuidaA, setAtribuidaA] = useState('');

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('ferramentas').select('*').order('nome');
    setFerramentas(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('ferramentas').insert([{
      nome, codigo_interno: codigoInterno || null, marca_modelo: marcaModelo || null,
      localizacao: localizacao || null, atribuida_a: atribuidaA || null,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setNome(''); setCodigoInterno(''); setMarcaModelo(''); setLocalizacao(''); setAtribuidaA('');
    setShowForm(false);
    carregar();
  }

  async function mudarEstado(id: string, estado: string) {
    await supabase.from('ferramentas').update({ estado }).eq('id', id);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover esta ferramenta?')) return;
    await supabase.from('ferramentas').delete().eq('id', id);
    carregar();
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{ferramentas.length} ferramenta{ferramentas.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Nova Ferramenta
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Nova Ferramenta</h2>
          <form onSubmit={adicionar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Nome (ex: Berbequim Bosch)" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
            <input type="text" placeholder="Código interno" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} className="input" />
            <input type="text" placeholder="Marca / Modelo" value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} className="input" />
            <input type="text" placeholder="Localização" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} className="input" />
            <input type="text" placeholder="Atribuída a" value={atribuidaA} onChange={(e) => setAtribuidaA(e.target.value)} className="input" />
            <button className="btn-primary justify-center">Adicionar</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Ferramenta</th>
                <th className="p-4 font-medium">Marca/Modelo</th>
                <th className="p-4 font-medium">Localização</th>
                <th className="p-4 font-medium">Atribuída a</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : ferramentas.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-ink-400 text-sm"><Wrench size={28} className="mx-auto mb-2 text-ink-200" />Nenhuma ferramenta registada.</td></tr>
              ) : (
                ferramentas.map((f) => (
                  <tr key={f.id} className="hover:bg-sand-50 transition-colors">
                    <td className="p-4 font-medium text-ink-800">{f.nome}{f.codigo_interno && <span className="text-ink-300 font-normal"> · {f.codigo_interno}</span>}</td>
                    <td className="p-4 text-ink-500">{f.marca_modelo || '—'}</td>
                    <td className="p-4 text-ink-500">{f.localizacao || '—'}</td>
                    <td className="p-4 text-ink-500">{f.atribuida_a || '—'}</td>
                    <td className="p-4">
                      <select
                        value={f.estado}
                        onChange={(e) => mudarEstado(f.id, e.target.value)}
                        className={`badge border-0 outline-none cursor-pointer ${ESTADOS_FERRAMENTA.find((e) => e.value === f.estado)?.color}`}
                      >
                        {ESTADOS_FERRAMENTA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => remover(f.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MateriaisTab() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [movimentoAberto, setMovimentoAberto] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [stockAtual, setStockAtual] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('0');
  const [fornecedor, setFornecedor] = useState('');
  const [custoMedio, setCustoMedio] = useState('');

  const [tipoMovimento, setTipoMovimento] = useState('entrada');
  const [quantidadeMovimento, setQuantidadeMovimento] = useState('');
  const [obraMovimento, setObraMovimento] = useState('');

  async function carregar() {
    setLoading(true);
    const [{ data: materiaisData }, { data: obrasData }] = await Promise.all([
      supabase.from('materiais').select('*').order('nome'),
      supabase.from('obras').select('id, titulo').order('titulo'),
    ]);
    setMateriais(materiaisData || []);
    setObras(obrasData || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('materiais').insert([{
      nome, unidade, stock_atual: parseFloat(stockAtual) || 0, stock_minimo: parseFloat(stockMinimo) || 0,
      fornecedor_habitual: fornecedor || null, custo_medio: parseFloat(custoMedio) || 0,
    }]);
    if (error) { alert('Erro: ' + error.message); return; }
    setNome(''); setUnidade('un'); setStockAtual('0'); setStockMinimo('0'); setFornecedor(''); setCustoMedio('');
    setShowForm(false);
    carregar();
  }

  async function remover(id: string) {
    if (!confirm('Remover este material?')) return;
    await supabase.from('materiais').delete().eq('id', id);
    carregar();
  }

  async function registarMovimento(e: React.FormEvent, material: Material) {
    e.preventDefault();
    const qtd = parseFloat(quantidadeMovimento) || 0;
    if (qtd <= 0) return;
    const { error: movError } = await supabase.from('movimentos_stock').insert([{
      material_id: material.id,
      obra_id: obraMovimento || null,
      tipo: tipoMovimento,
      quantidade: qtd,
    }]);
    if (movError) { alert('Erro: ' + movError.message); return; }
    const novoStock = tipoMovimento === 'entrada' ? material.stock_atual + qtd : material.stock_atual - qtd;
    await supabase.from('materiais').update({ stock_atual: novoStock }).eq('id', material.id);
    setQuantidadeMovimento(''); setObraMovimento(''); setTipoMovimento('entrada');
    setMovimentoAberto(null);
    carregar();
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink-400">{materiais.length} material{materiais.length !== 1 ? 'is' : ''}</p>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus size={18} /> Novo Material
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 text-ink-700">Novo Material</h2>
          <form onSubmit={adicionar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Nome (ex: Cimento)" value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
            <input type="text" placeholder="Unidade (un, m2, saco, litro...)" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Stock inicial" value={stockAtual} onChange={(e) => setStockAtual(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Stock mínimo" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} className="input" />
            <input type="text" placeholder="Fornecedor habitual" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="input" />
            <input type="number" step="0.01" placeholder="Custo médio (€)" value={custoMedio} onChange={(e) => setCustoMedio(e.target.value)} className="input" />
            <button className="btn-primary justify-center md:col-span-3">Adicionar</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-sand-50 text-ink-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-4 font-medium">Material</th>
                <th className="p-4 font-medium">Stock</th>
                <th className="p-4 font-medium">Fornecedor</th>
                <th className="p-4 font-medium">Custo médio</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-ink-300 text-sm">A carregar...</td></tr>
              ) : materiais.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-ink-400 text-sm"><Package size={28} className="mx-auto mb-2 text-ink-200" />Nenhum material registado.</td></tr>
              ) : (
                materiais.map((m) => {
                  const baixo = m.stock_atual <= m.stock_minimo;
                  return (
                    <React.Fragment key={m.id}>
                      <tr className="hover:bg-sand-50 transition-colors">
                        <td className="p-4 font-medium text-ink-800">{m.nome}</td>
                        <td className="p-4">
                          <span className={`flex items-center gap-1.5 ${baixo ? 'text-red-600 font-medium' : 'text-ink-600'}`}>
                            {baixo && <AlertTriangle size={14} />}
                            {m.stock_atual} {m.unidade} {baixo && <span className="text-xs">(mín. {m.stock_minimo})</span>}
                          </span>
                        </td>
                        <td className="p-4 text-ink-500">{m.fornecedor_habitual || '—'}</td>
                        <td className="p-4 text-ink-500">{m.custo_medio ? formatMoney(m.custo_medio) : '—'}</td>
                        <td className="p-4 text-right flex items-center justify-end gap-3">
                          <button onClick={() => setMovimentoAberto(movimentoAberto === m.id ? null : m.id)} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                            Movimento
                          </button>
                          <button onClick={() => remover(m.id)} className="text-ink-300 hover:text-red-600"><Trash2 size={15} /></button>
                        </td>
                      </tr>
                      {movimentoAberto === m.id && (
                        <tr>
                          <td colSpan={5} className="p-4 bg-sand-50">
                            <form onSubmit={(e) => registarMovimento(e, m)} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                              <select value={tipoMovimento} onChange={(e) => setTipoMovimento(e.target.value)} className="input">
                                <option value="entrada">Entrada</option>
                                <option value="saida">Saída</option>
                              </select>
                              <input type="number" step="0.01" placeholder={`Quantidade (${m.unidade})`} value={quantidadeMovimento} onChange={(e) => setQuantidadeMovimento(e.target.value)} className="input" required />
                              <select value={obraMovimento} onChange={(e) => setObraMovimento(e.target.value)} className="input">
                                <option value="">Sem obra associada</option>
                                {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                              </select>
                              <button className="btn-primary justify-center">
                                {tipoMovimento === 'entrada' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />} Registar
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
