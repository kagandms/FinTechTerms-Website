import {
    formatTaxonomyLabel,
    getContextTagLabels,
    getRegionalMarketBadgeConfig,
} from '@/lib/termTaxonomy';

describe('term taxonomy helpers', () => {
    it('humanizes known taxonomy values for card badges and chips', () => {
        expect(formatTaxonomyLabel('mis')).toBe('MIS');
        expect(formatTaxonomyLabel('comparative-economics-mis')).toBe('Comparative Economics MIS');
    });

    it('flattens context tags into stable, unique labels', () => {
        const labels = getContextTagLabels({
            target_universities: ['SPbU', 'HSE'],
            disciplines: ['economics', 'mis', 'economics'],
            contest_profile: 'comparative-economics-mis',
        });

        expect(labels).toEqual([
            'Economics',
            'MIS',
            'SPbU',
            'HSE',
            'Comparative Economics MIS',
        ]);
    });

    it('returns distinct styling metadata for regional markets', () => {
        expect(getRegionalMarketBadgeConfig('MOEX').label).toBe('MOEX');
        expect(getRegionalMarketBadgeConfig('BIST').className).toContain('rose');
    });
});
