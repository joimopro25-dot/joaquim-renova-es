// Service worker mínimo — necessário para o Chrome/Android considerar o site "instalável".
// Não intercepta pedidos (deixa tudo passar normalmente), só regista presença.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
