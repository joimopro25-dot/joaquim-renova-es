import * as webpush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails('mailto:geral@projetarconforto.pt', publicKey, privateKey);
}

type Subscricao = { endpoint: string; p256dh: string; auth: string };

export async function enviarPushParaSubscricoes(
  subscricoes: Subscricao[],
  payload: { titulo: string; corpo: string; url?: string }
) {
  if (!publicKey || !privateKey) return [];

  const resultados = await Promise.allSettled(
    subscricoes.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
    )
  );

  // Subscrições inválidas (404/410) são devolvidas para quem chamar poder limpá-las.
  const invalidas: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
      invalidas.push(subscricoes[i].endpoint);
    }
  });
  return invalidas;
}
