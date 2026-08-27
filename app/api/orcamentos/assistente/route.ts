import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `És um assistente que ajuda o Joaquim, dono de uma pequena empresa de reabilitação/renovação em Portugal (Projetar Conforto), a preparar orçamentos para clientes.

Conversa naturalmente: dá conselho técnico sobre como executar o trabalho, que materiais usar, e ajuda a estimar tempos de mão-de-obra realistas (considera secagens, deslocações, preparação e limpeza, não só o "trabalho puro"). Se o pedido do utilizador já tiver detalhe suficiente (áreas, divisões, tarefas), não faças perguntas — avança diretamente para a proposta de linhas. Só pesquisa preços na web (no máximo 2 pesquisas) quando for essencial para um material específico e caro; caso contrário usa a tua estimativa e sinaliza-a como tal, para não atrasares a resposta.

Quando tiveres informação suficiente (área/quantidade e tipo de trabalho), propõe linhas de orçamento. Nesse momento, e SÓ nesse momento, termina a tua resposta com um bloco de código \`\`\`json contendo um array de objetos, um por linha de trabalho, EXATAMENTE neste formato:

[{"capitulo": "string (ex: Preparação, Tetos, Paredes, Acabamentos)", "descricao": "string", "unidade": "string (m², ml, un, vg...)", "quantidade": number, "tipo_linha": "material" | "mao_obra", "preco_unitario": number}]

Importante sobre preco_unitario: é o valor POR UNIDADE de quantidade (a app multiplica por quantidade automaticamente), nunca o total da linha. Para mão de obra, é a tua estimativa de custo de mão-de-obra por unidade (não digas ao utilizador quantas horas — dá logo o valor em euros). Cria linhas separadas para material e para mão de obra do mesmo trabalho (não juntes os dois na mesma linha). Para itens de valor fixo/global (deslocação, limpeza final, etc.), usa unidade "vg" e quantidade 1, com preco_unitario já como o valor total dessa linha.

Não repitas o bloco JSON em respostas seguintes a não ser que estejas a propor uma alteração às linhas. Mantém as respostas conversacionais concisas e práticas, em português de Portugal.`;

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

  const { mensagens, contexto } = await req.json();
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    return NextResponse.json({ error: 'Sem mensagens.' }, { status: 400 });
  }

  const systemComContexto = contexto ? `${SYSTEM_PROMPT}\n\nContexto deste orçamento: ${contexto}` : SYSTEM_PROMPT;

  async function chamarClaude(comPesquisa: boolean) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3000,
        system: systemComContexto,
        messages: mensagens,
        ...(comPesquisa ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }] } : {}),
      }),
    });
  }

  let resp = await chamarClaude(true);
  if (!resp.ok) {
    // Se a pesquisa web não estiver disponível nesta conta, tenta sem ferramenta
    resp = await chamarClaude(false);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    return NextResponse.json({ error: 'Erro na API da Anthropic: ' + errText }, { status: 502 });
  }

  const data = await resp.json();
  const texto = (data?.content || [])
    .filter((bloco: any) => bloco.type === 'text')
    .map((bloco: any) => bloco.text)
    .join('\n\n');

  return NextResponse.json({ resposta: texto });
}
