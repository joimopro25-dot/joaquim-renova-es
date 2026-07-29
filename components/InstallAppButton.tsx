'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

type Props = {
  scope: '/admin/' | '/portal/';
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
  label?: string;
};

export default function InstallAppButton({ scope, className = '', labelClassName = '', iconClassName = '', label = 'Instalar App' }: Props) {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope }).catch(() => {});
    }

    const ua = window.navigator.userAgent;
    setIsIos(/iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream);
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    );

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setPromptEvent(e);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [scope]);

  if (isStandalone) return null;
  if (!promptEvent && !isIos) return null;

  async function handleClick() {
    if (promptEvent) {
      promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    if (isIos) {
      alert('Para instalar: toca no botão de Partilhar (o quadrado com a seta para cima) e depois em "Adicionar ao Ecrã Principal".');
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      <Download size={18} className={iconClassName} />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
