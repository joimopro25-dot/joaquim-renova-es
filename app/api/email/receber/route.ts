import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { de, deNome, para, cc, assunto, corpoTexto, corpoHtml, messageId, inReplyTo, anexos } = await req.json();
  if (!de || !para) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });

  const { data: email, error } = await supabase.from('emails').insert([{
    direcao: 'recebido',
    de,
    de_nome: deNome || null,
    para,
    cc: cc || null,
    assunto: assunto || '(sem assunto)',
    corpo_texto: corpoTexto || null,
    corpo_html: corpoHtml || null,
    message_id: messageId || null,
    in_reply_to: inReplyTo || null,
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const anexo of anexos || []) {
    try {
      const bytes = Buffer.from(anexo.contentBase64, 'base64');
      const path = `${email.id}/${anexo.nome}`;
      await supabase.storage.from('emails').upload(path, bytes, { contentType: anexo.contentType || 'application/octet-stream' });
      const url = supabase.storage.from('emails').getPublicUrl(path).data.publicUrl;
      await supabase.from('email_anexos').insert([{ email_id: email.id, nome_ficheiro: anexo.nome, url }]);
    } catch {
      // ignora falha num anexo individual, não bloqueia o resto do email
    }
  }

  return NextResponse.json({ status: 'ok' });
}
