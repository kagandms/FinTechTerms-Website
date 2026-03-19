import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { safeGetSupabaseUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { isAdminUserId } from '@/lib/admin-access';
import { authorityTargets } from '@/data/seo/authority-targets';
import { listPriorityTermRecords, listSeoTerms } from '@/lib/public-seo-catalog';

const getSeoReadiness = async () => {
    const [terms, priorityRecords] = await Promise.all([
        listSeoTerms(),
        listPriorityTermRecords(),
    ]);
    const priorityTerms = priorityRecords
        .map((record) => terms.find((term) => term.slug === record.slug))
        .filter((term): term is NonNullable<typeof term> => Boolean(term));
    const sourceReady = priorityTerms.filter((term) => term.source_refs.length >= 3).length;
    const relationReady = priorityTerms.filter((term) => (
        term.related_term_ids.length >= 3
        && Boolean(term.comparison_term_id)
        && Boolean(term.prerequisite_term_id)
    )).length;
    const localeReady = priorityTerms.filter((term) => (
        Boolean(term.expanded_definition.en.trim())
        && Boolean(term.expanded_definition.ru.trim())
        && Boolean(term.expanded_definition.tr.trim())
    )).length;
    const marketReady = priorityTerms.filter((term) => term.regional_markets.length >= 1).length;

    return {
        total: priorityRecords.length,
        sourceReady,
        relationReady,
        localeReady,
        marketReady,
        anchorCount: priorityRecords.filter((record) => record.tier === 'anchor').length,
        authorityPlanned: authorityTargets.length,
    };
};

export default async function SeoDashboardPage() {
    const env = getServerEnv();
    const supabaseAuth = await createClient();
    const authState = await safeGetSupabaseUser(supabaseAuth);

    if (!isAdminUserId(authState.user?.id ?? null, env)) {
        redirect('/dashboard');
    }

    const readiness = await getSeoReadiness();
    const kpis = [
        'Referring domains to locale home, topic hubs, and anchor term pages',
        'Branded vs non-brand impressions by locale',
        'Anchor term clicks and CTR',
        'Priority term index coverage and crawl depth',
        'Owned-channel mentions published vs planned',
    ];

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">SEO Acceptance</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">85+ SEO readiness dashboard</h1>
                </div>
                <Link href="/ru" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-950">
                    Open public RU surface
                </Link>
            </div>

            <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                {[
                    { label: 'Priority terms', value: readiness.total },
                    { label: 'Anchor terms', value: readiness.anchorCount },
                    { label: 'Source quorum', value: `${readiness.sourceReady}/${readiness.total}` },
                    { label: 'Relation completeness', value: `${readiness.relationReady}/${readiness.total}` },
                    { label: 'Locale completeness', value: `${readiness.localeReady}/${readiness.total}` },
                    { label: 'Authority targets', value: readiness.authorityPlanned },
                ].map((card) => (
                    <div key={card.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-500">{card.label}</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">{card.value}</p>
                    </div>
                ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">Release gates</h2>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                        <li>`html lang` must match locale on `/ru`, `/en`, `/tr` and representative term pages.</li>
                        <li>Priority terms require at least 3 sources, at least 3 related terms, comparison, prerequisite, author, reviewer, and reviewed_at.</li>
                        <li>Lighthouse budget must pass on locale home, topic hub, and anchor term pages before release.</li>
                    </ul>
                </article>
                <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-950">Authority backlog</h2>
                    <div className="mt-4 space-y-3">
                        {authorityTargets.slice(0, 6).map((target) => (
                            <div key={target.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{target.channel}</p>
                                <p className="mt-1 text-lg font-semibold text-slate-950">{target.name}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{target.rationale}</p>
                            </div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">Weekly KPI track</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                    {kpis.map((kpi) => (
                        <li key={kpi}>{kpi}</li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
