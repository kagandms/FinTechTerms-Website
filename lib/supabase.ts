import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getPublicEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

const SUPABASE_PLACEHOLDERS = new Set([
    '',
    'your_anon_key_here',
    'https://your-project.supabase.co',
]);

type AppSupabaseClient = SupabaseClient;

let client: AppSupabaseClient | null = null;
let nullClient: AppSupabaseClient | null = null;
let hasWarnedAboutMissingEnv = false;

const createClientOptions = () => ({
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
});

const isConfiguredValue = (value: string | null | undefined): value is string => (
    typeof value === 'string'
    && value.trim().length > 0
    && !SUPABASE_PLACEHOLDERS.has(value.trim())
);

const createNullClient = (): AppSupabaseClient => {
    if (!nullClient) {
        nullClient = createClient(
            'http://127.0.0.1:54321',
            'anon',
            createClientOptions()
        );
    }

    return nullClient;
};

export function getSupabaseClient(): AppSupabaseClient {
    if (client) {
        return client;
    }

    const env = getPublicEnv();
    const url = env.supabaseUrl;
    const key = env.supabaseAnonKey;

    if (!isConfiguredValue(url) || !isConfiguredValue(key)) {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
            throw new Error(
                '[FinTechTerms] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
                'Copy .env.example to .env.local and fill in the values.'
            );
        }

        if (!hasWarnedAboutMissingEnv) {
            logger.warn('[FinTechTerms] Supabase env vars missing or placeholders detected - running in guest mode.', {
                route: 'getSupabaseClient',
            });
            hasWarnedAboutMissingEnv = true;
        }

        return createNullClient();
    }

    client = createClient(url, key, createClientOptions());
    return client;
}

export type { Database };
