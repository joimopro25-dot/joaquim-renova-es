import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enviarPushParaSubscricoes } from '../../../../lib/push-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 });

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: perfil } = await adminClient.from('perfis').select('tipo, cliente_id').eq('id', userData.user.id).single();
  if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });

  const { obraId, titulo, corpo, url } = await req.json();
  if (!obraId || !titulo || !corpo) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });

  const { data: obra } = await adminClient.from('obras').select('cliente_id').eq('id', obraId).single();
  if (!obra) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 });

  let recipientIds: string[] = [];

  if (perfil.tipo === 'admin') {
    const { data: clientes } = await adminClient.from('perfis').select('id').eq('tipo', 'cliente').eq('cliente_id', obra.cliente_id);
    recipientIds = (clientes || []).map((c) => c.id);
  } else {
    if (perfil.cliente_id !== obra.cliente_id) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    const { data: admins } = await adminClient.from('perfis').select('id').eq('tipo', 'admin');
    recipientIds = (admins || []).map((a) => a.id);
  }

  if (recipientIds.length === 0) return NextResponse.json({ status: 'ok', enviados: 0 });

  const { data: subscricoes } = await adminClient
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('perfil_id', recipientIds);

  if (!subscricoes || subscricoes.length === 0) return NextResponse.json({ status: 'ok', enviados: 0 });

  const invalidas = await enviarPushParaSubscricoes(subscricoes, { titulo, corpo, url });
  if (invalidas.length > 0) {
    await adminClient.from('push_subscriptions').delete().in('endpoint', invalidas);
  }

  return NextResponse.json({ status: 'ok', enviados: subscricoes.length - invalidas.length });
}
