import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';

export const runtime = 'nodejs';

const PROMPT = `Este é um orçamento de obras de reabilitação/renovação (Portugal), possivelmente gerado por outra pessoa ou outra IA. Extrai a informação e responde APENAS com um objeto JSON válido, sem markdown, sem texto adicional, exatamente neste formato:

{
  "titulo": "string curto (ex: Reparação de Fachada)",
  "descricao": "string ou null (resumo de 1-2 frases do trabalho, se fizer sentido)",
  "linhas": [
    { "capitulo": "string (ex: Materiais, Mão de Obra, Preparação)", "descricao": "string", "unidade": "string (m², ml, un, vg...)", "quantidade": number, "custo_material": number }
  ]
}

Regras importantes:
- Cada linha do documento original (mesmo que já venha com um valor total, não decomposto em horas) deve virar uma linha aqui. Não inventes decomposição de mão-de-obra em horas — não sabemos a taxa horária de quem vai usar isto.
- "custo_material" é o valor MONETÁRIO POR UNIDADE dessa linha (valor total da linha dividido pela quantidade). Se a linha for um valor fixo/global (ex: deslocação, verba), usa unidade "vg", quantidade 1, e custo_material = valor total dessa linha.
- Usa ponto decimal (não vírgula) nos números.
- Se não conseguires ler algum campo com confiança, usa valores razoáveis a partir do contexto, nunca deixes campos obrigatórios em falta.
- Não incluas nenhum texto fora do JSON.`;

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

  const { fileBase64, mediaType } = await req.json();
  if (!fileBase64 || !mediaType) return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });

  const isPdf = mediaType === 'application/pdf';
  const isDocx = mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isDoc = mediaType === 'application/msword';

  let conteudo: any;

  if (isPdf) {
    conteudo = { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } };
  } else if (isDocx) {
    const buffer = Buffer.from(fileBase64, 'base64');
    let texto = '';
    try {
      const resultado = await mammoth.extractRawText({ buffer });
      texto = resultado.value;
    } catch (e: any) {
      return NextResponse.json({ error: 'Não foi possível ler o ficheiro Word: ' + e.message }, { status: 400 });
    }
    if (!texto.trim()) return NextResponse.json({ error: 'O documento parece estar vazio.' }, { status: 400 });
    conteudo = { type: 'text', text: `Texto extraído do documento:\n\n${texto}` };
  } else if (isDoc) {
    return NextResponse.json({ error: 'Ficheiros .doc antigos não são suportados — grava como .docx ou PDF e tenta novamente.' }, { status: 400 });
  } else {
    return NextResponse.json({ error: 'Formato não suportado. Usa PDF ou Word (.docx).' }, { status: 400 });
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: [conteudo, { type: 'text', text: PROMPT }],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return NextResponse.json({ error: 'Erro na API da Anthropic: ' + errText }, { status: 502 });
  }

  const data = await resp.json();
  const textoResposta: string = data?.content?.[0]?.text || '';

  let extraido;
  try {
    const limpo = textoResposta.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    extraido = JSON.parse(limpo);
  } catch {
    return NextResponse.json({ error: 'Não foi possível interpretar a resposta da IA.', bruto: textoResposta }, { status: 502 });
  }

  return NextResponse.json(extraido);
}
