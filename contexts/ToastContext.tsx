'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

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

const TOAST_DURATION = 3000;

const toastIcons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
};

const toastStyles: Record<ToastType, string> = {
    success: 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-900/50 border-amber-200 dark:border-amber-800',
    info: 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800',
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
            console.error('TOAST_PERSIST_FAILED', error);
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
            console.error('TOAST_RESTORE_FAILED', error);
        } finally {
            window.sessionStorage.removeItem(TOAST_STORAGE_KEY);
        }
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, showToastAfterRefresh }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 max-w-sm w-full px-4">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 p-4 rounded-xl shadow-lg border animate-toast-in ${toastStyles[toast.type]}`}
                    >
                        {toastIcons[toast.type]}
                        <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                            {toast.message}
                        </p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
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
