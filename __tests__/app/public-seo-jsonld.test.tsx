/**
 * @jest-environment node
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

describe('public SEO JSON-LD markup', () => {
    it('renders glossary term schema markup for localized term pages', async () => {
        const SeoTermPage = (await import('@/app/(public)/[locale]/glossary/[slug]/page')).default;
        const markup = renderToStaticMarkup(await SeoTermPage({
            params: Promise.resolve({ locale: 'en', slug: 'tokenization' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"DefinedTerm"');
        expect(markup).toContain('"@type":"BreadcrumbList"');
    });

    it('renders collection schema markup for localized topic pages', async () => {
        const TopicPage = (await import('@/app/(public)/[locale]/topics/[topicSlug]/page')).default;
        const markup = renderToStaticMarkup(await TopicPage({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
    });

    it('renders person or organization schema markup for localized author pages', async () => {
        const AuthorPage = (await import('@/app/(public)/[locale]/authors/[authorSlug]/page')).default;
        const markup = renderToStaticMarkup(await AuthorPage({
            params: Promise.resolve({ locale: 'en', authorSlug: 'kagan-samet-durmus' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"Person"');
        expect(markup).toContain('Kağan Samet Durmuş');
    });
});
