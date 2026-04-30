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
        expect(markup).toContain('"citation"');
        expect(markup).toContain('"@type":"CreativeWork"');
    });

    it('renders collection schema markup for localized topic pages', async () => {
        const TopicPage = (await import('@/app/(public)/[locale]/topics/[topicSlug]/page')).default;
        const markup = renderToStaticMarkup(await TopicPage({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
    });

    it('renders full topic term index schema markup', async () => {
        const TopicTermsPage = (await import('@/app/(public)/[locale]/topics/[topicSlug]/terms/page')).default;
        const markup = renderToStaticMarkup(await TopicTermsPage({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
        expect(markup).toContain('"@type":"ItemList"');
        expect(markup).toContain('/en/glossary/payment-gateway');
    });

    it('renders source library collection schema markup', async () => {
        const SourcesPage = (await import('@/app/(public)/[locale]/sources/page')).default;
        const markup = renderToStaticMarkup(await SourcesPage({
            params: Promise.resolve({ locale: 'en' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
        expect(markup).toContain('"@type":"CreativeWork"');
    });

    it('renders editorial trust page schema markup', async () => {
        const EditorialPolicyPage = (await import('@/app/(public)/[locale]/editorial-policy/page')).default;
        const CorrectionsPage = (await import('@/app/(public)/[locale]/corrections/page')).default;
        const MethodologyPage = (await import('@/app/(public)/[locale]/methodology/page')).default;

        const editorialMarkup = renderToStaticMarkup(await EditorialPolicyPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const correctionsMarkup = renderToStaticMarkup(await CorrectionsPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const methodologyMarkup = renderToStaticMarkup(await MethodologyPage({
            params: Promise.resolve({ locale: 'en' }),
        }));

        expect(editorialMarkup).toContain('"@type":"WebPage"');
        expect(editorialMarkup).toContain('"@type":"WebPageElement"');
        expect(correctionsMarkup).toContain('"@type":"WebPage"');
        expect(methodologyMarkup).toContain('"@type":"WebPageElement"');
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
