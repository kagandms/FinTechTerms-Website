import { Award, Flame, Sparkles, Target } from 'lucide-react';
import type { Language } from '@/types';
import type { UserBadgeSummary } from '@/types/gamification';

interface StreakCardProps {
    currentStreak: number;
    badges: UserBadgeSummary[];
    activeDays: number;
    lastStudyDate: string | null;
    language: Language;
}

const locales: Record<Language, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    ru: 'ru-RU',
};

const copy = {
    tr: {
        title: 'Günlük Seri',
        subtitle: 'Seriyi canlı tut ve kilometre taşlarını aç.',
        days: 'gün',
        activeDays: 'aktif gün',
        unlocked: 'açıldı',
        nextMilestone: 'Sonraki kilometre taşı',
        allUnlocked: 'Tüm seri rozetleri açıldı.',
        lastStudy: 'Son çalışma',
        noActivity: 'Henüz çalışma yok',
        milestones: {
            streak_3: '3 Gün',
            streak_7: '7 Gün',
            streak_30: '30 Gün',
        },
    },
    en: {
        title: 'Daily Streak',
        subtitle: 'Keep the streak alive and unlock milestones.',
        days: 'days',
        activeDays: 'active days',
        unlocked: 'unlocked',
        nextMilestone: 'Next milestone',
        allUnlocked: 'All streak badges unlocked.',
        lastStudy: 'Last study',
        noActivity: 'No study yet',
        milestones: {
            streak_3: '3 Days',
            streak_7: '7 Days',
            streak_30: '30 Days',
        },
    },
    ru: {
        title: 'Ежедневная серия',
        subtitle: 'Сохраняйте серию и открывайте достижения.',
        days: 'дней',
        activeDays: 'активных дней',
        unlocked: 'открыто',
        nextMilestone: 'Следующая цель',
        allUnlocked: 'Все достижения серии открыты.',
        lastStudy: 'Последнее занятие',
        noActivity: 'Пока нет занятий',
        milestones: {
            streak_3: '3 дня',
            streak_7: '7 дней',
            streak_30: '30 дней',
        },
    },
};

const badgeMilestones: Array<{
    key: 'streak_3' | 'streak_7' | 'streak_30';
    days: number;
    icon: typeof Sparkles;
}> = [
    { key: 'streak_3', days: 3, icon: Sparkles },
    { key: 'streak_7', days: 7, icon: Target },
    { key: 'streak_30', days: 30, icon: Award },
];

export default function StreakCard({
    currentStreak,
    badges,
    activeDays,
    lastStudyDate,
    language,
}: StreakCardProps) {
    const t = copy[language];
    const badgeKeys = new Set(badges.map((badge) => badge.badge_key));
    const nextMilestone = badgeMilestones.find((milestone) => !badgeKeys.has(milestone.key));
    const progressValue = nextMilestone
        ? Math.min((currentStreak / nextMilestone.days) * 100, 100)
        : 100;
    const formatter = new Intl.DateTimeFormat(locales[language], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <section className="overflow-hidden rounded-[1.75rem] border border-primary-500/20 bg-gradient-to-br from-primary-600 via-primary-500 to-accent-500 p-5 text-white shadow-card">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                        <Flame className="h-3.5 w-3.5" />
                        {t.title}
                    </div>
                    <h2 className="mt-4 text-4xl font-black tracking-tight">
                        {currentStreak}
                        <span className="ml-2 text-lg font-semibold text-white/80">{t.days}</span>
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-white/85">{t.subtitle}</p>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/90">
                        <span className="rounded-full bg-white/15 px-3 py-1">
                            {activeDays} {t.activeDays}
                        </span>
                        <span className="rounded-full bg-white/15 px-3 py-1">
                            {t.lastStudy}:{' '}
                            {lastStudyDate
                                ? formatter.format(new Date(lastStudyDate))
                                : t.noActivity}
                        </span>
                    </div>
                </div>

                <div className="min-w-full rounded-2xl bg-white/12 p-4 backdrop-blur-sm lg:min-w-[280px]">
                    <div className="flex items-center justify-between text-sm text-white/85">
                        <span>{t.nextMilestone}</span>
                        <span>{nextMilestone ? `${nextMilestone.days} ${t.days}` : t.allUnlocked}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                        <div
                            className="h-full rounded-full bg-white transition-[width]"
                            style={{ width: `${progressValue}%` }}
                        />
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {badgeMilestones.map((milestone) => {
                            const Icon = milestone.icon;
                            const unlocked = badgeKeys.has(milestone.key);

                            return (
                                <div
                                    key={milestone.key}
                                    className={`rounded-2xl border px-4 py-3 transition-colors ${unlocked
                                        ? 'border-white/30 bg-white/20'
                                        : 'border-white/15 bg-black/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`rounded-xl p-2 ${unlocked ? 'bg-white text-primary-600' : 'bg-white/10 text-white/80'}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white">
                                                {t.milestones[milestone.key]}
                                            </p>
                                            <p className="text-xs text-white/75">
                                                {unlocked ? t.unlocked : `${currentStreak}/${milestone.days}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
