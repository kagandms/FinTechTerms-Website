// ============================================
// Supabase Client Configuration
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables are not set. Using fallback mode.');
}

/**
 * Supabase client for all operations
 * Using standard createClient with proper configuration to avoid SSR client AbortError issues
 */
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
});

// Alias for backward compatibility
export const supabaseAuth = supabase;

/**
 * Database Types (generated from schema)
 * These match our database tables
 */
import { Database } from '@/types/supabase';

export type { Database };

