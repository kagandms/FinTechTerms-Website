import { MetadataRoute } from 'next';
import { fetchTermsFromSupabase } from '@/lib/supabaseStorage';
import { siteUrl } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Fetch all terms
    const terms = await fetchTermsFromSupabase();

    // Generate term URLs — use updated_at from DB when available
    const termEntries: MetadataRoute.Sitemap = terms.map((term) => ({
        url: `${siteUrl}/term/${term.id}`,
        lastModified: (term as Record<string, unknown>).updated_at
            ? new Date((term as Record<string, unknown>).updated_at as string)
            : new Date('2026-02-01'),
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
