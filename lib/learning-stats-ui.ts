import type { Language } from '@/types';
import type { LearningStatsMissingSegment } from '@/types/gamification';

const partialNoticeCopyByLanguage = {
    en: {
        title: 'Showing partial learning analytics',
        descriptionPrefix: 'Some sections are temporarily unavailable:',
        labels: {
            heatmap: 'heatmap',
            streak: 'streak summary',
            badges: 'badges',
            metrics: 'review metrics',
            recentAttempts: 'recent activity',
        },
    },
    tr: {
        title: 'Kismi ogrenme analitigi gosteriliyor',
        descriptionPrefix: 'Bazi bolumler gecici olarak kullanilamiyor:',
        labels: {
            heatmap: 'isi haritasi',
            streak: 'seri ozeti',
            badges: 'rozetler',
            metrics: 'tekrar metrikleri',
            recentAttempts: 'son etkinlik',
        },
    },
    ru: {
        title: 'Показана частичная учебная аналитика',
        descriptionPrefix: 'Некоторые разделы временно недоступны:',
        labels: {
            heatmap: 'тепловая карта',
            streak: 'сводка серии',
            badges: 'значки',
            metrics: 'метрики повторения',
            recentAttempts: 'недавняя активность',
        },
    },
} as const;

export interface LearningStatsPartialNotice {
    title: string;
    description: string;
}

export const getLearningStatsPartialNotice = (
    language: Language,
    missingSegments: LearningStatsMissingSegment[]
): LearningStatsPartialNotice => {
    const copy = partialNoticeCopyByLanguage[language] ?? partialNoticeCopyByLanguage.en;
    const missingLabels = missingSegments.map((segment) => copy.labels[segment]).join(', ');

    return {
        title: copy.title,
        description: `${copy.descriptionPrefix} ${missingLabels}.`,
    };
};
