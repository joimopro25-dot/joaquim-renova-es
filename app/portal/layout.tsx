'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { LogOut } from 'lucide-react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/portal/login';
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
      if (!data.session && !isLoginPage) router.replace('/portal/login');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession && !isLoginPage) router.replace('/portal/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [isLoginPage, router]);

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
        <span className="font-heading font-bold text-brand-600">Joaquim Renovações</span>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-red-600">
          <LogOut size={16} /> Sair
        </button>
      </header>
      <main>{children}</main>
    </div>
  );
}
