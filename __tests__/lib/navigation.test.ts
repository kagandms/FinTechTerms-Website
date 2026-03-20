import { resolveHomeHref } from '@/lib/navigation';

describe('resolveHomeHref', () => {
    it('routes protected app paths back to /dashboard', () => {
        expect(resolveHomeHref('/dashboard')).toBe('/dashboard');
        expect(resolveHomeHref('/search')).toBe('/dashboard');
        expect(resolveHomeHref('/quiz')).toBe('/dashboard');
        expect(resolveHomeHref('/profile')).toBe('/dashboard');
        expect(resolveHomeHref('/favorites')).toBe('/dashboard');
        expect(resolveHomeHref('/analytics')).toBe('/dashboard');
        expect(resolveHomeHref('/admin/dashboard')).toBe('/dashboard');
    });

    it('routes public and unknown paths back to /', () => {
        expect(resolveHomeHref('/')).toBe('/');
        expect(resolveHomeHref('/about')).toBe('/');
        expect(resolveHomeHref('/en/about')).toBe('/');
        expect(resolveHomeHref('/missing')).toBe('/');
        expect(resolveHomeHref(null)).toBe('/');
    });
});
