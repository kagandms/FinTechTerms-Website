import React, { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTranslationString } from '@/lib/i18n';
import type { Language } from '@/types';
import { useAccessibleDialog } from '@/hooks/use-accessible-dialog';

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
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const {
        dialogRef,
        titleId,
        descriptionId,
    } = useAccessibleDialog({
        isOpen,
        onClose,
        initialFocusRef: closeButtonRef,
    });
    if (!isOpen) return null;

    const copy = {
        title: getTranslationString(language, 'resetConfirm.title') ?? 'Warning!',
        description: getTranslationString(language, 'resetConfirm.description')
            ?? 'All your progress, favorites and quiz history will be deleted. This action cannot be undone.',
        cancel: getTranslationString(language, 'resetConfirm.cancel') ?? 'Cancel',
        confirm: getTranslationString(language, 'resetConfirm.confirm') ?? 'Reset',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-3 text-red-500 mb-4">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 id={titleId} className="text-lg font-bold">
                        {copy.title}
                    </h3>
                </div>

                <p id={descriptionId} className="text-gray-600 dark:text-gray-300 mb-6">
                    {copy.description}
                </p>

                <div className="flex gap-3">
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        {copy.cancel}
                    </button>
                    <button
                        type="button"
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
