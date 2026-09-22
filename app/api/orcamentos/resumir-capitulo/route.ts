import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const PROMPT_BASE = `És um técnico de remodelações a escrever a descrição técnica de um trabalho para um orçamento de cliente em Portugal.

Escreve um ÚNICO parágrafo curto (2 a 4 frases), em português de Portugal, a descrever o âmbito e as especificações técnicas do trabalho a partir da lista de itens internos fornecida — tipo "memória descritiva".

Regras importantes:
- Não menciones preços, valores, nem separes material de mão de obra.
- Não repitas a lista item a item — resume o essencial em texto corrido e natural, mencionando os materiais/técnicas relevantes (ex: tipo de bloco, espessura, acabamento, número de demãos) quando fizer sentido.
- Tom profissional e direto, sem floreados.
- Responde APENAS com o parágrafo, sem título, sem markdown, sem aspas.`;

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!serviceRoleKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 });

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: perfil } = await adminClient.from('perfis').select('tipo').eq('id', userData.user.id).single();
  if (perfil?.tipo !== 'admin') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const { capitulo, itens } = await req.json();
  if (!capitulo || !Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });
  }

  const listaItens = itens.map((it: { descricao: string; unidade: string; quantidade: number }) => `- ${it.descricao} (${it.quantidade} ${it.unidade})`).join('\n');
  const prompt = `${PROMPT_BASE}\n\nTrabalho: ${capitulo}\n\nItens internos:\n${listaItens}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return NextResponse.json({ error: 'Erro na API da Anthropic: ' + errText }, { status: 502 });
  }

  const data = await resp.json();
  const descricao: string = (data?.content || [])
    .filter((bloco: any) => bloco.type === 'text')
    .map((bloco: any) => bloco.text)
    .join('\n\n')
    .trim();

  return NextResponse.json({ descricao });
}
