'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { LogIn, UserPlus } from 'lucide-react';

async function garantirPerfil(userId: string, email: string) {
  const { data: perfilExistente } = await supabase.from('perfis').select('id').eq('id', userId).maybeSingle();
  if (perfilExistente) return;

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  await supabase.from('perfis').insert([{ id: userId, tipo: 'cliente', cliente_id: cliente?.id || null }]);
}

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (modo === 'entrar') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setLoading(false);
        setError('Email ou palavra-passe incorretos.');
        return;
      }
      await garantirPerfil(data.user.id, email);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) {
        setLoading(false);
        setError(error?.message === 'User already registered' ? 'Já existe uma conta com este email — tenta Entrar.' : 'Não foi possível criar a conta.');
        return;
      }
      await garantirPerfil(data.user.id, email);
    }

    setLoading(false);
    router.push('/portal');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-heading font-bold text-xl text-brand-600 mb-1">Projetar Conforto</h1>
        <p className="text-sm text-ink-400 mb-6">{modo === 'entrar' ? 'Aceda à área do cliente' : 'Criar acesso à área do cliente'}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" required autoFocus />
          <input type="password" placeholder="Palavra-passe" value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" required minLength={6} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-60">
            {modo === 'entrar' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? 'A processar...' : modo === 'entrar' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <p className="text-sm text-ink-400 mt-4 text-center">
          {modo === 'entrar' ? (
            <>Ainda não tem conta? <button onClick={() => { setModo('criar'); setError(''); }} className="text-brand-600 hover:underline">Criar conta</button></>
          ) : (
            <>Já tem conta? <button onClick={() => { setModo('entrar'); setError(''); }} className="text-brand-600 hover:underline">Entrar</button></>
          )}
        </p>

        <p className="text-xs text-ink-300 mt-4 text-center">
          Use o mesmo email que nos forneceu — é assim que associamos a sua conta às suas obras.
        </p>
      </div>
    </div>
  );
}
