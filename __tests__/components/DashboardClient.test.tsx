import {
    buildDistributionChartData,
    buildFatigueChartData,
    buildLearningCurveData,
} from '@/components/DashboardClient';

describe('DashboardClient analytics transforms', () => {
    it('preserves real calendar dates in the learning curve output', () => {
        const result = buildLearningCurveData([
            { created_at: '2026-03-01T10:00:00.000Z', is_correct: true },
            { created_at: '2026-03-03T10:00:00.000Z', is_correct: false },
        ]);

        expect(result).toEqual([
            { date: '2026-03-01', accuracy: 100 },
            { date: '2026-03-03', accuracy: 0 },
        ]);
    });

    it('uses session_id boundaries so same-day sessions are not merged into one fatigue run', () => {
        const result = buildFatigueChartData([
            {
                session_id: 'session-a',
                user_id: 'user-1',
                is_correct: true,
                created_at: '2026-03-01T10:00:00.000Z',
            },
            {
                session_id: 'session-a',
                user_id: 'user-1',
                is_correct: false,
                created_at: '2026-03-01T10:01:00.000Z',
            },
            {
                session_id: 'session-b',
                user_id: 'user-1',
                is_correct: false,
                created_at: '2026-03-01T18:00:00.000Z',
            },
        ]);

        expect(result).toEqual([
            { order: 1, errorRate: 50 },
            { order: 2, errorRate: 100 },
        ]);
    });

    it('excludes records with neither session_id nor user_id from the fatigue chart', () => {
        const result = buildFatigueChartData([
            {
                session_id: null,
                user_id: null,
                is_correct: false,
                created_at: '2026-03-01T10:00:00.000Z',
            },
        ]);

        expect(result).toEqual([]);
    });

    it('excludes anonymous records from the per-user distribution chart', () => {
        const result = buildDistributionChartData([
            {
                user_id: null,
                is_correct: true,
            },
            {
                user_id: 'user-1',
                is_correct: true,
            },
            {
                user_id: 'user-1',
                is_correct: false,
            },
        ]);

        expect(result.find((entry) => entry.range === '50-55%')).toMatchObject({
            count: 1,
        });
        expect(result.reduce((sum, entry) => sum + entry.count, 0)).toBe(1);
    });
});
