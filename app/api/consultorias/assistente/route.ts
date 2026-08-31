import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FOTOS_POR_PEDIDO = 8;

const PROMPT_BASE = `És um assistente técnico que ajuda o Joaquim, dono de uma pequena empresa de reabilitação/renovação em Portugal (Projetar Conforto), a avaliar trabalhos antes ou durante uma obra.

O utilizador vai descrever um trabalho e pode enviar fotos do local. A tua função principal é dar consultoria técnica: o que precisa de ser feito, qual a melhor forma/ordem de execução, que materiais usar, que cuidados ter (secagens, patologias visíveis nas fotos, riscos), e uma estimativa realista de tempo. Sê concreto e prático, como um profissional experiente a aconselhar um colega — não genérico.

Responde sempre em português de Portugal, de forma concisa e prática.`;

const PROMPT_COM_ORCAMENTO = `

Depois de dares o teu conselho técnico e quando achares que já há informação suficiente (área/quantidade e o que fazer), pergunta explicitamente ao utilizador se quer que proponhas já as linhas de orçamento com base no que foi discutido (ex: "Queres que monte já as linhas de orçamento com isto?"). Só depois de o utilizador confirmar é que deves propor as linhas — nunca proponhas o bloco JSON sem essa confirmação explícita.

Quando o utilizador confirmar, termina a tua resposta com um bloco de código \`\`\`json contendo um array de objetos, um por linha de trabalho, EXATAMENTE neste formato:

[{"capitulo": "string (ex: Preparação, Tetos, Paredes, Acabamentos)", "descricao": "string", "unidade": "string (m², ml, un, vg...)", "quantidade": number, "tipo_linha": "material" | "mao_obra", "preco_unitario": number}]

Importante sobre preco_unitario: é o valor POR UNIDADE de quantidade (a app multiplica por quantidade automaticamente), nunca o total da linha. Usa a tua própria estimativa de preços em Portugal (não tens acesso à internet) — não é preciso dizeres que é estimativa neste bloco, mas podes referi-lo no texto. Cria linhas separadas para material e para mão de obra do mesmo trabalho. Para itens de valor fixo/global, usa unidade "vg" e quantidade 1, com preco_unitario já como o valor total dessa linha. Não repitas o bloco JSON em respostas seguintes a não ser que estejas a propor uma alteração às linhas.`;

type MensagemEntrada = {
  role: 'user' | 'assistant';
  texto: string;
  fotos?: { url: string; legenda: string | null }[];
};

async function fotoParaBlocoImagem(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  const buf = await resp.arrayBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: contentType, data: base64 } };
}

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

  const { mensagens, contexto, permitirOrcamento } = await req.json();
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    return NextResponse.json({ error: 'Sem mensagens.' }, { status: 400 });
  }

  const systemPrompt = PROMPT_BASE + (permitirOrcamento ? PROMPT_COM_ORCAMENTO : '') + (contexto ? `\n\nContexto: ${contexto}` : '');

  let fotosRestantes = MAX_FOTOS_POR_PEDIDO;
  const mensagensAnthropic = [];
  for (const m of mensagens as MensagemEntrada[]) {
    const blocos: any[] = [];
    if (m.role === 'user' && m.fotos && m.fotos.length > 0) {
      for (const f of m.fotos) {
        if (fotosRestantes <= 0) break;
        try {
          const bloco = await fotoParaBlocoImagem(f.url);
          if (bloco) {
            blocos.push(bloco);
            if (f.legenda) blocos.push({ type: 'text', text: `(sobre a foto acima: ${f.legenda})` });
            fotosRestantes -= 1;
          }
        } catch {
          // ignora falha a carregar uma foto individual, não bloqueia o pedido
        }
      }
    }
    blocos.push({ type: 'text', text: m.texto || '(sem texto)' });
    mensagensAnthropic.push({ role: m.role, content: blocos });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: mensagensAnthropic,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.name === 'AbortError' ? 'O assistente demorou demasiado tempo a responder. Tenta uma descrição mais curta ou menos fotos de cada vez.' : 'Falha de rede ao contactar o assistente.' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
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
