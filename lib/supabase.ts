import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SESSAO_TIMEOUT = Symbol('sessao_timeout');

// Na PWA instalada no telemóvel, ao voltar de background o getSession() por
// vezes fica preso num lock antigo e nunca resolve ("A verificar sessão..."
// infinito). Em vez de esperar para sempre, corre a par com um limite de
// tempo — quem chamar decide o que fazer (normalmente recarregar a página,
// o que limpa o lock preso).
export async function getSessionComLimite(timeoutMs = 6000) {
  const timeout = new Promise<typeof SESSAO_TIMEOUT>((resolve) => setTimeout(() => resolve(SESSAO_TIMEOUT), timeoutMs));
  return Promise.race([supabase.auth.getSession(), timeout]);
}
