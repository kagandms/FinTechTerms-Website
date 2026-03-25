import { getLearningStats } from '@/app/actions/getLearningStats';
import AnalyticsPageClient from '@/app/(app)/analytics/AnalyticsPageClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function AnalyticsPage() {
    const learningStats = await getLearningStats();

    return <AnalyticsPageClient learningStats={learningStats} />;
}
