'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import SmartCard from '@/components/SmartCard';
import Link from 'next/link';
import { ArrowLeft, BookMarked } from 'lucide-react';

export default function FavoritesClient() {
    const { t, language } = useLanguage();
    const { terms, userProgress } = useSRS();

    // Get the terms that the user has favorited
    const favoriteTerms = terms.filter(term => userProgress.favorites.includes(term.id));

    return (
        <div className="page-content px-4 py-8 mb-20 max-w-4xl mx-auto min-h-screen">
            <header className="mb-8 hidden md:block">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {language === 'tr' ? 'Ana Sayfaya Dön' : language === 'ru' ? 'Вернуться на главную' : 'Back to Home'}
                </Link>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <BookMarked className="w-8 h-8 text-primary-500" />
                    {language === 'tr' ? 'Favorilerim' : language === 'ru' ? 'Мои избранные' : 'My Favorites'}
                </h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {language === 'tr' ? 'Öğrenmek için kaydettiğiniz tüm terimler.' : language === 'ru' ? 'Все термины, которые вы сохранили для изучения.' : 'All the terms you have saved for studying.'}
                </p>
            </header>

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-xl">
                        <BookMarked className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {language === 'tr' ? 'Favoriler' : language === 'ru' ? 'Избранные' : 'Favorites'}
                    </h1>
                </div>
            </header>

            <div className="space-y-4">
                {favoriteTerms.length > 0 ? (
                    favoriteTerms.map(term => (
                        <SmartCard key={term.id} term={term} />
                    ))
                ) : (
                    <div className="p-12 text-center rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 mt-8">
                        <BookMarked className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {language === 'tr' ? 'Henüz favori kelime yok' : language === 'ru' ? 'Пока нет избранных слов' : 'No favorite terms yet'}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                            {language === 'tr' ? 'Kelimeleri çalışırken yıldız ikonuna tıklayarak favorilerinize ekleyebilirsiniz.' : language === 'ru' ? 'Вы можете добавить слова в избранное, нажав на значок звезды во время изучения.' : 'You can add words to your favorites by clicking the star icon while studying.'}
                        </p>
                        <Link href="/search" className="inline-flex px-6 py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors shadow-sm">
                            {language === 'tr' ? 'Kelimeleri Keşfet' : language === 'ru' ? 'Изучать слова' : 'Explore Words'}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
