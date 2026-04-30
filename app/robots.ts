import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api/', '/dashboard', '/favorites', '/profile', '/quiz', '/search', '/term/'],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
