import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { listSitemapTerms } from '@/lib/public-term-catalog';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = getSiteUrl();
    const terms = await listSitemapTerms();

    const termEntries: MetadataRoute.Sitemap = terms.map((term) => ({
        url: `${siteUrl}/term/${term.id}`,
        lastModified: new Date(term.lastModified),
        changeFrequency: 'monthly',
        priority: 0.7,
    }));

    // Static routes
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: siteUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${siteUrl}/search`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${siteUrl}/quiz`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${siteUrl}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];

    return [...staticRoutes, ...termEntries];
}
