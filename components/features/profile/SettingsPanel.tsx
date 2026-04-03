import React from 'react';
import Link from 'next/link';
import {
    Globe, Moon, Sun, Monitor, BarChart3, Info, Brain, RotateCcw, ChevronRight
} from 'lucide-react';
import { Language } from '@/types';
import { languageNames, languageFlags } from '@/contexts/LanguageContext';
import NotificationSettings from '@/components/NotificationSettings';

import { Theme } from '@/contexts/ThemeContext';

interface ProfileEditorSection {
    readonly title: string;
    readonly description: string;
    readonly isOpen: boolean;
    readonly toggleLabel: string;
    readonly onToggle: () => void;
    readonly content: React.ReactNode;
    readonly toggleTestId?: string;
}

interface SettingsPanelProps {
    t: (key: string) => string;
    language: Language;
    setLanguage: (lang: Language) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    onResetClick: () => void;
    profileEditorSection?: ProfileEditorSection;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    onResetClick,
    profileEditorSection,
}) => {
    return (
        <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                {t('common.settings')}
            </h2>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {profileEditorSection ? (
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    {profileEditorSection.title}
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {profileEditorSection.description}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={profileEditorSection.onToggle}
                                data-testid={profileEditorSection.toggleTestId}
                                aria-expanded={profileEditorSection.isOpen}
                                aria-controls="profile-editor-panel"
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                                <ChevronRight className={`w-4 h-4 transition-transform ${profileEditorSection.isOpen ? 'rotate-90' : ''}`} />
                                {profileEditorSection.toggleLabel}
                            </button>
                        </div>

                        {profileEditorSection.isOpen ? (
                            <div id="profile-editor-panel" className="mt-5">
                                {profileEditorSection.content}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {/* Language Selection */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">{t('profile.language')}</span>
                    </div>

                    <div className="flex gap-2">
                        {(['ru', 'en', 'tr'] as Language[]).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${language === lang
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <span>{languageFlags[lang]}</span>
                                <span className="text-sm">{languageNames[lang].native}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Theme Selection */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-3">
                        {theme === 'dark' ? (
                            <Moon className="w-5 h-5 text-gray-400" />
                        ) : theme === 'light' ? (
                            <Sun className="w-5 h-5 text-gray-400" />
                        ) : (
                            <Monitor className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                            {t('settingsPanel.theme')}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setTheme('light')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${theme === 'light'
                                ? 'bg-primary-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <Sun className="w-4 h-4" />
                            <span className="text-sm">
                                {t('settingsPanel.light')}
                            </span>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${theme === 'dark'
                                ? 'bg-primary-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <Moon className="w-4 h-4" />
                            <span className="text-sm">
                                {t('settingsPanel.dark')}
                            </span>
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${theme === 'system'
                                ? 'bg-primary-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <Monitor className="w-4 h-4" />
                            <span className="text-sm">
                                {t('settingsPanel.system')}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Notification Settings */}
                <NotificationSettings language={language} />

                {/* Analytics */}
                <Link
                    href="/analytics"
                    className="w-full p-4 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">
                            {t('settingsPanel.analytics')}
                        </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>

                {/* About */}
                <Link
                    href="/profile/about"
                    className="w-full p-4 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-3">
                        <Info className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">{t('about.viewAbout')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>

                {/* Methodology */}
                <Link
                    href="/profile/methodology"
                    className="w-full p-4 flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-3">
                        <Brain className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">
                            {t('settingsPanel.methodology')}
                        </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>

                {/* Reset Data */}
                <button
                    onClick={onResetClick}
                    className="w-full p-4 flex items-center justify-between text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <RotateCcw className="w-5 h-5" />
                        <span className="font-medium">{t('profile.resetData')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </section>
    );
};
