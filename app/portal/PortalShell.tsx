'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase, getSessionComLimite, SESSAO_TIMEOUT } from '../../lib/supabase';
import { assinarNotificacoesPush } from '../../lib/push-client';
import InstallAppButton from '../../components/InstallAppButton';
import { LogOut, BellRing } from 'lucide-react';

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/portal/login' || pathname === '/portal/definir-password';
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    getSessionComLimite().then((resultado) => {
      if (resultado === SESSAO_TIMEOUT) {
        // Ficou preso a verificar a sessão (típico ao reabrir a app PWA
        // depois de estar em background) — recarregar limpa o lock preso.
        const jaTentou = sessionStorage.getItem('portal-sessao-reload');
        if (!jaTentou) {
          sessionStorage.setItem('portal-sessao-reload', '1');
          window.location.reload();
        } else {
          setChecking(false);
        }
        return;
      }
      sessionStorage.removeItem('portal-sessao-reload');
      setSession(resultado.data.session);
      setChecking(false);
      if (!resultado.data.session && !isLoginPage) router.replace('/portal/login');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession && !isLoginPage) router.replace('/portal/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [isLoginPage, router]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermissaoNotificacao(Notification.permission);
  }, []);

  useEffect(() => {
    if (session && permissaoNotificacao === 'granted') {
      assinarNotificacoesPush(session.user.id);
    }
  }, [session, permissaoNotificacao]);

  async function pedirNotificacoes() {
    if (typeof Notification === 'undefined') return;
    const resultado = await Notification.requestPermission();
    setPermissaoNotificacao(resultado);
    if (resultado === 'granted' && session) await assinarNotificacoesPush(session.user.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/portal/login');
  }

  if (isLoginPage) return <>{children}</>;

  if (checking || !session) {
    return <div className="min-h-screen bg-sand-50 flex items-center justify-center text-ink-400 text-sm">A verificar sessão...</div>;
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="h-16 bg-white border-b border-sand-200 flex items-center justify-between px-4 md:px-8">
        <span className="flex items-center gap-2 font-heading font-bold text-brand-600">
          <img src="/logo-icon.png" alt="" className="h-7 w-7" />
          Projetar Conforto
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/portal" className={`text-sm ${pathname === '/portal' ? 'text-brand-600 font-medium' : 'text-ink-500 hover:text-ink-800'}`}>As Minhas Obras</Link>
          <Link href="/portal/orcamentos" className={`text-sm ${pathname.startsWith('/portal/orcamentos') ? 'text-brand-600 font-medium' : 'text-ink-500 hover:text-ink-800'}`}>Orçamentos</Link>
          {permissaoNotificacao === 'default' && (
            <button onClick={pedirNotificacoes} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600">
              <BellRing size={16} /> Ativar Notificações
            </button>
          )}
          <InstallAppButton scope="/portal/" className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600" label="Instalar App" />
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-red-600">
            <LogOut size={16} /> Sair
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
