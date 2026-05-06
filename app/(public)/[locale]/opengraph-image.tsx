import { ImageResponse } from 'next/og';
import { isPublicLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = {
    width: 1200,
    height: 630,
};

interface OpenGraphImageProps {
    readonly params: Promise<{ locale: string }>;
}

interface OpenGraphCopy {
    readonly label: string;
    readonly title: string;
    readonly description: string;
    readonly trustSignal: string;
}

const imageCopy: Record<Language, OpenGraphCopy> = {
    en: {
        label: 'FinTechTerms EN',
        title: 'Multilingual fintech glossary',
        description: 'Topic hubs, reviewed term pages, source references, and public trust signals for finance and technology terminology.',
        trustSignal: 'Server-rendered public SEO layer',
    },
    ru: {
        label: 'FinTechTerms RU',
        title: 'Многоязычный финтех-глоссарий',
        description: 'Тематические хабы, проверенные страницы терминов, ссылки на источники и публичные сигналы доверия.',
        trustSignal: 'Серверно-рендеримый public SEO слой',
    },
    tr: {
        label: 'FinTechTerms TR',
        title: 'Çok dilli fintek sözlüğü',
        description: 'Topic hub yapısı, incelenmiş terim sayfaları, kaynak referansları ve kamusal güven sinyalleri.',
        trustSignal: 'Server-rendered public SEO katmanı',
    },
};

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
    const { locale: rawLocale } = await params;
    const locale = isPublicLocale(rawLocale) ? rawLocale : 'en';
    const copy = imageCopy[locale];

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '58px',
                    background: 'linear-gradient(135deg, #0f172a 0%, #0369a1 48%, #10b981 100%)',
                    color: '#f8fafc',
                    fontFamily: 'sans-serif',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '18px',
                            fontSize: 30,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}
                    >
                        <span>FinTechTerms</span>
                        <span style={{ color: '#bfdbfe' }}>{locale.toUpperCase()}</span>
                    </div>
                    <div
                        style={{
                            borderRadius: '999px',
                            border: '1px solid rgba(255, 255, 255, 0.24)',
                            background: 'rgba(15, 23, 42, 0.34)',
                            padding: '14px 22px',
                            fontSize: 24,
                            fontWeight: 700,
                        }}
                    >
                        {copy.label}
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        maxWidth: '940px',
                    }}
                >
                    <div
                        style={{
                            fontSize: 76,
                            lineHeight: 1.02,
                            fontWeight: 900,
                            letterSpacing: 0,
                        }}
                    >
                        {copy.title}
                    </div>
                    <div
                        style={{
                            maxWidth: '860px',
                            fontSize: 34,
                            lineHeight: 1.32,
                            color: '#e2e8f0',
                        }}
                    >
                        {copy.description}
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '24px',
                        borderRadius: '28px',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        background: 'rgba(15, 23, 42, 0.36)',
                        padding: '24px 28px',
                    }}
                >
                    <div style={{ fontSize: 28, fontWeight: 800 }}>
                        {copy.trustSignal}
                    </div>
                    <div style={{ fontSize: 24, color: '#bfdbfe' }}>
                        Glossary · Sources · Editorial review
                    </div>
                </div>
            </div>
        ),
        size
    );
}
