import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTranslationString } from '@/lib/i18n';
import type { Language } from '@/types';

interface ResetConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    language: Language;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    language
}) => {
    if (!isOpen) return null;

    const copy = {
        title: getTranslationString(language, 'resetConfirm.title') ?? 'Warning!',
        description: getTranslationString(language, 'resetConfirm.description')
            ?? 'All your progress, favorites and quiz history will be deleted. This action cannot be undone.',
        cancel: getTranslationString(language, 'resetConfirm.cancel') ?? 'Cancel',
        confirm: getTranslationString(language, 'resetConfirm.confirm') ?? 'Reset',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <div className="flex items-center gap-3 text-red-500 mb-4">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="text-lg font-bold">
                        {copy.title}
                    </h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {copy.description}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        {copy.cancel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
                    >
                        {copy.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
};
