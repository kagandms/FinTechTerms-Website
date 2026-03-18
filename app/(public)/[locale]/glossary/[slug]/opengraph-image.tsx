import { ImageResponse } from 'next/og';
import {
    getLocalizedTermDefinition,
    getLocalizedTermLabel,
    getSeoTermBySlug,
} from '@/lib/public-seo-catalog';
import { isPublicLocale } from '@/lib/seo-routing';
import type { Language, Term } from '@/types';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = {
    width: 1200,
    height: 630,
};

type OpenGraphImageProps = {
    params: Promise<{ locale: string; slug: string }>;
};

interface OpenGraphCopy {
    readonly title: string;
    readonly subtitle: string;
    readonly description: string;
    readonly market: string;
    readonly category: string;
}

const buildFallbackCopy = (): OpenGraphCopy => ({
    title: 'FinTechTerms',
    subtitle: 'Multilingual fintech glossary',
    description: 'Server-rendered glossary terms for fintech, finance, and technology.',
    market: 'GLOBAL',
    category: 'Glossary',
});

const buildSubtitle = (term: Term, locale: Language): string => {
    const localizedLabel = getLocalizedTermLabel(term, locale);
    const alternateLabels = [term.term_en, term.term_ru, term.term_tr]
        .filter((value) => value !== localizedLabel);

    return Array.from(new Set(alternateLabels)).join(' · ') || 'Multilingual glossary term';
};

const getOpenGraphCopy = async (
    slug: string,
    locale: Language
): Promise<OpenGraphCopy> => {
    const term = await getSeoTermBySlug(slug);

    if (!term) {
        return buildFallbackCopy();
    }

    return {
        title: getLocalizedTermLabel(term, locale),
        subtitle: buildSubtitle(term, locale),
        description: getLocalizedTermDefinition(term, locale),
        market: term.primary_market,
        category: term.category,
    };
};

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
    const { locale: rawLocale, slug } = await params;
    const locale = isPublicLocale(rawLocale) ? rawLocale : 'en';
    const { title, subtitle, description, market, category } = await getOpenGraphCopy(slug, locale);

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '56px',
                    background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 45%, #f59e0b 100%)',
                    color: '#f8fafc',
                    fontFamily: 'sans-serif',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            maxWidth: '860px',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: 28,
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#dbeafe',
                            }}
                        >
                            <span>FinTechTerms</span>
                            <span style={{ opacity: 0.72 }}>{locale.toUpperCase()} Glossary</span>
                        </div>
                        <div
                            style={{
                                fontSize: 76,
                                lineHeight: 1.05,
                                fontWeight: 800,
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                fontSize: 34,
                                fontWeight: 500,
                                color: '#e2e8f0',
                            }}
                        >
                            {subtitle}
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'flex-end',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '168px',
                                borderRadius: '999px',
                                padding: '12px 20px',
                                background: 'rgba(15, 23, 42, 0.38)',
                                border: '1px solid rgba(255, 255, 255, 0.18)',
                                fontSize: 26,
                                fontWeight: 700,
                            }}
                        >
                            {market}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '168px',
                                borderRadius: '999px',
                                padding: '12px 20px',
                                background: 'rgba(255, 255, 255, 0.16)',
                                fontSize: 24,
                                fontWeight: 600,
                            }}
                        >
                            {category}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '18px',
                        padding: '28px 32px',
                        borderRadius: '32px',
                        background: 'rgba(15, 23, 42, 0.34)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 24,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: '#bfdbfe',
                        }}
                    >
                        Definition
                    </div>
                    <div
                        style={{
                            fontSize: 32,
                            lineHeight: 1.35,
                            color: '#f8fafc',
                        }}
                    >
                        {description.slice(0, 180)}
                    </div>
                </div>
            </div>
        ),
        size
    );
}
