import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const REMETENTE = 'Projetar Conforto <geral@projetarconforto.pt>';

// Chamada pelo formulário público logo após criar um lead — não exige
// sessão (o visitante é anónimo), mas nunca aceita destinatário do
// cliente: o email vai sempre para o contacto configurado em
// site_settings, e o conteúdo vem sempre da base de dados (não do que o
// cliente enviou no pedido do fetch), para não servir de retransmissor
// de email arbitrário.
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!serviceRoleKey || !resendKey) {
    // Falha silenciosa — não queremos que a falta de configuração de email
    // impeça o pedido em si de ter sido guardado com sucesso.
    return NextResponse.json({ status: 'ignorado' });
  }

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: 'leadId em falta.' }, { status: 400 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: lead }, { data: settings }] = await Promise.all([
    adminClient.from('leads').select('nome, email, telefone, localidade, tipo_obra, mensagem, criado_em').eq('id', leadId).single(),
    adminClient.from('site_settings').select('email').eq('id', 1).single(),
  ]);

  const destino = settings?.email;
  if (!lead || !destino) return NextResponse.json({ status: 'ignorado' });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  const corpoHtml = `
    <h2>Novo pedido de orçamento</h2>
    <p><b>Nome:</b> ${lead.nome || '—'}</p>
    <p><b>Email:</b> ${lead.email || '—'}</p>
    <p><b>Telefone:</b> ${lead.telefone || '—'}</p>
    <p><b>Localidade:</b> ${lead.localidade || '—'}</p>
    <p><b>Obra:</b> ${lead.tipo_obra || '—'}</p>
    ${lead.mensagem ? `<p><b>Mensagem:</b> ${lead.mensagem}</p>` : ''}
    <p><a href="${siteUrl}/admin/leads">Ver em /admin/leads</a></p>
  `;

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REMETENTE,
      to: [destino],
      subject: `Novo pedido de orçamento — ${lead.nome || 'sem nome'}`,
      html: corpoHtml,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    return NextResponse.json({ error: 'Erro ao enviar: ' + errText }, { status: 502 });
  }

  return NextResponse.json({ status: 'ok' });
}
