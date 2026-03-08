import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api/'], // Disallow admin and internal api routes
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
