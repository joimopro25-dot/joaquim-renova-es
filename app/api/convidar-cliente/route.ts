import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: perfil } = await adminClient.from('perfis').select('tipo').eq('id', userData.user.id).single();
  if (perfil?.tipo !== 'admin') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const { clienteId, email } = await req.json();
  if (!clienteId || !email) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  const { data: convite, error: conviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/portal/definir-password`,
  });

  if (conviteError) {
    return NextResponse.json({ error: conviteError.message }, { status: 400 });
  }

  const novoUserId = convite.user.id;

  const { error: perfilError } = await adminClient.from('perfis').upsert([
    { id: novoUserId, tipo: 'cliente', cliente_id: clienteId },
  ]);

  if (perfilError) {
    return NextResponse.json({ error: 'Convite enviado mas falhou ao associar o perfil: ' + perfilError.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}
