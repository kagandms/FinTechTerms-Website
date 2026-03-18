import type { MetadataRoute } from 'next';
import { ROOT_SITEMAP_UPDATED_AT, STATIC_PUBLIC_PAGE_UPDATED_AT } from '@/lib/public-sitemap-freshness';
import { getSiteUrl } from '@/lib/site-url';
import { buildLocalePath } from '@/lib/seo-routing';
import { listSeoContributors, listSeoTerms, listSeoTopics } from '@/lib/public-seo-catalog';

const STATIC_LOCALE_PAGES = [
    { suffix: '', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.home, priority: 0.95 },
    { suffix: '/glossary', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.glossary, priority: 0.8 },
    { suffix: '/sources', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.sources, priority: 0.8 },
    { suffix: '/editorial-policy', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.editorialPolicy, priority: 0.8 },
    { suffix: '/corrections', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.corrections, priority: 0.8 },
    { suffix: '/methodology', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.methodology, priority: 0.8 },
    { suffix: '/about', updatedAt: STATIC_PUBLIC_PAGE_UPDATED_AT.about, priority: 0.8 },
] as const;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = getSiteUrl();
    const [terms, topics, contributors] = await Promise.all([
        listSeoTerms(),
        listSeoTopics(),
        listSeoContributors(),
    ]);
    const locales = ['ru', 'en', 'tr'] as const;

    const localeEntries = locales.flatMap((locale) => (
        STATIC_LOCALE_PAGES.map((page) => ({
            url: `${siteUrl}${buildLocalePath(locale, page.suffix)}`,
            lastModified: new Date(page.updatedAt),
            changeFrequency: 'weekly' as const,
            priority: page.priority,
        }))
    ));

    const topicEntries = locales.flatMap((locale) => (
        topics.map((topic) => ({
            url: `${siteUrl}${buildLocalePath(locale, `/topics/${topic.slug}`)}`,
            lastModified: new Date(topic.updated_at),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }))
    ));

    const contributorEntries = locales.flatMap((locale) => (
        contributors.map((contributor) => ({
            url: `${siteUrl}${buildLocalePath(locale, `/authors/${contributor.slug}`)}`,
            lastModified: new Date(contributor.updated_at),
            changeFrequency: 'monthly' as const,
            priority: 0.55,
        }))
    ));

    const termEntries = locales.flatMap((locale) => (
        terms.map((term) => ({
            url: `${siteUrl}${buildLocalePath(locale, `/glossary/${term.slug}`)}`,
            lastModified: new Date(term.updated_at),
            changeFrequency: 'monthly' as const,
            priority: term.index_priority === 'high' ? 0.9 : 0.65,
        }))
    ));

    return [
        {
            url: siteUrl,
            lastModified: new Date(ROOT_SITEMAP_UPDATED_AT),
            changeFrequency: 'weekly',
            priority: 1,
        },
        ...localeEntries,
        ...topicEntries,
        ...contributorEntries,
        ...termEntries,
    ];
}
