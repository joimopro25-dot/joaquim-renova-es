'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { KeyRound } from 'lucide-react';

const VERSAO_TERMOS = '2026-08-01';

export default function DefinirPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
  }, []);

  async function definirPassword(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (password.length < 6) { setErro('A palavra-passe deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirmar) { setErro('As palavras-passe não coincidem.'); return; }
    if (!aceitouTermos) { setErro('Tem de aceitar os Termos e Condições e a Política de Privacidade para continuar.'); return; }
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setErro(error.message); setGuardando(false); return; }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from('perfis').update({
        termos_aceites_em: new Date().toISOString(),
        termos_versao: VERSAO_TERMOS,
      }).eq('id', userData.user.id);
    }

    setGuardando(false);
    router.push('/portal');
  }

  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-heading font-bold text-xl text-brand-600 mb-1">Projetar Conforto</h1>
        <p className="text-sm text-ink-400 mb-6">Defina a sua palavra-passe de acesso</p>

        {!pronto ? (
          <p className="text-sm text-ink-500">A validar o convite... se esta mensagem persistir, o link pode ter expirado — peça um novo convite.</p>
        ) : (
          <form onSubmit={definirPassword} className="space-y-3">
            <input type="password" placeholder="Nova palavra-passe" value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" required minLength={6} />
            <input type="password" placeholder="Confirmar palavra-passe" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="input w-full" required minLength={6} />
            <label className="flex items-start gap-2 text-xs text-ink-500">
              <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} className="mt-0.5" required />
              <span>
                Li e aceito os{' '}
                <Link href="/termos-condicoes" target="_blank" className="text-brand-600 hover:underline">Termos e Condições</Link>
                {' '}e a{' '}
                <Link href="/politica-privacidade" target="_blank" className="text-brand-600 hover:underline">Política de Privacidade</Link>.
              </span>
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button type="submit" disabled={guardando} className="btn-primary w-full justify-center disabled:opacity-60">
              <KeyRound size={18} /> {guardando ? 'A guardar...' : 'Definir Palavra-passe e Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
