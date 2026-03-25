/**
 * @jest-environment node
 */

import { getClientIp } from '@/lib/api-response';

describe('getClientIp', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('prefers trusted direct IP headers over x-forwarded-for', () => {
        process.env.VERCEL_URL = 'fintechterms.vercel.app';
        const request = new Request('http://localhost:3000/api/test', {
            headers: {
                'x-forwarded-for': '198.51.100.10, 10.0.0.2',
                'x-real-ip': '203.0.113.25',
            },
        });

        expect(getClientIp(request)).toBe('203.0.113.25');
    });

    it('accepts x-forwarded-for only when a trusted platform env is present', () => {
        process.env.RENDER = 'true';
        const request = new Request('http://localhost:3000/api/test', {
            headers: {
                'x-forwarded-for': '203.0.113.10',
            },
        });

        expect(getClientIp(request)).toBe('203.0.113.10');
    });

    it('falls back to unknown for forwarded headers without a trusted platform env', () => {
        const request = new Request('http://localhost:3000/api/test', {
            headers: {
                'x-forwarded-for': '203.0.113.10',
                'x-real-ip': '203.0.113.25',
            },
        });

        expect(getClientIp(request)).toBe('unknown');
    });
});
