import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PROMPT = `Analisa esta imagem de uma fatura ou recibo de compra (material de construção/renovação em Portugal).
Extrai a informação e responde APENAS com um objeto JSON válido, sem markdown, sem texto adicional, exatamente neste formato:

{
  "fornecedor": "nome do fornecedor ou null",
  "data": "AAAA-MM-DD ou null",
  "itens": [
    { "descricao": "string", "quantidade": number, "preco_unitario": number, "desconto_percentagem": number, "iva_percentagem": number }
  ],
  "total": number
}

Regras:
- Usa ponto decimal (não vírgula) nos números.
- Se não conseguires ler algum campo com confiança, usa null nesse campo (não inventes valores).
- iva_percentagem: se não indicado explicitamente por artigo, usa a taxa geral da fatura (normalmente 23 em Portugal).
- desconto_percentagem: 0 se não houver desconto.
- "total" é o valor final pago, com IVA incluído.
- Não incluas nenhum texto fora do JSON.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 });
  }

  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: 'Imagem em falta.' }, { status: 400 });
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
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: PROMPT },
          ],
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
