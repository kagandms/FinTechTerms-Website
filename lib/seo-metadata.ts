import type { Metadata } from 'next';
import { buildAbsolutePublicLocaleAlternates, buildAbsoluteUrl, buildPublicOpenGraphImagePath, formatSeoTitle, getOpenGraphLocale } from '@/lib/seo-routing';
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

const OPEN_GRAPH_IMAGE_WIDTH = 1200;
const OPEN_GRAPH_IMAGE_HEIGHT = 630;

export const buildSeoMetadata = (options: SeoMetadataOptions): Metadata => {
    const {
        locale,
        title,
        description,
        path,
        type = 'website',
        imagePath = buildPublicOpenGraphImagePath(locale),
        noindex = false,
    } = options;

    return ({
        metadataBase: new URL(buildAbsoluteUrl('')),
        title: formatSeoTitle(title),
        description,
        alternates: {
            canonical: buildAbsoluteUrl(path),
            languages: buildAbsolutePublicLocaleAlternates(path.replace(`/${locale}`, '')),
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
                    width: OPEN_GRAPH_IMAGE_WIDTH,
                    height: OPEN_GRAPH_IMAGE_HEIGHT,
                    alt: formatSeoTitle(title),
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: formatSeoTitle(title),
            description,
            images: [buildAbsoluteUrl(imagePath)],
        },
    });
};
