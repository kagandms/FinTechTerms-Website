import { buildContentSecurityPolicy } from '@/lib/csp';

describe('content security policy', () => {
    it('keeps static App Router hydration scripts executable', () => {
        const policy = buildContentSecurityPolicy('request-nonce');

        expect(policy).toContain("script-src 'self' 'unsafe-inline'");
        expect(policy).not.toContain("'nonce-request-nonce'");
    });

    it('allows Google Analytics script and collection endpoints', () => {
        const policy = buildContentSecurityPolicy('request-nonce');

        expect(policy).toContain('https://www.googletagmanager.com');
        expect(policy).toContain('https://www.google-analytics.com');
        expect(policy).toContain('https://*.google-analytics.com');
        expect(policy).toContain('https://stats.g.doubleclick.net');
    });
});
