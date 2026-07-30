import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const REMETENTE = 'Projetar Conforto <geral@projetarconforto.pt>';
const DESTINATARIO_PADRAO = 'olijack84@gmail.com';

export async function POST(req: NextRequest) {
  const secret = process.env.ALERTA_EMAIL_SECRET;
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY não configurada no servidor.' }, { status: 500 });

  const { assunto, corpoHtml, destinatario } = await req.json();
  if (!assunto || !corpoHtml) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REMETENTE,
      to: [destinatario || DESTINATARIO_PADRAO],
      subject: assunto,
      html: corpoHtml,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    return NextResponse.json({ error: 'Erro ao enviar: ' + errText }, { status: 502 });
  }

  return NextResponse.json({ status: 'ok' });
}
