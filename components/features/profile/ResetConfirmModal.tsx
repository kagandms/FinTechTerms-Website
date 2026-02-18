import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ResetConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    language: string;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    language
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <div className="flex items-center gap-3 text-red-500 mb-4">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="text-lg font-bold">
                        {language === 'tr' ? 'Dikkat!' : language === 'ru' ? 'Внимание!' : 'Warning!'}
                    </h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {language === 'tr'
                        ? 'Tüm ilerlemeniz, favorileriniz ve quiz geçmişiniz silinecek. Bu işlem geri alınamaz.'
                        : language === 'ru'
                            ? 'Весь ваш прогресс, избранное и история тестов будут удалены. Это действие необратимо.'
                            : 'All your progress, favorites and quiz history will be deleted. This action cannot be undone.'
                    }
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        {language === 'tr' ? 'İptal' : language === 'ru' ? 'Отмена' : 'Cancel'}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
                    >
                        {language === 'tr' ? 'Sıfırla' : language === 'ru' ? 'Сбросить' : 'Reset'}
                    </button>
                </div>
            </div>
        </div>
    );
};
