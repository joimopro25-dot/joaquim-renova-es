'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import InstallAppButton from '../../components/InstallAppButton';
import {
  LayoutDashboard, Users, Briefcase, Receipt, Package, FileText, Inbox, Globe as GlobeIcon, Images, BookMarked, HardHat, UsersRound, Mail, BellRing,
  Menu, X, ChevronLeft, ChevronRight, Globe, LogOut,
} from 'lucide-react';

type MenuItem = { path: string; icon: typeof LayoutDashboard; label: string; comingSoon?: boolean };

const MENU: MenuItem[] = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/email', icon: Mail, label: 'Email' },
  { path: '/admin/leads', icon: Inbox, label: 'Leads' },
  { path: '/admin/clientes', icon: Users, label: 'Clientes' },
  { path: '/admin/orcamentos', icon: FileText, label: 'Orçamentos' },
  { path: '/admin/precario', icon: BookMarked, label: 'Preçário' },
  { path: '/admin/obras', icon: Briefcase, label: 'Obras' },
  { path: '/admin/trabalhadores', icon: UsersRound, label: 'Trabalhadores' },
  { path: '/admin/subempreitadas', icon: HardHat, label: 'Subempreitadas' },
  { path: '/admin/despesas', icon: Receipt, label: 'Despesas/Faturas' },
  { path: '/admin/stock', icon: Package, label: 'Stock/Ferramentas' },
  { path: '/admin/portfolio', icon: Images, label: 'Portfólio' },
  { path: '/admin/site', icon: GlobeIcon, label: 'Site Público' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [emailsNaoLidos, setEmailsNaoLidos] = useState(0);
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    setCollapsed(localStorage.getItem('admin-collapsed') === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('admin-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    async function checarAcesso(currentSession: Session | null) {
      setSession(currentSession);
      if (!currentSession) {
        setIsAdmin(false);
        setCheckingSession(false);
        if (!isLoginPage) router.replace('/admin/login');
        return;
      }
      const { data: perfil } = await supabase.from('perfis').select('tipo').eq('id', currentSession.user.id).single();
      const admin = perfil?.tipo === 'admin';
      setIsAdmin(admin);
      setCheckingSession(false);
      if (!admin && !isLoginPage) {
        await supabase.auth.signOut();
        router.replace('/admin/login');
      }
    }
    supabase.auth.getSession().then(({ data }) => checarAcesso(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      checarAcesso(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [isLoginPage, router]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermissaoNotificacao(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let anterior = -1;

    async function verificarEmails() {
      const { count } = await supabase.from('emails').select('id', { count: 'exact', head: true }).eq('direcao', 'recebido').eq('lida', false);
      const atual = count || 0;
      if (anterior >= 0 && atual > anterior && permissaoNotificacao === 'granted') {
        new Notification(atual - anterior === 1 ? 'Novo email recebido' : `${atual - anterior} novos emails recebidos`, {
          body: 'geral@projetarconforto.pt',
          icon: '/icons/admin-192.png',
        });
      }
      anterior = atual;
      setEmailsNaoLidos(atual);
    }

    verificarEmails();
    const intervalo = setInterval(verificarEmails, 45000);
    return () => clearInterval(intervalo);
  }, [isAdmin, permissaoNotificacao]);

  async function pedirNotificacoes() {
    if (typeof Notification === 'undefined') return;
    const resultado = await Notification.requestPermission();
    setPermissaoNotificacao(resultado);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  function toggle() {
    if (window.innerWidth <= 768) setSidebarOpen(true);
    else setCollapsed((c) => !c);
  }

  const currentLabel = MENU.find((m) => pathname === m.path || (m.path !== '/admin' && pathname?.startsWith(m.path)))?.label || 'Backoffice';

  if (isLoginPage) return <>{children}</>;

  if (checkingSession || !session || !isAdmin) {
    return <div className="min-h-screen bg-sand-50 flex items-center justify-center text-ink-400 text-sm">A verificar sessão...</div>;
  }

  return (
    <div className="min-h-screen bg-sand-50 flex">
      <aside
        className={`print:hidden fixed top-0 left-0 bottom-0 z-40 bg-ink-900 border-r border-ink-800 flex flex-col transition-all duration-200
          ${collapsed ? 'md:w-16' : 'md:w-64'} w-64
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-ink-800 shrink-0">
          <div className="flex-1 min-w-0 leading-none">
            <span className={`font-heading font-bold text-sand-50 tracking-wide ${collapsed ? 'md:text-sm' : 'text-lg'}`}>
              {collapsed ? 'PC' : 'Projetar Conforto'}
            </span>
            {!collapsed && (
              <div className="text-[10px] uppercase tracking-widest text-copper-400 mt-0.5">Backoffice</div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex items-center justify-center border border-ink-700 rounded-md p-1.5 text-ink-300 hover:bg-ink-800 shrink-0"
          >
            <ChevronLeft size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden flex items-center justify-center border border-ink-700 rounded-md p-1.5 text-ink-300 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {MENU.map((item) => {
            const active = pathname === item.path || (item.path !== '/admin' && pathname?.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.comingSoon ? '#' : item.path}
                onClick={(e) => {
                  if (item.comingSoon) e.preventDefault();
                  setSidebarOpen(false);
                }}
                title={item.comingSoon ? `${item.label} (em breve)` : item.label}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${collapsed ? 'md:justify-center' : ''}
                  ${item.comingSoon ? 'text-ink-500 cursor-not-allowed' : active ? 'bg-ink-800 text-copper-300 font-medium' : 'text-ink-300 hover:bg-ink-800 hover:text-sand-100'}`}
              >
                <Icon size={18} className="shrink-0" />
                <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
                {item.comingSoon && !collapsed && (
                  <span className="badge bg-ink-800 text-ink-400 ml-auto text-[10px]">em breve</span>
                )}
                {item.path === '/admin/email' && emailsNaoLidos > 0 && (
                  <span className={`badge bg-brand-500 text-white text-[10px] ${collapsed ? 'absolute top-1 right-1' : 'ml-auto'}`}>{emailsNaoLidos}</span>
                )}
                {active && !collapsed && !item.comingSoon && emailsNaoLidos === 0 && <ChevronRight size={14} className="ml-auto text-copper-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-ink-800">
          {permissaoNotificacao === 'default' && (
            <button
              onClick={pedirNotificacoes}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink-300 hover:bg-ink-800 hover:text-sand-100 w-full ${collapsed ? 'md:justify-center' : ''}`}
            >
              <BellRing size={18} className="shrink-0" />
              <span className={collapsed ? 'md:hidden' : ''}>Ativar Notificações</span>
            </button>
          )}
          <InstallAppButton
            scope="/admin/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink-300 hover:bg-ink-800 hover:text-sand-100 w-full ${collapsed ? 'md:justify-center' : ''}`}
            labelClassName={collapsed ? 'md:hidden' : ''}
          />
          <Link
            href="/"
            target="_blank"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink-300 hover:bg-ink-800 hover:text-sand-100 ${collapsed ? 'md:justify-center' : ''}`}
          >
            <Globe size={18} className="shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>Ver site</span>
          </Link>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ink-300 hover:bg-red-950 hover:text-red-400 w-full ${collapsed ? 'md:justify-center' : ''}`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>Sair</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`flex-1 min-w-0 flex flex-col transition-all duration-200 print:ml-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <header className="print:hidden h-16 sticky top-0 z-20 bg-white border-b border-sand-200 flex items-center gap-3 px-4 md:px-6 shrink-0">
          <button
            onClick={toggle}
            className="flex items-center justify-center border border-sand-200 rounded-md p-1.5 text-ink-600 hover:bg-sand-50"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-semibold text-ink-800 truncate">{currentLabel}</h1>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
