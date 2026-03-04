'use client';

/**
 * HomeHeader — Extracted Header Components (M51)
 * Skill: code-refactoring-refactor-clean, react-best-practices
 *
 * Separates mobile and desktop headers from HomeClient.tsx
 * for better maintainability and readability.
 */

import React from 'react';
import Image from 'next/image';
import { Flame, Sun, Moon, Send } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import InstallButton from '@/components/InstallButton';

interface HeaderProps {
    t: (key: string) => string;
    resolvedTheme: string | undefined;
    toggleTheme: () => void;
    streak?: number;
}

/**
 * Compact mobile header — shown on screens < md breakpoint.
 */
export function MobileHeader({ t, resolvedTheme, toggleTheme }: HeaderProps) {
    return (
        <header className="flex md:hidden items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <Image
                    src="/ftt.png"
                    alt="FinTechTerms Logo"
                    height={56}
                    width={56}
                    className="w-14 h-14 object-contain"
                    priority
                />
                <div className="min-w-0">
                    <h1 className="text-xl font-bold text-primary-500 dark:text-primary-400 leading-tight truncate">
                        FinTechTerms
                    </h1>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                        {t('home.subtitle')}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <a
                    href="https://t.me/FinTechTermsBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 transition-colors shadow-sm"
                    aria-label="Telegram Bot"
                >
                    <Send className="w-4 h-4 text-white" />
                </a>
                <InstallButton />
                <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle theme"
                >
                    {resolvedTheme === 'dark' ? (
                        <Sun className="w-4 h-4 text-yellow-500" />
                    ) : (
                        <Moon className="w-4 h-4 text-gray-600" />
                    )}
                </button>
                <LanguageSwitcher />
            </div>
        </header>
    );
}

/**
 * Full-width desktop header with hero styling — shown on screens >= md.
 */
export function DesktopHeader({ t, resolvedTheme, toggleTheme, streak = 0 }: HeaderProps) {
    return (
        <header className="hidden md:flex items-center justify-between mb-12 py-8 border-b border-gray-100 dark:border-primary-800 bg-white/50 dark:bg-primary-900/50 backdrop-blur-sm -mx-4 px-8 rounded-b-3xl shadow-sm relative z-50">
            <div className="flex items-center gap-8">
                <div className="relative group shrink-0">
                    <div className="relative w-40 h-40 transition-transform duration-500 group-hover:scale-105">
                        <Image
                            src="/ftt.png"
                            alt="FinTechTerms Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>
                <div className="flex flex-col justify-center h-40">
                    <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 tracking-tighter mb-2">
                        FinTechTerms
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 font-medium max-w-md leading-relaxed">
                        {t('home.subtitle')}
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-end gap-6 h-40 justify-center">
                {/* Streak Badge */}
                <div className="px-6 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{t('profile.days')}</span>
                        <span className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" />
                            {streak}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    <a
                        href="https://t.me/FinTechTermsBot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-all border border-sky-400 shadow-sm hover:shadow-md"
                        aria-label="Telegram Bot"
                    >
                        <Send className="w-5 h-5" />
                    </a>
                    <InstallButton />

                    <div className="h-10 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                    <button
                        onClick={toggleTheme}
                        className="p-3 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-all border border-gray-100 dark:border-gray-700 shadow-sm"
                        aria-label="Toggle theme"
                    >
                        {resolvedTheme === 'dark' ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>
                    <LanguageSwitcher />
                </div>
            </div>
        </header>
    );
}
