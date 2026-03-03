import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api/'], // Disallow admin and internal api routes
        },
        sitemap: 'https://fintechterms.com/sitemap.xml',
    };
}
