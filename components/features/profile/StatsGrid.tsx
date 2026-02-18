import React from 'react';
import { Flame, BookMarked, Trophy, BookOpen, RotateCcw, Target } from 'lucide-react';

interface StatsGridProps {
    userProgress: {
        current_streak: number;
    };
    stats: {
        totalFavorites: number;
        mastered: number;
        learning: number;
    };
    totalReviews: number;
    accuracy: number;
    isAuthenticated: boolean;
    t: (key: string) => string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
    userProgress,
    stats,
    totalReviews,
    accuracy,
    isAuthenticated,
    t
}) => {
    return (
        <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                {t('profile.statistics')}
            </h2>

            <div className="grid grid-cols-2 gap-4">
                {/* Streak */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                            <Flame className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.currentStreak')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {userProgress.current_streak} <span className="text-sm font-normal text-gray-400">{t('profile.days')}</span>
                    </p>
                </div>

                {/* Favorites */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary-100 rounded-xl">
                            <BookMarked className="w-5 h-5 text-primary-500" />
                        </div>
                        <span className="text-sm text-gray-500">{t('profile.favoriteCount')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {stats.totalFavorites}
                        {!isAuthenticated && (
                            <span className="text-sm font-normal text-gray-400"> / 50</span>
                        )}
                    </p>
                </div>

                {/* Mastered */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-xl">
                            <Trophy className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-sm text-gray-500">{t('profile.masteredWords')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.mastered}</p>
                </div>

                {/* Learning */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-xl">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className="text-sm text-gray-500">{t('profile.learningWords')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.learning}</p>
                </div>

                {/* Total Reviews */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-xl">
                            <RotateCcw className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className="text-sm text-gray-500">{t('profile.totalReviews')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
                </div>

                {/* Accuracy */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-accent-100 rounded-xl">
                            <Target className="w-5 h-5 text-accent-500" />
                        </div>
                        <span className="text-sm text-gray-500">{t('profile.accuracy')}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">%{accuracy}</p>
                </div>
            </div>
        </section>
    );
};
