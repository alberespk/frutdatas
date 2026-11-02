import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null quando o .env.local ainda não foi preenchido. */
export const supabase: SupabaseClient | null =
  url && chave
    ? createClient(url, chave, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "frutdatas-sessao" },
      })
    : null;
