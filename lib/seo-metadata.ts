import type { Metadata } from 'next';
import { buildAbsoluteUrl, buildLocaleAlternates, formatSeoTitle, getOpenGraphLocale } from '@/lib/seo-routing';
import type { Language } from '@/types';

interface SeoMetadataOptions {
    locale: Language;
    title: string;
    description: string;
    path: string;
    type?: 'website' | 'article';
    imagePath?: string;
    noindex?: boolean;
}

const DEFAULT_IMAGE_PATH = '/home-logo.png';

export const buildSeoMetadata = ({
    locale,
    title,
    description,
    path,
    type = 'website',
    imagePath = DEFAULT_IMAGE_PATH,
    noindex = false,
}: SeoMetadataOptions): Metadata => ({
    title: formatSeoTitle(title),
    description,
    alternates: {
        canonical: path,
        languages: buildLocaleAlternates(path.replace(`/${locale}`, '')),
    },
    robots: noindex ? {
        index: false,
        follow: false,
    } : undefined,
    openGraph: {
        title: formatSeoTitle(title),
        description,
        url: buildAbsoluteUrl(path),
        type,
        locale: getOpenGraphLocale(locale),
        images: [
            {
                url: buildAbsoluteUrl(imagePath),
                width: imagePath === DEFAULT_IMAGE_PATH ? 512 : 1200,
                height: imagePath === DEFAULT_IMAGE_PATH ? 512 : 630,
                alt: formatSeoTitle(title),
            },
        ],
    },
    twitter: {
        card: imagePath === DEFAULT_IMAGE_PATH ? 'summary' : 'summary_large_image',
        title: formatSeoTitle(title),
        description,
        images: [buildAbsoluteUrl(imagePath)],
    },
});
