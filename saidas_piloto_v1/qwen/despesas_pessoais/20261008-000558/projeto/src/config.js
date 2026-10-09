import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error(
    'ERRO: variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY não configuradas.\n' +
    'Leia o README.md — você precisa cadastrar um projeto gratuito no Supabase\n' +
    'e colocar a URL e a Service Key (veja a seção "Passo a passo").'
  );
  process.exit(1);
}

export const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
