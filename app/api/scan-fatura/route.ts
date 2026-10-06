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
- "preco_unitario" tem de ser o valor SEM IVA (base tributável), por unidade — nunca o preço final com IVA incluído.
  Muitas faturas de loja mostram o preço já com IVA incluído: nesse caso, calcula o valor sem IVA dividindo pelo
  fator correspondente (ex: preço com IVA ÷ 1.23 para uma taxa de 23%) antes de o colocares em "preco_unitario".
  Isto é importante porque o sistema volta a somar o IVA por cima deste valor — se devolveres o preço já com IVA,
  o IVA fica contado em duplicado.
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

  const isPdf = mediaType === 'application/pdf';
  const conteudoFicheiro = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } };

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
            conteudoFicheiro,
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
  const textoResposta: string = (data?.content || [])
    .filter((bloco: any) => bloco.type === 'text')
    .map((bloco: any) => bloco.text)
    .join('\n\n');

  let extraido;
  try {
    extraido = extrairJSON(textoResposta);
  } catch {
    return NextResponse.json({ error: 'Não foi possível interpretar a resposta da IA.', bruto: textoResposta }, { status: 502 });
  }

  return NextResponse.json(extraido);
}

function extrairJSON(texto: string): any {
  let corpo = texto.trim();
  const fenceMatch = corpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) corpo = fenceMatch[1].trim();
  try {
    return JSON.parse(corpo);
  } catch {
    const inicio = corpo.indexOf('{');
    const fim = corpo.lastIndexOf('}');
    if (inicio !== -1 && fim > inicio) {
      return JSON.parse(corpo.slice(inicio, fim + 1));
    }
    throw new Error('JSON inválido');
  }
}
