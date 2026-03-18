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
    const { user } = useAuth();
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

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

    if (user?.email && ADMIN_EMAIL && user.email === ADMIN_EMAIL) {
        navItems.push({
            href: '/admin/dashboard',
            labelKey: 'common.dashboard',
            icon: <BarChart2 className="w-6 h-6" />,
        });
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-nav safe-area-bottom" aria-label="Основная навигация">
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
                                    : 'text-gray-400 hover:text-gray-600'
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

                                <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary-500' : 'text-gray-500'
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
