import React from 'react';
import { BrainCircuit, BookMarked, Trophy, BookOpen, RotateCcw, Target } from 'lucide-react';

interface StatsGridProps {
    stats: {
        totalFavorites: number;
        mastered: number;
        learning: number;
        dueToday: number;
    };
    totalReviews: number | null;
    accuracy: number | null;
    favoriteLimit: number;
    t: (key: string) => string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
    stats,
    totalReviews,
    accuracy,
    favoriteLimit,
    t
}) => {
    const showsFavoriteLimit = Number.isFinite(favoriteLimit);

    return (
        <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                {t('profile.statistics')}
            </h2>

            <div className="grid grid-cols-2 gap-4">
                {/* SRS Queue */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-xl">
                            <BrainCircuit className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.srsQueue')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.dueToday} <span className="text-sm font-normal text-gray-400 dark:text-gray-500">{t('profile.dueForReview')}</span>
                    </p>
                </div>

                {/* Favorites */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                            <BookMarked className="w-5 h-5 text-primary-500" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.favoriteCount')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.totalFavorites}
                        {showsFavoriteLimit && (
                            <span className="text-sm font-normal text-gray-400 dark:text-gray-500"> / {favoriteLimit}</span>
                        )}
                    </p>
                </div>

                {/* Mastered */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                            <Trophy className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.masteredWords')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.mastered}</p>
                </div>

                {/* Learning */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.learningWords')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.learning}</p>
                </div>

                {/* Total Reviews */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <RotateCcw className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.totalReviews')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalReviews ?? '—'}</p>
                </div>

                {/* Accuracy */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-accent-100 dark:bg-accent-900/30 rounded-xl">
                            <Target className="w-5 h-5 text-accent-500" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.accuracy')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {accuracy === null ? '—' : `%${accuracy}`}
                    </p>
                </div>
            </div>
        </section>
    );
};
