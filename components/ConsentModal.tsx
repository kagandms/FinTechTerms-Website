'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, Shield, X, Check } from 'lucide-react';

const CONSENT_KEY = 'fintechterms_research_consent';

interface ConsentData {
    given: boolean;
    timestamp: string;
    version: string;
}

export default function ConsentModal() {
    const { language } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Check if consent was already given
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        try {
            const stored = localStorage.getItem(CONSENT_KEY);
            if (!stored) {
                // Delay showing modal for better UX
                timer = setTimeout(() => setIsOpen(true), 1500);
            }
        } catch {
            // localStorage not available
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, []);

    const handleAccept = () => {
        const consentData: ConsentData = {
            given: true,
            timestamp: new Date().toISOString(),
            version: '1.0',
        };
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
        } catch {
            // Silently fail if localStorage not available
        }
        handleClose();
    };

    const handleDecline = () => {
        const consentData: ConsentData = {
            given: false,
            timestamp: new Date().toISOString(),
            version: '1.0',
        };
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
        } catch {
            // Silently fail
        }
        handleClose();
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 200);
    };

    if (!isOpen) return null;

    const content = {
        tr: {
            title: 'Akademik Araştırma Bildirimi',
            description: 'Bu uygulama, üniversite düzeyinde bir akademik araştırma projesi kapsamında geliştirilmiştir. Öğrenme deneyiminizi iyileştirmek ve bilimsel araştırma yapmak amacıyla anonim kullanım verileri toplanmaktadır.',
            dataCollected: 'Toplanan Veriler:',
            dataItems: [
                'Quiz cevap süreleri (milisaniye)',
                'Doğru/yanlış cevap oranları',
                'Oturum süreleri',
                'Tercih edilen dil',
            ],
            noPersonal: 'Kişisel bilgileriniz (e-posta, isim vb.) araştırma verileriyle ilişkilendirilmemektedir.',
            accept: 'Kabul Ediyorum',
            decline: 'Reddet',
        },
        en: {
            title: 'Academic Research Notice',
            description: 'This application is developed as part of a university-level academic research project. Anonymous usage data is collected to improve your learning experience and conduct scientific research.',
            dataCollected: 'Data Collected:',
            dataItems: [
                'Quiz response times (milliseconds)',
                'Correct/incorrect answer rates',
                'Session durations',
                'Preferred language',
            ],
            noPersonal: 'Your personal information (email, name, etc.) is not linked to research data.',
            accept: 'I Accept',
            decline: 'Decline',
        },
        ru: {
            title: 'Уведомление об исследовании',
            description: 'Это приложение разработано в рамках университетского академического исследовательского проекта. Анонимные данные об использовании собираются для улучшения вашего обучения и проведения научных исследований.',
            dataCollected: 'Собираемые данные:',
            dataItems: [
                'Время ответа на вопросы (миллисекунды)',
                'Соотношение правильных/неправильных ответов',
                'Продолжительность сеансов',
                'Предпочитаемый язык',
            ],
            noPersonal: 'Ваша личная информация (email, имя и т.д.) не связана с исследовательскими данными.',
            accept: 'Принимаю',
            decline: 'Отклонить',
        },
    };

    const t = content[language];

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'
                }`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleDecline}
            />

            {/* Modal */}
            <div
                className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-200 ${isClosing ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
                    }`}
            >
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-primary-500 to-blue-600 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold">{t.title}</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {t.description}
                    </p>

                    {/* Data collected list */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                            {t.dataCollected}
                        </p>
                        <ul className="space-y-1.5">
                            {t.dataItems.map((item, index) => (
                                <li
                                    key={index}
                                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Privacy note */}
                    <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
                        <p>{t.noPersonal}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                    <button
                        onClick={handleDecline}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                        {t.decline}
                    </button>
                    <button
                        onClick={handleAccept}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-md"
                    >
                        <Check className="w-4 h-4" />
                        {t.accept}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Check if user has given consent
 */
export function hasResearchConsent(): boolean {
    try {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (stored) {
            const data: ConsentData = JSON.parse(stored);
            return data.given === true;
        }
    } catch {
        // localStorage not available
    }
    return false;
}
