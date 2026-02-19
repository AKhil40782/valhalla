
import { createClient, SupabaseClient } from '@supabase/supabase-js';

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not Set');
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not Set');

// TODO: Remove hardcoded fallbacks after restarting the server to pick up env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lskduvcaahmhydaqvnjq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_YFO_w48vUCJ1XoYJO_6z-w_wyvhgXhi';


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
