import { buildAbsoluteUrl, buildLocalePath } from '@/lib/seo-routing';
import type { Language } from '@/types';

interface BreadcrumbInput {
    readonly name: string;
    readonly path: string;
}

export const buildBreadcrumbJsonLd = (
    locale: Language,
    items: readonly BreadcrumbInput[]
) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'FinTechTerms',
            item: buildAbsoluteUrl(buildLocalePath(locale)),
        },
        ...items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 2,
            name: item.name,
            item: buildAbsoluteUrl(item.path),
        })),
    ],
});

export const buildOrganizationJsonLd = (locale: Language) => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FinTechTerms',
    url: buildAbsoluteUrl(buildLocalePath(locale)),
    logo: buildAbsoluteUrl('/icons/icon-512.png'),
    sameAs: [
        'https://t.me/FinTechTermsBot',
    ],
    founder: {
        '@type': 'Person',
        name: 'Kağan Samet Durmuş',
        url: buildAbsoluteUrl(buildLocalePath(locale, '/authors/kagan-samet-durmus')),
    },
    publishingPrinciples: buildAbsoluteUrl(buildLocalePath(locale, '/editorial-policy')),
    contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'editorial corrections',
        email: 'fintechterms@mail.ru',
        url: buildAbsoluteUrl(buildLocalePath(locale, '/contact')),
    },
});
