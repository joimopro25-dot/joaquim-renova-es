import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const REMETENTE = 'Projetar Conforto <geral@projetarconforto.pt>';
const DESTINATARIO = 'olijack84@gmail.com';
const DIAS_LIMITE = 14;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!serviceRoleKey || !resendKey) {
    return NextResponse.json({ error: 'Variáveis de ambiente em falta no servidor.' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_LIMITE);
  const limiteISO = limite.toISOString();

  const [{ data: subs }, { data: trabs }] = await Promise.all([
    supabase.from('subempreitadas').select('descricao, criado_em, clientes(nome)').eq('estado', 'pendente').lt('criado_em', limiteISO),
    supabase.from('obra_trabalhadores').select('criado_em, trabalhadores(nome), obras(titulo), subempreitadas(descricao)').eq('estado', 'pendente').lt('criado_em', limiteISO),
  ]);

  const linhasSubs = (subs || []).map((s: any) =>
    `<li>Subempreitada "${s.descricao}" (${s.clientes?.nome || '—'}) — pendente desde ${new Date(s.criado_em).toLocaleDateString('pt-PT')}</li>`
  );
  const linhasTrabs = (trabs || []).map((t: any) =>
    `<li>Trabalhador ${t.trabalhadores?.nome || '—'} em ${t.obras?.titulo || t.subempreitadas?.descricao || '—'} — pendente desde ${new Date(t.criado_em).toLocaleDateString('pt-PT')}</li>`
  );

  if (linhasSubs.length === 0 && linhasTrabs.length === 0) {
    return NextResponse.json({ status: 'ok', pendentes: 0 });
  }

  const corpoHtml = `
    <p>Pagamentos pendentes há mais de ${DIAS_LIMITE} dias:</p>
    ${linhasSubs.length ? `<p><strong>Subempreitadas</strong></p><ul>${linhasSubs.join('')}</ul>` : ''}
    ${linhasTrabs.length ? `<p><strong>Trabalhadores</strong></p><ul>${linhasTrabs.join('')}</ul>` : ''}
  `;

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REMETENTE,
      to: [DESTINATARIO],
      subject: `Pagamentos em atraso (${linhasSubs.length + linhasTrabs.length})`,
      html: corpoHtml,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    return NextResponse.json({ error: 'Erro ao enviar: ' + errText }, { status: 502 });
  }

  return NextResponse.json({ status: 'ok', pendentes: linhasSubs.length + linhasTrabs.length });
}
