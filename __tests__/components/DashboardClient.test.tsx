import { buildFatigueChartData, buildLearningCurveData } from '@/components/DashboardClient';

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
});
