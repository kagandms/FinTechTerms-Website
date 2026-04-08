import {
    buildLatencyChartData,
    buildDistributionChartData,
    buildFatigueChartData,
    buildLearningCurveData,
} from '@/components/DashboardClient';

describe('DashboardClient analytics transforms', () => {
    it('preserves real calendar dates in the aggregate learning curve output', () => {
        const result = buildLearningCurveData([
            { date: '2026-03-03', accuracy: 0 },
            { date: '2026-03-01', accuracy: 100 },
        ]);

        expect(result).toEqual([
            { date: '2026-03-01', accuracy: 100 },
            { date: '2026-03-03', accuracy: 0 },
        ]);
    });

    it('sorts aggregate fatigue rows by question order', () => {
        const result = buildFatigueChartData([
            {
                order: 2,
                errorRate: 100,
            },
            {
                order: 1,
                errorRate: 50,
            },
        ]);

        expect(result).toEqual([
            { order: 1, errorRate: 50 },
            { order: 2, errorRate: 100 },
        ]);
    });

    it('keeps latency summary in correct/incorrect chart order', () => {
        const result = buildLatencyChartData([
            { name: 'Incorrect', ms: 1400 },
        ]);

        expect(result).toEqual([
            { name: 'Correct', ms: 0 },
            { name: 'Incorrect', ms: 1400 },
        ]);
    });

    it('sorts aggregate distribution bins numerically with 100% last', () => {
        const result = buildDistributionChartData([
            {
                range: '100%',
                count: 2,
            },
            {
                range: '50-55%',
                count: 1,
            },
            {
                range: '0-5%',
                count: 3,
            },
        ]);

        expect(result).toEqual([
            { range: '0-5%', count: 3 },
            { range: '50-55%', count: 1 },
            { range: '100%', count: 2 },
        ]);
    });
});
