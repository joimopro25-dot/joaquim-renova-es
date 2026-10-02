import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const REMETENTE = 'Projetar Conforto <geral@projetarconforto.pt>';
const DESTINO_CONTABILISTA = 'famescrita@gmail.com';
const CC_EMPRESA = 'projetarconforto@gmail.com';

function csvEscape(v: any): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function paraCsv(linhas: Record<string, any>[], colunas: { chave: string; label: string }[]): string {
  const cabecalho = colunas.map((c) => csvEscape(c.label)).join(',');
  const corpo = linhas.map((l) => colunas.map((c) => csvEscape(l[c.chave])).join(','));
  return [cabecalho, ...corpo].join('\n');
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY não configurada no servidor.' }, { status: 500 });

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: perfil } = await adminClient.from('perfis').select('tipo').eq('id', userData.user.id).single();
  if (perfil?.tipo !== 'admin') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const { mes } = await req.json();
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: 'Mês inválido.' }, { status: 400 });

  const [ano, mesNum] = mes.split('-').map(Number);
  const inicio = `${mes}-01`;
  const fim = new Date(ano, mesNum, 0).toISOString().slice(0, 10);

  const [{ data: despesas }, { data: receitas }, { data: extratos }] = await Promise.all([
    adminClient.from('despesas').select('data_despesa, descricao, categoria, valor, estado_pagamento, obras(titulo), areas_negocio(nome), fornecedores(nome)').gte('data_despesa', inicio).lte('data_despesa', fim).order('data_despesa'),
    adminClient.from('receitas').select('data_receita, descricao, categoria, valor, estado_recebimento, cliente_nome, obras(titulo), areas_negocio(nome)').gte('data_receita', inicio).lte('data_receita', fim).order('data_receita'),
    adminClient.from('extratos_bancarios').select('nome_ficheiro, ficheiro_url').eq('mes', inicio),
  ]);

  const listaDespesas = (despesas as any[]) || [];
  const listaReceitas = (receitas as any[]) || [];
  const listaExtratos = (extratos as any[]) || [];

  const totalDespesas = listaDespesas.reduce((s, d) => s + d.valor, 0);
  const totalReceitas = listaReceitas.reduce((s, r) => s + r.valor, 0);

  const csvDespesas = paraCsv(
    listaDespesas.map((d) => ({
      data: d.data_despesa,
      descricao: d.descricao,
      categoria: d.categoria,
      destino: d.obras?.titulo || d.areas_negocio?.nome || 'Geral',
      fornecedor: d.fornecedores?.nome || '',
      estado: d.estado_pagamento,
      valor: d.valor,
    })),
    [
      { chave: 'data', label: 'Data' },
      { chave: 'descricao', label: 'Descrição' },
      { chave: 'categoria', label: 'Categoria' },
      { chave: 'destino', label: 'Destino' },
      { chave: 'fornecedor', label: 'Fornecedor' },
      { chave: 'estado', label: 'Estado' },
      { chave: 'valor', label: 'Valor' },
    ]
  );

  const csvReceitas = paraCsv(
    listaReceitas.map((r) => ({
      data: r.data_receita,
      descricao: r.descricao,
      categoria: r.categoria,
      origem: r.obras?.titulo || r.areas_negocio?.nome || 'Geral',
      cliente: r.cliente_nome || '',
      estado: r.estado_recebimento,
      valor: r.valor,
    })),
    [
      { chave: 'data', label: 'Data' },
      { chave: 'descricao', label: 'Descrição' },
      { chave: 'categoria', label: 'Categoria' },
      { chave: 'origem', label: 'Origem' },
      { chave: 'cliente', label: 'Cliente' },
      { chave: 'estado', label: 'Estado' },
      { chave: 'valor', label: 'Valor' },
    ]
  );

  const anexos: { filename: string; content: string }[] = [
    { filename: `despesas-${mes}.csv`, content: Buffer.from(csvDespesas).toString('base64') },
    { filename: `receitas-${mes}.csv`, content: Buffer.from(csvReceitas).toString('base64') },
  ];

  for (const ex of listaExtratos) {
    try {
      const resp = await fetch(ex.ficheiro_url);
      const buf = await resp.arrayBuffer();
      anexos.push({ filename: ex.nome_ficheiro, content: Buffer.from(buf).toString('base64') });
    } catch {
      // ignora falha a anexar um extrato individual — não bloqueia o envio dos restantes
    }
  }

  const mesLabel = new Date(ano, mesNum - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const corpoHtml = `
    <h2>Contabilidade — ${mesLabel}</h2>
    <p><b>Total de Despesas:</b> ${totalDespesas.toFixed(2)} € (${listaDespesas.length} registos)</p>
    <p><b>Total de Receitas:</b> ${totalReceitas.toFixed(2)} € (${listaReceitas.length} registos)</p>
    <p>Em anexo: CSV de despesas, CSV de receitas${listaExtratos.length ? `, e ${listaExtratos.length} extrato(s) bancário(s)` : ''}.</p>
    <p style="color:#888;font-size:12px">Gomes de Oliveira & Oliveira, Lda. · NIPC 519645847 · Projetar Conforto</p>
  `;

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REMETENTE,
      to: [DESTINO_CONTABILISTA],
      cc: [CC_EMPRESA],
      subject: `Contabilidade — ${mesLabel}`,
      html: corpoHtml,
      attachments: anexos,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    return NextResponse.json({ error: 'Erro ao enviar: ' + errText }, { status: 502 });
  }

  return NextResponse.json({ status: 'ok' });
}
