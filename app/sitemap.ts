import type { MetadataRoute } from 'next';
import { ROOT_SITEMAP_UPDATED_AT, STATIC_PUBLIC_PAGE_UPDATED_AT } from '@/lib/public-sitemap-freshness';
import { getSiteUrl } from '@/lib/site-url';
import { buildAbsolutePublicLocaleAlternates, buildAbsoluteXDefaultAlternates, buildLocalePath } from '@/lib/seo-routing';
import { listSeoContributors, listSeoTerms, listSeoTopics } from '@/lib/public-seo-catalog';
import type { Language } from '@/types';

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

type SitemapEntry = MetadataRoute.Sitemap[number];

interface LocalizedSitemapEntryOptions {
    readonly siteUrl: string;
    readonly locale: Language;
    readonly suffix: string;
    readonly lastModified: string;
    readonly changeFrequency: SitemapEntry['changeFrequency'];
    readonly priority: number;
}

const buildLocalizedSitemapEntry = ({
    siteUrl,
    locale,
    suffix,
    lastModified,
    changeFrequency,
    priority,
}: LocalizedSitemapEntryOptions): SitemapEntry => ({
    url: `${siteUrl}${buildLocalePath(locale, suffix)}`,
    lastModified: new Date(lastModified),
    changeFrequency,
    priority,
    alternates: {
        languages: buildAbsolutePublicLocaleAlternates(suffix),
    },
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = getSiteUrl();
    const [terms, topics, contributors] = await Promise.all([
        listSeoTerms(),
        listSeoTopics(),
        listSeoContributors(),
    ]);
    const locales = ['ru', 'en', 'tr'] as const;

    const localeEntries = locales.flatMap((locale) => (
        STATIC_LOCALE_PAGES.map((page) => buildLocalizedSitemapEntry({
            siteUrl,
            locale,
            suffix: page.suffix,
            lastModified: page.updatedAt,
            changeFrequency: 'weekly',
            priority: page.priority,
        }))
    ));

    const topicEntries = locales.flatMap((locale) => (
        topics.map((topic) => buildLocalizedSitemapEntry({
            siteUrl,
            locale,
            suffix: `/topics/${topic.slug}`,
            lastModified: topic.updated_at,
            changeFrequency: 'weekly',
            priority: 0.8,
        }))
    ));

    const contributorEntries = locales.flatMap((locale) => (
        contributors.map((contributor) => buildLocalizedSitemapEntry({
            siteUrl,
            locale,
            suffix: `/authors/${contributor.slug}`,
            lastModified: contributor.updated_at,
            changeFrequency: 'monthly',
            priority: 0.55,
        }))
    ));

    const termEntries = locales.flatMap((locale) => (
        terms.map((term) => buildLocalizedSitemapEntry({
            siteUrl,
            locale,
            suffix: `/glossary/${term.slug}`,
            lastModified: term.updated_at,
            changeFrequency: 'monthly',
            priority: term.index_priority === 'high' ? 0.9 : 0.65,
        }))
    ));

    return [
        {
            url: siteUrl,
            lastModified: new Date(ROOT_SITEMAP_UPDATED_AT),
            changeFrequency: 'weekly',
            priority: 1,
            alternates: {
                languages: buildAbsoluteXDefaultAlternates(),
            },
        },
        ...localeEntries,
        ...topicEntries,
        ...contributorEntries,
        ...termEntries,
    ];
}
