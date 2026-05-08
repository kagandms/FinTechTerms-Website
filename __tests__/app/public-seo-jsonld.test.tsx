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
    it('renders locale homepage schema without a single-item breadcrumb', async () => {
        const LocaleHomePage = (await import('@/app/(public)/[locale]/page')).default;
        const markup = renderToStaticMarkup(await LocaleHomePage({
            params: Promise.resolve({ locale: 'en' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"WebSite"');
        expect(markup).toContain('"@type":"Organization"');
        expect(markup).toContain('"logo":"http://localhost:3000/icons/icon-512.png"');
        expect(markup).not.toContain('"@type":"BreadcrumbList"');
    });

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

    it('renders glossary letter group schema markup', async () => {
        const GlossaryLetterPage = (await import('@/app/(public)/[locale]/glossary/letter/[group]/page')).default;
        const markup = renderToStaticMarkup(await GlossaryLetterPage({
            params: Promise.resolve({ locale: 'en', group: 'p' }),
        }));
        const ruMarkup = renderToStaticMarkup(await GlossaryLetterPage({
            params: Promise.resolve({ locale: 'ru', group: '%D0%B0' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"DefinedTermSet"');
        expect(markup).toContain('"@type":"BreadcrumbList"');
        expect(markup).toContain('/en/glossary/payment-gateway');
        expect(ruMarkup).toContain('"@type":"DefinedTermSet"');
        expect(ruMarkup).toContain('/ru/glossary/');
    });

    it('renders collection schema markup for localized topic pages', async () => {
        const TopicPage = (await import('@/app/(public)/[locale]/topics/[topicSlug]/page')).default;
        const markup = renderToStaticMarkup(await TopicPage({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
        expect(markup).toContain('"@type":"BreadcrumbList"');
    });

    it('renders full topic term index schema markup', async () => {
        const TopicTermsPage = (await import('@/app/(public)/[locale]/topics/[topicSlug]/terms/page')).default;
        const markup = renderToStaticMarkup(await TopicTermsPage({
            params: Promise.resolve({ locale: 'en', topicSlug: 'cards-payments' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
        expect(markup).toContain('"@type":"ItemList"');
        expect(markup).toContain('"@type":"BreadcrumbList"');
        expect(markup).toContain('Acceptance stack');
        expect(markup).toContain('All terms in this topic');
        expect(markup).toContain('/en/glossary/payment-gateway');
        expect(markup).not.toContain('Service processing credit card transactions.');
    });

    it('renders source library collection schema markup', async () => {
        const SourcesPage = (await import('@/app/(public)/[locale]/sources/page')).default;
        const markup = renderToStaticMarkup(await SourcesPage({
            params: Promise.resolve({ locale: 'en' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"CollectionPage"');
        expect(markup).toContain('"@type":"CreativeWork"');
        expect(markup).toContain('"@type":"BreadcrumbList"');
    });

    it('renders editorial trust page schema markup', async () => {
        const EditorialPolicyPage = (await import('@/app/(public)/[locale]/editorial-policy/page')).default;
        const CorrectionsPage = (await import('@/app/(public)/[locale]/corrections/page')).default;
        const MethodologyPage = (await import('@/app/(public)/[locale]/methodology/page')).default;
        const AboutPage = (await import('@/app/(public)/[locale]/about/page')).default;

        const editorialMarkup = renderToStaticMarkup(await EditorialPolicyPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const correctionsMarkup = renderToStaticMarkup(await CorrectionsPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const methodologyMarkup = renderToStaticMarkup(await MethodologyPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const aboutMarkup = renderToStaticMarkup(await AboutPage({
            params: Promise.resolve({ locale: 'en' }),
        }));

        expect(editorialMarkup).toContain('"@type":"WebPage"');
        expect(editorialMarkup).toContain('"@type":"WebPageElement"');
        expect(editorialMarkup).toContain('"@type":"BreadcrumbList"');
        expect(correctionsMarkup).toContain('"@type":"WebPage"');
        expect(correctionsMarkup).toContain('"@type":"BreadcrumbList"');
        expect(methodologyMarkup).toContain('"@type":"WebPageElement"');
        expect(methodologyMarkup).toContain('"@type":"BreadcrumbList"');
        expect(aboutMarkup).toContain('"@type":"AboutPage"');
        expect(aboutMarkup).toContain('"@type":"Organization"');
        expect(aboutMarkup).toContain('"@type":"BreadcrumbList"');
    });

    it('renders support page schema markup for privacy, terms, and contact pages', async () => {
        const PrivacyPage = (await import('@/app/(public)/[locale]/privacy/page')).default;
        const TermsPage = (await import('@/app/(public)/[locale]/terms/page')).default;
        const ContactPage = (await import('@/app/(public)/[locale]/contact/page')).default;

        const privacyMarkup = renderToStaticMarkup(await PrivacyPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const termsMarkup = renderToStaticMarkup(await TermsPage({
            params: Promise.resolve({ locale: 'en' }),
        }));
        const contactMarkup = renderToStaticMarkup(await ContactPage({
            params: Promise.resolve({ locale: 'en' }),
        }));

        expect(privacyMarkup).toContain('"@type":"WebPage"');
        expect(privacyMarkup).toContain('"@type":"BreadcrumbList"');
        expect(termsMarkup).toContain('"@type":"WebPage"');
        expect(termsMarkup).toContain('"@type":"BreadcrumbList"');
        expect(contactMarkup).toContain('"@type":"ContactPage"');
        expect(contactMarkup).toContain('"@type":"ContactPoint"');
        expect(contactMarkup).toContain('"@type":"BreadcrumbList"');
    });

    it('renders person or organization schema markup for localized author pages', async () => {
        const AuthorPage = (await import('@/app/(public)/[locale]/authors/[authorSlug]/page')).default;
        const markup = renderToStaticMarkup(await AuthorPage({
            params: Promise.resolve({ locale: 'en', authorSlug: 'kagan-samet-durmus' }),
        }));

        expect(markup).toContain('application/ld+json');
        expect(markup).toContain('"@type":"Person"');
        expect(markup).toContain('Kağan Samet Durmuş');
        expect(markup).toContain('"knowsAbout"');
        expect(markup).toContain('"hasCredential"');
        expect(markup).toContain('"affiliation"');
        expect(markup).toContain('"@type":"BreadcrumbList"');
    });

    it('limits FAQPage schema to high-priority term pages', async () => {
        const { listSeoTerms } = await import('@/lib/public-seo-catalog');
        const SeoTermPage = (await import('@/app/(public)/[locale]/glossary/[slug]/page')).default;
        const terms = await listSeoTerms();
        const standardTerm = terms.find((term) => term.index_priority !== 'high');

        expect(standardTerm).toBeDefined();

        const priorityMarkup = renderToStaticMarkup(await SeoTermPage({
            params: Promise.resolve({ locale: 'en', slug: 'tokenization' }),
        }));
        const standardMarkup = renderToStaticMarkup(await SeoTermPage({
            params: Promise.resolve({ locale: 'en', slug: standardTerm?.slug ?? '' }),
        }));

        expect(priorityMarkup).toContain('"@type":"FAQPage"');
        expect(standardMarkup).not.toContain('"@type":"FAQPage"');
    });
});
