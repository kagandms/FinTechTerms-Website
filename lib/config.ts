const PLACEHOLDER_VALUES = new Set([
    '',
    'your_anon_key_here',
    'https://your-project.supabase.co',
]);

export function assertRequiredEnv(): void {
    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ] as const;

    const missing = required.filter((key) => {
        const value = process.env[key];
        return !value || PLACEHOLDER_VALUES.has(value);
    });

    if (missing.length > 0) {
        console.warn(`[FinTechTerms] Missing environment variables: ${missing.join(', ')}`);
    }
}
