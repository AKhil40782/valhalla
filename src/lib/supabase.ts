
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabase) {
            if (!supabaseUrl) {
                throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
            }
            _supabase = createClient(supabaseUrl, supabaseAnonKey);
        }
        return (_supabase as any)[prop];
    }
});
