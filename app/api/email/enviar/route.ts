import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const REMETENTE = 'Projetar Conforto <geral@projetarconforto.pt>';

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

  const { para, cc, assunto, corpoHtml, emRespostaAId, anexos } = await req.json();
  if (!para || !assunto) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });

  let inReplyTo: string | null = null;
  if (emRespostaAId) {
    const { data: original } = await adminClient.from('emails').select('message_id').eq('id', emRespostaAId).single();
    inReplyTo = original?.message_id || null;
  }

  const anexosResend: { filename: string; content: string }[] = [];
  for (const a of anexos || []) {
    try {
      const resp = await fetch(a.url);
      const buf = await resp.arrayBuffer();
      anexosResend.push({ filename: a.nome, content: Buffer.from(buf).toString('base64') });
    } catch {
      // ignora falha a anexar um ficheiro individual
    }
  }

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REMETENTE,
      to: [para],
      cc: cc ? [cc] : undefined,
      subject: assunto,
      html: corpoHtml,
      attachments: anexosResend.length ? anexosResend : undefined,
      headers: inReplyTo ? { 'In-Reply-To': inReplyTo, References: inReplyTo } : undefined,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    return NextResponse.json({ error: 'Erro ao enviar: ' + errText }, { status: 502 });
  }

  const resendData = await resendResp.json();

  const { data: emailGuardado, error: insertError } = await adminClient.from('emails').insert([{
    direcao: 'enviado',
    de: 'geral@projetarconforto.pt',
    de_nome: 'Projetar Conforto',
    para,
    cc: cc || null,
    assunto,
    corpo_html: corpoHtml,
    message_id: resendData.id || null,
    in_reply_to: inReplyTo,
    lida: true,
  }]).select().single();

  if (!insertError && emailGuardado) {
    for (const a of anexos || []) {
      await adminClient.from('email_anexos').insert([{ email_id: emailGuardado.id, nome_ficheiro: a.nome, url: a.url }]);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
