import { supabase } from './supabase';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

// Pede autorização de notificações (se ainda não foi dada/recusada) e guarda a
// subscrição push associada a este perfil. Falha em silêncio em navegadores
// sem suporte (ex. Safari fora do ecrã principal) — notificações são um extra,
// não algo de que a app dependa.
export async function assinarNotificacoesPush(perfilId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    if (Notification.permission === 'denied') return;

    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      if (Notification.permission !== 'granted') {
        const permissao = await Notification.requestPermission();
        if (permissao !== 'granted') return;
      }
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await supabase.from('push_subscriptions').upsert(
      {
        perfil_id: perfilId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' }
    );
  } catch {
    // notificações são um extra — nunca devem bloquear o resto da app
  }
}
