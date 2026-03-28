import { createClient } from '@supabase/supabase-js';
import { env, requireEnv } from './env.js';

export const supabase = createClient(
  requireEnv('SUPABASE_URL', env.supabaseUrl),
  requireEnv('SUPABASE_SERVICE_KEY', env.supabaseServiceKey),
  {
    auth: { persistSession: false },
  }
);
