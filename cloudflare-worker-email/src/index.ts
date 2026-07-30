import PostalMime from 'postal-mime';

export interface Env {
  INBOUND_EMAIL_SECRET: string;
  API_URL: string;
  FORWARD_TO: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default {
  async email(message: ForwardableEmailMessage, env: Env) {
    try {
      await message.forward(env.FORWARD_TO);
    } catch (e) {
      console.error('Falha ao reencaminhar para o Gmail', e);
    }

    try {
      const buffer = await new Response(message.raw).arrayBuffer();
      const email = await PostalMime.parse(buffer);

      const anexos = [];
      for (const att of email.attachments || []) {
        anexos.push({
          nome: att.filename || 'anexo',
          contentType: att.mimeType || 'application/octet-stream',
          contentBase64: arrayBufferToBase64(att.content as ArrayBuffer),
        });
      }

      await fetch(env.API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': env.INBOUND_EMAIL_SECRET,
        },
        body: JSON.stringify({
          de: email.from?.address || message.from,
          deNome: email.from?.name || null,
          para: message.to,
          cc: (email.cc || []).map((c) => c.address).join(', ') || null,
          assunto: email.subject || '(sem assunto)',
          corpoTexto: email.text || null,
          corpoHtml: email.html || null,
          messageId: email.messageId || null,
          inReplyTo: email.inReplyTo || null,
          anexos,
        }),
      });
    } catch (e) {
      console.error('Falha ao processar/enviar email para o CRM', e);
    }
  },
};
