'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { logger } from '@/lib/logger';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TOAST_STORAGE_KEY = 'ftt_pending_toast';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showToastAfterRefresh: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION = 3600;

const toastIcons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />,
    error: <XCircle className="w-5 h-5 text-red-600 dark:text-red-300" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-300" />,
    info: <Info className="w-5 h-5 text-blue-600 dark:text-blue-300" />,
};

const toastStyles: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 dark:bg-slate-900 dark:border-green-500/40',
    error: 'bg-red-50 border-red-200 dark:bg-slate-900 dark:border-red-500/40',
    warning: 'bg-amber-50 border-amber-200 dark:bg-slate-900 dark:border-amber-500/40',
    info: 'bg-blue-50 border-blue-200 dark:bg-slate-900 dark:border-blue-500/40',
};

const toastTextStyles: Record<ToastType, string> = {
    success: 'text-green-900 dark:text-green-50',
    error: 'text-red-900 dark:text-red-50',
    warning: 'text-amber-900 dark:text-amber-50',
    info: 'text-blue-900 dark:text-blue-50',
};

const toastCloseStyles: Record<ToastType, string> = {
    success: 'text-green-400 hover:text-green-700 dark:text-green-200 dark:hover:text-white',
    error: 'text-red-400 hover:text-red-700 dark:text-red-200 dark:hover:text-white',
    warning: 'text-amber-400 hover:text-amber-700 dark:text-amber-200 dark:hover:text-white',
    info: 'text-blue-400 hover:text-blue-700 dark:text-blue-200 dark:hover:text-white',
};

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timeoutMapRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    React.useEffect(() => () => {
        Object.values(timeoutMapRef.current).forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        timeoutMapRef.current = {};
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `toast_${Date.now()}`;
        const newToast: Toast = { id, message, type };

        setToasts(prev => [...prev, newToast]);

        timeoutMapRef.current[id] = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            delete timeoutMapRef.current[id];
        }, TOAST_DURATION);
    }, []);

    const removeToast = useCallback((id: string) => {
        const timeoutId = timeoutMapRef.current[id];
        if (timeoutId) {
            clearTimeout(timeoutId);
            delete timeoutMapRef.current[id];
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToastAfterRefresh = useCallback((message: string, type: ToastType = 'info') => {
        if (typeof window === 'undefined') {
            showToast(message, type);
            return;
        }

        try {
            window.sessionStorage.setItem(
                TOAST_STORAGE_KEY,
                JSON.stringify({ message, type })
            );
        } catch (error) {
            logger.error('TOAST_PERSIST_FAILED', {
                route: 'ToastProvider',
                error: error instanceof Error ? error : undefined,
            });
            showToast(message, type);
        }
    }, [showToast]);

    React.useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const rawToast = window.sessionStorage.getItem(TOAST_STORAGE_KEY);
        if (!rawToast) {
            return;
        }

        try {
            const parsed = JSON.parse(rawToast) as Partial<Toast>;
            if (parsed.message) {
                showToast(
                    parsed.message,
                    (parsed.type as ToastType | undefined) || 'info'
                );
            }
        } catch (error) {
            logger.error('TOAST_RESTORE_FAILED', {
                route: 'ToastProvider',
                error: error instanceof Error ? error : undefined,
            });
        } finally {
            window.sessionStorage.removeItem(TOAST_STORAGE_KEY);
        }
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, showToastAfterRefresh }}>
            {children}

            {/* Toast Container */}
            <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2 md:top-6">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto ml-auto flex w-full items-center gap-3 rounded-xl border p-3 shadow-lg animate-toast-in ${toastStyles[toast.type]}`}
                    >
                        {toastIcons[toast.type]}
                        <p className={`flex-1 text-sm font-medium ${toastTextStyles[toast.type]}`}>
                            {toast.message}
                        </p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className={`transition-colors ${toastCloseStyles[toast.type]}`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
