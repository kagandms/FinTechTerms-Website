'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSRS } from '@/contexts/SRSContext';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Search, BookOpen, User, BarChart2 } from 'lucide-react';

interface NavItem {
    href: string;
    labelKey: string;
    icon: React.ReactNode;
    badge?: number;
}

export default function BottomNav() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const { dueTerms } = useSRS();
    const { isAdmin } = useAuth();

    const navItems: NavItem[] = [
        {
            href: '/dashboard',
            labelKey: 'common.home',
            icon: <Home className="w-6 h-6" />,
        },
        {
            href: '/search',
            labelKey: 'common.search',
            icon: <Search className="w-6 h-6" />,
        },
        {
            href: '/quiz',
            labelKey: 'common.quiz',
            icon: <BookOpen className="w-6 h-6" />,
            badge: dueTerms.length > 0 ? dueTerms.length : undefined,
        },
        {
            href: '/profile',
            labelKey: 'common.profile',
            icon: <User className="w-6 h-6" />,
        },
    ];

    if (isAdmin) {
        navItems.push({
            href: '/admin/dashboard',
            labelKey: 'common.dashboard',
            icon: <BarChart2 className="w-6 h-6" />,
        });
    }

    return (
        <nav
            className="app-surface fixed bottom-0 left-0 right-0 z-50 border-t shadow-nav safe-area-bottom"
            aria-label={t('shell.navAria')}
        >
            <div className="max-w-lg mx-auto px-4">
                <div className="flex items-center justify-around">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex flex-col items-center justify-center py-2 px-3 min-w-[64px] transition-all duration-200 ${isActive
                                    ? 'text-primary-500'
                                    : 'app-text-secondary hover:text-gray-600 dark:hover:text-white'
                                    }`}
                            >
                                <div className="relative">
                                    <div className={`p-1 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary-50' : ''
                                        }`}>
                                        {item.icon}
                                    </div>

                                    {/* Badge for due items */}
                                    {item.badge && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-accent-500 text-white text-xs font-bold rounded-full px-1 animate-pulse-soft">
                                            {item.badge > 9 ? '9+' : item.badge}
                                        </span>
                                    )}
                                </div>

                                <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary-500' : 'app-text-secondary'
                                    }`}>
                                    {t(item.labelKey)}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
