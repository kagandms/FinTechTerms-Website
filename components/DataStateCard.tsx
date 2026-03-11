'use client';

import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

type Tone = 'neutral' | 'warning' | 'error';

interface DataStateCardProps {
    title: string;
    description: string;
    action?: React.ReactNode;
    icon?: React.ReactNode;
    tone?: Tone;
    className?: string;
}

const toneStyles: Record<Tone, string> = {
    neutral: 'bg-gray-50 border-gray-200 text-gray-900 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white',
    warning: 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-900/10 dark:border-amber-800/50 dark:text-amber-100',
    error: 'bg-red-50 border-red-200 text-red-950 dark:bg-red-900/10 dark:border-red-800/50 dark:text-red-100',
};

const defaultIcons: Record<Tone, React.ReactNode> = {
    neutral: <AlertCircle className="w-10 h-10 text-primary-500" />,
    warning: <AlertTriangle className="w-10 h-10 text-amber-500" />,
    error: <AlertTriangle className="w-10 h-10 text-red-500" />,
};

export default function DataStateCard({
    title,
    description,
    action,
    icon,
    tone = 'neutral',
    className = '',
}: DataStateCardProps) {
    return (
        <div className={`rounded-2xl border p-6 text-center shadow-sm ${toneStyles[tone]} ${className}`.trim()}>
            <div className="flex justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/80 dark:bg-black/10">
                    {icon ?? defaultIcons[tone]}
                </div>
            </div>
            <h2 className="text-lg font-bold mb-2">{title}</h2>
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>
            {action ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {action}
                </div>
            ) : null}
        </div>
    );
}
